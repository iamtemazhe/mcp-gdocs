import { google } from "googleapis";
import { GoogleAuth, OAuth2Client, JWT } from "google-auth-library";
import type { docs_v1, drive_v3 } from "googleapis";
import { existsSync } from "node:fs";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";
import { homedir } from "node:os";
import { createServer } from "node:http";

const SCOPES = [
  "https://www.googleapis.com/auth/documents",
  "https://www.googleapis.com/auth/drive",
];

const CONFIG_DIR_NAME = "mcp-gdocs";

interface ServiceAccountCredentials {
  readonly client_email: string;
  readonly private_key: string;
  readonly [key: string]: unknown;
}

interface OAuthClientSecrets {
  readonly clientId: string;
  readonly clientSecret: string;
}

interface SavedToken {
  readonly type: string;
  readonly client_id: string;
  readonly client_secret: string;
  readonly refresh_token: string;
}

// ── Paths ──────────────────────────────────────────────────────────

function getConfigDir(): string {
  const xdg = process.env.XDG_CONFIG_HOME;
  const base = xdg || join(homedir(), ".config");
  const baseDir = join(base, CONFIG_DIR_NAME);
  const profile = process.env.GOOGLE_MCP_PROFILE;
  return profile ? join(baseDir, profile) : baseDir;
}

function getTokenPath(): string {
  return join(getConfigDir(), "token.json");
}

// ── OAuth helpers ──────────────────────────────────────────────────

function loadOAuthClientSecrets(): OAuthClientSecrets | null {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (clientId && clientSecret) {
    return { clientId, clientSecret };
  }
  return null;
}

async function loadSavedToken(): Promise<OAuth2Client | null> {
  const secrets = loadOAuthClientSecrets();
  if (!secrets) {
    return null;
  }

  const tokenPath = getTokenPath();
  try {
    const content = await readFile(tokenPath, "utf-8");
    const token = JSON.parse(content) as SavedToken;
    const client = new google.auth.OAuth2(
      secrets.clientId,
      secrets.clientSecret,
    );
    client.setCredentials({
      refresh_token: token.refresh_token,
    });
    return client;
  } catch {
    return null;
  }
}

async function saveToken(client: OAuth2Client): Promise<void> {
  const secrets = loadOAuthClientSecrets();
  if (!secrets) {
    return;
  }

  const configDir = getConfigDir();
  await mkdir(configDir, { recursive: true });

  const payload: SavedToken = {
    type: "authorized_user",
    client_id: secrets.clientId,
    client_secret: secrets.clientSecret,
    refresh_token: client.credentials.refresh_token ?? "",
  };

  await writeFile(
    getTokenPath(),
    JSON.stringify(payload, null, 2),
  );
}

/**
 * Интерактивный OAuth-flow через браузер.
 * Поднимает локальный HTTP-сервер, ждёт callback с кодом.
 */
async function interactiveOAuthFlow(): Promise<OAuth2Client> {
  const secrets = loadOAuthClientSecrets();
  if (!secrets) {
    throw new Error(
      "OAuth credentials not found. "
      + "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.",
    );
  }

  const server = createServer();
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", resolve),
  );
  const port = (server.address() as { port: number }).port;
  const redirectUri = `http://127.0.0.1:${port}`;

  const oAuth2Client = new google.auth.OAuth2(
    secrets.clientId,
    secrets.clientSecret,
    redirectUri,
  );

  const authorizeUrl = oAuth2Client.generateAuthUrl({
    access_type: "offline",
    scope: SCOPES.join(" "),
  });

  console.error(`\nOpen this URL to authorize:\n${authorizeUrl}\n`);

  const code = await new Promise<string>((resolve, reject) => {
    server.on("request", (req, res) => {
      const url = new URL(
        req.url ?? "/",
        `http://127.0.0.1:${port}`,
      );
      const authCode = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h1>Authorization failed</h1>");
        reject(new Error(`Authorization error: ${error}`));
        server.close();
        return;
      }

      if (authCode) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(
          "<h1>Authorization successful!</h1>"
          + "<p>You can close this tab.</p>",
        );
        resolve(authCode);
        server.close();
      }
    });
  });

  const { tokens } = await oAuth2Client.getToken(code);
  oAuth2Client.setCredentials(tokens);

  if (tokens.refresh_token) {
    await saveToken(oAuth2Client);
  } else {
    console.error(
      "Warning: no refresh_token received. "
      + "Token may expire without auto-renewal.",
    );
  }

  return oAuth2Client;
}

// ── Service Account helpers ────────────────────────────────────────

function createAuthFromBase64(encoded: string): GoogleAuth {
  let json: string;
  try {
    json = Buffer.from(encoded, "base64").toString("utf-8");
  } catch {
    throw new Error(
      "CREDENTIALS_CONFIG: failed to decode base64",
    );
  }

  let credentials: ServiceAccountCredentials;
  try {
    credentials = JSON.parse(json) as ServiceAccountCredentials;
  } catch {
    throw new Error(
      "CREDENTIALS_CONFIG: decoded string is not valid JSON",
    );
  }

  if (!credentials.client_email || !credentials.private_key) {
    throw new Error(
      "CREDENTIALS_CONFIG: JSON missing "
      + "client_email / private_key",
    );
  }

  return new GoogleAuth({ credentials, scopes: SCOPES });
}

function createServiceAccountAuth(
  keyFile: string,
): GoogleAuth {
  if (!existsSync(keyFile)) {
    throw new Error(
      `Credentials file not found: ${keyFile}`,
    );
  }
  return new GoogleAuth({ keyFile, scopes: SCOPES });
}

async function createServiceAccountJwt(
  keyFile: string,
): Promise<JWT> {
  const content = await readFile(keyFile, "utf-8");
  const key = JSON.parse(content) as ServiceAccountCredentials;
  const impersonateUser = process.env.GOOGLE_IMPERSONATE_USER;

  const auth = new JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: SCOPES,
    subject: impersonateUser,
  });
  await auth.authorize();
  return auth;
}

// ── Main auth resolution ───────────────────────────────────────────

type AuthClient = GoogleAuth | OAuth2Client | JWT;

let cachedAuth: AuthClient | null = null;

/**
 * Приоритет аутентификации:
 *  1. OAuth (GOOGLE_CLIENT_ID + GOOGLE_CLIENT_SECRET) — saved token
 *  2. SERVICE_ACCOUNT_PATH — SA с JWT (+ impersonation)
 *  3. CREDENTIALS_CONFIG — base64-encoded SA JSON
 *  4. GOOGLE_APPLICATION_CREDENTIALS — путь к SA JSON
 *  5. ADC fallback
 */
async function resolveAuth(): Promise<AuthClient> {
  if (cachedAuth) {
    return cachedAuth;
  }

  // 1. OAuth — saved token
  const oauthClient = await loadSavedToken();
  if (oauthClient) {
    cachedAuth = oauthClient;
    return cachedAuth;
  }

  // 2. Service Account с JWT (поддержка impersonation)
  const serviceAccountPath = process.env.SERVICE_ACCOUNT_PATH;
  if (serviceAccountPath) {
    cachedAuth = await createServiceAccountJwt(
      serviceAccountPath,
    );
    return cachedAuth;
  }

  // 3. CREDENTIALS_CONFIG (base64)
  const credentialsConfig = process.env.CREDENTIALS_CONFIG;
  if (credentialsConfig) {
    cachedAuth = createAuthFromBase64(credentialsConfig);
    return cachedAuth;
  }

  // 4. GOOGLE_APPLICATION_CREDENTIALS
  const keyFile = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  if (keyFile) {
    cachedAuth = createServiceAccountAuth(keyFile);
    return cachedAuth;
  }

  // 5. ADC fallback
  cachedAuth = new GoogleAuth({ scopes: SCOPES });
  return cachedAuth;
}

// ── Retry ──────────────────────────────────────────────────────────

const RETRY_CONFIG = {
  retry: 3,
  retryDelayMultiplier: 2,
  maxRetryDelay: 32_000,
  statusCodesToRetry: [
    [429, 429],
    [500, 599],
  ] as [number, number][],
  httpMethodsToRetry: [
    "GET", "HEAD", "PUT", "OPTIONS",
    "DELETE", "POST", "PATCH",
  ],
};

// ── Public API ─────────────────────────────────────────────────────

export async function authorize(): Promise<void> {
  await resolveAuth();
}

export async function runAuthFlow(): Promise<void> {
  await interactiveOAuthFlow();
}

let cachedDocs: docs_v1.Docs | null = null;
let cachedDrive: drive_v3.Drive | null = null;

export async function getDocsService(): Promise<docs_v1.Docs> {
  if (cachedDocs) return cachedDocs;
  const auth = await resolveAuth();
  cachedDocs = google.docs({
    version: "v1",
    auth: auth as GoogleAuth,
    retryConfig: RETRY_CONFIG,
  });
  return cachedDocs;
}

export async function getDriveService(): Promise<drive_v3.Drive> {
  if (cachedDrive) return cachedDrive;
  const auth = await resolveAuth();
  cachedDrive = google.drive({
    version: "v3",
    auth: auth as GoogleAuth,
    retryConfig: RETRY_CONFIG,
  });
  return cachedDrive;
}

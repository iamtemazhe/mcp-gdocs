#!/usr/bin/env node

import { createRequire } from "node:module";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { authorize, runAuthFlow } from "./auth.js";
import { registerDocsReadTools } from "./tools/docsRead.js";
import { registerDocsWriteTools } from "./tools/docsWrite.js";
import { registerDocsFormatTools } from "./tools/docsFormat.js";
import { registerDocsTableTools } from "./tools/docsTables.js";
import { registerDocsImageTools } from "./tools/docsImages.js";
import { registerDocsMarkdownNativeTools } from "./tools/docsMarkdownNative.js";
import { registerDocsCommentTools } from "./tools/docsComments.js";
import { registerDocsBatchTools } from "./tools/docsBatch.js";
import { registerDocsFormatByTextTools } from "./tools/docsFormatByText.js";
import { registerDocsNamedRangeTools } from "./tools/docsNamedRanges.js";
import { registerDriveTools } from "./tools/drive.js";
import { registerResources } from "./resources.js";
import { registerPrompts } from "./prompts.js";
import { installToolsListCache } from "./utils/toolsListCache.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json") as {
  version: string;
};

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err.message);
  if (err instanceof Error && err.stack) {
    console.error(err.stack);
  }
});
process.on("unhandledRejection", (reason) => {
  if (reason instanceof Error) {
    console.error("Unhandled rejection:", reason.message);
    if (reason.stack) {
      console.error(reason.stack);
    }
  } else {
    console.error("Unhandled rejection:", reason);
  }
});

// ── Auth CLI subcommand ────────────────────────────────────────────

if (process.argv[2] === "auth") {
  try {
    await runAuthFlow();
    console.error("Authorization complete. Token saved.");
    process.exit(0);
  } catch (error: unknown) {
    const message = error instanceof Error
      ? error.message
      : String(error);
    console.error("Authorization failed:", message);
    process.exit(1);
  }
}

// ── Server startup ─────────────────────────────────────────────────

const server = new McpServer(
  {
    name: "mcp-gdocs",
    version,
  },
  {
    capabilities: {
      tools: { listChanged: true },
      resources: { listChanged: true },
      prompts: { listChanged: true },
      logging: {},
    },
  },
);

registerDocsReadTools(server);
registerDocsWriteTools(server);
registerDocsFormatTools(server);
registerDocsTableTools(server);
registerDocsImageTools(server);
registerDocsMarkdownNativeTools(server);
registerDocsCommentTools(server);
registerDocsBatchTools(server);
registerDocsFormatByTextTools(server);
registerDocsNamedRangeTools(server);
registerDriveTools(server);
registerResources(server);
registerPrompts(server);

async function main(): Promise<void> {
  await authorize();
  const transport = new StdioServerTransport();
  await server.connect(transport);
  installToolsListCache(server);
}

main().catch((error: unknown) => {
  const message = error instanceof Error
    ? error.message
    : String(error);
  console.error("Server startup error:", message);
  process.exit(1);
});

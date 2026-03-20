#!/usr/bin/env node

process.on("uncaughtException", (err) => {
  console.error("Uncaught exception:", err.message);
});
process.on("unhandledRejection", (reason) => {
  console.error("Unhandled rejection:", reason);
});

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { authorize, runAuthFlow } from "./auth.js";
import { registerDocsReadTools } from "./tools/docsRead.js";
import { registerDocsWriteTools } from "./tools/docsWrite.js";
import { registerDocsFormatTools } from "./tools/docsFormat.js";
import { registerDocsTableTools } from "./tools/docsTables.js";
import { registerDocsImageTools } from "./tools/docsImages.js";
import { registerDocsMarkdownTools } from "./tools/docsMarkdown.js";
import { registerDocsCommentTools } from "./tools/docsComments.js";
import { registerDocsBatchTools } from "./tools/docsBatch.js";
import { registerDriveTools } from "./tools/drive.js";

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
    version: "1.0.0",
  },
  {
    capabilities: {
      logging: {},
    },
  },
);

registerDocsReadTools(server);
registerDocsWriteTools(server);
registerDocsFormatTools(server);
registerDocsTableTools(server);
registerDocsImageTools(server);
registerDocsMarkdownTools(server);
registerDocsCommentTools(server);
registerDocsBatchTools(server);
registerDriveTools(server);

async function main(): Promise<void> {
  await authorize();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((error: unknown) => {
  const message = error instanceof Error
    ? error.message
    : String(error);
  console.error("Server startup error:", message);
  process.exit(1);
});

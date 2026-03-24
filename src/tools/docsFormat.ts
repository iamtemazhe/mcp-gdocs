import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleTool, textResult } from "../utils/errors.js";
import {
  sendBatchedRequests,
  tabIdParam,
  injectTabId,
} from "../utils/batch.js";
import {
  indexedTextStyleSchema,
  indexedParagraphStyleSchema,
  indexedHeadingStyleSchema,
  buildTextStyleRequest,
  buildParagraphStyleRequest,
  buildHeadingStyleRequest,
} from "../utils/styleBuilders.js";

export function registerDocsFormatTools(
  server: McpServer,
): void {
  server.registerTool(
    "docs_apply_text_style",
    {
      title: "Apply Text Style",
      description:
        "Bulk character styles on index ranges.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        items: z.array(indexedTextStyleSchema).min(1)
          .describe("Style ranges"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ documentId, tabId, items }) => {
      const requests = items.map(buildTextStyleRequest);
      await sendBatchedRequests(
        documentId, injectTabId(requests, tabId),
      );

      return textResult(
        `Text style applied to ${items.length} range(s)`,
      );
    }),
  );

  server.registerTool(
    "docs_apply_paragraph_style",
    {
      title: "Apply Paragraph Style",
      description:
        "Bulk paragraph styles on ranges.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        items: z.array(indexedParagraphStyleSchema).min(1)
          .describe("Paragraph ranges"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ documentId, tabId, items }) => {
      const requests =
        items.map(buildParagraphStyleRequest);
      await sendBatchedRequests(
        documentId, injectTabId(requests, tabId),
      );

      return textResult(
        `Paragraph style applied to ${items.length} range(s)`,
      );
    }),
  );

  server.registerTool(
    "docs_apply_heading_style",
    {
      title: "Apply Heading Style",
      description:
        "Bulk heading level on ranges (H1–H6, NORMAL).",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        items: z.array(indexedHeadingStyleSchema).min(1)
          .describe("Heading ranges"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ documentId, tabId, items }) => {
      const requests =
        items.map(buildHeadingStyleRequest);
      await sendBatchedRequests(
        documentId, injectTabId(requests, tabId),
      );

      return textResult(
        `Heading style applied to ${items.length} range(s)`,
      );
    }),
  );
}

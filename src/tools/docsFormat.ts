import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { documentIdParam } from "../utils/schemas.js";
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
        "Apply character formatting (bold, italic, font, color) to explicit "
        + "index ranges.",
      inputSchema: {
        documentId: documentIdParam,
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
        "Apply paragraph formatting (alignment, spacing, indentation) to "
        + "index ranges.",
      inputSchema: {
        documentId: documentIdParam,
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
        "Set named heading levels (HEADING_1 … HEADING_6 or NORMAL) on "
        + "paragraph ranges. "
        + "Get ranges from docs_read_document(format:'json'). "
        + "For bullet lists use docs_batch_update (createParagraphBullets).",
      inputSchema: {
        documentId: documentIdParam,
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

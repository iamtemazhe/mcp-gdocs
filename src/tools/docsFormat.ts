import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleTool, textResult } from "../utils/errors.js";
import {
  sendBatchedRequests,
  tabIdParam,
  injectTabId,
} from "../utils/batch.js";
import {
  textStyleItemSchema,
  paragraphStyleItemSchema,
  headingStyleItemSchema,
  buildTextStyleRequest,
  buildParagraphStyleRequest,
  buildHeadingStyleRequest,
} from "../utils/styleBuilders.js";

const INDEX_FROM_JSON_DOC =
  "Get from docs_read_document (format: json)";

const docsFormatTextStyleItemSchema =
  textStyleItemSchema.extend({
    startIndex: z.number().int().min(1).describe(
      INDEX_FROM_JSON_DOC,
    ),
    endIndex: z.number().int().min(2).describe(
      INDEX_FROM_JSON_DOC,
    ),
  });

const docsFormatParagraphStyleItemSchema =
  paragraphStyleItemSchema.extend({
    startIndex: z.number().int().min(1).describe(
      INDEX_FROM_JSON_DOC,
    ),
    endIndex: z.number().int().min(2).describe(
      INDEX_FROM_JSON_DOC,
    ),
  });

const docsFormatHeadingStyleItemSchema =
  headingStyleItemSchema.extend({
    startIndex: z.number().int().min(1).describe(
      INDEX_FROM_JSON_DOC,
    ),
    endIndex: z.number().int().min(2).describe(
      INDEX_FROM_JSON_DOC,
    ),
  });

export function registerDocsFormatTools(
  server: McpServer,
): void {
  server.tool(
    "docs_apply_text_style",
    "Apply text formatting (bold, italic, underline, "
      + "strikethrough, font, size, color). Get startIndex/"
      + "endIndex from docs_read_document (format: json)",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      items: z.array(docsFormatTextStyleItemSchema).min(1)
        .describe("Array of ranges with styles to apply"),
    },
    handleTool(async ({ documentId, tabId, items }) => {
      const requests = items.map(buildTextStyleRequest);
      await sendBatchedRequests(
        documentId, injectTabId(requests, tabId),
      );

      return textResult(
        `Стиль текста применён к `
          + `${items.length} диапазонам`,
      );
    }),
  );

  server.tool(
    "docs_apply_paragraph_style",
    "Apply paragraph formatting (alignment, spacing, "
      + "indentation). Get startIndex/endIndex from "
      + "docs_read_document (format: json)",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      items: z.array(docsFormatParagraphStyleItemSchema).min(1)
        .describe(
          "Array of ranges with paragraph styles",
        ),
    },
    handleTool(async ({ documentId, tabId, items }) => {
      const requests =
        items.map(buildParagraphStyleRequest);
      await sendBatchedRequests(
        documentId, injectTabId(requests, tabId),
      );

      return textResult(
        `Стиль абзаца применён к `
          + `${items.length} диапазонам`,
      );
    }),
  );

  server.tool(
    "docs_apply_heading_style",
    "Set heading level (HEADING_1..6 or NORMAL_TEXT). Get "
      + "startIndex/endIndex from docs_read_document (format: "
      + "json)",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      items: z.array(docsFormatHeadingStyleItemSchema).min(1)
        .describe(
          "Array of ranges with heading styles",
        ),
    },
    handleTool(async ({ documentId, tabId, items }) => {
      const requests =
        items.map(buildHeadingStyleRequest);
      await sendBatchedRequests(
        documentId, injectTabId(requests, tabId),
      );

      return textResult(
        `Стиль заголовков применён к `
          + `${items.length} диапазонам`,
      );
    }),
  );
}

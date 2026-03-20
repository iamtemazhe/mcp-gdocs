import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatApiError } from "../utils/errors.js";
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

export function registerDocsFormatTools(
  server: McpServer,
): void {
  server.tool(
    "docs_apply_text_style",
    "Apply text style to one or multiple ranges: bold, "
    + "italic, underline, strikethrough, fontSize, "
    + "fontFamily, colors",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      items: z.array(textStyleItemSchema).min(1)
        .describe("Array of ranges with styles to apply"),
    },
    async ({ documentId, tabId, items }) => {
      try {
        const requests = items.map(buildTextStyleRequest);
        await sendBatchedRequests(
          documentId, injectTabId(requests, tabId),
        );

        return {
          content: [{
            type: "text",
            text: `Стиль текста применён к `
              + `${items.length} диапазонам`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_apply_paragraph_style",
    "Apply paragraph style to one or multiple ranges: "
    + "alignment, lineSpacing, indentation, spacing",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      items: z.array(paragraphStyleItemSchema).min(1)
        .describe(
          "Array of ranges with paragraph styles",
        ),
    },
    async ({ documentId, tabId, items }) => {
      try {
        const requests =
          items.map(buildParagraphStyleRequest);
        await sendBatchedRequests(
          documentId, injectTabId(requests, tabId),
        );

        return {
          content: [{
            type: "text",
            text: `Стиль абзаца применён к `
              + `${items.length} диапазонам`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_apply_heading_style",
    "Apply heading style to one or multiple paragraphs "
    + "(HEADING_1..6 or NORMAL_TEXT)",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      items: z.array(headingStyleItemSchema).min(1)
        .describe(
          "Array of ranges with heading styles",
        ),
    },
    async ({ documentId, tabId, items }) => {
      try {
        const requests =
          items.map(buildHeadingStyleRequest);
        await sendBatchedRequests(
          documentId, injectTabId(requests, tabId),
        );

        return {
          content: [{
            type: "text",
            text: `Стиль заголовков применён к `
              + `${items.length} диапазонам`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );
}

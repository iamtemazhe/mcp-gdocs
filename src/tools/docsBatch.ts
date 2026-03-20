import { z } from "zod";
import type { docs_v1 } from "googleapis";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatApiError } from "../utils/errors.js";
import { sendBatchedRequests } from "../utils/batch.js";
import {
  textStyleItemSchema,
  paragraphStyleItemSchema,
  headingStyleItemSchema,
  imageItemSchema,
  tableCellStyleItemSchema,
  buildTextStyleRequest,
  buildParagraphStyleRequest,
  buildHeadingStyleRequest,
  buildImageRequest,
  buildTableCellStyleRequest,
} from "../utils/styleBuilders.js";

const updateTextStyleSchema = textStyleItemSchema.extend({
  type: z.literal("updateTextStyle"),
});

const updateParagraphStyleSchema =
  paragraphStyleItemSchema.extend({
    type: z.literal("updateParagraphStyle"),
  });

const updateHeadingStyleSchema =
  headingStyleItemSchema.extend({
    type: z.literal("updateHeadingStyle"),
  });

const insertTextSchema = z.object({
  type: z.literal("insertText"),
  index: z.number().int().min(1),
  text: z.string(),
});

const deleteContentRangeSchema = z.object({
  type: z.literal("deleteContentRange"),
  startIndex: z.number().int().min(1),
  endIndex: z.number().int().min(2),
});

const replaceAllTextSchema = z.object({
  type: z.literal("replaceAllText"),
  searchText: z.string(),
  replaceText: z.string(),
  matchCase: z.boolean().default(true),
});

const insertPageBreakSchema = z.object({
  type: z.literal("insertPageBreak"),
  index: z.number().int().min(1),
});

const insertTableSchema = z.object({
  type: z.literal("insertTable"),
  index: z.number().int().min(1),
  rows: z.number().int().min(1),
  columns: z.number().int().min(1),
});

const insertInlineImageSchema = imageItemSchema.extend({
  type: z.literal("insertInlineImage"),
});

const updateTableCellStyleSchema =
  tableCellStyleItemSchema.extend({
    type: z.literal("updateTableCellStyle"),
    tableStartIndex: z.number().int(),
  });

const batchRequestSchema = z.discriminatedUnion("type", [
  updateTextStyleSchema,
  updateParagraphStyleSchema,
  updateHeadingStyleSchema,
  insertTextSchema,
  deleteContentRangeSchema,
  replaceAllTextSchema,
  insertPageBreakSchema,
  insertTableSchema,
  insertInlineImageSchema,
  updateTableCellStyleSchema,
]);

type BatchRequest = z.infer<typeof batchRequestSchema>;

function mapRequest(
  req: BatchRequest,
): docs_v1.Schema$Request {
  switch (req.type) {
    case "updateTextStyle":
      return buildTextStyleRequest(req);

    case "updateParagraphStyle":
      return buildParagraphStyleRequest(req);

    case "updateHeadingStyle":
      return buildHeadingStyleRequest(req);

    case "insertText":
      return {
        insertText: {
          location: { index: req.index },
          text: req.text,
        },
      };

    case "deleteContentRange":
      return {
        deleteContentRange: {
          range: {
            startIndex: req.startIndex,
            endIndex: req.endIndex,
          },
        },
      };

    case "replaceAllText":
      return {
        replaceAllText: {
          containsText: {
            text: req.searchText,
            matchCase: req.matchCase,
          },
          replaceText: req.replaceText,
        },
      };

    case "insertPageBreak":
      return {
        insertPageBreak: {
          location: { index: req.index },
        },
      };

    case "insertTable":
      return {
        insertTable: {
          rows: req.rows,
          columns: req.columns,
          location: { index: req.index },
        },
      };

    case "insertInlineImage":
      return buildImageRequest(req);

    case "updateTableCellStyle":
      return buildTableCellStyleRequest(
        req.tableStartIndex, req,
      );
  }
}

export function registerDocsBatchTools(
  server: McpServer,
): void {
  server.tool(
    "docs_batch_update",
    "Batch multiple operations in one API call: "
    + "text/paragraph styles, headings, inserts, deletes, "
    + "tables, images. Avoids per-minute quota limits.",
    {
      documentId: z.string().describe("Document ID"),
      requests: z
        .array(batchRequestSchema)
        .min(1)
        .describe("Array of operations to execute"),
    },
    async ({ documentId, requests }) => {
      try {
        const apiRequests = requests.map(mapRequest);
        const sent = await sendBatchedRequests(
          documentId, apiRequests,
        );

        const chunks = Math.ceil(sent / 100);
        return {
          content: [{
            type: "text",
            text: `Выполнено ${requests.length} операций`
              + ` в ${chunks} запросах`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );
}

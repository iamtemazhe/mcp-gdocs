import { z } from "zod";
import type { docs_v1 } from "googleapis";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { textResult, handleTool } from "../utils/errors.js";
import {
  sendBatchedRequests,
  CHUNK_SIZE,
  tabIdParam,
  injectTabId,
} from "../utils/batch.js";
import {
  indexedTextStyleSchema,
  indexedParagraphStyleSchema,
  indexedHeadingStyleSchema,
  imageItemSchema,
  tableCellStyleItemSchema,
  buildTextStyleRequest,
  buildParagraphStyleRequest,
  buildHeadingStyleRequest,
  buildImageRequest,
  buildTableCellStyleRequest,
} from "../utils/styleBuilders.js";

const updateTextStyleSchema =
  indexedTextStyleSchema.extend({
    type: z.literal("updateTextStyle"),
  });

const updateParagraphStyleSchema =
  indexedParagraphStyleSchema.extend({
    type: z.literal("updateParagraphStyle"),
  });

const updateHeadingStyleSchema =
  indexedHeadingStyleSchema.extend({
    type: z.literal("updateHeadingStyle"),
  });

const insertTextSchema = z.object({
  type: z.literal("insertText"),
  index: z.number().int().min(1).describe("Insert index"),
  text: z.string().describe("Text to insert"),
});

const deleteContentRangeSchema = z.object({
  type: z.literal("deleteContentRange"),
  startIndex: z.number().int().min(1).describe("Range start"),
  endIndex: z.number().int().min(2).describe("Range end"),
});

const replaceAllTextSchema = z.object({
  type: z.literal("replaceAllText"),
  searchText: z.string().describe("Search string"),
  replaceText: z.string().describe("Replace string"),
  matchCase: z.boolean().default(true)
    .describe("Case-sensitive match"),
});

const insertPageBreakSchema = z.object({
  type: z.literal("insertPageBreak"),
  index: z.number().int().min(1).describe("Break index"),
});

const insertTableSchema = z.object({
  type: z.literal("insertTable"),
  index: z.number().int().min(1).describe("Table index"),
  rows: z.number().int().min(1).describe("Row count"),
  columns: z.number().int().min(1).describe("Column count"),
});

const insertInlineImageSchema = imageItemSchema.extend({
  type: z.literal("insertInlineImage"),
});

const updateTableCellStyleSchema =
  tableCellStyleItemSchema.extend({
    type: z.literal("updateTableCellStyle"),
    tableStartIndex: z.number().int().describe(
      "From docs_read_document format:json",
    ),
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
  tabId?: string,
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
          ...(tabId
            ? { tabsCriteria: { tabIds: [tabId] } }
            : {}),
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
  server.registerTool(
    "docs_batch_update",
    {
      title: "Batch Update",
      description:
        "Batch: updateTextStyle, updateParagraphStyle, updateHeadingStyle, insertText, deleteContentRange, replaceAllText; +4",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        requests: z
          .array(batchRequestSchema)
          .min(1)
          .describe("Batch operations"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ documentId, tabId, requests }) => {
      const apiRequests = requests.map(
        (r) => mapRequest(r, tabId),
      );
      const replies = await sendBatchedRequests(
        documentId,
        injectTabId(apiRequests, tabId),
      );

      const chunks = Math.ceil(replies.length / CHUNK_SIZE);
      return textResult(
        `${requests.length} op(s) in ${chunks} request(s)`,
      );
    }),
  );
}

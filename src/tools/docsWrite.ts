import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { docs_v1 } from "googleapis";
import { getDocsService } from "../auth.js";
import { formatApiError } from "../utils/errors.js";
import {
  sendBatchedRequests,
  getDocEndIndex,
} from "../utils/batch.js";

const insertTextItemSchema = z.object({
  text: z.string().describe("Text to insert"),
  index: z.number().int().min(1).describe(
    "Insertion position (1 = start of document)",
  ),
});

const deleteRangeItemSchema = z.object({
  startIndex: z.number().int().min(1).describe(
    "Range start index",
  ),
  endIndex: z.number().int().min(2).describe(
    "Range end index",
  ),
});

const replaceAllItemSchema = z.object({
  searchText: z.string().describe("Text to find"),
  replaceText: z.string().describe("Replacement text"),
  matchCase: z.boolean().default(true).describe(
    "Whether to match case",
  ),
});

const pageBreakItemSchema = z.object({
  index: z.number().int().min(1).describe(
    "Position to insert the page break",
  ),
});

export function registerDocsWriteTools(
  server: McpServer,
): void {
  server.tool(
    "docs_insert_text",
    "Insert text at one or multiple positions",
    {
      documentId: z.string().describe("Document ID"),
      items: z.array(insertTextItemSchema).min(1)
        .describe("Array of text insertions"),
    },
    async ({ documentId, items }) => {
      try {
        const requests: docs_v1.Schema$Request[] =
          items.map((item) => ({
            insertText: {
              location: { index: item.index },
              text: item.text,
            },
          }));

        await sendBatchedRequests(documentId, requests);

        return {
          content: [{
            type: "text",
            text: `Выполнено ${items.length} вставок`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_append_text",
    "Append text to the end of the document",
    {
      documentId: z.string().describe("Document ID"),
      text: z.string().describe("Text to append"),
    },
    async ({ documentId, text }) => {
      try {
        const endIndex =
          await getDocEndIndex(documentId) - 1;

        await sendBatchedRequests(documentId, [{
          insertText: {
            location: { index: Math.max(endIndex, 1) },
            text,
          },
        }]);

        return {
          content: [{
            type: "text",
            text: `Добавлено ${text.length} символов `
              + `в конец документа`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_delete_range",
    "Delete one or multiple content ranges",
    {
      documentId: z.string().describe("Document ID"),
      items: z.array(deleteRangeItemSchema).min(1)
        .describe("Array of ranges to delete"),
    },
    async ({ documentId, items }) => {
      try {
        const requests: docs_v1.Schema$Request[] =
          items.map((item) => ({
            deleteContentRange: {
              range: {
                startIndex: item.startIndex,
                endIndex: item.endIndex,
              },
            },
          }));

        await sendBatchedRequests(documentId, requests);

        return {
          content: [{
            type: "text",
            text: `Удалено ${items.length} диапазонов`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_replace_all_text",
    "Replace all occurrences of one or multiple patterns",
    {
      documentId: z.string().describe("Document ID"),
      items: z.array(replaceAllItemSchema).min(1)
        .describe("Array of search-replace pairs"),
    },
    async ({ documentId, items }) => {
      try {
        const docs = await getDocsService();
        const requests: docs_v1.Schema$Request[] =
          items.map((item) => ({
            replaceAllText: {
              containsText: {
                text: item.searchText,
                matchCase: item.matchCase,
              },
              replaceText: item.replaceText,
            },
          }));

        const result = await docs.documents.batchUpdate({
          documentId,
          requestBody: { requests },
        });

        const totalChanged = (result.data.replies ?? [])
          .reduce((sum, r) => {
            const changed =
              r.replaceAllText?.occurrencesChanged ?? 0;
            return sum + changed;
          }, 0);

        return {
          content: [{
            type: "text",
            text: `Выполнено ${items.length} замен, `
              + `изменено ${totalChanged} вхождений`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_replace_document_content",
    "Replace entire document content with new text",
    {
      documentId: z.string().describe("Document ID"),
      newContent: z.string().describe(
        "New document content",
      ),
    },
    async ({ documentId, newContent }) => {
      try {
        const endIndex =
          await getDocEndIndex(documentId);
        const requests: docs_v1.Schema$Request[] = [];

        if (endIndex > 2) {
          requests.push({
            deleteContentRange: {
              range: {
                startIndex: 1,
                endIndex: endIndex - 1,
              },
            },
          });
        }

        requests.push({
          insertText: {
            location: { index: 1 },
            text: newContent,
          },
        });

        await sendBatchedRequests(documentId, requests);

        return {
          content: [{
            type: "text",
            text: `Содержимое заменено `
              + `(${newContent.length} символов)`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_insert_page_break",
    "Insert page breaks at one or multiple positions",
    {
      documentId: z.string().describe("Document ID"),
      items: z.array(pageBreakItemSchema).min(1)
        .describe("Array of positions for page breaks"),
    },
    async ({ documentId, items }) => {
      try {
        const requests: docs_v1.Schema$Request[] =
          items.map((item) => ({
            insertPageBreak: {
              location: { index: item.index },
            },
          }));

        await sendBatchedRequests(documentId, requests);

        return {
          content: [{
            type: "text",
            text: `Вставлено ${items.length} `
              + `разрывов страниц`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );
}

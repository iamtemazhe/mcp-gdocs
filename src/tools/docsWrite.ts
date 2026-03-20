import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { docs_v1 } from "googleapis";
import { textResult, handleTool } from "../utils/errors.js";
import {
  sendBatchedRequests,
  getDocEndIndex,
  tabIdParam,
  injectTabId,
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
    "Insert text at index. Get index from docs_read_document (format: json)",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      items: z.array(insertTextItemSchema).min(1)
        .describe("Array of text insertions"),
    },
    handleTool(async ({ documentId, tabId, items }) => {
      const requests: docs_v1.Schema$Request[] =
        items.map((item) => ({
          insertText: {
            location: { index: item.index },
            text: item.text,
          },
        }));

      await sendBatchedRequests(
        documentId, injectTabId(requests, tabId),
      );

      return textResult(`Выполнено ${items.length} вставок`);
    }),
  );

  server.tool(
    "docs_append_text",
    "Append text to the end of the document",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      text: z.string().describe("Text to append"),
    },
    handleTool(async ({ documentId, tabId, text }) => {
      const endIndex =
        await getDocEndIndex(documentId, tabId) - 1;

      const reqs: docs_v1.Schema$Request[] = [{
        insertText: {
          location: { index: Math.max(endIndex, 1) },
          text,
        },
      }];

      await sendBatchedRequests(
        documentId, injectTabId(reqs, tabId),
      );

      return textResult(
        `Добавлено ${text.length} символов `
          + `в конец документа`,
      );
    }),
  );

  server.tool(
    "docs_delete_range",
    "Delete content ranges. Get startIndex/endIndex from docs_read_document (format: json)",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      items: z.array(deleteRangeItemSchema).min(1)
        .describe("Array of ranges to delete"),
    },
    handleTool(async ({ documentId, tabId, items }) => {
      const requests: docs_v1.Schema$Request[] =
        items.map((item) => ({
          deleteContentRange: {
            range: {
              startIndex: item.startIndex,
              endIndex: item.endIndex,
            },
          },
        }));

      await sendBatchedRequests(
        documentId, injectTabId(requests, tabId),
      );

      return textResult(`Удалено ${items.length} диапазонов`);
    }),
  );

  server.tool(
    "docs_replace_all_text",
    "Find and replace text patterns across document. Supports bulk search-replace pairs",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      items: z.array(replaceAllItemSchema).min(1)
        .describe("Array of search-replace pairs"),
    },
    handleTool(async ({ documentId, tabId, items }) => {
      const requests: docs_v1.Schema$Request[] =
        items.map((item) => ({
          replaceAllText: {
            containsText: {
              text: item.searchText,
              matchCase: item.matchCase,
            },
            replaceText: item.replaceText,
            ...(tabId
              ? { tabsCriteria: { tabIds: [tabId] } }
              : {}),
          },
        }));

      const replies = await sendBatchedRequests(
        documentId,
        injectTabId(requests, tabId),
      );

      const totalChanged = replies.reduce((sum, r) => {
        const changed =
          r.replaceAllText?.occurrencesChanged ?? 0;
        return sum + changed;
      }, 0);

      return textResult(
        `Выполнено ${items.length} замен, `
          + `изменено ${totalChanged} вхождений`,
      );
    }),
  );

  server.tool(
    "docs_replace_document_content",
    "Clear and replace entire document content. For partial edits use docs_insert_text or docs_delete_range",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      newContent: z.string().describe(
        "New document content",
      ),
    },
    handleTool(async ({ documentId, tabId, newContent }) => {
      const endIndex =
        await getDocEndIndex(documentId, tabId);
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

      await sendBatchedRequests(
        documentId, injectTabId(requests, tabId),
      );

      return textResult(
        `Содержимое заменено `
          + `(${newContent.length} символов)`,
      );
    }),
  );

  server.tool(
    "docs_insert_page_break",
    "Insert page break at index. Get index from docs_read_document (format: json)",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      items: z.array(pageBreakItemSchema).min(1)
        .describe("Array of positions for page breaks"),
    },
    handleTool(async ({ documentId, tabId, items }) => {
      const requests: docs_v1.Schema$Request[] =
        items.map((item) => ({
          insertPageBreak: {
            location: { index: item.index },
          },
        }));

      await sendBatchedRequests(
        documentId, injectTabId(requests, tabId),
      );

      return textResult(
        `Вставлено ${items.length} `
          + `разрывов страниц`,
      );
    }),
  );
}

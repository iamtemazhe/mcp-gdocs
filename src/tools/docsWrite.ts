import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { docs_v1 } from "googleapis";
import { textResult, handleTool } from "../utils/errors.js";
import {
  sendBatchedRequests,
  fetchDocIndices,
  tabIdParam,
  injectTabId,
} from "../utils/batch.js";

const insertTextItemSchema = z.object({
  text: z.string().describe("Text to insert"),
  index: z.number().int().min(1).describe("1-based index"),
});

const deleteRangeItemSchema = z.object({
  startIndex: z.number().int().min(1).describe("Range start"),
  endIndex: z.number().int().min(2).describe("Range end"),
});

const replaceAllItemSchema = z.object({
  searchText: z.string().describe("Search string"),
  replaceText: z.string().describe("Replace string"),
  matchCase: z.boolean().default(true).describe("Case-sensitive"),
});

const pageBreakItemSchema = z.object({
  index: z.number().int().min(1).describe("Insert index"),
});

export function registerDocsWriteTools(
  server: McpServer,
): void {
  server.registerTool(
    "docs_insert_text",
    {
      title: "Insert Text",
      description: "Bulk insert at indices (json read).",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        items: z.array(insertTextItemSchema).min(1)
          .describe("Insert operations"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
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

      return textResult(`Done: ${items.length} insert(s)`);
    }),
  );

  server.registerTool(
    "docs_append_text",
    {
      title: "Append Text",
      description: "Append text at document end.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        text: z.string().describe("Text to append"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ documentId, tabId, text }) => {
      const { endIndex: docEnd } =
        await fetchDocIndices(documentId, tabId);
      const endIndex = docEnd - 1;

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
        `Appended ${text.length} character(s)`,
      );
    }),
  );

  server.registerTool(
    "docs_delete_range",
    {
      title: "Delete Range",
      description: "Bulk delete by index ranges.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        items: z.array(deleteRangeItemSchema).min(1)
          .describe("Ranges to delete"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
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

      return textResult(`Deleted ${items.length} range(s)`);
    }),
  );

  server.registerTool(
    "docs_replace_all_text",
    {
      title: "Replace All Text",
      description:
        "Bulk find-replace (literal match). Does NOT replace entire body; use docs_replace_document_content for that.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        items: z.array(replaceAllItemSchema).min(1)
          .describe("Search-replace pairs"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
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
        `${items.length} rule(s), ${totalChanged} occurrence(s) changed`,
      );
    }),
  );

  server.registerTool(
    "docs_replace_document_content",
    {
      title: "Replace Document Content",
      description:
        "Clear and replace entire body with plain text. For find-replace use docs_replace_all_text.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        newContent: z.string().describe("New body text"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ documentId, tabId, newContent }) => {
      const { endIndex } =
        await fetchDocIndices(documentId, tabId);
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
        `Body replaced (${newContent.length} chars)`,
      );
    }),
  );

  server.registerTool(
    "docs_insert_page_break",
    {
      title: "Insert Page Break",
      description:
        "Bulk insert page breaks at indices.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        items: z.array(pageBreakItemSchema).min(1)
          .describe("Break positions"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
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
        `Inserted ${items.length} page break(s)`,
      );
    }),
  );

  server.registerTool(
    "docs_rename_tab",
    {
      title: "Rename Tab",
      description: "Rename one tab by tabId.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: z.string().describe("Tab ID"),
        newTitle: z.string().min(1).describe("New title"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ documentId, tabId, newTitle }) => {
      const { getDocsService } = await import(
        "../auth.js"
      );
      const docs = await getDocsService();
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [{
            updateDocumentTabProperties: {
              tabProperties: { tabId, title: newTitle },
              fields: "title",
            },
          } as docs_v1.Schema$Request],
        },
      });

      return textResult(
        `Tab "${tabId}" renamed to "${newTitle}"`,
      );
    }),
  );
}

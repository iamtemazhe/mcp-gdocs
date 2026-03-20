import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { docs_v1 } from "googleapis";
import {
  markdownToRequestBatches,
} from "../utils/markdownParser.js";
import { formatApiError } from "../utils/errors.js";
import {
  sendBatchedRequests,
  getDocEndIndex,
} from "../utils/batch.js";

async function sendBatches(
  documentId: string,
  batches: docs_v1.Schema$Request[][],
): Promise<number> {
  let total = 0;
  for (const batch of batches) {
    if (batch.length === 0) continue;
    total += await sendBatchedRequests(
      documentId, batch,
    );
  }
  return total;
}

export function registerDocsMarkdownTools(
  server: McpServer,
): void {
  server.tool(
    "docs_replace_with_markdown",
    "Replace entire document content by converting Markdown "
    + "to a formatted Google Doc (headings, lists, tables, "
    + "styles)",
    {
      documentId: z.string().describe("Document ID"),
      markdown: z.string().describe("Markdown content"),
    },
    async ({ documentId, markdown }) => {
      try {
        const endIndex =
          await getDocEndIndex(documentId);

        if (endIndex > 2) {
          await sendBatchedRequests(documentId, [{
            deleteContentRange: {
              range: {
                startIndex: 1,
                endIndex: endIndex - 1,
              },
            },
          }]);
        }

        const batches =
          markdownToRequestBatches(markdown, 1);
        const total = await sendBatches(
          documentId, batches,
        );

        return {
          content: [{
            type: "text",
            text: `Документ заполнен из Markdown `
              + `(${total} операций)`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_append_markdown",
    "Append Markdown content to the end of the document "
    + "with formatting",
    {
      documentId: z.string().describe("Document ID"),
      markdown: z.string().describe("Markdown to append"),
    },
    async ({ documentId, markdown }) => {
      try {
        const endIndex =
          await getDocEndIndex(documentId) - 1;

        const batches = markdownToRequestBatches(
          markdown, Math.max(endIndex, 1),
        );
        const total = await sendBatches(
          documentId, batches,
        );

        return {
          content: [{
            type: "text",
            text: `Markdown добавлен в конец документа `
              + `(${total} операций)`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );
}

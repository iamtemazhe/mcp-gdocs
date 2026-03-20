import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { docs_v1 } from "googleapis";
import {
  markdownToRequestBatches,
} from "../utils/markdownParser.js";
import { textResult, handleTool } from "../utils/errors.js";
import {
  sendBatchedRequests,
  getDocEndIndex,
  tabIdParam,
  injectTabId,
} from "../utils/batch.js";

const INSERT_KEYS = new Set([
  "insertText",
  "insertTable",
  "insertPageBreak",
  "insertInlineImage",
  "insertSectionBreak",
  "createParagraphBullets",
]);

function isInsertRequest(
  req: docs_v1.Schema$Request,
): boolean {
  return Object.keys(req).some(
    (k) => INSERT_KEYS.has(k),
  );
}

/**
 * Отправляет batch'и с фазовым разделением:
 * сначала все insert-запросы, потом все format-запросы.
 * Это предотвращает конфликты индексов при
 * одновременной вставке и форматировании.
 */
async function sendBatches(
  documentId: string,
  batches: docs_v1.Schema$Request[][],
  tabId?: string,
): Promise<number> {
  let total = 0;
  for (const batch of batches) {
    if (batch.length === 0) continue;

    const inserts = batch.filter(isInsertRequest);
    const formats = batch.filter(
      (r) => !isInsertRequest(r),
    );

    if (inserts.length > 0) {
      const r = await sendBatchedRequests(
        documentId, injectTabId(inserts, tabId),
      );
      total += r.length;
    }
    if (formats.length > 0) {
      const r = await sendBatchedRequests(
        documentId, injectTabId(formats, tabId),
      );
      total += r.length;
    }
  }
  return total;
}

export function registerDocsMarkdownTools(
  server: McpServer,
): void {
  server.tool(
    "docs_replace_with_markdown",
    "Replace document content with Markdown. Supports headings, "
    + "bold, italic, strikethrough, links, lists, code blocks, "
    + "tables, horizontal rules",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      markdown: z.string().describe("Markdown content"),
    },
    handleTool(async ({ documentId, tabId, markdown }) => {
      const endIndex =
        await getDocEndIndex(documentId, tabId);

      if (endIndex > 2) {
        const delReqs = injectTabId([{
          deleteContentRange: {
            range: {
              startIndex: 1,
              endIndex: endIndex - 1,
            },
          },
        }], tabId);
        await sendBatchedRequests(documentId, delReqs);
      }

      const batches =
        markdownToRequestBatches(markdown, 1);
      const total = await sendBatches(
        documentId, batches, tabId,
      );

      return textResult(
        `Документ заполнен из Markdown `
          + `(${total} операций)`,
      );
    }),
  );

  server.tool(
    "docs_append_markdown",
    "Append Markdown content to document end. Same Markdown "
    + "features as docs_replace_with_markdown",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      markdown: z.string().describe("Markdown to append"),
    },
    handleTool(async ({ documentId, tabId, markdown }) => {
      const endIndex =
        await getDocEndIndex(documentId, tabId) - 1;

      const batches = markdownToRequestBatches(
        markdown, Math.max(endIndex, 1),
      );
      const total = await sendBatches(
        documentId, batches, tabId,
      );

      return textResult(
        `Markdown добавлен в конец документа `
          + `(${total} операций)`,
      );
    }),
  );
}

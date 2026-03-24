import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { docs_v1 } from "googleapis";
import {
  markdownToRequestBatches,
} from "../utils/markdownParser.js";
import { textResult, handleTool } from "../utils/errors.js";
import {
  sendBatchedRequests,
  fetchDocIndices,
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
 * Sends batches in two phases: inserts first, then formats,
 * to avoid index conflicts when mixing both.
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

function extractFirstHeading(
  markdown: string,
): string | null {
  const match = /^#{1,6}\s+(.+)$/m.exec(markdown);
  return match ? match[1].trim() : null;
}

export function registerDocsMarkdownTools(
  server: McpServer,
): void {
  server.registerTool(
    "docs_replace_with_markdown",
    {
      title: "Replace With Markdown",
      description:
        "Clear body and render Markdown as formatted content. For plain text use docs_replace_document_content.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        markdown: z.string().describe("Markdown source"),
        preserveTitle: z.boolean().default(false).describe(
          "Keep first paragraph",
        ),
        firstHeadingAsTitle: z.boolean().default(false)
          .describe("Title from first H1"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({
      documentId, tabId, markdown,
      preserveTitle, firstHeadingAsTitle,
    }) => {
      const { endIndex, firstParagraphEnd } =
        await fetchDocIndices(documentId, tabId);
      const deleteFrom = preserveTitle
        ? firstParagraphEnd
        : 1;

      if (endIndex > deleteFrom + 1) {
        const delReqs = injectTabId([{
          deleteContentRange: {
            range: {
              startIndex: deleteFrom,
              endIndex: endIndex - 1,
            },
          },
        }], tabId);
        await sendBatchedRequests(documentId, delReqs);
      }

      const insertAt = preserveTitle ? deleteFrom : 1;
      const batches =
        markdownToRequestBatches(markdown, insertAt);
      const total = await sendBatches(
        documentId, batches, tabId,
      );

      if (firstHeadingAsTitle) {
        const heading = extractFirstHeading(markdown);
        if (heading) {
          const { getDriveService } = await import(
            "../auth.js"
          );
          const drive = await getDriveService();
          await drive.files.update({
            fileId: documentId,
            requestBody: { name: heading },
          });
        }
      }

      return textResult(
        `Replaced from Markdown (${total} ops)`,
      );
    }),
  );

  server.registerTool(
    "docs_append_markdown",
    {
      title: "Append Markdown",
      description:
        "Append Markdown at document end.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        markdown: z.string().describe("Markdown chunk"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ documentId, tabId, markdown }) => {
      const { endIndex: docEnd } =
        await fetchDocIndices(documentId, tabId);
      const endIndex = docEnd - 1;

      const batches = markdownToRequestBatches(
        markdown, Math.max(endIndex, 1),
      );
      const total = await sendBatches(
        documentId, batches, tabId,
      );

      return textResult(
        `Markdown appended (${total} ops)`,
      );
    }),
  );
}

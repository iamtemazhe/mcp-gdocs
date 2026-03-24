import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { documentIdParam } from "../utils/schemas.js";
import type { docs_v1 } from "googleapis";
import { getDocsService } from "../auth.js";
import { textResult, handleTool } from "../utils/errors.js";
import {
  sendBatchedRequests,
  fetchDocIndices,
  tabIdParam,
  injectTabId,
} from "../utils/batch.js";
import { getBodyContent } from "../utils/tabs.js";
import {
  bulletPresetSchema,
  sectionBreakTypeSchema,
} from "../utils/styleBuilders.js";

async function fetchDocForSegments(
  documentId: string,
  tabId?: string,
): Promise<docs_v1.Schema$Document> {
  const docs = await getDocsService();
  const { data } = await docs.documents.get({
    documentId,
    ...(tabId ? { includeTabsContent: true } : {}),
  });
  return data;
}

function segmentContentEndIndex(
  content: docs_v1.Schema$StructuralElement[] | undefined,
): number {
  const c = content ?? [];
  if (c.length === 0) return 1;
  const last = c[c.length - 1];
  return last.endIndex ?? 2;
}

function resolveHeaderId(
  doc: docs_v1.Schema$Document,
  sectionIndex: number,
  bodyContent: docs_v1.Schema$StructuralElement[],
): string | undefined {
  const breaks = bodyContent.filter((e) => e.sectionBreak != null);

  if (sectionIndex === 0) {
    return (
      doc.documentStyle?.defaultHeaderId
      ?? breaks[0]?.sectionBreak?.sectionStyle?.defaultHeaderId
      ?? (doc.headers ? Object.keys(doc.headers)[0] : undefined)
    );
  }

  return breaks[sectionIndex]?.sectionBreak?.sectionStyle
    ?.defaultHeaderId ?? undefined;
}

function resolveFooterId(
  doc: docs_v1.Schema$Document,
  sectionIndex: number,
  bodyContent: docs_v1.Schema$StructuralElement[],
): string | undefined {
  const breaks = bodyContent.filter((e) => e.sectionBreak != null);

  if (sectionIndex === 0) {
    return (
      doc.documentStyle?.defaultFooterId
      ?? breaks[0]?.sectionBreak?.sectionStyle?.defaultFooterId
      ?? (doc.footers ? Object.keys(doc.footers)[0] : undefined)
    );
  }

  return breaks[sectionIndex]?.sectionBreak?.sectionStyle
    ?.defaultFooterId ?? undefined;
}

function buildCreateHeaderRequest(
  sectionIndex: number,
  bodyContent: docs_v1.Schema$StructuralElement[],
  tabId?: string,
): docs_v1.Schema$Request {
  if (sectionIndex === 0) {
    return { createHeader: { type: "DEFAULT" } };
  }
  const breaks = bodyContent.filter((e) => e.sectionBreak != null);
  const br = breaks[sectionIndex];
  const idx = br?.startIndex;
  if (idx == null) {
    throw new Error(
      `No section break for section index ${sectionIndex}`,
    );
  }
  return {
    createHeader: {
      type: "DEFAULT",
      sectionBreakLocation: {
        index: idx,
        ...(tabId ? { tabId } : {}),
      },
    },
  };
}

function buildCreateFooterRequest(
  sectionIndex: number,
  bodyContent: docs_v1.Schema$StructuralElement[],
  tabId?: string,
): docs_v1.Schema$Request {
  if (sectionIndex === 0) {
    return { createFooter: { type: "DEFAULT" } };
  }
  const breaks = bodyContent.filter((e) => e.sectionBreak != null);
  const br = breaks[sectionIndex];
  const idx = br?.startIndex;
  if (idx == null) {
    throw new Error(
      `No section break for section index ${sectionIndex}`,
    );
  }
  return {
    createFooter: {
      type: "DEFAULT",
      sectionBreakLocation: {
        index: idx,
        ...(tabId ? { tabId } : {}),
      },
    },
  };
}

async function replaceSegmentPlainText(
  documentId: string,
  tabId: string | undefined,
  segmentKind: "header" | "footer",
  segmentId: string,
  text: string,
): Promise<void> {
  const doc = await fetchDocForSegments(documentId, tabId);
  const map = segmentKind === "header"
    ? doc.headers
    : doc.footers;
  const seg = map?.[segmentId];
  const endIndex = segmentContentEndIndex(seg?.content);

  const requests: docs_v1.Schema$Request[] = [];
  if (endIndex > 2) {
    requests.push({
      deleteContentRange: {
        range: {
          segmentId,
          startIndex: 1,
          endIndex: endIndex - 1,
        },
      },
    });
  }
  requests.push({
    insertText: {
      location: { index: 1, segmentId },
      text,
    },
  });
  await sendBatchedRequests(
    documentId,
    injectTabId(requests, tabId),
  );
}

async function updateHeaderOrFooter(
  documentId: string,
  tabId: string | undefined,
  text: string,
  sectionIndex: number,
  segment: "header" | "footer",
): Promise<void> {
  const doc = await fetchDocForSegments(documentId, tabId);
  const bodyContent = getBodyContent(doc, tabId);

  const existingId = segment === "header"
    ? resolveHeaderId(doc, sectionIndex, bodyContent)
    : resolveFooterId(doc, sectionIndex, bodyContent);

  let segmentId = existingId;

  if (!segmentId) {
    const createReq = segment === "header"
      ? buildCreateHeaderRequest(
        sectionIndex, bodyContent, tabId,
      )
      : buildCreateFooterRequest(
        sectionIndex, bodyContent, tabId,
      );
    const replies = await sendBatchedRequests(
      documentId,
      injectTabId([createReq], tabId),
    );
    const r0 = replies[0];
    segmentId = segment === "header"
      ? r0?.createHeader?.headerId ?? undefined
      : r0?.createFooter?.footerId ?? undefined;
    if (!segmentId) {
      throw new Error(
        `Failed to create ${segment}: missing id in API response`,
      );
    }
  }

  await replaceSegmentPlainText(
    documentId, tabId, segment, segmentId, text,
  );
}

const insertTextItemSchema = z.object({
  text: z.string().describe("Text to insert"),
  index: z.number().int().min(1).describe(
    "1-based index from docs_read_document(format:'json')",
  ),
});

const deleteRangeItemSchema = z.object({
  startIndex: z.number().int().min(1).describe(
    "Range start from docs_read_document(format:'json')",
  ),
  endIndex: z.number().int().min(2).describe(
    "Range end from docs_read_document(format:'json')",
  ),
});

const replaceAllItemSchema = z.object({
  searchText: z.string().describe("Search string"),
  replaceText: z.string().describe("Replace string"),
  matchCase: z.boolean().default(true).describe("Case-sensitive"),
});

const pageBreakItemSchema = z.object({
  index: z.number().int().min(1).describe(
    "Insert index from docs_read_document(format:'json')",
  ),
});

export function registerDocsWriteTools(
  server: McpServer,
): void {
  server.registerTool(
    "docs_insert_text",
    {
      title: "Insert Text",
      description:
        "Insert plain text at body indices. For appending to the end use "
        + "docs_append_text.",
      inputSchema: {
        documentId: documentIdParam,
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
      description:
        "Append plain text to the end of the document body.",
      inputSchema: {
        documentId: documentIdParam,
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
      description:
        "Delete one or more body ranges by index; process from highest index "
        + "first.",
      inputSchema: {
        documentId: documentIdParam,
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
        "Replace all occurrences of literal text across the document body.",
      inputSchema: {
        documentId: documentIdParam,
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
        "Replace the entire document body with new plain text.",
      inputSchema: {
        documentId: documentIdParam,
        tabId: tabIdParam,
        newContent: z.string().describe("New body text"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ documentId, tabId, newContent }) => {
      const { endIndex } =
        await fetchDocIndices(documentId, tabId);

      if (endIndex > 2) {
        await sendBatchedRequests(
          documentId,
          injectTabId([{
            deleteContentRange: {
              range: {
                startIndex: 1,
                endIndex: endIndex - 1,
              },
            },
          }], tabId),
        );
        await sendBatchedRequests(
          documentId,
          injectTabId([{
            updateTextStyle: {
              range: { startIndex: 1, endIndex: 2 },
              textStyle: {
                bold: false,
                italic: false,
                underline: false,
                strikethrough: false,
              },
              fields:
                "bold,italic,underline,strikethrough",
            },
          }], tabId),
        );
      }

      await sendBatchedRequests(
        documentId,
        injectTabId([{
          insertText: {
            location: { index: 1 },
            text: newContent,
          },
        }], tabId),
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
        "Insert page breaks at given body indices.",
      inputSchema: {
        documentId: documentIdParam,
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
      description:
        "Rename a document tab.",
      inputSchema: {
        documentId: documentIdParam,
        tabId: z.string().describe(
          "Tab ID from docs_list_document_tabs",
        ),
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

  server.registerTool(
    "docs_update_header",
    {
      title: "Update Header",
      description:
        "Set header text for a section, creating the header if needed.",
      inputSchema: {
        documentId: documentIdParam,
        tabId: tabIdParam,
        text: z.string().describe("Header text"),
        sectionIndex: z.number().int().min(0).default(0)
          .describe("Section index (0 = first section)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({
      documentId, tabId, text, sectionIndex,
    }) => {
      await updateHeaderOrFooter(
        documentId,
        tabId,
        text,
        sectionIndex,
        "header",
      );
      return textResult("Header updated");
    }),
  );

  server.registerTool(
    "docs_update_footer",
    {
      title: "Update Footer",
      description:
        "Set footer text for a section, creating the footer if needed.",
      inputSchema: {
        documentId: documentIdParam,
        tabId: tabIdParam,
        text: z.string().describe("Footer text"),
        sectionIndex: z.number().int().min(0).default(0)
          .describe("Section index (0 = first section)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({
      documentId, tabId, text, sectionIndex,
    }) => {
      await updateHeaderOrFooter(
        documentId,
        tabId,
        text,
        sectionIndex,
        "footer",
      );
      return textResult("Footer updated");
    }),
  );

  server.registerTool(
    "docs_create_footnote",
    {
      title: "Create Footnote",
      description:
        "Add a footnote reference at a body index.",
      inputSchema: {
        documentId: documentIdParam,
        tabId: tabIdParam,
        index: z.number().int().min(1).describe(
          "Insert index from docs_read_document(format:'json')",
        ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ documentId, tabId, index }) => {
      const replies = await sendBatchedRequests(
        documentId,
        injectTabId([{
          createFootnote: {
            location: { index },
          },
        }], tabId),
      );

      const footnoteId =
        replies[0]?.createFootnote?.footnoteId ?? undefined;

      return textResult(
        footnoteId != null && footnoteId !== ""
          ? `Footnote created. footnoteId=${footnoteId}`
          : "Footnote created",
      );
    }),
  );

  server.registerTool(
    "docs_add_tab",
    {
      title: "Add Document Tab",
      description:
        "Add a new tab or nested tab to the document.",
      inputSchema: {
        documentId: documentIdParam,
        title: z.string().optional().describe("Tab title"),
        parentTabId: z.string().optional().describe("Parent tab ID"),
        insertionIndex: z.number().int().optional().describe(
          "Tab order index",
        ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({
      documentId,
      title: tabTitle,
      parentTabId,
      insertionIndex,
    }) => {
      const tabProperties: Record<string, unknown> = {};
      if (tabTitle != null) tabProperties.title = tabTitle;
      if (parentTabId != null) tabProperties.parentTabId = parentTabId;
      if (insertionIndex != null) tabProperties.index = insertionIndex;

      const req = {
        addDocumentTab: { tabProperties },
      } as docs_v1.Schema$Request;

      const replies = await sendBatchedRequests(documentId, [req]);

      const r0 = replies[0] as docs_v1.Schema$Response & {
        addDocumentTab?: { tabId?: string | null };
      };
      const newTabId = r0?.addDocumentTab?.tabId ?? undefined;

      return textResult(
        newTabId != null && newTabId !== ""
          ? `Tab added. tabId=${newTabId}`
          : "Tab added",
      );
    }),
  );
}

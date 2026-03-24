import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { documentIdParam } from "../utils/schemas.js";
import { getDocsService } from "../auth.js";
import { docToPlainText, docToMarkdown } from "../utils/docReader.js";
import { documentToSummary } from "../utils/docSummary.js";
import {
  textResult, jsonResult, stripEmpty, handleTool,
} from "../utils/errors.js";
import { tabIdParam } from "../utils/batch.js";
import { findTab } from "../utils/tabs.js";

export function registerDocsReadTools(server: McpServer): void {
  server.registerTool(
    "docs_read_document",
    {
      title: "Read Document",
      description:
        "Read document body in text, JSON (with indices), Markdown, or "
        + "summary format. For multi-tab docs pass tabId from "
        + "docs_list_document_tabs.",
      inputSchema: {
        documentId: documentIdParam,
        tabId: tabIdParam,
        format: z
          .enum(["text", "json", "markdown", "summary"])
          .default("text")
          .describe(
            "Output format: text (plain), json (structure with indices), "
            + "markdown (formatted), summary (outline of headings/tables/images)",
          ),
        fields: z.string().optional().describe(
          "Google API fields mask to limit response size. "
          + "E.g. 'body(content(paragraph(elements(textRun(content)))))' "
          + "or 'body(content(startIndex,endIndex,paragraph,table))'. "
          + "Omit for full document.",
        ),
        maxLength: z.number().int().min(1).optional()
          .describe("Max response length"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({
      documentId, tabId, format, maxLength,
    }) => {
      const docs = await getDocsService();

      const textFields =
        "body(content(paragraph(elements("
        + "textRun(content),startIndex,endIndex))))";

      const doc = await docs.documents.get({
        documentId,
        ...(format === "text"
          ? { fields: `documentId,title,${textFields}` }
          : {}),
        ...(tabId ? { includeTabsContent: true } : {}),
      });

      let docData = doc.data;
      if (tabId) {
        const tab = findTab(doc.data, tabId);
        if (!tab?.documentTab) {
          throw new Error(
            `Tab "${tabId}" not found. `
            + "Use docs_list_document_tabs to list valid tab IDs",
          );
        }
        docData = {
          ...doc.data,
          body: tab.documentTab.body,
        };
      }

      if (format === "json") {
        return jsonResult(stripEmpty(docData));
      }

      if (format === "summary") {
        return jsonResult(documentToSummary(docData));
      }

      let result = format === "markdown"
        ? docToMarkdown(docData)
        : docToPlainText(docData);

      if (maxLength && result.length > maxLength) {
        const fullLength = result.length;
        result = result.slice(0, maxLength)
          + `\n\n[Truncated at ${maxLength}`
          + ` of ${fullLength} chars]`;
      }

      return textResult(result);
    }),
  );

  server.registerTool(
    "docs_get_document_info",
    {
      title: "Get Document Info",
      description:
        "Fetch document title, revision id, and body element count without "
        + "loading full content.",
      inputSchema: {
        documentId: documentIdParam,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ documentId }) => {
      const docs = await getDocsService();
      const doc = await docs.documents.get({
        documentId,
        fields: "documentId,title,revisionId,"
          + "body(content(endIndex))",
      });

      const info = {
        documentId: doc.data.documentId,
        title: doc.data.title,
        revisionId: doc.data.revisionId,
        bodyContentLength:
          doc.data.body?.content?.length ?? 0,
      };

      return jsonResult(info);
    }),
  );

  server.registerTool(
    "docs_list_document_tabs",
    {
      title: "List Document Tabs",
      description:
        "List document tabs with ids, titles, and nesting for use with "
        + "tab-scoped tools.",
      inputSchema: {
        documentId: documentIdParam,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ documentId }) => {
      const docs = await getDocsService();
      const doc = await docs.documents.get({
        documentId,
        includeTabsContent: true,
        fields: "tabs(tabProperties,childTabs("
          + "tabProperties))",
      });

      const tabs = doc.data.tabs ?? [];
      const tabList = tabs.map((tab) => ({
        tabId: tab.tabProperties?.tabId,
        title: tab.tabProperties?.title,
        index: tab.tabProperties?.index,
        childTabs: (tab.childTabs ?? []).map((child) => ({
          tabId: child.tabProperties?.tabId,
          title: child.tabProperties?.title,
          index: child.tabProperties?.index,
        })),
      }));

      return jsonResult(tabList);
    }),
  );
}

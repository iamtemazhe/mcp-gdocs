import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDocsService } from "../auth.js";
import { docToPlainText, docToMarkdown } from "../utils/docReader.js";
import { textResult, jsonResult, handleTool } from "../utils/errors.js";
import { tabIdParam } from "../utils/batch.js";
import { findTab } from "../utils/tabs.js";

export function registerDocsReadTools(server: McpServer): void {
  server.tool(
    "docs_read_document",
    "Read document content. Use format: json to get element indices for "
      + "other tools (insert, style, table operations)",
    {
      documentId: z.string().describe("Google Docs document ID"),
      tabId: tabIdParam,
      format: z
        .enum(["text", "json", "markdown"])
        .default("text")
        .describe(
          "text = plain body; json = structure with startIndex/endIndex "
            + "for insert/style/table tools; markdown = rendered markdown",
        ),
    },
    handleTool(async ({ documentId, tabId, format }) => {
      const docs = await getDocsService();
      const doc = await docs.documents.get({
        documentId,
        ...(tabId ? { includeTabsContent: true } : {}),
      });

      let docData = doc.data;
      if (tabId) {
        const tab = findTab(doc.data, tabId);
        if (!tab?.documentTab) {
          throw new Error(`Tab "${tabId}" not found`);
        }
        docData = {
          ...doc.data,
          body: tab.documentTab.body,
        };
      }

      switch (format) {
        case "json":
          return jsonResult(docData);
        case "markdown":
          return textResult(docToMarkdown(docData));
        default:
          return textResult(docToPlainText(docData));
      }
    }),
  );

  server.tool(
    "docs_get_document_info",
    "Get document metadata: title, locale, revision. "
      + "Use docs_read_document for content",
    {
      documentId: z.string().describe("Google Docs document ID"),
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

  server.tool(
    "docs_list_document_tabs",
    "List all tabs in a multi-tab document",
    {
      documentId: z.string().describe("Google Docs document ID"),
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

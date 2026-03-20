import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDocsService } from "../auth.js";
import { docToPlainText, docToMarkdown } from "../utils/docReader.js";
import { formatApiError } from "../utils/errors.js";
import { tabIdParam } from "../utils/batch.js";
import { findTab } from "../utils/tabs.js";

export function registerDocsReadTools(server: McpServer): void {
  server.tool(
    "docs_read_document",
    "Read Google Doc content as text, json, or markdown",
    {
      documentId: z.string().describe("Google Docs document ID"),
      tabId: tabIdParam,
      format: z
        .enum(["text", "json", "markdown"])
        .default("text")
        .describe("Output format"),
    },
    async ({ documentId, tabId, format }) => {
      try {
        const docs = await getDocsService();
        const doc = await docs.documents.get({
          documentId,
          ...(tabId ? { includeTabsContent: true } : {}),
        });

        let docData = doc.data;
        if (tabId) {
          const tab = findTab(doc.data, tabId);
          if (!tab?.documentTab) {
            return {
              content: [{
                type: "text",
                text: `Tab "${tabId}" not found`,
              }],
              isError: true,
            };
          }
          docData = {
            ...doc.data,
            body: tab.documentTab.body,
          };
        }

        let content: string;
        switch (format) {
          case "json":
            content = JSON.stringify(docData, null, 2);
            break;
          case "markdown":
            content = docToMarkdown(docData);
            break;
          default:
            content = docToPlainText(docData);
        }

        return {
          content: [{ type: "text", text: content }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_get_document_info",
    "Get document metadata: title, ID, revision",
    {
      documentId: z.string().describe("Google Docs document ID"),
    },
    async ({ documentId }) => {
      try {
        const docs = await getDocsService();
        const doc = await docs.documents.get({ documentId });

        const info = {
          documentId: doc.data.documentId,
          title: doc.data.title,
          revisionId: doc.data.revisionId,
          bodyContentLength:
            doc.data.body?.content?.length ?? 0,
        };

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(info, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_list_document_tabs",
    "List all tabs in a multi-tab document",
    {
      documentId: z.string().describe("Google Docs document ID"),
    },
    async ({ documentId }) => {
      try {
        const docs = await getDocsService();
        const doc = await docs.documents.get({
          documentId,
          includeTabsContent: true,
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

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(tabList, null, 2),
            },
          ],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );
}

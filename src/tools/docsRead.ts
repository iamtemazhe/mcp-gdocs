import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDocsService } from "../auth.js";
import { docToPlainText, docToMarkdown } from "../utils/docReader.js";
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
        "Read body as text, json (indices), or markdown.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        format: z
          .enum(["text", "json", "markdown"])
          .default("text")
          .describe("Output format"),
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
        ...(tabId ? { includeTabsContent: true } : {}),
        ...(format === "text"
          ? { fields: `documentId,title,${textFields}` }
          : {}),
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
        "Metadata: title, revisionId, body size.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
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
      description: "List tab id and title per tab.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
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

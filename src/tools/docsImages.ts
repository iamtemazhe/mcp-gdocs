import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { handleTool, textResult } from "../utils/errors.js";
import {
  sendBatchedRequests,
  tabIdParam,
  injectTabId,
} from "../utils/batch.js";
import {
  imageItemSchema,
  buildImageRequest,
} from "../utils/styleBuilders.js";

export function registerDocsImageTools(
  server: McpServer,
): void {
  server.tool(
    "docs_insert_image",
    "Insert image from URL at index. Get index from "
    + "docs_read_document (format: json). Supports width/height "
    + "in points",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      items: z.array(imageItemSchema).min(1)
        .describe("Array of images to insert"),
    },
    handleTool(async ({ documentId, tabId, items }) => {
      const requests = items.map(buildImageRequest);
      await sendBatchedRequests(
        documentId, injectTabId(requests, tabId),
      );

      return textResult(
        `Вставлено ${items.length} изображений`,
      );
    }),
  );
}

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { formatApiError } from "../utils/errors.js";
import { sendBatchedRequests } from "../utils/batch.js";
import {
  imageItemSchema,
  buildImageRequest,
} from "../utils/styleBuilders.js";

export function registerDocsImageTools(
  server: McpServer,
): void {
  server.tool(
    "docs_insert_image",
    "Insert one or multiple images from URL",
    {
      documentId: z.string().describe("Document ID"),
      items: z.array(imageItemSchema).min(1)
        .describe("Array of images to insert"),
    },
    async ({ documentId, items }) => {
      try {
        const requests = items.map(buildImageRequest);
        await sendBatchedRequests(documentId, requests);

        return {
          content: [{
            type: "text",
            text: `Вставлено ${items.length} изображений`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );
}

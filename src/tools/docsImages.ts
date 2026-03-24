import { z } from "zod";
import { readFile } from "node:fs/promises";
import { basename, extname } from "node:path";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { docs_v1 } from "googleapis";
import { getDriveService } from "../auth.js";
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
import { Readable } from "node:stream";

const MIME_MAP: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".svg": "image/svg+xml",
  ".bmp": "image/bmp",
};

const localImageItemSchema = z.object({
  filePath: z.string().describe(
    "Absolute path to image file on disk",
  ),
  index: z.number().int().min(1).describe(
    "Insertion position (from docs_read_document "
    + "format: json)",
  ),
  width: z.number().optional().describe(
    "Width in pt (optional)",
  ),
  height: z.number().optional().describe(
    "Height in pt (optional)",
  ),
});

export function registerDocsImageTools(
  server: McpServer,
): void {
  server.registerTool(
    "docs_insert_image",
    {
      title: "Insert Image",
      description:
        "Insert inline images from public URLs (bulk). Index from "
        + "docs_read_document (format: json); optional width/height in "
        + "pt. Local paths → docs_insert_local_image.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        items: z.array(imageItemSchema).min(1)
          .describe("Array of images to insert"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ documentId, tabId, items }) => {
      const requests = items.map(buildImageRequest);
      await sendBatchedRequests(
        documentId, injectTabId(requests, tabId),
      );

      return textResult(
        `Inserted ${items.length} images`,
      );
    }),
  );

  server.registerTool(
    "docs_insert_local_image",
    {
      title: "Insert Local Image",
      description:
        "Insert image from local file: uploads to Drive, then inserts "
        + "at index from docs_read_document (format: json). Use when "
        + "URL-based docs_insert_image is not available.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        items: z.array(localImageItemSchema).min(1)
          .describe("Array of local images to insert"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ documentId, tabId, items }) => {
      const drive = await getDriveService();
      const requests: docs_v1.Schema$Request[] = [];

      for (const item of items) {
        const ext = extname(item.filePath).toLowerCase();
        const mimeType = MIME_MAP[ext] ?? "image/png";
        const content = await readFile(item.filePath);

        const uploaded = await drive.files.create({
          requestBody: {
            name: basename(item.filePath),
            mimeType,
          },
          media: {
            mimeType,
            body: Readable.from(content),
          },
          fields: "id,webContentLink",
        });

        const fileId = uploaded.data.id;
        if (!fileId) {
          throw new Error(
            `Upload failed for ${item.filePath}`,
          );
        }

        await drive.permissions.create({
          fileId,
          requestBody: {
            role: "reader",
            type: "anyone",
          },
        });

        const url = `https://drive.google.com`
          + `/uc?id=${fileId}&export=download`;

        const insertReq:
          docs_v1.Schema$InsertInlineImageRequest = {
            uri: url,
            location: { index: item.index },
          };

        if (item.width || item.height) {
          const size: docs_v1.Schema$Size = {};
          if (item.width) {
            size.width = {
              magnitude: item.width, unit: "PT",
            };
          }
          if (item.height) {
            size.height = {
              magnitude: item.height, unit: "PT",
            };
          }
          insertReq.objectSize = size;
        }

        requests.push({
          insertInlineImage: insertReq,
        });
      }

      if (requests.length > 0) {
        await sendBatchedRequests(
          documentId,
          injectTabId(requests, tabId),
        );
      }

      return textResult(
        `Inserted ${items.length} local images`,
      );
    }),
  );
}

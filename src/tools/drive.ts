import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { drive_v3 } from "googleapis";
import { getDriveService } from "../auth.js";
import { formatApiError, bulkResult } from "../utils/errors.js";

export function registerDriveTools(server: McpServer): void {
  server.tool(
    "drive_list_documents",
    "List Google Docs in a folder or by query",
    {
      folderId: z.string().optional().describe(
        "Folder ID (optional)",
      ),
      query: z.string().optional().describe(
        "Name search substring (optional)",
      ),
      pageSize: z.number().int().min(1).max(100).default(20)
        .describe("Max results per page"),
    },
    async ({ folderId, query, pageSize }) => {
      try {
        const drive = await getDriveService();

        const qParts: string[] = [
          "mimeType='application/vnd.google-apps.document'",
          "trashed=false",
        ];
        if (folderId) {
          qParts.push(`'${folderId}' in parents`);
        }
        if (query) {
          qParts.push(`name contains '${query}'`);
        }

        const result = await drive.files.list({
          q: qParts.join(" and "),
          pageSize,
          fields: "files(id,name,modifiedTime,createdTime,"
            + "owners,webViewLink)",
          orderBy: "modifiedTime desc",
        });

        const files = result.data.files ?? [];
        const items = files.map((f) => ({
          id: f.id,
          name: f.name,
          modifiedTime: f.modifiedTime,
          webViewLink: f.webViewLink,
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify(items, null, 2),
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "drive_search_documents",
    "Full-text search across Google Docs",
    {
      query: z.string().describe("Full-text search query"),
      pageSize: z.number().int().min(1).max(50).default(10)
        .describe("Max results per page"),
    },
    async ({ query, pageSize }) => {
      try {
        const drive = await getDriveService();
        const result = await drive.files.list({
          q: `mimeType='application/vnd.google-apps.document' `
            + `and fullText contains '${query}' `
            + `and trashed=false`,
          pageSize,
          fields: "files(id,name,modifiedTime,webViewLink)",
          orderBy: "modifiedTime desc",
        });

        const files = result.data.files ?? [];
        return {
          content: [{
            type: "text",
            text: JSON.stringify(files, null, 2),
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  const createDocItemSchema = z.object({
    title: z.string().describe("Document title"),
    folderId: z.string().optional().describe(
      "Parent folder ID (optional)",
    ),
  });

  server.tool(
    "drive_create_document",
    "Create one or multiple new empty Google Docs",
    {
      items: z.array(createDocItemSchema).min(1)
        .describe("Array of documents to create"),
    },
    async ({ items }) => {
      const drive = await getDriveService();

      const results = await Promise.allSettled(
        items.map(async ({ title, folderId }) => {
          const result = await drive.files.create({
            requestBody: {
              name: title,
              mimeType:
                "application/vnd.google-apps.document",
              parents: folderId ? [folderId] : undefined,
            },
            fields: "id,name,webViewLink",
          });

          const docId = result.data.id;
          if (!docId) {
            throw new Error("API returned empty document ID");
          }

          return {
            documentId: docId,
            title: result.data.name,
            url: result.data.webViewLink
              ?? `https://docs.google.com/document/d/`
              + `${docId}/edit`,
          };
        }),
      );

      return bulkResult(results);
    },
  );

  const copyItemSchema = z.object({
    fileId: z.string().describe("Source file ID"),
    newName: z.string().optional().describe(
      "New file name (optional)",
    ),
    folderId: z.string().optional().describe(
      "Target folder ID (optional)",
    ),
  });

  server.tool(
    "drive_copy_file",
    "Copy one or multiple files on Google Drive",
    {
      items: z.array(copyItemSchema).min(1)
        .describe("Array of files to copy"),
    },
    async ({ items }) => {
      const drive = await getDriveService();

      const results = await Promise.allSettled(
        items.map(async ({ fileId, newName, folderId }) => {
          const body: drive_v3.Schema$File = {};
          if (newName) body.name = newName;
          if (folderId) body.parents = [folderId];

          const result = await drive.files.copy({
            fileId,
            requestBody: body,
            fields: "id,name,webViewLink",
          });

          return result.data;
        }),
      );

      return bulkResult(results);
    },
  );

  const moveItemSchema = z.object({
    fileId: z.string().describe("File ID"),
    targetFolderId: z.string().describe(
      "Destination folder ID",
    ),
  });

  server.tool(
    "drive_move_file",
    "Move one or multiple files to another folder",
    {
      items: z.array(moveItemSchema).min(1)
        .describe("Array of files to move"),
    },
    async ({ items }) => {
      const drive = await getDriveService();

      const results = await Promise.allSettled(
        items.map(async ({ fileId, targetFolderId }) => {
          const file = await drive.files.get({
            fileId,
            fields: "parents",
          });
          const previousParents =
            (file.data.parents ?? []).join(",");

          await drive.files.update({
            fileId,
            addParents: targetFolderId,
            removeParents: previousParents,
            fields: "id,parents",
          });

          return {
            fileId,
            movedTo: targetFolderId,
          };
        }),
      );

      return bulkResult(results);
    },
  );

  const deleteItemSchema = z.object({
    fileId: z.string().describe("File ID"),
  });

  server.tool(
    "drive_delete_file",
    "Delete one or multiple files (move to trash)",
    {
      items: z.array(deleteItemSchema).min(1)
        .describe("Array of files to delete"),
    },
    async ({ items }) => {
      const drive = await getDriveService();

      const results = await Promise.allSettled(
        items.map(async ({ fileId }) => {
          await drive.files.update({
            fileId,
            requestBody: { trashed: true },
          });
          return { fileId, trashed: true };
        }),
      );

      return bulkResult(results);
    },
  );

  const createFolderItemSchema = z.object({
    name: z.string().describe("Folder name"),
    parentFolderId: z.string().optional().describe(
      "Parent folder ID (optional)",
    ),
  });

  server.tool(
    "drive_create_folder",
    "Create one or multiple folders on Google Drive",
    {
      items: z.array(createFolderItemSchema).min(1)
        .describe("Array of folders to create"),
    },
    async ({ items }) => {
      const drive = await getDriveService();

      const results = await Promise.allSettled(
        items.map(async ({ name, parentFolderId }) => {
          const result = await drive.files.create({
            requestBody: {
              name,
              mimeType: "application/vnd.google-apps.folder",
              parents: parentFolderId
                ? [parentFolderId]
                : undefined,
            },
            fields: "id,name,webViewLink",
          });
          return result.data;
        }),
      );

      return bulkResult(results);
    },
  );

  server.tool(
    "drive_list_folder_contents",
    "List folder contents on Google Drive",
    {
      folderId: z.string().describe("Folder ID"),
      pageSize: z.number().int().min(1).max(100).default(50)
        .describe("Max results per page"),
    },
    async ({ folderId, pageSize }) => {
      try {
        const drive = await getDriveService();
        const result = await drive.files.list({
          q: `'${folderId}' in parents and trashed=false`,
          pageSize,
          fields: "files(id,name,mimeType,modifiedTime,"
            + "webViewLink)",
          orderBy: "name",
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(
              result.data.files ?? [], null, 2,
            ),
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  const templateItemSchema = z.object({
    templateId: z.string().describe(
      "Template document ID",
    ),
    title: z.string().describe(
      "Title for the new document",
    ),
    folderId: z.string().optional().describe(
      "Target folder ID (optional)",
    ),
  });

  server.tool(
    "drive_create_from_template",
    "Create one or more documents from a template (copy)",
    {
      items: z.array(templateItemSchema).min(1)
        .describe("Array of documents to create"),
    },
    async ({ items }) => {
      const drive = await getDriveService();

      const results = await Promise.allSettled(
        items.map(
          async ({ templateId, title, folderId }) => {
            const body: drive_v3.Schema$File = {
              name: title,
            };
            if (folderId) {
              body.parents = [folderId];
            }

            const result = await drive.files.copy({
              fileId: templateId,
              requestBody: body,
              fields: "id,name,webViewLink",
            });

            return {
              documentId: result.data.id,
              name: result.data.name,
              url: result.data.webViewLink,
            };
          },
        ),
      );

      return bulkResult(results);
    },
  );

  server.tool(
    "drive_get_folder_info",
    "Get folder metadata from Google Drive",
    {
      folderId: z.string().describe("Folder ID"),
    },
    async ({ folderId }) => {
      try {
        const drive = await getDriveService();
        const result = await drive.files.get({
          fileId: folderId,
          fields: "id,name,mimeType,createdTime,"
            + "modifiedTime,parents,webViewLink,"
            + "owners(displayName,emailAddress),shared",
        });

        return {
          content: [{
            type: "text",
            text: JSON.stringify(result.data, null, 2),
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  const renameItemSchema = z.object({
    fileId: z.string().describe("File ID"),
    newName: z.string().describe("New file name"),
  });

  server.tool(
    "drive_rename_file",
    "Rename one or multiple files on Google Drive",
    {
      items: z.array(renameItemSchema).min(1)
        .describe("Array of files to rename"),
    },
    async ({ items }) => {
      const drive = await getDriveService();

      const results = await Promise.allSettled(
        items.map(async ({ fileId, newName }) => {
          const result = await drive.files.update({
            fileId,
            requestBody: { name: newName },
            fields: "id,name,webViewLink",
          });
          return result.data;
        }),
      );

      return bulkResult(results);
    },
  );
}

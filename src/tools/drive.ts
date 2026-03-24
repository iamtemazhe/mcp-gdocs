import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { drive_v3 } from "googleapis";
import { getDriveService } from "../auth.js";
import {
  bulkResult,
  handleTool,
  jsonResult,
} from "../utils/errors.js";

type DriveVerbosity = "min" | "normal";

const driveVerbositySchema = z
  .enum(["min", "normal"])
  .default("normal")
  .describe("Detail: min(default)|normal");

function simplifyFile(
  f: drive_v3.Schema$File,
  v: DriveVerbosity,
): Record<string, unknown> {
  if (v === "min") {
    return { id: f.id, name: f.name };
  }
  return {
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
    webViewLink: f.webViewLink,
  };
}

export function registerDriveTools(server: McpServer): void {
  server.registerTool(
    "drive_list_documents",
    {
      title: "List Documents",
      description:
        "List Google Docs; optional folder or name filter.",
      inputSchema: {
        folderId: z.string().optional().describe(
          "Folder ID from drive_list_folder_contents",
        ),
        query: z.string().optional().describe("Name substring"),
        pageSize: z.number().int().min(1).max(100).default(20)
          .describe("Page size"),
        verbosity: driveVerbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({
      folderId, query, pageSize, verbosity,
    }) => {
      const v = verbosity as DriveVerbosity;
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

      const fields = v === "min"
        ? "files(id,name)"
        : "files(id,name,modifiedTime,webViewLink)";

      const result = await drive.files.list({
        q: qParts.join(" and "),
        pageSize,
        fields,
        orderBy: "modifiedTime desc",
      });

      const files = result.data.files ?? [];
      return jsonResult(
        files.map((f) => simplifyFile(f, v)),
      );
    }),
  );

  server.registerTool(
    "drive_search_documents",
    {
      title: "Search Documents",
      description:
        "Full-text search in Doc bodies.",
      inputSchema: {
        query: z.string().describe("Search text"),
        pageSize: z.number().int().min(1).max(50).default(10)
          .describe("Page size"),
        verbosity: driveVerbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ query, pageSize, verbosity }) => {
      const v = verbosity as DriveVerbosity;
      const drive = await getDriveService();

      const fields = v === "min"
        ? "files(id,name)"
        : "files(id,name,modifiedTime,webViewLink)";

      const result = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.document' `
          + `and fullText contains '${query}' `
          + `and trashed=false`,
        pageSize,
        fields,
        orderBy: "modifiedTime desc",
      });

      const files = result.data.files ?? [];
      return jsonResult(
        files.map((f) => simplifyFile(f, v)),
      );
    }),
  );

  const createDocItemSchema = z.object({
    title: z.string().describe("Doc title"),
    folderId: z.string().optional().describe("Parent folder"),
  });

  server.registerTool(
    "drive_create_document",
    {
      title: "Create Document",
      description: "Bulk create empty Docs.",
      inputSchema: {
        items: z.array(createDocItemSchema).min(1)
          .describe("Docs to create"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ items }) => {
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
    }),
  );

  const copyItemSchema = z.object({
    fileId: z.string().describe(
      "File ID from drive_list_documents or drive_search_documents",
    ),
    newName: z.string().optional().describe("New name"),
    folderId: z.string().optional().describe("Target folder"),
  });

  server.registerTool(
    "drive_copy_file",
    {
      title: "Copy File",
      description:
        "Bulk copy files; optional name or folder.",
      inputSchema: {
        items: z.array(copyItemSchema).min(1)
          .describe("Copy jobs"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ items }) => {
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
    }),
  );

  const moveItemSchema = z.object({
    fileId: z.string().describe(
      "File ID from drive_list_documents or drive_search_documents",
    ),
    targetFolderId: z.string().describe("Target folder"),
  });

  server.registerTool(
    "drive_move_file",
    {
      title: "Move File",
      description: "Bulk move to another folder.",
      inputSchema: {
        items: z.array(moveItemSchema).min(1)
          .describe("Move jobs"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ items }) => {
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
    }),
  );

  const deleteItemSchema = z.object({
    fileId: z.string().describe(
      "File ID from drive_list_documents or drive_search_documents",
    ),
  });

  server.registerTool(
    "drive_delete_file",
    {
      title: "Delete File",
      description:
        "Bulk trash files (reversible).",
      inputSchema: {
        items: z.array(deleteItemSchema).min(1)
          .describe("Files to trash"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ items }) => {
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
    }),
  );

  const createFolderItemSchema = z.object({
    name: z.string().describe("Folder name"),
    parentFolderId: z.string().optional().describe("Parent folder"),
  });

  server.registerTool(
    "drive_create_folder",
    {
      title: "Create Folder",
      description: "Bulk create folders.",
      inputSchema: {
        items: z.array(createFolderItemSchema).min(1)
          .describe("Folders to create"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ items }) => {
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
    }),
  );

  server.registerTool(
    "drive_list_folder_contents",
    {
      title: "List Folder Contents",
      description: "List folder children.",
      inputSchema: {
        folderId: z.string().describe("Folder ID"),
        pageSize: z.number().int().min(1).max(100).default(50)
          .describe("Page size"),
        verbosity: driveVerbositySchema,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ folderId, pageSize, verbosity }) => {
      const v = verbosity as DriveVerbosity;
      const drive = await getDriveService();

      const fields = v === "min"
        ? "files(id,name,mimeType)"
        : "files(id,name,mimeType,modifiedTime,"
          + "webViewLink)";

      const result = await drive.files.list({
        q: `'${folderId}' in parents and trashed=false`,
        pageSize,
        fields,
        orderBy: "name",
      });

      const files = result.data.files ?? [];
      return jsonResult(
        files.map((f) => {
          const base = simplifyFile(f, v);
          base.mimeType = f.mimeType;
          return base;
        }),
      );
    }),
  );

  const templateItemSchema = z.object({
    templateId: z.string().describe("Template ID"),
    title: z.string().describe("New title"),
    folderId: z.string().optional().describe("Target folder"),
  });

  server.registerTool(
    "drive_create_from_template",
    {
      title: "Create From Template",
      description:
        "Bulk copy template to new Doc.",
      inputSchema: {
        items: z.array(templateItemSchema).min(1)
          .describe("Template copies"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ items }) => {
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
    }),
  );

  server.registerTool(
    "drive_get_folder_info",
    {
      title: "Get Folder Info",
      description:
        "Folder metadata and parents.",
      inputSchema: {
        folderId: z.string().describe("Folder ID"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ folderId }) => {
      const drive = await getDriveService();
      const result = await drive.files.get({
        fileId: folderId,
        fields: "id,name,mimeType,createdTime,"
          + "modifiedTime,parents,webViewLink,"
          + "owners(displayName,emailAddress),shared",
      });

      return jsonResult(result.data);
    }),
  );

  const renameItemSchema = z.object({
    fileId: z.string().describe(
      "File ID from drive_list_documents or drive_search_documents",
    ),
    newName: z.string().describe("New name"),
  });

  server.registerTool(
    "drive_rename_file",
    {
      title: "Rename File",
      description: "Bulk rename; id unchanged.",
      inputSchema: {
        items: z.array(renameItemSchema).min(1)
          .describe("Rename jobs"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ items }) => {
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
    }),
  );
}

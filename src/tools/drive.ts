import { writeFile } from "node:fs/promises";
import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { documentIdParam, fileIdParam } from "../utils/schemas.js";
import type { drive_v3 } from "googleapis";
import { getDriveService } from "../auth.js";
import {
  bulkResult,
  handleTool,
  jsonResult,
  textResult,
} from "../utils/errors.js";
import {
  authMeta,
  canDo,
  saRestrictionNote,
} from "../utils/authCapabilities.js";

/** Escape Drive API `q` string literals (single-quoted segments). */
export function escapeQ(s: string): string {
  return s.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

type DriveVerbosity = "min" | "normal";

function sharedDriveListOptions(
  includeSharedDrives: boolean,
): Pick<
  drive_v3.Params$Resource$Files$List,
  "supportsAllDrives" | "includeItemsFromAllDrives"
> {
  return includeSharedDrives
    ? {
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
    }
    : {};
}

const supportsAllDrivesParam = {
  supportsAllDrives: true,
} as const;

const driveVerbositySchema = z
  .enum(["min", "normal"])
  .default("normal")
  .describe("Detail: normal(default)|min");

function exportResponseToBuffer(data: unknown): Buffer {
  if (data instanceof ArrayBuffer) {
    return Buffer.from(data);
  }
  if (Buffer.isBuffer(data)) {
    return data;
  }
  if (data instanceof Uint8Array) {
    return Buffer.from(data);
  }
  throw new Error("Unexpected export response type");
}

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
        "List Google Docs in My Drive or a folder, filtered by name.",
      inputSchema: {
        folderId: z.string().optional().describe(
          "Folder ID from drive_list_folder_contents",
        ),
        query: z.string().optional().describe("Name substring"),
        pageSize: z.number().int().min(1).max(100).default(20)
          .describe("Page size"),
        verbosity: driveVerbositySchema,
        includeSharedDrives: z.boolean().default(false)
          .describe("Include Shared Drive files"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({
      folderId,
      query,
      pageSize,
      verbosity,
      includeSharedDrives,
    }) => {
      const v = verbosity as DriveVerbosity;
      const drive = await getDriveService();

      const qParts: string[] = [
        "mimeType='application/vnd.google-apps.document'",
        "trashed=false",
      ];
      if (folderId) {
        qParts.push(`'${escapeQ(folderId)}' in parents`);
      }
      if (query) {
        qParts.push(`name contains '${escapeQ(query)}'`);
      }

      const fields = v === "min"
        ? "files(id,name)"
        : "files(id,name,modifiedTime,webViewLink)";

      const result = await drive.files.list({
        q: qParts.join(" and "),
        pageSize,
        fields,
        orderBy: "modifiedTime desc",
        ...sharedDriveListOptions(includeSharedDrives),
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
        "Search Google Docs by full-text content in the document body.",
      inputSchema: {
        query: z.string().describe("Search text"),
        pageSize: z.number().int().min(1).max(50).default(10)
          .describe("Page size"),
        verbosity: driveVerbositySchema,
        includeSharedDrives: z.boolean().default(false)
          .describe("Include Shared Drive files"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({
      query, pageSize, verbosity, includeSharedDrives,
    }) => {
      const v = verbosity as DriveVerbosity;
      const drive = await getDriveService();

      const fields = v === "min"
        ? "files(id,name)"
        : "files(id,name,modifiedTime,webViewLink)";

      const result = await drive.files.list({
        q: `mimeType='application/vnd.google-apps.document' `
          + `and fullText contains '${escapeQ(query)}' `
          + `and trashed=false`,
        pageSize,
        fields,
        orderBy: "modifiedTime desc",
        ...sharedDriveListOptions(includeSharedDrives),
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
      description: "Create one or more empty Google Docs.",
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
      _meta: authMeta(["create_files"]),
    },
    handleTool(async ({ items }) => {
      if (!canDo("create_files")) {
        return textResult(saRestrictionNote(["create_files"]));
      }
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
            ...supportsAllDrivesParam,
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
    fileId: fileIdParam,
    newName: z.string().optional().describe("New name"),
    folderId: z.string().optional().describe("Target folder"),
  });

  server.registerTool(
    "drive_copy_file",
    {
      title: "Copy File",
      description:
        "Copy files in bulk; optionally set a new name or parent folder.",
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
      _meta: authMeta(["create_files"]),
    },
    handleTool(async ({ items }) => {
      if (!canDo("create_files")) {
        return textResult(saRestrictionNote(["create_files"]));
      }
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
            ...supportsAllDrivesParam,
          });

          return result.data;
        }),
      );

      return bulkResult(results);
    }),
  );

  const moveItemSchema = z.object({
    fileId: fileIdParam,
    targetFolderId: z.string().describe("Target folder"),
  });

  server.registerTool(
    "drive_move_file",
    {
      title: "Move File",
      description: "Move files to another folder in bulk.",
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
            ...supportsAllDrivesParam,
          });
          const previousParents =
            (file.data.parents ?? []).join(",");

          await drive.files.update({
            fileId,
            addParents: targetFolderId,
            removeParents: previousParents,
            fields: "id,parents",
            ...supportsAllDrivesParam,
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
    fileId: fileIdParam,
  });

  server.registerTool(
    "drive_delete_file",
    {
      title: "Delete File",
      description:
        "Delete files in bulk (trash by default, permanent if specified).",
      inputSchema: {
        items: z.array(deleteItemSchema).min(1)
          .describe("Files to delete"),
        permanent: z.boolean().optional().default(false)
          .describe("Permanently delete instead of trash"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
      _meta: authMeta(["trash"]),
    },
    handleTool(async ({ items, permanent }) => {
      const drive = await getDriveService();

      const results = await Promise.allSettled(
        items.map(async ({ fileId }) => {
          if (permanent) {
            await drive.files.delete({
              fileId,
              ...supportsAllDrivesParam,
            });
            return { fileId, deleted: true };
          }
          try {
            await drive.files.update({
              fileId,
              requestBody: { trashed: true },
              ...supportsAllDrivesParam,
            });
            return { fileId, trashed: true };
          } catch (err: unknown) {
            const status = (err as { status?: number }).status;
            if (status === 403) {
              await drive.files.delete({
                fileId,
                ...supportsAllDrivesParam,
              });
              return { fileId, deleted: true };
            }
            throw err;
          }
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
      description: "Create folders in bulk under an optional parent.",
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
            ...supportsAllDrivesParam,
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
      description: "List files and folders directly inside a folder.",
      inputSchema: {
        folderId: z.string().describe("Folder ID"),
        pageSize: z.number().int().min(1).max(100).default(50)
          .describe("Page size"),
        verbosity: driveVerbositySchema,
        includeSharedDrives: z.boolean().default(false)
          .describe("Include Shared Drive files"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({
      folderId, pageSize, verbosity, includeSharedDrives,
    }) => {
      const v = verbosity as DriveVerbosity;
      const drive = await getDriveService();

      const fields = v === "min"
        ? "files(id,name,mimeType)"
        : "files(id,name,mimeType,modifiedTime,"
          + "webViewLink)";

      const result = await drive.files.list({
        q: `'${escapeQ(folderId)}' in parents and trashed=false`,
        pageSize,
        fields,
        orderBy: "name",
        ...sharedDriveListOptions(includeSharedDrives),
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
      description: "Create new documents from templates in bulk.",
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
      _meta: authMeta(["create_files"]),
    },
    handleTool(async ({ items }) => {
      if (!canDo("create_files")) {
        return textResult(saRestrictionNote(["create_files"]));
      }
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
              ...supportsAllDrivesParam,
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
      description: "Fetch folder metadata and parent folder ids.",
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
        ...supportsAllDrivesParam,
      });

      return jsonResult(result.data);
    }),
  );

  const renameItemSchema = z.object({
    fileId: fileIdParam,
    newName: z.string().describe("New name"),
  });

  server.registerTool(
    "drive_rename_file",
    {
      title: "Rename File",
      description: "Rename files in bulk.",
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
            ...supportsAllDrivesParam,
          });
          return result.data;
        }),
      );

      return bulkResult(results);
    }),
  );

  server.registerTool(
    "docs_export_pdf",
    {
      title: "Docs: Export PDF URL",
      description:
        "Get a PDF export link for a document, or save the PDF to a local path.",
      inputSchema: {
        documentId: documentIdParam,
        savePath: z.string().optional().describe(
          "Local path to write PDF via API export",
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ documentId, savePath }) => {
      if (savePath) {
        const drive = await getDriveService();
        const result = await drive.files.export(
          { fileId: documentId, mimeType: "application/pdf" },
          { responseType: "arraybuffer" },
        );
        const buf = exportResponseToBuffer(result.data);
        await writeFile(savePath, buf);
        return textResult(`PDF saved to ${savePath}`);
      }
      const url =
        `https://docs.google.com/document/d/${documentId}/export?format=pdf`;
      return textResult(`PDF export URL: ${url}`);
    }),
  );

  const driveExportMimeSchema = z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
    "text/markdown",
    "text/html",
    "application/epub+zip",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
    "application/vnd.oasis.opendocument.text",
  ]);

  server.registerTool(
    "drive_share_file",
    {
      title: "Drive: Share File",
      description:
        "Share a file by granting access to a user, group, domain, or anyone.",
      inputSchema: {
        fileId: fileIdParam,
        role: z.enum(["reader", "writer", "commenter", "organizer"])
          .describe("Access role"),
        type: z.enum(["user", "group", "domain", "anyone"])
          .describe("Grantee type"),
        emailAddress: z.string().optional().describe(
          "Required for user or group",
        ),
        domain: z.string().optional().describe(
          "Required when type is domain",
        ),
        sendNotificationEmail: z.boolean().default(true)
          .describe("Notify user/group by email"),
        transferOwnership: z.boolean().default(false)
          .describe("Transfer ownership (user only)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({
      fileId,
      role,
      type,
      emailAddress,
      domain: domainVal,
      sendNotificationEmail,
      transferOwnership,
    }) => {
      if (
        (type === "user" || type === "group")
        && !(emailAddress?.trim())
      ) {
        throw new Error(
          "emailAddress is required for type user or group",
        );
      }
      if (type === "domain" && !(domainVal?.trim())) {
        throw new Error("domain is required for type domain");
      }

      const drive = await getDriveService();
      const requestBody: drive_v3.Schema$Permission = {
        role,
        type,
      };
      if (emailAddress?.trim()) {
        requestBody.emailAddress = emailAddress.trim();
      }
      if (domainVal?.trim()) {
        requestBody.domain = domainVal.trim();
      }

      const result = await drive.permissions.create({
        fileId,
        requestBody,
        sendNotificationEmail,
        transferOwnership,
        ...supportsAllDrivesParam,
      });

      return jsonResult({
        id: result.data.id,
        role: result.data.role,
      });
    }),
  );

  server.registerTool(
    "drive_list_permissions",
    {
      title: "Drive: List Permissions",
      description: "List who has access to a file and their roles.",
      inputSchema: {
        fileId: fileIdParam,
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ fileId }) => {
      const drive = await getDriveService();
      const result = await drive.permissions.list({
        fileId,
        fields:
          "permissions(id,role,type,emailAddress,domain,displayName)",
        ...supportsAllDrivesParam,
      });
      return jsonResult(result.data.permissions ?? []);
    }),
  );

  server.registerTool(
    "drive_update_permission",
    {
      title: "Drive: Update Permission",
      description: "Change an existing permission's role on a file.",
      inputSchema: {
        fileId: fileIdParam,
        permissionId: z.string().describe("Permission ID"),
        role: z.enum(["reader", "writer", "commenter", "organizer"])
          .describe("New role"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ fileId, permissionId, role }) => {
      const drive = await getDriveService();
      const result = await drive.permissions.update({
        fileId,
        permissionId,
        requestBody: { role },
        ...supportsAllDrivesParam,
      });
      return jsonResult(result.data);
    }),
  );

  server.registerTool(
    "drive_remove_permission",
    {
      title: "Drive: Remove Permission",
      description: "Remove a permission from a file.",
      inputSchema: {
        fileId: fileIdParam,
        permissionId: z.string().describe("Permission ID"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ fileId, permissionId }) => {
      const drive = await getDriveService();
      await drive.permissions.delete({
        fileId,
        permissionId,
        ...supportsAllDrivesParam,
      });
      return textResult(`Permission ${permissionId} removed from ${fileId}`);
    }),
  );

  server.registerTool(
    "drive_export_file",
    {
      title: "Drive: Export File",
      description:
        "Export a Google Doc or Sheet to another file format, optionally saving to disk.",
      inputSchema: {
        fileId: fileIdParam,
        mimeType: driveExportMimeSchema.describe("Target MIME type"),
        savePath: z.string().optional().describe(
          "Local file path to write exported bytes",
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ fileId, mimeType, savePath }) => {
      const drive = await getDriveService();
      const result = await drive.files.export(
        { fileId, mimeType },
        { responseType: "arraybuffer" },
      );
      const buf = exportResponseToBuffer(result.data);

      if (savePath) {
        await writeFile(savePath, buf);
        return textResult(`Exported to ${savePath}`);
      }

      const isTextMime = mimeType.startsWith("text/");
      if (isTextMime) {
        return textResult(buf.toString("utf8"));
      }

      return textResult(
        "Binary export is not returned inline. Pass savePath to save locally.",
      );
    }),
  );

  server.registerTool(
    "drive_list_revisions",
    {
      title: "Drive: List Revisions",
      description: "List past revisions of a file.",
      inputSchema: {
        fileId: fileIdParam,
        pageSize: z.number().int().min(1).max(200).default(10)
          .describe("Max revisions per page"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ fileId, pageSize }) => {
      const drive = await getDriveService();
      const result = await drive.revisions.list({
        fileId,
        pageSize,
        fields:
          "revisions(id,modifiedTime,"
          + "lastModifyingUser(displayName,emailAddress))",
      });
      return jsonResult(result.data.revisions ?? []);
    }),
  );

  server.registerTool(
    "drive_get_revision",
    {
      title: "Drive: Get Revision",
      description: "Fetch metadata for one file revision.",
      inputSchema: {
        fileId: fileIdParam,
        revisionId: z.string().describe("Revision ID"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ fileId, revisionId }) => {
      const drive = await getDriveService();
      const result = await drive.revisions.get({
        fileId,
        revisionId,
        fields:
          "id,modifiedTime,lastModifyingUser(displayName,emailAddress),"
          + "size,exportLinks",
      });
      return jsonResult(result.data);
    }),
  );

  server.registerTool(
    "drive_list_shared_drives",
    {
      title: "Drive: List Shared Drives",
      description:
        "List shared drives you can access, optionally filtering by name.",
      inputSchema: {
        pageSize: z.number().int().min(1).max(100).default(10)
          .describe("Page size"),
        query: z.string().optional().describe("Name substring filter"),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ pageSize, query }) => {
      const drive = await getDriveService();
      const result = await drive.drives.list({
        pageSize,
        q: query
          ? `name contains '${escapeQ(query)}'`
          : undefined,
        fields: "drives(id,name,createdTime)",
      });
      return jsonResult(result.data.drives ?? []);
    }),
  );
}

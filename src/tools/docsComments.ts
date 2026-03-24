import { z } from "zod";
import type { drive_v3 } from "googleapis";
import { documentIdParam } from "../utils/schemas.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDriveService } from "../auth.js";
import {
  bulkResult,
  handleTool,
  jsonResult,
} from "../utils/errors.js";

export function registerDocsCommentTools(
  server: McpServer,
): void {
  server.registerTool(
    "docs_list_comments",
    {
      title: "List Comments",
      description:
        "List comment threads on a document.",
      inputSchema: {
        documentId: documentIdParam,
        includeDeleted: z.boolean().default(false).describe(
          "Include deleted",
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ documentId, includeDeleted }) => {
      const drive = await getDriveService();
      const result = await drive.comments.list({
        fileId: documentId,
        fields: "comments(id,content,author(displayName,"
          + "emailAddress),createdTime,modifiedTime,"
          + "resolved,quotedFileContent,replies(id,"
          + "content,author(displayName),createdTime))",
        includeDeleted,
      });

      const comments = (result.data.comments ?? [])
        .map((c) => ({
          id: c.id,
          content: c.content,
          author: c.author?.displayName,
          authorEmail: c.author?.emailAddress,
          createdTime: c.createdTime,
          modifiedTime: c.modifiedTime,
          resolved: c.resolved,
          quotedText: c.quotedFileContent?.value,
          repliesCount: c.replies?.length ?? 0,
        }));

      return jsonResult(comments);
    }),
  );

  server.registerTool(
    "docs_get_comment",
    {
      title: "Get Comment",
      description:
        "Fetch one comment thread including replies.",
      inputSchema: {
        documentId: documentIdParam,
        commentId: z.string().describe(
          "Comment ID from docs_list_comments",
        ),
      },
      annotations: {
        readOnlyHint: true,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({ documentId, commentId }) => {
      const drive = await getDriveService();
      const result = await drive.comments.get({
        fileId: documentId,
        commentId,
        fields: "id,content,author(displayName,"
          + "emailAddress),createdTime,modifiedTime,"
          + "resolved,quotedFileContent,replies(id,"
          + "content,author(displayName,emailAddress),"
          + "createdTime,modifiedTime)",
        includeDeleted: true,
      });

      return jsonResult(result.data);
    }),
  );

  const addCommentItemSchema = z.object({
    documentId: documentIdParam,
    content: z.string().describe("Comment body"),
    quotedText: z.string().optional().describe(
      "Anchor quote",
    ),
  });

  server.registerTool(
    "docs_add_comment",
    {
      title: "Add Comment",
      description:
        "Add comments to a document, optionally anchoring with an exact text quote.",
      inputSchema: {
        items: z.array(addCommentItemSchema).min(1)
          .describe("Comments to add"),
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
        items.map(async ({ documentId, content, quotedText }) => {
          const requestBody: drive_v3.Schema$Comment = {
            content,
          };

          if (quotedText) {
            requestBody.anchor = JSON.stringify({
              "r": "head",
              "a": [{ "txt": { "o": quotedText } }],
            });
            requestBody.quotedFileContent = {
              value: quotedText,
            };
          }

          const result = await drive.comments.create({
            fileId: documentId,
            fields: "id,content,author(displayName),"
              + "createdTime",
            requestBody,
          });

          return result.data;
        }),
      );

      return bulkResult(results);
    }),
  );

  const replyItemSchema = z.object({
    documentId: documentIdParam,
    commentId: z.string().describe(
      "Comment ID from docs_list_comments",
    ),
    content: z.string().describe("Reply body"),
  });

  server.registerTool(
    "docs_reply_to_comment",
    {
      title: "Reply To Comment",
      description:
        "Reply to existing comment threads in bulk.",
      inputSchema: {
        items: z.array(replyItemSchema).min(1)
          .describe("Replies to add"),
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
        items.map(async ({ documentId, commentId, content }) => {
          const result = await drive.replies.create({
            fileId: documentId,
            commentId,
            fields: "id,content,author(displayName),"
              + "createdTime",
            requestBody: { content },
          });
          return result.data;
        }),
      );

      return bulkResult(results);
    }),
  );

  const resolveItemSchema = z.object({
    documentId: documentIdParam,
    commentId: z.string().describe(
      "Comment ID from docs_list_comments",
    ),
  });

  server.registerTool(
    "docs_resolve_comment",
    {
      title: "Resolve Comment",
      description:
        "Mark comment threads as resolved in bulk.",
      inputSchema: {
        items: z.array(resolveItemSchema).min(1)
          .describe("Comments to resolve"),
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
        items.map(async ({ documentId, commentId }) => {
          await drive.replies.create({
            fileId: documentId,
            commentId,
            fields: "id",
            requestBody: {
              content: "",
              action: "resolve",
            },
          });
          return { commentId, resolved: true };
        }),
      );

      return bulkResult(results);
    }),
  );

  const deleteCommentItemSchema = z.object({
    documentId: documentIdParam,
    commentId: z.string().describe(
      "Comment ID from docs_list_comments",
    ),
  });

  server.registerTool(
    "docs_delete_comment",
    {
      title: "Delete Comment",
      description:
        "Delete comment threads permanently in bulk.",
      inputSchema: {
        items: z.array(deleteCommentItemSchema).min(1)
          .describe("Comments to delete"),
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
        items.map(async ({ documentId, commentId }) => {
          await drive.comments.delete({
            fileId: documentId,
            commentId,
          });
          return { commentId, deleted: true };
        }),
      );

      return bulkResult(results);
    }),
  );
}

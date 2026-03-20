import { z } from "zod";
import type { drive_v3 } from "googleapis";
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
  server.tool(
    "docs_list_comments",
    "List all comments on document with replies and resolution "
    + "status",
    {
      documentId: z.string().describe("Document ID"),
      includeDeleted: z.boolean().default(false).describe(
        "Include deleted comments",
      ),
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

  server.tool(
    "docs_get_comment",
    "Get single comment details. Get commentId from "
    + "docs_list_comments",
    {
      documentId: z.string().describe("Document ID"),
      commentId: z.string().describe("Comment ID"),
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
    documentId: z.string().describe("Document ID"),
    content: z.string().describe("Comment text"),
    quotedText: z.string().optional().describe(
      "Document text to anchor the comment to",
    ),
  });

  server.tool(
    "docs_add_comment",
    "Add comment to document. Anchor to text "
    + "via quotedText (exact text from document)",
    {
      items: z.array(addCommentItemSchema).min(1)
        .describe("Array of comments to add"),
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
    documentId: z.string().describe("Document ID"),
    commentId: z.string().describe("Comment ID"),
    content: z.string().describe("Reply text"),
  });

  server.tool(
    "docs_reply_to_comment",
    "Reply to existing comment. Get commentId from "
    + "docs_list_comments",
    {
      items: z.array(replyItemSchema).min(1)
        .describe("Array of replies to create"),
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
    documentId: z.string().describe("Document ID"),
    commentId: z.string().describe("Comment ID"),
  });

  server.tool(
    "docs_resolve_comment",
    "Mark comment as resolved. Get commentId from "
    + "docs_list_comments",
    {
      items: z.array(resolveItemSchema).min(1)
        .describe("Array of comments to resolve"),
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
    documentId: z.string().describe("Document ID"),
    commentId: z.string().describe("Comment ID"),
  });

  server.tool(
    "docs_delete_comment",
    "Delete comment. Get commentId from docs_list_comments",
    {
      items: z.array(deleteCommentItemSchema).min(1)
        .describe("Array of comments to delete"),
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

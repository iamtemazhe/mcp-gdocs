import { z } from "zod";
import { readFile } from "node:fs/promises";
import { Readable } from "node:stream";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getDriveService } from "../auth.js";
import { textResult, handleTool } from "../utils/errors.js";
import { documentIdParam } from "../utils/schemas.js";
import {
  authMeta,
  canDo,
  saRestrictionNote,
} from "../utils/authCapabilities.js";
import {
  sendBatchedRequests,
  fetchDocIndices,
  tabIdParam,
  injectTabId,
} from "../utils/batch.js";

/**
 * Upload markdown content to Google Drive as a new Google Doc.
 * Google natively parses headings, bold, italic, tables, lists.
 */
async function uploadMarkdownAsDoc(
  markdown: string,
  name: string,
  folderId?: string,
): Promise<{ id: string; url: string }> {
  const drive = await getDriveService();

  const result = await drive.files.create({
    requestBody: {
      name,
      mimeType: "application/vnd.google-apps.document",
      parents: folderId ? [folderId] : undefined,
    },
    media: {
      mimeType: "text/markdown",
      body: Readable.from(markdown),
    },
    fields: "id,webViewLink",
    supportsAllDrives: true,
  });

  const id = result.data.id;
  if (!id) throw new Error("API returned empty document ID");

  return {
    id,
    url: result.data.webViewLink
      ?? `https://docs.google.com/document/d/${id}/edit`,
  };
}

/**
 * Replace existing document content by uploading markdown via
 * Drive files.update with media body.
 */
async function replaceDocWithMarkdown(
  documentId: string,
  markdown: string,
): Promise<void> {
  const drive = await getDriveService();

  await drive.files.update({
    fileId: documentId,
    media: {
      mimeType: "text/markdown",
      body: Readable.from(markdown),
    },
    supportsAllDrives: true,
  });
}

/**
 * Apply global font and color to the entire document body.
 * Typical post-processing: Times New Roman, black, 14pt.
 */
async function applyGlobalFont(
  documentId: string,
  tabId?: string,
  fontFamily = "Times New Roman",
  fontSize = 14,
): Promise<number> {
  const { endIndex } = await fetchDocIndices(
    documentId, tabId,
  );

  if (endIndex <= 2) return 0;

  const reqs = injectTabId([{
    updateTextStyle: {
      range: { startIndex: 1, endIndex: endIndex - 1 },
      textStyle: {
        weightedFontFamily: {
          fontFamily,
          weight: 400,
        },
        fontSize: {
          magnitude: fontSize,
          unit: "PT",
        },
        foregroundColor: {
          color: {
            rgbColor: { red: 0, green: 0, blue: 0 },
          },
        },
      },
      fields: "weightedFontFamily,fontSize,foregroundColor",
    },
  }], tabId);

  const replies = await sendBatchedRequests(
    documentId, reqs,
  );
  return replies.length;
}

function extractFirstHeading(
  markdown: string,
): string | null {
  const match = /^#{1,6}\s+(.+)$/m.exec(markdown);
  return match ? match[1].trim() : null;
}

async function afterNativeCreate(
  id: string,
  markdown: string,
  opts: {
    applyFont: boolean;
    fontFamily: string;
    fontSize: number;
    firstHeadingAsTitle: boolean;
  },
): Promise<number> {
  let ops = 0;
  if (opts.applyFont) {
    ops = await applyGlobalFont(
      id, undefined, opts.fontFamily, opts.fontSize,
    );
  }
  if (opts.firstHeadingAsTitle) {
    const heading = extractFirstHeading(markdown);
    if (heading) {
      const drive = await getDriveService();
      await drive.files.update({
        fileId: id,
        requestBody: { name: heading },
      });
    }
  }
  return ops;
}

export function registerDocsMarkdownNativeTools(
  server: McpServer,
): void {
  server.registerTool(
    "drive_create_from_markdown",
    {
      title: "Create Doc from Markdown (native)",
      description:
        "Create a new Google Doc from Markdown using native conversion.",
      inputSchema: {
        title: z.string().describe("Document title"),
        markdown: z.string().describe("Markdown source"),
        folderId: z.string().optional()
          .describe("Parent folder ID"),
        applyFont: z.boolean().default(false).describe(
          "Override font/size/color globally "
          + "(for GOST or special formatting only)",
        ),
        fontFamily: z.string().default("Times New Roman")
          .describe("Font family (only when applyFont)"),
        fontSize: z.number().default(14)
          .describe("Font size pt (only when applyFont)"),
        firstHeadingAsTitle: z.boolean().default(false)
          .describe("Set doc title from first heading"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
      _meta: authMeta(["create_files"]),
    },
    handleTool(async ({
      title, markdown, folderId, applyFont,
      fontFamily, fontSize, firstHeadingAsTitle,
    }) => {
      if (!canDo("create_files")) {
        return textResult(
          saRestrictionNote(["create_files"]),
        );
      }

      const { id, url } = await uploadMarkdownAsDoc(
        markdown, title, folderId,
      );

      const ops = await afterNativeCreate(id, markdown, {
        applyFont, fontFamily, fontSize, firstHeadingAsTitle,
      });

      return textResult(
        `Created from markdown (native): ${url}`
        + (ops > 0 ? ` (+ ${ops} font ops)` : ""),
      );
    }),
  );

  server.registerTool(
    "drive_create_from_markdown_file",
    {
      title: "Create Doc from Markdown File (native)",
      description:
        "Create a new Google Doc from a local Markdown file using native conversion.",
      inputSchema: {
        title: z.string().describe("Document title"),
        filePath: z.string().describe(
          "Absolute path to .md file on disk",
        ),
        folderId: z.string().optional()
          .describe("Parent folder ID"),
        applyFont: z.boolean().default(false).describe(
          "Override font/size/color globally "
          + "(for GOST or special formatting only)",
        ),
        fontFamily: z.string().default("Times New Roman")
          .describe("Font family (only when applyFont)"),
        fontSize: z.number().default(14)
          .describe("Font size pt (only when applyFont)"),
        firstHeadingAsTitle: z.boolean().default(false)
          .describe("Set doc title from first heading"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
      _meta: authMeta(["create_files"]),
    },
    handleTool(async ({
      title, filePath, folderId, applyFont,
      fontFamily, fontSize, firstHeadingAsTitle,
    }) => {
      if (!canDo("create_files")) {
        return textResult(
          saRestrictionNote(["create_files"]),
        );
      }

      const markdown = await readFile(filePath, "utf-8");

      const { id, url } = await uploadMarkdownAsDoc(
        markdown, title, folderId,
      );

      const ops = await afterNativeCreate(id, markdown, {
        applyFont, fontFamily, fontSize, firstHeadingAsTitle,
      });

      return textResult(
        `Created from file (native): ${url} `
        + `(${markdown.length} chars)`
        + (ops > 0 ? ` (+ ${ops} font ops)` : ""),
      );
    }),
  );

  server.registerTool(
    "docs_replace_with_markdown_native",
    {
      title: "Replace With Markdown (native)",
      description:
        "Replace the document body with Markdown content using native "
        + "conversion.",
      inputSchema: {
        documentId: documentIdParam,
        markdown: z.string().describe("Markdown source"),
        applyFont: z.boolean().default(false).describe(
          "Override font/size/color globally "
          + "(for GOST or special formatting only)",
        ),
        fontFamily: z.string().default("Times New Roman")
          .describe("Font family (only when applyFont)"),
        fontSize: z.number().default(14)
          .describe("Font size pt (only when applyFont)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({
      documentId, markdown, applyFont,
      fontFamily, fontSize,
    }) => {
      await replaceDocWithMarkdown(documentId, markdown);

      let ops = 0;
      if (applyFont) {
        ops = await applyGlobalFont(
          documentId, undefined, fontFamily, fontSize,
        );
      }

      return textResult(
        `Replaced with markdown (native, `
        + `${markdown.length} chars)`
        + (ops > 0 ? ` (+ ${ops} font ops)` : ""),
      );
    }),
  );

  server.registerTool(
    "docs_replace_with_markdown_file_native",
    {
      title: "Replace With Markdown File (native)",
      description:
        "Replace the document body with a local Markdown file using native "
        + "conversion.",
      inputSchema: {
        documentId: documentIdParam,
        filePath: z.string().describe(
          "Absolute path to .md file on disk",
        ),
        applyFont: z.boolean().default(false).describe(
          "Override font/size/color globally "
          + "(for GOST or special formatting only)",
        ),
        fontFamily: z.string().default("Times New Roman")
          .describe("Font family (only when applyFont)"),
        fontSize: z.number().default(14)
          .describe("Font size pt (only when applyFont)"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: true,
      },
    },
    handleTool(async ({
      documentId, filePath, applyFont,
      fontFamily, fontSize,
    }) => {
      const markdown = await readFile(filePath, "utf-8");

      await replaceDocWithMarkdown(documentId, markdown);

      let ops = 0;
      if (applyFont) {
        ops = await applyGlobalFont(
          documentId, undefined, fontFamily, fontSize,
        );
      }

      return textResult(
        `Replaced from file (native, `
        + `${markdown.length} chars)`
        + (ops > 0 ? ` (+ ${ops} font ops)` : ""),
      );
    }),
  );
}

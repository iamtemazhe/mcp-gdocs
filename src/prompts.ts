import type { McpServer } from
  "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

/* ── Shared cleanup batch description ─────────────────────────── */

const PRETTY_CLEANUP = `
After native markdown import, clean up residual artifacts
with one or two docs_batch_update calls.

Read the document JSON (docs_read_document format:"json")
and build ONE batch with these operations:

1. DELETE horizontal rules — find paragraphs containing
   a horizontalRule element. Delete the paragraph range
   (startIndex to endIndex). Process in REVERSE order
   (highest index first) so deletions don't shift indices.

2. MINIMIZE empty paragraphs before tables — for each
   empty paragraph immediately before a table element,
   set fontSize:1, lineSpacing:100, spaceAbove:0,
   spaceBelow:0, indentFirstLine:0, indentStart:0.

3. MINIMIZE empty paragraphs before lists — for each
   empty paragraph immediately before a bullet paragraph,
   same as step 2.

4. MINIMIZE empty paragraphs after tables — for each
   empty paragraph immediately after a table element,
   same as step 2.

Critical: deletions (step 1) must go in a SEPARATE
batch BEFORE the minimize operations (steps 2-4),
because deletions shift all subsequent indices.
So: first batch = deleteContentRange (reverse order),
then re-read JSON, then second batch = minimize.

Alternatively, if there are no horizontal rules,
skip the delete step and do everything in one batch.
`.trim();

/* ── Prompts ──────────────────────────────────────────────────── */

export function registerPrompts(
  server: McpServer,
): void {
  server.registerPrompt(
    "pretty-format",
    {
      title: "Pretty Format",
      description:
        "Create or reformat a Google Doc from markdown "
        + "with clean formatting: removes horizontal "
        + "rules (---), minimizes empty lines before "
        + "tables/lists and after tables",
      argsSchema: {
        documentId: z.string().optional().describe(
          "Existing document ID to reformat "
          + "(omit to create new)",
        ),
        filePath: z.string().optional().describe(
          "Path to .md file (for new document)",
        ),
        markdown: z.string().optional().describe(
          "Inline markdown (if no filePath)",
        ),
        title: z.string().optional().describe(
          "Document title (for new document)",
        ),
        folderId: z.string().optional().describe(
          "Parent folder ID (for new document)",
        ),
      },
    },
    async ({ documentId, filePath, markdown,
      title, folderId }) => {
      const isNew = !documentId;
      const createStep = filePath
        ? `drive_create_from_markdown_file(`
          + `title: "${title ?? "Document"}", `
          + `filePath: "${filePath}"`
          + (folderId ? `, folderId: "${folderId}"` : "")
          + ")"
        : markdown
          ? `drive_create_from_markdown(`
            + `title: "${title ?? "Document"}", `
            + `markdown: <provided>)`
          : "drive_create_from_markdown(title, markdown)";

      const replaceStep = filePath
        ? `docs_replace_with_markdown_file_native(`
          + `documentId: "${documentId}", `
          + `filePath: "${filePath}")`
        : `docs_replace_with_markdown_native(`
          + `documentId: "${documentId}", `
          + `markdown: <provided>)`;

      const step1 = isNew
        ? `1. Create document:\n   ${createStep}`
        : `1. Replace content:\n   ${replaceStep}`;

      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "Pretty-format a Google Doc from markdown."
              + "\n\n"
              + step1 + "\n\n"
              + "2. Read structure:\n"
              + "   docs_read_document(documentId, "
              + "format: \"json\")\n\n"
              + "3. Clean up artifacts:\n"
              + PRETTY_CLEANUP,
          },
        }],
      };
    },
  );

  server.registerPrompt(
    "gost-format",
    {
      title: "GOST Format (ГОСТ 19.106-78)",
      description:
        "Create a Google Doc formatted per GOST 19.106-78: "
        + "Times New Roman 14pt, justified, 1.5 spacing, "
        + "page breaks between sections, heading hierarchy",
      argsSchema: {
        documentId: z.string().optional().describe(
          "Existing document ID to reformat "
          + "(omit to create new)",
        ),
        filePath: z.string().optional().describe(
          "Path to .md file (for new document)",
        ),
        markdown: z.string().optional().describe(
          "Inline markdown (if no filePath)",
        ),
        title: z.string().optional().describe(
          "Document title (for new document)",
        ),
        folderId: z.string().optional().describe(
          "Parent folder ID (for new document)",
        ),
      },
    },
    async ({ documentId, filePath, markdown,
      title, folderId }) => {
      const isNew = !documentId;
      const createStep = filePath
        ? `drive_create_from_markdown_file(`
          + `title: "${title ?? "Document"}", `
          + `filePath: "${filePath}", `
          + `applyFont: true`
          + (folderId ? `, folderId: "${folderId}"` : "")
          + ")"
        : markdown
          ? `drive_create_from_markdown(`
            + `title: "${title ?? "Document"}", `
            + `markdown: <provided>, applyFont: true)`
          : "drive_create_from_markdown(title, markdown, "
            + "applyFont: true)";

      const replaceStep = filePath
        ? `docs_replace_with_markdown_file_native(`
          + `documentId: "${documentId}", `
          + `filePath: "${filePath}", applyFont: true)`
        : `docs_replace_with_markdown_native(`
          + `documentId: "${documentId}", `
          + `markdown: <provided>, applyFont: true)`;

      const step1 = isNew
        ? `1. Create document with font override:\n`
          + `   ${createStep}\n`
          + "   (applyFont sets Times New Roman 14pt black)"
        : `1. Replace content with font override:\n`
          + `   ${replaceStep}\n`
          + "   (applyFont sets Times New Roman 14pt black)";

      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "Format a Google Doc per ГОСТ 19.106-78."
              + "\n\n"
              + step1 + "\n\n"
              + "2. Read structure:\n"
              + "   docs_read_document(documentId, "
              + "format: \"json\")\n\n"
              + "3. Clean up artifacts (same as pretty):\n"
              + PRETTY_CLEANUP
              + "\n\n"
              + "4. Apply ГОСТ styles in ONE "
              + "docs_batch_update:\n\n"
              + "From the JSON, collect:\n"
              + "- headings[]: {start, end, level} "
              + "for each HEADING_*\n"
              + "- tables[]: {start, end}\n"
              + "- lastEnd: document end index\n\n"
              + "Build batch:\n"
              + "a) Global paragraph: lineSpacing:150, "
              + "alignment:JUSTIFIED, indentFirstLine:35\n"
              + "b) H1: alignment:CENTER, "
              + "indentFirstLine:0, spaceBefore:0, "
              + "spaceAfter:0 + bold, fontSize:18\n"
              + "c) H2: alignment:CENTER, "
              + "indentFirstLine:0, spaceBefore:0, "
              + "spaceAfter:0, pageBreakBefore:true "
              + "(EXCEPT first H2) + bold, fontSize:16\n"
              + "d) H3/H4: alignment:JUSTIFIED, "
              + "indentFirstLine:35, spaceBefore:12, "
              + "spaceAfter:0 + bold (fontSize stays 14)\n"
              + "e) Tables: fontSize:12, lineSpacing:100, "
              + "indentFirstLine:0, indentStart:0, "
              + "spaceBefore:0, spaceAfter:0\n\n"
              + "Critical rules:\n"
              + "- Do NOT set bold in global "
              + "updateTextStyle — it resets inline bold\n"
              + "- bold: true ONLY on headings\n"
              + "- pageBreakBefore NOT on first H2",
          },
        }],
      };
    },
  );

  server.registerPrompt(
    "template-fill",
    {
      title: "Template Fill",
      description:
        "Fill a document template by replacing {{placeholders}} "
        + "with provided values using replaceAllText batch.",
      argsSchema: {
        documentId: z.string().describe("Template document ID"),
        replacements: z.string().describe(
          "JSON object with placeholder→value pairs, e.g. "
          + '{"{{name}}": "John", "{{date}}": "2026-03-22"}',
        ),
      },
    },
    async ({ documentId, replacements }) => ({
      messages: [{
        role: "user" as const,
        content: {
          type: "text" as const,
          text: "Fill a document template using named ranges.\n\n"
            + "1. Read the document structure:\n"
            + `   docs_read_document(documentId: "${documentId}", `
            + 'format: "text")\n\n'
            + "2. For each placeholder in the replacements JSON:\n"
            + `   ${replacements}\n\n`
            + "   Find the placeholder text in the document using "
            + 'docs_read_document(format: "json")\n'
            + "   to get exact startIndex and endIndex of each "
            + "occurrence.\n\n"
            + "3. Use docs_batch_update with replaceAllText requests:\n"
            + "   For each placeholder→value pair, add a "
            + "replaceAllText request\n"
            + "   with searchText=placeholder, replaceText=value, "
            + "matchCase=true.\n\n"
            + "   This is the most reliable approach — no need to "
            + "create named ranges\n"
            + "   for simple text replacement.\n\n"
            + "4. Verify: "
            + `docs_read_document(documentId: "${documentId}", `
            + 'format: "text") to confirm replacements.',
        },
      }],
    }),
  );

  server.registerPrompt(
    "export-to-markdown",
    {
      title: "Export to Markdown",
      description:
        "Export a Google Doc to Markdown format using Drive API "
        + "native export.",
      argsSchema: {
        documentId: z.string().describe("Document ID to export"),
        savePath: z.string().optional().describe(
          "Local file path to save .md file (omit to return content)",
        ),
      },
    },
    async ({ documentId, savePath }) => {
      const exportCall = savePath
        ? `drive_export_file(fileId: "${documentId}", `
          + 'mimeType: "text/markdown", '
          + `savePath: "${savePath}")`
        : `drive_export_file(fileId: "${documentId}", `
          + 'mimeType: "text/markdown")';
      const step2 = savePath
        ? `File saved to ${savePath}. Verify content.`
        : "Review the exported markdown content for accuracy.";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "Export a Google Doc to Markdown.\n\n"
              + "1. Export using Drive API:\n"
              + `   ${exportCall}\n\n`
              + `2. ${step2}\n\n`
              + "Note: Google's native markdown export preserves "
              + "headings, bold, italic,\n"
              + "lists, and tables. Some formatting (colors, fonts) "
              + "may be lost.",
          },
        }],
      };
    },
  );

  server.registerPrompt(
    "format-table",
    {
      title: "Format Table",
      description:
        "Format a table in a Google Doc: set column widths, "
        + "pin headers, style cells.",
      argsSchema: {
        documentId: z.string().describe("Document ID"),
        tableIndex: z.number().optional().describe(
          "Table index (0-based, default 0 = first table)",
        ),
      },
    },
    async ({ documentId, tableIndex }) => {
      const idx = tableIndex ?? 0;
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "Format a table in a Google Doc.\n\n"
              + "1. Read document structure:\n"
              + `   docs_read_document(documentId: "${documentId}", `
              + 'format: "json")\n\n'
              + "2. Find the table element (table index: "
              + `${idx}).\n`
              + "   Note the tableStartIndex from the JSON.\n\n"
              + "3. Analyze the table: count columns, check content "
              + "width needs.\n\n"
              + "4. Apply formatting with docs_batch_update:\n"
              + "   - Pin header row: pinTableHeaderRows("
              + "tableStartIndex, pinnedHeaderRowsCount: 1)\n"
              + "   - Set column widths: updateTableColumnProperties "
              + "for each column\n"
              + "   - Style header cells: updateTableCellStyle with "
              + "backgroundColor\n"
              + "   - Bold header text: updateTextStyle on header row "
              + "range\n\n"
              + "5. Verify: docs_read_document(documentId, "
              + 'format: "text")',
          },
        }],
      };
    },
  );

  server.registerPrompt(
    "share-document",
    {
      title: "Share Document",
      description:
        "Share a Google Doc with users, checking current "
        + "permissions first.",
      argsSchema: {
        fileId: z.string().describe("Document or file ID"),
        email: z.string().describe("Email address to share with"),
        role: z.enum(["reader", "writer", "commenter"])
          .default("reader")
          .describe("Access level"),
      },
    },
    async ({ fileId, email, role }) => {
      const accessRole = role ?? "reader";
      return {
        messages: [{
          role: "user" as const,
          content: {
            type: "text" as const,
            text: "Share a document with a user.\n\n"
              + "1. Check current permissions:\n"
              + `   drive_list_permissions(fileId: "${fileId}")\n\n`
              + "2. Review existing access. If "
              + `${email} already has access,\n`
              + "   consider updating their role instead of creating a "
              + "duplicate.\n\n"
              + "3. Share the document:\n"
              + `   drive_share_file(fileId: "${fileId}", `
              + `role: "${accessRole}", type: "user", `
              + `emailAddress: "${email}")\n\n`
              + "4. Confirm: "
              + `drive_list_permissions(fileId: "${fileId}")`,
          },
        }],
      };
    },
  );

}

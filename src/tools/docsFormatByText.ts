import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { docs_v1 } from "googleapis";
import { getDocsService } from "../auth.js";
import { textResult, handleTool } from "../utils/errors.js";
import {
  sendBatchedRequests,
  tabIdParam,
  injectTabId,
} from "../utils/batch.js";
import {
  buildTextStyle,
  type TextStyleItem,
} from "../utils/styleBuilders.js";
import { getBodyContent } from "../utils/tabs.js";

/** Match range in document body (exported for unit tests). */
export interface TextMatch {
  readonly startIndex: number;
  readonly endIndex: number;
}

/** Finds literal text in structural content (exported for unit tests). */
export function findTextInContent(
  content: docs_v1.Schema$StructuralElement[],
  searchText: string,
  matchCase: boolean,
): TextMatch[] {
  const matches: TextMatch[] = [];
  const needle = matchCase
    ? searchText
    : searchText.toLowerCase();

  for (const el of content) {
    if (el.paragraph?.elements) {
      findInParagraph(
        el.paragraph.elements, needle,
        matchCase, matches,
      );
    }
    if (el.table) {
      for (const row of el.table.tableRows ?? []) {
        for (const cell of row.tableCells ?? []) {
          for (const cellEl of cell.content ?? []) {
            if (cellEl.paragraph?.elements) {
              findInParagraph(
                cellEl.paragraph.elements, needle,
                matchCase, matches,
              );
            }
          }
        }
      }
    }
  }

  return matches;
}

function findInParagraph(
  elements: docs_v1.Schema$ParagraphElement[],
  needle: string,
  matchCase: boolean,
  matches: TextMatch[],
): void {
  for (const el of elements) {
    const run = el.textRun;
    if (!run?.content || run.content === "\n") continue;

    const text = matchCase
      ? run.content
      : run.content.toLowerCase();
    const base = el.startIndex ?? 0;
    let pos = 0;

    while (pos < text.length) {
      const idx = text.indexOf(needle, pos);
      if (idx === -1) break;
      matches.push({
        startIndex: base + idx,
        endIndex: base + idx + needle.length,
      });
      pos = idx + 1;
    }
  }
}

const formatByTextItemSchema = z.object({
  searchText: z.string().min(1).describe(
    "Text to find in the document",
  ),
  matchCase: z.boolean().default(true).describe(
    "Whether to match case",
  ),
  bold: z.boolean().optional().describe(
    "Omit to leave unchanged",
  ),
  italic: z.boolean().optional().describe(
    "Omit to leave unchanged",
  ),
  underline: z.boolean().optional().describe(
    "Omit to leave unchanged",
  ),
  strikethrough: z.boolean().optional().describe(
    "Omit to leave unchanged",
  ),
  fontSize: z.number().optional().describe(
    "Font size in pt",
  ),
  fontFamily: z.string().optional().describe(
    "Font family name",
  ),
  foregroundColor: z.string().optional().describe(
    "Text color in hex (#RRGGBB)",
  ),
  backgroundColor: z.string().optional().describe(
    "Text background color in hex (#RRGGBB)",
  ),
});

export function registerDocsFormatByTextTools(
  server: McpServer,
): void {
  server.registerTool(
    "docs_format_by_text",
    {
      title: "Format By Text",
      description:
        "Find literal text and apply character styles to every match "
        + "without indices. For precise ranges use docs_read_document "
        + "(json) + docs_apply_text_style.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        items: z.array(formatByTextItemSchema).min(1)
          .describe(
            "Array of text patterns with styles",
          ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ documentId, tabId, items }) => {
      const docs = await getDocsService();
      const doc = await docs.documents.get({
        documentId,
        ...(tabId ? { includeTabsContent: true } : {}),
      });

      const content = getBodyContent(doc.data, tabId);
      const requests: docs_v1.Schema$Request[] = [];
      let totalMatches = 0;
      const notFound: string[] = [];

      for (const item of items) {
        const matches = findTextInContent(
          content, item.searchText, item.matchCase,
        );
        totalMatches += matches.length;

        if (matches.length === 0) {
          notFound.push(item.searchText);
          continue;
        }

        const styleItem: TextStyleItem = {
          startIndex: 0,
          endIndex: 0,
          bold: item.bold,
          italic: item.italic,
          underline: item.underline,
          strikethrough: item.strikethrough,
          fontSize: item.fontSize,
          fontFamily: item.fontFamily,
          foregroundColor: item.foregroundColor,
          backgroundColor: item.backgroundColor,
        };

        const { style, fields } =
          buildTextStyle(styleItem);

        if (fields.length === 0) continue;

        for (const match of matches) {
          requests.push({
            updateTextStyle: {
              range: {
                startIndex: match.startIndex,
                endIndex: match.endIndex,
              },
              textStyle: style,
              fields: fields.join(","),
            },
          });
        }
      }

      if (requests.length > 0) {
        await sendBatchedRequests(
          documentId,
          injectTabId(requests, tabId),
        );
      }

      let msg = `Formatted ${totalMatches} matches`
        + ` across ${items.length} patterns`;
      if (notFound.length > 0) {
        msg += `. Not found: ${notFound.join(", ")}`;
      }
      return textResult(msg);
    }),
  );
}

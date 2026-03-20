import { z } from "zod";
import type { docs_v1 } from "googleapis";
import { hexToRgb } from "./colors.js";

// ── Image ──────────────────────────────────────────────────────────

export const imageItemSchema = z.object({
  imageUrl: z.string().url().describe(
    "Publicly accessible image URL",
  ),
  index: z.number().int().min(1).describe(
    "Insertion index (character position)",
  ),
  width: z.number().optional().describe(
    "Width in pt (optional)",
  ),
  height: z.number().optional().describe(
    "Height in pt (optional)",
  ),
});

export type ImageItem = z.infer<typeof imageItemSchema>;

export function buildImageRequest(
  item: ImageItem,
): docs_v1.Schema$Request {
  const insertReq:
    docs_v1.Schema$InsertInlineImageRequest = {
      uri: item.imageUrl,
      location: { index: item.index },
    };
  if (item.width || item.height) {
    const size: docs_v1.Schema$Size = {};
    if (item.width) {
      size.width = { magnitude: item.width, unit: "PT" };
    }
    if (item.height) {
      size.height = {
        magnitude: item.height,
        unit: "PT",
      };
    }
    insertReq.objectSize = size;
  }
  return { insertInlineImage: insertReq };
}

// ── Table Cell Style ───────────────────────────────────────────────

export const tableCellStyleItemSchema = z.object({
  rowIndex: z.number().int().min(0).describe("Row index"),
  columnIndex: z.number().int().min(0).describe(
    "Column index",
  ),
  backgroundColor: z.string().optional().describe(
    "Background color in hex (#RRGGBB)",
  ),
});

export type TableCellStyleItem =
  z.infer<typeof tableCellStyleItemSchema>;

export function buildTableCellStyleRequest(
  tableStartIndex: number,
  item: TableCellStyleItem,
): docs_v1.Schema$Request {
  const style: docs_v1.Schema$TableCellStyle = {};
  const fields: string[] = [];

  if (item.backgroundColor) {
    style.backgroundColor = {
      color: {
        rgbColor: hexToRgb(item.backgroundColor),
      },
    };
    fields.push("backgroundColor");
  }

  return {
    updateTableCellStyle: {
      tableRange: {
        tableCellLocation: {
          tableStartLocation: {
            index: tableStartIndex,
          },
          rowIndex: item.rowIndex,
          columnIndex: item.columnIndex,
        },
        rowSpan: 1,
        columnSpan: 1,
      },
      tableCellStyle: style,
      fields: fields.join(","),
    },
  };
}

// ── Text Style ─────────────────────────────────────────────────────

export const textStyleItemSchema = z.object({
  startIndex: z.number().int().min(1),
  endIndex: z.number().int().min(2),
  bold: z.boolean().optional(),
  italic: z.boolean().optional(),
  underline: z.boolean().optional(),
  strikethrough: z.boolean().optional(),
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

export type TextStyleItem =
  z.infer<typeof textStyleItemSchema>;

export const paragraphStyleItemSchema = z.object({
  startIndex: z.number().int().min(1),
  endIndex: z.number().int().min(2),
  alignment: z
    .enum(["START", "CENTER", "END", "JUSTIFIED"])
    .optional()
    .describe("Paragraph alignment"),
  lineSpacing: z.number().optional().describe(
    "Line spacing (100 = single)",
  ),
  spaceBefore: z.number().optional().describe(
    "Space before paragraph in pt",
  ),
  spaceAfter: z.number().optional().describe(
    "Space after paragraph in pt",
  ),
  indentFirstLine: z.number().optional().describe(
    "First line indent in pt",
  ),
  indentStart: z.number().optional().describe(
    "Left indent in pt",
  ),
  pageBreakBefore: z.boolean().optional().describe(
    "Insert page break before paragraph",
  ),
});

export type ParagraphStyleItem =
  z.infer<typeof paragraphStyleItemSchema>;

export const headingStyleItemSchema = z.object({
  startIndex: z.number().int().min(1),
  endIndex: z.number().int().min(2),
  headingStyle: z
    .enum([
      "NORMAL_TEXT",
      "HEADING_1",
      "HEADING_2",
      "HEADING_3",
      "HEADING_4",
      "HEADING_5",
      "HEADING_6",
    ])
    .describe("Heading / named paragraph style"),
});

export type HeadingStyleItem =
  z.infer<typeof headingStyleItemSchema>;

export function buildTextStyle(
  item: TextStyleItem,
): { style: docs_v1.Schema$TextStyle; fields: string[] } {
  const style: docs_v1.Schema$TextStyle = {};
  const fields: string[] = [];

  if (item.bold !== undefined) {
    style.bold = item.bold;
    fields.push("bold");
  }
  if (item.italic !== undefined) {
    style.italic = item.italic;
    fields.push("italic");
  }
  if (item.underline !== undefined) {
    style.underline = item.underline;
    fields.push("underline");
  }
  if (item.strikethrough !== undefined) {
    style.strikethrough = item.strikethrough;
    fields.push("strikethrough");
  }
  if (item.fontSize !== undefined) {
    style.fontSize = {
      magnitude: item.fontSize,
      unit: "PT",
    };
    fields.push("fontSize");
  }
  if (item.fontFamily !== undefined) {
    style.weightedFontFamily = {
      fontFamily: item.fontFamily,
      weight: 400,
    };
    fields.push("weightedFontFamily");
  }
  if (item.foregroundColor) {
    style.foregroundColor = {
      color: { rgbColor: hexToRgb(item.foregroundColor) },
    };
    fields.push("foregroundColor");
  }
  if (item.backgroundColor) {
    style.backgroundColor = {
      color: { rgbColor: hexToRgb(item.backgroundColor) },
    };
    fields.push("backgroundColor");
  }

  return { style, fields };
}

export function buildTextStyleRequest(
  item: TextStyleItem,
): docs_v1.Schema$Request {
  const { style, fields } = buildTextStyle(item);
  return {
    updateTextStyle: {
      range: {
        startIndex: item.startIndex,
        endIndex: item.endIndex,
      },
      textStyle: style,
      fields: fields.join(","),
    },
  };
}

export function buildParagraphStyle(
  item: ParagraphStyleItem,
): {
  style: docs_v1.Schema$ParagraphStyle;
  fields: string[];
} {
  const style: docs_v1.Schema$ParagraphStyle = {};
  const fields: string[] = [];

  if (item.alignment) {
    style.alignment = item.alignment;
    fields.push("alignment");
  }
  if (item.lineSpacing !== undefined) {
    style.lineSpacing = item.lineSpacing;
    fields.push("lineSpacing");
  }
  if (item.spaceBefore !== undefined) {
    style.spaceAbove = {
      magnitude: item.spaceBefore,
      unit: "PT",
    };
    fields.push("spaceAbove");
  }
  if (item.spaceAfter !== undefined) {
    style.spaceBelow = {
      magnitude: item.spaceAfter,
      unit: "PT",
    };
    fields.push("spaceBelow");
  }
  if (item.indentFirstLine !== undefined) {
    style.indentFirstLine = {
      magnitude: item.indentFirstLine,
      unit: "PT",
    };
    fields.push("indentFirstLine");
  }
  if (item.indentStart !== undefined) {
    style.indentStart = {
      magnitude: item.indentStart,
      unit: "PT",
    };
    fields.push("indentStart");
  }
  if (item.pageBreakBefore !== undefined) {
    style.pageBreakBefore = item.pageBreakBefore;
    fields.push("pageBreakBefore");
  }

  return { style, fields };
}

/**
 * Google Docs API применяет paragraph style ко всем
 * параграфам, пересекающимся с range. startIndex
 * структурного элемента совпадает с \n предыдущего
 * параграфа, поэтому сдвигаем на +1, чтобы не
 * захватить соседний абзац.
 */
function safeStart(index: number): number {
  return index > 1 ? index + 1 : index;
}

export function buildParagraphStyleRequest(
  item: ParagraphStyleItem,
): docs_v1.Schema$Request {
  const { style, fields } = buildParagraphStyle(item);
  return {
    updateParagraphStyle: {
      range: {
        startIndex: safeStart(item.startIndex),
        endIndex: item.endIndex,
      },
      paragraphStyle: style,
      fields: fields.join(","),
    },
  };
}

export function buildHeadingStyleRequest(
  item: HeadingStyleItem,
): docs_v1.Schema$Request {
  return {
    updateParagraphStyle: {
      range: {
        startIndex: safeStart(item.startIndex),
        endIndex: item.endIndex,
      },
      paragraphStyle: {
        namedStyleType: item.headingStyle,
      },
      fields: "namedStyleType",
    },
  };
}

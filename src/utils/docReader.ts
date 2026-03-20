import type { docs_v1 } from "googleapis";

type StructuralElement = docs_v1.Schema$StructuralElement;
type ParagraphElement = docs_v1.Schema$ParagraphElement;
type TableCell = docs_v1.Schema$TableCell;

function extractTextFromElements(
  elements: ParagraphElement[],
): string {
  let text = "";
  for (const el of elements) {
    if (el.textRun?.content) {
      text += el.textRun.content;
    } else if (el.inlineObjectElement) {
      text += "[image]";
    }
  }
  return text;
}

function extractTextFromStructural(
  elements: StructuralElement[],
): string {
  let text = "";
  for (const el of elements) {
    if (el.paragraph?.elements) {
      text += extractTextFromElements(el.paragraph.elements);
    } else if (el.table) {
      text += extractTableAsText(el.table);
    } else if (el.sectionBreak) {
      text += "\n";
    }
  }
  return text;
}

function extractTableAsText(
  table: docs_v1.Schema$Table,
): string {
  let result = "";
  for (const row of table.tableRows ?? []) {
    const cells: string[] = [];
    for (const cell of row.tableCells ?? []) {
      cells.push(extractCellText(cell).trim());
    }
    result += cells.join("\t") + "\n";
  }
  return result + "\n";
}

function extractCellText(cell: TableCell): string {
  let text = "";
  for (const el of cell.content ?? []) {
    if (el.paragraph?.elements) {
      text += extractTextFromElements(el.paragraph.elements);
    }
  }
  return text;
}

export function docToPlainText(
  doc: docs_v1.Schema$Document,
): string {
  const body = doc.body;
  if (!body?.content) {
    return "";
  }
  return extractTextFromStructural(body.content);
}

function getHeadingLevel(
  style: docs_v1.Schema$ParagraphStyle | undefined,
): number {
  if (!style?.namedStyleType) {
    return 0;
  }
  const match = style.namedStyleType.match(/^HEADING_(\d)$/);
  return match ? parseInt(match[1], 10) : 0;
}

function isBold(
  style: docs_v1.Schema$TextStyle | undefined,
): boolean {
  return style?.bold === true;
}

function isItalic(
  style: docs_v1.Schema$TextStyle | undefined,
): boolean {
  return style?.italic === true;
}

function isCode(
  style: docs_v1.Schema$TextStyle | undefined,
): boolean {
  const fontFamily = style?.weightedFontFamily?.fontFamily ?? "";
  return /mono|courier|consolas/i.test(fontFamily);
}

function formatTextRun(
  el: ParagraphElement,
): string {
  const content = el.textRun?.content ?? "";
  if (!content.trim()) {
    return content;
  }
  const style = el.textRun?.textStyle;
  let text = content;

  if (isCode(style)) {
    text = "`" + text + "`";
  } else {
    if (isBold(style) && isItalic(style)) {
      text = "***" + text + "***";
    } else if (isBold(style)) {
      text = "**" + text + "**";
    } else if (isItalic(style)) {
      text = "*" + text + "*";
    }
  }

  if (style?.link?.url) {
    text = `[${text}](${style.link.url})`;
  }

  return text;
}

function paragraphToMarkdown(
  paragraph: docs_v1.Schema$Paragraph,
): string {
  const headingLevel = getHeadingLevel(paragraph.paragraphStyle);
  const bullet = paragraph.bullet;

  let text = "";
  for (const el of paragraph.elements ?? []) {
    if (el.textRun) {
      text += formatTextRun(el);
    } else if (el.inlineObjectElement) {
      text += "![image]()";
    }
  }

  text = text.replace(/\n$/, "");

  if (headingLevel > 0) {
    return "#".repeat(headingLevel) + " " + text;
  }

  if (bullet) {
    const nestingLevel = bullet.nestingLevel ?? 0;
    const indent = "  ".repeat(nestingLevel);
    const listId = bullet.listId ?? "";
    const isOrdered = listId.startsWith("kix.");
    const marker = isOrdered ? "1." : "-";
    return `${indent}${marker} ${text}`;
  }

  return text;
}

function tableToMarkdown(
  table: docs_v1.Schema$Table,
): string {
  const rows = table.tableRows ?? [];
  if (rows.length === 0) {
    return "";
  }

  const mdRows: string[][] = [];
  for (const row of rows) {
    const cells: string[] = [];
    for (const cell of row.tableCells ?? []) {
      cells.push(extractCellText(cell).trim());
    }
    mdRows.push(cells);
  }

  const colCount = Math.max(...mdRows.map((r) => r.length));
  const lines: string[] = [];

  for (let i = 0; i < mdRows.length; i++) {
    const row = mdRows[i];
    while (row.length < colCount) {
      row.push("");
    }
    lines.push("| " + row.join(" | ") + " |");
    if (i === 0) {
      lines.push(
        "| " + row.map(() => "---").join(" | ") + " |",
      );
    }
  }

  return lines.join("\n");
}

export function docToMarkdown(
  doc: docs_v1.Schema$Document,
): string {
  const body = doc.body;
  if (!body?.content) {
    return "";
  }

  const parts: string[] = [];

  for (const el of body.content) {
    if (el.paragraph) {
      parts.push(paragraphToMarkdown(el.paragraph));
    } else if (el.table) {
      parts.push(tableToMarkdown(el.table));
    } else if (el.sectionBreak) {
      parts.push("---");
    }
  }

  return parts.join("\n");
}

import type { docs_v1 } from "googleapis";

type StructuralElement = docs_v1.Schema$StructuralElement;
type ParagraphElement = docs_v1.Schema$ParagraphElement;

const PREVIEW_MAX = 50;

function truncatePreview(raw: string): string {
  const t = raw.replace(/\s+/g, " ").trim();
  if (t.length <= PREVIEW_MAX) {
    return t;
  }
  return `${t.slice(0, PREVIEW_MAX)}…`;
}

function extractParagraphPlainText(
  elements: ParagraphElement[] | undefined,
): string {
  if (!elements) {
    return "";
  }
  let text = "";
  for (const el of elements) {
    if (el.textRun?.content) {
      text += el.textRun.content;
    }
  }
  return text;
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

export interface DocumentSummary {
  documentId?: string | null;
  title?: string | null;
  headings: Array<{
    level: number;
    text: string;
    startIndex?: number | null;
    endIndex?: number | null;
  }>;
  tables: Array<{
    startIndex?: number | null;
    endIndex?: number | null;
    rows: number;
    columns: number;
  }>;
  lists: Array<{
    startIndex?: number | null;
    endIndex?: number | null;
    listId?: string | null;
    type: "ordered" | "bullet";
  }>;
  images: Array<{
    startIndex?: number | null;
    objectId: string;
  }>;
  sectionBreaks: Array<{
    startIndex?: number | null;
    endIndex?: number | null;
  }>;
}

function listTypeFromListId(
  listId: string | undefined | null,
): "ordered" | "bullet" {
  if (listId?.startsWith("kix.")) {
    return "ordered";
  }
  return "bullet";
}

function walkStructural(
  elements: StructuralElement[] | undefined,
  out: Omit<DocumentSummary, "documentId" | "title">,
): void {
  if (!elements) {
    return;
  }

  for (const el of elements) {
    if (el.sectionBreak) {
      out.sectionBreaks.push({
        startIndex: el.startIndex,
        endIndex: el.endIndex,
      });
      continue;
    }

    if (el.table) {
      const rows = el.table.tableRows ?? [];
      let columns = 0;
      for (const row of rows) {
        const n = row.tableCells?.length ?? 0;
        if (n > columns) {
          columns = n;
        }
      }
      out.tables.push({
        startIndex: el.startIndex,
        endIndex: el.endIndex,
        rows: rows.length,
        columns,
      });
      continue;
    }

    if (el.paragraph) {
      const p = el.paragraph;
      for (const pe of p.elements ?? []) {
        const oid = pe.inlineObjectElement?.inlineObjectId;
        if (oid) {
          out.images.push({
            startIndex: pe.startIndex,
            objectId: oid,
          });
        }
      }

      const level = getHeadingLevel(p.paragraphStyle);
      if (level >= 1 && level <= 6) {
        const full = extractParagraphPlainText(p.elements);
        out.headings.push({
          level,
          text: truncatePreview(full),
          startIndex: el.startIndex,
          endIndex: el.endIndex,
        });
        continue;
      }

      if (p.bullet) {
        out.lists.push({
          startIndex: el.startIndex,
          endIndex: el.endIndex,
          listId: p.bullet.listId ?? undefined,
          type: listTypeFromListId(p.bullet.listId),
        });
      }
    }
  }
}

export function documentToSummary(
  doc: docs_v1.Schema$Document,
): DocumentSummary {
  const acc: Omit<DocumentSummary, "documentId" | "title"> = {
    headings: [],
    tables: [],
    lists: [],
    images: [],
    sectionBreaks: [],
  };
  walkStructural(doc.body?.content, acc);
  return {
    documentId: doc.documentId,
    title: doc.title,
    ...acc,
  };
}

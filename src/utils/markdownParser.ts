import { marked, type Token, type TokensList, type Tokens } from "marked";
import type { docs_v1 } from "googleapis";
import { MD_COLORS } from "./colors.js";

type DocsRequest = docs_v1.Schema$Request;

interface PendingTableFill {
  readonly insertIndex: number;
  readonly numRows: number;
  readonly numCols: number;
  readonly cells: readonly (readonly string[])[];
}

interface InsertState {
  index: number;
  requests: DocsRequest[];
  pendingTableFills: PendingTableFill[];
}

function insertTextReq(
  state: InsertState,
  text: string,
): void {
  if (!text) return;
  state.requests.push({
    insertText: {
      location: { index: state.index },
      text,
    },
  });
  state.index += text.length;
}

function applyStyle(
  state: InsertState,
  startIndex: number,
  endIndex: number,
  style: Readonly<docs_v1.Schema$TextStyle>,
  fields: string,
): void {
  if (startIndex >= endIndex) return;
  state.requests.push({
    updateTextStyle: {
      range: { startIndex, endIndex },
      textStyle: style,
      fields,
    },
  });
}

function applyParagraphStyle(
  state: InsertState,
  startIndex: number,
  endIndex: number,
  namedStyleType: string,
): void {
  state.requests.push({
    updateParagraphStyle: {
      range: { startIndex, endIndex },
      paragraphStyle: { namedStyleType },
      fields: "namedStyleType",
    },
  });
}

function applyBulletStyle(
  state: InsertState,
  startIndex: number,
  endIndex: number,
  preset: string,
): void {
  state.requests.push({
    createParagraphBullets: {
      range: { startIndex, endIndex },
      bulletPreset: preset,
    },
  });
}

function processInlineTokens(
  state: InsertState,
  tokens: readonly Token[],
): void {
  for (const token of tokens) {
    switch (token.type) {
      case "text": {
        const t = token as Tokens.Text;
        if (t.tokens && t.tokens.length > 0) {
          processInlineTokens(state, t.tokens);
        } else {
          insertTextReq(state, t.raw);
        }
        break;
      }
      case "strong": {
        const t = token as Tokens.Strong;
        const start = state.index;
        if (t.tokens) {
          processInlineTokens(state, t.tokens);
        } else {
          insertTextReq(state, t.text);
        }
        applyStyle(
          state, start, state.index,
          { bold: true }, "bold",
        );
        break;
      }
      case "em": {
        const t = token as Tokens.Em;
        const start = state.index;
        if (t.tokens) {
          processInlineTokens(state, t.tokens);
        } else {
          insertTextReq(state, t.text);
        }
        applyStyle(
          state, start, state.index,
          { italic: true }, "italic",
        );
        break;
      }
      case "codespan": {
        const t = token as Tokens.Codespan;
        const start = state.index;
        insertTextReq(state, t.text);
        applyStyle(
          state, start, state.index,
          {
            weightedFontFamily: {
              fontFamily: "Courier New",
              weight: 400,
            },
            backgroundColor: {
              color: { rgbColor: MD_COLORS.codeBg },
            },
          },
          "weightedFontFamily,backgroundColor",
        );
        break;
      }
      case "link": {
        const t = token as Tokens.Link;
        const start = state.index;
        const linkText = t.text || t.href;
        insertTextReq(state, linkText);
        applyStyle(
          state, start, state.index,
          {
            link: { url: t.href },
            foregroundColor: {
              color: { rgbColor: MD_COLORS.link },
            },
            underline: true,
          },
          "link,foregroundColor,underline",
        );
        break;
      }
      case "del": {
        const t = token as Tokens.Del;
        const start = state.index;
        if (t.tokens) {
          processInlineTokens(state, t.tokens);
        } else {
          insertTextReq(state, t.text);
        }
        applyStyle(
          state, start, state.index,
          { strikethrough: true }, "strikethrough",
        );
        break;
      }
      case "image": {
        const t = token as Tokens.Image;
        if (t.href) {
          state.requests.push({
            insertInlineImage: {
              uri: t.href,
              location: { index: state.index },
            },
          });
          state.index += 1;
        }
        break;
      }
      case "br": {
        insertTextReq(state, "\n");
        break;
      }
      case "escape": {
        const t = token as Tokens.Escape;
        insertTextReq(state, t.text);
        break;
      }
      default: {
        const fallbackToken = token as Record<string, unknown>;
        if (typeof fallbackToken.text === "string") {
          insertTextReq(state, fallbackToken.text as string);
        } else if (typeof fallbackToken.raw === "string") {
          insertTextReq(state, fallbackToken.raw as string);
        }
      }
    }
  }
}

function processTokens(
  state: InsertState,
  tokens: TokensList | readonly Token[],
): void {
  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const t = token as Tokens.Heading;
        const start = state.index;
        if (t.tokens) {
          processInlineTokens(state, t.tokens);
        } else {
          insertTextReq(state, t.text);
        }
        insertTextReq(state, "\n");
        const headingStyle = `HEADING_${t.depth}`;
        applyParagraphStyle(
          state, start, state.index, headingStyle,
        );
        break;
      }
      case "paragraph": {
        const t = token as Tokens.Paragraph;
        if (t.tokens) {
          processInlineTokens(state, t.tokens);
        } else {
          insertTextReq(state, t.text);
        }
        insertTextReq(state, "\n");
        break;
      }
      case "code": {
        const t = token as Tokens.Code;
        const start = state.index;
        insertTextReq(state, t.text + "\n");
        applyStyle(
          state, start, state.index,
          {
            weightedFontFamily: {
              fontFamily: "Courier New",
              weight: 400,
            },
            fontSize: { magnitude: 9, unit: "PT" },
            backgroundColor: {
              color: { rgbColor: MD_COLORS.codeBg },
            },
          },
          "weightedFontFamily,fontSize,backgroundColor",
        );
        break;
      }
      case "list": {
        const t = token as Tokens.List;
        processListItems(state, t.items, t.ordered);
        break;
      }
      case "blockquote": {
        const t = token as Tokens.Blockquote;
        const start = state.index;
        if (t.tokens) {
          processTokens(state, t.tokens);
        } else {
          insertTextReq(state, t.text + "\n");
        }
        applyStyle(
          state, start, state.index,
          {
            italic: true,
            foregroundColor: {
              color: { rgbColor: MD_COLORS.blockquote },
            },
          },
          "italic,foregroundColor",
        );
        break;
      }
      case "hr": {
        const hrStart = state.index;
        insertTextReq(state, "\n");
        state.requests.push({
          updateParagraphStyle: {
            range: {
              startIndex: hrStart,
              endIndex: state.index,
            },
            paragraphStyle: {
              borderBottom: {
                color: {
                  color: {
                    rgbColor: MD_COLORS.hrBorder,
                  },
                },
                width: {
                  magnitude: 1,
                  unit: "PT",
                },
                dashStyle: "SOLID",
                padding: {
                  magnitude: 6,
                  unit: "PT",
                },
              },
              spaceBelow: {
                magnitude: 6,
                unit: "PT",
              },
            },
            fields: "borderBottom,spaceBelow",
          },
        });
        break;
      }
      case "table": {
        const t = token as Tokens.Table;
        processTable(state, t);
        break;
      }
      case "html": {
        const t = token as Tokens.HTML;
        insertTextReq(state, t.text);
        break;
      }
      case "space": {
        break;
      }
      default: {
        const fallbackToken = token as Record<string, unknown>;
        if (typeof fallbackToken.text === "string") {
          insertTextReq(
            state, (fallbackToken.text as string) + "\n",
          );
        }
      }
    }
  }
}

function processListItems(
  state: InsertState,
  items: readonly Tokens.ListItem[],
  ordered: boolean,
): void {
  const start = state.index;
  for (const item of items) {
    if (item.tokens) {
      for (const t of item.tokens) {
        if (t.type === "text") {
          const textToken = t as Tokens.Text;
          if (textToken.tokens) {
            processInlineTokens(state, textToken.tokens);
          } else {
            insertTextReq(state, textToken.text);
          }
          insertTextReq(state, "\n");
        } else {
          processTokens(state, [t]);
        }
      }
    } else {
      insertTextReq(state, item.text + "\n");
    }
  }
  const preset = ordered
    ? "NUMBERED_DECIMAL_ALPHA_ROMAN"
    : "BULLET_DISC_CIRCLE_SQUARE";
  applyBulletStyle(state, start, state.index, preset);
}

/**
 * insertTable на позиции I создаёт в Google Docs:
 *   - Пустой параграф перед таблицей: I .. I+1  (+1)
 *   - Table element: I+1 .. end
 *     - table start (+1)
 *     - для каждой row: row start (+1)
 *       - для каждой cell: cell start (+1) + paragraph \n (+1)
 *     - table end (+1)
 *   - Trailing paragraph \n: end .. end+1  (+1)
 *
 * Размер: 1 + 1 + rows*(1 + cols*2) + 1 + 1
 *        = 4 + rows*(1 + cols*2)
 *
 * Индекс параграфа ячейки (r,c):
 *   I + 1 (пустой параграф) + 1 (table start)
 *   + r * (1 + cols*2) + 1 (row start)
 *   + c * 2 + 1 (cell start)
 *   = I + 4 + r*(1 + cols*2) + c*2
 */
function processTable(
  state: InsertState,
  table: Readonly<Tokens.Table>,
): void {
  const rows = table.header.length > 0
    ? [table.header, ...table.rows]
    : table.rows;
  const numRows = rows.length;
  const numCols = rows[0]?.length ?? 0;

  if (numRows === 0 || numCols === 0) return;

  const insertIndex = state.index;

  state.requests.push({
    insertTable: {
      rows: numRows,
      columns: numCols,
      location: { index: insertIndex },
    },
  });

  const cells: string[][] = [];
  for (let r = 0; r < numRows; r++) {
    const row: string[] = [];
    for (let c = 0; c < numCols; c++) {
      row.push(rows[r][c]?.text ?? "");
    }
    cells.push(row);
  }

  state.pendingTableFills.push({
    insertIndex,
    numRows,
    numCols,
    cells,
  });

  state.index += 4 + numRows * (1 + numCols * 2);
}

/**
 * Вставки идут в обратном порядке (от последней ячейки
 * к первой), чтобы каждая вставка не сдвигала индексы
 * ещё не обработанных ячеек.
 */
function buildTableFillRequests(
  fill: Readonly<PendingTableFill>,
): DocsRequest[] {
  const reqs: DocsRequest[] = [];
  const base = fill.insertIndex;

  for (let r = fill.numRows - 1; r >= 0; r--) {
    for (let c = fill.numCols - 1; c >= 0; c--) {
      const text = fill.cells[r][c];
      if (!text) continue;

      const paragraphIndex = base + 4
        + r * (1 + fill.numCols * 2)
        + c * 2;

      reqs.push({
        insertText: {
          location: { index: paragraphIndex },
          text,
        },
      });
    }
  }

  return reqs;
}

function parseMarkdown(
  markdown: string,
  startIndex: number,
): InsertState {
  const tokens = marked.lexer(markdown);
  const state: InsertState = {
    index: startIndex,
    requests: [],
    pendingTableFills: [],
  };
  processTokens(state, tokens);
  return state;
}

export function markdownToGoogleDocsRequests(
  markdown: string,
  startIndex: number = 1,
): DocsRequest[] {
  return parseMarkdown(markdown, startIndex).requests;
}

/**
 * Разбивает запросы на batch'и по границам insertTable:
 *  - Batch N: запросы до insertTable включительно
 *  - Batch N+1: заполнение ячеек + запросы после таблицы
 *
 * Это необходимо, потому что insertTable создаёт новые
 * структурные элементы, и все последующие insertText
 * ссылаются на индексы, которых ещё нет до выполнения
 * insertTable.
 */
export function markdownToRequestBatches(
  markdown: string,
  startIndex: number = 1,
): DocsRequest[][] {
  const state = parseMarkdown(markdown, startIndex);

  if (state.pendingTableFills.length === 0) {
    return [state.requests];
  }

  const batches: DocsRequest[][] = [];
  let currentBatch: DocsRequest[] = [];
  let fillIndex = 0;

  for (const req of state.requests) {
    currentBatch.push(req);

    if (req.insertTable && fillIndex < state.pendingTableFills.length) {
      batches.push(currentBatch);
      const fill = state.pendingTableFills[fillIndex];
      fillIndex++;
      currentBatch = [...buildTableFillRequests(fill)];
    }
  }

  if (currentBatch.length > 0) {
    batches.push(currentBatch);
  }

  return batches;
}

import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { docs_v1 } from "googleapis";
import { getDocsService } from "../auth.js";
import { formatApiError } from "../utils/errors.js";
import {
  sendBatchedRequests,
  tabIdParam,
  injectTabId,
} from "../utils/batch.js";
import {
  tableCellStyleItemSchema,
  buildTableCellStyleRequest,
} from "../utils/styleBuilders.js";
import { getBodyContent } from "../utils/tabs.js";

const cellContentItemSchema = z.object({
  rowIndex: z.number().int().min(0).describe("Row index"),
  columnIndex: z.number().int().min(0).describe(
    "Column index",
  ),
  newContent: z.string().describe("New cell content"),
});

export function registerDocsTableTools(
  server: McpServer,
): void {
  server.tool(
    "docs_insert_table",
    "Insert an empty table at a specific position",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      rows: z.number().int().min(1).describe(
        "Number of rows",
      ),
      columns: z.number().int().min(1).describe(
        "Number of columns",
      ),
      index: z.number().int().min(1).describe(
        "Insert position",
      ),
    },
    async ({ documentId, tabId, rows, columns, index }) => {
      try {
        const reqs = injectTabId([{
          insertTable: {
            rows,
            columns,
            location: { index },
          },
        }], tabId);

        await sendBatchedRequests(documentId, reqs);
        return {
          content: [{
            type: "text",
            text: `Таблица ${rows}x${columns} вставлена `
              + `на позицию ${index}`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_insert_table_row",
    "Insert a row into a table",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      tableStartIndex: z.number().int().describe(
        "Table start index in the document",
      ),
      rowIndex: z.number().int().min(0).describe(
        "Row index to insert after",
      ),
      columnIndex: z.number().int().min(0).default(0)
        .describe("Reference cell column index"),
      insertBelow: z.boolean().default(true).describe(
        "Insert below (true) or above (false)",
      ),
    },
    async (params) => {
      try {
        const reqs = injectTabId([{
          insertTableRow: {
            tableCellLocation: {
              tableStartLocation: {
                index: params.tableStartIndex,
              },
              rowIndex: params.rowIndex,
              columnIndex: params.columnIndex,
            },
            insertBelow: params.insertBelow,
          },
        }], params.tabId);

        await sendBatchedRequests(
          params.documentId, reqs,
        );
        return {
          content: [{
            type: "text",
            text: `Строка вставлена `
              + `(row=${params.rowIndex}, `
              + `below=${params.insertBelow})`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_insert_table_column",
    "Insert a column into a table",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      tableStartIndex: z.number().int().describe(
        "Table start index",
      ),
      rowIndex: z.number().int().min(0).default(0)
        .describe("Reference row index"),
      columnIndex: z.number().int().min(0).describe(
        "Column index to insert next to",
      ),
      insertRight: z.boolean().default(true).describe(
        "Insert right (true) or left (false)",
      ),
    },
    async (params) => {
      try {
        const reqs = injectTabId([{
          insertTableColumn: {
            tableCellLocation: {
              tableStartLocation: {
                index: params.tableStartIndex,
              },
              rowIndex: params.rowIndex,
              columnIndex: params.columnIndex,
            },
            insertRight: params.insertRight,
          },
        }], params.tabId);

        await sendBatchedRequests(
          params.documentId, reqs,
        );
        return {
          content: [{
            type: "text",
            text: `Столбец вставлен рядом с `
              + `column=${params.columnIndex}`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_delete_table_row",
    "Delete a row from a table",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      tableStartIndex: z.number().int().describe(
        "Table start index",
      ),
      rowIndex: z.number().int().min(0).describe(
        "Row index to delete",
      ),
      columnIndex: z.number().int().min(0).default(0)
        .describe("Reference column index"),
    },
    async (params) => {
      try {
        const reqs = injectTabId([{
          deleteTableRow: {
            tableCellLocation: {
              tableStartLocation: {
                index: params.tableStartIndex,
              },
              rowIndex: params.rowIndex,
              columnIndex: params.columnIndex,
            },
          },
        }], params.tabId);

        await sendBatchedRequests(
          params.documentId, reqs,
        );
        return {
          content: [{
            type: "text",
            text: `Строка ${params.rowIndex} удалена`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_delete_table_column",
    "Delete a column from a table",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      tableStartIndex: z.number().int().describe(
        "Table start index",
      ),
      rowIndex: z.number().int().min(0).default(0)
        .describe("Reference row index"),
      columnIndex: z.number().int().min(0).describe(
        "Column index to delete",
      ),
    },
    async (params) => {
      try {
        const reqs = injectTabId([{
          deleteTableColumn: {
            tableCellLocation: {
              tableStartLocation: {
                index: params.tableStartIndex,
              },
              rowIndex: params.rowIndex,
              columnIndex: params.columnIndex,
            },
          },
        }], params.tabId);

        await sendBatchedRequests(
          params.documentId, reqs,
        );
        return {
          content: [{
            type: "text",
            text: `Столбец ${params.columnIndex} удалён`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_update_table_cell_content",
    "Replace content of one or multiple table cells",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      tableStartIndex: z.number().int().describe(
        "Table start index",
      ),
      items: z.array(cellContentItemSchema).min(1)
        .describe("Array of cells to update"),
    },
    async ({
      documentId, tabId, tableStartIndex, items,
    }) => {
      try {
        const docs = await getDocsService();
        const doc = await docs.documents.get({
          documentId,
          ...(tabId ? { includeTabsContent: true } : {}),
        });

        const sortedItems = [...items].sort((a, b) => {
          const cellA = getCellInfo(
            doc.data, tableStartIndex,
            a.rowIndex, a.columnIndex, tabId,
          );
          const cellB = getCellInfo(
            doc.data, tableStartIndex,
            b.rowIndex, b.columnIndex, tabId,
          );
          return cellB.contentStart - cellA.contentStart;
        });

        const requests: docs_v1.Schema$Request[] = [];

        for (const item of sortedItems) {
          const cell = getCellInfo(
            doc.data, tableStartIndex,
            item.rowIndex, item.columnIndex, tabId,
          );

          if (cell.contentEnd > cell.contentStart + 1) {
            requests.push({
              deleteContentRange: {
                range: {
                  startIndex: cell.contentStart,
                  endIndex: cell.contentEnd - 1,
                },
              },
            });
          }

          if (item.newContent) {
            requests.push({
              insertText: {
                location: { index: cell.contentStart },
                text: item.newContent,
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

        return {
          content: [{
            type: "text",
            text: `Обновлено ${items.length} ячеек`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );

  server.tool(
    "docs_update_table_cell_style",
    "Apply style to one or multiple table cells",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      tableStartIndex: z.number().int().describe(
        "Table start index",
      ),
      items: z.array(tableCellStyleItemSchema).min(1)
        .describe("Array of cells to style"),
    },
    async ({
      documentId, tabId, tableStartIndex, items,
    }) => {
      try {
        const requests = items.map(
          (item) => buildTableCellStyleRequest(
            tableStartIndex, item,
          ),
        );

        await sendBatchedRequests(
          documentId, injectTabId(requests, tabId),
        );

        return {
          content: [{
            type: "text",
            text: `Стиль применён к `
              + `${items.length} ячейкам`,
          }],
        };
      } catch (error) {
        return formatApiError(error);
      }
    },
  );
}

interface CellInfo {
  contentStart: number;
  contentEnd: number;
}

function findTable(
  doc: docs_v1.Schema$Document,
  tableStartIndex: number,
  tabId?: string,
): docs_v1.Schema$Table {
  for (const el of getBodyContent(doc, tabId)) {
    if (el.table && el.startIndex === tableStartIndex) {
      return el.table;
    }
  }
  throw new Error(
    `Table not found at index ${tableStartIndex}`,
  );
}

function getCellInfo(
  doc: docs_v1.Schema$Document,
  tableStartIndex: number,
  rowIndex: number,
  columnIndex: number,
  tabId?: string,
): CellInfo {
  const table = findTable(doc, tableStartIndex, tabId);

  const row = table.tableRows?.[rowIndex];
  if (!row) {
    throw new Error(`Row ${rowIndex} not found`);
  }

  const cell = row.tableCells?.[columnIndex];
  if (!cell) {
    throw new Error(`Column ${columnIndex} not found`);
  }

  const cellContent = cell.content ?? [];
  const contentStart =
    cellContent[0]?.startIndex ?? 0;
  const contentEnd =
    cellContent[cellContent.length - 1]?.endIndex
      ?? contentStart;

  return { contentStart, contentEnd };
}

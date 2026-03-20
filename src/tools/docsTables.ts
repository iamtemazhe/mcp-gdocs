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
    "Insert table at index. Get index from docs_read_document "
      + "(format: json)",
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
    handleTool(async ({
      documentId, tabId, rows, columns, index,
    }) => {
      const reqs = injectTabId([{
        insertTable: {
          rows,
          columns,
          location: { index },
        },
      }], tabId);

      await sendBatchedRequests(documentId, reqs);
      return textResult(
        `Таблица ${rows}x${columns} вставлена `
          + `на позицию ${index}`,
      );
    }),
  );

  server.tool(
    "docs_insert_table_row",
    "Insert rows into table. Get tableStartIndex from "
      + "docs_read_document (format: json)",
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
    handleTool(async (params) => {
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
      return textResult(
        `Строка вставлена `
          + `(row=${params.rowIndex}, `
          + `below=${params.insertBelow})`,
      );
    }),
  );

  server.tool(
    "docs_insert_table_column",
    "Insert columns into table. Get tableStartIndex from "
      + "docs_read_document (format: json)",
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
    handleTool(async (params) => {
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
      return textResult(
        `Столбец вставлен рядом с `
          + `column=${params.columnIndex}`,
      );
    }),
  );

  server.tool(
    "docs_delete_table_row",
    "Delete rows from table. Get tableStartIndex from "
      + "docs_read_document (format: json)",
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
    handleTool(async (params) => {
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
      return textResult(
        `Строка ${params.rowIndex} удалена`,
      );
    }),
  );

  server.tool(
    "docs_delete_table_column",
    "Delete columns from table. Get tableStartIndex from "
      + "docs_read_document (format: json)",
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
    handleTool(async (params) => {
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
      return textResult(
        `Столбец ${params.columnIndex} удалён`,
      );
    }),
  );

  server.tool(
    "docs_update_table_cell_content",
    "Replace table cell content. Get tableStartIndex from "
      + "docs_read_document (format: json). Rows/columns are "
      + "0-indexed",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      tableStartIndex: z.number().int().describe(
        "Table start index",
      ),
      items: z.array(cellContentItemSchema).min(1)
        .describe("Array of cells to update"),
    },
    handleTool(async ({
      documentId, tabId, tableStartIndex, items,
    }) => {
      const docs = await getDocsService();
      const tableFields =
        "startIndex,table(tableRows(tableCells("
        + "content(startIndex,endIndex))))";
      const fields = tabId
        ? `tabs(tabProperties(tabId),`
          + `childTabs(tabProperties(tabId),`
          + `documentTab(body(content(${tableFields})))),`
          + `documentTab(body(content(${tableFields}))))`
        : `body(content(${tableFields}))`;
      const doc = await docs.documents.get({
        documentId,
        fields,
        ...(tabId ? { includeTabsContent: true } : {}),
      });

      const table = findTable(
        doc.data, tableStartIndex, tabId,
      );

      const cellInfos = items.map((item) =>
        getCellInfoFromTable(
          table, item.rowIndex, item.columnIndex,
        ),
      );

      const indexed = items.map((item, i) => ({
        item,
        cell: cellInfos[i],
      }));
      indexed.sort(
        (a, b) => b.cell.contentStart
          - a.cell.contentStart,
      );

      const requests: docs_v1.Schema$Request[] = [];

      for (const { item, cell } of indexed) {
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

      return textResult(
        `Обновлено ${items.length} ячеек`,
      );
    }),
  );

  server.tool(
    "docs_update_table_cell_style",
    "Style table cells (background color). Get tableStartIndex "
      + "from docs_read_document (format: json)",
    {
      documentId: z.string().describe("Document ID"),
      tabId: tabIdParam,
      tableStartIndex: z.number().int().describe(
        "Table start index",
      ),
      items: z.array(tableCellStyleItemSchema).min(1)
        .describe("Array of cells to style"),
    },
    handleTool(async ({
      documentId, tabId, tableStartIndex, items,
    }) => {
      const requests = items.map(
        (item) => buildTableCellStyleRequest(
          tableStartIndex, item,
        ),
      );

      await sendBatchedRequests(
        documentId, injectTabId(requests, tabId),
      );

      return textResult(
        `Стиль применён к `
          + `${items.length} ячейкам`,
      );
    }),
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

function getCellInfoFromTable(
  table: docs_v1.Schema$Table,
  rowIndex: number,
  columnIndex: number,
): CellInfo {
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

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
  rowIndex: z.number().int().min(0).describe("Row (0-based)"),
  columnIndex: z.number().int().min(0).describe("Column (0-based)"),
  newContent: z.string().describe("Cell text"),
});

export function registerDocsTableTools(
  server: McpServer,
): void {
  server.registerTool(
    "docs_insert_table",
    {
      title: "Insert Table",
      description: "Insert empty table at index.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        rows: z.number().int().min(1).describe("Row count"),
        columns: z.number().int().min(1).describe("Column count"),
        index: z.number().int().min(1).describe("Insert index"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
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
        `Table ${rows}x${columns} at index ${index}`,
      );
    }),
  );

  server.registerTool(
    "docs_insert_table_row",
    {
      title: "Insert Table Row",
      description:
        "Insert row via table cell anchor.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        tableStartIndex: z.number().int().describe("From docs_read_document format:json"),
        rowIndex: z.number().int().min(0).describe("Anchor row"),
        columnIndex: z.number().int().min(0).default(0)
          .describe("Anchor column"),
        insertBelow: z.boolean().default(true).describe("Below if true"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
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
        `Row inserted (row=${params.rowIndex}, below=${params.insertBelow})`,
      );
    }),
  );

  server.registerTool(
    "docs_insert_table_column",
    {
      title: "Insert Table Column",
      description:
        "Insert column via cell anchor.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        tableStartIndex: z.number().int().describe("From docs_read_document format:json"),
        rowIndex: z.number().int().min(0).default(0)
          .describe("Anchor row"),
        columnIndex: z.number().int().min(0).describe("Anchor column"),
        insertRight: z.boolean().default(true).describe("Right if true"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
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
        `Column inserted near column=${params.columnIndex}`,
      );
    }),
  );

  server.registerTool(
    "docs_delete_table_row",
    {
      title: "Delete Table Row",
      description:
        "Delete one row by cell context.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        tableStartIndex: z.number().int().describe("From docs_read_document format:json"),
        rowIndex: z.number().int().min(0).describe("Row to delete"),
        columnIndex: z.number().int().min(0).default(0)
          .describe("Anchor column"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
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
        `Row ${params.rowIndex} deleted`,
      );
    }),
  );

  server.registerTool(
    "docs_delete_table_column",
    {
      title: "Delete Table Column",
      description:
        "Delete one column by index.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        tableStartIndex: z.number().int().describe("From docs_read_document format:json"),
        rowIndex: z.number().int().min(0).default(0)
          .describe("Anchor row"),
        columnIndex: z.number().int().min(0).describe("Column to delete"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
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
        `Column ${params.columnIndex} deleted`,
      );
    }),
  );

  server.registerTool(
    "docs_update_table_cell_content",
    {
      title: "Update Table Cell Content",
      description:
        "Bulk set cell text (0-based indices).",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        tableStartIndex: z.number().int().describe("From docs_read_document format:json"),
        items: z.array(cellContentItemSchema).min(1)
          .describe("Cells to update"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
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
        `Updated ${items.length} cell(s)`,
      );
    }),
  );

  server.registerTool(
    "docs_update_table_cell_style",
    {
      title: "Update Table Cell Style",
      description:
        "Bulk cell background color.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        tableStartIndex: z.number().int().describe("From docs_read_document format:json"),
        items: z.array(tableCellStyleItemSchema).min(1)
          .describe("Cells to style"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
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
        `Style applied to ${items.length} cell(s)`,
      );
    }),
  );

  server.registerTool(
    "docs_insert_table_with_data",
    {
      title: "Insert Table With Data",
      description:
        "Insert table and fill cells at index.",
      inputSchema: {
        documentId: z.string().describe("Document ID"),
        tabId: tabIdParam,
        index: z.number().int().min(1).describe("Insert index"),
        headers: z.array(z.string()).optional().describe("Header row"),
        rows: z.array(z.array(z.string())).min(1).describe("Data rows"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({
      documentId, tabId, index, headers, rows,
    }) => {
      const allRows = headers ? [headers, ...rows] : rows;
      const numRows = allRows.length;
      const numCols = Math.max(
        ...allRows.map((r) => r.length),
      );

      if (numCols === 0) {
        throw new Error("Rows must not be empty");
      }

      const insertReqs = injectTabId([{
        insertTable: {
          rows: numRows,
          columns: numCols,
          location: { index },
        },
      }], tabId);
      await sendBatchedRequests(documentId, insertReqs);

      const fillReqs: docs_v1.Schema$Request[] = [];
      for (let r = numRows - 1; r >= 0; r--) {
        for (let c = numCols - 1; c >= 0; c--) {
          const text = allRows[r]?.[c] ?? "";
          if (!text) continue;
          const cellIdx = index + 4
            + r * (1 + numCols * 2) + c * 2;
          fillReqs.push({
            insertText: {
              location: { index: cellIdx },
              text,
            },
          });
        }
      }

      if (fillReqs.length > 0) {
        await sendBatchedRequests(
          documentId, injectTabId(fillReqs, tabId),
        );
      }

      return textResult(
        `Table ${numRows}x${numCols} inserted at ${index}`,
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
    `Table not found at index ${tableStartIndex}. `
    + "Use docs_read_document(format:json) to find "
    + "tableStartIndex values",
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

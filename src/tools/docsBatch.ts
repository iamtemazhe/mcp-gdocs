import { z } from "zod";
import type { docs_v1 } from "googleapis";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { documentIdParam } from "../utils/schemas.js";
import { textResult, handleTool } from "../utils/errors.js";
import {
  sendBatchedRequests,
  CHUNK_SIZE,
  tabIdParam,
  injectTabId,
} from "../utils/batch.js";
import {
  indexedTextStyleSchema,
  indexedParagraphStyleSchema,
  indexedHeadingStyleSchema,
  imageItemSchema,
  tableCellStyleItemSchema,
  buildTextStyleRequest,
  buildParagraphStyleRequest,
  buildHeadingStyleRequest,
  buildImageRequest,
  buildTableCellStyleRequest,
  ptDim,
  buildTableRange,
  bulletPresetSchema,
  tableCellLocationParams,
} from "../utils/styleBuilders.js";

const updateTextStyleSchema =
  indexedTextStyleSchema.extend({
    type: z.literal("updateTextStyle"),
  });

const updateParagraphStyleSchema =
  indexedParagraphStyleSchema.extend({
    type: z.literal("updateParagraphStyle"),
  });

const updateHeadingStyleSchema =
  indexedHeadingStyleSchema.extend({
    type: z.literal("updateHeadingStyle"),
  });

const insertTextSchema = z.object({
  type: z.literal("insertText"),
  index: z.number().int().min(1).describe("Insert index"),
  text: z.string().describe("Text to insert"),
});

const deleteContentRangeSchema = z.object({
  type: z.literal("deleteContentRange"),
  startIndex: z.number().int().min(1).describe("Range start"),
  endIndex: z.number().int().min(2).describe("Range end"),
});

const replaceAllTextSchema = z.object({
  type: z.literal("replaceAllText"),
  searchText: z.string().describe("Search string"),
  replaceText: z.string().describe("Replace string"),
  matchCase: z.boolean().default(true)
    .describe("Case-sensitive match"),
});

const insertPageBreakSchema = z.object({
  type: z.literal("insertPageBreak"),
  index: z.number().int().min(1).describe("Break index"),
});

const insertTableSchema = z.object({
  type: z.literal("insertTable"),
  index: z.number().int().min(1).describe("Table index"),
  rows: z.number().int().min(1).describe("Row count"),
  columns: z.number().int().min(1).describe("Column count"),
});

const insertInlineImageSchema = imageItemSchema.extend({
  type: z.literal("insertInlineImage"),
});

const updateTableCellStyleSchema =
  tableCellStyleItemSchema.extend({
    type: z.literal("updateTableCellStyle"),
    tableStartIndex: tableCellLocationParams.tableStartIndex,
  });

const updateDocumentStyleSchema = z.object({
  type: z.literal("updateDocumentStyle"),
  marginTop: z.number().optional().describe("pt"),
  marginBottom: z.number().optional().describe("pt"),
  marginLeft: z.number().optional().describe("pt"),
  marginRight: z.number().optional().describe("pt"),
  pageWidth: z.number().optional().describe("pt"),
  pageHeight: z.number().optional().describe("pt"),
  useFirstPageHeaderFooter: z.boolean().optional(),
  useEvenPageHeaderFooter: z.boolean().optional(),
});

const mergeTableCellsSchema = z.object({
  type: z.literal("mergeTableCells"),
  ...tableCellLocationParams,
  rowSpan: z.number().int().min(1),
  columnSpan: z.number().int().min(1),
});

const unmergeTableCellsSchema = z.object({
  type: z.literal("unmergeTableCells"),
  ...tableCellLocationParams,
  rowSpan: z.number().int().min(1),
  columnSpan: z.number().int().min(1),
});

const updateTableColumnPropertiesSchema = z.object({
  type: z.literal("updateTableColumnProperties"),
  tableStartIndex: tableCellLocationParams.tableStartIndex,
  columnIndex: tableCellLocationParams.columnIndex,
  width: z.number().optional().describe("pt; required for FIXED_WIDTH"),
  widthType: z
    .enum(["EVENLY_DISTRIBUTED", "FIXED_WIDTH"])
    .default("FIXED_WIDTH")
    .describe("Column width: even split or fixed pt"),
});

const updateTableRowStyleSchema = z.object({
  type: z.literal("updateTableRowStyle"),
  tableStartIndex: tableCellLocationParams.tableStartIndex,
  rowIndex: tableCellLocationParams.rowIndex,
  minRowHeight: z.number().optional().describe("pt"),
  preventOverflow: z.boolean().optional()
    .describe("Prevent row from breaking across pages"),
});

const pinTableHeaderRowsSchema = z.object({
  type: z.literal("pinTableHeaderRows"),
  tableStartIndex: tableCellLocationParams.tableStartIndex,
  pinnedHeaderRowsCount: z.number().int().min(0)
    .describe("Number of header rows to pin"),
});

const createParagraphBulletsSchema = z.object({
  type: z.literal("createParagraphBullets"),
  startIndex: z.number().int().min(1)
    .describe("Bullet range start (document index)"),
  endIndex: z.number().int().min(2)
    .describe("Bullet range end (document index)"),
  bulletPreset: bulletPresetSchema,
});

const deleteParagraphBulletsSchema = z.object({
  type: z.literal("deleteParagraphBullets"),
  startIndex: z.number().int().min(1)
    .describe("Range start to clear bullets"),
  endIndex: z.number().int().min(2)
    .describe("Range end to clear bullets"),
});

const createNamedRangeSchema = z.object({
  type: z.literal("createNamedRange"),
  name: z.string().min(1)
    .describe("Unique name for the new range"),
  startIndex: z.number().int().min(1)
    .describe("Range start index in document"),
  endIndex: z.number().int().min(2)
    .describe("Range end index in document"),
});

const deleteNamedRangeByIdSchema = z.object({
  type: z.literal("deleteNamedRange"),
  namedRangeId: z.string().min(1)
    .describe("ID of the named range"),
});

const deleteNamedRangeByNameSchema = z.object({
  type: z.literal("deleteNamedRange"),
  name: z.string().min(1)
    .describe("Named range label to delete"),
});

const replaceNamedRangeByIdSchema = z.object({
  type: z.literal("replaceNamedRangeContent"),
  namedRangeId: z.string().min(1)
    .describe("ID of the named range"),
  text: z.string()
    .describe("Replacement plain text for range"),
});

const replaceNamedRangeByNameSchema = z.object({
  type: z.literal("replaceNamedRangeContent"),
  name: z.string().min(1)
    .describe("Named range label to replace"),
  text: z.string()
    .describe("Replacement plain text for range"),
});

const insertSectionBreakSchema = z.object({
  type: z.literal("insertSectionBreak"),
  index: z.number().int().min(1)
    .describe("Insert position for section break"),
  sectionType: z
    .enum(["NEXT_PAGE", "CONTINUOUS"])
    .default("NEXT_PAGE")
    .describe("Next page or continuous section"),
});

const updateSectionStyleSchema = z.object({
  type: z.literal("updateSectionStyle"),
  startIndex: z.number().int().min(1)
    .describe("Section span start index"),
  endIndex: z.number().int().min(2)
    .describe("Section span end index"),
  columnCount: z.number().int().min(1).max(3).optional()
    .describe("Number of columns (1–3)"),
  columnSeparatorStyle: z
    .enum(["NONE", "BETWEEN_EACH_COLUMN"])
    .optional()
    .describe("Vertical line between columns"),
  contentDirection: z
    .enum(["LEFT_TO_RIGHT", "RIGHT_TO_LEFT"])
    .optional()
    .describe("Text direction for the section"),
  sectionType: z.enum(["CONTINUOUS", "NEXT_PAGE"]).optional()
    .describe("Continuous flow or next-page section"),
});

const deleteHeaderSchema = z.object({
  type: z.literal("deleteHeader"),
  headerId: z.string().min(1)
    .describe("Header ID from document JSON"),
});

const deleteFooterSchema = z.object({
  type: z.literal("deleteFooter"),
  footerId: z.string().min(1)
    .describe("Footer ID from document JSON"),
});

const createFootnoteSchema = z.object({
  type: z.literal("createFootnote"),
  index: z.number().int().min(1)
    .describe("Insert index for footnote reference"),
});

const replaceImageSchema = z.object({
  type: z.literal("replaceImage"),
  imageObjectId: z.string().min(1)
    .describe("Inline object ID of the image to replace"),
  uri: z.string().min(1)
    .describe("Public URL of the replacement image"),
  imageReplaceMethod: z
    .enum(["CENTER_CROP", "STRETCH"])
    .default("CENTER_CROP")
    .describe("CENTER_CROP or STRETCH scaling"),
});

const addDocumentTabSchema = z.object({
  type: z.literal("addDocumentTab"),
  title: z.string().optional()
    .describe("Optional title for the new tab"),
  parentTabId: z.string().optional()
    .describe("Parent tab ID for nested tab"),
  insertionIndex: z.number().int().min(0).optional()
    .describe("Zero-based position among sibling tabs"),
});

const deleteTabSchema = z.object({
  type: z.literal("deleteTab"),
  tabId: z.string().min(1)
    .describe("Tab ID from docs_list_document_tabs"),
});

const deletePositionedObjectSchema = z.object({
  type: z.literal("deletePositionedObject"),
  objectId: z.string().min(1)
    .describe("Positioned object ID from document JSON"),
});

export const batchRequestSchema = z
  .union([
    updateTextStyleSchema,
    updateParagraphStyleSchema,
    updateHeadingStyleSchema,
    insertTextSchema,
    deleteContentRangeSchema,
    replaceAllTextSchema,
    insertPageBreakSchema,
    insertTableSchema,
    insertInlineImageSchema,
    updateTableCellStyleSchema,
    updateDocumentStyleSchema,
    mergeTableCellsSchema,
    unmergeTableCellsSchema,
    updateTableColumnPropertiesSchema,
    updateTableRowStyleSchema,
    pinTableHeaderRowsSchema,
    createParagraphBulletsSchema,
    deleteParagraphBulletsSchema,
    createNamedRangeSchema,
    deleteNamedRangeByIdSchema,
    deleteNamedRangeByNameSchema,
    replaceNamedRangeByIdSchema,
    replaceNamedRangeByNameSchema,
    insertSectionBreakSchema,
    updateSectionStyleSchema,
    deleteHeaderSchema,
    deleteFooterSchema,
    createFootnoteSchema,
    replaceImageSchema,
    addDocumentTabSchema,
    deleteTabSchema,
    deletePositionedObjectSchema,
  ])
  .superRefine((val, ctx) => {
    if (val.type === "updateDocumentStyle") {
      const ok =
        val.marginTop !== undefined
        || val.marginBottom !== undefined
        || val.marginLeft !== undefined
        || val.marginRight !== undefined
        || val.pageWidth !== undefined
        || val.pageHeight !== undefined
        || val.useFirstPageHeaderFooter !== undefined
        || val.useEvenPageHeaderFooter !== undefined;
      if (!ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "At least one document style field is required",
        });
      }
    }
    if (val.type === "updateTableColumnProperties") {
      if (
        val.widthType === "FIXED_WIDTH" && val.width === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "width is required when widthType is FIXED_WIDTH",
        });
      }
    }
    if (val.type === "updateTableRowStyle") {
      if (
        val.minRowHeight === undefined
        && val.preventOverflow === undefined
      ) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "At least one of minRowHeight or preventOverflow is required",
        });
      }
    }
    if (val.type === "updateSectionStyle") {
      const ok =
        val.columnCount !== undefined
        || val.columnSeparatorStyle !== undefined
        || val.contentDirection !== undefined
        || val.sectionType !== undefined;
      if (!ok) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message:
            "At least one of columnCount, columnSeparatorStyle, "
            + "contentDirection, sectionType is required",
        });
      }
    }
  });

type BatchRequest = z.infer<typeof batchRequestSchema>;

function mapRequest(
  req: BatchRequest,
  tabId?: string,
): docs_v1.Schema$Request {
  switch (req.type) {
    case "updateTextStyle":
      return buildTextStyleRequest(req);

    case "updateParagraphStyle":
      return buildParagraphStyleRequest(req);

    case "updateHeadingStyle":
      return buildHeadingStyleRequest(req);

    case "insertText":
      return {
        insertText: {
          location: { index: req.index },
          text: req.text,
        },
      };

    case "deleteContentRange":
      return {
        deleteContentRange: {
          range: {
            startIndex: req.startIndex,
            endIndex: req.endIndex,
          },
        },
      };

    case "replaceAllText":
      return {
        replaceAllText: {
          containsText: {
            text: req.searchText,
            matchCase: req.matchCase,
          },
          replaceText: req.replaceText,
          ...(tabId
            ? { tabsCriteria: { tabIds: [tabId] } }
            : {}),
        },
      };

    case "insertPageBreak":
      return {
        insertPageBreak: {
          location: { index: req.index },
        },
      };

    case "insertTable":
      return {
        insertTable: {
          rows: req.rows,
          columns: req.columns,
          location: { index: req.index },
        },
      };

    case "insertInlineImage":
      return buildImageRequest(req);

    case "updateTableCellStyle":
      return buildTableCellStyleRequest(
        req.tableStartIndex, req,
      );

    case "updateDocumentStyle": {
      const documentStyle: docs_v1.Schema$DocumentStyle = {};
      const fields: string[] = [];
      if (req.marginTop !== undefined) {
        documentStyle.marginTop = ptDim(req.marginTop);
        fields.push("marginTop");
      }
      if (req.marginBottom !== undefined) {
        documentStyle.marginBottom = ptDim(req.marginBottom);
        fields.push("marginBottom");
      }
      if (req.marginLeft !== undefined) {
        documentStyle.marginLeft = ptDim(req.marginLeft);
        fields.push("marginLeft");
      }
      if (req.marginRight !== undefined) {
        documentStyle.marginRight = ptDim(req.marginRight);
        fields.push("marginRight");
      }
      if (
        req.pageWidth !== undefined || req.pageHeight !== undefined
      ) {
        documentStyle.pageSize = {};
        if (req.pageWidth !== undefined) {
          documentStyle.pageSize.width = ptDim(req.pageWidth);
        }
        if (req.pageHeight !== undefined) {
          documentStyle.pageSize.height = ptDim(req.pageHeight);
        }
        fields.push("pageSize");
      }
      if (req.useFirstPageHeaderFooter !== undefined) {
        documentStyle.useFirstPageHeaderFooter =
          req.useFirstPageHeaderFooter;
        fields.push("useFirstPageHeaderFooter");
      }
      if (req.useEvenPageHeaderFooter !== undefined) {
        documentStyle.useEvenPageHeaderFooter =
          req.useEvenPageHeaderFooter;
        fields.push("useEvenPageHeaderFooter");
      }
      return {
        updateDocumentStyle: {
          documentStyle,
          fields: fields.join(","),
          ...(tabId ? { tabId } : {}),
        },
      };
    }

    case "mergeTableCells":
      return {
        mergeTableCells: {
          tableRange: buildTableRange(
            req.tableStartIndex,
            req.rowIndex,
            req.columnIndex,
            req.rowSpan,
            req.columnSpan,
          ),
        },
      };

    case "unmergeTableCells":
      return {
        unmergeTableCells: {
          tableRange: buildTableRange(
            req.tableStartIndex,
            req.rowIndex,
            req.columnIndex,
            req.rowSpan,
            req.columnSpan,
          ),
        },
      };

    case "updateTableColumnProperties": {
      const tableColumnProperties: docs_v1.Schema$TableColumnProperties =
        {
          widthType: req.widthType,
        };
      const colFields: string[] = ["widthType"];
      if (
        req.widthType === "FIXED_WIDTH" && req.width !== undefined
      ) {
        tableColumnProperties.width = ptDim(req.width);
        colFields.push("width");
      }
      return {
        updateTableColumnProperties: {
          tableStartLocation: { index: req.tableStartIndex },
          columnIndices: [req.columnIndex],
          tableColumnProperties,
          fields: colFields.join(","),
        },
      };
    }

    case "updateTableRowStyle": {
      const tableRowStyle: docs_v1.Schema$TableRowStyle = {};
      const rowFields: string[] = [];
      if (req.minRowHeight !== undefined) {
        tableRowStyle.minRowHeight = ptDim(req.minRowHeight);
        rowFields.push("minRowHeight");
      }
      if (req.preventOverflow !== undefined) {
        tableRowStyle.preventOverflow = req.preventOverflow;
        rowFields.push("preventOverflow");
      }
      return {
        updateTableRowStyle: {
          tableStartLocation: { index: req.tableStartIndex },
          rowIndices: [req.rowIndex],
          tableRowStyle,
          fields: rowFields.join(","),
        },
      };
    }

    case "pinTableHeaderRows":
      return {
        pinTableHeaderRows: {
          tableStartLocation: { index: req.tableStartIndex },
          pinnedHeaderRowsCount: req.pinnedHeaderRowsCount,
        },
      };

    case "createParagraphBullets":
      return {
        createParagraphBullets: {
          range: {
            startIndex: req.startIndex,
            endIndex: req.endIndex,
          },
          bulletPreset: req.bulletPreset,
        },
      };

    case "deleteParagraphBullets":
      return {
        deleteParagraphBullets: {
          range: {
            startIndex: req.startIndex,
            endIndex: req.endIndex,
          },
        },
      };

    case "createNamedRange":
      return {
        createNamedRange: {
          name: req.name,
          range: {
            startIndex: req.startIndex,
            endIndex: req.endIndex,
          },
        },
      };

    case "deleteNamedRange":
      return {
        deleteNamedRange: {
          ...("namedRangeId" in req
            ? { namedRangeId: req.namedRangeId }
            : { name: req.name }),
          ...(tabId
            ? { tabsCriteria: { tabIds: [tabId] } }
            : {}),
        },
      };

    case "replaceNamedRangeContent":
      return {
        replaceNamedRangeContent: {
          ...("namedRangeId" in req
            ? { namedRangeId: req.namedRangeId }
            : { namedRangeName: req.name }),
          text: req.text,
          ...(tabId
            ? { tabsCriteria: { tabIds: [tabId] } }
            : {}),
        },
      };

    case "insertSectionBreak":
      return {
        insertSectionBreak: {
          location: { index: req.index },
          sectionType: req.sectionType,
        },
      };

    case "updateSectionStyle": {
      const sectionStyle: docs_v1.Schema$SectionStyle = {};
      const secFields: string[] = [];
      if (req.columnCount !== undefined) {
        sectionStyle.columnProperties = Array.from(
          { length: req.columnCount },
          () => ({}),
        );
        secFields.push("columnProperties");
      }
      if (req.columnSeparatorStyle !== undefined) {
        sectionStyle.columnSeparatorStyle = req.columnSeparatorStyle;
        secFields.push("columnSeparatorStyle");
      }
      if (req.contentDirection !== undefined) {
        sectionStyle.contentDirection = req.contentDirection;
        secFields.push("contentDirection");
      }
      if (req.sectionType !== undefined) {
        sectionStyle.sectionType = req.sectionType;
        secFields.push("sectionType");
      }
      return {
        updateSectionStyle: {
          range: {
            startIndex: req.startIndex,
            endIndex: req.endIndex,
          },
          sectionStyle,
          fields: secFields.join(","),
        },
      };
    }

    case "deleteHeader":
      return {
        deleteHeader: {
          headerId: req.headerId,
          ...(tabId ? { tabId } : {}),
        },
      };

    case "deleteFooter":
      return {
        deleteFooter: {
          footerId: req.footerId,
          ...(tabId ? { tabId } : {}),
        },
      };

    case "createFootnote":
      return {
        createFootnote: {
          location: { index: req.index },
        },
      };

    case "replaceImage":
      return {
        replaceImage: {
          imageObjectId: req.imageObjectId,
          uri: req.uri,
          imageReplaceMethod: req.imageReplaceMethod,
          ...(tabId ? { tabId } : {}),
        },
      };

    case "addDocumentTab": {
      const tabProperties: Record<string, string | number> = {};
      if (req.title !== undefined) tabProperties.title = req.title;
      if (req.parentTabId !== undefined) {
        tabProperties.parentTabId = req.parentTabId;
      }
      if (req.insertionIndex !== undefined) {
        tabProperties.index = req.insertionIndex;
      }
      return {
        addDocumentTab: { tabProperties },
      } as docs_v1.Schema$Request;
    }

    case "deleteTab":
      return {
        deleteTab: { tabId: req.tabId },
      } as docs_v1.Schema$Request;

    case "deletePositionedObject":
      return {
        deletePositionedObject: {
          objectId: req.objectId,
          ...(tabId ? { tabId } : {}),
        },
      };

    default: {
      const _x: never = req;
      return _x;
    }
  }
}

export function registerDocsBatchTools(
  server: McpServer,
): void {
  server.registerTool(
    "docs_batch_update",
    {
      title: "Batch Update",
      description:
        "Run structural and formatting edits on a document in one batch (text styles, paragraph styles, inserts, deletes, tables, images, sections, tabs, named ranges, and more).",
      inputSchema: {
        documentId: documentIdParam,
        tabId: tabIdParam,
        requests: z
          .array(batchRequestSchema)
          .min(1)
          .describe("Batch operations"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ documentId, tabId, requests }) => {
      const apiRequests = requests.map(
        (r) => mapRequest(r, tabId),
      );
      const replies = await sendBatchedRequests(
        documentId,
        injectTabId(apiRequests, tabId),
      );

      const chunks = Math.ceil(replies.length / CHUNK_SIZE);
      return textResult(
        `${requests.length} op(s) in ${chunks} request(s)`,
      );
    }),
  );
}

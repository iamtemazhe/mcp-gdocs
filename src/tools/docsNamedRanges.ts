import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { documentIdParam } from "../utils/schemas.js";
import type { docs_v1 } from "googleapis";
import { textResult, handleTool } from "../utils/errors.js";
import {
  sendBatchedRequests,
  tabIdParam,
  injectTabId,
} from "../utils/batch.js";

function requireNamedRangeIdOrName(
  namedRangeId: string | undefined,
  name: string | undefined,
): void {
  const idOk = namedRangeId != null && namedRangeId.trim().length > 0;
  const nameOk = name != null && name.trim().length > 0;
  if (!idOk && !nameOk) {
    throw new Error("Provide namedRangeId or name");
  }
}

export function registerDocsNamedRangeTools(server: McpServer): void {
  server.registerTool(
    "docs_create_named_range",
    {
      title: "Create Named Range",
      description:
        "Create a named range over a character span for templates and automation.",
      inputSchema: {
        documentId: documentIdParam,
        tabId: tabIdParam,
        name: z.string().min(1).describe("Named range name"),
        startIndex: z.number().int().min(1).describe(
          "Range start index from docs_read_document(format:'json')",
        ),
        endIndex: z.number().int().min(2).describe(
          "Range end from docs_read_document(format:'json')",
        ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({
      documentId,
      tabId,
      name,
      startIndex,
      endIndex,
    }) => {
      const req: docs_v1.Schema$Request = {
        createNamedRange: {
          name,
          range: { startIndex, endIndex },
        },
      };
      const replies = await sendBatchedRequests(
        documentId,
        injectTabId([req], tabId),
      );
      const namedRangeId = replies[0]?.createNamedRange?.namedRangeId;
      if (!namedRangeId) {
        throw new Error("No namedRangeId in API response");
      }
      return textResult(namedRangeId);
    }),
  );

  server.registerTool(
    "docs_delete_named_range",
    {
      title: "Delete Named Range",
      description:
        "Delete a named range by id or by name.",
      inputSchema: {
        documentId: documentIdParam,
        namedRangeId: z.string().optional().describe(
          "Named range ID (from docs_create_named_range or docs_read_document)",
        ),
        name: z.string().optional().describe(
          "Named range name (alternative to namedRangeId)",
        ),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: true,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ documentId, namedRangeId, name }) => {
      requireNamedRangeIdOrName(namedRangeId, name);
      const deleteNamedRange: docs_v1.Schema$DeleteNamedRangeRequest =
        namedRangeId != null && namedRangeId.trim().length > 0
          ? { namedRangeId: namedRangeId.trim() }
          : { name: name!.trim() };
      await sendBatchedRequests(documentId, [{ deleteNamedRange }]);
      return textResult("OK");
    }),
  );

  server.registerTool(
    "docs_replace_named_range_content",
    {
      title: "Replace Named Range Content",
      description:
        "Replace the text inside a named range.",
      inputSchema: {
        documentId: documentIdParam,
        namedRangeId: z.string().optional().describe("Named range ID"),
        name: z.string().optional().describe(
          "Named range name (alternative to namedRangeId)",
        ),
        text: z.string().describe("Replacement text"),
      },
      annotations: {
        readOnlyHint: false,
        destructiveHint: false,
        openWorldHint: true,
        idempotentHint: false,
      },
    },
    handleTool(async ({ documentId, namedRangeId, name, text }) => {
      requireNamedRangeIdOrName(namedRangeId, name);
      const replaceNamedRangeContent:
        docs_v1.Schema$ReplaceNamedRangeContentRequest =
        namedRangeId != null && namedRangeId.trim().length > 0
          ? { namedRangeId: namedRangeId.trim(), text }
          : { namedRangeName: name!.trim(), text };
      await sendBatchedRequests(documentId, [{ replaceNamedRangeContent }]);
      return textResult("OK");
    }),
  );
}

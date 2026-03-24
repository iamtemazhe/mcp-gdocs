import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { GaxiosError } from "googleapis-common";
import { logger } from "./logger.js";

const MAX_RESPONSE =
  parseInt(
    process.env.GDOCS_MAX_RESPONSE_LENGTH ?? "0",
    10,
  ) || 0;

const PRETTY_JSON =
  process.env.MCP_PRETTY_JSON === "true";

function truncate(text: string): string {
  if (!MAX_RESPONSE || text.length <= MAX_RESPONSE) {
    return text;
  }
  return text.slice(0, MAX_RESPONSE)
    + `\n\n[Response truncated at ${MAX_RESPONSE} chars. `
    + "Use 'fields' parameter or 'summary' format to reduce response size.]";
}

export function textResult(
  msg: string,
): CallToolResult {
  return {
    content: [{ type: "text", text: truncate(msg) }],
  };
}

export function jsonResult(
  data: unknown,
): CallToolResult {
  const raw = PRETTY_JSON
    ? JSON.stringify(data, null, 2)
    : JSON.stringify(data);
  return {
    content: [{ type: "text", text: truncate(raw) }],
  };
}

export function handleTool<T>(
  fn: (args: T) => Promise<CallToolResult>,
): (args: T) => Promise<CallToolResult> {
  return async (args: T) => {
    try {
      return await fn(args);
    } catch (error) {
      return formatApiError(error);
    }
  };
}

export function bulkResult(
  settled: PromiseSettledResult<unknown>[],
): CallToolResult {
  const errors: { index: number; error: string }[] = [];
  const results: { index: number; result: unknown }[] = [];

  settled.forEach((s, i) => {
    if (s.status === "fulfilled") {
      results.push({ index: i, result: s.value });
    } else {
      const msg = s.reason instanceof Error
        ? s.reason.message
        : String(s.reason);
      errors.push({ index: i, error: msg });
    }
  });

  const total = settled.length;
  const ok = results.length;
  const summary = `Done ${ok}/${total}`
    + (errors.length > 0
      ? `, errors: ${errors.length}`
      : "");

  const parts: string[] = [summary];
  if (results.length > 0) {
    parts.push(JSON.stringify(results));
  }
  if (errors.length > 0) {
    parts.push(JSON.stringify(errors));
  }

  return {
    content: [{ type: "text", text: parts.join("\n") }],
    isError: ok === 0 && total > 0,
  };
}

export function formatApiError(error: unknown): CallToolResult {
  if (isGaxiosError(error)) {
    const status = error.response?.status ?? 0;
    const message = error.response?.data?.error?.message
      ?? error.message;

    const prefix = `Google API ${status}`;
    let hint = "";

    if (status === 401 || status === 403) {
      hint = ". Check service account permissions "
        + "on the document (Share → Add email)";
    } else if (status === 404) {
      hint = ". Resource not found. Verify document ID or use "
        + "drive_list_documents.";
    } else if (status === 429) {
      hint = ". Rate limit exceeded, retry in a moment";
    } else if (status === 500) {
      hint = ". Google API internal error. The request may succeed on retry.";
    } else if (status === 502 || status === 503) {
      hint = ". Google API temporarily unavailable. Retry in a moment.";
    }

    logger.error(`${prefix}: ${message}`, {
      status,
      url: error.config?.url,
    });

    return {
      content: [
        { type: "text", text: `${prefix}: ${message}${hint}` },
      ],
      isError: true,
      _meta: {
        googleStatus: status,
        googleMessage: message,
      },
    };
  }

  const msg = error instanceof Error
    ? error.message
    : String(error);

  logger.error(msg);

  return {
    content: [
      { type: "text", text: `Error: ${msg}` },
    ],
    isError: true,
  };
}

export function stripEmpty(obj: unknown): unknown {
  if (obj === null || obj === undefined) return undefined;
  if (Array.isArray(obj)) {
    const arr = obj
      .map(stripEmpty)
      .filter((v) => v !== undefined);
    return arr.length > 0 ? arr : undefined;
  }
  if (typeof obj === "object") {
    const result: Record<string, unknown> = {};
    let hasKeys = false;
    for (const [k, v] of Object.entries(
      obj as Record<string, unknown>,
    )) {
      const cleaned = stripEmpty(v);
      if (cleaned !== undefined) {
        result[k] = cleaned;
        hasKeys = true;
      }
    }
    return hasKeys ? result : undefined;
  }
  return obj;
}

function isGaxiosError(error: unknown): error is GaxiosError {
  return (
    error instanceof Error &&
    "response" in error &&
    typeof (error as GaxiosError).response?.status === "number"
  );
}

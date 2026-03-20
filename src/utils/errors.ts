import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { GaxiosError } from "googleapis-common";

export function textResult(
  msg: string,
): CallToolResult {
  return { content: [{ type: "text", text: msg }] };
}

export function jsonResult(
  data: unknown,
): CallToolResult {
  return {
    content: [{
      type: "text",
      text: JSON.stringify(data, null, 2),
    }],
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

interface BulkItem {
  index: number;
  status: "ok" | "error";
  result?: unknown;
  error?: string;
}

export function bulkResult(
  settled: PromiseSettledResult<unknown>[],
): CallToolResult {
  const items: BulkItem[] = settled.map((s, i) => {
    if (s.status === "fulfilled") {
      return { index: i, status: "ok", result: s.value };
    }
    const msg = s.reason instanceof Error
      ? s.reason.message
      : String(s.reason);
    return { index: i, status: "error", error: msg };
  });

  const ok = items.filter((i) => i.status === "ok").length;
  const failed = items.length - ok;
  const summary = `Выполнено ${ok}/${items.length}`
    + (failed > 0 ? `, ошибок: ${failed}` : "");

  return {
    content: [{
      type: "text",
      text: `${summary}\n${JSON.stringify(items, null, 2)}`,
    }],
    isError: failed === items.length,
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
      hint = ". Проверьте права service account на документ";
    } else if (status === 404) {
      hint = ". Документ не найден или нет доступа";
    } else if (status === 429) {
      hint = ". Превышен лимит запросов, повторите позже";
    }

    return {
      content: [
        { type: "text", text: `${prefix}: ${message}${hint}` },
      ],
      isError: true,
    };
  }

  if (error instanceof Error) {
    return {
      content: [
        { type: "text", text: `Ошибка: ${error.message}` },
      ],
      isError: true,
    };
  }

  return {
    content: [
      { type: "text", text: `Неизвестная ошибка: ${String(error)}` },
    ],
    isError: true,
  };
}

function isGaxiosError(error: unknown): error is GaxiosError {
  return (
    error instanceof Error &&
    "response" in error &&
    typeof (error as GaxiosError).response?.status === "number"
  );
}

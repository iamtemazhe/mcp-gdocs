import type { docs_v1 } from "googleapis";
import { z } from "zod";
import { getDocsService } from "../auth.js";
import { getBodyContent } from "./tabs.js";

export const tabIdParam = z.string().optional().describe(
  "Tab ID for multi-tab documents "
  + "(use docs_list_document_tabs to find)",
);

export const CHUNK_SIZE = 100;

export async function sendBatchedRequests(
  documentId: string,
  requests: docs_v1.Schema$Request[],
): Promise<docs_v1.Schema$Response[]> {
  const docs = await getDocsService();
  const allReplies: docs_v1.Schema$Response[] = [];

  for (
    let i = 0; i < requests.length; i += CHUNK_SIZE
  ) {
    const chunk = requests.slice(i, i + CHUNK_SIZE);
    const result = await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests: chunk },
    });
    allReplies.push(...(result.data.replies ?? []));
  }

  return allReplies;
}

type Obj = Record<string, unknown>;

/**
 * Рекурсивно добавляет tabId в location и range
 * объекты запроса (in-place мутация).
 */
function addTabIdToObj(obj: Obj, tabId: string): void {
  for (const [key, val] of Object.entries(obj)) {
    if (!val || typeof val !== "object") continue;
    const child = val as Obj;

    if (key === "location" && "index" in child) {
      child.tabId = tabId;
    } else if (key === "range" && "startIndex" in child) {
      child.tabId = tabId;
    }

    addTabIdToObj(child, tabId);
  }
}

/**
 * Добавляет tabId в location и range объекты запросов.
 * Мутирует исходные объекты (без JSON.stringify).
 */
export function injectTabId(
  requests: docs_v1.Schema$Request[],
  tabId?: string,
): docs_v1.Schema$Request[] {
  if (!tabId) return requests;

  for (const req of requests) {
    addTabIdToObj(
      req as unknown as Obj, tabId,
    );
  }
  return requests;
}

/**
 * Возвращает endIndex последнего элемента body.
 * Если передан tabId — читает контент конкретного таба.
 */
const END_INDEX_FIELDS = "body(content(endIndex))";
const END_INDEX_FIELDS_TAB =
  "tabs(tabProperties(tabId),"
  + "childTabs(tabProperties(tabId),"
  + "documentTab(body(content(endIndex)))),"
  + "documentTab(body(content(endIndex))))";

export async function getDocEndIndex(
  documentId: string,
  tabId?: string,
): Promise<number> {
  const docs = await getDocsService();

  const doc = await docs.documents.get({
    documentId,
    ...(tabId
      ? {
        includeTabsContent: true,
        fields: END_INDEX_FIELDS_TAB,
      }
      : { fields: END_INDEX_FIELDS }),
  });

  const content = getBodyContent(doc.data, tabId);

  return content.length > 0
    ? (content[content.length - 1].endIndex ?? 1)
    : 1;
}

import type { docs_v1 } from "googleapis";
import { getDocsService } from "../auth.js";

export const CHUNK_SIZE = 100;

export async function sendBatchedRequests(
  documentId: string,
  requests: docs_v1.Schema$Request[],
): Promise<number> {
  const docs = await getDocsService();
  let sent = 0;

  for (let i = 0; i < requests.length; i += CHUNK_SIZE) {
    const chunk = requests.slice(i, i + CHUNK_SIZE);
    await docs.documents.batchUpdate({
      documentId,
      requestBody: { requests: chunk },
    });
    sent += chunk.length;
  }

  return sent;
}

/**
 * Возвращает endIndex последнего элемента body.
 * Используется для append-операций и замены контента.
 */
export async function getDocEndIndex(
  documentId: string,
): Promise<number> {
  const docs = await getDocsService();
  const doc = await docs.documents.get({ documentId });
  const content = doc.data.body?.content ?? [];
  return content.length > 0
    ? (content[content.length - 1].endIndex ?? 1)
    : 1;
}

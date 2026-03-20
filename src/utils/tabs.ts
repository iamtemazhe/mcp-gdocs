import type { docs_v1 } from "googleapis";

/**
 * Ищет вкладку по tabId (включая дочерние).
 * Возвращает null, если не найдена.
 */
export function findTab(
  doc: docs_v1.Schema$Document,
  tabId: string,
): docs_v1.Schema$Tab | null {
  for (const tab of doc.tabs ?? []) {
    if (tab.tabProperties?.tabId === tabId) return tab;
    for (const child of tab.childTabs ?? []) {
      if (child.tabProperties?.tabId === tabId) {
        return child;
      }
    }
  }
  return null;
}

/**
 * Возвращает body.content для указанного таба
 * или для основного body (если tabId не передан).
 * Бросает ошибку, если таб не найден.
 */
export function getBodyContent(
  doc: docs_v1.Schema$Document,
  tabId?: string,
): docs_v1.Schema$StructuralElement[] {
  if (!tabId) return doc.body?.content ?? [];

  const tab = findTab(doc, tabId);
  if (!tab) throw new Error(`Tab "${tabId}" not found`);
  return tab.documentTab?.body?.content ?? [];
}

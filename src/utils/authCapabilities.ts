import { isServiceAccount } from "../auth.js";

/**
 * SA в enterprise Google Workspace:
 *   ✓ Docs read/write/format
 *   ✓ Drive list/search/rename/move
 *   ✓ Drive create folders
 *   ✓ Drive permanent delete
 *   ✗ Drive create files (docs/copy) — storage quota
 *   ✗ Drive trash — 403 insufficient permissions
 *   ✗ Drive upload images — storage quota
 */

export type AuthCapability =
  | "create_files"
  | "trash"
  | "upload";

const SA_DENIED: ReadonlySet<AuthCapability> = new Set([
  "create_files",
  "trash",
  "upload",
]);

export function canDo(cap: AuthCapability): boolean {
  if (!isServiceAccount()) return true;
  return !SA_DENIED.has(cap);
}

export function saRestrictionNote(
  caps: AuthCapability[],
): string {
  const labels: Record<AuthCapability, string> = {
    create_files:
      "Service Account in enterprise workspace cannot create files (storage quota).",
    trash:
      "Service Account in enterprise workspace cannot trash files (use permanent delete).",
    upload:
      "Service Account in enterprise workspace cannot upload files (storage quota).",
  };
  return caps.map((c) => labels[c]).join(" ");
}

export function authMeta(
  requires: AuthCapability[],
): Record<string, unknown> {
  return {
    authRequires: requires,
    saEnterpriseLimited: requires.length > 0,
  };
}

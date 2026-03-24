import type { McpServer } from
  "@modelcontextprotocol/sdk/server/mcp.js";
import { getDriveService } from "./auth.js";

async function listRecentFiles(
  mimeType: string,
  uri: string,
): Promise<{
  contents: Array<{
    uri: string;
    mimeType: string;
    text: string;
  }>;
}> {
  const drive = await getDriveService();
  const res = await drive.files.list({
    q: `mimeType='${mimeType}' and trashed=false`,
    pageSize: 20,
    fields: "files(id,name,modifiedTime)",
    orderBy: "modifiedTime desc",
  });
  const items = (res.data.files ?? []).map((f) => ({
    id: f.id,
    name: f.name,
    modifiedTime: f.modifiedTime,
  }));
  return {
    contents: [{
      uri,
      mimeType: "application/json",
      text: JSON.stringify(items),
    }],
  };
}

export function registerResources(
  server: McpServer,
): void {
  server.registerResource(
    "recent-documents",
    "gdocs://documents/recent",
    {
      title: "Recent Documents",
      description:
        "List recent Google Docs. "
        + "Use documentId with document tools.",
      mimeType: "application/json",
    },
    () => listRecentFiles(
      "application/vnd.google-apps.document",
      "gdocs://documents/recent",
    ),
  );

}

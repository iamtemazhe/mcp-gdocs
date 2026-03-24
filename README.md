# mcp-gdocs

[Русский](docs/README.ru.md) | [中文](docs/README.cn.md)

[Why mcp-gdocs exists](docs/WHYIEXIST.md)

MCP server for **Google Docs**, **Google Drive**, and **Comments** with flexible authentication.

Connect Cursor, Claude Desktop, or any MCP client to your Google Docs and Drive.

Start with a single command: `npx -y mcp-gdocs`.

---

## Quick Start

### 1. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable **Google Docs API** and **Google Drive API**
4. Choose authentication method (see [Authentication](#authentication) below)

### 2. Add to Cursor / MCP Client

**Service Account** — share documents with the SA email, then:

```json
{
  "mcpServers": {
    "mcp-gdocs": {
      "command": "npx",
      "args": ["-y", "mcp-gdocs"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json"
      }
    }
  }
}
```

**OAuth** — run `npx -y mcp-gdocs auth` first, then:

```json
{
  "mcpServers": {
    "mcp-gdocs": {
      "command": "npx",
      "args": ["-y", "mcp-gdocs"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id",
        "GOOGLE_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

The server starts automatically when the MCP client connects.

---

## What Can It Do?

Most write operations accept an `items` array for bulk execution in a single call. All tools support an optional `tabId` parameter for multi-tab documents.

### Google Docs

<details>
<summary>Reading, writing, formatting, tables, images, native Markdown, batch, tabs, named ranges</summary>

| Tool | Description |
| --- | --- |
| `docs_read_document` | Read as text, JSON, markdown, or **summary**; optional **`fields`** mask |
| `docs_get_document_info` | Document metadata (title, ID, revision) |
| `docs_list_document_tabs` | List all tabs in a multi-tab document |
| `docs_insert_text` | Insert text at one or multiple positions |
| `docs_append_text` | Append text to the end |
| `docs_delete_range` | Remove content by index ranges |
| `docs_replace_all_text` | Replace all occurrences of patterns |
| `docs_replace_document_content` | Replace entire document content |
| `docs_insert_page_break` | Insert page breaks |
| `docs_rename_tab` | Rename a document tab |
| `docs_update_header` | Update header content |
| `docs_update_footer` | Update footer content |
| `docs_create_footnote` | Create footnotes at a position |
| `docs_add_tab` | Add a new document tab |
| `docs_apply_text_style` | Bold, italic, underline, colors, font, links |
| `docs_apply_paragraph_style` | Alignment, spacing, indentation |
| `docs_apply_heading_style` | Heading styles (H1–H6) |
| `docs_format_by_text` | Find text and apply formatting without knowing indices |
| `docs_insert_table_row` | Add row to table |
| `docs_insert_table_column` | Add column to table |
| `docs_delete_table_row` | Delete row from table |
| `docs_delete_table_column` | Delete column from table |
| `docs_update_table_cell_content` | Update cell content |
| `docs_update_table_cell_style` | Cell background color |
| `docs_insert_table_with_data` | Create a table pre-filled with data |
| `docs_insert_image` | Insert images from URL |
| `docs_insert_local_image` | Insert images from local files (upload + insert) |
| `docs_replace_with_markdown_native` | Replace from Markdown (native Google conversion) |
| `docs_replace_with_markdown_file_native` | Replace from Markdown file (native conversion) |
| `docs_batch_update` | Batch multiple operations in one API call (30 request types) |
| `docs_create_named_range` | Create a named range |
| `docs_delete_named_range` | Delete a named range |
| `docs_replace_named_range_content` | Replace text inside a named range |

</details>

### Comments

<details>
<summary>List, get, add, reply, resolve, delete</summary>

| Tool | Description |
| --- | --- |
| `docs_list_comments` | List all comments with author and date |
| `docs_get_comment` | Get a specific comment with replies |
| `docs_add_comment` | Create comments anchored to text |
| `docs_reply_to_comment` | Reply to comments |
| `docs_resolve_comment` | Mark comments as resolved |
| `docs_delete_comment` | Remove comments |

</details>

### Google Drive

<details>
<summary>Files, folders, permissions, export, revisions, shared drives</summary>

| Tool | Description |
| --- | --- |
| `drive_list_documents` | List documents, optionally filtered |
| `drive_search_documents` | Full-text search across documents |
| `drive_create_document` | Create new documents |
| `drive_create_from_template` | Create documents from a template |
| `drive_create_from_markdown` | Create a new Doc from inline Markdown |
| `drive_create_from_markdown_file` | Create a new Doc from a local `.md` file |
| `drive_create_folder` | Create folders |
| `drive_list_folder_contents` | List folder contents |
| `drive_get_folder_info` | Get folder metadata |
| `drive_move_file` | Move files to another folder |
| `drive_copy_file` | Duplicate files |
| `drive_rename_file` | Rename files |
| `drive_delete_file` | Move files to trash |
| `docs_export_pdf` | Export document as PDF (optional `savePath`) |
| `drive_export_file` | Export to markdown, PDF, DOCX, and other MIME types |
| `drive_share_file` | Share a file (user, group, domain, anyone) |
| `drive_list_permissions` | List ACLs on a file |
| `drive_update_permission` | Change role on an existing permission |
| `drive_remove_permission` | Revoke a permission |
| `drive_list_revisions` | List revision history |
| `drive_get_revision` | Fetch metadata or content of one revision |
| `drive_list_shared_drives` | List shared drives (Team Drives) |

</details>

### Prompts

<details>
<summary>Workflow-oriented prompt templates for common tasks</summary>

| Prompt | Description |
| --- | --- |
| `pretty-format` | Create or reformat a Doc from Markdown; cleanup batch for rules, spacing, tables |
| `gost-format` | Document structure and styles aligned with GOST 19.106-78 |
| `template-fill` | Fill a template using placeholders / named ranges |
| `export-to-markdown` | Export a Google Doc to Markdown via Drive API |
| `format-table` | Pin headers, column widths, and cell styles for a Doc table |
| `share-document` | List permissions, then share with a user |

</details>

### Resources

| URI | Description |
| --- | --- |
| `gdocs://documents/recent` | JSON list of recently modified Google Docs |

### Batch Operations

`docs_batch_update` combines multiple heterogeneous operations into a single API request (**30** request types). Large arrays are automatically split into chunks. Rate limiting uses a shared API semaphore.

---

## Authentication

The server supports multiple authentication methods. If several variables are set, the first found is used: **OAuth** → `SERVICE_ACCOUNT_PATH` → `CREDENTIALS_CONFIG` → `GOOGLE_APPLICATION_CREDENTIALS`.

| Criteria | Service Account | OAuth |
| --- | --- | --- |
| **Document access** | Only shared with SA | All your documents |
| **Drive operations** | Only in shared folders | Full access to your Drive |
| **Best for** | CI/CD, servers, automation | Personal use, Cursor, Claude Desktop |
| **Setup** | Download JSON key, share documents | OAuth flow in browser |
| **Google Workspace** | Impersonation — full access as user | Not needed |

> **Enterprise (Google Workspace):** with domain-wide delegation, SA can act on behalf of any domain user via `GOOGLE_IMPERSONATE_USER`.

**Recommendation:** use **OAuth** for personal work in Cursor/Claude Desktop. Use **Service Account** with impersonation for enterprise automation.

### Method A: Service Account

Headless, secure, ideal for server environments.

**Steps:**

1. GCP Console → IAM & Admin → Service Accounts → Create
2. Download JSON key
3. Share documents/folders with SA email (Editor)

**Three ways to provide credentials:**

<details>
<summary>A1. <code>SERVICE_ACCOUNT_PATH</code> (+ impersonation)</summary>

```json
{
  "mcpServers": {
    "mcp-gdocs": {
      "command": "npx",
      "args": ["-y", "mcp-gdocs"],
      "env": {
        "SERVICE_ACCOUNT_PATH": "/path/to/service-account-key.json",
        "GOOGLE_IMPERSONATE_USER": "user@yourdomain.com"
      }
    }
  }
}
```

</details>

<details>
<summary>A2. <code>CREDENTIALS_CONFIG</code> — Base64-encoded JSON (Docker / CI / K8s)</summary>

```bash
base64 -w 0 service-account.json   # Linux
base64 -i service-account.json | tr -d '\n'   # macOS
```

```json
{
  "mcpServers": {
    "mcp-gdocs": {
      "command": "npx",
      "args": ["-y", "mcp-gdocs"],
      "env": {
        "CREDENTIALS_CONFIG": "ewogICJ0eXBlIjogInNlcnZpY2VfYWNjb3VudCIs..."
      }
    }
  }
}
```

</details>

<details>
<summary>A3. <code>GOOGLE_APPLICATION_CREDENTIALS</code></summary>

```json
{
  "mcpServers": {
    "mcp-gdocs": {
      "command": "npx",
      "args": ["-y", "mcp-gdocs"],
      "env": {
        "GOOGLE_APPLICATION_CREDENTIALS": "/path/to/service-account.json"
      }
    }
  }
}
```

</details>

### Method B: OAuth 2.0

For personal use with interactive browser login.

<details>
<summary>B1. Setup and authorize</summary>

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create **OAuth client ID** → Desktop app
3. Copy **Client ID** and **Client Secret**
4. OAuth consent screen → add your email as Test User
5. Authorize: `GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..." npx -y mcp-gdocs auth`

```json
{
  "mcpServers": {
    "mcp-gdocs": {
      "command": "npx",
      "args": ["-y", "mcp-gdocs"],
      "env": {
        "GOOGLE_CLIENT_ID": "your-client-id",
        "GOOGLE_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

OAuth refresh tokens are stored in `~/.config/mcp-gdocs/token.json` (respects `XDG_CONFIG_HOME`). To re-authorize, delete the token file and run `auth` again.

</details>

### Multiple Google Accounts

`GOOGLE_MCP_PROFILE` isolates token storage per profile:

```
~/.config/mcp-gdocs/
├── token.json              # default (no profile)
├── work/token.json         # GOOGLE_MCP_PROFILE=work
└── personal/token.json     # GOOGLE_MCP_PROFILE=personal
```

### Environment Variables

<details>
<summary>All supported environment variables</summary>

| Variable | Method | Description |
| --- | --- | --- |
| `SERVICE_ACCOUNT_PATH` | SA | Path to SA JSON key (+ impersonation support) |
| `GOOGLE_IMPERSONATE_USER` | SA | Email for impersonation (optional) |
| `CREDENTIALS_CONFIG` | SA | Base64-encoded SA JSON (Docker/CI) |
| `GOOGLE_APPLICATION_CREDENTIALS` | SA | Path to SA JSON key (standard Google variable) |
| `GOOGLE_CLIENT_ID` | OAuth | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth | OAuth client secret |
| `GOOGLE_MCP_PROFILE` | OAuth | Profile name for isolated token storage |

</details>

---

## Known Limitations

- **SA without Workspace:** Service account without Google Workspace license has Drive quota = 0 and cannot create files. Use OAuth or impersonation.
- **Comment anchoring:** Programmatically created comments may not be anchored to text in Google Docs UI (Drive API limitation).
- **Deeply nested lists:** Lists with 3+ nesting levels may have formatting artifacts when converting Markdown.
- **Paragraph style safe range:** paragraph and heading style tools automatically adjust ranges to prevent styles from bleeding into adjacent paragraphs.

## Troubleshooting

- **Server won't start:** check that environment variables are set in the MCP config `env` block.
- **Authorization errors:** make sure Docs and Drive APIs are enabled in Google Cloud Console. For OAuth — check that your email is added as Test User.
- **Re-authorization:** delete `~/.config/mcp-gdocs/token.json` and run `npx -y mcp-gdocs auth` again.

---

[Changelog](CHANGELOG.md) · [License](LICENSE)

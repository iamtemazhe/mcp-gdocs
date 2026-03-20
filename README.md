# mcp-gdocs

[Русская версия](README.ru.md)

MCP server for **Google Docs**, **Google Drive** and **Comments** with flexible authentication.

Connect Cursor, Claude Desktop, or any MCP client to your Google Docs and Drive.

Start with a single command: `npx -y mcp-gdocs`.

---

## Quick Start

### 1. Google Cloud Setup

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create or select a project
3. Enable **Google Docs API** and **Google Drive API**
4. Choose authentication method:
  - **Service Account** — for automation, CI, servers
  - **OAuth** — for personal documents

> See the **Authentication** section below for details.

### 2a. Service Account — share your documents

Share the documents/folders with the service account email (`client_email` from the JSON key).

### 2b. OAuth — authorize

```bash
GOOGLE_CLIENT_ID="your-client-id" \
GOOGLE_CLIENT_SECRET="your-client-secret" \
npx -y mcp-gdocs auth
```

A browser window will open for Google authorization. The refresh token is saved to `~/.config/mcp-gdocs/token.json`.

### 3. Add to Cursor / MCP Client

**Service Account:**

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

**OAuth:**

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

Most write operations accept an `items` array for bulk execution in a single call.

### Google Docs


| Tool                             | Description                                         |
| -------------------------------- | --------------------------------------------------- |
| `docs_read_document`             | Read content as plain text, JSON, or markdown       |
| `docs_get_document_info`         | Get document metadata (title, ID, revision)         |
| `docs_list_document_tabs`        | List all tabs in a multi-tab document               |
| `docs_insert_text`               | Insert text at one or multiple positions            |
| `docs_append_text`               | Append text to the end                              |
| `docs_delete_range`              | Remove content by one or multiple index ranges      |
| `docs_replace_all_text`          | Replace all occurrences of one or multiple patterns |
| `docs_replace_document_content`  | Replace entire document content                     |
| `docs_insert_page_break`         | Insert one or multiple page breaks                  |
| `docs_apply_text_style`          | Bold, italic, underline, colors, font, links        |
| `docs_apply_paragraph_style`     | Alignment, spacing, indentation                     |
| `docs_apply_heading_style`       | Heading styles (H1–H6)                              |
| `docs_insert_table`              | Create tables                                       |
| `docs_insert_table_row`          | Add row to table                                    |
| `docs_insert_table_column`       | Add column to table                                 |
| `docs_delete_table_row`          | Delete row from table                               |
| `docs_delete_table_column`       | Delete column from table                            |
| `docs_update_table_cell_content` | Update one or multiple cells content                |
| `docs_update_table_cell_style`   | Cell background color                               |
| `docs_insert_image`              | Insert one or multiple images from URL              |
| `docs_replace_with_markdown`     | Replace entire document from Markdown               |
| `docs_append_markdown`           | Append Markdown-formatted content                   |
| `docs_batch_update`              | Batch multiple operations in one API call           |


### Comments


| Tool                    | Description                                      |
| ----------------------- | ------------------------------------------------ |
| `docs_list_comments`    | List all comments with author and date           |
| `docs_get_comment`      | Get a specific comment with replies              |
| `docs_add_comment`      | Create one or multiple comments anchored to text |
| `docs_reply_to_comment` | Reply to one or multiple comments                |
| `docs_resolve_comment`  | Mark one or multiple comments as resolved        |
| `docs_delete_comment`   | Remove one or multiple comments                  |


### Google Drive


| Tool                         | Description                                  |
| ---------------------------- | -------------------------------------------- |
| `drive_list_documents`       | List documents, optionally filtered          |
| `drive_search_documents`     | Full-text search across documents            |
| `drive_create_document`      | Create one or multiple new documents         |
| `drive_create_from_template` | Create one or more documents from a template |
| `drive_create_folder`        | Create one or multiple folders               |
| `drive_list_folder_contents` | List folder contents                         |
| `drive_get_folder_info`      | Get folder metadata                          |
| `drive_move_file`            | Move one or multiple files to another folder |
| `drive_copy_file`            | Duplicate one or multiple files              |
| `drive_rename_file`          | Rename one or multiple files                 |
| `drive_delete_file`          | Move one or multiple files to trash          |


### Batch Operations

`docs_batch_update` combines multiple heterogeneous operations into a single HTTP request to Google Docs API. This helps with the per-minute quota (60 write ops/min) during bulk formatting.

Supported operation types: `updateTextStyle`, `updateParagraphStyle`, `updateHeadingStyle`, `insertText`, `deleteContentRange`, `replaceAllText`, `insertPageBreak`, `insertTable`, `insertInlineImage`, `updateTableCellStyle`.

Arrays of >100 operations are automatically split into chunks.

---

## Authentication

The server supports multiple authentication methods. If several variables are set, the first found is used: OAuth → `SERVICE_ACCOUNT_PATH` → `CREDENTIALS_CONFIG` → `GOOGLE_APPLICATION_CREDENTIALS` → ADC.

### Service Account vs OAuth


| Criteria             | Service Account                     | OAuth                                |
| -------------------- | ----------------------------------- | ------------------------------------ |
| **Document access**  | Only shared with SA                 | All your documents                   |
| **Drive operations** | Only in shared folders              | Full access to your Drive            |
| **Best for**         | CI/CD, servers, automation          | Personal use, Cursor, Claude Desktop |
| **Setup**            | Download JSON key, share documents  | OAuth flow in browser                |
| **Google Workspace** | Impersonation — full access as user | Not needed                           |


> **Enterprise (Google Workspace):** with domain-wide delegation, SA can act on behalf of any domain user via `GOOGLE_IMPERSONATE_USER`.

**Recommendation:** use **OAuth** for personal work in Cursor/Claude Desktop. Use **Service Account** with impersonation for enterprise automation.

### Method A: Service Account

Headless, secure, ideal for server environments.

**Steps:**

1. GCP Console → IAM & Admin → Service Accounts → Create
2. Download JSON key
3. Share documents/folders with SA email (Editor)

**Three ways to provide credentials:**

**A1. `SERVICE_ACCOUNT_PATH` (+ impersonation)**

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

**A2. `CREDENTIALS_CONFIG` — Base64-encoded JSON (Docker / CI / K8s)**

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

**A3. `GOOGLE_APPLICATION_CREDENTIALS`**

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

### Method B: OAuth 2.0

For personal use with interactive browser login.

**Step 1: Create OAuth Client**

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create **OAuth client ID** → Desktop app
3. Copy **Client ID** and **Client Secret**
4. OAuth consent screen → add your email as Test User

**Step 2: Authorize**

```bash
GOOGLE_CLIENT_ID="your-client-id" \
GOOGLE_CLIENT_SECRET="your-client-secret" \
npx -y mcp-gdocs auth
```

**Step 3: MCP configuration**

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

### Method C: Application Default Credentials (ADC)

Ideal for Google Cloud environments (GKE, Compute Engine, Cloud Run) and local development with `gcloud`.

ADC is used automatically as a fallback when no other methods are configured.

**For local development:**

```bash
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/documents,https://www.googleapis.com/auth/drive
```

**For Google Cloud:** attach a service account to the compute resource — no extra variables needed.

### Multiple Google Accounts (Profiles)

`GOOGLE_MCP_PROFILE` isolates token storage per profile:

```json
{
  "mcpServers": {
    "mcp-gdocs-work": {
      "command": "npx",
      "args": ["-y", "mcp-gdocs"],
      "env": {
        "GOOGLE_CLIENT_ID": "...",
        "GOOGLE_CLIENT_SECRET": "...",
        "GOOGLE_MCP_PROFILE": "work"
      }
    },
    "mcp-gdocs-personal": {
      "command": "npx",
      "args": ["-y", "mcp-gdocs"],
      "env": {
        "GOOGLE_CLIENT_ID": "...",
        "GOOGLE_CLIENT_SECRET": "...",
        "GOOGLE_MCP_PROFILE": "personal"
      }
    }
  }
}
```

Tokens are stored separately:

```
~/.config/mcp-gdocs/
├── token.json              # default (no profile)
├── work/token.json         # GOOGLE_MCP_PROFILE=work
└── personal/token.json     # GOOGLE_MCP_PROFILE=personal
```

### Token Storage

OAuth refresh tokens are stored in `~/.config/mcp-gdocs/token.json` (respects `XDG_CONFIG_HOME`). To re-authorize, run `npx -y mcp-gdocs auth` again or delete the token file.

### Environment Variables


| Variable                         | Method | Description                                    |
| -------------------------------- | ------ | ---------------------------------------------- |
| `SERVICE_ACCOUNT_PATH`           | SA     | Path to SA JSON key (+ impersonation support)  |
| `GOOGLE_IMPERSONATE_USER`        | SA     | Email for impersonation (optional)             |
| `CREDENTIALS_CONFIG`             | SA     | Base64-encoded SA JSON (Docker/CI)             |
| `GOOGLE_APPLICATION_CREDENTIALS` | ADC    | Path to SA JSON key (standard Google variable) |
| `GOOGLE_CLIENT_ID`               | OAuth  | OAuth client ID                                |
| `GOOGLE_CLIENT_SECRET`           | OAuth  | OAuth client secret                            |
| `GOOGLE_MCP_PROFILE`             | OAuth  | Profile name for isolated token storage        |


---

## Known Limitations

- **SA without Workspace:** Service account without Google Workspace license has Drive quota = 0 and cannot create files. Use OAuth or impersonation.
- **Comment anchoring:** Programmatically created comments appear in the list but may not be anchored to text in Google Docs UI (Drive API limitation).
- **Deeply nested lists:** Lists with 3+ nesting levels may have formatting artifacts when converting Markdown.
- **Paragraph style safe range:** `docs_apply_paragraph_style` and `docs_apply_heading_style` automatically shift `startIndex` by +1 (when > 1) to prevent styles from bleeding into the preceding paragraph. This matches Google Docs API behavior where structural element boundaries overlap with the previous paragraph's newline.

## Troubleshooting

- **Server won't start:** check that environment variables (`GOOGLE_CLIENT_ID` / `GOOGLE_APPLICATION_CREDENTIALS`) are set in the MCP config `env` block.
- **Authorization errors:** make sure Docs API and Drive API are enabled in Google Cloud Console. For OAuth — check that your email is added as Test User in OAuth consent screen.
- **Re-authorization:** delete `~/.config/mcp-gdocs/token.json` and run `npx -y mcp-gdocs auth` again.

## License

[MIT](LICENSE)
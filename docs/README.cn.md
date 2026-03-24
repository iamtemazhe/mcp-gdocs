# mcp-gdocs

[English](../README.md) | [Русский](README.ru.md)

[为什么选择 mcp-gdocs](WHYIEXIST.cn.md)

面向 **Google 文档**、**Google 云端硬盘** 与 **评论** 的 MCP 服务器，支持多种灵活的身份验证方式。

将 Cursor、Claude Desktop 或任意 MCP 客户端连接到您的 Google 文档与云端硬盘。

一条命令即可开始：`npx -y mcp-gdocs`。

---

## 快速开始

### 1. Google Cloud 配置

1. 打开 [Google Cloud 控制台](https://console.cloud.google.com)
2. 创建或选择一个项目
3. 启用 **Google Docs API** 与 **Google Drive API**
4. 选择身份验证方式：
  - **服务账号** — 适用于自动化、CI、服务器
  - **OAuth** — 适用于个人文档

> 详见下文 **身份验证** 章节。

### 2a. 服务账号 — 共享文档

将文档/文件夹与服务账号邮箱（JSON 密钥中的 `client_email`）共享。

### 2b. OAuth — 授权

```bash
GOOGLE_CLIENT_ID="your-client-id" \
GOOGLE_CLIENT_SECRET="your-client-secret" \
npx -y mcp-gdocs auth
```

浏览器将打开以完成 Google 授权。刷新令牌会保存到 `~/.config/mcp-gdocs/token.json`。

### 3. 添加到 Cursor / MCP 客户端

**服务账号：**

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

**OAuth：**

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

当 MCP 客户端连接时，服务器会自动启动。

---

## 能做什么？

大多数写入操作接受 `items` 数组，可在单次调用中批量执行。所有工具均支持可选参数 `tabId`，用于多标签页文档。

### Google 文档


| 工具                             | 说明                                         |
| -------------------------------- | -------------------------------------------- |
| `docs_read_document`             | 以纯文本、JSON 或 Markdown 读取内容        |
| `docs_get_document_info`         | 获取文档元数据（标题、ID、修订版本）       |
| `docs_list_document_tabs`        | 列出多标签页文档中的所有标签页             |
| `docs_insert_text`               | 在一个或多个位置插入文本                   |
| `docs_append_text`               | 在文档末尾追加文本                         |
| `docs_delete_range`              | 按一个或多个索引范围删除内容               |
| `docs_replace_all_text`          | 替换一个或多个模式的所有匹配项             |
| `docs_replace_document_content`  | 替换整个文档内容                           |
| `docs_insert_page_break`         | 插入一个或多个分页符                       |
| `docs_apply_text_style`          | 粗体、斜体、下划线、颜色、字体、链接       |
| `docs_apply_paragraph_style`     | 对齐、间距、缩进                           |
| `docs_apply_heading_style`       | 标题样式（H1–H6）                          |
| `docs_insert_table`              | 创建表格                                   |
| `docs_insert_table_row`          | 向表格添加行                               |
| `docs_insert_table_column`       | 向表格添加列                               |
| `docs_delete_table_row`          | 从表格删除行                               |
| `docs_delete_table_column`       | 从表格删除列                               |
| `docs_update_table_cell_content` | 更新一个或多个单元格内容                   |
| `docs_update_table_cell_style`   | 单元格背景色                               |
| `docs_insert_image`              | 从 URL 插入一个或多个图片                  |
| `docs_insert_local_image`        | 从本地文件插入图片（上传并插入）           |
| `docs_replace_with_markdown`     | 用 Markdown 替换整篇文档（标题、列表、表格、删除线、水平线） |
| `docs_append_markdown`           | 追加 Markdown 格式内容                     |
| `docs_batch_update`              | 在一次 API 调用中批量执行多种操作          |
| `docs_rename_tab`                | 重命名文档标签页                           |
| `docs_insert_table_with_data`    | 一次调用创建表格并填入数据                 |
| `docs_format_by_text`            | 查找文本并应用格式，无需知道索引           |


### 评论


| 工具                    | 说明                                   |
| ----------------------- | -------------------------------------- |
| `docs_list_comments`    | 列出所有评论（含作者与日期）           |
| `docs_get_comment`      | 获取指定评论及其回复                   |
| `docs_add_comment`      | 创建一条或多条锚定到文本的评论         |
| `docs_reply_to_comment` | 回复一条或多条评论                     |
| `docs_resolve_comment`  | 将一条或多条评论标记为已解决           |
| `docs_delete_comment`   | 删除一条或多条评论                     |


### Google 云端硬盘


| 工具                         | 说明                               |
| ---------------------------- | ---------------------------------- |
| `drive_list_documents`       | 列出文档，可按条件筛选             |
| `drive_search_documents`     | 在文档中进行全文搜索               |
| `drive_create_document`      | 创建一个或多个新文档               |
| `drive_create_from_template` | 从一个模板创建一个或多个文档       |
| `drive_create_folder`        | 创建一个或多个文件夹               |
| `drive_list_folder_contents` | 列出文件夹内容                     |
| `drive_get_folder_info`      | 获取文件夹元数据                   |
| `drive_move_file`            | 将一个或多个文件移动到另一文件夹   |
| `drive_copy_file`            | 复制一个或多个文件                 |
| `drive_rename_file`          | 重命名一个或多个文件               |
| `drive_delete_file`          | 将一个或多个文件移入回收站         |


### 批量操作

`docs_batch_update` 将多种不同类型的操作合并为发往 Google Docs API 的单个 HTTP 请求。在大量格式化时有助于应对每分钟配额（每分钟 60 次写入操作）。

支持的操作类型：`updateTextStyle`、`updateParagraphStyle`、`updateHeadingStyle`、`insertText`、`deleteContentRange`、`replaceAllText`、`insertPageBreak`、`insertTable`、`insertInlineImage`、`updateTableCellStyle`。

超过 500 条操作的数组会自动拆分为多个块。

---

## 身份验证

服务器支持多种身份验证方式。若同时设置了多个变量，按以下优先级使用最先匹配的一项：OAuth → `SERVICE_ACCOUNT_PATH` → `CREDENTIALS_CONFIG` → `GOOGLE_APPLICATION_CREDENTIALS` → ADC。

### 服务账号与 OAuth 对比


| 对比项               | 服务账号                     | OAuth                                |
| -------------------- | ---------------------------- | ------------------------------------ |
| **文档访问**         | 仅已与服务账号共享的文档     | 您的所有文档                         |
| **云端硬盘操作**     | 仅在已共享的文件夹中         | 对您云端硬盘的完整访问               |
| **最适合**           | CI/CD、服务器、自动化        | 个人使用、Cursor、Claude Desktop     |
| **配置**             | 下载 JSON 密钥并共享文档     | 在浏览器中完成 OAuth 流程            |
| **Google Workspace** | 可通过模拟用户获得完整访问   | 不需要                               |


> **企业（Google Workspace）：** 在启用全网域委派后，服务账号可通过 `GOOGLE_IMPERSONATE_USER` 代表网域内任意用户执行操作。

**建议：** 在 Cursor / Claude Desktop 中进行个人工作时使用 **OAuth**。企业自动化场景使用带用户模拟的 **服务账号**。

### 方式 A：服务账号

无界面、安全，适合服务器环境。

**步骤：**

1. GCP 控制台 → IAM 与管理 → 服务账号 → 创建
2. 下载 JSON 密钥
3. 将文档/文件夹与服务账号邮箱共享（编辑者权限）

**提供凭据的三种方式：**

**A1. `SERVICE_ACCOUNT_PATH`（+ 用户模拟）**

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

**A2. `CREDENTIALS_CONFIG` — Base64 编码的 JSON（Docker / CI / K8s）**

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

### 方式 B：OAuth 2.0

适合通过浏览器交互登录的个人使用。

**第 1 步：创建 OAuth 客户端**

1. [Google Cloud 控制台](https://console.cloud.google.com) → API 和服务 → 凭据
2. 创建 **OAuth 客户端 ID** → 桌面应用
3. 复制 **客户端 ID** 与 **客户端密钥**
4. OAuth 同意屏幕 → 将您的邮箱添加为测试用户

**第 2 步：授权**

```bash
GOOGLE_CLIENT_ID="your-client-id" \
GOOGLE_CLIENT_SECRET="your-client-secret" \
npx -y mcp-gdocs auth
```

**第 3 步：MCP 配置**

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

### 方式 C：应用默认凭据（ADC）

适合 Google Cloud 环境（GKE、Compute Engine、Cloud Run）以及使用 `gcloud` 的本地开发。

在未配置其他方式时，会自动回退使用 ADC。

**本地开发：**

```bash
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/documents,https://www.googleapis.com/auth/drive
```

**在 Google Cloud 上：** 将服务账号附加到计算资源即可，无需额外环境变量。

### 多个 Google 账号（配置文件）

`GOOGLE_MCP_PROFILE` 按配置文件隔离令牌存储：

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

令牌分别存储在：

```
~/.config/mcp-gdocs/
├── token.json              # 默认（无配置文件）
├── work/token.json         # GOOGLE_MCP_PROFILE=work
└── personal/token.json     # GOOGLE_MCP_PROFILE=personal
```

### 令牌存储

OAuth 刷新令牌保存在 `~/.config/mcp-gdocs/token.json`（遵循 `XDG_CONFIG_HOME`）。若要重新授权，请再次运行 `npx -y mcp-gdocs auth`，或删除令牌文件。

### 环境变量


| 变量                             | 方式   | 说明                                           |
| -------------------------------- | ------ | ---------------------------------------------- |
| `SERVICE_ACCOUNT_PATH`           | SA     | 服务账号 JSON 密钥路径（支持用户模拟）         |
| `GOOGLE_IMPERSONATE_USER`        | SA     | 要模拟的用户邮箱（可选）                       |
| `CREDENTIALS_CONFIG`             | SA     | Base64 编码的服务账号 JSON（Docker/CI）        |
| `GOOGLE_APPLICATION_CREDENTIALS` | ADC    | 服务账号 JSON 密钥路径（Google 标准变量）    |
| `GOOGLE_CLIENT_ID`               | OAuth  | OAuth 客户端 ID                                |
| `GOOGLE_CLIENT_SECRET`           | OAuth  | OAuth 客户端密钥                               |
| `GOOGLE_MCP_PROFILE`             | OAuth  | 用于隔离令牌存储的配置文件名称                 |


---

## 已知限制

- **无 Workspace 的服务账号：** 未购买 Google Workspace 许可的服务账号云端硬盘配额为 0，无法创建文件。请使用 OAuth 或用户模拟。
- **评论锚定：** 通过程序创建的评论会出现在列表中，但在 Google 文档界面中可能无法锚定到文本（Drive API 限制）。
- **深层嵌套列表：** 嵌套 3 层及以上的列表在转换为 Markdown 时可能出现格式异常。
- **段落样式安全范围：** `docs_apply_paragraph_style` 与 `docs_apply_heading_style` 会在 `startIndex` 大于 1 时自动将其 +1 偏移，避免样式渗入上一段。这与 Google Docs API 中结构元素边界与上一段换行重叠的行为一致。

## 故障排除

- **服务器无法启动：** 检查 MCP 配置的 `env` 中是否已设置环境变量（`GOOGLE_CLIENT_ID` / `GOOGLE_APPLICATION_CREDENTIALS`）。
- **授权错误：** 确认已在 Google Cloud 控制台启用 Docs API 与 Drive API。若使用 OAuth，请确认您的邮箱已添加到 OAuth 同意屏幕的测试用户列表。
- **重新授权：** 删除 `~/.config/mcp-gdocs/token.json` 后再次运行 `npx -y mcp-gdocs auth`。

---

[更新日志](../CHANGELOG.md)

[许可协议](../LICENSE)

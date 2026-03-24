# mcp-gdocs

[English](../README.md) | [Русский](README.ru.md)

[为什么选择 mcp-gdocs](WHYIEXIST.cn.md)

面向 **Google 文档**、**Google 云端硬盘** 与 **评论** 的 MCP 服务器，提供读写、批量操作与格式化等能力，并支持多种灵活的身份验证方式。

将 Cursor、Claude Desktop 或任意 MCP 客户端连接到您的 Google 文档与云端硬盘。

一条命令即可开始：`npx -y mcp-gdocs`。

---

## 快速开始

### 1. Google Cloud 配置

1. 打开 [Google Cloud 控制台](https://console.cloud.google.com)
2. 创建或选择一个项目
3. 启用 **Google Docs API** 与 **Google Drive API**
4. 选择身份验证方式（见下文 [身份验证](#身份验证)）

### 2. 添加到 Cursor / MCP 客户端

**服务账号** — 将文档与服务账号邮箱共享后：

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

**OAuth** — 请先运行 `npx -y mcp-gdocs auth`，然后：

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

<details>
<summary>读取、写入、格式、表格、图片、原生 Markdown、批量、标签页、命名范围</summary>

| 工具 | 说明 |
| --- | --- |
| `docs_read_document` | 以文本、JSON、Markdown 或 **摘要** 读取；可选 **`fields`** 掩码 |
| `docs_get_document_info` | 文档元数据（标题、ID、修订版本） |
| `docs_list_document_tabs` | 列出多标签页文档中的所有标签页 |
| `docs_insert_text` | 在一个或多个位置插入文本 |
| `docs_append_text` | 在文档末尾追加文本 |
| `docs_delete_range` | 按索引范围删除内容 |
| `docs_replace_all_text` | 替换模式中所有匹配项 |
| `docs_replace_document_content` | 替换整篇文档内容 |
| `docs_insert_page_break` | 插入分页符 |
| `docs_rename_tab` | 重命名文档标签页 |
| `docs_update_header` | 更新页眉内容 |
| `docs_update_footer` | 更新页脚内容 |
| `docs_create_footnote` | 在指定位置创建脚注 |
| `docs_add_tab` | 添加新的文档标签页 |
| `docs_apply_text_style` | 粗体、斜体、下划线、颜色、字体、链接 |
| `docs_apply_paragraph_style` | 对齐、间距、缩进 |
| `docs_apply_heading_style` | 标题样式（H1–H6） |
| `docs_format_by_text` | 查找文本并应用格式，无需知道索引 |
| `docs_insert_table_row` | 向表格添加行 |
| `docs_insert_table_column` | 向表格添加列 |
| `docs_delete_table_row` | 从表格删除行 |
| `docs_delete_table_column` | 从表格删除列 |
| `docs_update_table_cell_content` | 更新单元格内容 |
| `docs_update_table_cell_style` | 单元格背景色 |
| `docs_insert_table_with_data` | 创建表格并预填数据 |
| `docs_insert_image` | 从 URL 插入图片 |
| `docs_insert_local_image` | 从本地文件插入图片（上传并插入） |
| `docs_replace_with_markdown_native` | 用 Markdown 替换（Google 原生转换） |
| `docs_replace_with_markdown_file_native` | 用 Markdown 文件替换（原生转换） |
| `docs_batch_update` | 在一次 API 调用中批量执行多种操作（**30** 种请求类型） |
| `docs_create_named_range` | 创建命名范围 |
| `docs_delete_named_range` | 删除命名范围 |
| `docs_replace_named_range_content` | 替换命名范围内的文本 |

</details>

### 评论

<details>
<summary>列出、获取、添加、回复、解决、删除</summary>

| 工具 | 说明 |
| --- | --- |
| `docs_list_comments` | 列出所有评论（含作者与日期） |
| `docs_get_comment` | 获取指定评论及其回复 |
| `docs_add_comment` | 创建锚定到文本的评论 |
| `docs_reply_to_comment` | 回复评论 |
| `docs_resolve_comment` | 将评论标记为已解决 |
| `docs_delete_comment` | 删除评论 |

</details>

### Google 云端硬盘

<details>
<summary>文件、文件夹、权限、导出、修订版本、共享云端硬盘</summary>

| 工具 | 说明 |
| --- | --- |
| `drive_list_documents` | 列出文档，可按条件筛选 |
| `drive_search_documents` | 在文档中进行全文搜索 |
| `drive_create_document` | 创建新文档 |
| `drive_create_from_template` | 从模板创建文档 |
| `drive_create_from_markdown` | 由行内 Markdown 创建新文档 |
| `drive_create_from_markdown_file` | 由本地 `.md` 文件创建新文档 |
| `drive_create_folder` | 创建文件夹 |
| `drive_list_folder_contents` | 列出文件夹内容 |
| `drive_get_folder_info` | 获取文件夹元数据 |
| `drive_move_file` | 将文件移动到另一文件夹 |
| `drive_copy_file` | 复制文件 |
| `drive_rename_file` | 重命名文件 |
| `drive_delete_file` | 将文件移入回收站 |
| `docs_export_pdf` | 导出为 PDF（可选 `savePath`） |
| `drive_export_file` | 导出为 Markdown、PDF、DOCX 及其他 MIME 类型 |
| `drive_share_file` | 共享文件（用户、群组、网域、任何人） |
| `drive_list_permissions` | 列出文件的 ACL |
| `drive_update_permission` | 修改已有权限的角色 |
| `drive_remove_permission` | 撤销权限 |
| `drive_list_revisions` | 列出修订历史 |
| `drive_get_revision` | 获取某一修订的元数据或内容 |
| `drive_list_shared_drives` | 列出共享云端硬盘（团队盘） |

</details>

### 提示（Prompts）

<details>
<summary>面向常见任务的工作流提示模板</summary>

| 提示 | 说明 |
| --- | --- |
| `pretty-format` | 从 Markdown 创建或重排文档；清理规则、间距、表格等 |
| `gost-format` | 符合 GOST 19.106-78 的文档结构与样式 |
| `template-fill` | 使用占位符 / 命名范围填充模板 |
| `export-to-markdown` | 通过 Drive API 将 Google 文档导出为 Markdown |
| `format-table` | 固定表头、列宽与文档中表格的单元格样式 |
| `share-document` | 列出权限后向用户共享 |

</details>

### 资源（Resources）

| URI | 说明 |
| --- | --- |
| `gdocs://documents/recent` | 最近修改过的 Google 文档的 JSON 列表 |

### 批量操作

`docs_batch_update` 将多种不同类型的操作合并为单次 API 请求（**30** 种请求类型）。大型数组会自动分块。速率限制通过共享的 API 信号量控制。

---

## 身份验证

服务器支持多种身份验证方式。若同时设置了多个变量，按以下优先级使用最先匹配的一项：**OAuth** → `SERVICE_ACCOUNT_PATH` → `CREDENTIALS_CONFIG` → `GOOGLE_APPLICATION_CREDENTIALS`。

| 对比项 | 服务账号 | OAuth |
| --- | --- | --- |
| **文档访问** | 仅已与服务账号共享的文档 | 您的所有文档 |
| **云端硬盘操作** | 仅在已共享的文件夹中 | 对您云端硬盘的完整访问 |
| **最适合** | CI/CD、服务器、自动化 | 个人使用、Cursor、Claude Desktop |
| **配置** | 下载 JSON 密钥并共享文档 | 在浏览器中完成 OAuth 流程 |
| **Google Workspace** | 可通过模拟用户获得完整访问 | 不需要 |

> **企业（Google Workspace）：** 在启用全网域委派后，服务账号可通过 `GOOGLE_IMPERSONATE_USER` 代表网域内任意用户执行操作。

**建议：** 在 Cursor / Claude Desktop 中进行个人工作时使用 **OAuth**。企业自动化场景使用带用户模拟的 **服务账号**。

### 方式 A：服务账号

无界面、安全，适合服务器环境。

**步骤：**

1. GCP 控制台 → IAM 与管理 → 服务账号 → 创建
2. 下载 JSON 密钥
3. 将文档/文件夹与服务账号邮箱共享（编辑者权限）

**提供凭据的三种方式：**

<details>
<summary>A1. <code>SERVICE_ACCOUNT_PATH</code>（+ 用户模拟）</summary>

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
<summary>A2. <code>CREDENTIALS_CONFIG</code> — Base64 编码的 JSON（Docker / CI / K8s）</summary>

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

### 方式 B：OAuth 2.0

适合通过浏览器交互登录的个人使用。

<details>
<summary>B1. 配置与授权</summary>

1. [Google Cloud 控制台](https://console.cloud.google.com) → API 和服务 → 凭据
2. 创建 **OAuth 客户端 ID** → 桌面应用
3. 复制 **客户端 ID** 与 **客户端密钥**
4. OAuth 同意屏幕 → 将您的邮箱添加为测试用户
5. 授权：`GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..." npx -y mcp-gdocs auth`

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

OAuth 刷新令牌保存在 `~/.config/mcp-gdocs/token.json`（遵循 `XDG_CONFIG_HOME`）。若要重新授权，请删除令牌文件并再次运行 `auth`。

</details>

### 多个 Google 账号

`GOOGLE_MCP_PROFILE` 按配置文件隔离令牌存储：

```
~/.config/mcp-gdocs/
├── token.json              # 默认（无配置文件）
├── work/token.json         # GOOGLE_MCP_PROFILE=work
└── personal/token.json     # GOOGLE_MCP_PROFILE=personal
```

### 环境变量

<details>
<summary>所有支持的环境变量</summary>

| 变量 | 方式 | 说明 |
| --- | --- | --- |
| `SERVICE_ACCOUNT_PATH` | SA | 服务账号 JSON 密钥路径（支持用户模拟） |
| `GOOGLE_IMPERSONATE_USER` | SA | 要模拟的用户邮箱（可选） |
| `CREDENTIALS_CONFIG` | SA | Base64 编码的服务账号 JSON（Docker/CI） |
| `GOOGLE_APPLICATION_CREDENTIALS` | SA | 服务账号 JSON 密钥路径（Google 标准变量） |
| `GOOGLE_CLIENT_ID` | OAuth | OAuth 客户端 ID |
| `GOOGLE_CLIENT_SECRET` | OAuth | OAuth 客户端密钥 |
| `GOOGLE_MCP_PROFILE` | OAuth | 用于隔离令牌存储的配置文件名称 |

</details>

---

## 已知限制

- **无 Workspace 的服务账号：** 未购买 Google Workspace 许可的服务账号云端硬盘配额为 0，无法创建文件。请使用 OAuth 或用户模拟。
- **评论锚定：** 通过程序创建的评论在 Google 文档界面中可能无法锚定到文本（Drive API 限制）。
- **深层嵌套列表：** 嵌套 3 层及以上的列表在转换为 Markdown 时可能出现格式异常。
- **段落样式安全范围：** 段落与标题样式工具会自动调整范围，避免样式蔓延到相邻段落。

## 故障排除

- **服务器无法启动：** 检查 MCP 配置的 `env` 中是否已正确设置环境变量。
- **授权错误：** 确认已在 Google Cloud 控制台启用 Docs API 与 Drive API。若使用 OAuth，请确认您的邮箱已添加到测试用户。
- **重新授权：** 删除 `~/.config/mcp-gdocs/token.json` 后再次运行 `npx -y mcp-gdocs auth`。

---

[更新日志](../CHANGELOG.md) · [许可协议](../LICENSE)

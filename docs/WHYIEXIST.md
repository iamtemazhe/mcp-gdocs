# Why mcp-gdocs exists

## Problem

Google Docs API is powerful but complex. Existing solutions (MCP servers for Google Docs) either:

- Cover only basic operations (read/write) without formatting, tables, or comments
- Lack batch capabilities, forcing AI to make dozens of sequential calls
- Don't handle index conflicts when mixing inserts with formatting
- Require manual index calculation for every formatting operation
- Bundle Docs + Slides into one oversized server

## What mcp-gdocs gives you

### 1. Complete document control in one server

63 tools covering Google Docs, Drive, and comments, with multi-tab support for Docs. MCP **resources** expose recent documents (`gdocs://documents/recent`); **prompts** ship workflows such as pretty-format, gost-format, template-fill, and export-to-markdown:

**Reading**
- Read document content in text, JSON, or Markdown format
- Get document metadata (title, revision, locale)
- List document tabs
- Truncate large documents to save context
- Lightweight reads that fetch only needed data

**Writing**
- Insert, append, delete, and replace text
- Replace entire document content
- Find and replace across the document
- Insert page breaks
- Rename document tabs
- Update header and footer text (`docs_update_header`, `docs_update_footer`)
- Export document to PDF via shareable URL (`docs_export_pdf`)

**Formatting**
- Apply text styles (bold, italic, underline, strikethrough, font, size, color)
- Apply paragraph styles (alignment, spacing, indents, page break before)
- Apply heading styles (H1–H6, normal text)
- Format text by search — find text and apply style without knowing positions

**Tables**
- Create tables, add/delete rows and columns
- Update cell content and cell background styles
- Insert table with data — create and fill in one call

**Images**
- Insert images from URL
- Insert images from local files (automatic upload and insertion)

**Markdown**
- Replace document content from Markdown (headings, lists, tables, bold/italic, strikethrough, links, code blocks, blockquotes, horizontal rules, images)
- Append Markdown to end of document
- Preserve document title during replacement
- Set document title from first heading

**Batch operations**
- Combine multiple operations of different types in a single request
- Automatic chunking for large operation sets

**Comments**
- List, read, create, reply, resolve, and delete comments

**Google Drive**
- List, search, create, copy, rename, move, and delete documents and folders
- Create documents from templates
- View folder contents and metadata
- Verbosity control for Drive responses
- Shared Drives: `supportsAllDrives` and `includeItemsFromAllDrives` on Drive list/search operations

### 2. Batch operations everywhere

All write, format, comment, and drive tools accept multiple items per call where applicable. One tool call can perform dozens of operations — formatting 50 headings, inserting 20 text blocks, or creating 10 Drive files in a single request.

Other implementations for Google Docs rarely support multi-item operations.

### 3. Format by text, not positions

Find text in the document and apply formatting directly — no need to read the document structure and calculate positions first. Reduces a 3-step workflow (read → find position → format) to 1 step.

### 4. Markdown to Google Docs — complete

Full Markdown conversion: headings, lists, tables, bold/italic, strikethrough, links, code blocks, blockquotes, horizontal rules, and images. Phased execution ensures inserts complete before formatting, preventing position conflicts.

Many existing solutions explicitly state that Markdown tables and images are "not yet supported".

### 5. Local image insertion

Read an image from disk, upload it to Drive, set permissions, and insert into the document — all in one call.

### 6. Safe paragraph styling

Automatic position adjustment prevents the common Google Docs API issue where paragraph styles bleed into adjacent paragraphs.

### 7. Four authentication methods

OAuth, Service Account (file path, JWT, impersonation), and Base64 credentials (for Docker/CI). Multi-profile support for isolated token management. Other implementations typically support only two authentication methods.

### 8. Reliability

- Automatic retries with exponential backoff for rate limits and server errors
- Optional concurrency cap via semaphore (`GDOCS_MAX_CONCURRENT`) to limit parallel API calls
- Global and per-read response truncation to save context
- Lightweight API requests that fetch only needed data
- Structured logging with configurable levels
- Actionable error messages with hints on how to fix the issue

## Strengths

| Advantage | Details |
|---|---|
| Multi-item operations | All tools accept arrays for bulk execution |
| Unified batch API | 10 Docs operation types in one call |
| MCP resources & prompts | Recent docs; reusable prompt workflows |
| Shared Drives | Drive tools honor team/shared drive content where applicable |
| Headers, footers, PDF | Document header/footer text; Docs PDF export URL |
| Concurrency control | Optional `GDOCS_MAX_CONCURRENT` semaphore |
| Markdown tables and images | Full conversion including tables and images |
| Phased request execution | Inserts before formatting — prevents position conflicts |
| Heading styles | Dedicated H1–H6 tool |
| Table cell styles | Background color per cell |
| Safe paragraph styling | Automatic position adjustment |
| Local image insertion | Upload + insert in one call |
| 4 auth methods | OAuth, SA (JWT + impersonation), Base64 |
| Retry on API errors | Automatic retries for rate limits and server errors |
| Response control | Global truncation + per-read limit + Drive verbosity |
| Structured logging | Configurable log levels for debugging |

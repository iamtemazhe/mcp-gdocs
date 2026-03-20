# Changelog

## [1.1.1] - 2026-03-20

### Added
- Tab support — all tools can target specific document tabs via `tabId`
- Strikethrough and horizontal rule in Markdown parser
- Phased request execution — inserts run before formatting to prevent index conflicts
- Crash protection for unhandled errors
- CI/CD: GitHub Actions for build checks and npm publish
- Unit tests for all utility modules

### Changed
- Faster API calls — only required fields are fetched for metadata, tables, and end-index lookups
- Docs and Drive service instances are cached across tool calls
- Improved tool descriptions with references to related tools
- Hex color validation with clear error messages
- OAuth is now the highest-priority auth method

### Fixed
- Paragraph/heading styles no longer bleed into adjacent paragraphs

## [1.1.0] - 2026-03-16

### Added
- Paragraph/heading styles no longer bleed into adjacent paragraphs
- CI/CD: GitHub Actions for build checks and npm publish on tag
- Crash protection for unhandled errors

### Changed
- OAuth is now the highest-priority auth method (before Service Account and ADC)

### Fixed
- Applying paragraph or heading style no longer affects the preceding paragraph

## [1.0.0] - 2026-03-15

### Initial Release — 39 tools

### Features
- **Docs Read (3):** read document (text/json/markdown), get info, list tabs
- **Docs Write (6):** insert, append, delete, replace all, replace content, page break
- **Docs Format (3):** text style, paragraph style, heading style
- **Docs Tables (7):** insert table, insert/delete row/column, update cell content/style
- **Docs Media (1):** insert image
- **Docs Markdown (2):** replace with markdown, append markdown
- **Docs Batch (1):** multiple operations in one API call
- **Comments (6):** list, get, add, reply, resolve, delete
- **Drive (11):** list, search, create, template, folder ops, move, copy, rename, delete

### Bulk Operations
- All write/format tools support `items` array for batch execution
- Automatic chunking for large batches (>100 requests)

### Authentication
- OAuth 2.0, Service Account, CREDENTIALS_CONFIG (Base64), ADC
- Impersonation support for Google Workspace
- Profile isolation via `GOOGLE_MCP_PROFILE`

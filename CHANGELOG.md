# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Planned

- Google Sheets support (values, formatting, charts, validation, protection, batch operations)

## [1.3.0] - 2026-03-22

### Added

- Cached `tools/list` response to avoid repeated JSON Schema conversion on every poll
- Full Docs API audit: 30 batch request types covering all document operations
- Full Drive API audit: permissions, export, revisions, shared drives
- 6 workflow prompts and 1 MCP resource
- `docs_update_header` and `docs_update_footer` for header/footer text management
- `pretty-format` and `gost-format` MCP prompts for post-import document formatting

### Changed

- **BREAKING**: Legacy Markdown tools removed (use native Google conversion via Drive API)
- Improved tool descriptions for LLM clarity and token efficiency
- Fixed header/footer segment indexing (0-based for insert/delete operations)

### Removed

- Docs simple wrapper tools (use `docs_batch_update`)
- Legacy custom Markdown parser and `marked` dependency

## [1.2.0] - 2026-03-21

### Added

- Format by text: find text and apply styles without knowing indices
- Table with data: create a table pre-filled with headers and rows
- Rename tab: rename document tabs
- Markdown images in markdown-to-document conversion

### Fixed

- Tab renaming works correctly
- Paragraph and heading styles no longer bleed into adjacent paragraphs
- Strict `z.enum()` for alignment, wrap, numberFormat, border styles
- Validation: borders require at least one side, `endIndex > startIndex`

### Changed

- Better guidance on where to find required IDs and allowed values
- Optional style fields clearly indicate they can be omitted
- Replace tools differentiate find-replace, full-body replace, and markdown replace

## [1.1.2] - 2026-03-21

### Changed

- Faster API calls with reduced data transfer per request
- Improved tool descriptions with references to related tools

## [1.1.1] - 2026-03-20

### Added

- Tab support for all tools (`tabId` parameter)
- Strikethrough and horizontal rule in Markdown conversion

### Fixed

- Paragraph and heading styles no longer affect adjacent paragraphs

### Changed

- OAuth is now the highest-priority auth method

## [1.1.0] - 2026-03-16

### Added

- Paragraph and heading style isolation

### Fixed

- Applying paragraph or heading style no longer affects the preceding paragraph

### Changed

- OAuth is now the highest-priority auth method

## [1.0.0] - 2026-03-15

### Added

- Google Docs: read (text/json/markdown), write, format, tables, images, markdown, batch, comments
- Google Drive: list, search, create, template, folder ops, move, copy, rename, delete, PDF export
- Bulk execution support for all write/format tools
- OAuth 2.0 and Service Account authentication (file path, JWT, Base64)
- Profile isolation for multiple Google accounts

[Unreleased]: https://github.com/iamtemazhe/mcp-gdocs/compare/v1.3.0...HEAD
[1.3.0]: https://github.com/iamtemazhe/mcp-gdocs/compare/v1.2.0...v1.3.0
[1.2.0]: https://github.com/iamtemazhe/mcp-gdocs/compare/v1.1.2...v1.2.0
[1.1.2]: https://github.com/iamtemazhe/mcp-gdocs/compare/v1.1.1...v1.1.2
[1.1.1]: https://github.com/iamtemazhe/mcp-gdocs/compare/v1.1.0...v1.1.1
[1.1.0]: https://github.com/iamtemazhe/mcp-gdocs/compare/v1.0.0...v1.1.0
[1.0.0]: https://github.com/iamtemazhe/mcp-gdocs/releases/tag/v1.0.0

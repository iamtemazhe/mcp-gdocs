# Changelog

## [1.2.0] - 2026-03-21

### Added
- **Format by text:** find text in the document and apply styles without knowing indices
- **Table with data:** create a table pre-filled with headers and rows in one call
- **Rename tab:** rename document tabs
- Markdown images are now supported in markdown-to-document conversion

### Fixed
- Tab renaming now works correctly
- Paragraph and heading styles no longer bleed into adjacent paragraphs

### Changed
- Tool descriptions now guide the AI on where to find required IDs and allowed values
- Optional style fields clearly indicate they can be omitted
- Replace tools clearly differentiate find-replace, full-body replace, and markdown replace
- 44 tools total (was 39 in 1.0.0)

## [1.1.2] - 2026-03-21

### Changed
- Faster API calls — only required fields are fetched
- Improved tool descriptions with references to related tools

## [1.1.1] - 2026-03-20

### Added
- Tab support — all tools can target specific document tabs
- Strikethrough and horizontal rule in Markdown conversion
- Formatting and insertions no longer conflict when run together

### Fixed
- Paragraph and heading styles no longer affect adjacent paragraphs

### Changed
- OAuth is now the highest-priority auth method

## [1.1.0] - 2026-03-16

### Added
- Paragraph and heading style isolation

### Changed
- OAuth is now the highest-priority auth method

### Fixed
- Applying paragraph or heading style no longer affects the preceding paragraph

## [1.0.0] - 2026-03-15

### Initial Release — 39 tools

- **Docs Read:** read document (text/json/markdown), get info, list tabs
- **Docs Write:** insert, append, delete, replace, page break
- **Docs Format:** text style, paragraph style, heading style
- **Docs Tables:** insert table, insert/delete row/column, update cell content/style
- **Docs Media:** insert image
- **Docs Markdown:** replace with markdown, append markdown
- **Docs Batch:** multiple operations in one API call
- **Comments:** list, get, add, reply, resolve, delete
- **Drive:** list, search, create, template, folder ops, move, copy, rename, delete
- All write/format tools support bulk execution
- OAuth 2.0, Service Account, and Application Default Credentials
- Profile isolation for multiple Google accounts

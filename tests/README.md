# Тесты mcp-gdocs

## Подготовка

1. Создайте пустой Google Doc для тестов
2. Share → `work-kts@work-487307.iam.gserviceaccount.com` (Editor)
3. Скопируйте ID документа из URL и пропишите в `tests/.env`:

```
TEST_DOC_ID="<id>"
```

> **Внимание:** тесты **перезаписывают** содержимое документа. Используйте только специально созданный тестовый документ!

Для тестов Drive (создание папок/файлов) также укажите `TEST_PARENT_FOLDER_ID`.

## Запуск

```bash
# Все тесты
npm test

# Отдельные модули
npm run test:docs
npm run test:tables
npm run test:markdown
npm run test:images
npm run test:comments
npm run test:drive
```

## Структура

| Файл | Что тестирует |
|------|---------------|
| `harness.sh` | Общий harness: MCP-вызовы, assertions, helpers |
| `run-all.sh` | Запуск всех/выбранных модулей |
| `test-docs.sh` | Чтение, запись, форматирование документа |
| `test-tables.sh` | Создание таблиц, ячейки, строки, столбцы |
| `test-markdown.sh` | Markdown → Google Docs, append markdown |
| `test-images.sh` | Вставка изображений |
| `test-comments.sh` | Комментарии: CRUD, reply, resolve |
| `test-drive.sh` | Drive: папки, документы, копирование, перемещение |

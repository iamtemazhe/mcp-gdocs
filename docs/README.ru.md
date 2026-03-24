# mcp-gdocs

[English](../README.md) | [中文](README.cn.md)

[Почему mcp-gdocs существует](WHYIEXIST.ru.md)

MCP-сервер для **Google Docs**, **Google Drive** и **Комментариев** с гибкой аутентификацией.

Подключите Cursor, Claude Desktop или любой MCP-клиент к вашим Google Docs и Drive.

Запуск одной командой: `npx -y mcp-gdocs`.

---

## Быстрый старт

### 1. Настройка Google Cloud

1. Откройте [Google Cloud Console](https://console.cloud.google.com)
2. Создайте или выберите проект
3. Включите **Google Docs API** и **Google Drive API**
4. Выберите способ аутентификации (см. [Аутентификация](#аутентификация) ниже)

### 2. Добавьте в Cursor / MCP-клиент

**Service Account** — расшарьте документы с email SA, затем:

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

**OAuth** — сначала `npx -y mcp-gdocs auth`, затем:

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

Сервер запускается автоматически, когда MCP-клиент к нему обращается.

---

## Возможности

Большинство операций записи принимают массив `items` для выполнения нескольких действий за один вызов. Все инструменты поддерживают опциональный параметр `tabId` для работы с многовкладочными документами.

### Google Docs

<details>
<summary>Чтение, запись, форматирование, таблицы, изображения, нативный Markdown, batch, вкладки, именованные диапазоны</summary>

| Инструмент | Описание |
| --- | --- |
| `docs_read_document` | Чтение как текст, JSON, markdown или **summary**; опциональная маска **`fields`** |
| `docs_get_document_info` | Метаданные документа (название, ID, ревизия) |
| `docs_list_document_tabs` | Список вкладок в многовкладочном документе |
| `docs_insert_text` | Вставка текста в одну или несколько позиций |
| `docs_append_text` | Добавление текста в конец |
| `docs_delete_range` | Удаление по диапазонам индексов |
| `docs_replace_all_text` | Замена всех вхождений паттернов |
| `docs_replace_document_content` | Замена всего содержимого документа |
| `docs_insert_page_break` | Вставка разрывов страниц |
| `docs_rename_tab` | Переименование вкладки документа |
| `docs_update_header` | Обновление содержимого колонтитула |
| `docs_update_footer` | Обновление содержимого нижнего колонтитула |
| `docs_create_footnote` | Создание сносок |
| `docs_add_tab` | Добавление новой вкладки |
| `docs_apply_text_style` | Жирный, курсив, подчёркивание, цвета, шрифт, ссылки |
| `docs_apply_paragraph_style` | Выравнивание, интервалы, отступы |
| `docs_apply_heading_style` | Стили заголовков (H1–H6) |
| `docs_format_by_text` | Поиск текста и применение форматирования без знания индексов |
| `docs_insert_table_row` | Добавление строки в таблицу |
| `docs_insert_table_column` | Добавление столбца в таблицу |
| `docs_delete_table_row` | Удаление строки из таблицы |
| `docs_delete_table_column` | Удаление столбца из таблицы |
| `docs_update_table_cell_content` | Обновление содержимого ячеек |
| `docs_update_table_cell_style` | Цвет фона ячеек |
| `docs_insert_table_with_data` | Создание таблицы с данными за один вызов |
| `docs_insert_image` | Вставка изображений по URL |
| `docs_insert_local_image` | Вставка изображений из локальных файлов (загрузка + вставка) |
| `docs_replace_with_markdown_native` | Замена из Markdown (нативная конвертация Google) |
| `docs_replace_with_markdown_file_native` | Замена из Markdown-файла (нативная конвертация) |
| `docs_batch_update` | Пакетное выполнение операций за один API-вызов (30 типов запросов) |
| `docs_create_named_range` | Создание именованного диапазона |
| `docs_delete_named_range` | Удаление именованного диапазона |
| `docs_replace_named_range_content` | Замена текста внутри именованного диапазона |

</details>

### Комментарии

<details>
<summary>Список, получение, создание, ответ, закрытие, удаление</summary>

| Инструмент | Описание |
| --- | --- |
| `docs_list_comments` | Список всех комментариев с автором и датой |
| `docs_get_comment` | Получение комментария с ответами |
| `docs_add_comment` | Создание комментариев с привязкой к тексту |
| `docs_reply_to_comment` | Ответ на комментарии |
| `docs_resolve_comment` | Закрытие комментариев |
| `docs_delete_comment` | Удаление комментариев |

</details>

### Google Drive

<details>
<summary>Файлы, папки, права доступа, экспорт, ревизии, общие диски</summary>

| Инструмент | Описание |
| --- | --- |
| `drive_list_documents` | Список документов с фильтрацией |
| `drive_search_documents` | Полнотекстовый поиск по документам |
| `drive_create_document` | Создание новых документов |
| `drive_create_from_template` | Создание документов из шаблона |
| `drive_create_from_markdown` | Создание документа из Markdown |
| `drive_create_from_markdown_file` | Создание документа из `.md`-файла |
| `drive_create_folder` | Создание папок |
| `drive_list_folder_contents` | Содержимое папки |
| `drive_get_folder_info` | Метаданные папки |
| `drive_move_file` | Перемещение файлов в другую папку |
| `drive_copy_file` | Копирование файлов |
| `drive_rename_file` | Переименование файлов |
| `drive_delete_file` | Удаление файлов в корзину |
| `docs_export_pdf` | Экспорт документа в PDF (опциональный `savePath`) |
| `drive_export_file` | Экспорт в markdown, PDF, DOCX и другие форматы |
| `drive_share_file` | Предоставление доступа (пользователь, группа, домен, все) |
| `drive_list_permissions` | Список прав доступа к файлу |
| `drive_update_permission` | Изменение роли в существующем разрешении |
| `drive_remove_permission` | Отзыв разрешения |
| `drive_list_revisions` | История ревизий файла |
| `drive_get_revision` | Метаданные или содержимое ревизии |
| `drive_list_shared_drives` | Список общих дисков (Team Drives) |

</details>

### Промпты

<details>
<summary>Шаблоны workflow-промптов для типовых задач</summary>

| Промпт | Описание |
| --- | --- |
| `pretty-format` | Создание или переформатирование документа из Markdown; очистка артефактов |
| `gost-format` | Структура и стили документа по ГОСТ 19.106-78 |
| `template-fill` | Заполнение шаблона через плейсхолдеры / именованные диапазоны |
| `export-to-markdown` | Экспорт Google Doc в Markdown через Drive API |
| `format-table` | Закрепление заголовков, ширины столбцов, стили ячеек таблицы |
| `share-document` | Просмотр прав доступа и предоставление доступа |

</details>

### Ресурсы

| URI | Описание |
| --- | --- |
| `gdocs://documents/recent` | JSON-список недавно изменённых Google Docs |

### Пакетные операции

`docs_batch_update` объединяет несколько разнородных операций в один API-запрос (**30** типов запросов). Большие массивы автоматически разбиваются на части. Ограничение частоты запросов через общий API-семафор.

---

## Аутентификация

Сервер поддерживает несколько способов аутентификации. Если задано несколько переменных одновременно, используется первая найденная: **OAuth** → `SERVICE_ACCOUNT_PATH` → `CREDENTIALS_CONFIG` → `GOOGLE_APPLICATION_CREDENTIALS`.

| Критерий | Service Account | OAuth |
| --- | --- | --- |
| **Доступ к документам** | Только расшаренные с SA | Все ваши документы |
| **Операции с Drive** | Только в расшаренных папках | Полный доступ к вашему Drive |
| **Подходит для** | CI/CD, серверы, автоматизация | Личная работа, Cursor, Claude Desktop |
| **Настройка** | Скачать JSON-ключ, расшарить документы | OAuth-flow в браузере |
| **Google Workspace** | Impersonation — полный доступ от имени пользователя | Не нужен |

> **Enterprise (Google Workspace):** при настроенном domain-wide delegation SA может работать от имени любого пользователя домена через `GOOGLE_IMPERSONATE_USER`.

**Рекомендация:** для личной работы в Cursor/Claude Desktop — **OAuth**. Для корпоративной автоматизации — **Service Account** с impersonation.

### Способ A: Service Account

Headless, безопасный, идеален для серверных окружений.

**Шаги:**

1. GCP Console → IAM & Admin → Service Accounts → Create
2. Скачайте JSON-ключ
3. Расшарьте документы/папки с email SA (Editor)

**Три варианта передачи credentials:**

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

### Способ B: OAuth 2.0

Для личного использования с интерактивным входом через браузер.

<details>
<summary>B1. Настройка и авторизация</summary>

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create **OAuth client ID** → Desktop app
3. Скопируйте **Client ID** и **Client Secret**
4. OAuth consent screen → добавьте свой email как Test User
5. Авторизуйтесь: `GOOGLE_CLIENT_ID="..." GOOGLE_CLIENT_SECRET="..." npx -y mcp-gdocs auth`

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

OAuth refresh tokens хранятся в `~/.config/mcp-gdocs/token.json` (учитывает `XDG_CONFIG_HOME`). Для повторной авторизации удалите файл токена и запустите `auth` заново.

</details>

### Несколько Google-аккаунтов

`GOOGLE_MCP_PROFILE` изолирует хранение токенов по профилям:

```
~/.config/mcp-gdocs/
├── token.json              # default (без профиля)
├── work/token.json         # GOOGLE_MCP_PROFILE=work
└── personal/token.json     # GOOGLE_MCP_PROFILE=personal
```

### Переменные окружения

<details>
<summary>Все поддерживаемые переменные окружения</summary>

| Переменная | Способ | Описание |
| --- | --- | --- |
| `SERVICE_ACCOUNT_PATH` | SA | Путь к JSON-ключу SA (+ поддержка impersonation) |
| `GOOGLE_IMPERSONATE_USER` | SA | Email для impersonation (опционально) |
| `CREDENTIALS_CONFIG` | SA | Base64-encoded SA JSON (Docker/CI) |
| `GOOGLE_APPLICATION_CREDENTIALS` | SA | Путь к JSON-ключу SA (стандартная переменная Google) |
| `GOOGLE_CLIENT_ID` | OAuth | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth | OAuth client secret |
| `GOOGLE_MCP_PROFILE` | OAuth | Имя профиля для изолированного хранения токенов |

</details>

---

## Известные ограничения

- **SA без Workspace:** Service account без Google Workspace лицензии имеет квоту Drive = 0 и не может создавать файлы. Используйте OAuth или impersonation.
- **Привязка комментариев:** Программно созданные комментарии могут не быть привязаны к тексту в UI Google Docs (ограничение Drive API).
- **Глубокие списки:** Списки с 3+ уровнями вложенности могут иметь артефакты форматирования при конвертации Markdown.
- **Безопасный диапазон стилей:** стили абзаца и заголовка автоматически корректируются, чтобы не затрагивать соседние абзацы.

## Решение проблем

- **Сервер не запускается:** проверьте, что переменные окружения заданы в `env` блоке конфигурации MCP.
- **Ошибки авторизации:** убедитесь, что Docs API и Drive API включены в Google Cloud Console. Для OAuth — проверьте, что ваш email добавлен как Test User.
- **Повторная авторизация:** удалите `~/.config/mcp-gdocs/token.json` и запустите `npx -y mcp-gdocs auth` заново.

---

[История изменений](../CHANGELOG.md) · [Лицензия](../LICENSE)

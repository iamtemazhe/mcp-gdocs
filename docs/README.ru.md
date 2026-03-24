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
4. Выберите способ аутентификации:
   - **Service Account** — для автоматизации, CI, серверов
   - **OAuth** — для работы с личными документами

> Подробнее о каждом методе — в разделе **Аутентификация** ниже.

### 2a. Service Account — расшарьте документы

Расшарьте нужные документы/папки с email сервисного аккаунта (поле `client_email` в JSON-ключе).

### 2b. OAuth — авторизуйтесь

```bash
GOOGLE_CLIENT_ID="your-client-id" \
GOOGLE_CLIENT_SECRET="your-client-secret" \
npx -y mcp-gdocs auth
```

Откроется браузер для авторизации Google. Refresh token сохранится в `~/.config/mcp-gdocs/token.json`.

### 3. Добавьте в Cursor / MCP-клиент

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

Сервер запускается автоматически, когда MCP-клиент к нему обращается.

---

## Возможности

Большинство операций записи принимают массив `items` для выполнения нескольких действий за один вызов. Все инструменты поддерживают опциональный параметр `tabId` для работы с многовкладочными документами.

### Google Docs

| Инструмент | Описание |
|------------|----------|
| `docs_read_document` | Чтение содержимого как текст, JSON или markdown |
| `docs_get_document_info` | Метаданные документа (название, ID, ревизия) |
| `docs_list_document_tabs` | Список вкладок в многовкладочном документе |
| `docs_insert_text` | Вставка текста в одну или несколько позиций |
| `docs_append_text` | Добавление текста в конец |
| `docs_delete_range` | Удаление одного или нескольких диапазонов |
| `docs_replace_all_text` | Замена всех вхождений одного или нескольких паттернов |
| `docs_replace_document_content` | Замена всего содержимого документа |
| `docs_insert_page_break` | Вставка одного или нескольких разрывов страниц |
| `docs_apply_text_style` | Жирный, курсив, подчёркивание, цвета, шрифт, ссылки |
| `docs_apply_paragraph_style` | Выравнивание, интервалы, отступы |
| `docs_apply_heading_style` | Стили заголовков (H1–H6) |
| `docs_insert_table` | Создание таблиц |
| `docs_insert_table_row` | Добавление строки в таблицу |
| `docs_insert_table_column` | Добавление столбца в таблицу |
| `docs_delete_table_row` | Удаление строки из таблицы |
| `docs_delete_table_column` | Удаление столбца из таблицы |
| `docs_update_table_cell_content` | Обновление содержимого одной или нескольких ячеек |
| `docs_update_table_cell_style` | Стиль фона ячеек |
| `docs_insert_image` | Вставка одного или нескольких изображений по URL |
| `docs_insert_local_image` | Вставка изображений из локальных файлов (загрузка + вставка) |
| `docs_replace_with_markdown` | Замена содержимого из Markdown (заголовки, списки, таблицы, зачёркнутый, HR) |
| `docs_append_markdown` | Добавление Markdown-контента в конец |
| `docs_batch_update` | Пакетное выполнение нескольких операций за один API-вызов |
| `docs_rename_tab` | Переименование вкладки документа |
| `docs_insert_table_with_data` | Создание таблицы с данными за один вызов |
| `docs_format_by_text` | Поиск текста и применение форматирования без знания индексов |

### Комментарии

| Инструмент | Описание |
|------------|----------|
| `docs_list_comments` | Список всех комментариев с автором и датой |
| `docs_get_comment` | Получение комментария с ответами |
| `docs_add_comment` | Создание одного или нескольких комментариев с привязкой к тексту |
| `docs_reply_to_comment` | Ответ на один или несколько комментариев |
| `docs_resolve_comment` | Закрытие одного или нескольких комментариев |
| `docs_delete_comment` | Удаление одного или нескольких комментариев |

### Google Drive

| Инструмент | Описание |
|------------|----------|
| `drive_list_documents` | Список документов с фильтрацией |
| `drive_search_documents` | Полнотекстовый поиск по документам |
| `drive_create_document` | Создание одного или нескольких документов |
| `drive_create_from_template` | Создание одного или нескольких документов из шаблона |
| `drive_create_folder` | Создание одной или нескольких папок |
| `drive_list_folder_contents` | Содержимое папки |
| `drive_get_folder_info` | Метаданные папки |
| `drive_move_file` | Перемещение одного или нескольких файлов в другую папку |
| `drive_copy_file` | Копирование одного или нескольких файлов |
| `drive_rename_file` | Переименование одного или нескольких файлов |
| `drive_delete_file` | Удаление одного или нескольких файлов в корзину |

### Пакетные операции

`docs_batch_update` объединяет несколько разнородных операций в один HTTP-запрос к Google Docs API. Это решает проблему квоты (60 write ops/min) при массовом форматировании.

Поддерживаемые типы: `updateTextStyle`, `updateParagraphStyle`, `updateHeadingStyle`, `insertText`, `deleteContentRange`, `replaceAllText`, `insertPageBreak`, `insertTable`, `insertInlineImage`, `updateTableCellStyle`.

Массивы из >100 операций автоматически разбиваются на чанки.

---

## Аутентификация

Сервер поддерживает несколько способов аутентификации. Если задано несколько переменных одновременно, используется первая найденная в порядке: OAuth → `SERVICE_ACCOUNT_PATH` → `CREDENTIALS_CONFIG` → `GOOGLE_APPLICATION_CREDENTIALS` → ADC.

### Service Account и OAuth

| Критерий | Service Account | OAuth |
|----------|----------------|-------|
| **Доступ к документам** | Только расшаренные с SA | Все свои документы |
| **Операции с Drive** | Только в расшаренных папках | Полный доступ к своему Drive |
| **Подходит для** | CI/CD, серверы, автоматизация | Личная работа, Cursor, Claude Desktop |
| **Настройка** | Скачать JSON-ключ, расшарить документы | Пройти OAuth-flow в браузере |
| **Google Workspace** | Impersonation — полный доступ от имени пользователя | Не нужен |

> **Enterprise (Google Workspace):** при наличии корпоративной лицензии и настроенном domain-wide delegation SA может работать от имени любого пользователя домена через `GOOGLE_IMPERSONATE_USER`.

**Рекомендация:** для личной работы в Cursor/Claude Desktop используйте **OAuth**. Для корпоративной автоматизации с Google Workspace — **Service Account** с impersonation.

### Способ A: Service Account

Headless (без браузера), безопасный, идеален для серверных окружений.

**Шаги:**

1. GCP Console → IAM & Admin → Service Accounts → Create
2. Скачайте JSON-ключ
3. Расшарьте нужные документы/папки с email SA (Editor)

**Три варианта передачи credentials:**

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

### Способ B: OAuth 2.0

Для личного использования с интерактивным входом через браузер.

**Шаг 1: Создайте OAuth Client**

1. [Google Cloud Console](https://console.cloud.google.com) → APIs & Services → Credentials
2. Create **OAuth client ID** → Desktop app
3. Скопируйте **Client ID** и **Client Secret**
4. OAuth consent screen → добавьте свой email как Test User

**Шаг 2: Авторизуйтесь**

```bash
GOOGLE_CLIENT_ID="your-client-id" \
GOOGLE_CLIENT_SECRET="your-client-secret" \
npx -y mcp-gdocs auth
```

**Шаг 3: Конфигурация MCP**

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

### Способ C: Application Default Credentials (ADC)

Идеален для Google Cloud окружений (GKE, Compute Engine, Cloud Run) и локальной разработки с `gcloud`.

ADC используется автоматически как fallback, когда другие методы не заданы.

**Для локальной разработки:**

```bash
gcloud auth application-default login \
  --scopes=https://www.googleapis.com/auth/documents,https://www.googleapis.com/auth/drive
```

**Для Google Cloud:** привяжите service account к compute-ресурсу — дополнительных переменных не нужно.

### Несколько Google-аккаунтов (профили)

`GOOGLE_MCP_PROFILE` изолирует хранение токенов по профилям:

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

Токены хранятся изолированно:

```
~/.config/mcp-gdocs/
├── token.json              # default (без профиля)
├── work/token.json         # GOOGLE_MCP_PROFILE=work
└── personal/token.json     # GOOGLE_MCP_PROFILE=personal
```

### Хранение токенов

OAuth refresh tokens хранятся в `~/.config/mcp-gdocs/token.json` (учитывает `XDG_CONFIG_HOME`). Для повторной авторизации запустите `npx -y mcp-gdocs auth` снова или удалите файл токена.

### Переменные окружения

| Переменная | Способ | Описание |
|------------|--------|----------|
| `SERVICE_ACCOUNT_PATH` | SA | Путь к JSON-ключу SA (+ поддержка impersonation) |
| `GOOGLE_IMPERSONATE_USER` | SA | Email для impersonation (опционально) |
| `CREDENTIALS_CONFIG` | SA | Base64-encoded SA JSON (Docker/CI) |
| `GOOGLE_APPLICATION_CREDENTIALS` | ADC | Путь к JSON-ключу SA (стандартная переменная Google) |
| `GOOGLE_CLIENT_ID` | OAuth | OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | OAuth | OAuth client secret |
| `GOOGLE_MCP_PROFILE` | OAuth | Имя профиля для изолированного хранения токенов |

---

## Известные ограничения

- **SA без Workspace:** Service account без Google Workspace лицензии имеет квоту Drive = 0 и не может создавать файлы. Используйте OAuth или impersonation.
- **Привязка комментариев:** Программно созданные комментарии отображаются в списке, но могут не быть привязаны к тексту в UI Google Docs (ограничение Drive API).
- **Глубокие списки:** Списки с 3+ уровнями вложенности могут иметь артефакты форматирования при конвертации Markdown.
- **Безопасный диапазон стилей абзаца:** `docs_apply_paragraph_style` и `docs_apply_heading_style` автоматически сдвигают `startIndex` на +1 (если > 1), чтобы стили не затрагивали предыдущий абзац. Это соответствует поведению Google Docs API, где границы структурных элементов пересекаются с переводом строки предыдущего абзаца.

## Решение проблем

- **Сервер не запускается:** проверьте, что переменные окружения (`GOOGLE_CLIENT_ID` / `GOOGLE_APPLICATION_CREDENTIALS`) заданы в `env` блоке конфигурации MCP.
- **Ошибки авторизации:** убедитесь, что Docs API и Drive API включены в Google Cloud Console. Для OAuth — проверьте, что ваш email добавлен как Test User в OAuth consent screen.
- **Повторная авторизация:** удалите `~/.config/mcp-gdocs/token.json` и запустите `npx -y mcp-gdocs auth` заново.

---

[История изменений](../CHANGELOG.md)

[Лицензия](../LICENSE)

# Tools reference

Part of the `google-workspace` skill — loaded on demand from `SKILL.md`. All tool names below are real — sourced live from `workspace-mcp==1.21.2` via `tools/list` (121 tools total at tier `complete`). The full registry is available at runtime via the MCP `tools/list` method.

All tools share the prefix `mcp__plugin_google-workspace_workspace__`.

## User defaults

| Setting | Value |
|---|---|
| Account | `andrevcv1@gmail.com` |
| `user_google_email` default | `andrevcv1@gmail.com` (set via `USER_GOOGLE_EMAIL` in `secrets.env`) |
| Timezone | `America/Sao_Paulo` (IANA name — always use IANA names, never offsets like `UTC-3`) |
| Locale | `pt-BR` |

## Calendar

| Tool | Purpose |
|---|---|
| `list_calendars` | List all calendars |
| `get_events` | List events in a calendar (supports date range, query) |
| `manage_event` | Create, update, or delete a calendar event |
| `query_freebusy` | Check free/busy status for a time range |
| `manage_focus_time` | Create or manage Focus Time blocks |
| `manage_out_of_office` | Create or manage Out-of-Office entries |
| `create_calendar` | Create a new calendar |

**Common workflow — create an event:**
```
manage_event(
  action="create",
  calendar_id="primary",
  summary="Stand-up",
  start_time="2026-06-12T09:00:00",
  end_time="2026-06-12T09:30:00",
  time_zone="America/Sao_Paulo",
  user_google_email="andrevcv1@gmail.com"
)
```

## Gmail

| Tool | Purpose |
|---|---|
| `search_gmail_messages` | Search messages (Gmail query syntax, e.g. `from:foo@bar.com`) |
| `get_gmail_message_content` | Get full content of a single message |
| `get_gmail_messages_content_batch` | Batch fetch multiple messages |
| `get_gmail_thread_content` | Get full thread content |
| `get_gmail_threads_content_batch` | Batch fetch multiple threads |
| `get_gmail_attachment_content` | Get attachment content |
| `draft_gmail_message` | Create a draft message |
| `send_gmail_message` | Send a message (new or reply) |
| `modify_gmail_message_labels` | Add or remove labels on a message |
| `batch_modify_gmail_message_labels` | Batch label operations |
| `list_gmail_labels` | List all Gmail labels |
| `manage_gmail_label` | Create, update, or delete a label |
| `list_gmail_filters` | List Gmail filters |
| `manage_gmail_filter` | Create or delete a Gmail filter |

**Common workflow — search and label:**
```
search_gmail_messages(query="is:unread from:github.com", max_results=20)
modify_gmail_message_labels(message_id="...", add_labels=["Label_123"])
```

## Drive

| Tool | Purpose |
|---|---|
| `list_drive_items` | List files/folders in a folder |
| `search_drive_files` | Search files by name, type, or query |
| `get_drive_file_content` | Get text content of a file |
| `get_drive_file_download_url` | Get a download URL |
| `get_drive_file_permissions` | List permissions on a file |
| `get_drive_shareable_link` | Get or create a shareable link |
| `create_drive_file` | Create a new file |
| `create_drive_folder` | Create a new folder |
| `update_drive_file` | Update file metadata or content |
| `copy_drive_file` | Copy a file |
| `set_drive_file_permissions` | Set sharing/permissions |
| `manage_drive_access` | Grant or revoke access |
| `check_drive_file_public_access` | Check if a file is publicly accessible |

## Docs

| Tool | Purpose |
|---|---|
| `create_doc` | Create a new Google Doc |
| `get_doc_content` | Get document content |
| `get_doc_as_markdown` | Get document as Markdown |
| `import_to_google_doc` | Import content into a Doc |
| `batch_update_doc` | Apply a batch of document updates |
| `modify_doc_text` | Find and replace or insert text |
| `find_and_replace_doc` | Find and replace across the document |
| `insert_doc_elements` | Insert elements (paragraphs, tables, etc.) |
| `insert_doc_image` | Insert an image |
| `inspect_doc_structure` | Inspect document structure |
| `update_doc_headers_footers` | Update headers and footers |
| `update_paragraph_style` | Update paragraph styles |
| `manage_doc_tab` | Manage document tabs |
| `export_doc_to_pdf` | Export a Doc as PDF |
| `search_docs` | Search Google Docs |
| `list_docs_in_folder` | List Docs in a Drive folder |
| `list_document_comments` | List comments on a document |
| `manage_document_comment` | Create, resolve, or delete a comment |

## Sheets

| Tool | Purpose |
|---|---|
| `create_spreadsheet` | Create a new spreadsheet |
| `get_spreadsheet_info` | Get spreadsheet metadata and sheet list |
| `read_sheet_values` | Read cell values from a range |
| `modify_sheet_values` | Write or clear cell values |
| `format_sheet_range` | Apply formatting to a range |
| `resize_sheet_dimensions` | Resize rows or columns |
| `move_sheet_rows` | Move rows within a sheet |
| `append_table_rows` | Append rows to a table |
| `create_table_with_data` | Create a table with data |
| `list_sheet_tables` | List tables in a sheet |
| `debug_table_structure` | Debug table structure |
| `manage_conditional_formatting` | Create or remove conditional formatting rules |
| `import_to_google_sheets` | Import data into a sheet |
| `list_spreadsheets` | List spreadsheets in Drive |
| `list_spreadsheet_comments` | List comments |
| `manage_spreadsheet_comment` | Create or resolve a comment |

## Slides

| Tool | Purpose |
|---|---|
| `create_presentation` | Create a new presentation |
| `get_presentation` | Get presentation content |
| `get_page` | Get a specific slide |
| `get_page_thumbnail` | Get a thumbnail image of a slide |
| `batch_update_presentation` | Apply batch updates to a presentation |
| `import_to_google_slides` | Import content into Slides |
| `list_presentation_comments` | List comments |
| `manage_presentation_comment` | Create or resolve a comment |

## Forms

| Tool | Purpose |
|---|---|
| `create_form` | Create a new Google Form |
| `get_form` | Get form structure |
| `batch_update_form` | Update form structure/questions |
| `list_form_responses` | List form responses |
| `get_form_response` | Get a specific response |

## Tasks

| Tool | Purpose |
|---|---|
| `list_task_lists` | List all task lists |
| `get_task_list` | Get a specific task list |
| `manage_task_list` | Create, update, or delete a task list |
| `list_tasks` | List tasks in a task list |
| `get_task` | Get a specific task |
| `manage_task` | Create, update, complete, or delete a task |

## Chat

| Tool | Purpose |
|---|---|
| `list_spaces` | List Chat spaces/rooms |
| `get_messages` | Get messages from a space |
| `send_message` | Send a message to a space |
| `search_messages` | Search Chat messages |
| `create_reaction` | Add a reaction to a message |
| `download_chat_attachment` | Download a Chat attachment |

## Contacts (People API)

| Tool | Purpose |
|---|---|
| `list_contacts` | List contacts |
| `search_contacts` | Search contacts |
| `get_contact` | Get a specific contact |
| `manage_contact` | Create, update, or delete a contact |
| `manage_contacts_batch` | Batch contact operations |
| `list_contact_groups` | List contact groups (labels) |
| `get_contact_group` | Get a specific contact group |
| `manage_contact_group` | Create, update, or delete a contact group |

## Other tools (Apps Script, Search, Drive misc)

| Tool | Purpose |
|---|---|
| `search_custom` | Custom search via Programmable Search Engine |
| `get_search_engine_info` | Get Custom Search Engine info |
| `list_script_projects` | List Apps Script projects |
| `get_script_project` | Get a script project |
| `create_script_project` | Create a new Apps Script project |
| `get_script_content` | Get script source files |
| `update_script_content` | Update script source |
| `run_script_function` | Run a function in a script |
| `get_script_metrics` | Get execution metrics |
| `list_script_processes` | List script process runs |
| `manage_deployment` | Create or update a deployment |
| `list_deployments` | List deployments |
| `create_version` | Create a version |
| `get_version` | Get a version |
| `list_versions` | List versions |
| `generate_trigger_code` | Generate trigger code |
| `create_sheet` | Create a new sheet within a spreadsheet |
| `set_publish_settings` | Set publish settings for a file |
| `start_google_auth` | Manually initiate OAuth (legacy — see `references/auth-and-credentials.md`) |

## Parameter gotchas

- **Timezones:** always use IANA names (`America/Sao_Paulo`, `UTC`, `America/New_York`) — never raw offsets (`-03:00`). André's timezone is `America/Sao_Paulo`.
- **`user_google_email`:** defaults to `andrevcv1@gmail.com` (set via `USER_GOOGLE_EMAIL` in `secrets.env`). Omit it or pass `andrevcv1@gmail.com` explicitly. Never use `nicolas1120201@gmail.com`.
- Never use the `mcp__claude_ai_*` Google connectors — see the account-isolation rule in SKILL.md.
- **Calendar IDs:** `primary` refers to the user's primary calendar — preferred over the explicit calendar ID for most operations.
- **Gmail query syntax:** `search_gmail_messages` uses Gmail search operators (`from:`, `to:`, `subject:`, `is:unread`, `after:`, `before:`, label names, etc.).
- **Drive MIME types:** use `application/vnd.google-apps.document` for Docs, `application/vnd.google-apps.spreadsheet` for Sheets, `application/vnd.google-apps.presentation` for Slides, `application/vnd.google-apps.folder` for folders.

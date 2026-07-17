# Charts — limits & gotchas

Part of the `notion` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, act-and-report (no approval gate), a live re-read after structural changes, match-conventions) still apply to everything here.

**Reads:** use `read_database` (`exhaust_all=true`) to enumerate or sum rows for chart data; every `read_database(database_id, format)` call (`table`/`kv`/`tsv`/`summary`) also dumps each view's full config (axes, filters, sorts, group_by) in a trailing `# Views` section — no flag, every format. The raw patterns here are for **writes** (creating/patching chart views and properties).

- **Free plan = 1 chart/workspace** (hard billing wall, not configurable; exact slot reclaim behavior after deletion is ambiguous)
- **Y-axis**: plain `number` properties and scalar formulas work; rollups, buttons, unique IDs, and files/media are not supported
  - Workaround if plain number required: add a plain number property; get each row's `.id` and source value in one raw `POST /v1/data_sources/{id}/query` (the readers don't expose page ids), then `PATCH /v1/pages/{id}` for each, keeping it synced
- **X-axis** type `'formula'` → 400 on donut charts specifically (the donut x_axis allowed list excludes formula); `type: 'relation'` → 400 on donut
  - Workaround: mirror relation name into a `select` property via API, use `x_axis.type: 'select'`
- Chart display limits: max 200 groups and 50 subgroups visible simultaneously
- Chart blocks (`/v1/blocks`) **cannot** be created via API — use `POST /v1/views` with `type: 'chart'` (full payload, with required `database_id` + `data_source_id`, in `views.md`)
- Linked-database views ARE creatable via `POST /v1/views` with a `create_database` block (see `views.md`); column layouts are UI-only. In-place **block reordering** via the public API is unsupported — but the private `listAfter` op (`private-api.md`) moves ANY block in place; `child_database`/`child_page` blocks can also be reordered via the re-parent trick (see [blocks.md](blocks.md))
- Relative date filters (`past_month`, `this_week`) cause `Something is wrong with your chart data` when set as chart-view filters (they work fine in `POST /v1/data_sources/{id}/query`). Fixed-date filters (`on_or_after`) also failed in testing, but that could not be isolated from the 1-chart billing wall — their behavior on paid plans is unconfirmed *(needs-verification)*
- Dashboard views (`type: 'dashboard'`) require Business+ plan; widgets are added via `POST /v1/views` — the exact required fields (whether `view_id` alone or alongside `database_id`/`data_source_id`) are **unverified against 2026-03-11** (doc-sourced); test before relying on this. Max 4 widgets per row *(needs-verification — doc-sourced, unconfirmed)*.


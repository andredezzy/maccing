# Charts — limits & gotchas

Part of the `notion-api` skill — loaded on demand from `SKILL.md`. The skill's MANDATORY rules (AGENTS.md sweep, full pagination, approval gate before writes, tree view after structural changes, match-conventions) still apply to everything here.

## Charts — limits & gotchas

- **Free plan = 1 chart/workspace** (hard billing wall, not configurable; exact slot reclaim behavior after deletion is ambiguous)
- **Y-axis**: plain `number` properties and scalar formulas work; rollups, buttons, unique IDs, and files/media are not supported
  - Workaround if plain number required: add a plain number property, populate via `PATCH /v1/pages/{id}` for each row, keep synced
- **X-axis** type `'formula'` → 400 on donut charts specifically (the donut x_axis allowed list excludes formula); `type: 'relation'` → 400 on donut
  - Workaround: mirror relation name into a `select` property via API, use `x_axis.type: 'select'`
- Chart display limits: max 200 groups and 50 subgroups visible simultaneously
- Chart blocks (`/v1/blocks`) **cannot** be created via API — use `POST /v1/views` with `type: 'chart'`
- Linked-database views, column layouts: **UI-only**. In-place **block reordering** is UI-only too — but `child_database`/`child_page` blocks can be reordered via the re-parent trick (see [blocks.md](blocks.md))
- Relative date filters (`past_month`, `this_week`) work in `POST /v1/data_sources/{id}/query` but cause `Something is wrong with your chart data` when used as chart view filters; alternative fixed-date filters (`on_or_after`) may also fail — the root cause in testing was the 1-chart billing wall, not the filter shape, so the exact safe filter form for chart views is unconfirmed
- Dashboard views (`type: 'dashboard'`) require Business+ plan; widgets added via separate `POST /v1/views` calls with `view_id` parent reference; max 4 widgets per row


# Step: layout

Goal: content is built for a 360–440px wide screen. It isn't a squeezed desktop page: one or two columns, nothing hidden behind hover, tables readable, comfortable spacing.

## Grids and cards
- Photo grids: 2 columns. `grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 8px;` with `aspect-ratio` on the media so cards don't jump.
- Text cards and posts: 1 column, full width, 16px side gutters.
- Avoid fixed card widths and heights; let content set the height.

## Sidebars
- Navigation sidebars are replaced by the tab bar (navigation step); hide them on phones.
- Filter and sort sidebars → a "Filter" button that opens a sheet (`navigation.md` §4). Show active filters as small removable chips under the title, and the count on the button.
- Info sidebars (details, stats) → move below the main content or into a collapsible `<details>`.

## Tables
Pick per table:
- **List of records** (most app tables): a card per row on phones with the 2–3 most important fields, the rest on the detail page.
  ```css
  @media (max-width: 640px) {
    .records, .records tbody, .records tr, .records td { display: block; }
    .records thead { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); }
    .records { min-width: 0; }
    .records tr { padding: 12px 16px; border-top: 1px solid #eee; }
    .records td { padding: 2px 0; border: 0; }
    .records td[data-label]::before { content: attr(data-label) " "; color: #6b7280; }
  }
  ```
  Add `data-label` to each cell. Safari drops table semantics when display changes, so add `role="table"`, `row` and `cell` if the table matters to screen reader users.
- **Truly tabular data** (numbers to compare across columns): keep the table, put it in an `overflow-x: auto` wrapper with a sticky first column, and show a hint that it scrolls.

## Hover-only actions
Things revealed by `:hover` (`hoverOnly` in the facts) don't exist on phones. Fix each one:
- Show the primary action always (a visible button on the card), and/or
- a "⋯" button that opens an action sheet with the rest.
- Keep the hover reveal on desktop inside `@media (hover: hover) and (pointer: fine)`.

## Headers and page titles
Phone page header: title (22–28px), one line of context, actions as icons or a single primary button. Move sort and selection controls into the filter sheet or a compact row.

## Spacing and type
- 16px side gutters; 8–12px between list items; 24–32px between sections.
- Body 15–16px, secondary 13px minimum, line length naturally short on phones.
- Every tappable row is at least 44–48px tall (`tapTargets.small`).

## Done when
No `hoverOnly` controls without a phone alternative, `overflowX` still 0, grids and lists read naturally on the small iPhone and the Galaxy (narrowest), and the desktop entry is unchanged. Checkpoint "Phone layout".

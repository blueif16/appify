# App types: what changes for each

Classify each main page, not just the whole app: a dashboard can have a chat page and a long form. Each plan says which navigation pattern to use, what to do with the layout, and which steps matter most. The step details live in `modules/`.

## Dashboard / admin / CRUD
**Signals:** sidebar navigation, data tables, filters, multi-column forms, modals.
- **Navigation:** sidebar → bottom tab bar with the 3–5 most used destinations; the rest in a "More" tab or a menu sheet. Top bar: page title plus one or two actions.
- **Layout:** tables → a card list on phones (key fields only, tap opens a detail page) or, for truly tabular data, a horizontal scroller with a sticky first column. Filters → a bottom sheet behind a "Filter" button with a count. Multi-column → single column.
- **Actions:** hover-only row or card actions → a visible "⋯" button that opens an action sheet, or the primary action shown inline.
- **Forms and modals:** popups → full-screen or bottom sheets that Back closes.
- **Matters most:** navigation, layout.

## Feed / gallery / social
**Signals:** a grid or stream of items (photos, posts, products), item detail pages, upload or create.
- **Navigation:** bottom tab bar (Home, Explore/Search, Create, Activity, Profile); Create may be a centered prominent tab.
- **Layout:** full-bleed media; a 2-column grid for photos, 1 column for posts. Keep scroll position when coming back from a detail. Infinite scroll or "Load more", never tiny pagination links.
- **Actions:** hover overlays → always-visible compact actions or a "⋯" sheet; long-press only as a shortcut, never the only way.
- **Input:** upload through `<input type="file" accept="image/*">` (camera and library), never drag-and-drop only.
- **Sharing:** every item has its own URL and preview card; a share button on the detail page; on Android, `share_target` so photos can be shared into the app.
- **Matters most:** navigation, layout, shareable.

## Single-purpose tool
**Signals:** one main action (convert, generate, calculate, edit), results area.
- **Navigation:** usually none; a compact top bar with settings in a sheet.
- **Layout:** one screen; the main action at the bottom within thumb reach, above the safe area; results replace or slide over the input.
- **State:** put inputs/results in the URL so a result can be shared and reloaded.
- **Installable:** the biggest win; an offline shell if the tool works without the network.
- **Matters most:** shell, input, installable.

## Chat / AI assistant
**Signals:** a message list and a composer.
- **Layout:** app shell that never scrolls as a page: header, scrolling message pane anchored to the bottom, composer. Conversation list → a drawer or its own screen.
- **Keyboard:** the composer stays above the keyboard (`visualViewport` on both; `interactive-widget=resizes-content` on Android). The composer textarea uses 16px text and `enterkeyhint="send"`.
- **Sharing:** a conversation link with a preview card, if conversations are shareable.
- **Matters most:** shell, input.

## Content site (landing, blog, docs, portfolio)
**Signals:** mostly reading; few actions.
- **Navigation:** no tab bar. A compact top bar; the menu opens as a sheet; docs get a contents sheet.
- **Layout:** readable type (body 16–18px, line length ≤ ~70 characters), images full width, code blocks scroll horizontally inside themselves.
- **Sharing:** the main job: per-page preview cards and a share button on articles.
- **Installable:** optional (offline reading, a reading list).
- **Matters most:** shell, shareable.

## Checkout / booking / long forms
**Signals:** multi-step input, payment or booking.
- **Layout:** one step per screen with a working Back; progress shown; the primary button fixed at the bottom above the home indicator and the keyboard.
- **Input:** the right keyboard and autofill on every field (`autocomplete`, `inputmode`, `enterkeyhint="next"` until the last field); errors inline next to the field.
- **Matters most:** input, navigation.

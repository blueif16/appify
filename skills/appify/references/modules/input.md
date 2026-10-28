# Step: forms and input

Goal: typing on a phone is easy. The right keyboard appears, autofill works, nothing zooms, the keyboard never hides the field or the submit button, and photos come from the camera or library instead of drag-and-drop.

## Fields
| Field | Write |
|---|---|
| Email | `type="email" autocomplete="email" autocapitalize="none" spellcheck="false"` |
| Phone | `type="tel" autocomplete="tel"` |
| Name | `autocomplete="name"` (or `given-name` / `family-name`) |
| Password | `type="password" autocomplete="current-password"` (sign-in) / `new-password` (sign-up) |
| One-time code | `inputmode="numeric" autocomplete="one-time-code" pattern="[0-9]*"` |
| Quantity, days | `inputmode="numeric"` (or `type="number"` only for real quantities) |
| Money | `inputmode="decimal"` |
| Search | `type="search" enterkeyhint="search"` |
| Free text | `<textarea>`, `enterkeyhint="enter"`; chat composer `enterkeyhint="send"` |

- Every field: a visible `<label>`, a meaningful `name`, `font-size: max(16px, 1rem)`.
- `enterkeyhint="next"` on fields followed by another, `"done"` or `"go"` on the last. Wrap fields in a `<form>` so Go submits.
- No `autofocus` on phones.

## Layout
- One column on phones: `.form-row { display: grid; grid-template-columns: 1fr; gap: 16px; }` under the phone breakpoint.
- Checkbox and radio rows are 44px tall with the label clickable.
- Errors inline under the field, in words, not only red borders.
- The primary button full width at the end of the form. In long forms, a sticky footer: `position: sticky; bottom: 0; padding-bottom: max(env(safe-area-inset-bottom), 12px)`.

## Photos and files
Drag-and-drop doesn't exist on phones. Make the drop area a tappable picker and keep drag-and-drop for desktop:
```html
<label class="picker">
  <input type="file" accept="image/*" class="visually-hidden">
  <span class="for-mouse">Drag a photo here or <u>choose one</u></span>
  <span class="for-touch">Take or choose a photo</span>
</label>
```
```css
.visually-hidden { position: absolute; width: 1px; height: 1px; opacity: 0; overflow: hidden; }
@media (hover: none) { .for-mouse { display: none; } }
@media (hover: hover) { .for-touch { display: none; } }
```
- `accept="image/*"` opens camera, library and files; add `capture="environment"` only if the app is about taking a new photo right now; `multiple` for several.
- Handle the file from the input's `change` event with the same code path as a drop. Expect HEIC from iPhones.

## The on-screen keyboard
- It covers the bottom ~40% and doesn't resize `vh`/`dvh`. A `position: fixed; bottom: 0` bar ends up behind it.
- For a composer or primary bar that must stay visible:
  ```js
  const bar = document.querySelector('.composer');
  const vv = window.visualViewport;
  const place = () => {
    const covered = innerHeight - (vv.height + vv.offsetTop);
    bar.style.transform = covered > 0 ? `translateY(${-covered}px)` : '';
  };
  vv?.addEventListener('resize', place);
  vv?.addEventListener('scroll', place);
  ```
  On Android only, `interactive-widget=resizes-content` in the viewport tag is the simpler option for chat-style pages.
- Forms inside sheets: the sheet's content scrolls (`overflow-y: auto`) so the focused field can move above the keyboard.

## Confirmations
After submitting, show a sheet or an inline success state instead of a centered desktop modal. It closes with Back on Android (it's a `<dialog>`, see `navigation.md`) and with a visible button on iOS.

## Done when
`smallFields` is 0. In the studio with the keyboard on, every field you tap stays visible and the right keyboard appears (email, numbers). The photo picker opens from a tap. Checkpoint "Forms and input".

[Português](PADRAO_ICONES.md) | **English**

# Icon standard

Standard for GeradorOne action icons: plain JS, no React, and only the tokens from `public/design.css`. It applies to any row action button: tables, cards and lists.

## Rule

A row action is always an icon-only button with a tooltip (`title`), never a text button ("Edit", "Delete", "Reset password") and never an emoji. Form buttons (Save, Cancel, Generate, Create user) and the main buttons of a screen keep their text.

## Single source

- **JS:** `ACTION_ICONS`, `actionButton()` and `armAction()` in `public/app.js`. Do not redefine an icon per screen.
- **CSS:** the `.act` block at the end of `public/design.css`.

```js
actionButton('edit', 'edit', 'Editar usuário', `data-edit-user="${id}"`)
actionButton('del', 'trash', 'Excluir projeto', `data-delete-project="${id}"`)
```

The signature is `actionButton(kind, icon, title, attributes)`. The title becomes `title` and `aria-label`.

## Button anatomy

- 30 by 30 px box, 6 px radius.
- 16 px SVG icon, 2 px stroke, `stroke="currentColor"`, Feather style.
- Tonal background: `color-mix(color 9%)`; border `color-mix(color 30%)`; icon in the full color.
- Hover: the background goes up to 18%. Nothing moves, no shadow and no gradient, as in `docs/DESIGN.en.md`.
- Accessible: `title` and `aria-label` identical; visible focus inherited from the theme.

## Colors: only through theme tokens

GeradorOne has no success or warning tokens, and the visual standard forbids creating colors outside `design.css`, so the kind of action maps to three tokens that exist in all six themes.

| Kind | Class | Token | Actions |
|---|---|---|---|
| Normal action | `act-edit`, `act-add`, `act-on`, `act-sync`, `act-exp` | `--accent` | Edit, open, create, enable, refresh, export |
| View-only or neutral | `act-view`, `act-off`, `act-neutral` | `--ink` | View details, disable, reset password |
| Destructive | `act-del` | `--danger` | Delete |

Disable uses `--ink` because the theme has no amber. If the theme ever gets a warning token, only the `act-off` line changes.

## Action → icon

| Kind | Icon (`ACTION_ICONS`) | When to use |
|---|---|---|
| `view` | `view` (eye) | Open or view without editing |
| `edit` | `edit` (pencil) | Edit a record; also open a project |
| `del` | `trash` (trash can) | Remove, always with two-click confirmation |
| `on` / `off` | `power` | Enable / disable |
| `sync` | `sync` (circular arrows) | Reload or reprocess |
| `exp` | `grid` or `download` | Export a spreadsheet or download a file |
| `add` | `plus` | Create (a main button with the text "New ..." keeps its text) |
| `neutral` | `key` (key) | GeradorOne extra: reset password |

## Two-click deletion

An icon-only button has no room for the text "Confirm deletion". So the first click calls `armAction(button, confirmationText, originalTitle, milliseconds)`: the button turns solid `--danger`, shows the confirmation text next to the icon, swaps `title` and `aria-label` and goes back to normal on its own after the timeout. The second click, while still armed, deletes. Timeouts in use: 3.5 s for projects and 4 s for users.

## Do and don't

Do: use `actionButton`; color by kind of action; 16 px and 30 px on every screen; row action with icon and tooltip.

Don't: emoji as an action; the text "Edit" or "Delete" on a row button; a fixed hexadecimal color; a new icon copied into a single screen; mixed sizes.

## Where it already applies

- **Users** tab of Settings: edit, reset password and delete.
- **My projects** screen: open and delete.

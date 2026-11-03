[Português](DESIGN.md) | **English**

# GeradorOne design system

This document explains the visual identity applied on 2026-10-23 and how to use it on new pages. The code lives in `public/design.css` (tokens, themes and finish); the reference boards are in `docs/design/`.

## Principles

The app is a working tool for teachers, not a showcase. The look follows these rules:

- **No generic AI look.** No gradients, glows, glass, shadows, cards that rise on hover, pill chips, icons in colored boxes or decorative numbering (01/02/03).
- **Lines instead of shadows.** Separation by a 1 px border and by a step in tone (`--bg` to `--paper`). 2 px corners.
- **One accent color per theme**, used only where there is action, focus or selection. Errors have their own color (`--danger`).
- **Typography with personality.** Book serif for titles and for the prompt text (it appears as a sheet of paper); a highly legible sans for the interface.
- **Interaction without movement.** The button inverts to ink on mouse hover; nothing shifts. `prefers-reduced-motion` turns transitions off.
- **Concrete texts in Portuguese**, no marketing phrases and no emojis. Icons are inline SVG (2 px stroke, no fill).

## Typography

| Use | Font | Note |
|---|---|---|
| Titles, brand name, prompt text | Literata (variable, 400 to 700) | `--serif` |
| Interface, forms, tables | Atkinson Hyperlegible Next (400, 500, 700) | `--sans`, designed for low vision |

The fonts are served by the app itself from `public/fonts/` (Latin subset only, SIL OFL 1.1 license). Do not use Google Fonts: the CSP (`style-src 'self'`) blocks them. If you need another font, copy the `.woff2` file to `public/fonts/`, declare `@font-face` in `design.css` and confirm that `server.js` serves the extension (today `.woff2` is already in `MIME`).

Sizes: body text 15 px; page title 34 px; section title 20 px; supporting text 13 px.

## Themes

The choice happens on the **Theme** screen (the "Theme: …" item at the bottom of the menu): a gallery with a thumbnail of the screen in each theme, and the option "Follow the system". The color and contrast table that exists on the board was removed from the app on request (2026-10-23). The reference board is `docs/design/Temas.dc.html`. Any element with `data-theme-scope="name"` receives the tokens of that theme without changing the rest of the page; this is how the gallery thumbnails are painted.

There are six color combinations applied to the same app. The theme lives in `<html data-theme="...">` and the choice is saved **on the account**, in the `users.theme` column (empty = not chosen yet), through the `POST /api/auth/theme` route. On sign-in, the app applies the account's theme; "Follow the system" saves `sistema` on the account. `localStorage` (`apostila-theme`) only keeps a copy for the login screen. With no choice made, the first sign-in is in Paper, whatever the system preference; only users who pick "Follow the system" get Graphite for dark and Paper for light. Old values (`light`, `dark`) are converted.

| Theme (`data-theme`) | `--bg` | `--paper` | `--ink` | `--muted` | `--line` | `--field` | `--accent` | `--accent-ink` | `--danger` |
|---|---|---|---|---|---|---|---|---|---|
| `papel` (default) | #F2F0EB | #FCFBF8 | #1D1B17 | #5C574E | #D3CEC4 | #8A8378 | #13704A | #FFFFFF | #B42318 |
| `grafite` | #161719 | #1F2124 | #ECEAE5 | #A6A39C | #3A3D42 | #77746E | #F0A040 | #1A1206 | #FF8A7A |
| `lousa` | #1D3A2F | #244537 | #F2F0E6 | #BCC9BF | #45685A | #86A596 | #E9D26A | #1D2A14 | #FFB4A8 |
| `azul-tinta` | #ECF0F6 | #FFFFFF | #0F1A33 | #475471 | #C6CEDD | #7A87A3 | #1D3FBF | #FFFFFF | #B42318 |
| `sepia` | #ECE2CD | #F6EEDC | #2A2015 | #5D4C38 | #CBB896 | #8C7656 | #7A3812 | #FFFFFF | #A0261A |
| `alto-contraste` | #000000 | #0A0A0A | #FFFFFF | #DADADA | #FFFFFF | #FFFFFF | #FFE14D | #000000 | #FF6B6B |

Meaning of the tokens:

- `--bg`: page and side menu background.
- `--paper`: card, field and panel surface.
- `--ink`: main text, button outline and menu logo.
- `--muted`: supporting text and captions.
- `--line`: divider and card border (not for use as a field border).
- `--field`: field and control border, with a contrast of at least 3:1 against `--paper`.
- `--accent`: primary button, focus, selection, link and home page logo.
- `--accent-ink`: text on `--accent`.
- `--danger`: error and destructive action.

Contrast (calculated by script in the design, to be checked again when a color changes): text and supporting text above 4.5:1 in all themes; the lowest is `--muted` in Chalkboard (6.2:1). The primary button text on `--accent` is 6.1:1 or higher.

To **add a theme**: create the `html[data-theme="novo"]` block in `design.css` with the nine tokens, add the key to `themeNames` in `app.js` and to `THEMES` in `lib/users.js`, and create a migration that extends the `CHECK` of the `users.theme` column, a `data-theme-pick="novo"` button in `#theme-menu` of `index.html` and the three `--sw-*` variables of `.theme-option[data-theme-pick="novo"]` (thumbnail in the selector). If the theme is dark, also include it in the rule that inverts `.resource-icon`.

The old names from earlier stylesheets (`--teal`, `--teal-dark`, `--aqua`, `--violet`) still exist, but point to the new tokens. **In new code use only the nine tokens.**

## Components

All of them use only the tokens, so they work in any theme.

- **Secondary button** (`.ghost`, `.icon-button`, action buttons): transparent background, 1 px outline in `--ink`; on hover it becomes an `--ink` background with `--paper` text.
- **Primary button** (`.primary`): `--accent` background, `--accent-ink` text; on hover it inverts to ink. One per screen.
- **Field** (`input`, `select`, `textarea`): `--field` border, 2 px corner, `--ink` text at weight 400; focus with a 2 px outline in `--accent`. Bold label above.
- **Card** (`.card`): `--paper` background, `--line` border, no shadow. Section title in 20 px serif.
- **Choice** (`.option`, `.resource`): rectangle with a `--line` border; when selected, border and thin inner line in `--accent` and an `--aqua` background (accent at 11% over `--paper`).
- **Project path line** (`.crumbs`, only in Workbook and Cover): "My projects / project name · saved at HH:MM" on the left; Rename, Save project (or Update project), and Save as new on the right. It replaced the save line that used to sit inside the result panel. The button warns if there is no generated prompt yet.
- **Mobile (up to 900 px)**: header with menu, logo, name and shortcut to My projects; Data | Result tabs (`.mobile-steps`, the active one in solid ink); the form shows only the data and the panel shows only the result. On generating, it opens the Result tab by itself. The "Generate prompt" button (48 px) stays fixed at the bottom of the screen, with the note "The result opens in the Result tab." Between 901 and 1180 px the screen stacks form and result, without tabs.
- **Side menu**: `--bg` background; active item with a `--paper` background and a thin `--line` outline, no colored bar.
- **Acceptance box** (`.terms-check`): 20 px checkbox on the left and text at weight 400 with links underlined in `--accent`; used in sign-up and on the Terms acceptance screen.
- **Long-text pages** (`termos.html`, `privacidade.html`, styled in `legal.css`): 780 px column, serif titles, draft note with a thin line in `--accent`; `legal.js` applies the theme stored in the browser.
- **Result panel**: the prompt in 15 px serif with 1.7 line height, inside a sheet with a border.
- **Notice and error**: text in `--danger` or `--accent`, never by color alone (with clear text alongside).
- **Logo**: the same drawing (`assets/icons/mapa-mental.png`) painted through a CSS mask on the `.logo` class, taking the theme color. Use `<span class="logo">` and set the width and `aspect-ratio: 897 / 1000`.

## Screen structure

The screens follow the boards in `docs/design/`. The reusable blocks:

- **Flat section** (`.sec`): title in 20 px serif (`.sec-head h2`) with a caption (`.help`), separated from the previous one by a 1 px line, no card. For option groups use `<fieldset class="sec"><legend><span class="sec-title">…</span><span class="help">…</span></legend>`.
- **Option list** (`.opt-grid` with `<label class="opt"><input type="radio">…`): used for the material type. The checked option is bold.
- **Choice card** (`.option`, `.resource`): square rectangle; when selected, a 2 px ink border. The 12 styles carry the thumbnail from `style-art.js`.
- **Form footer** (`.form-foot`): 2 px ink line, tall primary button (`.primary.big`), "Clear form" as a text button (`.textbtn`) and a note on the right. On mobile it becomes a fixed bar at the bottom of the screen.
- **Result panel** (`.out-panel`): sheet with an ink border. Header "Result" with the time, Prompt/Preview tabs (`.out-tabs`), a toolbar with the segmented group Copy/TXT/JSON/PDF (`.seg`) and "Improve with AI" (`.outline`), the prompt in serif and, at the end, the "Generate the material with AI" block (`.ai-block`), which picks the delivery format and triggers generation.
- **Table** (`.data-table`): header in small caps with an ink line, rows separated by `--line`, actions in outlined buttons; editing opens below the row.
- **Login**: two halves. On the left, brand, a form without a card (title with a line, "Forgot password" next to the label, an eye to show the password inside the field, as in every password field in the app) and footer; on the right, a panel always in the Chalkboard theme (`data-theme-scope="lousa"`) with the logo and the introductory sentence.
- **Title of each screen**: carries the same icon as the menu button in front. `app.js` copies the `<svg>` of the menu item itself (class `.title-icon`), so the two never diverge; when creating a new screen, the icon comes for free if the menu item has a `data-view` equal to the section's.
- **FAQ**: collapsible explanatory box, search, category filter and a Category/Question table; the answer opens in the row itself. On mobile the table becomes a list.
- **Row action buttons**: 16 px Feather icon in a 30 px tonal box, through `actionButton()`; rules and colors in [PADRAO_ICONES.en.md](PADRAO_ICONES.en.md).
- **Tabs** (`.config-tabs`, in Settings): text without a box, active tab with a 2 px underline in `--accent` and weight 700; on mobile they scroll horizontally. Backup panel: `.backup-alert` (left border `--accent` or `--danger`), `.backup-stat`, `.data-table` tables and a log in `.backup-log`.
- **Side menu**: no group labels; footer with Theme (theme name on the right), Sign out and the name with the role.

## Illustration style thumbnails

Each of the 12 styles in the form has an SVG thumbnail (`public/style-art.js`): the same apple drawn in Cartoon, Hand-drawn, Doodle, Educational Cartoon, Scientific Illustration, Futuristic Digital, Modern Infographic, Minimalist, Educational 3D, Realistic, Textbook and Colorful Kids. Using the same object in all 12 makes the difference in stroke show without noise. The thumbnails are monochrome: only `currentColor` (the theme ink) and `var(--paper)`, with opacity to create tones. What changes between styles is the stroke, the fill and the details, never the color. Do not use fixed colors in them. The array order must follow that of `styles` in `app.js`. SVG gradients need a unique `id` (the prefix comes from `renderStyleOptions`, because the list appears in both Workbook and Cover).

## How to create a new page

1. Use the existing classes (`.view`, `.view-head`, `.card`, `.primary`, `.ghost`) before inventing CSS.
2. Colors only through `var(--token)`. No hexadecimal outside `design.css`.
3. No `style=` and no inline script (CSP). Dynamic adjustments through `element.style.setProperty`.
4. No shadow, gradient, `transform` on hover or corner larger than 2 px.
5. Test in the six themes, at 1440 px and at 390 px, and navigating by keyboard only (focus must be visible).
6. Check the contrast of new pairs against the tokens before creating a color pair that is not in the table.

## Reference boards

`docs/design/` holds the files of the design made in the Artifact "GeradorOne — UI redesign" (`.dc.html` format, which only opens in the Artifact itself): identity and components (`Main`), `Login`, `Apostila`, `Temas`, `Usuarios` and `Mobile`. They serve as a visual guide; the real code is `public/design.css`. The names, emails and sample texts on the boards are made up.

## Open items from the redesign

- `styles.css`, `theme.css` and `app.css` still carry rules from the old design, overridden by `design.css`. The `--field` token was a field background in the old design and today it is the border color: when touching those stylesheets, never use `--field` as a `background`.
- The `Mobile` board uses dropdown menus for type and style; in the app the option list and the cards remain, and they scroll normally on mobile.
- The `Temas` board also has the section "The same screen in three themes" (side-by-side comparison); in the app there is only the gallery. The "colors and contrast" table from the board was also left out.

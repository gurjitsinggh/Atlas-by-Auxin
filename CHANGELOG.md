# Changelog

## v1.14.3 — Orchard Glow palette clarification
- Added one combined Orchard Glow palette using all four exact colours: Lime Green `#B0E454`, Forest Green `#224F10`, Soft Ivory `#EAFFD0`, and Jet Black `#0D0D0D`.
- Kept Classic Light and Classic Dark modes; removed the four individual swatch themes from the selector.
- Existing saved swatch selections migrate to Orchard Glow.
- Updated all-caps utility labels to natural casing, including the brand subtitle, settings helper labels, export labels, and table headings.
- Left all scaling slider ranges, values, spacing controls, and scale calculations unchanged.


## v1.14.3 Settings language and theme studio update
- Added a searchable language picker with native-language labels for 80+ languages; selected preference is stored locally.
- Added a custom theme studio with live preview, color swatches, and HEX/RGB/HSL code entry.
- Kept existing Maps open/detect/sync logic and all interface scaling defaults unchanged.


## v1.14.3 Theme library management
- Added persistent Saved themes so multiple custom palettes can be kept across extension sessions.
- Added Apply, Edit, and Delete actions for saved palettes.
- Deleted custom themes move into Recently deleted instead of being lost immediately; individual restore, restore-all, and permanent-delete actions are available.
- Migrated the earlier single saved custom palette into the new theme library when upgrading.
- Kept built-in Classic Light, Classic Dark, and Orchard Glow presets intact; no Google Maps workflow or interface scaling values were changed.

## Interface translation fix
- Changing Interface language now translates visible interface labels, buttons, descriptions, placeholders, accessibility labels, and newly-rendered UI copy.
- Added local translation caching so repeated visits and language changes reuse translations.
- Supports right-to-left layout direction for Arabic, Persian, Hebrew, Urdu, Pashto, and Kurdish.
- Lead/business record values and saved records are excluded from translation requests. Translation requires an internet connection on first use.

## Translation stability and layout fix
- Prevented concurrent localization refreshes from reverting translated copy to English or applying stale translations after UI updates.
- Translates explanatory sentences containing quoted examples, including the business-card privacy note.
- Preserves the Auxin Studio wordmark while translating its descriptive copy.
- Allows long translated labels and button captions to wrap/expand within their layout; fixed the scan-note text clipping seen in the Ukrainian UI.


## CSP and helper-text refinement
- Allowed the two already-declared city-data hosts in the extension-page `connect-src` CSP so the GeoNames dataset and GitHub fallback are no longer blocked by the manifest's own policy.
- Standardized explanatory/help-copy sizing, line-height, contrast, and wrapping across settings and other helper-note components, while preserving the existing text-scale control.
- Associated the language explanation with the language search and selector for accessibility.

## v1.14.3 — Button Translation Stability & Language Help Alignment
- Apply cached interface translations synchronously in the DOM mutation microtask so refreshed Maps/search/scan button labels do not flash back to English between UI polls.
- Avoid translation refreshes for mutations inside language-picker internals and dynamic saved-record tables.
- Align the language helper paragraph with the Interface language heading and Find a language label, without changing the separate settings-footnote indentation elsewhere.
- Preserve left alignment for LTR languages and right alignment for RTL language helper copy.


## Saved Views, Maps Fallback & Locale Layout (v1.14.3)
- Stacked Saved views, Apply/Save/Delete, and Import CSV/JSON into full-width responsive rows so translated labels do not collapse into narrow vertical text.
- Kept the Open Maps search button label stable. In manual sync mode it now opens a Google Maps search when the active tab is not Maps, and continues to update the current Maps tab when one is active.
- Allowed the empty saved-records message to participate in interface translation without translating business record cells.
- Preserved two-digit section numbering and existing scale settings.

## On-demand Google Cloud language packs
- Removed the all-language bundled translation dictionary to keep the extension package smaller.
- Added per-language downloads through the official Google Cloud Translation v2 endpoint; users choose the language they need.
- Each download is split into batches of at most 128 phrases, validated, then saved locally only after the entire phrase inventory succeeds.
- Downloaded packs are reusable offline and can be exported or removed. The API key is stored in session storage only.


## Downloadable localization — v1.14.3
- The extension ships only the English interface phrase glossary and captures eligible interface phrases present at startup to improve coverage.
- Language packs are downloaded individually via the official Google Cloud Translation API; incomplete responses are not installed.
- Restored protected dynamic-number placeholders through translation and accept valid unchanged phrases (e.g. product names/acronyms) as complete entries.


## Global language-pack downloader (2026-10-16)
- Added one-click sequential processing for every non-English language in the language selector. All codes are attempted with equal priority.
- Checks Google's supported-language catalogue and maps known aliases before translating. Unsupported languages are reported rather than marked installed.
- Translates the frozen full interface phrase inventory in Google Cloud batches and validates every phrase and protected brand/format token before storing a pack.
- Saves each complete pack immediately, so a quota/network interruption does not erase finished work. Complete packs are skipped on the next run.
- Added export of all complete installed language packs into one JSON collection.
- No API key is embedded in the extension; the key remains in session storage. Google Cloud billing may apply.

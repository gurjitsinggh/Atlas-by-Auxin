Atlas by **Auxin** Studio — Chrome extension, version 1.14.3.

This build downloads only the interface-language pack a user selects using the official Google Cloud Translation API. It does not ship a large dictionary for every language. Packs are generated in batches, installed only when the full phrase inventory is returned, and cached in local extension storage for offline use. The API key is held in Chrome session storage only. A Google Cloud project with Cloud Translation enabled and billing/quota configured is required; Google may charge for usage.

To set up packs, follow `LANGUAGE-PACK-DOWNLOAD-GUIDE.txt`.

To update, replace the files in the existing unpacked extension folder with these root files and click Reload at `chrome://extensions`. Preserve the same folder to keep the extension ID and local data.

See `CHANGELOG.md` for release history.

---

- v1.12.5: The Find phone numbers control and its explanatory note are hidden from the interface; other features remain unchanged.
Atlas by **Auxin** Studio — v1.12.4

Chrome Manifest V3 extension. To update, replace the files in the existing unpacked extension folder with these root files and click Reload at chrome://extensions. Preserve the same folder to keep the extension ID and local data.


### v1.12.1 reliability fixes
- Resetting saved records during an active scan/phone lookup requests a stop, awaits the running content task, then clears records.
- Atlas keeps progress and commands associated with the original Maps tab while work is active, even if the user switches browser tabs.

### v1.12.2 fixes
- Standardized city spellings in location normalization.
- Removed the empty phone-lookup queue label.

### v1.12.8 — dataset choice on search change

When you begin a scan after changing the Google Maps search while saved records exist, Atlas asks whether to append new results to the existing dataset, reset old records and start fresh, or cancel. Repeated scans of the same search do not prompt.

Previous release: v1.13.0 keeps the new-tab Maps search in automatic mode and changes the primary search button to update the active Maps tab in place when automatic sync is disabled.

Current release: v1.13.1 improves XLSX auto-width calculations across every selected column.


### Excel column widths
XLSX exports calculate the width of every selected column from the header and the longest exported cell value, with better support for wide-script characters and emoji. Widths retain a sensible cap and wrapped-cell behavior for very long values. CSV, TSV, and JSON do not support column-width metadata, so their data is exported unchanged.


### v1.13.2 reset reliability

Reset clears the stored dataset immediately and advances a generation marker. Collector writes from an older generation are rejected, so late writes cannot repopulate the visible/exportable dataset after reset. If the Maps content script is unavailable, reset still succeeds without treating the missing message receiver as a fatal error.

### Background collection (v1.13.3)
Atlas keeps the job tied to the original Google Maps tab, disables automatic discarding for that tab for the duration of a scan or phone lookup, streams saved records/status through Chrome storage, and restores the tab's original discard setting when the task finishes. Chrome may pause or throttle collection while another tab is selected; keep the original Maps tab active and return to it if progress pauses. A full Maps page reload ends the page-bound collection task, while already-saved records remain safe.


### v1.13.4 status information
The active-job information now tells users to keep the original Google Maps tab active, because collection may pause while another tab is selected and resume after returning. This release changes only status copy and version documentation.


## v1.13.7 updates
- Column-selection undo is available via Ctrl+Z or the red Undo column selection button above Export dataset. Undo snapshots persist across panel/extension sessions. Configure the retained history size in Settings (1–50, default 10).
- The Saved column presets card now includes built-in presets and saved custom presets as wrapping chips, growing naturally as more presets are added.
- Reset data is full width and sits directly below Start scan.


## v1.14.0 React Lead Workspace

The extension now includes a React-rendered application shell and React-powered workspace alongside the existing, stable collection engine. The migration is incremental: established scanner/export/settings event handlers remain in the legacy module for this release so their behavior and existing extension storage keys can be preserved while the new workspace uses component-based rendering.

Workspace capabilities include:
- Data-quality review for duplicate candidates, missing identity fields, and unusual phone/website/email formats.
- Lead status, priority, editable email, tags, notes, follow-up dates, filtering, sorting, saved views with delete, bulk status/priority edits, and row selection.
- Local CSV/TSV/JSON import with field/header mapping (including optional user-supplied email fields) and duplicate prevention.
- Selected-record export, export preview, saved export setups with delete, and optional email/lead metadata columns in CSV/XLSX/JSON/TSV output.
- Virtualized record rows, local-only help, and scan Pause/Resume/Stop controls.

No subscription backend, cloud sync, or new CRM API integrations were added. New workspace metadata is saved to `chrome.storage.local` under `atlasLeadMetadataV1`; saved filters use `atlasLeadSavedViewsV1`; saved export setups use `atlasExportProfilesV1`. Existing record, export-column, preset, and settings keys remain unchanged. Explicit dataset resets also clear lead metadata attached to the records being reset.

### Updating safely
Extract this ZIP and copy the contents into your existing unpacked Atlas extension folder, replacing files in place. Then open `chrome://extensions` and click **Reload** on the existing Atlas extension. Do not remove the existing extension or load this as a separate extension if you need to preserve its extension ID and existing `chrome.storage.local` data.

### Compliance note
Atlas's collection workflow relies on page content. Before public or paid launch, review the current Google Maps Platform / Google Maps terms and Chrome Web Store program policies. This release does not add a server, paid tier, or API integration, and does not certify the existing collection workflow as permitted for commercial use.


### v1.14.2 UI refinement
The Lead Workspace data-quality score is displayed as a large, plain number instead of a circle. The title and descriptive copy are stacked cleanly. The lead search input no longer shows a second square focus outline; focus remains indicated by the rounded field border. Workspace cards and controls use subtle ease-out motion, smooth scrolling, and reduced-motion support. The OPTIONAL label beside Location is removed, but Location itself remains optional. The scanner, records, data keys, and exports are unchanged.


Advanced Mode

The Lead Workspace is hidden by default to keep the basic scan/export workflow focused. Use the Advanced Mode control near the top of the extension to show it. This preference is stored locally in Chrome extension storage. The Workspace uses animated selectors for its main filters, saved views, bulk editing, export setups, and editor fields.


### v1.14.3 responsive layout
The side panel now uses available viewport width instead of assuming a fixed 410 px width. Lead Workspace toolbar actions, saved-view controls, and editor/bulk fields wrap at narrow widths to avoid overlapping or extending beyond the panel. Data and scanning behavior are unchanged.

### Scrolling behavior (v1.14.3)
The outer extension page scrolls naturally through the full settings and workspace content. The Lead Workspace table retains its own bounded scrollbar when its rows overflow, and wheel/touch scrolling chains to the outer page when the table has no overflow or reaches its top/bottom edge.

### Lead Workspace heading alignment follow-up
The Lead Workspace subtitle begins beneath the title text, sharing the same left alignment as the heading instead of starting under the `04` section badge.


UI note (v1.14.3): the Lead Workspace heading intentionally shows only the numbered badge and title; the descriptive subtitle has been removed for a cleaner aligned heading.

### Latest Saved Records (v1.14.3)
The preview includes a search field that filters all saved records (newest first), a vertically scrollable table, and three columns: Business, Phone, and Category. Business names open their Google Maps profile or business website in a new tab. Phone clicks honor the configured Auto-detect / WhatsApp / Clipboard action in Settings. Scrolling uses native, immediate behavior to avoid lag and preserve natural scroll chaining.

## v1.14.3 Orchard Glow theme
The appearance selector offers Classic Light, Classic Dark, and one combined Orchard Glow theme. Orchard Glow uses Lime Green (#B0E454), Forest Green (#224F10), Soft Ivory (#EAFFD0), and Jet Black (#0D0D0D) together. Utility labels use natural casing. Scaling controls, ranges, values, and calculations are unchanged.

## Offline localization audit
- Added a full UI source phrase catalog for visible text, helpers, placeholders, accessible labels, and scan/Maps messages.
- Added normalized exact-key matching for curly quotes, Unicode forms, dash variants, ellipses, and whitespace.
- Added translation coverage audit; only explicit translations are counted, never English fallbacks.
- Offline localization continues to make no network translation requests.

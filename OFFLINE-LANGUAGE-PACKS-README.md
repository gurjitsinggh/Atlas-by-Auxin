# Atlas v1.14.3 — Bundled Offline Language Pack Build

This extension bundles offline translation dictionaries for all 82 language codes represented by the localization kit. The existing Atlas interface localization engine reads `translations.json` locally. No external translation request is needed for dictionary entries included in this file.

## Important coverage note
The supplied source packs contain 338 phrase slots each, but not all languages have all phrases translated. This build includes every available non-empty non-English translation and falls back to the original English phrase for missing or identical-to-English values. It does not claim 338 genuinely translated phrases in every language. See `OFFLINE-LANGUAGE-COVERAGE.csv`.

## Install
1. Extract this ZIP to a folder.
2. Open `chrome://extensions` in Chrome.
3. Enable Developer mode and choose **Load unpacked** (or replace files in the same existing unpacked folder to preserve the extension ID and local data).
4. Select this folder. If already installed from an unpacked folder, replace its files in that same folder and click Reload.

The extension version remains 1.14.3. Keep the same unpacked folder when updating if you need to preserve its extension ID and local data.

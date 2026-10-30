const $ = (id) => document.getElementById(id);
let toastTimer = null;
let toastExitTimer = null;
let activeTab = null;
let refreshTimer = null;
let lastStatus = {};
let lastBackgroundStatusProbeAt = 0;
const DEFAULT_EXPORT_COLUMNS = ['name', 'phone', 'website', 'category', 'rating', 'reviews', 'priceRange', 'address', 'hours', 'description', 'mapsUrl'];
const MAPS_PERMISSION = { origins: ['https://www.google.com/*', 'https://maps.google.com/*'] };
const DEFAULT_VIEW_PREFS = { showHero: true, showSearch: true, showPreview: true, showExport: true, resetSearchOnPanelClose: false, autoMapsSearchSync: true };
const DEFAULT_APPEARANCE_PREFS = { theme: 'classic-light', strongBorders: false, headingScale: 100, textScale: 100, controlScale: 100, cardSpacingScale: 10, phoneClickAction: 'auto', interfaceLanguage: 'en', customTheme: null };
const ATLAS_THEME_PRESETS = {
  'classic-light': { label: 'Classic Light', mode: 'light', palette: null },
  'classic-dark': { label: 'Classic Dark', mode: 'dark', palette: null },
  'orchard-glow': { label: 'Orchard Glow', mode: 'light', palette: 'orchard-glow' },
  'custom-theme': { label: 'Custom Theme', mode: 'light', palette: 'custom-theme' }
};
const ATLAS_LANGUAGES = [
  ['en','English','English'],['hi','Hindi','हिन्दी'],['pa','Punjabi','ਪੰਜਾਬੀ'],['ur','Urdu','اردو'],['bn','Bengali','বাংলা'],['ta','Tamil','தமிழ்'],['te','Telugu','తెలుగు'],['mr','Marathi','मराठी'],['gu','Gujarati','ગુજરાતી'],['kn','Kannada','ಕನ್ನಡ'],['ml','Malayalam','മലയാളം'],['or','Odia','ଓଡ଼ିଆ'],['as','Assamese','অসমীয়া'],['ne','Nepali','नेपाली'],['si','Sinhala','සිංහල'],['ar','Arabic','العربية'],['fa','Persian','فارسی'],['he','Hebrew','עברית'],['zh-CN','Chinese (Simplified)','简体中文'],['zh-TW','Chinese (Traditional)','繁體中文'],['ja','Japanese','日本語'],['ko','Korean','한국어'],['th','Thai','ไทย'],['vi','Vietnamese','Tiếng Việt'],['id','Indonesian','Bahasa Indonesia'],['ms','Malay','Bahasa Melayu'],['tl','Filipino','Filipino'],['my','Burmese','မြန်မာ'],['km','Khmer','ខ្មែរ'],['lo','Lao','ລາວ'],['ru','Russian','Русский'],['uk','Ukrainian','Українська'],['pl','Polish','Polski'],['cs','Czech','Čeština'],['sk','Slovak','Slovenčina'],['hu','Hungarian','Magyar'],['ro','Romanian','Română'],['bg','Bulgarian','Български'],['el','Greek','Ελληνικά'],['tr','Turkish','Türkçe'],['de','German','Deutsch'],['fr','French','Français'],['es','Spanish','Español'],['pt','Portuguese','Português'],['it','Italian','Italiano'],['nl','Dutch','Nederlands'],['sv','Swedish','Svenska'],['no','Norwegian','Norsk'],['da','Danish','Dansk'],['fi','Finnish','Suomi'],['is','Icelandic','Íslenska'],['et','Estonian','Eesti'],['lv','Latvian','Latviešu'],['lt','Lithuanian','Lietuvių'],['hr','Croatian','Hrvatski'],['sr','Serbian','Српски'],['sl','Slovenian','Slovenščina'],['sq','Albanian','Shqip'],['mk','Macedonian','Македонски'],['bs','Bosnian','Bosanski'],['ca','Catalan','Català'],['eu','Basque','Euskara'],['gl','Galician','Galego'],['af','Afrikaans','Afrikaans'],['sw','Swahili','Kiswahili'],['am','Amharic','አማርኛ'],['yo','Yoruba','Yorùbá'],['ig','Igbo','Igbo'],['ha','Hausa','Hausa'],['zu','Zulu','isiZulu'],['xh','Xhosa','isiXhosa'],['ga','Irish','Gaeilge'],['cy','Welsh','Cymraeg'],['mt','Maltese','Malti'],['lb','Luxembourgish','Lëtzebuergesch'],['kk','Kazakh','Қазақша'],['uz','Uzbek','Oʻzbekcha'],['mn','Mongolian','Монгол'],['ps','Pashto','پښتو'],['ku','Kurdish','Kurdî'],['hy','Armenian','Հայերեն'],['ka','Georgian','ქართული']
];

const CUSTOM_THEME_DEFAULTS = { name: 'My Atlas Theme', background: '#F5F8F5', surface: '#FFFFFF', primary: '#18724E', accent: '#BCEBD0', text: '#12251B' };
const SAVED_CUSTOM_THEMES_KEY = 'mapLeadSavedCustomThemes';
const DELETED_CUSTOM_THEMES_KEY = 'mapLeadDeletedCustomThemes';
let editingCustomThemeId = null;
function resolveAtlasTheme(value) {
  if (Object.prototype.hasOwnProperty.call(ATLAS_THEME_PRESETS, value)) return value;
  // Migrate the previous four separate swatches into the single combined palette.
  if (['lime-radiance', 'forest-canopy', 'ivory-haze', 'midnight-orchard'].includes(value)) return 'orchard-glow';
  return value === 'dark' ? 'classic-dark' : 'classic-light';
}
let querySaveTimer = null;
let mapsQuerySyncTimer = null;
let atlasToMapsSyncTimer = null;
let lastMapsObservedQuery = null;
let lastMapsObservedTabId = null;
let pendingAtlasToMapsSync = null;
let settingsSaveQueue = Promise.resolve();
const CONTACT_COLUMNS = ['name', 'phone', 'website', 'address', 'mapsUrl'];
const CORE_COLUMNS = ['name', 'category', 'rating', 'reviews', 'address', 'phone', 'website'];
const CUSTOM_COLUMN_PRESETS_KEY = 'mapLeadCustomColumnPresets';
const COLUMN_UNDO_HISTORY_KEY = 'mapLeadColumnUndoHistory';
const COLUMN_REDO_HISTORY_KEY = 'mapLeadColumnRedoHistory';
const COLUMN_UNDO_LIMIT_KEY = 'mapLeadColumnUndoHistoryLimit';
let columnUndoHistory = [];
let columnRedoHistory = [];
let columnUndoLimit = 10;
let lastSavedExportColumns = null;
let applyingColumnUndo = false;
const FILENAME_PREFS_KEY = 'mapLeadFilenamePrefs';
let customColumnPresets = [];
let manualFilenameBase = '';
let filenameSearchSignature = null;
let filenameSaveTimer = null;

const MESSAGE = {
  start: 'MAPLEADS_V130_START_SCAN',
  stop: 'MAPLEADS_V130_STOP_SCAN',
  pause: 'MAPLEADS_V130_PAUSE_SCAN',
  resume: 'MAPLEADS_V130_RESUME_SCAN',
  phones: 'MAPLEADS_V130_ENRICH_PHONES',
  resetData: 'MAPLEADS_V130_RESET_DATA'
};

function isGoogleMapsUrl(rawUrl) {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    const isGoogleHost = /(^|\.)google\.[a-z.]+$/i.test(host);
    if (!isGoogleHost) return false;
    // Google commonly uses www.google.tld/maps, while maps.google.tld may
    // legitimately serve the app at the root path. Support regional domains.
    const isMapsHost = host.startsWith('maps.google.');
    const hasMapsPath = /^\/maps(?:\/|$)/i.test(u.pathname);
    return hasMapsPath || (isMapsHost && (u.pathname === '/' || u.pathname === ''));
  } catch { return false; }
}

function isAutoMapsSearchSyncEnabled() {
  const toggle = $('autoMapsSearchSync');
  return toggle ? toggle.checked : true;
}

function updateMapsSyncControls() {
  const automatic = isAutoMapsSearchSyncEnabled();
  const note = $('mapsSyncNote');
  const manualButton = $('manualMapsSyncBtn');
  const openButton = $('openMapsBtn');
  const openLabel = openButton?.querySelector('span:first-child');
  const mapsDetected = Boolean(activeTab?.id && isGoogleMapsUrl(activeTab.url || ''));
  if (note) note.hidden = !automatic;

  // Reuse the primary action in manual mode so the user has one clear control.
  // Automatic mode opens a new Maps tab; manual mode updates the current Maps tab.
  if (openLabel) openLabel.textContent = 'Open Maps search';
  if (openButton) {
    openButton.dataset.searchMode = automatic ? 'new-tab' : 'current-tab';
    openButton.setAttribute('aria-label', 'Open Maps search');
    openButton.title = automatic ? 'Open this search in Google Maps; an open Maps tab can still be detected' : 'Search in the current Google Maps tab, or open Maps if none is active';
  }
  // Kept in the markup for backward-compatible selectors, but hidden because
  // the main button handles the manual action in one place now.
  if (manualButton) {
    manualButton.hidden = true;
    manualButton.disabled = true;
    manualButton.setAttribute('aria-hidden', 'true');
  }
}

function updateAnimatedSelect(wrapper) {
  const select = wrapper.querySelector('select');
  const value = wrapper.querySelector('.animated-select-value');
  const menu = wrapper.querySelector('.animated-select-menu');
  if (!select || !value || !menu) return;
  const selected = [...select.options].find((option) => option.value === select.value) || select.options[0];
  value.textContent = selected ? selected.textContent.trim() : '';
  for (const item of menu.querySelectorAll('[data-value]')) {
    const isSelected = item.dataset.value === select.value;
    item.setAttribute('aria-selected', String(isSelected));
  }
}

function closeAnimatedSelect(wrapper, returnFocus = false) {
  const menu = wrapper.querySelector('.animated-select-menu');
  const trigger = wrapper.querySelector('.animated-select-trigger');
  if (!menu || !trigger) return;
  window.clearTimeout(wrapper._atlasCloseTimer);
  wrapper.classList.remove('is-open');
  trigger.setAttribute('aria-expanded', 'false');
  menu.setAttribute('aria-hidden', 'true');
  wrapper._atlasCloseTimer = window.setTimeout(() => {
    if (!wrapper.classList.contains('is-open')) menu.hidden = true;
  }, 190);
  if (returnFocus) trigger.focus({ preventScroll: true });
}

function openAnimatedSelect(wrapper, focusSelected = false) {
  document.querySelectorAll('[data-animated-select].is-open').forEach((other) => {
    if (other !== wrapper) closeAnimatedSelect(other, false);
  });
  const menu = wrapper.querySelector('.animated-select-menu');
  const trigger = wrapper.querySelector('.animated-select-trigger');
  if (!menu || !trigger) return;
  window.clearTimeout(wrapper._atlasCloseTimer);
  menu.hidden = false;
  menu.setAttribute('aria-hidden', 'false');
  // Establish the closed starting style before applying the open transition.
  void menu.offsetWidth;
  wrapper.classList.add('is-open');
  trigger.setAttribute('aria-expanded', 'true');
  if (focusSelected) {
    window.requestAnimationFrame(() => {
      const selected = menu.querySelector('[aria-selected="true"]');
      (selected || menu.querySelector('[role="option"]'))?.focus({ preventScroll: true });
    });
  }
}

function syncAnimatedSelects() {
  // Also initialize dropdowns rendered later by conditional React panels (for example, the lead editor).
  initAnimatedSelects();
}

function populateAnimatedSelectMenu(wrapper) {
  const select = wrapper.querySelector('select');
  const menu = wrapper.querySelector('.animated-select-menu');
  if (!select || !menu) return;
  wrapper.dataset.atlasOptionsSignature = [...select.options].map(option => `${option.value}\u241f${option.textContent.trim()}\u241f${option.hidden ? 1 : 0}`).join('\u241e');
  menu.replaceChildren();
  for (const option of [...select.options].filter((item) => !item.hidden)) {
    const item = document.createElement('button');
    item.type = 'button';
    item.className = 'animated-select-option';
    item.setAttribute('role', 'option');
    item.dataset.value = option.value;
    const label = document.createElement('span');
    label.className = 'animated-option-label';
    label.textContent = option.textContent.trim();
    const check = document.createElement('span');
    check.className = 'animated-option-check';
    check.setAttribute('aria-hidden', 'true');
    check.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="m5 12 4.2 4.2L19 6.5"/></svg>';
    item.append(label, check);
    item.addEventListener('click', () => {
      if (select.value !== item.dataset.value) {
        select.value = item.dataset.value;
        updateAnimatedSelect(wrapper);
        select.dispatchEvent(new Event('change', { bubbles: true }));
      }
      closeAnimatedSelect(wrapper, true);
    });
    menu.appendChild(item);
  }
  updateAnimatedSelect(wrapper);
}

function initAnimatedSelects() {
  const wrappers = [...document.querySelectorAll('[data-animated-select]')];
  for (const wrapper of wrappers) {
    const select = wrapper.querySelector('select');
    const trigger = wrapper.querySelector('.animated-select-trigger');
    const menu = wrapper.querySelector('.animated-select-menu');
    if (!select || !trigger || !menu) continue;
    if (wrapper.dataset.atlasSelectInitialized === 'true') {
      const signature = [...select.options].map(option => `${option.value}\u241f${option.textContent.trim()}\u241f${option.hidden ? 1 : 0}`).join('\u241e');
      if (wrapper.dataset.atlasOptionsSignature !== signature) populateAnimatedSelectMenu(wrapper);
      else updateAnimatedSelect(wrapper);
      continue;
    }
    populateAnimatedSelectMenu(wrapper);
    wrapper.dataset.atlasSelectInitialized = 'true';
    trigger.addEventListener('click', () => {
      if (wrapper.classList.contains('is-open')) closeAnimatedSelect(wrapper, false);
      else openAnimatedSelect(wrapper, false);
    });
    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        openAnimatedSelect(wrapper, true);
      } else if (event.key === 'Escape' && wrapper.classList.contains('is-open')) {
        event.preventDefault();
        closeAnimatedSelect(wrapper, true);
      }
    });
    menu.addEventListener('keydown', (event) => {
      const items = [...menu.querySelectorAll('[role="option"]')];
      const current = items.indexOf(document.activeElement);
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
        event.preventDefault();
        const delta = event.key === 'ArrowDown' ? 1 : -1;
        items[(Math.max(0, current) + delta + items.length) % items.length]?.focus({ preventScroll: true });
      } else if (event.key === 'Home' || event.key === 'End') {
        event.preventDefault();
        (event.key === 'Home' ? items[0] : items[items.length - 1])?.focus({ preventScroll: true });
      } else if (event.key === 'Escape') {
        event.preventDefault();
        closeAnimatedSelect(wrapper, true);
      }
    });
    select.addEventListener('change', () => updateAnimatedSelect(wrapper));
    updateAnimatedSelect(wrapper);
  }
  if (!window.__atlasAnimatedSelectOutsideClickBound) {
    document.addEventListener('click', (event) => {
      document.querySelectorAll('[data-animated-select].is-open').forEach((wrapper) => {
        if (!wrapper.contains(event.target)) closeAnimatedSelect(wrapper, false);
      });
    });
    window.__atlasAnimatedSelectOutsideClickBound = true;
  }
}
function dismissToast() {
  const toast = $('toast');
  if (!toast) return;
  window.clearTimeout(toastTimer);
  window.clearTimeout(toastExitTimer);
  if (toast.classList.contains('hidden')) return;
  toast.classList.remove('is-visible');
  toast.classList.add('is-exiting');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  toastExitTimer = window.setTimeout(() => {
    toast.classList.add('hidden');
    toast.classList.remove('is-exiting', 'toast-success');
  }, reducedMotion ? 0 : 260);
}

function showToast(message, options = {}) {
  const toast = $('toast');
  if (!toast) return;
  const title = options.title || 'Atlas';
  const persistent = Boolean(options.persistent);
  window.clearTimeout(toastTimer);
  window.clearTimeout(toastExitTimer);
  $('toastTitle').textContent = title;
  $('toastMessage').textContent = String(message || '');
  toast.classList.toggle('toast-success', options.kind === 'success');
  toast.classList.remove('hidden', 'is-exiting');
  // Two frames guarantee the entry state is painted before the transition starts.
  toast.classList.remove('is-visible');
  requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('is-visible')));
  if (!persistent) toastTimer = window.setTimeout(dismissToast, 3600);
}

let completionAudioContext = null;
let completionReturnFocus = null;
let completionExitTimer = null;

function primeCompletionSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!completionAudioContext) completionAudioContext = new AudioContextClass();
    if (completionAudioContext.state === 'suspended') {
      completionAudioContext.resume().catch(() => {});
    }
  } catch (_) {
    // Audio is a progressive enhancement; the visual completion notification still works.
  }
}

function playCompletionSound() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    if (!completionAudioContext) completionAudioContext = new AudioContextClass();
    const ctx = completionAudioContext;
    const play = () => {
      const now = ctx.currentTime + 0.025;
      // Soft three-note confirmation chime (no external sound file or network access).
      [659.25, 783.99, 987.77].forEach((frequency, index) => {
        const start = now + index * 0.105;
        const oscillator = ctx.createOscillator();
        const gain = ctx.createGain();
        oscillator.type = 'sine';
        oscillator.frequency.setValueAtTime(frequency, start);
        gain.gain.setValueAtTime(0.0001, start);
        gain.gain.exponentialRampToValueAtTime(0.075, start + 0.018);
        gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.24);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.26);
        oscillator.onended = () => { oscillator.disconnect(); gain.disconnect(); };
      });
    };
    if (ctx.state === 'suspended') {
      ctx.resume().then(play).catch(() => { /* Sound may be blocked by browser policy. */ });
    } else {
      play();
    }
  } catch (_) {
    // Silently fall back to the visual notification when Web Audio is unavailable.
  }
}

function showCompletionNotice(title, message) {
  const overlay = $('completionOverlay');
  if (!overlay) {
    showToast(message, { title, persistent: true, kind: 'success' });
    playCompletionSound();
    return;
  }
  window.clearTimeout(completionExitTimer);
  completionReturnFocus = document.activeElement;
  $('completionTitle').textContent = title;
  $('completionMessage').textContent = String(message || 'Your task has finished.');
  overlay.classList.remove('hidden', 'is-exiting');
  overlay.setAttribute('aria-hidden', 'false');
  overlay.classList.remove('is-visible');
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-visible')));
  playCompletionSound();
  window.setTimeout(() => $('completionCloseBtn')?.focus({ preventScroll: true }), 40);
}

function dismissCompletionNotice() {
  const overlay = $('completionOverlay');
  if (!overlay || overlay.classList.contains('hidden')) return;
  window.clearTimeout(completionExitTimer);
  overlay.classList.remove('is-visible');
  overlay.classList.add('is-exiting');
  overlay.setAttribute('aria-hidden', 'true');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  completionExitTimer = window.setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.classList.remove('is-exiting');
    const target = completionReturnFocus;
    completionReturnFocus = null;
    if (target?.isConnected && !overlay.contains(target) && typeof target.focus === 'function') {
      target.focus({ preventScroll: true });
    }
  }, reducedMotion ? 0 : 300);
}

let datasetChoiceResolver = null;
let datasetChoiceReturnFocus = null;

function datasetSearchSignature(query, location) {
  return JSON.stringify([normalizeSearchSignature(query), normalizeSearchSignature(location)]);
}

async function captureDatasetSearch(tab) {
  let query = $('queryInput')?.value.trim() || '';
  let location = $('locationInput')?.value.trim() || '';
  try {
    const liveSearch = await readMapsSearch(tab);
    const raw = String(liveSearch?.query || '').trim();
    if (raw) {
      const parts = AtlasExport.normalizeFilenameParts(raw, '');
      query = parts.query || raw;
      if (parts.location) location = parts.location;
    }
  } catch { /* Use Atlas' synchronized fields if the live search cannot be read. */ }
  return {
    query,
    location,
    label: [query, location].filter(Boolean).join(', ') || 'Current Google Maps search',
    signature: datasetSearchSignature(query, location)
  };
}

function closeDatasetChoice(choice) {
  const overlay = $('datasetChoiceOverlay');
  if (!overlay || !datasetChoiceResolver) return;
  const resolve = datasetChoiceResolver;
  datasetChoiceResolver = null;
  overlay.classList.remove('is-visible');
  overlay.classList.add('is-exiting');
  overlay.setAttribute('aria-hidden', 'true');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  window.setTimeout(() => {
    overlay.classList.add('hidden');
    overlay.classList.remove('is-exiting');
    const focusTarget = datasetChoiceReturnFocus;
    datasetChoiceReturnFocus = null;
    if (focusTarget?.isConnected && typeof focusTarget.focus === 'function') focusTarget.focus({ preventScroll: true });
  }, reducedMotion ? 0 : 210);
  resolve(choice);
}

function askDatasetChoice({ count, previousSearch, nextSearch }) {
  const overlay = $('datasetChoiceOverlay');
  if (!overlay) return Promise.resolve('append');
  datasetChoiceReturnFocus = document.activeElement;
  const previousLabel = $('datasetPreviousLabel');
  const nextLabel = $('datasetNextLabel');
  const message = $('datasetChoiceMessage');
  if (previousLabel) previousLabel.textContent = previousSearch?.label || 'Existing saved records (search label unavailable)';
  if (nextLabel) nextLabel.textContent = nextSearch.label;
  if (message) {
    message.textContent = `Atlas already has ${count.toLocaleString()} saved listing${count === 1 ? '' : 's'}, and this Maps search is different. Choose whether to keep them or start with a clean dataset.`;
  }
  overlay.classList.remove('hidden', 'is-exiting');
  overlay.setAttribute('aria-hidden', 'false');
  overlay.classList.remove('is-visible');
  requestAnimationFrame(() => requestAnimationFrame(() => overlay.classList.add('is-visible')));
  return new Promise((resolve) => {
    datasetChoiceResolver = resolve;
    window.setTimeout(() => $('datasetAppendBtn')?.focus({ preventScroll: true }), 35);
  });
}

function wireDatasetChoiceDialog() {
  $('datasetAppendBtn')?.addEventListener('click', () => closeDatasetChoice('append'));
  $('datasetResetBtn')?.addEventListener('click', () => closeDatasetChoice('reset'));
  $('datasetCancelBtn')?.addEventListener('click', () => closeDatasetChoice('cancel'));
  $('datasetChoiceOverlay')?.addEventListener('click', (event) => {
    if (event.target === $('datasetChoiceOverlay')) closeDatasetChoice('cancel');
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && !$('datasetChoiceOverlay')?.classList.contains('hidden')) {
      event.preventDefault();
      closeDatasetChoice('cancel');
    }
  });
}

function notifyRunCompletion(previousStatus, nextStatus) {
  if (!previousStatus?.running || !nextStatus || nextStatus.running || nextStatus.error || nextStatus.interrupted) return;
  const statusMessage = String(nextStatus.message || '');
  if (nextStatus.mode === 'scan' && nextStatus.phase === 'done') {
    const collected = Number(nextStatus.collected) || 0;
    const total = Number(nextStatus.total) || 0;
    showCompletionNotice('Scraping complete', `${collected.toLocaleString()} new listings collected · ${total.toLocaleString()} total saved.`);
    return;
  }
  if (nextStatus.mode === 'phones' && /^Phone lookup finished\./i.test(statusMessage) && !/stopped/i.test(statusMessage)) {
    const detail = statusMessage.replace(/^Phone lookup finished\.\s*/i, '');
    showCompletionNotice('Phone lookup complete', detail || 'Phone number lookup has finished.');
  }
}

async function getActiveTab() {
  const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
  if (tabs[0]) return tabs[0];
  const fallback = await chrome.tabs.query({ active: true, currentWindow: true });
  return fallback[0] || null;
}

// Keep the Maps tab from being automatically discarded while Atlas is collecting.
// The service worker restores the tab's original setting as soon as the job ends.
async function protectMapsTabForBackgroundTask(tab) {
  if (!Number.isInteger(tab?.id)) return {};
  const previousAutoDiscardable = tab.autoDiscardable !== false;
  try {
    await chrome.tabs.update(tab.id, { autoDiscardable: false });
    return {
      atlasManagedAutoDiscardable: true,
      atlasPreviousAutoDiscardable: previousAutoDiscardable
    };
  } catch (error) {
    console.info('Atlas could not disable automatic tab discard; collection will continue normally.', error);
    return {};
  }
}

async function findMapsTab(preferredTabId = null) {
  // Don't rely exclusively on the panel's last tab snapshot: the tab can
  // navigate from Google Search to Maps, or a Maps tab can load slowly.
  const allTabs = await chrome.tabs.query({});
  let currentWindowId = null;
  try { currentWindowId = (await chrome.windows.getLastFocused()).id; } catch {}
  const isMapsTab = (tab) => Boolean(tab && isGoogleMapsUrl(tab.url || ''));
  const activeCurrent = allTabs.find((tab) => tab.active && tab.windowId === currentWindowId);
  if (isMapsTab(activeCurrent)) return activeCurrent;

  const idCandidates = [preferredTabId, lastStatus?.tabId].filter((v) => Number.isInteger(v));
  for (const id of idCandidates) {
    const candidate = allTabs.find((tab) => tab.id === id);
    if (isMapsTab(candidate)) return candidate;
  }

  const recency = (a, b) => Number(b.lastAccessed || 0) - Number(a.lastAccessed || 0);
  const currentMaps = allTabs.filter((tab) => tab.windowId === currentWindowId && isMapsTab(tab)).sort(recency);
  if (currentMaps.length) return currentMaps[0];
  const anyMaps = allTabs.filter(isMapsTab).sort(recency);
  return anyMaps[0] || activeCurrent || (await getActiveTab());
}

function recordKey(record) {
  const url = String(record?.mapsUrl || '').split('?')[0];
  return url.toLowerCase() || String(record?.name || '').trim().toLowerCase();
}

function filenameExtension(format = $('exportFormat')?.value || 'csv') {
  return ({ xlsx: 'xlsx', csv: 'csv', json: 'json', tsv: 'tsv' })[format] || 'csv';
}

function cleanFilenameBase(value) {
  return String(value || '')
    .trim()
    .replace(/\.(?:xlsx|csv|json|tsv)$/i, '')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/[\u0000-\u001f]/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
    .slice(0, 140)
    .replace(/[ ,.-]+$/g, '')
    .trim();
}

function currentFilenameSearchSignature() {
  return JSON.stringify([
    normalizeSearchSignature($('queryInput')?.value || ''),
    normalizeSearchSignature($('locationInput')?.value || '')
  ]);
}

function clearManualFilenameForNewSearch() {
  const signature = currentFilenameSearchSignature();
  if (filenameSearchSignature === null) {
    filenameSearchSignature = signature;
    return;
  }
  if (signature === filenameSearchSignature) return;
  filenameSearchSignature = signature;
  manualFilenameBase = '';
  window.clearTimeout(filenameSaveTimer);
  chrome.storage.local.remove(FILENAME_PREFS_KEY).catch(() => {});
}

function currentExportFilename() {
  const format = $('exportFormat').value || 'csv';
  const query = $('queryInput').value.trim();
  const location = $('locationInput').value.trim();
  const fallbackUrl = activeTab?.url || '';
  const manualBase = cleanFilenameBase(manualFilenameBase);
  if (manualBase) return `${manualBase || 'Atlas Export'}.${filenameExtension(format)}`;
  return AtlasExport.makeFilename(query, location, format, fallbackUrl);
}

function updateFilenamePreview() {
  clearManualFilenameForNewSearch();
  const input = $('filenameInput');
  if (!input) return;
  // Keep the user's caret and uncommitted text intact while they are typing.
  if (document.activeElement !== input) input.value = currentExportFilename();
  const mode = $('filenameModeLabel');
  if (mode) {
    const isManual = Boolean(cleanFilenameBase(manualFilenameBase));
    mode.textContent = isManual ? 'Manual' : 'Auto-named';
    mode.classList.toggle('is-manual', isManual);
  }
}

async function persistManualFilename() {
  clearManualFilenameForNewSearch();
  const base = cleanFilenameBase($('filenameInput').value);
  manualFilenameBase = base;
  if (!base) {
    await chrome.storage.local.remove(FILENAME_PREFS_KEY);
    updateFilenamePreview();
    return;
  }
  await chrome.storage.local.set({
    [FILENAME_PREFS_KEY]: {
      manualBase: base,
      searchSignature: currentFilenameSearchSignature(),
      updatedAt: Date.now()
    }
  });
  const input = $('filenameInput');
  const mode = $('filenameModeLabel');
  if (mode) { mode.textContent = 'Manual'; mode.classList.add('is-manual'); }
  if (document.activeElement !== input) updateFilenamePreview();
}

function scheduleManualFilenameSave() {
  window.clearTimeout(filenameSaveTimer);
  filenameSaveTimer = window.setTimeout(() => { persistManualFilename(); }, 250);
}

function selectedExportColumns() {
  return [...document.querySelectorAll('[data-export-column]:checked')].map((input) => input.value);
}

function updateColumnCount() {
  const selectedCount = selectedExportColumns().length;
  $('columnCount').textContent = `${selectedCount} selected`;
  $('exportBtn').disabled = selectedCount === 0 || Number($('exportCount').textContent.replace(/,/g, '')) === 0;
}

async function saveExportColumns() {
  const keys = selectedExportColumns();
  const previous = Array.isArray(lastSavedExportColumns) ? lastSavedExportColumns : null;
  const changed = previous && (previous.length !== keys.length || previous.some((key, index) => key !== keys[index]));
  if (!applyingColumnUndo && changed) {
    const stored = await chrome.storage.local.get(COLUMN_UNDO_HISTORY_KEY);
    const history = Array.isArray(stored[COLUMN_UNDO_HISTORY_KEY]) ? stored[COLUMN_UNDO_HISTORY_KEY].slice() : columnUndoHistory.slice();
    history.push(previous.slice());
    columnUndoHistory = history.slice(-columnUndoLimit);
    columnRedoHistory = [];
    await chrome.storage.local.set({ [COLUMN_UNDO_HISTORY_KEY]: columnUndoHistory, [COLUMN_REDO_HISTORY_KEY]: columnRedoHistory, mapLeadExportColumns: keys });
  } else {
    await chrome.storage.local.set({ mapLeadExportColumns: keys });
  }
  lastSavedExportColumns = keys.slice();
  updateColumnCount();
  updateUndoButton();
}

function builtInColumnPresets() {
  const all = [...document.querySelectorAll('[data-export-column]')].map((input) => input.value);
  return [
    { id: 'builtin-all', name: 'All columns', columns: all },
    { id: 'builtin-recommended', name: 'Recommended', columns: DEFAULT_EXPORT_COLUMNS },
    { id: 'builtin-core', name: 'Core', columns: CORE_COLUMNS },
    { id: 'builtin-contact', name: 'Contact', columns: CONTACT_COLUMNS }
  ];
}

function capitalizePresetInitial(value) {
  const name = String(value ?? '');
  return name ? name.charAt(0).toLocaleUpperCase() + name.slice(1) : '';
}

function normalizedPresetName(value) {
  const name = String(value ?? '').trim().replace(/\s+/g, ' ');
  return capitalizePresetInitial(name);
}

function renderPresetChips() {
  const list = $('presetChipList');
  if (!list) return;
  list.replaceChildren();
  const query = String($('columnPresetSearch')?.value || '').trim().toLocaleLowerCase();
  const presets = [...builtInColumnPresets(), ...customColumnPresets]
    .filter((preset) => !query || String(preset.name).toLocaleLowerCase().includes(query));
  if (!presets.length) {
    const empty = document.createElement('p');
    empty.className = 'preset-no-results';
    empty.textContent = 'No presets match your search.';
    list.append(empty);
    return;
  }
  for (const preset of presets) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'preset-chip';
    button.dataset.presetType = String(preset.id).startsWith('builtin-') ? 'builtin' : 'custom';
    button.textContent = preset.name;
    button.title = `Apply ${preset.name} column selection`;
    button.addEventListener('click', () => applyColumnSelection(preset.columns, preset.name));
    list.append(button);
  }
}

function renderCustomColumnPresets(keepId = null) {
  const select = $('savedColumnPresetSelect');
  if (!select) return;
  const wantedId = keepId ?? select.value;
  select.replaceChildren(new Option('Choose a saved preset', ''));
  for (const preset of customColumnPresets) {
    const option = new Option(preset.name, preset.id);
    select.add(option);
  }
  select.value = customColumnPresets.some((preset) => preset.id === wantedId) ? wantedId : '';
  const presetWrapper = document.querySelector('[data-animated-select="savedColumnPreset"]');
  if (presetWrapper) populateAnimatedSelectMenu(presetWrapper);
  const hasPreset = Boolean(select.value);
  $('deleteColumnPresetBtn').disabled = !hasPreset;
  renderPresetChips();
}

async function persistCustomColumnPresets() {
  await chrome.storage.local.set({ [CUSTOM_COLUMN_PRESETS_KEY]: customColumnPresets });
}

async function applyColumnSelection(columns, name) {
  const validKeys = new Set([...document.querySelectorAll('[data-export-column]')].map((input) => input.value));
  const keys = new Set((Array.isArray(columns) ? columns : []).filter((key) => validKeys.has(key)));
  document.querySelectorAll('[data-export-column]').forEach((input) => { input.checked = keys.has(input.value); });
  await saveExportColumns();
  await refreshUI();
  showToast(`Applied preset: ${name}`);
}

async function applyCustomColumnPreset() {
  const preset = customColumnPresets.find((item) => item.id === $('savedColumnPresetSelect').value);
  if (!preset) return;
  await applyColumnSelection(preset.columns, preset.name);
}

async function saveCustomColumnPreset() {
  const input = $('columnPresetName');
  const name = normalizedPresetName(input.value);
  const columns = selectedExportColumns();
  if (!name) { showToast('Enter a name for this preset first.'); input.focus(); return; }
  if (!columns.length) { showToast('Select at least one column before saving a preset.'); return; }
  const existing = customColumnPresets.find((preset) => preset.name.toLocaleLowerCase() === name.toLocaleLowerCase());
  if (existing && !confirm(`A preset named "${existing.name}" already exists. Replace its column selection?`)) return;
  const id = existing?.id || (globalThis.crypto?.randomUUID ? crypto.randomUUID() : `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`);
  const next = { id, name, columns, updatedAt: Date.now() };
  customColumnPresets = existing
    ? customColumnPresets.map((preset) => preset.id === existing.id ? next : preset)
    : [...customColumnPresets, next];
  await persistCustomColumnPresets();
  renderCustomColumnPresets(id);
  input.value = '';
  showToast(`Saved preset "${name}" with ${columns.length} columns.`);
}

async function deleteCustomColumnPreset() {
  const select = $('savedColumnPresetSelect');
  const preset = customColumnPresets.find((item) => item.id === select.value);
  if (!preset) return;
  if (!confirm(`Delete the saved preset "${preset.name}"?`)) return;
  customColumnPresets = customColumnPresets.filter((item) => item.id !== preset.id);
  await persistCustomColumnPresets();
  renderCustomColumnPresets();
  showToast(`Deleted preset "${preset.name}".`);
}

function updateUndoButton() {
  const undo = $('undoColumnsBtn');
  const redo = $('redoColumnsBtn');
  if (undo) undo.disabled = !Array.isArray(columnUndoHistory) || columnUndoHistory.length === 0;
  if (redo) redo.disabled = !Array.isArray(columnRedoHistory) || columnRedoHistory.length === 0;
}

async function applyHistorySelection(keysToApply, message) {
  applyingColumnUndo = true;
  try {
    const validKeys = new Set([...document.querySelectorAll('[data-export-column]')].map((input) => input.value));
    const keys = new Set((Array.isArray(keysToApply) ? keysToApply : []).filter((key) => validKeys.has(key)));
    document.querySelectorAll('[data-export-column]').forEach((input) => { input.checked = keys.has(input.value); });
    lastSavedExportColumns = selectedExportColumns();
    await chrome.storage.local.set({ mapLeadExportColumns: lastSavedExportColumns });
    await refreshUI();
    showToast(message);
  } finally {
    applyingColumnUndo = false;
    updateUndoButton();
  }
}

async function undoColumnSelection() {
  if (!columnUndoHistory.length) { showToast('No previous column selection to restore.'); return; }
  const previous = columnUndoHistory.pop();
  const current = selectedExportColumns();
  columnRedoHistory.push(current);
  columnRedoHistory = columnRedoHistory.slice(-columnUndoLimit);
  await chrome.storage.local.set({ [COLUMN_UNDO_HISTORY_KEY]: columnUndoHistory, [COLUMN_REDO_HISTORY_KEY]: columnRedoHistory });
  await applyHistorySelection(previous, 'Restored previous column selection.');
}

async function redoColumnSelection() {
  if (!columnRedoHistory.length) { showToast('No column selection to redo.'); return; }
  const next = columnRedoHistory.pop();
  const current = selectedExportColumns();
  columnUndoHistory.push(current);
  columnUndoHistory = columnUndoHistory.slice(-columnUndoLimit);
  await chrome.storage.local.set({ [COLUMN_UNDO_HISTORY_KEY]: columnUndoHistory, [COLUMN_REDO_HISTORY_KEY]: columnRedoHistory });
  await applyHistorySelection(next, 'Reapplied column selection.');
}

async function saveUndoHistoryLimit() {
  const input = $('undoHistoryLimit');
  const value = Math.max(1, Math.min(50, Number.parseInt(input?.value || '10', 10) || 10));
  columnUndoLimit = value;
  if (input) input.value = String(value);
  const output = $('undoHistoryLimitValue');
  if (output) output.textContent = `${value} saved`;
  columnUndoHistory = columnUndoHistory.slice(-columnUndoLimit);
  columnRedoHistory = columnRedoHistory.slice(-columnUndoLimit);
  await chrome.storage.local.set({ [COLUMN_UNDO_LIMIT_KEY]: columnUndoLimit, [COLUMN_UNDO_HISTORY_KEY]: columnUndoHistory, [COLUMN_REDO_HISTORY_KEY]: columnRedoHistory });
  updateUndoButton();
}

async function requestMapsPermission(tabHint = null) {
  try {
    // Ask only for the Maps origin the user chose to use, when identifiable.
    // If Chrome hides the URL before the optional permission is granted, start
    // with Google's standard Maps origin and detect again after permission.
    let origins = MAPS_PERMISSION.origins;
    if (tabHint?.url) {
      try {
        const u = new URL(tabHint.url);
        if (isGoogleMapsUrl(u.href)) origins = [`${u.origin}/*`];
      } catch {}
    }
    return await chrome.permissions.request({ origins });
  } catch (error) {
    console.warn('Maps permission request failed', error);
    return false;
  }
}

async function saveQueryPreferences(patch = {}) {
  const { mapLeadQueryPrefs = {} } = await chrome.storage.local.get('mapLeadQueryPrefs');
  await chrome.storage.local.set({
    mapLeadQueryPrefs: {
      ...mapLeadQueryPrefs,
      query: $('queryInput').value.trim(),
      location: $('locationInput').value.trim(),
      format: $('exportFormat').value || mapLeadQueryPrefs.format || 'csv',
      ...patch
    }
  });
}

function applyViewPreferences(prefs = {}) {
  const merged = { ...DEFAULT_VIEW_PREFS, ...(prefs || {}) };
  for (const [key, value] of Object.entries(merged)) {
    const checkbox = document.querySelector(`[data-view-option="${key}"]`);
    if (checkbox) checkbox.checked = Boolean(value);
    const section = document.querySelector(`[data-view-section="${key}"]`);
    if (section) section.hidden = !value;
  }
  $('resetSearchOnPanelClose').checked = merged.resetSearchOnPanelClose !== false;
  $('autoMapsSearchSync').checked = merged.autoMapsSearchSync !== false;
  updateMapsSyncControls();
}

async function persistSettingsPatch({ viewPatch = null, appearancePatch = null } = {}) {
  // Serialize preference writes so two quick settings changes cannot overwrite
  // each other with stale snapshots from chrome.storage.local.
  const write = settingsSaveQueue.then(async () => {
    const stored = await chrome.storage.local.get(['mapLeadViewPrefs', 'mapLeadAppearancePrefs']);
    const view = { ...DEFAULT_VIEW_PREFS, ...(stored.mapLeadViewPrefs || {}), ...(viewPatch || {}) };
    const appearance = { ...DEFAULT_APPEARANCE_PREFS, ...(stored.mapLeadAppearancePrefs || {}), ...(appearancePatch || {}) };
    await chrome.storage.local.set({ mapLeadViewPrefs: view, mapLeadAppearancePrefs: appearance });
    applyViewPreferences(view);
    applyAppearancePreferences(appearance);
    return { view, appearance };
  });
  settingsSaveQueue = write.catch((error) => {
    console.error('Atlas could not save settings:', error);
  });
  try { return await write; }
  catch (error) {
    showToast('Atlas could not save your settings. Check Chrome extension storage and try again.');
    throw error;
  }
}

async function saveViewPreferences() {
  const prefs = {};
  for (const key of ['showHero', 'showSearch', 'showPreview', 'showExport']) {
    const checkbox = document.querySelector(`[data-view-option="${key}"]`);
    if (checkbox) prefs[key] = checkbox.checked;
  }
  prefs.resetSearchOnPanelClose = $('resetSearchOnPanelClose').checked;
  prefs.autoMapsSearchSync = $('autoMapsSearchSync').checked;
  await persistSettingsPatch({ viewPatch: prefs });
}

function normalizeScale(value, min = 85, max = 130) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.min(max, Math.max(min, Math.round(parsed))) : 100;
}

function updateScaleSliderTrack(input) {
  if (!input) return;
  const min = Number(input.min || 0);
  const max = Number(input.max || 100);
  const value = Number(input.value || min);
  const percentage = max > min ? ((value - min) / (max - min)) * 100 : 0;
  input.style.setProperty('--slider-fill', `${Math.max(0, Math.min(100, percentage))}%`);
  input.setAttribute('aria-valuetext', `${Math.round(value)}%`);
}

let atlasTypographyObserver = null;
let atlasLastScaleValues = { headingScale: 100, textScale: 100 };

function applyUniversalTextScale(values = atlasLastScaleValues) {
  const root = document.documentElement;
  const targetHeadings = String((values.headingScale || 100) / 100);
  const targetText = String((values.textScale || 100) / 100);
  // Neutralize existing multipliers when recording the baseline, preventing cumulative scaling.
  root.style.setProperty('--atlas-scale-headings', '1');
  root.style.setProperty('--atlas-scale-text', '1');
  const scope = document.getElementById('atlas-root') || document.body;
  const nodes = [];
  if (scope instanceof Element) nodes.push(scope);
  if (scope && scope.querySelectorAll) nodes.push(...scope.querySelectorAll('*'));
  const headingSelector = 'h1,h2,h3,h4,h5,h6,[role="heading"],.brand-name,.section-number,.quality-score-title,.quality-score-value,.quality-metric-value';
  for (const element of nodes) {
    if (!(element instanceof Element) || element.matches('svg,script,style,noscript') || element.closest('svg,script,style,noscript')) continue;
    const isControl = element.matches('input,select,textarea,option');
    const hasDirectText = Array.from(element.childNodes).some(node => node.nodeType === Node.TEXT_NODE && String(node.nodeValue || '').trim());
    if (!hasDirectText && !isControl) continue;
    if (!element.dataset.atlasFontBasePx) {
      const size = Number.parseFloat(getComputedStyle(element).fontSize);
      if (Number.isFinite(size) && size > 0) element.dataset.atlasFontBasePx = String(size);
    }
    const base = Number.parseFloat(element.dataset.atlasFontBasePx || '');
    if (!Number.isFinite(base) || base <= 0) continue;
    const scaleName = element.matches(headingSelector) ? 'headings' : 'text';
    element.style.setProperty('font-size', `calc(${base}px * var(--atlas-scale-${scaleName}, 1))`, 'important');
  }
  root.style.setProperty('--atlas-scale-headings', targetHeadings);
  root.style.setProperty('--atlas-scale-text', targetText);
  if (!atlasTypographyObserver && scope) {
    atlasTypographyObserver = new MutationObserver(mutations => {
      const hasAddedContent = mutations.some(mutation => Array.from(mutation.addedNodes || []).some(node => node.nodeType === Node.ELEMENT_NODE || (node.nodeType === Node.TEXT_NODE && String(node.nodeValue || '').trim())));
      if (hasAddedContent) applyUniversalTextScale(atlasLastScaleValues);
    });
    atlasTypographyObserver.observe(scope, { childList: true, subtree: true });
  }
}

function applyUIScalePreferences(prefs = {}) {
  const values = {
    headingScale: normalizeScale(prefs.headingScale, 85, 130),
    textScale: normalizeScale(prefs.textScale, 85, 130),
    controlScale: normalizeScale(prefs.controlScale, 85, 120),
    cardSpacingScale: normalizeScale(prefs.cardSpacingScale, 4, 24)
  };
  const root = document.documentElement;
  root.style.setProperty('--atlas-scale-headings', String(values.headingScale / 100));
  root.style.setProperty('--atlas-scale-text', String(values.textScale / 100));
  root.style.setProperty('--atlas-scale-controls', String(values.controlScale / 100));
  root.style.setProperty('--atlas-card-gap', `${values.cardSpacingScale}px`);
  atlasLastScaleValues = values;
  applyUniversalTextScale(values);
  for (const [key, id] of [['headingScale', 'headingScale'], ['textScale', 'textScale'], ['controlScale', 'controlScale'], ['cardSpacingScale', 'cardSpacingScale']]) {
    const input = $(id);
    const output = $(`${id}Value`);
    if (input) {
      input.value = String(values[key]);
      updateScaleSliderTrack(input);
    }
    if (output) output.textContent = key === 'cardSpacingScale' ? `${values[key]} px` : `${values[key]}%`;
  }
}

function applyUIScalePreview() {
  applyUIScalePreferences({
    headingScale: $('headingScale')?.value,
    textScale: $('textScale')?.value,
    controlScale: $('controlScale')?.value,
    cardSpacingScale: $('cardSpacingScale')?.value
  });
}

function applyAppearancePreferences(prefs = {}) {
  const merged = { ...DEFAULT_APPEARANCE_PREFS, ...(prefs || {}) };
  const themeKey = resolveAtlasTheme(merged.theme);
  const preset = ATLAS_THEME_PRESETS[themeKey] || ATLAS_THEME_PRESETS['classic-light'];
  const theme = preset.mode;
  document.body.dataset.theme = theme;
  if (preset.palette) document.body.dataset.palette = preset.palette;
  else delete document.body.dataset.palette;
  if (themeKey === 'custom-theme' && merged.customTheme) {
    const colors = normalizeCustomTheme(merged.customTheme);
    const root = document.body.style;
    root.setProperty('--paper', colors.background); root.setProperty('--white', colors.surface);
    root.setProperty('--green', colors.primary); root.setProperty('--green-dark', colors.text);
    root.setProperty('--green-deep', colors.primary); root.setProperty('--mint', colors.accent);
    root.setProperty('--mint-strong', colors.accent); root.setProperty('--quality-track', colors.accent);
    root.setProperty('--ink', colors.text); root.setProperty('--muted', colors.text);
    root.setProperty('--quiet', colors.text); root.setProperty('--line', colors.primary);
    root.setProperty('--atlas-field', colors.surface); root.setProperty('--atlas-table-head', colors.primary);
    root.setProperty('--atlas-button-text', contrastText(colors.primary)); root.setProperty('--atlas-soft', colors.accent);
    root.setProperty('--atlas-scroll-track', colors.background); root.setProperty('--atlas-scroll-thumb', colors.primary);
    document.documentElement.style.colorScheme = 'light';
  } else {
    ['--paper','--white','--green','--green-dark','--green-deep','--mint','--mint-strong','--quality-track','--ink','--muted','--quiet','--line','--atlas-field','--atlas-table-head','--atlas-button-text','--atlas-soft','--atlas-scroll-track','--atlas-scroll-thumb'].forEach((key) => document.body.style.removeProperty(key));
    document.documentElement.style.colorScheme = theme === 'dark' ? 'dark' : 'light';
  }
  document.body.classList.toggle('strong-borders', Boolean(merged.strongBorders));
  applyUIScalePreferences(merged);
  const borderToggle = $('strongBordersToggle');
  if (borderToggle) borderToggle.checked = Boolean(merged.strongBorders);
  const phoneAction = $('phoneClickAction');
  if (phoneAction) phoneAction.value = ['auto', 'whatsapp', 'clipboard'].includes(merged.phoneClickAction) ? merged.phoneClickAction : 'auto';
  const themeSelect = $('themePreset');
  if (themeSelect) {
    if (![...themeSelect.options].some((option) => option.value === 'custom-theme')) { themeSelect.add(new Option('Custom Theme', 'custom-theme')); const themeWrapper = document.querySelector('[data-animated-select="themePreset"]'); if (themeWrapper) populateAnimatedSelectMenu(themeWrapper); }
    themeSelect.value = themeKey;
    const wrapper = document.querySelector('[data-animated-select="themePreset"]');
    if (wrapper) updateAnimatedSelect(wrapper);
  }
  const button = $('themeToggle');
  if (button) {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    const message = `Switch to ${nextTheme} appearance`;
    button.title = message;
    button.setAttribute('aria-label', message);
  }
}

async function saveAppearancePreferences(patch = {}) {
  const controls = {
    strongBorders: $('strongBordersToggle').checked,
    headingScale: Number($('headingScale')?.value || 100),
    textScale: Number($('textScale')?.value || 100),
    controlScale: Number($('controlScale')?.value || 100),
    cardSpacingScale: Number($('cardSpacingScale')?.value || 10),
    phoneClickAction: $('phoneClickAction')?.value || 'auto',
    interfaceLanguage: $('interfaceLanguage')?.value || 'en',
    ...patch
  };
  await persistSettingsPatch({ appearancePatch: controls });
}


function normalizeCustomTheme(theme = {}) {
  const result = { ...CUSTOM_THEME_DEFAULTS, ...(theme || {}) };
  for (const key of ['background','surface','primary','accent','text']) {
    const candidate = String(result[key] || CUSTOM_THEME_DEFAULTS[key]).trim();
    result[key] = isValidCssColor(candidate) ? candidate : CUSTOM_THEME_DEFAULTS[key];
  }
  result.name = String(result.name || CUSTOM_THEME_DEFAULTS.name).trim().slice(0, 32) || CUSTOM_THEME_DEFAULTS.name;
  return result;
}
function isValidCssColor(value) {
  if (!value || typeof value !== 'string') return false;
  if (typeof CSS !== 'undefined' && CSS.supports && CSS.supports('color', value)) return true;
  return /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i.test(value);
}
function colorToHex(value) {
  const input = String(value || '').trim();
  const short = input.match(/^#([0-9a-f]{3})$/i);
  if (short) return '#' + short[1].split('').map((ch) => ch + ch).join('').toUpperCase();
  const long = input.match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
  if (long) return '#' + long[1].toUpperCase();
  try {
    const canvas = document.createElement('canvas'); canvas.width = canvas.height = 1;
    const ctx = canvas.getContext('2d'); if (!ctx) return '#000000';
    ctx.fillStyle = '#010203'; ctx.fillStyle = input;
    const normalized = ctx.fillStyle;
    const rgb = normalized.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
    if (rgb) return '#' + rgb.slice(1,4).map((n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2,'0')).join('').toUpperCase();
    const hex = normalized.match(/^#([0-9a-f]{6})$/i); return hex ? '#' + hex[1].toUpperCase() : '#000000';
  } catch (_) { return '#000000'; }
}
function contrastText(color) {
  const hex = colorToHex(color).slice(1);
  const channels = [0,2,4].map((i) => parseInt(hex.slice(i,i+2),16)/255).map((v) => v <= .04045 ? v/12.92 : Math.pow((v+.055)/1.055,2.4));
  const luminance = .2126*channels[0] + .7152*channels[1] + .0722*channels[2];
  return luminance > .48 ? '#0D0D0D' : '#FFFFFF';
}
function initSettingsTabs() {
  const settingsBody = document.querySelector('#viewSettings .settings-body');
  if (!settingsBody || settingsBody.dataset.tabsBound === 'true') return;
  settingsBody.dataset.tabsBound = 'true';
  const tabs = [...settingsBody.querySelectorAll('[data-settings-tab]')];
  const languagePanel = settingsBody.querySelector('[data-settings-group="language"]');
  const appearancePanel = settingsBody.querySelector('[data-settings-group="appearance"]');
  const intro = settingsBody.querySelector('[data-settings-general-only]');
  const setTab = (active) => {
    for (const tab of tabs) {
      const selected = tab.dataset.settingsTab === active;
      tab.classList.toggle('is-active', selected);
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    }
    for (const child of settingsBody.children) {
      if (child.classList.contains('settings-tab-bar')) continue;
      if (child.dataset.settingsGroup) child.hidden = child.dataset.settingsGroup !== active;
      else if (child.classList.contains('settings-divider')) child.hidden = active !== 'general';
      else child.hidden = active !== 'general';
    }
    if (languagePanel) languagePanel.hidden = active !== 'language';
    if (appearancePanel) appearancePanel.hidden = active !== 'appearance';
    if (intro) intro.hidden = active !== 'general';
    settingsBody.dataset.activeSettingsTab = active;
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => setTab(tab.dataset.settingsTab));
    tab.addEventListener('keydown', (event) => {
      if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
      event.preventDefault();
      let next = index;
      if (event.key === 'ArrowRight') next = (index + 1) % tabs.length;
      if (event.key === 'ArrowLeft') next = (index - 1 + tabs.length) % tabs.length;
      if (event.key === 'Home') next = 0;
      if (event.key === 'End') next = tabs.length - 1;
      tabs[next].focus(); setTab(tabs[next].dataset.settingsTab);
    });
  });
  setTab('general');
}

/* Atlas on-demand interface localization. Packs are downloaded per language and cached locally. */
const ATLAS_RTL_LANGUAGES = new Set(['ar', 'fa', 'he', 'ur', 'ps', 'ku']);
const ATLAS_TRANSLATABLE_ATTRIBUTES = ['placeholder', 'title', 'aria-label', 'aria-description', 'alt'];
const ATLAS_PREWRITTEN_TRANSLATIONS = window.ATLAS_PREWRITTEN_TRANSLATIONS && typeof window.ATLAS_PREWRITTEN_TRANSLATIONS === 'object'
  ? window.ATLAS_PREWRITTEN_TRANSLATIONS
  : {};
const ATLAS_SOURCE_PHRASES = Array.isArray(window.ATLAS_SOURCE_PHRASES) ? [...new Set(window.ATLAS_SOURCE_PHRASES.filter(value => typeof value === 'string' && value.trim()))] : [];
const ATLAS_LANGUAGE_PACKS_STORAGE_KEY = 'atlasDownloadedLanguagePacks';
const ATLAS_TRANSLATION_API_KEY_SESSION_KEY = 'atlasGoogleTranslationApiKey';
const ATLAS_GOOGLE_TRANSLATION_ENDPOINT = 'https://translation.googleapis.com/language/translate/v2';
const ATLAS_GOOGLE_TRANSLATION_BATCH_SIZE = 128;
let atlasDownloadedLanguagePacks = window.ATLAS_DOWNLOADED_LANGUAGE_PACKS && typeof window.ATLAS_DOWNLOADED_LANGUAGE_PACKS === 'object'
  ? window.ATLAS_DOWNLOADED_LANGUAGE_PACKS
  : {};
let atlasLanguagePackManagerBound = false;
let atlasLanguagePackDownloadInProgress = false;
let atlasInterfaceLanguage = 'en';
let atlasInterfaceTranslationGeneration = 0;
let atlasInterfaceTranslationObserver = null;
let atlasInterfaceTranslationObserverTimer = null;
let atlasInterfaceTranslationPass = null;
let atlasInterfaceTranslationPassQueued = false;
const atlasTextOriginals = new WeakMap();
const atlasTextLastTranslations = new WeakMap();
const atlasAttributeOriginals = new WeakMap();
const atlasAttributeLastTranslations = new WeakMap();

function isAtlasInterfaceTextExcluded(element) {
  if (!element || element.nodeType !== Node.ELEMENT_NODE) return true;
  if (element.closest('script, style, svg, noscript, textarea, [contenteditable="true"], [data-i18n-ignore], .records-table tbody, .language-search-results')) return true;
  // The lead grid contains real customer/business data. Keep record cells, names, phone numbers, URLs, emails, notes, and saved-view names outside interface localization.
  if (element.closest('[data-animated-select="saved-views"]')) return true;
  const leadCell = element.closest('.lead-table tbody td');
  if (leadCell && !element.closest('.animated-select-menu, .edit-lead-button') && !element.closest('.lead-empty-state')) return true;
  return false;
}

function shouldTranslateAtlasInterfacePhrase(value) {
  const phrase = String(value == null ? '' : value).trim();
  if (phrase.length < 2 || phrase.length > 1400) return false;
  if (!/\p{L}/u.test(phrase)) return false;
  if (/^(?:atlas|auxin|studio)$/i.test(phrase)) return false;
  if (/^https?:\/\//i.test(phrase) || /\bwww\./i.test(phrase) || /^[\w.+-]+@[\w.-]+\.[a-z]{2,}$/i.test(phrase)) return false;
  // Known preset/theme notifications use phrase templates that protect user-entered names.
  // Search terms can appear inside live status text; do not translate those dynamic values.
  for (const id of ['queryInput', 'locationInput']) {
    const entered = String($(id)?.value || '').trim();
    if (entered.length >= 3 && phrase.toLocaleLowerCase().includes(entered.toLocaleLowerCase())) return false;
  }
  return true;
}

function readAtlasOriginalText(node) {
  const current = String(node.nodeValue || '');
  const last = atlasTextLastTranslations.get(node);
  if (last !== undefined && current === last && atlasTextOriginals.has(node)) return atlasTextOriginals.get(node);
  atlasTextOriginals.set(node, current);
  atlasTextLastTranslations.delete(node);
  return current;
}

function writeAtlasTextTranslation(node, original, translation) {
  atlasTextOriginals.set(node, original);
  if (translation == null) {
    // Remember the restored source value too, so our own DOM mutation is ignored by the observer.
    atlasTextLastTranslations.set(node, original);
    if (node.nodeValue !== original) node.nodeValue = original;
    return;
  }
  const leading = (String(original).match(/^\s*/) || [''])[0];
  const trailing = (String(original).match(/\s*$/) || [''])[0];
  const formatted = leading + String(translation).trim() + trailing;
  atlasTextLastTranslations.set(node, formatted);
  if (node.nodeValue !== formatted) node.nodeValue = formatted;
}

function getAtlasAttributeMap(weakMap, element) {
  let map = weakMap.get(element);
  if (!map) { map = new Map(); weakMap.set(element, map); }
  return map;
}

function readAtlasOriginalAttribute(element, attribute) {
  const current = element.getAttribute(attribute);
  if (current == null) return null;
  const originals = getAtlasAttributeMap(atlasAttributeOriginals, element);
  const translated = getAtlasAttributeMap(atlasAttributeLastTranslations, element);
  if (translated.has(attribute) && current === translated.get(attribute) && originals.has(attribute)) return originals.get(attribute);
  originals.set(attribute, current);
  translated.delete(attribute);
  return current;
}

function writeAtlasAttributeTranslation(element, attribute, original, translation) {
  const originals = getAtlasAttributeMap(atlasAttributeOriginals, element);
  const translated = getAtlasAttributeMap(atlasAttributeLastTranslations, element);
  originals.set(attribute, original);
  if (translation == null) {
    // Treat restoring the original as an expected value, not as a new React mutation.
    translated.set(attribute, original);
    if (element.getAttribute(attribute) !== original) element.setAttribute(attribute, original);
    return;
  }
  const result = String(translation).trim();
  translated.set(attribute, result);
  if (element.getAttribute(attribute) !== result) element.setAttribute(attribute, result);
}

function describeAtlasTranslationPhrase(phrase) {
  const values = [];
  let namePlaceholderIndex = 0;
  let key = String(phrase).replace(/\b\d[\d,]*(?:\.\d+)?%?\b/g, (value) => {
    const marker = `ZXQVAL${String(values.length).padStart(3, '0')}QXZ`;
    values.push({ marker, value });
    return marker;
  });
  const protectName = (pattern, groupIndex = 1) => {
    key = key.replace(pattern, (...args) => {
      const full = args[0];
      const name = args[groupIndex];
      const marker = `ZXQNAME${String(namePlaceholderIndex++).padStart(3, '0')}QXZ`;
      values.push({ marker, value: name });
      // Replace only the user-authored name, leaving fixed punctuation/words translatable.
      const startIndex = full.indexOf(name);
      return startIndex < 0 ? full : full.slice(0, startIndex) + marker + full.slice(startIndex + name.length);
    });
  };
  // Preserve custom preset/theme names locally; only the surrounding interface wording is sent to Google.
  protectName(/^(Applied preset: )(.+)$/i, 2);
  protectName(/^(Saved preset ")([^"]+)(" with ZXQVAL\d{3}QXZ columns\.)$/i, 2);
  protectName(/^(Deleted preset ")([^"]+)("\.)$/i, 2);
  protectName(/^(Editing “)(.+?)(”\. Save changes to update it\.)$/i, 2);
  protectName(/^(Moved “)(.+?)(” to Recently deleted\. You can restore it later\.)$/i, 2);
  protectName(/^(Restored “)(.+?)(” to Saved themes\.)$/i, 2);
  protectName(/^(“)(.+?)(” was permanently deleted\.)$/i, 2);
  protectName(/^(.+?)( theme applied\.)$/i, 1);
  protectName(/^(.+?)( applied\.)$/i, 1);
  return {
    key,
    restore(translation) {
      let result = String(translation || '');
      for (const item of values) result = result.split(item.marker).join(item.value);
      return result;
    }
  };
}
let atlasLanguagePackSourceEntriesCache = null;
function getAtlasLanguagePackSourceEntries() {
  if (atlasLanguagePackSourceEntriesCache) return atlasLanguagePackSourceEntriesCache;
  const unique = new Map();
  const addPhrase = (sourcePhrase) => {
    const phrase = String(sourcePhrase == null ? '' : sourcePhrase).trim();
    if (!phrase) return;
    const descriptor = describeAtlasTranslationPhrase(phrase);
    if (!unique.has(descriptor.key)) unique.set(descriptor.key, { sourcePhrase: phrase, key: descriptor.key });
  };
  // Keep the release glossary as a baseline for status messages and conditional states
  // that are not present in the DOM at startup.
  for (const sourcePhrase of ATLAS_SOURCE_PHRASES) addPhrase(sourcePhrase);
  // Also snapshot every eligible live interface label, helper paragraph, input attribute,
  // React workspace label and hidden-panel string. This closes gaps when UI text was added
  // after the baseline glossary was last audited. The result is frozen for this page session,
  // so every language pack in the same session has identical phrase coverage. These targets
  // already passed collectAtlasInterfaceTranslationTargets' safety and user-data filters.
  try {
    for (const target of collectAtlasInterfaceTranslationTargets()) addPhrase(target.phrase);
  } catch (error) {
    console.warn('Atlas could not augment the source glossary from the interface DOM:', error);
  }
  atlasLanguagePackSourceEntriesCache = [...unique.values()];
  return atlasLanguagePackSourceEntriesCache;
}

const atlasNormalizedTranslationKeyCache = new WeakMap();
function normalizeAtlasTranslationKey(value) {
  return String(value || '')
    .normalize('NFKC')
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[‐‑‒–—]/g, '-')
    .replace(/[.…]{3,}/g, '…')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase();
}
function getAtlasNormalizedPhraseMap(pack) {
  let map = atlasNormalizedTranslationKeyCache.get(pack);
  if (map) return map;
  map = new Map();
  for (const [source, value] of Object.entries(pack)) {
    if (typeof value !== 'string' || !value.trim()) continue;
    const normalized = normalizeAtlasTranslationKey(source);
    if (normalized && !map.has(normalized)) map.set(normalized, value.trim());
  }
  atlasNormalizedTranslationKeyCache.set(pack, map);
  return map;
}
function getAtlasPrewrittenTranslation(language, phrase, translationKey = phrase) {
  const pack = ATLAS_PREWRITTEN_TRANSLATIONS[language];
  if (!pack || typeof pack !== 'object') return '';
  const candidates = [String(phrase || '').trim(), String(translationKey || '').trim()];
  for (const key of candidates) {
    const value = pack[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  const normalizedPack = getAtlasNormalizedPhraseMap(pack);
  for (const key of candidates) {
    const normalized = normalizeAtlasTranslationKey(key);
    const value = normalizedPack.get(normalized);
    if (typeof value === 'string' && value.trim()) return value;
  }
  return '';
}

function collectAtlasInterfaceTranslationTargets() {
  const targets = [];
  const root = document.body || document.documentElement;
  if (!root) return targets;
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  let node;
  while ((node = walker.nextNode())) {
    const parent = node.parentElement;
    if (!parent || isAtlasInterfaceTextExcluded(parent) || parent.closest('select, .language-animated-select, #interfaceLanguage-menu, .language-search-results, .theme-library-item-title, .preset-chip[data-preset-type="custom"]')) continue;
    // Inside record rows, only the static Edit action is eligible; do not translate
    // the actual record values or the accessibility attributes containing them.
    const original = readAtlasOriginalText(node);
    const phrase = original.trim();
    if (!shouldTranslateAtlasInterfacePhrase(phrase)) continue;
    const descriptor = describeAtlasTranslationPhrase(phrase);
    targets.push({ type: 'text', node, original, phrase, translationKey: descriptor.key, restoreTranslation: descriptor.restore });
  }
  const attributeElements = root.querySelectorAll('*');
  for (const element of attributeElements) {
    if (isAtlasInterfaceTextExcluded(element) || element.closest('.lead-table tbody, .records-table tbody, .preset-chip[data-preset-type="custom"]')) continue;
    for (const attribute of ATLAS_TRANSLATABLE_ATTRIBUTES) {
      if (!element.hasAttribute(attribute)) continue;
      const original = readAtlasOriginalAttribute(element, attribute);
      const phrase = String(original || '').trim();
      if (!shouldTranslateAtlasInterfacePhrase(phrase)) continue;
      const descriptor = describeAtlasTranslationPhrase(phrase);
      targets.push({ type: 'attribute', element, attribute, original, phrase, translationKey: descriptor.key, restoreTranslation: descriptor.restore });
      }
  }
  return targets;
}

function applyAtlasTranslationToTarget(target, translation) {
  if (target.type === 'text') writeAtlasTextTranslation(target.node, target.original, translation);
  else writeAtlasAttributeTranslation(target.element, target.attribute, target.original, translation);
}

function restoreAtlasInterfaceOriginals(targets) {
  for (const target of targets) applyAtlasTranslationToTarget(target, null);
}

function restoreAtlasInterfaceEnglish(targets) {
  restoreAtlasInterfaceOriginals(targets);
  document.documentElement.lang = 'en';
  // Keep the extension's component layout stable. RTL writing is applied to
  // text surfaces selectively through the body class, not to the whole UI tree.
  document.documentElement.dir = 'ltr';
  document.body?.classList.remove('atlas-rtl-interface');
}

function atlasTranslationTargetStillMatches(target) {
  if (target.type === 'text') {
    const node = target.node;
    if (!node || !node.isConnected) return false;
    const current = String(node.nodeValue || '');
    if (current === target.original) return true;
    const last = atlasTextLastTranslations.get(node);
    return last !== undefined && current === last && atlasTextOriginals.get(node) === target.original;
  }
  const element = target.element;
  if (!element || !element.isConnected) return false;
  const current = element.getAttribute(target.attribute);
  if (current === target.original) return true;
  const last = getAtlasAttributeMap(atlasAttributeLastTranslations, element).get(target.attribute);
  return last !== undefined && current === last && getAtlasAttributeMap(atlasAttributeOriginals, element).get(target.attribute) === target.original;
}

function startAtlasInterfaceTranslation(language, options = {}) {
  const targetLanguage = ATLAS_LANGUAGES.some(([code]) => code === language) ? language : 'en';
  if (targetLanguage !== 'en' && !isAtlasLanguagePackComplete(targetLanguage)) {
    updateAtlasLanguagePackUi(targetLanguage);
    if (!options.silent) showToast('The selected language is not downloaded yet. Download the pack to apply it.');
    return Promise.resolve({ language: targetLanguage, translated: 0, failed: ATLAS_SOURCE_PHRASES.length, missingPack: true });
  }
  const isRefresh = options.refresh === true;
  const languageChanged = !isRefresh && (options.forceLanguageChange === true || targetLanguage !== atlasInterfaceLanguage);
  if (languageChanged) {
    atlasInterfaceTranslationGeneration += 1;
    atlasInterfaceLanguage = targetLanguage;
    // Restore the source copy only once per actual language change. Refresh passes
    // keep the current translation in place, avoiding English/translated flicker.
    const knownTargets = collectAtlasInterfaceTranslationTargets();
    restoreAtlasInterfaceOriginals(knownTargets);
  }
  const generation = atlasInterfaceTranslationGeneration;
  const task = applyAtlasInterfaceLanguage(targetLanguage, { ...options, refresh: isRefresh, generation });
  let tracked;
  tracked = task.catch((error) => {
    console.warn('Atlas could not apply the selected interface language:', error);
    if (!options.silent) showToast('Atlas could not apply its offline language pack. Reload the extension and try again.');
    return { language: targetLanguage, translated: 0, failed: 1 };
  }).finally(() => {
    if (atlasInterfaceTranslationPass === tracked) {
      atlasInterfaceTranslationPass = null;
      if (atlasInterfaceTranslationPassQueued) {
        atlasInterfaceTranslationPassQueued = false;
        scheduleAtlasInterfaceTranslationPass();
      }
    }
  });
  atlasInterfaceTranslationPass = tracked;
  return tracked;
}
function scheduleAtlasInterfaceTranslationPass() {
  if (atlasInterfaceLanguage === 'en') return;
  atlasInterfaceTranslationPassQueued = true;
  if (atlasInterfaceTranslationPass) return;
  if (atlasInterfaceTranslationObserverTimer != null) window.clearTimeout(atlasInterfaceTranslationObserverTimer);
  atlasInterfaceTranslationObserverTimer = window.setTimeout(() => {
    atlasInterfaceTranslationObserverTimer = null;
    if (atlasInterfaceTranslationPass) return;
    atlasInterfaceTranslationPassQueued = false;
    void startAtlasInterfaceTranslation(atlasInterfaceLanguage, { silent: true, refresh: true });
  }, 0);
}

// When app state renders a known phrase, apply its prewritten translation immediately in the MutationObserver microtask.
function applyAtlasCachedTranslationToTextNode(node) {
  if (!node || node.nodeType !== Node.TEXT_NODE) return { eligible: false, translated: false };
  const parent = node.parentElement;
  if (!parent || isAtlasInterfaceTextExcluded(parent) || parent.closest('select, .language-animated-select, #interfaceLanguage-menu, .language-search-results, .theme-library-item-title, .preset-chip[data-preset-type="custom"]')) {
    return { eligible: false, translated: false };
  }
  const original = readAtlasOriginalText(node);
  const phrase = original.trim();
  if (!shouldTranslateAtlasInterfacePhrase(phrase)) return { eligible: false, translated: false };
  const descriptor = describeAtlasTranslationPhrase(phrase);
  const translation = getAtlasPrewrittenTranslation(atlasInterfaceLanguage, phrase, descriptor.key);
  if (!translation) return { eligible: false, translated: false };
  const target = { type: 'text', node, original, phrase, translationKey: descriptor.key, restoreTranslation: descriptor.restore };
  if (!atlasTranslationTargetStillMatches(target)) return { eligible: true, translated: false };
  applyAtlasTranslationToTarget(target, descriptor.restore(translation));
  return { eligible: true, translated: true };
}

function applyAtlasCachedTranslationToAttribute(element, attribute) {
  if (!element || isAtlasInterfaceTextExcluded(element) || element.closest('.lead-table tbody, .records-table tbody')) return { eligible: false, translated: false };
  const original = readAtlasOriginalAttribute(element, attribute);
  const phrase = String(original || '').trim();
  if (!shouldTranslateAtlasInterfacePhrase(phrase)) return { eligible: false, translated: false };
  const descriptor = describeAtlasTranslationPhrase(phrase);
  const translation = getAtlasPrewrittenTranslation(atlasInterfaceLanguage, phrase, descriptor.key);
  if (!translation) return { eligible: false, translated: false };
  const target = { type: 'attribute', element, attribute, original, phrase, translationKey: descriptor.key, restoreTranslation: descriptor.restore };
  if (!atlasTranslationTargetStillMatches(target)) return { eligible: true, translated: false };
  applyAtlasTranslationToTarget(target, descriptor.restore(translation));
  return { eligible: true, translated: true };
}

function applyAtlasCachedTranslationsToSubtree(rootNode) {
  let needsTranslationPass = false;
  const inspectElement = (element) => {
    if (!element || isAtlasInterfaceTextExcluded(element) || element.closest('.language-search-results, .language-animated-select, #interfaceLanguage-menu, .lead-table tbody, .records-table tbody')) return;
    for (const attribute of ATLAS_TRANSLATABLE_ATTRIBUTES) {
      if (!element.hasAttribute(attribute)) continue;
      const result = applyAtlasCachedTranslationToAttribute(element, attribute);
      if (result.eligible && !result.translated) needsTranslationPass = true;
    }
  };
  if (!rootNode) return false;
  if (rootNode.nodeType === Node.TEXT_NODE) {
    const result = applyAtlasCachedTranslationToTextNode(rootNode);
    return result.eligible && !result.translated;
  }
  if (rootNode.nodeType !== Node.ELEMENT_NODE && rootNode.nodeType !== Node.DOCUMENT_FRAGMENT_NODE) return false;
  if (rootNode.nodeType === Node.ELEMENT_NODE) inspectElement(rootNode);
  const walker = document.createTreeWalker(rootNode, NodeFilter.SHOW_TEXT);
  let textNode;
  while ((textNode = walker.nextNode())) {
    const result = applyAtlasCachedTranslationToTextNode(textNode);
    if (result.eligible && !result.translated) needsTranslationPass = true;
  }
  if (rootNode.querySelectorAll) {
    for (const element of rootNode.querySelectorAll('*')) inspectElement(element);
  }
  return needsTranslationPass;
}

function startAtlasInterfaceTranslationObserver() {
  if (atlasInterfaceTranslationObserver || !document.body) return;
  atlasInterfaceTranslationObserver = new MutationObserver((mutations) => {
    if (atlasInterfaceLanguage === 'en') return;
    let needsPass = false;
    for (const mutation of mutations) {
      const mutationElement = mutation.target.nodeType === Node.ELEMENT_NODE
        ? mutation.target
        : mutation.target.parentElement;
      // Frequent updates in language-picker controls and user data are intentionally skipped.
      if (mutationElement?.closest('.language-search-results, .language-animated-select, #interfaceLanguage-menu, .lead-table tbody, .records-table tbody')) continue;
      if (mutation.type === 'characterData') {
        const node = mutation.target;
        if (atlasTextLastTranslations.get(node) === node.nodeValue) continue;
        const result = applyAtlasCachedTranslationToTextNode(node);
        if (result.eligible && result.translated) continue;
        if (result.eligible) needsPass = true;
        continue;
      }
      if (mutation.type === 'attributes') {
        const map = atlasAttributeLastTranslations.get(mutation.target);
        if (map && map.get(mutation.attributeName) === mutation.target.getAttribute(mutation.attributeName)) continue;
        const result = applyAtlasCachedTranslationToAttribute(mutation.target, mutation.attributeName);
        if (result.eligible && result.translated) continue;
        if (result.eligible) needsPass = true;
        continue;
      }
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        for (const addedNode of mutation.addedNodes) {
          if (applyAtlasCachedTranslationsToSubtree(addedNode)) needsPass = true;
        }
      }
    }
    if (needsPass) scheduleAtlasInterfaceTranslationPass();
  });
  atlasInterfaceTranslationObserver.observe(document.body, {
    subtree: true, childList: true, characterData: true, attributes: true,
    attributeFilter: ATLAS_TRANSLATABLE_ATTRIBUTES
  });
}

async function applyAtlasInterfaceLanguage(language, options = {}) {
  const targetLanguage = ATLAS_LANGUAGES.some(([code]) => code === language) ? language : 'en';
  const generation = Number.isInteger(options.generation) ? options.generation : ++atlasInterfaceTranslationGeneration;
  atlasInterfaceLanguage = targetLanguage;
  document.documentElement.lang = targetLanguage;
  // Preserve Atlas's LTR component order; apply RTL only to text-oriented surfaces.
  document.documentElement.dir = 'ltr';
  document.body?.classList.toggle('atlas-rtl-interface', ATLAS_RTL_LANGUAGES.has(targetLanguage));
  const targets = collectAtlasInterfaceTranslationTargets();
  if (targetLanguage === 'en') {
    restoreAtlasInterfaceEnglish(targets);
    return { language: 'en', translated: 0, failed: 0 };
  }
  if (generation !== atlasInterfaceTranslationGeneration || targetLanguage !== atlasInterfaceLanguage) {
    return { language: targetLanguage, translated: 0, failed: 0, stale: true };
  }
  let translatedPhraseCount = 0;
  let failedPhraseCount = 0;
  const seenTranslated = new Set();
  const seenMissing = new Set();
  for (const target of targets) {
    const value = getAtlasPrewrittenTranslation(targetLanguage, target.phrase, target.translationKey);
    if (value) {
      const restoredValue = target.restoreTranslation ? target.restoreTranslation(value) : value;
      if (atlasTranslationTargetStillMatches(target)) applyAtlasTranslationToTarget(target, restoredValue);
      seenTranslated.add(target.translationKey);
    } else {
      seenMissing.add(target.translationKey);
    }
  }
  translatedPhraseCount = seenTranslated.size;
  failedPhraseCount = seenMissing.size;
  if (generation === atlasInterfaceTranslationGeneration && atlasInterfaceLanguage === targetLanguage && !options.silent) {
    const languageName = ATLAS_LANGUAGES.find(([code]) => code === targetLanguage)?.[1] || targetLanguage;
    if (failedPhraseCount) {
      showToast('Some interface text is not included in this language pack. Update the pack to complete translation.', { persistent: false });
    } else {
      showToast('Interface language changed.', { kind: 'success' });
    }
  }
  return { language: targetLanguage, translated: translatedPhraseCount, failed: failedPhraseCount };
}
function atlasLanguageName(code) {
  return ATLAS_LANGUAGES.find(([languageCode]) => languageCode === code)?.[1] || code;
}

function isAtlasLanguagePackComplete(language) {
  if (language === 'en') return true;
  const pack = atlasDownloadedLanguagePacks[language];
  const entries = getAtlasLanguagePackSourceEntries();
  if (!pack || !pack.translations || typeof pack.translations !== 'object' || !entries.length) return false;
  return entries.every((entry) => typeof pack.translations[entry.key] === 'string' && pack.translations[entry.key].trim().length > 0);
}

function getAtlasLanguagePackPhraseCount(language) {
  const entries = getAtlasLanguagePackSourceEntries();
  if (language === 'en') return entries.length;
  const pack = atlasDownloadedLanguagePacks[language];
  const translations = pack && pack.translations && typeof pack.translations === 'object' ? pack.translations : {};
  return entries.reduce((count, entry) => count + (typeof translations[entry.key] === 'string' && translations[entry.key].trim() ? 1 : 0), 0);
}

function updateAtlasLanguagePackUi(language, options = {}) {
  const selectedLanguage = ATLAS_LANGUAGES.some(([code]) => code === language) ? language : 'en';
  const coverage = $('languagePackCoverage');
  const status = $('languagePackStatus');
  const downloadButton = $('downloadLanguagePackBtn');
  const exportButton = $('exportLanguagePackBtn');
  const removeButton = $('removeLanguagePackBtn');
  const downloadAllButton = $('downloadAllLanguagePacksBtn');
  const exportAllButton = $('exportAllLanguagePacksBtn');
  const apiKey = $('translationApiKey');
  const count = getAtlasLanguagePackPhraseCount(selectedLanguage);
  const total = getAtlasLanguagePackSourceEntries().length;
  const complete = isAtlasLanguagePackComplete(selectedLanguage);
  if (coverage) coverage.textContent = `${count} / ${total}`;
  if (status && !options.preserveStatus) {
    status.dataset.language = selectedLanguage;
    status.dataset.state = complete ? 'success' : 'default';
    status.textContent = selectedLanguage === 'en'
      ? 'English is built in and does not need a download.'
      : complete ? 'Pack installed and ready offline' : 'No language pack downloaded';
  }
  if (downloadButton) {
    downloadButton.textContent = selectedLanguage === 'en' ? 'English is built in' : complete ? 'Update selected language pack' : 'Download selected language pack';
    downloadButton.disabled = selectedLanguage === 'en' || atlasLanguagePackDownloadInProgress;
  }
  if (exportButton) exportButton.disabled = selectedLanguage === 'en' || !complete || atlasLanguagePackDownloadInProgress;
  if (removeButton) removeButton.disabled = selectedLanguage === 'en' || !atlasDownloadedLanguagePacks[selectedLanguage] || atlasLanguagePackDownloadInProgress;
  if (downloadAllButton) downloadAllButton.disabled = atlasLanguagePackDownloadInProgress;
  if (exportAllButton) {
    const hasCompletePack = Object.keys(atlasDownloadedLanguagePacks || {}).some(code => code !== 'en' && isAtlasLanguagePackComplete(code));
    exportAllButton.disabled = atlasLanguagePackDownloadInProgress || !hasCompletePack;
  }
  if (apiKey) apiKey.disabled = atlasLanguagePackDownloadInProgress;
}

function setAtlasLanguagePackProgress(completed, total, message, visible = true) {
  const wrap = $('languagePackProgressWrap');
  const bar = $('languagePackProgressBar');
  const text = $('languagePackProgressText');
  const count = $('languagePackProgressCount');
  if (wrap) wrap.hidden = !visible;
  if (bar) bar.style.width = `${total ? Math.min(100, Math.max(0, completed / total * 100)) : 0}%`;
  if (text && message) text.textContent = message;
  if (count) count.textContent = `${completed} / ${total}`;
}

function decodeAtlasGoogleTranslatedText(value) {
  // Cloud Translation may return HTML entities even for plain-text mode; decode as text, never as markup.
  const decoder = document.createElement('textarea');
  decoder.innerHTML = String(value == null ? '' : value);
  return decoder.value;
}

function protectAtlasTranslationTerms(source) {
  const protectedTerms = [
    'Google Cloud Translation API', 'Google Maps URL', 'Google Maps', 'Auxin Studio', 'WhatsApp', 'Gmail',
    'Ctrl+Z', 'CSV/JSON', '.xlsx', '.csv', '.json', 'Auxin', 'Atlas', 'CSV', 'JSON', 'API', 'URL', 'HEX', 'RGB', 'HSL', 'React'
  ];
  const matches = [];
  let value = String(source);
  const keepMatches = (input, pattern) => input.replace(pattern, (match) => {
    const token = `ZXQATLASKEEP${String(matches.length).padStart(4, '0')}QXZ`;
    matches.push({ token, value: match });
    return token;
  });
  const sortedTerms = [...protectedTerms].sort((a, b) => b.length - a.length);
  for (const term of sortedTerms) {
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const pattern = term.startsWith('.')
      ? new RegExp(`${escaped}\\b`, 'gi')
      : new RegExp(`\\b${escaped}\\b`, 'gi');
    value = keepMatches(value, pattern);
  }
  // These are runtime counter placeholders, not words; keep them verbatim through Google translation.
  value = keepMatches(value, /ZXQ(?:VAL|NAME)\d{3}QXZ/g);
  return {
    text: value,
    restore(translated) {
      let result = String(translated || '');
      for (const entry of matches) {
        const escaped = entry.token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(escaped, 'gi'), entry.value);
      }
      return result;
    },
    expectedTokens: matches.map(entry => entry.token)
  };
}

async function requestAtlasGoogleTranslationBatch(apiKey, language, phrases) {
  const protectedRows = phrases.map((phrase) => protectAtlasTranslationTerms(phrase));
  const url = `${ATLAS_GOOGLE_TRANSLATION_ENDPOINT}?key=${encodeURIComponent(apiKey)}`;
  let lastError = null;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    let timeoutId = null;
    const controller = new AbortController();
    try {
      timeoutId = window.setTimeout(() => controller.abort(), 45000);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({ q: protectedRows.map(row => row.text), source: 'en', target: language, format: 'text' })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        const apiMessage = payload?.error?.message || `Google Cloud Translation returned HTTP ${response.status}.`;
        const error = new Error(apiMessage);
        error.status = response.status;
        throw error;
      }
      const rows = payload?.data?.translations;
      if (!Array.isArray(rows) || rows.length !== phrases.length) {
        throw new Error(`Google returned ${Array.isArray(rows) ? rows.length : 0} translations for ${phrases.length} submitted phrases.`);
      }
      return rows.map((row, index) => {
        const decoded = decodeAtlasGoogleTranslatedText(row?.translatedText || '');
        if (!decoded.trim()) throw new Error(`Google returned an empty translation for phrase ${index + 1} in this batch.`);
        for (const token of protectedRows[index].expectedTokens) {
          if (!decoded.toLowerCase().includes(token.toLowerCase())) throw new Error(`A protected brand or format token was missing from phrase ${index + 1}. Please retry the download.`);
        }
        const restored = protectedRows[index].restore(decoded).trim();
        if (!restored) throw new Error(`A translation was empty for phrase ${index + 1}.`);
        return restored;
      });
    } catch (error) {
      lastError = error;
      const status = Number(error?.status || 0);
      const retryable = error?.name === 'AbortError' || status === 429 || status >= 500 || !status;
      if (!retryable || attempt >= 2) break;
      await new Promise(resolve => window.setTimeout(resolve, 500 * (attempt + 1)));
    } finally {
      if (timeoutId != null) window.clearTimeout(timeoutId);
    }
  }
  throw lastError || new Error('Google Cloud Translation could not complete this batch.');
}

async function getAtlasTranslationApiKey() {
  const entered = String($('translationApiKey')?.value || '').trim();
  if (entered) {
    try { await chrome.storage.session.set({ [ATLAS_TRANSLATION_API_KEY_SESSION_KEY]: entered }); } catch (_) {}
    return entered;
  }
  try {
    const session = await chrome.storage.session.get(ATLAS_TRANSLATION_API_KEY_SESSION_KEY);
    return String(session[ATLAS_TRANSLATION_API_KEY_SESSION_KEY] || '').trim();
  } catch (_) {
    return '';
  }
}

function getAtlasLanguagePackAsBlob(pack) {
  return new Blob([JSON.stringify(pack, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
}

async function downloadAtlasSelectedLanguagePack() {
  const select = $('interfaceLanguage');
  const language = String(select?.value || 'en');
  if (!language || language === 'en') {
    showToast('English is built in and does not need a download.');
    return;
  }
  const sourceEntries = getAtlasLanguagePackSourceEntries();
  if (!sourceEntries.length) {
    showToast('The Atlas source phrase list could not be loaded. Reload the extension and try again.');
    return;
  }
  const apiKey = await getAtlasTranslationApiKey();
  if (!apiKey) {
    $('translationApiKey')?.focus();
    showToast('Enter a Google Cloud Translation API key first.');
    return;
  }
  let targetApiCode = language;
  try {
    const supportedCodes = await getAtlasGoogleSupportedLanguageCodes(apiKey);
    targetApiCode = resolveAtlasGoogleTargetCode(language, supportedCodes);
    if (!targetApiCode) {
      const friendly = `${atlasLanguageName(language)} is not available under a compatible Google Cloud Translation language code.`;
      const status = $('languagePackStatus');
      if (status) { status.dataset.state = 'error'; status.dataset.language = language; status.textContent = friendly; }
      showToast(friendly, { kind: 'error' });
      return;
    }
  } catch (error) {
    console.error('Atlas could not read Google supported languages:', error);
    showToast('Could not check Google-supported languages. Check the API key, billing, API enablement and network connection.', { kind: 'error' });
    return;
  }
  atlasLanguagePackDownloadInProgress = true;
  const statusBeforeDownload = $('languagePackStatus');
  if (statusBeforeDownload) { statusBeforeDownload.dataset.state = 'default'; statusBeforeDownload.dataset.language = language; }
  updateAtlasLanguagePackUi(language);
  const total = sourceEntries.length;
  setAtlasLanguagePackProgress(0, total, 'Preparing language pack…', true);
  const translations = {};
  let preserveErrorStatus = false;
  const totalBatches = Math.ceil(total / ATLAS_GOOGLE_TRANSLATION_BATCH_SIZE);
  try {
    for (let offset = 0; offset < total; offset += ATLAS_GOOGLE_TRANSLATION_BATCH_SIZE) {
      const batch = sourceEntries.slice(offset, offset + ATLAS_GOOGLE_TRANSLATION_BATCH_SIZE);
      const batchNumber = Math.floor(offset / ATLAS_GOOGLE_TRANSLATION_BATCH_SIZE) + 1;
      setAtlasLanguagePackProgress(offset, total, 'Translating interface phrases…', true);
      const translatedRows = await requestAtlasGoogleTranslationBatch(apiKey, targetApiCode, batch.map(entry => entry.key));
      if (translatedRows.length !== batch.length) throw new Error(`Incomplete response for batch ${batchNumber}.`);
      batch.forEach((entry, index) => { translations[entry.key] = translatedRows[index]; });
      setAtlasLanguagePackProgress(Math.min(total, offset + batch.length), total, 'Translating interface phrases…', true);
    }
    const missing = sourceEntries.filter(entry => typeof translations[entry.key] !== 'string' || !translations[entry.key].trim());
    if (missing.length || Object.keys(translations).length !== total) {
      throw new Error('The Google response was incomplete, so Atlas did not install a partial language pack.');
    }
    setAtlasLanguagePackProgress(total, total, 'Saving language pack for offline use…', true);
    const pack = {
      format: 'atlas-language-pack',
      schemaVersion: 1,
      language,
      languageName: atlasLanguageName(language),
      sourceLanguage: 'en',
      googleTargetCode: targetApiCode,
      provider: 'Google Cloud Translation API',
      downloadedAt: new Date().toISOString(),
      phraseCount: total,
      translations
    };
    // Publish only after every phrase response has been validated.
    const updatedPacks = { ...atlasDownloadedLanguagePacks, [language]: pack };
    await chrome.storage.local.set({ [ATLAS_LANGUAGE_PACKS_STORAGE_KEY]: updatedPacks });
    atlasDownloadedLanguagePacks = updatedPacks;
    window.ATLAS_DOWNLOADED_LANGUAGE_PACKS = updatedPacks;
    ATLAS_PREWRITTEN_TRANSLATIONS[language] = translations;
    updateAtlasLanguagePackUi(language);
    setAtlasLanguagePackProgress(total, total, 'Language pack downloaded and installed.', false);
    await saveAppearancePreferences({ interfaceLanguage: language });
    await startAtlasInterfaceTranslation(language, { forceLanguageChange: true, silent: true });
    showToast('Language pack downloaded and installed.', { kind: 'success' });
  } catch (error) {
    console.error('Atlas language pack download failed:', error);
    const message = String(error?.message || 'Unknown translation download error');
    const friendly = /API key not valid|invalid API key/i.test(message)
      ? 'The Google Cloud Translation API key is invalid. Check the key and try again.'
      : /not been used|disabled|has not been used/i.test(message)
        ? 'Enable the Google Cloud Translation API for this project, then try again.'
        : /billing|quota|rate limit|exceeded/i.test(message)
          ? 'Google Cloud rejected the request because of billing or quota settings.'
          : /not supported|unsupported language|invalid value.*target/i.test(message)
            ? 'This language is not available for the Google Cloud Translation API.'
            : /incomplete response|empty translation|protected brand|protected.*token/i.test(message)
              ? 'The Google response was incomplete, so Atlas did not install a partial language pack.'
              : 'Language pack download failed. Check your API key, Cloud Translation API setup, billing, and network connection.';
    preserveErrorStatus = true;
    const status = $('languagePackStatus');
    if (status) { status.dataset.state = 'error'; status.dataset.language = language; status.textContent = friendly; }
    console.error('Google Cloud Translation error detail:', message);
    setAtlasLanguagePackProgress(0, total, 'Language pack download failed. Check your API key, Cloud Translation API setup, billing, and network connection.', false);
    showToast(friendly, { kind: 'error', persistent: false });
  } finally {
    atlasLanguagePackDownloadInProgress = false;
    updateAtlasLanguagePackUi(language, { preserveStatus: preserveErrorStatus });
  }
}


const ATLAS_GOOGLE_LANGUAGE_ALIASES = {
  he: ['he', 'iw'],
  tl: ['tl', 'fil'],
  no: ['no', 'nb', 'nb-NO'],
  ku: ['ku', 'ckb'],
  'zh-CN': ['zh-CN', 'zh'],
  'zh-TW': ['zh-TW', 'zh-Hant']
};

async function getAtlasGoogleSupportedLanguageCodes(apiKey) {
  const url = `${ATLAS_GOOGLE_TRANSLATION_ENDPOINT}/languages?key=${encodeURIComponent(apiKey)}&target=en`;
  const controller = new AbortController();
  const timeoutId = window.setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(url, { method: 'GET', cache: 'no-store', signal: controller.signal });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload?.error?.message || `Google Cloud Translation returned HTTP ${response.status} while reading supported languages.`);
      error.status = response.status;
      throw error;
    }
    if (!Array.isArray(payload?.data?.languages)) throw new Error('Google Cloud Translation did not return its supported-language list.');
    return new Map(payload.data.languages.map(item => [String(item.language || '').toLowerCase(), String(item.language || '')]).filter(([key, value]) => key && value));
  } finally {
    window.clearTimeout(timeoutId);
  }
}

function resolveAtlasGoogleTargetCode(language, supportedCodes) {
  const candidates = ATLAS_GOOGLE_LANGUAGE_ALIASES[language] || [language];
  for (const candidate of candidates) {
    const supported = supportedCodes.get(String(candidate).toLowerCase());
    if (supported) return supported;
  }
  return '';
}

function buildAtlasGoogleLanguagePack(language, targetApiCode, sourceEntries, apiKey, progressCallback) {
  return (async () => {
    const total = sourceEntries.length;
    const translations = {};
    const totalBatches = Math.ceil(total / ATLAS_GOOGLE_TRANSLATION_BATCH_SIZE);
    for (let offset = 0; offset < total; offset += ATLAS_GOOGLE_TRANSLATION_BATCH_SIZE) {
      const batch = sourceEntries.slice(offset, offset + ATLAS_GOOGLE_TRANSLATION_BATCH_SIZE);
      const batchNumber = Math.floor(offset / ATLAS_GOOGLE_TRANSLATION_BATCH_SIZE) + 1;
      if (progressCallback) progressCallback(offset, total, batchNumber, totalBatches);
      const translatedRows = await requestAtlasGoogleTranslationBatch(apiKey, targetApiCode, batch.map(entry => entry.key));
      if (translatedRows.length !== batch.length) throw new Error(`Incomplete response for batch ${batchNumber}.`);
      batch.forEach((entry, index) => { translations[entry.key] = translatedRows[index]; });
      if (progressCallback) progressCallback(Math.min(total, offset + batch.length), total, batchNumber, totalBatches);
    }
    const missing = sourceEntries.filter(entry => typeof translations[entry.key] !== 'string' || !translations[entry.key].trim());
    if (missing.length || Object.keys(translations).length !== total) throw new Error(`Pack rejected: ${missing.length} of ${total} interface phrases are missing.`);
    return {
      format: 'atlas-language-pack',
      schemaVersion: 1,
      language,
      googleTargetCode: targetApiCode,
      languageName: atlasLanguageName(language),
      sourceLanguage: 'en',
      provider: 'Google Cloud Translation API',
      downloadedAt: new Date().toISOString(),
      phraseCount: total,
      translations
    };
  })();
}

function isAtlasGlobalTranslationSetupError(error) {
  const status = Number(error?.status || 0);
  const message = String(error?.message || '').toLowerCase();
  const networkFailure = error?.name === 'AbortError' ||
    (error?.name === 'TypeError' && /fetch|network|connection/.test(message)) ||
    /failed to fetch|networkerror|network error|connection refused|connection reset/.test(message);
  return networkFailure || status === 401 || status === 403 || status === 429 || status >= 500 ||
    /api key not valid|invalid api key|billing|quota|permission denied|has not been used|not been enabled|disabled|daily limit|rate limit|exceeded your quota/.test(message);
}

async function downloadAtlasAllLanguagePacks() {
  if (atlasLanguagePackDownloadInProgress) return;
  const apiKey = await getAtlasTranslationApiKey();
  if (!apiKey) {
    $('translationApiKey')?.focus();
    showToast('Enter a Google Cloud Translation API key first.', { kind: 'error' });
    return;
  }
  const sourceEntries = getAtlasLanguagePackSourceEntries();
  if (!sourceEntries.length) {
    showToast('The Atlas source phrase list could not be loaded. Reload the extension and try again.', { kind: 'error' });
    return;
  }
  const targets = ATLAS_LANGUAGES.filter(([code]) => code !== 'en');
  const sourceCharacters = sourceEntries.reduce((total, entry) => total + String(entry.key || '').length, 0);
  const requestedCharacters = sourceCharacters * targets.length;
  const estimatedCalls = Math.ceil(sourceEntries.length / ATLAS_GOOGLE_TRANSLATION_BATCH_SIZE) * targets.length;
  const confirmMessage = `Atlas will prepare all ${targets.length} non-English languages in the selector.\n\n` +
    `${sourceEntries.length.toLocaleString()} interface phrases per language\n` +
    `About ${requestedCharacters.toLocaleString()} source characters across all languages\n` +
    `Up to ${estimatedCalls.toLocaleString()} translation requests, plus support checks\n\n` +
    `Google Cloud Translation billing may apply. Complete packs are saved as each language finishes, so you can resume later. Continue?`;
  if (typeof window.confirm === 'function' && !window.confirm(confirmMessage)) return;

  atlasLanguagePackDownloadInProgress = true;
  updateAtlasLanguagePackUi(String($('interfaceLanguage')?.value || 'en'));
  const status = $('languagePackStatus');
  if (status) { status.dataset.state = 'default'; status.textContent = 'Checking Google-supported languages…'; }
  setAtlasLanguagePackProgress(0, targets.length * sourceEntries.length, 'Checking Google-supported languages…', true);

  const result = { installed: [], alreadyInstalled: [], unsupported: [], failed: [], stoppedReason: '' };
  try {
    const supportedCodes = await getAtlasGoogleSupportedLanguageCodes(apiKey);
    const resolvableTargets = targets.map(([code, name, native]) => ({ code, name, native, targetApiCode: resolveAtlasGoogleTargetCode(code, supportedCodes) }));
    for (const target of resolvableTargets) {
      if (!target.targetApiCode) result.unsupported.push(`${target.name} (${target.code})`);
    }
    const supportedTargets = resolvableTargets.filter(target => target.targetApiCode);
    const total = supportedTargets.length * sourceEntries.length;
    let completedPhrases = 0;
    for (let index = 0; index < supportedTargets.length; index += 1) {
      const target = supportedTargets[index];
      if (isAtlasLanguagePackComplete(target.code)) {
        result.alreadyInstalled.push(target.name);
        completedPhrases += sourceEntries.length;
        setAtlasLanguagePackProgress(completedPhrases, total, `Already installed · ${index + 1} of ${supportedTargets.length}: ${target.name}`, true);
        continue;
      }
      if (status) { status.dataset.state = 'default'; status.textContent = `Downloading ${index + 1} of ${supportedTargets.length}: ${target.name}…`; }
      try {
        const pack = await buildAtlasGoogleLanguagePack(target.code, target.targetApiCode, sourceEntries, apiKey, (withinLanguage, languageTotal) => {
          setAtlasLanguagePackProgress(completedPhrases + withinLanguage, total,
            `Downloading ${index + 1} of ${supportedTargets.length}: ${target.name}…`, true);
        });
        const updatedPacks = { ...atlasDownloadedLanguagePacks, [target.code]: pack };
        try {
          await chrome.storage.local.set({ [ATLAS_LANGUAGE_PACKS_STORAGE_KEY]: updatedPacks });
        } catch (storageError) {
          const detail = String(storageError?.message || 'Chrome local storage rejected the pack.');
          result.failed.push(`${target.name}: Local storage: ${detail}`);
          result.stoppedReason = `Local storage error: ${detail}`;
          break;
        }
        atlasDownloadedLanguagePacks = updatedPacks;
        window.ATLAS_DOWNLOADED_LANGUAGE_PACKS = updatedPacks;
        ATLAS_PREWRITTEN_TRANSLATIONS[target.code] = pack.translations;
        result.installed.push(target.name);
        completedPhrases += sourceEntries.length;
        setAtlasLanguagePackProgress(completedPhrases, total, `Saved ${target.name} · ${index + 1} of ${supportedTargets.length}`, true);
      } catch (error) {
        const detail = String(error?.message || 'Unknown translation error');
        if (isAtlasGlobalTranslationSetupError(error)) {
          result.failed.push(`${target.name}: ${detail}`);
          result.stoppedReason = `Google API/network/configuration error: ${detail}`;
          break;
        }
        // A 400/404 after the language catalogue reports support commonly means this code is not accepted as a target by the current API route.
        if ([400, 404].includes(Number(error?.status || 0)) && /language|target|unsupported|invalid value/i.test(detail)) result.unsupported.push(`${target.name} (${target.code})`);
        else result.failed.push(`${target.name}: ${detail}`);
        console.warn(`Atlas bulk language-pack download failed for ${target.code}:`, error);
      }
    }

    // If the selected language was waiting for its first complete pack, apply it once at the end.
    // The local translation pass is synchronous and never exposes an English intermediate frame.
    const selectedAtEnd = String($('interfaceLanguage')?.value || 'en');
    if (selectedAtEnd !== 'en' && isAtlasLanguagePackComplete(selectedAtEnd)) {
      await startAtlasInterfaceTranslation(selectedAtEnd, { forceLanguageChange: true, silent: true });
    }
    const installedNow = result.installed.length;
    const existing = result.alreadyInstalled.length;
    const unsupportedCount = result.unsupported.length;
    const failedCount = result.failed.length;
    const attemptedCount = result.installed.length + result.alreadyInstalled.length + result.unsupported.length + result.failed.length;
    const notAttemptedCount = Math.max(0, targets.length - attemptedCount);
    const summary = `Language packs ready: ${installedNow} downloaded, ${existing} already installed, ${unsupportedCount} unsupported, ${failedCount} failed, ${notAttemptedCount} not attempted.` +
      (result.unsupported.length ? ` Unsupported: ${result.unsupported.join(', ')}.` : '') +
      (result.failed.length ? ` Failed: ${result.failed.map(item => item.split(':')[0]).join(', ')}.` : '') +
      (result.stoppedReason ? ` Run stopped early: ${result.stoppedReason}` : '');
    if (status) {
      status.dataset.state = failedCount || unsupportedCount || result.stoppedReason ? 'error' : 'success';
      status.textContent = summary;
    }
    setAtlasLanguagePackProgress(completedPhrasesFromResult(result, sourceEntries.length), total, 'All-language pack run finished.', false);
    updateAtlasLanguagePackUi(String($('interfaceLanguage')?.value || 'en'), { preserveStatus: true });
    if (!failedCount && !unsupportedCount && !result.stoppedReason) showToast(`All ${targets.length} language packs are ready offline.`, { kind: 'success' });
    else showToast(`Language pack run finished: ${installedNow + existing} ready, ${unsupportedCount} unsupported, ${failedCount} failed.`, { kind: failedCount || unsupportedCount ? 'error' : 'success', persistent: false });
  } catch (error) {
    console.error('Atlas all-language pack download failed:', error);
    const message = String(error?.message || 'Unknown translation download error');
    if (status) { status.dataset.state = 'error'; status.textContent = `Could not start all-language download: ${message}`; }
    setAtlasLanguagePackProgress(0, targets.length * sourceEntries.length, 'Could not start all-language download.', false);
    showToast('Could not start the all-language download. Check the Google Cloud API key, API enablement, billing and network connection.', { kind: 'error' });
  } finally {
    atlasLanguagePackDownloadInProgress = false;
    updateAtlasLanguagePackUi(String($('interfaceLanguage')?.value || 'en'), { preserveStatus: true });
  }
}

function completedPhrasesFromResult(result, phraseCount) {
  return (result.installed.length + result.alreadyInstalled.length) * phraseCount;
}

async function exportAtlasAllInstalledLanguagePacks() {
  const entries = Object.entries(atlasDownloadedLanguagePacks || {}).filter(([code, pack]) => code !== 'en' && isAtlasLanguagePackComplete(code) && pack);
  if (!entries.length) {
    showToast('No complete downloaded language packs are available to export.');
    return;
  }
  const payload = {
    format: 'atlas-language-pack-collection',
    schemaVersion: 1,
    sourceLanguage: 'en',
    exportedAt: new Date().toISOString(),
    phraseCount: getAtlasLanguagePackSourceEntries().length,
    languages: Object.fromEntries(entries)
  };
  const blob = new Blob([JSON.stringify(payload, null, 2) + '\n'], { type: 'application/json;charset=utf-8' });
  downloadBlob(blob, 'atlas-all-installed-language-packs.json');
  showToast(`Exported ${entries.length} complete language packs.`, { kind: 'success' });
}

async function exportAtlasSelectedLanguagePack() {
  const language = String($('interfaceLanguage')?.value || 'en');
  const pack = atlasDownloadedLanguagePacks[language];
  if (!pack || !isAtlasLanguagePackComplete(language)) {
    showToast('No downloaded language pack is available to export.');
    return;
  }
  downloadBlob(getAtlasLanguagePackAsBlob(pack), `atlas-language-${language}-pack.json`);
  showToast('Language pack exported.', { kind: 'success' });
}

async function removeAtlasSelectedLanguagePack() {
  const language = String($('interfaceLanguage')?.value || 'en');
  if (!language || language === 'en' || !atlasDownloadedLanguagePacks[language]) return;
  const nextPacks = { ...atlasDownloadedLanguagePacks };
  delete nextPacks[language];
  try {
    await chrome.storage.local.set({ [ATLAS_LANGUAGE_PACKS_STORAGE_KEY]: nextPacks });
    atlasDownloadedLanguagePacks = nextPacks;
    window.ATLAS_DOWNLOADED_LANGUAGE_PACKS = atlasDownloadedLanguagePacks;
    delete ATLAS_PREWRITTEN_TRANSLATIONS[language];
    const select = $('interfaceLanguage');
    if (atlasInterfaceLanguage === language) {
      await saveAppearancePreferences({ interfaceLanguage: 'en' });
      if (select) select.value = 'en';
      const wrapper = document.querySelector('[data-animated-select="interfaceLanguage"]');
      if (wrapper) { populateAnimatedSelectMenu(wrapper); updateAnimatedSelect(wrapper); }
      await startAtlasInterfaceTranslation('en', { forceLanguageChange: true });
    }
    updateAtlasLanguagePackUi(select?.value || 'en');
    showToast('Language pack removed.', { kind: 'success' });
  } catch (error) {
    console.error('Could not remove the Atlas language pack:', error);
    showToast('Could not remove the saved language pack. Try again.', { kind: 'error' });
  }
}

function initAtlasLanguagePackManager() {
  if (atlasLanguagePackManagerBound) return;
  atlasLanguagePackManagerBound = true;
  const apiKey = $('translationApiKey');
  const showHide = $('toggleTranslationApiKey');
  const download = $('downloadLanguagePackBtn');
  const exportButton = $('exportLanguagePackBtn');
  const removeButton = $('removeLanguagePackBtn');
  const downloadAllButton = $('downloadAllLanguagePacksBtn');
  const exportAllButton = $('exportAllLanguagePacksBtn');
  if (apiKey) {
    chrome.storage.session?.get(ATLAS_TRANSLATION_API_KEY_SESSION_KEY).then((stored) => {
      if (document.activeElement !== apiKey && !apiKey.value && stored?.[ATLAS_TRANSLATION_API_KEY_SESSION_KEY]) apiKey.value = stored[ATLAS_TRANSLATION_API_KEY_SESSION_KEY];
    }).catch(() => {});
    apiKey.addEventListener('change', () => { void getAtlasTranslationApiKey(); });
  }
  if (showHide && apiKey) {
    showHide.addEventListener('click', () => {
      const showing = apiKey.type === 'text';
      apiKey.type = showing ? 'password' : 'text';
      showHide.textContent = showing ? 'Show API key' : 'Hide API key';
      showHide.setAttribute('aria-pressed', String(!showing));
    });
  }
  download?.addEventListener('click', () => { void downloadAtlasSelectedLanguagePack(); });
  exportButton?.addEventListener('click', () => { void exportAtlasSelectedLanguagePack(); });
  removeButton?.addEventListener('click', () => { void removeAtlasSelectedLanguagePack(); });
  downloadAllButton?.addEventListener('click', () => { void downloadAtlasAllLanguagePacks(); });
  exportAllButton?.addEventListener('click', () => { void exportAtlasAllInstalledLanguagePacks(); });
}

function initLanguagePicker(prefs = {}) {
  const select = $('interfaceLanguage'); if (!select) return;
  const current = String(prefs.interfaceLanguage || 'en');
  select.replaceChildren(...ATLAS_LANGUAGES.map(([code, name, native]) => new Option(`${name} · ${native}`, code)));
  select.value = ATLAS_LANGUAGES.some(([code]) => code === current) ? current : 'en';
  const wrapper = document.querySelector('[data-animated-select="interfaceLanguage"]');
  if (wrapper) { populateAnimatedSelectMenu(wrapper); updateAnimatedSelect(wrapper); }
  const search = $('interfaceLanguageSearch');
  const searchResults = $('languageSearchResults');
  const normalizeLanguageSearch = (value) => String(value || '')
    .normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().trim();
  const matchingLanguages = (query) => {
    const needle = normalizeLanguageSearch(query);
    if (!needle) return [];
    return ATLAS_LANGUAGES.filter(([code, name, native]) =>
      [code, name, native].some((value) => normalizeLanguageSearch(value).includes(needle))
    );
  };
  const hideLanguageSearchResults = () => {
    if (!searchResults) return;
    searchResults.hidden = true;
    searchResults.replaceChildren();
    search?.setAttribute('aria-expanded', 'false');
  };
  const chooseLanguage = (code) => {
    if (!ATLAS_LANGUAGES.some(([languageCode]) => languageCode === code)) return;
    // Restore the hidden native-select options before updating the custom picker.
    for (const option of select.options) option.hidden = false;
    select.value = code;
    if (search) search.value = '';
    hideLanguageSearchResults();
    if (wrapper) {
      populateAnimatedSelectMenu(wrapper);
      updateAnimatedSelect(wrapper);
      closeAnimatedSelect(wrapper, true);
    }
    // Dispatch even for the current language so a user can retry translation.
    select.dispatchEvent(new Event('change', { bubbles: true }));
  };
  const renderLanguageSearchResults = (query) => {
    if (!searchResults) return [];
    const matches = matchingLanguages(query);
    searchResults.replaceChildren();
    if (!String(query || '').trim()) {
      searchResults.hidden = true;
      search?.setAttribute('aria-expanded', 'false');
      return matches;
    }
    searchResults.hidden = false;
    search?.setAttribute('aria-expanded', 'true');
    if (!matches.length) {
      const empty = document.createElement('div');
      empty.className = 'language-search-empty';
      empty.textContent = 'No languages found';
      empty.setAttribute('role', 'status');
      searchResults.appendChild(empty);
      return matches;
    }
    for (const [code, name, nativeName] of matches) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'language-search-result';
      button.setAttribute('role', 'option');
      button.dataset.value = code;
      button.setAttribute('aria-selected', String(select.value === code));
      button.setAttribute('lang', code);
      const copy = document.createElement('span');
      copy.className = 'language-search-result-copy';
      const primary = document.createElement('strong');
      primary.className = 'language-search-result-name';
      primary.textContent = name;
      const native = document.createElement('small');
      native.className = 'language-search-result-native';
      native.textContent = nativeName;
      native.setAttribute('lang', code);
      copy.append(primary, native);
      const check = document.createElement('span');
      check.className = 'language-search-result-check';
      check.setAttribute('aria-hidden', 'true');
      check.innerHTML = '<svg viewBox="0 0 24 24" focusable="false"><path d="m5 12 4.2 4.2L19 6.5"/></svg>';
      button.append(copy, check);
      button.addEventListener('click', () => chooseLanguage(code));
      button.addEventListener('keydown', (event) => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
        event.preventDefault();
        const buttons = [...searchResults.querySelectorAll('.language-search-result')];
        const index = buttons.indexOf(button);
        const next = event.key === 'ArrowDown' ? Math.min(buttons.length - 1, index + 1) : Math.max(0, index - 1);
        buttons[next]?.focus({ preventScroll: true });
      });
      searchResults.appendChild(button);
    }
    return matches;
  };
  if (search && !search.dataset.bound) {
    search.dataset.bound = 'true';
    search.addEventListener('input', () => {
      const query = search.value.trim();
      const matches = renderLanguageSearchResults(query);
      for (const option of select.options) {
        option.hidden = Boolean(query) && !matches.some(([code]) => code === option.value);
      }
      if (wrapper) populateAnimatedSelectMenu(wrapper);
    });
    search.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' && searchResults && !searchResults.hidden) {
        event.preventDefault();
        searchResults.querySelector('.language-search-result')?.focus({ preventScroll: true });
      } else if (event.key === 'Enter' && searchResults && !searchResults.hidden) {
        const first = searchResults.querySelector('.language-search-result');
        if (first) { event.preventDefault(); first.click(); }
      } else if (event.key === 'Escape' && searchResults && !searchResults.hidden) {
        event.preventDefault();
        search.value = '';
        renderLanguageSearchResults('');
        for (const option of select.options) option.hidden = false;
        if (wrapper) populateAnimatedSelectMenu(wrapper);
      }
    });
  }
  if (!select.dataset.bound) {
    select.dataset.bound = 'true';
    select.addEventListener('change', async () => {
      const lang = select.value || 'en';
      try {
        updateAtlasLanguagePackUi(lang);
        if (lang !== 'en' && !isAtlasLanguagePackComplete(lang)) {
          showToast('The selected language is not downloaded yet. Download the pack to apply it.');
          return;
        }
        await saveAppearancePreferences({ interfaceLanguage: lang });
        await startAtlasInterfaceTranslation(lang, { forceLanguageChange: true });
      } catch (error) {
        console.error('Atlas could not change the interface language:', error);
        showToast('Atlas could not apply its downloaded language pack. Try again.');
      }
    });
  }
  initAtlasLanguagePackManager();
  updateAtlasLanguagePackUi(select.value || 'en');
  startAtlasInterfaceTranslationObserver();
  void startAtlasInterfaceTranslation(select.value || 'en', { silent: true });
}

function readThemeFromControls() {
  const theme = { name: $('customThemeName')?.value.trim() || CUSTOM_THEME_DEFAULTS.name };
  for (const key of ['background','surface','primary','accent','text']) {
    const field = $(`themeColor${key[0].toUpperCase()}${key.slice(1)}Code`);
    theme[key] = field?.value.trim() || CUSTOM_THEME_DEFAULTS[key];
  }
  return normalizeCustomTheme(theme);
}
function paintCustomThemePreview(theme) {
  const preview = $('customThemePreview'); if (!preview) return;
  const colors = normalizeCustomTheme(theme);
  preview.style.setProperty('--preview-bg', colors.background);
  preview.style.setProperty('--preview-surface', colors.surface);
  preview.style.setProperty('--preview-primary', colors.primary);
  preview.style.setProperty('--preview-accent', colors.accent);
  preview.style.setProperty('--preview-text', colors.text);
}
function createThemeId() {
  try { if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID(); } catch (_) {}
  return `atlas-theme-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
}
function normalizeThemeLibraryItem(theme = {}) {
  const normalized = normalizeCustomTheme(theme);
  normalized.id = String(theme.id || createThemeId()).slice(0, 100);
  return normalized;
}
async function getThemeCollections() {
  const stored = await chrome.storage.local.get([SAVED_CUSTOM_THEMES_KEY, DELETED_CUSTOM_THEMES_KEY]);
  let saved = Array.isArray(stored[SAVED_CUSTOM_THEMES_KEY]) ? stored[SAVED_CUSTOM_THEMES_KEY].map(normalizeThemeLibraryItem) : [];
  let deleted = Array.isArray(stored[DELETED_CUSTOM_THEMES_KEY]) ? stored[DELETED_CUSTOM_THEMES_KEY].map(normalizeThemeLibraryItem) : [];
  // Preserve custom themes made by older Atlas builds that stored only one palette.
  if (!Array.isArray(stored[SAVED_CUSTOM_THEMES_KEY])) {
    const prefs = (await chrome.storage.local.get('mapLeadAppearancePrefs')).mapLeadAppearancePrefs || {};
    if (prefs.customTheme && typeof prefs.customTheme === 'object') {
      const legacy = normalizeThemeLibraryItem(prefs.customTheme);
      saved.unshift(legacy);
      await chrome.storage.local.set({ [SAVED_CUSTOM_THEMES_KEY]: saved, [DELETED_CUSTOM_THEMES_KEY]: deleted });
    }
  }
  // De-duplicate malformed or older entries by stable ID while preserving order.
  const unique = (items) => {
    const seen = new Set();
    return items.filter((item) => { if (seen.has(item.id)) return false; seen.add(item.id); return true; });
  };
  return { saved: unique(saved), deleted: unique(deleted) };
}
async function writeThemeCollections(saved, deleted) {
  await chrome.storage.local.set({
    [SAVED_CUSTOM_THEMES_KEY]: saved.map(normalizeThemeLibraryItem),
    [DELETED_CUSTOM_THEMES_KEY]: deleted.map(normalizeThemeLibraryItem)
  });
}
function readThemeEditorDraft() {
  const theme = { name: $('customThemeName')?.value.trim() || CUSTOM_THEME_DEFAULTS.name };
  for (const key of ['background','surface','primary','accent','text']) {
    const field = $(`themeColor${key[0].toUpperCase()}${key.slice(1)}Code`);
    theme[key] = field?.value.trim() || CUSTOM_THEME_DEFAULTS[key];
    if (!isValidCssColor(theme[key])) return { errorField: field, theme };
  }
  theme.name = String(theme.name || CUSTOM_THEME_DEFAULTS.name).slice(0, 32);
  if (editingCustomThemeId) theme.id = editingCustomThemeId;
  return { theme: normalizeThemeLibraryItem(theme) };
}
function writeThemeToEditor(theme, id = theme?.id || null) {
  const normalized = normalizeThemeLibraryItem(theme || CUSTOM_THEME_DEFAULTS);
  const name = $('customThemeName');
  if (name) name.value = normalized.name;
  for (const key of ['background','surface','primary','accent','text']) {
    const cap = key[0].toUpperCase() + key.slice(1);
    const native = $(`themeColor${cap}`), code = $(`themeColor${cap}Code`);
    if (native) native.value = colorToHex(normalized[key]);
    if (code) { code.value = normalized[key]; code.removeAttribute('aria-invalid'); }
  }
  editingCustomThemeId = id;
  paintCustomThemePreview(normalized);
  clearCustomThemeError();
}
async function keepThemeInLibrary(theme) {
  const { saved, deleted } = await getThemeCollections();
  const matchingId = theme.id && saved.some((entry) => entry.id === theme.id) ? theme.id : null;
  const matchingName = saved.find((entry) => entry.name.toLocaleLowerCase() === theme.name.toLocaleLowerCase());
  const id = matchingId || matchingName?.id || createThemeId();
  const kept = { ...normalizeThemeLibraryItem(theme), id, savedAt: Date.now() };
  const nextSaved = matchingId
    ? saved.map((entry) => entry.id === id ? kept : entry)
    : matchingName
      ? saved.map((entry) => entry.id === id ? kept : entry)
      : [kept, ...saved];
  const nextDeleted = deleted.filter((entry) => entry.id !== id && entry.name.toLocaleLowerCase() !== kept.name.toLocaleLowerCase());
  await writeThemeCollections(nextSaved, nextDeleted);
  editingCustomThemeId = id;
  await renderThemeLibrary();
  return kept;
}
function makeThemeSwatches(theme) {
  const swatches = document.createElement('span');
  swatches.className = 'theme-library-swatches';
  for (const color of [theme.background, theme.surface, theme.primary, theme.accent, theme.text]) {
    const dot = document.createElement('span');
    dot.className = 'theme-library-swatch';
    dot.setAttribute('data-i18n-ignore', ''); // HEX values are data, not translatable UI text.
    dot.style.background = color;
    dot.title = color;
    dot.setAttribute('aria-label', color);
    swatches.appendChild(dot);
  }
  return swatches;
}
function makeThemeLibraryAction(label, action, kind = 'secondary') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `button button-${kind} theme-library-action`;
  button.textContent = label;
  button.addEventListener('click', action);
  return button;
}
async function applySavedTheme(theme) {
  const normalized = normalizeThemeLibraryItem(theme);
  writeThemeToEditor(normalized, normalized.id);
  await saveAppearancePreferences({ theme: 'custom-theme', customTheme: normalized });
  showCustomThemeError(`${normalized.name} applied.`, true);
  showToast(`${normalized.name} theme applied.`, { kind: 'success' });
}
async function deleteSavedTheme(theme) {
  const { saved, deleted } = await getThemeCollections();
  const entry = saved.find((item) => item.id === theme.id);
  if (!entry) return;
  const nextSaved = saved.filter((item) => item.id !== theme.id);
  const nextDeleted = [{ ...entry, deletedAt: Date.now() }, ...deleted.filter((item) => item.id !== entry.id)].slice(0, 50);
  await writeThemeCollections(nextSaved, nextDeleted);
  const stored = (await chrome.storage.local.get('mapLeadAppearancePrefs')).mapLeadAppearancePrefs || {};
  if (stored.theme === 'custom-theme' && stored.customTheme && normalizeCustomTheme(stored.customTheme).name === entry.name) {
    await saveAppearancePreferences({ theme: 'classic-light' });
  }
  if (editingCustomThemeId === entry.id) editingCustomThemeId = null;
  await renderThemeLibrary();
  showCustomThemeError(`Moved “${entry.name}” to Recently deleted. You can restore it later.`, true);
}
async function restoreDeletedTheme(id) {
  const { saved, deleted } = await getThemeCollections();
  const entry = deleted.find((item) => item.id === id);
  if (!entry) return;
  const nextDeleted = deleted.filter((item) => item.id !== id);
  const collision = saved.find((item) => item.name.toLocaleLowerCase() === entry.name.toLocaleLowerCase());
  const restored = { ...entry, id: collision ? createThemeId() : entry.id, restoredAt: Date.now() };
  await writeThemeCollections([restored, ...saved], nextDeleted);
  await renderThemeLibrary();
  showCustomThemeError(`Restored “${restored.name}” to Saved themes.`, true);
}
async function permanentlyDeleteTheme(id) {
  const { saved, deleted } = await getThemeCollections();
  const entry = deleted.find((item) => item.id === id);
  if (!entry) return;
  const nextDeleted = deleted.filter((item) => item.id !== id);
  await writeThemeCollections(saved, nextDeleted);
  await renderThemeLibrary();
  showCustomThemeError(`“${entry.name}” was permanently deleted.`, true);
}
async function renderThemeLibrary() {
  const savedHost = $('savedThemeList');
  const deletedHost = $('deletedThemeList');
  if (!savedHost || !deletedHost) return;
  let collections;
  try { collections = await getThemeCollections(); }
  catch (_) { return; }
  const { saved, deleted } = collections;
  const draw = (host, items, isDeleted) => {
    host.replaceChildren();
    if (!items.length) {
      const empty = document.createElement('p');
      empty.className = 'theme-library-empty';
      empty.textContent = isDeleted ? 'No deleted themes to restore.' : 'No custom themes saved yet.';
      host.appendChild(empty);
      return;
    }
    items.forEach((theme) => {
      const row = document.createElement('article');
      row.className = 'theme-library-item';
      const main = document.createElement('div');
      main.className = 'theme-library-item-main';
      const title = document.createElement('strong');
      title.className = 'theme-library-item-title';
      title.textContent = theme.name;
      const metadata = document.createElement('small');
      metadata.className = 'theme-library-item-meta';
      metadata.textContent = isDeleted ? 'Deleted custom theme' : 'Saved custom theme';
      main.append(title, metadata, makeThemeSwatches(theme));
      const actions = document.createElement('div');
      actions.className = 'theme-library-item-actions';
      if (isDeleted) {
        actions.append(
          makeThemeLibraryAction('Restore', () => restoreDeletedTheme(theme.id), 'primary'),
          makeThemeLibraryAction('Delete permanently', () => permanentlyDeleteTheme(theme.id), 'secondary')
        );
      } else {
        actions.append(
          makeThemeLibraryAction('Apply', () => applySavedTheme(theme).catch(() => showCustomThemeError('Could not apply this theme.')) , 'primary'),
          makeThemeLibraryAction('Edit', () => { writeThemeToEditor(theme, theme.id); showCustomThemeError(`Editing “${theme.name}”. Save changes to update it.`, true); }),
          makeThemeLibraryAction('Delete', () => deleteSavedTheme(theme).catch(() => showCustomThemeError('Could not delete this theme.')), 'secondary')
        );
      }
      row.append(main, actions);
      host.appendChild(row);
    });
  };
  draw(savedHost, saved, false);
  draw(deletedHost, deleted, true);
  const count = $('deletedThemeCount');
  if (count) count.textContent = String(deleted.length);
  const toggle = $('toggleDeletedThemesBtn');
  if (toggle) {
    toggle.disabled = deleted.length === 0;
    toggle.setAttribute('aria-label', deleted.length ? `Show ${deleted.length} deleted themes` : 'No deleted themes');
  }
  const restoreAll = $('restoreAllDeletedThemesBtn');
  if (restoreAll) restoreAll.disabled = deleted.length === 0;
}

function initCustomThemeStudio(prefs = {}) {
  const saved = normalizeCustomTheme(prefs.customTheme || CUSTOM_THEME_DEFAULTS);
  writeThemeToEditor(saved, prefs.customTheme?.id || null);
  for (const key of ['background','surface','primary','accent','text']) {
    const cap = key[0].toUpperCase() + key.slice(1);
    const native = $(`themeColor${cap}`);
    const code = $(`themeColor${cap}Code`);
    const hex = colorToHex(saved[key]);
    if (native) native.value = hex;
    if (code) code.value = saved[key];
    if (native && code && !native.dataset.bound) {
      native.dataset.bound = 'true';
      native.addEventListener('input', () => {
        code.value = native.value.toUpperCase();
        code.removeAttribute('aria-invalid');
        paintCustomThemePreview(readThemeFromControls());
        clearCustomThemeError();
      });
    }
    if (code && native && !code.dataset.bound) {
      code.dataset.bound = 'true';
      code.addEventListener('input', () => {
        const valid = isValidCssColor(code.value.trim());
        code.setAttribute('aria-invalid', String(!valid));
        if (valid) native.value = colorToHex(code.value.trim());
        paintCustomThemePreview(readThemeFromControls());
        clearCustomThemeError();
      });
      code.addEventListener('blur', () => { if (isValidCssColor(code.value.trim())) code.value = code.value.trim(); });
    }
  }
  const name = $('customThemeName');
  if (name && !name.dataset.bound) {
    name.dataset.bound = 'true';
    name.addEventListener('input', () => {
      const live = readThemeFromControls();
      live.name = name.value;
      paintCustomThemePreview(live);
    });
  }
  paintCustomThemePreview(saved);
  const applyButton = $('applyCustomThemeBtn');
  if (applyButton && !applyButton.dataset.bound) {
    applyButton.dataset.bound = 'true';
    applyButton.addEventListener('click', async () => {
      const draft = readThemeEditorDraft();
      if (draft.errorField) { draft.errorField.focus(); showCustomThemeError('Enter a valid HEX, RGB, or HSL color value for each field.'); return; }
      try {
        const theme = await keepThemeInLibrary(draft.theme);
        await saveAppearancePreferences({ theme: 'custom-theme', customTheme: theme });
        paintCustomThemePreview(theme);
        showCustomThemeError(`${theme.name} saved and applied.`, true);
        showToast(`${theme.name} theme applied.`, { kind: 'success' });
      } catch (_) { showCustomThemeError('Could not save this theme. Please try again.'); }
    });
  }
  const keepButton = $('keepCustomThemeBtn');
  if (keepButton && !keepButton.dataset.bound) {
    keepButton.dataset.bound = 'true';
    keepButton.addEventListener('click', async () => {
      const draft = readThemeEditorDraft();
      if (draft.errorField) { draft.errorField.focus(); showCustomThemeError('Enter a valid HEX, RGB, or HSL color value for each field.'); return; }
      try {
        const theme = await keepThemeInLibrary(draft.theme);
        writeThemeToEditor(theme, theme.id);
        showCustomThemeError(`Kept “${theme.name}” in Saved themes.`, true);
        showToast(`${theme.name} saved to your theme library.`, { kind: 'success' });
      } catch (_) { showCustomThemeError('Could not save this theme. Please try again.'); }
    });
  }
  const resetButton = $('resetCustomThemeBtn');
  if (resetButton && !resetButton.dataset.bound) {
    resetButton.dataset.bound = 'true';
    resetButton.addEventListener('click', () => {
      writeThemeToEditor(CUSTOM_THEME_DEFAULTS, null);
      clearCustomThemeError();
    });
  }
  const toggleDeleted = $('toggleDeletedThemesBtn');
  if (toggleDeleted && !toggleDeleted.dataset.bound) {
    toggleDeleted.dataset.bound = 'true';
    toggleDeleted.addEventListener('click', () => {
      const panel = $('deletedThemeLibrary');
      if (!panel) return;
      panel.hidden = !panel.hidden;
      toggleDeleted.setAttribute('aria-expanded', String(!panel.hidden));
    });
  }
  const restoreAll = $('restoreAllDeletedThemesBtn');
  if (restoreAll && !restoreAll.dataset.bound) {
    restoreAll.dataset.bound = 'true';
    restoreAll.addEventListener('click', async () => {
      try {
        const { saved, deleted } = await getThemeCollections();
        if (!deleted.length) return;
        const names = new Set(saved.map((item) => item.name.toLocaleLowerCase()));
        const restored = deleted.map((item) => ({ ...item, id: names.has(item.name.toLocaleLowerCase()) ? createThemeId() : item.id, restoredAt: Date.now() }));
        await writeThemeCollections([...restored, ...saved], []);
        await renderThemeLibrary();
        const panel = $('deletedThemeLibrary'); if (panel) panel.hidden = true;
        if (toggleDeleted) toggleDeleted.setAttribute('aria-expanded', 'false');
        showCustomThemeError(`Restored ${restored.length} deleted theme${restored.length === 1 ? '' : 's'}.`, true);
      } catch (_) { showCustomThemeError('Could not restore deleted themes. Please try again.'); }
    });
  }
  renderThemeLibrary().catch(() => {});
}
function showCustomThemeError(message, success = false) {
  const node = $('customThemeError'); if (!node) return;
  node.textContent = message; node.hidden = !message; node.classList.toggle('is-success', Boolean(success));
}
function clearCustomThemeError() { const node = $('customThemeError'); if (node) { node.hidden = true; node.textContent = ''; node.classList.remove('is-success'); } }

function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}

let latestPreviewRecords = [];
let lastPreviewRenderSignature = null;

function safeExternalUrl(rawValue) {
  const raw = String(rawValue || '').trim();
  if (!raw) return '';
  try {
    const normalized = /^https?:\/\//i.test(raw) ? raw : `https://${raw}`;
    const parsed = new URL(normalized);
    return ['http:', 'https:'].includes(parsed.protocol) ? parsed.href : '';
  } catch (_) {
    return '';
  }
}

function createPreviewLink(label, url, className, title) {
  const anchor = document.createElement('a');
  anchor.className = className;
  anchor.textContent = String(label || '');
  anchor.href = url;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  anchor.title = title || String(label || 'Open link in a new tab');
  return anchor;
}

async function handlePreviewPhoneClick(phone) {
  const original = String(phone || '').trim();
  if (!original) return;
  const normalizedSource = original.replace(/^tel:\s*/i, '').trim();
  let digits = normalizedSource.replace(/\D/g, '');
  const hasInternationalPrefix = /^(?:tel:\s*)?(?:\+|00)/i.test(original);
  const action = ['auto', 'whatsapp', 'clipboard'].includes($('phoneClickAction')?.value)
    ? $('phoneClickAction').value
    : 'auto';
  if (digits.startsWith('00')) digits = digits.slice(2);
  const validDigits = digits.length >= 7 && digits.length <= 15;
  const openWhatsApp = action === 'whatsapp' || (action === 'auto' && hasInternationalPrefix && validDigits);
  if (openWhatsApp && validDigits) {
    window.open(`https://wa.me/${digits}`, '_blank', 'noopener,noreferrer');
    return;
  }
  try {
    if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
      await navigator.clipboard.writeText(original);
    } else {
      const field = document.createElement('textarea');
      field.value = original;
      field.setAttribute('readonly', '');
      field.style.position = 'fixed';
      field.style.opacity = '0';
      document.body.appendChild(field);
      field.select();
      const copied = document.execCommand('copy');
      field.remove();
      if (!copied) throw new Error('Clipboard unavailable');
    }
    const autoNeedsPrefix = action === 'auto' && !hasInternationalPrefix;
    showToast(autoNeedsPrefix
      ? 'Phone number copied. Add an international country code to open it in WhatsApp automatically.'
      : 'Phone number copied to clipboard.', { kind: 'success' });
  } catch (_) {
    showToast('Could not copy the phone number. Please select and copy it manually.');
  }
}

function renderPreview(records) {
  latestPreviewRecords = Array.isArray(records) ? records : [];
  const body = $('previewRows');
  const searchInput = $('previewSearchInput');
  const query = String(searchInput?.value || '').trim().toLocaleLowerCase();
  const phoneAction = ['auto', 'whatsapp', 'clipboard'].includes($('phoneClickAction')?.value)
    ? $('phoneClickAction').value
    : 'auto';
  // The popup refreshes its status periodically. Avoid rebuilding hundreds of rows
  // every second when neither the records nor the preview query has changed.
  const renderSignature = JSON.stringify({
    query,
    phoneAction,
    records: latestPreviewRecords.map((record) => [record.name, record.phone, record.category, record.address, record.website, record.mapsUrl])
  });
  if (renderSignature === lastPreviewRenderSignature) return;
  lastPreviewRenderSignature = renderSignature;
  const filtered = latestPreviewRecords.slice().reverse().filter((record) => {
    if (!query) return true;
    const haystack = [record.name, record.phone, record.category, record.address, record.website, record.mapsUrl]
      .map((value) => String(value || '')).join(' ').toLocaleLowerCase();
    return haystack.includes(query);
  });
  if ($('previewSearchClear')) $('previewSearchClear').hidden = !query;
  body.replaceChildren();

  if (!filtered.length) {
    const row = document.createElement('tr');
    const cell = document.createElement('td');
    cell.colSpan = 3;
    cell.className = 'empty-cell';
    cell.textContent = latestPreviewRecords.length
      ? 'No saved leads match this search.'
      : 'Your results will appear here.';
    row.appendChild(cell);
    body.appendChild(row);
    $('previewMeta').textContent = query
      ? `0 of ${latestPreviewRecords.length.toLocaleString()} shown`
      : '0 saved';
    return;
  }

  for (const record of filtered) {
    const tr = document.createElement('tr');

    const businessCell = document.createElement('td');
    const businessName = String(record.name || 'Unnamed business');
    // Prefer a direct Maps profile URL; fall back to the company's website.
    const mapsProfileUrl = safeExternalUrl(record.mapsUrl);
    const businessUrl = mapsProfileUrl || safeExternalUrl(record.website);
    if (businessUrl) {
      businessCell.appendChild(createPreviewLink(
        businessName,
        businessUrl,
        'preview-business-link',
        mapsProfileUrl ? 'Open Google Maps business profile in a new tab' : 'Open business website in a new tab'
      ));
    } else {
      const span = document.createElement('span');
      span.className = 'preview-business-name';
      span.textContent = businessName;
      businessCell.appendChild(span);
    }
    businessCell.title = businessName;
    tr.appendChild(businessCell);

    const phoneCell = document.createElement('td');
    const phone = String(record.phone || '').trim();
    if (phone) {
      const phoneButton = document.createElement('button');
      phoneButton.type = 'button';
      phoneButton.className = 'preview-phone-link';
      phoneButton.textContent = phone;
      phoneButton.title = phoneAction === 'whatsapp'
        ? 'Open this number in WhatsApp'
        : phoneAction === 'clipboard'
          ? 'Copy phone number'
          : 'Auto-detect: WhatsApp for explicit international numbers, otherwise copy';
      phoneButton.addEventListener('click', () => handlePreviewPhoneClick(phone));
      phoneCell.appendChild(phoneButton);
    } else {
      phoneCell.textContent = '—';
    }
    phoneCell.title = phone;
    tr.appendChild(phoneCell);

    const categoryCell = document.createElement('td');
    categoryCell.textContent = String(record.category || '—');
    categoryCell.title = String(record.category || '');
    tr.appendChild(categoryCell);
    body.appendChild(tr);
  }

  $('previewMeta').textContent = query
    ? `${filtered.length.toLocaleString()} of ${latestPreviewRecords.length.toLocaleString()} shown`
    : `${latestPreviewRecords.length.toLocaleString()} saved`;
}

function bindPreviewSearch() {
  const input = $('previewSearchInput');
  const clear = $('previewSearchClear');
  if (input && !input.dataset.bound) {
    input.dataset.bound = 'true';
    input.addEventListener('input', () => {
      const scrollBox = input.closest('.preview-card')?.querySelector('.table-wrap');
      if (scrollBox) scrollBox.scrollTop = 0;
      renderPreview(latestPreviewRecords);
    });
    input.addEventListener('keydown', (event) => {
      if (event.key === 'Escape' && input.value) {
        input.value = '';
        const scrollBox = input.closest('.preview-card')?.querySelector('.table-wrap');
        if (scrollBox) scrollBox.scrollTop = 0;
        renderPreview(latestPreviewRecords);
      }
    });
  }
  if (clear && !clear.dataset.bound) {
    clear.dataset.bound = 'true';
    clear.addEventListener('click', () => {
      if (input) { input.value = ''; input.focus(); }
      const scrollBox = input?.closest('.preview-card')?.querySelector('.table-wrap');
      if (scrollBox) scrollBox.scrollTop = 0;
      renderPreview(latestPreviewRecords);
    });
  }
}

function updateActivity(status) {
  const running = Boolean(status.running);
  $('scanActivity').classList.toggle('hidden', !running);
  if (!running) return;
  const start = Number(status.startedAt) || Date.now();
  $('elapsedTime').textContent = String(Math.max(0, Math.floor((Date.now() - start) / 1000)));
  const message = String(status.message || '').toLowerCase();
  let title = status.paused ? 'Collection paused' : 'Reading visible listings';
  let subtitle = status.paused ? 'Paused at a safe checkpoint. Your saved records are retained.' : 'Saving each business as it is found';
  if (status.paused) {
    title = 'Collection paused';
    subtitle = 'Paused at a safe checkpoint. Your saved records are retained.';
  } else if (status.mode === 'phones' || message.includes('phone')) {
    title = 'Looking up phone numbers';
    subtitle = 'Waiting for business profiles to load';
  } else if (message.includes('waiting') || message.includes('loading')) {
    title = 'Waiting for Google Maps';
    subtitle = 'Slow pages are allowed more time';
  } else if (message.includes('finding')) {
    title = 'Finding business cards';
    subtitle = 'Watching the results panel for new listings';
  } else if (message.includes('collected')) {
    title = 'Collecting clean records';
    subtitle = 'De-duplicating and saving as we go';
  } else if (message.includes('end of list')) {
    title = 'Finishing the list';
    subtitle = 'Saving the last records';
  }
  const titleNode = $('activityTitle').childNodes[0];
  if (titleNode) titleNode.textContent = title;
  $('activitySubtitle').textContent = `${subtitle} · Keep this Google Maps tab active. Collection may pause while another tab is selected; return to this tab to resume.`;
}

async function readStatusAndRepair() {
  const { mapLeadStatus = {} } = await chrome.storage.local.get('mapLeadStatus');
  const status = mapLeadStatus || {};
  if (status.running) {
    const heartbeat = Number(status.updatedAt || status.startedAt || 0);
    // Inactive Maps tabs can have heavily throttled timers. Do not mark a job
    // interrupted from a stale heartbeat alone: confirm the tab is gone or the
    // content task explicitly reports that it is no longer running.
    if (heartbeat && Date.now() - heartbeat > 5 * 60 * 1000) {
      // Probe at a limited cadence so a throttled hidden tab does not create
      // a burst of messaging attempts while the panel continues refreshing.
      if (Date.now() - lastBackgroundStatusProbeAt < 15000) return status;
      lastBackgroundStatusProbeAt = Date.now();
      let tab = null;
      try {
        if (Number.isInteger(status.tabId)) tab = await chrome.tabs.get(status.tabId);
      } catch { /* A missing tab is a definitive interruption. */ }

      const tabGone = !tab || tab.discarded || !isGoogleMapsUrl(tab.url || '');
      let confirmedStopped = false;
      if (!tabGone && tab.status !== 'loading') {
        try {
          const response = await Promise.race([
            chrome.tabs.sendMessage(tab.id, { type: 'MAPLEADS_V130_STATUS' }),
            new Promise((resolve) => window.setTimeout(() => resolve(null), 1800))
          ]);
          confirmedStopped = response?.ok === true && response.running === false;
          if (response?.ok === true && response.running === true) return status;
        } catch { /* A hidden/frozen tab may not answer immediately; keep its job state. */ }
      }

      if (tabGone || confirmedStopped) {
        const repaired = {
          ...status,
          running: false,
          interrupted: true,
          progress: 0,
          updatedAt: Date.now(),
          message: tabGone
            ? 'The Maps tab is no longer available. Saved records are safe; reopen Maps and press Start scan to continue.'
            : 'The Maps collector stopped responding after a page change. Saved records are safe; press Start scan to resume.'
        };
        await chrome.storage.local.set({ mapLeadStatus: repaired });
        return repaired;
      }
    }
  }
  return status;
}

async function refreshUI() {
  try {
    const data = await chrome.storage.local.get(['mapLeadRecords', 'mapLeadStatus', 'mapLeadResetEpoch', 'mapLeadRecordsEpoch', 'mapLeadResetPending', 'mapLeadResetPendingAt']);
    const records = currentRecordsFromStorage(data);
    const status = await readStatusAndRepair();
    lastStatus = status;
    const onMaps = Boolean(activeTab && isGoogleMapsUrl(activeTab.url || ''));
    const pendingPhones = records.filter((record) => !String(record.phone || '').trim() && !record.phoneLookupAttempted && record.mapsUrl).length;
    $('recordCount').textContent = records.length.toLocaleString();
    $('exportCount').textContent = records.length.toLocaleString();
    $('exportBtn').disabled = records.length === 0 || selectedExportColumns().length === 0;
    $('clearBtn').disabled = records.length === 0 && !status.running;
    $('progressBar').style.width = `${Math.max(0, Math.min(100, Number(status.progress || 0)))}%`;
    $('progressBar').classList.toggle('is-running', Boolean(status.running));
    if (status.message) $('statusText').textContent = status.message;
    const running = Boolean(status.running);
    const paused = Boolean(status.paused);
    const resetPending = isResetPending(data);
    $('scanBtn').classList.toggle('hidden', running);
    $('scanControlRow').classList.toggle('hidden', !running);
    $('stopBtn').textContent = status.mode === 'phones' ? 'Stop phone lookup' : 'Stop scan';
    $('pauseBtn').hidden = !running || paused;
    $('resumeBtn').hidden = !running || !paused;
    $('pauseBtn').textContent = status.mode === 'phones' ? 'Pause lookup' : 'Pause scan';
    $('resumeBtn').textContent = status.mode === 'phones' ? 'Resume lookup' : 'Resume scan';
    $('scanBtn').disabled = running || resetPending;
    $('scanBtnText').textContent = onMaps
      ? (status.interrupted || status.error ? 'Retry / resume scan' : 'Start scan')
      : 'Detect Maps & start scan';
    if (data.mapLeadResetPending === true && !resetPending) chrome.storage.local.set({ mapLeadResetPending: false, mapLeadResetPendingAt: 0 });
    $('phoneBtn').disabled = running || resetPending || pendingPhones === 0;
    const limitValue = $('limitSelect').value;
    const suffix = limitValue === 'unlimited' ? 'all pending' : Math.min(pendingPhones, Number(limitValue || 50));
    $('phoneBtnText').textContent = pendingPhones > 0 ? `Find phone numbers · ${suffix}` : 'Find phone numbers';
    $('pageBadge').classList.toggle('status-ready', onMaps);
    $('pageBadge').classList.toggle('status-neutral', !onMaps);
    $('pageBadge').classList.toggle('status-busy', running);
    $('pageBadgeText').textContent = running ? (paused ? 'Paused' : 'Working') : onMaps ? 'Maps detected' : 'Open Maps';
    updateActivity(status);
    renderPreview(records);
    if (!running && status.progress >= 100) $('progressBar').style.width = '100%';
    if (!onMaps && !running && !status.message) $('statusText').textContent = 'Keep this Google Maps tab active. Collection may pause while another tab is selected; return to this tab to resume.';
  } catch (error) {
    $('statusText').textContent = `Could not read saved data: ${error.message || error}`;
  }
}


// Search all saved records from the preview table; bind once after the shell is mounted.
bindPreviewSearch();

function normalizeSearchSignature(value) {
  return String(value || '').trim().replace(/\s+/g, ' ').toLocaleLowerCase();
}

// Ignore any record array written by a scan that started before the latest reset.
// Legacy datasets without epoch metadata remain valid until the first reset.
function currentRecordsFromStorage(data = {}) {
  const resetEpoch = Number(data.mapLeadResetEpoch || 0);
  const recordsEpoch = data.mapLeadRecordsEpoch == null ? 0 : Number(data.mapLeadRecordsEpoch);
  if (recordsEpoch !== resetEpoch) return [];
  return Array.isArray(data.mapLeadRecords) ? data.mapLeadRecords : [];
}

function nextResetEpoch(data = {}) {
  const current = Number(data.mapLeadResetEpoch || 0);
  return (Number.isFinite(current) && current >= 0 ? Math.trunc(current) : 0) + 1;
}

function isResetPending(data = {}) {
  return data.mapLeadResetPending === true && Number(data.mapLeadResetPendingAt || 0) > 0 && Date.now() - Number(data.mapLeadResetPendingAt) < 30000;
}

function combinedAtlasSearch() {
  return [$('queryInput').value.trim(), $('locationInput').value.trim()].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
}

async function readMapsSearch(tab) {
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: () => {
      const input = document.querySelector('#searchboxinput, input[aria-label*="Search Google Maps"], input[placeholder*="Search Google Maps"]');
      let query = String(input?.value || '').trim();
      // The URL is authoritative when the visible input is temporarily empty
      // during hydration or just before Maps commits a cleared search.
      if (!query) {
        try {
          const match = decodeURIComponent(location.pathname).match(/\/maps\/search\/([^/]+)/i);
          if (match) query = match[1].replace(/\+/g, ' ').trim();
        } catch {}
      }
      return { query, inputFound: Boolean(input), url: location.href };
    }
  });
  return results?.[0]?.result || null;
}

async function syncQueryFromMaps() {
  if (!isAutoMapsSearchSyncEnabled()) return;
  const tab = activeTab;
  if (!tab?.id || !isGoogleMapsUrl(tab.url || '')) return;
  try {
    const data = await readMapsSearch(tab);
    if (!data) return;
    const rawQuery = String(data.query || '').trim();
    const signature = normalizeSearchSignature(rawQuery);

    // Atlas-initiated navigation can take a moment to update the Maps input.
    // Ignore stale Maps text until the target query appears or the pending sync expires.
    if (pendingAtlasToMapsSync && pendingAtlasToMapsSync.tabId === tab.id) {
      const expected = normalizeSearchSignature(pendingAtlasToMapsSync.query);
      if (signature === expected) pendingAtlasToMapsSync = null;
      else if (Date.now() - pendingAtlasToMapsSync.startedAt < 15000) return;
      else pendingAtlasToMapsSync = null;
    }

    if (lastMapsObservedQuery === signature && lastMapsObservedTabId === tab.id) return;
    // Avoid interpreting a newly opened but not-yet-hydrated Maps page as an empty search.
    if (!rawQuery && !data.inputFound) return;
    lastMapsObservedQuery = signature;
    lastMapsObservedTabId = tab.id;

    const stored = (await chrome.storage.local.get('mapLeadQueryPrefs')).mapLeadQueryPrefs || {};
    const parts = rawQuery ? AtlasExport.normalizeFilenameParts(rawQuery, '') : { query: '', location: '' };
    const nextQuery = parts.query || '';
    const nextLocation = parts.location || '';
    if (nextQuery === String(stored.query || '').trim() && nextLocation === String(stored.location || '').trim()) {
      updateFilenamePreview();
      return;
    }
    await chrome.storage.local.set({
      mapLeadQueryPrefs: { ...stored, query: nextQuery, location: nextLocation, lastUrl: data.url || tab.url || stored.lastUrl || '' }
    });
  } catch { /* Maps may not have permission yet or may still be loading. */ }
}

function queryFromMapsUrl(rawUrl) {
  try {
    const url = new URL(rawUrl);
    const match = decodeURIComponent(url.pathname).match(/\/maps\/search\/([^/]+)/i);
    return match ? match[1].replace(/\+/g, ' ').trim() : '';
  } catch { return ''; }
}

async function syncQueryToMaps({ force = false } = {}) {
  if (!force && !isAutoMapsSearchSyncEnabled()) return false;
  const tab = activeTab;
  if (!tab?.id || !isGoogleMapsUrl(tab.url || '')) return false;
  const query = combinedAtlasSearch();
  const signature = normalizeSearchSignature(query);
  if (pendingAtlasToMapsSync && !pendingAtlasToMapsSync.scheduled && pendingAtlasToMapsSync.tabId === tab.id && normalizeSearchSignature(pendingAtlasToMapsSync.query) === signature) return;
  try {
    // URL comparison keeps Atlas-to-Maps syncing functional even before optional
    // scripting permission has been granted for reading the live Maps input.
    let currentQuery = queryFromMapsUrl(tab.url || '');
    try {
      const data = await readMapsSearch(tab);
      if (data) currentQuery = data.query || currentQuery;
    } catch { /* The URL can still be updated without script access. */ }
    if (normalizeSearchSignature(currentQuery) === signature) {
      pendingAtlasToMapsSync = null;
      return true;
    }
    const currentUrl = new URL(tab.url);
    currentUrl.pathname = query ? `/maps/search/${encodeURIComponent(query)}/` : '/maps';
    currentUrl.search = '';
    currentUrl.hash = '';
    pendingAtlasToMapsSync = { tabId: tab.id, query, startedAt: Date.now(), scheduled: false };
    await chrome.tabs.update(tab.id, { url: currentUrl.toString() });
    const stored = (await chrome.storage.local.get('mapLeadQueryPrefs')).mapLeadQueryPrefs || {};
    await chrome.storage.local.set({ mapLeadQueryPrefs: { ...stored, query: $('queryInput').value.trim(), location: $('locationInput').value.trim(), lastUrl: currentUrl.toString() } });
    return true;
  } catch (error) {
    pendingAtlasToMapsSync = null;
    console.warn('Atlas could not sync its search to Maps:', error);
    return false;
  }
}

function scheduleQueryToMapsSync() {
  window.clearTimeout(atlasToMapsSyncTimer);
  if (!isAutoMapsSearchSyncEnabled()) {
    atlasToMapsSyncTimer = null;
    updateMapsSyncControls();
    return;
  }
  // Mark the Atlas edit immediately so the Maps polling loop cannot overwrite
  // the text fields with the older query during the debounce window.
  if (activeTab?.id && isGoogleMapsUrl(activeTab.url || '')) {
    pendingAtlasToMapsSync = { tabId: activeTab.id, query: combinedAtlasSearch(), startedAt: Date.now(), scheduled: true };
  }
  atlasToMapsSyncTimer = window.setTimeout(() => { syncQueryToMaps(); }, 650);
}

async function refreshActiveTab(preferredTabId = null) {
  // Keep controls bound to the original Maps tab while a scan/phone lookup is
  // running. Switching browser tabs must not silently retarget the active job.
  let pinnedRunningTab = false;
  try {
    const { mapLeadStatus = {} } = await chrome.storage.local.get('mapLeadStatus');
    if (mapLeadStatus.running && Number.isInteger(mapLeadStatus.tabId)) {
      try {
        const runningTab = await chrome.tabs.get(mapLeadStatus.tabId);
        if (runningTab && isGoogleMapsUrl(runningTab.url || '')) {
          activeTab = runningTab;
          pinnedRunningTab = true;
        }
      } catch { /* The original tab may have been closed; fall back below. */ }
    }
  } catch { /* Preserve the normal tab detection fallback if storage is unavailable. */ }
  if (!pinnedRunningTab) activeTab = await findMapsTab(preferredTabId);
  if (!activeTab) activeTab = await getActiveTab();
  updateFilenamePreview();
  updateMapsSyncControls();
  await refreshUI();
}

$('openMapsBtn').addEventListener('click', async () => {
  const query = $('queryInput').value.trim();
  const location = $('locationInput').value.trim();
  if (!query) { showToast('Enter a business type or keyword first.'); $('queryInput').focus(); return; }
  const combined = [query, location].filter(Boolean).join(' ');

  // Manual mode reuses an already-open Maps tab when possible. If no Maps tab
  // exists, it opens the requested search and then lets the normal detector bind to it.
  if (!isAutoMapsSearchSyncEnabled()) {
    try {
      const currentTab = await getActiveTab();
      const targetTab = currentTab?.id && isGoogleMapsUrl(currentTab.url || '')
        ? currentTab
        : await findMapsTab();
      if (!targetTab?.id || !isGoogleMapsUrl(targetTab.url || '')) {
        const hasAccess = await requestMapsPermission();
        if (!hasAccess) { showToast('Google Maps access is required to open the search. Try again and choose Allow.'); return; }
        const url = `https://www.google.com/maps/search/${encodeURIComponent(combined)}/`;
        const oldPrefs = (await chrome.storage.local.get('mapLeadQueryPrefs')).mapLeadQueryPrefs || {};
        await chrome.storage.local.set({ mapLeadQueryPrefs: { ...oldPrefs, query, location, lastUrl: url, limit: $('limitSelect').value, format: $('exportFormat').value || oldPrefs.format || 'csv' } });
        const newTab = await chrome.tabs.create({ url, active: true });
        await refreshActiveTab(newTab.id);
        await refreshUI();
        showToast('Maps search opened. Atlas will detect the new Maps tab.');
        return;
      }
      const { mapLeadStatus = {} } = await chrome.storage.local.get('mapLeadStatus');
      if (mapLeadStatus.running && mapLeadStatus.tabId === targetTab.id) {
        showToast('Stop the active scan before changing the current Maps search.');
        return;
      }
      const hasAccess = await requestMapsPermission(targetTab);
      if (!hasAccess) { showToast('Google Maps access is required to search in the current tab. Try again and choose Allow.'); return; }
      activeTab = targetTab;
      const currentUrl = new URL(targetTab.url);
      const targetUrl = new URL(currentUrl.origin);
      targetUrl.pathname = `/maps/search/${encodeURIComponent(combined)}/`;
      targetUrl.search = '';
      targetUrl.hash = '';
      const oldPrefs = (await chrome.storage.local.get('mapLeadQueryPrefs')).mapLeadQueryPrefs || {};
      await chrome.storage.local.set({ mapLeadQueryPrefs: { ...oldPrefs, query, location, lastUrl: targetUrl.toString(), limit: $('limitSelect').value, format: $('exportFormat').value || oldPrefs.format || 'csv' } });
      pendingAtlasToMapsSync = { tabId: targetTab.id, query: combined, startedAt: Date.now(), scheduled: false };
      await chrome.tabs.update(targetTab.id, { url: targetUrl.toString(), active: true });
      await refreshActiveTab(targetTab.id);
      await refreshUI();
      showToast('Search updated in the detected Google Maps tab.');
    } catch (error) {
      pendingAtlasToMapsSync = null;
      showToast(`Could not search in the current Maps tab: ${error.message || error}`);
    }
    return;
  }

  // Automatic mode retains the existing new-tab behavior.
  const hasAccess = await requestMapsPermission();
  if (!hasAccess) { showToast('Google Maps access is required for the in-panel search. Try again and choose Allow to continue.'); return; }
  const url = `https://www.google.com/maps/search/${encodeURIComponent(combined)}/`;
  const oldPrefs = (await chrome.storage.local.get('mapLeadQueryPrefs')).mapLeadQueryPrefs || {};
  await chrome.storage.local.set({ mapLeadQueryPrefs: { ...oldPrefs, query, location, lastUrl: url, limit: $('limitSelect').value, format: $('exportFormat').value || oldPrefs.format || 'csv' } });
  try {
    const newTab = await chrome.tabs.create({ url, active: true });
    // In side-panel mode Atlas remains visible while the new Maps tab loads.
    await refreshActiveTab(newTab.id);
    await refreshUI();
    showToast('Maps search opened. Atlas will stay open beside it.');
  } catch (error) {
    showToast(`Could not open Maps search: ${error.message || error}`);
  }
});

$('manualMapsSyncBtn')?.addEventListener('click', async () => {
  await refreshActiveTab();
  const tab = activeTab;
  if (!tab?.id || !isGoogleMapsUrl(tab.url || '')) {
    updateMapsSyncControls();
    showToast('Open a Google Maps tab first, then update its search manually.');
    return;
  }
  if (!combinedAtlasSearch()) {
    showToast('Enter a business type or keyword first.');
    $('queryInput').focus();
    return;
  }
  const hasAccess = await requestMapsPermission(tab);
  if (!hasAccess) {
    showToast('Google Maps access is required to update the search. Try again and choose Allow.');
    return;
  }
  const synced = await syncQueryToMaps({ force: true });
  showToast(synced ? 'Google Maps search updated.' : 'Could not update the Google Maps search. Check permissions and try again.');
  await refreshActiveTab(tab.id);
});

for (const id of ['queryInput', 'locationInput']) {
  $(id).addEventListener('input', () => {
    updateFilenamePreview();
    window.clearTimeout(querySaveTimer);
    querySaveTimer = window.setTimeout(() => saveQueryPreferences(), 250);
    scheduleQueryToMapsSync();
  });
  $(id).addEventListener('change', async () => {
    await saveQueryPreferences();
    scheduleQueryToMapsSync();
  });
}

function initAnimatedDetails(details, contentSelector, motionOptions = {}) {
  const summary = details?.querySelector(':scope > summary');
  const content = details?.querySelector(contentSelector);
  if (!details || !summary || !content) return;

  const openDuration = Number.isFinite(motionOptions.openDuration) ? motionOptions.openDuration : 280;
  const closeDuration = Number.isFinite(motionOptions.closeDuration) ? motionOptions.closeDuration : 220;
  const openEasing = motionOptions.openEasing || 'cubic-bezier(.22,.75,.25,1)';
  const closeEasing = motionOptions.closeEasing || 'cubic-bezier(.4,0,1,1)';
  const openOffset = Number.isFinite(motionOptions.openOffset) ? motionOptions.openOffset : -4;
  const closeOffset = Number.isFinite(motionOptions.closeOffset) ? motionOptions.closeOffset : 4;

  let animation = null;
  let targetOpen = details.open;
  let animationToken = 0;

  const clearInline = () => {
    for (const property of ['height', 'opacity', 'transform', 'overflow', 'will-change']) {
      content.style.removeProperty(property);
    }
  };
  const reducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const fullHeight = () => {
    // Measure the natural expanded size rather than estimating from scrollHeight;
    // this avoids the final 1–2px snap when padding/borders are present.
    const previousHeight = content.style.height;
    content.style.height = 'auto';
    const measured = content.getBoundingClientRect().height;
    content.style.height = previousHeight;
    return measured;
  };

  summary.addEventListener('click', (event) => {
    event.preventDefault();
    const opening = animation ? !targetOpen : !details.open;
    const currentStyle = getComputedStyle(content);
    const currentHeight = details.open ? content.getBoundingClientRect().height : 0;
    const parsedOpacity = Number.parseFloat(currentStyle.opacity);
    // Opacity 0 is valid and must not be coerced to 1; doing so causes a flash
    // when a just-opened accordion is reversed before its fade has completed.
    const currentOpacity = details.open
      ? (Number.isFinite(parsedOpacity) ? parsedOpacity : 1)
      : 0;
    const currentTransform = currentStyle.transform === 'none'
      ? 'translateY(0px)'
      : currentStyle.transform;

    // Freeze the exact rendered frame before interrupting the previous animation.
    if (animation) {
      animationToken += 1;
      animation.onfinish = null;
      animation.oncancel = null;
      content.style.height = `${currentHeight}px`;
      content.style.opacity = String(currentOpacity);
      content.style.transform = currentTransform;
      content.style.overflow = 'hidden';
      content.style.willChange = 'height, opacity, transform';
      animation.cancel();
      animation = null;
    }

    const fromHeight = details.open ? content.getBoundingClientRect().height : 0;
    let fromOpacity = details.open ? currentOpacity : 0;
    let fromTransform = details.open ? currentTransform : `translateY(${openOffset}px)`;

    if (opening) {
      details.open = true;
      if (fromHeight === 0) {
        content.style.height = '0px';
        content.style.opacity = '0';
        content.style.transform = `translateY(${openOffset}px)`;
        fromOpacity = 0;
        fromTransform = `translateY(${openOffset}px)`;
      }
    } else {
      // Keep the <details> content rendered until the fade/height animation ends.
      details.open = true;
    }

    const startHeight = Math.max(0, fromHeight || 0);
    const endHeight = opening ? fullHeight() : 0;
    const startOpacity = Number.isFinite(fromOpacity) ? fromOpacity : (opening ? 0 : 1);
    const endOpacity = opening ? 1 : 0;
    const finalTransform = opening ? 'translateY(0px)' : `translateY(-${closeOffset}px)`;

    content.style.height = `${startHeight}px`;
    content.style.opacity = String(startOpacity);
    content.style.transform = fromTransform;
    content.style.overflow = 'hidden';
    content.style.willChange = 'height, opacity, transform';
    targetOpen = opening;

    if (reducedMotion() || Math.abs(endHeight - startHeight) < 1) {
      details.open = opening;
      clearInline();
      animation = null;
      return;
    }

    void content.offsetHeight;
    const distanceRatio = Math.min(1, Math.abs(endHeight - startHeight) / Math.max(1, fullHeight()));
    const baseDuration = opening ? openDuration : closeDuration;
    const duration = Math.max(170, Math.round(baseDuration * Math.max(.72, Math.sqrt(distanceRatio))));
    const token = ++animationToken;
    animation = content.animate([
      { height: `${startHeight}px`, opacity: startOpacity, transform: fromTransform },
      { height: `${endHeight}px`, opacity: endOpacity, transform: finalTransform }
    ], {
      duration,
      easing: opening ? openEasing : closeEasing,
      fill: 'both'
    });
    animation.onfinish = () => {
      if (token !== animationToken) return;
      const finishedAnimation = animation;
      animation = null;

      // Commit the end state before removing the effect to prevent a flash/snap.
      content.style.height = `${endHeight}px`;
      content.style.opacity = String(endOpacity);
      content.style.transform = finalTransform;
      content.style.overflow = 'hidden';
      content.style.willChange = 'auto';
      details.open = opening;
      finishedAnimation?.cancel();
      clearInline();
    };
  });
}
function initAccordions() {
  initAnimatedDetails($('viewSettings'), '.settings-body', { settings: true, openDuration: 320, closeDuration: 230, openEasing: 'cubic-bezier(.22,.61,.36,1)', closeEasing: 'cubic-bezier(.4,0,1,1)', openOffset: -6, closeOffset: 4 });
  initAnimatedDetails(document.querySelector('.columns-picker'), '.columns-content');
}
initAnimatedSelects();
window.AtlasSyncWorkspaceSelects = syncAnimatedSelects;
initAccordions();

// Keep the lead workspace out of the default view; enable it on demand from the top bar.
const ADVANCED_MODE_KEY = 'mapLeadAdvancedModeV1';
function applyAdvancedMode(enabled, options = {}) {
  const panel = $('leadWorkspaceMount');
  const toggle = $('advancedModeToggle');
  const state = $('advancedModeState');
  if (!panel || !toggle) return;
  panel.hidden = !enabled;
  toggle.setAttribute('aria-pressed', String(enabled));
  toggle.setAttribute('aria-label', enabled ? 'Disable advanced mode' : 'Enable advanced mode');
  toggle.classList.toggle('is-active', enabled);
  if (state) state.textContent = enabled ? 'On' : 'Off';
  if (enabled && options.scroll) {
    window.requestAnimationFrame(() => panel.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }
}
const advancedModeToggle = $('advancedModeToggle');
if (advancedModeToggle) {
  advancedModeToggle.addEventListener('click', async () => {
    const nextEnabled = $('leadWorkspaceMount')?.hidden !== false;
    applyAdvancedMode(nextEnabled, { scroll: nextEnabled });
    try { await chrome.storage.local.set({ [ADVANCED_MODE_KEY]: nextEnabled }); }
    catch (error) { console.warn('Atlas could not save Advanced Mode preference:', error); }
  });
  chrome.storage.local.get([ADVANCED_MODE_KEY]).then(data => {
    applyAdvancedMode(Boolean(data[ADVANCED_MODE_KEY]));
  }).catch(error => {
    applyAdvancedMode(false);
    console.warn('Atlas could not load Advanced Mode preference:', error);
  });
}
$('viewSettings').addEventListener('toggle', () => {
  chrome.storage.local.set({ mapLeadSettingsOpen: $('viewSettings').open }).catch((error) => console.warn('Atlas could not save the settings panel state:', error));
});
$('toastClose').addEventListener('click', dismissToast);
$('completionCloseIcon').addEventListener('click', dismissCompletionNotice);
$('completionCloseBtn').addEventListener('click', dismissCompletionNotice);
$('completionOverlay').addEventListener('click', (event) => {
  if (event.target === $('completionOverlay')) dismissCompletionNotice();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && !$('completionOverlay').classList.contains('hidden')) {
    event.preventDefault();
    dismissCompletionNotice();
  }
});

// Prime Web Audio during a real user gesture, so the completion chime can play
// after a long-running scan instead of being blocked by autoplay policy.
document.addEventListener('pointerdown', primeCompletionSound, { capture: true });
document.addEventListener('keydown', primeCompletionSound, { capture: true });

$('undoColumnsBtn').addEventListener('click', () => undoColumnSelection().catch((error) => showToast(`Undo failed: ${error.message || error}`)));
$('redoColumnsBtn').addEventListener('click', () => redoColumnSelection().catch((error) => showToast(`Redo failed: ${error.message || error}`)));
$('undoHistoryLimit').addEventListener('input', () => {
  $('undoHistoryLimitValue').textContent = `${$('undoHistoryLimit').value} saved`;
});
$('undoHistoryLimit').addEventListener('change', () => saveUndoHistoryLimit().catch((error) => showToast(`Could not save undo history: ${error.message || error}`)));
document.addEventListener('keydown', (event) => {
  if (!(event.ctrlKey || event.metaKey) || event.altKey) return;
  const key = event.key.toLowerCase();
  if (key !== 'z' && key !== 'y') return;
  const target = event.target;
  const isTextEntry = target instanceof HTMLElement && (target.isContentEditable || target.matches('input:not([type="checkbox"]):not([type="range"]):not([type="button"]), textarea, select'));
  if (isTextEntry) return;
  event.preventDefault();
  const action = key === 'z' ? undoColumnSelection : redoColumnSelection;
  action().catch((error) => showToast(`${key === 'z' ? 'Undo' : 'Redo'} failed: ${error.message || error}`));
});

$('exportFormat').addEventListener('change', async () => {
  await saveQueryPreferences({ format: $('exportFormat').value });
  updateFilenamePreview();
});

$('filenameInput').addEventListener('input', () => {
  manualFilenameBase = $('filenameInput').value;
  const mode = $('filenameModeLabel');
  const isManual = Boolean(cleanFilenameBase(manualFilenameBase));
  if (mode) { mode.textContent = isManual ? 'Manual' : 'Auto-named'; mode.classList.toggle('is-manual', isManual); }
  scheduleManualFilenameSave();
});
$('filenameInput').addEventListener('blur', async () => {
  window.clearTimeout(filenameSaveTimer);
  manualFilenameBase = cleanFilenameBase($('filenameInput').value);
  updateFilenamePreview();
  await persistManualFilename();
});

$('limitSelect').addEventListener('change', async () => {
  const old = (await chrome.storage.local.get('mapLeadQueryPrefs')).mapLeadQueryPrefs || {};
  await chrome.storage.local.set({ mapLeadQueryPrefs: { ...old, limit: $('limitSelect').value } });
});

for (const input of document.querySelectorAll('[data-export-column]')) {
  input.addEventListener('change', saveExportColumns);
}

for (const input of document.querySelectorAll('[data-view-option]')) {
  input.addEventListener('change', saveViewPreferences);
}
$('resetSearchOnPanelClose').addEventListener('change', saveViewPreferences);
$('autoMapsSearchSync').addEventListener('change', async () => {
  const enabled = $('autoMapsSearchSync').checked;
  try {
    await saveViewPreferences();
  } catch {
    return;
  }
  if (!enabled) {
    window.clearTimeout(atlasToMapsSyncTimer);
    atlasToMapsSyncTimer = null;
    pendingAtlasToMapsSync = null;
    showToast('Automatic search sync is off. Search in current tab will apply changes without opening a new tab.');
  } else {
    window.clearTimeout(atlasToMapsSyncTimer);
    atlasToMapsSyncTimer = null;
    pendingAtlasToMapsSync = null;
    lastMapsObservedQuery = null;
    lastMapsObservedTabId = null;
    await syncQueryFromMaps();
    showToast('Automatic search sync enabled.');
  }
  updateMapsSyncControls();
});
$('strongBordersToggle').addEventListener('change', () => saveAppearancePreferences());
$('phoneClickAction')?.addEventListener('change', async () => {
  const action = $('phoneClickAction').value;
  try {
    await saveAppearancePreferences({ phoneClickAction: ['auto', 'whatsapp', 'clipboard'].includes(action) ? action : 'auto' });
    showToast('Phone-number click behavior saved.', { kind: 'success' });
  } catch (_) { /* storage failure is already reported by the shared settings handler */ }
});
$('themePreset')?.addEventListener('change', async () => {
  const selected = $('themePreset').value;
  if (!Object.prototype.hasOwnProperty.call(ATLAS_THEME_PRESETS, selected)) return;
  try {
    await saveAppearancePreferences({ theme: selected });
    showToast(`${selected === 'custom-theme' ? (document.getElementById('customThemeName')?.value.trim() || 'Custom') : ATLAS_THEME_PRESETS[selected].label} theme applied.`, { kind: 'success' });
  } catch (_) { /* storage failure is already reported by the shared settings handler */ }
});
for (const id of ['headingScale', 'textScale', 'controlScale', 'cardSpacingScale']) {
  const input = $(id);
  input?.addEventListener('input', applyUIScalePreview);
  input?.addEventListener('change', () => saveAppearancePreferences().catch(() => {}));
}
$('resetInterfaceScaleBtn')?.addEventListener('click', async () => {
  const defaults = { headingScale: 100, textScale: 100, controlScale: 100, cardSpacingScale: 10 };
  const resetButton = $('resetInterfaceScaleBtn');
  if (resetButton) resetButton.disabled = true;
  for (const [id, value] of Object.entries(defaults)) {
    const input = $(id);
    if (input) input.value = String(value);
  }
  applyUIScalePreview();
  try {
    // Save only the three scale values. Existing theme and border preferences
    // are retained by persistSettingsPatch; no unrelated control is read here.
    await persistSettingsPatch({ appearancePatch: defaults });
    showToast('Interface scaling reset to 100%', { kind: 'success' });
  } catch (error) {
    console.error('Could not save interface scale reset:', error);
    showToast(`Could not save interface scale reset${error?.message ? `: ${error.message}` : '.'}`);
  } finally {
    if (resetButton) resetButton.disabled = false;
  }
});
$('themeToggle').addEventListener('click', async () => {
  const currentMode = document.body.dataset.theme === 'dark' ? 'dark' : 'light';
  await saveAppearancePreferences({ theme: currentMode === 'dark' ? 'classic-light' : 'classic-dark' });
});

$('selectAllColumnsBtn').addEventListener('click', async () => {
  document.querySelectorAll('[data-export-column]').forEach((input) => { input.checked = true; });
  await saveExportColumns();
});

$('recommendedColumnsBtn').addEventListener('click', async () => {
  document.querySelectorAll('[data-export-column]').forEach((input) => { input.checked = DEFAULT_EXPORT_COLUMNS.includes(input.value); });
  await saveExportColumns();
});

$('contactColumnsBtn')?.addEventListener('click', async () => {
  document.querySelectorAll('[data-export-column]').forEach((input) => { input.checked = CONTACT_COLUMNS.includes(input.value); });
  await saveExportColumns();
});

$('coreColumnsBtn')?.addEventListener('click', async () => {
  document.querySelectorAll('[data-export-column]').forEach((input) => { input.checked = CORE_COLUMNS.includes(input.value); });
  await saveExportColumns();
});

$('savedColumnPresetSelect').addEventListener('change', async () => {
  const selectedPresetId = $('savedColumnPresetSelect').value;
  renderCustomColumnPresets(selectedPresetId);
  if (selectedPresetId) await applyCustomColumnPreset();
});
$('saveColumnPresetBtn').addEventListener('click', saveCustomColumnPreset);
$('columnPresetSearch')?.addEventListener('input', renderPresetChips);
$('columnPresetName').addEventListener('input', (event) => {
  const input = event.currentTarget;
  const before = input.value;
  const after = capitalizePresetInitial(before);
  if (after !== before) {
    const start = input.selectionStart ?? before.length;
    const end = input.selectionEnd ?? start;
    input.value = after;
    const delta = after.length - before.length;
    const cursorStart = Math.max(0, start + (start > 0 ? delta : 0));
    const cursorEnd = Math.max(0, end + (end > 0 ? delta : 0));
    input.setSelectionRange(cursorStart, cursorEnd);
  }
});
$('columnPresetName').addEventListener('keydown', (event) => {
  if (event.key === 'Enter') { event.preventDefault(); saveCustomColumnPreset(); }
});
$('deleteColumnPresetBtn').addEventListener('click', deleteCustomColumnPreset);

$('scanBtn').addEventListener('click', async () => {
  primeCompletionSound();
  try {
    const resetState = await chrome.storage.local.get(['mapLeadResetPending', 'mapLeadResetPendingAt']);
    if (isResetPending(resetState)) {
      showToast('The previous task is still stopping. Please wait a moment, then start the scan.');
      return;
    } else if (resetState.mapLeadResetPending === true) {
      await chrome.storage.local.set({ mapLeadResetPending: false, mapLeadResetPendingAt: 0 });
    }
    // Request optional access first, directly in the button's user gesture.
    const baseAccess = await requestMapsPermission();
    if (!baseAccess) { showToast('Allow Atlas to access Google Maps, then try again.'); return; }
    const activeHint = await getActiveTab();
    const candidate = await findMapsTab(activeHint?.id);
    activeTab = candidate;
    if (!activeTab?.id || !isGoogleMapsUrl(activeTab.url || '')) {
      await refreshUI();
      showToast('No Google Maps tab was detected. Open Maps results and click this button again.'); return;
    }
    // If the detected map uses a regional origin, ask only for that origin.
    const targetOrigin = `${new URL(activeTab.url).origin}/*`;
    const hasTargetOrigin = await chrome.permissions.contains({ origins: [targetOrigin] });
    if (!hasTargetOrigin) {
      const regionalAccess = await requestMapsPermission(activeTab);
      if (!regionalAccess) { showToast('Allow Atlas to access this Google Maps domain, then try again.'); return; }
    }
    const old = await chrome.storage.local.get(['mapLeadStatus', 'mapLeadRecords', 'mapLeadLastDatasetSearch', 'mapLeadResetEpoch', 'mapLeadRecordsEpoch']);
    if (old.mapLeadStatus?.running) { showToast('A scan is already running.'); return; }

    const search = await captureDatasetSearch(activeTab);
    const records = currentRecordsFromStorage(old);
    const previousSearch = old.mapLeadLastDatasetSearch || null;
    let datasetChoice = 'append';
    const searchChanged = records.length > 0 && (!previousSearch?.signature || previousSearch.signature !== search.signature);
    if (searchChanged) {
      datasetChoice = await askDatasetChoice({ count: records.length, previousSearch, nextSearch: search });
      if (datasetChoice === 'cancel') return;
    }

    // Ensure the collector is injected before applying the user's reset choice.
    await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: ['content.js'] });
    if (datasetChoice === 'reset') {
      const resetEpoch = nextResetEpoch(old);
      await chrome.storage.local.set({
        mapLeadResetEpoch: resetEpoch,
        mapLeadResetPending: false,
        mapLeadResetPendingAt: 0,
        // Keep a mismatch until a new task writes records tagged with this epoch.
        // This also makes late writes from old content-script contexts invisible.
        mapLeadRecordsEpoch: resetEpoch - 1,
        mapLeadRecords: [],
        atlasLeadMetadataV1: {},
        mapLeadParserVersion: 3,
        mapLeadStatus: { running: false, progress: 0, updatedAt: Date.now(), message: 'Previous data cleared for the new search.', interrupted: false }
      });
    }

    const { mapLeadResetEpoch: startResetEpoch = 0 } = await chrome.storage.local.get('mapLeadResetEpoch');
    const backgroundProtection = await protectMapsTabForBackgroundTask(activeTab);
    const startedAt = Date.now();
    await chrome.storage.local.set({ mapLeadStatus: {
      running: true, progress: 2, startedAt, updatedAt: startedAt,
      message: 'Waiting for the Google Maps results list…', collected: 0,
      mode: 'scan', tabId: activeTab.id, ...backgroundProtection
    } });
    const selected = $('limitSelect').value;
    const limit = selected === 'unlimited' ? 0 : Math.max(1, Number(selected) || 50);
    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: MESSAGE.start,
      limit,
      delay: 1100,
      resetEpoch: Number(startResetEpoch || 0)
    });
    if (!response?.ok) throw new Error(response?.error || 'The collector did not start.');
    await chrome.storage.local.set({
      mapLeadLastDatasetSearch: {
        signature: search.signature,
        query: search.query,
        location: search.location,
        label: search.label,
        updatedAt: Date.now(),
        strategy: datasetChoice === 'reset' ? 'reset' : 'append'
      }
    });
    await refreshUI();
  } catch (error) {
    await chrome.storage.local.set({ mapLeadStatus: {
      running: false, progress: 0, updatedAt: Date.now(), message: `Could not start: ${error.message || error}`, error: true
    } });
    showToast(`Could not start: ${error.message || error}`);
    await refreshUI();
  }
});
$('phoneBtn').addEventListener('click', async () => {
  primeCompletionSound();
  try {
    const resetState = await chrome.storage.local.get(['mapLeadResetPending', 'mapLeadResetPendingAt']);
    if (isResetPending(resetState)) {
      showToast('The previous task is still stopping. Please wait a moment, then try again.');
      return;
    } else if (resetState.mapLeadResetPending === true) {
      await chrome.storage.local.set({ mapLeadResetPending: false, mapLeadResetPendingAt: 0 });
    }
    const baseAccess = await requestMapsPermission();
    if (!baseAccess) { showToast('Allow Atlas to access Google Maps to look up public phone details.'); return; }
    const activeHint = await getActiveTab();
    const candidate = await findMapsTab(activeHint?.id);
    activeTab = candidate;
    if (!activeTab?.id || !isGoogleMapsUrl(activeTab.url || '')) {
      await refreshUI();
      showToast('No Google Maps tab was detected. Open the matching Maps results page and try again.'); return;
    }
    const targetOrigin = `${new URL(activeTab.url).origin}/*`;
    const hasTargetOrigin = await chrome.permissions.contains({ origins: [targetOrigin] });
    if (!hasTargetOrigin) {
      const regionalAccess = await requestMapsPermission(activeTab);
      if (!regionalAccess) { showToast('Allow Atlas to access this Google Maps domain, then try again.'); return; }
    }
    await chrome.scripting.executeScript({ target: { tabId: activeTab.id }, files: ['content.js'] });
    const selected = $('limitSelect').value;
    const limit = selected === 'unlimited' ? 0 : Math.max(1, Number(selected) || 50);
    const { mapLeadResetEpoch: phoneResetEpoch = 0 } = await chrome.storage.local.get('mapLeadResetEpoch');
    const backgroundProtection = await protectMapsTabForBackgroundTask(activeTab);
    const startedAt = Date.now();
    await chrome.storage.local.set({ mapLeadStatus: {
      running: true, progress: 1, startedAt, updatedAt: startedAt,
      message: 'Waiting for business profiles to load…', collected: 0,
      mode: 'phones', tabId: activeTab.id, ...backgroundProtection
    } });
    const response = await chrome.tabs.sendMessage(activeTab.id, {
      type: MESSAGE.phones, limit, delay: 1100, resetEpoch: Number(phoneResetEpoch || 0)
    });
    if (!response?.ok) throw new Error(response?.error || 'Phone lookup could not start.');
    showToast('Phone lookup started. Keep the Maps tab open.');
    await refreshUI();
  } catch (error) {
    await chrome.storage.local.set({ mapLeadStatus: {
      running: false, progress: 0, updatedAt: Date.now(), message: `Could not start phone lookup: ${error.message || error}`, error: true, mode: 'phones'
    } });
    showToast(`Could not start: ${error.message || error}`);
    await refreshUI();
  }
});

async function sendScanControl(type, successMessage) {
  try {
    const status = await readStatusAndRepair();
    const targetTabId = Number.isInteger(status.tabId) ? status.tabId : (await getActiveTab())?.id;
    if (!targetTabId) throw new Error('No active Maps task was found.');
    const response = await chrome.tabs.sendMessage(targetTabId, { type });
    if (!response?.ok) throw new Error(response?.error || 'The scan control was not accepted.');
    showToast(successMessage);
    await refreshUI();
  } catch (error) {
    showToast(error.message || 'Could not update the scan. Saved records remain safe.');
  }
}
$('pauseBtn').addEventListener('click', () => sendScanControl(MESSAGE.pause, 'Pause requested. Atlas will pause at its next safe checkpoint.'));
$('resumeBtn').addEventListener('click', () => sendScanControl(MESSAGE.resume, 'Resume requested. Atlas is continuing from its next safe checkpoint.'));

$('stopBtn').addEventListener('click', async () => {
  try {
    const status = await readStatusAndRepair();
    const targetTabId = Number.isInteger(status.tabId) ? status.tabId : (await getActiveTab())?.id;
    if (targetTabId) await chrome.tabs.sendMessage(targetTabId, { type: MESSAGE.stop });
    showToast('Stop requested. Current records will be saved.');
  } catch {
    showToast('The Maps tab may have been refreshed. Saved records are retained.');
  }
});

$('exportBtn').addEventListener('click', async () => {
  try {
    const stored = await chrome.storage.local.get(['mapLeadRecords', 'mapLeadResetEpoch', 'mapLeadRecordsEpoch']);
    const records = currentRecordsFromStorage(stored);
    if (!records.length) return;
    const format = $('exportFormat').value || 'csv';
    const filename = currentExportFilename();
    const columns = selectedExportColumns();
    if (!columns.length) { showToast('Select at least one column to export.'); return; }
    const exportResult = AtlasExport.buildBlob(records, format, columns);
    downloadBlob(exportResult.blob, filename);
    // Successful downloads stay silent; the centered completion notification is reserved for completed scans/lookups.
  } catch (error) {
    showToast(`Export failed: ${error.message || error}`);
    $('statusText').textContent = `Export failed: ${error.message || error}`;
  }
});

$('clearBtn').addEventListener('click', async () => {
  const resetButton = $('clearBtn');
  try {
    const stored = await chrome.storage.local.get([
      'mapLeadRecords', 'mapLeadStatus', 'mapLeadResetEpoch', 'mapLeadRecordsEpoch'
    ]);
    const records = currentRecordsFromStorage(stored);
    const count = records.length;
    const status = stored.mapLeadStatus || {};
    const running = Boolean(status.running);
    if (!count && !running) { showToast('No saved results to reset.'); return; }
    const runningLabel = status.mode === 'phones' ? 'phone lookup' : 'scan';
    const confirmText = running
      ? `Stop the active ${runningLabel} and permanently delete all ${count.toLocaleString()} saved listings? This cannot be undone.`
      : `Reset and permanently delete all ${count.toLocaleString()} saved listings? This cannot be undone.`;
    if (!confirm(confirmText)) return;

    if (resetButton) resetButton.disabled = true;

    // Invalidate all current/late collector writes first, then clear immediately.
    // The content-script message is best-effort; reset still succeeds if Maps was
    // refreshed/closed or no listener is available in that tab.
    const resetEpoch = nextResetEpoch(stored);
    const canSignalActiveTask = running && Number.isInteger(status.tabId);
    await chrome.storage.local.set({
      mapLeadResetEpoch: resetEpoch,
      mapLeadResetPending: canSignalActiveTask,
      mapLeadResetPendingAt: canSignalActiveTask ? Date.now() : 0,
      // A stale content script cannot make old rows visible after this marker changes.
      mapLeadRecordsEpoch: resetEpoch - 1,
      mapLeadRecords: [],
      atlasLeadMetadataV1: {},
      mapLeadStatus: {
        running: false, progress: 0, updatedAt: Date.now(),
        message: 'Saved data reset. Start a new scan whenever ready.', interrupted: false
      },
      mapLeadParserVersion: 3
    });

    if (canSignalActiveTask) {
      // Do not make clearing data depend on a live content-script receiver.
      // If one is available, keep new jobs gated until it has stopped its task.
      chrome.tabs.sendMessage(status.tabId, { type: MESSAGE.resetData, resetEpoch })
        .then(() => chrome.storage.local.set({ mapLeadResetPending: false, mapLeadResetPendingAt: 0 }))
        .catch(() => chrome.storage.local.set({ mapLeadResetPending: false, mapLeadResetPendingAt: 0 }));
    }
    await refreshUI();
    showToast('All saved data reset. Your extension is ready for a new scan.');
  } catch (error) {
    showToast(`Could not reset saved data: ${error?.message || error}`);
    console.error('Atlas could not reset saved data:', error);
  } finally {
    if (resetButton) resetButton.disabled = false;
    await refreshUI();
  }
});

(async function init() {
  wireDatasetChoiceDialog();
  initSettingsTabs();
  const { mapLeadQueryPrefs = {}, mapLeadExportColumns, mapLeadViewPrefs = {}, mapLeadAppearancePrefs = {}, mapLeadCustomColumnPresets = [], mapLeadSettingsOpen, mapLeadSettingsVersion = 0, mapLeadFilenamePrefs = null, mapLeadColumnUndoHistory = [], mapLeadColumnRedoHistory = [], mapLeadColumnUndoHistoryLimit = 10 } = await chrome.storage.local.get(['mapLeadQueryPrefs', 'mapLeadExportColumns', 'mapLeadViewPrefs', 'mapLeadAppearancePrefs', CUSTOM_COLUMN_PRESETS_KEY, 'mapLeadSettingsOpen', 'mapLeadSettingsVersion', FILENAME_PREFS_KEY, COLUMN_UNDO_HISTORY_KEY, COLUMN_REDO_HISTORY_KEY, COLUMN_UNDO_LIMIT_KEY]);
  customColumnPresets = Array.isArray(mapLeadCustomColumnPresets) ? mapLeadCustomColumnPresets.filter((preset) => preset && typeof preset.id === 'string' && typeof preset.name === 'string' && Array.isArray(preset.columns)) : [];
  renderCustomColumnPresets();
  $('queryInput').value = mapLeadQueryPrefs.query || '';
  $('locationInput').value = mapLeadQueryPrefs.location || '';
  filenameSearchSignature = currentFilenameSearchSignature();
  if (mapLeadFilenamePrefs && mapLeadFilenamePrefs.searchSignature === filenameSearchSignature) {
    manualFilenameBase = cleanFilenameBase(mapLeadFilenamePrefs.manualBase || '');
  } else if (mapLeadFilenamePrefs) {
    await chrome.storage.local.remove(FILENAME_PREFS_KEY);
  }
  $('limitSelect').value = mapLeadQueryPrefs.limit || 'unlimited';
  $('exportFormat').value = mapLeadQueryPrefs.format || 'csv';
  syncAnimatedSelects();
  let effectiveViewPrefs = { ...DEFAULT_VIEW_PREFS, ...(mapLeadViewPrefs || {}) };
  if (Number(mapLeadSettingsVersion) < 2) {
    effectiveViewPrefs.resetSearchOnPanelClose = false;
  }
  if (Number(mapLeadSettingsVersion) < 3 || typeof mapLeadViewPrefs.autoMapsSearchSync !== 'boolean') {
    if (typeof mapLeadViewPrefs.autoMapsSearchSync !== 'boolean') effectiveViewPrefs.autoMapsSearchSync = true;
    await chrome.storage.local.set({ mapLeadViewPrefs: effectiveViewPrefs, mapLeadSettingsVersion: 3 });
  }
  applyViewPreferences(effectiveViewPrefs);
  applyAppearancePreferences(mapLeadAppearancePrefs);
  initLanguagePicker(mapLeadAppearancePrefs);
  initCustomThemeStudio(mapLeadAppearancePrefs);
  if (typeof mapLeadSettingsOpen === 'boolean') $('viewSettings').open = mapLeadSettingsOpen;
  const initSettings = {};
  if (!Object.keys(mapLeadViewPrefs || {}).length) initSettings.mapLeadViewPrefs = effectiveViewPrefs;
  if (!Object.keys(mapLeadAppearancePrefs || {}).length) initSettings.mapLeadAppearancePrefs = DEFAULT_APPEARANCE_PREFS;
  if (Object.keys(initSettings).length) await chrome.storage.local.set(initSettings);
  const savedColumns = Array.isArray(mapLeadExportColumns) ? mapLeadExportColumns : DEFAULT_EXPORT_COLUMNS;
  document.querySelectorAll('[data-export-column]').forEach((input) => { input.checked = savedColumns.includes(input.value); });
  lastSavedExportColumns = selectedExportColumns();
  columnUndoHistory = Array.isArray(mapLeadColumnUndoHistory) ? mapLeadColumnUndoHistory.filter(Array.isArray).slice(-50) : [];
  columnRedoHistory = Array.isArray(mapLeadColumnRedoHistory) ? mapLeadColumnRedoHistory.filter(Array.isArray).slice(-50) : [];
  columnUndoLimit = Math.max(1, Math.min(50, Number.parseInt(mapLeadColumnUndoHistoryLimit, 10) || 10));
  $('undoHistoryLimit').value = String(columnUndoLimit);
  $('undoHistoryLimitValue').textContent = `${columnUndoLimit} saved`;
  columnUndoHistory = columnUndoHistory.slice(-columnUndoLimit);
  if (!Array.isArray(mapLeadExportColumns)) await chrome.storage.local.set({ mapLeadExportColumns: DEFAULT_EXPORT_COLUMNS });
  columnRedoHistory = columnRedoHistory.slice(-columnUndoLimit);
  await chrome.storage.local.set({ [COLUMN_UNDO_HISTORY_KEY]: columnUndoHistory, [COLUMN_REDO_HISTORY_KEY]: columnRedoHistory, [COLUMN_UNDO_LIMIT_KEY]: columnUndoLimit });
  updateColumnCount();
  updateUndoButton();
  await refreshActiveTab();
  updateFilenamePreview();
  // Populate the global city/country suffix index on first use, then cache it
  // locally. This fetches only the public place-name dataset, never search text.
  AtlasExport.loadWorldCityDatabase().then((result) => {
    updateFilenamePreview();
    if (!result?.ok) console.info('Atlas worldwide city normalization is using its built-in fallback list.', result?.error || 'No city data result');
  }).catch((error) => console.info('Atlas worldwide city normalization could not be refreshed:', error));
  refreshTimer = window.setInterval(refreshUI, 1100);
  mapsQuerySyncTimer = window.setInterval(syncQueryFromMaps, 2200);
  syncQueryFromMaps();
  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== 'local') return;
    if (changes.mapLeadStatus) {
      const oldStatus = changes.mapLeadStatus.oldValue || {};
      const newStatus = changes.mapLeadStatus.newValue || {};
      notifyRunCompletion(oldStatus, newStatus);
      if (oldStatus.running && !newStatus.running) {
        // The active job ended. Follow the browser's current tab again.
        refreshActiveTab();
      }
    }
    if (changes[COLUMN_UNDO_HISTORY_KEY]) {
      columnUndoHistory = Array.isArray(changes[COLUMN_UNDO_HISTORY_KEY].newValue) ? changes[COLUMN_UNDO_HISTORY_KEY].newValue.slice(-columnUndoLimit) : [];
      updateUndoButton();
    }
    if (changes[COLUMN_REDO_HISTORY_KEY]) {
      columnRedoHistory = Array.isArray(changes[COLUMN_REDO_HISTORY_KEY].newValue) ? changes[COLUMN_REDO_HISTORY_KEY].newValue.slice(-columnUndoLimit) : [];
      updateUndoButton();
    }
    if (changes.mapLeadExportColumns) {
      const changedColumns = changes.mapLeadExportColumns.newValue;
      if (Array.isArray(changedColumns) && !applyingColumnUndo) {
        const current = selectedExportColumns();
        if (JSON.stringify(current) !== JSON.stringify(changedColumns)) {
          document.querySelectorAll('[data-export-column]').forEach((input) => { input.checked = changedColumns.includes(input.value); });
          lastSavedExportColumns = changedColumns.slice();
          updateColumnCount();
        }
      }
    }
    if (changes.mapLeadQueryPrefs) {
      const prefs = changes.mapLeadQueryPrefs.newValue || {};
      if ($('queryInput').value !== (prefs.query || '')) $('queryInput').value = prefs.query || '';
      if ($('locationInput').value !== (prefs.location || '')) $('locationInput').value = prefs.location || '';
      if (prefs.limit && $('limitSelect').value !== prefs.limit) $('limitSelect').value = prefs.limit;
      if (prefs.format && $('exportFormat').value !== prefs.format) $('exportFormat').value = prefs.format;
      syncAnimatedSelects();
      updateFilenamePreview();
    }
    if (changes.mapLeadViewPrefs) {
      const previousAutoSync = isAutoMapsSearchSyncEnabled();
      const nextViewPrefs = { ...DEFAULT_VIEW_PREFS, ...(changes.mapLeadViewPrefs.newValue || {}) };
      applyViewPreferences(nextViewPrefs);
      const nextAutoSync = isAutoMapsSearchSyncEnabled();
      if (previousAutoSync !== nextAutoSync) {
        if (nextAutoSync) {
          lastMapsObservedQuery = null;
          lastMapsObservedTabId = null;
          pendingAtlasToMapsSync = null;
          syncQueryFromMaps();
        } else {
          window.clearTimeout(atlasToMapsSyncTimer);
          atlasToMapsSyncTimer = null;
          pendingAtlasToMapsSync = null;
        }
        updateMapsSyncControls();
      }
    }
    if (changes.mapLeadAppearancePrefs) applyAppearancePreferences(changes.mapLeadAppearancePrefs.newValue || {});
    if (changes[CUSTOM_COLUMN_PRESETS_KEY]) {
      customColumnPresets = Array.isArray(changes[CUSTOM_COLUMN_PRESETS_KEY].newValue) ? changes[CUSTOM_COLUMN_PRESETS_KEY].newValue : [];
      renderCustomColumnPresets();
    }
    if (changes.mapLeadRecords || changes.mapLeadRecordsEpoch || changes.mapLeadResetEpoch || changes.mapLeadResetPending || changes.mapLeadResetPendingAt || changes.mapLeadStatus || changes.mapLeadExportColumns || changes.mapLeadQueryPrefs) refreshUI();
  });
  // Use both activation and navigation events: Maps can be detected before the
  // tab is fully loaded and can change the URL after Chrome first activates it.
  chrome.tabs.onActivated.addListener(({ tabId }) => { refreshActiveTab(tabId); });
  chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
    if (changeInfo.url || changeInfo.status === 'complete') refreshActiveTab(tabId);
  });
  chrome.tabs.onRemoved.addListener(async (tabId) => {
    const { mapLeadStatus = {} } = await chrome.storage.local.get('mapLeadStatus');
    if (mapLeadStatus.tabId === tabId && mapLeadStatus.running) {
      await chrome.storage.local.set({ mapLeadStatus: { ...mapLeadStatus, running: false, interrupted: true, progress: 0, updatedAt: Date.now(), message: 'Maps tab was closed. Saved records are safe; reopen Maps to continue.' } });
    }
    refreshActiveTab();
  });
})();

/* Atlas React workspace. Lead data stays local; optional language packs use Google Cloud Translation. */
(function () {
  'use strict';
  if (!window.React || !window.ReactDOM) {
    document.getElementById('atlas-root').textContent = 'Atlas could not load its local React interface. Reload the extension and try again.';
    return;
  }

  const h = React.createElement;
  let workspaceToastTimer = null;
  let workspaceToastExitTimer = null;
  const META_KEY = 'atlasLeadMetadataV1';
  const SAVED_VIEWS_KEY = 'atlasLeadSavedViewsV1';
  const EXPORT_PROFILES_KEY = 'atlasExportProfilesV1';
  const STORAGE_KEYS = ['mapLeadRecords', 'mapLeadRecordsEpoch', 'mapLeadResetEpoch', 'mapLeadStatus', 'mapLeadAppearancePrefs', META_KEY, SAVED_VIEWS_KEY, EXPORT_PROFILES_KEY];
  const STATUS_OPTIONS = ['New', 'Qualified', 'Contacted', 'Won', 'Lost', 'Do not contact'];
  const PRIORITY_OPTIONS = ['Low', 'Normal', 'High'];
  const FIELD_ALIASES = {
    name: ['name', 'business name', 'business', 'company', 'company name', 'title'],
    phone: ['phone', 'phone number', 'telephone', 'tel', 'mobile'],
    email: ['email', 'email address', 'e-mail', 'e-mail address'],
    website: ['website', 'web site', 'url', 'domain'],
    category: ['category', 'business category', 'type', 'industry'],
    rating: ['rating', 'stars'],
    reviews: ['reviews', 'review count', 'number of reviews'],
    priceRange: ['price range', 'price', 'price level'],
    address: ['address', 'full address', 'location'],
    hours: ['hours', 'opening hours', 'business hours'],
    description: ['description', 'about'],
    mapsUrl: ['maps url', 'google maps url', 'google maps link', 'map link', 'place url'],
    collectedAt: ['collected at', 'date collected', 'created at'],
    leadStatus: ['lead status', 'status'],
    leadTags: ['lead tags', 'tags'],
    leadNotes: ['lead notes', 'notes'],
    leadPriority: ['lead priority', 'priority'],
    followUpDate: ['follow up date', 'follow-up date', 'followup date', 'next follow up']
  };

  function normalize(value) {
    return String(value == null ? '' : value).trim().normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  function recordKey(record) {
    const raw = String(record && record.mapsUrl || '').trim();
    if (raw) {
      try {
        const url = new URL(raw);
        const host = url.hostname.toLowerCase().replace(/^www\./, '');
        const path = url.pathname.replace(/\/+$/, '').toLowerCase();
        if (path) return `maps:${host}${path}`;
      } catch (_) { return `url:${raw.toLocaleLowerCase()}`; }
    }
    return `record:${normalize(record && record.name)}|${normalize(record && record.address)}`;
  }
  function identityKey(record) {
    const name = normalize(record && record.name);
    const address = normalize(record && record.address);
    return name && address ? `${name}|${address}` : '';
  }
  function getMetadataFor(metadata, key) {
    return Object.assign({ status: 'New', tags: [], notes: '', priority: 'Normal', followUpDate: '', updatedAt: 0 }, metadata && metadata[key] || {});
  }
  function isValidPhone(value) {
    const digits = String(value || '').replace(/\D/g, '');
    return digits.length >= 7 && digits.length <= 16;
  }
  function isValidWebsite(value) {
    const text = String(value || '').trim();
    if (!text) return true;
    try { const url = new URL(/^https?:\/\//i.test(text) ? text : `https://${text}`); return Boolean(url.hostname.includes('.') && !/\s/.test(text)); }
    catch (_) { return false; }
  }
  function getQuality(records) {
    const identities = new Map();
    const urls = new Map();
    const missingIdentity = [];
    const invalidPhones = [];
    const invalidWebsites = [];
    const invalidEmails = [];
    const invalidContactIndexes = new Set();
    const duplicateKeys = new Set();
    const duplicateIndexes = new Set();
    const duplicateGroups = [];
    records.forEach((record, index) => {
      const key = recordKey(record);
      if (key && urls.has(key)) { duplicateKeys.add(key); duplicateIndexes.add(index); }
      else if (key) urls.set(key, index);
      const identity = identityKey(record);
      if (identity) {
        if (!identities.has(identity)) identities.set(identity, []);
        identities.get(identity).push({ record, index });
      }
      if (!String(record.name || '').trim() || !String(record.address || '').trim()) missingIdentity.push(record);
      if (String(record.phone || '').trim() && !isValidPhone(record.phone)) invalidPhones.push(record);
      if (String(record.website || '').trim() && !isValidWebsite(record.website)) { invalidWebsites.push(record); invalidContactIndexes.add(index); }
      if (String(record.email || '').trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(record.email).trim())) { invalidEmails.push(record); invalidContactIndexes.add(index); }
    });
    identities.forEach((list, key) => {
      if (list.length > 1) {
        duplicateGroups.push({ key, records: list.map(item => item.record) });
        list.slice(1).forEach(({ record, index }) => { duplicateKeys.add(recordKey(record)); duplicateIndexes.add(index); });
      }
    });
    const duplicateExtraCount = duplicateIndexes.size;
    const issues = new Set([...missingIdentity.map(recordKey), ...invalidPhones.map(recordKey), ...invalidWebsites.map(recordKey), ...invalidEmails.map(recordKey), ...duplicateKeys]);
    const score = records.length ? Math.max(0, Math.min(100, Math.round(100 - (duplicateExtraCount / records.length) * 28 - (missingIdentity.length / records.length) * 12 - (invalidPhones.length / records.length) * 20 - (invalidContactIndexes.size / records.length) * 20))) : 0;
    return { score, duplicateCount: duplicateExtraCount, duplicateGroups, missingIdentity, invalidPhones, invalidWebsites, invalidEmails, invalidContactCount: invalidContactIndexes.size, issues, duplicateKeys };
  }
  function createDownload(blob, filename) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 2500);
  }
  function parseDelimited(text, delimiter) {
    const rows = [];
    let row = [];
    let field = '';
    let quoted = false;
    const source = String(text || '').replace(/^\uFEFF/, '');
    for (let i = 0; i < source.length; i++) {
      const char = source[i];
      if (char === '"') {
        if (quoted && source[i + 1] === '"') { field += '"'; i++; }
        else quoted = !quoted;
      } else if (char === delimiter && !quoted) {
        row.push(field); field = '';
      } else if ((char === '\n' || char === '\r') && !quoted) {
        if (char === '\r' && source[i + 1] === '\n') i++;
        row.push(field); field = '';
        if (row.some(cell => String(cell).trim())) rows.push(row);
        row = [];
      } else field += char;
    }
    row.push(field);
    if (row.some(cell => String(cell).trim())) rows.push(row);
    return rows;
  }
  function mapImportedRow(headers, row) {
    const values = {};
    const headerMap = new Map();
    headers.forEach((header, index) => {
      const normalized = normalize(header);
      for (const [key, aliases] of Object.entries(FIELD_ALIASES)) {
        if (aliases.some(alias => normalize(alias) === normalized)) { headerMap.set(index, key); break; }
      }
    });
    headerMap.forEach((key, index) => { values[key] = String(row[index] == null ? '' : row[index]).trim(); });
    const output = {};
    ['name', 'phone', 'email', 'website', 'category', 'rating', 'reviews', 'priceRange', 'address', 'hours', 'description', 'mapsUrl', 'collectedAt'].forEach((key) => {
      if (values[key] != null) output[key] = values[key];
    });
    output.parserVersion = 3;
    output.collectedAt = output.collectedAt || new Date().toISOString();
    return { record: output, meta: {
      status: STATUS_OPTIONS.includes(values.leadStatus) ? values.leadStatus : 'New',
      tags: String(values.leadTags || '').split(/[,;]/).map(tag => tag.trim()).filter(Boolean).slice(0, 30),
      notes: values.leadNotes || '',
      priority: PRIORITY_OPTIONS.includes(values.leadPriority) ? values.leadPriority : 'Normal',
      followUpDate: values.followUpDate || ''
    } };
  }

  class LeadWorkspace extends React.Component {
    constructor(props) {
      super(props);
      this.state = {
        records: [], metadata: {}, savedViews: [], exportProfiles: [], status: {},
        search: '', statusFilter: 'all', qualityFilter: 'all', sortBy: 'recent', bulkStatus: 'Contacted', bulkPriority: 'High', phoneClickAction: 'auto',
        selected: [], editingKey: '', draft: null, savedViewId: '', exportProfileId: '',
        previewExport: false, importBusy: false, expandedHelp: false, loaded: false
      };
      this.onStorageChanged = this.onStorageChanged.bind(this);
      this.loadData = this.loadData.bind(this);
      this.importInput = null;
    }
    componentDidMount() {
      this.loadData();
      chrome.storage.onChanged.addListener(this.onStorageChanged);
    }
    componentDidUpdate() {
      // Keep custom trigger labels and dynamic saved-view menus in sync with React state.
      window.requestAnimationFrame(() => {
        if (typeof window.AtlasSyncWorkspaceSelects === 'function') window.AtlasSyncWorkspaceSelects();
      });
    }
    componentWillUnmount() { chrome.storage.onChanged.removeListener(this.onStorageChanged); }
    onStorageChanged(changes, area) {
      if (area !== 'local') return;
      const heavyKeys = ['mapLeadRecords', 'mapLeadRecordsEpoch', 'mapLeadResetEpoch', META_KEY, SAVED_VIEWS_KEY, EXPORT_PROFILES_KEY];
      if (heavyKeys.some(key => changes[key])) this.loadData();
      if (changes.mapLeadStatus) this.setState({ status: changes.mapLeadStatus.newValue || {} });
      if (changes.mapLeadAppearancePrefs) this.setState({ phoneClickAction: (changes.mapLeadAppearancePrefs.newValue || {}).phoneClickAction || 'auto' });
    }
    async loadData() {
      try {
        const data = await chrome.storage.local.get(STORAGE_KEYS);
        const epoch = Number(data.mapLeadResetEpoch || 0);
        const recordsEpoch = data.mapLeadRecordsEpoch == null ? 0 : Number(data.mapLeadRecordsEpoch);
        const records = recordsEpoch === epoch && Array.isArray(data.mapLeadRecords) ? data.mapLeadRecords : [];
        this.setState({
          records,
          metadata: data[META_KEY] && typeof data[META_KEY] === 'object' ? data[META_KEY] : {},
          savedViews: Array.isArray(data[SAVED_VIEWS_KEY]) ? data[SAVED_VIEWS_KEY] : [],
          exportProfiles: Array.isArray(data[EXPORT_PROFILES_KEY]) ? data[EXPORT_PROFILES_KEY] : [],
          status: data.mapLeadStatus || {}, phoneClickAction: (data.mapLeadAppearancePrefs || {}).phoneClickAction || 'auto', loaded: true
        });
      } catch (error) { this.setState({ loaded: true }); }
    }
    getMeta(key) { return getMetadataFor(this.state.metadata, key); }
    async saveMetadataPatch(key, patch) {
      const current = getMetadataFor(this.state.metadata, key);
      const nextEntry = Object.assign({}, current, patch, { updatedAt: Date.now() });
      const next = Object.assign({}, this.state.metadata, { [key]: nextEntry });
      this.setState(state => ({ metadata: next, draft: state.editingKey === key ? Object.assign({}, state.draft || current, patch) : state.draft }));
      await chrome.storage.local.set({ [META_KEY]: next });
    }
    async saveBulkPatch(patch) {
      if (!this.state.selected.length) return;
      const next = Object.assign({}, this.state.metadata);
      this.state.selected.forEach(key => { next[key] = Object.assign({}, getMetadataFor(next, key), patch, { updatedAt: Date.now() }); });
      this.setState({ metadata: next });
      await chrome.storage.local.set({ [META_KEY]: next });
      this.toast(`Updated ${this.state.selected.length} selected lead${this.state.selected.length === 1 ? '' : 's'}.`);
    }
    toast(message, kind) {
      const toast = document.getElementById('toast');
      if (!toast) return;
      window.clearTimeout(workspaceToastTimer);
      window.clearTimeout(workspaceToastExitTimer);
      const title = document.getElementById('toastTitle');
      const body = document.getElementById('toastMessage');
      if (title) title.textContent = 'Atlas';
      if (body) body.textContent = message;
      toast.classList.remove('hidden', 'is-exiting', 'is-visible');
      toast.classList.toggle('toast-success', kind === 'success');
      requestAnimationFrame(() => requestAnimationFrame(() => toast.classList.add('is-visible')));
      // Keep workspace feedback brief and dismiss it automatically like other Atlas notices.
      workspaceToastTimer = window.setTimeout(() => {
        toast.classList.remove('is-visible');
        toast.classList.add('is-exiting');
        const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        workspaceToastExitTimer = window.setTimeout(() => {
          toast.classList.add('hidden');
          toast.classList.remove('is-exiting', 'toast-success');
        }, reducedMotion ? 0 : 260);
      }, 2400);
    }
    setFilter(field, value) { this.setState({ [field]: value }); const box = document.querySelector('.lead-table-scroll'); if (box) box.scrollTop = 0; }
    async handlePhoneClick(phone) {
      const original = String(phone || '').trim();
      if (!original) return;
      const normalizedSource = original.replace(/^tel:\s*/i, '').trim();
      let digits = normalizedSource.replace(/\D/g, '');
      const hasInternationalPrefix = /^(?:tel:\s*)?(?:\+|00)/i.test(original);
      const action = this.state.phoneClickAction || 'auto';
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
          field.value = original; field.setAttribute('readonly', '');
          field.style.position = 'fixed'; field.style.opacity = '0';
          document.body.appendChild(field); field.select();
          const copied = document.execCommand('copy'); field.remove();
          if (!copied) throw new Error('Clipboard unavailable');
        }
        this.toast(action === 'auto' && !hasInternationalPrefix ? 'Phone number copied. Add an international country code to open it in WhatsApp automatically.' : 'Phone number copied to clipboard.', 'success');
      } catch (_) {
        this.toast('Could not copy the phone number. Please select and copy it manually.');
      }
    }
    toggleSelected(key) { this.setState(state => ({ selected: state.selected.includes(key) ? state.selected.filter(item => item !== key) : state.selected.concat(key) })); }
    openEditor(record) {
      const key = recordKey(record);
      const meta = this.getMeta(key);
      this.setState({ editingKey: key, draft: Object.assign({}, meta, { email: meta.email || record.email || '', tagsText: (meta.tags || []).join(', ') }) });
    }
    async saveEditor() {
      const key = this.state.editingKey;
      if (!key || !this.state.draft) return;
      const draft = this.state.draft;
      const tags = String(draft.tagsText || '').split(/[,;]/).map(tag => tag.trim().replace(/\s+/g, ' ')).filter(Boolean).slice(0, 30);
      const email = String(draft.email || '').trim().slice(0, 254);
      const nextEntry = { status: draft.status || 'New', priority: draft.priority || 'Normal', followUpDate: draft.followUpDate || '', tags, notes: String(draft.notes || '').slice(0, 8000), email, doNotContact: draft.status === 'Do not contact', updatedAt: Date.now() };
      await this.saveMetadataPatch(key, nextEntry);
      const storage = await chrome.storage.local.get(['mapLeadRecords', 'mapLeadRecordsEpoch', 'mapLeadResetEpoch']);
      const epoch = Number(storage.mapLeadResetEpoch || 0);
      const storedRecords = Number(storage.mapLeadRecordsEpoch || 0) === epoch && Array.isArray(storage.mapLeadRecords) ? storage.mapLeadRecords : [];
      const updatedRecords = storedRecords.map(record => recordKey(record) === key ? Object.assign({}, record, { email }) : record);
      await chrome.storage.local.set({ mapLeadRecords: updatedRecords, mapLeadRecordsEpoch: epoch });
      this.setState({ editingKey: '', draft: null });
      this.toast('Lead details saved.', 'success');
    }
    async saveView() {
      const rawName = window.prompt('Name this saved lead view:');
      if (!rawName || !rawName.trim()) return;
      const view = { id: `view-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: rawName.trim().slice(0, 48), search: this.state.search, statusFilter: this.state.statusFilter, qualityFilter: this.state.qualityFilter, sortBy: this.state.sortBy, updatedAt: Date.now() };
      const savedViews = this.state.savedViews.filter(item => item.name.toLowerCase() !== view.name.toLowerCase()).concat(view).slice(-30);
      await chrome.storage.local.set({ [SAVED_VIEWS_KEY]: savedViews });
      this.setState({ savedViews, savedViewId: view.id });
      this.toast(`Saved view “${view.name}”.`, 'success');
    }
    applySavedView() {
      const view = this.state.savedViews.find(item => item.id === this.state.savedViewId);
      if (!view) return;
      this.setState({ search: view.search || '', statusFilter: view.statusFilter || 'all', qualityFilter: view.qualityFilter || 'all', sortBy: view.sortBy || 'recent', scrollTop: 0 });
    }
    async deleteSavedView() {
      const view = this.state.savedViews.find(item => item.id === this.state.savedViewId);
      if (!view) return;
      if (!window.confirm(`Delete the saved view “${view.name}”? This will not delete any leads.`)) return;
      const savedViews = this.state.savedViews.filter(item => item.id !== view.id);
      await chrome.storage.local.set({ [SAVED_VIEWS_KEY]: savedViews });
      this.setState({ savedViews, savedViewId: '' });
      this.toast(`Deleted saved view “${view.name}”.`, 'success');
    }
    async saveExportProfile() {
      const nameInput = document.getElementById('atlasExportProfileName');
      const name = String(nameInput && nameInput.value || '').trim();
      if (!name) { this.toast('Enter a name for this export setup.'); nameInput && nameInput.focus(); return; }
      const selectedColumns = Array.from(document.querySelectorAll('[data-export-column]:checked')).map(input => input.value);
      if (!selectedColumns.length) { this.toast('Select at least one export column first.'); return; }
      const format = document.getElementById('exportFormat')?.value || 'csv';
      const profile = { id: `export-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: name.slice(0, 48), columns: selectedColumns, format, updatedAt: Date.now() };
      const profiles = this.state.exportProfiles.filter(item => item.name.toLowerCase() !== profile.name.toLowerCase()).concat(profile).slice(-30);
      await chrome.storage.local.set({ [EXPORT_PROFILES_KEY]: profiles });
      this.setState({ exportProfiles: profiles, exportProfileId: profile.id });
      if (nameInput) nameInput.value = '';
      this.toast(`Saved export setup “${profile.name}”.`, 'success');
    }
    applyExportProfile() {
      const profile = this.state.exportProfiles.find(item => item.id === this.state.exportProfileId);
      if (!profile) return;
      const format = document.getElementById('exportFormat');
      if (format) { format.value = profile.format || 'csv'; format.dispatchEvent(new Event('change', { bubbles: true })); }
      document.querySelectorAll('[data-export-column]').forEach(input => { input.checked = (profile.columns || []).includes(input.value); });
      const eventInput = document.querySelector('[data-export-column]');
      if (eventInput) eventInput.dispatchEvent(new Event('change', { bubbles: true }));
      this.toast(`Applied export setup “${profile.name}”.`, 'success');
    }
    async deleteExportProfile() {
      const profile = this.state.exportProfiles.find(item => item.id === this.state.exportProfileId);
      if (!profile) return;
      if (!window.confirm(`Delete the export setup “${profile.name}”? This will not delete your records.`)) return;
      const exportProfiles = this.state.exportProfiles.filter(item => item.id !== profile.id);
      await chrome.storage.local.set({ [EXPORT_PROFILES_KEY]: exportProfiles });
      this.setState({ exportProfiles, exportProfileId: '' });
      this.toast(`Deleted export setup “${profile.name}”.`, 'success');
    }
    selectedColumns() { return Array.from(document.querySelectorAll('[data-export-column]:checked')).map(input => input.value); }
    exportRows(records) {
      if (!records.length) { this.toast('Select at least one lead to export.'); return; }
      if (!window.AtlasExport || typeof window.AtlasExport.buildBlob !== 'function') { this.toast('Export tools are still loading. Try again in a moment.'); return; }
      const columns = this.selectedColumns();
      if (!columns.length) { this.toast('Select at least one export column first.'); return; }
      const enriched = records.map(record => {
        const meta = this.getMeta(recordKey(record));
        return Object.assign({}, record, { email: meta.email || record.email || '', leadStatus: meta.status || 'New', leadTags: (meta.tags || []).join(', '), leadNotes: meta.notes || '', leadPriority: meta.priority || 'Normal', followUpDate: meta.followUpDate || '' });
      });
      const format = document.getElementById('exportFormat')?.value || 'csv';
      let filename = String(document.getElementById('filenameInput')?.value || `Atlas selected leads.${format}`).trim();
      filename = filename.replace(/[\\/:*?"<>|]/g, '-').replace(/[. ]+$/g, '').slice(0, 145) || 'Atlas selected leads';
      const extension = format === 'xlsx' ? 'xlsx' : format;
      filename = filename.replace(/\.(csv|tsv|json|xlsx)$/i, '');
      const result = window.AtlasExport.buildBlob(enriched, format, columns);
      createDownload(result.blob, `${filename}.${extension}`);
      this.toast(`Exported ${records.length.toLocaleString()} selected lead${records.length === 1 ? '' : 's'}.`, 'success');
    }
    async importFile(file) {
      if (!file) return;
      this.setState({ importBusy: true });
      try {
        const data = await chrome.storage.local.get(['mapLeadRecords', 'mapLeadRecordsEpoch', 'mapLeadResetEpoch', 'mapLeadStatus', META_KEY]);
        if (data.mapLeadStatus && data.mapLeadStatus.running) throw new Error('Stop or pause the current scan before importing a file.');
        const text = await file.text();
        let rows = [];
        if (/\.json$/i.test(file.name) || /^\s*[\[{]/.test(text)) {
          const parsed = JSON.parse(text);
          const arr = Array.isArray(parsed) ? parsed : Array.isArray(parsed.records) ? parsed.records : Array.isArray(parsed.data) ? parsed.data : null;
          if (!arr) throw new Error('JSON must contain an array of business records, or a records/data array.');
          rows = arr.map(source => {
            const headers = Object.keys(source || {});
            return mapImportedRow(headers.map(header => header.replace(/([a-z])([A-Z])/g, '$1 $2')), headers.map(header => source[header]));
          });
        } else {
          const delimiter = /\.tsv$/i.test(file.name) || (!file.name.toLowerCase().endsWith('.csv') && text.split('\n', 1)[0].includes('\t')) ? '\t' : ',';
          const parsedRows = parseDelimited(text, delimiter);
          if (parsedRows.length < 2) throw new Error('The file must include a header row and at least one record.');
          rows = parsedRows.slice(1).map(row => mapImportedRow(parsedRows[0], row));
        }
        const imported = rows.map(item => item.record).filter(record => String(record.name || '').trim());
        if (!imported.length) throw new Error('No rows with a business name were found. Check the file headers.');
        const epoch = Number(data.mapLeadResetEpoch || 0);
        const current = Number(data.mapLeadRecordsEpoch || 0) === epoch && Array.isArray(data.mapLeadRecords) ? data.mapLeadRecords.slice() : [];
        const seen = new Set(current.map(recordKey));
        const identities = new Set(current.map(identityKey).filter(Boolean));
        const next = current.slice();
        const nextMeta = Object.assign({}, data[META_KEY] || this.state.metadata);
        let added = 0;
        rows.forEach((item) => {
          const record = item.record;
          if (!String(record.name || '').trim()) return;
          const key = recordKey(record);
          const identity = identityKey(record);
          if (seen.has(key) || (identity && identities.has(identity))) return;
          seen.add(key); if (identity) identities.add(identity);
          next.push(record); added++;
          nextMeta[key] = Object.assign({}, getMetadataFor(nextMeta, key), item.meta, { updatedAt: Date.now() });
        });
        if (!window.confirm(`Import ${added} new record${added === 1 ? '' : 's'} from ${file.name}? Existing matching records will be kept.`)) return;
        await chrome.storage.local.set({ mapLeadRecords: next, mapLeadRecordsEpoch: epoch, mapLeadParserVersion: 3, [META_KEY]: nextMeta });
        this.toast(`Imported ${added} record${added === 1 ? '' : 's'}; ${imported.length - added} duplicate or invalid row${imported.length - added === 1 ? '' : 's'} skipped.`, 'success');
        await this.loadData();
      } catch (error) { this.toast(`Import failed: ${error.message || error}`); }
      finally { this.setState({ importBusy: false }); if (this.importInput) this.importInput.value = ''; }
    }
    getDerivedData(records, metadata) {
      if (this._derivedCache && this._derivedCache.records === records && this._derivedCache.metadata === metadata) return this._derivedCache;
      const quality = getQuality(records);
      const decorated = records.map(record => {
        const key = recordKey(record);
        const meta = getMetadataFor(metadata, key);
        const hasIssue = quality.issues.has(key);
        const isDuplicate = quality.duplicateKeys.has(key);
        const missingContact = !String(record.phone || '').trim() && !String(record.website || '').trim() && !String(metadata[key] && metadata[key].email || record.email || '').trim();
        return { record, key, meta, hasIssue, isDuplicate, missingContact };
      });
      this._derivedCache = { records, metadata, quality, decorated };
      this._filteredCache = null;
      return this._derivedCache;
    }
    getFilteredData(decorated, search, statusFilter, qualityFilter, sortBy) {
      const cached = this._filteredCache;
      if (cached && cached.decorated === decorated && cached.search === search && cached.statusFilter === statusFilter && cached.qualityFilter === qualityFilter && cached.sortBy === sortBy) return cached.filtered;
      const q = normalize(search);
      const filtered = decorated.filter(item => {
        const haystack = normalize([item.record.name, item.record.address, item.record.category, item.record.phone, item.meta.email || item.record.email, item.record.website, item.meta.tags.join(' '), item.meta.notes].join(' '));
        if (q && !haystack.includes(q)) return false;
        if (statusFilter !== 'all' && item.meta.status !== statusFilter) return false;
        if (qualityFilter === 'issues' && !item.hasIssue) return false;
        if (qualityFilter === 'duplicates' && !item.isDuplicate) return false;
        if (qualityFilter === 'missing-contact' && !item.missingContact) return false;
        return true;
      });
      if (sortBy === 'name') filtered.sort((a, b) => String(a.record.name || '').localeCompare(String(b.record.name || '')));
      else if (sortBy === 'priority') { const rank = { High: 0, Normal: 1, Low: 2 }; filtered.sort((a, b) => (rank[a.meta.priority] == null ? 1 : rank[a.meta.priority]) - (rank[b.meta.priority] == null ? 1 : rank[b.meta.priority])); }
      else if (sortBy === 'followup') filtered.sort((a, b) => (a.meta.followUpDate || '9999-99-99').localeCompare(b.meta.followUpDate || '9999-99-99'));
      else filtered.sort((a, b) => String(b.record.collectedAt || '').localeCompare(String(a.record.collectedAt || '')));
      this._filteredCache = { decorated, search, statusFilter, qualityFilter, sortBy, filtered };
      return filtered;
    }
    renderMetric(label, value, detail, action) {
      return h('button', { type: 'button', className: 'quality-metric' + (action ? ' is-action' : ''), onClick: action || undefined, key: label, title: action ? `Filter records: ${label}` : undefined }, h('span', { className: 'quality-metric-label' }, label), h('strong', { className: 'quality-metric-value' }, String(value)), h('span', { className: 'quality-metric-detail' }, detail));
    }
    renderAnimatedSelect(id, value, options, ariaLabel, onChange, disabled = false, extraClass = '') {
      const selectId = `atlas-workspace-${id}`;
      const selectedOption = options.find(option => String(option.value) === String(value)) || options[0] || { label: '' };
      return h('div', { className: `animated-select workspace-animated-select ${extraClass}`.trim(), 'data-animated-select': selectId, key: selectId },
        h('select', { className: 'native-select-hidden', value, onChange: event => onChange(event.target.value), disabled, 'aria-hidden': 'true', tabIndex: -1, 'aria-label': ariaLabel },
          options.map(option => h('option', { key: String(option.value), value: option.value }, option.label))
        ),
        h('button', { type: 'button', className: 'animated-select-trigger workspace-select-trigger', 'aria-haspopup': 'listbox', 'aria-expanded': 'false', 'aria-label': ariaLabel, 'aria-controls': `${selectId}-menu`, disabled },
          h('span', { className: 'animated-select-value' }, selectedOption.label),
          h('svg', { className: 'animated-select-chevron', viewBox: '0 0 24 24', 'aria-hidden': 'true', focusable: 'false' }, h('path', { d: 'm7 10 5 5 5-5' }))
        ),
        h('div', { id: `${selectId}-menu`, className: 'animated-select-menu', role: 'listbox', 'aria-label': ariaLabel, hidden: true })
      );
    }
    render() {
      const { records, metadata, search, statusFilter, qualityFilter, sortBy, selected, editingKey, draft, savedViews, exportProfiles, savedViewId, exportProfileId, previewExport, importBusy, loaded } = this.state;
      const derived = this.getDerivedData(records, metadata);
      const quality = derived.quality;
      const decorated = derived.decorated;
      const filtered = this.getFilteredData(decorated, search, statusFilter, qualityFilter, sortBy);
      // Render the complete filtered set. Variable-height rows are needed for wrapping and larger text; fixed-height virtualization caused the scroll thumb and footer count to drift.
      const visibleRows = filtered;
      const selectedItems = decorated.filter(item => selected.includes(item.key));
      const selectedRows = selectedItems.map(item => item.record);
      const exportColumns = this.selectedColumns();
      const exportPreviewRows = previewExport ? selectedItems.slice(0, 5).map(item => {
        const meta = item.meta;
        return Object.assign({}, item.record, { email: meta.email || item.record.email || '', leadStatus: meta.status, leadTags: (meta.tags || []).join(', '), leadNotes: meta.notes || '', leadPriority: meta.priority, followUpDate: meta.followUpDate || '' });
      }) : [];
      const status = this.state.status || {};
      const previewHeaders = exportColumns.map(key => h('th', { key }, (window.AtlasExport && window.AtlasExport.columns.find(col => col[1] === key)?.[0]) || key));
      const previewBodyRows = exportPreviewRows.map((row, index) => h('tr', { key: index }, exportColumns.map(key => h('td', { key, title: String(row[key] || '') }, String(row[key] || '—')))));
      const previewTable = selectedItems.length && exportColumns.length
        ? h('div', { className: 'lead-preview-table-wrap' }, h('table', { className: 'lead-preview-table' }, h('thead', null, h('tr', null, previewHeaders)), h('tbody', null, previewBodyRows)))
        : h('p', { className: 'lead-empty-state' }, selectedItems.length ? 'Choose at least one export column above to preview the selected records.' : 'Select one or more leads to preview export output.');

      return h('section', { className: 'lead-workspace-card', 'aria-label': 'Lead management and quality review' },
        h('div', { className: 'lead-workspace-header' },
          h('div', { className: 'lead-workspace-heading' }, h('span', { className: 'section-number' }, '04'), h('h2', null, 'Lead Workspace')),
          h('span', { className: 'local-only-badge' }, h('span', { className: 'local-only-dot' }), 'LOCAL ONLY')
        ),
        h('div', { className: 'quality-overview' },
          h('div', { className: 'quality-score-panel' },
            h('strong', { className: 'quality-score-title' }, 'Data quality'),
            h('div', { className: 'quality-score-value-row', 'aria-label': `Data quality score ${quality.score} out of 100` },
              h('strong', { className: 'quality-score-value' }, String(quality.score)),
              h('span', { className: 'quality-score-scale' }, '/ 100')
            ),
            h('span', { className: 'quality-score-copy' }, records.length ? `${quality.issues.size.toLocaleString()} records need review or contain potential issues.` : 'Collect or import records to begin quality checks.')
          ),
          h('div', { className: 'quality-metrics' },
            this.renderMetric('Possible duplicates', quality.duplicateCount, 'Review before exporting', () => this.setFilter('qualityFilter', 'duplicates')),
            this.renderMetric('Missing identity', quality.missingIdentity.length, 'Name or address missing', () => this.setFilter('qualityFilter', 'issues')),
            this.renderMetric('Invalid phone', quality.invalidPhones.length, 'Format looks unusual', () => this.setFilter('qualityFilter', 'issues')),
            this.renderMetric('Invalid contact', quality.invalidContactCount, 'Website or email format', () => this.setFilter('qualityFilter', 'issues'))
          )
        ),
        h('div', { className: 'lead-workspace-tools' },
          this.renderAnimatedSelect('status-filter', statusFilter, [{ value: 'all', label: 'All statuses' }].concat(STATUS_OPTIONS.map(value => ({ value, label: value }))), 'Filter by lead status', value => this.setFilter('statusFilter', value)),
          this.renderAnimatedSelect('quality-filter', qualityFilter, [{ value: 'all', label: 'All records' }, { value: 'issues', label: 'Needs review' }, { value: 'duplicates', label: 'Duplicates' }, { value: 'missing-contact', label: 'No contact detail' }], 'Filter by data quality', value => this.setFilter('qualityFilter', value)),
          this.renderAnimatedSelect('sort-by', sortBy, [{ value: 'recent', label: 'Recently collected' }, { value: 'name', label: 'Business name' }, { value: 'priority', label: 'Priority' }, { value: 'followup', label: 'Follow-up date' }], 'Sort leads', value => this.setFilter('sortBy', value)),
          h('label', { className: 'lead-search-field' }, h('span', { className: 'sr-only' }, 'Search saved leads'), h('span', { className: 'lead-search-glyph', 'aria-hidden': 'true' }, '⌕'), h('input', { type: 'search', value: search, placeholder: 'Search businesses, notes and tags…', onChange: e => this.setFilter('search', e.target.value), 'aria-label': 'Search businesses, notes and tags' }))
        ),
        h('div', { className: 'lead-view-tools' },
          h('div', { className: 'lead-view-save' },
            h('div', { className: 'lead-view-select-row' }, this.renderAnimatedSelect('saved-views', savedViewId, [{ value: '', label: 'Saved views' }].concat(savedViews.map(view => ({ value: view.id, label: view.name }))), 'Saved lead views', value => this.setState({ savedViewId: value }))),
            h('div', { className: 'lead-view-actions' },
              h('button', { type: 'button', className: 'workspace-button subtle', onClick: () => this.applySavedView(), disabled: !savedViewId }, 'Apply'),
              h('button', { type: 'button', className: 'workspace-button subtle', onClick: () => this.saveView() }, 'Save'),
              h('button', { type: 'button', className: 'workspace-button subtle', onClick: () => this.deleteSavedView(), disabled: !savedViewId, title: 'Delete selected saved view' }, 'Delete')
            )
          ),
          h('label', { className: 'workspace-import-label' }, h('input', { type: 'file', accept: '.csv,.tsv,.json,application/json,text/csv,text/tab-separated-values', disabled: importBusy || Boolean(status.running), ref: el => { this.importInput = el; }, onChange: e => this.importFile(e.target.files && e.target.files[0]) }), importBusy ? 'Importing…' : 'Import CSV / JSON')
        ),
        h('div', { className: 'lead-table-toolbar' },
          h('label', { className: 'lead-select-all' }, h('input', { type: 'checkbox', checked: filtered.length > 0 && filtered.every(item => selected.includes(item.key)), onChange: e => this.setState({ selected: e.target.checked ? Array.from(new Set(selected.concat(filtered.map(item => item.key)))) : selected.filter(key => !filtered.some(item => item.key === key)) }), 'aria-label': 'Select all filtered leads' }), h('span', null, `${filtered.length.toLocaleString()} shown`)),
          h('span', { className: 'lead-selection-count' }, `${selected.length} selected`),
          h('button', { type: 'button', className: 'workspace-button subtle', disabled: !selected.length, onClick: () => this.saveBulkPatch({ status: 'Contacted', doNotContact: false }) }, 'Mark contacted'),
          h('details', { className: 'lead-bulk-actions', key: 'bulk-actions' }, h('summary', null, 'Bulk edit'), h('div', { className: 'lead-bulk-grid' },
            h('label', null, 'Set status', this.renderAnimatedSelect('bulk-status', this.state.bulkStatus, STATUS_OPTIONS.map(value => ({ value, label: value })), 'Bulk status', value => this.setState({ bulkStatus: value })), h('button', { type: 'button', className: 'workspace-button subtle', disabled: !selected.length, onClick: () => this.saveBulkPatch({ status: this.state.bulkStatus, doNotContact: this.state.bulkStatus === 'Do not contact' }) }, 'Apply status')),
            h('label', null, 'Set priority', this.renderAnimatedSelect('bulk-priority', this.state.bulkPriority, PRIORITY_OPTIONS.map(value => ({ value, label: value })), 'Bulk priority', value => this.setState({ bulkPriority: value })), h('button', { type: 'button', className: 'workspace-button subtle', disabled: !selected.length, onClick: () => this.saveBulkPatch({ priority: this.state.bulkPriority }) }, 'Apply priority'))
          )),
          h('button', { type: 'button', className: 'workspace-button subtle', disabled: !selected.length, onClick: () => this.setState({ selected: [], previewExport: false }) }, 'Clear selection'),
          h('button', { type: 'button', className: 'workspace-button primary', disabled: !selected.length, onClick: () => this.exportRows(selectedRows) }, 'Export selected')
        ),
        h('div', { className: 'lead-table-scroll', role: 'region', 'aria-label': 'Saved lead records table' },
          h('table', { className: 'lead-table' },
            h('thead', null, h('tr', null, h('th', { className: 'lead-checkbox-col' }, ''), h('th', null, 'Business'), h('th', null, 'Contact'), h('th', null, 'Status'), h('th', null, 'Priority'), h('th', null, 'Follow-up'), h('th', null, 'Edit'))),
            h('tbody', null,
              visibleRows.length ? visibleRows.map(item => h('tr', { key: item.key, className: (selected.includes(item.key) ? 'is-selected ' : '') + (item.isDuplicate ? 'possible-duplicate' : '') },
                h('td', { className: 'lead-checkbox-col' }, h('input', { type: 'checkbox', checked: selected.includes(item.key), onChange: () => this.toggleSelected(item.key), 'aria-label': `Select ${item.record.name || 'business'}` })),
                h('td', { className: 'lead-business-cell' },
                  item.record.mapsUrl
                    ? h('strong', null, h('a', { className: 'lead-maps-profile-link', href: item.record.mapsUrl, target: '_blank', rel: 'noopener noreferrer', title: 'Open this Google Maps business profile' }, item.record.name || 'Unnamed business'))
                    : h('strong', null, item.record.name || 'Unnamed business'),
                  h('span', null, [item.record.category, item.record.address].filter(Boolean).join(' · ') || 'No category or address'),
                  item.isDuplicate ? h('em', { className: 'duplicate-flag' }, 'Possible duplicate') : null),
                h('td', { className: 'lead-contact-cell' },
                  item.record.phone
                    ? h('button', { type: 'button', className: 'lead-phone-link', onClick: () => this.handlePhoneClick(item.record.phone), title: (this.state.phoneClickAction || 'auto') === 'whatsapp' ? 'Open this number in WhatsApp' : (this.state.phoneClickAction || 'auto') === 'clipboard' ? 'Copy phone number' : 'Auto-detect: WhatsApp for explicit international numbers, otherwise copy', 'aria-label': `Phone ${item.record.phone}. ${(this.state.phoneClickAction || 'auto') === 'whatsapp' ? 'Open in WhatsApp' : (this.state.phoneClickAction || 'auto') === 'clipboard' ? 'Copy to clipboard' : 'Auto-detect phone action'}` }, item.record.phone)
                    : h('span', null, 'No phone'),
                  (item.meta.email || item.record.email)
                    ? h('a', { className: 'lead-contact-link lead-email-link', href: `https://mail.google.com/mail/?view=cm&to=${encodeURIComponent(item.meta.email || item.record.email)}`, target: '_blank', rel: 'noopener noreferrer', title: 'Compose an email in Gmail' }, item.meta.email || item.record.email)
                    : h('span', null, 'No email'),
                  item.record.website
                    ? h('a', { className: 'lead-contact-link lead-website-link', href: /^https?:\/\//i.test(item.record.website) ? item.record.website : `https://${item.record.website}`, target: '_blank', rel: 'noopener noreferrer', title: 'Open business website' }, item.record.website)
                    : h('span', null, 'No website')),
                h('td', { className: 'lead-status-cell' }, this.renderAnimatedSelect(`lead-status-${item.key}`, item.meta.status, STATUS_OPTIONS.map(value => ({ value, label: value })), `Status for ${item.record.name}`, value => this.saveMetadataPatch(item.key, { status: value, doNotContact: value === 'Do not contact' }), false, `lead-status-control status-${normalize(item.meta.status).replace(/\s+/g, '-')}`)),
                h('td', null, h('span', { className: `priority-pill priority-${normalize(item.meta.priority)}` }, item.meta.priority)),
                h('td', { className: 'lead-followup-cell' }, item.meta.followUpDate || '—'),
                h('td', null, h('button', { type: 'button', className: 'workspace-button edit-lead-button', onClick: () => this.openEditor(item.record), 'aria-label': `Edit ${item.record.name}` }, 'Edit'))
              )) : h('tr', { key: 'empty' }, h('td', { colSpan: 7, className: 'lead-empty-state' }, loaded ? (records.length ? 'No leads match these filters.' : 'No saved records yet. Start a permitted collection or import a CSV/JSON file.') : 'Loading saved records…')),
            )
          )
        ),
        h('div', { className: 'lead-table-footer' }, h('span', null, `Showing all ${filtered.length.toLocaleString()} filtered leads · ${records.length.toLocaleString()} total saved`), h('button', { type: 'button', className: 'workspace-link-button', onClick: () => this.setState({ previewExport: !previewExport }) }, previewExport ? 'Hide export preview' : 'Preview selected export')),
        previewExport ? h('div', { className: 'lead-export-preview' },
          h('div', { className: 'lead-export-preview-heading' }, h('strong', null, 'Export preview'), h('span', null, `${selectedItems.length} selected · first 5 shown`)),
          previewTable,
          h('p', { className: 'lead-preview-footnote' }, 'The preview uses the current export format and checked columns. Spreadsheet exports apply the same text-safety and clean-header rules as Atlas exports.')
        ) : null,
        h('details', { className: 'export-profile-settings' },
          h('summary', null, h('span', null, 'Saved export setups'), h('span', { className: 'settings-summary-note' }, 'FORMAT + COLUMNS')),
          h('div', { className: 'export-profile-controls' },
            this.renderAnimatedSelect('export-profiles', exportProfileId, [{ value: '', label: 'Choose saved setup' }].concat(exportProfiles.map(profile => ({ value: profile.id, label: profile.name }))), 'Saved export setups', value => this.setState({ exportProfileId: value })),
            h('button', { type: 'button', className: 'workspace-button subtle', disabled: !exportProfileId, onClick: () => this.applyExportProfile() }, 'Apply setup'),
            h('button', { type: 'button', className: 'workspace-button subtle', disabled: !exportProfileId, onClick: () => this.deleteExportProfile(), title: 'Delete selected export setup' }, 'Delete'),
            h('input', { id: 'atlasExportProfileName', type: 'text', maxLength: 48, placeholder: 'Name current setup', 'aria-label': 'Name current export setup' }),
            h('button', { type: 'button', className: 'workspace-button subtle', onClick: () => this.saveExportProfile() }, 'Save setup')
          ),
          h('p', { className: 'workspace-help-text' }, 'A setup stores the selected file format and column configuration locally. Your existing column presets continue to work independently.')
        ),
        editingKey && draft ? h('div', { className: 'lead-editor-panel' },
          h('div', { className: 'lead-editor-heading' }, h('div', null, h('span', { className: 'editor-kicker' }, 'LEAD DETAILS'), h('strong', null, (records.find(record => recordKey(record) === editingKey) || {}).name || 'Edit lead')), h('button', { type: 'button', className: 'workspace-link-button', onClick: () => this.setState({ editingKey: '', draft: null }) }, 'Close')),
          h('div', { className: 'lead-editor-grid' },
            h('label', null, 'Status', this.renderAnimatedSelect('editor-status', draft.status || 'New', STATUS_OPTIONS.map(value => ({ value, label: value })), 'Lead status', value => this.setState({ draft: Object.assign({}, this.state.draft || draft, { status: value }) }))),
            h('label', null, 'Priority', this.renderAnimatedSelect('editor-priority', draft.priority || 'Normal', PRIORITY_OPTIONS.map(value => ({ value, label: value })), 'Lead priority', value => this.setState({ draft: Object.assign({}, this.state.draft || draft, { priority: value }) }))),
            h('label', null, 'Email', h('input', { type: 'email', maxLength: 254, value: draft.email || '', placeholder: 'name@example.com', onChange: e => this.setState({ draft: Object.assign({}, draft, { email: e.target.value }) }) })),
            h('label', null, 'Follow-up date', h('input', { type: 'date', value: draft.followUpDate || '', onChange: e => this.setState({ draft: Object.assign({}, draft, { followUpDate: e.target.value }) }) })),
            h('label', { className: 'lead-editor-wide' }, 'Tags', h('input', { type: 'text', maxLength: 500, value: draft.tagsText || '', placeholder: 'e.g. dental, high intent, local', onChange: e => this.setState({ draft: Object.assign({}, draft, { tagsText: e.target.value }) }) }), h('span', { className: 'lead-editor-help' }, 'Separate tags with commas.')),
            h('label', { className: 'lead-editor-wide' }, 'Notes', h('textarea', { rows: 3, maxLength: 8000, value: draft.notes || '', placeholder: 'Add context, outreach notes, or next steps…', onChange: e => this.setState({ draft: Object.assign({}, draft, { notes: e.target.value }) }) })),
            h('div', { className: 'lead-editor-actions lead-editor-wide' }, h('button', { type: 'button', className: 'workspace-button primary', onClick: () => this.saveEditor() }, 'Save lead details'), h('span', null, 'Saved only in this browser.'))
          )
        ) : null,
        h('div', { className: 'lead-workspace-bottom-tools' },
          h('details', { className: 'workspace-help' }, h('summary', null, 'Help & troubleshooting'), h('div', { className: 'workspace-help-body' },
            h('p', null, h('strong', null, 'Missing business details'), ' — Atlas can only organize information available in your imported data or the page. Missing phone numbers do not automatically mean a record is invalid.'),
            h('p', null, h('strong', null, 'Possible duplicates'), ' — matches are suggestions based on listing URL or normalized business name and address. Review them before deleting or excluding anything; branches can share names.'),
            h('p', null, h('strong', null, 'Collection interruption'), ' — saved records remain in local storage. Reopen the relevant results page and use Start scan / Retry to continue; already-known listings are skipped where the listing key matches.'),
            h('p', null, h('strong', null, 'Privacy'), ' — notes, tags, statuses, views, and export setups stay in Chrome local storage. Export or reset data deliberately because clearing browser extension data removes this information too.')
          )),
          h('span', { className: 'workspace-local-note' }, 'Local storage only · No account, subscription, external CRM API, or cloud sync is configured.')
        )
      );
    }
  }

  function loadScript(src) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = chrome.runtime.getURL(src);
      script.onload = () => { script.remove(); resolve(); };
      script.onerror = () => { reject(new Error(`Could not load ${src}`)); };
      document.body.appendChild(script);
    });
  }

  function LegacyShell(props) {
    return h('div', { className: 'react-rendered-shell', dangerouslySetInnerHTML: { __html: props.html } });
  }

  fetch(chrome.runtime.getURL('legacy-shell.html'))
    .then(response => { if (!response.ok) throw new Error('The Atlas interface template could not be read.'); return response.text(); })
    .then(html => {
      ReactDOM.render(h(LegacyShell, { html }), document.getElementById('atlas-root'), () => {
        const workspace = document.getElementById('leadWorkspaceMount');
        if (workspace) ReactDOM.render(h(LeadWorkspace), workspace);
        loadScript('world-country-data.js')
          .then(() => loadScript('export-utils.js'))
          .then(async () => {
            // All available offline translations ship inside this extension. No translation
            // service or language-pack download is needed for phrases included in translations.json.
            try {
              const phraseResponse = await fetch(chrome.runtime.getURL('interface-phrases.json'));
              if (!phraseResponse.ok) throw new Error(`Could not read interface-phrases.json (${phraseResponse.status})`);
              const phrases = await phraseResponse.json();
              window.ATLAS_SOURCE_PHRASES = Array.isArray(phrases) ? phrases.filter(value => typeof value === 'string' && value.trim()) : [];
              const translationResponse = await fetch(chrome.runtime.getURL('translations.json'));
              if (!translationResponse.ok) throw new Error(`Could not read translations.json (${translationResponse.status})`);
              const localTranslations = await translationResponse.json();
              window.ATLAS_PREWRITTEN_TRANSLATIONS = localTranslations && typeof localTranslations === 'object' ? localTranslations : {};
              window.ATLAS_DOWNLOADED_LANGUAGE_PACKS = {};
              for (const [code, translations] of Object.entries(window.ATLAS_PREWRITTEN_TRANSLATIONS)) {
                window.ATLAS_DOWNLOADED_LANGUAGE_PACKS[code] = {
                  language: code, downloadedAt: 'bundled-offline', phraseCount: window.ATLAS_SOURCE_PHRASES.length,
                  translations
                };
              }
            } catch (translationLoadError) {
              console.warn('Atlas offline language packs could not be loaded; interface will use English.', translationLoadError);
              window.ATLAS_SOURCE_PHRASES = [];
              window.ATLAS_DOWNLOADED_LANGUAGE_PACKS = {};
              window.ATLAS_PREWRITTEN_TRANSLATIONS = {};
            }
            return loadScript('popup.js');
          })
          .catch(error => {
            const status = document.getElementById('statusText');
            if (status) status.textContent = `Atlas loaded with a startup issue: ${error.message || error}`;
          });
      });
    })
    .catch(error => {
      const root = document.getElementById('atlas-root');
      if (root) root.textContent = `Atlas could not start: ${error.message || error}. Reload the extension from chrome://extensions.`;
    });
})();

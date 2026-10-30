// Atlas 1.6.0 — use the persistent Chrome side panel instead of a closing action popup.
chrome.runtime.onInstalled.addListener(async () => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
  // Older builds stored "clear search on close" as enabled by default. On
  // upgrade, migrate that default to opt-in so saved search preferences stay.
  try {
    const { mapLeadViewPrefs = {}, mapLeadSettingsVersion = 0 } = await chrome.storage.local.get(['mapLeadViewPrefs', 'mapLeadSettingsVersion']);
    if (Number(mapLeadSettingsVersion) < 2) {
      await chrome.storage.local.set({
        mapLeadViewPrefs: {
          showHero: true, showSearch: true, showPreview: true, showExport: true,
          ...mapLeadViewPrefs,
          resetSearchOnPanelClose: false
        },
        mapLeadSettingsVersion: 2
      });
    }
  } catch (error) {
    console.warn('Atlas could not migrate saved preferences:', error);
  }
});
chrome.runtime.onStartup.addListener(() => {
  chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});
});
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true }).catch(() => {});


// Chrome 142+ exposes an explicit side-panel close event. Clear search inputs
// on close when enabled, but never clear the saved business dataset.
if (chrome.sidePanel?.onClosed?.addListener) {
  chrome.sidePanel.onClosed.addListener(async () => {
    try {
      const { mapLeadViewPrefs = {}, mapLeadQueryPrefs = {} } = await chrome.storage.local.get(['mapLeadViewPrefs', 'mapLeadQueryPrefs']);
      if (mapLeadViewPrefs.resetSearchOnPanelClose !== true) return;
      await chrome.storage.local.set({
        mapLeadQueryPrefs: { ...mapLeadQueryPrefs, query: '', location: '' }
      });
    } catch (error) {
      console.warn('Atlas could not reset search fields after the panel closed:', error);
    }
  });
}

// Manage background scan tabs independently of the side-panel page lifecycle.
// This keeps collection going when the user switches tabs or closes the panel.
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName !== 'local' || !changes.mapLeadStatus) return;
  const previous = changes.mapLeadStatus.oldValue || {};
  const next = changes.mapLeadStatus.newValue || {};
  if (!previous.running || next.running || previous.atlasManagedAutoDiscardable !== true) return;
  if (!Number.isInteger(previous.tabId)) return;

  const originalValue = previous.atlasPreviousAutoDiscardable !== false;
  chrome.tabs.update(previous.tabId, { autoDiscardable: originalValue }).catch(() => {
    // The tab may already have been closed; its preference no longer matters.
  });
});

// If the Maps page itself navigates/reloads during a collection, the page's
// content-script task cannot survive that document replacement. Distinguish
// this from a user simply switching to another tab.
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  if (changeInfo.status === 'loading') {
    (async () => {
      const { mapLeadStatus = {} } = await chrome.storage.local.get('mapLeadStatus');
      if (!mapLeadStatus.running || mapLeadStatus.tabId !== tabId) return;
      await chrome.storage.local.set({
        mapLeadStatus: {
          ...mapLeadStatus,
          atlasNavigationPendingAt: Date.now(),
          updatedAt: Date.now(),
          message: 'The Maps tab is navigating. Atlas is checking whether the background task can continue…'
        }
      });
    })().catch(() => {});
    return;
  }

  if (changeInfo.status !== 'complete') return;
  (async () => {
    // Allow the document and its extension message listeners to finish loading.
    await new Promise((resolve) => setTimeout(resolve, 900));
    const { mapLeadStatus = {} } = await chrome.storage.local.get('mapLeadStatus');
    if (!mapLeadStatus.running || mapLeadStatus.tabId !== tabId || !mapLeadStatus.atlasNavigationPendingAt) return;
    try {
      const response = await chrome.tabs.sendMessage(tabId, { type: 'MAPLEADS_V130_STATUS' });
      if (response?.ok && response.running) {
        const resumed = { ...mapLeadStatus, atlasNavigationPendingAt: 0, updatedAt: Date.now(), message: 'Background collection is active again. Progress and saved records will update here.' };
        await chrome.storage.local.set({ mapLeadStatus: resumed });
        return;
      }
    } catch { /* A full page reload can remove the collector's message listener. */ }

    const interrupted = {
      ...mapLeadStatus,
      running: false,
      interrupted: true,
      progress: 0,
      atlasNavigationPendingAt: 0,
      updatedAt: Date.now(),
      message: 'The Maps page reloaded during collection. Saved records are safe; press Start scan to resume.'
    };
    await chrome.storage.local.set({ mapLeadStatus: interrupted });
  })().catch(() => {});
});

// Keep the active-job state correct even if the side panel is closed when the
// user closes the Maps tab. The storage listener above also restores tab policy.
chrome.tabs.onRemoved.addListener((tabId) => {
  (async () => {
    const { mapLeadStatus = {} } = await chrome.storage.local.get('mapLeadStatus');
    if (!mapLeadStatus.running || mapLeadStatus.tabId !== tabId) return;
    await chrome.storage.local.set({
      mapLeadStatus: {
        ...mapLeadStatus,
        running: false,
        interrupted: true,
        progress: 0,
        atlasNavigationPendingAt: 0,
        updatedAt: Date.now(),
        message: 'The Maps tab was closed. Saved records are safe; reopen Maps and press Start scan to continue.'
      }
    });
  })().catch(() => {});
});

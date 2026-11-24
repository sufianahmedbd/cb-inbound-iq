// Local-only bridge: never sends Hive data to a third party or to the Worker backend.
const SNAPSHOT_KEY = 'latestParcelSnapshot';

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'CARRYBEE_PARCEL_SNAPSHOT' && message.payload) {
    chrome.storage.local.set({ [SNAPSHOT_KEY]: message.payload }, () => {
      sendResponse({ ok: !chrome.runtime.lastError, storedAt: new Date().toISOString() });
    });
    return true;
  }

  if (message?.type === 'CARRYBEE_GET_PARCEL_SNAPSHOT') {
    chrome.storage.local.get(SNAPSHOT_KEY, (result) => {
      sendResponse({ ok: !chrome.runtime.lastError, payload: result[SNAPSHOT_KEY] || null });
    });
    return true;
  }
});

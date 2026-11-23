// Carrybee InboundIQ Manifest V3 Service Worker Bridge
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message && message.type === 'CARRYBEE_PARCEL_SNAPSHOT') {
    chrome.storage.local.set({ latestParcelSnapshot: message.payload }, () => {
      sendResponse({ ok: true, storedAt: new Date().toISOString() });
    });
    return true;
  }
});

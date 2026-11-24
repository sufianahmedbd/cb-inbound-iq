// Relay a page request to the extension service worker and reply only to this page.
(() => {
  window.addEventListener('message', (event) => {
    if (event.source !== window || event.data?.source !== 'inboundiq-crm' || event.data?.type !== 'GET_HIVE_PARCEL') return;
    chrome.runtime.sendMessage({ type: 'CARRYBEE_GET_PARCEL_SNAPSHOT' }, (result) => {
      window.postMessage({
        source: 'inboundiq-extension',
        type: 'HIVE_PARCEL_RESULT',
        requestId: event.data.requestId,
        payload: result?.payload || null,
        error: chrome.runtime.lastError?.message || null
      }, location.origin);
    });
  });
})();

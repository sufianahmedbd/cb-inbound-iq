// Browser-local storage bridge. Hive order data is never uploaded to the Worker backend.
const SNAPSHOT_KEY = 'latestParcelSnapshot';
const APPROVED_FIELDS = [
  'consignment_id', 'created_ago', 'created_at',
  'business_name', 'business_id', 'business_owner_number',
  'customer_name', 'customer_number', 'customer_address',
  'delivery_attempt_count', 'current_parcel_status',
  'pickup_hub', 'current_hub', 'lmh_hub',
  'parcel_amount', 'cod_amount'
];

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'CARRYBEE_PARCEL_SNAPSHOT' && message.payload) {
    const source = message.payload;
    const payload = Object.fromEntries(APPROVED_FIELDS.map((key) => [key, String(source[key] ?? '')]));
    const id = payload.consignment_id.toUpperCase();
    if (!/^(?:CB[0-9]{6,12}|[FER][A-Z0-9]{10})$/.test(id)) {
      sendResponse({ ok: false, error: 'Invalid consignment ID.' });
      return false;
    }
    payload.consignment_id = id;
    chrome.storage.local.set({ [SNAPSHOT_KEY]: payload }, () => {
      sendResponse({ ok: !chrome.runtime.lastError });
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

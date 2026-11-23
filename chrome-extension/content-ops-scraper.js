// Carrybee Ops Panel Read-Only DOM Bridge (Zero Core Backend Changes)
(function () {
  function extractParcelCard() {
    const consignmentEl = document.querySelector('[data-consignment-id], .consignment-id');
    if (!consignmentEl) return null;
    return {
      consignment_id: (consignmentEl.textContent || '').trim(),
      hub_name: (document.querySelector('[data-hub-name]')?.textContent || '').trim(),
      zone: (document.querySelector('[data-zone]')?.textContent || 'ISD').trim(),
      current_status: (document.querySelector('[data-parcel-status]')?.textContent || '').trim(),
      cod_amount: (document.querySelector('[data-cod-amount]')?.textContent || '0').replace(/[^\d.]/g, ''),
      captured_at: new Date().toISOString(),
    };
  }

  document.addEventListener('mouseup', () => {
    const snap = extractParcelCard();
    if (snap && snap.consignment_id) {
      chrome.runtime.sendMessage({ type: 'CARRYBEE_PARCEL_SNAPSHOT', payload: snap });
    }
  });
})();

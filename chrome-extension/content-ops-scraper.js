// Read only the six approved Hive order sections from the single visible search-result row.
(() => {
  if (window.top !== window || document.getElementById('inboundiq-hive-capture')) return;

  const ID_RE = /\b(?:CB[0-9]{6,12}|[FER][A-Z0-9]{10})\b/i;
  const button = document.createElement('button');
  button.id = 'inboundiq-hive-capture';
  button.type = 'button';
  button.textContent = 'Waiting for one matching order';
  button.title = 'Automatically captures only when this Hive search shows exactly one matching order.';
  Object.assign(button.style, {
    position: 'fixed', zIndex: '2147483647', right: '18px', bottom: '18px',
    padding: '12px 16px', border: '0', borderRadius: '9px',
    background: '#124b3a', color: '#fff', font: '600 13px system-ui',
    boxShadow: '0 4px 16px #0004', cursor: 'pointer'
  });
  document.documentElement.appendChild(button);

  const linesOf = (node) => (node?.innerText || '').replace(/\u00a0/g, ' ').split(/\n+/).map(x => x.replace(/\s+/g, ' ').trim()).filter(Boolean);
  const money = (text) => {
    const match = String(text || '').replace(/,/g, '').match(/[৳Tk\s]*([0-9]+(?:\.[0-9]{1,2})?)/i);
    return match ? match[1] : '';
  };
  const cleanLine = (text) => String(text || '').replace(/^[^\p{L}\p{N}৳]+/u, '').trim();

  function findSingleResult() {
    const requested = new URL(location.href).searchParams.get('consignmentId')?.trim().toUpperCase() || '';
    if (!requested || !ID_RE.test(requested)) return null;
    const rows = [...document.querySelectorAll('tr, [role="row"]')].filter((row) => {
      const cells = row.matches('tr') ? [...row.children] : [...row.children];
      return cells.length >= 6 && ID_RE.test(row.innerText || '');
    });
    const matching = rows.filter(row => (row.innerText || '').toUpperCase().includes(requested));
    if (rows.length !== 1 || matching.length !== 1) return null;
    const row = matching[0];
    const cells = [...row.children].map(cell => linesOf(cell));
    if (cells.length < 6) return null;

    const info = cells[0];
    const id = (row.innerText || '').match(ID_RE)?.[0]?.toUpperCase() || requested;
    if (id !== requested) return null;
    const createdAgo = info.find(line => /\b\d+\s+(minute|hour|day|week|month|year)s?\s+ago\b/i.test(line)) || '';
    const createdAt = info.find(line => /\b20\d{2}-\d{2}-\d{2}\s+\d{2}:\d{2}:\d{2}\b/.test(line)) || '';

    const business = cells[1];
    const businessName = cleanLine(business.find(line => !/^#?\s*\d+\s*$/.test(line) && !/^\+?[\d ()-]{8,}$/.test(line)) || '');
    const businessIdLine = business.find(line => /#\s*\d+/.test(line)) || '';
    const businessId = businessIdLine.match(/#\s*(\d+)/)?.[1] || '';
    const businessOwnerNumber = business.find(line => /\+?\d[\d ()-]{7,}/.test(line))?.replace(/\D/g, '') || '';

    const receiver = cells[2];
    const customerName = cleanLine(receiver[0] || '');
    const customerNumber = receiver.find(line => /\+?\d[\d ()-]{7,}/.test(line))?.replace(/\D/g, '') || '';
    const customerAddress = receiver.find(line => !line.includes(customerNumber) && line !== customerName && /[a-z]/i.test(line)) || '';

    const statusCell = cells[3];
    const deliveryAttemptCount = statusCell.map(line => line.match(/^\D*(\d+)\s*$/)?.[1]).find(Boolean) || '';
    const currentParcelStatus = cleanLine(statusCell.find(line => /assigned|received|delivered|transit|pickup|picked|hold|attempt|cancel|return|processing/i.test(line)) || '');

    const hubCell = cells[4];
    const labeledHub = (label) => hubCell.find(line => new RegExp('^' + label + '\\s*:', 'i').test(line))?.replace(new RegExp('^' + label + '\\s*:\\s*', 'i'), '').trim() || '';
    const pickupHub = labeledHub('Pickup');
    const currentHub = labeledHub('Current');
    const lmhHub = labeledHub('LMH');

    const fees = cells[5];
    const parcelAmount = money(fees.find(line => /^Amount\s*:/i.test(line)) || '');
    const codAmount = money(fees.find(line => /^COD\s*:/i.test(line)) || '');

    return {
      consignment_id: id,
      created_ago: createdAgo,
      created_at: createdAt,
      business_name: businessName,
      business_id: businessId,
      business_owner_number: businessOwnerNumber,
      customer_name: customerName,
      customer_number: customerNumber,
      customer_address: customerAddress,
      delivery_attempt_count: deliveryAttemptCount,
      current_parcel_status: currentParcelStatus,
      pickup_hub: pickupHub,
      current_hub: currentHub,
      lmh_hub: lmhHub,
      parcel_amount: parcelAmount,
      cod_amount: codAmount
    };
  }

  let lastSavedId = '';
  function capture() {
    const payload = findSingleResult();
    if (!payload) {
      button.textContent = 'Waiting for exactly one matching order';
      return;
    }
    if (payload.consignment_id === lastSavedId) return;
    lastSavedId = payload.consignment_id;
    chrome.runtime.sendMessage({ type: 'CARRYBEE_PARCEL_SNAPSHOT', payload }, (result) => {
      if (chrome.runtime.lastError || !result?.ok) {
        button.textContent = 'Could not capture — check extension';
        lastSavedId = '';
      } else {
        button.textContent = `Captured ${payload.consignment_id} · one result`;
      }
    });
  }

  button.addEventListener('click', capture);
  // No polling or requests to Hive: observe the rendered page after its normal search completes.
  let debounce;
  const observer = new MutationObserver(() => {
    clearTimeout(debounce);
    debounce = setTimeout(capture, 250);
  });
  observer.observe(document.body, { childList: true, subtree: true, characterData: true });
  setTimeout(capture, 300);
})();

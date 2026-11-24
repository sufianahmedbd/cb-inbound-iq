// Manually capture the currently visible order from the user's authenticated Hive tab.
(() => {
  if (window.top !== window || document.getElementById('inboundiq-hive-capture')) return;

  const button = document.createElement('button');
  button.id = 'inboundiq-hive-capture';
  button.type = 'button';
  button.textContent = 'Send visible order to InboundIQ';
  button.title = 'Capture the visible Hive order into this browser for the CRM.';
  Object.assign(button.style, {
    position: 'fixed', zIndex: '2147483647', right: '18px', bottom: '18px',
    padding: '12px 16px', border: '0', borderRadius: '9px',
    background: '#124b3a', color: '#fff', font: '600 13px system-ui',
    boxShadow: '0 4px 16px #0004', cursor: 'pointer'
  });
  document.documentElement.appendChild(button);

  const norm = (value) => (value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim().replace(/[:：]$/, '').toLowerCase();
  const findValue = (labels) => {
    const wanted = labels.map(norm);
    const nodes = document.querySelectorAll('label, dt, th, span, p, div, strong, small, b');
    for (const el of nodes) {
      if (!wanted.includes(norm(el.textContent))) continue;
      const sibling = (el.nextElementSibling?.innerText || '').trim();
      if (sibling && sibling.length < 700) return sibling;
      const parent = el.parentElement;
      if (!parent) continue;
      const children = [...parent.children];
      const index = children.indexOf(el);
      if (index >= 0 && children[index + 1]) {
        const value = (children[index + 1].innerText || '').trim();
        if (value && value.length < 700) return value;
      }
      const parentText = (parent.innerText || '').replace(/\u00a0/g, ' ').trim();
      const value = parentText.slice(el.textContent.trim().length).replace(/^\s*[:：]?\s*/, '').trim();
      if (value && value.length < 700) return value;
    }
    // Table and definition-list fallback for layouts where labels aren't their own nodes.
    for (const row of document.querySelectorAll('tr, dl, [class*="row"], [class*="detail"]')) {
      const cells = [...row.children].map((child) => (child.innerText || '').trim()).filter(Boolean);
      if (cells.length < 2) continue;
      if (wanted.includes(norm(cells[0]))) return cells.slice(1).join(' ').trim();
    }
    return '';
  };

  const findConsignment = () => {
    const fromUrl = new URL(location.href).searchParams.get('consignmentId') || '';
    const valid = /\b(?:CB\d{6,12}|[FER][A-Z0-9]{10})\b/i;
    if (valid.test(fromUrl)) return fromUrl.match(valid)[0].toUpperCase();
    const match = (document.body?.innerText || '').match(valid);
    return match ? match[0].toUpperCase() : '';
  };

  button.addEventListener('click', () => {
    const consignmentId = findConsignment();
    if (!consignmentId) {
      button.textContent = 'No supported consignment found on this page';
      setTimeout(() => { button.textContent = 'Send visible order to InboundIQ'; }, 3000);
      return;
    }

    const statusCandidates = [...document.querySelectorAll('[class*="status"], [class*="badge"], [class*="tag"]')]
      .map((el) => (el.innerText || '').trim().replace(/\s+/g, ' '))
      .filter((text) => text.length > 3 && text.length < 100);
    const status = findValue(['Current Status', 'Order Status', 'Delivery Status']) ||
      statusCandidates.find((text) => /received|delivered|transit|pickup|picked|hold|attempt|cancel|return|processing/i.test(text)) || '';

    const orderLogs = [...document.querySelectorAll('tr')]
      .map((row) => (row.innerText || '').trim().replace(/\s+/g, ' '))
      .filter((text) => text.length > 12 && text.length < 500 && /20\d{2}[-/]/.test(text))
      .filter((text, index, all) => all.indexOf(text) === index)
      .slice(0, 30);

    const snapshot = {
      consignment_id: consignmentId,
      current_status: status,
      current_hub: findValue(['Current Hub']),
      last_mile_hub: findValue(['Last Mile Hub']),
      pickup_hub: findValue(['Pickup Hub']),
      rider: findValue(['Rider', 'Delivery Agent', 'Assigned Rider']),
      rider_phone: findValue(['Rider Phone', 'Agent Phone']),
      collectable_amount: findValue(['Collectable Amount', 'Amount to Collect', 'Amount']),
      cod_fee: findValue(['COD Fee']),
      merchant: findValue(['Business Name', 'Merchant', 'Store']),
      merchant_order_id: findValue(['Merchant Order ID']),
      destination: findValue(['Address', 'Delivery Address', 'Customer Address']),
      receiver_name: findValue(['Receiver Name', 'Name']),
      receiver_phone: findValue(['Receiver Number', 'Number', 'Phone']),
      weight: findValue(['Weight']),
      quantity: findValue(['Quantity']),
      payment_status: findValue(['Payment Status']),
      hub_payment_status: findValue(['Hub Payment Status']),
      order_logs: orderLogs,
      source_url: location.href,
      captured_at: new Date().toISOString()
    };
    chrome.runtime.sendMessage({ type: 'CARRYBEE_PARCEL_SNAPSHOT', payload: snapshot }, (result) => {
      if (chrome.runtime.lastError || !result?.ok) button.textContent = 'Could not save order — check extension';
      else button.textContent = `Saved ${snapshot.consignment_id} — open InboundIQ`;
      setTimeout(() => { button.textContent = 'Send visible order to InboundIQ'; }, 3500);
    });
  });
})();

// On the user's authenticated Hive orders page, manually capture the visible order only.
(() => {
  if (window.top !== window || document.getElementById('inboundiq-hive-capture')) return;

  const button = document.createElement('button');
  button.id = 'inboundiq-hive-capture';
  button.type = 'button';
  button.textContent = 'Send visible order to InboundIQ';
  button.title = 'Reads visible order details on this page and stores them in this browser only.';
  Object.assign(button.style, {
    position: 'fixed', zIndex: '2147483647', right: '18px', bottom: '18px',
    padding: '12px 16px', border: '0', borderRadius: '9px',
    background: '#124b3a', color: '#fff', font: '600 13px system-ui',
    boxShadow: '0 4px 16px #0004', cursor: 'pointer'
  });
  document.documentElement.appendChild(button);

  const findValue = (labels) => {
    const wanted = labels.map((label) => label.toLowerCase());
    for (const el of document.querySelectorAll('tr, [class*="row"], [class*="detail"], li, dt')) {
      const text = (el.innerText || '').trim();
      if (!text || text.length > 700) continue;
      const cells = [...el.children].map((child) => (child.innerText || '').trim()).filter(Boolean);
      if (cells.length >= 2 && wanted.some((label) => cells[0].toLowerCase().replace(/[:：]$/, '').includes(label))) return cells.slice(1).join(' ').trim();
      const match = text.match(/^([^:：\n]{2,50})[:：]\s*(.+)$/s);
      if (match && wanted.some((label) => match[1].trim().toLowerCase().includes(label))) return match[2].trim();
    }
    return '';
  };

  button.addEventListener('click', () => {
    const bodyText = (document.body?.innerText || '').replace(/\u00a0/g, ' ');
    const idMatch = bodyText.match(/\bCB\d{6,12}\b/i);
    if (!idMatch) {
      button.textContent = 'No consignment found — search an order first';
      setTimeout(() => { button.textContent = 'Send visible order to InboundIQ'; }, 3000);
      return;
    }

    const scans = [...document.querySelectorAll('tr, [class*="timeline"], [class*="history"], [class*="scan"]')]
      .map((el) => (el.innerText || '').trim().replace(/\s+/g, ' '))
      .filter((text) => text.length > 8 && text.length < 500)
      .filter((text, index, all) => all.indexOf(text) === index)
      .slice(0, 30);
    const snapshot = {
      consignment_id: idMatch[0].toUpperCase(),
      current_status: findValue(['status', 'current status', 'delivery status']),
      hub_name: findValue(['hub', 'current hub', 'destination hub']),
      rider: findValue(['rider', 'delivery agent', 'assigned rider']),
      rider_phone: findValue(['rider phone', 'agent phone', 'contact number']),
      cod_amount: findValue(['cod', 'cod amount', 'collectable amount']),
      merchant: findValue(['merchant', 'store', 'sender']),
      destination: findValue(['destination', 'delivery address', 'customer address']),
      scans,
      source_url: location.href,
      captured_at: new Date().toISOString()
    };
    chrome.runtime.sendMessage({ type: 'CARRYBEE_PARCEL_SNAPSHOT', payload: snapshot }, (result) => {
      if (chrome.runtime.lastError || !result?.ok) {
        button.textContent = 'Could not save order — check extension';
      } else {
        button.textContent = `Saved ${snapshot.consignment_id} — open InboundIQ`;
      }
      setTimeout(() => { button.textContent = 'Send visible order to InboundIQ'; }, 3500);
    });
  });
})();

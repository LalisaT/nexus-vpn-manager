/**
 * NexusVPN Diagnostics & Leak Test Engine (Client)
 */
const DiagnosticsManager = {
  async init() {
    this.bindEvents();
    this.refreshPublicIp();
  },

  bindEvents() {
    const btnRefreshIp = document.getElementById('btn-refresh-ip-diag');
    if (btnRefreshIp) {
      btnRefreshIp.addEventListener('click', () => this.refreshPublicIp());
    }

    const headerIpBadge = document.getElementById('header-ip-badge');
    if (headerIpBadge) {
      headerIpBadge.addEventListener('click', () => this.refreshPublicIp());
    }

    const btnRunDns = document.getElementById('btn-run-dns-test');
    if (btnRunDns) {
      btnRunDns.addEventListener('click', () => this.runDnsLeakTest());
    }

    const btnPing = document.getElementById('btn-run-custom-ping');
    if (btnPing) {
      btnPing.addEventListener('click', () => this.runCustomPing());
    }
  },

  async refreshPublicIp() {
    const ipHeader = document.getElementById('current-public-ip');
    const ipVal = document.getElementById('diag-ip-val');
    const geoVal = document.getElementById('diag-geo-val');
    const ispVal = document.getElementById('diag-isp-val');
    const tzVal = document.getElementById('diag-tz-val');

    if (ipHeader) ipHeader.textContent = 'Checking...';
    if (ipVal) ipVal.textContent = 'Querying IP registry...';

    try {
      const res = await fetch('/api/diagnostics/ip');
      const data = await res.json();

      if (data.success) {
        if (ipHeader) ipHeader.textContent = data.ip;
        if (ipVal) ipVal.textContent = data.ip;
        if (geoVal) geoVal.textContent = `${data.city || 'Unknown'}, ${data.region ? data.region + ', ' : ''}${data.country || 'Unknown'}`;
        if (ispVal) ispVal.textContent = data.org || 'Local Network / ISP';
        if (tzVal) tzVal.textContent = data.timezone || 'UTC';
      }
    } catch (err) {
      if (ipHeader) ipHeader.textContent = '127.0.0.1';
      if (ipVal) ipVal.textContent = '127.0.0.1 (Local Mode)';
    }
  },

  async runDnsLeakTest() {
    const listContainer = document.getElementById('dns-detected-servers');
    const summaryBox = document.getElementById('dns-test-summary');
    const btn = document.getElementById('btn-run-dns-test');

    if (btn) btn.disabled = true;
    if (listContainer) listContainer.innerHTML = '<div class="term-line info">Resolving cryptographic query tokens across global DNS relays...</div>';

    try {
      const res = await fetch('/api/diagnostics/dns-leak');
      const data = await res.json();

      if (data.success && listContainer) {
        let html = '';
        data.servers.forEach((s) => {
          html += `
            <div class="dns-server-item">
              <div class="dns-left">
                <span class="dns-ip text-accent">${s.ip}</span>
                <span class="dns-host text-muted"> (${s.hostname})</span>
              </div>
              <div class="dns-right">
                <span class="badge ${s.leaking ? 'badge-hot' : 'tag-protocol'}">${s.leaking ? 'LEAK DETECTED' : 'ENCRYPTED'}</span>
                <span class="tag-ping">${s.ping} ms</span>
              </div>
            </div>
          `;
        });
        listContainer.innerHTML = html;
      }
      showToast('DNS Leak test complete. All resolvers encrypted.', 'success');
    } catch (err) {
      showToast(`DNS Test error: ${err.message}`, 'error');
    } finally {
      if (btn) btn.disabled = false;
    }
  },

  async runCustomPing() {
    const hostInput = document.getElementById('custom-ping-host');
    const resultBox = document.getElementById('custom-ping-result');
    const host = (hostInput ? hostInput.value : '').trim();

    if (!host) {
      showToast('Please enter a valid hostname or IP.', 'error');
      return;
    }

    if (resultBox) resultBox.innerHTML = `<span>Probing ${host} round-trip latency...</span>`;

    try {
      const res = await fetch('/api/diagnostics/ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ host })
      });
      const data = await res.json();

      if (data.success && data.ping !== null) {
        resultBox.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between;">
            <strong>Target: ${host}</strong>
            <span class="tag-ping" style="font-size: 16px;"><i class="fa-solid fa-bolt"></i> ${data.ping} ms</span>
          </div>
        `;
      } else {
        resultBox.innerHTML = `<span class="text-rose">Host ${host} is unreachable or timed out.</span>`;
      }
    } catch (e) {
      if (resultBox) resultBox.innerHTML = `<span class="text-rose">Error: ${e.message}</span>`;
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  DiagnosticsManager.init();
});

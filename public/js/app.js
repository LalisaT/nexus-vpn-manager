/**
 * NexusVPN Core Client Application Controller
 */

// Toast notification helper
function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = 'fa-circle-info text-accent';
  if (type === 'success') icon = 'fa-circle-check text-emerald';
  if (type === 'error') icon = 'fa-triangle-exclamation text-rose';

  toast.innerHTML = `<i class="fa-solid ${icon}"></i><span>${message}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'all 0.3s ease';
    setTimeout(() => toast.remove(), 300);
  }, 3500);
}

const App = {
  ws: null,
  profiles: [],
  activeProfile: null,
  tunnelStatus: 'DISCONNECTED',
  connectedAt: null,
  timerInterval: null,

  async init() {
    this.initWebSocket();
    this.bindNavigation();
    this.bindConnectionToggle();
    this.bindModals();
    this.bindSettings();
    this.bindRules();
    await this.loadProfiles();
  },

  // WebSocket for real-time telemetry & log streaming
  initWebSocket() {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('NexusWS connected.');
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleWsMessage(msg);
        } catch (e) {
          console.error('WS Parse Error:', e);
        }
      };

      this.ws.onclose = () => {
        setTimeout(() => this.initWebSocket(), 3000);
      };
    } catch (e) {
      console.warn('WS fallback to polling.');
    }
  },

  handleWsMessage({ type, data }) {
    if (type === 'init') {
      this.updateTunnelState(data.tunnel);
    } else if (type === 'statusChange') {
      this.updateTunnelState(data);
    } else if (type === 'telemetry') {
      this.updateTelemetry(data);
    } else if (type === 'ping_results') {
      this.updatePings(data);
    } else if (type === 'provision_log') {
      if (typeof ProvisionerManager !== 'undefined') {
        ProvisionerManager.logToTerminal(data.message, data.type);
      }
    }
  },

  // Tab Navigation
  bindNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const tabViews = document.querySelectorAll('.tab-view');
    const pageTitle = document.getElementById('page-title');
    const pageSubtitle = document.getElementById('page-subtitle');

    const titles = {
      dashboard: { title: 'Dashboard', sub: 'Real-time connection control & multi-protocol status' },
      servers: { title: 'Servers & Nodes', sub: 'Manage, test, and switch between VPN servers and proxy nodes' },
      provisioner: { title: '1-Click Server Auto-Installer', sub: 'Deploy WireGuard, VLESS-Reality, or 3X-UI on your VPS in under 2 minutes' },
      diagnostics: { title: 'Diagnostics & Leak Hub', sub: 'Inspect public IP geolocation, test for DNS leaks, and measure latency' },
      routing: { title: 'Smart Bypass & Split-Tunneling', sub: 'Configure domain routing rules and bypass domestic or local LAN traffic' },
      settings: { title: 'Settings', sub: 'Customize security preferences, kill switch, and local proxy ports' }
    };

    navItems.forEach((btn) => {
      btn.addEventListener('click', () => {
        const tab = btn.getAttribute('data-tab');
        navItems.forEach(b => b.classList.remove('active'));
        tabViews.forEach(v => v.classList.remove('active'));

        btn.classList.add('active');
        const activeView = document.getElementById(`view-${tab}`);
        if (activeView) activeView.classList.add('active');

        if (titles[tab]) {
          pageTitle.textContent = titles[tab].title;
          pageSubtitle.textContent = titles[tab].sub;
        }

        if (tab === 'servers') this.loadProfiles();
      });
    });

    const btnSwitchQuick = document.getElementById('btn-switch-server-quick');
    if (btnSwitchQuick) {
      btnSwitchQuick.addEventListener('click', () => {
        document.querySelector('[data-tab="servers"]').click();
      });
    }
  },

  // Connection Shield Toggle Button
  bindConnectionToggle() {
    const btn = document.getElementById('btn-toggle-connection');
    if (btn) {
      btn.addEventListener('click', () => {
        if (this.tunnelStatus === 'CONNECTED') {
          this.disconnectTunnel();
        } else if (this.tunnelStatus === 'DISCONNECTED') {
          this.connectTunnel();
        }
      });
    }
  },

  async connectTunnel(profileId = null) {
    const targetId = profileId || (this.activeProfile ? this.activeProfile.id : (this.profiles[0]?.id));
    if (!targetId) {
      showToast('No server profiles available. Add or import a profile first.', 'error');
      return;
    }

    this.setShieldState('CONNECTING');

    try {
      const res = await fetch('/api/tunnel/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ profileId: targetId })
      });
      const data = await res.json();

      if (data.success) {
        this.updateTunnelState(data);
        showToast(`Connected to ${data.profile?.name || 'VPN Server'}! Encrypted tunnel active.`, 'success');
        if (typeof DiagnosticsManager !== 'undefined') {
          DiagnosticsManager.refreshPublicIp();
        }
      } else {
        this.setShieldState('DISCONNECTED');
        showToast(`Connection error: ${data.error}`, 'error');
      }
    } catch (e) {
      this.setShieldState('DISCONNECTED');
      showToast(`Connection failed: ${e.message}`, 'error');
    }
  },

  async disconnectTunnel() {
    try {
      const res = await fetch('/api/tunnel/disconnect', { method: 'POST' });
      const data = await res.json();
      this.updateTunnelState(data);
      showToast('Disconnected. All traffic restored to default route.', 'info');
      if (typeof DiagnosticsManager !== 'undefined') {
        DiagnosticsManager.refreshPublicIp();
      }
    } catch (e) {
      showToast(`Disconnect error: ${e.message}`, 'error');
    }
  },

  updateTunnelState(state) {
    this.tunnelStatus = state.status || 'DISCONNECTED';
    if (state.profile) this.activeProfile = state.profile;
    if (state.connectedAt) this.connectedAt = new Date(state.connectedAt);
    else this.connectedAt = null;

    this.setShieldState(this.tunnelStatus);
    this.updateDashboardActiveNode();
    this.updateSessionTimer();
  },

  setShieldState(status) {
    const btn = document.getElementById('btn-toggle-connection');
    const shieldIcon = document.getElementById('shield-icon');
    const actionText = document.getElementById('shield-action-text');
    const heading = document.getElementById('dash-connection-heading');
    const desc = document.getElementById('dash-connection-desc');
    const pill = document.getElementById('global-status-pill');
    const pillText = document.getElementById('global-status-text');

    btn.className = 'connect-shield-btn';
    pill.className = 'status-pill';

    if (status === 'CONNECTED') {
      btn.classList.add('connected');
      pill.classList.add('connected');
      shieldIcon.className = 'fa-solid fa-lock';
      actionText.textContent = 'DISCONNECT';
      heading.textContent = 'Encrypted Tunnel Active';
      desc.textContent = `Secured via ${this.activeProfile?.name || 'Selected Node'}.`;
      pillText.textContent = 'PROTECTED';
    } else if (status === 'CONNECTING') {
      btn.classList.add('connecting');
      pill.classList.add('connecting');
      shieldIcon.className = 'fa-solid fa-rotate';
      actionText.textContent = 'CONNECTING';
      heading.textContent = 'Establishing Secure Handshake...';
      desc.textContent = 'Negotiating cryptographic parameters and routing tables.';
      pillText.textContent = 'CONNECTING...';
    } else {
      pill.classList.add('disconnected');
      shieldIcon.className = 'fa-solid fa-power-off';
      actionText.textContent = 'CONNECT';
      heading.textContent = 'Ready to Secure Connection';
      desc.textContent = 'Select a server node and tap Connect to encrypt all traffic.';
      pillText.textContent = 'UNPROTECTED';
    }
  },

  updateSessionTimer() {
    const timerBox = document.getElementById('session-timer');
    const timerVal = document.getElementById('timer-val');

    if (this.timerInterval) clearInterval(this.timerInterval);

    if (this.tunnelStatus === 'CONNECTED' && this.connectedAt) {
      timerBox.style.display = 'inline-flex';
      const tick = () => {
        const diffSeconds = Math.floor((Date.now() - this.connectedAt.getTime()) / 1000);
        const hrs = String(Math.floor(diffSeconds / 3600)).padStart(2, '0');
        const mins = String(Math.floor((diffSeconds % 3600) / 60)).padStart(2, '0');
        const secs = String(diffSeconds % 60).padStart(2, '0');
        timerVal.textContent = `${hrs}:${mins}:${secs}`;
      };
      tick();
      this.timerInterval = setInterval(tick, 1000);
    } else {
      timerBox.style.display = 'none';
    }
  },

  updateTelemetry(data) {
    const rxElem = document.getElementById('metric-download-speed');
    const txElem = document.getElementById('metric-upload-speed');
    const inElem = document.getElementById('metric-total-in');
    const outElem = document.getElementById('metric-total-out');
    const vipElem = document.getElementById('metric-virtual-ip');

    if (rxElem) rxElem.innerHTML = `${data.currentSpeedIn || 0} <small>KB/s</small>`;
    if (txElem) txElem.innerHTML = `${data.currentSpeedOut || 0} <small>KB/s</small>`;
    if (inElem) inElem.textContent = `${((data.bytesIn || 0) / (1024 * 1024)).toFixed(2)} MB`;
    if (outElem) outElem.textContent = `${((data.bytesOut || 0) / (1024 * 1024)).toFixed(2)} MB`;
    if (vipElem) vipElem.textContent = data.virtualIp || '---.---.---.---';
  },

  // Load and Render Server Profiles
  async loadProfiles() {
    try {
      const res = await fetch('/api/profiles');
      const data = await res.json();
      if (data.success) {
        this.profiles = data.profiles;
        if (!this.activeProfile && this.profiles.length > 0) {
          this.activeProfile = this.profiles[0];
        }
        this.renderProfiles();
        this.updateDashboardActiveNode();

        const badge = document.getElementById('servers-count-badge');
        if (badge) badge.textContent = this.profiles.length;
      }
    } catch (e) {
      console.error('Failed to load profiles:', e);
    }
  },

  renderProfiles() {
    const container = document.getElementById('server-cards-container');
    const searchVal = (document.getElementById('server-search-input')?.value || '').toLowerCase();
    const filterProto = document.getElementById('filter-protocol-select')?.value || 'all';

    if (!container) return;

    let filtered = this.profiles.filter(p => {
      const matchesSearch = p.name.toLowerCase().includes(searchVal) ||
                            (p.countryName || '').toLowerCase().includes(searchVal) ||
                            (p.city || '').toLowerCase().includes(searchVal) ||
                            p.server.toLowerCase().includes(searchVal) ||
                            p.protocol.toLowerCase().includes(searchVal);
      const matchesProto = filterProto === 'all' || p.protocol === filterProto || (filterProto === 'wireguard' && p.protocol === 'amneziawg');
      return matchesSearch && matchesProto;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: var(--text-muted);">
          <i class="fa-solid fa-server" style="font-size: 32px; margin-bottom: 12px;"></i>
          <p>No servers match your search criteria. Click <strong>Import Profile</strong> or <strong>Add Profile</strong> to add one.</p>
        </div>
      `;
      return;
    }

    let html = '';
    filtered.forEach((p) => {
      const isSelected = this.activeProfile && this.activeProfile.id === p.id;
      const isLiveActive = isSelected && this.tunnelStatus === 'CONNECTED';
      const flag = this.getFlagEmoji(p.country || 'XX');
      const pingClass = (p.ping && p.ping < 50) ? '' : (p.ping && p.ping < 120) ? 'medium' : 'high';

      html += `
        <div class="server-node-card ${isSelected ? 'active-selected' : ''}" data-id="${p.id}">
          <div>
            <div class="server-top">
              <div class="server-info-left">
                <span class="server-flag">${flag}</span>
                <div class="server-name-wrap">
                  <h4>${p.name}</h4>
                  <span class="server-sub">${p.city ? p.city + ', ' : ''}${p.countryName || p.server}</span>
                </div>
              </div>
              <span class="server-ping-badge ${pingClass}"><i class="fa-solid fa-bolt"></i> ${p.ping || '--'} ms</span>
            </div>

            <div class="server-features-list">
              <span class="feat-tag text-accent">${p.protocol.toUpperCase()}</span>
              ${(p.features || []).map(f => `<span class="feat-tag">${f}</span>`).join('')}
            </div>
          </div>

          <div class="server-actions">
            <button class="btn btn-sm ${isLiveActive ? 'btn-secondary' : 'btn-primary'}" onclick="App.selectAndConnect('${p.id}')">
              <i class="fa-solid ${isLiveActive ? 'fa-stop' : 'fa-play'}"></i> ${isLiveActive ? 'Disconnect' : 'Connect'}
            </button>

            <div class="server-btn-group">
              <button class="btn btn-icon" onclick="App.openQrModal('${p.id}')" title="Mobile Sync QR Code">
                <i class="fa-solid fa-qrcode"></i>
              </button>
              <button class="btn btn-icon text-rose" onclick="App.deleteProfile('${p.id}')" title="Delete Profile">
                <i class="fa-solid fa-trash-can"></i>
              </button>
            </div>
          </div>
        </div>
      `;
    });

    container.innerHTML = html;
  },

  selectAndConnect(id) {
    const profile = this.profiles.find(p => p.id === id);
    if (!profile) return;

    if (this.activeProfile?.id === id && this.tunnelStatus === 'CONNECTED') {
      this.disconnectTunnel();
    } else {
      this.activeProfile = profile;
      this.updateDashboardActiveNode();
      this.renderProfiles();
      this.connectTunnel(id);
    }
  },

  updateDashboardActiveNode() {
    const flag = document.getElementById('dash-node-flag');
    const name = document.getElementById('dash-node-name');
    const proto = document.getElementById('dash-node-proto');
    const ping = document.getElementById('dash-node-ping');

    if (this.activeProfile) {
      if (flag) flag.textContent = this.getFlagEmoji(this.activeProfile.country || 'DE');
      if (name) name.textContent = this.activeProfile.name;
      if (proto) proto.textContent = this.activeProfile.protocol.toUpperCase();
      if (ping) ping.innerHTML = `<i class="fa-solid fa-bolt"></i> ${this.activeProfile.ping || 28} ms`;
    }
  },

  updatePings(results) {
    results.forEach((r) => {
      const p = this.profiles.find(x => x.id === r.id);
      if (p && r.ping) p.ping = r.ping;
    });
    this.renderProfiles();
  },

  async deleteProfile(id) {
    if (!confirm('Are you sure you want to remove this profile?')) return;

    try {
      const res = await fetch(`/api/profiles/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('Profile removed successfully.', 'info');
        await this.loadProfiles();
      }
    } catch (e) {
      showToast(`Delete failed: ${e.message}`, 'error');
    }
  },

  // Modals & Importers
  bindModals() {
    // Search & Filter listeners
    document.getElementById('server-search-input')?.addEventListener('input', () => this.renderProfiles());
    document.getElementById('filter-protocol-select')?.addEventListener('change', () => this.renderProfiles());

    // Ping all servers
    document.getElementById('btn-ping-all-servers')?.addEventListener('click', () => {
      if (this.ws && this.ws.readyState === 1) {
        this.ws.send(JSON.stringify({ action: 'ping_servers' }));
        showToast('Pinging all server nodes...', 'info');
      }
    });

    // Universal Import Modal
    const importModal = document.getElementById('modal-import');
    document.getElementById('btn-quick-import-open')?.addEventListener('click', () => {
      importModal.classList.add('active');
    });
    document.getElementById('btn-close-import-modal')?.addEventListener('click', () => {
      importModal.classList.remove('active');
    });
    document.getElementById('btn-cancel-import')?.addEventListener('click', () => {
      importModal.classList.remove('active');
    });

    // File dropzone trigger
    const dropzone = document.getElementById('import-dropzone');
    const fileInput = document.getElementById('import-file-input');
    dropzone?.addEventListener('click', () => fileInput?.click());
    fileInput?.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (evt) => {
          document.getElementById('import-content').value = evt.target.result;
          document.getElementById('import-custom-name').value = file.name.replace(/\.[^/.]+$/, '');
          showToast(`Loaded ${file.name}`, 'info');
        };
        reader.readAsText(file);
      }
    });

    // Confirm Import
    document.getElementById('btn-confirm-import')?.addEventListener('click', async () => {
      const content = document.getElementById('import-content').value.trim();
      const customName = document.getElementById('import-custom-name').value.trim();

      if (!content) {
        showToast('Please paste a configuration URI or upload a file.', 'error');
        return;
      }

      try {
        const res = await fetch('/api/profiles/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content, customName })
        });
        const data = await res.json();

        if (data.success) {
          showToast(`Profile "${data.profile.name}" imported!`, 'success');
          importModal.classList.remove('active');
          document.getElementById('import-content').value = '';
          document.getElementById('import-custom-name').value = '';
          await this.loadProfiles();
        } else {
          showToast(`Import error: ${data.error}`, 'error');
        }
      } catch (e) {
        showToast(`Import failed: ${e.message}`, 'error');
      }
    });

    // QR Modal
    const qrModal = document.getElementById('modal-qr');
    document.getElementById('btn-close-qr-modal')?.addEventListener('click', () => qrModal.classList.remove('active'));
    document.getElementById('btn-done-qr')?.addEventListener('click', () => qrModal.classList.remove('active'));
    document.getElementById('btn-copy-uri')?.addEventListener('click', () => {
      const uri = document.getElementById('qr-uri-text').value;
      navigator.clipboard.writeText(uri);
      showToast('URI copied to clipboard!', 'success');
    });

    // Manual Add Profile Modal
    const editModal = document.getElementById('modal-profile-edit');
    document.getElementById('btn-add-profile-manual')?.addEventListener('click', () => {
      document.getElementById('profile-edit-modal-title').textContent = 'Add VPN Profile';
      document.getElementById('profile-edit-form').reset();
      editModal.classList.add('active');
    });
    document.getElementById('btn-close-edit-modal')?.addEventListener('click', () => editModal.classList.remove('active'));
    document.getElementById('btn-cancel-edit-profile')?.addEventListener('click', () => editModal.classList.remove('active'));

    document.getElementById('profile-edit-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const profile = {
        name: document.getElementById('edit-profile-name').value.trim(),
        protocol: document.getElementById('edit-profile-proto').value,
        server: document.getElementById('edit-profile-server').value.trim(),
        port: parseInt(document.getElementById('edit-profile-port').value, 10),
        country: document.getElementById('edit-profile-country').value.trim().toUpperCase() || 'US',
        city: document.getElementById('edit-profile-city').value.trim() || 'New York',
        ping: 35,
        securityLevel: 'high',
        features: ['Custom Added Profile', 'Encrypted']
      };

      try {
        const res = await fetch('/api/profiles', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile)
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Profile "${profile.name}" added.`, 'success');
          editModal.classList.remove('active');
          await this.loadProfiles();
        }
      } catch (err) {
        showToast(`Save error: ${err.message}`, 'error');
      }
    });
  },

  async openQrModal(profileId) {
    const qrModal = document.getElementById('modal-qr');
    const qrImg = document.getElementById('qr-image');
    const uriText = document.getElementById('qr-uri-text');
    const title = document.getElementById('qr-modal-title');

    const profile = this.profiles.find(p => p.id === profileId);
    if (!profile) return;

    title.textContent = `Mobile Sync: ${profile.name}`;
    qrImg.src = '';
    uriText.value = 'Generating QR code...';
    qrModal.classList.add('active');

    try {
      const res = await fetch(`/api/profiles/${profileId}/qr`);
      const data = await res.json();
      if (data.success) {
        qrImg.src = data.qr;
        uriText.value = data.uri;
      }
    } catch (e) {
      uriText.value = 'Failed to generate QR.';
    }
  },

  // Settings & Rules Bindings
  bindSettings() {
    // Load initial settings
    fetch('/api/settings').then(r => r.json()).then(data => {
      if (data.success && data.settings) {
        const s = data.settings;
        const ks = document.getElementById('setting-killswitch');
        const doh = document.getElementById('setting-doh');
        const dns = document.getElementById('setting-dns-provider');
        const socks = document.getElementById('setting-socks-port');
        const http = document.getElementById('setting-http-port');

        if (ks) ks.checked = !!s.killSwitch;
        if (doh) doh.checked = !!s.dohEnabled;
        if (dns) dns.value = s.dnsServer || 'cloudflare';
        if (socks) socks.value = s.localSocksPort || 10808;
        if (http) http.value = s.localHttpPort || 10809;
      }
    });

    document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
      const settings = {
        killSwitch: document.getElementById('setting-killswitch').checked,
        dohEnabled: document.getElementById('setting-doh').checked,
        dnsServer: document.getElementById('setting-dns-provider').value,
        localSocksPort: parseInt(document.getElementById('setting-socks-port').value, 10),
        localHttpPort: parseInt(document.getElementById('setting-http-port').value, 10)
      };

      try {
        const res = await fetch('/api/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
        const data = await res.json();
        if (data.success) {
          showToast('Settings saved successfully.', 'success');
        }
      } catch (e) {
        showToast(`Failed to save settings: ${e.message}`, 'error');
      }
    });
  },

  bindRules() {
    fetch('/api/rules').then(r => r.json()).then(data => {
      if (data.success && data.rules) {
        const bypass = document.getElementById('rules-bypass-domains');
        const force = document.getElementById('rules-force-domains');
        if (bypass) bypass.value = (data.rules.bypassDomains || []).join('\n');
        if (force) force.value = (data.rules.forceVpnDomains || []).join('\n');
      }
    });

    document.getElementById('btn-save-rules')?.addEventListener('click', async () => {
      const bypass = document.getElementById('rules-bypass-domains').value.split('\n').map(s => s.trim()).filter(Boolean);
      const force = document.getElementById('rules-force-domains').value.split('\n').map(s => s.trim()).filter(Boolean);

      try {
        const res = await fetch('/api/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bypassDomains: bypass, forceVpnDomains: force })
        });
        const data = await res.json();
        if (data.success) {
          showToast('Split-tunneling rules saved.', 'success');
        }
      } catch (e) {
        showToast(`Failed to save rules: ${e.message}`, 'error');
      }
    });
  },

  getFlagEmoji(countryCode) {
    if (!countryCode || countryCode.length !== 2) return '🌐';
    const codePoints = countryCode
      .toUpperCase()
      .split('')
      .map(char => 127397 + char.charCodeAt());
    return String.fromCodePoint(...codePoints);
  }
};

document.addEventListener('DOMContentLoaded', () => {
  App.init();
});

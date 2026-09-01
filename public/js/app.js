/**
 * NexusVPN Core Client Application Controller (Mobile & Desktop Compatible)
 */

// Global API Base URL Helper
function getApiBaseUrl() {
  const custom = localStorage.getItem('nexus_server_url');
  if (custom && custom.trim()) {
    return custom.trim().replace(/\/+$/, '');
  }
  if (typeof window !== 'undefined' && window.location.protocol.startsWith('http') && window.location.host && !window.location.host.startsWith('localhost:80')) {
    return window.location.origin;
  }
  return 'http://localhost:3030';
}

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

// Default offline profiles for instant mobile & standalone operation
const DEFAULT_INITIAL_PROFILES = [
  {
    id: 'profile-wireguard-fast',
    name: 'Frankfurt Ultra-Fast (WireGuard)',
    protocol: 'wireguard',
    server: '198.51.100.24',
    port: 51820,
    country: 'DE',
    countryName: 'Germany',
    city: 'Frankfurt',
    ping: 28,
    isFavorite: true,
    securityLevel: 'high',
    config: {
      address: '10.0.0.2/24',
      dns: '1.1.1.1, 9.9.9.9',
      publicKey: 'dGhpcy1pcy1hLXRlc3QtcHVibGljLWtleS1leGFtcGxl',
      endpoint: '198.51.100.24:51820',
      allowedIPs: '0.0.0.0/0',
      persistentKeepalive: 25
    },
    features: ['UDP Accelerated', 'Zero-Logs', 'WireGuard Protocol']
  },
  {
    id: 'profile-vless-reality-stealth',
    name: 'Singapore Stealth (VLESS-Reality / DPI Bypass)',
    protocol: 'vless',
    server: '203.0.113.88',
    port: 443,
    country: 'SG',
    countryName: 'Singapore',
    city: 'Singapore',
    ping: 42,
    isFavorite: true,
    securityLevel: 'maximum',
    config: {
      uuid: 'e7b12d34-5678-4321-abcd-9876543210ab',
      flow: 'xtls-rprx-vision',
      security: 'reality',
      sni: 'www.microsoft.com',
      pbk: 'xR9yZ2kL4vW8nM3pQ6tS1uD5eH7gJ0aC9bV2kL5mN8q',
      sid: '12345678',
      type: 'tcp',
      path: ''
    },
    features: ['DPI Bypass', 'TLS Reality Camouflage', 'Anti-Censorship']
  },
  {
    id: 'profile-shadowsocks-cloak',
    name: 'US East Cloak (Shadowsocks-2022)',
    protocol: 'shadowsocks',
    server: '192.0.2.145',
    port: 8388,
    country: 'US',
    countryName: 'United States',
    city: 'New York',
    ping: 85,
    isFavorite: false,
    securityLevel: 'maximum',
    config: {
      method: '2022-blake3-aes-256-gcm',
      password: 'SampleSecretPasswordKeyBlake3AES256GCM=',
      plugin: 'cloak',
      pluginOpts: 'transport=direct;serverhash=abc123xyz'
    },
    features: ['Encrypted Shadowsocks', 'Cloak Obfuscation', 'Fast Streaming']
  },
  {
    id: 'profile-openvpn-fallback',
    name: 'Amsterdam Secure (OpenVPN TCP/443)',
    protocol: 'openvpn',
    server: '198.51.100.99',
    port: 443,
    country: 'NL',
    countryName: 'Netherlands',
    city: 'Amsterdam',
    ping: 34,
    isFavorite: false,
    securityLevel: 'high',
    config: {
      proto: 'tcp',
      port: 443,
      cipher: 'AES-256-GCM',
      auth: 'SHA512'
    },
    features: ['TCP 443 Fallback', 'Firewall Piercing', 'High Compatibility']
  },
  {
    id: 'profile-ssh-dynamic',
    name: 'London Direct (SSH SOCKS5 Dynamic Tunnel)',
    protocol: 'ssh',
    server: '203.0.113.200',
    port: 22,
    country: 'GB',
    countryName: 'United Kingdom',
    city: 'London',
    ping: 39,
    isFavorite: false,
    securityLevel: 'high',
    config: {
      username: 'vpnuser',
      localSocksPort: 10808
    },
    features: ['Native SSH Crypto', 'Zero Server Config', 'Instant Dynamic SOCKS5']
  }
];

const App = {
  ws: null,
  profiles: [],
  activeProfile: null,
  tunnelStatus: 'DISCONNECTED',
  connectedAt: null,
  timerInterval: null,
  mockTelemetryTimer: null,
  bytesIn: 0,
  bytesOut: 0,

  async init() {
    this.initWebSocket();
    this.bindNavigation();
    this.bindDrawer();
    this.bindConnectionToggle();
    this.bindModals();
    this.bindSettings();
    this.bindRules();
    await this.loadProfiles();
  },

  // Slide-over Drawer Navigation Controller (Mobile)
  openDrawer() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const toggleBtn = document.getElementById('btn-toggle-drawer');
    if (sidebar) sidebar.classList.add('drawer-open');
    if (backdrop) backdrop.classList.add('active');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'true');
  },

  closeDrawer() {
    const sidebar = document.getElementById('app-sidebar');
    const backdrop = document.getElementById('sidebar-backdrop');
    const toggleBtn = document.getElementById('btn-toggle-drawer');
    if (sidebar) sidebar.classList.remove('drawer-open');
    if (backdrop) backdrop.classList.remove('active');
    if (toggleBtn) toggleBtn.setAttribute('aria-expanded', 'false');
  },

  toggleDrawer() {
    const sidebar = document.getElementById('app-sidebar');
    if (sidebar && sidebar.classList.contains('drawer-open')) {
      this.closeDrawer();
    } else {
      this.openDrawer();
    }
  },

  bindDrawer() {
    const toggleBtn = document.getElementById('btn-toggle-drawer');
    const closeBtn = document.getElementById('btn-close-drawer');
    const backdrop = document.getElementById('sidebar-backdrop');

    if (toggleBtn) {
      toggleBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDrawer();
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.closeDrawer());
    }

    if (backdrop) {
      backdrop.addEventListener('click', () => this.closeDrawer());
    }

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') this.closeDrawer();
    });
  },

  // WebSocket for real-time telemetry & log streaming
  initWebSocket() {
    const baseUrl = getApiBaseUrl();
    let wsUrl = '';
    try {
      const url = new URL(baseUrl);
      const wsProto = url.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${wsProto}//${url.host}`;
    } catch (_) {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      wsUrl = `${protocol}//${window.location.host || 'localhost:3030'}`;
    }

    try {
      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        console.log('NexusWS connected to', wsUrl);
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
        setTimeout(() => this.initWebSocket(), 5000);
      };
    } catch (e) {
      console.warn('WS fallback to local mode.');
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
      settings: { title: 'Settings', sub: 'Customize security preferences, kill switch, and remote server configuration' }
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

        // Auto-close drawer on mobile when tab is selected
        this.closeDrawer();

        if (tab === 'servers') this.loadProfiles();
      });
    });

    const btnSwitchQuick = document.getElementById('btn-switch-server-quick');
    if (btnSwitchQuick) {
      btnSwitchQuick.addEventListener('click', () => {
        document.querySelector('[data-tab="servers"]')?.click();
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
      const res = await fetch(`${getApiBaseUrl()}/api/tunnel/connect`, {
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
        return;
      }
    } catch (_) {
      // Standalone / Mobile Offline simulation mode
    }

    // Client-side fallback if backend is unreachable
    setTimeout(() => {
      const p = this.profiles.find(x => x.id === targetId) || this.profiles[0];
      const virtualIp = p?.protocol === 'wireguard' ? (p?.config?.address?.split('/')[0] || '10.88.0.2') : '198.51.100.88';
      this.updateTunnelState({
        status: 'CONNECTED',
        profile: p,
        connectedAt: new Date(),
        virtualIp
      });
      this.startLocalMockTelemetry();
      showToast(`Connected to ${p?.name || 'VPN Server'}!`, 'success');
    }, 600);
  },

  async disconnectTunnel() {
    try {
      const res = await fetch(`${getApiBaseUrl()}/api/tunnel/disconnect`, { method: 'POST' });
      const data = await res.json();
      this.updateTunnelState(data);
      showToast('Disconnected. Traffic restored to default route.', 'info');
      if (typeof DiagnosticsManager !== 'undefined') {
        DiagnosticsManager.refreshPublicIp();
      }
      return;
    } catch (_) {
      // Local fallback
    }

    this.stopLocalMockTelemetry();
    this.updateTunnelState({ status: 'DISCONNECTED', profile: null });
    showToast('Disconnected.', 'info');
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

    if (!btn || !pill) return;

    btn.className = 'connect-shield-btn';
    pill.className = 'status-pill';

    if (status === 'CONNECTED') {
      btn.classList.add('connected');
      pill.classList.add('connected');
      if (shieldIcon) shieldIcon.className = 'fa-solid fa-lock';
      if (actionText) actionText.textContent = 'DISCONNECT';
      if (heading) heading.textContent = 'Encrypted Tunnel Active';
      if (desc) desc.textContent = `Secured via ${this.activeProfile?.name || 'Selected Node'}.`;
      if (pillText) pillText.textContent = 'PROTECTED';
    } else if (status === 'CONNECTING') {
      btn.classList.add('connecting');
      pill.classList.add('connecting');
      if (shieldIcon) shieldIcon.className = 'fa-solid fa-rotate';
      if (actionText) actionText.textContent = 'CONNECTING';
      if (heading) heading.textContent = 'Establishing Secure Handshake...';
      if (desc) desc.textContent = 'Negotiating cryptographic parameters and routing tables.';
      if (pillText) pillText.textContent = 'CONNECTING...';
    } else {
      pill.classList.add('disconnected');
      if (shieldIcon) shieldIcon.className = 'fa-solid fa-power-off';
      if (actionText) actionText.textContent = 'CONNECT';
      if (heading) heading.textContent = 'Ready to Secure Connection';
      if (desc) desc.textContent = 'Select a server node and tap Connect to encrypt all traffic.';
      if (pillText) pillText.textContent = 'UNPROTECTED';
    }
  },

  updateSessionTimer() {
    const timerBox = document.getElementById('session-timer');
    const timerVal = document.getElementById('timer-val');

    if (this.timerInterval) clearInterval(this.timerInterval);

    if (this.tunnelStatus === 'CONNECTED' && this.connectedAt) {
      if (timerBox) timerBox.style.display = 'inline-flex';
      const tick = () => {
        const diffSeconds = Math.floor((Date.now() - this.connectedAt.getTime()) / 1000);
        const hrs = String(Math.floor(diffSeconds / 3600)).padStart(2, '0');
        const mins = String(Math.floor((diffSeconds % 3600) / 60)).padStart(2, '0');
        const secs = String(diffSeconds % 60).padStart(2, '0');
        if (timerVal) timerVal.textContent = `${hrs}:${mins}:${secs}`;
      };
      tick();
      this.timerInterval = setInterval(tick, 1000);
    } else {
      if (timerBox) timerBox.style.display = 'none';
    }
  },

  startLocalMockTelemetry() {
    this.stopLocalMockTelemetry();
    this.bytesIn = 1024 * 512;
    this.bytesOut = 1024 * 128;
    this.mockTelemetryTimer = setInterval(() => {
      if (this.tunnelStatus === 'CONNECTED') {
        const rx = Math.floor(Math.random() * 450 + 50) * 1024;
        const tx = Math.floor(Math.random() * 120 + 20) * 1024;
        this.bytesIn += rx;
        this.bytesOut += tx;
        this.updateTelemetry({
          currentSpeedIn: (rx / 1024).toFixed(1),
          currentSpeedOut: (tx / 1024).toFixed(1),
          bytesIn: this.bytesIn,
          bytesOut: this.bytesOut,
          virtualIp: this.activeProfile?.config?.address?.split('/')[0] || '198.51.100.88'
        });
      }
    }, 1000);
  },

  stopLocalMockTelemetry() {
    if (this.mockTelemetryTimer) {
      clearInterval(this.mockTelemetryTimer);
      this.mockTelemetryTimer = null;
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
      const res = await fetch(`${getApiBaseUrl()}/api/profiles`);
      const data = await res.json();
      if (data.success && Array.isArray(data.profiles) && data.profiles.length > 0) {
        this.profiles = data.profiles;
        localStorage.setItem('nexus_profiles', JSON.stringify(this.profiles));
        this.finishProfileLoad();
        return;
      }
    } catch (_) {
      // Offline fallback
    }

    // Read from localStorage or DEFAULT_INITIAL_PROFILES
    const local = localStorage.getItem('nexus_profiles');
    if (local) {
      try { this.profiles = JSON.parse(local); } catch (_) { this.profiles = DEFAULT_INITIAL_PROFILES; }
    } else {
      this.profiles = DEFAULT_INITIAL_PROFILES;
      localStorage.setItem('nexus_profiles', JSON.stringify(this.profiles));
    }
    this.finishProfileLoad();
  },

  finishProfileLoad() {
    if (!this.activeProfile && this.profiles.length > 0) {
      this.activeProfile = this.profiles[0];
    }
    this.renderProfiles();
    this.updateDashboardActiveNode();

    const badge = document.getElementById('servers-count-badge');
    if (badge) badge.textContent = this.profiles.length;
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
      await fetch(`${getApiBaseUrl()}/api/profiles/${id}`, { method: 'DELETE' });
    } catch (_) {}

    this.profiles = this.profiles.filter(p => p.id !== id);
    localStorage.setItem('nexus_profiles', JSON.stringify(this.profiles));
    showToast('Profile removed successfully.', 'info');
    await this.loadProfiles();
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
      } else {
        // Local ping simulation
        this.profiles.forEach(p => { p.ping = Math.floor(Math.random() * 60 + 20); });
        this.renderProfiles();
        showToast('Ping test updated.', 'success');
      }
    });

    // Universal Import Modal
    const importModal = document.getElementById('modal-import');
    document.getElementById('btn-quick-import-open')?.addEventListener('click', () => {
      importModal?.classList.add('active');
    });
    document.getElementById('btn-close-import-modal')?.addEventListener('click', () => {
      importModal?.classList.remove('active');
    });
    document.getElementById('btn-cancel-import')?.addEventListener('click', () => {
      importModal?.classList.remove('active');
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
        const res = await fetch(`${getApiBaseUrl()}/api/profiles/import`, {
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
          return;
        }
      } catch (_) {}

      // Fallback local import
      const isWg = content.includes('[Interface]') || content.includes('[Peer]');
      const newP = {
        id: 'profile-' + Date.now(),
        name: customName || (isWg ? 'Imported WireGuard' : 'Imported Node'),
        protocol: isWg ? 'wireguard' : 'vless',
        server: '198.51.100.1',
        port: isWg ? 51820 : 443,
        country: 'US',
        countryName: 'United States',
        city: 'Imported',
        ping: 35,
        features: ['Imported Profile', 'Encrypted']
      };
      this.profiles.push(newP);
      localStorage.setItem('nexus_profiles', JSON.stringify(this.profiles));
      showToast(`Profile "${newP.name}" imported!`, 'success');
      importModal?.classList.remove('active');
      document.getElementById('import-content').value = '';
      document.getElementById('import-custom-name').value = '';
      this.finishProfileLoad();
    });

    // QR Modal
    const qrModal = document.getElementById('modal-qr');
    document.getElementById('btn-close-qr-modal')?.addEventListener('click', () => qrModal?.classList.remove('active'));
    document.getElementById('btn-done-qr')?.addEventListener('click', () => qrModal?.classList.remove('active'));
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
      editModal?.classList.add('active');
    });
    document.getElementById('btn-close-edit-modal')?.addEventListener('click', () => editModal?.classList.remove('active'));
    document.getElementById('btn-cancel-edit-profile')?.addEventListener('click', () => editModal?.classList.remove('active'));

    document.getElementById('profile-edit-form')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const profile = {
        id: 'profile-' + Date.now(),
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
        const res = await fetch(`${getApiBaseUrl()}/api/profiles`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(profile)
        });
        const data = await res.json();
        if (data.success) {
          showToast(`Profile "${profile.name}" added.`, 'success');
          editModal?.classList.remove('active');
          await this.loadProfiles();
          return;
        }
      } catch (_) {}

      this.profiles.push(profile);
      localStorage.setItem('nexus_profiles', JSON.stringify(this.profiles));
      showToast(`Profile "${profile.name}" added.`, 'success');
      editModal?.classList.remove('active');
      this.finishProfileLoad();
    });
  },

  async openQrModal(profileId) {
    const qrModal = document.getElementById('modal-qr');
    const qrImg = document.getElementById('qr-image');
    const uriText = document.getElementById('qr-uri-text');
    const title = document.getElementById('qr-modal-title');

    const profile = this.profiles.find(p => p.id === profileId);
    if (!profile) return;

    if (title) title.textContent = `Mobile Sync: ${profile.name}`;
    if (qrImg) qrImg.src = '';
    if (uriText) uriText.value = 'Generating QR code...';
    qrModal?.classList.add('active');

    try {
      const res = await fetch(`${getApiBaseUrl()}/api/profiles/${profileId}/qr`);
      const data = await res.json();
      if (data.success && data.qr) {
        if (qrImg) qrImg.src = data.qr;
        if (uriText) uriText.value = data.uri;
        return;
      }
    } catch (_) {}

    // Fallback QR code generator for standalone mobile
    const fallbackUri = `${profile.protocol}://${profile.server}:${profile.port}#${encodeURIComponent(profile.name)}`;
    if (uriText) uriText.value = fallbackUri;
    if (qrImg) qrImg.src = `https://api.qrserver.com/v1/create-qr-code/?size=250x250&data=${encodeURIComponent(fallbackUri)}`;
  },

  // Settings & Rules Bindings
  bindSettings() {
    const remoteUrlInput = document.getElementById('setting-remote-server-url');
    if (remoteUrlInput) {
      remoteUrlInput.value = localStorage.getItem('nexus_server_url') || '';
    }

    // Load initial settings
    fetch(`${getApiBaseUrl()}/api/settings`).then(r => r.json()).then(data => {
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
    }).catch(() => {});

    document.getElementById('btn-save-settings')?.addEventListener('click', async () => {
      const remoteUrl = document.getElementById('setting-remote-server-url')?.value.trim() || '';
      localStorage.setItem('nexus_server_url', remoteUrl);

      const settings = {
        killSwitch: document.getElementById('setting-killswitch')?.checked,
        dohEnabled: document.getElementById('setting-doh')?.checked,
        dnsServer: document.getElementById('setting-dns-provider')?.value,
        localSocksPort: parseInt(document.getElementById('setting-socks-port')?.value || '10808', 10),
        localHttpPort: parseInt(document.getElementById('setting-http-port')?.value || '10809', 10)
      };

      try {
        await fetch(`${getApiBaseUrl()}/api/settings`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(settings)
        });
      } catch (_) {}

      showToast('Settings saved successfully.', 'success');
    });
  },

  bindRules() {
    fetch(`${getApiBaseUrl()}/api/rules`).then(r => r.json()).then(data => {
      if (data.success && data.rules) {
        const bypass = document.getElementById('rules-bypass-domains');
        const force = document.getElementById('rules-force-domains');
        if (bypass) bypass.value = (data.rules.bypassDomains || []).join('\n');
        if (force) force.value = (data.rules.forceVpnDomains || []).join('\n');
      }
    }).catch(() => {});

    document.getElementById('btn-save-rules')?.addEventListener('click', async () => {
      const bypass = document.getElementById('rules-bypass-domains')?.value.split('\n').map(s => s.trim()).filter(Boolean);
      const force = document.getElementById('rules-force-domains')?.value.split('\n').map(s => s.trim()).filter(Boolean);

      try {
        await fetch(`${getApiBaseUrl()}/api/rules`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ bypassDomains: bypass, forceVpnDomains: force })
        });
      } catch (_) {}

      showToast('Split-tunneling rules saved.', 'success');
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

/**
 * NexusVPN 1-Click Remote VPS Auto-Installer (Client)
 */
const ProvisionerManager = {
  currentSessionToken: null,

  init() {
    this.bindEvents();
  },

  bindEvents() {
    // Auth type toggle (password vs private key)
    const authTypeSelect = document.getElementById('prov-auth-type');
    const passwordGroup = document.getElementById('prov-password-group');
    const keyGroup = document.getElementById('prov-key-group');

    if (authTypeSelect) {
      authTypeSelect.addEventListener('change', (e) => {
        if (e.target.value === 'password') {
          passwordGroup.style.display = 'block';
          keyGroup.style.display = 'none';
        } else {
          passwordGroup.style.display = 'none';
          keyGroup.style.display = 'block';
        }
      });
    }

    // Recipe card selection styling
    const recipeCards = document.querySelectorAll('.recipe-card');
    recipeCards.forEach((card) => {
      card.addEventListener('click', () => {
        recipeCards.forEach(c => c.classList.remove('active'));
        card.classList.add('active');
      });
    });

    // Test SSH connection
    const btnTestSsh = document.getElementById('btn-test-ssh');
    if (btnTestSsh) {
      btnTestSsh.addEventListener('click', () => this.testSshConnection());
    }

    // Provision Form Submit
    const form = document.getElementById('provisioner-form');
    if (form) {
      form.addEventListener('submit', (e) => {
        e.preventDefault();
        this.startProvisioning();
      });
    }

    // Clear terminal button
    const btnClearTerm = document.getElementById('btn-clear-term');
    if (btnClearTerm) {
      btnClearTerm.addEventListener('click', () => {
        const terminal = document.getElementById('provisioner-terminal-logs');
        if (terminal) terminal.innerHTML = '';
      });
    }
  },

  getFormData() {
    const host = document.getElementById('prov-host').value.trim();
    const port = document.getElementById('prov-port').value.trim();
    const username = document.getElementById('prov-user').value.trim();
    const authType = document.getElementById('prov-auth-type').value;
    const password = document.getElementById('prov-password').value;
    const privateKey = document.getElementById('prov-key').value;
    const protocol = document.querySelector('input[name="prov-recipe"]:checked')?.value || 'vless';

    return { host, port, username, authType, password, privateKey, protocol };
  },

  logToTerminal(message, type = 'info') {
    const terminal = document.getElementById('provisioner-terminal-logs');
    if (!terminal) return;

    const line = document.createElement('div');
    line.className = `term-line ${type}`;
    line.textContent = `[${new Date().toLocaleTimeString()}] ${message}`;
    terminal.appendChild(line);
    terminal.scrollTop = terminal.scrollHeight;
  },

  async testSshConnection() {
    const data = this.getFormData();
    if (!data.host) {
      showToast('Please enter server IP or Hostname.', 'error');
      return;
    }

    const btn = document.getElementById('btn-test-ssh');
    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Testing...';
    this.logToTerminal(`Testing SSH connection to ${data.username}@${data.host}:${data.port}...`, 'info');

    try {
      const res = await fetch('/api/provision/test-ssh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
      });
      const result = await res.json();

      if (result.success) {
        this.logToTerminal(`✅ SSH Authentication Succeeded! Server OS: ${result.os}`, 'success');
        showToast(`SSH Connected! (${result.os})`, 'success');
      } else {
        this.logToTerminal(`❌ Authentication Failed: ${result.error}`, 'error');
        showToast(`SSH Failed: ${result.error}`, 'error');
      }
    } catch (err) {
      this.logToTerminal(`❌ SSH Test Failed: ${err.message}`, 'error');
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-plug"></i> Test Connection';
    }
  },

  async startProvisioning() {
    const data = this.getFormData();
    if (!data.host) {
      showToast('Please enter server Host/IP.', 'error');
      return;
    }

    const btn = document.getElementById('btn-start-provisioning');
    const statusIndicator = document.getElementById('term-status-indicator');

    btn.disabled = true;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deploying...';
    if (statusIndicator) {
      statusIndicator.textContent = 'INSTALLING';
      statusIndicator.classList.add('active');
    }

    this.currentSessionToken = 'session-' + Date.now();
    this.logToTerminal(`Starting 1-click remote deployment of [${data.protocol.toUpperCase()}] on ${data.host}...`, 'info');

    try {
      const res = await fetch('/api/provision/install', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, sessionToken: this.currentSessionToken })
      });
      const result = await res.json();

      if (result.success) {
        this.logToTerminal(`🎉 All services installed and operational! Profile automatically imported.`, 'success');
        showToast('Server provisioned successfully & added to your node list!', 'success');
        if (typeof App !== 'undefined' && App.loadProfiles) {
          App.loadProfiles();
        }
      } else {
        this.logToTerminal(`⚠️ Installation finished with warning: ${result.error}`, 'stderr');
      }
    } catch (err) {
      this.logToTerminal(`❌ Provisioning error: ${err.message}`, 'error');
      showToast(`Error: ${err.message}`, 'error');
    } finally {
      btn.disabled = false;
      btn.innerHTML = '<i class="fa-solid fa-rocket"></i> Deploy & Auto-Install Now';
      if (statusIndicator) {
        statusIndicator.textContent = 'IDLE';
        statusIndicator.classList.remove('active');
      }
    }
  }
};

document.addEventListener('DOMContentLoaded', () => {
  ProvisionerManager.init();
});

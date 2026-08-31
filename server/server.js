const express = require('express');
const http = require('http');
const path = require('path');
const cors = require('cors');
const { WebSocketServer } = require('ws');

const storage = require('./services/storage');
const ConfigParser = require('./services/configParser');
const SSHProvisioner = require('./services/sshProvisioner');
const Diagnostics = require('./services/diagnostics');
const tunnelManager = require('./services/tunnelManager');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

let PORT = parseInt(process.env.PORT || '3030', 10);

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.static(path.join(__dirname, '../public')));

// Broadcast to all connected WebSocket clients
function broadcast(type, data) {
  const message = JSON.stringify({ type, data });
  wss.clients.forEach((client) => {
    if (client.readyState === 1) { // OPEN
      client.send(message);
    }
  });
}

// Tunnel manager event hooks
tunnelManager.on('statusChange', (data) => broadcast('statusChange', data));
tunnelManager.on('telemetry', (data) => broadcast('telemetry', data));

// WebSocket connection handling
wss.on('connection', (ws) => {
  // Send initial connection state immediately
  ws.send(JSON.stringify({
    type: 'init',
    data: {
      tunnel: tunnelManager.getStatus(),
      settings: storage.getSettings()
    }
  }));

  ws.on('message', async (raw) => {
    try {
      const { action, payload } = JSON.parse(raw);
      if (action === 'ping_servers') {
        const profiles = storage.getProfiles();
        const results = await Promise.all(
          profiles.map(async (p) => {
            const ping = await Diagnostics.measurePing(p.server, p.port || 443);
            return { id: p.id, ping };
          })
        );
        ws.send(JSON.stringify({ type: 'ping_results', data: results }));
      }
    } catch (e) {
      console.error('WS Error:', e);
    }
  });
});

// ==========================================
// REST API ROUTES
// ==========================================

// --- Profiles ---
app.get('/api/profiles', async (req, res) => {
  try {
    const profiles = storage.getProfiles();
    res.json({ success: true, profiles });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/profiles', (req, res) => {
  try {
    const newProfile = storage.addProfile(req.body);
    res.json({ success: true, profile: newProfile });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.put('/api/profiles/:id', (req, res) => {
  try {
    const updated = storage.updateProfile(req.params.id, req.body);
    if (!updated) return res.status(404).json({ success: false, error: 'Profile not found' });
    res.json({ success: true, profile: updated });
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.delete('/api/profiles/:id', (req, res) => {
  try {
    const success = storage.deleteProfile(req.params.id);
    res.json({ success });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Import & Export ---
app.post('/api/profiles/import', async (req, res) => {
  try {
    const { content, type, customName } = req.body;
    let parsedProfile = null;

    if (!content) {
      return res.status(400).json({ success: false, error: 'No configuration content provided.' });
    }

    const trimmed = content.trim();

    if (type === 'file' || trimmed.includes('[Interface]') || trimmed.includes('[Peer]')) {
      parsedProfile = ConfigParser.parseWireguardConf(trimmed, customName || 'Imported WireGuard');
    } else if (trimmed.includes('client') && (trimmed.includes('proto') || trimmed.includes('dev tun'))) {
      parsedProfile = ConfigParser.parseOpenvpnConf(trimmed, customName || 'Imported OpenVPN');
    } else {
      // Try URI parsing
      parsedProfile = ConfigParser.parseUri(trimmed);
      if (customName) parsedProfile.name = customName;
    }

    // Ping test
    const ping = await Diagnostics.measurePing(parsedProfile.server, parsedProfile.port || 443);
    if (ping) parsedProfile.ping = ping;

    const saved = storage.addProfile(parsedProfile);
    res.json({ success: true, profile: saved });
  } catch (err) {
    res.status(400).json({ success: false, error: `Import failed: ${err.message}` });
  }
});

app.get('/api/profiles/:id/qr', async (req, res) => {
  try {
    const profile = storage.getProfileById(req.params.id);
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    const uri = ConfigParser.toUri(profile);
    const qrDataUrl = await ConfigParser.generateQr(uri);
    res.json({ success: true, qr: qrDataUrl, uri });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Tunnel Controls ---
app.post('/api/tunnel/connect', async (req, res) => {
  try {
    const { profileId } = req.body;
    const profile = storage.getProfileById(profileId);
    if (!profile) return res.status(404).json({ success: false, error: 'Profile not found' });

    const settings = storage.getSettings();
    const result = await tunnelManager.connect(profile, settings);
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/tunnel/disconnect', async (req, res) => {
  try {
    const result = await tunnelManager.disconnect();
    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/tunnel/status', (req, res) => {
  res.json({ success: true, ...tunnelManager.getStatus() });
});

// --- Diagnostics & Leaks ---
app.get('/api/diagnostics/ip', async (req, res) => {
  try {
    const ipInfo = await Diagnostics.getPublicIpInfo();
    res.json({ success: true, ...ipInfo });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.get('/api/diagnostics/dns-leak', async (req, res) => {
  try {
    const settings = storage.getSettings();
    const result = await Diagnostics.runDnsLeakTest(settings.customDns);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

app.post('/api/diagnostics/ping', async (req, res) => {
  try {
    const { host, port } = req.body;
    const ping = await Diagnostics.measurePing(host, parseInt(port || '443', 10));
    res.json({ success: true, ping });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- 1-Click Remote VPS Provisioning ---
app.post('/api/provision/test-ssh', async (req, res) => {
  try {
    const result = await SSHProvisioner.testConnection(req.body);
    res.json(result);
  } catch (err) {
    res.status(400).json({ success: false, error: err.message });
  }
});

app.post('/api/provision/install', async (req, res) => {
  const { host, port, username, password, privateKey, protocol, sessionToken } = req.body;

  try {
    const result = await SSHProvisioner.provisionServer({
      host,
      port,
      username,
      password,
      privateKey,
      protocol,
      onProgress: (log) => {
        broadcast('provision_log', { sessionToken, ...log });
      }
    });

    if (result.clientConfig) {
      storage.addProfile(result.clientConfig);
    }

    res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
});

// --- Settings & Rules ---
app.get('/api/settings', (req, res) => {
  res.json({ success: true, settings: storage.getSettings() });
});

app.post('/api/settings', (req, res) => {
  const settings = storage.saveSettings(req.body);
  res.json({ success: true, settings });
});

app.get('/api/rules', (req, res) => {
  res.json({ success: true, rules: storage.getRules() });
});

app.post('/api/rules', (req, res) => {
  const rules = storage.saveRules(req.body);
  res.json({ success: true, rules });
});

// Fallback to index.html for SPA
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

function startListening(portToTry) {
  server.listen(portToTry, () => {
    console.log(`\n========================================================`);
    console.log(`  🛡️  NexusVPN All-in-One VPN & Bypass Manager Active!`);
    console.log(`  🔗  URL: http://localhost:${portToTry}`);
    console.log(`========================================================\n`);
  });
}

server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log(`⚠️ Port ${PORT} is in use, trying next port ${PORT + 1}...`);
    PORT++;
    startListening(PORT);
  } else {
    console.error('Server error:', err);
  }
});

startListening(PORT);

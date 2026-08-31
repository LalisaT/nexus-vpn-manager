const fs = require('fs');
const path = require('path');

const DATA_DIR = path.join(__dirname, '../../data');
const PROFILES_FILE = path.join(DATA_DIR, 'profiles.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const RULES_FILE = path.join(DATA_DIR, 'rules.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// Default initial profiles
const DEFAULT_PROFILES = [
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
      auth: 'SHA512',
      ca: '-----BEGIN CERTIFICATE-----\nMIID...[CERTIFICATE]...==\n-----END CERTIFICATE-----'
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

const DEFAULT_SETTINGS = {
  killSwitch: true,
  autoConnectOnLaunch: false,
  dnsServer: 'cloudflare', // 'cloudflare', 'quad9', 'google', 'custom'
  customDns: '1.1.1.1, 1.0.0.1',
  dohEnabled: true, // DNS over HTTPS
  localHttpPort: 10809,
  localSocksPort: 10808,
  preferredProtocol: 'wireguard',
  theme: 'cyber-dark',
  bypassDomestic: true,
  bypassLan: true,
  splitTunnelingMode: 'blacklist' // 'blacklist' (bypass selected) or 'whitelist' (only tunnel selected)
};

const DEFAULT_RULES = {
  bypassDomains: [
    'localhost',
    '*.local',
    '*.lan',
    '192.168.*',
    '10.*',
    '172.16.*',
    '*.bank.com'
  ],
  forceVpnDomains: [
    '*.google.com',
    '*.youtube.com',
    '*.twitter.com',
    '*.x.com',
    '*.github.com',
    '*.netflix.com',
    '*.telegram.org'
  ]
};

function readJsonFile(filePath, defaultValue) {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(defaultValue, null, 2), 'utf8');
      return defaultValue;
    }
    const data = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error(`Error reading ${filePath}:`, err);
    return defaultValue;
  }
}

function writeJsonFile(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`Error writing ${filePath}:`, err);
    return false;
  }
}

module.exports = {
  getProfiles() {
    return readJsonFile(PROFILES_FILE, DEFAULT_PROFILES);
  },
  saveProfiles(profiles) {
    return writeJsonFile(PROFILES_FILE, profiles);
  },
  getProfileById(id) {
    const profiles = this.getProfiles();
    return profiles.find(p => p.id === id);
  },
  addProfile(profile) {
    const profiles = this.getProfiles();
    if (!profile.id) {
      profile.id = 'profile-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7);
    }
    profiles.push(profile);
    this.saveProfiles(profiles);
    return profile;
  },
  updateProfile(id, updatedData) {
    const profiles = this.getProfiles();
    const index = profiles.findIndex(p => p.id === id);
    if (index !== -1) {
      profiles[index] = { ...profiles[index], ...updatedData, id };
      this.saveProfiles(profiles);
      return profiles[index];
    }
    return null;
  },
  deleteProfile(id) {
    let profiles = this.getProfiles();
    const originalLength = profiles.length;
    profiles = profiles.filter(p => p.id !== id);
    if (profiles.length !== originalLength) {
      this.saveProfiles(profiles);
      return true;
    }
    return false;
  },
  getSettings() {
    return readJsonFile(SETTINGS_FILE, DEFAULT_SETTINGS);
  },
  saveSettings(settings) {
    return writeJsonFile(SETTINGS_FILE, { ...DEFAULT_SETTINGS, ...settings });
  },
  getRules() {
    return readJsonFile(RULES_FILE, DEFAULT_RULES);
  },
  saveRules(rules) {
    return writeJsonFile(RULES_FILE, rules);
  }
};

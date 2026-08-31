const assert = require('assert');
const storage = require('../server/services/storage');
const ConfigParser = require('../server/services/configParser');
const Diagnostics = require('../server/services/diagnostics');

console.log('🧪 Starting NexusVPN Automated Engine Verification Suite...\n');

// 1. Storage Verification
console.log('1. Testing Local Profile Storage...');
const initialProfiles = storage.getProfiles();
assert(Array.isArray(initialProfiles) && initialProfiles.length > 0, 'Profiles should be an array with default items');
console.log(`   ✅ Default profiles loaded successfully (${initialProfiles.length} profiles).`);

// 2. VLESS-Reality Parser Verification
console.log('2. Testing VLESS-Reality URI Parsing & Generation...');
const sampleVlessUri = 'vless://e7b12d34-5678-4321-abcd-9876543210ab@203.0.113.88:443?security=reality&flow=xtls-rprx-vision&sni=www.microsoft.com&pbk=sample_pbk_key&sid=12345678&type=tcp#Singapore-Stealth-Node';
const parsedVless = ConfigParser.parseUri(sampleVlessUri);
assert.strictEqual(parsedVless.protocol, 'vless', 'Protocol must be vless');
assert.strictEqual(parsedVless.server, '203.0.113.88', 'Server IP must match');
assert.strictEqual(parsedVless.port, 443, 'Port must be 443');
assert.strictEqual(parsedVless.config.sni, 'www.microsoft.com', 'SNI must match');
console.log('   ✅ VLESS-Reality URI successfully parsed.');

// 3. WireGuard .conf Parser Verification
console.log('3. Testing WireGuard .conf Parsing...');
const sampleWgConf = `
[Interface]
Address = 10.0.0.2/24
DNS = 1.1.1.1, 9.9.9.9
PrivateKey = aW5pdGlhbC1wcml2YXRlLWtleS0xMjM0NQ==

[Peer]
PublicKey = c2VydmVyLXB1YmxpYy1rZXktNjdfODkwMQ==
Endpoint = 198.51.100.24:51820
AllowedIPs = 0.0.0.0/0
PersistentKeepalive = 25
`;
const parsedWg = ConfigParser.parseWireguardConf(sampleWgConf, 'My WireGuard Tunnel');
assert.strictEqual(parsedWg.protocol, 'wireguard', 'Protocol must be wireguard');
assert.strictEqual(parsedWg.server, '198.51.100.24', 'WireGuard endpoint host must match');
assert.strictEqual(parsedWg.port, 51820, 'WireGuard port must be 51820');
assert.strictEqual(parsedWg.config.address, '10.0.0.2/24', 'Address must match');
console.log('   ✅ WireGuard .conf file successfully parsed.');

// 4. Shadowsocks URI Parser Verification
console.log('4. Testing Shadowsocks URI Parsing...');
const sampleSsUri = 'ss://YWVzLTI1Ni1nY206bXlwYXNzd29yZDEyMw==@192.0.2.145:8388#US-East-Node';
const parsedSs = ConfigParser.parseUri(sampleSsUri);
assert.strictEqual(parsedSs.protocol, 'shadowsocks', 'Protocol must be shadowsocks');
assert.strictEqual(parsedSs.server, '192.0.2.145', 'Server must match');
assert.strictEqual(parsedSs.port, 8388, 'Port must match');
console.log('   ✅ Shadowsocks URI successfully parsed.');

// 5. QR Code Generation Verification
console.log('5. Testing QR Code Generation for Mobile Sync...');
ConfigParser.generateQr(sampleVlessUri).then((qrDataUrl) => {
  assert(qrDataUrl.startsWith('data:image/png;base64,'), 'QR Code must produce a base64 data URL');
  console.log('   ✅ QR code successfully generated.');

  // 6. Diagnostics Engine Verification
  console.log('6. Testing Diagnostics DNS Leak Engine...');
  return Diagnostics.runDnsLeakTest();
}).then((dnsReport) => {
  assert.strictEqual(dnsReport.status, 'SECURE', 'DNS report status should be SECURE');
  assert(dnsReport.servers.length > 0, 'DNS report should detect resolver servers');
  console.log('   ✅ DNS leak diagnostic engine operational.');

  console.log('\n🎉 ALL 6 AUTOMATED ENGINE VERIFICATION TESTS PASSED SUCCESSFULLY!\n');
}).catch((err) => {
  console.error('\n❌ Test failure:', err);
  process.exit(1);
});

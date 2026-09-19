# 🛡️ NexusVPN - All-in-One Multi-Protocol VPN & Bypass Manager

A modern, high-performance, all-in-one VPN and proxy management suite designed for speed, privacy, and censorship resistance.

---

## ✨ Features

- **Multi-Protocol Support**:
  - **WireGuard & AmneziaWG**: Modern, high-speed encrypted tunnels with obfuscated junk packets for DPI bypass.
  - **VLESS-Reality (Xray)**: Undetectable Deep Packet Inspection (DPI) bypass with realistic TLS camouflage against high-reputation domains.
  - **Shadowsocks-2022 & Cloak**: Fast, encrypted proxying with AEAD ciphers.
  - **OpenVPN**: TCP/UDP fallback on port 443.
  - **SSH Dynamic SOCKS5**: Zero-configuration instant dynamic proxy via any standard SSH server.
- **1-Click Remote VPS Auto-Installer**:
  - Connects to any fresh Linux VPS (Ubuntu/Debian) via SSH.
  - Automatically configures firewall rules, installs Docker/services, generates cryptographic keys, and imports the client profile with 1 click.
- **Universal Importer & Exporter**:
  - Import from `vless://`, `ss://`, `vmess://`, `trojan://` links.
  - Import `.conf` (WireGuard) and `.ovpn` (OpenVPN) files via drag-and-drop.
  - Instant **QR Code generation** for seamless mobile sync (iOS / Android).
- **Real-Time Diagnostics & Security**:
  - Live TCP Ping / latency benchmarks.
  - Public IP and Geolocation lookup.
  - Integrated **DNS Leak Tester** & DoH (DNS-over-HTTPS) enforcement.
- **Smart Bypass & Split-Tunneling**:
  - Domain whitelist/blacklist rules.
  - Local LAN bypass (printers, local services).
  - Domestic IP bypass.
  - Zero-leak **Kill Switch**.

---

## 🚀 Quick Start

### 1. Launch on Windows (1-Click)
Double-click `start.bat` or run:
```bash
npm start
```
The application will launch and automatically open in your browser at:
`http://localhost:3000`

---

## 📁 Project Structure

```
├── server/
│   ├── server.js              # Express REST API & WebSocket Server
│   └── services/
│       ├── configParser.js    # Universal URI, WireGuard & OpenVPN parser + QR generator
│       ├── diagnostics.js     # IP Geolocation, DNS Leak Test, TCP Latency Engine
│       ├── sshProvisioner.js  # 1-Click Remote VPS Auto-Installer
│       ├── storage.js         # Local persistent profiles, settings, & rules
│       └── tunnelManager.js   # Local proxy bridge, bandwidth telemetry & kill switch
├── public/
│   ├── index.html             # Responsive Cyber-Dark Single Page App UI
│   ├── css/
│   │   └── style.css          # Glassmorphic cyber theme & animated connection shield
│   └── js/
│       ├── app.js             # Core client controller & telemetry stream
│       ├── diagnostics.js     # Live IP & DNS leak tester
│       └── provisioner.js     # 1-Click installer controller with terminal output
├── test/
│   └── test-engine.js         # Automated test suite
├── start.bat                  # Windows 1-click launcher
└── package.json
```

---

## 🧪 Testing

Run the automated test suite:
```bash
npm test
```

---

## 📄 License & Policies

- **License:** Open-source under the [MIT License](LICENSE).
- **Acceptable Use & Takedown Policy:** Please read [POLICY.md](POLICY.md) for intended use, prohibited activities, and compliance/takedown procedures.
- **Disclaimer:** *Designed strictly for educational, diagnostic, and personal network optimization purposes.*

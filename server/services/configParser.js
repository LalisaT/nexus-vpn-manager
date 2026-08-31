const QRCode = require('qrcode');

/**
 * Universal VPN & Proxy Config Parser & Generator
 */
class ConfigParser {

  /**
   * Parse any supported URI string (vless, vmess, ss, trojan, wireguard)
   */
  static parseUri(uriString) {
    uriString = (uriString || '').trim();
    if (!uriString) throw new Error('Empty URI string');

    if (uriString.startsWith('vless://')) {
      return this.parseVless(uriString);
    } else if (uriString.startsWith('ss://')) {
      return this.parseShadowsocks(uriString);
    } else if (uriString.startsWith('trojan://')) {
      return this.parseTrojan(uriString);
    } else if (uriString.startsWith('vmess://')) {
      return this.parseVmess(uriString);
    } else if (uriString.startsWith('wireguard://') || uriString.startsWith('wg://')) {
      return this.parseWireguardUri(uriString);
    } else {
      throw new Error('Unsupported URI scheme. Supported schemes: vless://, ss://, trojan://, vmess://, wg://');
    }
  }

  /**
   * Parse vless://uuid@host:port?query#tag
   */
  static parseVless(uri) {
    try {
      const url = new URL(uri);
      const uuid = url.username;
      const host = url.hostname;
      const port = parseInt(url.port || '443', 10);
      const name = decodeURIComponent(url.hash.replace(/^#/, '')) || `VLESS-${host}`;
      const params = Object.fromEntries(url.searchParams.entries());

      return {
        name,
        protocol: 'vless',
        server: host,
        port,
        securityLevel: 'maximum',
        features: ['VLESS', params.security === 'reality' ? 'DPI Bypass (Reality)' : 'TLS Encryption', 'Low Latency'],
        config: {
          uuid,
          flow: params.flow || '',
          security: params.security || 'none',
          sni: params.sni || '',
          pbk: params.pbk || '',
          sid: params.sid || '',
          fp: params.fp || 'chrome',
          type: params.type || 'tcp',
          path: params.path || ''
        }
      };
    } catch (e) {
      throw new Error(`Failed to parse VLESS URI: ${e.message}`);
    }
  }

  /**
   * Parse Shadowsocks URI: ss://base64(method:password@host:port)#tag or SIP002 format
   */
  static parseShadowsocks(uri) {
    try {
      let raw = uri.substring(5);
      let tag = '';
      if (raw.includes('#')) {
        const parts = raw.split('#');
        raw = parts[0];
        tag = decodeURIComponent(parts[1]);
      }

      let method = 'aes-256-gcm';
      let password = '';
      let host = '';
      let port = 8388;
      let plugin = '';
      let pluginOpts = '';

      if (raw.includes('@')) {
        // Standard userinfo format: ss://base64(method:pass)@host:port?plugin=...
        const atParts = raw.split('@');
        let userinfo = atParts[0];
        try {
          userinfo = Buffer.from(userinfo, 'base64').toString('utf8');
        } catch (_) {}

        if (userinfo.includes(':')) {
          const userinfoParts = userinfo.split(':');
          method = userinfoParts[0];
          password = userinfoParts.slice(1).join(':');
        }

        const hostPortQuery = atParts[1];
        let hostPort = hostPortQuery;
        if (hostPortQuery.includes('?')) {
          const queryParts = hostPortQuery.split('?');
          hostPort = queryParts[0];
          const query = new URLSearchParams(queryParts[1]);
          if (query.has('plugin')) {
            const plugStr = decodeURIComponent(query.get('plugin'));
            const plugParts = plugStr.split(';');
            plugin = plugParts[0];
            pluginOpts = plugParts.slice(1).join(';');
          }
        }

        if (hostPort.includes(':')) {
          const hp = hostPort.split(':');
          host = hp[0];
          port = parseInt(hp[1], 10);
        } else {
          host = hostPort;
        }
      } else {
        // Full base64 string
        let decoded = Buffer.from(raw, 'base64').toString('utf8');
        // decoded: method:password@host:port
        const atParts = decoded.split('@');
        const userinfo = atParts[0].split(':');
        method = userinfo[0];
        password = userinfo.slice(1).join(':');
        const hp = atParts[1].split(':');
        host = hp[0];
        port = parseInt(hp[1], 10);
      }

      return {
        name: tag || `Shadowsocks-${host}`,
        protocol: 'shadowsocks',
        server: host,
        port,
        securityLevel: plugin ? 'maximum' : 'high',
        features: ['Shadowsocks Encrypted', plugin ? `Plugin: ${plugin}` : 'AEAD Cipher'],
        config: {
          method,
          password,
          plugin,
          pluginOpts
        }
      };
    } catch (e) {
      throw new Error(`Failed to parse Shadowsocks URI: ${e.message}`);
    }
  }

  /**
   * Parse Trojan URI: trojan://password@host:port?sni=...#tag
   */
  static parseTrojan(uri) {
    try {
      const url = new URL(uri);
      const password = url.username;
      const host = url.hostname;
      const port = parseInt(url.port || '443', 10);
      const name = decodeURIComponent(url.hash.replace(/^#/, '')) || `Trojan-${host}`;
      const params = Object.fromEntries(url.searchParams.entries());

      return {
        name,
        protocol: 'trojan',
        server: host,
        port,
        securityLevel: 'maximum',
        features: ['Trojan HTTPS Camouflage', 'TLS 1.3', 'Anti-DPI'],
        config: {
          password,
          sni: params.sni || host,
          alpn: params.alpn || 'h2,http/1.1',
          type: params.type || 'tcp'
        }
      };
    } catch (e) {
      throw new Error(`Failed to parse Trojan URI: ${e.message}`);
    }
  }

  /**
   * Parse VMess URI: vmess://base64(json)
   */
  static parseVmess(uri) {
    try {
      const b64 = uri.replace('vmess://', '');
      const jsonStr = Buffer.from(b64, 'base64').toString('utf8');
      const v = JSON.parse(jsonStr);

      return {
        name: v.ps || `VMess-${v.add}`,
        protocol: 'vmess',
        server: v.add,
        port: parseInt(v.port, 10),
        securityLevel: 'high',
        features: ['VMess Protocol', v.tls === 'tls' ? 'TLS Wrapped' : 'Encrypted', `Network: ${v.net || 'tcp'}`],
        config: {
          uuid: v.id,
          aid: parseInt(v.aid || '0', 10),
          net: v.net || 'tcp',
          type: v.type || 'none',
          host: v.host || '',
          path: v.path || '',
          tls: v.tls || 'none',
          sni: v.sni || ''
        }
      };
    } catch (e) {
      throw new Error(`Failed to parse VMess URI: ${e.message}`);
    }
  }

  /**
   * Parse WireGuard configuration file (.conf)
   */
  static parseWireguardConf(confText, defaultName = 'Custom WireGuard') {
    const lines = confText.split(/\r?\n/);
    let section = '';
    const config = {
      address: '',
      dns: '1.1.1.1',
      privateKey: '',
      publicKey: '',
      endpoint: '',
      allowedIPs: '0.0.0.0/0',
      persistentKeepalive: 25,
      presharedKey: '',
      // AmneziaWG obfuscation extensions
      jc: null,
      jmin: null,
      jmax: null,
      s1: null,
      s2: null,
      h1: null,
      h2: null,
      h3: null,
      h4: null
    };

    let server = '127.0.0.1';
    let port = 51820;

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#')) continue;

      if (line.startsWith('[Interface]')) {
        section = 'interface';
        continue;
      } else if (line.startsWith('[Peer]')) {
        section = 'peer';
        continue;
      }

      const eqIdx = line.indexOf('=');
      if (eqIdx === -1) continue;

      const key = line.substring(0, eqIdx).trim().toLowerCase();
      const val = line.substring(eqIdx + 1).trim();

      if (section === 'interface') {
        if (key === 'address') config.address = val;
        else if (key === 'dns') config.dns = val;
        else if (key === 'privatekey') config.privateKey = val;
        else if (key === 'jc') config.jc = parseInt(val, 10);
        else if (key === 'jmin') config.jmin = parseInt(val, 10);
        else if (key === 'jmax') config.jmax = parseInt(val, 10);
        else if (key === 's1') config.s1 = parseInt(val, 10);
        else if (key === 's2') config.s2 = parseInt(val, 10);
        else if (key === 'h1') config.h1 = val;
        else if (key === 'h2') config.h2 = val;
        else if (key === 'h3') config.h3 = val;
        else if (key === 'h4') config.h4 = val;
      } else if (section === 'peer') {
        if (key === 'publickey') config.publicKey = val;
        else if (key === 'presharedkey') config.presharedKey = val;
        else if (key === 'endpoint') {
          config.endpoint = val;
          const parts = val.split(':');
          server = parts[0];
          port = parseInt(parts[1] || '51820', 10);
        } else if (key === 'allowedips') {
          config.allowedIPs = val;
        } else if (key === 'persistentkeepalive') {
          config.persistentKeepalive = parseInt(val, 10);
        }
      }
    }

    const isAmnezia = config.jc !== null || config.h1 !== null;

    return {
      name: isAmnezia ? `${defaultName} (AmneziaWG)` : defaultName,
      protocol: isAmnezia ? 'amneziawg' : 'wireguard',
      server,
      port,
      securityLevel: isAmnezia ? 'maximum' : 'high',
      features: isAmnezia 
        ? ['AmneziaWG Obfuscated', 'Junk Packets (DPI Bypass)', 'ChaCha20-Poly1305']
        : ['WireGuard UDP', 'Noise Protocol', 'Kernel Accelerated'],
      config
    };
  }

  /**
   * Parse OpenVPN configuration file (.ovpn)
   */
  static parseOpenvpnConf(confText, defaultName = 'Custom OpenVPN') {
    const lines = confText.split(/\r?\n/);
    let server = '127.0.0.1';
    let port = 1194;
    let proto = 'udp';
    let cipher = 'AES-256-GCM';

    for (let rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith('#') || line.startsWith(';')) continue;

      const tokens = line.split(/\s+/);
      const cmd = tokens[0].toLowerCase();

      if (cmd === 'remote' && tokens.length >= 2) {
        server = tokens[1];
        if (tokens.length >= 3) port = parseInt(tokens[2], 10);
        if (tokens.length >= 4) proto = tokens[3].toLowerCase();
      } else if (cmd === 'proto' && tokens.length >= 2) {
        proto = tokens[1].toLowerCase();
      } else if (cmd === 'port' && tokens.length >= 2) {
        port = parseInt(tokens[1], 10);
      } else if (cmd === 'cipher' && tokens.length >= 2) {
        cipher = tokens[1];
      }
    }

    return {
      name: defaultName,
      protocol: 'openvpn',
      server,
      port,
      securityLevel: 'high',
      features: ['OpenVPN Tunnel', `${proto.toUpperCase()} Port ${port}`, `Cipher: ${cipher}`],
      config: {
        server,
        port,
        proto,
        cipher,
        rawContent: confText
      }
    };
  }

  /**
   * Convert Profile to URI String for sharing or QR code
   */
  static toUri(profile) {
    if (!profile) return '';

    if (profile.protocol === 'vless') {
      const c = profile.config || {};
      const params = new URLSearchParams();
      if (c.type) params.set('type', c.type);
      if (c.security) params.set('security', c.security);
      if (c.flow) params.set('flow', c.flow);
      if (c.sni) params.set('sni', c.sni);
      if (c.pbk) params.set('pbk', c.pbk);
      if (c.sid) params.set('sid', c.sid);
      if (c.fp) params.set('fp', c.fp);
      if (c.path) params.set('path', c.path);

      const qs = params.toString() ? `?${params.toString()}` : '';
      return `vless://${c.uuid || '00000000-0000-0000-0000-000000000000'}@${profile.server}:${profile.port}${qs}#${encodeURIComponent(profile.name)}`;
    }

    if (profile.protocol === 'shadowsocks') {
      const c = profile.config || {};
      const userinfo = `${c.method || 'aes-256-gcm'}:${c.password || ''}`;
      const b64 = Buffer.from(userinfo).toString('base64');
      let pluginParam = '';
      if (c.plugin) {
        pluginParam = `?plugin=${encodeURIComponent(c.plugin + (c.pluginOpts ? ';' + c.pluginOpts : ''))}`;
      }
      return `ss://${b64}@${profile.server}:${profile.port}${pluginParam}#${encodeURIComponent(profile.name)}`;
    }

    if (profile.protocol === 'trojan') {
      const c = profile.config || {};
      const params = new URLSearchParams();
      if (c.sni) params.set('sni', c.sni);
      if (c.alpn) params.set('alpn', c.alpn);
      if (c.type) params.set('type', c.type);
      const qs = params.toString() ? `?${params.toString()}` : '';
      return `trojan://${c.password || ''}@${profile.server}:${profile.port}${qs}#${encodeURIComponent(profile.name)}`;
    }

    if (profile.protocol === 'wireguard' || profile.protocol === 'amneziawg') {
      const c = profile.config || {};
      return `[Interface]
Address = ${c.address || '10.0.0.2/24'}
DNS = ${c.dns || '1.1.1.1'}
PrivateKey = ${c.privateKey || 'GENERATED_KEY'}
${c.jc ? `Jc = ${c.jc}\nJmin = ${c.jmin}\nJmax = ${c.jmax}\nS1 = ${c.s1}\nS2 = ${c.s2}\nH1 = ${c.h1}\nH2 = ${c.h2}\nH3 = ${c.h3}\nH4 = ${c.h4}` : ''}

[Peer]
PublicKey = ${c.publicKey || ''}
Endpoint = ${c.endpoint || `${profile.server}:${profile.port}`}
AllowedIPs = ${c.allowedIPs || '0.0.0.0/0'}
PersistentKeepalive = ${c.persistentKeepalive || 25}`;
    }

    return JSON.stringify(profile, null, 2);
  }

  /**
   * Generate QR Code Data URL
   */
  static async generateQr(text) {
    try {
      return await QRCode.toDataURL(text, {
        margin: 2,
        width: 300,
        color: {
          dark: '#00f2fe',
          light: '#0b0f19'
        }
      });
    } catch (err) {
      console.error('QR generation error:', err);
      return '';
    }
  }
}

module.exports = ConfigParser;

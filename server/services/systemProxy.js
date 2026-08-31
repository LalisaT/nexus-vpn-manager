const { exec } = require('child_process');

/**
 * Windows System Proxy Controller
 * Automatically configures Windows / Chrome / Edge / Firefox system proxy
 */
class SystemProxy {
  static isWindows() {
    return process.platform === 'win32';
  }

  /**
   * Enable Windows System Proxy for all browsers
   */
  static async enableProxy(httpPort = 10809, socksPort = 10808) {
    if (!this.isWindows()) return;

    const script = `
$regPath = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"
Set-ItemProperty -Path $regPath -Name ProxyEnable -Value 1
Set-ItemProperty -Path $regPath -Name ProxyServer -Value "http=127.0.0.1:${httpPort};https=127.0.0.1:${httpPort};socks=127.0.0.1:${socksPort}"
Set-ItemProperty -Path $regPath -Name ProxyOverride -Value "<local>;localhost;127.0.0.1;10.*;192.168.*"

try {
  $signature = @'
[DllImport("wininet.dll", SetLastError = true, CharSet=CharSet.Auto)]
public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);
'@
  $wininet = Add-Type -MemberDefinition $signature -Name WinINet -Namespace Win32Functions -PassThru
  $wininet::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0)
  $wininet::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0)
} catch {}
`;

    return new Promise((resolve) => {
      exec(`powershell -Command "${script.replace(/\r?\n/g, ' ')}"`, (err) => {
        if (err) console.warn('Could not set Windows system proxy automatically:', err.message);
        else console.log(`[SystemProxy] Windows system proxy enabled -> 127.0.0.1:${httpPort}`);
        resolve();
      });
    });
  }

  /**
   * Disable Windows System Proxy on Disconnect
   */
  static async disableProxy() {
    if (!this.isWindows()) return;

    const script = `
$regPath = "HKCU:\\Software\\Microsoft\\Windows\\CurrentVersion\\Internet Settings"
Set-ItemProperty -Path $regPath -Name ProxyEnable -Value 0

try {
  $signature = @'
[DllImport("wininet.dll", SetLastError = true, CharSet=CharSet.Auto)]
public static extern bool InternetSetOption(IntPtr hInternet, int dwOption, IntPtr lpBuffer, int dwBufferLength);
'@
  $wininet = Add-Type -MemberDefinition $signature -Name WinINet -Namespace Win32Functions -PassThru
  $wininet::InternetSetOption([IntPtr]::Zero, 39, [IntPtr]::Zero, 0)
  $wininet::InternetSetOption([IntPtr]::Zero, 37, [IntPtr]::Zero, 0)
} catch {}
`;

    return new Promise((resolve) => {
      exec(`powershell -Command "${script.replace(/\r?\n/g, ' ')}"`, (err) => {
        if (err) console.warn('Could not disable Windows system proxy:', err.message);
        else console.log('[SystemProxy] Windows system proxy disabled.');
        resolve();
      });
    });
  }
}

module.exports = SystemProxy;

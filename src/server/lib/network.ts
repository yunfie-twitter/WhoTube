import { lookup } from 'node:dns/promises';
import { Pool } from 'undici';
import { networkInterfaces } from 'node:os';

export interface NetworkStatus {
  hasIPv4: boolean;
  hasIPv6: boolean;
  preferredFamily: 4 | 6;
}

export async function detectNetworkStatus(): Promise<NetworkStatus> {
  let hasIPv4 = false;
  let hasIPv6 = false;

  try {
    const ipv4 = await lookup('google.com', { family: 4 });
    hasIPv4 = !!ipv4.address;
  } catch (e) {}

  try {
    const ipv6 = await lookup('google.com', { family: 6 });
    hasIPv6 = !!ipv6.address;
  } catch (e) {}

  return {
    hasIPv4,
    hasIPv6,
    preferredFamily: hasIPv6 ? 6 : 4
  };
}

/**
 * L2TP/VPN インターフェースと思われるIPアドレスを自動検出する
 */
export function getVpnIPs(): string[] {
  const interfaces = networkInterfaces();
  const vpnIps: string[] = [];
  
  // 典型的なVPNインターフェース名や属性でフィルタリング
  const vpnPatterns = [/vpn/i, /l2tp/i, /ppp/i, /tailscale/i, /zerotier/i];
  
  for (const [name, addrs] of Object.entries(interfaces)) {
    if (!addrs) continue;
    
    const isVpn = vpnPatterns.some(p => p.test(name));
    if (isVpn) {
      for (const addr of addrs) {
        if (!addr.internal && addr.family === 'IPv4') {
          vpnIps.push(addr.address);
        }
      }
    }
  }
  
  return vpnIps;
}

export async function testYouTubeConnectivity(family?: 4 | 6, localAddress?: string): Promise<boolean> {
  const pool = new Pool('https://www.youtube.com', {
    connect: {
      family: family,
      localAddress: localAddress
    }
  });

  try {
    const res = await pool.request({
      path: '/generate_204',
      method: 'GET'
    });
    const ok = res.statusCode === 204;
    await res.body.dump();
    return ok;
  } catch (e) {
    return false;
  } finally {
    await pool.close();
  }
}

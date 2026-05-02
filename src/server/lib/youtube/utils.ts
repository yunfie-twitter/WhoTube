import { generateRandomIPv6 } from '../ipv6.utils.js';
import { IPV6_BLOCK, IP_ROTATION_LIST } from './constants.js';

export function getNextLocalIP(): string | undefined {
  if (IPV6_BLOCK) {
    return generateRandomIPv6(IPV6_BLOCK);
  }
  if (IP_ROTATION_LIST.length > 0) {
    return IP_ROTATION_LIST[Math.floor(Math.random() * IP_ROTATION_LIST.length)];
  }
  return undefined;
}

export function validateVideoId(videoId: string): boolean {
  if (typeof videoId !== 'string') return false;
  return /^[A-Za-z0-9_-]{11}$/.test(videoId);
}

export function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

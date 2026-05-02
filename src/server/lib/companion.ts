import { config } from './config.js';

export function getCompanionBaseUrls(): string[] {
  const envUrl = config.companion.baseUrl || 'http://127.0.0.1:8282/companion';
  return envUrl.split(',').map(u => u.trim()).filter(Boolean);
}

export function getCompanionBaseUrl(identifier?: string): string {
  const urls = getCompanionBaseUrls();
  if (urls.length === 0) return 'http://127.0.0.1:8282/companion';
  if (urls.length === 1) return urls[0];

  if (identifier) {
    let hash = 0;
    for (let i = 0; i < identifier.length; i++) {
      hash = identifier.charCodeAt(i) + ((hash << 5) - hash);
    }
    const index = Math.abs(hash) % urls.length;
    return urls[index];
  }
  
  return urls[Math.floor(Math.random() * urls.length)];
}

import { exec } from 'node:child_process';
import { promisify } from 'node:util';

const execAsync = promisify(exec);

export class StreamlinkService {
  private static cache = new Map<string, { url: string, timestamp: number }>();
  private static CACHE_TTL = 60 * 1000; // 1 minute

  static async getStreamUrl(input: string): Promise<string | null> {
    const url = input.includes('://') ? input : `https://www.youtube.com/watch?v=${input}`;
    
    const cached = this.cache.get(url);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.url;
    }

    try {
      console.log(`[StreamlinkService] Fetching stream URL for: ${url}`);
      // --stream-url returns only the URL of the stream
      const { stdout } = await execAsync(`streamlink --stream-url "${url}" best`);
      const streamUrl = stdout.trim();
      
      if (streamUrl && streamUrl.startsWith('http')) {
        this.cache.set(url, { url: streamUrl, timestamp: Date.now() });
        return streamUrl;
      }
      
      console.warn(`[StreamlinkService] Invalid stream URL returned: ${streamUrl}`);
    } catch (e: any) {
      if (e.code === 127 || (e.message && e.message.includes('not found'))) {
        console.warn(`[StreamlinkService] streamlink command not found. Please install it (pip install streamlink).`);
      } else {
        console.warn(`[StreamlinkService] Failed to get stream URL for ${url}:`, e.message || e);
      }
    }
    return null;
  }
}

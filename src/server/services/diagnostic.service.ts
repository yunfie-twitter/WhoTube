import { detectNetworkStatus, testYouTubeConnectivity } from '../lib/network.js';
import { getYouTube, setPreferredIPFamily } from '../lib/youtube.js';
import { YouTubeService } from './youtube.service.js';
import { ManifestService } from './manifest.service.js';
import type { FastifyBaseLogger } from 'fastify';

export interface DiagnosticResult {
  isHealthy: boolean;
  network: any;
  connectivity: {
    ipv4: boolean;
    ipv6: boolean;
  };
  poToken: {
    status: 'OK' | 'FAILED' | 'EXCEPTION';
    source?: string;
    error?: string;
  };
  segmentFetch: {
    status: 'OK' | 'FAILED' | 'EXCEPTION';
    statusCode?: number;
    error?: string;
  };
  timestamp: string;
}

export class DiagnosticService {
  private static lastResult: DiagnosticResult | null = null;

  static getLastResult() {
    return this.lastResult;
  }

  static async runStartupTests(logger?: FastifyBaseLogger) {
    const log = logger || console;
    log.info('[Diagnostic] Starting startup tests...');
    
    const result: Partial<DiagnosticResult> = {
      timestamp: new Date().toISOString(),
      connectivity: { ipv4: false, ipv6: false },
      poToken: { status: 'FAILED' },
      segmentFetch: { status: 'FAILED' }
    };

    try {
      // 1. Network Detection
      const network = await detectNetworkStatus();
      result.network = network;
      log.info(`[Diagnostic] Network: IPv4=${network.hasIPv4}, IPv6=${network.hasIPv6} (Preferred: IPv${network.preferredFamily})`);

      // 2. Connectivity Tests
      const ytIPv4 = await testYouTubeConnectivity(4);
      const ytIPv6 = network.hasIPv6 ? await testYouTubeConnectivity(6) : false;
      result.connectivity = { ipv4: ytIPv4, ipv6: ytIPv6 };
      log.info(`[Diagnostic] YouTube Connectivity: IPv4=${ytIPv4 ? 'OK' : 'FAILED'}, IPv6=${ytIPv6 ? 'OK' : 'N/A'}`);

      if (ytIPv6) {
        log.info('[Diagnostic] IPv6 is working. Enabling dual-stack mode.');
        setPreferredIPFamily(undefined);
      } else {
        log.info('[Diagnostic] IPv6 is failing or unavailable. Forcing IPv4 for stability.');
        setPreferredIPFamily(4);
      }

      if (!ytIPv4 && !ytIPv6) {
        log.warn('[Diagnostic] CRITICAL: No connectivity to YouTube detected!');
      }

      // 3. PoToken Test
      try {
        log.info('[Diagnostic] Testing PoToken generation...');
        const yt = await getYouTube('WEB');
        const testVideoId = 'dQw4w9WgXcQ'; // Rickroll as test
        const { pot } = await YouTubeService.getPlaybackInfo(testVideoId, 'WEB', yt);
        if (pot?.poToken) {
          result.poToken = { status: 'OK', source: pot.source };
          log.info(`[Diagnostic] PoToken: OK (Source: ${pot.source})`);
        } else {
          result.poToken = { status: 'FAILED' };
          log.warn('[Diagnostic] PoToken: FAILED (Falling back to session-only tokens)');
        }
      } catch (e: any) {
        result.poToken = { status: 'EXCEPTION', error: e.message };
        log.warn(`[Diagnostic] PoToken test exception: ${e.message}`);
      }

      // 4. Segment Fetch Test
      try {
        log.info('[Diagnostic] Testing segment fetch...');
        const testVideoId = 'dQw4w9WgXcQ';
        const itag = 18; // 360p muxed, usually easy to fetch
        const { url } = await ManifestService.getDecipheredUrl(testVideoId, itag, 'WEB', undefined, true);
        const res = await fetch(url, { method: 'HEAD' });
        result.segmentFetch = { 
          status: (res.ok || res.status === 403) ? 'OK' : 'FAILED',
          statusCode: res.status 
        };
        if (result.segmentFetch.status === 'OK') {
          log.info(`[Diagnostic] Segment Fetch: OK (Status: ${res.status})`);
        } else {
          log.warn(`[Diagnostic] Segment Fetch: FAILED (Status: ${res.status})`);
        }
      } catch (e: any) {
        result.segmentFetch = { status: 'EXCEPTION', error: e.message };
        log.warn(`[Diagnostic] Segment fetch test exception: ${e.message}`);
      }

      result.isHealthy = (result.connectivity?.ipv4 || result.connectivity?.ipv6) === true;
      this.lastResult = result as DiagnosticResult;
      log.info('[Diagnostic] Startup tests completed.');
    } catch (e: any) {
      log.error(`[Diagnostic] Fatal error during startup tests: ${e.message}`);
      this.lastResult = {
        isHealthy: false,
        timestamp: new Date().toISOString(),
        error: e.message
      } as any;
    }
  }
}


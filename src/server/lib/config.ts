import { existsSync } from 'node:fs';
import path from 'node:path';

/**
 * Server Configuration
 * Centralizes all environment variables and provides defaults.
 */
export const config = {
  // General
  port: Number(process.env.PORT) || 3000,
  nodeEnv: process.env.NODE_ENV || 'development',
  isDev: process.env.NODE_ENV === 'development',
  
  // Auth
  jwtSecret: process.env.JWT_SECRET || 'youtube-proxy-secret-key',
  adminSecretToken: process.env.ADMIN_SECRET_TOKEN,
  appBaseUrl: process.env.APP_BASE_URL || 'http://localhost:3000',

  // YouTube
  youtube: {
    acceptLanguage: process.env.YOUTUBE_ACCEPT_LANGUAGE || 'ja-JP,ja;q=0.9,en-US;q=0.8,en;q=0.7',
    ipRotationIps: process.env.YOUTUBE_IP_ROTATION_IPS?.split(',').map(s => s.trim()).filter(Boolean) || [],
    ipv6Block: process.env.YOUTUBE_IPV6_BLOCK || '',
    rateLimitIntervalMs: Number(process.env.YOUTUBE_RATE_LIMIT_INTERVAL_MS || 180),
    cooldownBaseMs: Number(process.env.YOUTUBE_COOLDOWN_BASE_MS || 30_000),
    cooldownMaxMs: Number(process.env.YOUTUBE_COOLDOWN_MAX_MS || 10 * 60_000),
    cooldownSoftWaitMs: Number(process.env.YOUTUBE_COOLDOWN_SOFT_WAIT_MS || 1500),
  },

  // Companion Service
  companion: {
    baseUrl: process.env.COMPANION_BASE_URL || 'http://127.0.0.1:8282/companion',
    secret: process.env.COMPANION_SECRET || 'YOURSECRETKEY',
    useProxy: process.env.USE_COMPANION_PROXY === 'true',
  },

  // Database (Postgres)
  db: {
    host: process.env.POSTGRES_HOST || 'postgres',
    user: process.env.POSTGRES_USER || 'whotube',
    password: process.env.POSTGRES_PASSWORD || 'whotubepass',
    database: process.env.POSTGRES_DB || 'whotube',
    port: Number(process.env.POSTGRES_PORT) || 5432,
  },

  // Proxy / Caching
  proxy: {
    segmentCacheMaxBytes: Number(process.env.SEGMENT_CACHE_MAX_BYTES || 256 * 1024 * 1024),
    segmentCacheMaxEntryBytes: Number(process.env.SEGMENT_CACHE_MAX_ENTRY_BYTES || 8 * 1024 * 1024),
    segmentCacheTtlMs: Number(process.env.SEGMENT_CACHE_TTL_MS || 10 * 60 * 1000),
  },

  // Meta / Subscriptions
  meta: {
    forcedSubscriptionChannelIds: process.env.FORCED_SUBSCRIPTION_CHANNEL_ID
      ? process.env.FORCED_SUBSCRIPTION_CHANNEL_ID.split(',').map(id => id.trim()).filter(Boolean)
      : [],
  }
};

/**
 * Validate required environment variables
 */
export function validateConfig() {
  const missing: string[] = [];
  
  if (!config.adminSecretToken && config.nodeEnv === 'production') {
    missing.push('ADMIN_SECRET_TOKEN');
  }

  if (missing.length > 0) {
    console.error(`[Config] Missing required environment variables: ${missing.join(', ')}`);
    if (config.nodeEnv === 'production') {
      process.exit(1);
    }
  }
}

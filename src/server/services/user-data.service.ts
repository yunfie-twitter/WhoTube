import { ChannelService } from './channel.service.js';
import pg from 'pg';

const { Pool } = pg;

export interface SubscriptionRecord {
  channelId: string;
  title: string;
  handle: string;
  thumbnail: string;
  rssUrl: string;
  subscribedAt: string;
}

export interface UserDataRecord {
  favorites: unknown[];
  following: unknown[];
  history: unknown[];
  playlists: unknown[];
  subscriptions: SubscriptionRecord[];
}

import { config } from '../lib/config.js';

const pool = new pg.Pool({
  host: config.db.host,
  user: config.db.user,
  password: config.db.password,
  database: config.db.database,
  port: config.db.port,
});

pool.query(`
  CREATE TABLE IF NOT EXISTS user_data (
    user_id VARCHAR(255) PRIMARY KEY,
    data JSONB NOT NULL
  );
`).catch(err => console.error('[UserDataService] Failed to create user_data table:', err));

export class UserDataService {
  private static metadataQueue: { userId: string; channelId: string }[] = [];
  private static isProcessingMetadata = false;

  private static defaultData(): UserDataRecord {
    return {
      favorites: [],
      following: [],
      history: [],
      playlists: [],
      subscriptions: []
    };
  }

  static async getUserData(userId: string): Promise<UserDataRecord> {
    const res = await pool.query('SELECT data FROM user_data WHERE user_id = $1', [userId]);
    if (res.rows.length === 0) {
      return this.defaultData();
    }
    const raw = res.rows[0].data;
    return {
      ...this.defaultData(),
      ...raw,
      subscriptions: Array.isArray(raw?.subscriptions) ? raw.subscriptions : []
    };
  }

  static async saveUserData(userId: string, data: UserDataRecord): Promise<void> {
    await pool.query(
      `INSERT INTO user_data (user_id, data) VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE SET data = $2`,
      [userId, data]
    );
  }

  static async replaceUserData(userId: string, data: unknown): Promise<UserDataRecord> {
    const nextData = {
      ...this.defaultData(),
      ...(typeof data === 'object' && data ? data : {})
    } as UserDataRecord;
    nextData.subscriptions = Array.isArray(nextData.subscriptions) ? nextData.subscriptions : [];
    await this.saveUserData(userId, nextData);
    return nextData;
  }

  static async listSubscriptions(userId: string): Promise<SubscriptionRecord[]> {
    const data = await this.getUserData(userId);
    return data.subscriptions;
  }

  static async upsertSubscription(userId: string, subscription: Omit<SubscriptionRecord, 'subscribedAt'> & { subscribedAt?: string }): Promise<SubscriptionRecord> {
    const results = await this.upsertSubscriptions(userId, [subscription]);
    return results[0];
  }

  static async upsertSubscriptions(userId: string, subscriptions: (Omit<SubscriptionRecord, 'subscribedAt'> & { subscribedAt?: string })[]): Promise<SubscriptionRecord[]> {
    const data = await this.getUserData(userId);
    const results: SubscriptionRecord[] = [];
    const now = new Date().toISOString();

    for (const sub of subscriptions) {
      const nextSubscription: SubscriptionRecord = {
        ...sub,
        subscribedAt: sub.subscribedAt || now
      };
      
      data.subscriptions = data.subscriptions.filter((item) => item.channelId !== sub.channelId);
      data.subscriptions.unshift(nextSubscription);
      results.push(nextSubscription);
    }

    await this.saveUserData(userId, data);

    for (const sub of results) {
      if (!sub.thumbnail || !sub.handle) {
        this.queueMetadataRefresh(userId, sub.channelId);
      }
    }

    return results;
  }

  static queueMetadataRefresh(userId: string, channelId: string) {
    if (this.metadataQueue.some(item => item.userId === userId && item.channelId === channelId)) return;
    this.metadataQueue.push({ userId, channelId });
    this.processMetadataQueue();
  }

  private static async processMetadataQueue() {
    if (this.isProcessingMetadata) return;
    this.isProcessingMetadata = true;

    await new Promise(resolve => setTimeout(resolve, 5000));

    while (this.metadataQueue.length > 0) {
      const item = this.metadataQueue.shift();
      if (!item) break;

      try {
        const { userId, channelId } = item;
        const data = await this.getUserData(userId);
        const sub = data.subscriptions.find(s => s.channelId === channelId);
        
        if (sub && (!sub.thumbnail || !sub.handle)) {
          console.log(`[UserDataService] Lazy-fetching metadata for ${channelId}...`);
          const details = await ChannelService.getChannelDetails(channelId);
          
          const currentData = await this.getUserData(userId);
          const index = currentData.subscriptions.findIndex(s => s.channelId === channelId);
          if (index !== -1) {
            currentData.subscriptions[index] = {
              ...currentData.subscriptions[index],
              title: details.name || currentData.subscriptions[index].title,
              handle: details.handle || currentData.subscriptions[index].handle,
              thumbnail: details.thumbnail || currentData.subscriptions[index].thumbnail
            };
            await this.saveUserData(userId, currentData);
          }
        }
      } catch (err) {
        console.warn(`[UserDataService] Lazy-fetch failed for ${item?.channelId}:`, err);
      }

      if (this.metadataQueue.length > 0) {
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
    }

    this.isProcessingMetadata = false;
  }

  static async removeSubscription(userId: string, channelId: string): Promise<boolean> {
    const data = await this.getUserData(userId);
    const before = data.subscriptions.length;
    data.subscriptions = data.subscriptions.filter((item) => item.channelId !== channelId);
    await this.saveUserData(userId, data);
    return before !== data.subscriptions.length;
  }
}

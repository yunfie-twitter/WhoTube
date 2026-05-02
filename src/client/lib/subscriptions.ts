import {
  getLocalSubscriptionFeed,
  getSubscriptionFeed,
  listServerSubscriptions,
  serverBatchSubscribe,
  serverSubscribe,
  serverUnsubscribe
} from './api';
import type { Subscription, VideoItem } from './types';

const LOCAL_SUBSCRIPTIONS_KEY = 'whotube:subscriptions';

export interface SubscriptionOwner {
  isAuthenticated: boolean;
  userId?: string;
}

export function getSubscriptionQueryKey(owner: SubscriptionOwner) {
  return ['subscriptions', owner.isAuthenticated ? owner.userId : 'local'];
}

export function getSubscriptionFeedQueryKey(owner: SubscriptionOwner) {
  return ['subscription-feed', owner.isAuthenticated ? owner.userId : 'local'];
}

function readLocalSubscriptions(): Subscription[] {
  try {
    const raw = window.localStorage.getItem(LOCAL_SUBSCRIPTIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeLocalSubscriptions(items: Subscription[]) {
  window.localStorage.setItem(LOCAL_SUBSCRIPTIONS_KEY, JSON.stringify(items));
}

export async function listSubscriptions(owner: SubscriptionOwner): Promise<Subscription[]> {
  if (owner.isAuthenticated && owner.userId) {
    return listServerSubscriptions(owner.userId);
  }

  return readLocalSubscriptions();
}

export async function subscribe(
  owner: SubscriptionOwner,
  payload: { channelId: string; title?: string; handle?: string; thumbnail?: string }
): Promise<void> {
  if (owner.isAuthenticated && owner.userId) {
    await serverSubscribe(owner.userId, payload);
    return;
  }

  const now = new Date().toISOString();
  const items = readLocalSubscriptions().filter((item) => item.channelId !== payload.channelId);
  items.unshift({
    channelId: payload.channelId,
    title: payload.title || payload.channelId,
    handle: payload.handle,
    thumbnail: payload.thumbnail,
    subscribedAt: now
  });
  writeLocalSubscriptions(items);
}

export async function batchSubscribe(
  owner: SubscriptionOwner,
  payloads: { channelId: string; title?: string; handle?: string; thumbnail?: string }[]
): Promise<void> {
  if (owner.isAuthenticated && owner.userId) {
    await serverBatchSubscribe(owner.userId, payloads);
    return;
  }

  const now = new Date().toISOString();
  let items = readLocalSubscriptions();
  const existingIds = new Set(items.map(i => i.channelId));

  const newItems = payloads
    .filter(p => !existingIds.has(p.channelId))
    .map(p => ({
      channelId: p.channelId,
      title: p.title || p.channelId,
      handle: p.handle,
      thumbnail: p.thumbnail,
      subscribedAt: now
    }));

  items = [...newItems, ...items];
  writeLocalSubscriptions(items);
}

export async function unsubscribe(owner: SubscriptionOwner, channelId: string): Promise<void> {
  if (owner.isAuthenticated && owner.userId) {
    await serverUnsubscribe(owner.userId, channelId);
    return;
  }

  writeLocalSubscriptions(readLocalSubscriptions().filter((item) => item.channelId !== channelId));
}

export async function getSubscriptionsFeed(owner: SubscriptionOwner, limit = 50, offset = 0): Promise<VideoItem[]> {
  if (owner.isAuthenticated && owner.userId) {
    return getSubscriptionFeed(owner.userId, limit, offset);
  }

  const channelIds = readLocalSubscriptions().map((item) => item.channelId);
  if (channelIds.length === 0) return [];
  return getLocalSubscriptionFeed(channelIds, limit, offset);
}

import { getChannelFeed } from './api';
import { listSubscriptions, type SubscriptionOwner } from './subscriptions';
import type { VideoItem } from './types';

const SEEN_NOTIFICATIONS_KEY = 'whotube:notification-seen-video-ids';
const NOTIFICATIONS_ENABLED_KEY = 'whotube:notifications-enabled';
const NOTIFICATION_ITEMS_KEY = 'whotube:notification-items';
const LAST_SEEN_AT_KEY = 'whotube:notifications-last-seen-at';

export interface NotificationItem extends VideoItem {
  notifiedAt: string;
}

function readSeenIds(): Set<string> {
  try {
    const raw = window.localStorage.getItem(SEEN_NOTIFICATIONS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map(String) : []);
  } catch {
    return new Set();
  }
}

function writeSeenIds(ids: Set<string>) {
  window.localStorage.setItem(SEEN_NOTIFICATIONS_KEY, JSON.stringify([...ids].slice(-500)));
}

export function readNotificationItems(): NotificationItem[] {
  try {
    const raw = window.localStorage.getItem(NOTIFICATION_ITEMS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeNotificationItems(items: NotificationItem[]) {
  window.localStorage.setItem(NOTIFICATION_ITEMS_KEY, JSON.stringify(items.slice(0, 80)));
  window.dispatchEvent(new CustomEvent('whotube:notifications-changed'));
}

export function areSubscriptionNotificationsEnabled() {
  return window.localStorage.getItem(NOTIFICATIONS_ENABLED_KEY) === '1';
}

export function setSubscriptionNotificationsEnabled(enabled: boolean) {
  window.localStorage.setItem(NOTIFICATIONS_ENABLED_KEY, enabled ? '1' : '0');
}

export function getLastSeenAt(): string {
  return window.localStorage.getItem(LAST_SEEN_AT_KEY) || '1970-01-01T00:00:00.000Z';
}

export function setLastSeenAt(date: string) {
  window.localStorage.setItem(LAST_SEEN_AT_KEY, date);
  window.dispatchEvent(new CustomEvent('whotube:notifications-changed'));
}

export async function ensureNotificationPermission() {
  if (!('Notification' in window)) return false;
  if (Notification.permission === 'granted') return true;
  if (Notification.permission === 'denied') return false;
  return (await Notification.requestPermission()) === 'granted';
}

function notify(video: VideoItem) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  const notification = new Notification(video.channelTitle || 'WhoTube', {
    body: video.title,
    icon: video.thumbnail,
    tag: `whotube:${video.id}`
  });
  notification.onclick = () => {
    window.focus();
    window.location.href = `/watch/${video.id}?autoplay=1`;
  };
}

export async function checkSubscriptionNotifications(owner: SubscriptionOwner, notifyNewVideos: boolean) {
  if (!areSubscriptionNotificationsEnabled()) return [];

  const subscriptions = await listSubscriptions(owner);
  const seenIds = readSeenIds();
  const newlyFound: VideoItem[] = [];

  for (const subscription of subscriptions) {
    try {
      const [latest] = await getChannelFeed(subscription.channelId, 1);
      if (!latest?.id) continue;

      if (!seenIds.has(latest.id)) {
        seenIds.add(latest.id);
        newlyFound.push({
          ...latest,
          channelTitle: latest.channelTitle || subscription.title
        });
      }
    } catch {
      // A single RSS failure should not stop notification checks for other channels.
    }
  }

  writeSeenIds(seenIds);
  if (newlyFound.length) {
    writeNotificationItems([
      ...newlyFound.map((item) => ({ ...item, notifiedAt: new Date().toISOString() })),
      ...readNotificationItems()
    ]);
  }

  if (notifyNewVideos) {
    for (const video of newlyFound) {
      notify(video);
    }
  }

  return newlyFound;
}

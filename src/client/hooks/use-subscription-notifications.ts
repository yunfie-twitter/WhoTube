import { useEffect, useState } from 'react';
import { useAuth } from '../lib/auth';
import {
  areSubscriptionNotificationsEnabled,
  checkSubscriptionNotifications,
  ensureNotificationPermission,
  setSubscriptionNotificationsEnabled
} from '../lib/notifications';

const CHECK_INTERVAL_MS = 5 * 60 * 1000;

export function useSubscriptionNotifications() {
  const auth = useAuth();
  const owner = { isAuthenticated: auth.isAuthenticated && Boolean(auth.user?.id), userId: auth.user?.id };
  const [enabled, setEnabled] = useState(() => areSubscriptionNotificationsEnabled());
  const [isChecking, setIsChecking] = useState(false);

  useEffect(() => {
    if (!enabled || auth.isLoading) return;

    let cancelled = false;
    const run = async (notifyNewVideos: boolean) => {
      setIsChecking(true);
      try {
        await checkSubscriptionNotifications(owner, notifyNewVideos);
      } finally {
        if (!cancelled) setIsChecking(false);
      }
    };

    void run(false);
    const interval = window.setInterval(() => {
      void run(true);
    }, CHECK_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [auth.isLoading, enabled, owner.isAuthenticated, owner.userId]);

  async function enableNotifications() {
    const granted = await ensureNotificationPermission();
    if (!granted) return;
    setSubscriptionNotificationsEnabled(true);
    setEnabled(true);
    await checkSubscriptionNotifications(owner, false);
  }

  async function toggleNotifications() {
    if (enabled) {
      setSubscriptionNotificationsEnabled(false);
      setEnabled(false);
      return;
    }
    await enableNotifications();
  }

  return {
    enabled,
    isChecking,
    enableNotifications,
    toggleNotifications
  };
}

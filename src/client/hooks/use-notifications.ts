import { useQuery } from '@tanstack/react-query';
import { apiFetch } from '../lib/api';

export interface GlobalNotification {
  id: number;
  message: string;
  type: string;
  createdAt: string;
}

export function useGlobalNotifications() {
  return useQuery<GlobalNotification[]>({
    queryKey: ['global-notifications'],
    queryFn: () => apiFetch<GlobalNotification[]>('/api/notifications'),
    refetchInterval: 1000 * 60 * 5 // 5 minutes
  });
}

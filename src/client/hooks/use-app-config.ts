import { useQuery } from '@tanstack/react-query';
import { getAppConfig } from '../lib/api';

export function useAppConfig() {
  return useQuery({
    queryKey: ['app-config'],
    queryFn: getAppConfig,
    staleTime: Infinity,
  });
}

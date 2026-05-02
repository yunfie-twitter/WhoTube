import { type LogtoConfig, UserScope } from '@logto/react';

const endpoint = import.meta.env.VITE_LOGTO_ENDPOINT;
const appId = import.meta.env.VITE_LOGTO_APP_ID;

export const logtoConfig: LogtoConfig | null = endpoint && appId
  ? {
      endpoint,
      appId,
      scopes: [
        UserScope.Email,
        UserScope.Phone,
        UserScope.CustomData,
        UserScope.Identities,
        UserScope.Organizations,
        UserScope.Roles
      ]
    }
  : null;

export function getLogtoRedirectUri() {
  return `${window.location.origin}/callback`;
}

export function getLogtoPostLogoutRedirectUri() {
  return window.location.origin;
}

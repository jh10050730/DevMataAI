import { api } from './api';

export interface GoogleStatus {
  configured: boolean;
  connected: boolean;
  needsReconnect: boolean;
  email: string | null;
  lastSyncAt: string | null;
  syncedEvents: number;
  readOnly: boolean;
  redirectUri: string;
}

export interface GoogleSyncResult {
  created: number;
  updated: number;
  removed: number;
  total: number;
  complete: boolean;
}

export const googleApi = {
  status: () => api.get<GoogleStatus>('/google/status'),
  connect: () => api.post<{ url: string }>('/google/connect'),
  sync: () => api.post<GoogleSyncResult>('/google/sync'),
  disconnect: (removeEvents: boolean) =>
    api.delete<{ disconnected: boolean; revoked: boolean; removedEvents: number }>(`/google?removeEvents=${removeEvents}`),
};

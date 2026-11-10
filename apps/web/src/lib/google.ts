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
  /** 데스크톱 앱에서 실행 중 (Google 로그인은 기본 브라우저에서 하고 앱으로 돌아온다) */
  desktop?: boolean;
  /** 가져오는 기간 */
  syncWindow?: { pastDays: number; futureDays: number };
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

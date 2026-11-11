/**
 * 데스크톱 앱(Electron) 안에서 실행 중인지, 그리고 앱에 알리기 (IPC).
 * 데스크톱 앱은 API 를 자식 프로세스로 띄우며 DEVMATA_DESKTOP=1 과 IPC 채널을 준다 (apps/desktop/src/server.cjs).
 * 앱이 받는 메시지는 apps/desktop/src/paths.cjs 의 appRoute / resetRoute / folderTarget 이 검사한다.
 */
export const isDesktop = () => process.env.DEVMATA_DESKTOP === '1';

export type DesktopMessage =
  | { type: 'open-app'; path: string }
  | { type: 'reset-password'; email: string; path: string }
  | { type: 'open-folder'; target: 'data' | 'logs' }
  | { type: 'update'; action: 'check' | 'install' }
  | { type: 'focus' };

type Send = (message: unknown) => boolean;

/** 앱에 메시지를 보낸다. IPC 가 없거나 실패하면 false */
export function sendToDesktop(message: DesktopMessage, send: Send | null = process.send?.bind(process) ?? null): boolean {
  if (!send) return false;
  try {
    return send(message) !== false;
  } catch {
    return false;
  }
}

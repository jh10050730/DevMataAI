import { describe, expect, it } from 'vitest';
import { folderRows, updateView } from './AppInfoCard';

describe('앱 정보', () => {
  it('웹 실행에서는 폴더를 보여 주지 않는다', () => {
    expect(folderRows({ desktop: false, version: '0.1.0', dataDir: 'C:/x' })).toEqual([]);
  });
  it('데스크톱 앱에서는 받은 폴더만 순서대로 보여 준다', () => {
    expect(folderRows({ desktop: true, version: '1.0.0', dataDir: 'C:/d', logDir: 'C:/d/logs' }).map(r => [r.target, r.path])).toEqual([['data', 'C:/d'], ['logs', 'C:/d/logs']]);
    expect(folderRows({ desktop: true, version: '1.0.0', logDir: 'C:/d/logs' }).map(r => r.target)).toEqual(['logs']);
  });
});

describe('업데이트 표시', () => {
  it('상태마다 문구와 누를 수 있는 동작', () => {
    expect(updateView({ state: 'idle' })).toMatchObject({ action: 'check', working: false });
    expect(updateView({ state: 'checking' })).toMatchObject({ action: null, working: true });
    expect(updateView({ state: 'downloading', version: '0.2.0', percent: 42 })).toMatchObject({ text: 'v0.2.0 받는 중… 42%', action: null, working: true });
    expect(updateView({ state: 'ready', version: '0.2.0' })).toMatchObject({ action: 'install', working: false });
    expect(updateView({ state: 'ready', version: '0.2.0' }).text).toContain('v0.2.0');
    expect(updateView({ state: 'error', error: '인터넷에 연결할 수 없어요' })).toEqual({ text: '인터넷에 연결할 수 없어요', action: 'check', working: false });
  });
});

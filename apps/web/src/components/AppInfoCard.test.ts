import { describe, expect, it } from 'vitest';
import { folderRows } from './AppInfoCard';

describe('앱 정보', () => {
  it('웹 실행에서는 폴더를 보여 주지 않는다', () => {
    expect(folderRows({ desktop: false, version: '0.1.0', dataDir: 'C:/x' })).toEqual([]);
  });
  it('데스크톱 앱에서는 받은 폴더만 순서대로 보여 준다', () => {
    expect(folderRows({ desktop: true, version: '1.0.0', dataDir: 'C:/d', logDir: 'C:/d/logs' }).map(r => [r.target, r.path])).toEqual([['data', 'C:/d'], ['logs', 'C:/d/logs']]);
    expect(folderRows({ desktop: true, version: '1.0.0', logDir: 'C:/d/logs' }).map(r => r.target)).toEqual(['logs']);
  });
});

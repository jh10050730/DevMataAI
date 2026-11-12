import { describe, expect, it } from 'vitest';
import { readyVersion } from './UpdateBanner';

describe('업데이트 준비 안내줄', () => {
  it('데스크톱 앱이 새 버전을 다 받았을 때만 보여 준다', () => {
    expect(readyVersion({ desktop: true, version: '0.2.1', update: { state: 'ready', version: '0.3.0' } })).toBe('0.3.0');
    expect(readyVersion({ desktop: true, version: '0.2.1', update: { state: 'ready' } })).toBe('');
    expect(readyVersion({ desktop: true, version: '0.2.1', update: { state: 'downloading', version: '0.3.0', percent: 40 } })).toBeNull();
    expect(readyVersion({ desktop: false, version: '0.2.1', update: { state: 'ready', version: '0.3.0' } })).toBeNull();
    expect(readyVersion({ desktop: true, version: '0.2.1' })).toBeNull();
    expect(readyVersion(undefined)).toBeNull();
  });
});

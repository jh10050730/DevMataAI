import { describe, expect, it } from 'vitest';
import releaseNotes from '../releaseNotes.json';
import { majorMinor, whatsNewFor } from './whatsNew';

const notes = { '0.3': { title: '0.3', items: ['a'] }, '1.0': { title: '1.0', items: ['b'] } };

describe('업데이트 안내', () => {
  it('앞의 두 자리만 본다', () => {
    expect(majorMinor('0.3.1')).toBe('0.3');
    expect(majorMinor('v1.0.12')).toBe('1.0');
    expect(majorMinor('dev')).toBeNull();
  });
  it('큰 업데이트일 때만 보여 준다', () => {
    expect(whatsNewFor('0.2.0', '0.3.0', true, notes)?.version).toBe('0.3');
    expect(whatsNewFor('0.2.5', '0.3.1', true, notes)?.title).toBe('0.3');
    expect(whatsNewFor('0.9.4', '1.0.1', true, notes)?.version).toBe('1.0');
    expect(whatsNewFor('0.3.0', '0.3.2', true, notes)).toBeNull();
    expect(whatsNewFor('0.3.1', '0.3.1', true, notes)).toBeNull();
    expect(whatsNewFor('1.0.0', '0.3.0', true, notes)).toBeNull();
  });
  it('안내 글이 없는 버전·새 사용자는 보여 주지 않고, 기능이 생기기 전 버전에서 온 기존 사용자에게는 보여 준다', () => {
    expect(whatsNewFor('0.3.0', '0.4.0', true, notes)).toBeNull();
    expect(whatsNewFor(null, '0.3.0', false, notes)).toBeNull();
    expect(whatsNewFor(null, '0.3.0', true, notes)?.version).toBe('0.3');
  });
  it('안내 글 파일 형식', () => {
    for (const [key, note] of Object.entries(releaseNotes)) {
      expect(key).toMatch(/^\d+\.\d+$/);
      expect(note.title.length).toBeGreaterThan(0);
      expect(note.items.length).toBeGreaterThan(0);
    }
  });
});

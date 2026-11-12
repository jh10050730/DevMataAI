import releaseNotes from '../releaseNotes.json';

/** 업데이트 안내: 큰 업데이트(앞의 두 자리, 예 0.2 → 0.3, 0.9 → 1.0)일 때만 앱에 처음 들어오면 새로워진 점을 보여 준다 */
export type ReleaseNote = { title: string; items: string[] };
export type ReleaseNotes = Record<string, ReleaseNote>;

/** "0.3.1" → "0.3". 버전 형식이 아니면 null */
export function majorMinor(version: string | null | undefined) {
  const m = /^v?(\d+)\.(\d+)\.\d+$/.exec(String(version ?? '').trim());
  return m ? `${Number(m[1])}.${Number(m[2])}` : null;
}

const greater = (a: string, b: string) => {
  const [am, an] = a.split('.').map(Number), [bm, bn] = b.split('.').map(Number);
  return am - bm || an - bn;
};

/**
 * 보여 줄 안내를 고른다.
 * - seen: 이 PC에서 이 사용자가 마지막으로 본 버전 (처음이면 null)
 * - returning: 이미 쓰던 사용자인지 (안내 기능이 생기기 전 버전에서 업데이트한 경우를 구분)
 * 새로 가입한 사용자, 같은 큰 버전 안의 작은 업데이트(0.3.0 → 0.3.2), 안내 글이 없는 버전은 null.
 */
export function whatsNewFor(seen: string | null, current: string | null | undefined, returning: boolean, notes: ReleaseNotes = releaseNotes) {
  const now = majorMinor(current);
  if (!now) return null;
  if (seen === null) { if (!returning) return null; }
  else {
    const before = majorMinor(seen);
    if (before && greater(now, before) <= 0) return null;
  }
  const note = notes[now];
  return note ? { version: now, ...note } : null;
}

export const seenVersionKey = (userId: string) => `devmata-seen-version:${userId}`;

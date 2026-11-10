// DevMata AI 로고: 앱 사이드바 로고와 같은 모양 (파란 둥근 사각형 + 흰 레이어 아이콘, lucide "layers").
// 사이드바: 36px 사각형, rounded-xl(12px), 가운데 20px 아이콘, 선 두께 2.2, 색 accent-strong(#2272eb).
// 웹 favicon(apps/web/public/favicon.svg)과 데스크톱 창·트레이 아이콘이 이 정의를 쓴다. 테스트가 favicon 과 같은지 확인한다.

const BOX = 36;
const RADIUS = 12;
const COLOR = '#2272eb';
const ICON_OFFSET = 8;      // (36 - 20) / 2
const ICON_SCALE = 20 / 24; // lucide 아이콘은 24 기준
const STROKE = 2.2;         // 아이콘 좌표 기준

// lucide "layers" 원본 경로 (SVG 용)
const PATHS = [
  'M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z',
  'M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12',
  'M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17',
];

// 비트맵용 근사 꺾은선 (작은 곡선 모서리는 둥근 선 끝·이음으로 충분히 같아 보인다)
const lower = y => [[2, y], [2.58, y + 0.91], [11.18, y + 4.82], [12, y + 5], [12.83, y + 4.82], [21.41, y + 0.92], [22, y]];
const LINES = [
  [[12.83, 2.18], [12, 2], [11.17, 2.18], [2.6, 6.08], [2, 7], [2.6, 7.91], [11.18, 11.82], [12, 12], [12.83, 11.82], [21.41, 7.92], [22, 7], [21.41, 6.09], [12.83, 2.18]],
  lower(12),
  lower(17),
];

/** 로고 SVG 문자열 (favicon.svg 내용과 같다) */
function logoSvg() {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${BOX} ${BOX}">`
    + `<rect width="${BOX}" height="${BOX}" rx="${RADIUS}" fill="${COLOR}"/>`
    + `<g transform="translate(${ICON_OFFSET} ${ICON_OFFSET}) scale(${ICON_SCALE.toFixed(4)})" fill="none" stroke="#fff" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">`
    + PATHS.map(d => `<path d="${d}"/>`).join('')
    + '</g></svg>\n';
}

function insideRoundedRect(x, y) {
  if (x < 0 || y < 0 || x > BOX || y > BOX) return false;
  const dx = Math.max(RADIUS - x, 0, x - (BOX - RADIUS));
  const dy = Math.max(RADIUS - y, 0, y - (BOX - RADIUS));
  return dx * dx + dy * dy <= RADIUS * RADIUS;
}

function segmentDistance(px, py, [ax, ay], [bx, by]) {
  const vx = bx - ax; const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function onIcon(x, y) {
  const ix = (x - ICON_OFFSET) / ICON_SCALE; const iy = (y - ICON_OFFSET) / ICON_SCALE;
  for (const line of LINES) for (let i = 1; i < line.length; i++) {
    if (segmentDistance(ix, iy, line[i - 1], line[i]) <= STROKE / 2) return true;
  }
  return false;
}

/** size x size 크기의 BGRA(미리 곱한 알파) 비트맵. 4x4 샘플로 가장자리를 부드럽게 한다. */
function logoBitmap(size) {
  const buf = Buffer.alloc(size * size * 4);
  const [cr, cg, cb] = [1, 3, 5].map(i => parseInt(COLOR.slice(i, i + 2), 16));
  const S = 4; const scale = BOX / size;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0; let g = 0; let b = 0; let a = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const x = (px + (sx + 0.5) / S) * scale; const y = (py + (sy + 0.5) / S) * scale;
      if (!insideRoundedRect(x, y)) continue;
      a += 1;
      if (onIcon(x, y)) { r += 255; g += 255; b += 255; } else { r += cr; g += cg; b += cb; }
    }
    const n = S * S; const i = (py * size + px) * 4;
    buf[i] = Math.round(b / n); buf[i + 1] = Math.round(g / n); buf[i + 2] = Math.round(r / n); buf[i + 3] = Math.round((a / n) * 255);
  }
  return buf;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(buf) {
  let c = 0xffffffff;
  for (const byte of buf) c = CRC_TABLE[(c ^ byte) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function pngChunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/** size x size 로고 PNG (RGBA). 설치 파일 아이콘(.ico)에 쓴다. */
function logoPng(size) {
  const { deflateSync } = require('node:zlib');
  const src = logoBitmap(size);
  const raw = Buffer.alloc(size * (1 + size * 4));
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const i = (y * size + x) * 4; const o = y * (1 + size * 4) + 1 + x * 4;
    const a = src[i + 3]; const un = v => (a ? Math.min(255, Math.round((v * 255) / a)) : 0); // 미리 곱한 알파 되돌리기
    raw[o] = un(src[i + 2]); raw[o + 1] = un(src[i + 1]); raw[o + 2] = un(src[i]); raw[o + 3] = a;
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0); ihdr.writeUInt32BE(size, 4); ihdr[8] = 8; ihdr[9] = 6; // 8bit RGBA
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    pngChunk('IHDR', ihdr), pngChunk('IDAT', deflateSync(raw)), pngChunk('IEND', Buffer.alloc(0)),
  ]);
}

module.exports = { logoSvg, logoBitmap, logoPng };

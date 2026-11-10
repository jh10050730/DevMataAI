// DevMata AI 로고: 파란 둥근 사각형 안에 코드 꺾쇠 < > 와 가운데 AI 반짝임.
// 웹 favicon(apps/web/public/favicon.svg)과 데스크톱 아이콘이 같은 모양을 쓴다. 테스트가 둘이 같은지 확인한다.
// 좌표는 64x64 기준.

const SIZE = 64;
const RADIUS = 15;
const GRADIENT = ['#4f8dff', '#1f5fd6']; // 왼쪽 위 → 오른쪽 아래
const STROKE = 5.5;
const CHEVRONS = [
  [[20, 21], [10, 32], [20, 43]],
  [[44, 21], [54, 32], [44, 43]],
];
const STAR = { cx: 32, cy: 32, outer: 10.5, inner: 3 };

function starPoints({ cx, cy, outer, inner } = STAR) {
  const points = [];
  for (let i = 0; i < 8; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = (Math.PI / 4) * i - Math.PI / 2;
    points.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]);
  }
  return points;
}

const fmt = n => String(Math.round(n * 100) / 100);

/** 로고 SVG 문자열 (favicon.svg 내용과 같다) */
function logoSvg() {
  const chevrons = CHEVRONS.map(p => `<polyline points="${p.map(([x, y]) => `${x},${y}`).join(' ')}"/>`).join('');
  const star = starPoints().map(([x, y]) => `${fmt(x)},${fmt(y)}`).join(' ');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}">`
    + `<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${GRADIENT[0]}"/><stop offset="1" stop-color="${GRADIENT[1]}"/></linearGradient></defs>`
    + `<rect width="${SIZE}" height="${SIZE}" rx="${RADIUS}" fill="url(#g)"/>`
    + `<g fill="none" stroke="#fff" stroke-width="${STROKE}" stroke-linecap="round" stroke-linejoin="round">${chevrons}</g>`
    + `<polygon points="${star}" fill="#fff"/>`
    + '</svg>\n';
}

function hex(c) { return [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16)); }

function insideRoundedRect(x, y) {
  if (x < 0 || y < 0 || x > SIZE || y > SIZE) return false;
  const dx = Math.max(RADIUS - x, 0, x - (SIZE - RADIUS));
  const dy = Math.max(RADIUS - y, 0, y - (SIZE - RADIUS));
  return dx * dx + dy * dy <= RADIUS * RADIUS;
}

function segmentDistance(px, py, [ax, ay], [bx, by]) {
  const vx = bx - ax; const vy = by - ay;
  const t = Math.max(0, Math.min(1, ((px - ax) * vx + (py - ay) * vy) / (vx * vx + vy * vy)));
  return Math.hypot(px - (ax + t * vx), py - (ay + t * vy));
}

function insidePolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i]; const [xj, yj] = pts[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function onMark(x, y, star) {
  for (const line of CHEVRONS) for (let i = 1; i < line.length; i++) {
    if (segmentDistance(x, y, line[i - 1], line[i]) <= STROKE / 2) return true;
  }
  return insidePolygon(x, y, star);
}

/** size x size 크기의 BGRA(미리 곱한 알파) 비트맵. 4x4 샘플로 가장자리를 부드럽게 한다. */
function logoBitmap(size) {
  const buf = Buffer.alloc(size * size * 4);
  const [from, to] = GRADIENT.map(hex);
  const star = starPoints();
  const S = 4; const scale = SIZE / size;
  for (let py = 0; py < size; py++) for (let px = 0; px < size; px++) {
    let r = 0; let g = 0; let b = 0; let a = 0;
    for (let sy = 0; sy < S; sy++) for (let sx = 0; sx < S; sx++) {
      const x = (px + (sx + 0.5) / S) * scale; const y = (py + (sy + 0.5) / S) * scale;
      if (!insideRoundedRect(x, y)) continue;
      a += 1;
      if (onMark(x, y, star)) { r += 255; g += 255; b += 255; continue; }
      const t = Math.max(0, Math.min(1, (x + y) / (2 * SIZE)));
      r += from[0] + (to[0] - from[0]) * t; g += from[1] + (to[1] - from[1]) * t; b += from[2] + (to[2] - from[2]) * t;
    }
    const n = S * S; const i = (py * size + px) * 4;
    buf[i] = Math.round(b / n); buf[i + 1] = Math.round(g / n); buf[i + 2] = Math.round(r / n); buf[i + 3] = Math.round((a / n) * 255);
  }
  return buf;
}

module.exports = { logoSvg, logoBitmap };

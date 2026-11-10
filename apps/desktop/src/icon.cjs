// 임시 아이콘: 파란 둥근 사각형 위에 흰 "D" (5단계에서 정식 .ico 로 교체)
const { nativeImage } = require('electron');

const D = [
  '0111110', '0100011', '0100001', '0100001', '0100001', '0100001', '0100011', '0111110',
];

function trayIcon(size = 32) {
  const buf = Buffer.alloc(size * size * 4);
  const r = size * 0.22; const scale = Math.floor(size / 11);
  const ox = Math.floor((size - 7 * scale) / 2); const oy = Math.floor((size - 8 * scale) / 2);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = Math.max(r - x, 0, x - (size - 1 - r)); const dy = Math.max(r - y, 0, y - (size - 1 - r));
    const inside = dx * dx + dy * dy <= r * r;
    const gx = Math.floor((x - ox) / scale); const gy = Math.floor((y - oy) / scale);
    const letter = gx >= 0 && gx < 7 && gy >= 0 && gy < 8 && D[gy][gx] === '1';
    const i = (y * size + x) * 4; // BGRA
    if (!inside) continue;
    if (letter) buf.set([255, 255, 255, 255], i); else buf.set([235, 114, 34, 255], i); // #2272eb
  }
  return nativeImage.createFromBitmap(buf, { width: size, height: size });
}

module.exports = { trayIcon };

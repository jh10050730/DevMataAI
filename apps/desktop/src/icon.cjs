// 트레이·창 아이콘. 모양은 brand.cjs (웹 favicon 과 같은 로고).
const { nativeImage } = require('electron');
const { logoBitmap } = require('./brand.cjs');

function logoImage(size) {
  const image = nativeImage.createFromBitmap(logoBitmap(size), { width: size, height: size });
  // 화면 배율 150%·200% 에서도 선명하게
  for (const scaleFactor of [1.5, 2]) {
    const s = Math.round(size * scaleFactor);
    image.addRepresentation({ scaleFactor, width: s, height: s, buffer: logoBitmap(s) });
  }
  return image;
}

const trayIcon = () => logoImage(16);
const windowIcon = () => nativeImage.createFromBitmap(logoBitmap(256), { width: 256, height: 256 });

module.exports = { trayIcon, windowIcon };

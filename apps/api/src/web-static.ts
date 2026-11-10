import type { NestExpressApplication } from '@nestjs/platform-express';
import type { NextFunction, Request, Response } from 'express';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

/**
 * 데스크톱 앱: 빌드된 웹 화면(apps/web/dist)을 API 와 같은 주소에서 제공한다.
 * /api 는 그대로 API 로 가고, 그 밖의 화면 주소(/calendar 등)는 index.html 로 보낸다(SPA).
 */
export function serveWeb(app: NestExpressApplication, dir: string) {
  const index = join(dir, 'index.html');
  if (!existsSync(index)) throw new Error(`웹 화면 빌드가 없습니다: ${index}`);
  app.useStaticAssets(dir, { index: false, maxAge: '1h', setHeaders: (res, file) => { if (file.endsWith('.html')) res.setHeader('Cache-Control', 'no-store'); } });
  app.use((req: Request, res: Response, next: NextFunction) => {
    if ((req.method !== 'GET' && req.method !== 'HEAD') || req.path === '/api' || req.path.startsWith('/api/') || /\.[a-z0-9]+$/i.test(req.path)) return next();
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(index);
  });
}

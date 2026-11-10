import { Logger } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import type { NestExpressApplication } from '@nestjs/platform-express';
import { AppModule } from './app.module';
import { configureApp } from './app.setup';
import { serveWeb } from './web-static';

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);
  configureApp(app);

  const config = app.get(ConfigService);
  app.enableCors({
    origin: config.get<string>('WEB_ORIGIN', 'http://localhost:5173'),
    credentials: true,
  });
  // 데스크톱 앱은 웹 화면도 같은 서버에서 제공한다.
  const webDist = config.get<string>('WEB_DIST');
  if (webDist) serveWeb(app, webDist);

  const port = config.get<number>('PORT', 3000);
  await app.listen(port, config.get<string>('HOST', '127.0.0.1'));
  Logger.log(`DevMata AI API → http://localhost:${port}/api`, 'Bootstrap');
  // 데스크톱 앱(부모 프로세스)에 준비 완료를 알린다.
  process.send?.({ type: 'ready', port });
}

void bootstrap().catch(error => {
  Logger.error(error instanceof Error ? error.message : String(error), undefined, 'Bootstrap');
  process.exit(1);
});

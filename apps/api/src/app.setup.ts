import { INestApplication, ValidationPipe } from '@nestjs/common';

/** main.ts 와 e2e 테스트가 같은 설정을 쓰도록 분리 */
export function configureApp(app: INestApplication) {
  app.setGlobalPrefix('api');
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // DTO에 없는 필드 제거
      forbidNonWhitelisted: true, // 알 수 없는 필드가 오면 400
      transform: true,
    }),
  );
}

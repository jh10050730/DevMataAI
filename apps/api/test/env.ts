// 각 테스트 워커에서 실행: 테스트 전용 MySQL DB(<개발DB>_test)와 시크릿 사용 (개발 DB와 분리)
import { testDatabaseUrl } from './test-db';

process.env.DATABASE_URL = testDatabaseUrl();
process.env.JWT_SECRET = 'test-secret-that-is-at-least-32-characters-long';
process.env.AI_PROVIDER = 'demo';
process.env.NOTION_TOKEN = ''; // 테스트에서 실제 Notion 호출 금지

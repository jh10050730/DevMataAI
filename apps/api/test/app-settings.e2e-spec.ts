import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/app.setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { NotionService } from '../src/integrations/notion.service';
import { AppSettingsService } from '../src/app-settings/app-settings.service';

describe('administrator app settings', () => {
  let app: INestApplication;
  let admin: string, other: string;
  let originalPassword: string;
  const api = () => request(app.getHttpServer());
  const db = () => app.get(PrismaService);
  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = module.createNestApplication(); configureApp(app); await app.init();
    await db().user.deleteMany(); await db().appSetting.deleteMany();
    originalPassword = app.get(AppSettingsService).getEnv('SMTP_PASSWORD') ?? '';
    admin = (await api().post('/api/auth/register').send({ email: 'admin@test.com', name: '관리자', password: 'password123' }).expect(201)).body.accessToken;
    other = (await api().post('/api/auth/register').send({ email: 'other@test.com', name: '다른 사용자', password: 'password123' }).expect(201)).body.accessToken;
  });
  afterAll(async () => {
    const first = await db().user.findFirst({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }] });
    if (first) await app.get(AppSettingsService).update(first.id, { 'smtp.password': null, 'notion.token': null });
    await db().user.deleteMany(); await app.close();
  });
  it('requires login and the first registered account for reading and saving', async () => {
    await api().get('/api/app-settings').expect(401);
    await api().get('/api/app-settings').set('Authorization', `Bearer ${other}`).expect(403);
    await api().patch('/api/app-settings').set('Authorization', `Bearer ${other}`).send({ values: { 'smtp.password': 'unauthorized' } }).expect(403);
    expect(await db().appSetting.count()).toBe(0);
  });
  it('encrypts persisted secrets, hides them in responses and applies them immediately', async () => {
    const result = await api().patch('/api/app-settings').set('Authorization', `Bearer ${admin}`).send({ values: { 'smtp.password': 'private-password', 'notion.token': 'private-notion-token' } }).expect(200);
    expect(JSON.stringify(result.body)).not.toMatch(/private-password|private-notion-token|v1\./);
    const stored = await db().appSetting.findUniqueOrThrow({ where: { key: 'smtp.password' } });
    expect(stored.secret).toBe(true); expect(stored.value).toMatch(/^v1\./);
    expect(stored.value).not.toContain('private-password');
    expect(app.get(ConfigService).get('SMTP_PASSWORD')).toBe('private-password');
    expect(app.get(NotionService).configured).toBe(true);
    const read = await api().get('/api/app-settings').set('Authorization', `Bearer ${admin}`).expect(200);
    expect(read.body.settings.find((row: { key: string }) => row.key === 'smtp.password')).not.toHaveProperty('value');
  });
  it('validates an entire patch before saving any part of it', async () => {
    await api().patch('/api/app-settings').set('Authorization', `Bearer ${admin}`).send({ values: { 'notion.token': 'should-not-save', 'smtp.port': '65536' } }).expect(400);
    expect(app.get(ConfigService).get('NOTION_TOKEN')).toBe('private-notion-token');
    await api().patch('/api/app-settings').set('Authorization', `Bearer ${admin}`).send({ values: { 'JWT_SECRET': 'arbitrary' } }).expect(400);
    await api().patch('/api/app-settings').set('Authorization', `Bearer ${admin}`).send({ values: {}, userId: 'arbitrary' }).expect(400);
  });
  it('explicit clearing disables a secret and deleting an override restores original defaults', async () => {
    await api().patch('/api/app-settings').set('Authorization', `Bearer ${admin}`).send({ values: { 'smtp.password': '' } }).expect(200);
    expect(app.get(ConfigService).get('SMTP_PASSWORD')).toBe('');
    await api().patch('/api/app-settings').set('Authorization', `Bearer ${admin}`).send({ values: { 'smtp.password': null } }).expect(200);
    expect(await db().appSetting.findUnique({ where: { key: 'smtp.password' } })).toBeNull();
    expect(app.get(ConfigService).get('SMTP_PASSWORD')).toBe(originalPassword);
  });
});

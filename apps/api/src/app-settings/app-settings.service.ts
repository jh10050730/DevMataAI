import { ForbiddenException, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { SETTING_DEFINITIONS } from './settings-schema';
import { prepareSettings, publicSettings, resolveSetting, StoredSetting } from './settings-values';

@Injectable()
export class AppSettingsService implements OnModuleInit {
  private rows: StoredSetting[] = [];
  private readonly defaults: Map<string, string>;
  constructor(private readonly db: PrismaService, private readonly config: ConfigService) {
    this.defaults = new Map(SETTING_DEFINITIONS.map(row => [row.env, config.get<string>(row.env) ?? ({ AI_PROVIDER: 'claude-cli', SMTP_PORT: '587', CLAUDE_CLI_PATH: 'claude' } as Record<string, string>)[row.env] ?? '']));
  }
  async onModuleInit() { await this.reload(); }
  private async reload() {
    this.rows = await this.db.appSetting.findMany();
    // Existing consumers share ConfigService: publish effective settings after startup/save.
    // Preserve immutable original defaults so removing an override really restores .env.
    for (const definition of SETTING_DEFINITIONS) this.config.set(definition.env, this.getEnv(definition.env));
  }
  getEnv(name: string): string | undefined {
    const definition = SETTING_DEFINITIONS.find(row => row.env === name);
    if (!definition) return this.config.get<string>(name);
    return resolveSetting(definition.key, this.rows, env => this.defaults.get(env), this.config.get<string>('JWT_SECRET', ''));
  }
  private async admin(userId: string) {
    const first = await this.db.user.findFirst({ orderBy: [{ createdAt: 'asc' }, { id: 'asc' }], select: { id: true } });
    if (!first || first.id !== userId) throw new ForbiddenException('앱 설정은 처음 가입한 관리자 계정만 변경·조회할 수 있습니다.');
  }
  async read(userId: string) {
    await this.admin(userId);
    return { settings: publicSettings(this.rows, name => this.defaults.get(name)) };
  }
  async update(userId: string, values: unknown) {
    await this.admin(userId);
    const changes = prepareSettings(values, this.config.get<string>('JWT_SECRET', ''));
    await this.db.$transaction(changes.map(row => row.value === null
      ? this.db.appSetting.deleteMany({ where: { key: row.key } })
      : this.db.appSetting.upsert({ where: { key: row.key }, create: { key: row.key, value: row.value, secret: row.secret }, update: { value: row.value, secret: row.secret } })));
    await this.reload();
    return this.read(userId);
  }
}

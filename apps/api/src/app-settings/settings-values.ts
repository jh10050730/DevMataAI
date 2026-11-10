import { ServiceUnavailableException } from '@nestjs/common';
import { decryptToken, encryptToken } from '../calendar/google/google-crypto';
import { SETTING_DEFINITIONS, validateSettingsPatch } from './settings-schema';

export type StoredSetting = { key: string; value: string; secret: boolean };
function encryptionKey(secret: string) {
  if (secret.length < 32) throw new ServiceUnavailableException('앱 암호화 키 설정을 확인해 주세요.');
  return secret;
}
export function prepareSettings(input: unknown, secret: string): (StoredSetting | { key: string; value: null; secret: boolean })[] {
  return Object.entries(validateSettingsPatch(input)).map(([key, value]) => {
    const definition = SETTING_DEFINITIONS.find(row => row.key === key)!;
    return { key, secret: definition.secret, value: value && definition.secret ? encryptToken(value, encryptionKey(secret)) : value };
  });
}
export function resolveSetting(key: string, rows: readonly StoredSetting[], env: (name: string) => string | undefined, secret: string) {
  const definition = SETTING_DEFINITIONS.find(row => row.key === key);
  if (!definition) throw new Error('Unknown setting');
  const row = rows.find(value => value.key === key);
  if (!row) return env(definition.env) ?? '';
  if (!definition.secret || !row.value) return row.value;
  try { return decryptToken(row.value, encryptionKey(secret)); }
  catch { throw new ServiceUnavailableException('저장된 비밀 설정을 읽을 수 없습니다. 관리자 계정에서 다시 입력해 주세요.'); }
}
/** Read APIs may expose normal fields, but secret fields only expose presence and source. */
export function publicSettings(rows: readonly StoredSetting[], env: (name: string) => string | undefined) {
  return SETTING_DEFINITIONS.map(definition => {
    const stored = rows.find(row => row.key === definition.key);
    const value = stored ? stored.value : env(definition.env) ?? '';
    return { key: definition.key, label: definition.label, group: definition.group, secret: definition.secret, configured: !!value, source: stored ? 'app' : value ? 'environment' : 'unset', ...(!definition.secret ? { value } : {}) };
  });
}

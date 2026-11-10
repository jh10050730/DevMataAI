import { prepareSettings, publicSettings, resolveSetting, type StoredSetting } from './settings-values';
import { validateSettingsPatch } from './settings-schema';
const secret = 'a'.repeat(48);
describe('app settings validation and secret storage', () => {
  it('encrypts secrets with independent IVs and resolves them internally', () => {
    const first = prepareSettings({ 'smtp.password': 'private-value' }, secret);
    const second = prepareSettings({ 'smtp.password': 'private-value' }, secret);
    expect(first[0].value).not.toContain('private-value');
    expect(first[0].value).not.toBe(second[0].value);
    expect(resolveSetting('smtp.password', first as StoredSetting[], () => undefined, secret)).toBe('private-value');
  });
  it('does not expose stored secrets or environment secrets in public metadata', () => {
    const rows = prepareSettings({ 'github.token': 'stored-private' }, secret);
    const result = publicSettings(rows as StoredSetting[], name => name === 'SMTP_PASSWORD' ? 'environment-private' : undefined);
    expect(JSON.stringify(result)).not.toMatch(/stored-private|environment-private|v1\./);
    expect(result.find(row => row.key === 'github.token')).toMatchObject({ configured: true, source: 'app' });
    expect(result.find(row => row.key === 'smtp.password')).not.toHaveProperty('value');
  });
  it('prefers saved values, including intentional empty overrides, over environment defaults', () => {
    expect(resolveSetting('smtp.host', [{ key: 'smtp.host', value: '', secret: false }], () => 'env-host', secret)).toBe('');
    expect(resolveSetting('smtp.host', [], () => 'env-host', secret)).toBe('env-host');
    expect(prepareSettings({ 'smtp.password': null }, secret)[0].value).toBeNull();
  });
  it('fails closed when ciphertext is tampered with or the key changes', () => {
    const rows = prepareSettings({ 'github.token': 'private' }, secret);
    expect(() => resolveSetting('github.token', rows as StoredSetting[], () => 'fallback-private', 'b'.repeat(48))).toThrow('저장된');
    expect(() => prepareSettings({ 'github.token': 'private' }, 'short')).toThrow();
  });
  it.each([{ 'unknown.key': 'x' }, { 'smtp.port': '0' }, { 'smtp.port': '65536' }, { 'smtp.port': '587x' }, { 'smtp.from': 'bad-email' }, { 'smtp.password': 'private\nheader' }, { 'ai.provider': 'arbitrary' }, { 'google.redirectUri': 'http://external.example/callback' }])('rejects invalid patches without echoing values', input => {
    expect(() => validateSettingsPatch(input)).toThrow();
  });
});

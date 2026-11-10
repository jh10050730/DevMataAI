import { databaseFile, resolveDatabaseUrl } from './database-url';

describe('resolveDatabaseUrl', () => {
  it('resolves relative SQLite paths against the prisma folder like the Prisma CLI', () => {
    expect(resolveDatabaseUrl('file:../data/x.db', '/repo/apps/api/prisma')).toMatch(/\/repo\/apps\/api\/data\/x\.db$/);
  });
  it('keeps absolute paths and query parameters, with forward slashes', () => {
    expect(resolveDatabaseUrl('file:C:\\Users\\me\\devmata.db?connection_limit=1')).toBe('file:C:/Users/me/devmata.db?connection_limit=1');
    expect(databaseFile('file:C:\\Users\\me\\devmata.db?connection_limit=1')).toBe('C:/Users/me/devmata.db');
  });
  it('rejects missing or non-SQLite addresses', () => {
    expect(() => resolveDatabaseUrl(undefined)).toThrow();
    expect(() => resolveDatabaseUrl('mysql://u:p@localhost/devmate')).toThrow();
    expect(() => resolveDatabaseUrl('file:')).toThrow();
  });
});

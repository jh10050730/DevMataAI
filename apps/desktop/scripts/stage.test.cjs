const test = require('node:test');
const assert = require('node:assert/strict');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { tmpdir } = require('node:os');
const { basename, join, sep } = require('node:path');
const { collectPackages, writeIco } = require('./stage.cjs');

test('installer bundles only the packages the API needs at runtime', () => {
  const names = collectPackages().map(dir => dir.split(`node_modules${sep}`).pop().replace(/\\/g, '/'));
  for (const need of ['@nestjs/core', '@prisma/client', 'reflect-metadata', 'bcryptjs', 'linkedom']) assert.ok(names.includes(need), `${need} 가 빠졌습니다`);
  // 개발 도구는 들어가면 안 된다 (설치 파일이 커진다)
  for (const dev of ['typescript', 'prisma', 'electron', 'jest', 'vite', '@nestjs/cli']) assert.ok(!names.includes(dev), `${dev} 가 들어갔습니다`);
});

test('icon file holds every size as PNG', () => {
  const dir = mkdtempSync(join(tmpdir(), 'devmata-ico-'));
  try {
    const file = join(dir, 'icon.ico');
    writeIco(file, [16, 32, 256]);
    const ico = readFileSync(file);
    assert.equal(ico.readUInt16LE(2), 1); // 아이콘
    assert.equal(ico.readUInt16LE(4), 3);
    assert.deepEqual([ico[6], ico[22], ico[38]], [16, 32, 0]); // 256 은 0 으로 적는다
    const first = ico.readUInt32LE(6 + 12);
    assert.equal(ico.subarray(first + 1, first + 4).toString('ascii'), 'PNG');
    assert.equal(basename(file), 'icon.ico');
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('installer defaults carry only the Google app client, never personal tokens', () => {
  const { appDefaults, parseEnvFile } = require('./stage.cjs');
  const { writeFileSync } = require('node:fs');
  const dir = mkdtempSync(join(tmpdir(), 'devmata-env-'));
  try {
    const envFile = join(dir, '.env');
    writeFileSync(envFile, '﻿# 주석\nGOOGLE_CLIENT_ID="id-from-file"\nGOOGLE_CLIENT_SECRET=secret-from-file\nNOTION_TOKEN="ntn_personal"\nGITHUB_TOKEN=ghp_personal\n');
    assert.equal(parseEnvFile('A="x y"\n# B=1\nC=\'z\'').A, 'x y');
    assert.deepEqual(appDefaults({}, envFile), { GOOGLE_CLIENT_ID: 'id-from-file', GOOGLE_CLIENT_SECRET: 'secret-from-file' });
    assert.equal(appDefaults({ GOOGLE_CLIENT_ID: 'id-from-env' }, envFile).GOOGLE_CLIENT_ID, 'id-from-env');
    assert.deepEqual(appDefaults({}, join(dir, 'missing.env')), {});
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

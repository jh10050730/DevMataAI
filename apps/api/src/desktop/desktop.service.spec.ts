import { ConflictException, ForbiddenException, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { DesktopService, parseUpdateState } from './desktop.service';
import type { PrismaService } from '../prisma/prisma.service';

describe('DesktopService.open', () => {
  const previous = process.env.DEVMATA_DESKTOP;
  const db = { user: { findFirst: jest.fn().mockResolvedValue({ id: 'admin' }) } } as unknown as PrismaService;
  const service = new DesktopService(db);

  beforeEach(() => { process.env.DEVMATA_DESKTOP = '1'; });
  afterAll(() => { if (previous === undefined) delete process.env.DEVMATA_DESKTOP; else process.env.DEVMATA_DESKTOP = previous; });

  it('관리자가 요청하면 앱에 폴더 이름만 보낸다 (경로는 앱이 정한다)', async () => {
    const send = jest.fn().mockReturnValue(true);
    await service.open('admin', 'logs', send);
    expect(send).toHaveBeenCalledWith({ type: 'open-folder', target: 'logs' });
  });

  it('관리자가 아니면 보내지 않는다', async () => {
    const send = jest.fn().mockReturnValue(true);
    await expect(service.open('someone', 'data', send)).rejects.toBeInstanceOf(ForbiddenException);
    expect(send).not.toHaveBeenCalled();
  });

  it('앱과 연결이 없으면 503', async () => {
    await expect(service.open('admin', 'data', null)).rejects.toBeInstanceOf(ServiceUnavailableException);
    await expect(service.open('admin', 'data', () => false)).rejects.toBeInstanceOf(ServiceUnavailableException);
  });
});

describe('업데이트 상태와 요청', () => {
  const previous = process.env.DEVMATA_DESKTOP;
  const db = {} as PrismaService;
  beforeEach(() => { process.env.DEVMATA_DESKTOP = '1'; });
  afterAll(() => { if (previous === undefined) delete process.env.DEVMATA_DESKTOP; else process.env.DEVMATA_DESKTOP = previous; });

  it('앱이 보낸 상태에서 정해진 필드만 받는다', () => {
    expect(parseUpdateState({ type: 'update-state', state: 'downloading', version: '0.2.0', percent: 41.6, extra: 'x' })).toEqual({ state: 'downloading', version: '0.2.0', percent: 42 });
    expect(parseUpdateState({ type: 'update-state', state: 'error', error: 'e'.repeat(500) })?.error).toHaveLength(300);
    expect(parseUpdateState({ type: 'update-state', state: 'hacked' })).toBeNull();
    expect(parseUpdateState({ type: 'update-state', state: 'ready', version: '<script>' })).toEqual({ state: 'ready' });
    expect(parseUpdateState({ type: 'open-app', state: 'ready' })).toBeNull();
  });

  it('받은 상태를 앱 정보에 보여 주고, 받아 둔 업데이트가 있을 때만 설치를 보낸다', () => {
    const service = new DesktopService(db);
    const send = jest.fn().mockReturnValue(true);
    expect(service.info()).toMatchObject({ desktop: true, update: undefined });
    expect(() => service.requestUpdate('install', send)).toThrow(ConflictException);
    service.requestUpdate('check', send);
    expect(send).toHaveBeenLastCalledWith({ type: 'update', action: 'check' });

    service.receive({ type: 'update-state', state: 'ready', version: '0.2.0' });
    expect(service.info()).toMatchObject({ update: { state: 'ready', version: '0.2.0' } });
    service.requestUpdate('install', send);
    expect(send).toHaveBeenLastCalledWith({ type: 'update', action: 'install' });
  });

  it('웹 실행에서는 404', () => {
    delete process.env.DEVMATA_DESKTOP;
    expect(() => new DesktopService(db).requestUpdate('check', jest.fn())).toThrow(NotFoundException);
  });
});

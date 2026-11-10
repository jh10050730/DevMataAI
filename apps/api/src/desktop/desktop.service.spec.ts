import { ForbiddenException, ServiceUnavailableException } from '@nestjs/common';
import { DesktopService } from './desktop.service';
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

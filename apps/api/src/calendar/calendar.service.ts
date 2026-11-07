import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto, EventRangeDto, UpdateEventDto } from './events.dto';

const MAX_RANGE_DAYS = 400;

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  /** 기간과 겹치는 일정 (기간 걸친 일정 포함) */
  list(userId: string, { from, to }: EventRangeDto) {
    if (to <= from) throw new BadRequestException('to 는 from 보다 뒤여야 합니다.');
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
      throw new BadRequestException(`조회 기간은 최대 ${MAX_RANGE_DAYS}일입니다.`);
    }
    return this.prisma.event.findMany({
      where: { userId, startAt: { lt: to }, endAt: { gt: from } },
      orderBy: { startAt: 'asc' },
    });
  }

  /** 지금부터 N일 안에 시작하는 일정 */
  upcoming(userId: string, days = 7, take = 10) {
    const now = new Date();
    return this.prisma.event.findMany({
      where: { userId, startAt: { gte: now, lt: new Date(now.getTime() + days * 86_400_000) } },
      orderBy: { startAt: 'asc' },
      take,
    });
  }

  create(userId: string, dto: CreateEventDto) {
    CalendarService.assertRange(dto.startAt, dto.endAt);
    return this.prisma.event.create({ data: { ...dto, userId } });
  }

  async update(userId: string, id: string, dto: UpdateEventDto) {
    const existing = await this.findOwned(userId, id);
    CalendarService.assertLocal(existing);
    CalendarService.assertRange(dto.startAt ?? existing.startAt, dto.endAt ?? existing.endAt);
    return this.prisma.event.update({ where: { id }, data: dto });
  }

  async remove(userId: string, id: string) {
    CalendarService.assertLocal(await this.findOwned(userId, id));
    await this.prisma.event.delete({ where: { id } });
    return { id };
  }

  /** Google 에서 가져온 일정은 읽기 전용 (수정·삭제는 Google Calendar 에서, 다음 동기화 때 반영) */
  static assertLocal(event: { source: string }) {
    if (event.source !== 'LOCAL') {
      throw new BadRequestException('Google Calendar 에서 가져온 일정은 여기서 수정·삭제할 수 없습니다. Google Calendar 에서 변경한 뒤 동기화해주세요.');
    }
  }

  static assertRange(startAt: Date, endAt: Date) {
    if (endAt < startAt) throw new BadRequestException('종료 시간은 시작 시간보다 뒤여야 합니다.');
  }

  private async findOwned(userId: string, id: string) {
    const event = await this.prisma.event.findFirst({ where: { id, userId } });
    if (!event) throw new NotFoundException('일정을 찾을 수 없습니다.');
    return event;
  }
}

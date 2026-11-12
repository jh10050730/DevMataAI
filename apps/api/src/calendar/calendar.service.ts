import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateEventDto, EventRangeDto, UpdateEventDto } from './events.dto';
import { eventRangeWhere, expandEvents } from '../common/recurrence';

const MAX_RANGE_DAYS = 400;

@Injectable()
export class CalendarService {
  constructor(private readonly prisma: PrismaService) {}

  /** 기간과 겹치는 일정 (기간 걸친 일정 포함). 반복 일정은 회차마다 하나씩 펼친다 */
  async list(userId: string, { from, to }: EventRangeDto) {
    if (to <= from) throw new BadRequestException('to 는 from 보다 뒤여야 합니다.');
    if (to.getTime() - from.getTime() > MAX_RANGE_DAYS * 86_400_000) {
      throw new BadRequestException(`조회 기간은 최대 ${MAX_RANGE_DAYS}일입니다.`);
    }
    return CalendarService.inRange(this.prisma, userId, from, to);
  }

  /** 기간 안의 일정 회차 (다른 모듈도 같은 규칙으로 쓴다) */
  static async inRange(db: Pick<PrismaService, 'event'>, userId: string, from: Date, to: Date) {
    const rows = await db.event.findMany({ where: { userId, ...eventRangeWhere(from, to) }, orderBy: { startAt: 'asc' } });
    return expandEvents(rows, from, to);
  }

  /** 지금부터 N일 안에 시작하는 일정 (반복 일정은 회차로) */
  async upcoming(userId: string, days = 7, take = 10) {
    const now = new Date();
    const rows = await CalendarService.inRange(this.prisma, userId, now, new Date(now.getTime() + days * 86_400_000));
    return rows.filter(e => e.startAt >= now).slice(0, take);
  }

  create(userId: string, dto: CreateEventDto) {
    CalendarService.assertRange(dto.startAt, dto.endAt);
    CalendarService.assertRepeat(dto.repeat, dto.startAt, dto.repeatUntil);
    return this.prisma.event.create({ data: { ...dto, repeatUntil: dto.repeat ? dto.repeatUntil : undefined, userId } });
  }

  async update(userId: string, id: string, dto: UpdateEventDto) {
    const existing = await this.findOwned(userId, id);
    CalendarService.assertLocal(existing);
    CalendarService.assertRange(dto.startAt ?? existing.startAt, dto.endAt ?? existing.endAt);
    const repeat = dto.repeat === undefined ? existing.repeat : dto.repeat;
    CalendarService.assertRepeat(repeat, dto.startAt ?? existing.startAt, dto.repeatUntil === undefined ? existing.repeatUntil : dto.repeatUntil);
    // 반복을 끄면 반복 끝도 지운다
    return this.prisma.event.update({ where: { id }, data: { ...dto, ...(repeat ? {} : { repeatUntil: null }) } });
  }

  static assertRepeat(repeat: string | null | undefined, startAt: Date, until: Date | null | undefined) {
    if (repeat && until && until < startAt) throw new BadRequestException('반복 끝은 첫 일정보다 뒤여야 합니다.');
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

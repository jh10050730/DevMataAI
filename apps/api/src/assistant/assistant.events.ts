import { BadRequestException } from '@nestjs/common';
import { isISO8601 } from 'class-validator';
import { ActionDto } from './assistant.dto';

/** Both HTTP proposals and model-generated proposals pass the same validation. */
export function eventPayload(dto: Pick<ActionDto, 'title' | 'description' | 'location' | 'startAt' | 'endAt' | 'allDay'>): Record<string, string> {
  const title = dto.title?.trim();
  if (!title || title.length > 200) throw new BadRequestException('일정 제목을 입력하세요. (최대 200자)');
  const date = (value?: string) => {
    if (!value || !isISO8601(value, { strict: true }) || !/T.*(?:Z|[+-]\d{2}:\d{2})$/i.test(value)) throw new BadRequestException('일정의 시작·종료 날짜와 시간대를 확인해 주세요.');
    const parsed = new Date(value);
    if (!Number.isFinite(+parsed)) throw new BadRequestException('일정 날짜가 올바르지 않습니다.');
    return parsed;
  };
  const start = date(dto.startAt), end = date(dto.endAt);
  if (end <= start) throw new BadRequestException('일정 종료 시간은 시작 시간보다 뒤여야 합니다.');
  if (dto.allDay !== undefined && typeof dto.allDay !== 'boolean') throw new BadRequestException('종일 일정 여부를 확인해 주세요.');
  if ((dto.description?.length ?? 0) > 5000 || (dto.location?.length ?? 0) > 200) throw new BadRequestException('일정 설명·장소가 너무 깁니다.');
  if (dto.allDay) {
    const midnight = (value: Date) => new Date(+value + 9 * 3600000).toISOString().endsWith('T00:00:00.000Z');
    if (!midnight(start) || !midnight(end)) throw new BadRequestException('종일 일정은 한국 시간 자정부터 마지막 날짜 다음 날 자정까지 지정해 주세요.');
  }
  return { title, startAt: start.toISOString(), endAt: end.toISOString(), allDay: String(dto.allDay ?? false), description: dto.description?.trim() ?? '', location: dto.location?.trim() ?? '' };
}

import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateNoteDto, StudySessionDto, SubjectDto, UpdateNoteDto } from './study.dto';
import { normalizeTags, reviewSchedule } from './study.logic';

@Injectable()
export class StudyService {
  constructor(private readonly db: PrismaService) {}
  subjects(userId: string) { return this.db.studySubject.findMany({ where: { userId }, orderBy: { name: 'asc' } }); }
  async subject(userId: string, data: SubjectDto, id?: string) {
    const name = data.name.trim();
    if (!name) throw new BadRequestException('과목명을 입력하세요.');
    if (id && !await this.db.studySubject.findFirst({ where: { id, userId } })) throw new NotFoundException('과목을 찾을 수 없습니다.');
    try {
      return id ? await this.db.studySubject.update({ where: { id }, data: { name, color: data.color } })
        : await this.db.studySubject.create({ data: { userId, name, color: data.color } });
    } catch (e: any) { if (e.code === 'P2002') throw new ConflictException('이미 있는 과목입니다.'); throw e; }
  }
  async deleteSubject(userId: string, id: string) {
    if (!await this.db.studySubject.findFirst({ where: { id, userId } })) throw new NotFoundException();
    await this.db.studySubject.delete({ where: { id } });
    return { deleted: true };
  }
  async notes(userId: string, q = '', subjectId?: string, tag?: string, due?: string) {
    if (q.length > 200) throw new BadRequestException('검색어는 200자 이하로 입력하세요.');
    const notes = await this.db.studyNote.findMany({
      where: { userId, ...(subjectId ? { subjectId } : {}), ...(q ? { OR: [{ title: { contains: q } }, { content: { contains: q } }] } : {}) },
      include: { subject: true }, orderBy: { updatedAt: 'desc' },
    });
    return notes.map(n => this.serialize(n)).filter(n => (!tag || n.tags.includes(tag)) && (due !== 'true' || n.reviewDue));
  }
  async note(userId: string, id: string) {
    const note = await this.db.studyNote.findFirst({ where: { id, userId }, include: { subject: true } });
    if (!note) throw new NotFoundException('학습 노트를 찾을 수 없습니다.');
    return this.serialize(note);
  }
  async save(userId: string, data: CreateNoteDto | UpdateNoteDto, id?: string) {
    if (id) await this.note(userId, id);
    if (data.subjectId && !await this.db.studySubject.findFirst({ where: { id: data.subjectId, userId } })) throw new NotFoundException('과목을 찾을 수 없습니다.');
    if (data.title !== undefined && !data.title.trim()) throw new BadRequestException('제목을 입력하세요.');
    const values = { ...data, title: data.title?.trim(), subjectId: data.subjectId === '' ? null : data.subjectId,
      tags: data.tags ? JSON.stringify(normalizeTags(data.tags)) : undefined };
    const result = id ? await this.db.studyNote.update({ where: { id }, data: values, include: { subject: true } })
      : await this.db.studyNote.create({ data: { ...values, content: data.content ?? "", title: data.title!.trim(), userId }, include: { subject: true } });
    return this.serialize(result);
  }
  async remove(userId: string, id: string) {
    await this.note(userId, id);
    await this.db.studyNote.delete({ where: { id } });
    return { deleted: true };
  }
  async studied(userId: string, id: string, data: StudySessionDto) {
    const note = await this.note(userId, id);
    const now = new Date();
    const updated = await this.db.studyNote.update({ where: { id }, data: {
      lastStudiedAt: now, nextReviewAt: reviewSchedule(note.reviewCount, data.rating, now),
      reviewCount: data.rating === 'again' ? 0 : { increment: 1 }, progress: data.progress,
    }, include: { subject: true } });
    return this.serialize(updated);
  }
  async overview(userId: string) {
    const [notes, subjects] = await Promise.all([this.notes(userId), this.subjects(userId)]);
    const rows = [...subjects.map(s => ({ id: s.id, name: s.name, color: s.color })), { id: null, name: '미분류', color: '#64748b' }];
    const tags = [...new Set(notes.flatMap(n => n.tags))].sort();
    return { total: notes.length, due: notes.filter(n => n.reviewDue).length, tags,
      subjects: rows.map(s => { const group = notes.filter(n => n.subjectId === s.id); return { ...s, total: group.length,
        completed: group.filter(n => n.progress === 100).length, due: group.filter(n => n.reviewDue).length,
        progress: group.length ? Math.round(group.reduce((sum, n) => sum + n.progress, 0) / group.length) : 0 }; }),
    };
  }
  private serialize<T extends { tags: string; nextReviewAt: Date | null; lastStudiedAt: Date | null }>(note: T) {
    return { ...note, tags: JSON.parse(note.tags) as string[], reviewDue: !note.lastStudiedAt || (!!note.nextReviewAt && note.nextReviewAt <= new Date()) };
  }
}

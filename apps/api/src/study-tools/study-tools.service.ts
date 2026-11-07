import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { AiService } from '../ai/ai.service';
import { blocksToMarkdown, contentHash, markdownToBlocks } from '../integrations/notion.markdown';
import { NotionService } from '../integrations/notion.service';
import { PrismaService } from '../prisma/prisma.service';
import { notionPageId } from '../study/study.logic';
import { buildStudyPrompt, STUDY_SYSTEM_PROMPT } from './study-ai.prompts';
import { NotionExportRequestDto, NotionImportRequestDto, StudyAiRequestDto } from './study-tools.dto';

@Injectable()
export class StudyToolsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ai: AiService,
    private readonly notion: NotionService,
  ) {}

  private async ownedNote(userId: string, id: string) {
    const note = await this.prisma.studyNote.findFirst({ where: { id, userId } });
    if (!note) throw new NotFoundException('학습 노트를 찾을 수 없습니다.');
    return note;
  }

  /** 학습 노트 기반 AI 기능 (요약 / 설명 / 용어 / 문제 / 질문) */
  async runAi(userId: string, noteId: string, dto: StudyAiRequestDto) {
    const note = await this.ownedNote(userId, noteId);
    if (dto.action !== 'ask' && dto.action !== 'explain' && !note.content.trim()) {
      throw new BadRequestException('노트 내용이 비어 있습니다. 내용을 작성한 뒤 다시 시도해주세요.');
    }
    const result = await this.ai.complete(userId, `study:${dto.action}`, {
      system: STUDY_SYSTEM_PROMPT,
      prompt: buildStudyPrompt(dto.action, note, dto.question),
    });
    return { action: dto.action, ...result };
  }

  /** Notion 페이지 → 학습 노트. 같은 페이지를 다시 가져오면 새로 만들지 않고 기존 노트를 갱신한다. */
  async importFromNotion(userId: string, dto: NotionImportRequestDto) {
    const pageId = notionPageId(dto.page);
    if (!pageId) throw new BadRequestException('올바른 Notion 페이지 링크 또는 ID가 아닙니다.');
    if (dto.subjectId && !(await this.prisma.studySubject.findFirst({ where: { id: dto.subjectId, userId } }))) {
      throw new NotFoundException('과목을 찾을 수 없습니다.');
    }

    const [title, blocks] = await Promise.all([this.notion.getPageTitle(pageId), this.notion.getBlocks(pageId)]);
    const { markdown, skipped } = blocksToMarkdown(blocks);
    const data = {
      title: title.slice(0, 200),
      content: markdown.slice(0, 50_000),
      notionSavedAt: new Date(),
      notionHash: contentHash(title, markdown),
    };

    const existing = await this.prisma.studyNote.findUnique({ where: { userId_notionPageId: { userId, notionPageId: pageId } } });
    const note = existing
      ? await this.prisma.studyNote.update({ where: { id: existing.id }, data })
      : await this.prisma.studyNote.create({ data: { ...data, userId, notionPageId: pageId, subjectId: dto.subjectId || null } });

    return { noteId: note.id, created: !existing, skippedBlocks: skipped, truncated: markdown.length > 50_000 };
  }

  /**
   * 학습 노트 → Notion.
   * - 내용이 마지막 저장 이후 바뀌지 않았으면 아무것도 하지 않음 (중복 저장 방지)
   * - 연결된 페이지가 없으면 NOTION_PARENT_PAGE_ID 아래에 새 페이지 생성
   * - 연결된 페이지가 있으면 덮어쓰기 전에 사용자 확인(replace=true) 필요
   */
  async exportToNotion(userId: string, noteId: string, dto: NotionExportRequestDto) {
    const note = await this.ownedNote(userId, noteId);
    if (!this.notion.configured) {
      throw new BadRequestException('Notion 이 연결되지 않았습니다. apps/api/.env 에 NOTION_TOKEN 을 설정해주세요.');
    }
    const hash = contentHash(note.title, note.content);

    if (note.notionPageId && note.notionHash === hash) {
      return { status: 'unchanged' as const, notionPageId: note.notionPageId };
    }

    const blocks = markdownToBlocks(note.content);
    if (note.notionPageId) {
      if (!dto.replace) {
        throw new ConflictException('이 노트와 연결된 Notion 페이지가 있습니다. 덮어쓰려면 확인이 필요합니다.');
      }
      await this.notion.replaceContent(note.notionPageId, note.title, blocks);
      await this.prisma.studyNote.update({ where: { id: note.id }, data: { notionHash: hash, notionSavedAt: new Date() } });
      return { status: 'updated' as const, notionPageId: note.notionPageId };
    }

    const parent = this.notion.parentPageId;
    if (!parent) {
      throw new BadRequestException('저장할 Notion 상위 페이지가 없습니다. apps/api/.env 에 NOTION_PARENT_PAGE_ID 를 설정해주세요.');
    }
    const page = await this.notion.createPage(parent, note.title, blocks);
    const pageId = page.id.replace(/-/g, '');
    await this.prisma.studyNote.update({
      where: { id: note.id },
      data: { notionPageId: pageId, notionHash: hash, notionSavedAt: new Date() },
    });
    return { status: 'created' as const, notionPageId: pageId, url: page.url };
  }
}

import { HttpException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { notionPageId } from '../study/study.logic';
import { NotionBlock } from './notion.markdown';

const API = 'https://api.notion.com/v1';
const VERSION = '2022-06-28';
const MAX_BLOCKS = 1000;

/**
 * Notion REST API 클라이언트 (Internal Integration 토큰 사용).
 * 권한 범위: Notion 에서 이 integration 에 "연결(공유)"한 페이지만 접근 가능하다.
 * 토큰은 서버 환경변수에만 있고 프론트엔드나 로그로 나가지 않는다.
 */
@Injectable()
export class NotionService {
  constructor(private readonly config: ConfigService) {}

  private get token() {
    return this.config.get<string>('NOTION_TOKEN') || '';
  }
  /** 링크 또는 ID 모두 허용 */
  get parentPageId() {
    const raw = this.config.get<string>('NOTION_PARENT_PAGE_ID') || '';
    return raw ? (notionPageId(raw) ?? '') : '';
  }
  get configured() {
    return !!this.token;
  }

  async status() {
    if (!this.configured) {
      return { configured: false, ok: false, detail: 'NOTION_TOKEN 이 설정되지 않았습니다.', canExport: false };
    }
    try {
      const me = await this.request<{ name?: string; bot?: { workspace_name?: string } }>('GET', '/users/me');
      return {
        configured: true,
        ok: true,
        detail: `${me.bot?.workspace_name ?? me.name ?? 'Notion'} 연결됨`,
        canExport: !!this.parentPageId,
      };
    } catch (e) {
      return { configured: true, ok: false, detail: e instanceof Error ? e.message : '연결 실패', canExport: false };
    }
  }

  async getPageTitle(pageId: string) {
    const page = await this.request<{ properties?: Record<string, { type: string; title?: { plain_text: string }[] }> }>(
      'GET',
      `/pages/${pageId}`,
    );
    const prop = Object.values(page.properties ?? {}).find((p) => p.type === 'title');
    return prop?.title?.map((t) => t.plain_text).join('').trim() || '제목 없음';
  }

  /** 페이지의 최상위 블록 (하위 블록은 가져오지 않음) */
  async getBlocks(pageId: string) {
    const blocks: NotionBlock[] = [];
    let cursor: string | undefined;
    do {
      const qs = `page_size=100${cursor ? `&start_cursor=${cursor}` : ''}`;
      const res = await this.request<{ results: NotionBlock[]; has_more: boolean; next_cursor: string | null }>(
        'GET',
        `/blocks/${pageId}/children?${qs}`,
      );
      blocks.push(...res.results);
      cursor = res.has_more && res.next_cursor ? res.next_cursor : undefined;
    } while (cursor && blocks.length < MAX_BLOCKS);
    return blocks;
  }

  async createPage(parentId: string, title: string, blocks: Record<string, unknown>[]) {
    const page = await this.request<{ id: string; url: string }>('POST', '/pages', {
      parent: { page_id: parentId },
      properties: { title: { title: [{ type: 'text', text: { content: title.slice(0, 2000) } }] } },
      children: blocks.slice(0, 100),
    });
    await this.append(page.id, blocks.slice(100));
    return page;
  }

  /** 페이지 본문을 새 내용으로 교체 (기존 블록은 보관(archive) 처리 — Notion 휴지통에서 복구 가능) */
  async replaceContent(pageId: string, title: string, blocks: Record<string, unknown>[]) {
    const old = await this.getBlocks(pageId);
    for (const b of old) {
      if (typeof b.id === 'string') await this.request('DELETE', `/blocks/${b.id}`);
    }
    await this.request('PATCH', `/pages/${pageId}`, {
      properties: { title: { title: [{ type: 'text', text: { content: title.slice(0, 2000) } }] } },
    });
    await this.append(pageId, blocks);
  }

  private async append(pageId: string, blocks: Record<string, unknown>[]) {
    for (let i = 0; i < blocks.length; i += 100) {
      await this.request('PATCH', `/blocks/${pageId}/children`, { children: blocks.slice(i, i + 100) });
    }
  }

  private async request<T = unknown>(method: string, path: string, body?: unknown): Promise<T> {
    if (!this.configured) {
      throw new HttpException('Notion 이 연결되지 않았습니다. apps/api/.env 에 NOTION_TOKEN 을 설정해주세요.', 400);
    }
    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${this.token}`,
          'Notion-Version': VERSION,
          'Content-Type': 'application/json',
        },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(20_000),
      });
    } catch {
      throw new HttpException('Notion 서버에 연결할 수 없습니다.', 502);
    }
    if (res.ok) return (await res.json()) as T;

    const err = (await res.json().catch(() => ({}))) as { message?: string };
    if (res.status === 401) throw new HttpException('Notion 토큰이 올바르지 않습니다.', 400);
    if (res.status === 404 || res.status === 403) {
      throw new HttpException(
        'Notion 페이지를 찾을 수 없습니다. 페이지의 ··· → 연결(Connections)에서 이 integration 을 추가했는지 확인해주세요.',
        404,
      );
    }
    if (res.status === 429) throw new HttpException('Notion 요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.', 429);
    throw new HttpException(`Notion 오류: ${err.message ?? res.status}`, 502);
  }
}

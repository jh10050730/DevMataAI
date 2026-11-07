import { createHash } from 'node:crypto';

/**
 * Notion 블록 ↔ Markdown 변환 (순수 함수, 단위 테스트 대상).
 * 지원 범위: 제목(1~3), 문단, 글머리/번호 목록, 체크박스, 인용, 코드, 구분선.
 * 지원하지 않는 블록(이미지, 표, 데이터베이스 등)은 건너뛰고 개수를 알려준다.
 */

interface RichText {
  plain_text?: string;
  text?: { content: string };
}

export interface NotionBlock {
  type: string;
  has_children?: boolean;
  [key: string]: unknown;
}

const plain = (rt: unknown): string =>
  Array.isArray(rt) ? (rt as RichText[]).map((t) => t.plain_text ?? t.text?.content ?? '').join('') : '';

export function blocksToMarkdown(blocks: NotionBlock[]): { markdown: string; skipped: number } {
  const lines: string[] = [];
  let skipped = 0;
  let numbered = 0;

  for (const b of blocks) {
    const data = (b[b.type] ?? {}) as { rich_text?: unknown; checked?: boolean; language?: string };
    const text = plain(data.rich_text);
    if (b.type !== 'numbered_list_item') numbered = 0;

    switch (b.type) {
      case 'heading_1':
        lines.push(`# ${text}`, '');
        break;
      case 'heading_2':
        lines.push(`## ${text}`, '');
        break;
      case 'heading_3':
        lines.push(`### ${text}`, '');
        break;
      case 'paragraph':
        lines.push(text, '');
        break;
      case 'bulleted_list_item':
        lines.push(`- ${text}`);
        break;
      case 'numbered_list_item':
        lines.push(`${++numbered}. ${text}`);
        break;
      case 'to_do':
        lines.push(`- [${data.checked ? 'x' : ' '}] ${text}`);
        break;
      case 'quote':
      case 'callout':
        lines.push(`> ${text}`, '');
        break;
      case 'code':
        lines.push('```' + (data.language && data.language !== 'plain text' ? data.language : ''), text, '```', '');
        break;
      case 'divider':
        lines.push('---', '');
        break;
      default:
        skipped++;
    }
  }
  return { markdown: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(), skipped };
}

/** Notion rich_text 한 항목은 2000자 제한 */
function richText(content: string) {
  const chunks: { type: 'text'; text: { content: string } }[] = [];
  for (let i = 0; i < content.length; i += 2000) chunks.push({ type: 'text', text: { content: content.slice(i, i + 2000) } });
  return chunks.length ? chunks : [];
}

const block = (type: string, content: string, extra: Record<string, unknown> = {}) => ({
  object: 'block',
  type,
  [type]: { rich_text: richText(content), ...extra },
});

export function markdownToBlocks(markdown: string) {
  const blocks: Record<string, unknown>[] = [];
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      const code: string[] = [];
      while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i]);
      blocks.push(block('code', code.join('\n'), { language: fence[1].trim() || 'plain text' }));
      continue;
    }
    if (!line.trim()) continue;

    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,3})\s+(.*)$/))) blocks.push(block(`heading_${m[1].length}`, m[2]));
    else if ((m = line.match(/^\s*[-*]\s+\[([ xX])\]\s+(.*)$/))) blocks.push(block('to_do', m[2], { checked: m[1] !== ' ' }));
    else if ((m = line.match(/^\s*[-*]\s+(.*)$/))) blocks.push(block('bulleted_list_item', m[1]));
    else if ((m = line.match(/^\s*\d+[.)]\s+(.*)$/))) blocks.push(block('numbered_list_item', m[1]));
    else if ((m = line.match(/^>\s?(.*)$/))) blocks.push(block('quote', m[1]));
    else if (/^-{3,}$/.test(line.trim())) blocks.push({ object: 'block', type: 'divider', divider: {} });
    else blocks.push(block('paragraph', line));
  }
  return blocks;
}

/** 저장 내용이 바뀌었는지 판단하기 위한 해시 (중복 저장 방지) */
export function contentHash(title: string, markdown: string) {
  return createHash('sha256').update(`${title}\n${markdown}`).digest('hex');
}

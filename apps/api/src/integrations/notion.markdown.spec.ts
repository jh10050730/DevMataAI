import { blocksToMarkdown, contentHash, markdownToBlocks } from './notion.markdown';

const rt = (s: string) => ({ rich_text: [{ plain_text: s }] });

describe('Notion ↔ Markdown', () => {
  it('블록을 마크다운으로 변환하고, 지원하지 않는 블록은 개수만 센다', () => {
    const { markdown, skipped } = blocksToMarkdown([
      { type: 'heading_1', heading_1: rt('운영체제') },
      { type: 'paragraph', paragraph: rt('프로세스와 스레드') },
      { type: 'numbered_list_item', numbered_list_item: rt('하나') },
      { type: 'numbered_list_item', numbered_list_item: rt('둘') },
      { type: 'to_do', to_do: { ...rt('복습'), checked: true } },
      { type: 'code', code: { ...rt('int x = 1;'), language: 'c' } },
      { type: 'image', image: {} },
    ]);
    expect(markdown).toBe('# 운영체제\n\n프로세스와 스레드\n\n1. 하나\n2. 둘\n- [x] 복습\n```c\nint x = 1;\n```');
    expect(skipped).toBe(1);
  });

  it('마크다운을 Notion 블록으로 변환한다', () => {
    const blocks = markdownToBlocks('## 제목\n- 항목\n- [ ] 할 일\n1. 첫째\n> 인용\n---\n```ts\nconst a = 1;\n```\n문단');
    expect(blocks.map((b) => b.type)).toEqual([
      'heading_2', 'bulleted_list_item', 'to_do', 'numbered_list_item', 'quote', 'divider', 'code', 'paragraph',
    ]);
    expect((blocks[6] as { code: { language: string } }).code.language).toBe('ts');
  });

  it('2000자 넘는 문단은 rich_text 여러 개로 나눈다', () => {
    const [b] = markdownToBlocks('가'.repeat(4500)) as { paragraph: { rich_text: unknown[] } }[];
    expect(b.paragraph.rich_text).toHaveLength(3);
  });

  it('내용이 같으면 해시가 같다 (중복 저장 방지)', () => {
    expect(contentHash('a', 'b')).toBe(contentHash('a', 'b'));
    expect(contentHash('a', 'b')).not.toBe(contentHash('a', 'c'));
  });
});

import { describe, expect, it } from 'vitest';
import { parseMarkdown } from './Markdown';

describe('parseMarkdown', () => {
  it('블록 종류를 구분한다', () => {
    const blocks = parseMarkdown('# 제목\n\n문단 1\n문단 2\n\n- a\n- [x] b\n1. 하나\n> 인용\n---\n```js\nx<script>\n```');
    expect(blocks.map((b) => b.type)).toEqual(['heading', 'paragraph', 'list', 'list', 'quote', 'hr', 'code']);
    expect(blocks[2]).toEqual({ type: 'list', ordered: false, items: [{ text: 'a', checked: undefined }, { text: 'b', checked: true }] });
    expect(blocks[6]).toEqual({ type: 'code', lang: 'js', text: 'x<script>' });
  });

  it('빈 입력은 빈 배열', () => {
    expect(parseMarkdown('  \n\n')).toEqual([]);
  });
});

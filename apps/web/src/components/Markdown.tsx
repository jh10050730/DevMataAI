import type { ReactNode } from 'react';
import { cn } from './ui';

/**
 * 가벼운 Markdown 렌더러 (외부 패키지 없음).
 * HTML 문자열을 주입하지 않고 React 요소로 만들기 때문에 노트/AI 응답에 HTML 이 섞여 있어도 안전하다.
 * 지원: 제목, 문단, 목록(•, 1., 체크박스), 인용, 코드 블록, 구분선, **굵게**, *기울임*, `코드`, [링크](https://…)
 */

export type MdBlock =
  | { type: 'heading'; level: number; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'list'; ordered: boolean; items: { text: string; checked?: boolean }[] }
  | { type: 'quote'; text: string }
  | { type: 'code'; lang: string; text: string }
  | { type: 'hr' };

export function parseMarkdown(src: string): MdBlock[] {
  const lines = src.replace(/\r\n/g, '\n').split('\n');
  const out: MdBlock[] = [];
  let para: string[] = [];
  const flush = () => {
    if (para.length) out.push({ type: 'paragraph', text: para.join('\n') });
    para = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const fence = line.match(/^```(.*)$/);
    if (fence) {
      flush();
      const code: string[] = [];
      while (++i < lines.length && !lines[i].startsWith('```')) code.push(lines[i]);
      out.push({ type: 'code', lang: fence[1].trim(), text: code.join('\n') });
      continue;
    }
    if (!line.trim()) {
      flush();
      continue;
    }
    let m: RegExpMatchArray | null;
    if ((m = line.match(/^(#{1,4})\s+(.*)$/))) {
      flush();
      out.push({ type: 'heading', level: m[1].length, text: m[2] });
    } else if (/^\s*(-{3,}|\*{3,})\s*$/.test(line)) {
      flush();
      out.push({ type: 'hr' });
    } else if ((m = line.match(/^>\s?(.*)$/))) {
      flush();
      const prev = out[out.length - 1];
      if (prev?.type === 'quote') prev.text += `\n${m[1]}`;
      else out.push({ type: 'quote', text: m[1] });
    } else if ((m = line.match(/^\s*(?:[-*+]|(\d+)[.)])\s+(?:\[([ xX])\]\s+)?(.*)$/))) {
      flush();
      const ordered = !!m[1];
      const item = { text: m[3], checked: m[2] === undefined ? undefined : m[2] !== ' ' };
      const prev = out[out.length - 1];
      if (prev?.type === 'list' && prev.ordered === ordered) prev.items.push(item);
      else out.push({ type: 'list', ordered, items: [item] });
    } else {
      para.push(line);
    }
  }
  flush();
  return out;
}

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)\s]+\)|\*[^*\s][^*]*\*)/g;

function inline(text: string): ReactNode[] {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('`') && part.endsWith('`') && part.length > 2)
      return (
        <code key={i} className="rounded bg-surface-2 px-1 py-0.5 font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    const link = part.match(/^\[([^\]]+)\]\(([^)\s]+)\)$/);
    if (link) {
      return /^https?:\/\//i.test(link[2]) ? (
        <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-accent underline">
          {link[1]}
        </a>
      ) : (
        link[1]
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return part;
  });
}

const HEADING = ['text-xl', 'text-lg', 'text-base', 'text-sm'];

export default function Markdown({ source, className }: { source: string; className?: string }) {
  const blocks = parseMarkdown(source);
  if (!blocks.length) return <p className={cn('text-sm text-muted', className)}>내용이 없습니다.</p>;

  return (
    <div className={cn('space-y-3 text-sm leading-relaxed', className)}>
      {blocks.map((b, i) => {
        switch (b.type) {
          case 'heading':
            return (
              <p key={i} className={cn('font-semibold', HEADING[b.level - 1], i > 0 && 'pt-2')}>
                {inline(b.text)}
              </p>
            );
          case 'paragraph':
            return (
              <p key={i} className="whitespace-pre-wrap">
                {inline(b.text)}
              </p>
            );
          case 'quote':
            return (
              <blockquote key={i} className="whitespace-pre-wrap border-l-2 border-accent/50 pl-3 text-muted">
                {inline(b.text)}
              </blockquote>
            );
          case 'code':
            return (
              <pre key={i} className="overflow-x-auto rounded-lg bg-surface-2 p-3 font-mono text-xs">
                <code>{b.text}</code>
              </pre>
            );
          case 'hr':
            return <hr key={i} className="border-border" />;
          case 'list': {
            const Tag = b.ordered ? 'ol' : 'ul';
            return (
              <Tag key={i} className={cn('space-y-1 pl-5', b.ordered ? 'list-decimal' : 'list-disc')}>
                {b.items.map((it, j) => (
                  <li key={j} className={cn(it.checked !== undefined && 'list-none -ml-5')}>
                    {it.checked !== undefined && <input type="checkbox" checked={it.checked} readOnly className="mr-2 accent-accent" />}
                    {inline(it.text)}
                  </li>
                ))}
              </Tag>
            );
          }
        }
      })}
    </div>
  );
}

import { canonicalUrl, categoryFor, plainText } from './news.logic';
describe('news normalization', () => {
  it('추적 파라미터와 앵커를 제거해 같은 기사를 통합', () => {
    expect(canonicalUrl('https://example.com/post?utm_source=rss&b=2#a')).toBe('https://example.com/post?b=2');
    expect(canonicalUrl('javascript:alert(1)')).toBeNull();
    expect(canonicalUrl('invalid')).toBeNull();
  });
  it('피드 HTML을 텍스트로 변환', () => expect(plainText('<p>A &amp; B</p>')).toBe('A & B'));
  it('보안을 우선하고 일반 기술을 기본 분류', () => {
    expect(categoryFor('AI security update')).toBe('SECURITY');
    expect(categoryFor('new LLM')).toBe('AI');
    expect(categoryFor('new device')).toBe('TECH');
  });
});

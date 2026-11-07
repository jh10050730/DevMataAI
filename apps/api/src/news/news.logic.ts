export function canonicalUrl(value: string): string | null {
  try {
    const url = new URL(value);
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password) return null;
    url.hash = '';
    for (const key of [...url.searchParams.keys()]) if (/^(utm_|fbclid$|gclid$)/i.test(key)) url.searchParams.delete(key);
    url.searchParams.sort();
    return url.href;
  } catch { return null; }
}
export function plainText(value: string) {
  return value.replace(/<[^>]*>/g, ' ').replace(/&(?:nbsp|amp|lt|gt|quot|apos);/g, s => ({'&nbsp;':' ', '&amp;':'&', '&lt;':'<', '&gt;':'>', '&quot;':'"', '&apos;':"'"}[s]!)).replace(/\s+/g, ' ').trim();
}
export function categoryFor(text: string) {
  if (/security|vulnerability|cve-|보안/i.test(text)) return 'SECURITY';
  if (/\bai\b|llm|model|인공지능/i.test(text)) return 'AI';
  if (/release|framework|javascript|typescript|react|개발/i.test(text)) return 'DEV';
  return 'TECH';
}

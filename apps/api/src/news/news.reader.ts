import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { isIP } from 'node:net';
import ipaddr from 'ipaddr.js';
import { DOMParser } from 'linkedom';
import { Readability } from '@mozilla/readability';

const MAX_BYTES = 2 * 1024 * 1024;
export type ArticleBody = { available: true; text: string; url: string } | { available: false; message: string };

export function isPublicAddress(address: string) {
  try { return ipaddr.process(address).range() === 'unicast'; } catch { return false; }
}

export async function articleAddress(url: URL, signal: AbortSignal) {
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.port) throw new Error('invalid URL');
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  if (hostname === 'localhost' || /\.(localhost|local|internal)$/i.test(hostname)) throw new Error('private host');
  let onAbort: () => void = () => {};
  const records = await Promise.race([
    isIP(hostname) ? Promise.resolve([{ address: hostname, family: isIP(hostname) }]) : lookup(hostname, { all: true }),
    new Promise<never>((_, reject) => {
      onAbort = () => reject(new Error('timeout'));
      if (signal.aborted) onAbort(); else signal.addEventListener('abort', onAbort, { once: true });
    }),
  ]).finally(() => signal.removeEventListener('abort', onAbort));
  if (!records.length || records.some(record => !isPublicAddress(record.address))) throw new Error('private address');
  signal.throwIfAborted();
  return records[0];
}

async function download(url: URL, signal: AbortSignal): Promise<{ html: string; redirect?: string }> {
  const address = await articleAddress(url, signal);
  return new Promise((resolve, reject) => {
    const request = (url.protocol === 'https:' ? httpsRequest : httpRequest)(url, {
      signal, agent: false, family: address.family,
      headers: { 'User-Agent': 'DevMateAI/0.1 Article Reader', Accept: 'text/html,application/xhtml+xml', 'Accept-Encoding': 'identity' },
      // Connect only to the address already checked, retaining the original host for TLS and Host.
      lookup: (_hostname, _options, callback) => callback(null, address.address, address.family),
    }, response => {
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status) && response.headers.location) {
        resolve({ html: '', redirect: response.headers.location }); response.destroy(); return;
      }
      const contentType = response.headers['content-type'] ?? '';
      if (status !== 200 || !/^(text\/html|application\/xhtml\+xml)\b/i.test(contentType) ||
        (response.headers['content-encoding'] && response.headers['content-encoding'] !== 'identity') ||
        Number(response.headers['content-length'] ?? 0) > MAX_BYTES) {
        reject(new Error('unavailable page')); response.destroy(); return;
      }
      let size = 0;
      const chunks: Buffer[] = [];
      response.on('data', (chunk: Buffer) => {
        size += chunk.length;
        if (size > MAX_BYTES) { reject(new Error('page too large')); response.destroy(); return; }
        chunks.push(chunk);
      });
      response.on('error', reject);
      response.on('end', () => {
        try {
          const charset = /charset=["']?([^\s;"']+)/i.exec(contentType)?.[1] ?? 'utf-8';
          resolve({ html: new TextDecoder(charset).decode(Buffer.concat(chunks)) });
        } catch { reject(new Error('unsupported encoding')); }
      });
    });
    request.on('error', reject);
    request.end();
  });
}

export function extractArticleText(html: string) {
  if (/"isAccessibleForFree"\s*:\s*(false|"false")/i.test(html)) throw new Error('paid article');
  const document = new DOMParser().parseFromString(html, 'text/html');
  if (/just a moment|access denied|verify you are human|captcha|접근 차단/i.test(document.querySelector('title')?.textContent ?? '')) throw new Error('blocked page');
  document.querySelectorAll('script,style,nav,footer,header,form,iframe,noscript,[hidden],[aria-hidden="true"]').forEach(node => node.remove());
  // Use textContent only: never execute page scripts or return publisher HTML to the browser.
  const parsed = new Readability(document as unknown as Document, { charThreshold: 200, maxElemsToParse: 30000, disableJSONLD: true }).parse();
  const text = (parsed?.textContent ?? '').replace(/\s+/g, ' ').trim();
  if (text.length < 200) throw new Error('no article text');
  return text.slice(0, 12000);
}

export async function readArticle(url: string): Promise<ArticleBody> {
  try {
    const signal = AbortSignal.timeout(15000);
    let current = new URL(url);
    for (let redirects = 0; redirects <= 3; redirects++) {
      const result = await download(current, signal);
      if (result.redirect) { current = new URL(result.redirect, current); continue; }
      return { available: true, text: extractArticleText(result.html), url: current.href };
    }
  } catch { /* Publisher blocks, private addresses and unavailable pages are all non-readable sources. */ }
  return { available: false, message: '원문을 읽지 못했습니다. 접근 제한·유료 기사이거나 본문을 추출할 수 없는 페이지입니다.' };
}

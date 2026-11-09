import { resolve, relative, extname, sep } from 'node:path';
export function staticPath(root, rawPath) {
  let pathname; try { pathname = decodeURIComponent(rawPath); } catch { return null; }
  if (pathname.includes('\0') || pathname.includes('\\') || pathname.split('/').some(p => p === '..' || p.startsWith('.'))) return null;
  const file = resolve(root, '.' + pathname);
  const rel = relative(root, file);
  return rel.startsWith('..' + sep) || rel === '..' ? null : file;
}
export const contentType = file => ({ '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2' }[extname(file)] || 'application/octet-stream');

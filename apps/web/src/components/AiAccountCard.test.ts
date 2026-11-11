import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { AiAccountTabs, ChatGptConnection, ClaudeConnection, GeminiConnection } from './AiAccountCard';
const actions = { connect() {}, cancel() {}, disconnect() {}, refresh() {} };
function render(connected: boolean, pending = false, enabled = true) {
  return renderToStaticMarkup(createElement(ChatGptConnection, { account: { enabled, connected, pending, email: 'me@example.com', message: 'ChatGPT로 로그인해 주세요.' }, busy: false, loginUrl: pending ? 'https://auth.openai.com/login' : '', actions }));
}
describe('ChatGPT connection states', () => {
  it('offers Claude disconnection while connected and reconnection after app-only disconnect', () => {
    const account = { connected: true, loginConnected: true, enabled: true, installed: true, message: '연결됨' };
    const props = { busy: false, connect() {}, disconnect() {}, refresh() {} };
    expect(renderToStaticMarkup(createElement(ClaudeConnection, { ...props, account }))).toContain('계정 연결 해제');
    const html = renderToStaticMarkup(createElement(ClaudeConnection, { ...props, account: { ...account, connected: false, enabled: false } }));
    expect(html).toContain('Claude 연결'); expect(html).not.toContain('계정 연결 해제');
  });
  it('uses the same connected layout and status refresh button for both services', () => {
    const claude = renderToStaticMarkup(createElement(ClaudeConnection, { account: { connected: true, loginConnected: true, enabled: true, installed: true, email: 'me@example.com', message: '' }, busy: false, connect() {}, disconnect() {}, refresh() {} }));
    const chatgpt = render(true);
    expect(chatgpt).toContain('연결 상태 다시 확인');
    expect(chatgpt).toBe(claude.replace('Claude 연결됨', 'ChatGPT 연결됨'));
    const gemini = renderToStaticMarkup(createElement(GeminiConnection, { account: { enabled: true, connected: true, pending: false, email: 'me@example.com', message: '' }, busy: false, actions }));
    expect(gemini).toBe(claude.replace('Claude 연결됨', 'Gemini 연결됨'));
  });
  it('shows three connected service tabs without a separate both button', () => {
    const html = renderToStaticMarkup(createElement(AiAccountTabs, { selected: 'chatgpt', connected: ['claude-cli', 'chatgpt', 'gemini'], busy: false, onSelect() {} }));
    expect((html.match(/<button/g) || []).length).toBe(3);
    expect((html.match(/연결됨/g) || []).length).toBe(3);
    expect(html).toContain('Gemini');
    expect(html).not.toContain('둘 다');
  });
  it('shows a connected account without a login button or a model picker', () => {
    const html = render(true);
    expect(html).toContain('ChatGPT 연결됨'); expect(html).toContain('me@example.com');
    expect(html).toContain('계정 연결 해제'); expect(html).not.toContain('ChatGPT 연결 테스트');
    expect(html).not.toContain('ChatGPT로 로그인'); expect(html).not.toContain('<select');
    expect(html).not.toContain('모델 목록'); expect(html).not.toContain('Codex');
  });
  it('shows login only for a disconnected account', () => {
    const html = render(false);
    expect(html).toContain('ChatGPT로 로그인'); expect(html).not.toContain('계정 연결 해제'); expect(html).not.toContain('ChatGPT 연결 테스트');
  });
  it('shows cancellation and the browser link while login is pending', () => {
    const html = render(false, true);
    expect(html).toContain('로그인 취소'); expect(html).toContain('disabled'); expect(html).toContain('https://auth.openai.com/login');
  });
  it('uses ChatGPT names for installation guidance', () => {
    const html = render(false, false, false);
    expect(html).toContain('ChatGPT 연결 프로그램 설치 안내');
    expect(html.replace(/<[^>]*>/g, '')).not.toMatch(/codex/i);
  });
  it('shows Gemini install and cancellation controls without a separate connection test', () => {
    const base = { enabled: false, connected: false, pending: false, message: '설치가 필요합니다.' };
    const html = renderToStaticMarkup(createElement(GeminiConnection, { account: base, busy: false, actions }));
    expect(html).toContain('Gemini 연결 프로그램 설치 안내'); expect(html).toContain('Google 계정으로 Gemini 연결'); expect(html).not.toContain('연결 테스트');
    const pending = renderToStaticMarkup(createElement(GeminiConnection, { account: { ...base, enabled: true, pending: true }, busy: false, actions }));
    expect(pending).toContain('로그인 취소'); expect(pending).toContain('연결 상태 다시 확인');
  });
});

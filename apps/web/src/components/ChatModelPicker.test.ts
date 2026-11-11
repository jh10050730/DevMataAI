import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { ChatModelOptions, type ModelCatalog } from './ChatModelPicker';
const groups: ModelCatalog['groups'] = [{ provider: 'claude-cli', label: 'Claude', models: [{ id: 'sonnet', name: 'Sonnet' }] }, { provider: 'chatgpt', label: 'ChatGPT', models: [{ id: 'gpt-a', name: 'GPT A' }] }];
describe('chat model options', () => {
  it.each(['claude-cli', 'chatgpt', 'both'])('renders connected %s groups and preserves service identities', selection => {
    const enabled = groups.filter(group => selection === 'both' || selection === group.provider);
    const html = renderToStaticMarkup(createElement(ChatModelOptions, { catalog: { selection, groups: enabled }, value: '', disabled: false, onChange() {} }));
    expect(html).toContain('채팅 모델 선택');
    expect(html.includes('Claude · Sonnet')).toBe(selection !== 'chatgpt');
    expect(html.includes('ChatGPT · GPT A')).toBe(selection !== 'claude-cli');
    for (const group of enabled) expect(html).toContain(`label="${group.label}"`);
  });
});

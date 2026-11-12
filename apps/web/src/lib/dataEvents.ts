/**
 * AI 비서가 일정·할 일·학습·프로젝트를 바꾼 뒤, 열려 있는 화면이 최신 내용을 다시 불러오게 알린다.
 * useAsync 를 쓰는 화면은 자동으로 새로고침되고, 그 밖의 화면은 onDataChanged 로 직접 듣는다.
 */
export const DATA_CHANGED = 'devmata:data-changed';

export function notifyDataChanged() {
  window.dispatchEvent(new Event(DATA_CHANGED));
}

export function onDataChanged(listener: () => void) {
  window.addEventListener(DATA_CHANGED, listener);
  return () => window.removeEventListener(DATA_CHANGED, listener);
}

import { useCallback, useEffect, useRef, useState } from 'react';
import { errorMessage } from './api';
import { onDataChanged } from './dataEvents';

/** 데이터 로딩 상태(loading / error / data) + 다시 불러오기. AI 비서가 데이터를 바꾸면 조용히 다시 불러온다 */
export function useAsync<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const seq = useRef(0);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const run = useCallback(fn, deps);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const result = await run();
      if (id === seq.current) setData(result);
    } catch (e) {
      if (id === seq.current) setError(errorMessage(e));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, [run]);

  useEffect(() => {
    void reload();
  }, [reload]);

  // 로딩 표시 없이 내용만 바꾼다 (보던 화면·입력 중인 내용이 사라지지 않게)
  useEffect(() => onDataChanged(() => {
    const id = ++seq.current;
    run().then(result => { if (id === seq.current) { setData(result); setError(null); setLoading(false); } }, () => { if (id === seq.current) setLoading(false); /* 실패하면 기존 내용을 그대로 둔다 */ });
  }), [run]);

  return { data, error, loading, reload, setData };
}

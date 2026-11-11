import { ShieldCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { errorMessage } from '../lib/api';
import { verifyWithGoogle, type IdentityDone, type IdentityPurpose } from '../lib/googleIdentity';
import { Button } from './ui';

/** "Google로 확인" 버튼. 누르면 브라우저에서 Google 로그인 → 끝나면 onDone 으로 확인된 이메일을 넘긴다 */
export default function GoogleVerify({ purpose, label, onDone }: { purpose: IdentityPurpose; label: string; onDone: (result: IdentityDone) => void }) {
  const [waiting, setWaiting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abort = useRef<AbortController | null>(null);
  useEffect(() => () => abort.current?.abort(), []);

  const run = async () => {
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setWaiting(true); setError(null);
    try {
      const result = await verifyWithGoogle(purpose, { signal: controller.signal });
      if (!controller.signal.aborted) onDone(result);
    } catch (e) {
      if (!controller.signal.aborted) setError(errorMessage(e));
    } finally {
      if (abort.current === controller) setWaiting(false);
    }
  };

  const cancel = () => { abort.current?.abort(); setWaiting(false); };

  return (
    <div className="space-y-3">
      <Button type="button" onClick={() => void run()} loading={waiting} className="w-full">
        <ShieldCheck className="size-4" /> {label}
      </Button>
      {waiting && (
        <div className="rounded-2xl bg-accent-soft p-3 text-sm leading-6" role="status">
          브라우저에서 Google 로그인을 마치면 자동으로 이어져요.
          <button type="button" onClick={cancel} className="ml-2 font-semibold text-accent hover:underline">취소</button>
        </div>
      )}
      {error && <p role="alert" className="rounded-lg bg-red-500/10 px-3 py-2 text-sm text-red-600 dark:text-red-400">{error}</p>}
    </div>
  );
}

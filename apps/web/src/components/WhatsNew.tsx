import { Sparkles } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';
import { seenVersionKey, whatsNewFor, type ReleaseNote } from '../lib/whatsNew';
import { Button, Modal } from './ui';

const onboardingKey = (id: string) => `devmate-claude-onboarding-v1:${id}`;
const read = (key: string) => { try { return localStorage.getItem(key); } catch { return null; } };
const write = (key: string, value: string) => { try { localStorage.setItem(key, value); } catch { /* 저장이 막혀도 앱은 그대로 쓴다 */ } };

/** 큰 업데이트 뒤 처음 들어오면 새로워진 점을 한 번 보여 준다 (작은 업데이트·새 사용자는 조용히 버전만 기록) */
export default function WhatsNew() {
  const { user } = useAuth();
  const [note, setNote] = useState<ReleaseNote & { version: string }>();
  const [current, setCurrent] = useState('');

  useEffect(() => {
    if (!user) return;
    let active = true;
    api.get<{ version: string }>('/desktop/info').then(({ version }) => {
      if (!active || !version) return;
      const key = seenVersionKey(user.id);
      // 이 기능이 생기기 전 버전에서 업데이트한 사용자: 처음 설정(AI 연결)을 이미 지나갔으면 기존 사용자로 본다
      const found = whatsNewFor(read(key), version, !!read(onboardingKey(user.id)));
      if (found) { setCurrent(version); setNote(found); } else write(key, version);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [user]);

  if (!note || !user) return null;
  const close = () => { write(seenVersionKey(user.id), current); setNote(undefined); };
  return <Modal open onClose={close} title={note.title}>
    <div className="flex items-center gap-2 text-sm font-semibold text-accent"><Sparkles className="size-4" />v{current} 업데이트</div>
    <ul className="mt-4 space-y-3 text-sm leading-6">
      {note.items.map(item => <li key={item} className="flex gap-2.5"><span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-accent" /><span>{item}</span></li>)}
    </ul>
    <div className="mt-6 flex justify-end"><Button onClick={close}>확인</Button></div>
  </Modal>;
}

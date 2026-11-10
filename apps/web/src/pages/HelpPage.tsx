import { ArrowUpRight, Bot, CalendarCheck, Database, LifeBuoy, Plug, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

const REPO = 'https://github.com/jh10050730/DevMataAI';

function Section({ icon: Icon, title, children }: { icon: LucideIcon; title: string; children: ReactNode }) {
  return (
    <section className="workspace-card rounded-[24px] bg-surface p-6 sm:p-7">
      <h3 className="mb-3 flex items-center gap-2.5 text-lg font-bold">
        <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft"><Icon className="size-5 text-accent" strokeWidth={1.8} /></span>
        {title}
      </h3>
      <div className="space-y-2 text-sm leading-6 text-muted [&_b]:text-fg">{children}</div>
    </section>
  );
}

function Faq({ q, children }: { q: string; children: ReactNode }) {
  return (
    <details className="group rounded-2xl border border-border px-4 py-3 [&[open]]:bg-surface-2/50">
      <summary className="cursor-pointer list-none text-sm font-semibold text-fg marker:hidden">
        <span className="mr-2 text-accent group-open:hidden">+</span><span className="mr-2 hidden text-accent group-open:inline">−</span>{q}
      </summary>
      <div className="mt-2 text-sm leading-6 text-muted">{children}</div>
    </details>
  );
}

const external = 'inline-flex items-center gap-0.5 text-accent hover:underline';

/** 도움말: 처음 쓰는 방법과 자주 묻는 질문. 링크는 데스크톱 앱에서 기본 브라우저로 열린다. */
export default function HelpPage() {
  return (
    <div className="space-y-6">
      <header className="pb-2 pt-1">
        <h2 className="text-[28px] font-bold leading-snug tracking-tight">도움말</h2>
        <p className="mt-2 text-[15px] text-muted">DevMata AI를 처음 쓰는 방법과 자주 묻는 질문이에요.</p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        <Section icon={Bot} title="AI 연결">
          <p>DevMata AI는 <b>내 PC에 로그인한 내 AI 계정</b>으로 동작해요. 다른 사람의 사용량을 쓰지 않아요.</p>
          <p><Link to="/settings" className="text-accent hover:underline">설정 → 외부 연동</Link>에서 안내에 따라 AI 계정을 연결하고 <b>연결 테스트</b>를 눌러 확인하세요.</p>
        </Section>

        <Section icon={CalendarCheck} title="Google 캘린더">
          <p>설정 → 외부 연동 → Google Calendar에서 <b>Google 계정 연결</b>을 누르면 브라우저에서 로그인하고, 끝나면 앱으로 자동으로 돌아와요.</p>
          <p>읽기 전용이에요. Google 일정을 만들거나 바꾸지 않고 기본 캘린더의 일정을 가져오기만 해요.</p>
        </Section>

        <Section icon={Plug} title="Notion · GitHub">
          <p>각자 자기 Notion 통합 토큰과 GitHub 토큰을 만들어 <b>설정 → 앱 연결 설정</b>에 넣어요 (처음 가입한 관리자 계정만 바꿀 수 있어요).</p>
          <p>토큰은 이 PC에 암호화해 저장하고 화면에 다시 보여 주지 않아요.</p>
        </Section>

        <Section icon={Database} title="내 데이터">
          <p>모든 데이터는 이 PC에만 저장돼요: <code className="rounded bg-surface-2 px-1">%APPDATA%\DevMata AI</code></p>
          <p>앱을 지웠다가 다시 설치해도 이 폴더가 남아 있으면 그대로 이어서 쓸 수 있어요.</p>
        </Section>
      </div>

      <section className="workspace-card rounded-[24px] bg-surface p-6 sm:p-7">
        <h3 className="mb-3 flex items-center gap-2.5 text-lg font-bold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft"><LifeBuoy className="size-5 text-accent" strokeWidth={1.8} /></span>
          자주 묻는 질문
        </h3>
        <div className="space-y-2">
          <Faq q="창을 닫았는데 앱이 꺼지지 않아요">창의 X를 누르면 알림과 뉴스 수집을 계속하려고 트레이(작업 표시줄 오른쪽 아래 ^)로 숨어요. 완전히 끄려면 트레이 아이콘을 오른쪽 클릭하고 <b>종료</b>를 누르세요.</Faq>
          <Faq q="설치할 때 'Windows의 PC 보호' 창이 떠요">코드 서명 인증서가 없는 앱이라 나오는 경고예요. <b>추가 정보 → 실행</b>을 누르면 설치돼요.</Faq>
          <Faq q="Google 로그인 때 '확인되지 않은 앱' 경고가 떠요">아직 Google 검수를 받지 않아서 나오는 경고예요. <b>고급 → DevMata AI(으)로 이동</b>을 누르면 계속할 수 있어요. 캘린더는 읽기 권한만 요청해요.</Faq>
          <Faq q="AI 연결 테스트가 실패해요">AI 계정이 이 PC에 로그인되어 있는지 확인하세요. 방금 설치했다면 트레이에서 DevMata AI를 <b>종료</b>한 뒤 다시 실행해 보세요.</Faq>
          <Faq q="'서버와 연결이 끊겼어요' 띠가 떠요">앱 안의 서버가 잠깐 멈춘 상태예요. 대부분 몇 초 안에 다시 연결돼요. 계속되면 트레이에서 종료 후 다시 실행하세요.</Faq>
          <Faq q="'포트를 다른 프로그램이 쓰고 있습니다'라며 시작이 안 돼요">DevMata AI가 이미 실행 중일 가능성이 커요. 트레이 아이콘을 확인하거나, 작업 관리자에서 DevMata AI를 끝낸 뒤 다시 실행하세요.</Faq>
          <Faq q="비밀번호를 잊었어요">로그인 화면의 <b>비밀번호 찾기</b>에서 이메일을 입력하세요. 메일 설정이 없는 PC에서는 앱에 확인 창이 뜨고, <b>재설정</b>을 누르면 새 비밀번호를 정할 수 있어요.</Faq>
        </div>
      </section>

      <section className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-1.5 text-muted"><ShieldCheck className="size-4" /> 더 알아보기</span>
        <a href={`${REPO}#readme`} target="_blank" rel="noreferrer" className={external}>설치·사용 안내<ArrowUpRight className="size-3.5" /></a>
        <a href={`${REPO}/blob/main/PRIVACY.md`} target="_blank" rel="noreferrer" className={external}>개인정보처리방침<ArrowUpRight className="size-3.5" /></a>
        <a href={`${REPO}/issues`} target="_blank" rel="noreferrer" className={external}>문의·버그 제보<ArrowUpRight className="size-3.5" /></a>
      </section>
    </div>
  );
}

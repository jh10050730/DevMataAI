import { ArrowUpRight, Bot, CalendarCheck, Database, LifeBuoy, Plug, ShieldCheck, type LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';
import AppInfoCard from '../components/AppInfoCard';

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

      <div className="grid gap-4 @3xl:grid-cols-2">
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
          <p>하루에 한 번 같은 폴더의 <code className="rounded bg-surface-2 px-1">backups</code>에 자동으로 백업하고, <b>최근 7개</b>만 남겨요.</p>
        </Section>
      </div>

      <section className="workspace-card rounded-[24px] bg-surface p-6 sm:p-7">
        <h3 className="mb-3 flex items-center gap-2.5 text-lg font-bold">
          <span className="flex size-9 items-center justify-center rounded-xl bg-accent-soft"><LifeBuoy className="size-5 text-accent" strokeWidth={1.8} /></span>
          자주 묻는 질문
        </h3>
        <div className="space-y-2">
          <Faq q="창을 닫았는데 앱이 꺼지지 않아요">창의 X를 누르면 알림과 뉴스 수집을 계속하려고 트레이(작업 표시줄 오른쪽 아래 ^)로 숨어요. 완전히 끄려면 트레이 아이콘을 오른쪽 클릭하고 <b>종료</b>를 누르세요.</Faq>
          <Faq q="앱을 열지 않고 할 일을 빨리 적고 싶어요">어디서든 <b>Ctrl+Shift+Space</b>를 누르면 작은 빠른 입력 창이 떠요. "내일 3시 팀 회의"처럼 한 줄을 적고 Enter를 누르면 AI가 할 일·일정·메모로 바꾸고, 한 번 더 Enter를 누르면 추가돼요. 다른 프로그램이 이 단축키를 쓰고 있으면 Ctrl+Alt+Space나 Ctrl+Shift+J로 바뀌어요. 지금 쓰는 단축키는 트레이 메뉴에서 볼 수 있어요.</Faq>
          <Faq q="아침 브리핑은 언제 와요?">설정 → 알림에서 고른 시각이 지나고 앱이 처음 켜져 있을 때 하루 한 번, 오늘 일정·마감·복습을 3줄로 요약해 Windows 알림과 알림함으로 보내 드려요. 오후 6시가 지나면 그날은 보내지 않아요. <b>지금 받아 보기</b>로 미리 볼 수 있어요.</Faq>
          <Faq q="반복 일정이나 개발일지는 어떻게 써요?">일정·할 일을 만들 때 <b>반복</b>을 고르면 매일·평일·매주·매월 반복돼요. 반복 할 일은 끝내면 다음 마감일로 새로 생겨요. 개발일지는 프로젝트에 PC 폴더나 GitHub 저장소를 등록하면 그날의 커밋을 AI가 정리해 줘요. 아침 브리핑이 켜져 있으면 어제 일지가 자동으로 만들어져요.</Faq>
          <Faq q="설치할 때 'Windows의 PC 보호' 창이 떠요">코드 서명 인증서가 없는 앱이라 나오는 경고예요. <b>추가 정보 → 실행</b>을 누르면 설치돼요.</Faq>
          <Faq q="Google 로그인 때 '확인되지 않은 앱' 경고가 떠요">아직 Google 검수를 받지 않아서 나오는 경고예요. <b>고급 → DevMata AI(으)로 이동</b>을 누르면 계속할 수 있어요. 캘린더는 읽기 권한만 요청해요.</Faq>
          <Faq q="AI 연결 테스트가 실패해요">AI 계정이 이 PC에 로그인되어 있는지 확인하세요. 방금 설치했다면 트레이에서 DevMata AI를 <b>종료</b>한 뒤 다시 실행해 보세요.</Faq>
          <Faq q="'서버와 연결이 끊겼어요' 띠가 떠요">앱 안의 서버가 잠깐 멈춘 상태예요. 대부분 몇 초 안에 다시 연결돼요. 계속되면 트레이에서 종료 후 다시 실행하세요.</Faq>
          <Faq q="'포트를 다른 프로그램이 쓰고 있습니다'라며 시작이 안 돼요">DevMata AI가 이미 실행 중일 가능성이 커요. 트레이 아이콘을 확인하거나, 작업 관리자에서 DevMata AI를 끝낸 뒤 다시 실행하세요.</Faq>
          <Faq q="업데이트는 어떻게 해요?">앱이 켜져 있으면 시작할 때와 6시간마다 새 버전을 확인하고 알아서 받아 둬요. 다 받으면 Windows 알림과 화면 위쪽 안내줄로 알려 드려요. 알림이나 <b>지금 재시작</b>을 누르면 바로 설치되고, 트레이 메뉴의 <b>재시작해서 업데이트</b>로도 할 수 있어요. 누르지 않아도 다음에 앱을 끌 때 설치돼요. 데이터는 그대로 남아요.</Faq>
          <Faq q="예전 데이터로 되돌리고 싶어요">
            <ol className="list-decimal space-y-1 pl-5">
              <li>트레이 아이콘을 오른쪽 클릭하고 <b>종료</b>를 눌러 앱을 완전히 꺼요.</li>
              <li><code className="rounded bg-surface-2 px-1">%APPDATA%\DevMata AI</code> 폴더를 열고, 지금 쓰는 <b>devmata.db</b>를 다른 이름(예: devmata-old.db)으로 바꿔 둬요. 옆에 있는 devmata.db-wal, devmata.db-shm 파일은 지워요.</li>
              <li><code className="rounded bg-surface-2 px-1">backups</code> 폴더에서 되돌릴 날짜의 파일(devmata-날짜-시간.db)을 복사해 와서 이름을 <b>devmata.db</b>로 바꿔요.</li>
              <li>앱을 다시 실행해요.</li>
            </ol>
          </Faq>
          <Faq q="비밀번호를 잊었어요">로그인 화면의 <b>비밀번호 찾기</b>에서 <b>Google로 본인 확인</b>을 누르고, 가입한 Google 계정으로 로그인하면 바로 새 비밀번호를 정할 수 있어요. Google 계정이 아닌 이메일로 가입했다면 아래 칸에 이메일을 입력하세요. 메일 설정이 없는 PC에서는 앱에 확인 창이 뜨고, <b>재설정</b>을 누르면 돼요.</Faq>
          <Faq q="아이디가 기억나지 않아요">아이디는 가입할 때 쓴 이메일이에요. 로그인 화면의 <b>아이디 찾기</b>에서 Google 계정으로 확인하면 그 이메일로 가입된 계정이 있는지 알려 드려요.</Faq>
          <Faq q="회원가입할 때 왜 Google 로그인을 해요?">가입할 이메일이 정말 내 것인지 확인하려고요. Google에서는 이메일과 이름만 받고, 캘린더 같은 다른 정보는 가져오지 않아요. 비밀번호는 DevMata AI 전용으로 따로 정해요.</Faq>
        </div>
      </section>

      <AppInfoCard />

      <section className="flex flex-wrap items-center gap-x-5 gap-y-2 text-sm">
        <span className="inline-flex items-center gap-1.5 text-muted"><ShieldCheck className="size-4" /> 더 알아보기</span>
        <a href={`${REPO}#readme`} target="_blank" rel="noreferrer" className={external}>설치·사용 안내<ArrowUpRight className="size-3.5" /></a>
        <a href={`${REPO}/blob/main/PRIVACY.md`} target="_blank" rel="noreferrer" className={external}>개인정보처리방침<ArrowUpRight className="size-3.5" /></a>
        <a href={`${REPO}/issues`} target="_blank" rel="noreferrer" className={external}>문의·버그 제보<ArrowUpRight className="size-3.5" /></a>
      </section>
    </div>
  );
}

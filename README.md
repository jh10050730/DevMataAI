# DevMate AI

Phase 5 통합 비서: `/assistant`에서 한국 시간 기준 아침 브리핑, 개인 비서 채팅, 통합 검색과 관련 자료 추천을 제공합니다.
상단 검색도 할 일·일정·학습·프로젝트·프로젝트 작업·공용 뉴스를 함께 찾습니다 (종류별 최신 최대 20개).
아침 브리핑은 오늘 일정·지난/오늘 마감·미완료 작업·복습·프로젝트 진행률·오늘 뉴스를 표시합니다.
프로젝트를 고르면 이름·목표·설명의 키워드가 일치하는 저장된 노트와 뉴스를 각각 최대 5개 추천합니다.
AI 답변은 저장된 앱 데이터의 제한된 조회 범위와 최근 대화 최대 8개를 사용합니다. 실시간 외부 정보나 원문을 읽었다고 가정하지 않습니다.
채팅 기록은 이 화면에서만 유지되며 새로고침 시 초기화됩니다. 브리핑 데이터는 화면을 열거나 새로고침할 때 조회하며 자동 알림 발송 기능은 포함하지 않습니다.

AI 데이터 변경은 **제안 → 내용 검토 → 확인하고 적용** 순서입니다.
현재 지원하는 작업은 할 일 완료·제목 변경·삭제와 로컬 일정·학습 노트·프로젝트 삭제입니다.
프로젝트 삭제는 하위 작업·보고서도 삭제하므로 제안에 함께 표시됩니다. Google에서 가져온 일정은 비서에서도 읽기 전용입니다.
제안만으로 대상 데이터는 바뀌지 않습니다. 서버에 저장한 제안은 소유자만 10분 이내 한 번 확인할 수 있고,
대상이 변경됐거나 제안이 만료·취소·이미 처리되었으면 실행을 막습니다. 변경 적용과 제안 소비는 DB 트랜잭션으로 처리합니다.
지원하지 않는 수정·생성은 기존 관리 화면에서 수행하세요.

비서 API: `/api/assistant/briefing`, `/search?q=`, `/recommendations/:projectId`,
`POST /chat`, `POST /actions`, `POST /actions/:id/confirm`, `POST /actions/:id/cancel`.
모든 개인 데이터 조회와 변경 제안은 로그인한 사용자 소유 범위로 제한합니다. 뉴스는 공용 데이터입니다.
마이그레이션 `20261107121459_add_assistant_actions`를 적용해야 합니다.
실제 AI 연결 검증은 빌드 후 `npm run assistant:smoke -w apps/api`로 실행합니다.
이 명령은 임시 검사 계정을 만들고 응답을 확인한 뒤 삭제하며, 설정된 AI 제공자의 사용량이 발생합니다.
2026-11-07 실제 Claude CLI 비서 응답과 조회 범위 안내를 확인했습니다. 브라우저 시각 검증은 별도로 필요합니다.

Phase 4 프로젝트 관리: `/projects`에서 프로젝트 이름·목표·설명을 작성하고 기능과 작업을 등록합니다.
작업 상태는 예정·진행 중·문제 있음·완료로 관리하며, 진행률은 등록한 기능·작업의 완료 비율입니다.
GitHub 저장소는 선택 사항입니다. 저장소가 없어도 프로젝트 관리와 작업 기반 주간 보고서를 사용할 수 있습니다.
나중에 프로젝트 수정에서 `owner/repository`를 입력하면 최근 7일 기본 브랜치 커밋과 업데이트된 이슈·PR을 조회합니다.
공개 저장소는 토큰 없이, 비공개 저장소는 서버 `.env`의 `GITHUB_TOKEN` 읽기 권한으로 조회합니다.
저장소를 만들거나 GitHub에 변경 사항을 전송하는 기능은 포함하지 않습니다.
GitHub 조회는 종류별 최신 100개까지이며, 상한에 도달하거나 일부 조회가 실패하면 표시합니다.
AI 주간 보고서는 개발 내용·이번 주 완료·진행 중·문제·다음 작업 제안·커밋 요약을 생성하고 당시 근거와 함께 저장합니다.
데모 모드에서는 실제 분석이 아닌 DEMO 응답으로 표시합니다. 최근 보고서 최대 20개를 조회할 수 있습니다.
프로젝트 삭제 시 하위 작업과 보고서도 함께 삭제됩니다.
DB 변경은 `npm run db:deploy -w apps/api`로 적용하며, 개발 마이그레이션 `20261107114545_add_projects`가 포함되어 있습니다.
공개 GitHub 연결 확인: 빌드 후 `npm run projects:smoke -w apps/api` (예제 저장소만 읽으며 사용자 데이터를 만들지 않음).

프로젝트 API: `/api/projects` CRUD, `/:id/items` 생성·수정·삭제,
`/:id/github` 활동 조회, `/:id/reports` 보고서 생성·이력 조회. 모든 경로는 로그인과 프로젝트 소유자 검사를 적용합니다.

뉴스는 IT·경제·금융/증권·부동산·국제·정치·사회로 나누어 제공합니다.
한국경제의 [공식 RSS 목록](https://www.hankyung.com/feed)에 공개된 분야별 피드를 사용합니다.
API 서버가 실행 중이면 **매일 오전 7시(Asia/Seoul)** 자동 수집합니다.
오전 7시 이후 서버를 시작하면 놓친 당일 수집을 실행하며, 실패한 수집은 30분 간격으로 다시 시도합니다.
완료일과 마지막 시도·결과를 DB에 저장하므로 재시작 후에도 기록이 유지됩니다.
서버나 PC가 꺼져 있는 동안에는 수집할 수 없습니다. `.env`의 `NEWS_AUTO_COLLECT=false`로 자동 수집을 끌 수 있습니다.
뉴스 화면의 분야 버튼으로 목록과 당일 브리핑·AI 분석의 범위를 선택할 수 있습니다.
브리핑의 날짜는 한국 시간을 사용합니다. 자동 수집은 RSS 수집이며 AI 분석은 버튼으로 요청합니다.
이 설명은 아래 최초 Phase 3 구현 당시의 UTC·수동 수집 설명보다 우선합니다.

Phase 3 뉴스 기능: `/news`에서 **뉴스 수집**을 누르면 GitHub Blog와 Hacker News RSS를 저장합니다.
검색·카테고리 필터와 UTC 기준 오늘의 최신 기사 최대 5개를 제공합니다.
**AI 브리핑 생성**은 `.env`의 `AI_PROVIDER` 설정에 따라 Claude CLI 또는 Anthropic API를 호출합니다.
3~5줄 요약과 기사별 기술적 중요성·개발자 영향을 표시하며, 분석은 RSS 발췌를 근거로 합니다.
`demo` 모드나 AI 연결 실패 시에는 RSS 발췌를 계속 제공합니다.
수집은 5분 간격으로 제한되며 AI 분석은 같은 기사 구성에 대해 1시간 동안 메모리에 보관됩니다.
수집 실패는 출처별로 표시합니다. 기사는 공용 뉴스 데이터이며 로그인한 사용자가 함께 조회합니다.

API: `GET /api/news?q=&category=AI`, `POST /api/news/refresh`,
`GET /api/news/briefing`, `POST /api/news/briefing/analyze` (모두 로그인 필요).
실제 RSS 연결 확인: 빌드 후 `npm run news:smoke -w apps/api`.
이 명령은 개발 DB에 수집한 기사를 저장합니다.

일정과 할 일, 학습 기록을 관리하는 개인 워크스페이스입니다.
React/Vite 프론트엔드와 NestJS/Prisma/MySQL 8 백엔드를 npm workspaces로 구성합니다.

## 로컬 실행

Node.js 20.19 이상 또는 22.12 이상의 지원 버전이 필요합니다.

```powershell
npm install
Copy-Item apps/api/.env.example apps/api/.env
```

이미 `.env`가 있으면 복사하지 말고 기존 설정을 유지하세요.
`apps/api/.env`에서 `DATABASE_URL`(아래 MySQL 설정)과 32자 이상의 무작위 `JWT_SECRET`을 설정합니다.

### MySQL 설정

MySQL 8.x 서버가 필요합니다 (Windows: `winget install Oracle.MySQL` 후 MySQL Configurator로 서버 구성, 기본 포트 3306).
root로 접속해 앱 전용 계정과 DB를 만듭니다. 비밀번호는 직접 정하세요.

```sql
CREATE DATABASE devmate CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER 'devmate'@'localhost' IDENTIFIED BY '비밀번호';
GRANT ALL PRIVILEGES ON devmate.* TO 'devmate'@'localhost';
-- 마이그레이션용 임시(shadow) DB와 테스트 DB(devmate_test) 생성에 필요
GRANT CREATE, DROP, ALTER, INDEX, REFERENCES, SELECT, INSERT, UPDATE, DELETE ON *.* TO 'devmate'@'localhost';
```

`.env`: `DATABASE_URL="mysql://devmate:비밀번호@localhost:3306/devmate"`
(비밀번호에 `@ : / # ?` 등이 있으면 URL 인코딩합니다.)

아래 명령은 저장소 루트에서 실행합니다. `npm run setup`은 `prisma migrate deploy`로 마이그레이션을 적용합니다.

```powershell
npm run setup
npm run dev
```

웹: http://localhost:5173 · API 상태 확인: http://localhost:3000/api/health
웹에서 회원가입 후 사용합니다. 데이터는 MySQL `devmate` DB에 저장됩니다.
스키마를 바꾼 뒤에는 `npm run db:migrate -w apps/api -- --name <변경이름>`으로 마이그레이션을 만듭니다 (`prisma/migrations`).
스키마를 갱신하기 전에는 DB를 백업하세요 (`mysqldump`). 데이터 삭제를 허용하는 옵션은 일반 설정 과정에 필요하지 않습니다.
이전 SQLite 파일(`apps/api/prisma/dev.db`)은 더 이상 사용하지 않으며 지우지 않고 남겨 두었습니다.

Windows에서 Prisma 생성 중 `query_engine-windows.dll.node`의 `EPERM` 오류가 발생하면
이 프로젝트의 API 개발 서버를 종료한 후 `npm run db:generate -w apps/api`를 다시 실행하세요.

## 구현 범위

- 웹과 API: 회원가입/로그인, 할 일, 일정, 대시보드, 테마와 기본 설정 화면.
- API: 학습 과목·노트 CRUD, 검색·태그 필터, 학습 진행률, 복습 기록과 다음 복습일 계산.
- 웹: 학습 관리 화면 (과목·노트·마크다운·복습 기록), AI 학습 도우미, Notion 가져오기/저장, 연동 상태 화면.
- AI: 노트 요약, 쉬운 설명, 핵심 용어, 객관식·주관식 문제, 노트 기반 질문 답변 (`POST /api/study/notes/:id/ai`).
- 미완료: Google Calendar·GitHub 연동, 데모 데이터 관리, 프로젝트 관리, 통합 AI 비서.

### AI 설정 (API 키 불필요)

기본값 `AI_PROVIDER=claude-cli`는 이 PC에 설치된 Claude Code를 헤드리스로 호출하며 구독 로그인을 사용합니다.
터미널에서 `claude`를 한 번 실행해 로그인되어 있으면 됩니다. 설정 화면의 **연결 테스트**로 확인하세요.

- 호출 시 `--safe-mode --tools ""` 등 최소 모드를 사용해 1회 약 1천 토큰 수준으로 동작합니다 (도구·파일 접근 없음).
- `CLAUDE_CLI_MODEL`을 비우면 Claude Code 기본 모델, `haiku`/`sonnet`/`opus`로 지정할 수 있습니다.
- `AI_PROVIDER=demo`는 실제 AI를 호출하지 않고 "데모 응답"이라고 표시된 응답을 돌려줍니다 (테스트에서 사용).
- 서버가 이 PC에서 실행될 때만 동작하며, 개인용으로만 사용하세요.
- 호출 기록(성공/실패, 지연 시간, 토큰 수)은 `AiUsageLog` 테이블에 저장되고 프롬프트 원문은 저장하지 않습니다.

### Notion 설정 (선택)

1. https://www.notion.so/my-integrations 에서 Internal Integration을 만들고 토큰을 `apps/api/.env`의 `NOTION_TOKEN`에 넣습니다.
2. 가져오거나 저장할 페이지마다 `···` → **연결(Connections)** 에서 integration을 추가합니다. 연결한 페이지에만 접근할 수 있습니다.
3. 노트를 Notion에 새 페이지로 저장하려면 상위 페이지 링크를 `NOTION_PARENT_PAGE_ID`에 넣습니다.
4. API 서버를 재시작합니다.

- 같은 페이지를 다시 가져오면 새 노트를 만들지 않고 기존 노트를 갱신합니다.
- 내용이 바뀌지 않았으면 다시 저장하지 않습니다 (해시 비교).
- 이미 연결된 Notion 페이지를 덮어쓸 때는 화면에서 확인을 받습니다. 기존 블록은 Notion 휴지통에서 복구할 수 있습니다.
- 지원 블록: 제목, 문단, 목록, 체크박스, 인용, 코드, 구분선. 이미지·표 등은 가져오지 않습니다.

학습 API는 `/api/study` 아래에 있으며 로그인 토큰이 필요합니다.

| 경로 | 메서드 | 기능 |
|---|---|---|
| `/overview` | GET | 과목별 진행률과 복습 현황 |
| `/subjects` | GET, POST | 과목 목록·생성 |
| `/subjects/:id` | PATCH, DELETE | 과목 수정·삭제 |
| `/notes` | GET, POST | 노트 목록·생성 |
| `/notes/:id` | GET, PATCH, DELETE | 노트 조회·수정·삭제 |
| `/notes/:id/studied` | POST | 학습 기록 |

노트 목록은 `q`, `subjectId`, `tag`, `due=true`로 필터링합니다.
학습 기록은 `rating`(`again`, `hard`, `good`, `easy`)과 선택적인 `progress`(0–100)를 받습니다.
과목을 삭제하면 노트는 미분류로 유지됩니다. 다른 사용자의 노트·과목은 조회하거나 수정할 수 없습니다.

## 검증

```powershell
npm run typecheck
npm test
npm run build
```

API 테스트는 `.env`의 DB 이름 뒤에 `_test`를 붙인 별도 MySQL DB(`devmate_test`)를 매번 새로 만듭니다.
이름이 `_test`로 끝나는 DB만 초기화하며 개발 DB는 건드리지 않습니다. 다른 DB를 쓰려면 `TEST_DATABASE_URL`을 지정합니다.
2026-11-07 기준 (MySQL 8.4) 타입 검사, 빌드, API 38개 및 프론트 7개 테스트가 통과했습니다.
브라우저 화면에 대한 자동 테스트는 아직 없습니다.

전체 계획과 남은 작업은 [개발 로드맵](docs/ROADMAP.md)을 참고하세요.

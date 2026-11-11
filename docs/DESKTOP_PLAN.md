# DevMata AI 데스크톱 앱 전환 계획

목표: 설치 파일(`DevMata-AI-Setup.exe`) 하나로 설치하고, 각자 본인 PC의 Claude Code 로그인(본인 Claude 계정)으로 AI를 쓰는 Windows 데스크톱 앱.
Node.js·MySQL·`.env` 편집 없이 동작해야 한다.

작성: 2026-11-10 · 담당: **Claude**(Claude Code) / **Codex**

## 공통 규칙

1. **자기 담당 파일만 수정한다.** 아래 "파일 경계"에 없는 파일을 고쳐야 하면, 이 문서 맨 아래 **요청** 표에 적고 상대 작업을 기다린다.
2. 의존성 설치(`npm install <패키지>`)와 `package-lock.json` 변경은 **Claude만** 한다. Codex는 필요한 패키지를 요청 표에 적는다.
3. 커밋은 각자 자기 파일만 `git add <경로>`로 한다 (`git add -A` 금지). 푸시는 사용자가 요청할 때만 한다.
4. 화면·문서에 쓰는 앱 이름은 **DevMata AI**. 내부 식별자(`devmate` DB/키/패키지명)는 바꾸지 않는다.
5. 단계가 끝나면 이 문서의 상태 칸을 갱신한다.

## 단계와 담당

| 단계 | 내용 | 담당 | 선행 조건 | 상태 |
|---|---|---|---|---|
| 1 | **SQLite 전환**: Prisma provider sqlite, 마이그레이션 재생성, 테스트 DB를 임시 SQLite 파일로, 백업/복원 검증을 파일 복사 방식으로, 기존 MySQL 데이터 이전 스크립트. **`AppSetting` 테이블 추가**(2단계용) | Claude | 없음 | 완료 · AppSetting 포함, 테스트 139개 중 138개 통과(실패 1개는 아래 요청 참고), 실제 데이터 이전·검증 완료 |
| 2 | **설정을 앱 안으로**: `.env` 대신 앱 설정 화면에서 Google·Notion·GitHub·SMTP·AI 모델 입력. 비밀값은 암호화 저장, 읽기 API는 "설정됨" 여부만 반환. `.env` 값이 있으면 기본값으로 사용 | Codex | 1단계의 `AppSetting` 커밋 | 구현 완료 · 관리자 API/화면/동적 설정, 全 테스트 168개 통과 · Electron 화면 검수는 3단계 후 |
| 3 | **Electron 데스크톱 앱**: `apps/desktop` 패키지, 창·트레이·Windows 로그인 시 자동 실행, 데이터 폴더(`%APPDATA%/DevMata AI`), `JWT_SECRET` 자동 생성, API·웹을 앱 안에서 실행 | Claude | 1단계 | 기본 완료 · `npm run desktop`, 앱 창·트레이·자동 마이그레이션·웹 정적 제공 동작 확인. 정식 아이콘·자동 실행 확인은 5단계(설치본) |
| 4 | **Claude 연결 안내**: Claude Code 설치 여부·버전 확인 API, 미설치 시 공식 설치 안내, 로그인 확인(기존 연결 테스트 재사용), 첫 실행 온보딩 화면 | Codex | 없음 (바로 시작 가능) | 구현 완료 · 타입/빌드/단위 테스트 통과, Electron 화면 검수는 3단계 후 |
| 5 | **설치 파일·배포**: electron-builder(NSIS) 설치 파일, GitHub Releases 업로드, 자동 업데이트, 빌드 CI | Claude | 3단계 | 진행 중 · 설치 파일 완료(`npm run desktop:dist` → `%LOCALAPPDATA%\DevMataAI-build\release`, 설치본 API·화면·DB 동작 확인). 남음: 설치본 실제 설치·자동 실행 확인, 다른 사용자용 Google 키, 자동 업데이트, GitHub Releases, CI |
| 6 | **사용자 문서**: README를 "설치 파일 받기 → Claude 연결" 중심으로 재작성, 개발자용 실행 방법은 아래로 | Codex | 5단계 | 대기 |

진행 순서: **1(Claude) ∥ 4(Codex)** → **2(Codex) ∥ 3(Claude)** → **5(Claude)** → **6(Codex)**

## 파일 경계

| 영역 | Claude | Codex |
|---|---|---|
| DB | `apps/api/prisma/**`, `apps/api/src/prisma/**` | — (스키마 변경이 필요하면 요청) |
| 테스트 기반 | `apps/api/test/global-setup.ts`, `test-db.ts`, `env.ts`, `jest` 설정 | 자기 기능의 `*.spec.ts`, `*.e2e-spec.ts` 추가는 가능 |
| 운영 스크립트 | `scripts/**`, `*.bat`, 루트 `package.json`, `package-lock.json` | — |
| 데스크톱 | `apps/desktop/**`, 빌드·배포 설정, CI | — |
| 설정 기능 | `apps/api/src/config/env.validation.ts` (3단계에서 필수값 완화) | 새 모듈 `apps/api/src/app-settings/**`, 각 연동 서비스가 설정을 읽는 부분 (`google-calendar.service.ts`, `notion.service.ts`, `github.service.ts`, `mail/**`의 설정 조회 코드) |
| AI 연결 | — | `apps/api/src/ai/**`의 Claude Code 확인 코드, 온보딩 API |
| 웹 화면 | — | `apps/web/**` 전체 |
| 문서 | `docs/DESKTOP_PLAN.md`(공동), `PRIVACY.md` | `README.md`(6단계), `docs/HANDOFF.md` |

## 인터페이스 약속

**`AppSetting` 테이블 (Claude가 1단계에서 추가)**

```prisma
model AppSetting {
  key       String   @id          // 예: "google.clientId", "google.clientSecret", "notion.token"
  value     String                // 비밀값은 암호화된 문자열 (v1.iv.tag.data, google-crypto.ts의 encryptToken 사용)
  secret    Boolean  @default(false)
  updatedAt DateTime @updatedAt
}
```

- 앱 전체 설정(PC 단위)이다. 수정은 **첫 번째로 가입한 계정(관리자)** 만 할 수 있게 Codex가 API에서 검사한다.
- 우선순위: `AppSetting` 값 → 없으면 `.env`(ConfigService) 값.

**Claude Code 상태 API (Codex가 4단계에서 정의, 예시)**

```
GET /api/ai/claude-code → { installed: boolean, version?: string, path?: string, provider: "claude-cli" | "anthropic-api" | "demo" }
```

- 로그인 여부는 공식 `claude auth status --json`으로 확인한다(추론·사용량 소모 없음). 실제 응답 검사는 사용자가 누르는 **연결 테스트**로만 수행한다(자동 추론 금지).
- Claude Code를 앱에 포함해 재배포하지 않는다. 공식 설치 안내만 한다.

**Electron이 API에 넘기는 환경 (Claude가 3단계에서 보장)**

- `DATABASE_URL=file:<%APPDATA%/DevMata AI/devmata.db>`, `JWT_SECRET`(자동 생성·보관), `HOST=127.0.0.1`, `PORT`, `WEB_ORIGIN`
- 웹은 API와 같은 출처에서 제공된다 (`/api` 프록시 불필요).
- 설치본에는 Google OAuth 클라이언트(Desktop 유형) 기본값이 들어 있다 (`resources/api/app-defaults.json`, 환경변수로 전달). `AppSetting` 값이 있으면 그쪽이 우선.

**앱 정보·업데이트 API (Claude가 C4·C5에서 만든다, Codex는 화면만)**

```
GET  /api/desktop/info    → { desktop: boolean, version: string, dataDir?: string, logDir?: string, update?: { state: "idle"|"checking"|"available"|"downloading"|"ready"|"error", version?: string, error?: string } }
POST /api/desktop/open    { target: "data" | "logs" }   → 204 (탐색기로 폴더 열기, 관리자만)
POST /api/desktop/update  { action: "check" | "install" } → 202 (install 은 재시작해서 업데이트)
```

- 웹 실행(개발 서버)에서는 `{ desktop: false, version }` 만 온다. 화면은 `desktop` 이 false 면 데스크톱 전용 항목을 숨긴다.

## 다음 작업 (2026-11-10 정리)

**사용자**

| # | 할 일 | 언제 |
|---|---|---|
| U1 | 로컬 커밋 푸시 허락 (로고·설치 파일·Google PKCE·앱 복귀 등) | **완료** (2026-11-10 허락, 푸시함) |
| U2 | 앱에서 Google **지금 동기화** 눌러 일정이 들어오는지 확인 | 지금 |
| U3 | 새 설치 파일을 직접 설치해 확인 (개발용 앱은 트레이 → 종료 후) | C1 후 |
| U4 | 기존 '웹 애플리케이션' OAuth 클라이언트 삭제 (Desktop 클라이언트로 잘 되면) | U3 후 |
| U5 | GitHub 저장소 Settings → Secrets 에 `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` 등록 (CI 가 설치 파일을 만들 때 씀). 터미널: `gh secret set GOOGLE_CLIENT_ID` 실행 후 값 붙여넣기, `GOOGLE_CLIENT_SECRET` 도 같게 (값은 `apps/api/.env`) | 첫 배포 전 |
| U6 | (선택) Google 앱 검수 신청 → "확인되지 않은 앱" 경고 제거. 본인 소유 도메인 확인 필요 (GitHub Pages 가능) | 나중 |
| U7 | (선택) 코드 서명 인증서 → SmartScreen 경고 제거. 유료 | 나중 |

**Claude**

| # | 할 일 |
|---|---|
| C1 | 설치 파일 다시 빌드 (새 Desktop 클라이언트·PKCE·앱 복귀 반영), 설치본 실제 실행 점검: 창·트레이·작업 관리자 이름·Windows 시작 시 자동 실행 메뉴·제거 후 데이터 유지 |
| C2 | 예전 자동 실행 정리: `Startup\DevMata AI.lnk`(serve.mjs, 5173/3000) 제거 → 설치본의 자동 실행으로 대체. `start.bat`·`serve.mjs` 는 개발용으로 남기고 안내 갱신. OneDrive 안 빌드 찌꺼기(`apps/desktop/release`) 삭제 |
| C3 | GitHub Actions: push/PR → 타입 검사·전체 테스트, `v*` 태그 → windows 에서 설치 파일 빌드 후 Releases 업로드 (`GITHUB_TOKEN`, Google 키는 Secrets) → **완료** (`.github/workflows/ci.yml`, `release.yml`. Secrets 는 U5) |
| C4 | 자동 업데이트 (electron-updater + GitHub Releases): 시작 시·6시간마다 확인, 내려받으면 트레이·화면에 "재시작해서 업데이트". `POST /api/desktop/update` → **완료** (`apps/desktop/src/updater.cjs`, 화면은 도움말 → 앱 정보. 첫 자동 업데이트는 이 기능이 들어간 버전을 한 번 손으로 설치한 뒤부터) |
| C5 | `GET /api/desktop/info`, `POST /api/desktop/open` (버전·데이터 폴더·로그 폴더) — 위 인터페이스 약속대로 → **완료** (`apps/api/src/desktop`, 화면은 도움말 → 앱 정보. `update` 는 C4 에서) |
| C6 | 설치본 자동 백업: 하루 한 번 `%APPDATA%\DevMata AI\backups` 에 `VACUUM INTO`, 최근 7개 보관. 복원 방법 안내 → **완료** (`apps/api/src/backup`, `DB_BACKUP_DIR`·`DB_BACKUP_KEEP`, 복원은 도움말 FAQ) |
| C7 | 로그 크기 제한 (`logs/api.log` 5MB 넘으면 교체, 3개 보관) → **완료** (`server.cjs` rotateLog) |
| C8 | 버전 관리: `npm run release <버전>` → 버전 올리기·태그. 화면 표시 버전과 설치 파일 버전 일치 → **완료** (`npm run release -- patch`, `minor`, `major` 또는 `1.2.3`, 바로 올리려면 `--push`. `scripts/release.mjs`) |
| C9 | 설치본에서 Claude Code 찾기 점검 (설치본은 PATH 가 다를 수 있음: `%APPDATA%\npm`, `%LOCALAPPDATA%\…` 등) — Codex 의 확인 코드와 함께 → **완료**: `findClaude`(PATH·`~\.local\bin`·WinGet·npm) 가 이 PC 에서 찾음. Codex CLI 는 `chatgpt.service.ts` 가 npm 전역 설치 위치의 `codex.exe` 를 직접 찾고 설치본 API 도 같은 사용자 환경변수를 받으므로 앱이 따로 넘길 필요 없음 |

**Codex** (자기 파일 경계 안에서. 새 API 가 필요하면 위 약속을 쓰거나 요청 표에 적기)

| # | 할 일 |
|---|---|
| X1 | **6단계 README 재작성**: ① 설치 파일 받기(Releases 링크) ② 설치·SmartScreen "추가 정보 → 실행" ③ 첫 실행: 회원가입(첫 계정 = 관리자) ④ Claude Code 설치·로그인·연결 테스트 ⑤ 연동: Google 은 버튼만, Notion·GitHub 은 각자 토큰 ⑥ 업데이트·제거·데이터 위치(`%APPDATA%\DevMata AI`)·백업·복원 ⑦ 자주 묻는 질문(포트 사용 중, Google 경고, AI 연결 실패). 개발자용 실행은 아래 "개발" 절로. 스크린샷 자리 표시 |
| X2 | 설정 → Google Calendar 카드: 데스크톱에서는 리디렉션 URI·Google Cloud 설정 문구 숨김 (Desktop 클라이언트는 등록 불필요). 연결 결과(`?google=`) 안내를 보여 준 뒤 주소에서 쿼리 제거. 실패 이유 문구 다듬기 |
| X3 | Google 연결 직후 자동으로 첫 동기화, "마지막 동기화 시각·가져오는 기간·가져온 일정 수" 표시, 0개일 때 이유 안내 (기본 캘린더만, 기간 밖) |
| X4 | 앱 연결 설정(관리자) 화면: Google 키가 **설치본 기본값**으로 채워져 있으면 "기본값 사용 중" 표시, 직접 입력하면 덮어쓴다는 안내. API 응답에 값 출처(`db`/`env`) 추가 (app-settings 모듈) |
| X5 | **앱 정보** 화면 (설정 맨 아래): 버전, 업데이트 확인·"재시작해서 업데이트" 버튼, 데이터 폴더·로그 폴더 열기 — C4·C5 API 사용, `desktop:false` 면 숨김 |
| X6 | Notion·GitHub 연결 안내: 사용자가 **자기** 토큰을 만드는 단계별 안내(Notion 통합 만들기·페이지 공유, GitHub fine-grained 토큰 권한) 와 링크(외부 브라우저로 열림). 토큰 입력 칸 검증 문구 |
| X7 | 새로 설치한 빈 상태 점검: 첫 실행 → 가입 → Claude 안내 → 연동까지 막힘 없는지, 홈·일정·학습 노트·뉴스·프로젝트의 빈 화면 문구와 "처음 해 볼 일" 안내 |
| X8 | API 연결이 끊겼을 때(앱 서버 재시작 중 등) 화면: 재시도 안내, 무한 로딩 방지 |
| X9 | 작은 창(최소 380px)·큰 글꼴(Windows 배율 150%)에서 레이아웃 점검, 사이드바 접힘 |
| X10 | 비밀번호 재설정: 데스크톱에서 메일 설정이 없으면 "메일 없이 재설정" 대안(관리자가 재설정 또는 안내)으로, 메일 의존 화면 정리 |
| X11 | 테스트 보강: Google 콜백 데스크톱 모드 e2e (`DEVMATA_DESKTOP=1` → HTML 안내, IPC 없으면 리디렉션), 설정 화면 vitest (Google 결과 표시·관리자 전용 항목) → 콜백 e2e **완료**(Claude, 오류 문구 HTML 이스케이프 포함). 설정 화면 vitest 는 Codex 가 `SettingsPage` 작업 끝낼 때 함께 |
| X12 | `docs/HANDOFF.md` 최신화 (데스크톱 앱 기준 구조·실행·빌드·배포 흐름) |
| X13 | 앱 안 도움말 페이지(또는 설정의 "도움말" 절): README 핵심을 짧게, 문제 해결 링크 |

## 요청

| 요청자 | 대상 | 내용 | 상태 |
|---|---|---|---|
| 사용자 → Codex | Claude | Gemini 개인 계정 연결을 공식 Antigravity CLI로 전환 완료. agy.exe 자동 감지/ANTIGRAVITY_CLI_PATH, agy acp v1/oauth-personal, 상대 app-data-dir, 실제 Gemini 카탈로그만 표시. 이 PC CLI 1.5.5 설치, 기존 Google 인증 복구 및 Gemini 3.8 Flash 실제 응답 성공. 관련 테스트 19개·API/웹 빌드 통과. 설치본에는 최신 API/웹 및 관리자 경로 설정 포함 필요. | 전환·실계정 응답 검증 완료 |
| Codex | Claude | Gemini 실제 OAuth 후 서버 거부 확인: 개인 계정용 Gemini CLI는 2026-06-18 지원 종료. 0.68.0 실제 session/new 응답 `This client is no longer supported for Gemini Code Assist for individuals.` 아래 구현 완료 기록은 개인 계정 사용 성공을 뜻하지 않음. OAuth 사용자 설정 보완, 실패/지원 종료 표시·PENDING 복구 경합 방지 완료(18개 테스트·전체 빌드). 공식 대안 `agy acp`는 custom ACP clients 지원, Antigravity 전환은 아직 구현/설치하지 않음. | Gemini 개인 계정 사용 미해결 · 지원 클라이언트 전환 필요 |
| 사용자 → Codex | Claude | Gemini 추가: 공식 CLI ACP + Google 계정 로그인, 격리 GEMINI_CLI_HOME, 공통 연결 UI·해제·상태 확인·실제 카탈로그·AiService 라우팅 구현. GEMINI_CLI_PATH는 공식 index.js 또는 네이티브 파일(.cmd 제외). 새 의존성/lock 없음. 이 PC에 Gemini CLI가 없어 설치·실제 OAuth/추론은 미검증. 설치본에 새 빌드 포함과 공식 CLI 설치 후 smoke 확인 필요. | 구현·mock 회귀 완료 · API 241개·웹 42개 |
| 사용자 → Codex | Claude | Claude 탭에도 연결 해제/다시 연결 추가. 사용자별 Integration CLAUDE_CONNECTION 상태로 앱에서만 해제(전역 Claude 로그아웃 없음), ChatGPT 기존 전용 로그인 해제 유지. 해제한 모델 제외, 모든 계정 미연결 시 AI 요청 차단. 새 API·웹 빌드 포함 필요. | 완료 · API 224개·웹 40개·타입·빌드 통과 |
| 사용자 → Codex | Claude | 수동 both 버튼 폐기. 계정 탭은 연결 확인용이며 서로 연결을 끊지 않음. GET /ai/connections로 Claude 공식 auth status와 GPT account/read를 조회해 실제 연결된 서비스의 모델만 제공. 기존 both 기록은 읽기 호환만 유지. 아래 both 버튼 추가 요청은 이 행으로 대체. | 완료 · API 221개·웹 39개·타입·빌드 통과 |
| 사용자 → Codex | Claude | 계정 선택에 both(둘 다) 추가, 채팅에 선택한 서비스별 모델 목록 표시. GET /api/ai/models, ChatDto/AiRequest provider·model 요청별 전달/검증, 다른 AI 기능 기본값 유지(both면 Claude). 설정 카드의 GPT 전용 테스트 버튼 제거. 새 API·웹 빌드를 설치본에 포함 필요. | 완료 · API 215개·웹 38개·타입·빌드 통과 |
| 사용자 → Codex | Claude | 2026-11-11 직접 요청으로 뉴스 제공자 분기를 Codex가 구현: news.service/controller 및 테스트, 기사 진단 스크립트 수정. 모든 뉴스 AI 요청은 CurrentUser.id → AiService, 캐시는 사용자·제공자·모델별 분리. 임시 GPT 버튼 차단 해제. 사용자 요청으로 ChatGPT 연결 후 UI/모델 자동 선택, AI 비서 일정 추가·삭제 확인 흐름도 반영. 아래 기존 뉴스 연결 요청은 이 행으로 대체. | 구현 완료 · 설치본에는 새 API·웹 빌드 포함 필요 |
| Codex | Claude | ChatGPT 구현 인터페이스 확정: `CODEX_CLI_PATH`는 셸 래퍼가 아닌 네이티브 `codex.exe` 절대 경로. npm 네이티브 경로도 API가 탐색하며 `.cmd`/`.ps1`/`.bat`는 거부. 공식 `codex app-server`의 account/login/start·account/read·account/logout, `codex exec` 사용. 사용자별 `DATABASE_URL` DB 옆 `codex-accounts/<sha256(userId)>`를 CODEX_HOME으로 분리; 앱은 토큰 파일을 읽지 않음. 선택은 Integration AI_PREFERENCE, 모델만 CHATGPT metadata에 저장. 추가 패키지 없음. 사용자가 API 키 방식은 원하지 않아 추가하지 않음. Electron CODEX_CLI_PATH 탐색·전달과 설치본 확인 부탁. | API·화면 구현, 데스크톱 확인 요청 |
| Codex | Claude | 뉴스 제공자 분기: news.service/controller가 인증된 사용자로 AiService를 호출하도록 전환, 사용자·제공자·모델별 캐시 분리, 웹의 GPT 임시 차단 제거. 사용자 직접 요청으로 Codex가 변경 완료했으므로 별도 중복 수정 불필요. | 완료 · API 202개·웹 35개·타입·빌드 통과 |
| Codex | Claude | 2단계 선행 조건: AppSetting을 포함한 1단계 커밋이 준비되면 기록 필요. 현재 DB 작업 중이므로 Codex는 DB 독립 설정 검증·암호화 기반만 준비함. | 완료 (1단계 커밋됨, AppSetting 사용 가능) |
| Codex | Claude | AppSettingsModule 등록: Codex 소유 AiModule에서 import하여 전역 AppSettingsService 제공 완료. app.module.ts 추가 수정은 불필요. ConfigService에 유효 설정을 반영해 기존 Google/Notion/GitHub/메일/뉴스/비서도 새 요청부터 적용. | 해결 · 별도 등록하지 말 것 |
| Claude | Codex | `apps/api/src/ai/claude-code.service.spec.ts` 테스트 제공자 명시 및 child_process의 다른 export 보존으로 수정. | 완료 · 全 테스트 통과 |
| Claude | Codex | README 개발용 설치·DB·백업·복원·테스트 설명을 SQLite/Node 22.13 이상 기준으로 갱신. HANDOFF 상단 최신 기록이 이전 MySQL 시점 기록보다 우선. 설치 파일 중심 재작성은 5단계 후 6단계에서 진행. | 완료 |
| Claude | Codex | (안내) 데스크톱 앱 주소는 `http://localhost:47390` (포트는 `%APPDATA%/DevMata AI/config.json`). Google OAuth 리디렉션 URI 는 `http://localhost:<port>/api/google/callback` 이 되므로 2단계 설정 화면에 이 주소를 보여 주세요. 앱 창 밖 주소(Google 로그인 등)는 기본 브라우저로 열리므로, 콜백 후 브라우저에 "앱으로 돌아가세요" 안내가 있으면 좋습니다. 데스크톱 실행 시 `DEVMATA_DESKTOP=1` 환경변수가 있습니다. | 대기 |
| Claude | Codex | (알림 · Codex 영역을 사용자 요청으로 Claude 가 직접 수정함) ① 로고: `apps/web/public/favicon.svg` 추가, `apps/web/index.html` 에 favicon 링크. favicon 은 `apps/desktop/src/brand.cjs` 의 `logoSvg()` 로 만들며 테스트가 둘이 같은지 확인함 (사이드바·로그인 로고는 그대로). ② Google OAuth PKCE: `google-calendar.service.ts` 의 `authUrl`/`handleCallback` 에 `code_challenge`/`code_verifier` 추가, `google-crypto.ts` 에 `pkceVerifier`/`pkceChallenge`. 설치형 앱용 'Desktop 앱' OAuth 클라이언트로 바꾸기 위한 것. 이 부분을 고칠 때 PKCE 를 빼지 말 것. ③ Google 로그인 후 앱으로 돌아오기: `google-calendar.controller.ts` 콜백이 데스크톱(`DEVMATA_DESKTOP=1`)에서는 새 파일 `desktop-return.ts` 로 브라우저에 안내 페이지를 보여 주고 IPC `{type:"open-app", path:"/settings?google=…"}` 로 앱 창을 앞으로 가져옴 (웹 실행은 기존 리디렉션 그대로). 설정 화면의 `?google=` 결과 표시는 그대로 쓰므로 유지해 주세요. | 알림 |
| Claude | Codex | (AI 비서: Claude / ChatGPT 중 선택) ① ChatGPT 는 각자 PC 의 **Codex CLI + "ChatGPT 로 로그인"** 을 쓰는 방식이면 Claude Code 와 같은 구조라 정책상 문제없음. 앱이 로그인 토큰 파일을 직접 읽어 API 를 부르는 방식은 금지. ② 설치본은 시작 메뉴 PATH 가 오래됐을 수 있어 Claude 는 `CLAUDE_CLI_PATH` 를 넘기고 있음. Codex CLI 도 실행 방법을 정해 여기에 적어 주면 같은 방식(`CODEX_CLI_PATH`)으로 넘김. 참고: npm 설치 시 `%APPDATA%\npm\codex.cmd` 는 셸이 필요하고(`shell:false` 로는 실행 불가), 실제 실행 파일은 `…\node_modules\@openai\codex\node_modules\@openai\codex-win32-x64\vendor\x86_64-pc-windows-msvc\bin\codex.exe`. ③ 구독이 없는 사람용으로 **API 키(Anthropic / OpenAI, 사용량 과금)** 선택지도 함께 두는 것을 권장. 비밀값은 AppSetting 암호화 저장. ④ 새 패키지가 필요하면 요청 표에. | 대기 |
| 사용자 | Claude·Codex | **담당 변경 (2026-11-10)**: Codex 는 AI 비서 Claude/ChatGPT 선택 구현 중. 그동안 Claude 가 X2·X3·X7·X8·X9·X10·X11·X13 을 맡는다 (웹 화면 해당 파일 포함: `GoogleCalendarPanel.tsx`, 각 페이지 빈 화면, API 클라이언트 오류 처리, 비밀번호 재설정, 도움말). Codex 는 AI 작업 + X1·X4·X6·X12 (README·앱 설정·외부 연동 카드·HANDOFF) 를 맡고, 위 Claude 파일을 고쳐야 하면 이 표에 적어 주세요. X5 는 C4·C5 후. | 진행 중 |

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

- 로그인 여부는 토큰을 쓰지 않는 방법이 없으므로, 사용자가 누르는 기존 **연결 테스트**로 확인한다 (자동 호출 금지).
- Claude Code를 앱에 포함해 재배포하지 않는다. 공식 설치 안내만 한다.

**Electron이 API에 넘기는 환경 (Claude가 3단계에서 보장)**

- `DATABASE_URL=file:<%APPDATA%/DevMata AI/devmata.db>`, `JWT_SECRET`(자동 생성·보관), `HOST=127.0.0.1`, `PORT`, `WEB_ORIGIN`
- 웹은 API와 같은 출처에서 제공된다 (`/api` 프록시 불필요).

## 요청

| 요청자 | 대상 | 내용 | 상태 |
|---|---|---|---|
| Codex | Claude | 2단계 선행 조건: AppSetting을 포함한 1단계 커밋이 준비되면 기록 필요. 현재 DB 작업 중이므로 Codex는 DB 독립 설정 검증·암호화 기반만 준비함. | 완료 (1단계 커밋됨, AppSetting 사용 가능) |
| Codex | Claude | AppSettingsModule 등록: Codex 소유 AiModule에서 import하여 전역 AppSettingsService 제공 완료. app.module.ts 추가 수정은 불필요. ConfigService에 유효 설정을 반영해 기존 Google/Notion/GitHub/메일/뉴스/비서도 새 요청부터 적용. | 해결 · 별도 등록하지 말 것 |
| Claude | Codex | `apps/api/src/ai/claude-code.service.spec.ts` 테스트 제공자 명시 및 child_process의 다른 export 보존으로 수정. | 완료 · 全 테스트 통과 |
| Claude | Codex | README 개발용 설치·DB·백업·복원·테스트 설명을 SQLite/Node 22.13 이상 기준으로 갱신. HANDOFF 상단 최신 기록이 이전 MySQL 시점 기록보다 우선. 설치 파일 중심 재작성은 5단계 후 6단계에서 진행. | 완료 |
| Claude | Codex | (안내) 데스크톱 앱 주소는 `http://localhost:47390` (포트는 `%APPDATA%/DevMata AI/config.json`). Google OAuth 리디렉션 URI 는 `http://localhost:<port>/api/google/callback` 이 되므로 2단계 설정 화면에 이 주소를 보여 주세요. 앱 창 밖 주소(Google 로그인 등)는 기본 브라우저로 열리므로, 콜백 후 브라우저에 "앱으로 돌아가세요" 안내가 있으면 좋습니다. 데스크톱 실행 시 `DEVMATA_DESKTOP=1` 환경변수가 있습니다. | 대기 |
| Claude | Codex | (알림 · Codex 영역을 사용자 요청으로 Claude 가 직접 수정함) ① 로고: `apps/web/public/favicon.svg` 추가, `apps/web/index.html` 에 favicon 링크. favicon 은 `apps/desktop/src/brand.cjs` 의 `logoSvg()` 로 만들며 테스트가 둘이 같은지 확인함 (사이드바·로그인 로고는 그대로). ② Google OAuth PKCE: `google-calendar.service.ts` 의 `authUrl`/`handleCallback` 에 `code_challenge`/`code_verifier` 추가, `google-crypto.ts` 에 `pkceVerifier`/`pkceChallenge`. 설치형 앱용 'Desktop 앱' OAuth 클라이언트로 바꾸기 위한 것. 이 부분을 고칠 때 PKCE 를 빼지 말 것. | 알림 |

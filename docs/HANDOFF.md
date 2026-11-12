# 다음 작업을 위한 인수인계

## 2026-11-12 남은 작업 점검·설치본 재생성 (최신)

- 현재 전체 코드 검증 완료: API 36개 스위트/271개 테스트, 웹 11개 파일/50개 테스트, 운영·데스크톱 31개 테스트, API·웹 타입 검사 통과. 대화 저장·화면 패널·일정/할 일/노트 변경·AI 대기열 등 이전 별도 작업도 포함한 현재 작업 트리 기준. 최근 커밋 cea1925와 4bd69b5의 GitHub CI 성공 확인.
- `npm run desktop:dist` 성공. 초기화 대상 stage가 `%LOCALAPPDATA%/DevMataAI-build/stage` 내부임을 검증한 뒤 실행. 최신 설치 파일 `%LOCALAPPDATA%/DevMataAI-build/release/DevMata-AI-Setup-0.1.0.exe` 생성, 런타임 패키지 158개·Google 앱 기본값 포함. 기존 사용자 데이터/AI 인증 파일은 포함하지 않음. 공개 업로드하지 않음.
- win-unpacked의 실제 `DevMata AI.exe`를 ELECTRON_RUN_AS_NODE=1로 실행해 포함된 API를 별도 임시 DB/포트에서 검사. API 바이너리 소스와 웹 index가 현재 빌드와 동일한지 SHA-256 비교, health=ok, Antigravity 안내 최신 웹 제공, /api/ai/gemini 비로그인 401, Google 본인 확인 설정 포함, AssistantMessage 마이그레이션 자동 적용, DB integrity_check=ok/사용자 0명 확인. 검사용 서버 종료. NSIS 설치 마법사·Windows 시작 시 자동 실행을 실제로 검수했다는 뜻은 아님.
- README의 설치 사용자 안내를 완료하고 기존 개발 실행 자료를 하단에 분리. 계획의 5·6단계/C1/X1/U5 상태 갱신. GitHub의 Google Secret 두 개는 이미 등록되어 있어 이름만 확인했으며 값은 출력하지 않음. GitHub Releases는 아직 없음.
- 남음: NSIS 실제 설치·트레이/자동 실행·제거 후 데이터 유지 확인, 다음 배포 버전 결정과 갱신, GitHub Releases 게시와 자동 업데이트 실기동. 앱 기능의 실계정 Google Calendar/Notion/GitHub 연동 검수 및 2개 Google 계정으로 Antigravity keyring 분리 검수는 별도. 서명 인증서·Google 공개 검수는 선택/배포 범위에 따라 진행.

## 2026-11-11 Antigravity 전환 및 실제 응답 성공 (최신)

- 사용자 요청으로 Google 공식 설치 스크립트를 검토하고 Antigravity CLI 1.5.5를 `%LOCALAPPDATA%/agy/bin/agy.exe`에 설치. 프로젝트 의존성/lock 변경 없음. GeminiService가 ANTIGRAVITY_CLI_PATH(구 GEMINI_CLI_PATH 입력 호환) 또는 위 경로의 네이티브 실행 파일을 사용. JS/셸 래퍼 거부. 관리자 ai.geminiPath는 ANTIGRAVITY_CLI_PATH로 연결.
- GeminiAcpClient는 `agy acp --gemini-dir <앱 DB 옆 antigravity-accounts/userHash/.gemini> --app-data-dir antigravity-cli --include-default-customizations=false --disable-telemetry` 사용. **app-data-dir는 상대 폴더 이름이어야 함**. 절대 경로면 OAuth 후 language server가 시작되지 않았고 실제 오류로 수정 확인. ACP initialize 실제 성공(agentInfo Antigravity ACP Server 1.5.5, protocolVersion 1, oauth-personal).
- 전용 `.gemini/antigravity-cli/settings.json`에 command/read/write/url/MCP deny 규칙, useG1Credits=false, historySize=0 적용. 앱은 토큰 파일을 읽거나 이전 CLI 토큰을 복사하지 않음. CLI 자체 keyring 관리 사용. HOME/USERPROFILE/작업/설정 경로는 앱 사용자별 분리하되, Windows keyring의 여러 앱 사용자 간 분리는 아직 실계정 2개로 검증하지 않았으므로 완전한 인증 저장 격리를 주장하지 말 것.
- authenticate 완료 후 session/new 성공을 확인한 다음에만 CONNECTED 저장. 서버 시작 실패로 남은 FAILED도 기존 로그인으로 세션 확인 후 조건부 복구하며, DISCONNECTED는 복구하지 않음. 종료된 구 CLI 오류 기록은 새 Antigravity 로그인 안내로 바꿈. 모델 카탈로그에서 Gemini 모델만 노출하며 다른 제공자 모델은 제외.
- **실제 로그인 복구·모델 목록·추론 성공**: 연결 상태 connected=true/pending=false, 모델 목록 Gemini 3.8 Flash, GeminiService.complete가 provider=gemini/model=gemini-3.8-flash/demo=false/text=`연결 확인 완료` 반환. 검증용 짧은 실제 요청 1회(본인 계정 한도 사용). 사용자 계정 인증은 사용자가 진행했으며 자동 로그인 조작 없음. 관련 단위 테스트 19개 및 API/웹 빌드 통과. 앱 재실행 반영.

## 2026-11-11 Gemini 실제 Google 인증 후 실패 원인 (최신, 아래 성공 추정 기록보다 우선)

- 사용자는 Google Code Assist 인증 완료 화면에 도달했지만 앱 Integration GEMINI는 PENDING. 기존 공식 CLI 0.68.0으로 실제 session/new 검사 시 처음에는 OAuth 설정 누락으로 `Gemini API key is missing or not configured.` 확인. 앱의 시스템 설정 파일은 Windows 보안 검사로 무시될 수 있어 격리 HOME의 `.gemini/settings.json`에도 같은 OAuth/도구 제한 설정 적용.
- 설정 수정 후 실제 Google 서버 오류: `This client is no longer supported for Gemini Code Assist for individuals.` Google 공식 종료 공지 https://developers.google.com/gemini-code-assist/docs/deprecations/code-assist-individuals?hl=en 및 공식 gemini-cli README 확인: 개인 무료/Google AI Pro/Ultra 요청은 2026-06-18 중단. 이전 무료 사용 가능 안내는 오래된 문서에 근거했으며 정정함. 로그인 성공과 AI 서비스 권한은 별개. 추론 미실행.
- ACP 오류를 정해진 한국어 안내로 매핑(원문/토큰 노출 없음), 실패 상태 FAILED와 connectionError 코드만 저장, 화면에 지원 종료 링크 표시. 완료되었지만 중단된 PENDING은 실제 세션 검증 후 조건부 복구하며, 해제와 경합하면 복구하지 않음. 인증 실패도 PENDING에 방치하지 않음. GEMINI_CLI_NO_RELAUNCH=1로 자식 재실행 방지. 관련 단위 테스트 18개 통과.
- **아직 Gemini 개인 계정 연결 해결 완료 아님.** 현재 공식 대안은 Antigravity CLI `agy acp`(ACP v1, oauth-personal, 실제 모델 옵션). 공식 가이드 https://antigravity.google/docs/ide/extensions/acp 에 custom ACP clients 지원 명시. 별도 연결 구현/사용자별 인증 격리 검증 필요. Antigravity 미설치, 이번에는 설치·전환하지 않음. 기존 CLI·토큰을 위장하거나 다른 클라이언트로 사칭하지 않을 것. 사용자 지시에 따라 Claude/ChatGPT 및 CLI 방식 유지.

## 2026-11-11 Gemini 연결 버튼 비활성 수정

- 후속 실제 CLI 검사: 설치된 0.68.0과 앱 GeminiAcpClient로 ACP initialize 성공(protocolVersion=1, oauth-personal 지원 확인), 추론 미실행. 앱 DB의 GEMINI 연결 기록은 아직 없음. 기존 CLI 방식 유지 요청에 따라 웹 채팅/MCP 전환 없음. 사용자 요청으로 Google 본인 확인 완료 안내에서 `이 탭은 닫아도 됩니다.` 앞 `<br>` 추가, API 빌드와 앱 재시작 반영.
- 이 PC에 공식 Gemini CLI 0.68.0 전역 설치 완료(프로젝트 의존성/lock 변경 없음). 최신 npm 패키지는 `bundle/gemini.js`가 실행점이므로 이 경로를 먼저 탐색하고 구버전 `dist/index.js`도 유지. 공식 CLI `--version` 실행 및 앱 서비스의 enabled/installed=true 확인, 관련 테스트 13개·API 빌드 통과. 실제 Google 로그인과 추론은 아직 미검증.
- 사용자 후속 요구: Claude·ChatGPT·Gemini 모두 일반 무료 계정으로 GUI처럼 이용 희망. 아직 무료 웹 채팅 자동화/임베딩으로 전환하지 않음. 무료 웹 사용 가능 여부와 DevMata 자동 일정/뉴스 연동 지원은 별개이며, Gemini는 CLI 자체가 무료 Google 계정을 지원함. 서비스별 공식 연결 권한/한도를 따를 것.

## 2026-11-11 Gemini 추가 (최신)

- GeminiService와 GeminiAcpClient 추가. Google 공식 CLI의 ACP v1(stdio JSON-RPC) initialize → authenticate(oauth-personal) → session/new → session/set_model 또는 set_config_option → session/prompt 사용. 직접 Google API 호출·토큰 파일 읽기·API 키 입력 없음. Gemini 모델은 실제 세션 카탈로그만 사용. 채팅·뉴스·학습·프로젝트의 AiService 라우팅과 연결 목록에 gemini 추가, 실패 시 자동 fallback 없음.
- GEMINI_CLI_PATH 우선, 없으면 `%APPDATA%/npm/node_modules/@google/gemini-cli/dist/index.js` 탐색. JS는 현재 Node/Electron 런타임으로 실행, shell:false, .cmd/.bat/.ps1 거부. 새 npm 의존성/lock 변경 없음. 이 PC는 공식 Gemini CLI 미설치이며 실제 Google 로그인·실제 Gemini 추론은 검수하지 못함. 설치와 실제 CLI smoke는 후속 확인 필요.
- DB 옆 `gemini-accounts/<sha256(userId)>`를 GEMINI_CLI_HOME으로 격리. 앱 DB에는 Integration GEMINI의 연결 상태만 저장. 공식 CLI가 인증 저장/갱신을 관리. 상태 조회는 NO_BROWSER=true와 CONNECTED 상태에서만 session/new, 사용자가 연결 버튼을 누른 경우에만 브라우저 인증 허용. 취소/해제 epoch와 DB updatedAt 조건으로 지연 로그인 완료의 연결 부활 차단. 해제는 앱 전용 상태 비활성화이며 글로벌 Google 로그아웃을 하지 않음.
- 앱 전용 시스템 설정 파일로 Google OAuth만 사용, tools.core=[]·MCP 허용 없음·hooks/telemetry 비활성·추가 컨텍스트 없음. API 키/클라우드 인증 환경 제거. ACP 클라이언트는 파일/터미널 요청 거절·권한 취소·도구 호출 중단, 완료된 자기 세션 답변만 반환. CLI 자체가 세션을 로컬 저장할 수 있어 1일/최대 10개 보관 설정 적용. 인증 파일을 앱이 직접 읽거나 복사하지 않음.
- 세 서비스 연결됨 UI는 같은 ConnectedAccount 사용. Gemini 탭·Google 연결/취소·연결 해제·상태 확인·미설치 안내, Gemini 계정 모델 선택 추가. API 241개·웹 42개·타입·빌드 통과. 프로토콜/서비스는 mock, 실제 설치/로그인 검증이 아님. 기존 두 서비스 동작은 회귀 검증 통과.


## 2026-11-11 서비스별 연결 해제 (최신)

- 후속 UI 통일: Claude/ChatGPT 연결됨 화면은 같은 ConnectedAccount 컴포넌트를 사용. 상태·이메일·계정 연결 해제·연결 상태 다시 확인·안내 문구의 구조와 간격을 통일하고 ChatGPT의 미연결 상태에서도 다시 확인 가능. 두 화면 마크업 동일성 테스트 포함 웹 41개·웹 빌드 통과. API는 위 224개 통과 버전 유지.

- Claude 연결 해제/다시 연결 버튼 추가. POST /ai/claude-code/disconnect·connect는 사용자별 Integration CLAUDE_CONNECTION.status를 저장. Claude 전역 CLI auth logout은 호출하지 않으며 기존 다른 세션에 영향 없음. 공식 CLI 로그인 상태가 true여도 앱에서 해제했다면 connected:false 유지. 재연결은 native 로그인 상태를 확인한 뒤 명시적으로만 수행.
- ChatGPT의 기존 전용 CODEX_HOME 로그아웃 버튼은 유지. 두 서비스 연결은 독립적으로 관리하며 연결을 해제한 서비스의 모델을 제외. 다른 사용자 앱 연결에는 영향 없음. 모든 계정 미연결 시 defaultProvider:none, AI 호출 차단(데모/기타 제공자로 자동 전환 없음), RSS 조회는 유지.
- 공개 status와 로그인 상태를 구분해 Claude 응답에 loginConnected/enabled 제공. 해제 후에는 다시 연결 버튼, CLI 미로그인이면 안내 링크 표시. 미연결 채팅에는 설정 연결 안내.
- 최종 검증: API 전체 224개·웹 40개·타입 검사·빌드·diff --check 통과. 사용자별 해제 상태 유지, 다른 사용자의 연결 독립성, 명시적 재연결, 미연결 시 실제 AI 실행 차단 포함. 새 API·웹 빌드 반영을 위해 데스크톱 재시작 수행.


## 2026-11-11 연결 상태 자동 인식 (현재 동작)

- 최신 사용자 요청: 수동 both 버튼 삭제. Claude/ChatGPT 버튼은 연결 상태를 보는 로컬 UI 탭이며 PATCH selection을 호출하지 않음. 탭 변경으로 다른 연결이나 기본 제공자를 바꾸지 않음.
- GET /ai/connections: ClaudeCodeService.connection의 공식 `claude auth status --json` + ChatGptService.status를 합쳐 연결된 providers와 defaultProvider 반환. Claude는 loggedIn과 구독 authMethod(claude.ai/oauth_token)만 인정하며 API 키 연결·파싱 실패는 제외. 명령 15초/16KiB/shell:false, API 키 환경 제거, 10초 캐시, 공개 이메일만 반환. 실제 설치 CLI 응답 형식 확인, AI 추론 사용량 없음.
- 모델 목록과 채팅 override 허용은 저장된 both/선택값이 아닌 실제 연결 상태로 판단. 두 연결이면 두 모델 그룹을 자동 표시. 기본 제공자는 기존 선호가 연결돼 있으면 유지하고 아니면 연결된 계정 중 선택. 실행 실패 후 다른 AI로 fallback하지 않음. demo 기본 동작 유지. 기존 저장 both는 읽기 호환만 두고 새 저장은 허용하지 않음.
- Claude 온보딩의 명시적 테스트는 POST /ai/claude-code/test로 Claude를 지정해, 다른 기본값 때문에 GPT로 호출되는 문제 방지. 상태 조회에는 추론 없음. 계정 카드 포커스 복귀 시 상태 갱신.
- 전체 API 221개·웹 39개 테스트, 타입 검사·빌드 통과. 아래 수동 both 선택 설명은 이 기록으로 대체. 설치본에는 새 빌드 포함 필요.


## 2026-11-11 채팅 모델 선택 (최신 요청)

- 계정 선택을 claude-cli / chatgpt / both로 확장. both는 채팅에서 두 모델 그룹을 보이며 기본 요청·뉴스·학습·프로젝트는 Claude 유지. cacheScope도 실제 기본 제공자(Claude) 기준으로 계산해서 demo로 잘못 전환되지 않게 함.
- GET /api/ai/models: 저장된 사용자 선택으로 그룹을 제한. Claude는 CLI의 haiku/sonnet/opus 별칭, ChatGPT는 해당 계정의 실제 카탈로그 사용. ChatGPT 조회 실패 시 Claude 목록은 유지하고 재연결 안내.
- ChatDto/AiRequest의 provider/model은 요청별 옵션. AssistantService가 전달하고 AiService가 사용자 선택과 비교·검증하여 해당 제공자로 라우팅. Claude 별칭 검증, ChatGPT 계정 카탈로그 모델 검증. 개인 기본 모델/뉴스 캐시를 바꾸는 저장 API를 채팅에서 호출하지 않음. 오류 시 다른 서비스로 자동 fallback 없음.
- 설정 카드의 ChatGPT 연결 테스트 제거, 연결 후 상태·이메일·해제 표시. ChatModelPicker를 AI 채팅에 추가하고 서비스별 optgroup, 기본 모델, 새로고침 제공. 기존 Claude 온보딩 테스트는 both에서도 Claude 기본값으로 동작.
- API 215개·웹 38개 테스트, API/웹 타입 검사·빌드 통과. 실제 계정 AI 추론과 Windows 화면 조작은 실행하지 않음. 실행 중인 데스크톱 API는 재시작해야 새 모델 목록 라우트·요청 옵션이 반영됨. 아래 기록의 “모델 선택 UI 삭제”는 설정 카드에 한정되며, 채팅에는 위 선택 기능이 새로 생김.


## 2026-11-11 뉴스 분기·ChatGPT UI·비서 일정 추가 (최신)

- 사용자가 뉴스의 Claude/ChatGPT 분기를 직접 요청해 `news.service.ts`, `news.controller.ts`와 관련 테스트를 변경함. 직접 Claude/API 호출을 제거하고 인증된 CurrentUser.id로 AiService.complete 호출. AI 선택 변경 감지(요청 전 scope 검사), 사용자·제공자·모델·분야별 캐시/동시 요청 분리, 처리 도중 선택이 바뀌면 캐시 저장하지 않음. 목록·브리핑 조회도 자기 scope의 요약만 노출. ChatGPT 임시 차단 UI 제거, 접근 실패와 제공자 연결 오류는 안내하며 자동 fallback 없음.
- 사용자가 제공한 화면 기준 ChatGPT 로그인은 연결된 상태였음. 연결 후 로그인 버튼을 숨기고 “ChatGPT 연결됨”·이메일·테스트·해제 표시. 모델 목록/선택 UI 삭제. ChatGptService가 계정 카탈로그의 isDefault 모델(없으면 첫 공개 모델)을 자동 저장·사용하며 카탈로그 일시 오류가 로그인을 끊지 않음. 제품 화면의 Codex 문구는 ChatGPT로 변경, 내부 CLI 방식은 유지.
- 사용자 추가 요청으로 `assistant.dto.ts`, `assistant.service.ts`, 새 `assistant.events.ts`, AssistantPage 제안 표시 확장. event_create를 기존 10분 만료/확인/취소/중복 방지 트랜잭션에 연결. 입력·AI 출력 모두 날짜·시간대·종료 순서·길이 검증, 종일 일정은 KST 자정~마지막 포함일 다음 자정. event_delete 미리보기에 시간·장소 포함, 원래의 소유권·updatedAt·LOCAL 검사 유지. 채팅에 앞으로 30일 일정 최대 30개를 추가하고 검색 일정에도 시간·출처 제공. DB/lock 변경 없음.
- 최종 검증: API 전체 202개·웹 35개 통과(뉴스/AI 단위 27개, 일정 e2e 8개, 연결 상태 4개·일정 미리보기 3개 포함). API/웹 타입 검사·프로덕션 빌드·git diff --check 통과. 실제 계정 AI 사용량을 소모하는 테스트는 실행하지 않음. 실행 중인 앱은 재시작해야 새 서버 로직이 반영되며 설치본 재생성은 데스크톱 담당 범위.
- 뉴스 진단 스크립트 `news-original-smoke.cjs`는 NEWS_SMOKE_USER_ID에 명시한 앱 사용자의 선택으로 실행하도록 변경. 기사 자체는 변경하지 않지만 AiUsageLog는 기록하므로 예전 “DB 변경 없음” 설명과 다름.

아래 11월 10일의 모델 선택 UI·뉴스 미완료 설명은 위 기록으로 대체됨.

## 2026-11-10 Claude / ChatGPT 개인 선택 (Codex, 최신)

- `AiService.selection/select`: Integration의 AI_PREFERENCE metadata에 사용자별 제공자 저장. `complete`가 인증된 userId로 선택을 조회해 비서·학습·프로젝트 요청에 적용. 실패해도 Claude·데모로 자동 전환하지 않음. AI 사용 기록은 실제 제공자로 남김. 앱 기본값은 기존 관리자 설정 유지.
- ChatGPT는 공식 **Codex CLI** 사용. `codex app-server --listen stdio://`의 account/login/start(chatgpt), account/read, account/login/cancel, account/logout, model/list로 로그인·모델 관리. 추론은 `codex exec --ignore-user-config --ignore-rules --ephemeral --sandbox read-only --json`으로 실행. 토큰 파일 직접 읽기·직접 OpenAI HTTP 호출·API 키 입력 없음. 초기의 직접 OAuth 초안은 제거함.
- CODEX_HOME은 DATABASE_URL DB 폴더 아래 `codex-accounts/<sha256(userId)>`. 일반 Codex 전역 로그인과 분리. Codex가 인증 저장·갱신하며 앱 DB에는 선택 모델만 저장. 로그인 URL은 공식 auth.openai.com/chatgpt.com 출처만 허용. 추론은 별도 임시 폴더, shell:false, 셸·hooks·플러그인·앱·브라우저·이미지 도구 비활성, 상속 API 키 제거, 120초·2MiB 제한. 부분 응답·실패 이벤트를 성공으로 표시하지 않음.
- 실행 경로: 관리자 `ai.codexPath` → CODEX_CLI_PATH → npm의 실제 Windows 네이티브 경로/사용자 로컬 경로 → PATH. .cmd/.bat/.ps1 거부. Claude에게 Electron CODEX_CLI_PATH 전달과 설치본 확인 요청 기록. 새 패키지/lock/DB 스키마 변경 없음.
- 개인 설정 카드 + 첫 실행 온보딩에서 Claude/ChatGPT 선택, 공식 로그인 링크, 취소·로그아웃, 모델 선택, 수동 연결 테스트. 중복되는 외부 연동 카드의 앱 기본 AI 테스트 행 제거.
- **미완료 경계**: 뉴스 서비스는 직접 Claude 호출. DESKTOP_PLAN 요청 표에 Claude 담당 뉴스 서비스/컨트롤러를 AiService로 전환하고 사용자·제공자·모델별 캐시 분리 요청. 그전까지 GPT 선택 시 NewsDigestCard/ArticleExcerpt/NewsPage의 뉴스 AI 버튼 차단. NewsPage 변경은 새 Claude 담당 배정을 읽기 전에 한 변경이므로 보존·조정 요청. 서버 직접 뉴스 경로는 아직 Claude 전용임.
- 검증: 전체 API 186개(신규 계정·프로세스 단위 12개 + 개인 선택 e2e 4개 포함), 웹 28개 통과; API/웹 타입·빌드 통과. 실제 설치 Codex를 빈 임시 CODEX_HOME에서 초기화·account/read 성공(account:null), 기존 로그인·실제 AI 사용량 건드리지 않음. 실제 ChatGPT 로그인과 유료 추론·Electron 화면/설치본 검수는 미실행. 회귀 검증은 다른 작업 DB 잠금을 피하려고 전용 `chatgpt-regression-test.db` 사용.


## 2026-11-10 2단계 구현 완료 (Codex, 아래 준비 기록보다 우선)

- 선행 커밋 `169af03`(SQLite/AppSetting) 확인 후 구현. 현재 DB는 SQLite이고 MySQL 설치가 필요 없음. Node 22.13 이상, 개발 DB는 `DATABASE_URL=file:../../../data/devmata.db`(prisma 기준), 테스트 DB는 `apps/api/.test/devmata-test.db`.
- `GET/PATCH /api/app-settings`: 최초 가입 계정(createdAt, id 순)만 조회·저장. PATCH `{values: {설정키: 문자열|null}}`. 전체 검증 후 트랜잭션 저장, 비밀값 AES-GCM 암호화, GET에서 비밀값/암호문 미노출.
- 설정 화면 AppSettingsCard: 항목별 설정 여부/출처, 비밀값 교체·비활성·기본값 복귀. 빈 비밀 입력란은 패치에서 생략. 최초 가입자가 아닌 경우 권한 안내 표시.
- AppSettingsModule은 **AiModule의 imports**로 등록하고 전역 export. app.module.ts를 추가 수정하지 않아 파일 경계 유지. AppSettingsService가 시작/저장 후 유효값을 공유 ConfigService에 반영하므로 기존 연동 서비스와 직접 CLI를 쓰는 뉴스·비서·프로젝트도 새 요청부터 반영. 원래 환경 기본값은 별도 스냅샷으로 보관해 null 삭제 시 복귀.
- AiService의 제공자/모델/경로도 요청 시 조회. 요청 처리 도중 저장한 설정은 다음 요청부터 사용하는 용도. 관리자가 바꾼 Google OAuth 클라이언트는 재연결 필요.
- Claude Code 테스트의 제공자 명시 및 child_process mock 수정. 전체 API 148개 + 웹 20개 = 168개 테스트 통과, 타입 검사·빌드 통과. 외부 계정으로 실제 인증/메일 발송은 수행하지 않음. Electron 화면 검수는 3단계 완료 후 필요.
- README 개발용 MySQL 설치·권한·덤프 안내를 SQLite 생성·VACUUM INTO 백업·서버 종료 후 파일 복원 방식으로 수정. README 설치 파일 중심 전체 재작성은 6단계에서 진행.
- 다음은 Claude 담당 3단계(Electron). Codex 6단계는 5단계 설치 파일 준비 후 진행. DB/데스크톱/의존성/공용 테스트 기반 변경 없음.

## 2026-11-10 2단계 기반 준비 (Codex)

- `apps/api/src/app-settings/settings-schema.ts`: Google·Notion·GitHub·SMTP·Claude 설정 목록, 비밀값 구분, 허용 키·포트·이메일·콜백 URL·모델 검증. 현재 실제 구현된 AI 제공자 claude-cli/demo만 선택 허용.
- `settings-values.ts`: 기존 google-crypto AES-GCM 재사용, AppSetting 우선·환경변수 대체 규칙, 비밀값 비노출 조회 메타데이터. null은 앱 설정 삭제 후 환경변수로 복귀, 빈 문자열은 환경변수를 덮어쓰는 명시적 비활성 값으로 설계. UI의 비밀번호 빈칸은 저장 요청에서 생략하도록 후속 구현 필요.
- 독립 단위 테스트 12개와 API 타입 검사 통과. DB·패키지·공용 테스트 기반은 수정하지 않음.
- **미완료**: 관리자(최초 가입 사용자) 권한 검사, DB 저장 API, 설정 화면, 서비스별 동적 설정 조회. 계획서가 요구하는 AppSetting 포함 1단계 커밋이 아직 없어 통합 작업 대기 중.
- 계획서 요청 표에 선행 커밋과 파일 경계 밖 app.module.ts 모듈 등록 요청을 남김. 새 AppSettingsModule/Service 자체는 아직 만들지 않았으므로 지금 등록하지 말 것.

## 2026-11-10 데스크톱 전환 4단계 (Codex)

- `docs/DESKTOP_PLAN.md` 파일 경계를 준수해 `apps/api/src/ai/**`, 웹 화면과 공동 문서만 수정. 패키지 설치·DB·테스트 기반·운영 스크립트 변경 없음.
- 인증된 `GET /api/ai/claude-code`: 설정된 `CLAUDE_CLI_PATH`(기본 claude)에서 `--version`만 실행. 설치·버전·경로·설정 제공자와 `loginVerified: false` 반환. 타임아웃 15초, 출력 제한, shell 비활성화, API 키 환경변수 제거.
- 첫 로그인 후 계정별 온보딩: 설치 확인 → 공식 설치 안내 → 본인 계정 로그인 → 사용자가 누르는 기존 `POST /api/ai/test`. 자동 AI 요청 없음. demo나 다른 제공자의 응답은 실제 Claude Code 성공으로 표시하지 않음.
- 연결을 나중으로 미루고 앱을 사용할 수 있음. 설정의 Claude Code 설치·로그인 안내 링크(`/claude-setup`)로 재진입 가능. 로컬 저장소에 온보딩 완료/건너뛰기 상태만 저장.
- 설치 문서: https://code.claude.com/docs/en/setup . Claude Code 설치 파일·자격증명을 앱에 포함하지 않음.
- 설치 확인 단위 테스트 4개, 웹 테스트 20개, 전체 타입 검사와 빌드 통과. SQLite 전환과 충돌하지 않도록 설치 확인 테스트는 DB 글로벌 셋업 없이 독립 실행함. 실제 로그인 테스트는 자동 실행하지 않음. Electron 내 화면 검수는 3단계 완료 후 필요.
- 다음 Codex 작업은 **1단계 AppSetting 커밋 후 2단계**. `app.module.ts`의 새 설정 모듈 등록이 필요할 경우 파일 경계 밖이므로 계획서 요청 표를 통해 Claude에게 요청해야 함.

기록일: 2026-11-07 (한국 시간), 2026-11-08·09 추가 작업 반영

## 2026-11-09 추가 작업

- Aside 브라우저 점검(일부): 데모 데이터, 일정·할 일 DEMO 배지, 검색→노트 바로 열기, 프로젝트 작업 추가·상태 변경,
  AI 주간 보고서, 비서 채팅 변경 제안→확인 적용까지 정상. 수정 후 재점검: PC 폴더 등록·파일 목록(.env 숨김)·AI 진행률 분석,
  비서의 작업 상태 변경·작업 추가 제안 카드와 적용, 노트 상세 제목, 대시보드 바로가기 모두 정상. 점검 후 데모 데이터는 삭제함.
- 점검에서 고친 것: 버튼 글자 두 줄 깨짐(공통 Button `whitespace-nowrap`), 노트 상세 제목이 좁은 폭에서 글자 단위로 끊김,
  대시보드의 오래된 "Phase N 예정" 카드 → 실제 화면 바로가기, 데모 카드 문구, 주간 보고서 시각을 KST로 표기, 미사용 ComingSoonPage 삭제.
- 채팅 Enter 보내기 / Shift+Enter 줄바꿈 (한글 조합 중 Enter 무시).
- 프로젝트 PC 폴더·GitHub 파일 읽기(읽기 전용)와 AI 진행률 추정(`Project.localPath`, `aiProgress`, `aiProgressDetail`, `aiProgressAt`,
  마이그레이션 `20261109003941_add_project_files_ai_progress`). 사용자는 파일 수정보다 "파일을 보고 진행률 자동 산정"을 원함.
- 비서 변경 제안 확장: project_create/update, item_create/update/delete (모두 확인 후 적용).
- 검증: API 74개(단위+e2e) + 웹 7개 테스트, 빌드, 실제 Claude `progress:smoke` 통과.
- 이 작업과 별개로 `scripts/`의 서버 자동 시작·제어·백업 검증 파일과 `main.ts`(HOST), `.gitignore`, 루트 `package.json`,
  `integrations.controller.ts` 변경이 다른 작업에서 생겨 있었음. 사용자 요청으로 내용 확인·테스트(`test:ops` 4개, 전체 74개) 후
  별도 커밋 `356a7fb`(서버 운영 스크립트)으로 커밋함.

## 2026-11-08 추가 작업

- AI 비서: 한국어 조사·요청어를 떼는 키워드 추출(`apps/api/src/assistant/keywords.ts`)을 추천과 채팅 검색에 적용.
  채팅은 문장 전체 대신 키워드 최대 5개로 관련 기록을 찾음.
- 검색·추천의 학습 노트 링크를 `/study?note=<id>`로 변경해 해당 노트가 바로 열림.
- 주간 보고서 프롬프트 크기 제한: 작업 40개, GitHub 항목 종류별 30개, 메모·커밋 메시지 축약, 생략 개수 전달.
- 만료 후 하루 지난 `AssistantAction` 행은 새 제안을 만들 때 정리.
- 데모 데이터: `GET/POST/DELETE /api/demo`, 설정 화면 **데모 데이터** 카드, 할 일·일정·학습 노트에 `DEMO` 배지.
  스키마 변경 없음 (기존 `isDemo` 칸 사용). 프로젝트는 `isDemo` 칸이 없어 데모 대상에서 제외.
- README: `start.bat`, `backup-db.bat`, Google Calendar, GitHub 토큰 설정 설명 추가.
- 검증: 타입 검사, 빌드, API 69개 + 웹 7개 테스트 통과. 브라우저 점검은 Aside 미연결로 아직 못 함.
- GitHub 비공개 저장소(`jh10050730/DevMataAI`, `main`)는 2026-11-07에 푸시함. 11-08 커밋은 사용자가 요청할 때 푸시.

---

아래는 2026-11-07 종료 시점 기록이다. 다음 작업은 브라우저 사용 흐름 점검부터 시작한다.

## 현재 상태

- React/Vite 웹 + NestJS API + Prisma/MySQL 개인 워크스페이스.
- 기본 인증·대시보드·일정·할 일과 학습 관리 구현.
- Google Calendar 읽기 전용 동기화 코드와 테스트가 추가됨. 실제 계정 연결 여부는 별도 확인 필요.
- Phase 3: IT·경제·금융/증권·부동산·국제·정치·사회 RSS, 검색·중복 제거·분야별 브리핑과 AI 분석.
- 뉴스는 API 서버 실행 중 매일 오전 7시(Asia/Seoul) 수집. 당일 미수집 보충과 30분 간격 실패 재시도, 수집 기록 DB 저장.
- Phase 4: 프로젝트·목표·기능·작업 CRUD, 작업 완료 기준 진행률, 선택적 GitHub 활동 조회, AI 주간 보고서와 근거 저장.
- 사용자 GitHub 저장소는 아직 없으며 생성하거나 연결하지 않았음. 공개 예제 저장소로만 API 연결 검증.
- Phase 5: 비서 채팅, 아침 브리핑, 통합 검색, 프로젝트 키워드 기반 학습·뉴스 추천.
- 비서 변경 제안은 소유자 확인 후 적용. 10분 만료·취소·재실행·대상 변경 검사와 트랜잭션 적용. Google 사본 일정 삭제 차단.

## 마지막 확인 결과

- 전체 테스트: API 64개 + 웹 7개 = 71개 통과.
- 전체 빌드 통과.
- 실제 Claude CLI 비서 응답 확인: 빈 검사 계정에서 개인 데이터를 지어내지 않고 조회 범위를 설명함. 임시 계정 삭제 완료.
- RSS 8개 출처 수집 성공, 추가 기사 302개 저장 확인.
- GitHub 공개 예제 저장소의 커밋·이슈·PR 조회 성공.
- 코드 저장 확인 시 HEAD: `35d1ce6` (Phase 4·5 구현). 작업 트리는 깨끗했음.
- 위 검증은 마지막 실행 시점 결과이며 브라우저 시각·상호작용 검증 완료를 의미하지 않음.

## 다음에 할 일

1. 기존 실행 프로세스와 최신 파일 상태를 확인하고 `start.bat` 또는 `npm run dev`로 앱 실행.
2. 브라우저에서 로그인과 일정·학습·프로젝트 작성/수정/삭제, 뉴스 검색, 모바일 화면 점검.
3. 실제 데이터에 근거한 AI 답변과 변경 제안 확인·취소 흐름 점검.
4. 화면 오류를 수정한 뒤 필요한 테스트만 재실행.
5. DB 백업 복원과 장기 서버 실행 방식을 정리. 서버/PC가 꺼져 있으면 뉴스 자동 수집은 실행되지 않음.

## 남아 있는 제약

- 비서 대화는 화면 내 유지이며 새로고침하면 초기화됨.
- 아침 브리핑은 조회 화면이며 자동 알림 발송 기능은 없음.
- 비서는 저장된 데이터의 제한된 범위를 참고함. 실시간 외부 캘린더·GitHub·Notion·뉴스 원문을 자동 조회하지 않음.
- 지원하는 비서 변경: 할 일 완료·제목 변경·삭제, 로컬 일정·학습 노트·프로젝트 삭제. 프로젝트 삭제는 하위 작업·보고서도 삭제.
- 실제 뉴스 AI 분석·프로젝트 AI 보고서와 브라우저 화면은 비서 연결 검사와 별도로 검증 필요.
- 로드맵 아래쪽에는 초기 체크리스트가 남아 있으므로 상단 구현 현황과 이 기록을 우선함.

## 작업 선호

- 사용자는 일상적인 작업 확인 질문과 권한 요청을 최대한 줄이길 원함.
- RTK가 지원하는 셸 명령은 명시적으로 RTK를 통해 실행. `C:/Users/jh100/.codex/RTK.md` 준수.
- 다른 작업에서 파일이 동시에 바뀐 이력이 있음. 수정 직전 최신 파일을 확인하고 기존 변경을 보존.
- `.env`, 개인 DB와 `backups/`는 Git에 넣지 않음. 원격 푸시는 사용자가 요청할 때만 함.
- 사용자에게는 한국어로 답함. 브라우저 점검은 항상 Aside 브라우저에서 함 (Chrome 사용 안 함).

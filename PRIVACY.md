# DevMate AI 개인정보처리방침

최종 수정일: 2026-11-10

DevMate AI는 각 사용자가 **자기 PC에 직접 설치해 실행하는 개인용 오픈소스 앱**입니다.
개발자가 운영하는 서버는 없으며, 앱이 다루는 모든 데이터는 사용자의 PC에서만 처리·저장됩니다.
개발자는 어떤 사용자 데이터도 받거나 볼 수 없습니다.

## 1. Google 사용자 데이터

Google 계정을 연결하면 앱은 다음 권한만 요청합니다.

| 권한 | 용도 |
|---|---|
| `openid`, `email` | 연결된 Google 계정 이메일을 설정 화면에 표시 |
| `calendar.readonly` | 기본 캘린더의 일정(제목·시간·장소·설명)을 **읽기만** 해서 앱 일정 화면에 표시 |

- 앱은 Google 캘린더의 일정을 만들거나, 바꾸거나, 지우지 않습니다.
- 가져온 일정은 사용자 PC의 MySQL 데이터베이스에만 저장됩니다.
- Google 접근 토큰은 사용자 PC의 데이터베이스에 AES-256-GCM으로 암호화해 저장합니다.

## 2. 데이터 사용 범위

- Google 데이터는 사용자 본인에게 일정을 보여 주고, 사용자가 요청한 기능을 제공하는 데에만 사용합니다.
- 사용자가 AI 기능(아침 브리핑, 비서 채팅 등)을 직접 실행하면, 답변에 필요한 오늘 일정 정보가
  **사용자 본인이 로그인한 Claude Code 또는 본인의 Anthropic API 키**를 통해 Anthropic에 전달됩니다.
  AI 기능을 쓰지 않으면 일정 정보는 PC 밖으로 나가지 않습니다.
- Google 데이터를 판매하거나, 광고에 사용하거나, 제3자에게 제공하지 않습니다.
- Google 데이터를 AI 모델 학습에 사용하지 않습니다.

DevMate AI의 Google API 사용과 데이터 처리는
[Google API 서비스 사용자 데이터 정책](https://developers.google.com/terms/api-services-user-data-policy)의
제한적 사용(Limited Use) 요구 사항을 따릅니다.

## 3. 그 밖의 데이터

회원 계정(이메일, 해시된 비밀번호), 할 일, 일정, 학습 노트, 프로젝트 정보도 모두 사용자 PC의 데이터베이스에만 저장됩니다.
Notion·GitHub 연동은 사용자가 직접 발급해 `.env`에 넣은 토큰으로, 사용자 본인 계정의 데이터에만 접근합니다.

## 4. 연결 해제와 삭제

- 앱의 **설정 → 외부 연동 → Google Calendar → 연결 해제**를 누르면 Google에 토큰 폐기를 요청하고, PC에 저장된 토큰을 지웁니다.
  이때 가져온 Google 일정도 함께 지울지 선택할 수 있습니다.
- [Google 계정 → 서드파티 연결](https://myaccount.google.com/connections)에서도 언제든 접근 권한을 취소할 수 있습니다.
- 데이터는 모두 사용자 PC에 있으므로, 앱 데이터베이스를 지우면 모든 데이터가 삭제됩니다.

## 5. 문의

[GitHub Issues](https://github.com/jh10050730/DevMataAI/issues)로 문의해 주세요.

---

## Summary (English)

DevMate AI is a self-hosted, open-source personal app that each user runs on their own computer.
There is no developer-operated server; the developer never receives any user data.

- Google scopes: `openid`, `email`, and `calendar.readonly`. Calendar events are read only, never created, modified, or deleted.
- Calendar data and encrypted OAuth tokens are stored only in the MySQL database on the user's own computer.
- When the user runs an AI feature, relevant event details are sent to Anthropic through the user's own Claude account or API key. Otherwise, calendar data never leaves the user's computer.
- Google user data is not sold, not used for advertising, not shared with third parties, and not used to train AI models.
- DevMate AI's use of information received from Google APIs adheres to the [Google API Services User Data Policy](https://developers.google.com/terms/api-services-user-data-policy), including the Limited Use requirements.
- Users can disconnect in Settings (the token is revoked and deleted) or revoke access at https://myaccount.google.com/connections.
- Contact: https://github.com/jh10050730/DevMataAI/issues

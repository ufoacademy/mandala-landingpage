# 1점 문항 추적 + 영역별 점수 수집 — 설계 문서

날짜: 2026-07-15

## 배경

현재 구글시트 기록은 "프리미엄 리포트를 신청한 사람"에게만 일어난다 (이름/연락처/이메일 + 취약영역 top3). 진단만 하고 프리미엄을 신청하지 않은 사람의 데이터는 어디에도 남지 않는다.

사용자는 두 가지를 추가로 원한다:
1. **진단을 완료하는 모든 사람**(프리미엄 신청 여부 무관)의 8영역 점수와, 1점(최저점)으로 응답한 문항을 구글시트에 익명으로 기록.
2. 1점 문항 전체 목록을 AI 프롬프트에 반영해서, 영양설계·페어섹션 실천 미션이 실제로 그 사람이 약하다고 응답한 정확한 문항을 짚어주도록 리포트 내용을 더 날카롭게 만든다.

기존 "프리미엄 리포트 신청자" 데이터 수집(개인정보 + 취약영역 top3)은 그대로 유지한다.

## 데이터 흐름

### 1. 진단 완료 시 (모든 사용자, `index.html`의 `buildResults()`)

- `diagnosisId` 생성 (예: `Date.now().toString(36) + random 6자`), 페이지 전역 변수(`currentDiagnosisId`)에 저장 — 이후 프리미엄 신청 시 재사용해서 두 시트를 연결한다.
- `collectLowScoreItemsForReport()`(신규): `answers` 객체를 순회해 값이 정확히 1인 문항만 `{code:'{areaId}-{dimLetter}-{qNum}', question}` 형태로 수집. 8영역×4세부항목×2문항 = 최대 64개 코드(`1-A-1` ~ `8-D-2`).
- `collectAreaScoresForReport()`(기존)로 8영역 점수 재사용.
- `fetch('/api/log-diagnosis', {id: currentDiagnosisId, areaScores, lowScoreItems, totalScore})` — best-effort, 실패해도 결과 화면 표시에 영향 없음(await 하지 않고 fire-and-forget, `.catch`만 처리).

신규 `api/log-diagnosis.js`: 요청 바디 검증(areaScores 8개인지) 후 `SHEETS_WEBHOOK_URL`로 `{type:'diagnosis', id, timestamp, totalScore, areaScores, lowScoreItems}` POST. 이름/연락처 등 개인정보 검증 없음(익명 이벤트).

### 2. 프리미엄 리포트 신청 시 (기존 흐름, `submitPremiumLead()`)

- `currentDiagnosisId`를 그대로 재사용해서 `/api/generate-report` 요청 바디에 `id` 필드 추가.
- `api/generate-report.js`는 기존처럼 이름/연락처/이메일/취약영역 top3를 `{type:'premium_lead', id, ...기존 필드}`로 Sheets 웹훅에 전송(기존 필드는 변경 없음, `type`과 `id`만 추가).
- **동일한 `lowScoreItems`를 `buildPrompt`에도 전달**해서 AI가 참고하도록 한다(시트 기록과 별개로, 리포트 생성용).

### 3. 구글시트 (Apps Script `doPost` 분기)

- `type === 'diagnosis'` → "1점문항추적" 탭에 기록. 이 탭이 비어있으면(헤더 없음) 첫 실행 시 헤더 행을 자동 생성: `ID, 날짜, 총점, 식점수, 동점수, 휴점수, 심점수, 환점수, 연점수, 지점수, 락점수` + 64개 코드(`1-A-1`~`8-D-2`, area 1~8 × dim A~D × q 1~2 중첩 루프로 생성, 텍스트 하드코딩 없음). 데이터 행은 `lowScoreItems`에 있는 코드만 해당 열에 문항 텍스트를 채우고 나머지는 빈칸.
- `type === 'premium_lead'`(또는 `type` 없음, 하위호환) → 기존 "리드" 탭에 기존 필드 그대로 기록 + 맨 끝에 `id` 컬럼 추가.

### 4. 리포트 프롬프트 강화 (`lib/buildPrompt.js`)

- `buildPrompt({name, areaScores, checkupSummary, totalScore, lowScoreItems})` — `lowScoreItems`(선택, 없으면 빈 배열)를 받아 "[1점 응답 문항 목록]" 섹션을 사용자 메시지에 area별로 그룹핑해서 추가.
- SYSTEM_PROMPT에 규칙 추가: nutritionPlan과 pairedSections의 highlightContent는 반드시 이 목록에서 해당 페어의 영역에 속한 문항이 있으면 그 문항을 직접 인용/반영해서 작성. 목록에 없는 영역은 기존 `weakestDim` 방식으로 서술(하위호환).

## 사용자가 준비할 것

- 구글시트에 빈 탭 "1점문항추적" 생성 (헤더는 Apps Script가 자동 생성).
- 기존 인적사항(리드) 탭 마지막 칸에 "ID" 헤더 1개 수동 추가.
- Apps Script 재배포.

## 범위 밖

- 스팸/rate-limit 방지는 이번 범위에서 다루지 않음 (기존 프로젝트 컨벤션과 동일).
- 익명 진단 이벤트(`/api/log-diagnosis`)는 이름/연락처를 받지 않으므로 리드 검증(`validateLead`) 대상이 아님.

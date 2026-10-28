# 운영 잠금 · 복구 · 이전 절차

| 항목 | 값 |
|---|---|
| 잠금 시행일 | 2026-08-23 |
| 사유 | 건강만다라를 신규 통합 서비스로 개편. 개편 완료 전 데이터 유입 차단 |
| **기준 태그** | **`pre-lock-20260823`** |
| **기준 커밋** | `d8bfbe24ee8b15f2cd75f9e2cb57015e7c1e4134` |
| 신규 개발 저장소 | `ufoacademy/mandala.homepage` (비공개) |

> **이 저장소는 참조 원본이다.** 신규 구현은 전부 `mandala.homepage` 에서 진행한다.
> 여기서는 **잠금 유지·해제·이전**만 다룬다.

---

## 1. 잠금 전 상태 (복구 기준점)

`git checkout pre-lock-20260823` 으로 언제든 되돌릴 수 있다.

| 파일 | sha256 (앞 16자) |
|---|---|
| `index.html` | `200bfc62f36fbdb4` |
| `report.html` | `a5ceaa2c9cb05ebc` |
| `api/log-diagnosis.js` | `2c6a4e170bf8448e` |
| `api/generate-report.js` | `e754b47706ea9660` |

배포본 `index.html` 도 `200bfc62f36fbdb4` 로 저장소와 일치함을 2026-08-23 확인했다.

---

## 2. 잠금 내용

| # | 변경 | 파일 | 조건 |
|---|---|---|---|
| 1 | 프로토타입 원본을 `archive/` 로 **이동 보존** (내용 무변경) | `archive/index.prototype.html`<br>`archive/report.prototype.html` | 1·9 |
| 2 | 공개 화면을 **준비 중 안내**로 교체 | `index.html` (신규) | 3 |
| 3 | API를 **요청 본문 읽기 전 503 차단** | `api/log-diagnosis.js`<br>`api/generate-report.js` | 4·5·7 |
| 4 | `no-store` · `noindex` · `nofollow` 헤더 | `vercel.json` (신규) | 6 |
| 5 | 크롤러 차단 | `robots.txt` (신규) | 6 |
| 6 | `archive/` 등을 **배포에서 제외** | `.vercelignore` (신규) | 7 |

### 왜 `.vercelignore` 가 필요한가

`archive/` 를 배포하면 `/archive/index.prototype.html` 로 **입력 화면이 다시 공개된다.**
저장소에는 남기되 배포본에서는 빠지도록 제외한다. 원본은 git 과 태그에 그대로 있다.

### 왜 API 차단이 화면 차단보다 중요한가

화면만 막으면 URL·개발자도구로 API를 직접 호출할 수 있다.
두 함수 모두 **`const body = req.body` 이전**에 `SERVICE_LOCKED` 검사로 반환하므로,
요청 본문이 애플리케이션 처리 경로에 들어가지 않는다.
따라서 **Google Sheets 전송과 Anthropic 호출에 도달할 수 없다.**

---

## 3. 잠금 해제 절차

> ⚠️ 해제는 [출시 전 필수 조치 8항목](https://github.com/ufoacademy/mandala.homepage) 이 완료된 뒤에만 한다.
> 그 전에 해제하면 잠금 이전의 문제(P-1a~d)가 그대로 살아난다.

### 3-1. 전체 원복 (프로토타입을 그대로 되살릴 때)

```bash
git checkout pre-lock-20260823 -- index.html report.html api/ 
git rm --cached vercel.json robots.txt .vercelignore
git mv archive/index.prototype.html index.html   # 필요 시
```

또는 잠금 커밋 자체를 되돌린다.

```bash
git revert <잠금 커밋 해시>
```

### 3-2. 부분 해제 (API만 다시 열 때)

각 파일 상단의 상수 하나만 바꾼다.

```js
const SERVICE_LOCKED = true;   →   false
```

기존 로직은 그 아래에 **그대로 보존**되어 있으므로 다른 수정이 필요 없다.

### 3-3. 해제 전 반드시 확인

| # | 확인 |
|---|---|
| 1 | 처리방침이 실제로 게시되고 링크가 동작하는가 |
| 2 | 리포트 미신청자의 이름·이메일·연락처를 수집하지 않는가 |
| 3 | Anthropic 전송 페이로드에 직접식별정보가 없는가 |
| 4 | 보유기간·자동파기가 구현되어 있는가 |
| 5 | 개인정보·보안 테스트를 통과했는가 |

---

## 4. 신규 서비스로의 이전 절차

신규 통합 시스템(`mandala.healtheum.com`) 출시 후, 기존 주소를 신규 서비스로 연결한다.

### 4-1. 선택지

| 안 | 방법 | 비고 |
|---|---|---|
| **A. 리다이렉트** (권장) | `vercel.json` 에 `redirects` 추가 → 신규 주소로 308 | 기존 링크·북마크가 살아난다 |
| B. 안내 페이지 유지 | `index.html` 에 신규 주소 링크만 노출 | 이용자가 직접 이동 |
| C. 도메인 이전 | 기존 Vercel 프로젝트에 신규 도메인 연결 | 신규 저장소와 배포가 갈리므로 **비권장** |

### 4-2. A안 적용 예시

```json
{
  "redirects": [
    { "source": "/", "destination": "https://mandala.healtheum.com/", "permanent": true }
  ]
}
```

### 4-3. 이전 시 함께 할 일

| # | 작업 |
|---|---|
| 1 | `homepage/business/brand.md` 의 앱 URL을 신규 주소로 갱신 |
| 2 | 카카오 채널·SNS 링크 갱신 |
| 3 | `robots.txt` 유지 여부 결정 (이 저장소는 계속 색인 제외 권장) |
| 4 | 신규 서비스 안정화 확인 후 리다이렉트 적용 |
| 5 | Apps Script 웹앱 배포 해제 · `SHEETS_WEBHOOK_URL` 환경변수 제거 |

---

## 5. 잠금 중 유지 사항

| # | 사항 |
|---|---|
| 1 | 기존 소스·문항·점수계산·리포트 로직을 **삭제하지 않는다** |
| 2 | 기존 앱 주소를 **삭제하지 않는다** |
| 3 | 이 저장소에서 **신규 기능을 개발하지 않는다** — 참조 원본으로만 사용 |
| 4 | 코드를 가져갈 때는 **출처와 변경 내용을 기록**한다 |
| 5 | 세 저장소의 Git 이력을 **임의로 합치지 않는다** |

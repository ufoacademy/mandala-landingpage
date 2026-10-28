# 건강만다라 진단 플로우 재구성 (동의 선이동 & 프리미엄 다이렉트) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `index.html`의 화면 흐름을 "동의는 진단이 끝난 뒤 선택적으로" 방식에서 "동의·기본정보를 진단 시작 전에 필수로 받고, 진단이 끝나면 무료 1차 결과 없이 바로 프리미엄 AI 리포트로 자동 진행" 방식으로 재구성한다.

**Architecture:** SCREEN 1(인트로)과 SCREEN 2(퀴즈) 사이에 신규 SCREEN 1.5(`#screen-consent`)를 추가해 기존 `premiumModal`의 입력 필드·동의 체크박스를 그대로 옮긴다. 퀴즈+검진수치 입력이 끝나면 SCREEN 4(결과화면)를 레이더차트+CTA 1개로 간소화하고, 화면 전환 직후 자동으로 (이미 SCREEN 1.5에서 모아둔 정보로) `submitPremiumLead()`를 호출해 `report.html`로 넘어간다. 화면 전환 메커니즘(`.screen`/`.active` 클래스 토글)과 백엔드(`api/generate-report.js` 등)는 그대로 유지한다.

**Tech Stack:** Vanilla JS(변경 없음), 단일 파일 `index.html`(HTML+CSS+JS). 이 파일은 자동 테스트 하네스가 없으므로 각 태스크는 `npx serve .` + 브라우저 수동 검증으로 확인한다.

**Spec:** `docs/superpowers/specs/2026-08-14-diagnosis-flow-restructure-design.md`

## Global Constraints

- 백엔드(`api/generate-report.js`, `lib/validateLead.js`, `google-apps-script/lead-webhook.gs`)는 이번 작업에서 수정하지 않는다.
- 현재 워킹트리에 이미 존재하는(미커밋) 3단계 동의 필드(`consentPersonal`/`consentHealth`/`consentMarketing`)와 그 id(`premiumConsentPersonal` 등)를 그대로 재사용한다 — 새로 만들지 않는다.
- CTA 링크는 건강이음 공식 채널(`https://pf.kakao.com/_HlPnn`) 1개만 남긴다 — 인트로 화면과 결과 화면 모두.
- 화면 전환은 기존 `.screen`/`.active` 클래스 토글 패턴을 그대로 따른다 — 새로운 라우팅 방식을 도입하지 않는다.
- `buildCheckupResult`/`buildIntegratedSection`/`renderAreaInsights`/`buildEvidence`/`getWeakTip`/`getActionItems`/`getRiskLevel`/`shareKakao`/`copyLink` 등 이번 변경으로 더 이상 호출되지 않게 되는 기존 헬퍼 함수의 **정의 자체는 삭제하지 않는다** (범위 밖 — 사용처가 남아있는지 전수 확인하는 위험 대비 이득이 적다).
- `index_backup_habitonly.html`은 이번 스코프에 포함하지 않는다.

---

### Task 1: 인트로 화면(SCREEN 1) CTA 3개 → 1개로 축소

**Files:**
- Modify: `index.html` (약 682–707번째 줄, `quick-cta-cards`)

**Interfaces:**
- Consumes: 없음.
- Produces: 없음 (마크업 변경만).

- [ ] **Step 1: `quick-cta-cards`를 1개 카드로 교체**

`index.html`에서 아래 블록을 찾는다:

```html
    <div class="quick-cta-cards">
      <a href="https://open.kakao.com/me/healthteather" target="_blank" rel="noopener noreferrer" class="quick-cta-item qc-1">
        <div class="qc-icon">💬</div>
        <div class="qc-text">
          <span>Personalized</span>
          <strong>1:1 건강기능식품·프로그램 상담</strong>
        </div>
        <div class="qc-arrow">›</div>
      </a>
      <a href="https://pf.kakao.com/_HlPnn" target="_blank" rel="noopener noreferrer" class="quick-cta-item qc-2">
        <div class="qc-icon">📖</div>
        <div class="qc-text">
          <span>Self-directed</span>
          <strong>건강칼럼 구독 신청</strong>
        </div>
        <div class="qc-arrow">›</div>
      </a>
      <a href="https://open.kakao.com/o/pYYxjLpi" target="_blank" rel="noopener noreferrer" class="quick-cta-item qc-3">
        <div class="qc-icon">🌿</div>
        <div class="qc-text">
          <span>Community</span>
          <strong>우주건강실천인증방</strong>
        </div>
        <div class="qc-arrow">›</div>
      </a>
    </div>
```

아래로 교체:

```html
    <div class="quick-cta-cards">
      <a href="https://pf.kakao.com/_HlPnn" target="_blank" rel="noopener noreferrer" class="quick-cta-item qc-2">
        <div class="qc-icon">📖</div>
        <div class="qc-text">
          <span>Self-directed</span>
          <strong>건강칼럼 구독 신청</strong>
        </div>
        <div class="qc-arrow">›</div>
      </a>
    </div>
```

- [ ] **Step 2: 수동 검증**

Run: `npx serve .` 후 브라우저에서 `index.html` 접속.
Expected: 인트로 화면 하단 "진단 없이 바로 이동하기" 아래에 "건강칼럼 구독 신청" 카드 1개만 보이고, 클릭 시 `pf.kakao.com/_HlPnn`으로 이동한다.

- [ ] **Step 3: 커밋**

```bash
git add index.html
git commit -m "feat: reduce intro screen CTA to single official channel link"
```

---

### Task 2: 검진수치 입력 화면(SCREEN 3) 안내문구 보강

**Files:**
- Modify: `index.html` (약 748–750번째 줄, `checkup-hero`)

**Interfaces:**
- Consumes: 없음.
- Produces: 없음 (텍스트 추가만).

- [ ] **Step 1: 안내문구 한 줄 추가**

`index.html`에서 아래 블록을 찾는다:

```html
      <p>결과지의 수치를 입력해 주세요<br>
      없는 항목은 비워두면 됩니다 — 입력된 데이터만으로 분석합니다<br>
      <small style="opacity:.75">건강검진은 '질병 진단서'가 아닌 '생리학적 힌트'입니다</small></p>
```

아래로 교체:

```html
      <p>결과지의 수치를 입력해 주세요<br>
      없는 항목은 비워두면 됩니다 — 입력된 데이터만으로 분석합니다<br>
      <strong style="color:var(--green-dark);">입력하신 데이터가 많을수록 더 정확한 프리미엄 리포트가 생성됩니다.</strong><br>
      <small style="opacity:.75">건강검진은 '질병 진단서'가 아닌 '생리학적 힌트'입니다</small></p>
```

- [ ] **Step 2: 수동 검증**

Run: `npx serve .` 후 브라우저에서 검진수치 입력 화면으로 이동.
Expected: 안내문 3번째 줄에 "입력하신 데이터가 많을수록 더 정확한 프리미엄 리포트가 생성됩니다." 문구가 초록색 강조로 보인다.

- [ ] **Step 3: 커밋**

```bash
git add index.html
git commit -m "feat: emphasize that more checkup data yields a more accurate premium report"
```

---

### Task 3: 동의+기본정보 화면(SCREEN 1.5) 신설 및 자동 리포트 생성 트리거 연결

**Files:**
- Modify: `index.html` (모달 삭제, 신규 화면 삽입, `startApp`/`submitPremiumLead`/`showResults` 등 JS 수정)

**Interfaces:**
- Consumes: 기존 `lib/validateLead.js`와 동일한 필드명(`consentPersonal`/`consentHealth`/`consentMarketing`)을 쓰는 기존 `api/generate-report.js` 계약 — 변경 없음.
- Produces: 신규 전역 함수 `submitConsentAndStart()`. 화면 흐름상 `startApp()`의 동작이 바뀜(퀴즈로 바로 가지 않고 `#screen-consent`를 보여줌). `submitPremiumLead()`는 버튼 클릭이 아니라 `showResults()`의 `setTimeout`에서 자동 호출됨.

- [ ] **Step 1: 기존 `premiumModal` 삭제**

`index.html`에서 아래 블록(주석 포함)을 찾는다:

```html
<!-- 프리미엄 리포트 리드 입력 모달 -->
<div class="modal-overlay" id="premiumModal">
  <div class="modal-box">
    <h3>🎁 프리미엄 통합분석 리포트</h3>
    <p style="font-size:13px;color:var(--text-mid);margin-bottom:14px;line-height:1.6;">이름과 연락처를 남겨주시면 AI가 검진수치와 습관 점수를 통합 분석한 맞춤 프리미엄 리포트(진단가 10만원 상당)를 무료로 보여드려요.</p>
    <div class="name-input-box" style="box-shadow:none;padding:0;margin-bottom:10px;">
      <label for="premiumName">이름</label>
      <input type="text" id="premiumName" placeholder="이름을 입력하세요" maxlength="20">
    </div>
    <div class="name-input-box" style="box-shadow:none;padding:0;margin-bottom:10px;">
      <label for="premiumAge">나이</label>
      <input type="number" id="premiumAge" placeholder="나이를 입력하세요" min="1" max="120">
    </div>
    <div class="name-input-box" style="box-shadow:none;padding:0;margin-bottom:10px;">
      <label for="premiumGender">성별</label>
      <select id="premiumGender" style="width:100%;cursor:pointer;">
        <option value="">선택하세요</option>
        <option value="m">남성</option>
        <option value="f">여성</option>
      </select>
    </div>
    <div class="name-input-box" style="box-shadow:none;padding:0;margin-bottom:10px;">
      <label for="premiumEmail">이메일</label>
      <input type="email" id="premiumEmail" placeholder="example@email.com" maxlength="60">
    </div>
    <div class="name-input-box" style="box-shadow:none;padding:0;margin-bottom:10px;">
      <label for="premiumContact">연락처 (휴대폰 번호)</label>
      <input type="text" id="premiumContact" placeholder="010-1234-5678" maxlength="20">
    </div>
    <div style="background:#F5F8F6;border-radius:10px;padding:10px 12px;margin-bottom:10px;">
      <label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--text-mid);line-height:1.6;cursor:pointer;">
        <input type="checkbox" id="premiumConsentPersonal" style="margin-top:2px;flex-shrink:0;">
        <span>[필수] 개인정보(이름·나이·성별·연락처·이메일) 수집·이용에 동의합니다. <em style="font-style:normal;color:var(--text-mid);">(수집목적: 리포트 생성·발송 / 보유기간: 수집일로부터 1년 또는 파기 요청 시 즉시)</em></span>
      </label>
      <label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--text-mid);line-height:1.6;cursor:pointer;margin-top:8px;">
        <input type="checkbox" id="premiumConsentHealth" style="margin-top:2px;flex-shrink:0;">
        <span>[필수] 건강진단 응답 및 검진수치(건강에 관한 정보) 수집·이용에 동의합니다. <em style="font-style:normal;color:var(--text-mid);">(수집목적: AI 맞춤 분석 리포트 생성 / 보유기간: 수집일로부터 1년 또는 파기 요청 시 즉시)</em></span>
      </label>
      <label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--text-mid);line-height:1.6;cursor:pointer;margin-top:8px;">
        <input type="checkbox" id="premiumConsentMarketing" style="margin-top:2px;flex-shrink:0;">
        <span>[선택] 건강정보 안내 등 광고성 정보 수신에 동의합니다. 동의하지 않아도 리포트는 받을 수 있습니다.</span>
      </label>
      <a href="privacy-policy.html" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;font-size:11px;color:var(--green-dark);text-decoration:underline;">개인정보처리방침 전문 보기</a>
    </div>
    <input type="text" id="premiumHoneypot" name="website" autocomplete="off" tabindex="-1" style="position:absolute;left:-9999px;">
    <div id="premiumError" style="display:none;color:#DC2626;font-size:12px;margin-bottom:8px;"></div>
    <button class="close-btn" id="premiumSubmitBtn" onclick="submitPremiumLead()">리포트 받기</button>
    <button class="close-btn" style="background:#fff;color:var(--text-mid);border:2px solid #E5EDE8;margin-top:8px;" onclick="closePremiumModal()">닫기</button>
  </div>
</div>
```

이 블록 전체를 삭제한다 (앞의 `<!-- 프리미엄 리포트 리드 입력 모달 -->` 주석도 함께 삭제).

- [ ] **Step 2: SCREEN 1.5(`#screen-consent`) 신설**

`index.html`에서 SCREEN 1(인트로)의 끝과 SCREEN 2(퀴즈) 시작 사이, 아래 블록을 찾는다:

```html
      기업·기관 사용 문의: ufoacademy@naver.com
    </div>
  </div>
</div>

<!-- ════ SCREEN 2: QUIZ ════ -->
```

아래로 교체 (기존 두 줄은 그대로 두고 사이에 신규 화면을 삽입):

```html
      기업·기관 사용 문의: ufoacademy@naver.com
    </div>
  </div>
</div>

<!-- ════ SCREEN 1.5: CONSENT + BASIC INFO ════ -->
<div class="screen" id="screen-consent">
  <div class="container">
    <h2 style="font-size:18px;font-weight:700;color:var(--green-dark);margin-bottom:8px;">🎁 프리미엄 통합분석 리포트 신청</h2>
    <p style="font-size:13px;color:var(--text-mid);margin-bottom:14px;line-height:1.6;">이름과 연락처를 남겨주시면 AI가 검진수치와 습관 점수를 통합 분석한 맞춤 프리미엄 리포트(진단가 10만원 상당)를 무료로 보여드려요. 진단이 끝나면 별도 입력 없이 바로 리포트가 생성됩니다.</p>
    <div class="name-input-box" style="box-shadow:none;padding:0;margin-bottom:10px;">
      <label for="premiumName">이름</label>
      <input type="text" id="premiumName" placeholder="이름을 입력하세요" maxlength="20">
    </div>
    <div class="name-input-box" style="box-shadow:none;padding:0;margin-bottom:10px;">
      <label for="premiumAge">나이</label>
      <input type="number" id="premiumAge" placeholder="나이를 입력하세요" min="1" max="120">
    </div>
    <div class="name-input-box" style="box-shadow:none;padding:0;margin-bottom:10px;">
      <label for="premiumGender">성별</label>
      <select id="premiumGender" style="width:100%;cursor:pointer;">
        <option value="">선택하세요</option>
        <option value="m">남성</option>
        <option value="f">여성</option>
      </select>
    </div>
    <div class="name-input-box" style="box-shadow:none;padding:0;margin-bottom:10px;">
      <label for="premiumEmail">이메일</label>
      <input type="email" id="premiumEmail" placeholder="example@email.com" maxlength="60">
    </div>
    <div class="name-input-box" style="box-shadow:none;padding:0;margin-bottom:10px;">
      <label for="premiumContact">연락처 (휴대폰 번호)</label>
      <input type="text" id="premiumContact" placeholder="010-1234-5678" maxlength="20">
    </div>
    <div style="background:#F5F8F6;border-radius:10px;padding:10px 12px;margin-bottom:10px;">
      <label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--text-mid);line-height:1.6;cursor:pointer;">
        <input type="checkbox" id="premiumConsentPersonal" style="margin-top:2px;flex-shrink:0;">
        <span>[필수] 개인정보(이름·나이·성별·연락처·이메일) 수집·이용에 동의합니다. <em style="font-style:normal;color:var(--text-mid);">(수집목적: 리포트 생성·발송 / 보유기간: 수집일로부터 1년 또는 파기 요청 시 즉시)</em></span>
      </label>
      <label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--text-mid);line-height:1.6;cursor:pointer;margin-top:8px;">
        <input type="checkbox" id="premiumConsentHealth" style="margin-top:2px;flex-shrink:0;">
        <span>[필수] 건강진단 응답 및 검진수치(건강에 관한 정보) 수집·이용에 동의합니다. <em style="font-style:normal;color:var(--text-mid);">(수집목적: AI 맞춤 분석 리포트 생성 / 보유기간: 수집일로부터 1년 또는 파기 요청 시 즉시)</em></span>
      </label>
      <label style="display:flex;align-items:flex-start;gap:8px;font-size:12px;color:var(--text-mid);line-height:1.6;cursor:pointer;margin-top:8px;">
        <input type="checkbox" id="premiumConsentMarketing" style="margin-top:2px;flex-shrink:0;">
        <span>[선택] 건강정보 안내 등 광고성 정보 수신에 동의합니다. 동의하지 않아도 리포트는 받을 수 있습니다.</span>
      </label>
      <a href="privacy-policy.html" target="_blank" rel="noopener" style="display:inline-block;margin-top:8px;font-size:11px;color:var(--green-dark);text-decoration:underline;">개인정보처리방침 전문 보기</a>
    </div>
    <input type="text" id="premiumHoneypot" name="website" autocomplete="off" tabindex="-1" style="position:absolute;left:-9999px;">
    <div id="consentError" style="display:none;color:#DC2626;font-size:12px;margin-bottom:8px;"></div>
    <button class="btn-start" onclick="submitConsentAndStart()">🌱 동의하고 진단 시작하기</button>
    <div style="margin-top:14px;padding:12px 14px;background:var(--green-pale);border-radius:12px;font-size:11px;line-height:1.7;color:var(--text-mid);">
      📋 <strong>진단 전 확인하면 좋아요</strong> — 최근 건강검진 결과지에서 아래 항목을 미리 준비해두시면 더 정확한 리포트를 받을 수 있어요 (없어도 진단은 가능합니다).<br>
      BMI · 허리둘레 · 혈압 · 공복혈당 · 당화혈색소(HbA1c) · 중성지방 · 비타민D
    </div>
  </div>
</div>

<!-- ════ SCREEN 2: QUIZ ════ -->
```

- [ ] **Step 3: 결과 화면의 기존 프리미엄 CTA 버튼을 제거하고 자리에 에러 표시 영역 배치**

`index.html`에서 SCREEN 4(`#screen-result`) 안의 아래 블록을 찾는다:

```html
    <div style="margin-bottom:18px;">
      <button class="btn-analyze" onclick="openPremiumModal()" style="background:linear-gradient(135deg,#7C3AED,#5B21B6);">
        🎁 프리미엄 통합분석 리포트 무료로 받기
      </button>
      <p class="time-note">AI가 검진수치와 습관 점수를 통합 분석해 맞춤 리포트를 만들어드립니다</p>
    </div>
```

아래로 교체:

```html
    <div style="margin-bottom:18px;">
      <p class="time-note">AI가 검진수치와 습관 점수를 통합 분석해 맞춤 프리미엄 리포트를 자동으로 만들어드립니다</p>
      <div id="premiumError" style="display:none;color:#DC2626;font-size:12px;text-align:center;margin-top:8px;"></div>
    </div>
```

- [ ] **Step 4: `startApp()`을 SCREEN 1.5로 보내도록 수정하고 `submitConsentAndStart()` 신설**

`index.html`에서 아래 함수를 찾는다:

```js
function startApp(){
  selectedMode = document.querySelector('input[name="mode"]:checked')?.value || 'both';
  if(selectedMode === 'checkup'){
    showScreen('screen-checkup');
  } else {
    currentArea = 0;
    startQuiz();
  }
}
```

아래로 교체:

```js
function startApp(){
  selectedMode = document.querySelector('input[name="mode"]:checked')?.value || 'both';
  showScreen('screen-consent');
}

function submitConsentAndStart(){
  const consentPersonal=document.getElementById('premiumConsentPersonal').checked;
  const consentHealth=document.getElementById('premiumConsentHealth').checked;
  const errEl=document.getElementById('consentError');
  if(!consentPersonal || !consentHealth){
    errEl.textContent='진단을 시작하시려면 [필수] 항목 2가지에 모두 동의해주세요.';
    errEl.style.display='block';
    return;
  }
  errEl.style.display='none';
  const genderVal=document.getElementById('premiumGender').value;
  const ciGenderEl=document.getElementById('ci-gender');
  if(genderVal && ciGenderEl){
    ciGenderEl.value=genderVal;
  }
  if(selectedMode === 'checkup'){
    showScreen('screen-checkup');
  } else {
    currentArea = 0;
    startQuiz();
  }
}
```

(`ci-gender` 프리필: SCREEN 3의 체성분 섹션에도 별도 성별 선택이 있는데, 방금 SCREEN 1.5에서 입력받은 성별을 그대로 넘겨 재입력을 피한다.)

- [ ] **Step 5: `openPremiumModal()`/`closePremiumModal()` 삭제**

`index.html`에서 아래 함수를 찾아 통째로 삭제한다:

```js
function openPremiumModal(){
  document.getElementById('premiumError').style.display='none';
  document.getElementById('premiumModal').classList.add('show');
}
function closePremiumModal(){
  document.getElementById('premiumModal').classList.remove('show');
}
```

- [ ] **Step 6: 중복 정의된 `showResults()` 중 첫 번째(죽은 코드) 제거**

`index.html`에는 `showResults()`가 두 번 동일하게 정의되어 있다 (JS 함수 재선언 규칙상 두 번째 정의가 실제로 동작하며 첫 번째는 완전히 무시되는 죽은 코드다). 아래 블록을 찾는다:

```js
function analyzeCheckup(){
  collectCheckupData();
  showResults();
}

function showResults(){
  document.getElementById('loadingOverlay').classList.add('show');
  setTimeout(()=>{
    document.getElementById('loadingOverlay').classList.remove('show');
    buildResults();
    document.getElementById('progress-bar').style.width='100%';
    showScreen('screen-result');
  },1600);
}
```

아래로 교체 (죽은 첫 번째 `showResults()` 정의만 제거, `analyzeCheckup()`은 유지):

```js
function analyzeCheckup(){
  collectCheckupData();
  showResults();
}
```

- [ ] **Step 7: 남은(실제로 동작하는) `showResults()`에 자동 리포트 생성 트리거 추가**

Step 6 이후 파일에 하나만 남은 아래 함수를 찾는다:

```js
function showResults(){
  document.getElementById('loadingOverlay').classList.add('show');
  setTimeout(()=>{
    document.getElementById('loadingOverlay').classList.remove('show');
    buildResults();
    document.getElementById('progress-bar').style.width='100%';
    showScreen('screen-result');
  },1600);
}
```

아래로 교체:

```js
function showResults(){
  document.getElementById('loadingOverlay').classList.add('show');
  setTimeout(()=>{
    document.getElementById('loadingOverlay').classList.remove('show');
    buildResults();
    document.getElementById('progress-bar').style.width='100%';
    showScreen('screen-result');
    setTimeout(submitPremiumLead,1500);
  },1600);
}
```

- [ ] **Step 8: `submitPremiumLead()`에서 더 이상 존재하지 않는 버튼 참조 제거**

`index.html`에서 `submitPremiumLead()` 함수 상단의 아래 블록을 찾는다:

```js
  const honeypot=document.getElementById('premiumHoneypot').value;
  const errEl=document.getElementById('premiumError');
  const btn=document.getElementById('premiumSubmitBtn');

  errEl.style.display='none';

  if(!consentPersonal || !consentHealth){
    errEl.textContent='리포트를 받으시려면 [필수] 항목 2가지에 모두 동의해주세요.';
    errEl.style.display='block';
    return;
  }

  btn.disabled=true;
  btn.textContent='리포트 생성 중...';

  const areaScores=collectAreaScoresForReport();
```

아래로 교체:

```js
  const honeypot=document.getElementById('premiumHoneypot').value;
  const errEl=document.getElementById('premiumError');

  errEl.style.display='none';

  if(!consentPersonal || !consentHealth){
    errEl.textContent='리포트를 받으시려면 [필수] 항목 2가지에 모두 동의해주세요.';
    errEl.style.display='block';
    return;
  }

  const areaScores=collectAreaScoresForReport();
```

같은 함수의 `finally` 블록에서 아래를 찾는다:

```js
  }finally{
    document.removeEventListener('visibilitychange',handleVisibilityChange);
    if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}
    clearInterval(msgInterval);
    loadingOverlay.classList.remove('show');
    loadingTitle.textContent='결과를 분석하고 있습니다...';
    loadingSub.textContent='최약점 영역을 찾는 중';
    btn.disabled=false;
    btn.textContent='리포트 받기';
  }
}
```

아래로 교체:

```js
  }finally{
    document.removeEventListener('visibilitychange',handleVisibilityChange);
    if(wakeLock){wakeLock.release().catch(()=>{});wakeLock=null;}
    clearInterval(msgInterval);
    loadingOverlay.classList.remove('show');
    loadingTitle.textContent='결과를 분석하고 있습니다...';
    loadingSub.textContent='최약점 영역을 찾는 중';
  }
}
```

- [ ] **Step 9: 수동 검증**

Run: `npx serve .` 후 브라우저에서 처음부터 끝까지 진행.

1. 인트로 화면에서 "🌱 진단 시작하기" 클릭 → SCREEN 1.5(동의+기본정보)가 보이는지 확인.
2. 아무 것도 체크하지 않고 "🌱 동의하고 진단 시작하기" 클릭 → "진단을 시작하시려면 [필수] 항목 2가지에 모두 동의해주세요." 에러가 뜨는지 확인.
3. 이름/나이/성별/이메일/연락처를 채우고 필수 동의 2개 체크 후 다시 클릭 → 퀴즈 화면(또는 "건강검진 수치만 분석" 모드였다면 검진입력 화면)으로 넘어가는지 확인.
4. 브라우저 개발자도구 콘솔에서 `typeof openPremiumModal` 실행 → `"undefined"` 확인.
5. 검진수치 입력 화면에서 개발자도구 콘솔에 `document.getElementById('ci-gender').value` 입력 → 방금 SCREEN 1.5에서 고른 성별과 같은 값인지 확인.
6. 퀴즈+검진입력을 마치면 결과 화면이 뜬 뒤 약 3초 후 Network 탭에 `POST /api/generate-report` 요청이 자동으로 발생하는지 확인 (실제 API 키가 없어 500이 나도 무방 — 요청 자체가 자동으로 발생하는지, payload에 SCREEN 1.5에서 입력한 값들이 실려 있는지만 확인).

- [ ] **Step 10: 커밋**

```bash
git add index.html
git commit -m "feat: move consent and basic-info collection before quiz, auto-trigger premium report generation"
```

---

### Task 4: 결과 화면(SCREEN 4) 간소화 — 레이더차트+CTA 1개만 남기기

**Files:**
- Modify: `index.html` (SCREEN 4 마크업 축소, `buildResults()` 슬림화, `updateName()` 제거)

**Interfaces:**
- Consumes: Task 3에서 만든 자동 생성 트리거(`showResults()` → `submitPremiumLead()`) — 그대로 유지.
- Produces: `buildResults()`의 시그니처는 동일(인자 없음)하지만 내부에서 `areaScores`/`totalScore` 계산, `drawRadar()` 호출, `logDiagnosisToSheet()` 호출만 하도록 축소됨.

- [ ] **Step 1: `result-hero`(총점)와 `name-input-box`(userName) 삭제**

`index.html`의 `#screen-result` 안에서 아래 블록을 찾는다:

```html
    <div class="result-hero">
      <div class="total-score" id="result-total">0</div>
      <div class="total-label">/ 256점</div>
      <div class="result-grade" id="result-grade-text">분석 중...</div>
      <div class="result-msg" id="result-msg"></div>
    </div>

    <div class="name-input-box">
      <label for="userName">👤 이름을 입력하시면 맞춤 결과를 확인할 수 있어요</label>
      <input type="text" id="userName" placeholder="이름 입력 (선택사항)" maxlength="10" oninput="updateName()">
    </div>

    <div class="chart-box">
```

아래로 교체 (두 블록만 제거, `chart-box`는 유지):

```html
    <div class="chart-box">
```

- [ ] **Step 2: 검진결과·최약점랭킹·점수표·8영역해석·액션아이템·근거자료 블록 삭제**

`#screen-result` 안에서 `<canvas id="radarCanvas" ...></canvas>` 뒤에 이어지는 아래 블록을 찾는다:

```html
    <!-- 건강검진 결과 (입력 시만 표시) -->
    <div id="checkup-result-block" style="display:none;">
      <div class="checkup-result-section">
        <div class="crs-header">
          <h3>🔬 건강검진 회색지대 분석</h3>
          <p>수치가 질병과 정상 사이의 경계를 넘고 있는 신호를 찾았습니다</p>
        </div>
        <div class="crs-body" id="crs-body"></div>
      </div>
      <div class="integrated-section">
        <div class="is-header">
          <h3>🧭 검진 수치 × 생활습관 연결 설계</h3>
          <p>내 건강데이터와 취약 영역을 연결한 생활습관 설계 방향</p>
        </div>
        <div class="is-body" id="is-body"></div>
      </div>
    </div>

    <div class="weak-rank-section">
      <div class="weak-rank-header">
        <h3>🚨 집중 개선이 필요한 최약점 영역 TOP 3</h3>
        <p>점수가 낮을수록 만성질환 위험이 높은 영역입니다</p>
      </div>
      <div class="weak-rank-items" id="weak-rank-items"></div>
    </div>

    <div class="score-table">
      <div class="score-table-header">📊 8영역 × 4세부차원 점수 분석</div>
      <div id="score-rows"></div>
    </div>

    <div class="area-insight-section">
      <div class="area-insight-header">
        <h3>🧭 8영역 자동 결과 해석</h3>
        <p>각 영역 점수를 바탕으로 강점·주의·취약 상태를 자동 분류하고, 바로 실천할 행동 제안을 함께 보여줍니다.</p>
      </div>
      <div class="area-insight-grid" id="area-insight-grid"></div>
    </div>

    <div class="action-section">
      <h3>⚡ 최약점 영역 — 오늘부터 시작할 생활습관 1가지</h3>
      <div id="action-items"></div>
    </div>

    <div class="evidence-section">
      <div class="evidence-toggle" id="ev-toggle" onclick="toggleEvidence()">
        <h3>📖 질문 근거 자료 (국내외 가이드라인 & 연구)</h3>
        <span class="ev-arrow">▼</span>
      </div>
      <div class="evidence-content" id="ev-content"></div>
    </div>

    <div style="margin-bottom:18px;">
```

아래로 교체 (마지막 줄 `<div style="margin-bottom:18px;">`는 Task 3 Step 3에서 만든 `premiumError` 블록의 시작이므로 그대로 유지):

```html
    <div style="margin-bottom:18px;">
```

- [ ] **Step 3: 결과화면 CTA를 1개로 축소**

`#screen-result` 안에서 아래 블록을 찾는다:

```html
    <div class="cta-section">
      <div class="cta-title">
        <h3>이제 나의 무너진 한 칸을 채우러 가기</h3>
        <p id="cta-subtitle">가장 약한 영역부터, 지금 바로 시작해보세요</p>
      </div>
      <div class="cta-cards">
        <a href="https://open.kakao.com/me/healthteather" target="_blank" rel="noopener noreferrer" class="cta-card cta-1">
          <div class="cta-icon">💬</div>
          <div class="cta-text">
            <div class="cta-tag">Personalized</div>
            <h4>1:1 건강기능식품·프로그램 상담</h4>
            <p>건강기능식품 추천 · 다이어트 · 대사증후군 · 맞춤 건강 프로그램</p>
          </div>
          <div class="cta-arrow">›</div>
        </a>
        <a href="https://pf.kakao.com/_HlPnn" target="_blank" rel="noopener noreferrer" class="cta-card cta-2">
          <div class="cta-icon">📖</div>
          <div class="cta-text">
            <div class="cta-tag">Self-directed</div>
            <h4>건강칼럼 구독 신청</h4>
            <p>근거 기반 건강 지식으로 내 몸을 지키세요</p>
          </div>
          <div class="cta-arrow">›</div>
        </a>
        <a href="https://open.kakao.com/o/pYYxjLpi" target="_blank" rel="noopener noreferrer" class="cta-card cta-3">
          <div class="cta-icon">🌿</div>
          <div class="cta-text">
            <div class="cta-tag">Community</div>
            <h4>우주건강실천인증방</h4>
            <p>함께 실천하고 인증하는 건강 커뮤니티</p>
          </div>
          <div class="cta-arrow">›</div>
        </a>
      </div>
    </div>
```

아래로 교체:

```html
    <div class="cta-section">
      <div class="cta-title">
        <h3>진단 결과를 더 깊이 나누고 싶다면</h3>
        <p id="cta-subtitle">건강이음 채널에서 건강칼럼을 받아보세요</p>
      </div>
      <div class="cta-cards">
        <a href="https://pf.kakao.com/_HlPnn" target="_blank" rel="noopener noreferrer" class="cta-card cta-2">
          <div class="cta-icon">📖</div>
          <div class="cta-text">
            <div class="cta-tag">Self-directed</div>
            <h4>건강칼럼 구독 신청</h4>
            <p>근거 기반 건강 지식으로 내 몸을 지키세요</p>
          </div>
          <div class="cta-arrow">›</div>
        </a>
      </div>
    </div>
```

- [ ] **Step 4: 공유 버튼 삭제**

`#screen-result` 안에서 아래 블록을 찾아 삭제한다:

```html
    <div style="margin-top:8px;">
      <button class="share-btn" onclick="shareKakao()">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#3C1E1E"><path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.485 1.39 4.688 3.5 6.07L4.5 21l4.93-2.47A11.3 11.3 0 0012 18c5.523 0 10-3.477 10-7.5S17.523 3 12 3z"/></svg>
        카카오톡으로 공유하기
      </button>
      <button class="share-link-btn" onclick="copyLink()">
        🔗 링크 복사하기
      </button>
    </div>
```

- [ ] **Step 5: `buildResults()` 슬림화**

`index.html`에서 아래 함수 전체를 찾는다 (`function buildResults(){`부터 매칭되는 마지막 `}`까지):

```js
function buildResults(){
  // Scores
  const hasHabit = Object.keys(answers).length > 0;
  const hasCheckup = Object.keys(checkupData).length > 0;
  const areaScores=AREAS.map(a=>({...a,score:getAreaScore(a.id),pctVal:pct(getAreaScore(a.id),32)}));
  const totalScore=areaScores.reduce((s,a)=>s+a.score,0);

  // Total display
  if(hasHabit){
    document.getElementById('result-total').textContent=totalScore;
    const totalPct=pct(totalScore,256);
    let grade,msg;
    if(totalPct>=80){grade='🏆 우수';msg='건강 생활습관이 전반적으로 잘 유지되고 있습니다. 최약점을 보완하면 더 완성됩니다.';}
    else if(totalPct>=65){grade='✅ 양호';msg='대부분 영역이 양호합니다. 취약 영역의 생활습관 설계에 집중해보세요.';}
    else if(totalPct>=50){grade='⚠️ 주의';msg='절반 이상의 영역에서 생활습관 개선이 필요합니다. 낮은 영역부터 하나씩 시작하세요.';}
    else{grade='🚨 위험';msg='여러 영역에서 만성질환 관련 생활습관 위험 요인이 확인됩니다. 지금 시작하는 것이 중요합니다.';}
    document.getElementById('result-grade-text').textContent=`${grade} (${totalPct}%)`;
    document.getElementById('result-msg').textContent=msg;
  } else {
    document.getElementById('result-total').textContent='—';
    document.getElementById('result-grade-text').textContent='검진 분석 완료';
    document.getElementById('result-msg').textContent='건강검진 수치를 기반으로 생활습관 설계 방향을 안내합니다.';
  }

  // 건강검진 결과 블록
  const checkupBlock=document.getElementById('checkup-result-block');
  if(hasCheckup){
    checkupBlock.style.display='block';
    buildCheckupResult();
    buildIntegratedSection(areaScores);
  } else {
    checkupBlock.style.display='none';
  }

  if(!hasHabit){
    document.querySelector('.weak-rank-section').style.display='none';
    document.querySelector('.score-table').style.display='none';
    document.querySelector('.area-insight-section').style.display='none';
    document.querySelector('.action-section').style.display='none';
    drawRadar(areaScores);
    buildEvidence();
    return;
  }

  // Weak ranking (bottom 3)
  const sorted=[...areaScores].sort((a,b)=>a.pctVal-b.pctVal);
  const top3=sorted.slice(0,3);
  const rankEl=document.getElementById('weak-rank-items');
  rankEl.innerHTML='';
  const rankLabels=['1위 최약점','2위 취약','3위 관리필요'];
  const rankColors=['rank-1','rank-2','rank-3'];
  top3.forEach((a,i)=>{
    const risk=getRiskLevel(a.pctVal);
    const div=document.createElement('div');
    div.className=`rank-item ${rankColors[i]}`;
    div.innerHTML=`
      <div class="rank-badge">${i+1}</div>
      <div class="rank-content" style="flex:1">
        <h4>${a.icon} ${a.name} — ${a.sub} <span class="risk-badge ${risk.cls}">${risk.label} ${a.pctVal}%</span></h4>
        <div class="rank-score">점수: ${a.score}/32점 | 전체 ${a.pctVal}% 달성</div>
        <div class="rank-tip">💡 ${getWeakTip(a.id)}</div>
      </div>`;
    rankEl.appendChild(div);
  });

  // Score table
  const rowsEl=document.getElementById('score-rows');
  rowsEl.innerHTML='';
  areaScores.forEach(a=>{
    const risk=getRiskLevel(a.pctVal);
    const dimScores=a.dims.map((_,di)=>getDimScore(a.id,di));
    const row=document.createElement('div');
    row.className='score-row';
    row.innerHTML=`
      <div class="score-row-top">
        <div class="area-label">${a.icon} ${a.name}</div>
        <span class="risk-badge ${risk.cls}">${risk.label}</span>
        <div class="score-pct">${a.score}/32</div>
      </div>
      <div class="area-bar-wrap"><div class="area-bar" style="width:${a.pctVal}%;background:${a.color}"></div></div>
      <div class="sub-bars">
        ${a.dims.map((d,di)=>{
          const sp=pct(dimScores[di],8);
          return `<div class="sub-bar-item">
            <div class="sb-label">${d.letter}. ${d.name.slice(0,5)}</div>
            <div class="sb-fill-wrap"><div class="sb-fill" style="width:${sp}%;background:${a.color}80"></div></div>
            <div style="font-size:9px;color:var(--text-light);text-align:center;margin-top:2px">${dimScores[di]}/8</div>
          </div>`;}).join('')}
      </div>`;
    rowsEl.appendChild(row);
  });

  // 8-area interpretation cards
  renderAreaInsights(areaScores);

  // Action items (top 3 weak areas)
  const actEl=document.getElementById('action-items');
  actEl.innerHTML='';
  top3.forEach(a=>{
    const acts=getActionItems(a.id);
    const div=document.createElement('div');
    div.className='action-item';
    div.innerHTML=`
      <div class="ai-icon">${a.icon}</div>
      <div class="ai-text">
        <h4>${a.name} 즉시 실천 1가지</h4>
        <p>${acts}</p>
      </div>`;
    actEl.appendChild(div);
  });

  // Evidence
  buildEvidence();

  // Radar
  setTimeout(()=>drawRadar(areaScores),200);

  // 익명 진단 기록 (프리미엄 신청 여부와 무관하게 모든 진단 완료자 대상, best-effort)
  logDiagnosisToSheet(collectAreaScoresForReport(),totalScore);
}
```

아래로 통째로 교체한다:

```js
function buildResults(){
  const areaScores=AREAS.map(a=>({...a,score:getAreaScore(a.id),pctVal:pct(getAreaScore(a.id),32)}));
  const totalScore=areaScores.reduce((s,a)=>s+a.score,0);
  setTimeout(()=>drawRadar(areaScores),200);
  logDiagnosisToSheet(collectAreaScoresForReport(),totalScore);
}
```

- [ ] **Step 6: 더 이상 쓰이지 않는 `updateName()` 스텁 삭제**

`index.html`에서 아래 함수를 찾아 삭제한다:

```js
function updateName(){
  // placeholder for name personalization
}
```

- [ ] **Step 7: 수동 검증**

Run: `npx serve .` 후 브라우저에서 처음부터 끝까지 진행.

1. 결과 화면(SCREEN 4)에 "🕸️ 나의 생활습관 레이더 차트" 캔버스와 "진단 결과를 더 깊이 나누고 싶다면" CTA 카드 1개, "처음부터 다시하기" 버튼만 보이는지 확인 (총점 카드·이름입력·검진결과 회색지대 분석·최약점 TOP3·8영역 점수표·8영역 해석·액션아이템·근거자료·공유버튼이 안 보여야 함).
2. 브라우저 개발자도구 콘솔에 에러(빨간 줄)가 없는지 확인 — 특히 `Cannot set properties of null` 같은 에러가 없어야 함.
3. 결과 화면이 뜬 뒤 약 1.5초 후 자동으로 로딩 오버레이("AI가 8개 영역을 정밀 분석하고 있어요" 등)가 뜨는지 확인 (Task 3에서 연결한 자동 트리거가 여전히 동작하는지 재확인).

- [ ] **Step 8: 커밋**

```bash
git add index.html
git commit -m "feat: simplify result screen to radar chart + single CTA before auto-generating premium report"
```

---

### Task 5: 전체 플로우 수동 회귀 테스트

**Files:** 없음 (코드 변경 없음, 검증 전용 태스크).

**Interfaces:** 없음.

- [ ] **Step 1: 백엔드 테스트 스위트 회귀 확인**

Run: `npm test`
Expected: 기존 90개 테스트 전부 PASS (이번 작업은 `index.html`만 건드렸으므로 백엔드 테스트는 영향받지 않아야 함).

- [ ] **Step 2: 잔여 참조 확인**

Run: `grep -n "openPremiumModal\|closePremiumModal\|premiumModal\|open.kakao.com" index.html` (또는 Grep 도구로 동일하게 검색)
Expected: 매치가 0건이어야 한다 — 삭제된 함수/모달/링크에 대한 잔여 참조가 하나도 없어야 한다.

- [ ] **Step 3: 브라우저 E2E 시나리오 3가지 재확인**

`npx serve .`로 띄운 뒤 아래 3가지 모드를 각각 처음부터 끝까지 실행해 콘솔 에러 없이 `report.html`까지 도달하는지 확인 (실제 리포트 생성은 API 키 유무에 따라 실패할 수 있으나, 그 전까지의 화면 전환과 자동 트리거는 에러 없이 동작해야 한다):

1. "습관 진단 + 건강검진 통합 분석" 모드 — 검진수치를 일부만 입력.
2. "건강습관 자가 진단만" 모드 — 검진수치 화면 자체를 건너뜀.
3. "건강검진 수치만 분석" 모드 — 퀴즈를 건너뜀.

Expected: 세 모드 모두 SCREEN 1.5(동의)에서 필수 동의 체크 없이는 진행이 막히고, 체크 후에는 각자의 경로를 거쳐 결과 화면(레이더차트+CTA 1개)까지 도달하며, 이후 자동으로 리포트 생성 요청이 발생한다.

- [ ] **Step 4: 최종 상태 확인**

Run: `git status` / `git log --oneline -6`
Expected: Task 1~4의 커밋 4개가 순서대로 쌓여 있고, 워킹트리에 의도치 않은 변경이 남아있지 않다.

# 바이럴 프리미엄 포지셔닝 & 리포트 톤 개편 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 건강만다라 진단앱에 대표자 스토리, "10만원 상당 무료 프리미엄" 가치 프레이밍, 근거+동기부여 중심으로 재작성된 AI 리포트 톤, 그리고 바이럴을 노리는 공유 문구를 추가해 사용자가 자발적으로 공유하고 싶어지는 서비스로 만든다.

**Architecture:** 기존 `index.html`(진단앱)과 `report.html`(프리미엄 리포트)에 정적 콘텐츠/문구를 추가·수정하고, `lib/buildPrompt.js`의 시스템 프롬프트만 확장한다. 스키마(`lib/reportSchema.js`)나 API 계약은 변경하지 않는다 — 순수 콘텐츠/카피/프롬프트 작업이다.

**Tech Stack:** Vanilla JS/HTML (기존 유지), Node 내장 테스트러너(`node:test`, buildPrompt 프롬프트 검증용).

## Global Constraints

- 스키마(`REPORT_SCHEMA`) 구조는 변경하지 않는다 — 프롬프트 지시문 강화만 진행한다.
- 대표자 스토리는 기본 접힘 상태, "더보기" 클릭 시 펼쳐진다.
- 명언 4개는 사용자가 제시한 순서 그대로 사용한다: ①"건강은 정보를 더 많이 아는 사람이 아니라, 무너지는 신호를 끝까지 외면하지 않는 사람이 지킵니다." ②"몸은 어느 날 갑자기 무너지지 않습니다." ③"가장 약한 한 칸에서 먼저 새기 시작합니다." ④"건강은 지식이 아니라 태도입니다."
- 가격 문구("진단가 10만원 상당")는 리드 팝업 + report.html 히어로에만 넣고, 결과화면 하단 CTA는 가격 언급 없이 태도 전환 동기부여 문구로 교체한다.
- 저작권 등록번호는 정확히 `C-2026-026168`, 문의처는 정확히 `ufoacademy@naver.com`이다.
- 기존 로직(AREAS, BIOMARKERS, getAreaScore, buildResults, drawRadar 등)은 건드리지 않는다.

---

### Task 1: 대표자 스토리 섹션 (index.html 인트로 화면)

**Files:**
- Modify: `index.html` (인트로 화면 HTML + CSS + JS 토글 함수)

**Interfaces:**
- Produces: `toggleFounderStory()` — 새 전역 함수, 클릭 시 스토리 박스의 펼침/접힘을 토글.

- [ ] **Step 1: CSS 추가**

`index.html`의 `<style>` 블록 내, 기존 `.info-box` 관련 스타일 근처에 아래 스타일 추가:

```css
.founder-story-box{margin-bottom:16px;}
.founder-story-toggle{display:flex;align-items:center;justify-content:space-between;cursor:pointer;padding:4px 0;}
.founder-story-toggle h3{margin:0;}
.founder-story-arrow{font-size:12px;color:var(--text-mid);transition:transform .2s;}
.founder-story-arrow.open{transform:rotate(180deg);}
.founder-story-content{display:none;margin-top:12px;font-size:12px;line-height:1.8;color:var(--text-mid);}
.founder-story-content.show{display:block;}
.founder-quote{background:var(--green-pale);border-left:3px solid var(--green-dark);border-radius:8px;padding:10px 14px;margin:10px 0;font-weight:700;color:var(--green-dark);font-size:12.5px;}
```

- [ ] **Step 2: HTML 추가**

`index.html`에서 "🔬 진단 방식 선택" 박스를 찾는다 (검색어: `진단 방식 선택`). 그 박스 바로 앞에 아래 블록을 삽입:

```html
<!-- 대표자 스토리 -->
<div class="info-box founder-story-box">
  <div class="founder-story-toggle" onclick="toggleFounderStory()">
    <h3>👩‍⚕️ 왜 건강만다라를 만들었나</h3>
    <span class="founder-story-arrow" id="founderArrow">▼</span>
  </div>
  <div class="founder-story-content" id="founderContent">
    <p>23년차 질병예방전문가로 16년을 학교보건실이라는 제도권 안에서 건강사업을 해왔습니다. 하지만 결국 건강 문제는 가정에서부터 시작된다는 것을 알게 되어, 지난 7년간 제도권 밖 현장에서 수백 명을 직접 만나왔습니다.</p>
    <p style="margin-top:10px;">그 과정에서 깨달은 것은 하나입니다. 정보는 넘쳐나지만, 정작 내가 무엇을 어떻게 해야 할지 아는 사람은 드물다는 것입니다. 한 영역만 파고드는 것이 아니라, 건강이음 8영역으로 균형 있게 설계해야 한다는 확신으로 이 진단을 만들었습니다.</p>
    <div class="founder-quote">"건강은 정보를 더 많이 아는 사람이 아니라, 무너지는 신호를 끝까지 외면하지 않는 사람이 지킵니다."</div>
    <div class="founder-quote">"몸은 어느 날 갑자기 무너지지 않습니다."</div>
    <div class="founder-quote">"가장 약한 한 칸에서 먼저 새기 시작합니다."</div>
    <div class="founder-quote">"건강은 지식이 아니라 태도입니다."</div>
    <p style="margin-top:10px;">이 진단이 여러분의 건강한 삶에 작은 시작이 되기를 바랍니다.</p>
  </div>
</div>

```

- [ ] **Step 3: JS 토글 함수 추가**

`index.html`의 `<script>` 블록에서 `function toggleEvidence()` 함수를 찾는다(검색어: `function toggleEvidence`). 그 함수 바로 뒤에 추가:

```js
function toggleFounderStory(){
  const content=document.getElementById('founderContent');
  const arrow=document.getElementById('founderArrow');
  content.classList.toggle('show');
  arrow.classList.toggle('open');
}
```

- [ ] **Step 4: 수동 검증**

`npx serve .`로 로컬 서버를 띄우고 인트로 화면에서 "👩‍⚕️ 왜 건강만다라를 만들었나" 박스가 접혀있는 상태로 보이는지, 클릭 시 스토리+명언 4개가 순서대로 펼쳐지는지, 다시 클릭하면 접히는지 확인.

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "feat: add collapsible founder story section to intro screen"
```

---

### Task 2: 프리미엄 가격 포지셔닝 — 리드 팝업 + 결과화면 CTA (index.html)

**Files:**
- Modify: `index.html`

**Interfaces:**
- 없음 (정적 텍스트 변경)

- [ ] **Step 1: 리드 팝업 안내문에 가격 추가**

`index.html`에서 아래 문구를 찾는다 (검색어: `AI가 검진수치와 습관 점수를 통합 분석한 맞춤 프리미엄 리포트`):

기존:
```html
<p style="font-size:13px;color:var(--text-mid);margin-bottom:14px;line-height:1.6;">이름과 연락처를 남겨주시면 AI가 검진수치와 습관 점수를 통합 분석한 맞춤 프리미엄 리포트를 보여드려요.</p>
```

변경 후:
```html
<p style="font-size:13px;color:var(--text-mid);margin-bottom:14px;line-height:1.6;">이름과 연락처를 남겨주시면 AI가 검진수치와 습관 점수를 통합 분석한 맞춤 프리미엄 리포트(진단가 10만원 상당)를 무료로 보여드려요.</p>
```

- [ ] **Step 2: 결과화면 하단 CTA 헤드라인을 동기부여 문구로 교체**

`index.html`에서 아래 문구를 찾는다 (검색어: `지금 바로 건강을 바꾸는 첫 걸음`):

기존:
```html
<h3>지금 바로 건강을 바꾸는 첫 걸음</h3>
<p>맞춤 프로그램으로 만성질환을 예방하세요</p>
```

변경 후:
```html
<h3>이제 나의 무너진 한 칸을 채우러 가기</h3>
<p>가장 약한 영역부터, 지금 바로 시작해보세요</p>
```

- [ ] **Step 3: 수동 검증**

로컬 서버에서 리드 팝업을 열어 가격 문구가 자연스럽게 보이는지, 결과화면 하단 CTA 제목이 바뀌었는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add index.html
git commit -m "feat: add premium price framing to lead modal and motivational CTA copy"
```

---

### Task 3: 저작권 등록번호 + 기업/기관 문의처 (index.html, report.html)

**Files:**
- Modify: `index.html`
- Modify: `report.html`

**Interfaces:**
- 없음 (정적 텍스트 변경)

- [ ] **Step 1: index.html 푸터 수정**

`index.html`에서 아래 문구를 찾는다 (검색어: `무단 복제, 전재, 배포 및 상업적 도용을 금합니다`):

기존:
```html
<div>© 2026 건강이음센터 (올바른 보건쌤). All Rights Reserved. 본 프로그램의 8영역 진단 문항, 검진 지표 연계 알고리즘 및 결과 해석 텍스트는 저작권법의 보호를 받는 독창적 저작물이며, 무단 복제, 전재, 배포 및 상업적 도용을 금합니다.</div>
```

변경 후:
```html
<div>© 2026 건강이음센터 (올바른 보건쌤). All Rights Reserved. 본 프로그램의 8영역 진단 문항, 검진 지표 연계 알고리즘 및 결과 해석 텍스트는 저작권법의 보호를 받는 독창적 저작물이며, 무단 복제, 전재, 배포 및 상업적 도용을 금합니다. (저작권등록번호 C-2026-026168)</div>
<div style="margin-top:4px;font-size:10px;">기업·기관 사용 문의: ufoacademy@naver.com</div>
```

- [ ] **Step 2: report.html 푸터 수정**

`report.html`에서 아래 문구를 찾는다 (검색어: `본 리포트는 생활습관 코칭 참고용이며 의학적 진단을 대체하지 않습니다`):

기존:
```html
<p class="footer-note">© 2026 건강이음센터. 본 리포트는 생활습관 코칭 참고용이며 의학적 진단을 대체하지 않습니다.</p>
```

변경 후:
```html
<p class="footer-note">© 2026 건강이음센터. 본 리포트는 생활습관 코칭 참고용이며 의학적 진단을 대체하지 않습니다. (저작권등록번호 C-2026-026168)</p>
<p class="footer-note" style="margin-top:4px;">기업·기관 사용 문의: ufoacademy@naver.com</p>
```

주의: `report.html`은 `escapeHtml`로 감싼 템플릿 리터럴(`root.innerHTML = ...`) 안에 이 줄이 있으므로, `renderReport` 함수 내부의 해당 줄을 찾아 수정할 것 (정적 HTML이 아니라 JS 템플릿 문자열 안에 있음).

- [ ] **Step 3: 수동 검증**

두 페이지 모두 푸터에 저작권등록번호와 문의 이메일이 표시되는지 확인.

- [ ] **Step 4: 커밋**

```bash
git add index.html report.html
git commit -m "feat: add copyright registration number and institutional contact to footers"
```

---

### Task 4: report.html 히어로에 가격 배지 추가

**Files:**
- Modify: `report.html`

**Interfaces:**
- 없음 (정적 텍스트 변경, `renderReport` 함수 내부)

- [ ] **Step 1: 히어로 템플릿에 배지 삽입**

`report.html`의 `renderReport` 함수에서 아래 부분을 찾는다:

기존:
```html
    <div class="hero">
      <h1>${escapeHtml(name || '고객')}님, 건강만다라로 몸의 패턴을 읽었습니다</h1>
      <p class="greeting">${escapeHtml(report.greeting || '')}</p>
      <p class="total">건강만다라 총점 ${escapeHtml(totalScore)}/256</p>
    </div>
```

변경 후:
```html
    <div class="hero">
      <div style="display:inline-block;background:rgba(255,255,255,0.15);border-radius:20px;padding:6px 14px;font-size:11px;font-weight:700;margin-bottom:10px;">🎁 진단가 100,000원 상당의 프리미엄 통합분석을 무료로 제공합니다</div>
      <h1>${escapeHtml(name || '고객')}님, 건강만다라로 몸의 패턴을 읽었습니다</h1>
      <p class="greeting">${escapeHtml(report.greeting || '')}</p>
      <p class="total">건강만다라 총점 ${escapeHtml(totalScore)}/256</p>
    </div>
```

- [ ] **Step 2: 수동 검증**

report.html을 열어 히어로 영역 상단에 배지가 자연스럽게 보이는지 확인 (인쇄 미리보기에서도 잘리지 않는지 확인).

- [ ] **Step 3: 커밋**

```bash
git add report.html
git commit -m "feat: add premium price badge to report hero section"
```

---

### Task 5: 공유 문구 수정 (shareKakao/copyLink)

**Files:**
- Modify: `index.html`

**Interfaces:**
- 없음 (정적 텍스트 변경)

- [ ] **Step 1: 카카오 공유 desc 수정**

`index.html`의 `shareKakao()` 함수에서 아래 줄을 찾는다:

기존:
```js
  const desc = '당뇨·고혈압·비만을 유발하는 내 삶의 최약점을 찾아드립니다 | 8영역 64문항';
```

변경 후:
```js
  const desc = '10만원 상당의 정밀분석을 무료로! 당뇨·고혈압·비만을 유발하는 내 삶의 최약점을 찾아드립니다 | 8영역 64문항';
```

- [ ] **Step 2: 카카오톡 앱 직접 공유 문구도 동일하게 반영 확인**

같은 함수 내 `kakaoUrl` 변수는 `title + '\n' + desc + '\n' + url`을 사용하므로 `desc` 수정만으로 자동 반영됨 — 추가 수정 불필요. 코드 확인만 한다.

- [ ] **Step 3: 링크복사 토스트 문구 수정**

`index.html`의 `copyLink()` 함수에서 아래 두 곳을 찾는다:

기존 (두 곳에 동일하게 등장):
```js
      showToast('🔗 링크가 복사되었어요! 카카오톡에 붙여넣기 하세요.');
```

변경 후 (두 곳 모두):
```js
      showToast('🔗 무료 프리미엄 진단 링크가 복사되었어요! 카카오톡에 붙여넣기 하세요.');
```

- [ ] **Step 4: 수동 검증**

브라우저 개발자 도구 콘솔에서 `copyLink()` 실행 후 토스트 문구 확인, `shareKakao()`가 카카오 SDK 미설정 환경에서 폴백 경로를 타는지 코드 리뷰로 확인 (실제 카카오톡 앱 연동은 실기기 테스트 필요하므로 이번 범위에서는 코드 검증까지만).

- [ ] **Step 5: 커밋**

```bash
git add index.html
git commit -m "feat: update share copy to emphasize free premium framing"
```

---

### Task 6: AI 리포트 프롬프트 톤 개편 (lib/buildPrompt.js)

**Files:**
- Modify: `lib/buildPrompt.js`
- Modify: `test/buildPrompt.test.js`

**Interfaces:**
- Consumes: 없음 (기존 `buildPrompt` 시그니처 그대로 유지)
- Produces: 변경 없음 — `SYSTEM_PROMPT` 문자열 내용만 확장

- [ ] **Step 1: 실패하는 테스트 먼저 작성**

`test/buildPrompt.test.js`의 기존 `system prompt instructs nutritionPlan to cite official evidence sources` 테스트 바로 뒤에 추가:

```js
test('system prompt instructs evidence-based, motivation-driven tone across all sections', () => {
  const result = buildPrompt({ name: '홍길동', areaScores: makeAreaScores(), totalScore: 160 });
  assert.match(result.system, /오늘|이번 주/);
  assert.match(result.system, /동기부여/);
  assert.match(result.system, /finalConclusion/);
});
```

- [ ] **Step 2: 테스트 실행하여 실패 확인**

Run: `npm test`
Expected: FAIL — `system prompt instructs evidence-based, motivation-driven tone across all sections` 테스트가 실패 (아직 해당 키워드가 시스템 프롬프트에 없음)

- [ ] **Step 3: SYSTEM_PROMPT 수정**

`lib/buildPrompt.js`를 열어 현재 `SYSTEM_PROMPT` 상수의 규칙 목록 마지막 줄(`- nutritionPlan.recommendations는 3~5개 작성하세요.`) 뒤에 아래 규칙들을 추가:

```js
- coreInsights, areaInterpretations, pairedSections, priorityExplanation, finalConclusion 등 모든 서사 섹션은 다음 원칙을 따르세요: (1) 가능하면 WHO·AHA·대한당뇨병학회·식약처 등 공식 가이드라인이나 잘 알려진 생리학적 기전을 한 문장이라도 인용해 "왜 중요한가"의 근거를 제시하세요. 새로운 통계 수치를 지어내지 말고, 이미 알려진 공중보건 원칙 범위 내에서만 서술하세요. (2) 각 서술은 "오늘 또는 이번 주부터 무엇을 하면 되는가"라는 즉시 실천 가능한 문장으로 마무리하세요. (3) "이렇게 하면 이렇게 좋아진다"는 인과관계를 분명히 밝혀 동기부여를 자극하되, 과장되거나 상업적인 문구는 쓰지 마세요.
- finalConclusion에는 특히 "왜 지금 시작해야 하는가"에 대한 강한 동기부여 문장을 포함하세요.
```

- [ ] **Step 4: 테스트 실행하여 통과 확인**

Run: `npm test`
Expected: PASS — 모든 테스트 통과

- [ ] **Step 5: 커밋**

```bash
git add lib/buildPrompt.js test/buildPrompt.test.js
git commit -m "feat: strengthen AI report prompt with evidence-based, motivation-driven tone"
```

---

### Task 7: 로컬 통합 검증 및 배포

**Files:**
- 없음 (기존 파일들의 동작 확인만 수행)

**Interfaces:**
- 없음

- [ ] **Step 1: 전체 테스트 스위트 실행**

Run: `npm test`
Expected: 모든 테스트 통과 (기존 36개 + Task 6에서 추가된 1개 = 37개)

- [ ] **Step 2: 실제 Claude 호출로 리포트 톤 확인**

프로젝트 루트에서 아래 Node 스크립트로 실제 API를 호출해 새 톤이 반영됐는지 확인 (기존 세션에서 사용한 `test-handler.js` 패턴과 동일하게, `.env`에서 `ANTHROPIC_API_KEY`를 로드해 `api/generate-report.js`의 `createHandler`를 직접 호출):

```bash
node -e "
const fs = require('fs');
const envContent = fs.readFileSync('.env','utf8');
envContent.split('\n').filter(Boolean).forEach((line)=>{
  const idx = line.indexOf('=');
  process.env[line.slice(0,idx)] = line.slice(idx+1);
});
const Anthropic = require('@anthropic-ai/sdk');
const { createHandler } = require('./api/generate-report.js');
const handler = createHandler({
  createAnthropicClient: () => new Anthropic(),
  postLead: async () => {},
  sheetsWebhookUrl: null,
});
function mockRes(){return{statusCode:null,body:null,status(c){this.statusCode=c;return this;},json(p){this.body=p;return this;}};}
const areaScores = ['식','동','휴','심','환','연','지','락'].map((name,i)=>({id:i+1,name,sub:name+'영역',icon:'🌿',color:'#16A34A',score:24,pctVal:75}));
const req={method:'POST',body:{name:'테스트',age:'35',gender:'m',contact:'010-1234-5678',email:'test@example.com',consent:true,honeypot:'',areaScores,checkupSummary:null,totalScore:192}};
const res=mockRes();
handler(req,res).then(()=>{
  console.log('STATUS:',res.statusCode);
  console.log('finalConclusion:', JSON.stringify(res.body.report.finalConclusion, null, 2));
});
"
```

Expected: STATUS 200, `finalConclusion` 안에 "지금 시작해야 하는" 이유에 대한 동기부여 문장이 포함되어 있는지 육안 확인.

- [ ] **Step 3: 브라우저로 전체 플로우 시각 검증**

`npx serve .`로 로컬 서버 실행 후:
1. 인트로 화면에서 "👩‍⚕️ 왜 건강만다라를 만들었나" 박스 펼침/접힘, 명언 4개 순서 확인.
2. 진단 완료 후 리드 팝업에 "(진단가 10만원 상당)" 문구 확인.
3. report.html에서 히어로 배지, 영양설계 섹션, 레이더차트, 푸터 저작권번호+문의처 확인.
4. 결과화면 하단 CTA 제목이 "이제 나의 무너진 한 칸을 채우러 가기"로 바뀌었는지 확인.
5. `copyLink()` 실행 시 새 토스트 문구 확인.

- [ ] **Step 4: 프로덕션 배포**

이 프로젝트는 로컬 `vercel` CLI 인증이 깨져있어 REST API 기반 배포 스크립트를 사용한다 (이전 세션에서 작성한 스크래치패드 스크립트 재사용 또는 동일 로직으로 재작성). 배포 후 `https://mandala-gamma.vercel.app`에서 위 Step 3 항목을 동일하게 재확인한다.

- [ ] **Step 5: 발견된 문제 수정 및 커밋 (필요시)**

```bash
git add -A
git commit -m "fix: address issues found in viral positioning verification"
```

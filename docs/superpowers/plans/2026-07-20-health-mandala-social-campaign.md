# 건강만다라 SNS 캠페인 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 인스타그램에 바로 게시할 수 있는 고급 비즈니스 톤의 카드뉴스 8장과 대표 음성 녹음에 맞춰 완성할 수 있는 25~30초 릴스 제작 패키지를 만든다.

**Architecture:** 카드뉴스와 릴스는 하나의 캠페인 데이터 파일을 공통 원본으로 사용한다. HTML/CSS 기반 1080×1350 카드와 1080×1920 세로 영상 장면을 각각 렌더링해 문구와 디자인의 일관성을 유지하고, 최종 릴스는 사용자가 녹음한 내레이션을 합성한다.

**Tech Stack:** HTML5, CSS3, JavaScript, 로컬 브라우저 캡처, MP4 영상 렌더링 도구, Git

## Global Constraints

- 대상은 건강 신호가 나타났지만 무엇을 바꿀지 모르는 40~50대 직장인이다.
- 시각 톤은 딥 네이비 `#182B3A`, 웜 골드 `#C79A52`, 아이보리 `#F5F0E7`, 보조 오렌지 `#C96F3B`의 고급 비즈니스 스타일이다.
- CTA는 `팔로우 + “건강지도” 댓글 → 자동 DM 무료 링크`로 통일한다.
- 릴스는 9:16, 1080×1920, 25~30초이며 대표 본인의 목소리를 사용한다.
- 카드뉴스는 4:5, 1080×1350, 총 8장이다.
- 공포를 자극하는 의료 이미지, 병원 광고식 원색, 과도한 장식은 사용하지 않는다.
- 배포 대상은 GitHub `ufoacademy/mandala`, Vercel 프로젝트 `mandala`이며 푸시·배포 전 다시 확인한다.

---

## File Map

- Create: `social-campaign/content.js` — 카드뉴스·릴스 공통 문구와 타임라인 데이터
- Create: `social-campaign/cardnews.html` — 8장 카드뉴스 렌더링 원본
- Create: `social-campaign/reel.html` — 9:16 릴스 모션 장면 원본
- Create: `social-campaign/styles/brand.css` — 공통 색상·서체·그래픽 규칙
- Create: `social-campaign/assets/README.md` — 음성 파일 녹음·교체 규격
- Create: `social-campaign/export/README.md` — 최종 산출물 목록과 게시 방법
- Create: `test/socialCampaignContent.test.js` — 장수, CTA, 타임라인, 필수 신뢰 문구 검증
- Create: `test/socialCampaignMarkup.test.js` — 규격과 접근성용 구조 검증

### Task 1: 공통 캠페인 콘텐츠 모델

**Files:**
- Create: `social-campaign/content.js`
- Create: `test/socialCampaignContent.test.js`

**Interfaces:**
- Produces: `CARD_SLIDES: Array<{id:number, eyebrow:string, headline:string, body:string, visual:string}>`
- Produces: `REEL_SCENES: Array<{id:number, start:number, end:number, narration:string, caption:string, visual:string}>`
- Produces: `CTA_TEXT: string`

- [ ] **Step 1: 필수 콘텐츠 검증 테스트 작성**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const { CARD_SLIDES, REEL_SCENES, CTA_TEXT } = require('../social-campaign/content');

test('카드뉴스는 정확히 8장이다', () => assert.equal(CARD_SLIDES.length, 8));
test('릴스는 25~30초다', () => {
  assert.equal(REEL_SCENES[0].start, 0);
  assert.ok(REEL_SCENES.at(-1).end >= 25 && REEL_SCENES.at(-1).end <= 30);
});
test('CTA와 전문가 신뢰 문구가 들어간다', () => {
  assert.match(CTA_TEXT, /팔로우/);
  assert.match(CTA_TEXT, /건강지도/);
  assert.match(JSON.stringify(CARD_SLIDES), /23년차 질병예방 전문가/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/socialCampaignContent.test.js`
Expected: FAIL with `Cannot find module '../social-campaign/content'`

- [ ] **Step 3: 승인 명세의 8장 문구와 7개 영상 장면을 `content.js`에 구현**

CTA 상수는 아래 문구를 그대로 사용한다.

```js
const CTA_TEXT = '팔로우하고 “건강지도”라고 댓글 남겨주세요. 무료 건강만다라 링크를 DM으로 보내드립니다.';
```

- [ ] **Step 4: 테스트 통과 확인**

Run: `node --test test/socialCampaignContent.test.js`
Expected: 3 tests PASS

- [ ] **Step 5: 커밋**

```bash
git add social-campaign/content.js test/socialCampaignContent.test.js
git commit -m "feat: add health mandala campaign content model"
```

### Task 2: 브랜드 디자인 시스템과 카드뉴스 8장

**Files:**
- Create: `social-campaign/styles/brand.css`
- Create: `social-campaign/cardnews.html`
- Create: `test/socialCampaignMarkup.test.js`

**Interfaces:**
- Consumes: `CARD_SLIDES`, `CTA_TEXT`
- Produces: 브라우저에서 각각 1080×1350으로 캡처 가능한 `.card-slide[data-slide]` 8개

- [ ] **Step 1: 카드 규격과 장수 테스트 작성**

```js
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

test('카드 원본은 1080×1350 규격과 8개 슬라이드 슬롯을 가진다', () => {
  const css = fs.readFileSync('social-campaign/styles/brand.css', 'utf8');
  const html = fs.readFileSync('social-campaign/cardnews.html', 'utf8');
  assert.match(css, /--card-width:\s*1080px/);
  assert.match(css, /--card-height:\s*1350px/);
  assert.match(html, /CARD_SLIDES/);
  assert.match(html, /data-slide/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/socialCampaignMarkup.test.js`
Expected: FAIL because the CSS and HTML files do not exist

- [ ] **Step 3: `brand.css` 구현**

다음 토큰을 루트에 선언하고 모든 카드·릴스 요소가 이를 사용하게 한다.

```css
:root {
  --navy: #182B3A;
  --gold: #C79A52;
  --ivory: #F5F0E7;
  --orange: #C96F3B;
  --card-width: 1080px;
  --card-height: 1350px;
  --reel-width: 1080px;
  --reel-height: 1920px;
}
```

- [ ] **Step 4: `cardnews.html`에서 8장을 순서대로 렌더링**

첫 장은 현실 공감형 사진과 강한 질문, 2~7장은 아이보리 여백과 네이비 정보 구조, 8장은 골드 CTA 패널을 사용한다. 4장은 가장 낮은 판자, 5장은 8각형, 6장은 검진 수치에서 건강습관으로 이어지는 선형 그래픽을 CSS 도형으로 만든다.

- [ ] **Step 5: 테스트와 브라우저 육안 검수**

Run: `node --test test/socialCampaignMarkup.test.js`
Expected: PASS

브라우저 검수: 글자 잘림 없음, 각 장 번호 1~8, CTA의 `건강지도` 철자 정확, 모바일 축소 화면에서도 제목 판독 가능.

- [ ] **Step 6: 카드뉴스 PNG 8장 내보내기**

파일명은 `social-campaign/export/card-01.png`부터 `card-08.png`까지 사용한다. 각 파일의 실제 픽셀 크기가 1080×1350인지 이미지 속성으로 확인한다.

- [ ] **Step 7: 커밋**

```bash
git add social-campaign/styles/brand.css social-campaign/cardnews.html social-campaign/export/card-*.png test/socialCampaignMarkup.test.js
git commit -m "feat: create premium health mandala card news"
```

### Task 3: 릴스 모션 원본과 무음 시안

**Files:**
- Create: `social-campaign/reel.html`
- Create: `social-campaign/export/reel-preview.mp4`

**Interfaces:**
- Consumes: `REEL_SCENES`, `CTA_TEXT`, `brand.css`
- Produces: 1080×1920, 25~30초 무음 MP4 시안

- [ ] **Step 1: 릴스 규격 테스트 추가**

```js
test('릴스 원본은 세로 영상 규격과 공통 장면 데이터를 사용한다', () => {
  const css = fs.readFileSync('social-campaign/styles/brand.css', 'utf8');
  const html = fs.readFileSync('social-campaign/reel.html', 'utf8');
  assert.match(css, /--reel-width:\s*1080px/);
  assert.match(css, /--reel-height:\s*1920px/);
  assert.match(html, /REEL_SCENES/);
});
```

- [ ] **Step 2: 실패 확인**

Run: `node --test test/socialCampaignMarkup.test.js`
Expected: FAIL because `social-campaign/reel.html` does not exist

- [ ] **Step 3: 장면별 모션과 자막 구현**

0~3초 검진표 클로즈업, 3~7초 업무 장면, 7~11초 빈 지도, 11~15초 낮은 판자, 15~20초 수치와 8각형 연결, 20~24초 `23 YEARS` 신뢰 배지, 24~30초 CTA 순서를 적용한다. 자막은 최대 두 줄, 핵심어만 골드로 강조하고 마지막 CTA는 4초 이상 유지한다.

- [ ] **Step 4: 테스트 통과 확인**

Run: `npm test`
Expected: all tests PASS

- [ ] **Step 5: 무음 시안 렌더링 및 검수**

`social-campaign/export/reel-preview.mp4`로 렌더링한다. 세로 1080×1920, 25~30초, 검은 빈 프레임 없음, 자막 잘림 없음, 첫 1초 안에 질문 노출을 확인한다.

- [ ] **Step 6: 커밋**

```bash
git add social-campaign/reel.html social-campaign/export/reel-preview.mp4 test/socialCampaignMarkup.test.js
git commit -m "feat: create health mandala reel motion draft"
```

### Task 4: 대표 음성 녹음과 최종 릴스

**Files:**
- Create: `social-campaign/assets/README.md`
- Add: `social-campaign/assets/voiceover.wav`
- Create: `social-campaign/export/reel-final.mp4`
- Create: `social-campaign/export/README.md`

**Interfaces:**
- Consumes: 승인된 내레이션, `reel-preview.mp4`, 사용자가 녹음한 `voiceover.wav`
- Produces: 게시 가능한 `reel-final.mp4`

- [ ] **Step 1: 음성 녹음 규격 문서 작성**

`assets/README.md`에 WAV 또는 고음질 M4A, 조용한 실내, 입과 마이크 15~20cm, 문장 사이 0.3~0.5초, 전체 25~30초, 배경 음악 없이 녹음하도록 명시한다.

- [ ] **Step 2: 사용자 녹음 파일 확인**

파일을 `social-campaign/assets/voiceover.wav`로 배치하고 처음과 끝의 긴 무음, 클리핑, 잡음, 내레이션 누락 여부를 청취 확인한다.

- [ ] **Step 3: 음성과 장면 타이밍 동기화**

문장 시작점이 각 장면 전환과 일치하도록 장면 지속시간을 미세 조정하되 전체 길이는 25~30초로 유지한다. 배경음은 선택 사항이며 사용할 경우 내레이션보다 충분히 낮게 믹싱한다.

- [ ] **Step 4: 최종 MP4 내보내기**

파일은 `social-campaign/export/reel-final.mp4`로 저장한다. 1080×1920, H.264 영상, AAC 음성, 30fps 규격을 사용한다.

- [ ] **Step 5: 최종 검수 문서 작성**

`export/README.md`에 카드 8장, 릴스 1편, 게시 캡션, 권장 업로드 순서, 의료적 진단을 대신하지 않는다는 고지 문구를 기록한다.

- [ ] **Step 6: 전체 검증**

Run: `npm test`
Expected: all tests PASS

육안·청취 검수: 음성과 자막 일치, CTA 4초 이상, `23년차 질병예방 전문가` 표기, `팔로우 + 건강지도 댓글` 안내, 오탈자 없음.

- [ ] **Step 7: 커밋 전 대상 재확인 후 커밋**

GitHub 원격이 `ufoacademy/mandala`, Vercel 프로젝트가 `mandala`인지 다시 확인한다.

```bash
git add social-campaign/assets/README.md social-campaign/assets/voiceover.wav social-campaign/export/reel-final.mp4 social-campaign/export/README.md
git commit -m "feat: finalize health mandala social campaign assets"
```

### Task 5: 게시 전 최종 인수 확인

**Files:**
- Verify: `social-campaign/export/card-01.png` through `card-08.png`
- Verify: `social-campaign/export/reel-final.mp4`
- Verify: `social-campaign/export/README.md`

**Interfaces:**
- Produces: 사용자 승인된 게시 패키지

- [ ] **Step 1: 카드뉴스 전체 순서 검토**

공감 → 건강지도 부재 → 빈칸 → 낮은 판자 → 8영역 → 검진 수치 연결 → 전문가 신뢰 → CTA 흐름을 확인한다.

- [ ] **Step 2: 모바일 화면 최종 검토**

각 PNG와 MP4를 실제 모바일 크기로 축소해 제목, 본문, 댓글 키워드의 판독성을 확인한다.

- [ ] **Step 3: 사용자에게 최종 시안 승인 요청**

카드뉴스 8장과 최종 릴스를 함께 제공하며, 게시·푸시·Vercel 배포는 별도 승인 없이는 실행하지 않는다.


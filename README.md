# 건강만다라 랜딩페이지 — 1차 초안 (보라-초록)

2026-10-28 작업 기록. 기존 `ufoacademy/mandala` 소스를 바탕으로 판매 랜딩페이지와 교육플랫폼 상세페이지를 별도 프로젝트로 구성했다.

## 화면

- `index.html` / `premium.html`: 게임형 판매 랜딩. 보라색·형광 연두, 건강 탐험 캐릭터, 클릭 가능한 8영역 미션, 샘플 리포트.
- `education-detail.html`: 교육플랫폼용 세로 상세페이지. 이미지 업로드 파일은 `exports/`.
- `promotion.html`: 짧은 홍보 소재와 소개문.
- `result-preview.html`: 검사 직후 디자인 예시 → 프리미엄 결과지 샘플.
- `report-sample.html`: 11쪽 새 디자인 리포트 샘플.
- `assets/report/premium-design-sample.pdf`: 내보낸 PDF 샘플.
- `diagnosis.html`: 실제 진단 앱 소스. 기존 사용자 인증·점수 산식·DB 저장 유지. 새 결과 카드와 프리미엄 진입 버튼 적용.
- `report.html`: 실제 생성 리포트 화면. 샘플과 같은 보라색 카드 테마.

## 확정한 상품과 이용 흐름

정가 50,000원, 출시기념 9,900원. 1회 구매. 강의 수강 없이 리포트 제공.

이름·문자 수신 휴대폰 신청 → 결제 → 서버의 실제 수납 확인 → 이름·인증코드·검사 링크 문자 발송 → 이름·휴대폰·인증코드 일치 확인 → 검사 → 동일 사용자 ID로 습관 DB 저장 → 결과 카드 → 프리미엄 리포트 → PDF 저장.

게임의 레벨·능력치는 디자인 표현이다. 의학적 진단이나 미래 예측 서비스가 아니다. 샘플은 첨부된 김건강님 PDF 구성·점수를 재구성했으며 실제 검사에 샘플 점수를 사용하지 않는다.

## 현재 상태 / 남은 작업

화면·샘플·결과 디자인과 주문 연결부를 구현했다. 실제 결제선생 API, 수납 확인, 주문 DB, 이용권 발급, 문자 발송 연동은 미완료다. 현재 결제는 닫혀 있다. 판매자 정보, 개인정보·민감정보 처리, 제공 시점과 환불 규정 확정 후 실제 테스트를 거쳐 오픈한다. 세부 내용은 `docs/operations/premium-sales.md`.

GitHub Pages 배포는 판매 소개·교육 상세페이지·디자인 샘플만 정적으로 게시한다. 진단 API나 결제·문자를 실행하지 않는다. 실제 진단 앱 운영 배포에는 API 실행이 가능한 별도 호스팅과 환경변수 설정이 필요하다.

## 실행 / 배포

`npm ci` 후 `npm run dev`. 기본 포트 3000. 비밀키는 `.env.example`을 참고해 별도로 관리하며 커밋하지 않는다.

`npm run build:pages`로 정적 결과물을 `dist/`에 생성한다. GitHub Pages 하위 경로는 `PAGES_BASE_PATH=/mandala-landingpage` 사용. `main`에 푸시하면 `.github/workflows/pages.yml`이 정적 사이트를 배포한다. GitHub 설정에서 Pages의 소스는 GitHub Actions여야 한다.

커밋 메시지: **1차 초안만들기 (보라-초록)**

원본 출처: https://github.com/ufoacademy/mandala

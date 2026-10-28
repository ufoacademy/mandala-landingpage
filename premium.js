const samplePaper = document.querySelector('#sample-paper');
const sampleHeader = '<div class="sample-header"><span>건강만다라 · PREMIUM REPORT</span><span>미리보기용 예시 · 개인 진단 결과 아님</span></div>';
const samples = [
  `<h3>김건강님의 건강 지도</h3><p class="sample-description">8영역의 균형을 살펴보는 나의 생활습관 맵</p><div class="sample-grid">${[['식 · 식생활',56],['동 · 활동',47],['휴 · 회복',41],['심 · 마음',59],['환 · 환경',63],['연 · 연결',66],['지 · 정보',59],['락 · 여가',63]].map(([name,score])=>`<div class="sample-cell"><span>${name}</span><strong>${score}<small>%</small></strong></div>`).join('')}</div><div class="sample-insight"><strong>이번 변화의 출발점은 ‘회복’과 ‘활동’입니다.</strong>예시 응답에서는 휴·동 영역의 점수가 상대적으로 낮습니다. 다른 영역의 강점을 살피면서, 일상에 더할 작은 습관부터 정해보세요.</div>`,
  '<h3>숫자와 습관을 함께 읽기</h3><p class="sample-description">답변과 검진정보를 함께 살펴 실천의 우선순위를 정합니다.</p><div class="sample-row"><span>입력한 정보</span><div><strong>활동 47% · 회복 41%</strong><p>샘플 응답에서 상대적으로 낮은 두 영역입니다.</p></div></div><div class="sample-row"><span>함께 살필 점</span><div><strong>나의 활동량과 수면 리듬</strong><p>검진정보는 습관 점수와 함께 검토할 참고자료입니다. 개별 수치만으로 질병의 원인을 단정하지 않습니다.</p></div></div><div class="sample-insight"><strong>나에게 맞는 작은 행동부터</strong>예시 실천안: 저녁 식사 후 짧게 걷기, 기상시간 기록하기. 현재 건강상태와 일상 여건에 맞게 조정해 주세요.</div>',
  '<h3>작게 시작하는 12주</h3><p class="sample-description">한 번에 모두 바꾸기보다, 내 생활에 하나씩 더합니다.</p>'+[['1–2주','첫 습관 정하기','내가 실천할 수 있는 작은 행동 한 가지를 정해 기록합니다.'],['3–4주','회복 리듬 살피기','취침·기상시간을 기록하고 생활에 맞는 루틴을 찾습니다.'],['5–8주','일상으로 넓히기','실천 빈도를 점검하고 가족이나 친구와 목표를 공유합니다.'],['9–12주','변화 돌아보기','지속할 습관과 조정할 목표를 정리합니다.']].map(([week,title,desc])=>`<div class="sample-row"><span>${week}</span><div><strong>${title}</strong><p>${desc}</p></div></div>`).join('')
];
function showSample(index) {
  samplePaper.innerHTML = sampleHeader + samples[index] + `<div class="sample-footer"><span>HEALTH MANDALA · 생활습관 코칭 참고자료</span><span>0${index+1} / SAMPLE</span></div>`;
  document.querySelectorAll('[data-page]').forEach(button => {
    const active = Number(button.dataset.page) === index;
    button.classList.toggle('active', active); button.setAttribute('aria-pressed', String(active));
  });
}
document.querySelectorAll('[data-page]').forEach(button => button.addEventListener('click', () => showSample(Number(button.dataset.page))));
showSample(0);
const checkout = document.querySelector('#checkout');
const payButton = document.querySelector('#pay-button');
const consent = document.querySelector('#purchase-consent');
let paymentUrl = null;
let loading = false;
async function openCheckout() {
  if (!checkout.open) checkout.showModal();
  if (loading) return;
  loading = true; paymentUrl = null; consent.checked = false;
  payButton.disabled = true; payButton.textContent = '결제 연결 확인 중';
  document.querySelector('#checkout-terms').hidden = true;
  const status = document.querySelector('#checkout-status');
  status.textContent = '결제 연결 상태를 확인하고 있습니다.';
  try {
    const response = await fetch('/api/payment-config', { cache: 'no-store' });
    if (!response.ok) throw new Error('unavailable');
    const config = await response.json();
    if (!config.available) {
      status.textContent = '현재는 판매 페이지 미리보기입니다. 결제선생 연동과 구매 후 이용 안내를 준비하고 있어, 아직 실제 결제는 진행되지 않습니다.';
      payButton.textContent = '결제 오픈 준비 중'; return;
    }
    const terms = new URL(config.termsUrl);
    if (terms.protocol !== 'https:' || config.price !== 9900) throw new Error('invalid');
    paymentUrl = true;
    document.querySelector('#delivery-description').textContent = config.deliveryDescription;
    document.querySelector('#terms-link').href = terms.href;
    document.querySelector('#checkout-terms').hidden = false;
    status.textContent = '이름과 휴대폰 번호를 입력해 주세요. 결제 확인 후 이 번호로 이름·인증코드·검사 링크를 보내드립니다.';
    payButton.textContent = '9,900원 결제하기 ↗';
  } catch {
    status.textContent = '결제 연결 상태를 확인할 수 없습니다. 잠시 후 다시 시도해 주세요. 결제는 진행되지 않았습니다.';
    payButton.textContent = '연결 확인 필요';
  } finally { loading = false; }
}
document.querySelectorAll('[data-checkout]').forEach(button => button.addEventListener('click', openCheckout));
document.querySelector('.dialog-close').addEventListener('click', () => checkout.close());
checkout.addEventListener('click', event => { if (event.target === checkout) { const box=checkout.getBoundingClientRect(); if(event.clientX<box.left || event.clientX>box.right || event.clientY<box.top || event.clientY>box.bottom) checkout.close(); } });
consent.addEventListener('change', () => { payButton.disabled = !consent.checked || !paymentUrl; });
payButton.addEventListener('click', async () => {
  if (!consent.checked || !paymentUrl) return;
  const form = document.querySelector('#buyer-form');
  if (!form.reportValidity()) return;
  payButton.disabled = true; payButton.textContent = '주문을 준비하고 있습니다';
  try {
    const response = await fetch('/api/create-premium-order', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({name:form.elements.name.value.trim(),phone:form.elements.phone.value,consent:true}) });
    if(!response.ok) throw new Error('order_failed');
    const order = await response.json(); const url = new URL(order.checkoutUrl);
    if(url.protocol !== 'https:') throw new Error('invalid_checkout');
    location.assign(url.href);
  } catch {
    document.querySelector('#checkout-status').textContent = '주문을 연결하지 못했습니다. 결제는 진행되지 않았습니다. 잠시 후 다시 시도해 주세요.';
    payButton.disabled=false; payButton.textContent='9,900원 결제 다시 시도 ↗';
  }
});
document.querySelector('#share').addEventListener('click', async () => {
  try {
    if (navigator.share) await navigator.share({ title: document.title, url: location.href });
    else { await navigator.clipboard.writeText(location.href); const toast = document.querySelector('#toast'); toast.textContent = '페이지 주소를 복사했어요.'; toast.classList.add('visible'); setTimeout(()=>toast.classList.remove('visible'),2500); }
  } catch(error) { if(error.name !== 'AbortError') { const toast=document.querySelector('#toast'); toast.textContent='브라우저 주소창에서 링크를 복사해 주세요.'; toast.classList.add('visible');setTimeout(()=>toast.classList.remove('visible'),3000); } }
});

// An interactive sample, never a personal score or health recommendation.
const missionExamples = [
  '식 · 나의 한 끼를 기록해 보기. 평소 먹는 식사부터 관찰하는 미션이에요.',
  '동 · 하루 동안 앉아 있는 시간을 살펴보기. 내 일상의 움직임을 발견해요.',
  '휴 · 일주일의 취침·기상시간 기록하기. 나만의 회복 리듬을 찾아요.',
  '심 · 하루 끝, 오늘의 기분을 한 단어로 적기. 내 마음의 패턴을 살펴봐요.',
  '환 · 나의 생활공간 둘러보기. 건강한 선택을 돕는 환경을 생각해 봐요.',
  '연 · 가까운 사람과 건강 목표 이야기하기. 함께할 수 있는 일을 찾아요.',
  '지 · 식품 포장지의 영양표시 읽어 보기. 생활 속 정보를 발견해요.',
  '락 · 이번 주 즐거웠던 활동 적어 보기. 내 일상을 채우는 즐거움을 찾아요.'
];
document.querySelectorAll('.areas article').forEach((card,index)=>{
  card.tabIndex=0;card.setAttribute('role','button');card.setAttribute('aria-pressed','false');
  const select=()=>{document.querySelectorAll('.areas article').forEach(other=>{other.classList.remove('selected');other.setAttribute('aria-pressed','false')});card.classList.add('selected');card.setAttribute('aria-pressed','true');document.querySelector('#mission-text').textContent=missionExamples[index];};
  card.addEventListener('click',select);card.addEventListener('keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();select()}});
});

// 건강보험심사평가원(HIRA) 질병정보서비스 — 질병성별연령별통계(getDissByGenderAgeStats1) 연동.
// 문서: OpenAPI활용가이드_건강보험심사평가원(질병정보서비스)_20241011, 서비스ID 15119055
//
// 이 오퍼레이션은 "상병코드 1개"를 넣으면 그 질병의 성별·10세 연령구간별 환자수를 돌려주는
// 방식이다 ("이 연령대에서 가장 흔한 병"을 한 번에 물어보는 API가 아님). 그래서 건강만다라가
// 다루는 대표 만성질환 후보를 미리 정해두고, 하나씩 조회해서 그중 해당 연령·성별 환자수가
// 가장 많은 질병을 채택하는 방식으로 구현한다.
const HIRA_OPERATION_URL = 'https://apis.data.go.kr/B551182/diseaseInfoService1/getDissByGenderAgeStats1';

// 대사증후군/생활습관병 계열 대표 질병(3단상병 코드, sickType=1로 통일).
const CANDIDATE_CHRONIC_DISEASE_CODES = ['E11', 'I10', 'E78', 'E66'];

// HIRA 응답이 실제로 데이터를 보유한 것으로 확인된 연도. 매년 갱신 여부를 확인해서 필요하면
// 올려줘야 한다 (2026-07 기준 2023년까지 확인됨).
const DEFAULT_YEAR = 2023;

// 예전 설계(원시 다빈도질병 리스트를 KCD 접두사로 필터링하는 방식)의 흔적 — 지금은 후보 자체를
// 만성질환 코드로만 구성해서 조회하므로 실질적으로는 항상 통과하지만, 안전망으로 남겨둔다.
const CHRONIC_DISEASE_KCD_PREFIXES = [
  'E10', 'E11', 'E12', 'E13', 'E14', // 당뇨병
  'I10', 'I11', 'I12', 'I13', 'I15', // 고혈압
  'E78', // 이상지질혈증(고지혈증)
  'E66', // 비만
  'K76.0', // 비알코올성 지방간
  'E88.81', // 대사증후군
];

function isChronicDiseaseCode(code) {
  if (!code) return false;
  return CHRONIC_DISEASE_KCD_PREFIXES.some((prefix) => code.startsWith(prefix));
}

// 만 나이를 HIRA 응답이 쓰는 10세 구간 형식으로 변환한다. 실제 응답 확인 결과 구분자는
// 물결(~)이 아니라 밑줄(_)이다 (예: "40_49세").
function ageToHiraBracket(age) {
  const n = parseInt(age, 10);
  if (!Number.isFinite(n) || n < 0) return null;
  const bracketStart = Math.floor(n / 10) * 10;
  return `${bracketStart}_${bracketStart + 9}세`;
}

function genderToHiraSex(gender) {
  return gender === 'f' ? '여' : '남';
}

// 별도 XML 파서 없이, 이 API의 단순한 <item>...</item> 반복 구조에서 필요한 필드만 뽑아낸다.
function parseHiraItems(xml) {
  if (!xml) return [];
  const itemBlocks = xml.match(/<item>[\s\S]*?<\/item>/g) || [];
  return itemBlocks.map((block) => {
    const pick = (tag) => {
      const m = block.match(new RegExp(`<${tag}>([\\s\\S]*?)</${tag}>`));
      return m ? m[1].trim() : '';
    };
    return {
      sickCd: pick('sickCd'),
      sickNm: pick('sickNm'),
      sex: pick('sex'),
      age: pick('age'),
      ptntCnt: parseInt(pick('ptntCnt'), 10) || 0,
    };
  });
}

// raw: [{ name, code, count }, ...] — count(환자수) 내림차순 정렬, 만성질환 코드만 남긴다.
function filterChronicDiseases(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((item) => item && isChronicDiseaseCode(item.code))
    .sort((a, b) => (b.count || 0) - (a.count || 0));
}

// 서비스키(HIRA_API_KEY)가 없거나 나이가 유효하지 않으면 조용히 null을 반환해
// 이 기능 전체가 비활성화된다 (리포트 생성 자체는 항상 영향받지 않음).
async function fetchAgeGroupDiseaseStats({ age, gender, apiKey, fetchImpl, year }) {
  if (!apiKey) return null;
  const bracket = ageToHiraBracket(age);
  if (!bracket) return null;

  const doFetch = fetchImpl || fetch;
  const sexLabel = genderToHiraSex(gender);
  const targetYear = year || DEFAULT_YEAR;

  const results = [];
  for (const code of CANDIDATE_CHRONIC_DISEASE_CODES) {
    try {
      const url = `${HIRA_OPERATION_URL}?serviceKey=${encodeURIComponent(apiKey)}&year=${targetYear}&sickCd=${code}&sickType=1&medTp=1&numOfRows=100&pageNo=1`;
      const response = await doFetch(url);
      const xml = await response.text();
      const items = parseHiraItems(xml);
      const match = items.find((item) => item.age === bracket && item.sex === sexLabel);
      if (match) {
        results.push({ name: match.sickNm, code: match.sickCd, count: match.ptntCnt });
      }
    } catch (err) {
      console.error(`HIRA age-group stats fetch failed for ${code}`, err);
    }
  }
  return results;
}

module.exports = {
  ageToHiraBracket,
  genderToHiraSex,
  parseHiraItems,
  filterChronicDiseases,
  fetchAgeGroupDiseaseStats,
  isChronicDiseaseCode,
  CHRONIC_DISEASE_KCD_PREFIXES,
  CANDIDATE_CHRONIC_DISEASE_CODES,
  HIRA_OPERATION_URL,
  DEFAULT_YEAR,
};

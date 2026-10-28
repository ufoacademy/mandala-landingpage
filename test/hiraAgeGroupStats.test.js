const test = require('node:test');
const assert = require('node:assert/strict');
const {
  ageToHiraBracket,
  genderToHiraSex,
  parseHiraItems,
  filterChronicDiseases,
  fetchAgeGroupDiseaseStats,
  CHRONIC_DISEASE_KCD_PREFIXES,
  CANDIDATE_CHRONIC_DISEASE_CODES,
} = require('../lib/hiraAgeGroupStats');

test('ageToHiraBracket buckets ages into 10-year brackets using underscore separator', () => {
  assert.equal(ageToHiraBracket('45'), '40_49세');
  assert.equal(ageToHiraBracket('40'), '40_49세');
  assert.equal(ageToHiraBracket('49'), '40_49세');
  assert.equal(ageToHiraBracket('9'), '0_9세');
  assert.equal(ageToHiraBracket('72'), '70_79세');
});

test('ageToHiraBracket returns null for missing or invalid age', () => {
  assert.equal(ageToHiraBracket(''), null);
  assert.equal(ageToHiraBracket(undefined), null);
  assert.equal(ageToHiraBracket('abc'), null);
  assert.equal(ageToHiraBracket('-5'), null);
});

test('genderToHiraSex maps app gender codes to HIRA sex labels', () => {
  assert.equal(genderToHiraSex('m'), '남');
  assert.equal(genderToHiraSex('f'), '여');
});

test('filterChronicDiseases keeps only codes matching the chronic-disease allowlist', () => {
  const raw = [
    { name: '급성 비인두염(감기)', code: 'J00', count: 500 },
    { name: '2형 당뇨병', code: 'E11', count: 300 },
    { name: '본태성(원발성) 고혈압', code: 'I10', count: 450 },
    { name: '치은염 및 치주질환', code: 'K05', count: 200 },
  ];
  const result = filterChronicDiseases(raw);
  const names = result.map((d) => d.name);
  assert.ok(names.includes('2형 당뇨병'));
  assert.ok(names.includes('본태성(원발성) 고혈압'));
  assert.ok(!names.includes('급성 비인두염(감기)'));
  assert.ok(!names.includes('치은염 및 치주질환'));
});

test('filterChronicDiseases sorts remaining items by count descending', () => {
  const raw = [
    { name: '2형 당뇨병', code: 'E11', count: 100 },
    { name: '본태성(원발성) 고혈압', code: 'I10', count: 450 },
  ];
  const result = filterChronicDiseases(raw);
  assert.equal(result[0].name, '본태성(원발성) 고혈압');
  assert.equal(result[1].name, '2형 당뇨병');
});

test('filterChronicDiseases returns empty array for empty or missing input', () => {
  assert.deepEqual(filterChronicDiseases([]), []);
  assert.deepEqual(filterChronicDiseases(null), []);
  assert.deepEqual(filterChronicDiseases(undefined), []);
});

test('CHRONIC_DISEASE_KCD_PREFIXES includes core metabolic/lifestyle disease codes', () => {
  assert.ok(CHRONIC_DISEASE_KCD_PREFIXES.some((p) => p.startsWith('E1')), 'should cover diabetes (E10-E14)');
  assert.ok(CHRONIC_DISEASE_KCD_PREFIXES.some((p) => p.startsWith('I1')), 'should cover hypertension (I10-I15)');
});

// Shape confirmed against a real getDissByGenderAgeStats1 response (year=2023, sickCd=E11).
const SAMPLE_HIRA_XML = `<?xml version="1.0" encoding="UTF-8"?>
<response>
  <header>
    <resultCode>00</resultCode>
    <resultMsg>NORMAL SERVICE.</resultMsg>
  </header>
  <body>
    <items>
      <item>
        <age>40_49세</age>
        <ptntCnt>123456</ptntCnt>
        <rvdInsupBrdnAmt>1000000</rvdInsupBrdnAmt>
        <rvdRpeTamtAmt>2000000</rvdRpeTamtAmt>
        <sex>남</sex>
        <sickCd>E11</sickCd>
        <sickNm>2형 당뇨병</sickNm>
        <specCnt>10</specCnt>
        <vstDdcnt>50000</vstDdcnt>
      </item>
      <item>
        <age>40_49세</age>
        <ptntCnt>98765</ptntCnt>
        <rvdInsupBrdnAmt>900000</rvdInsupBrdnAmt>
        <rvdRpeTamtAmt>1800000</rvdRpeTamtAmt>
        <sex>여</sex>
        <sickCd>E11</sickCd>
        <sickNm>2형 당뇨병</sickNm>
        <specCnt>9</specCnt>
        <vstDdcnt>40000</vstDdcnt>
      </item>
      <item>
        <age>50_59세</age>
        <ptntCnt>200000</ptntCnt>
        <rvdInsupBrdnAmt>1500000</rvdInsupBrdnAmt>
        <rvdRpeTamtAmt>3000000</rvdRpeTamtAmt>
        <sex>남</sex>
        <sickCd>E11</sickCd>
        <sickNm>2형 당뇨병</sickNm>
        <specCnt>12</specCnt>
        <vstDdcnt>60000</vstDdcnt>
      </item>
    </items>
  </body>
</response>`;

test('parseHiraItems extracts age/sex/sickNm/ptntCnt from each <item> block', () => {
  const items = parseHiraItems(SAMPLE_HIRA_XML);
  assert.equal(items.length, 3);
  assert.deepEqual(items[0], {
    sickCd: 'E11',
    sickNm: '2형 당뇨병',
    sex: '남',
    age: '40_49세',
    ptntCnt: 123456,
  });
});

test('parseHiraItems returns empty array for empty or malformed input', () => {
  assert.deepEqual(parseHiraItems(''), []);
  assert.deepEqual(parseHiraItems(null), []);
  assert.deepEqual(parseHiraItems('<response><body><items></items></body></response>'), []);
});

test('fetchAgeGroupDiseaseStats returns null when apiKey is not configured', async () => {
  const result = await fetchAgeGroupDiseaseStats({ age: '45', gender: 'm', apiKey: null });
  assert.equal(result, null);
});

test('fetchAgeGroupDiseaseStats returns null when age is missing or invalid (even with apiKey)', async () => {
  const result = await fetchAgeGroupDiseaseStats({ age: '', gender: 'm', apiKey: 'fake-key' });
  assert.equal(result, null);
});

test('fetchAgeGroupDiseaseStats queries each candidate disease code and matches on age bracket + sex', async () => {
  const calledUrls = [];
  const fetchImpl = async (url) => {
    calledUrls.push(url);
    return { text: async () => SAMPLE_HIRA_XML };
  };
  const result = await fetchAgeGroupDiseaseStats({
    age: '45',
    gender: 'm',
    apiKey: 'fake-key',
    fetchImpl,
    year: 2023,
  });

  assert.equal(calledUrls.length, CANDIDATE_CHRONIC_DISEASE_CODES.length);
  assert.ok(calledUrls[0].includes('serviceKey=fake-key'));
  assert.ok(calledUrls[0].includes('year=2023'));
  assert.ok(calledUrls[0].includes(`sickCd=${CANDIDATE_CHRONIC_DISEASE_CODES[0]}`));

  // Every candidate code queried against the same mocked XML matches 40_49세/남, so each
  // yields one result (all using the sample's E11 data since the mock ignores sickCd).
  assert.equal(result.length, CANDIDATE_CHRONIC_DISEASE_CODES.length);
  assert.equal(result[0].name, '2형 당뇨병');
  assert.equal(result[0].count, 123456);
});

test('fetchAgeGroupDiseaseStats omits candidates with no matching age/sex row', async () => {
  const fetchImpl = async () => ({ text: async () => SAMPLE_HIRA_XML });
  // 20대 남 has no matching <item> in the sample data.
  const result = await fetchAgeGroupDiseaseStats({
    age: '25',
    gender: 'm',
    apiKey: 'fake-key',
    fetchImpl,
  });
  assert.deepEqual(result, []);
});

test('fetchAgeGroupDiseaseStats skips a candidate whose fetch throws and still returns the rest', async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    if (callCount === 1) throw new Error('network error');
    return { text: async () => SAMPLE_HIRA_XML };
  };
  const result = await fetchAgeGroupDiseaseStats({
    age: '45',
    gender: 'm',
    apiKey: 'fake-key',
    fetchImpl,
  });
  assert.equal(callCount, CANDIDATE_CHRONIC_DISEASE_CODES.length);
  assert.equal(result.length, CANDIDATE_CHRONIC_DISEASE_CODES.length - 1);
});

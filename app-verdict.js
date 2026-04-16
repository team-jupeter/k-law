/* ══════════════════════════════════════════════════════
   app-verdict.js  —  판결 생성 (K-Law 방법론 v6.4)
   수정 시 이 파일만 편집하면 됩니다.
══════════════════════════════════════════════════════ */

/* ── DeepSeek 내장 키 (DeepSeek 선택 시에만 사용) ─── */
const DS_KEY = 'sk-c2483c15cfc0410aa6865f1efde83730';

/* ── 시스템 프롬프트 ─────────────────────────────────── */
function buildSys() {
  return `당신은 K-Law 방법론 v6.4를 따르는 AI 법률 분석관입니다.

[STEP A: 피고 승소 논거 (역방향 추론)]
- 피고 입장에서 가장 강력한 법리적 논거를 300자 이상 작성하세요.
- 최소 1개 이상의 판례(또는 일반 법원칙)를 인용하고 출처를 명시하세요.
- 마지막 줄에 [STEP-A-COMPLETE] 를 출력하세요.

[STEP B: 판결문 (6단계 사고 순서)]
1. 법률관계 확정 및 특별법 확인
2. 쟁점 계층적 분해 (예/아니오 질문)
3. 원고와 피고의 삼단논법 구성
4. 인과관계 분석 및 가치 형량
5. 손해액 산정 및 책임 제한 (과실상계, 공평의 원칙)
6. 메타인지 자가 점검

이 단계가 끝나면 반드시 다음 JSON 형식으로 판결 결과를 출력하세요:
{
  "ruling": "원고 승소|원고 일부 승소|피고 승소|유죄|무죄",
  "key_legal_theory": "핵심 법리 2~3문장",
  "reasoning": "세부 논증 5~10문장",
  "legal_basis": ["적용 법조문1", "법조문2"],
  "ruling_text": "주문 내용",
  "verdict_summary": "판결 요지 3문장"
}
마지막 줄에 [STEP-B-COMPLETE] 를 출력하세요.

[STEP C: 정합성 검증]
Q1: 판결문의 논리가 STEP A의 판례/원칙과 일관되는가? (true/false, 불일치 시 사유 설명)
Q2: 판결문이 STEP A의 피고 승소 논거를 법리적으로 완전히 반박하였는가?
Q3: 유사 사건과 현저히 차이가 나는가? (차이 있다면 이유)
마지막 줄에 [STEP-C-COMPLETE] 를 출력하세요.`;
}

/* ── 사용자 프롬프트 ─────────────────────────────────── */
function buildUser() {
  return `아래 사건을 K-Law 방법론 v6.4에 따라 분석하고 가상 판결을 생성하세요.

[사건 분류] ${g('caseType').value || '미분류'}
[원고] ${g('plaintiff').value}
[피고] ${g('defendant').value}
[청구 금액] ${g('claimAmount').value || '명시되지 않음'}

[사건 개요]
${g('facts').value}

[원고 주장]
${g('plaintiffClaim').value || '없음'}

[피고 주장]
${g('defendantClaim').value || '없음'}

[다툼 없는 사실]
${g('undisputedFacts').value || '없음'}

STEP A, B, C를 순서대로 수행하고 최종 판결 JSON을 포함시켜 주세요.`;
}

/* ── JSON 추출 ───────────────────────────────────────── */
function extractJSON(str) {
  let cleaned = str.replace(/```json\s*|\s*```/g, '');
  let start = cleaned.lastIndexOf('{');
  if (start === -1) return null;
  let braceCount = 0, end = start;
  for (let i = start; i < cleaned.length; i++) {
    if (cleaned[i] === '{') braceCount++;
    else if (cleaned[i] === '}') braceCount--;
    if (braceCount === 0) { end = i; break; }
  }
  try { return JSON.parse(cleaned.slice(start, end + 1)); }
  catch(e) { return null; }
}

/* ── 판결 생성 메인 ─────────────────────────────────── */
async function runGenerate() {
  const steps = [
    { msg:'STEP A: 피고 승소 논거 구성 중... (역방향 추론)', progress:10 },
    { msg:'STEP B-1: 법률관계 확정 및 특별법 확인 중...',    progress:25 },
    { msg:'STEP B-2: 쟁점 계층적 분해 중...',               progress:35 },
    { msg:'STEP B-3: 삼단논법 구성 중...',                  progress:45 },
    { msg:'STEP B-4: 인과관계 분석 및 가치 형량 중...',     progress:60 },
    { msg:'STEP B-5: 손해액 산정 및 책임 제한 중...',       progress:75 },
    { msg:'STEP B-6: 메타인지 자가 점검 중...',             progress:85 },
    { msg:'STEP C: 정합성 검증 중...',                      progress:95 },
  ];
  let si = 0;
  const iv = setInterval(() => {
    if (si < steps.length) {
      g('progLbl').textContent   = steps[si].msg;
      g('progFill').style.width  = steps[si].progress + '%';
      si++;
    } else { clearInterval(iv); }
  }, 2000);

  g('btnGenerate').disabled = true;
  g('btnReGen').style.display  = 'none';
  g('progWrap').style.display  = 'block';
  g('errorArea').style.display = 'none';
  g('verdictCard').style.display = 'none';
  g('thinkingPanel').textContent  = '';
  g('rawOutputPanel').textContent = '';
  setProgress(0, '연결 중...');

  const key = getApiKey();
  if (!key) {
    clearInterval(iv);
    g('btnGenerate').disabled = false;
    g('progWrap').style.display = 'none';
    return;
  }

  let fullThink = '', fullOut = '';

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + key },
      body: JSON.stringify({
        model: 'deepseek-reasoner',
        messages: [
          { role:'system', content:buildSys() },
          { role:'user',   content:buildUser() }
        ],
        stream: true,
        temperature: 0,       /* 결정적 출력 — 동일 사건 = 동일 판결 */
        max_tokens: 8000
        /* seed: 42 */        /* DeepSeek 지원 시 주석 해제 */
      })
    });
    if (!res.ok) throw new Error('API 오류: ' + res.status);

    const reader  = res.body.getReader();
    const decoder = new TextDecoder();

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      for (const line of decoder.decode(value).split('\n')) {
        if (!line.startsWith('data: ')) continue;
        const raw = line.slice(6).trim();
        if (raw === '[DONE]') continue;
        try {
          const delta = JSON.parse(raw).choices?.[0]?.delta;
          if (delta?.reasoning_content) {
            fullThink += delta.reasoning_content;
            g('thinkingPanel').textContent = fullThink;
            g('thinkingPanel').scrollTop   = 99999;
          }
          if (delta?.content) {
            fullOut += delta.content;
            g('rawOutputPanel').textContent = fullOut;
            g('rawOutputPanel').scrollTop   = 99999;
          }
        } catch(_) {}
      }
    }

    clearInterval(iv);
    g('progFill').style.width = '100%';
    g('progLbl').textContent  = '분석 완료! 결과 정리 중...';

    const jsonObj = extractJSON(fullOut);
    if (jsonObj && jsonObj.ruling) {
      renderVerdict(jsonObj);
      showExplanation(jsonObj);   /* app-explanation.js */
    } else {
      renderFallback(fullOut);
    }
  } catch(e) {
    clearInterval(iv);
    g('errorArea').style.display  = 'block';
    g('errorArea').textContent    = '오류: ' + e.message + ' — 잠시 후 다시 시도해주세요.';
  } finally {
    g('btnGenerate').disabled      = false;
    g('btnGenerate').style.display = 'none';
    g('btnReGen').style.display    = '';
    g('progWrap').style.display    = 'none';
  }
}

/* ── 판결 렌더링 ─────────────────────────────────────── */
function renderVerdict(v) {
  const basis = Array.isArray(v.legal_basis)
    ? v.legal_basis.join(', ')
    : (v.legal_basis || '—');
  g('verdictBody').innerHTML =
    vrRow('판결 방향',   `<span class="ruling-chip">${esc(v.ruling)}</span>`) +
    vrRow('핵심 법리',   esc(v.key_legal_theory)) +
    vrRow('세부 논증',   esc(v.reasoning)) +
    vrRow('적용 법조문', esc(basis)) +
    vrRow('주문',         esc(v.ruling_text)) +
    vrRow('판결 요지',   esc(v.verdict_summary));
  g('verdictCard').style.display = 'block';
}

function renderFallback(raw) {
  g('verdictBody').innerHTML =
    `<div class="notice notice-warn" style="margin:0 0 12px;">JSON 구조를 추출하지 못했습니다. 원문 출력 패널에서 전체 응답을 확인하세요.</div>`
    + vrRow('원문 (마지막 1500자)',
        `<pre style="white-space:pre-wrap;font-size:12px;line-height:1.6;">${esc(raw.slice(-1500))}</pre>`);
  g('verdictCard').style.display = 'block';
}

function vrRow(k, vHtml) {
  return `<div class="vr-row"><div class="vr-key">${k}</div><div class="vr-val">${vHtml}</div></div>`;
}

function setProgress(val, lbl) {
  g('progFill').style.width = val + '%';
  g('progLbl').textContent  = lbl;
}

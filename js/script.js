// ── 상수 및 상태 ──
const DS_KEY = 'sk-c2483c15cfc0410aa6865f1efde83730';
const LLMS = {
  deepseek: { name:'DeepSeek R1', maker:'DeepSeek AI', logo:'D', cls:'lc-deepseek', model:'deepseek-reasoner', ep:'https://api.deepseek.com/chat/completions', needKey:false },
  gpt:      { name:'GPT-4o',      maker:'OpenAI',      logo:'G', cls:'lc-gpt',      model:'gpt-4o',          ep:'https://api.openai.com/v1/chat/completions',     needKey:true  },
};
let sel = 'deepseek', userKey = null;
let caseId = '', caseData = {}, extraAnswers = {}, dynamicQuestions = [];
let parsed = null;

const $ = id => document.getElementById(id);
function toast(msg) {
  const s = $('#snackbar');
  s.textContent = msg;
  s.style.opacity = '1';
  setTimeout(() => s.style.opacity = '0', 3000);
}
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function genId() { return `KL-${new Date().getFullYear()}-${Math.floor(Math.random() * 90000 + 10000)}`; }

// ── 단계 표시 ──
const STEPS = ['1', '2', '25', '3', '4', '5'];
const STEP_LABELS = { '1':'사건입력', '2':'문서생성', '25':'추가정보', '3':'AI분석', '4':'판결확인', '5':'최종판결' };

function renderStepIndicator() {
  const container = $('#stepList');
  if (!container) return;
  container.innerHTML = STEPS.map((s, i) => `
    <div style="display:flex; align-items:center;">
      <div class="step-node" id="sn-${s}">
        <div class="step-circle">${i + 1}</div>
        <div class="step-label">${STEP_LABELS[s]}</div>
      </div>
      ${i < STEPS.length - 1 ? `<div class="step-connector" id="sc-${s}"></div>` : ''}
    </div>
  `).join('');
}
renderStepIndicator();

function updateSteps(cur) {
  const idx = STEPS.indexOf(String(cur));
  STEPS.forEach((s, i) => {
    const node = $(`sn-${s}`);
    if (node) {
      node.classList.remove('active', 'done');
      if (i < idx) node.classList.add('done');
      else if (i === idx) node.classList.add('active');
    }
    const conn = $(`sc-${s}`);
    if (conn) {
      conn.classList.remove('done');
      if (i < idx) conn.classList.add('done');
    }
  });
}

function goSec(n) {
  document.querySelectorAll('.card').forEach(c => c.classList.remove('visible'));
  const el = $(`sec${n}`);
  if (el) el.classList.add('visible');
  if (n !== 0 && n !== '0') updateSteps(String(n));
  if (n === 5 || n === '5') renderVerdict();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ── 모드 및 LLM 선택 ──
function selectMode(m) {
  $('#card-single').classList.toggle('selected', m === 'single');
}
function selectLLM(id) {
  sel = id;
  document.querySelectorAll('.llm-tile').forEach(t => t.classList.toggle('selected', t.id === `opt-${id}`));
  const llm = LLMS[id];
  const panel = $('#apiKeySection');
  $('#apiKeyLlmName').innerText = llm.name;
  panel.style.display = llm.needKey ? 'block' : 'none';
  if (!llm.needKey) userKey = null;
}

function confirmMode() {
  console.log("confirmMode 실행됨");
  const llm = LLMS[sel];
  if (!llm) { toast("LLM 선택 오류"); return; }
  if (llm.needKey) {
    const keyInput = $('#userApiKey');
    if (!keyInput) { toast("API Key 입력 필드 없음"); return; }
    const v = keyInput.value.trim();
    if (!v) { toast('API Key를 입력하세요'); return; }
    userKey = v;
  }

  // 안전하게 요소 확인
  const configBar = $('#configBar');
  if (configBar) {
    configBar.style.display = 'flex';
    configBar.innerHTML = `
      <div class="config-item">모드: 단일 LLM</div>
      <div class="config-item">모델: ${llm.name}</div>
      <div class="config-item">방법론: K-Law v6.4</div>
    `;
  } else {
    console.warn("configBar 요소 없음");
  }

  const stepIndicator = $('#stepIndicator');
  if (stepIndicator) stepIndicator.style.display = 'block';
  
  const aLogo = $('#aLogo');
  if (aLogo) aLogo.innerText = llm.logo;
  
  const aTitle = $('#aTitle');
  if (aTitle) aTitle.innerText = llm.name;
  
  const sec3Title = $('#sec3-title');
  if (sec3Title) sec3Title.innerText = `${llm.name} 법리 분석 (K-Law v6.4)`;
  
  goSec(1);
}

// LLM 그리드 생성
const llmGrid = $('#llmGrid');
llmGrid.innerHTML = Object.keys(LLMS).map(k => `
  <div class="llm-tile ${k === 'deepseek' ? 'selected' : ''}" id="opt-${k}" onclick="selectLLM('${k}')">
    <div class="llm-logo ${LLMS[k].cls}">${LLMS[k].logo}</div>
    <div class="llm-tile-name">${LLMS[k].name}</div>
    <div class="llm-tile-maker">${LLMS[k].maker}</div>
  </div>
`).join('');

// ── AI 자동 추출 ──
async function extractFromFacts() {
  const facts = $('#facts').value.trim();
  if (facts.length < 20) { toast('사건 개요를 20자 이상 입력하세요'); return; }
  const btn = $('#btnExtract');
  const statusEl = $('#extractStatus');
  btn.disabled = true;
  btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> 추출 중...`;
  statusEl.style.display = 'block';
  statusEl.style.background = 'var(--primary-light)';
  statusEl.style.color = 'var(--primary)';
  statusEl.innerText = 'AI 분석 중...';

  const sys = `당신은 법률 문서 분석 전문가입니다. 사건 개요에서 다음 7가지 정보를 추출하여 JSON만 출력하세요:
{
  "caseType": "코드",
  "claimAmount": "금액",
  "plaintiff": "원고명",
  "defendant": "피고명",
  "plaintiffClaim": "원고의 주장 요약",
  "defendantClaim": "피고의 주장 요약",
  "undisputedFacts": "다툼 없는 사실 요약"
}
caseType 코드: civil_damage, civil_traffic, civil_medical, civil_contract, civil_lease, civil_insurance, family_divorce, family_custody, family_inherit, criminal_fraud, criminal_embezzle, criminal_assault, admin_cancel, admin_compensation`;

  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DS_KEY}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: sys }, { role: 'user', content: facts }], temperature: 0.1, max_tokens: 800 })
    });
    if (!res.ok) throw new Error('API 오류');
    const data = await res.json();
    const content = data.choices[0].message.content;
    const match = content.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('JSON 추출 실패');
    const ex = JSON.parse(match[0]);
    const valid = ['civil_damage','civil_traffic','civil_medical','civil_contract','civil_lease','civil_insurance','family_divorce','family_custody','family_inherit','criminal_fraud','criminal_embezzle','criminal_assault','admin_cancel','admin_compensation'];
    let filled = [];
    if (ex.caseType && valid.includes(ex.caseType)) { $('#caseType').value = ex.caseType; $('#caseTypeAiBadge').style.display = 'inline-block'; filled.push('사건분류'); }
    if (ex.claimAmount) { $('#claimAmount').value = ex.claimAmount; $('#claimAmountAiBadge').style.display = 'inline-block'; filled.push('청구금액'); }
    if (ex.plaintiff) { $('#plaintiff').value = ex.plaintiff; $('#plaintiffAiBadge').style.display = 'inline-block'; filled.push('원고'); }
    if (ex.defendant) { $('#defendant').value = ex.defendant; $('#defendantAiBadge').style.display = 'inline-block'; filled.push('피고'); }
    if (ex.undisputedFacts) { $('#undisputedFacts').value = ex.undisputedFacts; $('#undisputedAiBadge').style.display = 'inline-block'; filled.push('다툼없는사실'); }
    if (ex.plaintiffClaim) { $('#plaintiffClaim').value = ex.plaintiffClaim; $('#plaintiffClaimAiBadge').style.display = 'inline-block'; filled.push('원고주장'); }
    if (ex.defendantClaim) { $('#defendantClaim').value = ex.defendantClaim; $('#defendantClaimAiBadge').style.display = 'inline-block'; filled.push('피고주장'); }
    statusEl.style.background = 'var(--success-light)';
    statusEl.style.color = 'var(--success)';
    statusEl.innerText = `✓ 추출 완료: ${filled.join(' · ')} — 필요 시 직접 수정 가능합니다.`;
  } catch (e) {
    statusEl.style.background = 'var(--error-light)';
    statusEl.style.color = 'var(--error)';
    statusEl.innerText = `오류: ${e.message}`;
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="3" width="20" height="14" rx="2"/><path d="M8 21h8M12 17v4"/></svg> AI 자동 추출`;
  }
}

// ── 문서 생성 ──
function toSec2() {
  const ct = $('#caseType').value, pl = $('#plaintiff').value.trim(), df = $('#defendant').value.trim();
  const fc = $('#facts').value.trim(), pc = $('#plaintiffClaim').value.trim(), dc = $('#defendantClaim').value.trim();
  if (!ct || !pl || !df || !fc || !pc || !dc) {
    toast('필수 항목을 모두 입력하세요 (사건 분류/원고/피고/원고주장/피고주장)');
    return;
  }
  caseId = genId();
  $('#caseChip').innerText = `사건번호 ${caseId}`;
  $('#caseChip').style.display = 'block';
  caseData = {
    caseType: ct, plaintiff: pl, defendant: df, facts: fc,
    plaintiffClaim: pc, defendantClaim: dc,
    undisputedFacts: $('#undisputedFacts').value.trim(),
    caseId, claimAmount: $('#claimAmount').value
  };
  renderDoc();
  goSec(2);
}

function renderDoc() {
  const d = caseData;
  const label = { civil_damage:'손해배상(불법행위)', civil_traffic:'손해배상(교통사고)', civil_medical:'손해배상(의료)', civil_contract:'계약위반', civil_lease:'임대차', civil_insurance:'보험', family_divorce:'이혼·위자료', family_custody:'친권·양육권', family_inherit:'상속', criminal_fraud:'사기', criminal_embezzle:'횡령·배임', criminal_assault:'폭행·상해', admin_cancel:'행정처분 취소', admin_compensation:'국가배상' }[d.caseType] || d.caseType;
  const llm = LLMS[sel];
  $('#mandatoryDoc').innerText = `═══ K-LAW MANDATORY EXECUTE v6.4 ═══

[사건번호] ${d.caseId}
[사건분류] ${label}
[청구금액] ${d.claimAmount || '미기재'}
[분석 LLM] ${llm.name}

── 당사자 ──
원고: ${d.plaintiff}
피고: ${d.defendant}

── 다툼 없는 사실 ──
${d.undisputedFacts || '(없음)'}

── 사건 개요 ──
${d.facts}

── 원고 주장 ──
${d.plaintiffClaim}

── 피고 주장 ──
${d.defendantClaim}
═══ END ═══`;
}

// ── 추가 정보 요청 ──
async function toSec25() {
  const btn = $('#btnToSec25');
  btn.disabled = true;
  btn.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/></svg> 생성 중...`;
  const mandatory = $('#mandatoryDoc').innerText;
  const sys = `You are K-Law AI. Based on the mandatory document, generate up to 5 additional information questions (JSON array) with fields: id, text, priority("required"/"important"/"optional"), hint. Output only JSON array.`;
  try {
    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${DS_KEY}` },
      body: JSON.stringify({ model: 'deepseek-chat', messages: [{ role: 'system', content: sys }, { role: 'user', content: mandatory }], temperature: 0.3, max_tokens: 1000 })
    });
    const data = await res.json();
    const content = data.choices[0].message.content;
    const match = content.match(/\[[\s\S]*\]/);
    if (match) dynamicQuestions = JSON.parse(match[0]).slice(0, 5);
    else throw new Error('no json');
  } catch (e) {
    dynamicQuestions = [
      { id: 'q1', text: '추가 증거 자료가 있습니까?', priority: 'required', hint: '계약서, 영수증, 사진, 증인 등' },
      { id: 'q2', text: '합의 시도가 있었습니까?', priority: 'optional', hint: '협상 경위 및 결과' }
    ];
  }
  renderQuestions();
  goSec('25');
  btn.disabled = false;
  btn.innerHTML = `AI 추가 정보 요청 <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`;
}

function renderQuestions() {
  $('#dynamicInfoBanner').style.display = 'flex';
  const req = dynamicQuestions.filter(q => q.priority === 'required').length;
  const imp = dynamicQuestions.filter(q => q.priority === 'important').length;
  const opt = dynamicQuestions.filter(q => q.priority === 'optional').length;
  $('#qTotal').innerText = dynamicQuestions.length;
  $('#reqCnt').innerText = req;
  $('#impCnt').innerText = imp;
  $('#optCnt').innerText = opt;
  $('#questionList').innerHTML = dynamicQuestions.map((q, i) => `
    <div class="question-item">
      <div class="q-meta">
        <div class="q-index">${i + 1}</div>
        <span class="priority-chip ${q.priority === 'required' ? 'req' : q.priority === 'important' ? 'imp' : 'opt'}">${q.priority === 'required' ? '필수' : q.priority === 'important' ? '중요' : '선택'}</span>
      </div>
      <div class="q-text">${q.text}</div>
      <div class="q-hint">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        ${q.hint}
      </div>
      <textarea class="field" id="ans-${q.id}" rows="2" oninput="onAns('${q.id}')"></textarea>
      <div class="ans-status" id="st-${q.id}">— 미입력</div>
    </div>
  `).join('');
}

function onAns(id) {
  const v = $(`ans-${id}`).value.trim();
  extraAnswers[id] = v;
  const st = $(`st-${id}`);
  st.innerText = v ? '✓ 답변됨' : '— 미입력';
  st.style.color = v ? 'var(--success)' : '';
}

function skipQ() { runAnalysis(); }

async function submitQ() {
  const unans = dynamicQuestions.filter(q => q.priority === 'required' && !extraAnswers[q.id]?.trim());
  if (unans.length) { toast(`필수 질문 ${unans.length}개에 답변하세요`); return; }
  toast('답변 반영 후 분석 시작');
  await sleep(500);
  runAnalysis();
}

// ── K-Law 분석 ──
async function runAnalysis() {
  goSec(3);
  await sleep(200);
  const status = $('#aStatus'), prog = $('#aProg'), thinking = $('#aThinking'), result = $('#aResult'), err = $('#errBanner');
  status.innerText = 'K-Law 방법론 v6.4 적용 중...';
  prog.style.width = '5%';
  thinking.style.display = 'none';
  result.style.display = 'none';
  err.style.display = 'none';
  $('#sec3Btn').style.display = 'none';

  const extra = dynamicQuestions.filter(q => extraAnswers[q.id]?.trim()).map(q => `Q: ${q.text}\nA: ${extraAnswers[q.id]}`).join('\n\n');
  const mandatory = $('#mandatoryDoc').innerText;
  const sysPrompt = `You are K-Law AI. Follow the K-Law v6.4 mandatory steps exactly.
STEP A (피고 승소 논거): Write at least 300 characters defending the defendant, cite at least one precedent or general principle. End with [STEP-A-COMPLETE].
STEP B (판결문): Perform in order: 1) legal relationship, 2) issue decomposition, 3) syllogism for both parties, 4) causal analysis and value balancing, 5) damage calculation, 6) metacognition self-check. Then output JSON: {"ruling":"원고 승소|피고 승소|일부승소","key_legal_theory":"...","reasoning":"...","legal_basis":["..."],"ruling_text":"...","verdict_summary":"..."}. End with [STEP-B-COMPLETE].
STEP C (consistency check): Answer three questions. End with [STEP-C-COMPLETE].`;
  const userMsg = `${mandatory}\n\n추가 정보:\n${extra}`;

  try {
    const llm = LLMS[sel];
    const apiKey = llm.needKey ? userKey : DS_KEY;
    const res = await fetch(llm.ep, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
      body: JSON.stringify({ model: llm.model, messages: [{ role: 'system', content: sysPrompt }, { role: 'user', content: userMsg }], stream: true, temperature: 0.2, max_tokens: 8000 })
    });
    if (!res.ok) throw new Error(`API ${res.status}`);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let full = '', pct = 20;
    thinking.style.display = 'block';
    thinking.innerText = '추론 진행 중...\n';
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(l => l.startsWith('data: '));
      for (const line of lines) {
        const data = line.slice(6).trim();
        if (data === '[DONE]') continue;
        try {
          const j = JSON.parse(data);
          const delta = j.choices?.[0]?.delta;
          if (delta?.reasoning_content) { thinking.innerText += delta.reasoning_content; thinking.scrollTop = thinking.scrollHeight; }
          if (delta?.content) { full += delta.content; if (pct < 90) { pct += 0.5; prog.style.width = pct + '%'; status.innerText = `생성 중... (${full.length}자)`; } }
        } catch (e) { /* ignore parse errors */ }
      }
    }
    prog.style.width = '100%';
    status.style.color = 'var(--success)';
    status.innerText = '✓ 분석 완료';
    const jsonMatch = full.match(/\{[\s\S]*"ruling"[\s\S]*\}/);
    if (jsonMatch) {
      try { parsed = JSON.parse(jsonMatch[0]); }
      catch (e) { throw new Error('JSON 파싱 실패: ' + e.message); }
    } else {
      throw new Error('JSON 미추출');
    }
    result.style.display = 'block';
    result.innerHTML = `<strong>판결:</strong> ${parsed.ruling}<br><strong>법리:</strong> ${parsed.key_legal_theory}`;
    $('#sec3Btn').style.display = 'flex';
    renderSec4();
    if (llm.needKey) { userKey = null; $('#userApiKey').value = ''; toast('API Key 삭제됨'); }
  } catch (e) {
    status.innerText = '오류 발생';
    status.style.color = 'var(--error)';
    err.style.display = 'block';
    $('#errMsg').innerText = e.message;
  }
}

function renderSec4() {
  const r = parsed || { ruling:'-', key_legal_theory:'-', reasoning:'-', legal_basis:[], ruling_text:'-', verdict_summary:'-' };
  $('#sec4Content').innerHTML = `
    <div class="ruling-chip">${r.ruling}</div>
    <div><strong>핵심 법리</strong><p>${r.key_legal_theory}</p></div>
    <div><strong>세부 논증</strong><p>${r.reasoning}</p></div>
    <div><strong>법조문</strong><p>${(r.legal_basis || []).join(', ')}</p></div>
    <div><strong>판결 요지</strong><p>${r.verdict_summary}</p></div>
  `;
}

function renderVerdict() {
  const d = caseData, r = parsed || {};
  const label = { civil_damage:'손해배상(불법행위)', civil_traffic:'손해배상(교통사고)', civil_medical:'손해배상(의료)', civil_contract:'계약위반', civil_lease:'임대차', civil_insurance:'보험', family_divorce:'이혼·위자료', family_custody:'친권·양육권', family_inherit:'상속', criminal_fraud:'사기', criminal_embezzle:'횡령·배임', criminal_assault:'폭행·상해', admin_cancel:'행정처분 취소', admin_compensation:'국가배상' }[d.caseType] || d.caseType;
  const extraCount = dynamicQuestions.filter(q => extraAnswers[q.id]?.trim()).length;
  $('#verdictDoc').innerHTML = `
    <div class="verdict-doc">
      <div class="verdict-doc-header">
        <h2>K-Law AI 가상 판결문</h2>
        <div>사건번호 ${d.caseId}</div>
        <div>${label}</div>
      </div>
      <div class="verdict-doc-body">
        <div class="verdict-section-title">당사자</div>
        <p>원고 ${d.plaintiff}<br>피고 ${d.defendant}</p>
        <div class="verdict-section-title">다툼 없는 사실</div>
        <p>${d.undisputedFacts || '-'}</p>
        <div class="verdict-section-title">법리 판단</div>
        <p>${r.key_legal_theory || '-'}</p>
        <div class="verdict-section-title">논증</div>
        <p>${r.reasoning || '-'}</p>
        <div class="verdict-ruling-box">
          <h3>주문</h3>
          <p>${r.ruling_text || r.ruling || '-'}</p>
        </div>
        <div class="verdict-chips">${extraCount > 0 ? `<span>추가정보 ${extraCount}건 반영</span>` : ''}</div>
      </div>
    </div>
    <div class="disclaimer-box">※ 본 판결은 AI 생성 가상 판결로 법적 효력이 없습니다. 실제 법률 문제는 변호사와 상담하시기 바랍니다.</div>
  `;
}

function dlVerdict() {
  renderVerdict();
  const txt = $('#verdictDoc').innerText;
  const blob = new Blob([txt], { type: 'text/plain;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `K-Law_${caseData.caseId}.txt`;
  a.click();
  URL.revokeObjectURL(a.href);
  toast('판결문 다운로드');
}

function resetAll() { location.reload(); }

$('#facts').addEventListener('input', function () {
  const len = this.value.length;
  $('#factsCount').innerText = len;
  if (len > 2000) this.value = this.value.slice(0, 2000);
});

window.confirmMode = confirmMode;
window.selectMode = selectMode;
window.selectLLM = selectLLM;
window.toSec2 = toSec2;
window.goSec = goSec;
window.extractFromFacts = extractFromFacts;
window.toSec25 = toSec25;
window.skipQ = skipQ;
window.submitQ = submitQ;
window.dlVerdict = dlVerdict;
window.resetAll = resetAll;

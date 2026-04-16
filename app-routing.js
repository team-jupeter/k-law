/* ══════════════════════════════════════════════════════
   app-routing.js  —  페이지 라우팅 · 재판부/모델 선택
   수정 시 이 파일만 편집하면 됩니다.
══════════════════════════════════════════════════════ */

/* ── 공용 유틸 ──────────────────────────────────────── */
function g(id)  { return document.getElementById(id); }
function esc(s) {
  return String(s||'').replace(/[&<>]/g, m => ({'&':'&amp;','<':'&lt;','>':'&gt;'}[m]));
}

/* ── 페이지 전환 ─────────────────────────────────────── */
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  g('page-' + id).classList.add('active');
  const lbl = { index:'재판부 선택', bench:'사건 입력', verdict:'판결 생성' };
  const bc = g('breadcrumb');
  bc.innerHTML = id === 'index'
    ? '<span class="bc-link" onclick="showPage(\'index\')">홈</span>'
    : '<span class="bc-link" onclick="showPage(\'index\')">홈</span>'
      + '<span class="bc-sep">›</span>'
      + '<span class="bc-curr">' + lbl[id] + '</span>';
  window.scrollTo({ top:0, behavior:'smooth' });
}

/* ── 재판부 선택 ─────────────────────────────────────── */
function selectTrial(type) {
  ['single','panel','supreme'].forEach(t => {
    const card = g('card-' + t);
    if (card) card.classList.toggle('selected', t === type);
  });
  window._selectedTrial = type;
}

/* ── AI 모델 선택 → API Key 필드 표시 ──────────────── */
const MODEL_KEYS = {
  deepseek: null,                           /* 내장 키 사용 */
  gpt:      { label:'OpenAI API Key',   placeholder:'sk-...' },
  claude:   { label:'Anthropic API Key',placeholder:'sk-ant-...' },
  gemini:   { label:'Google API Key',   placeholder:'AIza...' },
  grok:     { label:'xAI API Key',      placeholder:'xai-...' },
  llama:    { label:'Groq API Key',     placeholder:'gsk_...' },
};

function onModelChange() {
  const sel   = g('singleLLM').value;
  const row   = g('apiKeyRow');
  const lbl   = g('apiKeyLabel');
  const inp   = g('apiKeyInput');
  const info  = MODEL_KEYS[sel];
  if (info) {
    lbl.textContent    = info.label;
    inp.placeholder    = info.placeholder;
    row.classList.add('visible');
  } else {
    row.classList.remove('visible');
    inp.value = '';
  }
}

/* ── 현재 선택된 API Key 반환 ──────────────────────── */
function getApiKey() {
  const sel = g('singleLLM').value;
  if (sel === 'deepseek') return DS_KEY;           /* DS_KEY는 app-verdict.js에 정의 */
  const val = (g('apiKeyInput').value || '').trim();
  if (!val) { alert('선택한 모델의 API Key를 입력해주세요.'); return null; }
  return val;
}

/* ── 다음 단계: 사건 입력 ────────────────────────────── */
function goToBench() { showPage('bench'); }

/* ── 사건 입력 → 판결 생성 페이지 이동 ─────────────── */
function goToVerdict() {
  const facts     = g('facts').value.trim();
  const plaintiff = g('plaintiff').value.trim();
  const defendant = g('defendant').value.trim();
  if (!facts || !plaintiff || !defendant) {
    alert('사건 개요, 원고, 피고는 필수 입력 항목입니다.');
    return;
  }

  const ctMap = {
    civil_contract:'계약위반', civil_damage:'손해배상',
    civil_traffic:'교통사고',  family_divorce:'이혼·위자료',
    criminal_fraud:'사기'
  };
  const ct = g('caseType').value;
  g('caseSummaryBody').innerHTML =
    csRow('사건 분류', ctMap[ct] || '미분류') +
    csRow('원고',      plaintiff) +
    csRow('피고',      defendant) +
    csRow('청구 금액', g('claimAmount').value || '명시되지 않음');

  /* 판결 페이지 초기화 */
  g('thinkingPanel').textContent  = '판결 생성 버튼을 클릭하면 분석이 시작됩니다.';
  g('rawOutputPanel').textContent = '—';
  g('verdictCard').style.display  = 'none';
  g('explanationSection').style.display = 'none';
  g('errorArea').style.display    = 'none';
  g('progWrap').style.display     = 'block';
  g('btnGenerate').style.display  = 'none';
  g('btnReGen').style.display     = 'none';

  showPage('verdict');
  runGenerate();          /* app-verdict.js */
}

function csRow(k, v) {
  return `<div class="cs-row"><span class="cs-key">${k}</span><span class="cs-val">${esc(v)}</span></div>`;
}

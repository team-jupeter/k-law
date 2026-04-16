/* ══════════════════════════════════════════════════════
   app-extract.js  —  사건 개요 AI 자동 추출
   수정 시 이 파일만 편집하면 됩니다.
══════════════════════════════════════════════════════ */

async function extractFromFacts() {
  const facts = g('facts').value.trim();
  if (facts.length < 20) { alert('사건 개요를 20자 이상 입력해주세요.'); return; }

  const btn = g('btnExtract');
  const sd  = g('extractStatus');

  /* 진행률 표시 영역 */
  let progDiv = g('extractProgress');
  if (!progDiv) {
    progDiv = document.createElement('div');
    progDiv.id = 'extractProgress';
    progDiv.innerHTML =
      '<div class="prog-track"><div class="prog-fill" style="width:0%"></div></div>'
      + '<div class="prog-lbl" style="text-align:left;">준비 중...</div>';
    sd.parentNode.insertBefore(progDiv, sd.nextSibling);
  }
  const fill = progDiv.querySelector('.prog-fill');
  const lbl  = progDiv.querySelector('.prog-lbl');

  btn.disabled = true; btn.textContent = '분석 중...';
  sd.style.display = 'block';
  sd.className = 'notice notice-info';

  const steps = [
    { msg:'사건 개요를 읽고 있습니다...',          progress:10 },
    { msg:'원고와 피고를 특정합니다...',            progress:30 },
    { msg:'청구 금액을 파악합니다...',              progress:50 },
    { msg:'사건 분류를 분석합니다...',              progress:70 },
    { msg:'주장과 다툼 없는 사실을 추출합니다...', progress:90 },
  ];
  let si = 0;
  const iv = setInterval(() => {
    if (si < steps.length) {
      lbl.textContent    = steps[si].msg;
      fill.style.width   = steps[si].progress + '%';
      si++;
    } else { clearInterval(iv); }
  }, 800);

  const sys = `당신은 법률 문서 분석 전문가입니다. 사건 개요에서 아래 7개 항목을 추출하여 순수 JSON만 출력하세요(코드블록 없이):
{"caseType":"코드","claimAmount":"금액","plaintiff":"원고명","defendant":"피고명","plaintiffClaim":"원고 주장","defendantClaim":"피고 주장","undisputedFacts":"다툼없는 사실"}
caseType 코드: civil_contract, civil_damage, civil_traffic, family_divorce, criminal_fraud. 불명확하면 civil_contract.`;

  try {
    const key = getApiKey();
    if (!key) return;

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + key },
      body: JSON.stringify({
        model:'deepseek-chat',
        messages:[{ role:'system', content:sys }, { role:'user', content:facts }],
        temperature:0,
        max_tokens:800
      })
    });
    clearInterval(iv);
    fill.style.width = '100%';
    lbl.textContent  = '추출 완료! 결과 적용 중...';

    if (!res.ok) throw new Error('API 오류: ' + res.status);
    const data = await res.json();
    const txt  = data.choices[0].message.content;
    const m    = txt.match(/\{[\s\S]*\}/);
    if (!m) throw new Error('JSON 파싱 실패');
    const ex = JSON.parse(m[0]);

    if (ex.caseType)        g('caseType').value        = ex.caseType;
    if (ex.claimAmount)     g('claimAmount').value     = ex.claimAmount;
    if (ex.plaintiff)       g('plaintiff').value       = ex.plaintiff;
    if (ex.defendant)       g('defendant').value       = ex.defendant;
    if (ex.plaintiffClaim)  g('plaintiffClaim').value  = ex.plaintiffClaim;
    if (ex.defendantClaim)  g('defendantClaim').value  = ex.defendantClaim;
    if (ex.undisputedFacts) g('undisputedFacts').value = ex.undisputedFacts;

    sd.className  = 'notice notice-ok';
    sd.textContent = '자동 추출이 완료되었습니다. 필요 시 직접 수정하세요.';
    setTimeout(() => { if (progDiv) progDiv.style.display = 'none'; }, 2000);
  } catch(e) {
    clearInterval(iv);
    sd.className  = 'notice notice-err';
    sd.textContent = '오류: ' + e.message;
  } finally {
    btn.disabled = false;
    btn.textContent = 'AI 자동 추출';
  }
}

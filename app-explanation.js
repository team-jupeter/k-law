/* ══════════════════════════════════════════════════════
   app-explanation.js  —  판결 정당성 설명 · 비유 생성
   수정 시 이 파일만 편집하면 됩니다.
══════════════════════════════════════════════════════ */

async function showExplanation(verdict) {
  const explanationDiv = g('explanationSection');
  if (!explanationDiv) return;

  explanationDiv.style.display = 'block';
  const explainContent = g('explanationContent');
  const analogyContent = g('analogyContent');

  explainContent.innerHTML = '<p>📖 판결 근거를 분석하고 비유를 생성하는 중입니다...</p>';
  analogyContent.innerHTML = '<p>🧸 초등학생도 이해할 수 있는 비유를 준비 중입니다...</p>';

  const caseData = {
    caseType:       g('caseType').options[g('caseType').selectedIndex]?.text || g('caseType').value,
    plaintiff:      g('plaintiff').value,
    defendant:      g('defendant').value,
    facts:          g('facts').value,
    plaintiffClaim: g('plaintiffClaim').value,
    defendantClaim: g('defendantClaim').value,
  };

  const systemPrompt = `당신은 법률 판결을 쉽게 설명하는 전문가입니다.
사용자가 제공한 사건 정보와 AI 판결 내용을 바탕으로,
1) 판결의 논리적 근거와 법적 정당성을 초등학생도 이해할 수 있는 친근한 비유로 설명하고,
2) 판결의 핵심 이유를 3~5문장으로 요약해 주세요.

응답은 다음 JSON 형식만 출력하세요 (추가 텍스트 없이):
{
  "reasoning_summary": "판결의 핵심 논리 요약 (3~5문장)",
  "analogy": "일상적인 비유 (100~150자)"
}`;

  const userMessage = `[사건 정보]
- 사건 분류: ${caseData.caseType}
- 원고: ${caseData.plaintiff}
- 피고: ${caseData.defendant}
- 사건 개요: ${caseData.facts.substring(0,500)}
- 원고 주장: ${caseData.plaintiffClaim.substring(0,300)}
- 피고 주장: ${caseData.defendantClaim.substring(0,300)}

[AI 판결]
- 판결 방향: ${verdict.ruling}
- 핵심 법리: ${verdict.key_legal_theory}
- 세부 논증: ${verdict.reasoning}
- 적용 법조문: ${Array.isArray(verdict.legal_basis) ? verdict.legal_basis.join(', ') : verdict.legal_basis}

위 정보를 바탕으로 판결의 정당성과 비유를 생성해 주세요.`;

  try {
    const key = getApiKey();
    if (!key) return;

    const response = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + key },
      body: JSON.stringify({
        model:'deepseek-chat',
        messages:[
          { role:'system', content:systemPrompt },
          { role:'user',   content:userMessage  }
        ],
        temperature:0.5,
        max_tokens:800
      })
    });
    if (!response.ok) throw new Error('설명 생성 API 오류');

    const data        = await response.json();
    const content     = data.choices[0].message.content;
    const jsonMatch   = content.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('JSON 파싱 실패');
    const explanation = JSON.parse(jsonMatch[0]);

    const basisStr = Array.isArray(verdict.legal_basis)
      ? verdict.legal_basis.join(', ')
      : (verdict.legal_basis || '명시되지 않음');

    explainContent.innerHTML =
      `<p><strong>📌 판결 요약:</strong> ${verdict.verdict_summary || '판결 요지가 없습니다.'}</p>
       <p><strong>🔍 핵심 법리:</strong> ${verdict.key_legal_theory || '설명 없음'}</p>
       <p><strong>⚖️ 법적 근거:</strong> ${basisStr}</p>
       <p><strong>💡 판결의 논리적 근거:</strong><br>${explanation.reasoning_summary}</p>`;
    analogyContent.innerHTML =
      `<strong>🧸 초등학생도 이해하는 비유:</strong><br>${explanation.analogy}`;

  } catch(err) {
    console.error(err);
    const basisStr = Array.isArray(verdict.legal_basis)
      ? verdict.legal_basis.join(', ')
      : (verdict.legal_basis || '명시되지 않음');
    explainContent.innerHTML =
      `<p><strong>📌 판결 요약:</strong> ${verdict.verdict_summary || '판결 요지가 없습니다.'}</p>
       <p><strong>🔍 핵심 법리:</strong> ${verdict.key_legal_theory || '설명 없음'}</p>
       <p><strong>⚖️ 법적 근거:</strong> ${basisStr}</p>`;
    analogyContent.innerHTML =
      `<strong>🧸 초등학생도 이해하는 비유:</strong><br>비유 생성 중 오류가 발생했습니다. 잠시 후 다시 시도해주세요.`;
  }
}

/* ── 추가 질문 ──────────────────────────────────────── */
async function askAdditionalQuestion() {
  const q      = g('questionInput').value.trim();
  const ansDiv = g('questionAnswer');
  if (!q) { alert('질문을 입력해주세요.'); return; }

  ansDiv.style.display = 'block';
  ansDiv.textContent   = '답변을 생성하는 중입니다...';

  try {
    const key = getApiKey();
    if (!key) return;

    const res = await fetch('https://api.deepseek.com/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type':'application/json', 'Authorization':'Bearer ' + key },
      body: JSON.stringify({
        model:'deepseek-chat',
        messages:[
          { role:'system', content:'당신은 법률 판결을 쉽게 설명하는 전문가입니다. 판결에 대한 질문에 친절하고 명확하게 답변하세요.' },
          { role:'user',   content:`판결 내용: ${g('rawOutputPanel')?.textContent?.slice(-2000) || ''}\n\n질문: ${q}` }
        ],
        temperature:0.5,
        max_tokens:600
      })
    });
    if (!res.ok) throw new Error('API 오류: ' + res.status);
    const data = await res.json();
    ansDiv.textContent = data.choices[0].message.content;
  } catch(e) {
    ansDiv.textContent = '오류: ' + e.message;
  }
}

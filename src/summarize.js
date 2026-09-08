// 用 Claude API 把新論文的標題／摘要濃縮成繁體中文摘要，
// 並額外標註是否與「雄性禿」或「植髮手術」直接相關、其臨床意義為何。

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY || '';
const MODEL = process.env.ANTHROPIC_SUMMARY_MODEL || 'claude-haiku-4-5-20251001';

export function summarizerConfigured() {
  return Boolean(ANTHROPIC_API_KEY);
}

function buildPrompt(paper) {
  return `你是專業醫學編輯，請閱讀以下 PubMed 論文的標題與摘要，並用「繁體中文」回覆，格式必須完全依照下面兩行，不要加其他文字或標題：
SUMMARY: <3-4句重點摘要，說明研究方法與主要發現>
ANALYSIS: <若此論文與「雄性禿（androgenetic alopecia／hair loss）」或「植髮手術（hair transplant／FUE）」有直接相關，用2-3句說明其臨床意義、機轉或對治療／手術的參考價值；若無直接相關，只回覆 NONE>

標題：${paper.title}
摘要：${paper.abstract || '（無摘要）'}`;
}

async function callClaude(prompt) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 500,
      temperature: 0,
      messages: [{ role: 'user', content: prompt }],
    }),
  });
  if (!res.ok) {
    throw new Error(`Anthropic API ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }
  const data = await res.json();
  return data.content?.[0]?.text || '';
}

function parseResponse(text) {
  const summaryMatch = text.match(/SUMMARY:\s*([\s\S]*?)(?:\nANALYSIS:|$)/i);
  const analysisMatch = text.match(/ANALYSIS:\s*([\s\S]*)$/i);
  const summary_zh = (summaryMatch ? summaryMatch[1] : text).trim();
  let key_analysis_zh = (analysisMatch ? analysisMatch[1] : '').trim();
  if (!key_analysis_zh || /^NONE$/i.test(key_analysis_zh)) key_analysis_zh = '';
  return { summary_zh, key_analysis_zh };
}

// 逐篇呼叫（新論文量不大，且失敗要能各自略過不拖垮整個爬取）
export async function summarizePapers(papers, { log = () => {} } = {}) {
  const results = new Map();
  if (!summarizerConfigured()) return results;
  for (const paper of papers) {
    try {
      const text = await callClaude(buildPrompt(paper));
      results.set(paper.pmid, parseResponse(text));
    } catch (err) {
      log(`   ⚠️ 中文摘要失敗（PMID ${paper.pmid}）：${err.message}`);
    }
  }
  return results;
}

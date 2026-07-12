import { XMLParser } from 'fast-xml-parser';
import { RETMAX, RELDATE_DAYS, NCBI_TOOL, NCBI_EMAIL, NCBI_API_KEY } from './config.js';

const EUTILS = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

const parser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: '@_',
  textNodeName: '#text',
});

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 無 API key 時 NCBI 限 3 req/s；保守用 ~350ms 間隔。有 key 可縮短。
const THROTTLE_MS = NCBI_API_KEY ? 120 : 350;

function baseParams() {
  const p = new URLSearchParams({ db: 'pubmed', tool: NCBI_TOOL });
  if (NCBI_EMAIL) p.set('email', NCBI_EMAIL);
  if (NCBI_API_KEY) p.set('api_key', NCBI_API_KEY);
  return p;
}

async function fetchWithRetry(url, tries = 3) {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(url);
      if (res.status === 429) {
        await sleep(1000 * (i + 1));
        continue;
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return res;
    } catch (err) {
      if (i === tries - 1) throw err;
      await sleep(500 * (i + 1));
    }
  }
}

// 用 esearch 取得符合查詢的 PMID 清單
export async function searchPmids(term) {
  const params = baseParams();
  params.set('term', term);
  params.set('retmax', String(RETMAX));
  params.set('retmode', 'json');
  params.set('sort', 'date');
  params.set('datetype', 'pdat');
  params.set('reldate', String(RELDATE_DAYS));
  const res = await fetchWithRetry(`${EUTILS}/esearch.fcgi?${params}`);
  const json = await res.json();
  await sleep(THROTTLE_MS);
  return json?.esearchresult?.idlist ?? [];
}

const asArray = (v) => (v == null ? [] : Array.isArray(v) ? v : [v]);

const NAMED_ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

// PubMed XML 內文常帶數值型 HTML 實體（如 &#x3b1;、&#xb2;、&#x2009;），
// fast-xml-parser 不會全部解碼，這裡統一還原成 Unicode 字元。
function decodeEntities(str) {
  return str
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&(amp|lt|gt|quot|apos|nbsp);/g, (_, n) => NAMED_ENTITIES[n]);
}

function textOf(node) {
  let raw = '';
  if (node == null) raw = '';
  else if (typeof node === 'string' || typeof node === 'number') raw = String(node);
  else if (typeof node === 'object') raw = node['#text'] != null ? String(node['#text']) : '';
  return decodeEntities(raw);
}

function parseAbstract(article) {
  const parts = asArray(article?.Abstract?.AbstractText);
  if (!parts.length) return '';
  return parts
    .map((p) => {
      const label = typeof p === 'object' ? p['@_Label'] : '';
      const text = textOf(p);
      return label ? `${label}: ${text}` : text;
    })
    .filter(Boolean)
    .join('\n\n')
    .trim();
}

function parseAuthors(article) {
  const authors = asArray(article?.AuthorList?.Author);
  const names = authors
    .map((a) => {
      if (a.CollectiveName) return textOf(a.CollectiveName);
      const last = textOf(a.LastName);
      const initials = textOf(a.Initials);
      return [last, initials].filter(Boolean).join(' ');
    })
    .filter(Boolean);
  if (names.length > 8) return `${names.slice(0, 8).join(', ')}, et al.`;
  return names.join(', ');
}

function parsePubDate(article, pubmedData) {
  // 優先用 ArticleDate（電子刊出日），較完整
  const ad = article?.ArticleDate;
  const adNode = Array.isArray(ad) ? ad[0] : ad;
  if (adNode?.Year) {
    const y = textOf(adNode.Year);
    const m = String(textOf(adNode.Month) || '01').padStart(2, '0');
    const d = String(textOf(adNode.Day) || '01').padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const pd = article?.Journal?.JournalIssue?.PubDate;
  if (pd?.Year) {
    const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
    const y = textOf(pd.Year);
    const rawM = textOf(pd.Month);
    const m = months[rawM] || (rawM ? String(rawM).padStart(2, '0') : '01');
    const d = String(textOf(pd.Day) || '01').padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  if (pd?.MedlineDate) return textOf(pd.MedlineDate);
  return '';
}

function parseDoi(article, pubmedData) {
  const ids = asArray(pubmedData?.ArticleIdList?.ArticleId);
  const doiId = ids.find((x) => x?.['@_IdType'] === 'doi');
  if (doiId) return textOf(doiId);
  const eloc = asArray(article?.ELocationID).find((x) => x?.['@_EIdType'] === 'doi');
  return eloc ? textOf(eloc) : '';
}

function parseKeywords(citation) {
  const kws = [];
  for (const list of asArray(citation?.KeywordList)) {
    for (const kw of asArray(list?.Keyword)) kws.push(textOf(kw));
  }
  return kws.filter(Boolean).join(', ');
}

// 用 efetch 取得完整記錄（含摘要），解析為乾淨的物件陣列
export async function fetchDetails(pmids) {
  if (!pmids.length) return [];
  const params = baseParams();
  params.set('id', pmids.join(','));
  params.set('retmode', 'xml');
  const res = await fetchWithRetry(`${EUTILS}/efetch.fcgi?${params}`);
  const xml = await res.text();
  await sleep(THROTTLE_MS);

  const doc = parser.parse(xml);
  const articles = asArray(doc?.PubmedArticleSet?.PubmedArticle);
  return articles.map((entry) => {
    const citation = entry.MedlineCitation ?? {};
    const article = citation.Article ?? {};
    const pubmedData = entry.PubmedData ?? {};
    const pmid = textOf(citation.PMID);
    return {
      pmid,
      title: textOf(article.ArticleTitle).replace(/\s+/g, ' ').trim(),
      abstract: parseAbstract(article),
      authors: parseAuthors(article),
      journal: textOf(article?.Journal?.Title),
      pub_date: parsePubDate(article, pubmedData),
      doi: parseDoi(article, pubmedData),
      url: `https://pubmed.ncbi.nlm.nih.gov/${pmid}/`,
      keywords: parseKeywords(citation),
    };
  }).filter((p) => p.pmid);
}

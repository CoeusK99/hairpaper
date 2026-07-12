// 追蹤主題與查詢設定。每個主題會各自向 PubMed 查詢，
// 同一篇論文若符合多個主題，topics 欄位會一併記錄。
export const TOPICS = [
  {
    key: 'hair_loss',
    label: '落髮 / 雄性禿',
    term: '(alopecia[Title/Abstract] OR "hair loss"[Title/Abstract] OR "androgenetic alopecia"[Title/Abstract] OR "alopecia areata"[Title/Abstract] OR "hair thinning"[Title/Abstract])',
  },
  {
    key: 'hair_transplant',
    label: '植髮手術',
    term: '("hair transplant"[Title/Abstract] OR "hair transplantation"[Title/Abstract] OR "follicular unit"[Title/Abstract] OR "FUE"[Title/Abstract] OR "follicular unit extraction"[Title/Abstract])',
  },
  {
    key: 'hair_growth',
    label: '生髮 / 毛囊再生',
    term: '("hair growth"[Title/Abstract] OR "hair regrowth"[Title/Abstract] OR "hair regeneration"[Title/Abstract] OR "hair follicle"[Title/Abstract] OR "dermal papilla"[Title/Abstract])',
  },
  {
    key: 'treatments',
    label: '藥物 / 療法',
    term: '((minoxidil OR finasteride OR dutasteride OR "platelet-rich plasma" OR "low-level laser therapy" OR microneedling) AND (hair OR alopecia OR scalp))',
  },
];

export const TOPIC_MAP = Object.fromEntries(TOPICS.map((t) => [t.key, t.label]));

// 每個主題每次抓取的最多篇數
export const RETMAX = Number(process.env.CRAWL_RETMAX || 50);

// 回溯天數：抓取最近 N 天內「發表」的論文（重複由 PMID 去重）
export const RELDATE_DAYS = Number(process.env.CRAWL_RELDATE_DAYS || 30);

// NCBI 建議在請求中附上工具名稱與聯絡 email（便於他們在異常時聯繫，非必填）
export const NCBI_TOOL = 'hair-papers';
export const NCBI_EMAIL = process.env.NCBI_EMAIL || process.env.MAIL_TO || '';

// 有 API key 時速率上限較高（10 req/s），可留空
export const NCBI_API_KEY = process.env.NCBI_API_KEY || '';

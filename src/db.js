import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, '..', 'data');
fs.mkdirSync(DATA_DIR, { recursive: true });

const db = new Database(path.join(DATA_DIR, 'papers.db'));
db.pragma('journal_mode = WAL');

db.exec(`
CREATE TABLE IF NOT EXISTS papers (
  pmid TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  abstract TEXT,
  authors TEXT,
  journal TEXT,
  pub_date TEXT,
  doi TEXT,
  url TEXT,
  topics TEXT,          -- 逗號分隔的主題 key
  keywords TEXT,
  first_seen TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  is_read INTEGER NOT NULL DEFAULT 0,
  is_starred INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_papers_pubdate ON papers(pub_date);
CREATE INDEX IF NOT EXISTS idx_papers_seen ON papers(first_seen);

CREATE TABLE IF NOT EXISTS crawl_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT NOT NULL DEFAULT (datetime('now','localtime')),
  finished_at TEXT,
  new_count INTEGER NOT NULL DEFAULT 0,
  total_found INTEGER NOT NULL DEFAULT 0,
  note TEXT
);
`);

const getPaper = db.prepare('SELECT topics FROM papers WHERE pmid = ?');
const insertPaper = db.prepare(`
  INSERT INTO papers (pmid, title, abstract, authors, journal, pub_date, doi, url, topics, keywords)
  VALUES (@pmid, @title, @abstract, @authors, @journal, @pub_date, @doi, @url, @topics, @keywords)
`);
const updateTopics = db.prepare('UPDATE papers SET topics = ? WHERE pmid = ?');

// 儲存一篇論文並歸屬到某主題。回傳 true 代表這是第一次見到（供摘要使用）。
export function upsertPaper(paper, topicKey) {
  const existing = getPaper.get(paper.pmid);
  if (existing) {
    const topics = new Set((existing.topics || '').split(',').filter(Boolean));
    if (!topics.has(topicKey)) {
      topics.add(topicKey);
      updateTopics.run([...topics].join(','), paper.pmid);
    }
    return false;
  }
  insertPaper.run({ ...paper, topics: topicKey });
  return true;
}

export function startRun() {
  return db.prepare('INSERT INTO crawl_runs DEFAULT VALUES').run().lastInsertRowid;
}

export function finishRun(id, { newCount, totalFound, note }) {
  db.prepare(`
    UPDATE crawl_runs
    SET finished_at = datetime('now','localtime'), new_count = ?, total_found = ?, note = ?
    WHERE id = ?
  `).run(newCount, totalFound, note || null, id);
}

// 把 WAL 內容併回 papers.db 本體，讓提交進 git 的 .db 檔是最新且自足的
export function checkpoint() {
  db.pragma('wal_checkpoint(TRUNCATE)');
}

export function getPapersByPmids(pmids) {
  if (!pmids.length) return [];
  const ph = pmids.map(() => '?').join(',');
  return db.prepare(`SELECT * FROM papers WHERE pmid IN (${ph})`).all(...pmids);
}

export default db;

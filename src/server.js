import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch {
  /* 沒有 .env 就用系統環境變數 */
}

const { default: db } = await import('./db.js');
const { TOPICS } = await import('./config.js');
const { runCrawl } = await import('./crawl.js');

const app = express();
const PORT = process.env.PORT || 3030;
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/topics', (req, res) => {
  res.json(TOPICS.map(({ key, label }) => ({ key, label })));
});

app.get('/api/stats', (req, res) => {
  const total = db.prepare('SELECT COUNT(*) AS c FROM papers').get().c;
  const unread = db.prepare('SELECT COUNT(*) AS c FROM papers WHERE is_read = 0').get().c;
  const starred = db.prepare('SELECT COUNT(*) AS c FROM papers WHERE is_starred = 1').get().c;
  const lastRun = db.prepare('SELECT * FROM crawl_runs ORDER BY id DESC LIMIT 1').get();
  res.json({ total, unread, starred, lastRun });
});

app.get('/api/papers', (req, res) => {
  const { topic, q, unread, starred } = req.query;
  const where = [];
  const params = [];
  if (topic) {
    where.push("(',' || topics || ',') LIKE ?");
    params.push(`%,${topic},%`);
  }
  if (q) {
    where.push('(title LIKE ? OR abstract LIKE ? OR authors LIKE ?)');
    params.push(`%${q}%`, `%${q}%`, `%${q}%`);
  }
  if (unread === '1') where.push('is_read = 0');
  if (starred === '1') where.push('is_starred = 1');
  const sql = `
    SELECT * FROM papers
    ${where.length ? 'WHERE ' + where.join(' AND ') : ''}
    ORDER BY (pub_date IS NULL OR pub_date = ''), pub_date DESC, first_seen DESC
    LIMIT 300
  `;
  res.json(db.prepare(sql).all(...params));
});

app.post('/api/papers/:pmid/read', (req, res) => {
  const val = req.body?.is_read ? 1 : 0;
  db.prepare('UPDATE papers SET is_read = ? WHERE pmid = ?').run(val, req.params.pmid);
  res.json({ ok: true, is_read: val });
});

app.post('/api/papers/:pmid/star', (req, res) => {
  const val = req.body?.is_starred ? 1 : 0;
  db.prepare('UPDATE papers SET is_starred = ? WHERE pmid = ?').run(val, req.params.pmid);
  res.json({ ok: true, is_starred: val });
});

// 手動觸發爬取（儀表板「立即更新」按鈕）
let crawling = false;
app.post('/api/crawl', async (req, res) => {
  if (crawling) return res.status(409).json({ error: '正在更新中，請稍候' });
  crawling = true;
  try {
    const result = await runCrawl({ quiet: true });
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  } finally {
    crawling = false;
  }
});

app.listen(PORT, () => {
  console.log(`📚 hair-papers 儀表板：http://localhost:${PORT}`);
});

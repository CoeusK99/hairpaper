import path from 'path';
import { fileURLToPath } from 'url';

// 載入專案根目錄的 .env（Node 20.6+ 內建，不需額外套件）
const __dirname = path.dirname(fileURLToPath(import.meta.url));
try {
  process.loadEnvFile(path.join(__dirname, '..', '.env'));
} catch {
  // 沒有 .env 也沒關係，改用系統環境變數
}

const { TOPICS } = await import('./config.js');
const { searchPmids, fetchDetails } = await import('./pubmed.js');
const { upsertPaper, startRun, finishRun, getPapersByPmids, checkpoint } = await import('./db.js');
const { writeMarkdown, buildEmailHtml, todayStr } = await import('./digest.js');
const { sendDigestEmail, mailerConfigured } = await import('./mailer.js');

export async function runCrawl({ quiet = false } = {}) {
  const log = quiet ? () => {} : (...a) => console.log(...a);
  const runId = startRun();
  const newPmids = new Set();
  const seenPmids = new Set();

  try {
    for (const topic of TOPICS) {
      log(`🔎 ${topic.label} …`);
      const pmids = await searchPmids(topic.term);
      log(`   命中 ${pmids.length} 篇，抓取詳細資料`);
      // efetch 一次帶多個 id；分批避免 URL 過長
      for (let i = 0; i < pmids.length; i += 40) {
        const batch = pmids.slice(i, i + 40);
        const details = await fetchDetails(batch);
        for (const paper of details) {
          seenPmids.add(paper.pmid);
          const isNew = upsertPaper(paper, topic.key);
          if (isNew) newPmids.add(paper.pmid);
        }
      }
    }

    const newPapers = getPapersByPmids([...newPmids]).sort((a, b) =>
      (b.pub_date || '').localeCompare(a.pub_date || '')
    );
    const dateStr = todayStr();

    // 1) Markdown 彙整檔
    const mdFile = writeMarkdown(newPapers, dateStr);
    log(`📝 Markdown：${mdFile}`);

    // 2) Email 摘要（未設定 SMTP 時自動略過）
    let mailNote = '未寄信';
    if (mailerConfigured()) {
      const result = await sendDigestEmail({
        subject: `🧬 毛髮論文彙整 ${dateStr}（新增 ${newPapers.length} 篇）`,
        html: buildEmailHtml(newPapers, dateStr),
      });
      mailNote = result.sent ? `已寄信 ${result.messageId}` : result.reason;
      log(`📧 ${mailNote}`);
    } else {
      log('📧 未設定 SMTP，略過 Email');
    }

    finishRun(runId, {
      newCount: newPapers.length,
      totalFound: seenPmids.size,
      note: mailNote,
    });
    checkpoint(); // 併回 WAL，讓提交進 git 的 papers.db 是最新狀態
    log(`✅ 完成：本次掃描 ${seenPmids.size} 篇，其中 ${newPapers.length} 篇為新論文`);
    return { newCount: newPapers.length, totalFound: seenPmids.size, mdFile };
  } catch (err) {
    finishRun(runId, { newCount: newPmids.size, totalFound: seenPmids.size, note: `錯誤：${err.message}` });
    throw err;
  }
}

// 直接執行時（npm run crawl）跑一次
if (import.meta.url === `file://${process.argv[1]}`) {
  runCrawl()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('❌ 爬取失敗：', err);
      process.exit(1);
    });
}

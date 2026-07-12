# 定期執行

你選的是**雲端排程**，主要設定如下；文末也附上本機 cron 作為備援。

## 方案 A：雲端排程（claude.ai routine）

### 你要做的一次性設定

雲端 routine 需要一個綁定本 repo 的 Claude Code 雲端環境（授權 GitHub 只有帳號本人能做）：

1. 到 claude.ai → Claude Code / Cloud → 新增一個環境，連結 GitHub repo `CoeusK99/hairpaper`。
2. 建好後，把該環境的 **environment_id** 交給我，我用 API 幫你把 routine 建起來，
   或你直接在該介面新增排程並貼上下面的「Routine 指令」。

### 排程與指令

- 建議排程：每天 08:17（cron `17 8 * * *`，Asia/Taipei；避開整點分散負載）
- Routine 指令（貼進排程的 prompt）：

```
每天更新論文資料庫並同步回 repo：
1. git pull origin main。
2. npm install。
3. npm run crawl（向 PubMed 抓最近 30 天生髮/植髮/毛髮論文，更新 data/papers.db、
   產生 digests/當日.md；若環境變數有設 SMTP_* 就寄 Email 摘要）。
4. 若 data/papers.db 或 digests/ 有變更，執行：
   git add data/papers.db digests
   git commit -m "chore: 每日論文更新"
   git push origin main
5. 回報本次新增幾篇（crawl 輸出的「其中 N 篇為新論文」）。
```

routine 每次跑會把新資料 push 回 repo，你本機 `git pull` + `npm start` 就看得到。

之後你在本機只要 `git pull`，再 `npm start` 開儀表板，就能看到雲端抓到的最新資料。
PMID 去重狀態存在 `data/papers.db` 裡，一起進版控，所以雲端每次跑不會重複通知舊論文。

### Email 要另外開啟（用 Resend，不需 Gmail 密碼）

要讓雲端每早寄摘要，在雲端環境的環境變數加上：
- `RESEND_API_KEY`（到 resend.com 用收件信箱註冊後產生，免費每天 100 封）
- `MAIL_TO=coeusxd@gmail.com`
- `MAIL_FROM=hair-papers <onboarding@resend.dev>`（未驗證自有網域時的預設寄件人）

API key 由你自己註冊產生、自行填入，屬你的機密，我不代填。沒設就自動略過寄信、其他照常。
本機執行 `npm run crawl` 時 `.env` 有設一樣會寄。細節見 `.env.example` 與 `README.md`。

### 調整排程

用「排程 / routines」介面就能改時間或暫停。預設頻率可依需求調整
（論文更新不快，建議每天一次或每週兩三次即可，不需要更頻繁）。

## 方案 B：本機 cron（備援，需電腦開著）

若哪天想改回本機跑，把下面加進 `crontab -e`（每天早上 8 點）：

```cron
0 8 * * * cd /Users/pohuan/Desktop/claude/hair-papers && /usr/local/bin/node src/crawl.js >> data/cron.log 2>&1
```

`node` 路徑用 `which node` 查。本機跑的好處是三種輸出（儀表板、Email、Markdown）
都在同一台機器上、`.env` 直接可用，Email 立即可寄；缺點是電腦要開著。

## macOS launchd（比 cron 穩，開機也會補跑）

如需 launchd 版本再說一聲，可以幫你產生 `~/Library/LaunchAgents/*.plist`。

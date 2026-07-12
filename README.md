# hair-papers 🧬

定期從 **PubMed** 追蹤生髮／植髮／毛髮相關的新論文，並用三種方式呈現：

1. **本機 Web 儀表板** — 搜尋、依主題篩選、標記已讀／收藏
2. **Email 摘要** — 每次更新把新論文整理成一封信寄給你
3. **Markdown 彙整檔** — 每次更新在 `digests/YYYY-MM-DD.md` 產生一份

資料來自 PubMed 官方 E-utilities API（非爬 HTML，穩定且合規）。

## 追蹤主題

| 主題 | 內容 |
| --- | --- |
| 落髮 / 雄性禿 | alopecia、hair loss、androgenetic alopecia… |
| 植髮手術 | hair transplant、follicular unit、FUE… |
| 生髮 / 毛囊再生 | hair growth、hair regeneration、dermal papilla… |
| 藥物 / 療法 | minoxidil、finasteride、PRP、低能量雷射、微針… |

主題與關鍵字可在 `src/config.js` 調整。

## 安裝

```bash
cd hair-papers
npm install
cp .env.example .env   # 依需求填入 Email 設定（不填也能跑，只是不寄信）
```

## 使用

```bash
npm run crawl    # 抓一次：更新資料庫 + 產生 Markdown + （有設定的話）寄 Email
npm start        # 開啟本機儀表板 http://localhost:3030
```

儀表板右上角的「立即更新」按鈕會即時觸發一次抓取。

## 定期執行

見 [`SCHEDULE.md`](SCHEDULE.md)：本機 cron／launchd 與雲端排程兩種做法。

## Email 設定（Gmail）

`.env` 裡的 `SMTP_PASS` 要填 **Gmail 應用程式密碼**（16 碼），不是登入密碼：
先在 Google 帳號開啟兩步驟驗證 → 搜尋「應用程式密碼」→ 產生一組貼上。
未設定 SMTP 時系統會自動略過寄信，其他功能照常。

## 資料存放

- `data/papers.db` — SQLite 資料庫（PMID 去重，累積收藏）
- `digests/` — 每次更新的 Markdown 彙整

兩者都在 `.gitignore` 內，不會進版控。

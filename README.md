# チャートログ — 青チャート進捗共有アプリ

青チャートの学習進捗を、友達同士でリアルタイムに共有するモバイルファーストのWebアプリです。
パスワード不要。名前を選ぶだけで、すぐに記録を始められます。

- **ビルド不要**：HTML / CSS / JavaScript だけで動く静的アプリ
- **Supabase 連携**：無料枠でリアルタイム同期（未設定でもローカル保存モードで動作）
- **スマホ前提のUI**：片手で押しやすい下部タブ、大きな問題タップ、範囲記録シート

---

## 1. 主な機能

| 機能 | 内容 |
| --- | --- |
| 範囲で記録 | 「例題 12〜30」のように範囲指定して一括 +1。続きから10問などのショートカット付き |
| 1問ずつ記録 | 問題番号をタップで +1。**長押しで −1**（誤入力の修正） |
| 周回カウント | 同じ問題を解くたびに回数が増え、`×2` のように表示。3回以上は濃い色に |
| 苦手チェック | 問題ごとに苦手フラグをオン/オフ。「苦手のみ」で絞り込み |
| 取り消し | 範囲記録の直後に「元に戻す」、または各問題を長押しで −1 |
| タイムライン | 誰が・いつ・どの参考書の何番を進めたかをリアルタイム表示 |
| 達成率比較 | 参考書ごとに「1回以上完了した問題数 ÷ 総問題数」をメンバー全員で比較 |
| ランキング | 今週 / 今月の演習数（延べ）をランキング表示 |
| マイページ | 完了問題数・延べ演習数・苦手数・連続日数・参考書別の進捗 |

### 参考書マスタ

| 参考書 | 例題 | EX |
| --- | ---: | ---: |
| 青チャートⅠ | 1〜194 | 1〜135 |
| 青チャートA | 1〜158 | 1〜107 |
| 青チャートⅡ | 1〜262 | 1〜159 |
| 青チャートB | 1〜94 | 1〜63 |
| 青チャートⅢ | 1〜215 | 1〜176 |
| 青チャートC | 1〜179 | 1〜121 |

問題数を変更したい場合は `js/master.js` の数値を書き換えてください。

---

## 2. すぐに動かす（ローカルモード）

このアプリはビルド不要です。`chartlog` フォルダで簡易サーバーを立てるのがおすすめです。

```bash
cd chartlog
python -m http.server 8000
```

ブラウザで `http://localhost:8000` を開いてください。

- `index.html` をダブルクリックしても起動できます（Supabaseを使う場合はネット接続が必要）。
- Supabase未設定のときは **ローカル保存モード** になります。データは `localStorage` に保存され、同じ端末・同じブラウザだけで共有されます。
- 画面右上が `LOCAL` ならローカル、`LIVE` ならクラウド同期中です。

---

## 3. Supabase の設定（環境変数）

友達のスマホとリアルタイム共有するには Supabase を使います（無料枠でOK）。
**このアプリはビルドを行わない静的アプリなので、環境変数の代わりに `config.js` を使います。**

### Step 1. プロジェクトを作成

1. [supabase.com](https://supabase.com) にログイン
2. **New project** をクリック
3. プロジェクト名（例：`chartlog`）、パスワード、リージョン（`Northeast Asia (Tokyo)` など）を設定して作成

### Step 2. テーブルと関数を作成

1. 左メニューの **SQL Editor** → **New query**
2. このリポジトリの `supabase/schema.sql` の中身をすべて貼り付ける
3. **Run** をクリック（`Success. No rows returned` などが出ればOK）

作成されるもの：

- `profiles` … ユーザー（名前だけ）
- `problem_progress` … 問題ごとの周回数・苦手フラグ
- `study_logs` … タイムライン / ランキング用の記録ログ
- `book_sections` … 問題数の上限チェック用マスタ
- `record_progress()` / `set_weak()` / `get_stats()` … 書き込み・集計用の関数
- RLS（読み取りは全員、書き込みは関数経由のみ）
- Realtime の publication 設定

### Step 3. 接続情報を `config.js` に書く

Supabase の **Project Settings → API** を開き、次の2つをコピーします。

| 画面の項目 | `config.js` のキー |
| --- | --- |
| Project URL | `SUPABASE_URL` |
| anon / public key | `SUPABASE_ANON_KEY` |

`config.js` を開いて貼り付けてください。

```js
window.APP_CONFIG = {
  SUPABASE_URL: "https://abcdefghijklmnop.supabase.co",
  SUPABASE_ANON_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9....",
};
```

> **環境変数について**
> この構成では `config.js` が環境変数ファイルの役割をします。
> Vite / Next.js などビルド環境に移植する場合は、`import.meta.env.VITE_SUPABASE_URL` や
> `process.env.NEXT_PUBLIC_SUPABASE_URL` から `window.APP_CONFIG` を組み立てる形に置き換えられます。
> その場合も **anon key だけ**を使い、`service_role` key は絶対にフロントエンドへ置かないでください。

### Step 4. 再読み込み

`http://localhost:8000` を再読み込みし、右上が **LIVE** になれば完了です。
もう1台のスマホ（または別ブラウザ）で同じURLを開き、別の名前で記録すると、
タイムラインと達成率が自動で更新されます。

> 同じ名前を選ぶと「同じユーザー」として記録されます。名前はユーザーIDの代わりなので、
> 友達と重複しない名前にしてください（16文字以内）。

---

## 4. デプロイ（無料で共有）

静的ファイルなので、どの静的ホスティングでも動きます。

### Netlify Drop（いちばん簡単）

1. [app.netlify.com/drop](https://app.netlify.com/drop) を開く
2. `chartlog` フォルダをドラッグ＆ドロップ
3. 発行されたURLを友達に送る

### GitHub Pages

1. `chartlog` の中身をリポジトリに push
2. **Settings → Pages** で Branch を `main` / `/root` に設定
3. 発行されたURLにアクセス

### Vercel

1. リポジトリを Import
2. Framework Preset は **Other**、Build Command は空、Output Directory は `chartlog`（またはリポジトリ直下に配置）

> デプロイ先のURLが変わっても、`config.js` はそのままで動きます。
> 独自ドメインを使う場合も追加設定は不要です。

---

## 5. 使い方

### 記録する

1. 上部の参考書チップで参考書を選ぶ
2. 「例題 / EX」を切り替える
3. 問題番号を **タップ → +1**、**長押し → −1**
4. 「＋1 記録 / 苦手」の切り替えで、タップ時の動作を変更

### 範囲で記録する

1. 右下の **「範囲で記録」** をタップ
2. 「から / まで」を入力（`続きから10問` などのボタンも便利）
3. **記録する** をタップ
4. トーストの **「元に戻す」** で直前の範囲記録を取り消せます

### 苦手を復習する

- 「苦手」モードにして問題をタップ → フラグのオン/オフ
- 「苦手のみ」をオンにすると、苦手な問題だけを表示
- マイページの「復習リストを開く」からも絞り込めます

### みんな / ランキング

- **みんな**：今日の演習数、参考書別の達成率マトリクス、タイムライン
- **ランキング**：週間 / 月間の演習数（延べ）。同じ問題の2周目以降もカウントされます

---

## 6. ファイル構成

```text
chartlog/
├── index.html                 # 画面の骨格
├── styles.css                 # デザイン（モバイルファースト）
├── config.js                  # ★ Supabase の接続情報（環境変数の代わり）
├── icon.svg                   # アプリアイコン
├── manifest.webmanifest       # PWA マニフェスト
├── js/
│   ├── master.js              # 参考書・問題数のマスタ
│   ├── store.js               # Supabase / ローカル保存のデータ層
│   └── app.js                 # 画面・操作・リアルタイム同期
├── supabase/
│   └── schema.sql             # ★ Supabase に実行するSQL
└── README.md
```

---

## 7. データモデル

### `profiles`

| 列 | 型 | 説明 |
| --- | --- | --- |
| `id` | uuid | 主キー |
| `name` | text | 表示名（ユニーク） |
| `created_at` | timestamptz | 作成日時 |

### `problem_progress`

| 列 | 型 | 説明 |
| --- | --- | --- |
| `user_id` | uuid | ユーザー |
| `book_id` | text | `1` / `A` / `2` / `B` / `3` / `C` |
| `section` | text | `example` / `exercise` |
| `problem_no` | int | 問題番号 |
| `count` | int | 解いた回数（0以上） |
| `weak` | boolean | 苦手フラグ |
| `updated_at` | timestamptz | 更新日時 |

### `study_logs`

| 列 | 型 | 説明 |
| --- | --- | --- |
| `from_no` / `to_no` | int | 範囲 |
| `amount` | int | 記録は正、取り消しは負（例：+19 / −19） |
| `kind` | text | `range` / `single` / `undo` |
| `created_at` | timestamptz | 記録日時（タイムライン・ランキングの基準） |

ランキングは「期間内の `amount` の合計」で計算しています。
取り消すとランキングの数値も減ります。

---

## 8. カスタマイズ

- **問題数を変える** → `js/master.js` の `example` / `exercise` を変更。
  Supabase 側の上限も変える場合は `supabase/schema.sql` の `book_sections` を更新して再実行してください。
- **参考書を追加する** → `js/master.js` の `BOOKS` に追加し、`book_sections` にも行を追加。
- **色・フォントを変える** → `styles.css` 冒頭の CSS 変数（`--primary` など）。
- **集計の期間を変える** → `js/app.js` の `startOfWeek()` / `startOfMonth()`。

---

## 9. トラブルシューティング

| 症状 | 確認すること |
| --- | --- |
| 右上が `LOCAL` のまま | `config.js` のURL・anon keyが空 or 間違っている。`https://` から始まっているか確認 |
| 「テーブルが見つかりません」 | `supabase/schema.sql` をSQL Editorで実行したか |
| 「関数が見つかりません」 | 同じく `schema.sql` の後半（関数）まで実行したか |
| リアルタイムに更新されない | Supabase の **Database → Replication** で `study_logs` / `problem_progress` / `profiles` が有効か。`schema.sql` を再実行すると設定されます |
| 名前が重複して進捗が分かれる | 同じ名前を選ぶと同一ユーザーになります。友達と重複しない名前にしてください |
| 記録が反映されない | 通信環境、Supabaseのプロジェクトが一時停止していないか（無料枠は一定期間で停止します） |
| ローカルデータを消したい | マイページ →「ローカルデータを削除」 |

---

## 10. 注意事項（セキュリティ）

- このアプリは **パスワード認証をしない** 設計です。URLを知っている人は誰でも名前を作成・選択でき、
  進捗を閲覧・記録できます。**友達内など、限定されたURLで使う前提** で利用してください。
- `anon key` はブラウザに公開される前提のキーです。RLS と RPC 関数で保護しています。
- `service_role` key は絶対に `config.js` やフロントエンドに置かないでください。
- Supabase の無料プロジェクトは、長期間アクセスがないと一時停止することがあります。
  その場合はダッシュボードから再開してください。

---

## 11. 今後の拡張アイデア

- 問題ごとのメモ・復習期限
- 参考書ごとの目標日数と通知
- 月間の学習カレンダー（ヒートマップ）
- ユーザーごとのプロフィール画像
- 先生 / グループ機能（グループコードで分離）

---

Made with ❤️ for 青チャート学習者。

/**
 * チャートログ 設定ファイル
 * ------------------------------------------------------------------
 * このファイルが「環境変数」の代わりです（ビルド不要の静的アプリのため）。
 * Supabase の Project Settings → API から次の2つをコピーして貼り付けてください。
 *
 *   SUPABASE_URL      : Project URL       例) https://abcdefghijklmnop.supabase.co
 *   SUPABASE_ANON_KEY : anon public key   例) eyJhbGciOiJIUzI1NiIs...
 *
 * ・anon key はブラウザに公開される前提のキーです（RLS で保護します）。
 * ・service_role key は絶対にここに書かないでください。
 * ・空のままでも「ローカル保存モード」で動作します（この端末だけ）。
 *
 * 設定後はページを再読み込みしてください。詳しい手順は README.md を参照。
 */
window.APP_CONFIG = {
  SUPABASE_URL: "",
  SUPABASE_ANON_KEY: "",
};

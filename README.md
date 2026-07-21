# 筋トレ記録アプリ（KintoreApp）

筋力トレーニングのセット記録と成長の可視化に加え、**食事・睡眠・体重も一括で記録**できるトレーニング記録 PWA。
要件定義書はネイティブ iOS（Swift/SwiftUI）を前提としていたが、Windows 環境でも開発・公開できるよう、
[fe-master-app](../fe-master-app) と同じ **バニラ JS の PWA** 方式で実装している（将来 Capacitor 化して App Store 公開を想定）。

## 特徴

- **フレームワーク／バンドラなし**・外部 CDN 不使用 → オフラインで全機能が動作
- データは **端末内 localStorage**（名前空間 `kintore:`）に保存。複数端末同期はしない（バックアップ JSON の書き出し／読み込みで機種変更に対応）
- 自前 SVG チャート（`charts.js`）でダーク／ライト両テーマに追従
- 重量は内部を常に **kg** で保持し、表示時に kg／lbs を換算

## 機能（MVP）

| カテゴリ | 内容 |
|---|---|
| ワークアウト記録 | 空 or テンプレから開始／種目追加（検索・部位フィルタ・カスタム種目）／セット記録（重量・回数・前セット引き継ぎ・前回実績の引き継ぎ・完了チェック・ウォームアップ区別・削除）／種目メモ・並べ替え／完了・再開 |
| レストタイマー | セット完了で自動スタート・カウントダウン・バイブ・ビープ・+30s／スキップ |
| 履歴 | 月カレンダー（実施日マーク）／日付降順一覧／セッション詳細（編集・再開・削除） |
| グラフ | 種目別 最大重量／ボリューム推移・自己ベスト・推定 1RM（Epley 式）・部位別ボリューム（直近30日） |
| 体調 | 体重・睡眠時間／質・カロリー・タンパク質・メモを日毎に記録／体重推移グラフ |
| 設定 | 単位（kg/lbs）・言語（日本語/English の下地）・テーマ（自動/ライト/ダーク）・レスト既定秒・データ書き出し／読み込み・記録の全消去 |

## 構成

```
docs/                     … 公開ディレクトリ（GitHub Pages はここを公開）
  index.html              … 5 タブ + 設定のシェル
  manifest.webmanifest    … PWA マニフェスト
  sw.js                   … Service Worker（オフラインキャッシュ。localhost では登録しない）
  css/style.css           … デザイントークン（CSS 変数）とレイアウト
  js/storage.js           … localStorage 永続化レイヤ（Store）
  js/data.js              … 部位マスタ・初期種目34件・単位換算・集計・日付・i18n 下地
  js/charts.js            … 依存なしの自前 SVG チャート
  js/app.js               … 画面描画・ルーティング・イベント処理（[data-act]/[data-in] 委譲）
  icons/                  … アプリアイコン（180/192/512）
server.js                 … ローカル確認用の静的サーバ（本番不要）
```

## ローカルで動かす

```bash
node kintore-app/server.js   # http://localhost:4174
```

（Claude Code のプレビューでは launch.json の `kintore-app` を利用）

## データモデル（論理）

- **Exercise**（種目）: id, name, muscle, custom, order
- **WorkoutSession**（ワークアウト）: id, date, name, note, startedAt, finishedAt, done, exercises[]
- **WorkoutExercise**（実施種目）: id, exerciseId, note, sets[]
- **WorkoutSet**（セット）: id, weight(kg), reps, warmup, done
- **WorkoutTemplate**（テンプレート）: id, name, description, exercises[{ exerciseId, sets, reps, weight }]
- **DailyLog**（体調）: date, sleepHours, sleepQuality, calories, protein, weight, note

## ロードマップ

1. Web 先行公開（GitHub Pages）
2. Capacitor 化 → Codemagic（Mac 不要のクラウド CI）→ App Store
3. フリーミアム課金（ネイティブのみ・Web は全無料）
4. 英語ローカライズの拡大、Apple ヘルスケア連携 等

初版は端末内保存のみ。iCloud 同期・Apple Watch は将来拡張。

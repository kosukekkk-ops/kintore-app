# トレログ（kintore-app）

筋力トレーニングのセット記録と成長の可視化に加え、**食事・睡眠・サプリ・体重も一括で記録**できるトレーニング記録アプリ。
要件定義書はネイティブ iOS（Swift/SwiftUI）を前提としていたが、Windows 環境でも開発・公開できるよう、
[fe-master-app](../fe-master-app) と同じ **バニラ JS の PWA + Capacitor** 方式で実装している。

- Web 版: https://kosukekkk-ops.github.io/kintore-app/
- iOS 版: App Store（Capacitor + Codemagic のクラウドビルド。→ [リリース手順](#リリース手順appstore)）

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
  js/premium.js           … 買い切り IAP の状態管理・無料枠の定義（線引きの単一の出典）
  js/legal.js             … 利用規約／プライバシーポリシー本文（アプリ内と公開ページで共用）
  js/data.js              … 部位マスタ・初期種目88件・単位換算・集計・日付・i18n
  js/charts.js            … 依存なしの自前 SVG チャート
  js/app.js               … 画面描画・ルーティング・イベント処理（[data-act]/[data-in] 委譲）
  privacy.html terms.html … 公開用の法務ページ（App Store 審査で必須）
  icons/                  … アプリアイコン（180/192/512）
ios/ android/             … Capacitor が生成するネイティブプロジェクト
capacitor.config.json     … appId / appName / webDir=docs
codemagic.yaml            … ビルド〜審査提出のワークフロー定義
store/                    … 掲載メタデータ・スクリーンショット・IAP 審査用スクショ
tools/                    … アイコン生成・スクショ生成・課金まわりのテスト
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

## リリース手順（App Store）

FE 対策アプリと同じパイプライン。**Mac は不要**で、Codemagic のクラウド Mac がビルドし、
App Store Connect API で掲載情報から審査提出までを自動で行う。

### 一度だけの準備（手作業）

1. **Apple Developer** → Certificates, Identifiers & Profiles → Identifiers →
   App ID `io.github.kosukekkkops.torelog` を登録
2. **App Store Connect** → マイ App → ＋ → 新規 App
   - プラットフォーム: iOS / 名前: `トレログ 筋トレ×睡眠×食事の記録`
   - プライマリ言語: 日本語 / バンドル ID: 上で作ったもの / SKU: 任意
   - ※App の作成だけは API で行えないため、ここだけ Web 画面で操作する
3. **Codemagic** にこのリポジトリを追加し、環境変数グループ `appstore` を作る
   （4 つとも Secure = ON。**FE 対策アプリで登録済みの値をそのまま使い回せる**）
   - `APP_STORE_CONNECT_ISSUER_ID` / `APP_STORE_CONNECT_KEY_IDENTIFIER`
   - `APP_STORE_CONNECT_PRIVATE_KEY`（.p8 の中身）
   - `CERTIFICATE_PRIVATE_KEY`（`C:\Users\kosuk\Documents\codemagic_cert_key.pem` の中身）
4. **有料 App 契約**（Paid Apps Agreement）を有効にする ← IAP の作成にはこれが必須

アプリの数値 ID と IAP の ID は、バンドル ID / プロダクト ID から毎回 API で引き当てるので
どこにも貼り付けない（貼り間違いで別アプリを更新する事故を防ぐため）。

### 実行順（Codemagic の workflow を順に流す）

| # | workflow | やること |
|---|---|---|
| 1 | `ios-release` | npm ci → dev ページ除去 → `cap sync` → 署名 → ビルド → TestFlight |
| 2 | `iap-setup` | プレミアム（非消耗型 ¥720）を作成・日本語名・価格・全地域販売 |
| 3 | `release-prep` | 掲載情報・審査連絡先・年齢制限・著作権・価格（無料）・IAP 審査用スクショ |
| 4 | `screenshots-upload` | `store/screenshots/*.png` をアップロード |
| 5 | `release-submit` | 最新ビルドを紐付け、**バージョン＋IAP** をまとめて審査提出 |

- `status-check` … いつでも実行可（読み取り専用でバージョン・IAP・提出状態を表示）
- `fix-availability` … 審査通過後どのストアにも出ないときに配信地域を全世界へ

IAP を提出物に含め忘れるとガイドライン 2.1(b) で差し戻されるため、
`release-submit` は常にバージョンと IAP を同じ提出物に入れる。

### バージョンを上げるとき

1. `ios/App/App.xcodeproj/project.pbxproj` の `MARKETING_VERSION` を上げる
2. `docs/sw.js` の `CACHE` 版数を上げる（Web 版のキャッシュ更新）
3. `ios-release` を流す
4. `release-submit` の `NEW_VERSION` と `WHATS_NEW` を設定して流す

### リリース前チェック

```bash
node tools/check-codemagic.js
```

codemagic.yaml を触ったら push する前に流す。CodemagicはYAMLとして正しくても
スキーマ検証で弾くことがあり(例: 環境変数の空文字は "at least 1 characters" で
落ちる)、それは画面に貼るまで気づけない。識別子の食い違いや、Windowsで
cap sync した際に Package.swift のパスが  区切りになる件もここで捕まえる。

### ストア素材の作り直し

```bash
node tools/build-icons.js                 # アイコンとスプラッシュ（PWA + iOS）
node tools/screenshots/prepare.js         # docs/ を撮影用に複製
node tools/screenshots/capture.js         # 1290x2796 で 5 画面を撮影
node tools/screenshots/compose.js         # コピーを載せて store/ へ
node tools/screenshots/capture.js paywall # IAP 審査用（購入画面）
```

掲載文面の原本は [store/app-store-metadata.md](store/app-store-metadata.md)。

## 課金（買い切りプレミアム）

記録アプリで記録そのものを制限すると即アンインストールされるため、**入力・保存は一切制限しない**。
制限するのは「積み上げ」と「分析」のみ。線引きの単一の出典は `docs/js/premium.js` の `LIMITS`。

| | 無料 | プレミアム（¥720 買い切り） |
|---|---|---|
| ワークアウト／睡眠／食事／体重の記録 | 無制限 | 無制限 |
| バランス（記録状況・7 日達成度） | ○ | ○ |
| バランスの 14 日推移 | ✕ | ○ |
| 種目別グラフ・自己ベスト・部位別ボリューム | ✕ | ○ |
| メニュー（テンプレート） | 3 件 | 無制限 |
| サプリの登録 | 3 件 | 無制限 |
| バックアップの書き出し | ✕ | ○ |

Web 版はストア（StoreKit）が無いので `Premium.unlocked()` が常に true = 全機能開放。
課金は App Store 版のみ。

```bash
node tools/test-premium.js   # 無料/購入済み/復元/返金/競合の33項目を自動検証
```

## ロードマップ

1. ~~Web 先行公開（GitHub Pages）~~ 完了
2. ~~Capacitor 化 → Codemagic → App Store~~ 完了（審査提出待ち）
3. ~~フリーミアム課金（ネイティブのみ・Web は全無料）~~ 完了
4. 英語ローカライズの拡大、Apple ヘルスケア連携 等

初版は端末内保存のみ。iCloud 同期・Apple Watch は将来拡張。

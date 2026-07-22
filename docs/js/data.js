/* data.js — マスタデータと共通ユーティリティ
 *  - 部位(筋肉群)の定義と表示ラベル/カラークラス
 *  - 初回起動時に登録する初期種目(約30種目)
 *  - 単位換算(内部kg ⇔ 表示kg/lbs)、ボリューム・1RM 計算、日付整形
 *  - i18n(ja/en)。UI文字列は t(key) 経由で取得し、言語設定で切り替える。
 */
const Data = (() => {
  const lang = () => (typeof Store !== 'undefined' && Store.getSettings().lang) || 'ja';

  /* ---------- 部位マスタ ---------- */
  const MUSCLES = [
    { key: 'chest',    ja: '胸',     en: 'Chest',     cls: 'm-chest' },
    { key: 'back',     ja: '背中',   en: 'Back',      cls: 'm-back' },
    { key: 'legs',     ja: '脚',     en: 'Legs',      cls: 'm-legs' },
    { key: 'shoulder', ja: '肩',     en: 'Shoulders', cls: 'm-shoulder' },
    { key: 'arm',      ja: '腕',     en: 'Arms',      cls: 'm-arm' },
    { key: 'abs',      ja: '腹・体幹', en: 'Core',      cls: 'm-abs' },
    { key: 'cardio',   ja: '有酸素',   en: 'Cardio',    cls: 'm-cardio' }
  ];
  const muscleMap = Object.fromEntries(MUSCLES.map(m => [m.key, m]));
  function muscleName(key) { const m = muscleMap[key]; return m ? (lang() === 'en' ? m.en : m.ja) : key; }
  const isCardioMuscle = (key) => key === 'cardio';

  // サブ部位の表示順(部位内でのグループ見出しの並び)
  const SUB_ORDER = ['大腿四頭筋', 'ハムストリングス', '臀部', '内転・外転', 'ふくらはぎ', '上腕二頭筋', '上腕三頭筋'];

  /* ---------- 初期種目。muscle=部位, sub=サブ部位(任意), equip=器具, en=英語名(任意) ---------- */
  const SEED_VERSION = 2; // これを上げると既存ユーザーにも不足分の初期種目が追加される
  const SEED_EXERCISES = [
    // 胸
    { name: 'ベンチプレス', en: 'Bench Press', muscle: 'chest', equip: 'フリー' },
    { name: 'ダンベルベンチプレス', en: 'Dumbbell Bench Press', muscle: 'chest', equip: 'フリー' },
    { name: 'インクラインベンチプレス', en: 'Incline Bench Press', muscle: 'chest', equip: 'フリー' },
    { name: 'ダンベルフライ', en: 'Dumbbell Fly', muscle: 'chest', equip: 'フリー' },
    { name: 'チェストプレス', en: 'Chest Press', muscle: 'chest', equip: 'マシン' },
    { name: 'インクラインチェストプレス', muscle: 'chest', equip: 'マシン' },
    { name: 'デクラインチェストプレス', muscle: 'chest', equip: 'マシン' },
    { name: 'ペックフライ', en: 'Pec Fly', muscle: 'chest', equip: 'マシン' },
    { name: 'ケーブルフライ', muscle: 'chest', equip: 'ケーブル' },
    { name: 'ケーブルクロスオーバー', muscle: 'chest', equip: 'ケーブル' },
    { name: 'アイソラテラルチェストプレス', muscle: 'chest', equip: 'プレート' },
    { name: 'ハンマーストレングス チェストプレス', muscle: 'chest', equip: 'マシン' },
    { name: '腕立て伏せ', en: 'Push-up', muscle: 'chest', equip: '自重' },
    // 背中
    { name: 'デッドリフト', en: 'Deadlift', muscle: 'back', equip: 'フリー' },
    { name: 'ラットプルダウン', en: 'Lat Pulldown', muscle: 'back', equip: 'マシン' },
    { name: 'フロントラットプルダウン', muscle: 'back', equip: 'マシン' },
    { name: 'アイソラテラルラットプル', muscle: 'back', equip: 'マシン' },
    { name: '懸垂（チンニング）', en: 'Pull-up', muscle: 'back', equip: '自重' },
    { name: 'シーテッドロー', en: 'Seated Row', muscle: 'back', equip: 'マシン' },
    { name: 'ローロー', muscle: 'back', equip: 'マシン' },
    { name: 'DYロー', muscle: 'back', equip: 'マシン' },
    { name: 'アイソラテラルロー', muscle: 'back', equip: 'マシン' },
    { name: 'Tバーロー', muscle: 'back', equip: 'プレート' },
    { name: 'ハイロー', muscle: 'back', equip: 'マシン' },
    { name: 'ケーブルロー', muscle: 'back', equip: 'ケーブル' },
    { name: 'ベントオーバーロウ', en: 'Bent-over Row', muscle: 'back', equip: 'フリー' },
    { name: 'ワンハンドダンベルロウ', en: 'One-arm Row', muscle: 'back', equip: 'フリー' },
    { name: 'プルオーバーマシン', muscle: 'back', equip: 'マシン' },
    { name: 'ノーチラス プルオーバー', muscle: 'back', equip: 'マシン' },
    { name: 'ハンマーストレングス ローロー', muscle: 'back', equip: 'マシン' },
    { name: 'ハンマーストレングス DYロー', muscle: 'back', equip: 'マシン' },
    // 肩
    { name: 'ショルダープレス', en: 'Shoulder Press', muscle: 'shoulder', equip: 'マシン' },
    { name: 'アイソラテラルショルダープレス', muscle: 'shoulder', equip: 'マシン' },
    { name: 'サイドレイズ', en: 'Side Raise', muscle: 'shoulder', equip: 'フリー' },
    { name: 'フロントレイズ', en: 'Front Raise', muscle: 'shoulder', equip: 'フリー' },
    { name: 'リアデルトフライ', en: 'Rear Delt Fly', muscle: 'shoulder', equip: 'マシン' },
    // 腕
    { name: 'アームカール', muscle: 'arm', sub: '上腕二頭筋', equip: 'マシン' },
    { name: 'バーベルカール', en: 'Barbell Curl', muscle: 'arm', sub: '上腕二頭筋', equip: 'フリー' },
    { name: 'ダンベルカール', en: 'Dumbbell Curl', muscle: 'arm', sub: '上腕二頭筋', equip: 'フリー' },
    { name: 'ハンマーカール', en: 'Hammer Curl', muscle: 'arm', sub: '上腕二頭筋', equip: 'フリー' },
    { name: 'プリーチャーカール', muscle: 'arm', sub: '上腕二頭筋', equip: 'マシン' },
    { name: 'トライセプスプレスダウン', en: 'Triceps Pushdown', muscle: 'arm', sub: '上腕三頭筋', equip: 'ケーブル' },
    { name: 'トライセプスエクステンション', muscle: 'arm', sub: '上腕三頭筋', equip: 'マシン' },
    { name: 'シーテッドディップ', muscle: 'arm', sub: '上腕三頭筋', equip: 'マシン' },
    { name: 'アシストディップ', muscle: 'arm', sub: '上腕三頭筋', equip: 'マシン' },
    { name: 'フレンチプレス', en: 'French Press', muscle: 'arm', sub: '上腕三頭筋', equip: 'フリー' },
    // 脚
    { name: 'スクワット', en: 'Squat', muscle: 'legs', sub: '大腿四頭筋', equip: 'フリー' },
    { name: 'レッグプレス', en: 'Leg Press', muscle: 'legs', sub: '大腿四頭筋', equip: 'マシン' },
    { name: 'ハックスクワット', muscle: 'legs', sub: '大腿四頭筋', equip: 'マシン' },
    { name: 'スクワットプレス', muscle: 'legs', sub: '大腿四頭筋', equip: 'マシン' },
    { name: 'レッグエクステンション', en: 'Leg Extension', muscle: 'legs', sub: '大腿四頭筋', equip: 'マシン' },
    { name: 'プレートロードレッグプレス', muscle: 'legs', sub: '大腿四頭筋', equip: 'プレート' },
    { name: 'ブルガリアンスクワット', en: 'Bulgarian Split Squat', muscle: 'legs', sub: '大腿四頭筋', equip: 'フリー' },
    { name: 'スミスマシン スクワット', muscle: 'legs', sub: '大腿四頭筋', equip: 'スミス' },
    { name: 'シーテッドレッグカール', muscle: 'legs', sub: 'ハムストリングス', equip: 'マシン' },
    { name: 'ライイングレッグカール', muscle: 'legs', sub: 'ハムストリングス', equip: 'マシン' },
    { name: 'スタンディングレッグカール', muscle: 'legs', sub: 'ハムストリングス', equip: 'マシン' },
    { name: 'ヒップスラスト', en: 'Hip Thrust', muscle: 'legs', sub: '臀部', equip: 'マシン' },
    { name: 'グルートドライブ', muscle: 'legs', sub: '臀部', equip: 'マシン' },
    { name: 'ブーティビルダー', muscle: 'legs', sub: '臀部', equip: 'マシン' },
    { name: 'グルートマシン', muscle: 'legs', sub: '臀部', equip: 'マシン' },
    { name: 'アダクター', muscle: 'legs', sub: '内転・外転', equip: 'マシン' },
    { name: 'アブダクター', muscle: 'legs', sub: '内転・外転', equip: 'マシン' },
    { name: 'シーテッドカーフレイズ', muscle: 'legs', sub: 'ふくらはぎ', equip: 'マシン' },
    { name: 'スタンディングカーフレイズ', muscle: 'legs', sub: 'ふくらはぎ', equip: 'マシン' },
    { name: 'レッグプレスカーフ', muscle: 'legs', sub: 'ふくらはぎ', equip: 'マシン' },
    // 腹・体幹
    { name: 'アブドミナルクランチ', muscle: 'abs', equip: 'マシン' },
    { name: 'クランチ', en: 'Crunch', muscle: 'abs', equip: '自重' },
    { name: 'レッグレイズ', en: 'Leg Raise', muscle: 'abs', equip: '自重' },
    { name: 'プランク', en: 'Plank', muscle: 'abs', equip: '自重' },
    { name: 'トーソローテーション', muscle: 'abs', equip: 'マシン' },
    { name: 'バックエクステンション', muscle: 'abs', equip: 'マシン' },
    { name: 'ローマンチェア', muscle: 'abs', equip: 'マシン' },
    { name: 'GHD（グルートハムデベロッパー）', muscle: 'abs', equip: 'マシン' },
    // 有酸素
    { name: 'ランニング', en: 'Running', muscle: 'cardio', equip: '有酸素' },
    { name: 'トレッドミル', muscle: 'cardio', equip: '有酸素' },
    { name: 'クロストレーナー', muscle: 'cardio', equip: '有酸素' },
    { name: 'エアロバイク', muscle: 'cardio', equip: '有酸素' },
    { name: 'リカンベントバイク', muscle: 'cardio', equip: '有酸素' },
    { name: 'ステアクライマー', muscle: 'cardio', equip: '有酸素' },
    { name: 'ローイングエルゴメーター', muscle: 'cardio', equip: '有酸素' },
    { name: 'サイクリング', en: 'Cycling', muscle: 'cardio', equip: '有酸素' },
    { name: 'ウォーキング', en: 'Walking', muscle: 'cardio', equip: '有酸素' }
  ];

  /* ---------- 単位換算(内部は常に kg) ---------- */
  const KG_TO_LB = 2.2046226218;
  const round1 = (n) => Math.round(n * 10) / 10;
  function kgToDisplay(kg, unit) { if (kg == null || isNaN(kg)) return 0; return round1(unit === 'lbs' ? kg * KG_TO_LB : kg); }
  function displayToKg(v, unit) { const n = parseFloat(v); if (isNaN(n)) return 0; return unit === 'lbs' ? n / KG_TO_LB : n; }
  const unitLabel = (unit) => (unit === 'lbs' ? 'lbs' : 'kg');
  function fmtNum(n) { if (n == null || isNaN(n)) return '0'; return String(round1(n)); }

  /* ---------- 集計(有酸素セットは weight/reps を持たないので自然に0) ---------- */
  function sessionVolumeKg(session) {
    let v = 0;
    (session.exercises || []).forEach(we => (we.sets || []).forEach(s => {
      if (!s.warmup && s.done && typeof s.weight === 'number') v += (s.weight || 0) * (s.reps || 0);
    }));
    return v;
  }
  function sessionSetCount(session) {
    let c = 0;
    (session.exercises || []).forEach(we => (we.sets || []).forEach(s => { if (!s.warmup) c += 1; }));
    return c;
  }
  function estimate1RM(weightKg, reps) {
    if (!weightKg || !reps) return 0;
    if (reps === 1) return weightKg;
    return weightKg * (1 + reps / 30);
  }

  /* ---------- 日付ユーティリティ(ja/en ロケール対応) ---------- */
  const pad = (n) => String(n).padStart(2, '0');
  function dateKey(d) { const x = new Date(d); return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`; }
  function todayKey() { return dateKey(new Date()); }
  const DOW_JA = ['日', '月', '火', '水', '木', '金', '土'];
  const DOW_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MON_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  function dow() { return lang() === 'en' ? DOW_EN : DOW_JA; }
  function fmtDate(key) {
    const [y, m, d] = key.split('-').map(Number);
    const dt = new Date(y, m - 1, d);
    return lang() === 'en' ? `${DOW_EN[dt.getDay()]}, ${MON_EN[m - 1]} ${d}` : `${m}月${d}日(${DOW_JA[dt.getDay()]})`;
  }
  function fmtDateShort(key) { const [, m, d] = key.split('-').map(Number); return `${m}/${d}`; }
  function fmtMonthYear(y, m) { return lang() === 'en' ? `${MON_EN[m]} ${y}` : `${y}年 ${m + 1}月`; }
  function fmtClock(sec) { const m = Math.floor(sec / 60), s = sec % 60; return `${m}:${pad(s)}`; }

  /* ---------- i18n 辞書 ---------- */
  const I18N = {
    ja: {
      tab_record: '記録', tab_history: '履歴', tab_graph: 'グラフ', tab_menu: 'メニュー', tab_condition: '体調', tab_settings: '設定',
      settings: '設定', back: '戻る', save: '保存', saved: '保存しました', delete: '削除', cancel: 'キャンセル', run: '実行する', confirm: '確認', start: '開始',
      // workout home
      h_record: '記録', a_settings: '設定', in_progress: '進行中のワークアウト', start_new: '＋ 新しいワークアウトを開始',
      start_from_tpl: 'テンプレートから開始', no_tpl_hint: '「メニュー」タブでよく行う種目の組み合わせを登録すると、ここからすぐ開始できます。',
      recent: '最近のワークアウト', no_records: 'まだ記録がありません。最初のワークアウトを始めましょう。',
      n_exercises: '{n}種目', n_sets: '{n}セット',
      app_title: '筋トレ記録', load_7d: '合計負荷量 / 7日間', load_28d: '合計負荷量 / 28日間', load_total: '総合計負荷量',
      weekly_load: '週別の負荷量', wk_now: '今週', wk_ago: '{n}週前',
      add_today: '本日のトレーニングを追加', rm_calc: 'RM計算機',
      rm_title: '1RM 計算機', rm_weight: '挙上重量（{u}）', rm_reps: '回数', rm_est: '推定 1RM',
      rm_hint: '重量と回数から最大挙上重量(1RM)を推定します（Epley式）。%表は各割合での目安重量です。',
      // session editor
      to_home: 'ホームへ', to_history: '履歴へ', workout_name_ph: 'ワークアウト名(任意)',
      empty_ex: '種目を追加してセットを記録しましょう', add_exercise: '＋ 種目を追加',
      session_note: 'セッションメモ', session_note_ph: '全体の気づき・体調など', discard: '破棄', finish_save: '完了して保存', save_do: '保存する',
      col_set: '#', col_reps: '回', col_done: '済', col_min: '分', col_km: 'km', add_set: '＋ セット', add_warm: '＋ ウォームアップ',
      no_exercise_toast: '種目がありません', saved_workout: 'ワークアウトを保存しました 💪', discard_confirm: 'このワークアウトを破棄しますか？',
      // picker
      pick_title: '種目を選ぶ', search_ph: '🔍 種目名・器具で検索', all: 'すべて', no_match: '該当する種目がありません', add_custom: '＋ カスタム種目を追加', recent_ex: '最近使った種目',
      about_ex: 'ⓘ この種目について', worked_muscles: '鍛える筋肉', front: '正面', back: '背面', pose_label: '動作イメージ',
      see_images: '🔍 画像で見る（Google）', see_video: '▶ 動画で見る（YouTube）', info_ext_note: '画像・動画は外部サイト（Google／YouTube）をブラウザで開きます。',
      custom_title: 'カスタム種目を追加', ex_name: '種目名', ex_name_ph: '例: ケーブルクロスオーバー', part: '部位', add_do: '追加する',
      need_name: '種目名を入力してください', ex_added: '種目を追加しました',
      // ex menu
      ex_note: '種目メモ', save_note: 'メモを保存', move_up: '↑ 上へ', move_down: '↓ 下へ', remove_ex: 'この種目を削除', note_saved: 'メモを保存しました',
      // timer
      rest: 'レスト', rest_done: '休憩おわり 💪', ok: 'OK', skip: 'スキップ',
      // history
      h_history: '履歴', all_records: 'すべての記録（{n}件）', history_empty: '完了したワークアウトがここに表示されます。',
      col_exercises: '種目', col_sets2: 'セット', col_total: '総量', edit_resume: '編集・再開', del_confirm: 'このワークアウトを削除しますか？',
      // graph
      h_graph: 'グラフ', graph_empty: 'ワークアウトを記録すると、種目ごとの推移がここに表示されます', exercise: '種目',
      m_max: '最大重量', m_volume: 'ボリューム', m_duration: '時間', m_distance: '距離',
      trend_max: '最大重量の推移', trend_volume: 'ボリュームの推移', trend_duration: '時間の推移（分）', trend_distance: '距離の推移（km）',
      pb_best: '自己ベスト', pb_maxvol: '最大ボリューム', pb_1rm: '推定1RM', pb_longest_t: '最長時間(分)', pb_longest_d: '最長距離(km)', pb_sessions: 'セッション数',
      muscle_vol: '部位別ボリューム（直近30日・{u}）',
      // menu
      h_menu: 'メニュー', a_new_tpl: 'テンプレートを作成', menu_empty: 'よく行う種目の組み合わせをテンプレートとして登録できます', create_tpl: '＋ テンプレートを作成',
      no_ex_set: '種目未設定', template: 'テンプレート', name: '名前', name_ph: '例: 胸の日 / プッシュ', desc: '説明(任意)', desc_ph: '例: 週2回・胸と三頭',
      ex_and_target: '種目と目標', tpl_hint: '種目を追加して、目標のセット数・回数・重量を設定します。', t_sets: 'セット', t_reps: '回数', t_min: '時間(分)', t_km: '距離(km)',
      del_tpl: 'このテンプレートを削除', tpl_saved: 'テンプレートを保存しました', tpl_del_confirm: 'このテンプレートを削除しますか？',
      // condition
      h_condition: '体調', a_cond_today: '今日の体調を記録', weight_trend: '体重の推移（{u}）', cond_today_btn: '＋ 今日の体調を記録',
      record_list: '記録一覧', cond_empty: '睡眠・食事・体重を記録すると、トレーニングと合わせて振り返れます。', note_only: 'メモのみ',
      c_weight: '体重（{u}）', c_sleep: '睡眠時間（時間）', c_quality: '睡眠の質', c_cal: 'カロリー（kcal）', c_protein: 'タンパク質（g）', c_note: 'メモ', c_note_ph: '体調・気づきなど',
      cond_saved: '体調を記録しました', cond_del_confirm: 'この記録を削除しますか？',
      // settings
      s_unit: '単位', s_lang: '言語 / Language', s_lang_hint: '選んだ言語でアプリ全体の表示が切り替わります。', s_appearance: '外観',
      th_auto: '自動', th_light: 'ライト', th_dark: 'ダーク', s_rest: 'レストタイマー', rest_default: '既定の休憩時間（秒）', rest_auto: 'セット完了で自動スタート',
      on: 'ON', off: 'OFF', s_data: 'データ', export_btn: 'バックアップを書き出す（JSON）', import_btn: 'バックアップを読み込む', reset_btn: '記録データを全消去',
      data_hint: 'データはこの端末内にのみ保存されます。機種変更の際は書き出したJSONを新しい端末で読み込んでください。',
      reset_confirm: 'すべての記録データ（ワークアウト・テンプレート・体調）を消去します。よろしいですか？', reset_done: '記録を消去しました',
      exported: 'バックアップを書き出しました', import_failed: '読み込みに失敗しました', imported: '読み込み完了(種目{e}・記録{s})',
      pick_day: '', // (日付見出しはfmtDate)
      version: '筋トレ記録 v1.0'
    },
    en: {
      tab_record: 'Record', tab_history: 'History', tab_graph: 'Graph', tab_menu: 'Menu', tab_condition: 'Health', tab_settings: 'Settings',
      settings: 'Settings', back: 'Back', save: 'Save', saved: 'Saved', delete: 'Delete', cancel: 'Cancel', run: 'Confirm', confirm: 'Confirm', start: 'Start',
      h_record: 'Record', a_settings: 'Settings', in_progress: 'Workout in progress', start_new: '＋ Start a new workout',
      start_from_tpl: 'Start from template', no_tpl_hint: 'Save your favorite exercise combos in the Menu tab to start them instantly here.',
      recent: 'Recent workouts', no_records: 'No records yet. Start your first workout!',
      n_exercises: '{n} exercises', n_sets: '{n} sets',
      app_title: 'Kintore Log', load_7d: 'Total load / 7 days', load_28d: 'Total load / 28 days', load_total: 'All-time load',
      weekly_load: 'Weekly load', wk_now: 'This wk', wk_ago: '{n} wk ago',
      add_today: "Add today's workout", rm_calc: 'RM calc',
      rm_title: '1RM Calculator', rm_weight: 'Weight lifted ({u})', rm_reps: 'Reps', rm_est: 'Est. 1RM',
      rm_hint: 'Estimates your 1-rep max from a set (Epley). The % table shows target weights at each percentage.',
      to_home: 'Home', to_history: 'History', workout_name_ph: 'Workout name (optional)',
      empty_ex: 'Add exercises and record your sets', add_exercise: '＋ Add exercise',
      session_note: 'Session note', session_note_ph: 'Overall notes, condition, etc.', discard: 'Discard', finish_save: 'Finish & save', save_do: 'Save',
      col_set: '#', col_reps: 'reps', col_done: '✓', col_min: 'min', col_km: 'km', add_set: '＋ Set', add_warm: '＋ Warm-up',
      no_exercise_toast: 'No exercises', saved_workout: 'Workout saved 💪', discard_confirm: 'Discard this workout?',
      pick_title: 'Choose exercise', search_ph: '🔍 Search name or gear', all: 'All', no_match: 'No matching exercise', add_custom: '＋ Add custom exercise', recent_ex: 'Recently used',
      about_ex: 'ⓘ About this exercise', worked_muscles: 'Muscles worked', front: 'Front', back: 'Back', pose_label: 'Movement',
      see_images: '🔍 See images (Google)', see_video: '▶ Watch video (YouTube)', info_ext_note: 'Images/videos open Google/YouTube in your browser.',
      custom_title: 'Add custom exercise', ex_name: 'Exercise name', ex_name_ph: 'e.g. Cable Crossover', part: 'Muscle group', add_do: 'Add',
      need_name: 'Please enter a name', ex_added: 'Exercise added',
      ex_note: 'Exercise note', save_note: 'Save note', move_up: '↑ Up', move_down: '↓ Down', remove_ex: 'Remove this exercise', note_saved: 'Note saved',
      rest: 'Rest', rest_done: 'Rest over 💪', ok: 'OK', skip: 'Skip',
      h_history: 'History', all_records: 'All records ({n})', history_empty: 'Completed workouts will appear here.',
      col_exercises: 'exercises', col_sets2: 'sets', col_total: 'total', edit_resume: 'Edit / resume', del_confirm: 'Delete this workout?',
      h_graph: 'Graph', graph_empty: 'Record a workout to see progress per exercise here', exercise: 'Exercise',
      m_max: 'Max weight', m_volume: 'Volume', m_duration: 'Duration', m_distance: 'Distance',
      trend_max: 'Max weight trend', trend_volume: 'Volume trend', trend_duration: 'Duration trend (min)', trend_distance: 'Distance trend (km)',
      pb_best: 'Personal best', pb_maxvol: 'Max volume', pb_1rm: 'Est. 1RM', pb_longest_t: 'Longest (min)', pb_longest_d: 'Longest (km)', pb_sessions: 'Sessions',
      muscle_vol: 'Volume by muscle (last 30 days, {u})',
      h_menu: 'Menu', a_new_tpl: 'Create template', menu_empty: 'Save frequent exercise combos as templates', create_tpl: '＋ Create template',
      no_ex_set: 'No exercises set', template: 'Template', name: 'Name', name_ph: 'e.g. Chest Day / Push', desc: 'Description (optional)', desc_ph: 'e.g. 2x/week, chest & triceps',
      ex_and_target: 'Exercises & targets', tpl_hint: 'Add exercises and set target sets, reps and weight.', t_sets: 'Sets', t_reps: 'Reps', t_min: 'Time (min)', t_km: 'Dist (km)',
      del_tpl: 'Delete this template', tpl_saved: 'Template saved', tpl_del_confirm: 'Delete this template?',
      h_condition: 'Health', a_cond_today: "Log today's health", weight_trend: 'Weight trend ({u})', cond_today_btn: "＋ Log today's health",
      record_list: 'Records', cond_empty: 'Log sleep, food and weight to review alongside training.', note_only: 'Note only',
      c_weight: 'Weight ({u})', c_sleep: 'Sleep (hours)', c_quality: 'Sleep quality', c_cal: 'Calories (kcal)', c_protein: 'Protein (g)', c_note: 'Note', c_note_ph: 'Condition, notes, etc.',
      cond_saved: 'Health logged', cond_del_confirm: 'Delete this record?',
      s_unit: 'Units', s_lang: 'Language / 言語', s_lang_hint: 'The whole app switches to the selected language.', s_appearance: 'Appearance',
      th_auto: 'Auto', th_light: 'Light', th_dark: 'Dark', s_rest: 'Rest timer', rest_default: 'Default rest (seconds)', rest_auto: 'Auto-start on set complete',
      on: 'ON', off: 'OFF', s_data: 'Data', export_btn: 'Export backup (JSON)', import_btn: 'Import backup', reset_btn: 'Erase all records',
      data_hint: 'Data is stored only on this device. To move to a new device, export the JSON and import it there.',
      reset_confirm: 'This erases all records (workouts, templates, health). Are you sure?', reset_done: 'Records erased',
      exported: 'Backup exported', import_failed: 'Import failed', imported: 'Imported ({e} exercises, {s} records)',
      pick_day: '',
      version: 'Kintore Log v1.0'
    }
  };
  function t(key, params) {
    const l = lang();
    let s = (I18N[l] && I18N[l][key] != null) ? I18N[l][key] : (I18N.ja[key] != null ? I18N.ja[key] : key);
    if (params) Object.keys(params).forEach(k => { s = s.replace(new RegExp('\\{' + k + '\\}', 'g'), params[k]); });
    return s;
  }

  return {
    MUSCLES, muscleMap, muscleName, isCardioMuscle, SEED_EXERCISES, SEED_VERSION, SUB_ORDER,
    KG_TO_LB, kgToDisplay, displayToKg, unitLabel, fmtNum,
    sessionVolumeKg, sessionSetCount, estimate1RM,
    dateKey, todayKey, fmtDate, fmtDateShort, fmtMonthYear, fmtClock, dow, DOW_JA,
    I18N, t, lang
  };
})();

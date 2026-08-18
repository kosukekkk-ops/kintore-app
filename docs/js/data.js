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

  // 器具ラベル(種目マスタは日本語で保持し、表示時だけ englishize する)
  const EQUIP_EN = { 'フリー': 'Free weight', 'マシン': 'Machine', 'ケーブル': 'Cable', 'プレート': 'Plate', '自重': 'Bodyweight', 'スミス': 'Smith', '有酸素': 'Cardio' };
  function equipName(e) { return (lang() === 'en' && EQUIP_EN[e]) ? EQUIP_EN[e] : (e || ''); }
  // サブ部位ラベル
  const SUB_EN = { '大腿四頭筋': 'Quads', 'ハムストリングス': 'Hamstrings', '臀部': 'Glutes', '内転・外転': 'Adductors', 'ふくらはぎ': 'Calves', '上腕二頭筋': 'Biceps', '上腕三頭筋': 'Triceps' };
  function subName(s) { return (lang() === 'en' && SUB_EN[s]) ? SUB_EN[s] : (s || ''); }

  // サブ部位の表示順(部位内でのグループ見出しの並び)
  const SUB_ORDER = ['大腿四頭筋', 'ハムストリングス', '臀部', '内転・外転', 'ふくらはぎ', '上腕二頭筋', '上腕三頭筋'];

  /* ---------- 初期種目。muscle=部位, sub=サブ部位(任意), equip=器具, en=英語名(任意) ---------- */
  // これを上げると既存ユーザーにも不足分の追加＋メタ情報の反映が走る。
  // v5: シュラッグを肩→背中へ訂正(僧帽筋のため)。ユーザーが自分で部位を変えた種目は触らない。
  const SEED_VERSION = 5;
  // 廃止した初期種目(未使用なら移行時に削除)。肩を10種に拡張した際の統合対象。
  const DEPRECATED_EXERCISES = ['アイソラテラルショルダープレス', 'リアデルトフライ'];
  const SEED_EXERCISES = [
    // 胸
    { name: 'ベンチプレス', en: 'Bench Press', muscle: 'chest', equip: 'フリー' },
    { name: 'ダンベルベンチプレス', en: 'Dumbbell Bench Press', muscle: 'chest', equip: 'フリー' },
    { name: 'インクラインベンチプレス', en: 'Incline Bench Press', muscle: 'chest', equip: 'フリー' },
    { name: 'ダンベルフライ', en: 'Dumbbell Fly', muscle: 'chest', equip: 'フリー' },
    { name: 'チェストプレス', en: 'Chest Press', muscle: 'chest', equip: 'マシン' },
    { name: 'インクラインチェストプレス', en: 'Incline Chest Press', muscle: 'chest', equip: 'マシン' },
    { name: 'デクラインチェストプレス', en: 'Decline Chest Press', muscle: 'chest', equip: 'マシン' },
    { name: 'ペックフライ', en: 'Pec Fly', muscle: 'chest', equip: 'マシン' },
    { name: 'ケーブルフライ', en: 'Cable Fly', muscle: 'chest', equip: 'ケーブル' },
    { name: 'ケーブルクロスオーバー', en: 'Cable Crossover', muscle: 'chest', equip: 'ケーブル' },
    { name: 'アイソラテラルチェストプレス', en: 'Iso-Lateral Chest Press', muscle: 'chest', equip: 'プレート' },
    { name: 'ハンマーストレングス チェストプレス', en: 'Hammer Strength Chest Press', muscle: 'chest', equip: 'マシン' },
    { name: '腕立て伏せ', en: 'Push-up', muscle: 'chest', equip: '自重' },
    // 背中
    { name: 'デッドリフト', en: 'Deadlift', muscle: 'back', equip: 'フリー' },
    { name: 'ラットプルダウン', en: 'Lat Pulldown', muscle: 'back', equip: 'マシン' },
    { name: 'フロントラットプルダウン', en: 'Front Lat Pulldown', muscle: 'back', equip: 'マシン' },
    { name: 'アイソラテラルラットプル', en: 'Iso-Lateral Lat Pulldown', muscle: 'back', equip: 'マシン' },
    { name: '懸垂（チンニング）', en: 'Pull-up', muscle: 'back', equip: '自重' },
    { name: 'シーテッドロー', en: 'Seated Row', muscle: 'back', equip: 'マシン' },
    { name: 'ローロー', en: 'Low Row', muscle: 'back', equip: 'マシン' },
    { name: 'DYロー', en: 'DY Row', muscle: 'back', equip: 'マシン' },
    { name: 'アイソラテラルロー', en: 'Iso-Lateral Row', muscle: 'back', equip: 'マシン' },
    { name: 'Tバーロー', en: 'T-Bar Row', muscle: 'back', equip: 'プレート' },
    { name: 'ハイロー', en: 'High Row', muscle: 'back', equip: 'マシン' },
    { name: 'ケーブルロー', en: 'Cable Row', muscle: 'back', equip: 'ケーブル' },
    { name: 'ベントオーバーロウ', en: 'Bent-over Row', muscle: 'back', equip: 'フリー' },
    { name: 'ワンハンドダンベルロウ', en: 'One-arm Row', muscle: 'back', equip: 'フリー' },
    { name: 'プルオーバーマシン', en: 'Pullover Machine', muscle: 'back', equip: 'マシン' },
    { name: 'ノーチラス プルオーバー', en: 'Nautilus Pullover', muscle: 'back', equip: 'マシン' },
    { name: 'ハンマーストレングス ローロー', en: 'Hammer Strength Low Row', muscle: 'back', equip: 'マシン' },
    { name: 'ハンマーストレングス DYロー', en: 'Hammer Strength DY Row', muscle: 'back', equip: 'マシン' },
    // 肩
    { name: 'サイドレイズ', en: 'Side Raise', muscle: 'shoulder', equip: 'フリー' },
    { name: 'ショルダープレス', en: 'Shoulder Press', muscle: 'shoulder', equip: 'マシン' },
    { name: 'インクラインショルダープレス', en: 'Incline Shoulder Press', muscle: 'shoulder', equip: 'フリー' },
    { name: 'フロントレイズ', en: 'Front Raise', muscle: 'shoulder', equip: 'フリー' },
    { name: 'リアレイズ', en: 'Rear Delt Raise', muscle: 'shoulder', equip: 'フリー' },
    { name: 'スミスマシンショルダープレス', en: 'Smith Machine Shoulder Press', muscle: 'shoulder', equip: 'スミス' },
    { name: 'ベントオーバーリアレイズ', en: 'Bent-over Rear Delt Raise', muscle: 'shoulder', equip: 'フリー' },
    { name: 'アップライトロー', en: 'Upright Row', muscle: 'shoulder', equip: 'フリー' },
    { name: 'フェイスプル', en: 'Face Pull', muscle: 'shoulder', equip: 'ケーブル' },
    { name: 'シュラッグ', en: 'Shrug', muscle: 'back', equip: 'フリー' },
    // 腕
    { name: 'アームカール', en: 'Arm Curl', muscle: 'arm', sub: '上腕二頭筋', equip: 'マシン' },
    { name: 'バーベルカール', en: 'Barbell Curl', muscle: 'arm', sub: '上腕二頭筋', equip: 'フリー' },
    { name: 'ダンベルカール', en: 'Dumbbell Curl', muscle: 'arm', sub: '上腕二頭筋', equip: 'フリー' },
    { name: 'ハンマーカール', en: 'Hammer Curl', muscle: 'arm', sub: '上腕二頭筋', equip: 'フリー' },
    { name: 'プリーチャーカール', en: 'Preacher Curl', muscle: 'arm', sub: '上腕二頭筋', equip: 'マシン' },
    { name: 'トライセプスプレスダウン', en: 'Triceps Pushdown', muscle: 'arm', sub: '上腕三頭筋', equip: 'ケーブル' },
    { name: 'トライセプスエクステンション', en: 'Triceps Extension', muscle: 'arm', sub: '上腕三頭筋', equip: 'マシン' },
    { name: 'シーテッドディップ', en: 'Seated Dip', muscle: 'arm', sub: '上腕三頭筋', equip: 'マシン' },
    { name: 'アシストディップ', en: 'Assisted Dip', muscle: 'arm', sub: '上腕三頭筋', equip: 'マシン' },
    { name: 'フレンチプレス', en: 'French Press', muscle: 'arm', sub: '上腕三頭筋', equip: 'フリー' },
    // 脚
    { name: 'スクワット', en: 'Squat', muscle: 'legs', sub: '大腿四頭筋', equip: 'フリー' },
    { name: 'レッグプレス', en: 'Leg Press', muscle: 'legs', sub: '大腿四頭筋', equip: 'マシン' },
    { name: 'ハックスクワット', en: 'Hack Squat', muscle: 'legs', sub: '大腿四頭筋', equip: 'マシン' },
    { name: 'スクワットプレス', en: 'Squat Press', muscle: 'legs', sub: '大腿四頭筋', equip: 'マシン' },
    { name: 'レッグエクステンション', en: 'Leg Extension', muscle: 'legs', sub: '大腿四頭筋', equip: 'マシン' },
    { name: 'プレートロードレッグプレス', en: 'Plate-Loaded Leg Press', muscle: 'legs', sub: '大腿四頭筋', equip: 'プレート' },
    { name: 'ブルガリアンスクワット', en: 'Bulgarian Split Squat', muscle: 'legs', sub: '大腿四頭筋', equip: 'フリー' },
    { name: 'スミスマシン スクワット', en: 'Smith Machine Squat', muscle: 'legs', sub: '大腿四頭筋', equip: 'スミス' },
    { name: 'シーテッドレッグカール', en: 'Seated Leg Curl', muscle: 'legs', sub: 'ハムストリングス', equip: 'マシン' },
    { name: 'ライイングレッグカール', en: 'Lying Leg Curl', muscle: 'legs', sub: 'ハムストリングス', equip: 'マシン' },
    { name: 'スタンディングレッグカール', en: 'Standing Leg Curl', muscle: 'legs', sub: 'ハムストリングス', equip: 'マシン' },
    { name: 'ヒップスラスト', en: 'Hip Thrust', muscle: 'legs', sub: '臀部', equip: 'マシン' },
    { name: 'グルートドライブ', en: 'Glute Drive', muscle: 'legs', sub: '臀部', equip: 'マシン' },
    { name: 'ブーティビルダー', en: 'Booty Builder', muscle: 'legs', sub: '臀部', equip: 'マシン' },
    { name: 'グルートマシン', en: 'Glute Machine', muscle: 'legs', sub: '臀部', equip: 'マシン' },
    { name: 'アダクター', en: 'Adductor (Inner Thigh)', muscle: 'legs', sub: '内転・外転', equip: 'マシン' },
    { name: 'アブダクター', en: 'Abductor (Outer Thigh)', muscle: 'legs', sub: '内転・外転', equip: 'マシン' },
    { name: 'シーテッドカーフレイズ', en: 'Seated Calf Raise', muscle: 'legs', sub: 'ふくらはぎ', equip: 'マシン' },
    { name: 'スタンディングカーフレイズ', en: 'Standing Calf Raise', muscle: 'legs', sub: 'ふくらはぎ', equip: 'マシン' },
    { name: 'レッグプレスカーフ', en: 'Leg Press Calf Raise', muscle: 'legs', sub: 'ふくらはぎ', equip: 'マシン' },
    // 腹・体幹
    { name: 'アブドミナルクランチ', en: 'Abdominal Crunch', muscle: 'abs', equip: 'マシン' },
    { name: 'クランチ', en: 'Crunch', muscle: 'abs', equip: '自重' },
    { name: 'レッグレイズ', en: 'Leg Raise', muscle: 'abs', equip: '自重' },
    { name: 'プランク', en: 'Plank', muscle: 'abs', equip: '自重' },
    { name: 'トーソローテーション', en: 'Torso Rotation', muscle: 'abs', equip: 'マシン' },
    { name: 'バックエクステンション', en: 'Back Extension', muscle: 'abs', equip: 'マシン' },
    { name: 'ローマンチェア', en: 'Roman Chair', muscle: 'abs', equip: 'マシン' },
    { name: 'GHD（グルートハムデベロッパー）', en: 'GHD (Glute-Ham Developer)', muscle: 'abs', equip: 'マシン' },
    // 有酸素
    { name: 'ランニング', en: 'Running', muscle: 'cardio', equip: '有酸素' },
    { name: 'トレッドミル', en: 'Treadmill', muscle: 'cardio', equip: '有酸素' },
    { name: 'クロストレーナー', en: 'Cross Trainer', muscle: 'cardio', equip: '有酸素' },
    { name: 'エアロバイク', en: 'Exercise Bike', muscle: 'cardio', equip: '有酸素' },
    { name: 'リカンベントバイク', en: 'Recumbent Bike', muscle: 'cardio', equip: '有酸素' },
    { name: 'ステアクライマー', en: 'Stair Climber', muscle: 'cardio', equip: '有酸素' },
    { name: 'ローイングエルゴメーター', en: 'Rowing Ergometer', muscle: 'cardio', equip: '有酸素' },
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

  /* ---------- 集計(有酸素セットは weight/reps を持たないので自然に0) ----------
   * 総量のルール:
   *  - 記録中(未完了)のセッション: ✓を付けたセットだけ数える(=今日の進捗)
   *  - 保存済みセッション: 値の入ったセットは✓が無くても数える
   *    (✓を付け忘れて保存した過去データが0kgになるのを防ぐ。保存時には
   *     ✓なしセットの扱いを確認するので、新しいデータは常に明確) */
  function sessionVolumeKg(session) {
    let v = 0;
    (session.exercises || []).forEach(we => (we.sets || []).forEach(s => {
      if (s.warmup) return;
      if (!session.done && !s.done) return;
      if (typeof s.weight === 'number') v += (s.weight || 0) * (s.reps || 0);
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
      n_exercises: '{n}種目', n_sets: '{n}セット', sep: ' ・ ',
      app_title: 'トレログ', load_7d: '合計負荷量 / 7日間', load_28d: '合計負荷量 / 28日間', load_total: '総合計負荷量',
      weekly_load: '週別の負荷量', wk_now: '今週', wk_ago: '{n}週前',
      add_today: '本日のトレーニングを追加', rm_calc: 'RM計算機',
      rm_title: '1RM 計算機', rm_weight: '挙上重量（{u}）', rm_reps: '回数', rm_est: '推定 1RM',
      rm_hint: '重量と回数から最大挙上重量(1RM)を推定します（Epley式）。%表は各割合での目安重量です。',
      // home(ナイトジム)
      greet_morning: 'おはようございます', greet_day: 'こんにちは', greet_night: 'こんばんは', greet_sep: '、',
      home_training: 'トレーニング', home_today: '今日', suf_recording: ' を記録中', suf_dayof: ' の日', suf_cheer: ' も頑張りましょう',
      ring_goal: '目標達成', m_streak: '連続日', m_done: '完了', rec_badge: '記録中',
      sec_today_menu: '今日のメニュー', sec_recommend: 'おすすめメニュー', sec_menu: 'メニュー',
      cta_log_sets: 'セットを記録する', cta_start_tpl: '{name} を開始', cta_start_workout: 'ワークアウトを開始',
      p_sleep: '睡眠', p_food: '食事', p_log: '＋ 記録する',
      // グラフ: 3本柱バランス
      g_balance: 'バランス', g_by_exercise: '種目別',
      bal_status: '今週の記録状況', bal_score: '3本柱の達成度（直近7日・記録日の平均）', bal_trend14: '推移（直近14日）',
      lbl_workout: '運動', lbl_sleep: '睡眠', lbl_food: '食事',
      bal_goalnote: '目標（1日あたり）: 運動 {v}{u} ・ 睡眠 {s}時間 ・ タンパク質 {p}g — 設定で変更できます',
      bal_empty: '運動・睡眠・食事を記録すると、ここに3本柱のバランスが表示されます。',
      bal_need_more: '記録が2日以上たまると表示されます',
      trend_vol_d: '運動（{u}/日）', trend_sleep: '睡眠（時間）', trend_protein: 'タンパク質（g）',
      goal_sleep: '睡眠（時間）', goal_protein: 'タンパク質（g）',
      first_workout: '最初のワークアウト', tap_to_start: 'タップして開始', q_empty_start: '＋ 空で開始', unit_min: '分',
      // 進行中セッションの衝突・復帰
      active_exists_title: '進行中のワークアウトがあります',
      active_exists_msg: '「{name}」を記録中です（{n}種目）。新しく始める前に選んでください。',
      active_resume: '進行中を開く', active_finish_new: '保存して新しく開始', active_discard_new: '破棄して新しく開始',
      unfinished_title: '未完了のワークアウト', unfinished_hint: 'タップすると続きから記録できます。', badge_unfinished: '未完了',
      close: '閉じる',
      // オフの日(休養日・食事なし)
      rest_day: '休養日', rest_day_set: '休養日にする', rest_day_unset: '休養日を解除',
      rest_day_card: '今日は休養日', rest_day_sub: '回復もトレーニングのうち',
      rest_day_on: '休養日にしました', rest_day_off: '休養日を解除しました',
      no_food: '食事をとらなかった', no_food_short: '食事なし',
      no_food_note: 'ファスティングや欠食を記録します。品目は入力しません。',
      legend_on: '記録あり', legend_off: 'オフ', legend_none: '未記録',
      // 睡眠(専用画面)
      c_sleep_title: '睡眠', bedtime: '就寝', waketime: '起床', sleep_dur: '睡眠時間',
      sleep_hm: '{h}時間{m}分', sleep_h: '{h}時間',
      sleep_need_times: '就寝・起床の時刻を入れると睡眠時間を自動で計算します',
      sleep_goal_met: '目標達成', sleep_short: '目標まで {v}', sleep_over: '目標 +{v}',
      // 食事(専用画面)
      c_food_title: '食事', meal_breakfast: '朝食', meal_lunch: '昼食', meal_dinner: '夕食',
      meal_snack: '間食', meal_other: 'その他',
      food_total: '合計', food_remain: '残り {v} kcal', food_over: '{v} kcal オーバー',
      food_add: '＋ 追加', food_item: '品目名（任意）', food_kcal: 'カロリー（kcal）', food_p: 'タンパク質（g）',
      food_add_title: '食べたものを追加', food_none: 'まだ記録がありません',
      food_need: 'カロリーかタンパク質を入れてください', food_legacy: '記録済みの合計',
      // 体重
      day_prev: '前の日', day_next: '次の日', to_today: '今日へ',
      c_weight_title: '体重', weight_none: '未記録',
      goal_cal: 'カロリー（kcal）',
      // サプリ
      supp_today: '今日のサプリ', supp_manage: 'サプリを管理', supp_title: 'マイサプリ',
      supp_add: '＋ サプリを追加', supp_edit: 'サプリを編集', supp_name: '名前', supp_dose: '用量（例: 5g / 2粒）',
      supp_slots: '飲むタイミング', supp_days: '頻度', supp_days_all: '毎日', supp_days_training: 'トレ日のみ',
      supp_preset: '定番から選ぶ', supp_custom_hint: '選ぶと名前・用量・タイミングが入ります。自由に変更してOK。',
      supp_save: '保存する', supp_delete: 'このサプリを削除', supp_del_confirm: '「{name}」を削除しますか？摂取記録は残ります。',
      supp_empty: 'サプリを登録すると、毎日のチェックリストがここに表示されます。',
      supp_none_today: '今日は飲むサプリがありません（トレ日のみのサプリは休息日に非表示）。',
      supp_need: '名前とタイミングを入れてください', supp_saved: 'サプリを保存しました', supp_added: 'サプリを追加しました',
      supp_rest_note: 'トレ日のみ', lbl_supp: 'サプリ', supp_pct: 'サプリ {n}/{m}',
      contact_title: 'お問い合わせ', contact_btn: 'ご意見・不具合を送る', contact_msg_lbl: '内容',
      contact_msg_ph: 'ご意見・不具合・欲しい機能など、なんでもどうぞ',
      contact_mail_lbl: '返信先メール（任意）', contact_send: '送信する', contact_sending: '送信中…',
      contact_sent: '送信しました。ありがとうございます！', contact_fail: '送信できませんでした。通信環境を確認してもう一度お試しください。',
      contact_note: '開発者に届くのは、入力した内容・返信先・アプリのバージョン情報のみです。',
      contact_need_msg: '内容を入力してください', contact_mailapp: 'メールアプリで送る',
      s_goal: '1日の目標', goal_volume: '目標の総重量（{u}）', goal_hint: 'ホームの達成リング(運動)とグラフの「バランス」は、この目標を100%として計算します。',
      tpl_unsaved: '編集内容が保存されていません。破棄して戻りますか？',
      a_date: '記録日', date_changed: '記録日を {d} に変更しました',
      back_to_picker: '種目選択へ戻る', info_add_btn: '＋ この種目を追加して戻る', label_sep: '：',
      day_no_record: 'この日の記録はまだありません。', add_on_date: '＋ この日に記録を追加', c_date: '記録する日',
      // session editor
      to_home: 'ホームへ', to_history: '履歴へ', workout_name_ph: 'ワークアウト名(任意)',
      empty_ex: '種目を追加してセットを記録しましょう', add_exercise: '＋ 種目を追加',
      session_note: 'セッションメモ', session_note_ph: '全体の気づき・体調など', discard: '破棄', finish_save: '完了して保存', save_do: '保存する',
      col_set: '#', col_reps: '回', col_done: '済', col_min: '分', col_km: 'km', add_set: '＋ セット', add_warm: '＋ ウォームアップ',
      no_exercise_toast: '種目がありません', saved_workout: 'ワークアウトを保存しました', discard_confirm: 'このワークアウトを破棄しますか？',
      fu_msg: '完了チェック（✓）のないセットが{n}件あります。実施した扱いにしますか？',
      fu_mark: '✓を付けて保存', fu_drop: '未実施として削除して保存',
      // picker
      pick_title: '種目を選ぶ', search_ph: '種目名・器具で検索', all: 'すべて', no_match: '該当する種目がありません', add_custom: '＋ カスタム種目を追加', recent_ex: '最近使った種目',
      about_ex: 'この種目について', worked_muscles: '鍛える筋肉', bm_front: '正面', bm_back: '背面', pose_label: '動作イメージ', points_label: 'フォームのポイント',
      see_images: '画像で見る（Google）', see_video: '動画で見る（YouTube）', info_ext_note: '画像・動画は外部サイト（Google／YouTube）をブラウザで開きます。',
      custom_title: 'カスタム種目を追加', ex_name: '種目名', ex_name_ph: '例: ケーブルクロスオーバー', part: '部位', add_do: '追加する',
      need_name: '種目名を入力してください', ex_added: '種目を追加しました',
      // ex menu
      ex_note: '種目メモ', save_note: 'メモを保存', move_up: '↑ 上へ', move_down: '↓ 下へ', remove_ex: 'この種目を削除', note_saved: 'メモを保存しました',
      ex_removed: '種目を削除しました', ex_del_confirm: '「{name}」を削除しますか？記録したセットも消えます。',
      // timer
      rest: 'レスト', rest_done: '休憩おわり！次のセットへ', ok: 'OK', skip: 'スキップ',
      stop_alarm: '停止',
      rest_sound: '終了時に音', rest_vibe: '終了時にバイブ', rest_test: '音とバイブを試す',
      rest_test_done: '鳴らしました（音が出ない場合は音量を確認してください）',
      stale_title: '保存されていないワークアウトがあります',
      rest_now: 'レスト中', rest_paused: '一時停止中', add30: '+30秒', rest_start: 'レスト', int_fab: 'インターバル',
      pause_lbl: '一時停止', resume_lbl: '再開', minimize_lbl: '小さく表示',
      timer_style: 'タイマー表示', ts_large: '大きく', ts_small: '小さく',
      rest_hint: 'インターバル（休憩）タイマーは記録画面下の再生ボタン（時間表示つき）で開始します。「セット完了で自動スタート」をONにすると「✓」でも始まります。「+30秒」で延長、一時停止と「✕」削除はタイマー上のボタンから。終了すると「停止」を押すまで鳴り続けます（放置した場合は60秒で自動的に止まります）。マナーモードでも聞こえるようにしていますが、iPhoneではバイブは動きません（Safariに機能がないため）。',
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
      s_unit: '単位', s_lang: '言語 / Language', s_lang_hint: '選んだ言語でアプリ全体の表示が切り替わります。', s_appearance: 'テーマ',
      th_lime: 'ライム', th_orange: 'オレンジ', s_appearance_hint: 'ダーク基調のままアクセント色だけ切り替わります。',
      s_rest: 'レストタイマー', rest_default: '既定の休憩時間（秒）', rest_auto: 'セット完了で自動スタート',
      on: 'ON', off: 'OFF', s_data: 'データ', export_btn: 'バックアップを書き出す（JSON）', import_btn: 'バックアップを読み込む', reset_btn: '記録データを全消去',
      data_hint: 'データはこの端末内にのみ保存されます。機種変更の際は書き出したJSONを新しい端末で読み込んでください。',
      reset_confirm: 'すべての記録データ（ワークアウト・テンプレート・体調）を消去します。よろしいですか？', reset_done: '記録を消去しました',
      exported: 'バックアップを書き出しました', import_failed: '読み込みに失敗しました', imported: '読み込み完了(種目{e}・記録{s})',
      /* ---- プレミアム(買い切りIAP) ---- */
      pw_title: 'トレログ プレミアム', pw_lead: '1回の購入で、以下がずっと使えるようになります。追加課金・サブスクはありません。',
      pw_f1: '種目別の詳しい分析', pw_f1d: '種目ごとの重量・ボリュームの推移グラフ、自己ベスト、部位別のボリューム配分',
      pw_f2: '3本柱の14日推移', pw_f2d: '運動・睡眠・たんぱく質の推移グラフを重ねて、崩れている柱を早めに見つけられます',
      pw_f3: 'メニューを無制限に', pw_f3d: '無料版は{n}件まで。分割法や増量期・減量期のメニューを好きなだけ保存できます',
      pw_f4: 'サプリを無制限に', pw_f4d: '無料版は{n}件まで。飲んでいるサプリを全部まとめて管理できます',
      pw_f5: 'バックアップの書き出し', pw_f5d: '機種変更に備えて記録をJSONで書き出せます',
      pw_buy: 'プレミアムを購入', pw_restore: '購入を復元', pw_restored: 'プレミアムを復元しました',
      pw_no_purchase: '復元できる購入が見つかりませんでした', pw_failed: '購入を完了できませんでした',
      pw_active: 'プレミアムをご利用中です。ありがとうございます。',
      pw_note: '価格はApp Storeの表示に従います。購入はApple IDに紐づき、同じIDの端末で「購入を復元」から引き継げます。',
      s_premium: 'プレミアム', pw_open: '詳しく見る', pw_lock: 'プレミアム機能',
      pw_g_exercise: '種目別の推移グラフ・自己ベスト・部位別ボリュームはプレミアム機能です。',
      pw_g_trend: '3本柱の14日推移はプレミアム機能です。',
      pw_g_tpl: 'メニューの保存は無料版では{n}件までです。',
      pw_g_supp: 'サプリの登録は無料版では{n}件までです。',
      pw_g_export: 'バックアップの書き出しはプレミアム機能です。',
      pw_free_of: '無料枠 {c}/{n}',
      s_legal: '規約・プライバシー', legal_terms: '利用規約', legal_privacy: 'プライバシーポリシー',
      /* ---- 種目の編集(部位の付け直し) ---- 
       * 追加時に部位を選ばせ、あとから直せるようにするための文言 */
      part_required: '部位を選んでください（部位別のボリューム集計に使います）',
      need_part: '部位を選んでください',
      ex_dup: '同じ名前の種目が既にあります（{p}）。検索から選んでください。',
      ex_edit: '編集', ex_edit_title: '種目を編集', ex_updated: '種目を更新しました',
      ex_edit_used: 'この種目は記録・メニューで{n}回使われています。部位を変えると過去の記録の部位別集計もまとめて直ります。',
      ex_edit_unused: 'まだどの記録にも使われていません。',
      ex_delete: 'この種目を削除', ex_deleted: '種目を削除しました',
      ex_del_used: '記録で使われている種目は削除できません',
      ex_del_confirm: '「{n}」を種目一覧から削除します。よろしいですか？',
      /* ---- 画面を離れている間に出すレスト終了通知 ---- */
      notif_rest_title: 'レスト終了', notif_rest_body: '次のセットへ',
      /* ---- 種目の管理 ---- */
      s_exercises: '種目', ex_manage_btn: '種目の管理',
      ex_manage_title: '種目の管理', ex_group_custom: '自分で追加した種目', ex_group_seed: '最初から入っている種目',
      ex_manage_hint: '名前や部位を間違えて登録しても、あとから直せます。部位を変えると過去の記録の部位別集計もまとめて直ります。',
      ex_used_n: '記録・メニューで{n}回使用', no_hit: '見つかりませんでした',
      pick_day: '', // (日付見出しはfmtDate)
      version: 'トレログ v1.0'
    },
    en: {
      tab_record: 'Record', tab_history: 'History', tab_graph: 'Graph', tab_menu: 'Menu', tab_condition: 'Health', tab_settings: 'Settings',
      settings: 'Settings', back: 'Back', save: 'Save', saved: 'Saved', delete: 'Delete', cancel: 'Cancel', run: 'Confirm', confirm: 'Confirm', start: 'Start',
      h_record: 'Record', a_settings: 'Settings', in_progress: 'Workout in progress', start_new: '＋ Start a new workout',
      start_from_tpl: 'Start from template', no_tpl_hint: 'Save your favorite exercise combos in the Menu tab to start them instantly here.',
      recent: 'Recent workouts', no_records: 'No records yet. Start your first workout!',
      n_exercises: '{n} exercises', n_sets: '{n} sets', n_exercises_one: '{n} exercise', n_sets_one: '{n} set', sep: ' · ',
      app_title: 'ToreLog', load_7d: 'Total load / 7 days', load_28d: 'Total load / 28 days', load_total: 'All-time load',
      weekly_load: 'Weekly load', wk_now: 'This wk', wk_ago: '{n} wk ago',
      add_today: "Add today's workout", rm_calc: 'RM calc',
      rm_title: '1RM Calculator', rm_weight: 'Weight lifted ({u})', rm_reps: 'Reps', rm_est: 'Est. 1RM',
      rm_hint: 'Estimates your 1-rep max from a set (Epley). The % table shows target weights at each percentage.',
      greet_morning: 'Good morning', greet_day: 'Hello', greet_night: 'Good evening', greet_sep: ', ',
      home_training: 'Training', home_today: 'today', suf_recording: ' in progress', suf_dayof: ' day', suf_cheer: " — let's go",
      ring_goal: 'of goal', m_streak: 'day streak', m_done: 'done', rec_badge: 'RECORDING',
      sec_today_menu: "Today's menu", sec_recommend: 'Suggested menu', sec_menu: 'Menu',
      cta_log_sets: 'Log your sets', cta_start_tpl: 'Start {name}', cta_start_workout: 'Start a workout',
      p_sleep: 'Sleep', p_food: 'Food', p_log: '+ Log',
      g_balance: 'Balance', g_by_exercise: 'By exercise',
      bal_status: "This week's logging", bal_score: '3-pillar achievement (7-day logged avg)', bal_trend14: 'Trends (last 14 days)',
      lbl_workout: 'Workout', lbl_sleep: 'Sleep', lbl_food: 'Food',
      bal_goalnote: 'Daily goals: workout {v}{u} · sleep {s}h · protein {p}g — change in Settings',
      bal_empty: 'Log workouts, sleep and meals to see your 3-pillar balance here.',
      bal_need_more: 'Shows once you have 2+ days of data',
      trend_vol_d: 'Workout ({u}/day)', trend_sleep: 'Sleep (h)', trend_protein: 'Protein (g)',
      goal_sleep: 'Sleep (hours)', goal_protein: 'Protein (g)',
      first_workout: 'Your first workout', tap_to_start: 'Tap to start', q_empty_start: '＋ Blank start', unit_min: 'min',
      active_exists_title: 'A workout is already in progress',
      active_exists_msg: '"{name}" is in progress ({n} exercises). Choose what to do before starting a new one.',
      active_resume: 'Open the one in progress', active_finish_new: 'Save it & start new', active_discard_new: 'Discard it & start new',
      unfinished_title: 'Unfinished workouts', unfinished_hint: 'Tap to pick up where you left off.', badge_unfinished: 'unfinished',
      close: 'Close',
      rest_day: 'Rest day', rest_day_set: 'Mark as rest day', rest_day_unset: 'Undo rest day',
      rest_day_card: 'Rest day', rest_day_sub: 'Recovery counts too',
      rest_day_on: 'Marked as a rest day', rest_day_off: 'Rest day removed',
      no_food: "Didn't eat", no_food_short: 'No meals',
      no_food_note: 'Logs a fast or a skipped day. No items needed.',
      legend_on: 'Logged', legend_off: 'Off', legend_none: 'Not logged',
      c_sleep_title: 'Sleep', bedtime: 'Bedtime', waketime: 'Wake up', sleep_dur: 'Time asleep',
      sleep_hm: '{h}h {m}m', sleep_h: '{h}h',
      sleep_need_times: 'Enter bedtime and wake-up time to calculate your sleep automatically',
      sleep_goal_met: 'Goal met', sleep_short: '{v} to goal', sleep_over: '{v} over goal',
      c_food_title: 'Food', meal_breakfast: 'Breakfast', meal_lunch: 'Lunch', meal_dinner: 'Dinner',
      meal_snack: 'Snacks', meal_other: 'Other',
      food_total: 'Total', food_remain: '{v} kcal left', food_over: '{v} kcal over',
      food_add: '＋ Add', food_item: 'Item name (optional)', food_kcal: 'Calories (kcal)', food_p: 'Protein (g)',
      food_add_title: 'Add what you ate', food_none: 'Nothing logged yet',
      food_need: 'Enter calories or protein', food_legacy: 'Logged total',
      day_prev: 'Previous day', day_next: 'Next day', to_today: 'Today',
      c_weight_title: 'Weight', weight_none: 'Not logged',
      goal_cal: 'Calories (kcal)',
      supp_today: "Today's supplements", supp_manage: 'Manage supplements', supp_title: 'My supplements',
      supp_add: '＋ Add supplement', supp_edit: 'Edit supplement', supp_name: 'Name', supp_dose: 'Dose (e.g. 5g / 2 caps)',
      supp_slots: 'When to take', supp_days: 'Frequency', supp_days_all: 'Every day', supp_days_training: 'Training days',
      supp_preset: 'Pick from presets', supp_custom_hint: 'Picking one fills the name, dose and timing. Edit freely.',
      supp_save: 'Save', supp_delete: 'Delete this supplement', supp_del_confirm: 'Delete "{name}"? Past intake logs are kept.',
      supp_empty: 'Add your supplements to get a daily checklist here.',
      supp_none_today: 'Nothing to take today (training-day items are hidden on rest days).',
      supp_need: 'Enter a name and timing', supp_saved: 'Supplement saved', supp_added: 'Supplement added',
      supp_rest_note: 'training days', lbl_supp: 'Supps', supp_pct: 'Supps {n}/{m}',
      contact_title: 'Contact', contact_btn: 'Send feedback / report a bug', contact_msg_lbl: 'Message',
      contact_msg_ph: 'Feedback, bugs, feature requests — anything goes',
      contact_mail_lbl: 'Reply-to email (optional)', contact_send: 'Send', contact_sending: 'Sending…',
      contact_sent: 'Sent. Thank you!', contact_fail: 'Could not send. Check your connection and try again.',
      contact_note: 'Only your message, reply-to address and app version info are sent to the developer.',
      contact_need_msg: 'Please enter a message', contact_mailapp: 'Send via mail app',
      s_goal: 'Daily goal', goal_volume: 'Target total volume ({u})', goal_hint: 'The home progress ring (workout) and the Balance view treat these goals as 100%.',
      tpl_unsaved: 'Your changes are not saved. Discard and go back?',
      a_date: 'Date', date_changed: 'Date changed to {d}',
      back_to_picker: 'Back to exercises', info_add_btn: '＋ Add this exercise and go back', label_sep: ': ',
      day_no_record: 'No record for this day yet.', add_on_date: '＋ Add a record for this day', c_date: 'Date',
      to_home: 'Home', to_history: 'History', workout_name_ph: 'Workout name (optional)',
      empty_ex: 'Add exercises and record your sets', add_exercise: '＋ Add exercise',
      session_note: 'Session note', session_note_ph: 'Overall notes, condition, etc.', discard: 'Discard', finish_save: 'Finish & save', save_do: 'Save',
      col_set: '#', col_reps: 'reps', col_done: '✓', col_min: 'min', col_km: 'km', add_set: '＋ Set', add_warm: '＋ Warm-up',
      no_exercise_toast: 'No exercises', saved_workout: 'Workout saved', discard_confirm: 'Discard this workout?',
      fu_msg: '{n} sets have no ✓ (done) mark. Count them as performed?',
      fu_mark: 'Mark ✓ and save', fu_drop: 'Remove them and save',
      pick_title: 'Choose exercise', search_ph: 'Search name or gear', all: 'All', no_match: 'No matching exercise', add_custom: '＋ Add custom exercise', recent_ex: 'Recently used',
      about_ex: 'About this exercise', worked_muscles: 'Muscles worked', bm_front: 'Front', bm_back: 'Back', pose_label: 'Movement', points_label: 'Form tips',
      see_images: 'See images (Google)', see_video: 'Watch video (YouTube)', info_ext_note: 'Images/videos open Google/YouTube in your browser.',
      custom_title: 'Add custom exercise', ex_name: 'Exercise name', ex_name_ph: 'e.g. Cable Crossover', part: 'Muscle group', add_do: 'Add',
      need_name: 'Please enter a name', ex_added: 'Exercise added',
      ex_note: 'Exercise note', save_note: 'Save note', move_up: '↑ Up', move_down: '↓ Down', remove_ex: 'Remove this exercise', note_saved: 'Note saved',
      ex_removed: 'Exercise removed', ex_del_confirm: 'Delete "{name}"? Its logged sets will be removed too.',
      rest: 'Rest', rest_done: 'Rest over — next set', ok: 'OK', skip: 'Skip',
      stop_alarm: 'Stop',
      rest_sound: 'Sound when done', rest_vibe: 'Vibrate when done', rest_test: 'Test sound & vibration',
      rest_test_done: 'Played (check the volume if you hear nothing)',
      stale_title: 'You have an unsaved workout',
      rest_now: 'REST', rest_paused: 'PAUSED', add30: '+30s', rest_start: 'Rest', int_fab: 'Interval',
      pause_lbl: 'Pause', resume_lbl: 'Resume', minimize_lbl: 'Minimize',
      timer_style: 'Timer display', ts_large: 'Large', ts_small: 'Compact',
      rest_hint: 'Start the interval (rest) timer with the play button at the bottom of the workout screen. Turn on "Auto-start on set done" to also start it with ✓. "+30s" extends; pause and "✕" remove from the timer itself. When it ends it keeps alerting until you press Stop (and stops itself after 60 seconds). It is set to be audible even in silent mode; vibration does not work on iPhone (Safari has no such feature).',
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
      s_unit: 'Units', s_lang: 'Language / 言語', s_lang_hint: 'The whole app switches to the selected language.', s_appearance: 'Theme',
      th_lime: 'Lime', th_orange: 'Orange', s_appearance_hint: 'Stays dark — only the accent color changes.',
      s_rest: 'Rest timer', rest_default: 'Default rest (seconds)', rest_auto: 'Auto-start on set complete',
      on: 'ON', off: 'OFF', s_data: 'Data', export_btn: 'Export backup (JSON)', import_btn: 'Import backup', reset_btn: 'Erase all records',
      data_hint: 'Data is stored only on this device. To move to a new device, export the JSON and import it there.',
      reset_confirm: 'This erases all records (workouts, templates, health). Are you sure?', reset_done: 'Records erased',
      exported: 'Backup exported', import_failed: 'Import failed', imported: 'Imported ({e} exercises, {s} records)',
      pw_title: 'ToreLog Premium', pw_lead: 'One purchase unlocks everything below, forever. No subscription, no extra charges.',
      pw_f1: 'Per-exercise analysis', pw_f1d: 'Weight and volume trend charts per exercise, personal bests, and volume by muscle group',
      pw_f2: '14-day pillar trends', pw_f2d: 'Overlay training, sleep and protein trends to spot the pillar that is slipping',
      pw_f3: 'Unlimited routines', pw_f3d: 'Free plan allows {n}. Save as many splits, bulk and cut routines as you like',
      pw_f4: 'Unlimited supplements', pw_f4d: 'Free plan allows {n}. Track every supplement you take in one place',
      pw_f5: 'Backup export', pw_f5d: 'Export your records as JSON before switching devices',
      pw_buy: 'Buy Premium', pw_restore: 'Restore purchase', pw_restored: 'Premium restored',
      pw_no_purchase: 'No purchase found to restore', pw_failed: 'Could not complete the purchase',
      pw_active: 'Premium is active. Thank you!',
      pw_note: 'Price follows the App Store listing. The purchase is tied to your Apple ID and can be restored on your other devices.',
      s_premium: 'Premium', pw_open: 'See details', pw_lock: 'Premium',
      pw_g_exercise: 'Per-exercise trends, personal bests and volume by muscle are Premium features.',
      pw_g_trend: 'The 14-day pillar trends are a Premium feature.',
      pw_g_tpl: 'The free plan saves up to {n} routines.',
      pw_g_supp: 'The free plan tracks up to {n} supplements.',
      pw_g_export: 'Backup export is a Premium feature.',
      pw_free_of: 'Free {c}/{n}',
      s_legal: 'Terms & Privacy', legal_terms: 'Terms of Use', legal_privacy: 'Privacy Policy',
      part_required: 'Choose a muscle group (used for volume by muscle)',
      need_part: 'Choose a muscle group',
      ex_dup: 'An exercise with that name already exists ({p}). Pick it from search instead.',
      ex_edit: 'Edit', ex_edit_title: 'Edit exercise', ex_updated: 'Exercise updated',
      ex_edit_used: 'Used {n} times in workouts and routines. Changing the muscle group also fixes volume-by-muscle for past records.',
      ex_edit_unused: 'Not used in any record yet.',
      ex_delete: 'Delete this exercise', ex_deleted: 'Exercise deleted',
      ex_del_used: 'Exercises used in records cannot be deleted',
      ex_del_confirm: 'Remove 「{n}」 from the exercise list. Are you sure?',
      notif_rest_title: 'Rest finished', notif_rest_body: 'Time for your next set',
      s_exercises: 'Exercises', ex_manage_btn: 'Manage exercises',
      ex_manage_title: 'Manage exercises', ex_group_custom: 'Your exercises', ex_group_seed: 'Built-in exercises',
      ex_manage_hint: 'Fix a wrong name or muscle group any time. Changing the muscle group also fixes volume-by-muscle for past records.',
      ex_used_n: 'Used {n} times', no_hit: 'No matches',
      pick_day: '',
      version: 'ToreLog v1.0'
    }
  };
  function t(key, params) {
    const l = lang();
    // 単数形: params.n === 1 のとき "<key>_one" があればそちらを使う("1 exercises" を防ぐ)
    const k = (params && +params.n === 1 && I18N[l] && I18N[l][key + '_one'] != null) ? key + '_one' : key;
    let s = (I18N[l] && I18N[l][k] != null) ? I18N[l][k] : (I18N.ja[k] != null ? I18N.ja[k] : (I18N.ja[key] != null ? I18N.ja[key] : key));
    if (params) Object.keys(params).forEach(p => { s = s.replace(new RegExp('\\{' + p + '\\}', 'g'), params[p]); });
    return s;
  }

  /* ---------- サプリメント(タイミング定義とプリセット) ----------
   * 実在の服薬/サプリ管理アプリ(Medisafe, Round Health, MyTherapy, iOSヘルスケア)の
   * 共通パターンを踏襲: 「マイリスト登録(用量+タイミング) → 今日のチェックリスト → 順守率」 */
  const SUPP_SLOTS = [
    { key: 'wake',    ja: '起床時',   en: 'On waking' },
    { key: 'morning', ja: '朝',       en: 'Morning' },
    { key: 'noon',    ja: '昼',       en: 'Noon' },
    { key: 'preW',    ja: 'トレ前',   en: 'Pre-workout' },
    { key: 'postW',   ja: 'トレ後',   en: 'Post-workout' },
    { key: 'evening', ja: '夜',       en: 'Evening' },
    { key: 'bed',     ja: '就寝前',   en: 'Before bed' }
  ];
  const slotName = (key) => { const s = SUPP_SLOTS.find(x => x.key === key); return s ? (lang() === 'en' ? s.en : s.ja) : key; };
  // 食事の区分(MyFitnessPal式に食事ごとへ分けて積む)。other は旧データの受け皿も兼ねる
  const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack', 'other'];
  // days: 'all'=毎日 / 'training'=トレ日のみ
  const SUPP_PRESETS = [
    { name: 'プロテイン', en: 'Whey Protein', dose: '30g', slots: ['postW'], days: 'all' },
    { name: 'クレアチン', en: 'Creatine', dose: '5g', slots: ['postW'], days: 'all' },
    { name: 'EAA', en: 'EAA', dose: '10g', slots: ['preW'], days: 'training' },
    { name: 'BCAA', en: 'BCAA', dose: '10g', slots: ['preW'], days: 'training' },
    { name: 'マルチビタミン', en: 'Multivitamin', dose: '1粒', slots: ['morning'], days: 'all' },
    { name: 'ビタミンD', en: 'Vitamin D', dose: '1粒', slots: ['morning'], days: 'all' },
    { name: 'ビタミンC', en: 'Vitamin C', dose: '1粒', slots: ['morning'], days: 'all' },
    { name: 'フィッシュオイル', en: 'Fish Oil', dose: '2粒', slots: ['evening'], days: 'all' },
    { name: '亜鉛', en: 'Zinc', dose: '1粒', slots: ['bed'], days: 'all' },
    { name: 'マグネシウム', en: 'Magnesium', dose: '1粒', slots: ['bed'], days: 'all' },
    { name: 'グルタミン', en: 'Glutamine', dose: '5g', slots: ['postW'], days: 'all' },
    { name: 'HMB', en: 'HMB', dose: '3g', slots: ['morning'], days: 'all' },
    { name: 'カフェイン', en: 'Caffeine', dose: '200mg', slots: ['preW'], days: 'training' },
    { name: 'シトルリン', en: 'Citrulline', dose: '8g', slots: ['preW'], days: 'training' },
    { name: 'アルギニン', en: 'Arginine', dose: '5g', slots: ['preW'], days: 'training' },
    { name: '鉄分', en: 'Iron', dose: '1粒', slots: ['morning'], days: 'all' },
    { name: 'コラーゲン', en: 'Collagen', dose: '10g', slots: ['bed'], days: 'all' },
    { name: 'プロバイオティクス', en: 'Probiotics', dose: '1粒', slots: ['morning'], days: 'all' }
  ];

  return {
    MUSCLES, muscleMap, muscleName, equipName, subName, isCardioMuscle, SEED_EXERCISES, SEED_VERSION, SUB_ORDER, DEPRECATED_EXERCISES,
    KG_TO_LB, kgToDisplay, displayToKg, unitLabel, fmtNum,
    sessionVolumeKg, sessionSetCount, estimate1RM,
    dateKey, todayKey, fmtDate, fmtDateShort, fmtMonthYear, fmtClock, dow, DOW_JA,
    SUPP_SLOTS, slotName, SUPP_PRESETS, MEAL_SLOTS,
    I18N, t, lang
  };
})();

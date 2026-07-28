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
  const SEED_VERSION = 4; // これを上げると既存ユーザーにも不足分の追加＋メタ情報(英語名など)の反映が走る
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
    { name: 'シュラッグ', en: 'Shrug', muscle: 'shoulder', equip: 'フリー' },
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
      n_exercises: '{n}種目', n_sets: '{n}セット', sep: ' ・ ',
      app_title: '筋トレ記録', load_7d: '合計負荷量 / 7日間', load_28d: '合計負荷量 / 28日間', load_total: '総合計負荷量',
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
      first_workout: '最初のワークアウト', tap_to_start: 'タップして開始', q_empty_start: '＋ 空で開始', unit_min: '分',
      // 進行中セッションの衝突・復帰
      active_exists_title: '進行中のワークアウトがあります',
      active_exists_msg: '「{name}」を記録中です（{n}種目）。新しく始める前に選んでください。',
      active_resume: '進行中を開く', active_finish_new: '保存して新しく開始', active_discard_new: '破棄して新しく開始',
      unfinished_title: '未完了のワークアウト', unfinished_hint: 'タップすると続きから記録できます。', badge_unfinished: '未完了',
      close: '閉じる',
      s_goal: '1日の目標', goal_volume: '目標の総重量（{u}）', goal_hint: 'ホーム画面の達成リングはこの値を100%として計算します。',
      tpl_unsaved: '編集内容が保存されていません。破棄して戻りますか？',
      a_date: '記録日', date_changed: '記録日を {d} に変更しました',
      back_to_picker: '種目選択へ戻る', info_add_btn: '＋ この種目を追加して戻る', label_sep: '：',
      day_no_record: 'この日の記録はまだありません。', add_on_date: '＋ この日に記録を追加', c_date: '記録する日',
      // session editor
      to_home: 'ホームへ', to_history: '履歴へ', workout_name_ph: 'ワークアウト名(任意)',
      empty_ex: '種目を追加してセットを記録しましょう', add_exercise: '＋ 種目を追加',
      session_note: 'セッションメモ', session_note_ph: '全体の気づき・体調など', discard: '破棄', finish_save: '完了して保存', save_do: '保存する',
      col_set: '#', col_reps: '回', col_done: '済', col_min: '分', col_km: 'km', add_set: '＋ セット', add_warm: '＋ ウォームアップ',
      no_exercise_toast: '種目がありません', saved_workout: 'ワークアウトを保存しました 💪', discard_confirm: 'このワークアウトを破棄しますか？',
      // picker
      pick_title: '種目を選ぶ', search_ph: '🔍 種目名・器具で検索', all: 'すべて', no_match: '該当する種目がありません', add_custom: '＋ カスタム種目を追加', recent_ex: '最近使った種目',
      about_ex: 'ⓘ この種目について', worked_muscles: '鍛える筋肉', bm_front: '正面', bm_back: '背面', pose_label: '動作イメージ', points_label: 'フォームのポイント',
      see_images: '🔍 画像で見る（Google）', see_video: '▶ 動画で見る（YouTube）', info_ext_note: '画像・動画は外部サイト（Google／YouTube）をブラウザで開きます。',
      custom_title: 'カスタム種目を追加', ex_name: '種目名', ex_name_ph: '例: ケーブルクロスオーバー', part: '部位', add_do: '追加する',
      need_name: '種目名を入力してください', ex_added: '種目を追加しました',
      // ex menu
      ex_note: '種目メモ', save_note: 'メモを保存', move_up: '↑ 上へ', move_down: '↓ 下へ', remove_ex: 'この種目を削除', note_saved: 'メモを保存しました',
      ex_removed: '種目を削除しました', ex_del_confirm: '「{name}」を削除しますか？記録したセットも消えます。',
      // timer
      rest: 'レスト', rest_done: '休憩おわり！次のセットへ 💪', ok: 'OK', skip: 'スキップ',
      rest_now: 'レスト中', rest_paused: '一時停止中', add30: '+30秒', rest_start: '⏱ レスト', int_fab: 'インターバル',
      pause_lbl: '一時停止', resume_lbl: '再開', minimize_lbl: '小さく表示',
      timer_style: 'タイマー表示', ts_large: '大きく', ts_small: '小さく',
      rest_hint: 'インターバル（休憩）タイマーは記録画面右下の「▶ インターバル」で開始します。「セット完了で自動スタート」をONにすると「✓」でも始まります。「+30秒」で延長、「⏸」で一時停止、「✕」で削除。大きい表示は右上の「▾」で小さくなり、バーをタップすると大きく戻ります。',
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
      pick_day: '', // (日付見出しはfmtDate)
      version: '筋トレ記録 v1.0'
    },
    en: {
      tab_record: 'Record', tab_history: 'History', tab_graph: 'Graph', tab_menu: 'Menu', tab_condition: 'Health', tab_settings: 'Settings',
      settings: 'Settings', back: 'Back', save: 'Save', saved: 'Saved', delete: 'Delete', cancel: 'Cancel', run: 'Confirm', confirm: 'Confirm', start: 'Start',
      h_record: 'Record', a_settings: 'Settings', in_progress: 'Workout in progress', start_new: '＋ Start a new workout',
      start_from_tpl: 'Start from template', no_tpl_hint: 'Save your favorite exercise combos in the Menu tab to start them instantly here.',
      recent: 'Recent workouts', no_records: 'No records yet. Start your first workout!',
      n_exercises: '{n} exercises', n_sets: '{n} sets', n_exercises_one: '{n} exercise', n_sets_one: '{n} set', sep: ' · ',
      app_title: 'Kintore Log', load_7d: 'Total load / 7 days', load_28d: 'Total load / 28 days', load_total: 'All-time load',
      weekly_load: 'Weekly load', wk_now: 'This wk', wk_ago: '{n} wk ago',
      add_today: "Add today's workout", rm_calc: 'RM calc',
      rm_title: '1RM Calculator', rm_weight: 'Weight lifted ({u})', rm_reps: 'Reps', rm_est: 'Est. 1RM',
      rm_hint: 'Estimates your 1-rep max from a set (Epley). The % table shows target weights at each percentage.',
      greet_morning: 'Good morning', greet_day: 'Hello', greet_night: 'Good evening', greet_sep: ', ',
      home_training: 'Training', home_today: 'today', suf_recording: ' in progress', suf_dayof: ' day', suf_cheer: " — let's go",
      ring_goal: 'of goal', m_streak: 'day streak', m_done: 'done', rec_badge: 'RECORDING',
      sec_today_menu: "Today's menu", sec_recommend: 'Suggested menu', sec_menu: 'Menu',
      cta_log_sets: 'Log your sets', cta_start_tpl: 'Start {name}', cta_start_workout: 'Start a workout',
      first_workout: 'Your first workout', tap_to_start: 'Tap to start', q_empty_start: '＋ Blank start', unit_min: 'min',
      active_exists_title: 'A workout is already in progress',
      active_exists_msg: '"{name}" is in progress ({n} exercises). Choose what to do before starting a new one.',
      active_resume: 'Open the one in progress', active_finish_new: 'Save it & start new', active_discard_new: 'Discard it & start new',
      unfinished_title: 'Unfinished workouts', unfinished_hint: 'Tap to pick up where you left off.', badge_unfinished: 'unfinished',
      close: 'Close',
      s_goal: 'Daily goal', goal_volume: 'Target total volume ({u})', goal_hint: 'The progress ring on the home screen treats this value as 100%.',
      tpl_unsaved: 'Your changes are not saved. Discard and go back?',
      a_date: 'Date', date_changed: 'Date changed to {d}',
      back_to_picker: 'Back to exercises', info_add_btn: '＋ Add this exercise and go back', label_sep: ': ',
      day_no_record: 'No record for this day yet.', add_on_date: '＋ Add a record for this day', c_date: 'Date',
      to_home: 'Home', to_history: 'History', workout_name_ph: 'Workout name (optional)',
      empty_ex: 'Add exercises and record your sets', add_exercise: '＋ Add exercise',
      session_note: 'Session note', session_note_ph: 'Overall notes, condition, etc.', discard: 'Discard', finish_save: 'Finish & save', save_do: 'Save',
      col_set: '#', col_reps: 'reps', col_done: '✓', col_min: 'min', col_km: 'km', add_set: '＋ Set', add_warm: '＋ Warm-up',
      no_exercise_toast: 'No exercises', saved_workout: 'Workout saved 💪', discard_confirm: 'Discard this workout?',
      pick_title: 'Choose exercise', search_ph: '🔍 Search name or gear', all: 'All', no_match: 'No matching exercise', add_custom: '＋ Add custom exercise', recent_ex: 'Recently used',
      about_ex: 'ⓘ About this exercise', worked_muscles: 'Muscles worked', bm_front: 'Front', bm_back: 'Back', pose_label: 'Movement', points_label: 'Form tips',
      see_images: '🔍 See images (Google)', see_video: '▶ Watch video (YouTube)', info_ext_note: 'Images/videos open Google/YouTube in your browser.',
      custom_title: 'Add custom exercise', ex_name: 'Exercise name', ex_name_ph: 'e.g. Cable Crossover', part: 'Muscle group', add_do: 'Add',
      need_name: 'Please enter a name', ex_added: 'Exercise added',
      ex_note: 'Exercise note', save_note: 'Save note', move_up: '↑ Up', move_down: '↓ Down', remove_ex: 'Remove this exercise', note_saved: 'Note saved',
      ex_removed: 'Exercise removed', ex_del_confirm: 'Delete "{name}"? Its logged sets will be removed too.',
      rest: 'Rest', rest_done: 'Rest over — next set 💪', ok: 'OK', skip: 'Skip',
      rest_now: 'REST', rest_paused: 'PAUSED', add30: '+30s', rest_start: '⏱ Rest', int_fab: 'Interval',
      pause_lbl: 'Pause', resume_lbl: 'Resume', minimize_lbl: 'Minimize',
      timer_style: 'Timer display', ts_large: 'Large', ts_small: 'Compact',
      rest_hint: 'Start the interval (rest) timer with the "▶ Interval" button at the bottom right of the workout screen. Turn on "Auto-start on set done" to also start it with ✓. "+30s" extends, "⏸" pauses, "✕" removes it. "▾" shrinks the large view; tap the bar to enlarge it again.',
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
      pick_day: '',
      version: 'Kintore Log v1.0'
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

  return {
    MUSCLES, muscleMap, muscleName, equipName, subName, isCardioMuscle, SEED_EXERCISES, SEED_VERSION, SUB_ORDER, DEPRECATED_EXERCISES,
    KG_TO_LB, kgToDisplay, displayToKg, unitLabel, fmtNum,
    sessionVolumeKg, sessionSetCount, estimate1RM,
    dateKey, todayKey, fmtDate, fmtDateShort, fmtMonthYear, fmtClock, dow, DOW_JA,
    I18N, t, lang
  };
})();

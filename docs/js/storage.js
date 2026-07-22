/* storage.js — localStorage 永続化レイヤ
 * すべてのデータは端末内(localStorage)に kintore:<key> の名前空間で保存する。
 * 複数端末同期は行わない(将来クラウド同期を足せるよう、読み書きはこの層に集約)。
 *
 * コレクション:
 *   exercises  種目マスタ  [{ id, name, muscle, custom, order }]
 *   sessions   ワークアウト [{ id, date, name, note, startedAt, finishedAt, done,
 *                             exercises:[{ id, exerciseId, note, sets:[{ id, weight, reps, warmup, done }] }] }]
 *   templates  テンプレート [{ id, name, description, order, exercises:[{ exerciseId, sets, reps, weight }] }]
 *   dailyLogs  体調記録     [{ date, sleepHours, sleepQuality, calories, protein, weight, note }]
 *   settings   設定         { unit:'kg'|'lbs', lang:'ja'|'en', restDefault:秒, restAuto:bool }
 * 重量はすべて内部で kg(数値)で保持し、表示時に単位設定で換算する。
 */
const Store = (() => {
  const ns = (key) => `kintore:${key}`;

  function read(key, fallback) {
    try {
      const raw = localStorage.getItem(ns(key));
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) {
      console.warn('Store.read failed', key, e);
      return fallback;
    }
  }
  function write(key, val) {
    try { localStorage.setItem(ns(key), JSON.stringify(val)); }
    catch (e) { console.warn('Store.write failed', key, e); }
  }

  let seq = 0;
  function uid() {
    seq += 1;
    return Date.now().toString(36) + '-' + seq.toString(36) + Math.random().toString(36).slice(2, 6);
  }

  const DEFAULT_SETTINGS = { unit: 'kg', lang: 'ja', restDefault: 90, restAuto: true };

  return {
    uid,

    /* ---------- settings / theme ---------- */
    getSettings() { return Object.assign({}, DEFAULT_SETTINGS, read('settings', {})); },
    setSettings(patch) { write('settings', Object.assign(this.getSettings(), patch)); },
    getTheme() { return read('theme', 'system'); },
    setTheme(t) { write('theme', t); },

    /* ---------- exercises ---------- */
    getExercises() { return read('exercises', []); },
    setExercises(list) { write('exercises', list); },
    addExercise(name, muscle) {
      const list = this.getExercises();
      const ex = { id: uid(), name: name.trim(), muscle, custom: true, order: list.length };
      list.push(ex); this.setExercises(list); return ex;
    },
    updateExercise(id, patch) {
      const list = this.getExercises();
      const i = list.findIndex(e => e.id === id);
      if (i >= 0) { list[i] = Object.assign(list[i], patch); this.setExercises(list); }
    },
    deleteExercise(id) { this.setExercises(this.getExercises().filter(e => e.id !== id)); },
    exerciseById(id) { return this.getExercises().find(e => e.id === id) || null; },

    /* ---------- sessions ---------- */
    getSessions() { return read('sessions', []); },
    setSessions(list) { write('sessions', list); },
    getSession(id) { return this.getSessions().find(s => s.id === id) || null; },
    saveSession(session) {
      const list = this.getSessions();
      const i = list.findIndex(s => s.id === session.id);
      if (i >= 0) list[i] = session; else list.push(session);
      this.setSessions(list);
      return session;
    },
    deleteSession(id) { this.setSessions(this.getSessions().filter(s => s.id !== id)); },
    // 進行中(未完了)のセッション。無ければ null。
    getActiveSession() {
      const active = this.getSessions().filter(s => !s.done);
      active.sort((a, b) => (b.startedAt || '').localeCompare(a.startedAt || ''));
      return active[0] || null;
    },

    /* ---------- templates ---------- */
    getTemplates() { return read('templates', []); },
    setTemplates(list) { write('templates', list); },
    getTemplate(id) { return this.getTemplates().find(t => t.id === id) || null; },
    saveTemplate(tpl) {
      const list = this.getTemplates();
      const i = list.findIndex(t => t.id === tpl.id);
      if (i >= 0) list[i] = tpl; else list.push(tpl);
      this.setTemplates(list);
      return tpl;
    },
    deleteTemplate(id) { this.setTemplates(this.getTemplates().filter(t => t.id !== id)); },

    /* ---------- daily logs(体調) ---------- */
    getLogs() { return read('dailyLogs', []); },
    setLogs(list) { write('dailyLogs', list); },
    getLog(date) { return this.getLogs().find(l => l.date === date) || null; },
    saveLog(log) {
      const list = this.getLogs();
      const i = list.findIndex(l => l.date === log.date);
      if (i >= 0) list[i] = log; else list.push(log);
      list.sort((a, b) => b.date.localeCompare(a.date));
      this.setLogs(list);
      return log;
    },
    deleteLog(date) { this.setLogs(this.getLogs().filter(l => l.date !== date)); },

    /* ---------- seed(初回起動時の初期種目 + 既存ユーザーへの不足分追加) ---------- */
    // Data は data.js の top-level const。ブラウザでは window に載らないため bare 参照する。
    _seedList() {
      const seed = (typeof Data !== 'undefined' && Data.SEED_EXERCISES) || [];
      return seed.map((e, i) => ({ id: uid(), name: e.name, en: e.en, muscle: e.muscle, sub: e.sub || '', equip: e.equip || '', custom: false, order: i }));
    },
    ensureSeed() {
      const seedVer = (typeof Data !== 'undefined' && Data.SEED_VERSION) || 1;
      if (this.getExercises().length === 0) {
        this.setExercises(this._seedList());
        this.setSettings({ seedVersion: seedVer });
        return;
      }
      // 既存インストール: SEED_VERSION が上がっていたら、名前が未登録の初期種目だけ追加する
      const stored = this.getSettings().seedVersion || 1;
      if (stored < seedVer) {
        const existingNames = new Set(this.getExercises().map(e => e.name));
        const list = this.getExercises();
        let order = list.length;
        this._seedList().forEach(e => { if (!existingNames.has(e.name)) { e.order = order++; list.push(e); } });
        this.setExercises(list);
        this.setSettings({ seedVersion: seedVer });
      }
    },

    /* ---------- export / import / reset ---------- */
    exportAll() {
      return {
        app: 'kintore', version: 1, exportedAt: new Date().toISOString(),
        exercises: this.getExercises(), sessions: this.getSessions(),
        templates: this.getTemplates(), dailyLogs: this.getLogs(), settings: this.getSettings()
      };
    },
    // 別端末で書き出したJSONを取り込み、現在のデータへマージする(idが同じものは上書き)。
    importMerge(data) {
      const mergeById = (cur, inc, key = 'id') => {
        const map = new Map(cur.map(x => [x[key], x]));
        (inc || []).forEach(x => map.set(x[key], x));
        return Array.from(map.values());
      };
      if (Array.isArray(data.exercises)) this.setExercises(mergeById(this.getExercises(), data.exercises));
      if (Array.isArray(data.sessions)) this.setSessions(mergeById(this.getSessions(), data.sessions));
      if (Array.isArray(data.templates)) this.setTemplates(mergeById(this.getTemplates(), data.templates));
      if (Array.isArray(data.dailyLogs)) {
        const merged = mergeById(this.getLogs(), data.dailyLogs, 'date');
        merged.sort((a, b) => b.date.localeCompare(a.date));
        this.setLogs(merged);
      }
      if (data.settings) this.setSettings(data.settings);
      return {
        exercises: this.getExercises().length, sessions: this.getSessions().length,
        templates: this.getTemplates().length, logs: this.getLogs().length
      };
    },
    // 記録データを全消去(種目マスタ・設定・テーマは残す)。
    resetData() {
      write('sessions', []); write('templates', []); write('dailyLogs', []);
    }
  };
})();

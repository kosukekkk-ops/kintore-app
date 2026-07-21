/* charts.js — 依存ライブラリなしの自前SVGチャート
 * オフライン要件のため外部CDNを使わず、SVGを文字列で組み立てる。
 * 色は CSS 変数(var(--accent) 等)を使い、ダーク/ライト両テーマに追従する。
 */
const Charts = (() => {
  const NS = 'http://www.w3.org/2000/svg';
  const esc = (s) => String(s).replace(/[&<>]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  const fmt = (n) => {
    const r = Math.round(n * 10) / 10;
    return Number.isInteger(r) ? String(r) : String(r);
  };

  // 実数値の折れ線グラフ。points=[{label, value}] を自動スケールで描画。
  // opts: { w, h, unit, color }
  function lineAbs(points, opts = {}) {
    const w = opts.w || 320, h = opts.h || 200;
    const color = opts.color || 'var(--accent)';
    const unit = opts.unit || '';
    if (!points.length) return '';
    const vals = points.map(p => p.value);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (lo === hi) { lo = lo - 1; hi = hi + 1; }       // 全て同値なら軸をずらす
    const span = hi - lo;
    lo = lo - span * 0.12; hi = hi + span * 0.12;      // 上下に余白
    const padL = 40, padR = 12, padT = 14, padB = 26;
    const iw = w - padL - padR, ih = h - padT - padB;
    const n = points.length;
    const xAt = (i) => padL + (n === 1 ? iw / 2 : (iw * i) / (n - 1));
    const yAt = (v) => padT + ih * (1 - (v - lo) / (hi - lo));
    let g = '';
    // y グリッド(下・中・上の実値ラベル)
    [0, 0.5, 1].forEach(f => {
      const v = lo + (hi - lo) * f;
      const y = yAt(v);
      g += `<line x1="${padL}" y1="${y.toFixed(1)}" x2="${w - padR}" y2="${y.toFixed(1)}" stroke="var(--border)" stroke-width="1"/>`;
      g += `<text x="${padL - 5}" y="${(y + 4).toFixed(1)}" text-anchor="end" font-size="10" fill="var(--text-dim)">${fmt(v)}</text>`;
    });
    // 面(薄い塗り)
    const base = yAt(lo);
    const area = points.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(' ');
    g += `<polygon points="${padL},${base.toFixed(1)} ${area} ${(w - padR)},${base.toFixed(1)}" fill="${color}" opacity="0.10"/>`;
    // 線
    const dp = points.map((p, i) => `${xAt(i).toFixed(1)},${yAt(p.value).toFixed(1)}`).join(' ');
    g += `<polyline points="${dp}" fill="none" stroke="${color}" stroke-width="2"/>`;
    // 点＋x軸ラベル(間引き)
    const step = Math.max(1, Math.ceil(n / 6));
    points.forEach((p, i) => {
      g += `<circle cx="${xAt(i).toFixed(1)}" cy="${yAt(p.value).toFixed(1)}" r="2.6" fill="${color}"/>`;
      if (n <= 7 || i % step === 0 || i === n - 1) {
        g += `<text x="${xAt(i).toFixed(1)}" y="${h - 8}" text-anchor="middle" font-size="9" fill="var(--text-dim)">${esc(p.label)}</text>`;
      }
    });
    if (unit) g += `<text x="${padL - 5}" y="10" text-anchor="end" font-size="9" fill="var(--text-dim)">${esc(unit)}</text>`;
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="${NS}">${g}</svg>`;
  }

  // 横棒グラフ: items=[{label, value(0..1), note, cls}] cls は色クラス(m-chest 等)
  function bars(items, w = 320) {
    if (!items.length) return '';
    const rowH = 38, pad = 6;
    const h = items.length * rowH + pad * 2;
    const labelW = 68, valW = 62;
    const barW = w - labelW - valW;
    let g = '';
    items.forEach((it, i) => {
      const y = pad + i * rowH + 8;
      const bw = Math.max(2, barW * Math.max(0, Math.min(1, it.value)));
      const fill = it.color || 'var(--accent)';
      g += `<text x="0" y="${y + 15}" font-size="12" fill="var(--text-dim)">${esc(it.label)}</text>`;
      g += `<rect x="${labelW}" y="${y}" width="${barW}" height="18" rx="9" fill="var(--bg-elev)"/>`;
      g += `<rect x="${labelW}" y="${y}" width="${bw.toFixed(1)}" height="18" rx="9" fill="${fill}"/>`;
      g += `<text x="${w}" y="${y + 15}" text-anchor="end" font-size="12" fill="var(--text)">${esc(it.note || '')}</text>`;
    });
    return `<svg viewBox="0 0 ${w} ${h}" xmlns="${NS}">${g}</svg>`;
  }

  return { lineAbs, bars };
})();

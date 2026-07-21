/* ============================================================
   Sèche — application locale de suivi repas & entraînements
   Données 100% locales (localStorage). Aucune donnée envoyée
   sauf, si tu l'actives, la photo d'un repas vers l'API Claude.
   ============================================================ */

'use strict';

/* ---------- Stockage ---------- */
const KEY = 'seche_app_v1';
const DEFAULT_STATE = {
  profile: null,
  meals: {},        // 'YYYY-MM-DD' -> [meal]
  workouts: {},     // 'YYYY-MM-DD' -> {done,type,note,duration,distance}
  weights: [],      // [{date,kg}]
  foodPrefs: {},    // nom -> true/false
  customFoods: [],  // [{nom,categorie,kcal,proteines,glucides,lipides}]
  settings: { provider: 'gemini', apiKey: '', model: 'gemini-2.5-flash' },
};
let state = load();

function load() {
  let st;
  try {
    const raw = localStorage.getItem(KEY);
    st = raw ? Object.assign(structuredClone(DEFAULT_STATE), JSON.parse(raw)) : structuredClone(DEFAULT_STATE);
  } catch (e) { st = structuredClone(DEFAULT_STATE); }
  // Applique les préférences alimentaires par défaut (sans écraser tes choix déjà faits)
  if (typeof DEFAULT_FOOD_PREFS !== 'undefined') {
    for (const k in DEFAULT_FOOD_PREFS) if (!(k in st.foodPrefs)) st.foodPrefs[k] = DEFAULT_FOOD_PREFS[k];
  }
  return st;
}
function save() { localStorage.setItem(KEY, JSON.stringify(state)); }

/* ---------- Dates ---------- */
function todayStr(d) { return dstr(d || new Date()); }
function dstr(d) { return d.toISOString().slice(0, 10); }
function parseD(s) { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); }
const JOURS = ['Dimanche', 'Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi'];
const JOURS_C = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
function frDate(s) { const d = parseD(s); return `${JOURS[d.getDay()]} ${d.getDate()}/${d.getMonth() + 1}`; }
function addDays(s, n) { const d = parseD(s); d.setDate(d.getDate() + n); return dstr(d); }
// Lundi de la semaine ISO contenant s
function weekStart(s) { const d = parseD(s); const wd = (d.getDay() + 6) % 7; return addDays(s, -wd); }
function weekDays(s) { const ws = weekStart(s); return Array.from({ length: 7 }, (_, i) => addDays(ws, i)); }

/* ---------- Objectifs nutritionnels (Mifflin-St Jeor) ---------- */
function computeTargets(p) {
  const s = p.sex === 'f' ? -161 : 5;
  const bmr = 10 * p.weight + 6.25 * p.height - 5 * p.age + s;
  const tdee = bmr * p.activity;
  const kcal = Math.round((tdee * (1 - p.deficit)) / 10) * 10;
  const proteines = Math.round(p.weight * 2.2);              // 2.2 g/kg (préserve le muscle en sèche)
  const lipides = Math.round(p.weight * 0.9);                // 0.9 g/kg
  const resteKcal = kcal - proteines * 4 - lipides * 9;
  const glucides = Math.max(60, Math.round(resteKcal / 4));
  return { kcal, proteines, glucides, lipides, tdee: Math.round(tdee), bmr: Math.round(bmr) };
}

/* ---------- Entraînement du jour (planning fixe) ---------- */
// Lun/Mer/Ven = Street workout ; Mar/Jeu/Sam = Course à pied ; Dim = Repos
function plannedWorkout(s) {
  const wd = parseD(s).getDay();
  if (wd === 0) return { type: 'Repos', emoji: '😴', rest: true };
  if (wd === 1 || wd === 3 || wd === 5) return { type: 'Street workout', emoji: '🤸', rest: false };
  return { type: 'Course à pied', emoji: '🏃', rest: false };
}

/* ---------- Score du jour (0-100) ---------- */
function dayScore(s) {
  const t = state.profile ? state.profile.targets : null;
  if (!t) return { total: 0, parts: [] };
  const meals = state.meals[s] || [];
  const sum = meals.reduce((a, m) => ({
    kcal: a.kcal + m.kcal, p: a.p + m.proteines, c: a.c + m.glucides, f: a.f + m.lipides,
  }), { kcal: 0, p: 0, c: 0, f: 0 });

  const parts = [];
  // Calories : rester à/sous la cible
  let kpts = 0;
  if (sum.kcal > 0) {
    if (sum.kcal <= t.kcal + 100) kpts = 25;
    else if (sum.kcal <= t.kcal + 400) kpts = 13;
    else kpts = 4;
  }
  parts.push({ label: 'Calories dans la cible', pts: kpts, max: 25 });
  // Protéines
  const ppts = Math.min(25, Math.round(25 * (sum.p / t.proteines)));
  parts.push({ label: 'Objectif protéines', pts: ppts, max: 25 });
  // Régularité des repas
  const mpts = meals.length >= 3 ? 20 : meals.length === 2 ? 13 : meals.length === 1 ? 7 : 0;
  parts.push({ label: 'Repas loggés (≥3)', pts: mpts, max: 20 });
  // Entraînement
  const w = state.workouts[s];
  const pl = plannedWorkout(s);
  const wpts = pl.rest ? 30 : (w && w.done ? 30 : 0);
  parts.push({ label: pl.rest ? 'Jour de repos' : 'Entraînement fait', pts: wpts, max: 30 });

  const total = parts.reduce((a, x) => a + x.pts, 0);
  return { total, parts, sum };
}

function streakDays() {
  // jours consécutifs (en remontant à partir d'aujourd'hui) avec score >= 60
  let n = 0; let cur = todayStr();
  // si aujourd'hui incomplet, on tolère et on part d'hier
  if (dayScore(cur).total < 60) cur = addDays(cur, -1);
  for (let i = 0; i < 400; i++) {
    if (dayScore(cur).total >= 60) { n++; cur = addDays(cur, -1); } else break;
  }
  return n;
}

/* ---------- Helpers UI ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
function el(html) { const t = document.createElement('template'); t.innerHTML = html.trim(); return t.content.firstChild; }
function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.add('hidden'), 2400);
}
function openModal(html) {
  $('#modal').innerHTML = '<div class="modal-handle"></div>' + html;
  $('#modal-backdrop').classList.remove('hidden');
}
function closeModal() { $('#modal-backdrop').classList.add('hidden'); $('#modal').innerHTML = ''; }
$('#modal-backdrop').addEventListener('click', e => { if (e.target.id === 'modal-backdrop') closeModal(); });

function ringSvg(pct, color) {
  const r = 50, c = 2 * Math.PI * r, off = c * (1 - Math.min(1, pct));
  return `<svg width="116" height="116" viewBox="0 0 116 116">
    <circle cx="58" cy="58" r="${r}" fill="none" stroke="var(--bg-2)" stroke-width="11"/>
    <circle cx="58" cy="58" r="${r}" fill="none" stroke="${color}" stroke-width="11"
      stroke-linecap="round" stroke-dasharray="${c}" stroke-dashoffset="${off}"/>
  </svg>`;
}
function bar(cls, val, max) {
  const pct = Math.min(100, max ? (val / max) * 100 : 0);
  return `<div class="bar ${cls}"><i style="width:${pct}%"></i></div>`;
}

/* ============================================================
   VUES
   ============================================================ */
let currentView = 'home';
const RENDERERS = {};

function renderView(v) {
  currentView = v;
  $$('#tabbar .tab').forEach(b => b.classList.toggle('active', b.dataset.view === v));
  $$('.view').forEach(s => s.classList.add('hidden'));
  const sec = $('#view-' + v); sec.classList.remove('hidden');
  RENDERERS[v](sec);
  window.scrollTo(0, 0);
}

/* ---------- HOME ---------- */
RENDERERS.home = (root) => {
  const s = todayStr();
  const sc = dayScore(s);
  const t = state.profile.targets;
  const sum = sc.sum || { kcal: 0, p: 0, c: 0, f: 0 };
  const pl = plannedWorkout(s);
  const w = state.workouts[s];
  $('#today-score-chip').textContent = sc.total + ' pts';

  const kcalLeft = t.kcal - sum.kcal;
  root.innerHTML = `
    <div class="card">
      <div class="flex-between" style="margin-bottom:14px">
        <div><div class="section-title" style="margin:0">${frDate(s)}</div>
          <h2 style="margin:2px 0 0">Aujourd'hui</h2></div>
        <div class="badge ${kcalLeft >= 0 ? 'green' : 'red'}">${kcalLeft >= 0 ? kcalLeft + ' kcal restantes' : Math.abs(kcalLeft) + ' kcal de dépassement'}</div>
      </div>
      <div class="ring-wrap">
        <div class="ring">${ringSvg(sum.kcal / t.kcal, 'var(--accent)')}
          <div class="ring-center"><b>${Math.round(sum.kcal)}</b><small>/ ${t.kcal} kcal</small></div>
        </div>
        <div style="flex:1">
          <div class="macro"><div class="macro-head"><span>Protéines</span><b>${Math.round(sum.p)} / ${t.proteines} g</b></div>${bar('p', sum.p, t.proteines)}</div>
          <div class="macro"><div class="macro-head"><span>Glucides</span><b>${Math.round(sum.c)} / ${t.glucides} g</b></div>${bar('c', sum.c, t.glucides)}</div>
          <div class="macro"><div class="macro-head"><span>Lipides</span><b>${Math.round(sum.f)} / ${t.lipides} g</b></div>${bar('f', sum.f, t.lipides)}</div>
        </div>
      </div>
      <button class="btn-primary big" id="home-add">📷 Ajouter un repas</button>
    </div>

    ${(typeof QUICK_MEALS !== 'undefined' && QUICK_MEALS.length) ? `
    <div class="card">
      <div class="section-title" style="margin-top:0">⚡ Repas rapides</div>
      ${QUICK_MEALS.map((q, i) => `<div class="list-item">
        <div class="emoji-thumb">${slotEmoji(q.slot)}</div>
        <div class="li-body"><div class="li-title">${esc(q.nom)}</div>
          <div class="li-sub">${q.slot} · ${q.kcal} kcal · ${q.proteines}P ${q.glucides}G ${q.lipides}L</div></div>
        <button class="btn-ghost sm quick-add" data-q="${i}">+ Ajouter</button>
      </div>`).join('')}
    </div>` : ''}

    <div class="card">
      <div class="flex-between">
        <div><div class="section-title" style="margin:0">Séance du jour</div>
          <h2 style="margin:2px 0 0">${pl.emoji} ${pl.type}</h2></div>
        ${pl.rest
          ? '<span class="badge grey">Repos</span>'
          : (w && w.done
            ? '<span class="badge green">✓ Fait</span>'
            : '<button class="btn-ghost sm" id="home-train">Marquer fait</button>')}
      </div>
    </div>

    <div class="card">
      <div class="flex-between" style="margin-bottom:12px">
        <h2 style="margin:0">Score du jour</h2>
        <div class="score-chip">${sc.total}/100</div>
      </div>
      <ul class="score-list">
        ${sc.parts.map(p => `<li><span>${p.label}</span>
          <b class="${p.pts === p.max ? '' : 'muted'}">${p.pts}/${p.max}</b></li>`).join('')}
      </ul>
      <div class="stat-grid mt">
        <div class="stat"><b>🔥${streakDays()}</b><small>jours de série</small></div>
        <div class="stat"><b>${weekScore(s)}</b><small>score semaine</small></div>
        <div class="stat"><b>${state.weights.length ? state.weights[state.weights.length - 1].kg : state.profile.weight}<small style="font-size:12px">kg</small></b><small>poids actuel</small></div>
      </div>
    </div>

    ${sum.kcal === 0 ? `<div class="card center muted">Aucun repas encore aujourd'hui.<br>Prends ton assiette en photo pour commencer 📸</div>` : renderTodayMeals(s)}
  `;
  $('#home-add').onclick = () => addMealFlow(s);
  const ht = $('#home-train'); if (ht) ht.onclick = () => { toggleWorkout(s); renderView('home'); };
  $$('.quick-add', root).forEach(b => b.onclick = () => {
    const q = QUICK_MEALS[Number(b.dataset.q)];
    (state.meals[s] = state.meals[s] || []).push({
      id: 'm' + Date.now() + Math.round(performance.now()), name: q.nom, slot: q.slot,
      kcal: q.kcal, proteines: q.proteines, glucides: q.glucides, lipides: q.lipides,
      photo: null, source: 'quick', ts: Date.now(),
    });
    save(); renderView('home'); toast(`${q.slot} ajouté ✓`);
  });
  bindMealItems(root, s);
};

function renderTodayMeals(s) {
  const meals = state.meals[s] || [];
  return `<div class="card"><h2>Repas d'aujourd'hui</h2>${mealListHtml(meals)}</div>`;
}
function mealListHtml(meals) {
  if (!meals.length) return '<div class="muted center">—</div>';
  return meals.map(m => `
    <div class="list-item" data-mid="${m.id}">
      ${m.photo ? `<img class="thumb" src="${m.photo}"/>` : `<div class="emoji-thumb">${slotEmoji(m.slot)}</div>`}
      <div class="li-body">
        <div class="li-title">${esc(m.name)} ${m.source === 'ai' ? '<span class="badge blue" style="font-size:9px">IA</span>' : ''}</div>
        <div class="li-sub">${m.slot} · ${Math.round(m.proteines)}P ${Math.round(m.glucides)}G ${Math.round(m.lipides)}L</div>
      </div>
      <div class="li-kcal">${Math.round(m.kcal)}<small class="muted"> kcal</small></div>
      <button class="icon-btn del-meal" title="Supprimer">✕</button>
    </div>`).join('');
}
function slotEmoji(slot) { return { 'Petit-déj': '🥣', 'Déjeuner': '🍽️', 'Collation': '🍎', 'Dîner': '🌙' }[slot] || '🍴'; }
function bindMealItems(root, s) {
  $$('.del-meal', root).forEach(b => b.onclick = (e) => {
    const mid = e.target.closest('[data-mid]').dataset.mid;
    state.meals[s] = (state.meals[s] || []).filter(m => m.id !== mid);
    save(); renderView(currentView);
  });
}

function weekScore(s) { return weekDays(s).reduce((a, d) => a + dayScore(d).total, 0); }

/* ---------- MEALS ---------- */
let mealsViewDate = todayStr();
RENDERERS.meals = (root) => {
  const s = mealsViewDate;
  const meals = state.meals[s] || [];
  const sum = meals.reduce((a, m) => ({ k: a.k + m.kcal, p: a.p + m.proteines, c: a.c + m.glucides, f: a.f + m.lipides }), { k: 0, p: 0, c: 0, f: 0 });
  root.innerHTML = `
    <div class="flex-between" style="margin-bottom:12px">
      <button class="btn-ghost sm" id="m-prev">←</button>
      <b>${frDate(s)}</b>
      <button class="btn-ghost sm" id="m-next" ${s >= todayStr() ? 'disabled style="opacity:.4"' : ''}>→</button>
    </div>
    <div class="card">
      <div class="flex-between"><h2 style="margin:0">${Math.round(sum.k)} kcal</h2>
        <span class="muted">${Math.round(sum.p)}P · ${Math.round(sum.c)}G · ${Math.round(sum.f)}L</span></div>
    </div>
    <button class="btn-primary big" id="m-add" style="margin-bottom:14px">📷 Ajouter un repas</button>
    <div class="card"><h2>Repas</h2>${mealListHtml(meals)}</div>
  `;
  $('#m-prev').onclick = () => { mealsViewDate = addDays(s, -1); renderView('meals'); };
  const nx = $('#m-next'); if (s < todayStr()) nx.onclick = () => { mealsViewDate = addDays(s, 1); renderView('meals'); };
  $('#m-add').onclick = () => addMealFlow(s);
  bindMealItems(root, s);
};

/* ---------- Ajout de repas : photo IA ou manuel ---------- */
function addMealFlow(dateStr) {
  const hasKey = !!state.settings.apiKey;
  openModal(`
    <h2>Ajouter un repas</h2>
    <label>Moment
      <select id="am-slot">
        <option>Petit-déj</option><option selected>Déjeuner</option>
        <option>Collation</option><option>Dîner</option>
      </select>
    </label>
    <div class="btn-row mt">
      <button class="btn-primary" id="am-photo" style="flex:1">📷 Depuis une photo${hasKey ? '' : ' 🔒'}</button>
      <button class="btn-ghost" id="am-manual" style="flex:1">✏️ Manuel</button>
    </div>
    <p class="muted mt" style="font-size:12px">
      ${hasKey
        ? 'La photo est analysée par l\'IA pour estimer calories et macros.'
        : 'Ajoute ta clé API (Gemini gratuit ou Claude) dans Réglages pour activer l\'analyse photo. Sinon, saisis à la main.'}
    </p>
    <input type="file" id="am-file" accept="image/*" capture="environment" class="hidden"/>
    <div id="am-work"></div>
  `);
  const slotOf = () => $('#am-slot').value;
  $('#am-manual').onclick = () => manualMealForm(dateStr, slotOf());
  $('#am-photo').onclick = () => {
    if (!hasKey) { toast('Ajoute ta clé API dans Réglages'); renderView('settings'); closeModal(); return; }
    $('#am-file').click();
  };
  $('#am-file').onchange = (e) => {
    const file = e.target.files[0]; if (!file) return;
    const reader = new FileReader();
    reader.onload = () => analyzePhotoFlow(dateStr, slotOf(), reader.result);
    reader.readAsDataURL(file);
  };
}

async function analyzePhotoFlow(dateStr, slot, dataUrl) {
  $('#am-work').innerHTML = `<div class="card center mt"><img class="thumb" style="width:120px;height:120px" src="${dataUrl}"/><div class="mt"><span class="spinner"></span> Analyse en cours…</div></div>`;
  try {
    const r = await analyzePhoto(dataUrl);
    // Pré-remplit le formulaire manuel avec le résultat IA (éditable)
    manualMealForm(dateStr, slot, {
      name: r.plat || 'Repas', kcal: r.kcal, proteines: r.proteines, glucides: r.glucides,
      lipides: r.lipides, photo: dataUrl, source: 'ai', note: r.ingredients,
    });
    toast('Analyse terminée — vérifie et enregistre');
  } catch (err) {
    $('#am-work').innerHTML = `<div class="card mt"><b class="badge red">Échec</b><p class="muted" style="font-size:13px">${esc(err.message)}</p>
      <button class="btn-ghost" id="am-fallback">Saisir manuellement</button></div>`;
    $('#am-fallback').onclick = () => manualMealForm(dateStr, slot, { photo: dataUrl });
  }
}

const VISION_PROMPT = `Tu es un nutritionniste. Analyse cette photo de repas et estime son contenu.
Réponds UNIQUEMENT avec un objet JSON valide, sans texte autour, au format exact :
{"plat":"nom court du plat","ingredients":"liste courte des aliments visibles","kcal":number,"proteines":number,"glucides":number,"lipides":number,"confiance":"faible|moyenne|élevée"}
Les macros sont en grammes pour la portion visible. Estime au mieux même si incertain.`;

const PROVIDERS = {
  gemini: {
    label: 'Google Gemini (gratuit)', keyHint: 'AIza…', keyUrl: 'https://aistudio.google.com/apikey',
    models: [['gemini-2.5-flash', 'Gemini 2.5 Flash — recommandé'], ['gemini-2.0-flash', 'Gemini 2.0 Flash — rapide']],
  },
  claude: {
    label: 'Anthropic Claude', keyHint: 'sk-ant-…', keyUrl: 'https://console.anthropic.com/settings/keys',
    models: [['claude-haiku-4-5-20251001', 'Haiku 4.5 — le moins cher'], ['claude-sonnet-5', 'Sonnet 5'], ['claude-opus-4-8', 'Opus 4.8']],
  },
};
function currentProvider() { return PROVIDERS[state.settings.provider] ? state.settings.provider : 'gemini'; }

function extractJson(txt) {
  const jm = (txt || '').match(/\{[\s\S]*\}/);
  if (!jm) throw new Error('Réponse illisible (réessaie avec une photo plus nette)');
  return JSON.parse(jm[0]);
}
function normalizeVision(obj) {
  ['kcal', 'proteines', 'glucides', 'lipides'].forEach(k => obj[k] = Math.round(Number(obj[k]) || 0));
  return obj;
}

async function analyzePhoto(dataUrl) {
  const m = dataUrl.match(/^data:(image\/\w+);base64,(.*)$/);
  if (!m) throw new Error('Image invalide');
  const media_type = m[1], b64 = m[2];
  if (!state.settings.apiKey) throw new Error('Aucune clé API — ajoute-la dans Réglages');
  return currentProvider() === 'claude' ? analyzeClaude(media_type, b64) : analyzeGemini(media_type, b64);
}

async function analyzeGemini(media_type, b64) {
  const model = (state.settings.model || '').startsWith('gemini') ? state.settings.model : 'gemini-2.5-flash';
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-goog-api-key': state.settings.apiKey },
    body: JSON.stringify({
      contents: [{ parts: [{ inline_data: { mime_type: media_type, data: b64 } }, { text: VISION_PROMPT }] }],
      generationConfig: { temperature: 0.2, responseMimeType: 'application/json' },
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    let msg = t.slice(0, 160);
    if (res.status === 400 && /API_KEY_INVALID|API key not valid/i.test(t)) msg = 'Clé API invalide.';
    else if (res.status === 403) msg = 'Accès refusé — vérifie ta clé (restrictions de domaine ?).';
    else if (res.status === 429) msg = 'Quota atteint, réessaie dans un moment.';
    throw new Error(`Gemini ${res.status} — ${msg}`);
  }
  const data = await res.json();
  const parts = (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) || [];
  const txt = parts.map(p => p.text || '').join('').trim();
  return normalizeVision(extractJson(txt));
}

async function analyzeClaude(media_type, b64) {
  const model = (state.settings.model || '').startsWith('claude') ? state.settings.model : 'claude-haiku-4-5-20251001';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      'x-api-key': state.settings.apiKey,
      'anthropic-version': '2023-06-01',
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify({
      model, max_tokens: 500,
      messages: [{ role: 'user', content: [
        { type: 'image', source: { type: 'base64', media_type, data: b64 } },
        { type: 'text', text: VISION_PROMPT },
      ] }],
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => '');
    throw new Error(`Claude ${res.status} — ${res.status === 401 ? 'Clé API invalide.' : t.slice(0, 140)}`);
  }
  const data = await res.json();
  const txt = (data.content || []).map(c => c.text || '').join('').trim();
  return normalizeVision(extractJson(txt));
}

function manualMealForm(dateStr, slot, pre = {}) {
  openModal(`
    <h2>${pre.source === 'ai' ? '🤖 Résultat IA (modifiable)' : '✏️ Repas manuel'}</h2>
    ${pre.photo ? `<div class="center"><img class="thumb" style="width:90px;height:90px" src="${pre.photo}"/></div>` : ''}
    ${pre.note ? `<p class="muted" style="font-size:12px">${esc(pre.note)}</p>` : ''}
    <label>Nom du repas<input id="mm-name" value="${esc(pre.name || '')}" placeholder="Ex: Poulet riz brocoli"/></label>
    <label>Moment
      <select id="mm-slot">
        ${['Petit-déj', 'Déjeuner', 'Collation', 'Dîner'].map(x => `<option ${x === slot ? 'selected' : ''}>${x}</option>`).join('')}
      </select>
    </label>
    <div class="section-title mt">Ou choisis un aliment de la base</div>
    <select id="mm-food"><option value="">— Aliment (pour 100g) —</option>
      ${allFoods().map((f, i) => `<option value="${i}">${esc(f.nom)} · ${f.kcal}kcal/100g</option>`).join('')}
    </select>
    <div class="row mt" id="mm-foodqty" style="display:none">
      <label>Quantité (g)<input id="mm-grams" type="number" value="150"/></label>
      <label style="align-self:end"><button class="btn-ghost" id="mm-apply">Appliquer</button></label>
    </div>
    <div class="divider"></div>
    <div class="row">
      <label>Calories<input id="mm-kcal" type="number" value="${pre.kcal || ''}"/></label>
      <label>Protéines (g)<input id="mm-p" type="number" value="${pre.proteines || ''}"/></label>
    </div>
    <div class="row">
      <label>Glucides (g)<input id="mm-c" type="number" value="${pre.glucides || ''}"/></label>
      <label>Lipides (g)<input id="mm-f" type="number" value="${pre.lipides || ''}"/></label>
    </div>
    <button class="btn-primary big" id="mm-save">Enregistrer</button>
  `);
  const foodSel = $('#mm-food');
  foodSel.onchange = () => { $('#mm-foodqty').style.display = foodSel.value === '' ? 'none' : 'grid'; };
  $('#mm-apply').onclick = () => {
    const f = allFoods()[Number(foodSel.value)]; if (!f) return;
    const g = Number($('#mm-grams').value) || 0; const r = g / 100;
    $('#mm-kcal').value = Math.round(f.kcal * r);
    $('#mm-p').value = Math.round(f.proteines * r);
    $('#mm-c').value = Math.round(f.glucides * r);
    $('#mm-f').value = Math.round(f.lipides * r);
    if (!$('#mm-name').value) $('#mm-name').value = f.nom;
  };
  $('#mm-save').onclick = () => {
    const meal = {
      id: 'm' + Date.now() + Math.round(performance.now()),
      name: $('#mm-name').value.trim() || 'Repas',
      slot: $('#mm-slot').value,
      kcal: Number($('#mm-kcal').value) || 0,
      proteines: Number($('#mm-p').value) || 0,
      glucides: Number($('#mm-c').value) || 0,
      lipides: Number($('#mm-f').value) || 0,
      photo: pre.photo || null,
      source: pre.source || 'manual',
      ts: Date.now(),
    };
    (state.meals[dateStr] = state.meals[dateStr] || []).push(meal);
    save(); closeModal(); renderView(currentView);
    toast('Repas ajouté ✓');
  };
}

/* ---------- PLAN de la semaine ---------- */
RENDERERS.plan = (root) => {
  root.innerHTML = `
    <div class="card">
      <h2>📅 Plan de la semaine</h2>
      <p class="muted" style="font-size:13px">Recettes basées sur tes aliments préférés, calées sur ~${state.profile.targets.kcal} kcal / jour.
      Touche un repas pour l'ajouter à ton journal.</p>
    </div>
    <div class="pill-nav" id="plan-nav">
      ${MEAL_PLAN.days.map((d, i) => `<button class="chip-btn ${i === planDayIdx ? 'active' : ''}" data-i="${i}">${d.jour}</button>`).join('')}
    </div>
    <div id="plan-day"></div>
  `;
  $$('#plan-nav .chip-btn').forEach(b => b.onclick = () => { planDayIdx = Number(b.dataset.i); renderView('plan'); });
  renderPlanDay();
};
let planDayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
function renderPlanDay() {
  const d = MEAL_PLAN.days[planDayIdx]; if (!d) return;
  $('#plan-day').innerHTML = `
    <div class="card">
      <div class="flex-between"><h2 style="margin:0">${d.jour}</h2>
        <span class="badge orange">${d.totaux.kcal} kcal</span></div>
      <div class="muted" style="font-size:12px;margin-top:4px">${d.totaux.proteines}P · ${d.totaux.glucides}G · ${d.totaux.lipides}L</div>
      <div class="divider"></div>
      ${d.repas.map((r, ri) => `
        <div class="plan-meal">
          <div class="pm-top"><b>${slotEmoji(r.moment)} ${esc(r.nom)}</b><span class="li-kcal">${r.kcal} kcal</span></div>
          <div class="li-sub">${r.moment} · ${r.proteines}P ${r.glucides}G ${r.lipides}L</div>
          <div class="muted" style="font-size:12px;margin:6px 0">${esc(r.ingredients.map(x => `${x.aliment} ${x.grammes}g`).join(', '))}</div>
          <div class="muted" style="font-size:12px">${esc(r.preparation)}</div>
          <button class="btn-ghost sm mt" data-add="${ri}">+ Ajouter à aujourd'hui</button>
        </div>`).join('')}
    </div>
    ${d.notes ? `<div class="card muted" style="font-size:13px">💡 ${esc(d.notes)}</div>` : ''}
  `;
  $$('#plan-day [data-add]').forEach(b => b.onclick = () => {
    const r = d.repas[Number(b.dataset.add)];
    const s = todayStr();
    (state.meals[s] = state.meals[s] || []).push({
      id: 'm' + Date.now() + Math.round(performance.now()), name: r.nom, slot: r.moment,
      kcal: r.kcal, proteines: r.proteines, glucides: r.glucides, lipides: r.lipides,
      photo: null, source: 'plan', ts: Date.now(),
    });
    save(); toast(`${r.nom} ajouté à aujourd'hui ✓`);
  });
}

/* ---------- ENTRAÎNEMENTS ---------- */
RENDERERS.train = (root) => {
  const s = todayStr();
  const days = weekDays(s);
  root.innerHTML = `
    <div class="card">
      <h2>💪 Ma semaine d'entraînement</h2>
      <p class="muted" style="font-size:13px">Lun · Mer · Ven → Street workout 🤸 &nbsp;|&nbsp; Mar · Jeu · Sam → Course à pied 🏃 &nbsp;|&nbsp; Dim → Repos 😴</p>
      <div class="week-grid mt">
        ${days.map(d => {
          const pl = plannedWorkout(d); const w = state.workouts[d];
          const done = w && w.done; const isToday = d === s;
          return `<div class="day-cell ${isToday ? 'today' : ''} ${done ? 'done' : ''}" data-d="${d}">
            <b>${JOURS_C[parseD(d).getDay()]}</b>
            <div class="d-emoji">${done ? '✅' : pl.emoji}</div>
            <small>${pl.rest ? 'Repos' : pl.type.split(' ')[0]}</small>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="card">
      <h3>Cette semaine</h3>
      <div class="stat-grid">
        <div class="stat"><b>${days.filter(d => state.workouts[d] && state.workouts[d].done).length}</b><small>séances faites</small></div>
        <div class="stat"><b>${days.filter(d => !plannedWorkout(d).rest).length}</b><small>séances prévues</small></div>
        <div class="stat"><b>${totalKm(days)}<small style="font-size:12px">km</small></b><small>course</small></div>
      </div>
    </div>
    <div class="card muted" style="font-size:13px">
      ⌚ <b>Apple Santé / BeReal :</b> pas de connexion automatique possible depuis une app web locale (voir Réglages). Marque tes séances ici ; tu peux noter la durée / distance.
    </div>
  `;
  $$('.day-cell', root).forEach(c => c.onclick = () => workoutModal(c.dataset.d));
};
function totalKm(days) {
  return days.reduce((a, d) => a + ((state.workouts[d] && Number(state.workouts[d].distance)) || 0), 0).toFixed(1).replace('.0', '');
}
function toggleWorkout(s) {
  const pl = plannedWorkout(s); if (pl.rest) return;
  state.workouts[s] = Object.assign({ type: pl.type }, state.workouts[s], { done: !(state.workouts[s] && state.workouts[s].done) });
  save();
}
function workoutModal(s) {
  const pl = plannedWorkout(s); const w = state.workouts[s] || {};
  openModal(`
    <h2>${pl.emoji} ${frDate(s)}</h2>
    <p class="muted">Séance prévue : <b style="color:var(--text)">${pl.type}</b></p>
    ${pl.rest ? '<p class="muted">Jour de repos — profite pour récupérer 😌</p>' : `
      <label>Durée (min)<input id="w-dur" type="number" value="${w.duration || ''}" placeholder="Ex: 45"/></label>
      ${pl.type === 'Course à pied' ? `<label>Distance (km)<input id="w-dist" type="number" step="0.1" value="${w.distance || ''}" placeholder="Ex: 5"/></label>` : ''}
      <label>Notes<textarea id="w-note" rows="2" placeholder="Ex: 4 séries tractions, dips…">${esc(w.note || '')}</textarea></label>
      <button class="btn-primary big" id="w-save">${w.done ? 'Mettre à jour ✓' : 'Marquer comme fait ✓'}</button>
      ${w.done ? '<button class="btn-ghost big mt" id="w-undo" style="width:100%">Annuler la séance</button>' : ''}
    `}
  `);
  if (!pl.rest) {
    $('#w-save').onclick = () => {
      state.workouts[s] = {
        type: pl.type, done: true,
        duration: Number($('#w-dur').value) || null,
        distance: $('#w-dist') ? Number($('#w-dist').value) || null : null,
        note: $('#w-note').value.trim(),
      };
      save(); closeModal(); renderView('train'); toast('Séance enregistrée 💪');
    };
    const undo = $('#w-undo'); if (undo) undo.onclick = () => { delete state.workouts[s]; save(); closeModal(); renderView('train'); };
  }
}

/* ---------- PROGRESSION ---------- */
RENDERERS.progress = (root) => {
  const s = todayStr();
  const cur = state.weights.length ? state.weights[state.weights.length - 1].kg : state.profile.weight;
  const start = state.weights.length ? state.weights[0].kg : state.profile.weight;
  const goal = state.profile.goal;
  const lost = (start - cur).toFixed(1);
  root.innerHTML = `
    <div class="card">
      <div class="flex-between"><h2 style="margin:0">📈 Poids</h2>
        <button class="btn-ghost sm" id="pr-addw">+ Peser</button></div>
      <div class="stat-grid mt">
        <div class="stat"><b>${cur}<small style="font-size:12px">kg</small></b><small>actuel</small></div>
        <div class="stat"><b>${lost > 0 ? '−' + lost : (lost < 0 ? '+' + Math.abs(lost) : '0')}<small style="font-size:12px">kg</small></b><small>depuis le début</small></div>
        <div class="stat"><b>${goal}<small style="font-size:12px">kg</small></b><small>objectif</small></div>
      </div>
      <div class="chart-wrap mt">${weightChart()}</div>
    </div>
    <div class="card">
      <h2>🏆 Scores hebdomadaires</h2>
      ${weekHistoryHtml(s)}
    </div>
    <div class="card">
      <h3>Objectifs actuels</h3>
      <ul class="score-list">
        <li><span>Calories / jour</span><b>${state.profile.targets.kcal} kcal</b></li>
        <li><span>Protéines</span><b>${state.profile.targets.proteines} g</b></li>
        <li><span>Glucides</span><b>${state.profile.targets.glucides} g</b></li>
        <li><span>Lipides</span><b>${state.profile.targets.lipides} g</b></li>
        <li><span>Maintenance estimée</span><b>${state.profile.targets.tdee} kcal</b></li>
      </ul>
    </div>
  `;
  $('#pr-addw').onclick = () => weightModal();
};
function weightModal() {
  const last = state.weights.length ? state.weights[state.weights.length - 1].kg : state.profile.weight;
  openModal(`
    <h2>Nouvelle pesée</h2>
    <label>Date<input id="wt-date" type="date" value="${todayStr()}"/></label>
    <label>Poids (kg)<input id="wt-kg" type="number" step="0.1" value="${last}"/></label>
    <button class="btn-primary big" id="wt-save">Enregistrer</button>
  `);
  $('#wt-save').onclick = () => {
    const date = $('#wt-date').value, kg = Number($('#wt-kg').value);
    if (!kg) return;
    state.weights = state.weights.filter(w => w.date !== date);
    state.weights.push({ date, kg });
    state.weights.sort((a, b) => a.date.localeCompare(b.date));
    save(); closeModal(); renderView('progress'); toast('Pesée enregistrée ✓');
  };
}
function weightChart() {
  const pts = state.weights.slice();
  if (pts.length < 2) return '<div class="muted center" style="padding:30px">Ajoute au moins 2 pesées pour voir la courbe 📉</div>';
  const W = 600, H = 200, pad = 30;
  const kgs = pts.map(p => p.kg).concat([state.profile.goal]);
  const min = Math.min(...kgs) - 0.5, max = Math.max(...kgs) + 0.5;
  const x = i => pad + (i / (pts.length - 1)) * (W - 2 * pad);
  const y = kg => H - pad - ((kg - min) / (max - min)) * (H - 2 * pad);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ');
  const goalY = y(state.profile.goal);
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none">
    <line x1="${pad}" y1="${goalY}" x2="${W - pad}" y2="${goalY}" stroke="var(--green)" stroke-dasharray="4 4" stroke-width="1.5"/>
    <text x="${W - pad}" y="${goalY - 5}" fill="var(--green)" font-size="11" text-anchor="end">objectif ${state.profile.goal}kg</text>
    <path d="${line}" fill="none" stroke="var(--accent)" stroke-width="2.5" stroke-linejoin="round"/>
    ${pts.map((p, i) => `<circle cx="${x(i)}" cy="${y(p.kg)}" r="3.5" fill="var(--accent)"/>`).join('')}
    <text x="${pad}" y="${H - 8}" fill="var(--muted)" font-size="10">${pts[0].date.slice(5)}</text>
    <text x="${W - pad}" y="${H - 8}" fill="var(--muted)" font-size="10" text-anchor="end">${pts[pts.length - 1].date.slice(5)}</text>
  </svg>`;
}
function weekHistoryHtml(s) {
  const weeks = [];
  let ws = weekStart(s);
  for (let i = 0; i < 6; i++) { weeks.push(ws); ws = addDays(ws, -7); }
  return `<ul class="score-list">${weeks.map(w => {
    const total = weekDays(w).reduce((a, d) => a + dayScore(d).total, 0);
    const max = 700;
    return `<li><span>Sem. du ${frDate(w).replace(/^\w+ /, '')}</span>
      <span style="display:flex;align-items:center;gap:8px;min-width:120px">
        <span class="bar k" style="width:70px"><i style="width:${Math.min(100, total / max * 100)}%"></i></span>
        <b>${total}</b></span></li>`;
  }).join('')}</ul>`;
}

/* ---------- ALIMENTS & préférences ---------- */
function allFoods() {
  const base = FOODS.map(f => Object.assign({}, f));
  return base.concat(state.customFoods);
}
function likedState(nom) {
  if (nom in state.foodPrefs) return state.foodPrefs[nom];
  const f = FOODS.find(x => x.nom === nom);
  return f ? !!f.aime : null;
}
let foodFilter = 'all';
RENDERERS.foods = (root) => {
  const cats = ['all', ...Array.from(new Set(allFoods().map(f => f.categorie)))];
  const foods = allFoods().filter(f => foodFilter === 'all' || f.categorie === foodFilter);
  root.innerHTML = `
    <div class="card">
      <h2>🥑 Aliments</h2>
      <p class="muted" style="font-size:13px">Dis-moi ce que tu aimes 👍 / 👎 — ça affine tes recettes.</p>
    </div>
    ${SUGGESTIONS.filter(s => !(s.nom in state.foodPrefs)).length ? `
    <div class="card">
      <div class="section-title" style="margin-top:0">💡 À découvrir — tu aimes ?</div>
      ${SUGGESTIONS.filter(s => !(s.nom in state.foodPrefs)).map(s => `
        <div class="food-row" data-sug="${esc(s.nom)}">
          <div class="li-body"><div class="li-title">${esc(s.nom)}</div>
            <div class="li-sub">${esc(s.pourquoi)}</div>
            <div class="li-sub">${s.kcal}kcal · ${s.proteines}P ${s.glucides}G ${s.lipides}L /100g</div></div>
          <div class="pref-btns"><button class="pref-yes">👍</button><button class="pref-no">👎</button></div>
        </div>`).join('')}
    </div>` : ''}
    <div class="pill-nav">
      ${cats.map(c => `<button class="chip-btn ${c === foodFilter ? 'active' : ''}" data-cat="${esc(c)}">${c === 'all' ? 'Tous' : esc(c)}</button>`).join('')}
    </div>
    <div class="card">
      <div class="flex-between"><h3 style="margin:0">Base d'aliments (${foods.length})</h3>
        <button class="btn-ghost sm" id="f-add">+ Créer</button></div>
      ${foods.map(f => {
        const liked = likedState(f.nom);
        return `<div class="food-row" data-food="${esc(f.nom)}">
          <div class="li-body"><div class="li-title">${esc(f.nom)} ${liked === true ? '❤️' : ''}</div>
            <div class="li-sub">${f.categorie} · ${f.kcal}kcal · ${f.proteines}P ${f.glucides}G ${f.lipides}L /100g</div></div>
          <div class="pref-btns">
            <button class="pref-yes ${liked === true ? 'on-yes' : ''}">👍</button>
            <button class="pref-no ${liked === false ? 'on-no' : ''}">👎</button>
          </div>
        </div>`;
      }).join('')}
    </div>
  `;
  $$('.pill-nav .chip-btn').forEach(b => b.onclick = () => { foodFilter = b.dataset.cat; renderView('foods'); });
  $$('[data-sug]', root).forEach(rowBind);
  $$('[data-food]', root).forEach(rowBind);
  $('#f-add').onclick = () => customFoodModal();
  function rowBind(row) {
    const nom = row.dataset.sug || row.dataset.food;
    $('.pref-yes', row).onclick = () => { state.foodPrefs[nom] = true; save(); renderView('foods'); toast(`👍 ${nom} ajouté à tes goûts`); };
    $('.pref-no', row).onclick = () => { state.foodPrefs[nom] = false; save(); renderView('foods'); };
  }
};
function customFoodModal() {
  openModal(`
    <h2>Créer un aliment</h2>
    <label>Nom<input id="cf-nom"/></label>
    <label>Catégorie<input id="cf-cat" value="Autres"/></label>
    <div class="section-title mt">Valeurs pour 100g</div>
    <div class="row"><label>Calories<input id="cf-k" type="number"/></label><label>Protéines<input id="cf-p" type="number"/></label></div>
    <div class="row"><label>Glucides<input id="cf-c" type="number"/></label><label>Lipides<input id="cf-f" type="number"/></label></div>
    <button class="btn-primary big" id="cf-save">Créer</button>
  `);
  $('#cf-save').onclick = () => {
    const nom = $('#cf-nom').value.trim(); if (!nom) return;
    state.customFoods.push({
      nom, categorie: $('#cf-cat').value.trim() || 'Autres',
      kcal: Number($('#cf-k').value) || 0, proteines: Number($('#cf-p').value) || 0,
      glucides: Number($('#cf-c').value) || 0, lipides: Number($('#cf-f').value) || 0, aime: true,
    });
    state.foodPrefs[nom] = true;
    save(); closeModal(); renderView('foods'); toast('Aliment créé ✓');
  };
}

/* ---------- RÉGLAGES ---------- */
RENDERERS.settings = (root) => {
  const p = state.profile;
  const prov = currentProvider();
  root.innerHTML = `
    <div class="card">
      <h2>👤 Profil & objectifs</h2>
      <div class="row"><label>Taille (cm)<input id="s-height" type="number" value="${p.height}"/></label>
        <label>Poids (kg)<input id="s-weight" type="number" value="${p.weight}"/></label></div>
      <div class="row"><label>Âge<input id="s-age" type="number" value="${p.age}"/></label>
        <label>Poids cible (kg)<input id="s-goal" type="number" value="${p.goal}"/></label></div>
      <label>Activité (hors sport)
        <select id="s-activity">
          <option value="1.375" ${p.activity == 1.375 ? 'selected' : ''}>Sédentaire</option>
          <option value="1.55" ${p.activity == 1.55 ? 'selected' : ''}>Modéré</option>
          <option value="1.725" ${p.activity == 1.725 ? 'selected' : ''}>Élevé</option>
        </select></label>
      <label>Intensité de sèche
        <select id="s-deficit">
          <option value="0.15" ${p.deficit == 0.15 ? 'selected' : ''}>Douce (-15%)</option>
          <option value="0.20" ${p.deficit == 0.20 ? 'selected' : ''}>Standard (-20%)</option>
          <option value="0.25" ${p.deficit == 0.25 ? 'selected' : ''}>Agressive (-25%)</option>
        </select></label>
      <button class="btn-primary big" id="s-save-profile">Recalculer mes objectifs</button>
    </div>

    <div class="card">
      <h2>🤖 Analyse photo (IA)</h2>
      <p class="muted" style="font-size:13px">Choisis un fournisseur et colle ta clé pour estimer calories & macros depuis une photo. La clé reste stockée uniquement sur cet appareil.</p>
      <label>Fournisseur
        <select id="s-provider">
          <option value="gemini" ${prov === 'gemini' ? 'selected' : ''}>Google Gemini — gratuit ✅</option>
          <option value="claude" ${prov === 'claude' ? 'selected' : ''}>Anthropic Claude</option>
        </select></label>
      <label>Clé API<input id="s-key" type="password" value="${esc(state.settings.apiKey)}" placeholder="${PROVIDERS[prov].keyHint}"/></label>
      <label>Modèle<select id="s-model"></select></label>
      <button class="btn-ghost" id="s-save-key">Enregistrer</button>
      <p class="muted mt" style="font-size:12px">🔑 Créer une clé gratuite : <a id="s-key-link" href="${PROVIDERS[prov].keyUrl}" target="_blank" rel="noopener">${prov === 'gemini' ? 'aistudio.google.com' : 'console.anthropic.com'}</a></p>
      <p class="muted" style="font-size:12px">🔒 Ta clé reste sur cet appareil, envoyée uniquement au fournisseur choisi.</p>
    </div>

    <div class="card">
      <h2>⌚ Apple Santé / BeReal</h2>
      <p class="muted" style="font-size:13px">Une app web locale ne peut pas lire Apple Santé (données sur l'iPhone, accès réservé à une app iOS/HealthKit) ni BeReal (pas d'API publique). Tes séances se notent donc à la main dans l'onglet Sport. Tu peux exporter Santé en fichier et l'importer plus tard si on ajoute cette option.</p>
    </div>

    <div class="card">
      <h2>💾 Données</h2>
      <div class="btn-row">
        <button class="btn-ghost" id="s-export">Exporter (JSON)</button>
        <button class="btn-ghost" id="s-import">Importer</button>
        <button class="btn-ghost" id="s-reset" style="color:var(--red)">Réinitialiser</button>
      </div>
      <input type="file" id="s-import-file" accept="application/json" class="hidden"/>
    </div>
  `;
  $('#s-save-profile').onclick = () => {
    Object.assign(p, {
      height: Number($('#s-height').value), weight: Number($('#s-weight').value),
      age: Number($('#s-age').value), goal: Number($('#s-goal').value),
      activity: Number($('#s-activity').value), deficit: Number($('#s-deficit').value),
    });
    p.targets = computeTargets(p);
    save(); renderView('settings'); toast(`Objectif : ${p.targets.kcal} kcal / ${p.targets.proteines}g protéines`);
  };
  const provSel = $('#s-provider');
  const fillModels = (pv) => {
    $('#s-model').innerHTML = PROVIDERS[pv].models.map(([v, l]) =>
      `<option value="${v}" ${state.settings.model === v ? 'selected' : ''}>${l}</option>`).join('');
  };
  fillModels(prov);
  provSel.onchange = () => {
    const pv = provSel.value;
    fillModels(pv);
    $('#s-key').placeholder = PROVIDERS[pv].keyHint;
    const lk = $('#s-key-link'); lk.href = PROVIDERS[pv].keyUrl;
    lk.textContent = pv === 'gemini' ? 'aistudio.google.com' : 'console.anthropic.com';
  };
  $('#s-save-key').onclick = () => {
    state.settings.provider = provSel.value;
    state.settings.apiKey = $('#s-key').value.trim();
    state.settings.model = $('#s-model').value;
    save(); toast('Réglages enregistrés ✓');
  };
  $('#s-export').onclick = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob);
    a.download = 'seche-data-' + todayStr() + '.json'; a.click();
  };
  $('#s-import').onclick = () => $('#s-import-file').click();
  $('#s-import-file').onchange = (e) => {
    const f = e.target.files[0]; if (!f) return;
    const r = new FileReader();
    r.onload = () => { try { state = Object.assign(structuredClone(DEFAULT_STATE), JSON.parse(r.result)); save(); renderView('settings'); toast('Données importées ✓'); } catch { toast('Fichier invalide'); } };
    r.readAsText(f);
  };
  $('#s-reset').onclick = () => {
    if (confirm('Tout effacer ? Cette action est irréversible.')) { localStorage.removeItem(KEY); location.reload(); }
  };
};

/* ============================================================
   ONBOARDING & BOOT
   ============================================================ */
function showApp() {
  $('#onboarding').classList.add('hidden');
  ['#topbar', '#views', '#tabbar'].forEach(s => $(s).classList.remove('hidden'));
  renderView('home');
}
function showOnboarding() {
  $('#onboarding').classList.remove('hidden');
  ['#topbar', '#views', '#tabbar'].forEach(s => $(s).classList.add('hidden'));
  $('#onb-save').onclick = () => {
    const p = {
      sex: $('#onb-sex').value,
      height: Number($('#onb-height').value), weight: Number($('#onb-weight').value),
      age: Number($('#onb-age').value), goal: Number($('#onb-goal').value),
      activity: Number($('#onb-activity').value), deficit: Number($('#onb-deficit').value),
    };
    p.targets = computeTargets(p);
    state.profile = p;
    state.weights = [{ date: todayStr(), kg: p.weight }];
    save(); showApp();
    toast(`🎯 Objectif : ${p.targets.kcal} kcal & ${p.targets.proteines}g de protéines / jour`);
  };
}

$$('#tabbar .tab').forEach(b => b.onclick = () => renderView(b.dataset.view));

if (state.profile) showApp(); else showOnboarding();

/* Service worker : app installable + hors-ligne (ignore les erreurs en local file://) */
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));
}

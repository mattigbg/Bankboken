(() => {
  "use strict";

  // ---------- grunddata ----------
  const GROUPS = ["Boende", "Transport", "Mat & hushåll", "Abonnemang", "Sparande", "Övrigt"];
  const TEMPLATE = {
    income: [["Lön (netto)", 28000]],
    fixed: [
      ["Hyra/avgift", "Boende", 9500], ["Hemförsäkring", "Boende", 180], ["Bredband", "Boende", 399],
      ["Kollektivtrafik", "Transport", 990],
      ["Mobil", "Abonnemang", 249], ["Streaming", "Abonnemang", 300], ["Gym", "Abonnemang", 400],
      ["Buffertsparande", "Sparande", 1500], ["Fondsparande (ISK)", "Sparande", 2000]
    ],
    cats: [
      ["El", "Boende", 600], ["Bil & bränsle", "Transport", 1200],
      ["Matbutik", "Mat & hushåll", 4500], ["Hygien & hushåll", "Mat & hushåll", 500], ["Restaurang & fika", "Mat & hushåll", 1000],
      ["Kläder", "Övrigt", 600], ["Nöje", "Övrigt", 800], ["Presenter", "Övrigt", 300], ["Oförutsett", "Övrigt", 500]
    ]
  };
  const MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
  const SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];
  const PLAN = "_plan"; // raden i databasen som håller kategorier, fasta utgifter och inkomster

  // ---------- hjälpfunktioner ----------
  const $ = id => document.getElementById(id);
  const rid = () => Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 8);
  const nf0 = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kr = n => { const v = Math.round((n || 0) * 100) / 100; return (Number.isInteger(v) ? nf0 : nf2).format(v) + " kr"; };
  const sum = (arr, f) => arr.reduce((s, x) => s + (f(x) || 0), 0);
  const lsGet = (k, fb) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : fb; } catch { return fb; } };
  const lsSet = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} };
  const lsDel = k => { try { localStorage.removeItem(k); } catch {} };
  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isStandalone = window.navigator.standalone === true || window.matchMedia("(display-mode: standalone)").matches;

  function parseKr(s) {
    s = String(s ?? "").replace(/kr/gi, "").replace(/[\s  ]/g, "").replace(/−/g, "-").replace(",", ".");
    if (s === "") return 0;
    const n = Number(s);
    return Number.isFinite(n) ? Math.round(n * 100) / 100 : NaN;
  }
  const fmtInput = n => (n ? String(n).replace(".", ",") : "");
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const parseISO = s => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
  const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const today0 = () => { const t = new Date(); return new Date(t.getFullYear(), t.getMonth(), t.getDate()); };
  const keyOf = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
  function shiftKey(key, delta) {
    let [y, m] = key.split("-").map(Number); m += delta;
    while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; }
    return keyOf(y, m);
  }
  const monthDiff = (a, b) => { const [ya, ma] = a.split("-").map(Number), [yb, mb] = b.split("-").map(Number); return (yb - ya) * 12 + (mb - ma); };
  const mIndex = key => Number(key.split("-")[1]) - 1;
  function monthName(key) { const [y, m] = key.split("-").map(Number); const n = MONTHS[m - 1]; return n[0].toUpperCase() + n.slice(1) + " " + y; }
  const monthLabel = key => monthName(key).toLowerCase();
  const fmtDay = s => { const [, m, d] = s.split("-").map(Number); return `${d} ${SHORT[m - 1]}`; };

  // ---------- lönedag och helgdagar ----------
  function easter(y) {
    const a = y % 19, b = Math.floor(y / 100), c = y % 100, d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3), hh = (19 * a + b - d - g + 15) % 30, i = Math.floor(c / 4), k = c % 4;
    const l = (32 + 2 * e + 2 * i - hh - k) % 7, m = Math.floor((a + 11 * hh + 22 * l) / 451);
    const mo = Math.floor((hh + l - 7 * m + 114) / 31), da = ((hh + l - 7 * m + 114) % 31) + 1;
    return new Date(y, mo - 1, da);
  }
  const hcache = {};
  // Dagar då banker inte betalar ut lön: helgdagar samt julafton, midsommarafton och nyårsafton.
  function holidays(y) {
    if (hcache[y]) return hcache[y];
    const s = new Set(["01-01", "01-06", "05-01", "06-06", "12-24", "12-25", "12-26", "12-31"].map(x => `${y}-${x}`));
    const e = easter(y);
    for (const off of [-2, 1, 39]) s.add(iso(addDays(e, off)));
    for (let d = 19; d <= 25; d++) { const dt = new Date(y, 5, d); if (dt.getDay() === 5) s.add(iso(dt)); }
    return (hcache[y] = s);
  }
  const isNonBankDay = d => d.getDay() === 0 || d.getDay() === 6 || holidays(d.getFullYear()).has(iso(d));
  function autoPayday(key) {
    const [y, m] = key.split("-").map(Number);
    let d = new Date(y, m - 2, 25);
    while (isNonBankDay(d)) d = addDays(d, -1);
    return d;
  }
  // Budgetmånaden "november" börjar på lönedagen i oktober.
  function periodStart(key) {
    const [y, m] = key.split("-").map(Number);
    if (store.settings.startDay !== 25) return new Date(y, m - 1, 1);
    const o = plan()?.paydays?.[key];
    return o ? parseISO(o) : autoPayday(key);
  }
  function period(key) {
    const start = periodStart(key), end = addDays(periodStart(shiftKey(key, 1)), -1);
    return { start, end, days: Math.round((end - start) / 864e5) + 1 };
  }
  function keyForDate(d) {
    let k = keyOf(d.getFullYear(), d.getMonth() + 1);
    if (d >= periodStart(shiftKey(k, 1))) k = shiftKey(k, 1);
    else if (d < periodStart(k)) k = shiftKey(k, -1);
    return k;
  }
  const currentKey = () => keyForDate(today0());
  function elapsed(key) {
    const { start, end, days } = period(key), t = today0();
    if (t < start) return { f: 0, day: 0, days };
    if (t > end) return { f: 1, day: days, days };
    const day = Math.round((t - start) / 864e5) + 1;
    return { f: day / days, day, days };
  }
  function defaultDate(key) {
    const { start, end } = period(key), t = today0();
    return iso(t >= start && t <= end ? t : start);
  }

  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === "class") el.className = v;
      else if (k === "text") el.textContent = v;
      else if (k === "value") el.value = v;
      else if (k === "style") el.style.cssText = v;
      else if (k.startsWith("on")) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? "" : v);
    }
    for (const c of kids.flat()) { if (c == null || c === false) continue; el.append(c instanceof Node ? c : document.createTextNode(String(c))); }
    return el;
  }

  let toastTimer;
  function toast(msg, kind = "", ms = 2800) {
    document.querySelectorAll(".toast").forEach(n => n.remove());
    const n = h("div", { class: "toast " + kind, role: "status", text: msg }); document.body.append(n);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => n.remove(), ms);
  }
  function setSync(text, kind = "") { const s = $("sync"); s.textContent = text; s.className = "sync " + kind; }
  const isNetworkError = e => !e || e.status === 0 || /fetch|network|load failed|offline/i.test(e.message || "");
  const isAuthError = e => e && (e.status === 401 || e.code === "PGRST301" || /jwt|token/i.test(e.message || ""));

  // ---------- lagring: Supabase i molnet, med kopia i telefonen ----------
  const CFG = window.HK_CONFIG || {};
  const CLOUD = !!(CFG.supabaseUrl && CFG.supabaseKey && window.supabase);

  const store = {
    sb: null, user: null, loaded: false,
    synced: false, // sant när molnet har lästs in, så att inget skrivs över som finns på en annan enhet
    months: {}, settings: { startDay: 1 },
    outbox: [], flushing: false, channel: null, timer: 0,

    get uid() { return this.user ? this.user.id : "local"; },
    loadCache() {
      const c = lsGet("hk-cache-" + this.uid, null);
      if (c) { this.months = c.months || {}; this.settings = c.settings || { startDay: 1 }; }
      this.outbox = lsGet("hk-outbox-" + this.uid, []);
      return !!c;
    },
    saveCache() { lsSet("hk-cache-" + this.uid, { months: this.months, settings: this.settings }); },
    saveOutbox() { lsSet("hk-outbox-" + this.uid, this.outbox); },

    // Alla ändringar går hit: sparas i telefonen direkt och i molnet så fort det går.
    setMonth(key, data) { this.months[key] = data; this.saveCache(); this.queue("m", key); },
    setSettings(s) { this.settings = s; this.saveCache(); this.queue("s", "s"); },
    queue(k, id) {
      if (!CLOUD) return;
      if (!this.outbox.some(o => o.k === k && o.id === id)) { this.outbox.push({ k, id }); this.saveOutbox(); }
      setSync("Sparar…");
      clearTimeout(this.timer); this.timer = setTimeout(() => this.flush(), 400);
    },
    pending(k, id) { return this.outbox.some(o => o.k === k && o.id === id); },

    async flush() {
      if (!CLOUD || !this.user || this.flushing) return;
      this.flushing = true;
      try {
        while (this.outbox.length) {
          setSync("Sparar…");
          const op = this.outbox[0], now = new Date().toISOString();
          let res, sent;
          if (op.k === "m") {
            sent = JSON.stringify(this.months[op.id] || {});
            res = await this.sb.from("budget_months").upsert({ user_id: this.user.id, month: op.id, data: JSON.parse(sent), updated_at: now });
          } else {
            sent = JSON.stringify(this.settings);
            res = await this.sb.from("budget_settings").upsert({ user_id: this.user.id, start_day: this.settings.startDay, updated_at: now });
          }
          if (res.error) {
            if (isNetworkError(res.error)) { setSync("Offline", "warn"); return; }
            if (isAuthError(res.error)) { await this.sb.auth.refreshSession().catch(() => {}); setSync("Logga in igen", "warn"); return; }
            console.error(res.error);
            toast("En ändring kunde inte sparas: " + (res.error.message || "okänt fel"), "bad", 5000);
          }
          // Ändrades samma rad medan den sparades? Då skickas den igen.
          const now2 = JSON.stringify(op.k === "m" ? (this.months[op.id] || {}) : this.settings);
          if (res.error || now2 === sent) { this.outbox.shift(); this.saveOutbox(); }
        }
        setSync("Synkad", "ok");
      } catch {
        setSync("Offline", "warn");
      } finally {
        this.flushing = false;
      }
    },

    async pull() {
      if (!CLOUD || !this.user) return;
      const [m, s] = await Promise.all([
        this.sb.from("budget_months").select("month,data"),
        this.sb.from("budget_settings").select("start_day").maybeSingle()
      ]);
      if (m.error || s.error) {
        const e = m.error || s.error;
        setSync(isNetworkError(e) ? "Offline" : "Kunde inte hämta", "warn");
        if (isAuthError(e)) setSync("Logga in igen", "warn");
        return;
      }
      const months = {};
      m.data.forEach(r => { months[r.month] = r.data || {}; });
      // Ändringar som inte hunnit sparas behåller vi.
      this.outbox.forEach(o => { if (o.k === "m" && this.months[o.id]) months[o.id] = this.months[o.id]; });
      this.months = months;
      if (!this.pending("s", "s") && s.data) this.settings = { startDay: s.data.start_day === 25 ? 25 : 1 };
      this.saveCache();
      this.loaded = true; this.synced = true;
      if (!this.outbox.length) setSync("Synkad", "ok");
    },

    subscribe(onChange) {
      if (this.channel) this.sb.removeChannel(this.channel);
      this.channel = this.sb.channel("hk-" + this.user.id)
        .on("postgres_changes", { event: "*", schema: "public", table: "budget_months", filter: "user_id=eq." + this.user.id }, p => {
          const key = (p.new && p.new.month) || (p.old && p.old.month);
          if (!key || this.pending("m", key)) return;
          if (p.eventType === "DELETE") delete this.months[key]; else this.months[key] = p.new.data || {};
          this.saveCache(); onChange(key);
        })
        .subscribe();
    },

    async refresh() { await this.flush(); await this.pull(); },

    async signOut() {
      await this.flush();
      if (this.channel) { this.sb.removeChannel(this.channel); this.channel = null; }
      lsDel("hk-cache-" + this.uid); lsDel("hk-outbox-" + this.uid);
      await this.sb.auth.signOut().catch(() => {});
      this.user = null; this.months = {}; this.outbox = []; this.settings = { startDay: 1 }; this.loaded = false; this.synced = false;
      showLogin();
    }
  };

  // ---------- planen: kategorier, fasta utgifter och inkomster ----------
  // Belopp sparas som en lista med "gäller från och med månad", så att en ändring
  // gäller framåt men inte ändrar tidigare månader.
  const plan = () => store.months[PLAN];
  function amtAt(arr, key) {
    if (!arr || !arr.length) return 0;
    let v = arr[0].amount;
    for (const a of arr) if (a.from <= key) v = a.amount;
    return v;
  }
  const setFrom = (arr, key, v) => [...(arr || []).filter(a => a.from < key), { from: key, amount: v }];
  const occurs = (f, key) => f.start <= key && (!f.end || key <= f.end) && monthDiff(f.start, key) % (f.every || 1) === 0;
  const catVisible = (c, key) => (!c.start || c.start <= key) && (!c.end || key <= c.end);
  const monthDoc = key => (store.months[key] ||= { v: 2, budgets: {}, tx: [] });
  function savePlan() { store.setMonth(PLAN, plan()); queueRender(); }
  function saveMonth(key) { store.setMonth(key, monthDoc(key)); queueRender(); }

  function model(key) {
    const p = plan(), doc = store.months[key] || {}, tx = doc.tx || [], ob = doc.budgets || {};
    const income = p.income.filter(i => occurs(i, key)).map(i => ({ i, amount: amtAt(i.amounts, key) }));
    const fixed = p.fixed.filter(f => occurs(f, key)).map(f => ({ f, amount: amtAt(f.amounts, key) }));
    const cats = p.cats.filter(c => catVisible(c, key)).map(c => ({ c, budget: ob[c.id] != null ? ob[c.id] : amtAt(c.budgets, key), only: ob[c.id] != null, spent: 0 }));
    const byId = Object.fromEntries(cats.map(x => [x.c.id, x]));
    let loose = 0;
    for (const t of tx) { const x = byId[t.cat]; if (x) x.spent += t.amount; else loose += t.amount; }
    const inc = sum(income, x => x.amount), fx = sum(fixed, x => x.amount), cb = sum(cats, x => x.budget), txs = sum(tx, t => t.amount);
    return { key, doc, tx, income, fixed, cats, byId, loose, inc, fx, cb, txs, left: cb - txs, unassigned: inc - fx - cb };
  }
  const groupsOf = (p, extra) => [...p.groups, ...new Set(extra.filter(g => g && !p.groups.includes(g)))];

  function newPlan(useTemplate) {
    const K = cur, p = { v: 2, groups: [...GROUPS], cats: [], fixed: [], income: [], paydays: {} };
    p.income = TEMPLATE.income.map(([name, a]) => ({ id: rid(), name, every: 1, start: K, amounts: [{ from: K, amount: useTemplate ? a : 0 }] }));
    if (useTemplate) p.fixed = TEMPLATE.fixed.map(([name, group, a]) => ({ id: rid(), name, group, every: 1, start: K, amounts: [{ from: K, amount: a }] }));
    p.cats = TEMPLATE.cats.map(([name, group, a]) => ({ id: rid(), name, group, start: K, budgets: [{ from: K, amount: useTemplate ? a : 0 }] }));
    store.months[PLAN] = p; savePlan();
  }

  // Flyttar över budgetar från förra versionen, där varje månad var en egen kopia.
  function migrate() {
    const keys = Object.keys(store.months).filter(k => /^\d{4}-\d{2}$/.test(k) && store.months[k] && store.months[k].v !== 2).sort();
    if (!keys.length) return false;
    const first = keys[0], now = currentKey();
    const src = store.months[[...keys].reverse().find(k => k <= now) || keys[keys.length - 1]];
    const p = { v: 2, groups: [...GROUPS], cats: [], fixed: [], income: [], paydays: {} };
    for (const c of src.cats || []) {
      if (c.group && !p.groups.includes(c.group)) p.groups.push(c.group);
      if (c.fixed) p.fixed.push({ id: c.id, name: c.name, group: c.group, every: 1, start: first, amounts: [{ from: first, amount: c.planned || 0 }] });
      else p.cats.push({ id: c.id, name: c.name, group: c.group, start: first, budgets: [{ from: first, amount: c.planned || 0 }] });
    }
    p.income = (src.income || []).map(i => ({ id: i.id, name: i.name, every: 1, start: first, amounts: [{ from: first, amount: i.amount || 0 }] }));
    store.months[PLAN] = p; store.setMonth(PLAN, p);
    const fixedIds = new Set(p.fixed.map(f => f.id));
    for (const k of keys) {
      const m = store.months[k], budgets = {};
      for (const c of m.cats || []) {
        const pc = p.cats.find(x => x.id === c.id);
        if (pc && (c.planned || 0) !== amtAt(pc.budgets, k)) budgets[c.id] = c.planned || 0;
      }
      const tx = (m.tx || []).filter(t => !t.auto).map(t => ({ id: t.id, date: t.date, cat: fixedIds.has(t.cat) ? null : t.cat, note: t.note || "", amount: t.amount, at: t.at || 0 }));
      store.setMonth(k, { v: 2, budgets, tx });
    }
    return true;
  }

  // ---------- visning ----------
  let cur = null, txFilter = "";
  let tab = lsGet("hk-tab", "home");
  if (!["home", "tx", "fixed", "more"].includes(tab)) tab = "home";
  let rq = 0;
  function queueRender() { cancelAnimationFrame(rq); rq = requestAnimationFrame(render); }
  function openMonth(key) { cur = key; txFilter = ""; render(); }
  function setTab(t) {
    tab = t; lsSet("hk-tab", t);
    document.querySelectorAll("#tabbar button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === t ? "true" : "false"));
    render(); window.scrollTo(0, 0);
  }

  function render() {
    if (!cur) return;
    const act = document.activeElement, fid = act && act.id; let sel = null;
    try { if (fid && act.selectionStart != null) sel = [act.selectionStart, act.selectionEnd]; } catch {}
    $("login").hidden = true;
    $("monthnav").hidden = false; $("tabbar").hidden = false;
    if (!plan() && store.synced && migrate()) toast("Din budget är flyttad till den nya versionen", "", 4000);
    const p = plan();
    renderHeader();
    const waiting = !p && !store.synced;
    const views = { home: "vHome", tx: "vTx", fixed: "vFixed", more: "vMore" };
    for (const [k, id] of Object.entries(views)) $(id).hidden = !(k === tab && (p || k === "more"));
    $("loading").hidden = !(waiting && tab !== "more");
    $("empty").hidden = !(!p && !waiting && tab !== "more");
    $("fab").hidden = !p || tab === "more" || tab === "fixed";
    if (p) {
      const mm = model(cur);
      if (tab === "home") renderHome(mm);
      if (tab === "tx") renderTx(mm);
      if (tab === "fixed") renderFixed(mm);
    }
    if (fid) { const el = $(fid); if (el && el !== document.activeElement) { el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(...sel); } catch {} } }
  }

  function renderHeader() {
    $("monthTitle").textContent = monthName(cur);
    const { start, end, days } = period(cur), e = elapsed(cur);
    const range = store.settings.startDay === 1
      ? `1–${end.getDate()} ${MONTHS[start.getMonth()]}`
      : `Lön ${start.getDate()} ${SHORT[start.getMonth()]} – ${end.getDate()} ${SHORT[end.getMonth()]}`;
    const pb = $("period");
    pb.textContent = range + (e.f > 0 && e.f < 1 ? ` · dag ${e.day} av ${days}` : e.f === 0 ? " · inte påbörjad" : " · avslutad");
    pb.classList.toggle("editable", store.settings.startDay === 25 && !!plan());
    pb.setAttribute("aria-label", store.settings.startDay === 25 ? `Lönedag ${start.getDate()} ${MONTHS[start.getMonth()]}. Tryck för att ändra` : pb.textContent);
    $("todayBtn").hidden = cur === currentKey();
  }

  // Status: ok, warn (snabbare än månaden eller under 10 % kvar) eller bad (över).
  function catState(budget, spent, f) {
    const left = budget - spent, ratio = budget > 0 ? spent / budget : (spent > 0 ? 2 : 0);
    if (budget > 0 && left < -0.005) return "bad";
    if (budget > 0 && left > 0.005 && (left / budget < 0.1 || (f > 0 && f < 1 && ratio > f + 0.15))) return "warn";
    return "ok";
  }
  function leftText(budget, spent) {
    const left = budget - spent;
    if (budget === 0 && spent === 0) return ["–", "mute"];
    if (budget === 0) return ["Ej budgeterat", "mute"];
    if (Math.abs(left) < 0.005) return ["Klart", "mute"];
    return left > 0 ? [`${kr(left)} kvar`, null] : [`${kr(-left)} över`, "bad"];
  }

  function renderHome(mm) {
    const p = plan(), e = elapsed(cur), left = mm.left;
    $("hLeft").textContent = kr(left); $("hLeft").classList.toggle("neg", left < 0);
    let daily;
    if (e.f > 0 && e.f < 1) {
      const daysLeft = e.days - e.day + 1;
      daily = left > 0
        ? h("span", { class: "pill " + (catState(mm.cb, mm.txs, e.f) === "warn" ? "warn" : "ok"), text: `≈ ${kr(Math.floor(left / daysLeft))} per dag i ${daysLeft} ${daysLeft === 1 ? "dag" : "dagar"}` })
        : h("span", { class: "pill bad", text: "Budgeten är slut för den här månaden" });
    } else if (e.f === 0) daily = h("span", { class: "pill mute", text: "Månaden har inte börjat än" });
    else daily = h("span", { class: "pill " + (left >= 0 ? "ok" : "bad"), text: left >= 0 ? `Månaden slutade med ${kr(left)} kvar` : `Månaden slutade ${kr(-left)} över budget` });
    $("hDaily").replaceChildren(daily);

    const ratio = mm.cb > 0 ? Math.min(mm.txs / mm.cb, 1) : (mm.txs > 0 ? 1 : 0);
    $("hFill").style.width = ratio * 100 + "%";
    $("hFill").classList.toggle("bad", mm.txs > mm.cb);
    $("hPace").hidden = !(e.f > 0 && e.f < 1 && mm.cb > 0);
    $("hPace").style.left = `calc(${e.f * 100}% - 1px)`;
    $("hBarWrap").setAttribute("aria-label", `${kr(mm.txs)} spenderat av ${kr(mm.cb)}`);
    $("hSpent").textContent = `${kr(mm.txs)} av ${kr(mm.cb)} spenderat`;
    const next = periodStart(shiftKey(cur, 1));
    $("hPayday").textContent = store.settings.startDay === 25 ? `Nästa lön ${next.getDate()} ${SHORT[next.getMonth()]}` : `Slutar ${period(cur).end.getDate()} ${SHORT[period(cur).end.getMonth()]}`;

    const un = Math.round(mm.unassigned * 100) / 100;
    $("hMinis").replaceChildren(
      h("div", { class: "mini" }, h("span", { class: "label", text: "Inkomster" }), h("b", { text: kr(mm.inc) })),
      h("div", { class: "mini" }, h("span", { class: "label", text: "Fasta utgifter" }), h("b", { text: kr(mm.fx) })),
      h("div", { class: "mini" }, h("span", { class: "label", text: "Rörlig budget" }), h("b", { text: kr(mm.cb) })),
      h("div", { class: "mini" }, h("span", { class: "label", text: un < 0 ? "Överfördelat" : "Ofördelat" }), h("b", { class: un === 0 ? "ok-t" : un > 0 ? "warn-t" : "bad-t", text: kr(Math.abs(un)) })));

    const wrap = $("hGroups"); wrap.replaceChildren();
    const groups = groupsOf(p, [...mm.fixed.map(x => x.f.group), ...mm.cats.map(x => x.c.group)]);
    for (const g of groups) {
      const fs = mm.fixed.filter(x => x.f.group === g), cs = mm.cats.filter(x => x.c.group === g);
      if (!fs.length && !cs.length) continue;
      const gb = sum(fs, x => x.amount) + sum(cs, x => x.budget), gs = sum(fs, x => x.amount) + sum(cs, x => x.spent);
      wrap.append(h("div", { class: "grp" },
        h("div", { class: "grph" }, h("h3", { text: g }), h("span", { text: `${kr(gs)} av ${kr(gb)}` })),
        cs.map(x => catLine(x, e.f)),
        fs.map(x => h("button", { class: "hcat fixed", type: "button", onclick: () => setTab("fixed"), "aria-label": `${x.f.name}, fast utgift ${kr(x.amount)}, betald` },
          h("div", { class: "r1" }, h("span", { class: "nm", text: x.f.name }), h("span", { class: "lf2 mute-t", text: kr(x.amount) })),
          h("div", { class: "r3" }, h("span", { text: "Fast utgift · betald" }))))));
    }
    if (mm.loose) wrap.append(h("div", { class: "grp" },
      h("button", { class: "hcat", type: "button", onclick: () => { txFilter = "_none"; setTab("tx"); } },
        h("div", { class: "r1" }, h("span", { class: "nm", text: "Utan kategori" }), h("span", { class: "lf2 mute-t", text: kr(mm.loose) })),
        h("div", { class: "r3" }, h("span", { text: "Tryck för att se köpen och flytta dem" })))));
    if (!wrap.children.length) wrap.append(h("p", { class: "muted", text: "Inga kategorier än. Lägg till dem under fliken Budget." }));
  }

  function catLine(x, f) {
    const st = catState(x.budget, x.spent, f), [lt, lk] = leftText(x.budget, x.spent);
    const r = x.budget > 0 ? Math.min(x.spent / x.budget, 1) : (x.spent > 0 ? 1 : 0);
    return h("button", { class: "hcat", type: "button", onclick: () => { txFilter = x.c.id; setTab("tx"); }, "aria-label": `${x.c.name}: ${lt}. Visa köpen` },
      h("div", { class: "r1" }, h("span", { class: "nm", text: x.c.name }), h("span", { class: "lf2 " + (lk === "mute" ? "mute-t" : st + "-t"), text: lt })),
      h("div", { class: "cbar" }, h("div", { class: "fill " + (st === "ok" ? "" : st), style: `width:${r * 100}%` }),
        f > 0 && f < 1 && x.budget > 0 ? h("div", { class: "pace", style: `left:calc(${f * 100}% - 1px)` }) : null),
      h("div", { class: "r3" }, h("span", { text: `${kr(x.spent)} av ${kr(x.budget)}` }), x.only ? h("span", { class: "tag", text: "bara denna månad" }) : null));
  }

  const catName = id => plan().cats.find(c => c.id === id)?.name || "Utan kategori";
  function dayLabel(d) {
    const t = today0();
    if (d === iso(t)) return "I dag";
    if (d === iso(addDays(t, -1))) return "I går";
    return fmtDay(d);
  }
  function txRow(t, key, sub) {
    return h("div", { class: "tx click", role: "button", tabindex: "0", onclick: () => openTxSheet({ key, id: t.id }),
      onkeydown: ev => { if (ev.key === "Enter") openTxSheet({ key, id: t.id }); } },
      h("div", { class: "n" }, h("b", { text: t.note || catName(t.cat) }), h("span", { text: sub })),
      h("span", { class: "a", text: kr(t.amount) }),
      h("span", { class: "muted", "aria-hidden": "true", text: "›" }));
  }

  function renderTx(mm) {
    const sel = $("txFilter"), prev = txFilter;
    sel.replaceChildren(h("option", { value: "", text: "Alla kategorier" }), ...mm.cats.map(x => h("option", { value: x.c.id, text: x.c.name })),
      mm.loose ? h("option", { value: "_none", text: "Utan kategori" }) : null);
    sel.value = [...sel.options].some(o => o.value === prev) ? prev : "";
    txFilter = sel.value;
    const known = id => !!mm.byId[id];
    const list = mm.tx.filter(t => !txFilter || (txFilter === "_none" ? !known(t.cat) : t.cat === txFilter))
      .slice().sort((a, b) => b.date.localeCompare(a.date) || (b.at || 0) - (a.at || 0));
    $("txSum").textContent = list.length ? `${list.length} köp · ${kr(sum(list, t => t.amount))} · tryck på ett köp för att ändra` : "";
    const out = []; let last = null;
    for (const t of list) {
      if (t.date !== last) { out.push(h("div", { class: "dhead", text: dayLabel(t.date) })); last = t.date; }
      out.push(txRow(t, cur, t.note ? catName(t.cat) : ""));
    }
    $("txList").replaceChildren(...(out.length ? out : [h("p", { class: "muted", text: txFilter ? "Inga köp i den här kategorin." : "Inga köp än den här månaden. Tryck på + för att lägga till." })]));

    const up = [];
    for (let i = 1; i <= 12; i++) {
      const K = shiftKey(cur, i), tx = (store.months[K]?.tx || []).slice().sort((a, b) => a.date.localeCompare(b.date));
      if (!tx.length) continue;
      up.push(h("div", { class: "dhead", text: `${monthName(K)} · ${kr(sum(tx, t => t.amount))}` }));
      for (const t of tx) up.push(txRow(t, K, t.note ? catName(t.cat) : ""));
    }
    $("upcoming").replaceChildren(...(up.length ? up : [h("p", { class: "muted small", text: "Inga kommande räkningar." })]));
  }

  function intervalLabel(f) {
    const ev = f.every || 1, m0 = mIndex(f.start);
    const ms = [...new Set(Array.from({ length: 12 / ev }, (_, i) => (m0 + i * ev) % 12))].sort((a, b) => a - b).map(i => SHORT[i]);
    let s = ev === 1 ? "Varje månad" : ev === 12 ? `Varje år i ${MONTHS[m0]}` : ev === 6 ? `Varje halvår (${ms.join(", ")})` : `Var 3:e månad (${ms.join(", ")})`;
    if (f.start > cur) s = `Från ${monthLabel(f.start)} · ` + s.toLowerCase();
    if (f.end) s += ` · till och med ${monthLabel(f.end)}`;
    return s;
  }

  function renderFixed(mm) {
    const p = plan();
    const active = list => list.filter(x => !x.end || x.end >= cur);
    $("incTotal").textContent = `${kr(mm.inc)} denna månad`;
    const inc = active(p.income);
    $("incList").replaceChildren(...(inc.length ? inc.map(i => h("button", { class: "frow" + (occurs(i, cur) ? "" : " off"), type: "button", onclick: () => openFixSheet(i.id, "income") },
      h("b", { text: i.name }), h("span", { class: "amt2", text: kr(amtAt(i.amounts, cur)) }), h("small", { text: intervalLabel(i) })))
      : [h("p", { class: "muted small", text: "Inga inkomster än." })]));

    $("fixTotal").textContent = `${kr(mm.fx)} denna månad`;
    const fx = active(p.fixed), out = [];
    for (const g of groupsOf(p, fx.map(f => f.group))) {
      const fs = fx.filter(f => f.group === g); if (!fs.length) continue;
      out.push(h("div", { class: "fgh", text: g }));
      for (const f of fs) out.push(h("button", { class: "frow" + (occurs(f, cur) ? "" : " off"), type: "button", onclick: () => openFixSheet(f.id, "fixed") },
        h("b", { text: f.name }), h("span", { class: "amt2", text: kr(amtAt(f.amounts, cur)) }),
        h("small", { text: intervalLabel(f) + (occurs(f, cur) ? "" : " · inte denna månad") })));
    }
    $("fixList").replaceChildren(...(out.length ? out : [h("p", { class: "muted small", text: "Inga fasta utgifter än." })]));

    $("catTotal").textContent = `${kr(mm.cb)} denna månad`;
    const cs = [];
    for (const g of groupsOf(p, mm.cats.map(x => x.c.group))) {
      const xs = mm.cats.filter(x => x.c.group === g); if (!xs.length) continue;
      cs.push(h("div", { class: "fgh", text: g }));
      for (const x of xs) cs.push(h("button", { class: "frow", type: "button", onclick: () => openCatSheet(x.c.id) },
        h("b", { text: x.c.name }), h("span", { class: "amt2", text: kr(x.budget) }),
        h("small", { text: x.only ? `Ändrad bara för ${monthLabel(cur)}` : `Varje månad · ${kr(x.spent)} spenderat hittills` })));
    }
    $("catList").replaceChildren(...(cs.length ? cs : [h("p", { class: "muted small", text: "Inga kategorier än." })]));
  }

  // ---------- bottenpaneler ----------
  function showSheet(id) { $(id).hidden = false; document.body.classList.add("sheet-open"); }
  function closeSheets() { $("txSheet").hidden = true; $("formSheet").hidden = true; document.body.classList.remove("sheet-open"); }
  document.querySelectorAll("[data-close]").forEach(el => { el.onclick = closeSheets; });

  // Två tryck för att ta bort: första trycket frågar, andra tar bort.
  function confirmBtn(label, confirmLabel, fn) {
    let armed = false, t = 0;
    const b = h("button", { class: "btn danger", type: "button", text: label, onclick: () => {
      if (armed) { clearTimeout(t); fn(); return; }
      armed = true; b.textContent = confirmLabel;
      t = setTimeout(() => { armed = false; b.textContent = label; }, 3500);
    } });
    return b;
  }
  function amountField(id, label, v) {
    return h("label", { class: "lf" }, label, h("input", { class: "field amt", id, inputmode: "decimal", placeholder: "0 kr", value: fmtInput(v) }));
  }
  function groupField(selected) {
    const p = plan();
    const s = h("select", { class: "field", id: "fGroup" },
      selected ? null : h("option", { value: "", text: "Välj grupp…" }),
      p.groups.map(g => h("option", { value: g, text: g })), h("option", { value: "__new", text: "Ny grupp…" }));
    s.value = selected || "";
    const inp = h("input", { class: "field", id: "fNewGroup", placeholder: "Namn på den nya gruppen", hidden: true });
    s.onchange = () => { inp.hidden = s.value !== "__new"; if (!inp.hidden) inp.focus(); };
    return {
      el: h("label", { class: "lf" }, "Grupp", s, inp),
      get() {
        if (s.value === "__new") { const n = inp.value.trim(); if (!n) return null; if (!p.groups.includes(n)) p.groups.push(n); return n; }
        return s.value || null;
      }
    };
  }
  function monthOptions(sel, from, to, value) {
    sel.replaceChildren(...Array.from({ length: monthDiff(from, to) + 1 }, (_, i) => { const K = shiftKey(from, i); return h("option", { value: K, text: monthName(K) }); }));
    sel.value = value;
  }
  function formMsg() { return h("p", { class: "msg", id: "fMsg", hidden: true }); }
  function showMsg(text) { const m = $("fMsg"); m.textContent = text; m.hidden = false; }

  // Kategori: namn, grupp och budget.
  function openCatSheet(id) {
    const p = plan(), c = id ? p.cats.find(x => x.id === id) : null, mm = model(cur), x = c ? mm.byId[c.id] : null;
    $("fTitle").textContent = c ? c.name : "Ny kategori";
    const gf = groupField(c?.group);
    const body = [];
    if (x) body.push(h("div", { class: "stats3" },
      h("div", {}, h("b", { text: kr(x.budget) }), h("span", { text: "Budget" })),
      h("div", {}, h("b", { text: kr(x.spent) }), h("span", { text: "Spenderat" })),
      h("div", {}, h("b", { class: catState(x.budget, x.spent, elapsed(cur).f) + "-t", text: kr(x.budget - x.spent) }), h("span", { text: "Kvar" }))));
    body.push(h("label", { class: "lf" }, "Namn", h("input", { class: "field", id: "fName", value: c?.name || "", placeholder: "t.ex. Matbutik" })));
    body.push(gf.el);
    body.push(amountField("fAmount", `Budget per månad`, x ? x.budget : 0));
    if (c) body.push(h("div", { class: "stack" },
      h("label", { class: "radio" }, h("input", { type: "radio", name: "scope", value: "from", checked: !x?.only }), `Från och med ${monthLabel(cur)} och framåt`),
      h("label", { class: "radio" }, h("input", { type: "radio", name: "scope", value: "only", checked: !!x?.only }), `Bara ${monthLabel(cur)}`)));
    body.push(formMsg());
    body.push(h("button", { class: "btn primary big", type: "button", text: c ? "Spara" : "Lägg till kategori", onclick: () => {
      const name = $("fName").value.trim(); if (!name) return showMsg("Skriv ett namn.");
      const group = gf.get(); if (!group) return showMsg("Välj en grupp.");
      const v = parseKr($("fAmount").value); if (Number.isNaN(v)) return showMsg("Beloppet ska vara ett tal, t.ex. 6000.");
      if (!c) {
        p.cats.push({ id: rid(), name, group, start: cur, budgets: [{ from: cur, amount: v }] });
        savePlan(); closeSheets(); toast(`${name} är tillagd`); return;
      }
      c.name = name; c.group = group;
      const only = document.querySelector('input[name="scope"]:checked')?.value === "only";
      const doc = store.months[cur];
      if (only) { monthDoc(cur).budgets ||= {}; monthDoc(cur).budgets[c.id] = v; saveMonth(cur); }
      else {
        if (v !== amtAt(c.budgets, cur) || x?.only) c.budgets = setFrom(c.budgets, cur, v);
        if (doc?.budgets && doc.budgets[c.id] != null) { delete doc.budgets[c.id]; saveMonth(cur); }
      }
      savePlan(); closeSheets(); toast("Sparat");
    } }));
    if (c) {
      body.push(h("button", { class: "btn", type: "button", text: `Lägg till köp i ${c.name}`, onclick: () => { closeSheets(); openTxSheet(null, c.id); } }));
      const tx = mm.tx.filter(t => t.cat === c.id).sort((a, b) => b.date.localeCompare(a.date));
      if (tx.length) body.push(h("div", { class: "txlist" }, h("div", { class: "dhead", text: `Köp i ${monthLabel(cur)}` }),
        tx.map(t => txRow(t, cur, dayLabel(t.date)))));
      body.push(confirmBtn("Ta bort kategorin", "Tryck igen för att ta bort", () => {
        if (c.start && c.start >= cur) p.cats = p.cats.filter(y => y !== c);
        else c.end = shiftKey(cur, -1);
        savePlan(); closeSheets(); toast(`${c.name} är borttagen från och med ${monthLabel(cur)}. Köpen ligger kvar under Utan kategori.`, "", 4500);
      }));
    }
    $("fBody").replaceChildren(...body);
    showSheet("formSheet");
    if (!c) $("fName").focus();
  }

  // Fast utgift eller inkomst.
  function openFixSheet(id, kind) {
    const p = plan(), isInc = kind === "income", list = isInc ? p.income : p.fixed;
    const f = id ? list.find(x => x.id === id) : null;
    $("fTitle").textContent = f ? f.name : isInc ? "Ny inkomst" : "Ny fast utgift";
    const gf = isInc ? null : groupField(f?.group);
    const every = h("select", { class: "field", id: "fEvery" },
      h("option", { value: "1", text: "Varje månad" }), h("option", { value: "3", text: "Var 3:e månad (kvartal)" }),
      h("option", { value: "6", text: "Varje halvår" }), h("option", { value: "12", text: "En gång om året" }));
    every.value = String(f?.every || 1);
    const start = h("select", { class: "field", id: "fStart" });
    const s0 = f?.start || cur, lo = [shiftKey(cur, -12), s0].sort()[0], hi = [shiftKey(cur, 24), s0].sort()[1];
    monthOptions(start, lo, hi, s0);
    const body = [
      h("label", { class: "lf" }, "Namn", h("input", { class: "field", id: "fName", value: f?.name || "", placeholder: isInc ? "t.ex. Lön (netto)" : "t.ex. Hyra" })),
      amountField("fAmount", isInc ? "Belopp per månad" : "Belopp", f ? amtAt(f.amounts, cur) : 0)
    ];
    if (gf) body.push(gf.el);
    if (!isInc) body.push(h("div", { class: "two" }, h("label", { class: "lf" }, "Hur ofta", every), h("label", { class: "lf" }, "Första månaden", start)));
    else body.push(h("label", { class: "lf" }, "Första månaden", start));
    if (f) body.push(h("p", { class: "note", text: `Ändrar du beloppet gäller det från och med ${monthLabel(cur)}. Tidigare månader ändras inte.` }));
    body.push(formMsg());
    body.push(h("button", { class: "btn primary big", type: "button", text: f ? "Spara" : "Lägg till", onclick: () => {
      const name = $("fName").value.trim(); if (!name) return showMsg("Skriv ett namn.");
      const v = parseKr($("fAmount").value); if (Number.isNaN(v) || v < 0) return showMsg("Beloppet ska vara ett tal, t.ex. 9500.");
      const group = gf ? gf.get() : null; if (gf && !group) return showMsg("Välj en grupp.");
      const ev = isInc ? 1 : Number(every.value), st = start.value;
      if (!f) {
        list.push({ id: rid(), name, group: group || undefined, every: ev, start: st, amounts: [{ from: st, amount: v }] });
        savePlan(); closeSheets(); toast(`${name} är tillagd`); return;
      }
      f.name = name; if (gf) f.group = group; f.every = ev; f.start = st;
      if (v !== amtAt(f.amounts, cur)) f.amounts = setFrom(f.amounts, cur < st ? st : cur, v);
      savePlan(); closeSheets(); toast("Sparat");
    } }));
    if (f) {
      if (f.start < cur) body.push(h("button", { class: "btn", type: "button", text: `Avsluta från och med ${monthLabel(cur)}`, onclick: () => {
        f.end = shiftKey(cur, -1); savePlan(); closeSheets(); toast(`${f.name} är avslutad från och med ${monthLabel(cur)}`);
      } }));
      body.push(confirmBtn("Ta bort helt, även tidigare månader", "Tryck igen för att ta bort", () => {
        if (isInc) p.income = p.income.filter(y => y !== f); else p.fixed = p.fixed.filter(y => y !== f);
        savePlan(); closeSheets(); toast(`${f.name} är borttagen`);
      }));
    }
    $("fBody").replaceChildren(...body);
    showSheet("formSheet");
    if (!f) $("fName").focus();
  }

  // Lönedag för en enskild månad.
  function openPaydaySheet() {
    if (store.settings.startDay !== 25 || !plan()) return;
    const p = plan(), auto = autoPayday(cur), now = periodStart(cur);
    $("fTitle").textContent = `Lönedag för ${monthLabel(cur)}`;
    $("fBody").replaceChildren(
      h("p", { class: "note", text: `Automatiskt datum: ${auto.getDate()} ${MONTHS[auto.getMonth()]} (den 25:e, eller vardagen före vid helg eller helgdag). Ändrar du datumet slutar förra månaden dagen innan.` }),
      h("label", { class: "lf" }, "Lönen kom", h("input", { class: "field", id: "fDate", type: "date", value: iso(now) })),
      formMsg(),
      h("button", { class: "btn primary big", type: "button", text: "Spara", onclick: () => {
        const v = $("fDate").value; if (!v) return showMsg("Välj ett datum.");
        const d = parseISO(v), prevStart = periodStart(shiftKey(cur, -1)), nextStart = periodStart(shiftKey(cur, 1));
        if (d <= prevStart || d >= nextStart) return showMsg("Datumet måste ligga mellan förra och nästa lönedag.");
        p.paydays ||= {};
        if (v === iso(auto)) delete p.paydays[cur]; else p.paydays[cur] = v;
        savePlan(); closeSheets(); toast(`Lönedag ${d.getDate()} ${MONTHS[d.getMonth()]}`);
      } }),
      p.paydays?.[cur] ? h("button", { class: "btn", type: "button", text: "Använd automatiskt datum", onclick: () => {
        delete p.paydays[cur]; savePlan(); closeSheets(); toast("Automatisk lönedag");
      } }) : null);
    showSheet("formSheet");
  }

  // ---------- köp: lägg till och ändra ----------
  let qStr = "", qCat = null, qEdit = null, qDelArmed = false;
  const qVal = () => { const n = parseKr(qStr); return Number.isNaN(n) ? 0 : n; };
  const findTx = e => store.months[e.key]?.tx?.find(t => t.id === e.id);

  function openTxSheet(edit, catId) {
    if (!plan()) return;
    closeSheets();
    const t = edit ? findTx(edit) : null;
    if (edit && !t) return;
    qEdit = t ? edit : null; qDelArmed = false;
    const K = t ? edit.key : cur;
    qStr = t ? fmtInput(t.amount) : ""; qCat = t ? t.cat : (catId || null);
    $("qNote").value = t?.note || "";
    monthOptions($("qMonth"), [shiftKey(cur, -1), K].sort()[0], [shiftKey(cur, 12), K].sort()[1], K);
    $("qDate").value = t ? t.date : defaultDate(K);
    $("qMore").open = !!(t && t.note);
    $("qCatAll").hidden = true;
    $("qTitle").textContent = t ? "Ändra köp" : "Nytt köp";
    $("qSave").textContent = t ? "Spara ändringar" : "Spara köp";
    $("qDelete").hidden = !t; $("qDelete").textContent = "Ta bort köpet";
    renderSheet();
    showSheet("txSheet");
  }

  function topCats(mm) {
    const count = {};
    for (const K of [cur, shiftKey(cur, -1)]) for (const t of store.months[K]?.tx || []) if (t.cat) count[t.cat] = (count[t.cat] || 0) + 1;
    return mm.cats.map((x, i) => ({ c: x.c, n: count[x.c.id] || 0, i })).sort((a, b) => b.n - a.n || a.i - b.i).map(x => x.c);
  }

  function renderSheet() {
    const K = $("qMonth").value || cur, mm = model(K), v = qVal();
    const [ip, dp] = (qStr || "0").split(",");
    $("qAmount").textContent = nf0.format(Number(ip || 0)) + (dp !== undefined ? "," + dp : "") + " kr";
    $("qAmount").classList.toggle("zero", !v);

    let chips = topCats(mm).slice(0, 6);
    if (qCat && !chips.some(c => c.id === qCat)) { const c = plan().cats.find(x => x.id === qCat); if (c) chips = [c, ...chips.slice(0, 5)]; }
    $("qChips").replaceChildren(...chips.map(c => h("button", {
      class: "chip", type: "button", "aria-pressed": qCat === c.id ? "true" : "false", text: c.name,
      onclick: () => { qCat = c.id; $("qCatAll").hidden = true; renderSheet(); }
    })), h("button", {
      class: "chip", type: "button", text: "Fler…", "aria-pressed": "false",
      onclick: () => {
        const s = $("qCatAll");
        const p = plan();
        s.replaceChildren(h("option", { value: "", text: "Välj kategori…" }), ...groupsOf(p, mm.cats.map(x => x.c.group)).map(g => {
          const cs = mm.cats.filter(x => x.c.group === g); return cs.length ? h("optgroup", { label: g }, cs.map(x => h("option", { value: x.c.id, text: x.c.name }))) : null;
        }));
        s.value = qCat || ""; s.hidden = false; s.focus();
      }
    }));

    const hint = $("qHint"); hint.className = "qhint";
    const x = mm.byId[qCat];
    if (!x) hint.textContent = mm.cats.length ? "Välj en kategori" : "";
    else {
      const own = qEdit && qEdit.key === K ? (findTx(qEdit)?.cat === qCat ? findTx(qEdit).amount : 0) : 0;
      const name = x.c.name, b = x.budget, after = b - (x.spent - own) - v;
      if (b === 0) hint.textContent = `${name} har ingen budget i ${monthLabel(K)}`;
      else if (after < -0.005) { hint.textContent = `${name} hamnar ${kr(-after)} över budget`; hint.classList.add("bad"); }
      else if (after / b < 0.1) { hint.textContent = `Bara ${kr(after)} kvar i ${name} efter köpet`; hint.classList.add("warn"); }
      else hint.textContent = v ? `${name} har ${kr(after)} kvar efter köpet` : `${name}: ${kr(b - x.spent + own)} kvar`;
    }
  }

  function keyIn(k) {
    if (k === "del") qStr = qStr.slice(0, -1);
    else if (k === ",") { if (!qStr.includes(",")) qStr = (qStr || "0") + ","; }
    else if (/^\d$/.test(k)) {
      const [ip, dp] = qStr.split(",");
      if (dp !== undefined && dp.length >= 2) return;
      if (dp === undefined && ip.length >= 7) return;
      qStr = qStr === "0" ? k : qStr + k;
    }
    renderSheet();
  }

  function saveTx() {
    const v = qVal(), hint = $("qHint"), K = $("qMonth").value || cur;
    if (!v) { hint.textContent = "Skriv ett belopp först"; hint.className = "qhint bad"; return; }
    if (!qCat && plan().cats.length) { hint.textContent = "Välj en kategori först"; hint.className = "qhint bad"; return; }
    const pr = period(K);
    let date = $("qDate").value;
    if (!date || parseISO(date) < pr.start || parseISO(date) > pr.end) date = defaultDate(K);
    const note = $("qNote").value.trim();
    if (qEdit) {
      const old = findTx(qEdit);
      const od = monthDoc(qEdit.key); od.tx = od.tx.filter(t => t.id !== qEdit.id);
      monthDoc(K).tx.push({ ...old, amount: v, cat: qCat, note, date });
      if (qEdit.key !== K) saveMonth(qEdit.key);
      saveMonth(K); closeSheets(); toast(qEdit.key !== K ? `Flyttat till ${monthLabel(K)}` : "Ändrat");
      return;
    }
    monthDoc(K).tx.push({ id: rid(), date, cat: qCat, note, amount: v, at: Date.now() });
    saveMonth(K); closeSheets();
    if (K !== cur) { toast(`Lagt in i ${monthLabel(K)}`); return; }
    const x = model(K).byId[qCat];
    if (!x) { toast(`${kr(v)} tillagt`); return; }
    const left = x.budget - x.spent;
    if (x.budget > 0 && left < -0.005) toast(`${x.c.name}: ${kr(-left)} över budget`, "bad", 5000);
    else if (x.budget > 0 && left / x.budget < 0.1) toast(`Bara ${kr(left)} kvar i ${x.c.name}`, "warn", 5000);
    else toast(x.budget > 0 ? `${x.c.name}: ${kr(left)} kvar` : `${kr(v)} tillagt i ${x.c.name}`);
  }

  $("fab").onclick = () => openTxSheet(null);
  $("qSave").onclick = saveTx;
  $("qDelete").onclick = () => {
    if (!qEdit) return;
    if (!qDelArmed) { qDelArmed = true; $("qDelete").textContent = "Tryck igen för att ta bort"; setTimeout(() => { qDelArmed = false; $("qDelete").textContent = "Ta bort köpet"; }, 3500); return; }
    const d = monthDoc(qEdit.key); d.tx = d.tx.filter(t => t.id !== qEdit.id);
    saveMonth(qEdit.key); closeSheets(); toast("Köpet är borttaget");
  };
  $("keypad").addEventListener("click", ev => { const b = ev.target.closest("button[data-k]"); if (b) keyIn(b.dataset.k); });
  $("qCatAll").onchange = ev => { qCat = ev.target.value || null; renderSheet(); };
  $("qMonth").onchange = () => { $("qDate").value = defaultDate($("qMonth").value); renderSheet(); };
  $("qDate").onchange = () => {
    const v = $("qDate").value; if (!v) return;
    const K = keyForDate(parseISO(v)), s = $("qMonth");
    if (![...s.options].some(o => o.value === K)) s.append(h("option", { value: K, text: monthName(K) }));
    s.value = K; renderSheet();
  };
  document.addEventListener("keydown", ev => {
    if (ev.key === "Escape" && (!$("txSheet").hidden || !$("formSheet").hidden)) { closeSheets(); return; }
    if ($("txSheet").hidden) return;
    if (ev.target.matches("input,select,textarea")) { if (ev.key === "Enter" && ev.target.tagName === "INPUT") { ev.preventDefault(); saveTx(); } return; }
    if (/^\d$/.test(ev.key)) keyIn(ev.key);
    else if (ev.key === "," || ev.key === ".") keyIn(",");
    else if (ev.key === "Backspace") keyIn("del");
    else if (ev.key === "Enter") saveTx();
    else return;
    ev.preventDefault();
  });

  // ---------- händelser ----------
  document.querySelectorAll("#tabbar button").forEach(b => { b.onclick = () => setTab(b.dataset.tab); });
  $("prevBtn").onclick = () => openMonth(shiftKey(cur, -1));
  $("nextBtn").onclick = () => openMonth(shiftKey(cur, 1));
  $("todayBtn").onclick = () => openMonth(currentKey());
  $("period").onclick = openPaydaySheet;
  $("templateBtn").onclick = () => newPlan(true);
  $("blankBtn").onclick = () => newPlan(false);
  $("addCatBtn").onclick = () => openCatSheet(null);
  $("addIncBtn").onclick = () => openFixSheet(null, "income");
  $("addFixBtn").onclick = () => openFixSheet(null, "fixed");
  $("txFilter").onchange = ev => { txFilter = ev.target.value; render(); };
  $("startDay").onchange = ev => {
    store.setSettings({ startDay: Number(ev.target.value) === 25 ? 25 : 1 });
    openMonth(currentKey());
  };

  $("csvBtn").onclick = () => {
    if (!plan()) { toast("Det finns ingen budget att exportera än"); return; }
    const mm = model(cur), q = s => `"${String(s).replace(/"/g, '""')}"`, start = iso(period(cur).start);
    const rows = [["Datum", "Typ", "Kategori", "Anteckning", "Belopp (kr)"].map(q).join(";")]
      .concat(mm.fixed.map(x => [start, "Fast utgift", x.f.group || "", x.f.name, String(x.amount).replace(".", ",")].map(q).join(";")))
      .concat(mm.tx.slice().sort((a, b) => a.date.localeCompare(b.date))
        .map(t => [t.date, "Köp", catName(t.cat), t.note || "", String(t.amount).replace(".", ",")].map(q).join(";")));
    const blob = new Blob(["﻿" + rows.join("\r\n")], { type: "text/csv;charset=utf-8" });
    const a = h("a", { href: URL.createObjectURL(blob), download: `bankboken-${cur}.csv` });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  };

  $("refreshBtn").onclick = async ev => { ev.target.disabled = true; await store.refresh(); ev.target.disabled = false; render(); toast("Uppdaterad"); };
  $("logoutBtn").onclick = () => store.signOut();
  $("pwBtn").onclick = () => openNewPassword(false);
  $("pwCancel").onclick = () => $("pwDialog").close();
  $("pwForm").addEventListener("submit", async ev => {
    ev.preventDefault();
    const { error } = await store.sb.auth.updateUser({ password: $("np").value });
    if (error) { const p = $("pwErr"); p.hidden = false; p.textContent = "Lösenordet kunde inte sparas. Det måste vara minst 6 tecken."; return; }
    $("pwDialog").close(); $("np").value = ""; toast("Lösenordet är bytt");
  });
  function openNewPassword(fromEmail) {
    $("pwTitle").textContent = fromEmail ? "Välj ett nytt lösenord" : "Byt lösenord";
    $("pwErr").hidden = true; $("pwCancel").hidden = fromEmail;
    $("pwDialog").showModal(); $("np").focus();
  }

  // ---------- inloggning ----------
  function showLogin(message) {
    ["loading", "empty", "vHome", "vTx", "vFixed", "vMore", "monthnav", "tabbar", "fab", "todayBtn"].forEach(id => { $(id).hidden = true; });
    closeSheets();
    $("login").hidden = false;
    const err = $("loginErr"); err.hidden = !message; err.textContent = message || "";
    setSync("Utloggad");
  }
  $("login").addEventListener("submit", async ev => {
    ev.preventDefault();
    const err = $("loginErr"), btn = $("loginBtn"); err.hidden = true;
    btn.disabled = true; btn.textContent = "Loggar in…";
    const { data, error } = await store.sb.auth.signInWithPassword({ email: $("le").value.trim(), password: $("lp").value });
    btn.disabled = false; btn.textContent = "Logga in";
    if (error) {
      err.textContent = isNetworkError(error) ? "Ingen internetanslutning. Försök igen när du är online." : "Fel e-post eller lösenord.";
      err.hidden = false; return;
    }
    $("lp").value = "";
    afterLogin(data.session);
  });
  $("forgotBtn").onclick = async () => {
    const email = $("le").value.trim(), err = $("loginErr");
    if (!email) { err.textContent = "Skriv din e-post först, så skickar vi en länk."; err.hidden = false; $("le").focus(); return; }
    const { error } = await store.sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin + location.pathname });
    err.hidden = true; toast(error ? "Kunde inte skicka. Försök igen om en stund." : "Kolla din e-post efter en länk.");
  };

  async function afterLogin(session) {
    store.user = session.user;
    store.loaded = store.loadCache();
    $("account").hidden = false;
    $("who").textContent = "Inloggad som " + (session.user.email || "");
    $("startDay").value = String(store.settings.startDay);
    openMonth(currentKey());
    store.subscribe(() => queueRender());
    await store.refresh();
    $("startDay").value = String(store.settings.startDay);
    openMonth(currentKey());
  }

  // ---------- start ----------
  async function start() {
    $("installTip").hidden = !(isIOS && !isStandalone);
    document.querySelectorAll("#tabbar button").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab ? "true" : "false"));
    if (!CLOUD) {
      store.loadCache(); store.loaded = true; store.synced = true;
      setSync("Testläge", "warn");
      const n = $("notice"); n.hidden = false;
      n.textContent = "Testläge: databasen är inte inkopplad, så budgeten sparas bara i den här webbläsaren.";
      $("startDay").value = String(store.settings.startDay);
      openMonth(currentKey());
      return;
    }
    store.sb = window.supabase.createClient(CFG.supabaseUrl, CFG.supabaseKey, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true }
    });
    store.sb.auth.onAuthStateChange(event => {
      if (event === "PASSWORD_RECOVERY") setTimeout(() => openNewPassword(true), 300);
    });
    setSync("Ansluter…");
    const { data } = await store.sb.auth.getSession();
    if (data && data.session) afterLogin(data.session);
    else showLogin();

    window.addEventListener("online", () => { if (store.user) store.refresh().then(render); });
    window.addEventListener("offline", () => setSync("Offline", "warn"));
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "visible" && store.user) {
        store.subscribe(() => queueRender());
        store.refresh().then(() => { if (!document.activeElement || !document.activeElement.matches("input,select")) render(); });
      }
    });
  }

  start();
})();

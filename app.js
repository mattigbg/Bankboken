(() => {
  "use strict";

  // ---------- grunddata ----------
  const GROUPS = ["Boende", "Transport", "Mat & hushåll", "Abonnemang", "Sparande", "Övrigt"];
  const TEMPLATE = {
    income: [["Lön (netto)", 28000]],
    cats: [
      ["Hyra/avgift", "Boende", 9500], ["El", "Boende", 600], ["Hemförsäkring", "Boende", 180], ["Bredband", "Boende", 399],
      ["Kollektivtrafik", "Transport", 990], ["Bil & bränsle", "Transport", 1200],
      ["Matbutik", "Mat & hushåll", 4500], ["Hygien & hushåll", "Mat & hushåll", 500], ["Restaurang & fika", "Mat & hushåll", 1000],
      ["Mobil", "Abonnemang", 249], ["Streaming", "Abonnemang", 300], ["Gym", "Abonnemang", 400],
      ["Buffertsparande", "Sparande", 1500], ["Fondsparande (ISK)", "Sparande", 2000],
      ["Kläder", "Övrigt", 600], ["Nöje", "Övrigt", 800], ["Presenter", "Övrigt", 300], ["Oförutsett", "Övrigt", 500]
    ]
  };
  const MONTHS = ["januari", "februari", "mars", "april", "maj", "juni", "juli", "augusti", "september", "oktober", "november", "december"];
  const SHORT = ["jan", "feb", "mar", "apr", "maj", "jun", "jul", "aug", "sep", "okt", "nov", "dec"];

  // ---------- hjälpfunktioner ----------
  const $ = id => document.getElementById(id);
  const rid = () => Date.now().toString(36).slice(-4) + Math.random().toString(36).slice(2, 8);
  const nf0 = new Intl.NumberFormat("sv-SE", { maximumFractionDigits: 0 });
  const nf2 = new Intl.NumberFormat("sv-SE", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const kr = n => { const v = Math.round((n || 0) * 100) / 100; return (Number.isInteger(v) ? nf0 : nf2).format(v) + " kr"; };
  const pct = n => Math.round(n * 100) + " %";
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
  const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const keyOf = (y, m) => `${y}-${String(m).padStart(2, "0")}`;
  function shiftKey(key, delta) {
    let [y, m] = key.split("-").map(Number); m += delta;
    while (m < 1) { m += 12; y--; } while (m > 12) { m -= 12; y++; }
    return keyOf(y, m);
  }
  function monthName(key) { const [y, m] = key.split("-").map(Number); const n = MONTHS[m - 1]; return n[0].toUpperCase() + n.slice(1) + " " + y; }
  function period(key) {
    const [y, m] = key.split("-").map(Number), s = store.settings.startDay;
    const start = new Date(y, m - 1, s), end = new Date(y, m, s - 1);
    return { start, end, days: Math.round((end - start) / 864e5) + 1 };
  }
  function currentKey() {
    const t = new Date(), s = store.settings.startDay;
    let y = t.getFullYear(), m = t.getMonth() + 1;
    if (t.getDate() < s) { m--; if (m < 1) { m = 12; y--; } }
    return keyOf(y, m);
  }
  function elapsed(key) {
    const { start, end, days } = period(key); const t = new Date(); t.setHours(12, 0, 0, 0);
    if (t < start) return { f: 0, day: 0, days };
    if (t > new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23)) return { f: 1, day: days, days };
    const day = Math.floor((t - start) / 864e5) + 1;
    return { f: day / days, day, days };
  }
  function fmtDay(s) { const [, m, d] = s.split("-").map(Number); return `${d} ${SHORT[m - 1]}`; }

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
  function toast(msg) {
    document.querySelectorAll(".toast").forEach(n => n.remove());
    const n = h("div", { class: "toast", role: "status", text: msg }); document.body.append(n);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => n.remove(), 2600);
  }
  function setSync(text, kind = "") { const s = $("sync"); s.textContent = text; s.className = "sync " + kind; }
  const isNetworkError = e => !e || e.status === 0 || /fetch|network|load failed|offline/i.test(e.message || "");
  const isAuthError = e => e && (e.status === 401 || e.code === "PGRST301" || /jwt|token/i.test(e.message || ""));

  // ---------- lagring: Supabase i molnet, med kopia i telefonen ----------
  const CFG = window.HK_CONFIG || {};
  const CLOUD = !!(CFG.supabaseUrl && CFG.supabaseKey && window.supabase);

  const store = {
    sb: null, user: null, loaded: false,
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
            toast("En ändring kunde inte sparas: " + (res.error.message || "okänt fel"));
          }
          // Ändrades samma månad medan den sparades? Då skickas den igen.
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
      this.loaded = true;
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
      this.user = null; this.months = {}; this.outbox = []; this.settings = { startDay: 1 }; this.loaded = false;
      showLogin();
    }
  };

  // ---------- appens tillstånd ----------
  let cur = null, armed = null, txFilter = "";
  const M = () => store.months[cur];
  function commit() { store.setMonth(cur, M()); queueRender(); }
  let rq = 0;
  function queueRender() { cancelAnimationFrame(rq); rq = requestAnimationFrame(render); }

  function openMonth(key) { cur = key; armed = null; txFilter = ""; render(); }

  const mk = {
    template: () => ({ v: 1, income: TEMPLATE.income.map(([name, amount]) => ({ id: rid(), name, amount })), cats: TEMPLATE.cats.map(([name, group, planned]) => ({ id: rid(), name, group, planned })), tx: [] }),
    blank: () => ({ v: 1, income: [{ id: rid(), name: "Lön (netto)", amount: 0 }], cats: TEMPLATE.cats.map(([name, group]) => ({ id: rid(), name, group, planned: 0 })), tx: [] }),
    copy: prev => ({ v: 1, income: (prev.income || []).map(i => ({ ...i })), cats: (prev.cats || []).map(c => ({ ...c })), tx: [] })
  };
  function createMonth(data) { store.setMonth(cur, data); render(); }

  // ---------- visning ----------
  function render() {
    const act = document.activeElement, fid = act && act.id; let sel = null;
    try { if (fid && act.selectionStart != null) sel = [act.selectionStart, act.selectionEnd]; } catch {}
    $("login").hidden = true;
    $("monthnav").hidden = $("meta").hidden = false;
    renderHeader();
    const month = M();
    const waiting = !month && !store.loaded;
    $("loading").hidden = !waiting;
    $("empty").hidden = waiting || !!month;
    $("budget").hidden = !month;
    if (!month && !waiting) renderEmpty();
    if (month) renderBudget(month);
    if (fid) { const el = $(fid); if (el && el !== document.activeElement) { el.focus({ preventScroll: true }); if (sel) try { el.setSelectionRange(...sel); } catch {} } }
  }

  function renderHeader() {
    $("monthTitle").textContent = monthName(cur);
    const { start, end, days } = period(cur), e = elapsed(cur);
    const range = store.settings.startDay === 1
      ? `1–${end.getDate()} ${MONTHS[start.getMonth()]}`
      : `${start.getDate()} ${SHORT[start.getMonth()]} – ${end.getDate()} ${SHORT[end.getMonth()]}`;
    $("period").textContent = range + (e.f > 0 && e.f < 1 ? ` · dag ${e.day} av ${days}` : e.f === 0 ? " · inte påbörjad" : " · avslutad");
    $("todayBtn").hidden = cur === currentKey();
  }

  function renderEmpty() {
    $("emptyTitle").textContent = `Ingen budget för ${monthName(cur).toLowerCase()} än`;
    $("copyPrevLabel").textContent = `Kopiera ${MONTHS[Number(shiftKey(cur, -1).split("-")[1]) - 1]}`;
    $("emptyMsg").hidden = true;
    $("templatePreview").replaceChildren(...TEMPLATE.cats.map(c => h("span", { text: c[0] })));
  }

  function totals(month) {
    const income = month.income.reduce((s, i) => s + (i.amount || 0), 0);
    const planned = month.cats.reduce((s, c) => s + (c.planned || 0), 0);
    const spentBy = {}; let spent = 0;
    for (const t of month.tx) { spentBy[t.cat || ""] = (spentBy[t.cat || ""] || 0) + t.amount; spent += t.amount; }
    return { income, planned, spent, spentBy };
  }

  function renderBudget(month) {
    month.income ||= []; month.cats ||= []; month.tx ||= [];
    const T = totals(month), e = elapsed(cur);

    // sammanfattning
    const left = T.planned - T.spent;
    $("sLeft").textContent = kr(left); $("sLeft").classList.toggle("neg", left < 0);
    $("sIncome").textContent = kr(T.income);
    $("sIncomeN").textContent = month.income.length === 1 ? "1 inkomstkälla" : `${month.income.length} inkomstkällor`;
    $("sPlanned").textContent = kr(T.planned);
    const un = Math.round((T.income - T.planned) * 100) / 100;
    $("sUnassigned").replaceChildren(
      un === 0 ? h("span", { class: "chip ok", text: "Varje krona har en uppgift" })
        : un > 0 ? h("span", { class: "chip warn", text: `${kr(un)} ofördelat` })
          : h("span", { class: "chip bad", text: `${kr(-un)} över inkomsten` }));
    $("sSpent").textContent = kr(T.spent);
    $("sSpentPct").textContent = T.planned > 0 ? `${pct(T.spent / T.planned)} av det fördelade` : "Inget fördelat än";
    const usedF = T.planned > 0 ? T.spent / T.planned : 0;
    $("sPace").textContent = e.f > 0 && e.f < 1
      ? `${pct(usedF)} av budgeten använd efter ${pct(e.f)} av månaden${usedF > e.f + 0.1 ? ", snabbare än takten" : ""}.`
      : e.f === 0 ? "Månaden har inte börjat än." : (left >= 0 ? `Månaden slutade med ${kr(left)} kvar.` : `Månaden slutade ${kr(-left)} över budget.`);
    const scale = Math.max(T.income, T.planned, T.spent, 1);
    $("mbPlan").style.width = (T.planned / scale * 100) + "%";
    $("mbSpent").style.width = (Math.min(T.spent, scale) / scale * 100) + "%";
    $("mbSpent").classList.toggle("over", T.spent > T.planned);
    const pace = $("mbPace"); pace.hidden = !(e.f > 0 && e.f < 1 && T.planned > 0);
    pace.style.left = `calc(${T.planned / scale * e.f * 100}% - 1px)`;

    // kategorier
    const wrap = $("cats"); wrap.replaceChildren();
    const groups = [...GROUPS, ...new Set(month.cats.map(c => c.group).filter(g => !GROUPS.includes(g)))];
    for (const g of groups) {
      const cs = month.cats.filter(c => c.group === g); if (!cs.length) continue;
      const gp = cs.reduce((s, c) => s + (c.planned || 0), 0), gs = cs.reduce((s, c) => s + (T.spentBy[c.id] || 0), 0);
      wrap.append(h("div", { class: "group" },
        h("div", { class: "ghead" }, h("h3", { text: g }), h("span", { text: `${kr(gs)} av ${kr(gp)}` })),
        cs.map(c => catRow(month, c, T.spentBy[c.id] || 0, e.f))));
    }
    if (T.spentBy[""]) wrap.append(h("div", { class: "group" }, h("div", { class: "ghead" }, h("h3", { text: "Utan kategori" }), h("span", { text: kr(T.spentBy[""]) }))));
    if (!month.cats.length) wrap.append(h("p", { class: "muted", text: "Inga kategorier än. Lägg till den första nedan." }));

    // listor
    fillCatSelect(month, $("txCat"), false);
    fillCatSelect(month, $("txFilter"), true);
    const ng = $("newCatGroup"); if (!ng.options.length) ng.replaceChildren(...GROUPS.map(g => h("option", { value: g, text: g })));
    const td = $("txDate"); if (!td.value || td.dataset.key !== cur) { td.value = defaultDate(); td.dataset.key = cur; }

    // inkomster
    $("incTotal").textContent = kr(T.income);
    $("incomes").replaceChildren(...month.income.map(i => h("div", { class: "inc" },
      h("input", { class: "flat", id: "iname-" + i.id, value: i.name, "aria-label": "Inkomstens namn", onchange: ev => { i.name = ev.target.value.trim() || "Inkomst"; commit(); } }),
      amountInput("iamt-" + i.id, "Belopp", () => i.amount, v => { i.amount = v; }),
      delBtn("inc-" + i.id, "Ta bort inkomst", () => { month.income = month.income.filter(x => x !== i); commit(); })
    )));

    // köp
    const list = month.tx.filter(t => !txFilter || (t.cat || "") === (txFilter === "_none" ? "" : txFilter))
      .slice().sort((a, b) => b.date.localeCompare(a.date) || (b.at || 0) - (a.at || 0));
    const catName = id => month.cats.find(c => c.id === id)?.name || "Utan kategori";
    $("txList").replaceChildren(...(list.length ? list.map(t => h("div", { class: "tx" },
      h("span", { class: "d", text: fmtDay(t.date) }),
      h("div", { class: "n" }, h("b", { text: t.note || catName(t.cat) }), h("span", { text: t.note ? catName(t.cat) : "" })),
      h("span", { class: "a", text: kr(t.amount) }),
      delBtn("tx-" + t.id, "Ta bort köp", () => { month.tx = month.tx.filter(x => x !== t); commit(); })
    )) : [h("p", { class: "muted", text: txFilter ? "Inga köp i den här kategorin." : "Inga köp registrerade den här månaden." })]));
  }

  function amountInput(id, label, get, set) {
    return h("input", {
      class: "flat amt", id, inputmode: "decimal", value: kr(get()), "aria-label": label,
      onfocus: ev => { const v = get(); ev.target.value = v ? String(v).replace(".", ",") : ""; ev.target.select(); },
      onchange: ev => { const v = parseKr(ev.target.value); if (!Number.isNaN(v)) set(v); commit(); },
      onblur: ev => { ev.target.value = kr(get()); }
    });
  }

  function catRow(month, c, spent, f) {
    const p = c.planned || 0, ratio = p > 0 ? spent / p : (spent > 0 ? 2 : 0), left = p - spent;
    let st = "ok";
    if (left < -0.005) st = "bad";
    else if (ratio < 1 && ratio > f + 0.15 && f > 0 && f < 1) st = "warn";
    const leftEl = p === 0 && spent === 0 ? h("div", { class: "left mute c-left", text: "–" })
      : Math.abs(left) < 0.005 ? h("div", { class: "left mute c-left", text: "Klart" })
        : h("div", { class: `left ${st} c-left`, text: left > 0 ? `${kr(left)} kvar` : `${kr(-left)} över` });
    return h("div", { class: "cat" },
      h("div", { class: "c-name" }, h("input", { class: "flat", id: "cname-" + c.id, value: c.name, "aria-label": "Kategorins namn", onchange: ev => { c.name = ev.target.value.trim() || "Namnlös"; commit(); } })),
      h("div", { class: "c-bar" },
        h("div", { class: "bar" }, h("div", { class: "fill " + (st === "ok" ? "" : st), style: `width:${Math.min(ratio, 1) * 100}%` }),
          f > 0 && f < 1 && p > 0 ? h("div", { class: "pace", style: `left:calc(${f * 100}% - 1px)` }) : null),
        h("div", { class: "spentcol", text: `${kr(spent)} spenderat` })),
      h("div", { class: "c-plan" }, amountInput("plan-" + c.id, `Budget för ${c.name}`, () => c.planned || 0, v => { c.planned = v; })),
      leftEl,
      h("div", { class: "c-del" }, delBtn("cat-" + c.id, "Ta bort kategori", () => {
        month.cats = month.cats.filter(x => x !== c);
        for (const t of month.tx) if (t.cat === c.id) t.cat = null;
        commit();
      }))
    );
  }

  // Två tryck för att ta bort: första trycket frågar, andra tar bort.
  function delBtn(key, label, fn) {
    const isArmed = armed === key;
    return h("button", {
      class: "del" + (isArmed ? " armed" : ""), type: "button", "aria-label": label, title: label, text: isArmed ? "Ta bort?" : "×",
      onclick: () => {
        if (armed === key) { armed = null; fn(); return; }
        armed = key; queueRender();
        setTimeout(() => { if (armed === key) { armed = null; queueRender(); } }, 3500);
      }
    });
  }

  function fillCatSelect(month, sel, withAll) {
    const prev = sel.value, opts = [];
    if (withAll) opts.push(h("option", { value: "", text: "Alla kategorier" }));
    for (const g of GROUPS) {
      const cs = month.cats.filter(c => c.group === g); if (!cs.length) continue;
      opts.push(h("optgroup", { label: g }, cs.map(c => h("option", { value: c.id, text: c.name }))));
    }
    const other = month.cats.filter(c => !GROUPS.includes(c.group));
    if (other.length) opts.push(h("optgroup", { label: "Övriga" }, other.map(c => h("option", { value: c.id, text: c.name }))));
    if (withAll && month.tx.some(t => !t.cat)) opts.push(h("option", { value: "_none", text: "Utan kategori" }));
    sel.replaceChildren(...opts);
    if ([...sel.options].some(o => o.value === prev)) sel.value = prev;
    else if (withAll) { sel.value = ""; txFilter = ""; }
  }

  function defaultDate() {
    const { start, end } = period(cur), t = new Date();
    const endOfDay = new Date(end.getFullYear(), end.getMonth(), end.getDate(), 23, 59);
    return iso(t >= start && t <= endOfDay ? t : t < start ? start : end);
  }

  // ---------- händelser ----------
  $("prevBtn").onclick = () => openMonth(shiftKey(cur, -1));
  $("nextBtn").onclick = () => openMonth(shiftKey(cur, 1));
  $("todayBtn").onclick = () => openMonth(currentKey());
  $("templateBtn").onclick = () => createMonth(mk.template());
  $("blankBtn").onclick = () => createMonth(mk.blank());
  $("copyPrevBtn").onclick = () => {
    const prevKey = shiftKey(cur, -1), prev = store.months[prevKey];
    if (!prev) {
      const msg = $("emptyMsg");
      msg.textContent = `Det finns ingen budget för ${monthName(prevKey).toLowerCase()} att kopiera. Välj mallen eller börja från noll.`;
      msg.hidden = false; return;
    }
    createMonth(mk.copy(prev));
  };

  $("addTxForm").addEventListener("submit", ev => {
    ev.preventDefault();
    const msg = $("txMsg"); msg.hidden = true;
    const amount = parseKr($("txAmount").value);
    if (Number.isNaN(amount) || amount === 0) { msg.textContent = "Skriv ett belopp, t.ex. 349 eller 1 250,50."; msg.hidden = false; $("txAmount").focus(); return; }
    M().tx.push({ id: rid(), date: $("txDate").value || defaultDate(), cat: $("txCat").value || null, note: $("txNote").value.trim(), amount, at: Date.now() });
    $("txAmount").value = ""; $("txNote").value = "";
    commit(); toast(`${kr(amount)} tillagt`);
  });

  $("addCatForm").addEventListener("submit", ev => {
    ev.preventDefault();
    const name = $("newCatName").value.trim(); if (!name) { $("newCatName").focus(); return; }
    const planned = parseKr($("newCatPlan").value);
    M().cats.push({ id: rid(), name, group: $("newCatGroup").value, planned: Number.isNaN(planned) ? 0 : planned });
    $("newCatName").value = ""; $("newCatPlan").value = "";
    commit();
  });

  $("addIncBtn").onclick = () => {
    const i = { id: rid(), name: "Ny inkomst", amount: 0 };
    M().income.push(i); commit();
    requestAnimationFrame(() => requestAnimationFrame(() => { const el = $("iname-" + i.id); el?.focus(); el?.select(); }));
  };
  $("txFilter").onchange = ev => { txFilter = ev.target.value; render(); };
  $("startDay").onchange = ev => {
    store.setSettings({ startDay: Number(ev.target.value) === 25 ? 25 : 1 });
    openMonth(currentKey());
  };

  $("csvBtn").onclick = () => {
    const month = M(); if (!month) return;
    const name = id => month.cats.find(c => c.id === id)?.name || "Utan kategori";
    const q = s => `"${String(s).replace(/"/g, '""')}"`;
    const rows = [["Datum", "Kategori", "Anteckning", "Belopp (kr)"].map(q).join(";")]
      .concat(month.tx.slice().sort((a, b) => a.date.localeCompare(b.date))
        .map(t => [t.date, name(t.cat), t.note || "", String(t.amount).replace(".", ",")].map(q).join(";")));
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
    ["loading", "empty", "budget", "monthnav", "meta"].forEach(id => { $(id).hidden = true; });
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
    store.subscribe(key => { if (key === cur) queueRender(); });
    await store.refresh();
    $("startDay").value = String(store.settings.startDay);
    if (cur !== currentKey() && !store.months[cur]) cur = currentKey();
    render();
  }

  // ---------- start ----------
  async function start() {
    $("installTip").hidden = !(isIOS && !isStandalone);
    if (!CLOUD) {
      store.loadCache(); store.loaded = true;
      setSync("Testläge", "warn");
      const n = $("notice"); n.hidden = false;
      n.textContent = "Testläge: databasen är inte inkopplad än, så budgeten sparas bara i den här webbläsaren.";
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
        store.subscribe(key => { if (key === cur) queueRender(); });
        store.refresh().then(() => { if (!document.activeElement || !document.activeElement.matches("input,select")) render(); });
      }
    });
  }

  start();
})();

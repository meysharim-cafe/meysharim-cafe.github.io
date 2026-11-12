// מצב הדגמה: "שרת" מדומה שנשמר רק בדפדפן הנוכחי, עם נתונים לדוגמה.
// פועל רק כש-API_URL ריק ב-config.js. מתנהג כמו apps-script/Code.gs.

const MockAPI = (() => {
  const KEY = "mesharim-demo-db-v1";
  const DEMO_PASSWORD = "1234";

  const DEFAULT_MENU = [
    { id: "pizza",  name: "פיצה",      price: 7,  emoji: "🍕", note: "",                          image: "", active: true },
    { id: "salad",  name: "סלט",       price: 10, emoji: "🥗", note: "",                          image: "", active: true },
    { id: "potato", name: "תפוח אדמה", price: 5,  emoji: "🥔", note: "",                          image: "", active: true },
    { id: "drink",  name: "שתייה",     price: 5,  emoji: "🥤", note: "שוקו או קפה — בוחרים במקום", image: "", active: true }
  ];
  const NAMES = ["דנה", "יוסי", "נועה", "איתי", "מאיה", "עומר", "שירה", "אורי", "תמר", "אליה", "רון", "הדר", "יובל", "ליאור", "עדי", "גיא"];
  const CLASSES = ["ז׳1", "ז׳2", "ח׳1", "ח׳2", "ט׳1"];

  const rnd = n => Math.floor(Math.random() * n);
  const uid = () => Math.random().toString(36).slice(2, 10).toUpperCase();

  function fakeOrder(day, menu) {
    const items = {};
    menu.forEach(m => { if (Math.random() < (m.id === "drink" ? 0.75 : 0.45)) items[m.id] = 1 + (Math.random() < 0.2 ? 1 : 0); });
    if (!Object.keys(items).length) items.pizza = 1;
    const created = new Date(Util.addDays(day, -1 - rnd(5)) + "T0" + (7 + rnd(3)) + ":" + (10 + rnd(49)) + ":00+02:00").toISOString();
    return {
      id: uid(), token: uid() + uid(), created, day,
      name: NAMES[rnd(NAMES.length)], klass: CLASSES[rnd(CLASSES.length)],
      items, total: total(items, menu), status: Math.random() < 0.05 ? "canceled" : "active"
    };
  }

  function seed() {
    const menu = DEFAULT_MENU.map(m => ({ ...m }));
    const win = Util.orderWindow();
    const orders = [];
    for (let w = 6; w >= 1; w--) {
      const day = Util.addDays(win.day, -7 * w);
      const n = 22 + w % 3 * 3 + (6 - w) * 2 + rnd(4);
      for (let i = 0; i < n; i++) orders.push(fakeOrder(day, menu));
    }
    for (let i = 0; i < 14; i++) orders.push(fakeOrder(win.day, menu));
    return { menu, menuVersion: String(Date.now()), orders };
  }

  function load() {
    try { const s = JSON.parse(localStorage.getItem(KEY)); if (s && s.menu) return s; } catch (e) {}
    const db = seed(); save(db); return db;
  }
  function save(db) { try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) {} }

  function total(items, menu) {
    return Object.entries(items).reduce((s, [id, q]) => {
      const m = menu.find(x => x.id === id);
      return s + (m ? m.price * q : 0);
    }, 0);
  }

  function fail(code, msg) { throw Object.assign(new Error(msg), { code }); }
  function checkPw(pw) { if (pw !== DEMO_PASSWORD) fail("bad_password", "סיסמה שגויה"); }
  const pub = o => ({ id: o.id, created: o.created, day: o.day, name: o.name, klass: o.klass, items: o.items, total: o.total, status: o.status });

  async function handle(action, d) {
    await new Promise(r => setTimeout(r, 250));
    const db = load();
    const win = Util.orderWindow();
    switch (action) {
      case "getMenu": {
        if (d.v && d.v === db.menuVersion) return { ok: true, same: true, v: db.menuVersion, window: win };
        return { ok: true, v: db.menuVersion, window: win, items: db.menu.filter(m => m.active) };
      }
      case "placeOrder": {
        const name = String(d.name || "").trim(), klass = String(d.klass || "").trim();
        if (name.length < 2) fail("bad_name", "צריך לכתוב שם");
        if (!klass) fail("bad_class", "צריך לכתוב כיתה");
        const items = {};
        for (const [id, q] of Object.entries(d.items || {})) {
          const n = Math.floor(Number(q));
          if (n > 0 && db.menu.some(m => m.id === id && m.active)) items[id] = Math.min(n, 99);
        }
        if (!Object.keys(items).length) fail("empty", "לא נבחרה אף מנה");
        const o = { id: uid(), token: uid() + uid(), created: new Date().toISOString(), day: win.day, name, klass, items, total: total(items, db.menu), status: "active" };
        db.orders.push(o); save(db);
        return { ok: true, id: o.id, token: o.token, day: o.day, total: o.total };
      }
      case "cancelOrder": {
        const o = db.orders.find(x => x.id === d.id);
        if (!o || o.token !== d.token) fail("not_found", "ההזמנה לא נמצאה");
        if (o.status !== "active") return { ok: true, status: o.status };
        if (o.day !== win.day) fail("closed", "ההזמנה כבר נסגרה ואי אפשר לבטל אותה");
        o.status = "canceled"; o.canceledBy = "תלמיד"; save(db);
        return { ok: true, status: "canceled" };
      }
      case "orderStatus": {
        const res = {};
        (d.orders || []).forEach(({ id, token }) => {
          const o = db.orders.find(x => x.id === id && x.token === token);
          res[id] = o ? o.status : "missing";
        });
        return { ok: true, statuses: res, window: win };
      }
      case "adminLogin": checkPw(d.pw); return { ok: true };
      case "adminData": {
        checkPw(d.pw);
        const from = Util.addDays(win.day, -7 * (d.weeks || 16));
        return { ok: true, window: win, menu: db.menu, orders: db.orders.filter(o => o.day >= from).map(pub) };
      }
      case "adminSetStatus": {
        checkPw(d.pw);
        const o = db.orders.find(x => x.id === d.id);
        if (!o) fail("not_found", "ההזמנה לא נמצאה");
        o.status = d.status === "canceled" ? "canceled" : "active"; o.canceledBy = "צוות"; save(db);
        return { ok: true, status: o.status };
      }
      case "adminSaveMenu": {
        checkPw(d.pw);
        db.menu = (d.items || []).map(m => ({
          id: m.id, name: String(m.name).trim(), price: Number(m.price) || 0, emoji: m.emoji || "🍽️",
          note: m.note || "", image: m.image || "", active: !!m.active
        }));
        db.menuVersion = String(Date.now()); save(db);
        return { ok: true, v: db.menuVersion };
      }
      case "demoReset": localStorage.removeItem(KEY); return { ok: true };
    }
    fail("unknown_action", "פעולה לא מוכרת");
  }

  return { handle, DEMO_PASSWORD };
})();

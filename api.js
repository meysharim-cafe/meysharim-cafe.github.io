// שכבת תקשורת משותפת לאפליקציית התלמידים ולמסך הניהול.
// אם API_URL ריק (config.js) — הכל עובד מול MockAPI (מצב הדגמה, נשמר רק בדפדפן).

const DEMO = !API_URL;

async function api(action, data = {}) {
  if (DEMO) return MockAPI.handle(action, data);
  let res;
  try {
    res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...data })
    });
  } catch (e) {
    throw Object.assign(new Error("אין חיבור לאינטרנט"), { code: "network" });
  }
  let j;
  try { j = await res.json(); }
  catch (e) { throw Object.assign(new Error("תשובה לא תקינה מהשרת"), { code: "bad_response" }); }
  if (!j.ok) throw Object.assign(new Error(j.error || "שגיאה"), { code: j.code || "error" });
  return j;
}

const Util = {
  TZ: "Asia/Jerusalem",
  CAFE_WEEKDAY: 2,   // 1=שני ... 7=ראשון. 2 = יום שלישי
  CUTOFF_HOUR: 8,    // אפשר להזמין עד השעה הזאת ביום שלישי

  // היום שבו ההזמנה תסופק: יום שלישי הקרוב שעוד לא עברה בו שעת הסגירה
  orderWindow(now = new Date()) {
    const f = new Intl.DateTimeFormat("en-CA", {
      timeZone: Util.TZ, year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", hourCycle: "h23", weekday: "short"
    });
    const p = Object.fromEntries(f.formatToParts(now).map(x => [x.type, x.value]));
    const wd = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }[p.weekday];
    let days = (Util.CAFE_WEEKDAY - wd + 7) % 7;
    if (days === 0 && Number(p.hour) >= Util.CUTOFF_HOUR) days = 7;
    return { day: Util.addDays(`${p.year}-${p.month}-${p.day}`, days), cutoffHour: Util.CUTOFF_HOUR };
  },

  addDays(ymd, n) {
    const d = new Date(ymd + "T12:00:00Z");
    d.setUTCDate(d.getUTCDate() + n);
    return d.toISOString().slice(0, 10);
  },

  // "2026-11-17" -> "17.11"
  fmtDay(ymd) {
    if (!ymd) return "";
    const [, m, d] = ymd.split("-");
    return `${Number(d)}.${Number(m)}`;
  },

  fmtTime(iso) {
    try {
      return new Intl.DateTimeFormat("he-IL", { timeZone: Util.TZ, weekday: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));
    } catch (e) { return ""; }
  },

  itemsText(items, menu) {
    return Object.entries(items || {})
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const m = (menu || []).find(x => x.id === id);
        return `${m ? m.name : id} ×${q}`;
      }).join(", ");
  },

  esc(s) {
    return String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },

  ls: {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
    del(k) { try { localStorage.removeItem(k); } catch (e) {} }
  }
};

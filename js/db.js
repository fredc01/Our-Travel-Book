// Talks to our Google Sheet through its Apps Script web app. Nobody needs to open the sheet.
const DB = (() => {
  const URL_ = String((window.TRAVEL_CONFIG || {}).SCRIPT_URL || "").trim();
  const ready = /^https:\/\/script\.google\.com\//.test(URL_);
  const KEY = "travelbook-password";
  const pw = {
    get() { try { return localStorage.getItem(KEY) || ""; } catch { return ""; } },
    set(v) { try { localStorage.setItem(KEY, v); } catch {} },
    clear() { try { localStorage.removeItem(KEY); } catch {} }
  };
  const t = (v) => String(v ?? "").trim();
  const splitPhotos = (p) => t(p).split("|").map((x) => x.trim()).filter(Boolean);   // several photos live in one cell, separated by |
  const photoPath = (p) => !t(p) ? null : /^(https?:|data:|images\/)/i.test(t(p)) ? t(p) : "images/" + t(p);

  async function read(res) {
    let out;
    try { out = await res.json(); }
    catch { throw new Error("The sheet didn’t answer. Check the web app URL in js/config.js and that access is set to “Anyone”."); }
    if (!out.ok) { const e = new Error(out.error || "Something went wrong."); e.code = out.code; throw e; }
    return out.data;
  }
  async function call(action, payload = {}) {
    // text/plain keeps this a "simple" request, so the browser doesn't need a CORS preflight (Apps Script can't answer one)
    const res = await fetch(URL_, { method: "POST", headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify({ action, ...payload, password: pw.get() }) });
    try { return await read(res); }
    catch (e) {
      if (e.code === "auth") { pw.clear(); window.dispatchEvent(new Event("travel-auth-lost")); e.message = "Wrong password. Please sign in again."; }
      throw e;
    }
  }

  /* ---------- sign in (one shared password) ---------- */
  async function session() { return !!pw.get(); }
  async function signIn(password) {
    pw.set(String(password));
    try { await call("ping"); } catch (e) { pw.clear(); throw e; }
  }
  async function signOut() { pw.clear(); }

  /* ---------- read everything ---------- */
  async function load() {
    const res = await fetch(URL_ + (URL_.includes("?") ? "&" : "?") + "t=" + Date.now());
    const d = await read(res);
    return {
      settings: { a: t(d.settings.a) || "You", b: t(d.settings.b) || "Me", since: d.settings.since || "" },
      next: { place: t(d.next.place), date: d.next.date || "" },
      memories: d.memories.map((r) => {
        const raw = splitPhotos(r.photo);
        return { id: r.id, title: r.title, place: r.place, date: r.date || "1970-01-01", mood: r.mood || "🥰", note: r.story || "",
          photos: raw.map(photoPath), rawPhotos: raw };
      }),
      bucket: d.bucket.map((r) => ({ id: r.id, text: r.item, done: !!r.done })),
      dreams: d.dreams.map((r) => ({ id: r.id, place: r.place }))
    };
  }

  /* ---------- changes ---------- */
  const saveSettings = (v) => call("saveSettings", v);
  const saveMemory = ({ id, ...row }) => call("saveMemory", { id, ...row });
  const deleteMemory = (id) => call("deleteMemory", { id });
  async function uploadPhoto(dataUrl) { return (await call("uploadPhoto", { data: dataUrl })).url; }
  async function removePhoto(url) { if (/drive\.google\.com\/thumbnail/.test(url || "")) try { await call("deletePhoto", { url }); } catch {} }
  const addBucket = (item) => call("addBucket", { item });
  const setBucketDone = (id, done) => call("setBucketDone", { id, done });
  const deleteBucket = (id) => call("deleteBucket", { id });
  const addDream = (place) => call("addDream", { place });
  const deleteDream = (id) => call("deleteDream", { id });

  return { ready, session, signIn, signOut, load, saveSettings, saveMemory, deleteMemory, uploadPhoto, removePhoto,
           addBucket, setBucketDone, deleteBucket, addDream, deleteDream };
})();

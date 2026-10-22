(() => {
  const $ = (s) => document.querySelector(s);
  const esc = (t) => String(t ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmtDate = (d) => d ? new Date(d + "T00:00").toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" }) : "";
  const today = () => { const n = new Date(); return `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, "0")}-${String(n.getDate()).padStart(2, "0")}`; };
  const MOODS = ["🥰", "😆", "🌅", "🍜", "😴", "🤪"];

  let S = null, editing = false, placeFilter = "all", shown = [], viewIdx = 0, pendingPhoto = null, editMem = null;
  let toastTimer;
  function toast(msg) {
    const t = $("#toast"); t.textContent = msg; t.classList.add("show");
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 3200);
  }
  const sorted = () => [...S.memories].sort((a, b) => b.date.localeCompare(a.date));
  const msg = (err) => (err && err.message) || String(err);

  /* ---------- Loading ---------- */
  async function start() {
    $("#wall").innerHTML = `<p class="empty">Opening our book…</p>`;
    if (!DB.ready) { $("#authBtn").hidden = true; return showBanner("setup"); }
    try {
      editing = !!(await DB.session());
      S = await DB.load();
      setEditing(editing);
    } catch (err) { console.error(err); showBanner("error"); }
  }
  function showBanner(kind) {
    $("#wall").innerHTML = kind === "setup"
      ? `<div class="loadbanner"><p>The site isn’t connected to our Google Sheet yet. Open <strong>js/config.js</strong> and paste in the web app URL (README, step 5).</p></div>`
      : `<div class="loadbanner"><p>We couldn’t open our book. Check the internet and try again.</p><button class="btn small" id="retry" type="button">Try again</button></div>`;
    const r = $("#retry"); if (r) r.addEventListener("click", start);
  }
  window.addEventListener("travel-auth-lost", () => setEditing(false));
  function setEditing(on) {
    editing = on;
    document.querySelectorAll(".edit-only").forEach(el => { el.hidden = !on; });
    $("#authBtn").textContent = on ? "Sign out" : "Sign in";
    if (S) render();
  }
  async function reload() { S = await DB.load(); render(); }
  function render() { renderHero(); renderWall(); renderNext(); renderBucket(); }

  /* ---------- Sign in / out ---------- */
  const ld = $("#loginDialog"), lf = $("#loginForm");
  $("#authBtn").addEventListener("click", async () => {
    if (editing) { await DB.signOut(); setEditing(false); toast("Signed out"); }
    else { lf.reset(); $("#loginError").textContent = ""; ld.showModal(); }
  });
  lf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#loginGo"); btn.disabled = true;
    try {
      await DB.signIn(lf.elements.password.value);
      ld.close(); setEditing(true); toast("Welcome back 💖");
    } catch { $("#loginError").textContent = "That password didn’t work."; }
    finally { btn.disabled = false; }
  });

  /* ---------- Hero ---------- */
  function renderHero() { $("#nameA").textContent = S.settings.a; $("#nameB").textContent = S.settings.b; tick(); }
  function tick() {
    const el = $("#counter");
    if (!S || !S.settings.since) { el.hidden = true; return; }
    el.hidden = false;
    const start = new Date(S.settings.since + "T00:00"), now = new Date();
    let y = now.getFullYear() - start.getFullYear(), m = now.getMonth() - start.getMonth(), d = now.getDate() - start.getDate();
    if (d < 0) { m--; d += new Date(now.getFullYear(), now.getMonth(), 0).getDate(); }
    if (m < 0) { y--; m += 12; }
    const days = Math.floor((now - start) / 864e5), p = (n) => String(n).padStart(2, "0");
    el.innerHTML = `<strong>${days.toLocaleString()}</strong> days together<small>${y} yr ${m} mo ${d} d, and ${p(now.getHours())}:${p(now.getMinutes())}:${p(now.getSeconds())} of today</small>`;
  }
  setInterval(tick, 1000);
  $("#counter").hidden = true;
  $("#plane").addEventListener("click", (e) => { const p = e.currentTarget; p.classList.remove("fly"); void p.offsetWidth; p.classList.add("fly"); });
  setTimeout(() => $("#plane").classList.add("fly"), 400);

  /* ---------- Memory wall ---------- */
  function renderFilters() {
    const places = [...new Set(S.memories.map(m => m.place))].sort();
    if (placeFilter !== "all" && !places.includes(placeFilter)) placeFilter = "all";
    $("#filters").innerHTML = places.length > 1 ? ["all", ...places].map(p =>
      `<button type="button" aria-pressed="${p === placeFilter}" data-p="${esc(p)}">${p === "all" ? "Everywhere" : esc(p)}</button>`).join("") : "";
    $("#placeList").innerHTML = places.map(p => `<option value="${esc(p)}">`).join("");
  }
  function renderWall() {
    renderFilters();
    shown = sorted().filter(m => placeFilter === "all" || m.place === placeFilter);
    $("#wall").innerHTML = shown.length ? shown.map((m, i) => `
      <button type="button" class="polaroid" style="--r:${((i * 37) % 7 - 3)}deg" data-i="${i}" aria-label="Open memory: ${esc(m.title)}">
        <span class="photo ${m.photo ? "" : "blank"}">${m.photo ? `<img src="${esc(m.photo)}" alt="" loading="lazy">` : esc(m.mood)}</span>
        <span class="cap"><strong>${esc(m.title)}</strong><small>${esc(m.mood)} ${esc(m.place)} · ${fmtDate(m.date)}</small></span>
      </button>`).join("")
      : `<p class="empty">No memories yet. ${editing ? "Press “+ Add a memory” to pin the first one." : "Sign in to pin the first one."}</p>`;
    renderStamps();
  }
  $("#filters").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { placeFilter = b.dataset.p; renderWall(); } });
  $("#wall").addEventListener("click", (e) => { const b = e.target.closest(".polaroid"); if (b) openView(+b.dataset.i); });
  $("#surpriseBtn").addEventListener("click", () => {
    if (!S || !S.memories.length) return toast("Add a memory first!");
    shown = sorted(); openView(Math.floor(Math.random() * shown.length)); FX.burst(innerWidth / 2, innerHeight / 2);
  });

  /* ---------- Viewer ---------- */
  const vd = $("#viewDialog");
  function openView(i) {
    viewIdx = (i + shown.length) % shown.length;
    const m = shown[viewIdx];
    $("#vPhoto").className = "photo" + (m.photo ? "" : " blank");
    $("#vPhoto").innerHTML = m.photo ? `<img src="${esc(m.photo)}" alt="${esc(m.title)}">` : esc(m.mood);
    $("#vTitle").textContent = m.title;
    $("#vMeta").textContent = `${m.mood} ${m.place} · ${fmtDate(m.date)}`;
    $("#vNote").textContent = m.note || "";
    if (!vd.open) vd.showModal();
  }
  $("#vPrev").onclick = () => openView(viewIdx - 1);
  $("#vNext").onclick = () => openView(viewIdx + 1);
  vd.addEventListener("keydown", (e) => { if (e.key === "ArrowLeft") openView(viewIdx - 1); if (e.key === "ArrowRight") openView(viewIdx + 1); });
  $("#vEdit").onclick = () => { const m = shown[viewIdx]; vd.close(); openMemory(m); };
  $("#vDelete").onclick = async () => {
    const m = shown[viewIdx];
    if (!confirm(`Delete “${m.title}”? This can’t be undone.`)) return;
    try {
      await DB.deleteMemory(m.id); DB.removePhoto(m.rawPhoto);
      vd.close(); await reload(); toast("Memory deleted");
    } catch (err) { toast("Couldn’t delete: " + msg(err)); }
  };

  /* ---------- Add / edit memory ---------- */
  const md = $("#memDialog"), mf = $("#memForm"), prev = $("#photoPreview");
  $("#moods").innerHTML = MOODS.map((m, i) =>
    `<label class="mood"><input type="radio" name="mood" value="${m}" ${i === 0 ? "checked" : ""}><span>${m}</span></label>`).join("");
  function openMemory(m) {
    const el = mf.elements;
    mf.reset(); pendingPhoto = null; editMem = m || null; $("#memError").textContent = "";
    $("#memDialogTitle").textContent = m ? "Edit memory" : "New memory";
    el.title.value = m ? m.title : ""; el.place.value = m ? m.place : ""; el.date.value = m ? m.date : today(); el.note.value = m ? m.note : "";
    const mood = m && MOODS.includes(m.mood) ? m.mood : MOODS[0];
    mf.querySelectorAll('input[name="mood"]').forEach(r => { r.checked = r.value === mood; });
    prev.hidden = !(m && m.photo); if (m && m.photo) prev.src = m.photo;
    $("#removePhotoRow").hidden = !(m && m.photo);
    md.showModal();
  }
  $("#addBtn").onclick = () => openMemory(null);
  mf.elements.photo.addEventListener("change", async () => {
    const f = mf.elements.photo.files[0]; if (!f) return;
    try { pendingPhoto = await shrink(f); prev.src = pendingPhoto; prev.hidden = false; mf.elements.removePhoto.checked = false; }
    catch { $("#memError").textContent = "That file couldn’t be read as an image. Try a JPG or PNG."; }
  });
  function shrink(file, max = 1400) {
    return new Promise((res, rej) => {
      const img = new Image(), url = URL.createObjectURL(file);
      img.onload = () => {
        const k = Math.min(1, max / Math.max(img.width, img.height)), c = document.createElement("canvas");
        c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
        c.getContext("2d").drawImage(img, 0, 0, c.width, c.height); URL.revokeObjectURL(url);
        res(c.toDataURL("image/jpeg", .8));
      };
      img.onerror = rej; img.src = url;
    });
  }
  mf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const el = mf.elements;
    const v = { title: el.title.value.trim(), place: el.place.value.trim(), date: el.date.value,
      mood: (mf.querySelector('input[name="mood"]:checked') || {}).value || MOODS[0], story: el.note.value.trim() };
    if (!v.title || !v.place || !v.date) { $("#memError").textContent = "Add a title, a place and a date."; return; }
    const btn = $("#memSave"); btn.disabled = true; btn.textContent = "Saving…";
    try {
      const old = editMem ? editMem.rawPhoto : "";
      let photo = old;
      if (pendingPhoto) photo = await DB.uploadPhoto(pendingPhoto);
      else if (el.removePhoto.checked) photo = "";
      await DB.saveMemory({ id: editMem ? editMem.id : undefined, ...v, photo });
      if (old && old !== photo) DB.removePhoto(old);
      const wasNew = !editMem;
      md.close(); await reload();
      if (wasNew) FX.confetti(); toast(wasNew ? "Memory pinned 💖" : "Memory updated");
    } catch (err) { $("#memError").textContent = "Couldn’t save: " + msg(err); }
    finally { btn.disabled = false; btn.textContent = "Save memory"; }
  });

  /* ---------- Our details + next trip ---------- */
  const sd = $("#setDialog"), sf = $("#setForm");
  $("#settingsBtn").onclick = () => {
    const el = sf.elements;
    el.nameA.value = S.settings.a; el.nameB.value = S.settings.b; el.since.value = S.settings.since;
    el.nextPlace.value = S.next.place; el.nextDate.value = S.next.date; $("#setError").textContent = ""; sd.showModal();
  };
  sf.addEventListener("submit", async (e) => {
    e.preventDefault();
    const el = sf.elements, btn = $("#setSave"); btn.disabled = true;
    try {
      await DB.saveSettings({ name_a: el.nameA.value.trim() || "You", name_b: el.nameB.value.trim() || "Me", since: el.since.value || null,
        next_place: el.nextPlace.value.trim(), next_date: el.nextDate.value || null });
      sd.close(); await reload(); toast("Saved 💖");
    } catch (err) { $("#setError").textContent = "Couldn’t save: " + msg(err); }
    finally { btn.disabled = false; }
  });

  /* ---------- Passport ---------- */
  function renderStamps() {
    const g = {};
    sorted().reverse().forEach(m => { (g[m.place] ||= { place: m.place, first: m.date, n: 0, mood: m.mood }).n++; });
    const list = Object.values(g), have = new Set(list.map(s => s.place.toLowerCase()));
    const dreams = S.dreams.filter(d => !have.has(d.place.toLowerCase()));
    $("#stamps").innerHTML = list.map((s, i) => `
      <div class="stamp c${i % 4}" style="--r:${(i * 53) % 13 - 6}deg">
        <span class="s-mood">${esc(s.mood)}</span><strong>${esc(s.place)}</strong>
        <small>${fmtDate(s.first)}</small><small>${s.n} ${s.n === 1 ? "memory" : "memories"}</small>
      </div>`).join("") + dreams.map((d, i) => `
      <div class="stamp dream" style="--r:${(i * 47) % 11 - 5}deg">
        ${editing ? `<button type="button" class="rm" data-dream="${esc(d.id)}" aria-label="Remove ${esc(d.place)}">✕</button>` : ""}
        <span class="s-mood">🎒</span><strong>${esc(d.place)}</strong><small>Someday soon ✨</small></div>`).join("");
  }
  $("#stamps").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-dream]"); if (!b) return;
    try { await DB.deleteDream(b.dataset.dream); S.dreams = S.dreams.filter(d => d.id !== b.dataset.dream); renderStamps(); }
    catch (err) { toast("Couldn’t remove: " + msg(err)); }
  });
  $("#dreamForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget, place = f.elements.place.value.trim(); if (!place) return;
    try { const row = await DB.addDream(place); S.dreams.push({ id: row.id, place: row.place }); f.reset(); renderStamps(); }
    catch (err) { toast("Couldn’t add: " + msg(err)); }
  });

  /* ---------- Next trip + bucket list ---------- */
  function renderNext() {
    const n = S.next, el = $("#countdown");
    if (!n.place || !n.date) { el.textContent = editing ? "No trip planned yet. Add one in “Our details & next trip”." : "No trip planned yet."; return; }
    const days = Math.ceil((new Date(n.date + "T00:00") - new Date(today() + "T00:00")) / 864e5);
    el.innerHTML = days > 0 ? `<strong>${days}</strong> ${days === 1 ? "day" : "days"} until ${esc(n.place)} ✈️`
      : days === 0 ? `<strong>Today!</strong> ${esc(n.place)} here we come 🎉` : `${esc(n.place)} was ${-days} days ago. Add the memory!`;
  }
  function renderBucket() {
    const done = S.bucket.filter(b => b.done).length;
    $("#progress").textContent = S.bucket.length ? `${done} of ${S.bucket.length} done` : "Nothing here yet.";
    $("#bucket").innerHTML = S.bucket.map(b => editing
      ? `<li class="${b.done ? "done" : ""}"><label><input class="sr" type="checkbox" data-id="${esc(b.id)}" ${b.done ? "checked" : ""}><span class="box" aria-hidden="true"></span><span>${esc(b.text)}</span></label><button type="button" class="rm" data-rm="${esc(b.id)}" aria-label="Remove ${esc(b.text)}">✕</button></li>`
      : `<li class="${b.done ? "done" : ""}"><span class="box" role="img" aria-label="${b.done ? "Done" : "Not done"}"></span><span>${esc(b.text)}</span></li>`).join("");
  }
  $("#bucket").addEventListener("change", async (e) => {
    const cb = e.target.closest("input[data-id]"); if (!cb) return;
    const b = S.bucket.find(x => x.id === cb.dataset.id); if (!b) return;
    b.done = cb.checked; renderBucket();
    try { await DB.setBucketDone(b.id, b.done); }
    catch (err) { b.done = !b.done; renderBucket(); toast("Couldn’t save that: " + msg(err)); }
  });
  $("#bucket").addEventListener("click", async (e) => {
    const b = e.target.closest("[data-rm]"); if (!b) return;
    try { await DB.deleteBucket(b.dataset.rm); S.bucket = S.bucket.filter(x => x.id !== b.dataset.rm); renderBucket(); }
    catch (err) { toast("Couldn’t remove: " + msg(err)); }
  });
  $("#bucketForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = e.currentTarget, item = f.elements.item.value.trim(); if (!item) return;
    try { const row = await DB.addBucket(item); S.bucket.push({ id: row.id, text: row.item, done: !!row.done }); f.reset(); renderBucket(); }
    catch (err) { toast("Couldn’t add: " + msg(err)); }
  });

  document.addEventListener("click", (e) => { if (e.target.matches("[data-close]")) e.target.closest("dialog").close(); });
  document.querySelectorAll("dialog").forEach(d => d.addEventListener("click", (e) => { if (e.target === d) d.close(); }));
  start();
})();

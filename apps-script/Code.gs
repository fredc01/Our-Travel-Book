/**
 * Our Travel Book: the "backend" that lives inside our Google Sheet.
 * The website reads and saves everything through this script, so nobody has to open the sheet.
 *
 * 1. Change PASSWORD below (the one password you both type on the website).
 * 2. Run setup() once. 3. Deploy > New deployment > Web app (see README).
 */
const PASSWORD = "change-me";

const SHEETS = {
  "Settings":     ["Setting", "Value"],
  "Memories":     ["ID", "Title", "Place", "Date", "Mood", "Story", "Photo"],
  "Bucket list":  ["ID", "Item", "Done"],
  "Dream places": ["ID", "Place"]
};

/* ---------- web app entry points ---------- */
function doGet() { return json_({ ok: true, data: readAll_() }); }

function doPost(e) {
  let lock = null;
  try {
    if (PASSWORD === "change-me") return json_({ ok: false, code: "setup", error: "Set a password in Code.gs first." });
    const req = JSON.parse(e.postData.contents);
    if (String(req.password || "") !== PASSWORD) return json_({ ok: false, code: "auth", error: "Wrong password." });
    const handler = ACTIONS[req.action];
    if (!handler) throw new Error("Unknown action: " + req.action);
    lock = LockService.getScriptLock();
    lock.waitLock(20000);
    return json_({ ok: true, data: handler(req) });
  } catch (err) {
    return json_({ ok: false, error: String((err && err.message) || err) });
  } finally {
    if (lock) { try { lock.releaseLock(); } catch (_) {} }
  }
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

/* ---------- one-time setup: run this from the editor ---------- */
function setup() {
  const ss = ss_();
  Object.keys(SHEETS).forEach(function (name) {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    sh.getRange(1, 1, sh.getMaxRows(), sh.getMaxColumns()).setNumberFormat("@");   // plain text: dates and stories stay as typed
    if (sh.getLastRow() === 0) sh.appendRow(SHEETS[name]);
    sh.setFrozenRows(1);
  });
  const blank = ss.getSheetByName("Sheet1");
  if (blank && ss.getSheets().length > 1) ss.deleteSheet(blank);

  if (sheet_("Settings").getLastRow() < 2) {
    [["Your name", "You"], ["Partner name", "Me"], ["Together since", ""], ["Next trip place", ""], ["Next trip date", ""]]
      .forEach(function (r) { sheet_("Settings").appendRow(r); });
  }
  if (sheet_("Memories").getLastRow() < 2) {
    [["Pine tree wonderland", "Baguio", "2026-01-10", "🥰", "Sample memory. Replace this with your own story.", "images/baguio-1.svg"],
     ["Golden hour, cold hands", "Baguio", "2026-01-11", "🌅", "Sample memory. Add the little details: what we ate, what made us laugh.", "images/baguio-2.svg"],
     ["Lost in the fog", "Baguio", "2026-01-12", "😴", "Sample memory. Delete these when you are ready to start fresh.", "images/baguio-3.svg"]]
      .forEach(function (r) { sheet_("Memories").appendRow([Utilities.getUuid()].concat(r)); });
  }
  if (sheet_("Bucket list").getLastRow() < 2) {
    [["Strawberry taho at the market", "no"], ["Sunrise at Mines View", "no"], ["Matching sweaters (non-negotiable)", "yes"]]
      .forEach(function (r) { sheet_("Bucket list").appendRow([Utilities.getUuid()].concat(r)); });
  }
  if (sheet_("Dream places").getLastRow() < 2) {
    ["Palawan", "Siargao", "Batanes", "Banaue", "Cebu", "Bohol"]
      .forEach(function (p) { sheet_("Dream places").appendRow([Utilities.getUuid(), p]); });
  }
  folder_();   // creates the photo folder now so Google asks for Drive permission here
  Logger.log("Setup done. Now deploy as a web app (see README).");
}

/* ---------- actions the website can ask for ---------- */
const ACTIONS = {
  ping: function () { return true; },

  saveSettings: function (r) {
    setSetting_("Your name", r.name_a);
    setSetting_("Partner name", r.name_b);
    setSetting_("Together since", r.since);
    setSetting_("Next trip place", r.next_place);
    setSetting_("Next trip date", r.next_date);
    return true;
  },

  saveMemory: function (r) {
    const sh = sheet_("Memories");
    const row = [text_(r.title), text_(r.place), text_(r.date), text_(r.mood), String(r.story || ""), text_(r.photo)];
    if (!row[0] || !row[1] || !row[2]) throw new Error("A memory needs a title, a place and a date.");
    if (r.id) {
      const n = rowOf_("Memories", r.id);
      if (!n) throw new Error("That memory no longer exists.");
      sh.getRange(n, 2, 1, 6).setValues([row]);
      return { id: String(r.id) };
    }
    const id = Utilities.getUuid();
    sh.appendRow([id].concat(row));
    return { id: id };
  },
  deleteMemory: function (r) { return deleteRow_("Memories", r.id); },

  addBucket: function (r) {
    const item = text_(r.item); if (!item) throw new Error("Type something first.");
    const id = Utilities.getUuid();
    sheet_("Bucket list").appendRow([id, item, "no"]);
    return { id: id, item: item, done: false };
  },
  setBucketDone: function (r) {
    const n = rowOf_("Bucket list", r.id); if (!n) throw new Error("That item no longer exists.");
    sheet_("Bucket list").getRange(n, 3).setValue(r.done ? "yes" : "no");
    return true;
  },
  deleteBucket: function (r) { return deleteRow_("Bucket list", r.id); },

  addDream: function (r) {
    const place = text_(r.place); if (!place) throw new Error("Type a place first.");
    const id = Utilities.getUuid();
    sheet_("Dream places").appendRow([id, place]);
    return { id: id, place: place };
  },
  deleteDream: function (r) { return deleteRow_("Dream places", r.id); },

  uploadPhoto: function (r) {
    const data = String(r.data || "");
    const comma = data.indexOf(",");
    if (data.indexOf("data:image/") !== 0 || comma < 0) throw new Error("That doesn’t look like an image.");
    const mime = data.substring(5, data.indexOf(";"));
    const blob = Utilities.newBlob(Utilities.base64Decode(data.substring(comma + 1)), mime, "photo-" + Date.now() + ".jpg");
    const file = folder_().createFile(blob);
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);
    return { url: "https://drive.google.com/thumbnail?id=" + file.getId() + "&sz=w1400" };
  },
  deletePhoto: function (r) {                       // only ever trashes files inside our own photo folder
    const m = /[?&]id=([\w-]+)/.exec(String(r.url || ""));
    if (!m) return false;
    const folderId = folder_().getId();
    const file = DriveApp.getFileById(m[1]);
    const parents = file.getParents();
    while (parents.hasNext()) { if (parents.next().getId() === folderId) { file.setTrashed(true); return true; } }
    return false;
  }
};

/* ---------- reading ---------- */
function readAll_() {
  const cfg = {};
  table_("Settings").forEach(function (r) { cfg[key_(r.Setting)] = text_(r.Value); });
  return {
    settings: { a: cfg["your name"] || "You", b: cfg["partner name"] || "Me", since: cfg["together since"] || "" },
    next: { place: cfg["next trip place"] || "", date: cfg["next trip date"] || "" },
    memories: table_("Memories").filter(function (r) { return text_(r.ID) && text_(r.Title) && text_(r.Place); }).map(function (r) {
      return { id: text_(r.ID), title: text_(r.Title), place: text_(r.Place), date: text_(r.Date), mood: text_(r.Mood), story: String(r.Story || ""), photo: text_(r.Photo) };
    }),
    bucket: table_("Bucket list").filter(function (r) { return text_(r.ID) && text_(r.Item); }).map(function (r) {
      return { id: text_(r.ID), item: text_(r.Item), done: /^(y|yes|true|1)/i.test(text_(r.Done)) };
    }),
    dreams: table_("Dream places").filter(function (r) { return text_(r.ID) && text_(r.Place); }).map(function (r) {
      return { id: text_(r.ID), place: text_(r.Place) };
    })
  };
}

/* ---------- helpers ---------- */
function ss_() { return SpreadsheetApp.getActiveSpreadsheet(); }
function sheet_(name) {
  const sh = ss_().getSheetByName(name);
  if (!sh) throw new Error('Missing sheet "' + name + '". Run setup() once.');
  return sh;
}
function key_(s) { return text_(s).toLowerCase().replace(/\s*\(.*\)/, ""); }
function text_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, ss_().getSpreadsheetTimeZone(), "yyyy-MM-dd");
  return String(v == null ? "" : v).trim();
}
function table_(name) {
  const v = sheet_(name).getDataRange().getValues();
  const head = v.shift().map(String);
  return v.map(function (r) { const o = {}; head.forEach(function (h, i) { o[h] = r[i]; }); return o; });
}
function rowOf_(name, id) {
  const sh = sheet_(name), n = sh.getLastRow();
  if (n < 2) return 0;
  const ids = sh.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) { if (text_(ids[i][0]) === String(id)) return i + 2; }
  return 0;
}
function deleteRow_(name, id) {
  const n = rowOf_(name, id);
  if (!n) throw new Error("That one no longer exists.");
  sheet_(name).deleteRow(n);
  return true;
}
function setSetting_(label, value) {
  const sh = sheet_("Settings"), v = sh.getDataRange().getValues(), val = String(value == null ? "" : value).trim();
  for (let i = 1; i < v.length; i++) {
    if (key_(v[i][0]) === label.toLowerCase()) { sh.getRange(i + 1, 2).setValue(val); return; }
  }
  sh.appendRow([label, val]);
}
function folder_() {
  const props = PropertiesService.getScriptProperties();
  const id = props.getProperty("PHOTO_FOLDER");
  if (id) { try { return DriveApp.getFolderById(id); } catch (_) {} }
  const f = DriveApp.createFolder("Our Travel Book photos");
  props.setProperty("PHOTO_FOLDER", f.getId());
  return f;
}

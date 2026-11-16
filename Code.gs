/**
 * OpenPages Health Check - booking backend (Google Apps Script, bound to a Google Sheet).
 * Bookings are stored in the sheet tab "Bookings". See README.md for setup.
 */
var CONFIG = {
  TZ: 'America/Toronto',
  DAYS: ['2026-12-08', '2026-12-09'],
  START_HOUR: 9,
  END_HOUR: 17,
  SLOT_MIN: 25,
  STEP_MIN: 30,
  LUNCH_START: 12,
  LUNCH_END: 13,
  PERSONAS: ['Compliance / Regulatory', 'Operational Risk', 'Internal Audit',
             'Business line / First line', 'Technology / Platform owner',
             'Executive / Senior leader', 'Other'],
  SHEET: 'Bookings'
};
var EMAIL_RE = /^[^@\s]{1,64}@[^@\s]{1,255}\.[^@\s]{2,}$/;

function pad_(n) { return (n < 10 ? '0' : '') + n; }

function allSlots_() {
  var out = [];
  CONFIG.DAYS.forEach(function (day) {
    for (var m = CONFIG.START_HOUR * 60; m + CONFIG.SLOT_MIN <= CONFIG.END_HOUR * 60; m += CONFIG.STEP_MIN) {
      var h = Math.floor(m / 60);
      if (h >= CONFIG.LUNCH_START && h < CONFIG.LUNCH_END) continue;
      out.push(day + 'T' + pad_(h) + ':' + pad_(m % 60));
    }
  });
  return out;
}

function slotDate_(id) {
  return Utilities.parseDate(id, CONFIG.TZ, "yyyy-MM-dd'T'HH:mm");
}

function sheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sh = ss.getSheetByName(CONFIG.SHEET);
  if (!sh) {
    sh = ss.insertSheet(CONFIG.SHEET);
    sh.appendRow(['Created', 'Slot (ET)', 'Name', 'Email', 'Group', 'Senior', 'Notes']);
    sh.setFrozenRows(1);
  }
  return sh;
}

// Slot ids are in column B. Stored as plain text (see safe_), so they compare as strings.
function takenSlots_() {
  var sh = sheet_(), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 2, last - 1, 1).getValues().map(function (r) { return String(r[0]); });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// Prevent spreadsheet formula injection and force text storage.
function safe_(v) {
  v = String(v);
  return /^[=+\-@\t\r]/.test(v) ? "'" + v : v;
}

function doGet() {
  var taken = takenSlots_();
  var now = new Date();
  var slots = allSlots_().map(function (id) {
    var d = slotDate_(id);
    return {
      id: id,
      day: Utilities.formatDate(d, CONFIG.TZ, 'EEEE, MMMM d'),
      label: Utilities.formatDate(d, CONFIG.TZ, 'h:mm a'),
      available: taken.indexOf(id) === -1 && d > now
    };
  });
  return json_({ personas: CONFIG.PERSONAS, slots: slots });
}

function doPost(e) {
  var p;
  try {
    if (e.postData.contents.length > 10000) throw new Error('too large');
    p = JSON.parse(e.postData.contents);
  } catch (err) {
    return json_({ ok: false, error: 'Invalid request.' });
  }
  var name = String(p.name || '').trim();
  var email = String(p.email || '').trim();
  var persona = String(p.persona || '');
  var notes = String(p.notes || '').trim();
  var slot = String(p.slot || '');

  if (name.length < 1 || name.length > 100 || !EMAIL_RE.test(email) || email.length > 254) {
    return json_({ ok: false, error: 'Please enter a valid name and email.' });
  }
  if (CONFIG.PERSONAS.indexOf(persona) === -1 || notes.length > 500) {
    return json_({ ok: false, error: 'Invalid group or notes too long.' });
  }
  if (allSlots_().indexOf(slot) === -1 || slotDate_(slot) <= new Date()) {
    return json_({ ok: false, error: 'That time slot is not available.' });
  }

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = sheet_();
    if (takenSlots_().indexOf(slot) !== -1) {
      return json_({ ok: false, error: 'Sorry, that slot was just taken. Please pick another.' });
    }
    var last = sh.getLastRow();
    var emails = last < 2 ? [] : sh.getRange(2, 4, last - 1, 1).getValues()
      .map(function (r) { return String(r[0]).toLowerCase(); });
    if (emails.indexOf(email.toLowerCase()) !== -1) {
      return json_({ ok: false, error: 'You already have a booking with this email.' });
    }
    var row = sh.getLastRow() + 1;
    sh.getRange(row, 1, 1, 7).setNumberFormat('@').setValues([[
      new Date().toISOString(), slot, safe_(name), safe_(email), persona, p.senior ? 'Yes' : '', safe_(notes)
    ]]);
    SpreadsheetApp.flush();
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

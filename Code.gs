/**
 * OpenPages Health Check - booking backend (Google Apps Script web app).
 * Bookings are stored as items on a monday.com board. The monday API token lives in
 * Script Properties (key MONDAY_TOKEN), never in the page or this file. See README.md.
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
  BOARD_ID: 18441012480,
  COL: { slot: 'text_mm9abnjp', email: 'email_mm9ajq84', group: 'text_mm9agxd5',
         senior: 'boolean_mm9a7d2e', notes: 'long_text_mm9apefk' }
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

function monday_(query, variables) {
  var token = PropertiesService.getScriptProperties().getProperty('MONDAY_TOKEN');
  if (!token) throw new Error('MONDAY_TOKEN not set');
  var res = UrlFetchApp.fetch('https://api.monday.com/v2', {
    method: 'post',
    contentType: 'application/json',
    headers: { Authorization: token, 'API-Version': '2025-10' },
    payload: JSON.stringify({ query: query, variables: variables || {} }),
    muteHttpExceptions: true
  });
  var body = JSON.parse(res.getContentText());
  if (res.getResponseCode() !== 200 || body.errors) throw new Error('monday API error');
  return body.data;
}

// Returns [{slot, email}] for every booking on the board.
function bookings_() {
  var d = monday_('query($b:[ID!]){boards(ids:$b){items_page(limit:500){items{column_values(ids:["' +
    CONFIG.COL.slot + '","' + CONFIG.COL.email + '"]){id text}}}}}', { b: [String(CONFIG.BOARD_ID)] });
  return d.boards[0].items_page.items.map(function (it) {
    var o = { slot: '', email: '' };
    it.column_values.forEach(function (c) {
      if (c.id === CONFIG.COL.slot) o.slot = String(c.text || '');
      if (c.id === CONFIG.COL.email) o.email = String(c.text || '').toLowerCase();
    });
    return o;
  });
}

function json_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

function doGet() {
  var taken;
  try { taken = bookings_().map(function (b) { return b.slot; }); }
  catch (err) { return json_({ ok: false, error: 'Booking service unavailable.' }); }
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
    var existing = bookings_();
    if (existing.some(function (b) { return b.slot === slot; })) {
      return json_({ ok: false, error: 'Sorry, that slot was just taken. Please pick another.' });
    }
    if (existing.some(function (b) { return b.email === email.toLowerCase(); })) {
      return json_({ ok: false, error: 'You already have a booking with this email.' });
    }
    var cols = {};
    cols[CONFIG.COL.slot] = slot;
    cols[CONFIG.COL.email] = { email: email, text: email };
    cols[CONFIG.COL.group] = persona;
    if (p.senior) cols[CONFIG.COL.senior] = { checked: 'true' };
    if (notes) cols[CONFIG.COL.notes] = { text: notes };
    monday_('mutation($b:ID!,$n:String!,$c:JSON!){create_item(board_id:$b,item_name:$n,column_values:$c){id}}',
      { b: String(CONFIG.BOARD_ID), n: name, c: JSON.stringify(cols) });
  } catch (err) {
    return json_({ ok: false, error: 'Could not save your booking. Please try again.' });
  } finally {
    lock.releaseLock();
  }
  return json_({ ok: true });
}

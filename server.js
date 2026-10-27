// ─── server.js ────────────────────────────────────────────────────────────────
// KAM CONNECT — Express REST API
// Serves: static index.html  +  /api/* routes
// ──────────────────────────────────────────────────────────────────────────────
'use strict';

const express = require('express');
const cors    = require('cors');
const path    = require('path');
const db      = require('./db');

const PORT = process.env.PORT || 3000;
const app  = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname)));   // serves index.html

// ── tiny id generator ─────────────────────────────────────────────────────────
const uid = (prefix = '') => prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

// ═════════════════════════════════════════════════════════════════════════════
//  AUTH  /api/auth/*
// =════════════════════════════════════════════════════════════════════════════

// POST /api/auth/send-otp  { phone }
app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone || String(phone).replace(/\D/g, '').length < 10)
    return res.status(400).json({ ok: false, error: 'Invalid phone number' });
  // In demo mode we always succeed (no real SMS)
  res.json({ ok: true, message: 'OTP sent (demo: use 123456)' });
});

// POST /api/auth/verify-otp  { phone, otp }
// Returns a session object (in production this would be a signed JWT/session token)
app.post('/api/auth/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  if (otp !== '123456')
    return res.status(401).json({ ok: false, error: 'Invalid OTP' });

  let user = db.get('SELECT * FROM users WHERE phone = ?', [phone]);
  if (!user) {
    const id = uid('u');
    db.run('INSERT INTO users(id,name,phone,role) VALUES(?,?,?,?)',
      [id, 'New User', phone, 'customer']);
    user = db.get('SELECT * FROM users WHERE id = ?', [id]);
  }
  res.json({ ok: true, user });
});

// POST /api/auth/demo-login  { role }
app.post('/api/auth/demo-login', (req, res) => {
  const { role } = req.body;
  const allowed = ['customer', 'worker', 'employer', 'admin'];
  if (!allowed.includes(role))
    return res.status(400).json({ ok: false, error: 'Invalid role' });

  const user = db.get('SELECT * FROM users WHERE id = ?', [`demo_${role}`]);
  if (!user) return res.status(404).json({ ok: false, error: 'Demo user not found' });
  res.json({ ok: true, user });
});

// ═════════════════════════════════════════════════════════════════════════════
//  WORKERS  /api/workers/*
// =════════════════════════════════════════════════════════════════════════════

// GET /api/workers?cat=&q=&av=&cy=
app.get('/api/workers', (req, res) => {
  try {
    const { cat, q, av, cy } = req.query;
    let sql  = 'SELECT * FROM workers WHERE 1=1';
    const p  = [];
    if (cat) { sql += ' AND cat = ?'; p.push(cat); }
    if (av === '1') { sql += ' AND av = 1'; }
    if (cy)  { sql += ' AND cy LIKE ?'; p.push(`%${cy}%`); }
    if (q) {
      sql += ' AND (nm LIKE ? OR sk LIKE ? OR cy LIKE ?)';
      p.push(`%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY rt DESC';
    const rows = db.all(sql, p).map(db.parseWorker);
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/workers/:id
app.get('/api/workers/:id', (req, res) => {
  try {
    const w = db.parseWorker(db.get('SELECT * FROM workers WHERE id = ?', [req.params.id]));
    if (!w) return res.status(404).json({ ok: false, error: 'Worker not found' });
    res.json({ ok: true, data: w });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PUT /api/workers/:id  — create or update worker profile
app.put('/api/workers/:id', (req, res) => {
  try {
    const { id } = req.params;
    const d = req.body;
    const existing = db.get('SELECT id FROM workers WHERE id = ?', [id]);
    if (existing) {
      db.run(`UPDATE workers SET nm=?,cat=?,em=?,sk=?,ex=?,cy=?,lo=?,ar=?,la=?,bi=?,wg=?,wu=?,av=?,ph=?,wa=?
              WHERE id=?`,
        [d.nm,d.cat,d.em||'👷',JSON.stringify(d.sk||[]),d.ex||0,d.cy,d.lo,d.ar,
         JSON.stringify(d.la||[]),d.bi,d.wg||0,d.wu||'per day',d.av?1:0,d.ph||'',d.wa?1:0,id]);
    } else {
      db.run(`INSERT INTO workers(id,nm,cat,em,sk,ex,cy,lo,ar,la,bi,wg,wu,av,ph,wa)
              VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id,d.nm,d.cat,d.em||'👷',JSON.stringify(d.sk||[]),d.ex||0,d.cy,d.lo,d.ar,
         JSON.stringify(d.la||[]),d.bi,d.wg||0,d.wu||'per day',d.av?1:0,d.ph||'',d.wa?1:0]);
    }
    const updated = db.parseWorker(db.get('SELECT * FROM workers WHERE id = ?', [id]));
    res.json({ ok: true, data: updated });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
//  JOBS  /api/jobs/*
// =════════════════════════════════════════════════════════════════════════════

// GET /api/jobs?cat=&ty=&cy=&q=
app.get('/api/jobs', (req, res) => {
  try {
    const { cat, ty, cy, q } = req.query;
    let sql = 'SELECT * FROM jobs WHERE op = 1';
    const p = [];
    if (cat) { sql += ' AND cat = ?'; p.push(cat); }
    if (ty)  { sql += ' AND ty = ?';  p.push(ty);  }
    if (cy)  { sql += ' AND cy LIKE ?'; p.push(`%${cy}%`); }
    if (q) {
      sql += ' AND (ti LIKE ? OR co LIKE ? OR cat LIKE ? OR sk LIKE ?)';
      p.push(`%${q}%`, `%${q}%`, `%${q}%`, `%${q}%`);
    }
    sql += ' ORDER BY created DESC';
    const rows = db.all(sql, p).map(db.parseJob);
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// GET /api/jobs/:id
app.get('/api/jobs/:id', (req, res) => {
  try {
    const j = db.parseJob(db.get('SELECT * FROM jobs WHERE id = ?', [req.params.id]));
    if (!j) return res.status(404).json({ ok: false, error: 'Job not found' });
    res.json({ ok: true, data: j });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/jobs  — create job
app.post('/api/jobs', (req, res) => {
  try {
    const d = req.body;
    if (!d.ti || !d.cat) return res.status(400).json({ ok: false, error: 'Title and category are required' });
    const id = uid('j');
    db.run(`INSERT INTO jobs(id,ti,co,ce,cat,ty,cy,lo,sk,wn,wmi,wma,fr,de,hr,dl,ap,po,op,ph,eid)
            VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id, d.ti, d.co||'My Company', d.ce||'🏢', d.cat, d.ty||'Full-time',
       d.cy||'Pune', d.lo||'', JSON.stringify(d.sk||[]),
       d.wn||1, d.wmi||0, d.wma||0, d.fr||'Per Day',
       d.de||'', d.hr||'', d.dl||'', 0, 'Just now', 1, d.ph||'', d.eid||null]);
    const job = db.parseJob(db.get('SELECT * FROM jobs WHERE id = ?', [id]));
    res.status(201).json({ ok: true, data: job });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PUT /api/jobs/:id  — update job
app.put('/api/jobs/:id', (req, res) => {
  try {
    const { id } = req.params;
    const d = req.body;
    const existing = db.get('SELECT id FROM jobs WHERE id = ?', [id]);
    if (!existing) return res.status(404).json({ ok: false, error: 'Job not found' });
    db.run(`UPDATE jobs SET ti=?,co=?,ce=?,cat=?,ty=?,cy=?,lo=?,sk=?,wn=?,wmi=?,wma=?,fr=?,de=?,hr=?,dl=?,ph=?
            WHERE id=?`,
      [d.ti, d.co, d.ce||'🏢', d.cat, d.ty||'Full-time',
       d.cy||'Pune', d.lo||'', JSON.stringify(d.sk||[]),
       d.wn||1, d.wmi||0, d.wma||0, d.fr||'Per Day',
       d.de||'', d.hr||'', d.dl||'', d.ph||'', id]);
    const job = db.parseJob(db.get('SELECT * FROM jobs WHERE id = ?', [id]));
    res.json({ ok: true, data: job });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PATCH /api/jobs/:id/close
app.patch('/api/jobs/:id/close', (req, res) => {
  try {
    db.run('UPDATE jobs SET op = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
//  APPLICATIONS  /api/applications/*
// =════════════════════════════════════════════════════════════════════════════

// GET /api/applications?uid=&jid=
app.get('/api/applications', (req, res) => {
  try {
    const { uid: userId, jid } = req.query;
    let sql = 'SELECT * FROM applications WHERE 1=1';
    const p = [];
    if (userId) { sql += ' AND wid = ?'; p.push(userId); }
    if (jid)    { sql += ' AND ji = ?';  p.push(jid); }
    sql += ' ORDER BY dt DESC';
    res.json({ ok: true, data: db.all(sql, p) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/applications
app.post('/api/applications', (req, res) => {
  try {
    const d = req.body;
    if (!d.ji) return res.status(400).json({ ok: false, error: 'Job ID required' });
    // Prevent duplicate
    const dup = db.get('SELECT id FROM applications WHERE ji = ? AND wid = ?', [d.ji, d.wid || '']);
    if (dup) return res.status(409).json({ ok: false, error: 'Already applied' });
    const id = uid('ap');
    db.run('INSERT INTO applications(id,ji,jt,co,wid,wn,st,nt,dt) VALUES(?,?,?,?,?,?,?,?,?)',
      [id, d.ji, d.jt||'', d.co||'', d.wid||null, d.wn||'', 'Submitted', d.nt||'',
       new Date().toLocaleDateString()]);
    // Increment job application counter
    db.run('UPDATE jobs SET ap = ap + 1 WHERE id = ?', [d.ji]);
    const app_ = db.get('SELECT * FROM applications WHERE id = ?', [id]);
    res.status(201).json({ ok: true, data: app_ });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PATCH /api/applications/:id  { st, nt }
app.patch('/api/applications/:id', (req, res) => {
  try {
    const { st, nt } = req.body;
    const existing = db.get('SELECT id FROM applications WHERE id = ?', [req.params.id]);
    if (!existing) return res.status(404).json({ ok: false, error: 'Application not found' });
    if (st) db.run('UPDATE applications SET st = ? WHERE id = ?', [st, req.params.id]);
    if (nt !== undefined) db.run('UPDATE applications SET nt = ? WHERE id = ?', [nt, req.params.id]);
    const updated = db.get('SELECT * FROM applications WHERE id = ?', [req.params.id]);
    res.json({ ok: true, data: updated });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
//  REVIEWS  /api/reviews/*
// =════════════════════════════════════════════════════════════════════════════

// GET /api/reviews?tid=
app.get('/api/reviews', (req, res) => {
  try {
    const { tid } = req.query;
    if (!tid) return res.status(400).json({ ok: false, error: 'tid required' });
    const rows = db.all('SELECT * FROM reviews WHERE tid = ? ORDER BY dt DESC', [tid]);
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/reviews
app.post('/api/reviews', (req, res) => {
  try {
    const d = req.body;
    if (!d.tid || !d.cm) return res.status(400).json({ ok: false, error: 'tid and cm required' });
    const id = uid('rv');
    const dt = new Date().toLocaleDateString();
    db.run('INSERT INTO reviews(id,tid,rn,rt,cm,dt,uid) VALUES(?,?,?,?,?,?,?)',
      [id, d.tid, d.rn||'Anonymous', d.rt||5, d.cm, dt, d.uid||null]);
    // Recalculate average rating for worker
    const stats = db.get('SELECT COUNT(*) as cnt, AVG(rt) as avg FROM reviews WHERE tid = ?', [d.tid]);
    if (stats && stats.cnt) {
      db.run('UPDATE workers SET rt = ?, rv = ? WHERE id = ?',
        [Math.round(stats.avg * 10) / 10, stats.cnt, d.tid]);
    }
    const review = db.get('SELECT * FROM reviews WHERE id = ?', [id]);
    res.status(201).json({ ok: true, data: review });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// DELETE /api/reviews/:id  (admin)
app.delete('/api/reviews/:id', (req, res) => {
  try {
    db.run('DELETE FROM reviews WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS  /api/notifications/*
// =════════════════════════════════════════════════════════════════════════════

// GET /api/notifications?uid=
app.get('/api/notifications', (req, res) => {
  try {
    const { uid: userId } = req.query;
    if (!userId) return res.status(400).json({ ok: false, error: 'uid required' });
    const rows = db.all(
      'SELECT * FROM notifications WHERE uid = ? ORDER BY created DESC LIMIT 50', [userId]);
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/notifications  (internal: create one)
app.post('/api/notifications', (req, res) => {
  try {
    const d = req.body;
    if (!d.uid || !d.ti) return res.status(400).json({ ok: false, error: 'uid and ti required' });
    const id = uid('n');
    db.run('INSERT INTO notifications(id,uid,ic,bg,ti,tx,tm,ur,tp,kid) VALUES(?,?,?,?,?,?,?,?,?,?)',
      [id, d.uid, d.ic||'🔔', d.bg||'rgba(64,202,215,.15)',
       d.ti, d.tx||'', d.tm||'Just now', 1, d.tp||'', d.kid||'']);
    res.status(201).json({ ok: true, id });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PATCH /api/notifications/read-all?uid=
app.patch('/api/notifications/read-all', (req, res) => {
  try {
    const { uid: userId } = req.query;
    if (!userId) return res.status(400).json({ ok: false, error: 'uid required' });
    db.run('UPDATE notifications SET ur = 0 WHERE uid = ?', [userId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PATCH /api/notifications/:id/read
app.patch('/api/notifications/:id/read', (req, res) => {
  try {
    db.run('UPDATE notifications SET ur = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
//  MESSAGES  /api/messages/*
// =════════════════════════════════════════════════════════════════════════════

// GET /api/messages?cid=
app.get('/api/messages', (req, res) => {
  try {
    const { cid } = req.query;
    if (!cid) return res.status(400).json({ ok: false, error: 'cid required' });
    const rows = db.all('SELECT * FROM messages WHERE cid = ? ORDER BY id ASC', [cid]);
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/messages
app.post('/api/messages', (req, res) => {
  try {
    const { cid, frm, tx, uid: userId } = req.body;
    if (!cid || !tx) return res.status(400).json({ ok: false, error: 'cid and tx required' });
    const id = uid('m');
    const tm = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    db.run('INSERT INTO messages(id,cid,frm,tx,tm,uid) VALUES(?,?,?,?,?,?)',
      [id, cid, frm||'me', tx, tm, userId||null]);
    res.status(201).json({ ok: true, data: { id, cid, frm: frm||'me', tx, tm } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
//  FAVORITES  /api/favorites/*
// =════════════════════════════════════════════════════════════════════════════

// GET /api/favorites?uid=
app.get('/api/favorites', (req, res) => {
  try {
    const { uid: userId } = req.query;
    if (!userId) return res.status(400).json({ ok: false, error: 'uid required' });
    const rows = db.all('SELECT fid FROM favorites WHERE uid = ?', [userId]);
    res.json({ ok: true, data: rows.map(r => r.fid) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/favorites  { uid, fid }
app.post('/api/favorites', (req, res) => {
  try {
    const { uid: userId, fid } = req.body;
    if (!userId || !fid) return res.status(400).json({ ok: false, error: 'uid and fid required' });
    const exists = db.get('SELECT 1 FROM favorites WHERE uid=? AND fid=?', [userId, fid]);
    if (exists) {
      db.run('DELETE FROM favorites WHERE uid=? AND fid=?', [userId, fid]);
      return res.json({ ok: true, action: 'removed' });
    }
    db.run('INSERT INTO favorites(uid,fid) VALUES(?,?)', [userId, fid]);
    res.json({ ok: true, action: 'added' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
//  REPORTS  /api/reports/*
// =════════════════════════════════════════════════════════════════════════════

// GET /api/reports  (admin)
app.get('/api/reports', (req, res) => {
  try {
    const rows = db.all('SELECT * FROM reports ORDER BY created DESC');
    res.json({ ok: true, data: rows });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// POST /api/reports
app.post('/api/reports', (req, res) => {
  try {
    const { rs, dt, tgt, uid: userId } = req.body;
    const id = uid('rpt');
    db.run('INSERT INTO reports(id,rs,dt,tgt,uid) VALUES(?,?,?,?,?)',
      [id, rs||'Other', dt||'', tgt||'', userId||null]);
    res.status(201).json({ ok: true, id });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// DELETE /api/reports/:id (admin dismiss)
app.delete('/api/reports/:id', (req, res) => {
  try {
    db.run('DELETE FROM reports WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
//  ADMIN  /api/admin/*
// =════════════════════════════════════════════════════════════════════════════

// GET /api/admin/stats
app.get('/api/admin/stats', (req, res) => {
  try {
    const workers = db.get('SELECT COUNT(*) AS cnt FROM workers');
    const jobs    = db.get('SELECT COUNT(*) AS cnt FROM jobs WHERE op=1');
    const apps    = db.get('SELECT COUNT(*) AS cnt FROM applications');
    const reports = db.get('SELECT COUNT(*) AS cnt FROM reports');
    res.json({ ok: true, data: {
      workers: workers.cnt, jobs: jobs.cnt, applications: apps.cnt, reports: reports.cnt
    }});
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PATCH /api/admin/workers/:id/verify
app.patch('/api/admin/workers/:id/verify', (req, res) => {
  try {
    db.run('UPDATE workers SET vr = 1 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// PATCH /api/admin/workers/:id/ban
app.patch('/api/admin/workers/:id/ban', (req, res) => {
  try {
    db.run('UPDATE workers SET av = 0 WHERE id = ?', [req.params.id]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
//  SEARCH  /api/search?q=
// =════════════════════════════════════════════════════════════════════════════

app.get('/api/search', (req, res) => {
  try {
    const { q = '', type = 'all' } = req.query;
    const like = `%${q}%`;
    let workers = [], jobs = [];
    if (q && (type === 'all' || type === 'workers')) {
      workers = db.all(
        'SELECT * FROM workers WHERE nm LIKE ? OR cat LIKE ? OR sk LIKE ? OR cy LIKE ?',
        [like, like, like, like]
      ).map(db.parseWorker);
    }
    if (q && (type === 'all' || type === 'jobs')) {
      jobs = db.all(
        'SELECT * FROM jobs WHERE op=1 AND (ti LIKE ? OR co LIKE ? OR cat LIKE ? OR sk LIKE ? OR cy LIKE ?)',
        [like, like, like, like, like]
      ).map(db.parseJob);
    }
    res.json({ ok: true, data: { workers, jobs } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═════════════════════════════════════════════════════════════════════════════
//  AI CHATBOT  /api/ai/chat
// Smart rule-based assistant with live data from DB — no API key needed
// =════════════════════════════════════════════════════════════════════════════

app.post('/api/ai/chat', (req, res) => {
  try {
    const { message = '', history = [] } = req.body;
    if (!message.trim()) return res.status(400).json({ ok: false, error: 'Empty message' });

    const msg = message.toLowerCase().trim();
    const workers = db.all('SELECT * FROM workers').map(db.parseWorker);
    const jobs    = db.all('SELECT * FROM jobs WHERE op=1').map(db.parseJob);
    const stats   = {
      workers: workers.length,
      jobs:    jobs.length,
      apps:    db.get('SELECT COUNT(*) AS cnt FROM applications').cnt,
    };

    // ── Helpers ─────────────────────────────────────────────────
    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const fmt  = w => `**${w.nm}** (${w.cat}, ${w.cy}) — ₹${w.wg}/${w.wu.replace('per ','')} · ⭐${w.rt}`;
    const fmtJ = j => `**${j.ti}** at ${j.co} (${j.cy}) — ₹${j.wmi}–₹${j.wma} ${j.fr}`;

    // ── Category worker finder ───────────────────────────────────
    const findWorkers = (cat, emoji) => {
      const found = workers.filter(w => w.cat === cat && w.av);
      return found.length
        ? `${emoji} Found **${found.length} available ${cat.toLowerCase()} workers**:\n\n${found.slice(0,3).map(fmt).join('\n')}\n\nTap a worker card to view profile & contact details.`
        : `No available ${cat.toLowerCase()} workers right now. Try browsing all workers in the Services tab.`;
    };

    let reply = '';

    // ── Greetings ────────────────────────────────────────────────
    if (/^(hi|hello|hey|namaste|hii|howdy|yo|sup|hola)\b/.test(msg)) {
      reply = pick([
        `Hello! 👋 I'm **Kam AI**, your assistant on Kam Connect. I can help you find workers, browse jobs, check stats, or answer questions about anything. What would you like to do?`,
        `Hey there! 😊 I'm here to help you with Kam Connect. Try asking me to find a plumber, show jobs in Pune, or just ask me anything!`,
        `Namaste! 🙏 I'm **Kam AI**. I have live data on **${stats.workers} workers** and **${stats.jobs} active jobs**. How can I assist you today?`,
      ]);
    }

    // ── Find workers by category ─────────────────────────────────
    else if (/plumb/i.test(msg) && /find|need|want|show|get|hire|looking|chahiye|dhundh/i.test(msg)) {
      reply = findWorkers('Plumbing', '🔧');
    }
    else if (/electr/i.test(msg) && /find|need|want|show|get|hire|looking/i.test(msg)) {
      reply = findWorkers('Electrical', '⚡');
    }
    else if (/clean/i.test(msg) && /find|need|want|show|get|hire|looking/i.test(msg)) {
      reply = findWorkers('Cleaning', '🧹');
    }
    else if (/paint/i.test(msg) && /find|need|want|show|get|hire|looking/i.test(msg)) {
      reply = findWorkers('Painting', '🖌️');
    }
    else if (/carpenter|carpent|furniture/i.test(msg) && /find|need|want|show|get|hire|looking/i.test(msg)) {
      reply = findWorkers('Carpentry', '🪚');
    }
    else if (/mechanic|bike.*repair|car.*repair/i.test(msg) && /find|need|want|show|get|hire|looking/i.test(msg)) {
      reply = findWorkers('Mechanic', '🔩');
    }
    else if (/deliver/i.test(msg) && /find|need|want|show|get|hire|looking/i.test(msg)) {
      reply = findWorkers('Delivery', '🚚');
    }
    else if (/garden|lawn|plant/i.test(msg) && /find|need|want|show|get|hire|looking/i.test(msg)) {
      reply = findWorkers('Gardening', '🌿');
    }

    // ── Jobs ─────────────────────────────────────────────────────
    else if (/show.*job|list.*job|job.*list|latest job|new job|available job|kaam dhundh|naukri/i.test(msg)) {
      reply = `💼 **${jobs.length} active jobs** right now:\n\n${jobs.slice(0,4).map(fmtJ).join('\n')}\n\nGo to the **Jobs** tab to apply!`;
    }
    else if (/job.*(pune)|pune.*job/i.test(msg)) {
      const found = jobs.filter(j => j.cy.toLowerCase().includes('pune'));
      reply = found.length ? `📍 **${found.length} jobs in Pune**:\n\n${found.slice(0,4).map(fmtJ).join('\n')}` : `No jobs found in Pune right now.`;
    }
    else if (/job.*(mumbai)|mumbai.*job/i.test(msg)) {
      const found = jobs.filter(j => j.cy.toLowerCase().includes('mumbai'));
      reply = found.length ? `📍 **${found.length} jobs in Mumbai**:\n\n${found.slice(0,4).map(fmtJ).join('\n')}` : `No jobs found in Mumbai right now.`;
    }
    else if (/full.?time/i.test(msg)) {
      const found = jobs.filter(j => j.ty === 'Full-time');
      reply = found.length ? `👔 **${found.length} full-time jobs**:\n\n${found.slice(0,3).map(fmtJ).join('\n')}` : `No full-time jobs available right now.`;
    }
    else if (/part.?time/i.test(msg)) {
      const found = jobs.filter(j => j.ty === 'Part-time');
      reply = found.length ? `⏱ **${found.length} part-time jobs**:\n\n${found.slice(0,3).map(fmtJ).join('\n')}` : `No part-time jobs right now.`;
    }
    else if (/daily.?wage/i.test(msg)) {
      const found = jobs.filter(j => j.ty === 'Daily Wage');
      reply = found.length ? `📅 **${found.length} daily wage jobs**:\n\n${found.slice(0,3).map(fmtJ).join('\n')}` : `No daily wage jobs right now.`;
    }
    else if (/how.*apply|apply.*job/i.test(msg)) {
      reply = `To apply for a job:\n\n1. Go to the **Jobs** tab\n2. Tap any job card to open it\n3. Tap **Apply Now**\n4. Add a cover note (optional)\n5. Hit **Submit Application** ✅\n\nYou'll receive a notification when the employer reviews your application!`;
    }
    else if (/post.*job|create.*job/i.test(msg)) {
      reply = `To post a job:\n\n1. Tap **+ Post Job** (Employer mode)\n2. Fill in title, category, description and wage\n3. Hit **Publish** ✅\n\nYour job will instantly be visible to workers!`;
    }

    // ── Workers general ──────────────────────────────────────────
    else if (/show.*worker|list.*worker|worker.*near|best worker|top worker/i.test(msg)) {
      const top = [...workers].sort((a,b) => b.rt - a.rt).slice(0, 4);
      reply = `⭐ **Top-rated workers** on Kam Connect:\n\n${top.map(fmt).join('\n')}`;
    }
    else if (/available.*worker|worker.*available/i.test(msg)) {
      const avail = workers.filter(w => w.av);
      reply = `✅ **${avail.length} workers available** right now:\n\n${avail.slice(0,4).map(fmt).join('\n')}`;
    }
    else if (/how.*create.*profile|worker.*profile|create.*profile/i.test(msg)) {
      reply = `To create your worker profile:\n\n1. Go to **Profile** tab\n2. Switch role to **Worker**\n3. Tap **Create Profile**\n4. Fill your name, skills, category, wage, and city\n5. Save ✓\n\nEmployers will then be able to find and contact you!`;
    }

    // ── Stats ────────────────────────────────────────────────────
    else if (/stat|how many|count|total|number of/i.test(msg)) {
      const avail = workers.filter(w => w.av).length;
      const cats  = [...new Set(workers.map(w => w.cat))].join(', ');
      reply = `📊 **Kam Connect Live Stats:**\n\n👷 **${stats.workers}** total workers (${avail} available)\n💼 **${stats.jobs}** active jobs\n📋 **${stats.apps}** applications submitted\n\n**Categories:** ${cats}`;
    }

    // ── Pricing / wages ──────────────────────────────────────────
    else if (/cost|price|wage|rate|salary|pay|charge|fee/i.test(msg)) {
      const avgWage = Math.round(workers.reduce((s,w)=>s+w.wg,0)/workers.length);
      const minWage = Math.min(...workers.map(w=>w.wg));
      const maxWage = Math.max(...workers.map(w=>w.wg));
      reply = `💰 **Worker wage rates on Kam Connect:**\n\n📉 Minimum: ₹${minWage}/day\n📈 Maximum: ₹${maxWage}/day\n📊 Average: ₹${avgWage}/day\n\nRates vary by category & experience. Verified workers typically charge more for guaranteed quality!`;
    }

    // ── Verification ─────────────────────────────────────────────
    else if (/verif/i.test(msg)) {
      const verified = workers.filter(w => w.vr).length;
      reply = `✓ **Verified workers** are reviewed & approved by our admin team. Currently **${verified} out of ${workers.length}** workers are verified.\n\nLook for the ✓ Verified badge on worker profiles!`;
    }

    // ── Help / features ──────────────────────────────────────────
    else if (/help|what can you do|feature|option|command/i.test(msg)) {
      reply = `I can help you with:\n\n🔍 **Find workers** — "Find a plumber in Pune"\n💼 **Browse jobs** — "Show jobs in Mumbai"\n📊 **Platform stats** — "How many workers are there?"\n💰 **Wage info** — "What are the rates?"\n📋 **How-to guides** — "How do I apply for a job?"\n✅ **Availability** — "Show available workers"\n💬 **General questions** — Just ask anything!\n\nJust type naturally and I'll do my best! 😊`;
    }

    // ── About ────────────────────────────────────────────────────
    else if (/what is kam|about kam|about this app|about platform/i.test(msg)) {
      reply = `**Kam Connect** is a local services & hiring platform connecting:\n\n👷 **Workers** — plumbers, electricians, carpenters, painters, cleaners and more\n🏢 **Employers** — post jobs and hire skilled workers fast\n👤 **Customers** — find trusted local service providers with real reviews\n\nCurrently serving **${stats.workers}** workers across Pune, Mumbai, Nashik and growing! 🚀`;
    }

    // ── Thanks ───────────────────────────────────────────────────
    else if (/thank|thanks|great|awesome|nice|perfect|cool|superb|shukriya|dhanyawad/i.test(msg)) {
      reply = pick([
        `You're welcome! 😊 Is there anything else I can help you with?`,
        `Happy to help! Let me know if you need anything else. 🙌`,
        `Glad I could help! Feel free to ask anything about Kam Connect. ⚡`,
      ]);
    }

    // ── Goodbye ──────────────────────────────────────────────────
    else if (/bye|goodbye|see you|take care|ciao|alvida/i.test(msg)) {
      reply = `Goodbye! 👋 Come back whenever you need help. Have a great day! 😊`;
    }

    // ── General Knowledge fallback (built-in answers for common Qs) ──
    else if (/capital.*india|india.*capital/i.test(msg)) {
      reply = `🏛️ The capital of India is **New Delhi**.`;
    }
    else if (/capital.*maharashtra|maharashtra.*capital/i.test(msg)) {
      reply = `🏛️ The capital of Maharashtra is **Mumbai** (also the financial capital of India).`;
    }
    else if (/pm.*india|prime minister.*india|india.*prime minister/i.test(msg)) {
      reply = `🇮🇳 The Prime Minister of India is **Narendra Modi** (as of 2024).`;
    }
    else if (/population.*india|india.*population/i.test(msg)) {
      reply = `🇮🇳 India's population is approximately **1.44 billion** people, making it the **most populous country** in the world (surpassing China in 2023).`;
    }
    else if (/currency.*india|india.*currency/i.test(msg)) {
      reply = `💵 India's currency is the **Indian Rupee (₹ / INR)**. 1 USD ≈ ₹83-84 (varies with market rates).`;
    }
    else if (/time.*india|ist\b/i.test(msg)) {
      const ist = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      reply = `🕐 Current time in India (IST) is: **${ist}**\n\nIST = UTC+5:30`;
    }
    else if (/what.*time|current.*time/i.test(msg)) {
      const ist = new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' });
      reply = `🕐 Current time (IST): **${ist}**`;
    }
    else if (/today.*date|current.*date|what.*date/i.test(msg)) {
      const d = new Date().toLocaleDateString('en-IN', { weekday:'long', year:'numeric', month:'long', day:'numeric', timeZone:'Asia/Kolkata' });
      reply = `📅 Today's date is: **${d}**`;
    }
    else if (/math|calculat|what is \d|\d.*\+.*\d|\d.*\-.*\d|\d.*\*.*\d|\d.*\/.*\d/i.test(msg)) {
      // Simple math eval
      const expr = msg.match(/([\d\s\+\-\*\/\.\(\)]+)/);
      if (expr) {
        try {
          const result = Function('"use strict"; return (' + expr[1].trim() + ')')();
          reply = `🔢 **${expr[1].trim()} = ${result}**`;
        } catch {
          reply = `I couldn't calculate that. Please use format like "What is 25 + 75?" or "Calculate 100 / 4".`;
        }
      } else {
        reply = `Please ask like: "What is 25 + 75?" or "Calculate 100 / 4"`;
      }
    }
    else if (/joke/i.test(msg)) {
      const jokes = [
        `Why don't scientists trust atoms?\n\nBecause they **make up everything!** 😄`,
        `Why did the plumber go to school?\n\nBecause he wanted to **fix his pipe dreams!** 🔧😂`,
        `What do you call a lazy electrician?\n\n**A low-energy person!** ⚡😄`,
        `Why did the worker bring a ladder to work?\n\nBecause his boss said **"Aim high!"** 😂`,
      ];
      reply = pick(jokes);
    }
    else if (/tip.*hire|how.*hire.*good|hiring.*tip/i.test(msg)) {
      reply = `💡 **Tips for hiring the right worker:**\n\n✅ Check their **rating and reviews**\n✅ Prefer **Verified** workers (✓ badge)\n✅ Check their **service area** matches your location\n✅ Ask about availability before confirming\n✅ Agree on **rate and payment** upfront\n✅ Use the **WhatsApp** button to discuss details directly\n\nAll workers on Kam Connect have real profiles with contact info!`;
    }
    else if (/resume|cv|portfolio/i.test(msg)) {
      reply = `📄 **Tips for a strong worker profile on Kam Connect:**\n\n1. Add all your **skills** (comma separated)\n2. Mention your **years of experience**\n3. Write a clear **bio** describing your work\n4. Set your **service area** so employers find you\n5. Keep **availability** status updated\n6. Add your **WhatsApp number** for easy contact\n\nA complete profile gets **3x more inquiries!**`;
    }

    // ── Final fallback ────────────────────────────────────────────
    else {
      reply = pick([
        `I'm **Kam AI** and I'm here to help! I specialize in Kam Connect platform — finding workers, jobs, and more.\n\nYou asked: *"${message.slice(0,60)}${message.length>60?'…':''}"*\n\nTry asking:\n- **"Find a plumber in Pune"**\n- **"Show latest jobs"**\n- **"What are the wage rates?"**`,
        `Hmm, I'm not sure about that specific question, but I can help with:\n\n🔍 Finding workers\n💼 Browsing jobs\n💰 Wage information\n📊 Platform stats\n\nJust type **help** to see all I can do! 😊`,
      ]);
    }

    res.json({ ok: true, reply, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error('[ai]', e);
    res.status(500).json({ ok: false, error: 'AI error: ' + e.message });
  }
});

// ═════════════════════════════════════════════════════════════════════════════
//  404 fallback — always serve index.html for SPA
// =════════════════════════════════════════════════════════════════════════════
app.use((req, res) => {
  if (req.path.startsWith('/api/'))
    return res.status(404).json({ ok: false, error: 'API endpoint not found' });
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ═════════════════════════════════════════════════════════════════════════════
//  Global error handler
// =════════════════════════════════════════════════════════════════════════════
app.use((err, req, res, _next) => {
  console.error('[server error]', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

// ─── Start ────────────────────────────────────────────────────────────────────
db.init().then(() => {
  app.listen(PORT, () => {
    console.log(`\n⚡ KAM CONNECT server running at http://localhost:${PORT}\n`);
  });
}).catch(err => {
  console.error('[fatal] DB init failed:', err);
  process.exit(1);
});

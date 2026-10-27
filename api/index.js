// api/index.js — Vercel serverless entry point
// Full Express app served as a single serverless function
'use strict';

const express  = require('express');
const cors     = require('cors');
const path     = require('path');
const db       = require('../db-vercel');

const app = express();
app.use(cors());
app.use(express.json());

// Serve static files (index.html, etc.) from root
app.use(express.static(path.join(__dirname, '..')));

// ── tiny id generator ──────────────────────────────────────────────────────────
const uid = (prefix = '') => prefix + '_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);

// ── ensure DB is ready before every request ───────────────────────────────────
app.use(async (req, res, next) => {
  try { await db.ensureReady(); next(); } catch (e) { res.status(500).json({ ok: false, error: 'DB init failed: ' + e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  AUTH
// ═══════════════════════════════════════════════════════════════════════════════
app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone || String(phone).replace(/\D/g, '').length < 10)
    return res.status(400).json({ ok: false, error: 'Invalid phone number' });
  res.json({ ok: true, message: 'OTP sent (demo: use 123456)' });
});

app.post('/api/auth/verify-otp', (req, res) => {
  const { phone, otp } = req.body;
  if (otp !== '123456') return res.status(401).json({ ok: false, error: 'Invalid OTP' });
  let user = db.get('SELECT * FROM users WHERE phone = ?', [phone]);
  if (!user) {
    const id = uid('u');
    db.run('INSERT INTO users(id,name,phone,role) VALUES(?,?,?,?)', [id, 'New User', phone, 'customer']);
    user = db.get('SELECT * FROM users WHERE id = ?', [id]);
  }
  res.json({ ok: true, user });
});

app.post('/api/auth/demo-login', (req, res) => {
  const { role } = req.body;
  if (!['customer','worker','employer','admin'].includes(role))
    return res.status(400).json({ ok: false, error: 'Invalid role' });
  const user = db.get('SELECT * FROM users WHERE id = ?', [`demo_${role}`]);
  if (!user) return res.status(404).json({ ok: false, error: 'Demo user not found' });
  res.json({ ok: true, user });
});

// ═══════════════════════════════════════════════════════════════════════════════
//  WORKERS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/workers', (req, res) => {
  try {
    const { cat, q, av, cy } = req.query;
    let sql = 'SELECT * FROM workers WHERE 1=1'; const p = [];
    if (cat) { sql += ' AND cat = ?'; p.push(cat); }
    if (av === '1') sql += ' AND av = 1';
    if (cy)  { sql += ' AND cy LIKE ?'; p.push(`%${cy}%`); }
    if (q)   { sql += ' AND (nm LIKE ? OR sk LIKE ? OR cy LIKE ?)'; p.push(`%${q}%`,`%${q}%`,`%${q}%`); }
    sql += ' ORDER BY rt DESC';
    res.json({ ok: true, data: db.all(sql, p).map(db.parseWorker) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/workers/:id', (req, res) => {
  try {
    const w = db.parseWorker(db.get('SELECT * FROM workers WHERE id = ?', [req.params.id]));
    if (!w) return res.status(404).json({ ok: false, error: 'Worker not found' });
    res.json({ ok: true, data: w });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.put('/api/workers/:id', (req, res) => {
  try {
    const { id } = req.params; const d = req.body;
    const ex = db.get('SELECT id FROM workers WHERE id = ?', [id]);
    if (ex) {
      db.run(`UPDATE workers SET nm=?,cat=?,em=?,sk=?,ex=?,cy=?,lo=?,ar=?,la=?,bi=?,wg=?,wu=?,av=?,ph=?,wa=? WHERE id=?`,
        [d.nm,d.cat,d.em||'👷',JSON.stringify(d.sk||[]),d.ex||0,d.cy,d.lo,d.ar,JSON.stringify(d.la||[]),d.bi,d.wg||0,d.wu||'per day',d.av?1:0,d.ph||'',d.wa?1:0,id]);
    } else {
      db.run(`INSERT INTO workers(id,nm,cat,em,sk,ex,cy,lo,ar,la,bi,wg,wu,av,ph,wa) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [id,d.nm,d.cat,d.em||'👷',JSON.stringify(d.sk||[]),d.ex||0,d.cy,d.lo,d.ar,JSON.stringify(d.la||[]),d.bi,d.wg||0,d.wu||'per day',d.av?1:0,d.ph||'',d.wa?1:0]);
    }
    res.json({ ok: true, data: db.parseWorker(db.get('SELECT * FROM workers WHERE id = ?', [id])) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  JOBS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/jobs', (req, res) => {
  try {
    const { cat, ty, cy, q } = req.query;
    let sql = 'SELECT * FROM jobs WHERE op = 1'; const p = [];
    if (cat) { sql += ' AND cat = ?'; p.push(cat); }
    if (ty)  { sql += ' AND ty = ?';  p.push(ty);  }
    if (cy)  { sql += ' AND cy LIKE ?'; p.push(`%${cy}%`); }
    if (q)   { sql += ' AND (ti LIKE ? OR co LIKE ? OR cat LIKE ? OR sk LIKE ?)'; p.push(`%${q}%`,`%${q}%`,`%${q}%`,`%${q}%`); }
    sql += ' ORDER BY created DESC';
    res.json({ ok: true, data: db.all(sql, p).map(db.parseJob) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.get('/api/jobs/:id', (req, res) => {
  try {
    const j = db.parseJob(db.get('SELECT * FROM jobs WHERE id = ?', [req.params.id]));
    if (!j) return res.status(404).json({ ok: false, error: 'Job not found' });
    res.json({ ok: true, data: j });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/jobs', (req, res) => {
  try {
    const d = req.body;
    if (!d.ti || !d.cat) return res.status(400).json({ ok: false, error: 'Title and category required' });
    const id = uid('j');
    db.run(`INSERT INTO jobs(id,ti,co,ce,cat,ty,cy,lo,sk,wn,wmi,wma,fr,de,hr,dl,ap,po,op,ph,eid) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [id,d.ti,d.co||'My Company',d.ce||'🏢',d.cat,d.ty||'Full-time',d.cy||'Pune',d.lo||'',JSON.stringify(d.sk||[]),d.wn||1,d.wmi||0,d.wma||0,d.fr||'Per Day',d.de||'',d.hr||'',d.dl||'',0,'Just now',1,d.ph||'',d.eid||null]);
    res.status(201).json({ ok: true, data: db.parseJob(db.get('SELECT * FROM jobs WHERE id = ?', [id])) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.put('/api/jobs/:id', (req, res) => {
  try {
    const { id } = req.params; const d = req.body;
    if (!db.get('SELECT id FROM jobs WHERE id = ?', [id])) return res.status(404).json({ ok: false, error: 'Job not found' });
    db.run(`UPDATE jobs SET ti=?,co=?,ce=?,cat=?,ty=?,cy=?,lo=?,sk=?,wn=?,wmi=?,wma=?,fr=?,de=?,hr=?,dl=?,ph=? WHERE id=?`,
      [d.ti,d.co,d.ce||'🏢',d.cat,d.ty||'Full-time',d.cy||'Pune',d.lo||'',JSON.stringify(d.sk||[]),d.wn||1,d.wmi||0,d.wma||0,d.fr||'Per Day',d.de||'',d.hr||'',d.dl||'',d.ph||'',id]);
    res.json({ ok: true, data: db.parseJob(db.get('SELECT * FROM jobs WHERE id = ?', [id])) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.patch('/api/jobs/:id/close', (req, res) => {
  try { db.run('UPDATE jobs SET op = 0 WHERE id = ?', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  APPLICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/applications', (req, res) => {
  try {
    const { uid: userId, jid } = req.query;
    let sql = 'SELECT * FROM applications WHERE 1=1'; const p = [];
    if (userId) { sql += ' AND wid = ?'; p.push(userId); }
    if (jid)    { sql += ' AND ji = ?';  p.push(jid); }
    res.json({ ok: true, data: db.all(sql + ' ORDER BY dt DESC', p) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/applications', (req, res) => {
  try {
    const d = req.body;
    if (!d.ji) return res.status(400).json({ ok: false, error: 'Job ID required' });
    if (db.get('SELECT id FROM applications WHERE ji = ? AND wid = ?', [d.ji, d.wid||'']))
      return res.status(409).json({ ok: false, error: 'Already applied' });
    const id = uid('ap');
    db.run('INSERT INTO applications(id,ji,jt,co,wid,wn,st,nt,dt) VALUES(?,?,?,?,?,?,?,?,?)',
      [id,d.ji,d.jt||'',d.co||'',d.wid||null,d.wn||'','Submitted',d.nt||'',new Date().toLocaleDateString()]);
    db.run('UPDATE jobs SET ap = ap + 1 WHERE id = ?', [d.ji]);
    res.status(201).json({ ok: true, data: db.get('SELECT * FROM applications WHERE id = ?', [id]) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.patch('/api/applications/:id', (req, res) => {
  try {
    const { st, nt } = req.body;
    if (!db.get('SELECT id FROM applications WHERE id = ?', [req.params.id]))
      return res.status(404).json({ ok: false, error: 'Not found' });
    if (st) db.run('UPDATE applications SET st = ? WHERE id = ?', [st, req.params.id]);
    if (nt !== undefined) db.run('UPDATE applications SET nt = ? WHERE id = ?', [nt, req.params.id]);
    res.json({ ok: true, data: db.get('SELECT * FROM applications WHERE id = ?', [req.params.id]) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  REVIEWS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/reviews', (req, res) => {
  try {
    const { tid } = req.query;
    if (!tid) return res.status(400).json({ ok: false, error: 'tid required' });
    res.json({ ok: true, data: db.all('SELECT * FROM reviews WHERE tid = ? ORDER BY dt DESC', [tid]) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/reviews', (req, res) => {
  try {
    const d = req.body;
    if (!d.tid || !d.cm) return res.status(400).json({ ok: false, error: 'tid and cm required' });
    const id = uid('rv');
    db.run('INSERT INTO reviews(id,tid,rn,rt,cm,dt,uid) VALUES(?,?,?,?,?,?,?)',
      [id,d.tid,d.rn||'Anonymous',d.rt||5,d.cm,new Date().toLocaleDateString(),d.uid||null]);
    const stats = db.get('SELECT COUNT(*) as cnt, AVG(rt) as avg FROM reviews WHERE tid = ?', [d.tid]);
    if (stats?.cnt) db.run('UPDATE workers SET rt = ?, rv = ? WHERE id = ?', [Math.round(stats.avg*10)/10, stats.cnt, d.tid]);
    res.status(201).json({ ok: true, data: db.get('SELECT * FROM reviews WHERE id = ?', [id]) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.delete('/api/reviews/:id', (req, res) => {
  try { db.run('DELETE FROM reviews WHERE id = ?', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  NOTIFICATIONS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/notifications', (req, res) => {
  try {
    const { uid: userId } = req.query;
    if (!userId) return res.status(400).json({ ok: false, error: 'uid required' });
    res.json({ ok: true, data: db.all('SELECT * FROM notifications WHERE uid = ? ORDER BY created DESC LIMIT 50', [userId]) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/notifications', (req, res) => {
  try {
    const d = req.body;
    if (!d.uid || !d.ti) return res.status(400).json({ ok: false, error: 'uid and ti required' });
    const id = uid('n');
    db.run('INSERT INTO notifications(id,uid,ic,bg,ti,tx,tm,ur,tp,kid) VALUES(?,?,?,?,?,?,?,?,?,?)',
      [id,d.uid,d.ic||'🔔',d.bg||'rgba(64,202,215,.15)',d.ti,d.tx||'',d.tm||'Just now',1,d.tp||'',d.kid||'']);
    res.status(201).json({ ok: true, id });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.patch('/api/notifications/read-all', (req, res) => {
  try {
    const { uid: userId } = req.query;
    if (!userId) return res.status(400).json({ ok: false, error: 'uid required' });
    db.run('UPDATE notifications SET ur = 0 WHERE uid = ?', [userId]);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.patch('/api/notifications/:id/read', (req, res) => {
  try { db.run('UPDATE notifications SET ur = 0 WHERE id = ?', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MESSAGES
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/messages', (req, res) => {
  try {
    const { cid } = req.query;
    if (!cid) return res.status(400).json({ ok: false, error: 'cid required' });
    res.json({ ok: true, data: db.all('SELECT * FROM messages WHERE cid = ? ORDER BY id ASC', [cid]) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/messages', (req, res) => {
  try {
    const { cid, frm, tx, uid: userId } = req.body;
    if (!cid || !tx) return res.status(400).json({ ok: false, error: 'cid and tx required' });
    const id = uid('m');
    const tm = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    db.run('INSERT INTO messages(id,cid,frm,tx,tm,uid) VALUES(?,?,?,?,?,?)', [id,cid,frm||'me',tx,tm,userId||null]);
    res.status(201).json({ ok: true, data: { id, cid, frm: frm||'me', tx, tm } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  FAVORITES
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/favorites', (req, res) => {
  try {
    const { uid: userId } = req.query;
    if (!userId) return res.status(400).json({ ok: false, error: 'uid required' });
    res.json({ ok: true, data: db.all('SELECT fid FROM favorites WHERE uid = ?', [userId]).map(r => r.fid) });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/favorites', (req, res) => {
  try {
    const { uid: userId, fid } = req.body;
    if (!userId || !fid) return res.status(400).json({ ok: false, error: 'uid and fid required' });
    if (db.get('SELECT 1 FROM favorites WHERE uid=? AND fid=?', [userId, fid])) {
      db.run('DELETE FROM favorites WHERE uid=? AND fid=?', [userId, fid]);
      return res.json({ ok: true, action: 'removed' });
    }
    db.run('INSERT INTO favorites(uid,fid) VALUES(?,?)', [userId, fid]);
    res.json({ ok: true, action: 'added' });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  REPORTS
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/reports', (req, res) => {
  try { res.json({ ok: true, data: db.all('SELECT * FROM reports ORDER BY created DESC') }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.post('/api/reports', (req, res) => {
  try {
    const { rs, dt, tgt, uid: userId } = req.body;
    const id = uid('rpt');
    db.run('INSERT INTO reports(id,rs,dt,tgt,uid) VALUES(?,?,?,?,?)', [id,rs||'Other',dt||'',tgt||'',userId||null]);
    res.status(201).json({ ok: true, id });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.delete('/api/reports/:id', (req, res) => {
  try { db.run('DELETE FROM reports WHERE id = ?', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  ADMIN
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/admin/stats', (req, res) => {
  try {
    res.json({ ok: true, data: {
      workers: db.get('SELECT COUNT(*) AS cnt FROM workers').cnt,
      jobs:    db.get('SELECT COUNT(*) AS cnt FROM jobs WHERE op=1').cnt,
      applications: db.get('SELECT COUNT(*) AS cnt FROM applications').cnt,
      reports: db.get('SELECT COUNT(*) AS cnt FROM reports').cnt,
    }});
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.patch('/api/admin/workers/:id/verify', (req, res) => {
  try { db.run('UPDATE workers SET vr = 1 WHERE id = ?', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

app.patch('/api/admin/workers/:id/ban', (req, res) => {
  try { db.run('UPDATE workers SET av = 0 WHERE id = ?', [req.params.id]); res.json({ ok: true }); }
  catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  SEARCH
// ═══════════════════════════════════════════════════════════════════════════════
app.get('/api/search', (req, res) => {
  try {
    const { q = '', type = 'all' } = req.query;
    const like = `%${q}%`;
    const workers = (q && (type==='all'||type==='workers'))
      ? db.all('SELECT * FROM workers WHERE nm LIKE ? OR cat LIKE ? OR sk LIKE ? OR cy LIKE ?', [like,like,like,like]).map(db.parseWorker) : [];
    const jobs = (q && (type==='all'||type==='jobs'))
      ? db.all('SELECT * FROM jobs WHERE op=1 AND (ti LIKE ? OR co LIKE ? OR cat LIKE ? OR sk LIKE ? OR cy LIKE ?)', [like,like,like,like,like]).map(db.parseJob) : [];
    res.json({ ok: true, data: { workers, jobs } });
  } catch (e) { res.status(500).json({ ok: false, error: e.message }); }
});

// ═══════════════════════════════════════════════════════════════════════════════
//  AI CHATBOT  — fully DB-independent, works on Vercel serverless
// ═══════════════════════════════════════════════════════════════════════════════

// Static seed data — no DB needed, always available instantly
const AI_WORKERS = [
  {nm:'Suresh Patil',cat:'Plumbing',cy:'Pune',wg:600,wu:'per day',av:true,vr:true,rt:4.7},
  {nm:'Ravi Kumar',cat:'Electrical',cy:'Pune',wg:700,wu:'per day',av:true,vr:true,rt:4.9},
  {nm:'Mohan Sinha',cat:'Carpentry',cy:'Mumbai',wg:800,wu:'per day',av:false,vr:false,rt:4.5},
  {nm:'Priya Cleaning Services',cat:'Cleaning',cy:'Pune',wg:500,wu:'per day',av:true,vr:true,rt:4.8},
  {nm:'Akbar Shaikh',cat:'Painting',cy:'Mumbai',wg:650,wu:'per day',av:true,vr:false,rt:4.3},
  {nm:'Ganesh More',cat:'Mechanic',cy:'Nashik',wg:550,wu:'per day',av:true,vr:false,rt:4.6},
  {nm:'Ramesh Gardener',cat:'Gardening',cy:'Pune',wg:450,wu:'per day',av:true,vr:false,rt:4.4},
  {nm:'Deepak Delivery',cat:'Delivery',cy:'Pune',wg:600,wu:'per day',av:true,vr:false,rt:4.2},
];
const AI_JOBS = [
  {ti:'Plumber Needed — Residential Project',co:'Anjali Construction',cy:'Pune',ty:'Temporary',wmi:600,wma:800,fr:'Per Day'},
  {ti:'Senior Electrician — IT Office Complex',co:'TechPark Facilities',cy:'Pune',ty:'Full-time',wmi:25000,wma:35000,fr:'Per Month'},
  {ti:'Delivery Boys — Grocery App',co:'QuickMart',cy:'Pune',ty:'Part-time',wmi:600,wma:900,fr:'Per Day'},
  {ti:'Carpenter — Modular Furniture',co:'Shree Interior Designs',cy:'Mumbai',ty:'Full-time',wmi:18000,wma:25000,fr:'Per Month'},
  {ti:'Gardeners for Society Maintenance',co:'GreenLeaf Gardens',cy:'Pune',ty:'Contract',wmi:300,wma:400,fr:'Per Day'},
  {ti:'Painting Team — 15-Floor Building',co:'Anjali Construction',cy:'Mumbai',ty:'Temporary',wmi:600,wma:750,fr:'Per Day'},
  {ti:'House Cleaner — Weekly Service',co:'HomeStar Services',cy:'Pune',ty:'Part-time',wmi:400,wma:500,fr:'Per Day'},
  {ti:'Two-Wheeler Mechanic — Workshop',co:'Speed Auto',cy:'Nashik',ty:'Full-time',wmi:15000,wma:20000,fr:'Per Month'},
];

app.post('/api/ai/chat', (req, res) => {
  try {
    const { message = '' } = req.body;
    if (!message.trim()) return res.status(400).json({ ok: false, error: 'Empty message' });

    const msg = message.toLowerCase().trim();

    // Use static data — no DB required
    const workers = AI_WORKERS;
    const jobs    = AI_JOBS;
    const avWorkers = workers.filter(w => w.av).length;
    const vrWorkers = workers.filter(w => w.vr).length;
    const avgWage   = Math.round(workers.reduce((s,w)=>s+w.wg,0)/workers.length);

    const pick = arr => arr[Math.floor(Math.random() * arr.length)];
    const fmt  = w => `**${w.nm}** (${w.cat}, ${w.cy}) — ₹${w.wg}/${w.wu.replace('per ','')} · ⭐${w.rt}`;
    const fmtJ = j => `**${j.ti}** at ${j.co} (${j.cy}) — ₹${j.wmi}–₹${j.wma} ${j.fr}`;
    const findW = (cat, em) => {
      const found = workers.filter(w => w.cat === cat && w.av);
      return found.length
        ? `${em} Found **${found.length} available ${cat.toLowerCase()} workers**:\n\n${found.map(fmt).join('\n')}\n\nOpen the **Services** tab to view full profile & contact.`
        : `No available ${cat.toLowerCase()} workers right now. Browse the **Services** tab.`;
    };

    let reply = '';

    if (/^(hi|hello|hey|namaste|hii|howdy|yo|sup|hola)\b/.test(msg))
      reply = pick([
        `Hello! 👋 I'm **Kam AI**, your assistant on Kam Connect.\n\nI can help you find workers, browse jobs, check stats, and answer general questions. What do you need?`,
        `Namaste! 🙏 I'm **Kam AI**. We have **${workers.length} workers** and **${jobs.length} active jobs** on platform. How can I help you today?`,
      ]);
    else if (/plumb/i.test(msg)) reply = findW('Plumbing','🔧');
    else if (/electr/i.test(msg)) reply = findW('Electrical','⚡');
    else if (/clean/i.test(msg)) reply = findW('Cleaning','🧹');
    else if (/paint/i.test(msg)) reply = findW('Painting','🖌️');
    else if (/carpenter|carpent|furniture/i.test(msg)) reply = findW('Carpentry','🪚');
    else if (/mechanic/i.test(msg)) reply = findW('Mechanic','🔩');
    else if (/deliver/i.test(msg)) reply = findW('Delivery','🚚');
    else if (/garden|lawn/i.test(msg)) reply = findW('Gardening','🌿');
    else if (/show.*job|list.*job|latest job|find.*job|job.*list|naukri|kaam/i.test(msg))
      reply = `💼 **${jobs.length} active jobs** on Kam Connect:\n\n${jobs.slice(0,4).map(fmtJ).join('\n')}\n\nOpen the **Jobs** tab to apply!`;
    else if (/pune.*job|job.*pune/i.test(msg)) {
      const f = jobs.filter(j=>j.cy.toLowerCase().includes('pune'));
      reply = f.length ? `📍 **${f.length} jobs in Pune**:\n\n${f.map(fmtJ).join('\n')}` : `No jobs in Pune right now.`;
    }
    else if (/mumbai.*job|job.*mumbai/i.test(msg)) {
      const f = jobs.filter(j=>j.cy.toLowerCase().includes('mumbai'));
      reply = f.length ? `📍 **${f.length} jobs in Mumbai**:\n\n${f.map(fmtJ).join('\n')}` : `No jobs in Mumbai right now.`;
    }
    else if (/full.?time/i.test(msg)) {
      const f = jobs.filter(j=>j.ty==='Full-time');
      reply = `👔 **${f.length} full-time jobs**:\n\n${f.map(fmtJ).join('\n')}`;
    }
    else if (/part.?time/i.test(msg)) {
      const f = jobs.filter(j=>j.ty==='Part-time');
      reply = `⏱ **${f.length} part-time jobs**:\n\n${f.map(fmtJ).join('\n')}`;
    }
    else if (/daily.?wage/i.test(msg)) {
      const f = jobs.filter(j=>j.ty==='Daily Wage');
      reply = f.length ? `📅 **${f.length} daily wage jobs**:\n\n${f.map(fmtJ).join('\n')}` : `No daily wage jobs right now.`;
    }
    else if (/how.*apply|apply.*job/i.test(msg))
      reply = `To apply for a job:\n\n1. Open the **Jobs** tab\n2. Tap any job card\n3. Tap **Apply Now**\n4. Add a cover note (optional)\n5. Tap **Submit Application** ✅\n\nYou'll get a notification when the employer responds!`;
    else if (/post.*job|create.*job/i.test(msg))
      reply = `To post a job:\n\n1. Go to **Profile** → switch to **Employer** mode\n2. Tap **+ Post Job**\n3. Fill title, category, wage, description\n4. Tap **Publish** ✅\n\nYour job will be visible to all workers instantly!`;
    else if (/top.*worker|best.*worker|show.*worker|worker.*list/i.test(msg)) {
      const top = [...workers].sort((a,b)=>b.rt-a.rt).slice(0,4);
      reply = `⭐ **Top-rated workers** on Kam Connect:\n\n${top.map(fmt).join('\n')}`;
    }
    else if (/available.*worker|worker.*available/i.test(msg)) {
      const av = workers.filter(w=>w.av);
      reply = `✅ **${av.length} workers available** right now:\n\n${av.map(fmt).join('\n')}`;
    }
    else if (/stat|how many|count|total|number/i.test(msg))
      reply = `📊 **Kam Connect Live Stats:**\n\n👷 **${workers.length}** total workers (${avWorkers} available)\n💼 **${jobs.length}** active jobs\n✅ **${vrWorkers}** verified workers\n📍 **3** cities — Pune, Mumbai, Nashik`;
    else if (/cost|price|wage|rate|salary|pay|charge|fee/i.test(msg))
      reply = `💰 **Worker wage rates on Kam Connect:**\n\n📉 Minimum: ₹${Math.min(...workers.map(w=>w.wg))}/day\n📈 Maximum: ₹${Math.max(...workers.map(w=>w.wg))}/day\n📊 Average: ₹${avgWage}/day\n\nRates vary by category & experience!`;
    else if (/verif/i.test(msg))
      reply = `✅ **${vrWorkers} out of ${workers.length}** workers are Verified on Kam Connect.\n\nVerified workers have been reviewed by our admin team. Look for the **✓ Verified** badge on worker profiles!`;
    else if (/help|what can you do|feature/i.test(msg))
      reply = `Here's what I can do:\n\n🔍 **Find workers** — "Find a plumber in Pune"\n💼 **Browse jobs** — "Show jobs in Mumbai"\n📊 **Platform stats** — "How many workers?"\n💰 **Wage rates** — "What are the rates?"\n📋 **How-to guides** — "How to apply for a job?"\n🌍 **General knowledge** — "Capital of India?"\n🕐 **Time & Date** — "What time is it?"\n😄 **Jokes** — "Tell me a joke"`;
    else if (/what is kam|about kam|about this|about platform/i.test(msg))
      reply = `**Kam Connect** is a local services & hiring platform that connects:\n\n👷 **Workers** — plumbers, electricians, carpenters, painters & more\n🏢 **Employers** — post jobs and hire skilled workers fast\n👤 **Customers** — find trusted local services with real reviews\n\n📍 Currently serving **${workers.length} workers** across Pune, Mumbai & Nashik! 🚀`;
    else if (/worker.*profile|create.*profile|how.*profile/i.test(msg))
      reply = `To create your worker profile:\n\n1. Go to **Profile** tab\n2. Switch role to **Worker**\n3. Tap **Create Profile**\n4. Fill your name, skills, category, wage & city\n5. Save ✓\n\nEmployers can then find and contact you directly!`;
    else if (/thank|thanks|great|awesome|nice|perfect|superb/i.test(msg))
      reply = pick([`You're welcome! 😊 Anything else I can help with?`, `Happy to help! 🙌`, `Glad I could help! ⚡`]);
    else if (/bye|goodbye|see you|take care/i.test(msg))
      reply = `Goodbye! 👋 Come back anytime. Have a great day! 😊`;
    else if (/capital.*india|india.*capital/i.test(msg))
      reply = `🏛️ The capital of India is **New Delhi**.`;
    else if (/capital.*maharashtra|maharashtra.*capital/i.test(msg))
      reply = `🏛️ The capital of Maharashtra is **Mumbai**.`;
    else if (/pm.*india|prime minister.*india|india.*prime minister/i.test(msg))
      reply = `🇮🇳 The Prime Minister of India is **Narendra Modi** (as of 2024).`;
    else if (/population.*india|india.*population/i.test(msg))
      reply = `🇮🇳 India's population is approximately **1.44 billion**, making it the most populous country in the world.`;
    else if (/currency.*india|india.*currency/i.test(msg))
      reply = `💵 India's currency is the **Indian Rupee (₹ / INR)**. 1 USD ≈ ₹83–84.`;
    else if (/what.*time|current.*time|time.*india|ist/i.test(msg)) {
      const t = new Date().toLocaleString('en-IN', {timeZone:'Asia/Kolkata'});
      reply = `🕐 Current IST time: **${t}**`;
    }
    else if (/today.*date|current.*date|what.*date/i.test(msg)) {
      const d = new Date().toLocaleDateString('en-IN', {weekday:'long',year:'numeric',month:'long',day:'numeric',timeZone:'Asia/Kolkata'});
      reply = `📅 Today is: **${d}**`;
    }
    else if (/\d+\s*[\+\-\*\/]\s*\d/i.test(msg)) {
      const expr = msg.match(/([\d\s\+\-\*\/\.\(\)]+)/);
      if (expr) {
        try {
          const result = Function('"use strict";return(' + expr[1].trim() + ')')();
          reply = `🔢 **${expr[1].trim()} = ${result}**`;
        } catch { reply = `I couldn't calculate that. Try: "What is 25 + 75?"` }
      }
    }
    else if (/joke/i.test(msg))
      reply = pick([
        `Why did the plumber go to school?\n\nBecause he wanted to **fix his pipe dreams!** 🔧😂`,
        `What do you call a reliable electrician?\n\n**Watt a great guy!** ⚡😄`,
        `Why don't scientists trust atoms?\n\nBecause they **make up everything!** 😄`,
        `Why did the worker bring a ladder to the office?\n\nHis boss said **"Aim high!"** 😂`,
      ]);
    else
      reply = pick([
        `I'm **Kam AI** — your assistant on Kam Connect! 🤖\n\nI can help with:\n- **"Find a plumber in Pune"**\n- **"Show jobs in Mumbai"**\n- **"How many workers are there?"**\n\nType **help** to see everything I can do!`,
        `Hmm, I'm not sure about that — but I'm great at helping with workers, jobs & platform info!\n\nTry asking:\n- **"Find an electrician"**\n- **"Show available jobs"**\n- **"What are wage rates?"**`,
      ]);

    res.json({ ok: true, reply, timestamp: new Date().toISOString() });
  } catch (e) {
    console.error('[ai]', e);
    res.status(500).json({ ok: false, error: 'AI error: ' + e.message });
  }
});

// ── 404 + SPA fallback ─────────────────────────────────────────────────────────
app.use((req, res) => {
  if (req.path.startsWith('/api/'))
    return res.status(404).json({ ok: false, error: 'Not found' });
  const fs = require('fs');
  const indexPath = path.join(__dirname, '..', 'index.html');
  if (fs.existsSync(indexPath)) res.sendFile(indexPath);
  else res.send('KAM CONNECT');
});

app.use((err, req, res, _next) => {
  console.error('[error]', err);
  res.status(500).json({ ok: false, error: 'Internal server error' });
});

module.exports = app;

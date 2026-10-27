// ─── db.js ────────────────────────────────────────────────────────────────────
// Pure-JS SQLite layer using sql.js (no native build required).
// The DB is persisted to ./data/kam.db on every write.
// ──────────────────────────────────────────────────────────────────────────────
'use strict';

const fs   = require('fs');
const path = require('path');
const initSqlJs = require('sql.js');

const DB_DIR  = path.join(__dirname, 'data');
const DB_FILE = path.join(DB_DIR, 'kam.db');

let db; // sql.js Database instance

// ── Persist helper ────────────────────────────────────────────────────────────
function save() {
  try {
    const data = db.export();
    fs.writeFileSync(DB_FILE, Buffer.from(data));
  } catch (e) {
    console.error('[db] save error:', e.message);
  }
}

// ── Bootstrap ─────────────────────────────────────────────────────────────────
async function init() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  const SQL = await initSqlJs();

  if (fs.existsSync(DB_FILE)) {
    const buf = fs.readFileSync(DB_FILE);
    db = new SQL.Database(buf);
    console.log('[db] Loaded existing database from', DB_FILE);
  } else {
    db = new SQL.Database();
    console.log('[db] Created new in-memory database');
    createSchema();
    seedData();
    save();
    console.log('[db] Schema created and seed data inserted');
  }
}

// ── Schema ────────────────────────────────────────────────────────────────────
function createSchema() {
  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id       TEXT PRIMARY KEY,
      name     TEXT NOT NULL,
      phone    TEXT UNIQUE NOT NULL,
      role     TEXT NOT NULL DEFAULT 'customer',
      created  TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS workers (
      id     TEXT PRIMARY KEY REFERENCES users(id),
      nm     TEXT NOT NULL,
      cat    TEXT NOT NULL DEFAULT 'Other',
      em     TEXT NOT NULL DEFAULT '👷',
      sk     TEXT NOT NULL DEFAULT '[]',
      ex     INTEGER NOT NULL DEFAULT 0,
      cy     TEXT NOT NULL DEFAULT '',
      lo     TEXT NOT NULL DEFAULT '',
      ar     TEXT NOT NULL DEFAULT '',
      la     TEXT NOT NULL DEFAULT '[]',
      bi     TEXT NOT NULL DEFAULT '',
      wg     REAL NOT NULL DEFAULT 0,
      wu     TEXT NOT NULL DEFAULT 'per day',
      av     INTEGER NOT NULL DEFAULT 1,
      vr     INTEGER NOT NULL DEFAULT 0,
      rt     REAL NOT NULL DEFAULT 0,
      rv     INTEGER NOT NULL DEFAULT 0,
      ph     TEXT NOT NULL DEFAULT '',
      wa     INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS jobs (
      id   TEXT PRIMARY KEY,
      ti   TEXT NOT NULL,
      co   TEXT NOT NULL,
      ce   TEXT NOT NULL DEFAULT '🏢',
      cat  TEXT NOT NULL DEFAULT 'Other',
      ty   TEXT NOT NULL DEFAULT 'Full-time',
      cy   TEXT NOT NULL DEFAULT '',
      lo   TEXT NOT NULL DEFAULT '',
      sk   TEXT NOT NULL DEFAULT '[]',
      wn   INTEGER NOT NULL DEFAULT 1,
      wmi  REAL NOT NULL DEFAULT 0,
      wma  REAL NOT NULL DEFAULT 0,
      fr   TEXT NOT NULL DEFAULT 'Per Day',
      de   TEXT NOT NULL DEFAULT '',
      hr   TEXT NOT NULL DEFAULT '',
      dl   TEXT NOT NULL DEFAULT '',
      ap   INTEGER NOT NULL DEFAULT 0,
      po   TEXT NOT NULL DEFAULT 'Just now',
      op   INTEGER NOT NULL DEFAULT 1,
      ph   TEXT NOT NULL DEFAULT '',
      eid  TEXT REFERENCES users(id),
      created TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS applications (
      id   TEXT PRIMARY KEY,
      ji   TEXT NOT NULL REFERENCES jobs(id),
      jt   TEXT NOT NULL DEFAULT '',
      co   TEXT NOT NULL DEFAULT '',
      wid  TEXT REFERENCES users(id),
      wn   TEXT NOT NULL DEFAULT '',
      st   TEXT NOT NULL DEFAULT 'Submitted',
      nt   TEXT NOT NULL DEFAULT '',
      dt   TEXT NOT NULL DEFAULT (date('now'))
    );

    CREATE TABLE IF NOT EXISTS reviews (
      id   TEXT PRIMARY KEY,
      tid  TEXT NOT NULL,
      rn   TEXT NOT NULL DEFAULT 'Anonymous',
      rt   REAL NOT NULL DEFAULT 5,
      cm   TEXT NOT NULL DEFAULT '',
      dt   TEXT NOT NULL DEFAULT (date('now')),
      uid  TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id   TEXT PRIMARY KEY,
      uid  TEXT NOT NULL REFERENCES users(id),
      ic   TEXT NOT NULL DEFAULT '🔔',
      bg   TEXT NOT NULL DEFAULT 'rgba(64,202,215,.15)',
      ti   TEXT NOT NULL DEFAULT '',
      tx   TEXT NOT NULL DEFAULT '',
      tm   TEXT NOT NULL DEFAULT 'Just now',
      ur   INTEGER NOT NULL DEFAULT 1,
      tp   TEXT NOT NULL DEFAULT '',
      kid  TEXT NOT NULL DEFAULT '',
      created TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS messages (
      id   TEXT PRIMARY KEY,
      cid  TEXT NOT NULL,
      frm  TEXT NOT NULL,
      tx   TEXT NOT NULL,
      tm   TEXT NOT NULL,
      uid  TEXT REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS reports (
      id   TEXT PRIMARY KEY,
      rs   TEXT NOT NULL DEFAULT 'Other',
      dt   TEXT NOT NULL DEFAULT '',
      tgt  TEXT NOT NULL DEFAULT '',
      uid  TEXT REFERENCES users(id),
      created TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS favorites (
      uid  TEXT NOT NULL REFERENCES users(id),
      fid  TEXT NOT NULL,
      PRIMARY KEY (uid, fid)
    );
  `);
}

// ── Seed Data ─────────────────────────────────────────────────────────────────
function seedData() {
  // Demo users
  const users = [
    { id:'demo_customer', name:'Rahul Sharma',       phone:'+91 98765 00001', role:'customer' },
    { id:'demo_worker',   name:'Suresh Patil',        phone:'+91 98765 00002', role:'worker'   },
    { id:'demo_employer', name:'Anjali Construction', phone:'+91 98765 00003', role:'employer' },
    { id:'demo_admin',    name:'Admin',               phone:'+91 98765 00004', role:'admin'    },
  ];
  users.forEach(u => run(
    'INSERT OR IGNORE INTO users(id,name,phone,role) VALUES(?,?,?,?)',
    [u.id, u.name, u.phone, u.role]
  ));

  // Workers
  const W = [
    {id:'w1',nm:'Suresh Patil',cat:'Plumbing',em:'🔧',sk:['Plumbing','Pipe Fitting','Drain Cleaning','Waterproofing'],ex:8,cy:'Pune',lo:'Kothrud',ar:'Kothrud, Karve Nagar, Warje',la:['Hindi','Marathi'],bi:'Expert plumber with 8+ years experience in residential and commercial work. Available 7 days a week.',wg:600,wu:'per day',av:1,vr:1,rt:4.7,rv:43,ph:'+91 98760 11111',wa:1},
    {id:'w2',nm:'Ravi Kumar',cat:'Electrical',em:'⚡',sk:['Wiring','Switchboard','Inverter','AC Fitting','Ceiling Fan'],ex:12,cy:'Pune',lo:'Hadapsar',ar:'Hadapsar, Magarpatta, Kharadi',la:['Hindi','Marathi','English'],bi:'Licensed electrician with 12 years of industrial and residential experience.',wg:700,wu:'per day',av:1,vr:1,rt:4.9,rv:87,ph:'+91 98760 22222',wa:1},
    {id:'w3',nm:'Mohan Sinha',cat:'Carpentry',em:'🪚',sk:['Furniture','Doors','Windows','Modular Kitchen','Wood Polish'],ex:15,cy:'Mumbai',lo:'Andheri',ar:'Andheri, Goregaon, Borivali',la:['Hindi','Marathi'],bi:'Custom furniture and woodwork specialist.',wg:800,wu:'per day',av:0,vr:0,rt:4.5,rv:31,ph:'+91 98760 33333',wa:0},
    {id:'w4',nm:'Priya Cleaning Services',cat:'Cleaning',em:'🧹',sk:['Deep Cleaning','Kitchen Cleaning','Post-Construction','Sofa Cleaning'],ex:4,cy:'Pune',lo:'Baner',ar:'Baner, Balewadi, Aundh',la:['Hindi','Marathi','English'],bi:'Professional cleaning services using eco-friendly products.',wg:500,wu:'per day',av:1,vr:1,rt:4.8,rv:62,ph:'+91 98760 44444',wa:1},
    {id:'w5',nm:'Akbar Shaikh',cat:'Painting',em:'🖌️',sk:['Interior Painting','Exterior Painting','Waterproofing','Texture Work'],ex:10,cy:'Mumbai',lo:'Bandra',ar:'Bandra, Santacruz, Kurla',la:['Hindi','Urdu'],bi:'Quality painting at competitive rates.',wg:650,wu:'per day',av:1,vr:0,rt:4.3,rv:28,ph:'+91 98760 55555',wa:1},
    {id:'w6',nm:'Ganesh More',cat:'Mechanic',em:'🔩',sk:['Two Wheeler Repair','Car Servicing','AC Repair','Puncture'],ex:7,cy:'Nashik',lo:'Gangapur Road',ar:'Nashik, College Road',la:['Marathi','Hindi'],bi:'Home-visit mechanic. Bikes and cars serviced at your doorstep.',wg:550,wu:'per day',av:1,vr:0,rt:4.6,rv:19,ph:'+91 98760 66666',wa:1},
    {id:'w7',nm:'Ramesh Gardener',cat:'Gardening',em:'🌿',sk:['Lawn Maintenance','Landscaping','Plant Care','Pruning'],ex:6,cy:'Pune',lo:'Koregaon Park',ar:'Koregaon Park, Kalyani Nagar',la:['Marathi','Hindi'],bi:'Expert landscaper and gardener.',wg:450,wu:'per day',av:1,vr:0,rt:4.4,rv:14,ph:'+91 98760 77777',wa:1},
    {id:'w8',nm:'Deepak Delivery',cat:'Delivery',em:'🚚',sk:['Two Wheeler Delivery','Last Mile','Hyperlocal','Food Delivery'],ex:3,cy:'Pune',lo:'Viman Nagar',ar:'Viman Nagar, Nagar Road',la:['Hindi','Marathi'],bi:'Reliable two-wheeler delivery executive.',wg:600,wu:'per day',av:1,vr:0,rt:4.2,rv:8,ph:'+91 98760 88888',wa:1},
  ];
  W.forEach(w => run(
    `INSERT OR IGNORE INTO workers(id,nm,cat,em,sk,ex,cy,lo,ar,la,bi,wg,wu,av,vr,rt,rv,ph,wa)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [w.id,w.nm,w.cat,w.em,JSON.stringify(w.sk),w.ex,w.cy,w.lo,w.ar,JSON.stringify(w.la),w.bi,w.wg,w.wu,w.av,w.vr,w.rt,w.rv,w.ph,w.wa]
  ));

  // Jobs
  const J = [
    {id:'j1',ti:'Plumber Needed — Residential Project',co:'Anjali Construction',ce:'🏗️',cat:'Plumbing',ty:'Temporary',cy:'Pune',lo:'Kothrud',sk:['Plumbing','Pipe Fitting'],wn:3,wmi:600,wma:800,fr:'Per Day',de:'We need experienced plumbers for a new residential building in Kothrud.',hr:'8am–6pm, Mon–Sat',dl:'2025-08-14',ap:12,po:'2 days ago',op:1,eid:'demo_employer'},
    {id:'j2',ti:'Senior Electrician — IT Office Complex',co:'TechPark Facilities',ce:'💻',cat:'Electrical',ty:'Full-time',cy:'Pune',lo:'Hinjewadi',sk:['Industrial Wiring','UPS','Fire Alarm'],wn:2,wmi:25000,wma:35000,fr:'Per Month',de:'Hiring a senior electrician for ongoing maintenance of a large IT office complex.',hr:'9am–6pm, Mon–Fri',dl:'2025-08-28',ap:7,po:'4 days ago',op:1,eid:'demo_employer'},
    {id:'j3',ti:'Delivery Boys — Grocery App',co:'QuickMart',ce:'🛒',cat:'Delivery',ty:'Part-time',cy:'Pune',lo:'Aundh',sk:['Two Wheeler','Smartphone','Valid License'],wn:10,wmi:600,wma:900,fr:'Per Day',de:'QuickMart grocery delivery app looking for delivery partners.',hr:'Flexible shifts',dl:'2025-09-01',ap:34,po:'1 day ago',op:1,eid:'demo_employer'},
    {id:'j4',ti:'Carpenter — Modular Furniture',co:'Shree Interior Designs',ce:'🛋️',cat:'Carpentry',ty:'Full-time',cy:'Mumbai',lo:'Andheri',sk:['Modular Kitchen','Laminates','Hardware Fitting'],wn:2,wmi:18000,wma:25000,fr:'Per Month',de:'Experienced carpenter needed for modular furniture fabrication.',hr:'9am–7pm, Mon–Sat',dl:'2025-09-15',ap:5,po:'6 days ago',op:1,eid:'demo_employer'},
    {id:'j5',ti:'Gardeners for Society Maintenance',co:'GreenLeaf Gardens',ce:'🌳',cat:'Gardening',ty:'Contract',cy:'Pune',lo:'Viman Nagar',sk:['Lawn Maintenance','Plant Care'],wn:3,wmi:300,wma:400,fr:'Per Day',de:'Residential society looking for gardeners for daily maintenance.',hr:'6am–10am daily',dl:'2025-08-25',ap:8,po:'2 days ago',op:1,eid:'demo_employer'},
    {id:'j6',ti:'Painting Team — New 15-Floor Building',co:'Anjali Construction',ce:'🏗️',cat:'Painting',ty:'Temporary',cy:'Mumbai',lo:'Thane',sk:['Interior Painting','Exterior Painting','Waterproofing'],wn:5,wmi:600,wma:750,fr:'Per Day',de:'Need 5 painters for a 15-floor residential building in Thane.',hr:'7am–5pm, Mon–Sat',dl:'2025-08-20',ap:21,po:'3 days ago',op:1,eid:'demo_employer'},
    {id:'j7',ti:'House Cleaner — Weekly Service',co:'HomeStar Services',ce:'🏠',cat:'Cleaning',ty:'Part-time',cy:'Pune',lo:'Baner',sk:['Deep Cleaning','Kitchen Cleaning'],wn:5,wmi:400,wma:500,fr:'Per Day',de:'Premium home cleaning service seeking experienced cleaners.',hr:'9am–3pm as scheduled',dl:'2025-09-10',ap:11,po:'5 days ago',op:1,eid:'demo_employer'},
    {id:'j8',ti:'Two-Wheeler Mechanic — Workshop',co:'Speed Auto',ce:'🏍️',cat:'Mechanic',ty:'Full-time',cy:'Nashik',lo:'College Road',sk:['Two Wheeler Repair','Servicing','Diagnosis'],wn:1,wmi:15000,wma:20000,fr:'Per Month',de:'Speed Auto workshop hiring an experienced two-wheeler mechanic.',hr:'9am–7pm, Mon–Sat',dl:'2025-08-30',ap:4,po:'1 day ago',op:1,eid:'demo_employer'},
  ];
  J.forEach(j => run(
    `INSERT OR IGNORE INTO jobs(id,ti,co,ce,cat,ty,cy,lo,sk,wn,wmi,wma,fr,de,hr,dl,ap,po,op,eid)
     VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [j.id,j.ti,j.co,j.ce,j.cat,j.ty,j.cy,j.lo,JSON.stringify(j.sk),j.wn,j.wmi,j.wma,j.fr,j.de,j.hr,j.dl,j.ap,j.po,j.op,j.eid]
  ));

  // Seed reviews
  const reviews = [
    {id:'rv1',tid:'w1',rn:'Rahul S.',rt:5,cm:'Suresh fixed my bathroom leak perfectly. Very professional and clean work!',dt:'10 days ago'},
    {id:'rv2',tid:'w1',rn:'Meena K.',rt:4.5,cm:'Good work, came on time. Reasonable rates.',dt:'20 days ago'},
    {id:'rv3',tid:'w1',rn:'Sanjay P.',rt:5,cm:'Excellent service. Fixed the kitchen pipe in 30 minutes.',dt:'1 month ago'},
    {id:'rv4',tid:'w2',rn:'Rahul S.',rt:5,cm:'Ravi is the best electrician I have hired. Knows his craft deeply.',dt:'15 days ago'},
    {id:'rv5',tid:'w2',rn:'Priti M.',rt:5,cm:'Installed 3 ACs and rewired the switchboard flawlessly.',dt:'25 days ago'},
    {id:'rv6',tid:'w4',rn:'Asha N.',rt:5,cm:'Amazing post-renovation cleaning. House sparkles!',dt:'8 days ago'},
    {id:'rv7',tid:'w4',rn:'Rohit G.',rt:4.5,cm:'Very thorough cleaning. A bit pricey but worth it.',dt:'18 days ago'},
  ];
  reviews.forEach(r => run(
    'INSERT OR IGNORE INTO reviews(id,tid,rn,rt,cm,dt) VALUES(?,?,?,?,?,?)',
    [r.id,r.tid,r.rn,r.rt,r.cm,r.dt]
  ));

  // Seed notifications for demo_customer
  const nots = [
    {id:'n1',uid:'demo_customer',ic:'✅',bg:'rgba(52,211,153,.15)',ti:'Application Shortlisted!',tx:'Your application for "Plumber Needed" has been shortlisted by Anjali Construction.',tm:'2 hours ago',ur:1,tp:'app',kid:'j1'},
    {id:'n2',uid:'demo_customer',ic:'💼',bg:'rgba(64,202,215,.15)',ti:'New Job Alert',tx:'A new Electrical job was posted in Pune matching your skills.',tm:'5 hours ago',ur:1,tp:'job',kid:'j2'},
    {id:'n3',uid:'demo_customer',ic:'💬',bg:'rgba(124,92,216,.15)',ti:'New Message',tx:'Anjali Construction sent you a message about your application.',tm:'1 day ago',ur:0,tp:'msg',kid:''},
    {id:'n4',uid:'demo_customer',ic:'⭐',bg:'rgba(255,184,48,.15)',ti:'Review Received',tx:'You received a new 5-star review from Rahul S.',tm:'2 days ago',ur:0,tp:'',kid:''},
  ];
  nots.forEach(n => run(
    'INSERT OR IGNORE INTO notifications(id,uid,ic,bg,ti,tx,tm,ur,tp,kid) VALUES(?,?,?,?,?,?,?,?,?,?)',
    [n.id,n.uid,n.ic,n.bg,n.ti,n.tx,n.tm,n.ur,n.tp,n.kid]
  ));
}

// ── Query helpers ─────────────────────────────────────────────────────────────
function run(sql, params = []) {
  db.run(sql, params);
  save();
}

function all(sql, params = []) {
  const stmt = db.prepare(sql);
  const rows = stmt.getAsObject ? [] : [];
  stmt.bind(params);
  const result = [];
  while (stmt.step()) result.push(stmt.getAsObject());
  stmt.free();
  return result;
}

function get(sql, params = []) {
  const rows = all(sql, params);
  return rows[0] || null;
}

// ── JSON column helpers ───────────────────────────────────────────────────────
function parseWorker(w) {
  if (!w) return null;
  return {
    ...w,
    sk: tryParse(w.sk, []),
    la: tryParse(w.la, []),
    av: !!w.av, vr: !!w.vr, wa: !!w.wa,
  };
}

function parseJob(j) {
  if (!j) return null;
  return { ...j, sk: tryParse(j.sk, []), op: !!j.op };
}

function tryParse(v, fallback) {
  try { return JSON.parse(v); } catch { return fallback; }
}

module.exports = { init, run, all, get, save, parseWorker, parseJob };

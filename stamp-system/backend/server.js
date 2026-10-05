// Stamp-card backend: zero dependencies (Node 18+). Run: node server.js
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
const PORT = process.env.PORT || 3000;
const SECRET = process.env.SECRET || 'change-me-before-going-live';
const DB = process.env.DB_FILE || path.join(__dirname, 'data.json');
const ROOT = path.join(__dirname, '..');
const SITES = { customer: path.join(ROOT, 'customer-site'), staff: path.join(ROOT, 'staff-site'), admin: path.join(ROOT, 'admin-site') };

const CODE_LIFETIME = 15 * 60 * 1000; // a QR is valid for 15 minutes

// ---------- tiny "database": one JSON file ----------
const hash = (pw, salt) => crypto.scryptSync(pw, salt, 32).toString('hex');
const mkUser = (username, pw, role) => { const salt = crypto.randomBytes(8).toString('hex'); return { username, salt, hash: hash(pw, salt), role }; };
const SEED = process.env.ADMIN_PASSWORD ? [mkUser('admin', process.env.ADMIN_PASSWORD, 'admin')]   // live: admin only
  : [mkUser('admin', 'admin123', 'admin'), mkUser('staff', 'staff123', 'staff')];                  // local demo accounts
const db = fs.existsSync(DB) ? JSON.parse(fs.readFileSync(DB)) :
  { users: SEED, codes: [], cards: {} };
const save = () => fs.writeFileSync(DB, JSON.stringify(db, null, 1));
save();

// ---------- login tokens (signed, expire after 8h) ----------
const sign = s => crypto.createHmac('sha256', SECRET).update(s).digest('hex');
const makeToken = u => { const b = Buffer.from(JSON.stringify({ u: u.username, r: u.role, e: Date.now() + 8 * 3600e3 })).toString('base64url'); return b + '.' + sign(b); };
const readToken = t => { try { const [b, s] = (t || '').split('.'); crypto.timingSafeEqual(Buffer.from(s), Buffer.from(sign(b))); const p = JSON.parse(Buffer.from(b, 'base64url')); return p.e > Date.now() ? p : null; } catch { return null; } };
const auth = (req, role) => { const p = readToken((req.headers.authorization || '').replace('Bearer ', '')); return p && db.users.some(u => u.username === p.u) && (!role || p.r === role) ? p : null; };  // removed staff lose access at once

const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(obj)); };
const body = req => new Promise(ok => { let d = ''; req.on('data', c => { d += c; if (d.length > 1e5) req.destroy(); }); req.on('end', () => { try { ok(JSON.parse(d || '{}')); } catch { ok({}); } }); });
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript' };

http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x'), p = url.pathname;

  // CORS: lets the two websites (other addresses) call this API. Set ALLOW_ORIGIN to your three site addresses, comma separated, in production.
  const ORIGINS = (process.env.ALLOW_ORIGIN || '*').split(',').map(x => x.trim()), o = req.headers.origin;
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Origin', ORIGINS.includes('*') ? '*' : ORIGINS.includes(o) ? o : ORIGINS[0]);
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,DELETE,OPTIONS');
  if (req.method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  // ---------- API ----------
  if (p === '/api/login' && req.method === 'POST') {
    const { username, password } = await body(req);
    const u = db.users.find(x => x.username === username);
    if (!u || hash(String(password || ''), u.salt) !== u.hash) return json(res, 401, { error: 'Wrong username or password' });
    return json(res, 200, { token: makeToken(u), role: u.role, username: u.username });
  }
  if (p === '/api/codes' && req.method === 'POST') {            // staff: make a QR
    const me = auth(req); if (!me) return json(res, 401, { error: 'Please log in' });
    const cups = parseInt((await body(req)).cups, 10);
    if (!(cups >= 1 && cups <= 10)) return json(res, 400, { error: 'Cups must be 1 to 10' });
    const c = { id: crypto.randomBytes(9).toString('base64url'), cups, createdBy: me.u, createdAt: Date.now(), expiresAt: Date.now() + CODE_LIFETIME, usedBy: null, usedAt: null };
    db.codes.push(c); save();
    return json(res, 200, c);
  }
  if (p === '/api/logs' && req.method === 'GET') {              // admin: every QR ever made
    if (!auth(req, 'admin')) return json(res, 403, { error: 'Admin only' });
    return json(res, 200, db.codes.slice().reverse());
  }
  if (p === '/api/users' && req.method === 'GET') {             // admin: list accounts
    if (!auth(req, 'admin')) return json(res, 403, { error: 'Admin only' });
    return json(res, 200, db.users.map(u => ({ username: u.username, role: u.role })));
  }
  if (p === '/api/users' && req.method === 'POST') {            // admin: create a staff account
    if (!auth(req, 'admin')) return json(res, 403, { error: 'Admin only' });
    const { username, password } = await body(req);
    if (!/^[a-z0-9_]{3,20}$/.test(username || '')) return json(res, 400, { error: 'Username: 3-20 letters (a-z), numbers or _' });
    if (String(password || '').length < 6) return json(res, 400, { error: 'Password must be at least 6 characters' });
    if (db.users.some(u => u.username === username)) return json(res, 409, { error: 'That username is taken' });
    db.users.push(mkUser(username, String(password), 'staff')); save();
    return json(res, 200, { username, role: 'staff' });
  }
  if (p.startsWith('/api/users/') && req.method === 'DELETE') { // admin: remove a staff account
    if (!auth(req, 'admin')) return json(res, 403, { error: 'Admin only' });
    const u = db.users.find(x => x.username === decodeURIComponent(p.slice(11)));
    if (!u || u.role === 'admin') return json(res, 400, { error: 'Cannot remove that account' });
    db.users = db.users.filter(x => x !== u); save();
    return json(res, 200, { removed: u.username });
  }
  if (p === '/api/redeem' && req.method === 'POST') {           // customer: scan result
    const { customerId, code } = await body(req);
    if (!/^[\w-]{6,64}$/.test(customerId || '')) return json(res, 400, { error: 'Missing customer id' });
    const c = db.codes.find(x => x.id === code);
    if (!c) return json(res, 404, { error: 'QR code not recognised' });
    if (c.usedBy) return json(res, 409, { error: 'This QR code was already used' });
    if (Date.now() > c.expiresAt) return json(res, 410, { error: 'This QR code has expired' });
    c.usedBy = customerId; c.usedAt = Date.now();
    const card = db.cards[customerId] = db.cards[customerId] || { total: 0 };
    card.total += c.cups; save();
    return json(res, 200, { added: c.cups, total: card.total });
  }
  if (p === '/api/card' && req.method === 'GET')
    return json(res, 200, { total: (db.cards[url.searchParams.get('customerId')] || { total: 0 }).total });

  // ---------- website files ----------
  // One public server: / = customer, /staff = staff, /admin = admin.
  if (req.method === 'GET' || req.method === 'HEAD') {
    let site = SITES.customer, rel = p;
    if (p === '/staff' || p.startsWith('/staff/')) { site = SITES.staff; rel = p.slice('/staff'.length) || '/'; }
    else if (p === '/admin' || p.startsWith('/admin/')) { site = SITES.admin; rel = p.slice('/admin'.length) || '/'; }
    if (rel === '/') rel = '/index.html';
    const file = path.normalize(path.join(site, rel));
    if (file.startsWith(site) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      const ext = path.extname(file).toLowerCase();
      const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.svg':'image/svg+xml', '.png':'image/png', '.jpg':'image/jpeg', '.jpeg':'image/jpeg', '.ico':'image/x-icon' };
      res.writeHead(200, { 'Content-Type': types[ext] || 'application/octet-stream', 'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=3600' });
      if (req.method === 'HEAD') return res.end();
      return fs.createReadStream(file).pipe(res);
    }
  }
  json(res, 404, { error: 'Not found' });
}).listen(PORT, () => console.log(`Stamp card app listening on port ${PORT}`));

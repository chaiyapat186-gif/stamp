// The ONE place the front end talks to the back end. Staff and admin pages both load this file.
const $ = id => document.getElementById(id);
let tok = sessionStorage.tok || '', role = sessionStorage.role || '';
const say = (t, ok) => { const m = $('msg'); m.hidden = !t; m.className = 'msg ' + (ok ? 'ok' : 'bad'); m.textContent = t; };
const esc = s => String(s).replace(/[&<>"']/g, c => '&#' + c.charCodeAt(0) + ';');

async function api(path, opts = {}) {   // fetch + token header + error handling
  const r = await fetch(API + path, { ...opts, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + tok } });
  const d = await r.json(); if (!r.ok) throw new Error(d.error || 'Something went wrong'); return d;
}
async function login(need) {            // need = role this page requires ('' = any)
  const d = await api('/api/login', { method: 'POST', body: JSON.stringify({ username: $('u').value, password: $('p').value }) });
  if (need && d.role !== need) throw new Error('This page needs an ' + need + ' account');
  tok = sessionStorage.tok = d.token; role = sessionStorage.role = d.role;
}
function logout() { sessionStorage.clear(); tok = role = ''; }

/* Pink House Baktouk - selection drawer + DM handoff.
   No cart, no checkout, no backend. The page builds a text list, copies it to
   the clipboard, and opens Telegram or Facebook. Neither t.me nor m.me accepts
   prefilled message text from a web link, so the clipboard is the handoff. */

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];

const KEY = 'ph-selection';
const money = n => '$' + n.toFixed(2);

/* ---------- state ---------- */

let items = [];
try { items = JSON.parse(localStorage.getItem(KEY)) || []; } catch { items = []; }

const save = () => localStorage.setItem(KEY, JSON.stringify(items));
const subtotal = list => list.reduce((s, i) => s + (i.price || 0) * i.qty, 0);

/* Order summary. Exported shape is the one thing worth a self-check. */
function buildSummary(list) {
  if (!list.length) return '';
  const lines = list.map(i => {
    const sku = i.sku ? ` (${i.sku})` : '';
    const price = i.price ? ` - ${money(i.price * i.qty)}` : ' - ask for price';
    return `${i.qty} x ${i.name}${sku}${price}`;
  });
  const total = subtotal(list);
  if (total) lines.push(`Subtotal: ${money(total)}`);
  return `Hi Pink House, I would like:\n${lines.join('\n')}`;
}

/* ---------- drawer render ---------- */

const list = $('#drawerList');
const empty = $('#drawerEmpty');
const countEl = $('#count');

function render() {
  list.innerHTML = '';
  items.forEach((it, n) => {
    const li = document.createElement('li');
    li.style.animationDelay = n * 50 + 'ms';
    li.innerHTML = `
      <div class="d-info">
        <strong></strong>
        <span></span>
      </div>
      <div class="qty">
        <button type="button" data-step="-1" aria-label="One less">&minus;</button>
        <output></output>
        <button type="button" data-step="1" aria-label="One more">+</button>
      </div>`;
    $('strong', li).textContent = it.name;
    $('span', li).textContent = it.price ? money(it.price * it.qty) : 'Ask for price';
    $('output', li).textContent = it.qty;
    $$('button', li).forEach(b => b.onclick = () => step(it.sku || it.name, +b.dataset.step));
    list.append(li);
  });

  empty.hidden = items.length > 0;
  const n = items.reduce((s, i) => s + i.qty, 0);
  countEl.textContent = n;
  countEl.classList.remove('pop');
  void countEl.offsetWidth;
  if (n) countEl.classList.add('pop');
  $('#total').textContent = money(subtotal(items));
  save();
}

function step(id, delta) {
  const i = items.findIndex(x => (x.sku || x.name) === id);
  if (i < 0) return;
  items[i].qty += delta;
  if (items[i].qty < 1) items.splice(i, 1);
  render();
}

/* ---------- add to selection ---------- */

$('#grid').addEventListener('click', e => {
  const btn = e.target.closest('.add');
  if (!btn) return;
  const { name, sku, price } = btn.dataset;
  const id = sku || name;
  const found = items.find(x => (x.sku || x.name) === id);
  if (found) found.qty++;
  else items.push({ name, sku, price: parseFloat(price) || 0, qty: 1 });
  render();

  const card = btn.closest('.card');
  card.classList.remove('added');
  void card.offsetWidth;
  card.classList.add('added');
  toast(`${name} added`);
});

/* ---------- filters ---------- */

const grid = $('#grid');
const gridEmpty = $('#gridEmpty');

$$('.pill').forEach(pill => pill.addEventListener('click', () => {
  const cat = pill.dataset.filter;
  $$('.pill').forEach(p => {
    const on = p === pill;
    p.classList.toggle('is-on', on);
    p.setAttribute('aria-pressed', on);
  });
  grid.classList.toggle('is-filtered', cat !== 'all');

  let shown = 0;
  $$('.card', grid).forEach(card => {
    const hide = cat !== 'all' && card.dataset.cat !== cat;
    card.classList.toggle('hidden', hide);
    card.classList.remove('swap');
    if (!hide) {
      void card.offsetWidth;
      card.style.animationDelay = shown * 45 + 'ms';
      card.classList.add('swap', 'in');
      shown++;
    }
  });
  gridEmpty.hidden = shown > 0;
}));

/* ---------- drawer open / close ---------- */

const drawer = $('#drawer');
const scrim = $('#scrim');
const openBtn = $('#openDrawer');
let lastFocus = null;

function openDrawer() {
  lastFocus = document.activeElement;
  drawer.hidden = scrim.hidden = false;
  void drawer.offsetWidth;
  drawer.classList.add('open');
  scrim.classList.add('open');
  openBtn.setAttribute('aria-expanded', 'true');
  document.body.style.overflow = 'hidden';
  $('#closeDrawer').focus();
}

function closeDrawer() {
  drawer.classList.remove('open');
  scrim.classList.remove('open');
  openBtn.setAttribute('aria-expanded', 'false');
  document.body.style.overflow = '';
  setTimeout(() => { drawer.hidden = scrim.hidden = true; }, 350);
  lastFocus?.focus();
}

openBtn.onclick = openDrawer;
$('#closeDrawer').onclick = closeDrawer;
scrim.onclick = closeDrawer;

drawer.addEventListener('keydown', e => {
  if (e.key === 'Escape') return closeDrawer();
  if (e.key !== 'Tab') return;
  const f = $$('button, [href]', drawer).filter(el => el.offsetParent);
  const edge = e.shiftKey ? f[0] : f.at(-1);
  if (document.activeElement === edge) {
    e.preventDefault();
    (e.shiftKey ? f.at(-1) : f[0]).focus();
  }
});

/* ---------- send ---------- */

async function send(btn) {
  if (!items.length) return toast('Pick a bag first', true);
  const link = btn.dataset.link;
  if (link.includes('PLACEHOLDER')) return toast('Chat link not set up yet', true);
  try {
    await navigator.clipboard.writeText(buildSummary(items));
    toast('List copied. Paste it in the chat.');
  } catch {
    toast('Could not copy. Screenshot your list.', true);
  }
  window.open(link, '_blank', 'noopener');
}

$('#sendTelegram').onclick = e => send(e.currentTarget);
$('#sendFacebook').onclick = e => send(e.currentTarget);

/* ---------- toast ---------- */

const toastEl = $('#toast');
let toastTimer;
function toast(msg, isErr = false) {
  toastEl.textContent = msg;
  toastEl.classList.toggle('err', isErr);
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
}

/* ---------- scroll reveal ---------- */

const reveals = $$('.reveal');
reveals.forEach((el, i) => el.style.setProperty('--i', i % 6));
const io = new IntersectionObserver((entries, obs) => {
  entries.forEach(en => {
    if (!en.isIntersecting) return;
    en.target.classList.add('in');
    obs.unobserve(en.target);
  });
}, { threshold: .15, rootMargin: '0px 0px -8%' });
reveals.forEach(el => io.observe(el));

/* ---------- boot ---------- */

$('#year').textContent = new Date().getFullYear();
render();

/* ---------- self-check: run with ?selfcheck in the URL ---------- */

if (location.search.includes('selfcheck')) {
  const got = buildSummary([
    { name: 'Flat Sacoche', sku: 'KTM16832-48', price: 13, qty: 2 },
    { name: 'Classic Backpack', sku: '', price: 0, qty: 1 },
  ]);
  const want =
    'Hi Pink House, I would like:\n' +
    '2 x Flat Sacoche (KTM16832-48) - $26.00\n' +
    '1 x Classic Backpack - ask for price\n' +
    'Subtotal: $26.00';
  console.assert(got === want, 'summary mismatch:\n' + got);
  console.assert(buildSummary([]) === '', 'empty list should be empty string');
  console.log('selfcheck done');
}

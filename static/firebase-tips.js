import firebaseApp from '/static/firebase-init.js';
import {
  getFirestore,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';

const db = getFirestore(firebaseApp);

const statusEl = document.getElementById('status');
const tipsGrid = document.getElementById('tipsGrid');
const emptyEl = document.getElementById('empty');

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function toDateMaybe(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts === 'number') return new Date(ts);
  if (ts instanceof Date) return ts;
  return null;
}

function render(tips) {
  tipsGrid.innerHTML = '';

  if (!tips.length) {
    tipsGrid.style.display = 'none';
    emptyEl.style.display = 'block';
    statusEl.textContent = '';
    return;
  }

  tips.forEach((t) => {
    const title = t.title || 'Tip';
    const text = t.text || '';
    const imageUrl = t.imageUrl || '';
    const d = toDateMaybe(t.createdAt);

    const el = document.createElement('div');
    el.className = 'tip';

    const imgHtml = imageUrl
      ? `<img class="img" src="${esc(imageUrl)}" alt="tip image" />`
      : '';

    el.innerHTML = `
      ${imgHtml}
      <div class="body">
        <h2>${esc(title)}</h2>
        <p>${esc(text)}</p>
        ${d ? `<div class="meta">${d.toLocaleString()}</div>` : ''}
      </div>
    `;

    tipsGrid.appendChild(el);
  });

  emptyEl.style.display = 'none';
  tipsGrid.style.display = 'grid';
  statusEl.textContent = '';
}

(async () => {
  try {
    const q = query(collection(db, 'tips'), orderBy('createdAt', 'desc'), limit(50));
    const snap = await getDocs(q);
    const tips = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    render(tips);
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Failed to load tips. Check Firestore rules.';
  }
})();

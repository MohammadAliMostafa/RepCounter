import firebaseApp from '/static/firebase-init.js';
import {
  getAuth,
  onAuthStateChanged,
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js';
import {
  getFirestore,
  collection,
  getDocs,
  addDoc,
  serverTimestamp,
  query,
  orderBy,
  doc,
  updateDoc,
  deleteDoc,
} from 'https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js';
import { loadProfile } from '/static/firebase-profile.js';

const auth = getAuth(firebaseApp);
const db = getFirestore(firebaseApp);

const statusEl = document.getElementById('status');
const adminUI = document.getElementById('adminUI');
const usersBody = document.getElementById('usersBody');
const filterInput = document.getElementById('filter');

const tipsBody = document.getElementById('tipsBody');
const tipTitleInput = document.getElementById('tipTitle');
const tipImageUrlInput = document.getElementById('tipImageUrl');
const tipTextInput = document.getElementById('tipText');
const addTipBtn = document.getElementById('addTipBtn');
const tipsMsg = document.getElementById('tipsMsg');

let allUsers = [];
let allTips = [];

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]));
}

function render(users) {
  usersBody.innerHTML = '';
  users.forEach((u) => {
    const tr = document.createElement('tr');

    const name = u.displayName || '(no name)';
    const isAdmin = !!u.isAdmin;

    tr.innerHTML = `
      <td>${esc(name)}</td>
      <td><span class="pill">${esc(u.id)}</span></td>
      <td>${isAdmin ? '<span class="pill">true</span>' : '<span class="pill danger">false</span>'}</td>
      <td>
        <div class="actions">
          <button class="btn gray" data-action="toggle-admin" data-uid="${esc(u.id)}">Toggle Admin</button>
          <button class="btn red" data-action="delete-profile" data-uid="${esc(u.id)}">Delete Profile</button>
        </div>
      </td>
    `;

    usersBody.appendChild(tr);
  });
}

function applyFilter() {
  const q = (filterInput?.value || '').trim().toLowerCase();
  if (!q) {
    render(allUsers);
    return;
  }
  const filtered = allUsers.filter((u) => {
    const name = String(u.displayName || '').toLowerCase();
    const uid = String(u.id || '').toLowerCase();
    return name.includes(q) || uid.includes(q);
  });
  render(filtered);
}

async function loadAllProfiles() {
  const snap = await getDocs(collection(db, 'profiles'));
  allUsers = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  applyFilter();
}

async function toggleAdmin(uid) {
  const ref = doc(db, 'profiles', uid);
  const user = allUsers.find((u) => u.id === uid);
  const next = !user?.isAdmin;
  await updateDoc(ref, { isAdmin: next });
  // Update local cache
  allUsers = allUsers.map((u) => (u.id === uid ? { ...u, isAdmin: next } : u));
  applyFilter();
}

async function deleteProfile(uid) {
  if (!confirm('Delete this profile document? This does NOT delete the Firebase Auth user.')) return;
  await deleteDoc(doc(db, 'profiles', uid));
  allUsers = allUsers.filter((u) => u.id !== uid);
  applyFilter();
}

usersBody?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  const uid = btn.getAttribute('data-uid');
  if (!action || !uid) return;

  btn.disabled = true;
  try {
    if (action === 'toggle-admin') {
      await toggleAdmin(uid);
    } else if (action === 'delete-profile') {
      await deleteProfile(uid);
    }
  } catch (err) {
    console.error(err);
    alert('Action failed: ' + (err.message || err));
  } finally {
    btn.disabled = false;
  }
});

filterInput?.addEventListener('input', applyFilter);

function toDateMaybe(ts) {
  if (!ts) return null;
  if (typeof ts.toDate === 'function') return ts.toDate();
  if (typeof ts === 'number') return new Date(ts);
  if (ts instanceof Date) return ts;
  return null;
}

function renderTips(tips) {
  if (!tipsBody) return;
  tipsBody.innerHTML = '';

  tips.forEach((t) => {
    const tr = document.createElement('tr');
    const created = toDateMaybe(t.createdAt);
    const hasImage = !!(t.imageUrl && String(t.imageUrl).trim());

    tr.innerHTML = `
      <td>${esc(t.title || 'Tip')}</td>
      <td>${hasImage ? '<span class="pill">yes</span>' : '<span class="pill danger">no</span>'}</td>
      <td>${created ? esc(created.toLocaleString()) : ''}</td>
      <td>
        <div class="actions">
          <button class="btn red" data-action="delete-tip" data-tipid="${esc(t.id)}">Delete</button>
        </div>
      </td>
    `;

    tipsBody.appendChild(tr);
  });
}

async function loadTips() {
  const q = query(collection(db, 'tips'), orderBy('createdAt', 'desc'));
  const snap = await getDocs(q);
  allTips = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  renderTips(allTips);
}

async function addTip() {
  if (!tipTextInput || !tipTitleInput) return;
  const title = String(tipTitleInput.value || '').trim();
  const text = String(tipTextInput.value || '').trim();
  const imageUrl = String(tipImageUrlInput?.value || '').trim();

  if (!text) {
    if (tipsMsg) tipsMsg.textContent = 'Tip text is required.';
    return;
  }

  await addDoc(collection(db, 'tips'), {
    title: title || 'Tip',
    text,
    imageUrl: imageUrl || null,
    createdAt: serverTimestamp(),
    createdByUid: auth.currentUser?.uid || null,
  });

  tipTitleInput.value = '';
  tipTextInput.value = '';
  if (tipImageUrlInput) tipImageUrlInput.value = '';
  if (tipsMsg) {
    tipsMsg.textContent = 'Added!';
    setTimeout(() => { if (tipsMsg) tipsMsg.textContent = ''; }, 1200);
  }

  await loadTips();
}

async function deleteTip(tipId) {
  if (!confirm('Delete this tip?')) return;
  await deleteDoc(doc(db, 'tips', tipId));
  allTips = allTips.filter((t) => t.id !== tipId);
  renderTips(allTips);
}

tipsBody?.addEventListener('click', async (e) => {
  const btn = e.target.closest('button');
  if (!btn) return;
  const action = btn.getAttribute('data-action');
  if (action !== 'delete-tip') return;
  const tipId = btn.getAttribute('data-tipid');
  if (!tipId) return;

  btn.disabled = true;
  try {
    await deleteTip(tipId);
  } catch (err) {
    console.error(err);
    alert('Delete failed: ' + (err.message || err));
  } finally {
    btn.disabled = false;
  }
});

addTipBtn?.addEventListener('click', async () => {
  addTipBtn.disabled = true;
  if (tipsMsg) tipsMsg.textContent = '';
  try {
    await addTip();
  } catch (err) {
    console.error(err);
    if (tipsMsg) tipsMsg.textContent = 'Add failed: ' + (err.message || err);
  } finally {
    addTipBtn.disabled = false;
  }
});

onAuthStateChanged(auth, async (user) => {
  adminUI.style.display = 'none';

  if (!user) {
    statusEl.innerHTML = 'Please <a href="/login">login</a> to access admin.';
    return;
  }

  statusEl.textContent = 'Checking admin permissions…';

  let profile = null;
  try {
    profile = await loadProfile();
  } catch (_) {
    // ignore
  }

  if (!profile || profile.isAdmin !== true) {
    statusEl.textContent = 'Access denied. Your profile does not have isAdmin=true.';
    return;
  }

  statusEl.textContent = '';
  adminUI.style.display = 'block';

  try {
    await loadAllProfiles();
    await loadTips();
  } catch (err) {
    console.error(err);
    statusEl.textContent = 'Failed to load users. Check Firestore rules.';
  }
});

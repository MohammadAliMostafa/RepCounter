// firebase-auth.js
import {
  getAuth,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import firebaseApp from './firebase-init.js';
import { saveProfile, loadProfile } from './firebase-profile.js';

const auth = getAuth(firebaseApp);

const DEFAULT_AVATAR = '/static/default-avatar.svg';

let _persistencePromise = null;
function ensurePersistence() {
  if (_persistencePromise) return _persistencePromise;
  _persistencePromise = setPersistence(auth, browserLocalPersistence).catch((err) => {
    // If persistence can't be set (browser restrictions), keep working with default.
    console.warn('Auth persistence not set:', err?.message || err);
  });
  return _persistencePromise;
}

export function initAuthUI() {
  onAuthStateChanged(auth, async (user) => {
    const signedInElems = document.querySelectorAll('[data-auth="signed-in"]');
    const signedOutElems = document.querySelectorAll('[data-auth="signed-out"]');
    if (user) {
      signedInElems.forEach(e => e.style.display = 'inline-block');
      signedOutElems.forEach(e => e.style.display = 'none');
      // show email initially (will be replaced by displayName if present)
      const userEmail = document.getElementById('userEmail');
      if (userEmail) userEmail.textContent = user.email;

      // load profile and set avatar and display name if present
      try {
        const profile = await loadProfile();
        const pic = document.getElementById('profilePic');
        if (pic) {
          pic.src = (profile && profile.avatarUrl) ? profile.avatarUrl : DEFAULT_AVATAR;
          pic.style.display = 'inline-block';
        }
        if (profile && profile.displayName && userEmail) {
          userEmail.textContent = profile.displayName;
        }
      } catch (err) {
        // fallback to default avatar and keep email
        const pic = document.getElementById('profilePic');
        if (pic) {
          pic.src = DEFAULT_AVATAR;
          pic.style.display = 'inline-block';
        }
      }
    } else {
      signedInElems.forEach(e => e.style.display = 'none');
      signedOutElems.forEach(e => e.style.display = 'inline-block');
      const pic = document.getElementById('profilePic');
      if (pic) pic.style.display = 'none';
    }
  });
}

export async function doSignup(email, password, username) {
  try {
    await ensurePersistence();
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    // Force token fetch so auth state is fully established before redirect.
    try { await userCredential.user.getIdToken(); } catch (_) {}
    // create default profile for new user
    const defaultProfile = {
      displayName: username || '',
      age: null,
      weight: null,
      height: null,
      gender: 1,
      reps: 0,
      avatarUrl: DEFAULT_AVATAR,
      isAdmin: false
    };
    try {
      await saveProfile(defaultProfile);
    } catch (err) {
      console.warn('Could not save default profile:', err);
    }
    return { success: true, user: userCredential.user };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function doLogin(email, password) {
  try {
    await ensurePersistence();
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    try { await userCredential.user.getIdToken(); } catch (_) {}
    return { success: true, user: userCredential.user };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

export async function doLogout() {
  try {
    await signOut(auth);
    return { success: true };
  } catch (err) {
    return { success: false, error: err.message };
  }
}

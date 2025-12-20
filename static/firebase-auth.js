// firebase-auth.js
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import firebaseApp from './firebase-init.js';
import { saveProfile, loadProfile } from './firebase-profile.js';

const auth = getAuth(firebaseApp);

const DEFAULT_AVATAR = '/static/default-avatar.svg';

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
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
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
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
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

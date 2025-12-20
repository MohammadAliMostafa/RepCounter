// firebase-profile.js
import { getFirestore, doc, setDoc, getDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAuth, EmailAuthProvider, reauthenticateWithCredential, updatePassword, deleteUser } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import firebaseApp from './firebase-init.js';

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

export async function loadProfile() {
  const user = auth.currentUser;
  if (!user) return null;
  const docRef = doc(db, 'profiles', user.uid);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return snap.data();
}

export async function saveProfile(profile) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const docRef = doc(db, 'profiles', user.uid);
  await setDoc(docRef, profile, { merge: true });
}

export async function changePassword(currentPassword, newPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');
  const cred = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, cred);
  await updatePassword(user, newPassword);
}

// Deletes the Firestore profile document and the Firebase Auth user.
// `currentPassword` (string) is required when the user's credentials are not recent.
export async function deleteProfile(currentPassword) {
  const user = auth.currentUser;
  if (!user) throw new Error('Not authenticated');

  // If a password was supplied, reauthenticate to ensure recent sign-in
  if (currentPassword) {
    const cred = EmailAuthProvider.credential(user.email, currentPassword);
    await reauthenticateWithCredential(user, cred);
  }

  // Remove Firestore profile doc first
  const docRef = doc(db, 'profiles', user.uid);
  await deleteDoc(docRef);

  // Then delete the Authentication user
  await deleteUser(user);
}

export default { loadProfile, saveProfile, changePassword, deleteProfile };

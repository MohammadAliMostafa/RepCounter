// firebase-sessions.js
import {
  getFirestore,
  collection,
  addDoc,
  query,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  Timestamp,
} from "https://www.gstatic.com/firebasejs/9.22.1/firebase-firestore.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-auth.js";
import firebaseApp from "./firebase-init.js";

const db = getFirestore(firebaseApp);
const auth = getAuth(firebaseApp);

function sessionsCollectionRef(uid) {
  return collection(db, "profiles", uid, "sessions");
}

export async function logSession(session) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const startedAtMs = session.startedAtMs ?? null;
  const endedAtMs = session.endedAtMs ?? null;

  const docData = {
    exercise: session.exercise ?? "",
    reps: Number(session.reps ?? 0),
    calories: Number(session.calories ?? 0),
    durationSec: Number(session.durationSec ?? 0),
    startedAt: startedAtMs ? Timestamp.fromMillis(startedAtMs) : null,
    endedAt: endedAtMs ? Timestamp.fromMillis(endedAtMs) : null,
    createdAt: serverTimestamp(),
  };

  return addDoc(sessionsCollectionRef(user.uid), docData);
}

export async function loadSessions({ max = 50 } = {}) {
  const user = auth.currentUser;
  if (!user) throw new Error("Not authenticated");

  const q = query(sessionsCollectionRef(user.uid), orderBy("createdAt", "desc"), limit(max));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export default { logSession, loadSessions };

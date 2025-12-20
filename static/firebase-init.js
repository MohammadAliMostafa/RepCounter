// firebase-init.js
// Initialize Firebase for the web app using modular SDK (ES modules)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/9.22.1/firebase-analytics.js";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBc4Jox-NdErqJJYU7BIhrcNW6iYHhpEOI",
  authDomain: "fittness-tracker-be343.firebaseapp.com",
  projectId: "fittness-tracker-be343",
  storageBucket: "fittness-tracker-be343.firebasestorage.app",
  messagingSenderId: "451307004598",
  appId: "1:451307004598:web:ddf073cc940befafc47c17",
  measurementId: "G-PKWZJS5FQQ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
try {
  const analytics = getAnalytics(app);
  console.log('Firebase initialized, analytics ready');
} catch (err) {
  // Analytics may fail in non-HTTPS or non-supported environments
  console.log('Firebase initialized (analytics may be unavailable):', err?.message || err);
}

export default app;

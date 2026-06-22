// Firebase Modular SDK (importing from CDN)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getDatabase } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

// Firebase Configuration
// Ganti dengan konfigurasi proyek Firebase Anda sendiri
const firebaseConfig = {
  apiKey: "ISI_CONFIG",
  authDomain: "ISI_CONFIG",
  databaseURL: "ISI_CONFIG",
  projectId: "ISI_CONFIG",
  storageBucket: "ISI_CONFIG",
  messagingSenderId: "ISI_CONFIG",
  appId: "ISI_CONFIG"
};

// Inisialisasi Firebase
const app = initializeApp(firebaseConfig);

// Inisialisasi Realtime Database
const db = getDatabase(app);

// Ekspor db agar dapat diimpor di script.js
export { db };

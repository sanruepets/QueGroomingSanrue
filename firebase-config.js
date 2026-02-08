// Firebase Configuration
// Replace with your actual Firebase project config keys
const firebaseConfig = {
    apiKey: "AIzaSyCa5hytLxjeGUZbUkCTSMIKTOL72J7J_hY",
    authDomain: "quegroomingsanrue.firebaseapp.com",
    projectId: "quegroomingsanrue",
    storageBucket: "quegroomingsanrue.firebasestorage.app",
    messagingSenderId: "939515937605",
    appId: "1:939515937605:web:4398219f99964ad570342c",
    measurementId: "G-3W82XJBRWF"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
window.db = db; // Make available globally for app.js

// Enable offline persistence
// Enable offline persistence with multi-tab support
db.enablePersistence({ synchronizeTabs: true })
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled in one tab at a a time.
            console.warn('Persistence failed: Multiple tabs open (persistence disabled in this tab)');
        } else if (err.code == 'unimplemented') {
            // The current browser does not support all of the features required to enable persistence
            console.warn('Persistence failed: Browser not supported');
        }
    });

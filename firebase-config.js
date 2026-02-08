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

// Force long polling for mobile devices (iOS WebKit compatibility)
const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
if (isMobile) {
    db.settings({ experimentalForceLongPolling: true });
}

window.db = db; // Make available globally for app.js


// Try to enable persistence, but don't block app if it fails (Safari private mode)
try {
    db.enablePersistence({ synchronizeTabs: true })
        .then(() => {
            console.log('✓ Offline persistence enabled');
        })
        .catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn('⚠️ Persistence disabled: Multiple tabs open');
            } else if (err.code === 'unimplemented') {
                console.warn('⚠️ Persistence not supported by browser');
            } else {
                console.warn('⚠️ Persistence failed:', err.code);
            }
            // App continues to work without persistence
        });
} catch (err) {
    console.warn('⚠️ Persistence initialization failed (likely private mode):', err);
    // App continues to work without persistence
}

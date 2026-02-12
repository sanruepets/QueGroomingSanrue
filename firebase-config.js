// Firebase Configuration
// Replace with your actual Firebase project config keys
const firebaseConfig = {
    apiKey: "AIzaSyCa5hytLxjeGUZbUkCTSMIKTOL72J7J_hY",
    authDomain: "quegroomingsanrue.firebaseapp.com",
    projectId: "quegroomingsanrue",
    storageBucket: "quegroomingsanrue.firebasestorage.app",
    messagingSenderId: "939515937605",
    appId: "1:939515937605:web:4398219f99964ad570342c",
    // measurementId: "G-3W82XJBRWF" // Disable Analytics for Safari compatibility
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();

// firebase.firestore.setLogLevel('debug'); // Turn off for production to reduce console noise

// Standard settings (Bypass experimental settings if onSnapshot is no longer used)
db.settings({
    merge: true
});

console.log('🔥 Firestore settings applied:', db._settings);

window.db = db; // Make available globally for app.js


// TEST: Enable persistence for offline support and faster loads
try {
    // Note: synchronizeTabs: true can sometimes hang in Safari/WebKit but is generally recommended
    db.enablePersistence({ synchronizeTabs: true })
        .then(() => {
            console.log('✓ Offline persistence enabled');
        })
        .catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn('⚠️ Persistence disabled: Multiple tabs open');
            } else if (err.code === 'unimplemented') {
                // console.warn('⚠️ Persistence not supported by browser');
            } else {
                console.warn('⚠️ Persistence failed:', err.code);
            }
        });
} catch (err) {
    console.warn('⚠️ Persistence initialization failed:', err);
}

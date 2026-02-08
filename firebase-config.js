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


// Detect private browsing mode (Safari private mode blocks IndexedDB)
function isPrivateMode() {
    return new Promise((resolve) => {
        const testKey = '__firebase_test__';
        try {
            if (!window.indexedDB) {
                resolve(true);
                return;
            }
            const request = indexedDB.open(testKey);
            request.onsuccess = () => {
                indexedDB.deleteDatabase(testKey);
                resolve(false);
            };
            request.onerror = () => resolve(true);
        } catch (e) {
            resolve(true);
        }
    });
}

// Enable offline persistence only if not in private browsing mode
isPrivateMode().then(isPrivate => {
    if (!isPrivate) {
        db.enablePersistence({ synchronizeTabs: true })
            .catch((err) => {
                if (err.code == 'failed-precondition') {
                    console.warn('Persistence failed: Multiple tabs open');
                } else if (err.code == 'unimplemented') {
                    console.warn('Persistence failed: Browser not supported');
                }
            });
    } else {
        console.log('🔒 Private browsing detected - running without offline persistence');
    }
});

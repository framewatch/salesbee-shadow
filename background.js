// background.js - Service Worker (Manifest V3 Module)

// --- 1. IMPORT FIREBASE SDKs ---
import "https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js";
import "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js";
import "https://www.gstatic.com/firebasejs/10.12.2/firebase-functions-compat.js";
import "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js";

// --- 2. INITIALIZE FIREBASE ---
const firebaseConfig = {
    apiKey: "AIzaSyBmCi2l_D-sW8wBVwW9p128BsFEyGQOuz0",
    authDomain: "salesbee-test.firebaseapp.com",
    projectId: "salesbee-test",
    storageBucket: "salesbee-test.firebasestorage.app",
    messagingSenderId: "519990493612",
    appId: "1:519990493612:web:9e49c76f8f683e4fb47a09",
    measurementId: "G-S28X5JZQ0Z"
};

let app, auth, functions, db;

try {
    if (self.firebase && !firebase.apps.length) {
      app = firebase.initializeApp(firebaseConfig);
      auth = firebase.auth();
      functions = app.functions('europe-west3');
      db = firebase.firestore();
    } else if (self.firebase) {
      app = firebase.app();
      auth = firebase.auth();
      functions = app.functions('europe-west3');
      db = firebase.firestore();
    }
} catch(e) {
    console.error("Error during Firebase initialization:", e);
}

// --- 3. MANAGE USER STATE ---
let userStatus = { user: null, isEmailVerified: false, isSubscribed: false, isVintedVerified: false, hasHadTrial: false, role: null };

const serializeUser = (user) => {
    if (!user) return null;
    return { uid: user.uid, email: user.email, displayName: user.displayName, emailVerified: user.emailVerified };
};

async function buildUserStatus(user) {
    if (!user) {
        userStatus = { user: null, isEmailVerified: false, isSubscribed: false, isVintedVerified: false, hasHadTrial: false, role: null };
        return userStatus;
    }
    try {
        await user.reload();
        const freshUser = auth.currentUser;
        if (!freshUser) {
             userStatus = { user: null, isEmailVerified: false, isSubscribed: false, isVintedVerified: false, hasHadTrial: false, role: null };
             return userStatus
        };

        const idTokenResult = await freshUser.getIdTokenResult();
        const stripeRole = idTokenResult.claims.stripeRole || null;
        let isSubscribed = !!stripeRole;
        let isVintedVerified = false;
        let hasHadTrial = false;
        const isEmailVerified = freshUser.emailVerified;

        if (db) {
            const customerRef = db.collection('customers').doc(freshUser.uid);
            const customerDoc = await customerRef.get();
            if (customerDoc.exists) {
                const customerData = customerDoc.data();
                if (customerData.vintedInfo) isVintedVerified = true;
                if (customerData.hasHadTrial === true) hasHadTrial = true;
                if (!isSubscribed) {
                    const subscriptionsRef = customerRef.collection('subscriptions');
                    const activeSubscriptionsQuery = subscriptionsRef.where('status', 'in', ['active', 'trialing']);
                    const querySnapshot = await activeSubscriptionsQuery.get();
                    if (!querySnapshot.empty) isSubscribed = true;
                }
            }
        }
        
        const finalStatus = { user: serializeUser(freshUser), isEmailVerified, isSubscribed, isVintedVerified, hasHadTrial, role: stripeRole };
        userStatus = finalStatus;
        return finalStatus;

    } catch (error) {
        console.error("Error building user status:", error);
        const errorStatus = { user: serializeUser(user), isEmailVerified: user.emailVerified, isSubscribed: false, isVintedVerified: false, hasHadTrial: false, role: null };
        userStatus = errorStatus;
        return userStatus;
    }
}

const broadcastStatusUpdate = () => {
    if (!chrome.tabs) return;
    chrome.tabs.query({}, (tabs) => {
        tabs.forEach(tab => {
            if (tab.id && tab.url && (tab.url.startsWith('http') || tab.url.startsWith('https'))) {
                chrome.tabs.sendMessage(tab.id, {
                    type: 'USER_STATUS_CHANGED',
                    payload: userStatus
                }).catch(err => {});
            }
        });
    });
};

if (auth) {
    auth.onAuthStateChanged(async (user) => {
        await buildUserStatus(user);
        broadcastStatusUpdate();
    });
}

// --- 4. LISTEN FOR MESSAGES ---
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!auth) {
      sendResponse({ success: false, error: "Firebase not initialized." });
      return true;
    }

    (async () => {
        let finalStatus;
        switch (message.type) {
            case 'GET_USER_STATUS':
                if (message.forceRefresh) {
                    const newStatus = await buildUserStatus(auth.currentUser);
                    broadcastStatusUpdate();
                    sendResponse(newStatus);
                } else {
                    sendResponse(userStatus);
                }
                break;

            case 'SEND_VERIFICATION_EMAIL':
                try {
                    await auth.currentUser.sendEmailVerification();
                    sendResponse({ success: true });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
                break;

            case 'LOGIN':
                try {
                    const userCredential = await auth.signInWithEmailAndPassword(message.payload.email, message.payload.password);
                    if (!userCredential.user.emailVerified) {
                        await userCredential.user.sendEmailVerification();
                    }
                    finalStatus = await buildUserStatus(userCredential.user);
                    sendResponse({ success: true, status: finalStatus });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
                break;

            case 'LOGOUT':
                try {
                    await auth.signOut();
                    finalStatus = await buildUserStatus(null);
                    sendResponse({ success: true, status: finalStatus });
                } catch (error) {
                    sendResponse({ success: false, error: error.message });
                }
                break;
            
            case 'START_FREE_TRIAL':
                if (!functions) return sendResponse({ success: false, error: "Functions not ready." });
                try {
                    const startFreeTrial = functions.httpsCallable('startFreeTrial');
                    await startFreeTrial();
                    finalStatus = await buildUserStatus(auth.currentUser);
                    sendResponse({ success: true, status: finalStatus });
                } catch (error) { // <-- CORRECTED SYNTAX
                    sendResponse({ success: false, error: error.message });
                }
                break;

            case 'LINK_VINTED_ACCOUNT':
                if (!functions) return sendResponse({ success: false, error: "Functions not ready." });
                try {
                    const linkVintedAccount = functions.httpsCallable('linkVintedAccount');
                    await linkVintedAccount({ vintedUsername: message.payload.vintedUsername });
                    finalStatus = await buildUserStatus(auth.currentUser);
                    sendResponse({ success: true, status: finalStatus });
                } catch (error) { // <-- CORRECTED SYNTAX
                    sendResponse({ success: false, error: error.message });
                }
                break;

            case 'USE_FEATURE':
                if (!functions) return sendResponse({ success: false, error: "Functions not ready." });
                try {
                    const useFeature = functions.httpsCallable('useFeature');
                    const result = await useFeature({ feature: message.payload.featureName });
                    sendResponse({ success: true, data: result.data });
                } catch (error) { // <-- CORRECTED SYNTAX
                    sendResponse({ success: false, error: error.message });
                }
                break;
        }
    })();

    return true; 
});

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
    getAuth,
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider,
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    updateProfile,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
    getFirestore,
    doc,
    getDoc,
    getDocs,
    setDoc,
    collection,
    query,
    where,
    orderBy,
    limit,
    onSnapshot,
    serverTimestamp,
    deleteDoc,
    updateDoc,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import {
    getStorage,
    ref as storageRef,
    uploadString,
    getDownloadURL,
    deleteObject,
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";

// ── YOUR FIREBASE CONFIG (replace with yours) ────────────────
const firebaseConfig = {
    apiKey:            "AIzaSyApxnv6GbVYM4aV3ubRA6eG1QWrgowscYM",
    authDomain:        "streamflex-app-d8624.firebaseapp.com",
    projectId:         "streamflex-app-d8624",
    storageBucket:     "streamflex-app-d8624.appspot.com",
    messagingSenderId: "919493990395",
    appId:             "1:919493990395:web:9e350a110a87d2c0c6dd5e",
};
// ────────────────────────────────────────────────────────────

const app  = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db   = getFirestore(app);
const storage = getStorage(app);
const googleProvider = new GoogleAuthProvider();
// Force Google account selection for better UX
googleProvider.setCustomParameters({ prompt: 'select_account' });

// Expose to global scope so script.js can use them
window._fb = {
    auth, db, storage, googleProvider,
    doc, getDoc, getDocs, setDoc, collection, query, where, orderBy, limit, onSnapshot, serverTimestamp,
    deleteDoc, updateDoc,
    storageRef, uploadString, getDownloadURL, deleteObject,
    signOut, sendPasswordResetEmail, signInWithEmailAndPassword,
    createUserWithEmailAndPassword, signInWithPopup, updateProfile, onAuthStateChanged
};

// ── Wait for DOM then boot auth ──────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
    bootAuth();
});

function bootAuth() {
    const authScreen  = document.getElementById('authScreen');
    const userBar     = document.getElementById('userBar');
    const mainApp     = document.getElementById('mainApp');
    const header      = document.querySelector('header');

    // ── Auth state listener ──────────────────────────────────
    onAuthStateChanged(auth, async (user) => {
        if (user) {
            // Logged in — show app
            authScreen.style.display  = 'none';
            userBar.style.display     = 'flex';
            if (mainApp) mainApp.style.display = '';
            if (header)  header.style.display  = '';

            // Update user bar
            const displayName = user.displayName || user.email.split('@')[0];
            const firstName   = displayName.split(' ')[0];
            document.getElementById('userBarName').textContent  = firstName;
            document.getElementById('userBarEmail').textContent = user.email;
            const avatarEl = document.getElementById('userBarAvatar');
            if (user.photoURL) {
                avatarEl.innerHTML = `<img src="${user.photoURL}" alt="${firstName}">`;
            } else {
                avatarEl.textContent = firstName.charAt(0).toUpperCase();
            }

            // Signal script.js that user is ready
            window.dispatchEvent(new CustomEvent('sf:userReady', { detail: { uid: user.uid, user } }));

            // Load user data from Firestore
            await loadUserData(user.uid);

        } else {
            // Not logged in — show auth screen, hide app
            authScreen.style.display  = 'flex';
            userBar.style.display     = 'none';
            if (mainApp) mainApp.style.display = 'none';
            if (header)  header.style.display  = 'none';
        }
    });

    // ── Tab switching with pill animation ────────────────────
    document.getElementById('authTabLogin')?.addEventListener('click', () => {
        setAuthTab('login');
        document.querySelector('.auth-toggle-pill')?.classList.remove('right');
    });
    document.getElementById('authTabRegister')?.addEventListener('click', () => {
        setAuthTab('register');
        document.querySelector('.auth-toggle-pill')?.classList.add('right');
    });

    // ── Login ────────────────────────────────────────────────
    document.getElementById('loginBtn')?.addEventListener('click', async () => {
        const email    = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errEl    = document.getElementById('loginError');
        clearError(errEl);
        setLoading('loginBtn', true);
        try {
            await signInWithEmailAndPassword(auth, email, password);
        } catch(e) {
            showError(errEl, firebaseErrorMsg(e.code));
        }
        setLoading('loginBtn', false);
    });

    // Enter key on login fields
    ['loginEmail','loginPassword'].forEach(id => {
        document.getElementById(id)?.addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('loginBtn')?.click();
        });
    });

    // ── Show/hide password toggles ───────────────────────────
    setupEyeToggle('toggleLoginPwd', 'loginPassword');
    setupEyeToggle('toggleRegPwd',   'regPassword');

    // ── Password strength meter ──────────────────────────────
    document.getElementById('regPassword')?.addEventListener('input', e => {
        const val  = e.target.value;
        const bar  = document.querySelector('.auth-strength-bar');
        if (!bar) return;
        let score = 0;
        if (val.length >= 6)  score++;
        if (val.length >= 10) score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;
        const pct   = (score / 5) * 100;
        const color = score <= 1 ? '#cc0000' : score <= 3 ? '#c9a84c' : '#4ade80';
        bar.style.width = pct + '%';
        bar.style.background = color;
    });

    // ── Register ─────────────────────────────────────────────
    document.getElementById('registerBtn')?.addEventListener('click', async () => {
        const name  = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const pass  = document.getElementById('regPassword').value;
        const pass2 = document.getElementById('regPassword2').value;
        const errEl = document.getElementById('registerError');
        clearError(errEl);
        if (!name)            return showError(errEl, 'El nombre es obligatorio.');
        if (pass !== pass2)   return showError(errEl, 'Las contraseñas no coinciden.');
        if (pass.length < 6)  return showError(errEl, 'La contraseña debe tener al menos 6 caracteres.');
        setLoading('registerBtn', true);
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            await updateProfile(cred.user, { displayName: name });
            // Init empty profile in Firestore
            await setDoc(doc(db, 'users', cred.user.uid), {
                displayName: name,
                email,
                createdAt: serverTimestamp(),
                favorites: [], watchLater: [], watchHistory: [],
                top10List: [], userRatings: {}, userNotes: {},
                customLists: {}, achievements: {}, streakData: { streak:0, longest:0, lastWatch:null },
                marathonQueue: [],
            });
        } catch(e) {
            showError(errEl, firebaseErrorMsg(e.code));
        }
        setLoading('registerBtn', false);
    });

    // ── Google sign-in ───────────────────────────────────────
    document.getElementById('googleSignInBtn')?.addEventListener('click', async () => {
        try {
            const result = await signInWithPopup(auth, googleProvider);
            const user   = result.user;
            // First time? create doc
            const snap = await getDoc(doc(db, 'users', user.uid));
            if (!snap.exists()) {
                await setDoc(doc(db, 'users', user.uid), {
                    displayName: user.displayName || '',
                    email: user.email,
                    createdAt: serverTimestamp(),
                    favorites: [], watchLater: [], watchHistory: [],
                    top10List: [], userRatings: {}, userNotes: {},
                    customLists: {}, achievements: {}, streakData: { streak:0, longest:0, lastWatch:null },
                    marathonQueue: [],
                });
            }
        } catch(e) {
            const errEl = document.getElementById('loginError');
            console.error('Google sign-in failed:', e);
            showError(errEl, firebaseErrorMsg(e.code));
        }
    });

    // ── Forgot password ──────────────────────────────────────
    document.getElementById('forgotPasswordBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const errEl = document.getElementById('loginError');
        if (!email) return showError(errEl, 'Escribe tu email arriba primero.');
        try {
            await sendPasswordResetEmail(auth, email);
            showError(errEl, '✅ Email de recuperación enviado. Revisa tu bandeja.', 'success');
        } catch(e) {
            showError(errEl, firebaseErrorMsg(e.code));
        }
    });

    // ── Logout ───────────────────────────────────────────────
    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        const user = auth.currentUser;
        const name = user?.displayName || user?.email?.split('@')[0] || 'usuario';

        // Use custom dialog if available, fallback to native confirm
        const confirmed = typeof sfConfirm === 'function'
            ? await sfConfirm({
                icon: '👋',
                kanji: 'ログアウト',
                title: 'Cerrar sesión',
                body: `¿Seguro que quieres salir, ${name}? Tu progreso está guardado en la nube.`,
                confirmText: '<i class="fas fa-sign-out-alt"></i> Salir',
                cancelText: 'Quedarse',
                variant: 'warning'
              })
            : confirm('¿Cerrar sesión?');

        if (!confirmed) return;
        await signOut(auth);
    });
}

// ── Load user data from Firestore into script.js globals ─────
async function loadUserData(uid) {
    const syncEl = document.getElementById('syncStatus');
    if (syncEl) { syncEl.innerHTML = '<i class="fas fa-sync fa-spin"></i> Sincronizando...'; syncEl.className = 'user-bar-sync syncing'; }

    try {
        const snap = await getDoc(doc(db, 'users', uid));
        if (snap.exists()) {
            const data = snap.data();
            // Push into script.js globals
            window._sfLoadUserData(data);
        }
        if (syncEl) { syncEl.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sincronizado'; syncEl.className = 'user-bar-sync'; }
    } catch(e) {
        console.error('Error loading user data:', e);
        if (syncEl) { syncEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Sin conexión'; syncEl.className = 'user-bar-sync error'; }
    }
}

// ── Save user data to Firestore ──────────────────────────────
window._sfSaveToCloud = async function(data) {
    const user = auth.currentUser;
    if (!user) return;
    const syncEl = document.getElementById('syncStatus');
    try {
        if (syncEl) { syncEl.innerHTML = '<i class="fas fa-sync fa-spin"></i> Guardando...'; syncEl.className = 'user-bar-sync syncing'; }
        await setDoc(doc(db, 'users', user.uid), { ...data, updatedAt: serverTimestamp() }, { merge: true });
        if (syncEl) { syncEl.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sincronizado'; syncEl.className = 'user-bar-sync'; }
    } catch(e) {
        if (syncEl) { syncEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error al guardar'; syncEl.className = 'user-bar-sync error'; }
    }
};

// ── Helper: eye toggle ───────────────────────────────────────
function setupEyeToggle(btnId, inputId) {
    const btn   = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
        const isText = input.type === 'text';
        input.type = isText ? 'password' : 'text';
        btn.innerHTML = isText ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });
}

// ── Error message helpers ────────────────────────────────────
function firebaseErrorMsg(code) {
    const msgs = {
        'auth/invalid-email':          'El correo no es válido.',
        'auth/user-not-found':         'No existe una cuenta con ese correo.',
        'auth/wrong-password':         'Contraseña incorrecta.',
        'auth/email-already-in-use':   'Ese correo ya tiene una cuenta registrada.',
        'auth/weak-password':          'La contraseña es demasiado débil (mínimo 6 caracteres).',
        'auth/too-many-requests':      'Demasiados intentos. Espera un momento.',
        'auth/network-request-failed': 'Error de red. Verifica tu conexión.',
        'auth/popup-closed-by-user':   'Ventana de Google cerrada. Inténtalo de nuevo.',
        'auth/invalid-credential':     'Credenciales incorrectas. Verifica tu email y contraseña.',
    };
    return msgs[code] || `Error: ${code}`;
}
function setAuthTab(tab) {
    // Toggle active class on buttons
    document.getElementById('authTabLogin')?.classList.toggle('active', tab === 'login');
    document.getElementById('authTabRegister')?.classList.toggle('active', tab === 'register');
    // Show/hide forms
    document.getElementById('authFormLogin')?.classList.toggle('active', tab === 'login');
    document.getElementById('authFormRegister')?.classList.toggle('active', tab === 'register');
    // Move pill
    const pill = document.querySelector('.auth-toggle-pill');
    if (pill) pill.classList.toggle('right', tab === 'register');
    // Clear errors
    ['loginError','registerError'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.style.display = 'none'; el.textContent = ''; }
    });
}
function showError(el, msg, type='error') {
    el.textContent = msg;
    el.style.display = 'block';
    el.className = type === 'success' ? 'auth-success' : 'auth-error';
}
function clearError(el) { el.style.display = 'none'; el.textContent = ''; }
function setLoading(btnId, loading) {
    const btn = document.getElementById(btnId);
    if (!btn) return;
    btn.disabled = loading;
    if (loading) btn.dataset.orig = btn.innerHTML;
    btn.innerHTML = loading ? '<i class="fas fa-spinner fa-spin"></i> Espera...' : (btn.dataset.orig || btn.innerHTML);
}

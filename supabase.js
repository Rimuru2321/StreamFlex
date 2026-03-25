import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";

const SUPABASE_URL = "https://exahvybdsbrwgavycnhk.supabase.co";
const SUPABASE_KEY = "sb_publishable_zWLgFAuxmQtK4M-et792hA_gwYJnC7P";

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

window._sb = supabase;

function supabaseErrorMsg(error) {
    const msgs = {
        'invalid_email': 'El correo no es válido.',
        'user_not_found': 'No existe una cuenta con ese correo.',
        'invalid_login_credentials': 'Contraseña incorrecta.',
        'email_already_exists': 'Ese correo ya tiene una cuenta registrada.',
        'weak_password': 'La contraseña es demasiado débil (mínimo 6 caracteres).',
        'too_many_requests': 'Demasiados intentos. Espera un momento.',
        'network_error': 'Error de red. Verifica tu conexión.',
        'popup_closed': 'Ventana de Google cerrada. Inténtalo de nuevo.',
        'invalid_credentials': 'Credenciales incorrectas. Verifica tu email y contraseña.',
    };
    const msg = error?.message || '';
    for (const [key, val] of Object.entries(msgs)) {
        if (msg.includes(key)) return val;
    }
    return `Error: ${msg}`;
}

document.addEventListener('DOMContentLoaded', () => {
    bootAuth();
});

async function bootAuth() {
    const authScreen = document.getElementById('authScreen');
    const userBar = document.getElementById('userBar');
    const mainApp = document.getElementById('mainApp');
    const header = document.querySelector('header');

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
        if (session?.user) {
            const user = session.user;
            authScreen.style.display = 'none';
            userBar.style.display = 'flex';
            if (mainApp) mainApp.style.display = '';
            if (header) header.style.display = '';

            const displayName = user.user_metadata?.display_name || user.email.split('@')[0];
            const firstName = displayName.split(' ')[0];
            document.getElementById('userBarName').textContent = firstName;
            document.getElementById('userBarEmail').textContent = user.email;
            const avatarEl = document.getElementById('userBarAvatar');
            const savedIcon = localStorage.getItem('sf_avatarIcon') || '';
            if (savedIcon) avatarEl.textContent = savedIcon;
            else avatarEl.textContent = firstName.charAt(0).toUpperCase();

            window.dispatchEvent(new CustomEvent('sf:userReady', { detail: { uid: user.id, user } }));

            await loadUserData(user.id);

        } else {
            authScreen.style.display = 'flex';
            userBar.style.display = 'none';
            if (mainApp) mainApp.style.display = 'none';
            if (header) header.style.display = 'none';
        }
    });

    document.getElementById('authTabLogin')?.addEventListener('click', () => {
        setAuthTab('login');
        document.querySelector('.auth-toggle-pill')?.classList.remove('right');
    });
    document.getElementById('authTabRegister')?.addEventListener('click', () => {
        setAuthTab('register');
        document.querySelector('.auth-toggle-pill')?.classList.add('right');
    });

    document.getElementById('loginBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;
        const errEl = document.getElementById('loginError');
        clearError(errEl);
        setLoading('loginBtn', true);
        try {
            const { error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) throw error;
        } catch(e) {
            showError(errEl, supabaseErrorMsg(e));
        }
        setLoading('loginBtn', false);
    });

    ['loginEmail','loginPassword'].forEach(id => {
        document.getElementById(id)?.addEventListener('keydown', e => {
            if (e.key === 'Enter') document.getElementById('loginBtn')?.click();
        });
    });

    setupEyeToggle('toggleLoginPwd', 'loginPassword');
    setupEyeToggle('toggleRegPwd', 'regPassword');

    document.getElementById('regPassword')?.addEventListener('input', e => {
        const val = e.target.value;
        const bar = document.querySelector('.auth-strength-bar');
        if (!bar) return;
        let score = 0;
        if (val.length >= 6) score++;
        if (val.length >= 10) score++;
        if (/[A-Z]/.test(val)) score++;
        if (/[0-9]/.test(val)) score++;
        if (/[^A-Za-z0-9]/.test(val)) score++;
        const pct = (score / 5) * 100;
        const color = score <= 1 ? '#cc0000' : score <= 3 ? '#c9a84c' : '#4ade80';
        bar.style.width = pct + '%';
        bar.style.background = color;
    });

    document.getElementById('registerBtn')?.addEventListener('click', async () => {
        const name = document.getElementById('regName').value.trim();
        const email = document.getElementById('regEmail').value.trim();
        const pass = document.getElementById('regPassword').value;
        const pass2 = document.getElementById('regPassword2').value;
        const errEl = document.getElementById('registerError');
        clearError(errEl);
        if (!name) return showError(errEl, 'El nombre es obligatorio.');
        if (pass !== pass2) return showError(errEl, 'Las contraseñas no coinciden.');
        if (pass.length < 6) return showError(errEl, 'La contraseña debe tener al menos 6 caracteres.');
        setLoading('registerBtn', true);
        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password: pass,
                options: { data: { display_name: name } }
            });
            if (error) throw error;

            if (data.user) {
                const { error: profileError } = await supabase.from('profiles').upsert({
                    id: data.user.id,
                    display_name: name,
                    email: email,
                    favorites: [],
                    watch_later: [],
                    watch_history: [],
                    top10_list: [],
                    user_ratings: {},
                    user_notes: {},
                    custom_lists: {},
                    achievements: {},
                    streak_data: { streak: 0, longest: 0, lastWatch: null },
                    marathon_queue: [],
                }, { onConflict: 'id', ignoreDuplicates: true });
                if (profileError) console.warn('Profile auto-created by trigger:', profileError.message);
            }
        } catch(e) {
            showError(errEl, supabaseErrorMsg(e));
        }
        setLoading('registerBtn', false);
    });

    document.getElementById('googleSignInBtn')?.addEventListener('click', async () => {
        try {
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: `${window.location.origin}${window.location.pathname}`
                }
            });
            if (error) throw error;
        } catch(e) {
            const errEl = document.getElementById('loginError');
            console.error('Google sign-in failed:', e);
            showError(errEl, supabaseErrorMsg(e));
        }
    });

    document.getElementById('forgotPasswordBtn')?.addEventListener('click', async () => {
        const email = document.getElementById('loginEmail').value.trim();
        const errEl = document.getElementById('loginError');
        if (!email) return showError(errEl, 'Escribe tu email arriba primero.');
        try {
            const { error } = await supabase.auth.resetPasswordForEmail(email, {
                redirectTo: `${window.location.origin}${window.location.pathname}`
            });
            if (error) throw error;
            showError(errEl, '✅ Email de recuperación enviado. Revisa tu bandeja.', 'success');
        } catch(e) {
            showError(errEl, supabaseErrorMsg(e));
        }
    });

    document.getElementById('logoutBtn')?.addEventListener('click', async () => {
        const { data: { user } } = await supabase.auth.getUser();
        const name = user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'usuario';

        const confirmed = typeof sfConfirm === 'function'
            ? await sfConfirm({
                icon: '👋',
                kanji: 'Salir',
                title: 'Cerrar sesión',
                body: `¿Seguro que quieres salir, ${name}? Tu progreso está guardado en la nube.`,
                confirmText: '<i class="fas fa-sign-out-alt"></i> Salir',
                cancelText: 'Quedarse',
                variant: 'warning'
              })
            : confirm('¿Cerrar sesión?');

        if (!confirmed) return;
        await supabase.auth.signOut();
    });
}

async function loadUserData(uid) {
    const syncEl = document.getElementById('syncStatus');
    if (syncEl) { syncEl.innerHTML = '<i class="fas fa-sync fa-spin"></i> Sincronizando...'; syncEl.className = 'user-bar-sync syncing'; }

    try {
        const { data, error } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .single();

        if (data) {
            const mappedData = {
                displayName: data.display_name,
                email: data.email,
                favorites: data.favorites || [],
                watchLater: data.watch_later || [],
                watchHistory: data.watch_history || [],
                top10List: data.top10_list || [],
                userRatings: data.user_ratings || {},
                userNotes: data.user_notes || {},
                customLists: data.custom_lists || {},
                achievements: data.achievements || {},
                streakData: data.streak_data || { streak: 0, longest: 0, lastWatch: null },
                marathonQueue: data.marathon_queue || [],
                avatarIcon: data.avatar_icon || '',
                isPremium: data.is_premium || false,
                friends: data.friends || [],
            };
            window._sfLoadUserData(mappedData);
        }
        if (syncEl) { syncEl.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sincronizado'; syncEl.className = 'user-bar-sync'; }
    } catch(e) {
        console.error('Error loading user data:', e);
        if (syncEl) { syncEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Sin conexión'; syncEl.className = 'user-bar-sync error'; }
    }
}

window._sfSaveToCloud = async function(data) {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const syncEl = document.getElementById('syncStatus');
    try {
        if (syncEl) { syncEl.innerHTML = '<i class="fas fa-sync fa-spin"></i> Guardando...'; syncEl.className = 'user-bar-sync syncing'; }

        const updateData = {
            favorites: data.favorites || [],
            watch_later: data.watchLater || [],
            watch_history: data.watchHistory || [],
            top10_list: data.top10List || [],
            user_ratings: data.userRatings || {},
            user_notes: data.userNotes || {},
            custom_lists: data.customLists || {},
            achievements: data.achievements || {},
            streak_data: data.streakData || {},
            marathon_queue: data.marathonQueue || [],
            avatar_icon: data.avatarIcon || '',
            display_name: data.displayName || '',
            is_premium: data.isPremium,
            friends: data.friends || [],
            updated_at: new Date().toISOString(),
        };

        await supabase
            .from('profiles')
            .upsert(updateData, { onConflict: 'id' })
            .eq('id', user.id);

        if (syncEl) { syncEl.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sincronizado'; syncEl.className = 'user-bar-sync'; }
    } catch(e) {
        if (syncEl) { syncEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error al guardar'; syncEl.className = 'user-bar-sync error'; }
    }
};

function setupEyeToggle(btnId, inputId) {
    const btn = document.getElementById(btnId);
    const input = document.getElementById(inputId);
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
        const isText = input.type === 'text';
        input.type = isText ? 'password' : 'text';
        btn.innerHTML = isText ? '<i class="fas fa-eye"></i>' : '<i class="fas fa-eye-slash"></i>';
    });
}

function setAuthTab(tab) {
    document.getElementById('authTabLogin')?.classList.toggle('active', tab === 'login');
    document.getElementById('authTabRegister')?.classList.toggle('active', tab === 'register');
    document.getElementById('authFormLogin')?.classList.toggle('active', tab === 'login');
    document.getElementById('authFormRegister')?.classList.toggle('active', tab === 'register');
    const pill = document.querySelector('.auth-toggle-pill');
    if (pill) pill.classList.toggle('right', tab === 'register');
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

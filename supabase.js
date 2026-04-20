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
    console.log('Supabase error:', error);
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
            const savedIcon = SFStorage.getItem('sf_avatarIcon') || '';
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
        if (!email) return showError(errEl, 'El email es obligatorio.');
        if (!password) return showError(errEl, 'La contraseña es obligatoria.');
        setLoading('loginBtn', true);
        try {
            console.log('Intentando login con:', email);
            const { data, error } = await supabase.auth.signInWithPassword({ email, password });
            if (error) {
                console.error('Error login:', error);
                throw error;
            }
            console.log('Login exitoso:', data);
        } catch(e) {
            console.error('Login error:', e);
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
            const currentUrl = window.location.origin + window.location.pathname;
            const { data, error } = await supabase.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    redirectTo: currentUrl
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

async function loadUserData(uid, retryCount = 0) {
    const maxRetries = 3;
    const syncEl = document.getElementById('syncStatus');
    console.log('[SYNC] Iniciando carga de datos para usuario:', uid);
    console.log('[SYNC] Supabase URL:', SUPABASE_URL);
    
    if (syncEl) { 
        syncEl.innerHTML = '<i class="fas fa-sync fa-spin"></i> Sincronizando...'; 
        syncEl.className = 'user-bar-sync syncing'; 
    }

    // Timeout de 30 segundos (las consultas pueden tardar en ambiente serverless)
    const timeoutMs = 30000;
    const timeoutPromise = new Promise((_, reject) => 
        setTimeout(() => reject(new Error('Timeout: La consulta tardó más de 30 segundos')), timeoutMs)
    );

    try {
        console.log('[SYNC] Consultando perfil en Supabase...');
        
        // Usar limit(1) en lugar de single() para evitar el error de múltiples filas
        const queryPromise = supabase
            .from('profiles')
            .select('*')
            .eq('id', uid)
            .limit(1);

        const { data, error } = await Promise.race([queryPromise, timeoutPromise]);
        
        console.log('[SYNC] Respuesta de Supabase - data:', data, 'error:', error);

        if (error) {
            console.error('[SYNC] Error de Supabase:', error.message || error, 'Code:', error.code);
            
            // Si es error 406, probablemente la tabla no existe o RLS la bloquea
            // Intentar crear la tabla o usar datos locales
            if (error.code === '406' || error.message?.includes('406') || error.code === 'PGRST116') {
                console.warn('[SYNC] Error 406/GRST116 - La tabla profiles puede no existir o estar bloqueada');
                console.warn('[SYNC] Necesitas ejecutar el SQL de setup en Supabase');
                handleOfflineMode(syncEl);
                return;
            }
            throw error;
        }

        // data puede ser un array vacío si no existe el perfil
        if (!data || data.length === 0) {
            console.warn('[SYNC] No se encontró perfil para el usuario, creando...');
            try {
                const { data: { user } } = await supabase.auth.getUser();
                if (user) {
                    const { error: insertError } = await supabase.from('profiles').insert({
                        id: user.id,
                        email: user.email,
                        display_name: user.user_metadata?.display_name || user.email.split('@')[0],
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
                        is_premium: false,
                        friends: []
                    });
                    
                    if (insertError) {
                        console.error('[SYNC] Error al crear perfil:', insertError);
                        handleOfflineMode(syncEl);
                    } else {
                        console.log('[SYNC] Perfil creado, recargando...');
                        loadUserData(uid, 0);
                        return;
                    }
                }
            } catch(e) {
                console.error('[SYNC] Error creando perfil:', e);
                handleOfflineMode(syncEl);
            }
            return;
        }

        const profileData = data[0];
        console.log('[SYNC] Datos recibidos:', Object.keys(profileData));
        
        const mappedData = {
            displayName: profileData.display_name,
            email: profileData.email,
            favorites: profileData.favorites || [],
            watchLater: profileData.watch_later || [],
            watchHistory: profileData.watch_history || [],
            top10List: profileData.top10_list || [],
            userRatings: profileData.user_ratings || {},
            userNotes: profileData.user_notes || {},
            customLists: profileData.custom_lists || {},
            achievements: profileData.achievements || {},
            streakData: profileData.streak_data || { streak: 0, longest: 0, lastWatch: null },
            marathonQueue: profileData.marathon_queue || [],
            avatarIcon: profileData.avatar_icon || '',
            isPremium: profileData.is_premium || false,
            friends: profileData.friends || [],
        };
        
        console.log('[SYNC] Datos mapeados, llamando a _sfLoadUserData...');
        window._sfLoadUserData(mappedData);
        
        const lastSync = SFStorage.getItem('lastSyncTime');
        const syncTime = lastSync ? new Date(parseInt(lastSync)).toLocaleString('es-ES') : 'Nunca';
        if (syncEl) { 
            syncEl.innerHTML = `<i class="fas fa-check-circle"></i> Sincronizado (${syncTime})`; 
            syncEl.className = 'user-bar-sync';
        }
        console.log('[SYNC] Carga completada exitosamente');
        
    } catch(e) {
        const errMsg = e?.message || String(e);
        console.error('[SYNC] Error loading user data:', errMsg);
        
        // Error de lock de Supabase: otro tab/proceso tiene el lock del auth token.
        // Reintentar con delay más largo o caer a modo offline.
        const isLockError = errMsg.includes('Lock') || errMsg.includes('lock');
        
        if (isLockError && retryCount < maxRetries) {
            console.log(`[SYNC] Lock error detectado, reintentando con delay largo (${retryCount + 1}/${maxRetries})...`);
            if (syncEl) { 
                syncEl.innerHTML = `<i class="fas fa-sync fa-spin"></i> Esperando lock (${retryCount + 1}/${maxRetries})...`; 
            }
            setTimeout(() => loadUserData(uid, retryCount + 1), 3000 * (retryCount + 1));
            return;
        }
        
        if (retryCount < maxRetries) {
            console.log(`[SYNC] Reintentando carga de datos (${retryCount + 1}/${maxRetries})...`);
            if (syncEl) { 
                syncEl.innerHTML = `<i class="fas fa-sync fa-spin"></i> Reintentando (${retryCount + 1}/${maxRetries})...`; 
            }
            setTimeout(() => loadUserData(uid, retryCount + 1), 2000 * (retryCount + 1));
            return;
        }
        
        // Tras agotar reintentos: activar modo offline y cargar datos locales
        console.warn('[SYNC] Reintentos agotados, activando modo offline');
        handleOfflineMode(syncEl);
    }
}

function handleOfflineMode(syncEl) {
    console.warn('[SYNC] Activando modo offline - usando datos locales');
    if (syncEl) { 
        syncEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Modo offline'; 
        syncEl.className = 'user-bar-sync error';
    }
    SFStorage.setItem('sf_offline_mode', 'true');
    
    // Cargar datos desde SFStorage
    const localData = {
        favorites: JSON.parse(SFStorage.getItem('favorites') || '[]'),
        watchLater: JSON.parse(SFStorage.getItem('watchLater') || '[]'),
        watchHistory: JSON.parse(SFStorage.getItem('watchHistory') || '[]'),
        userRatings: JSON.parse(SFStorage.getItem('userRatings') || '{}'),
        userNotes: JSON.parse(SFStorage.getItem('userNotes') || '{}'),
        customLists: JSON.parse(SFStorage.getItem('customLists') || '{}'),
        achievements: JSON.parse(SFStorage.getItem('achievements') || '{}'),
        streakData: JSON.parse(SFStorage.getItem('streakData') || '{"streak":0,"longest":0}'),
        avatarIcon: SFStorage.getItem('sf_avatarIcon') || '',
    };
    
    console.log('[SYNC] Datos cargados desde SFStorage');
    window._sfLoadUserData(localData);
}

window._sfSaveToCloud = async function(data, retryCount = 0) {
    const maxRetries = 3;
    const syncEl = document.getElementById('syncStatus');
    console.log('[SYNC] Intentando guardar datos en la nube...');
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.warn('[SYNC] No hay usuario logueado, no se puede guardar');
        return;
    }
    
    // Timeout de 30 segundos para guardado
    const timeoutMs = 30000;
    
    const updateData = {
        id: user.id,
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
    
    try {
        if (syncEl) { 
            syncEl.innerHTML = '<i class="fas fa-sync fa-spin"></i> Guardando...'; 
            syncEl.className = 'user-bar-sync syncing'; 
        }

        console.log('[SYNC] Preparando datos para guardar...', Object.keys(updateData));
        
        // Usar timeout para el guardado también
        const savePromise = supabase
            .from('profiles')
            .upsert(updateData, { onConflict: 'id' });
            
        const { error } = await Promise.race([savePromise, new Promise((_, reject) => 
            setTimeout(() => reject(new Error('Timeout: Guardado tardó más de 30 segundos')), timeoutMs)
        )]);

        if (error) {
            console.error('[SYNC] Error al guardar:', error);
            throw error;
        }

        console.log('[SYNC] Guardado exitoso');
        
        if (syncEl) { 
            syncEl.innerHTML = '<i class="fas fa-check-circle"></i> Sincronizado'; 
            syncEl.className = 'user-bar-sync';
            setTimeout(() => {
                if (syncEl && syncEl.className !== 'user-bar-sync syncing') {
                    syncEl.innerHTML = '<i class="fas fa-cloud-upload-alt"></i> Sincronizado';
                }
            }, 2000);
        }
        
        SFStorage.setItem('lastSyncTime', Date.now());
        SFStorage.removeItem('pendingSync');
        
    } catch(e) {
        const errMsg = e?.message || String(e);
        console.error('[SYNC] Error al guardar en la nube:', errMsg);
        
        const isLockError = errMsg.includes('Lock') || errMsg.includes('lock');
        const retryDelay = isLockError ? 3000 * (retryCount + 1) : 2000 * (retryCount + 1);
        
        if (retryCount < maxRetries) {
            console.log(`[SYNC] Reintentando sincronización (${retryCount + 1}/${maxRetries})${isLockError ? ' [lock error]' : ''}...`);
            if (syncEl) { 
                syncEl.innerHTML = '<i class="fas fa-sync fa-spin"></i> Reintentando...'; 
            }
            setTimeout(() => {
                window._sfSaveToCloud(data, retryCount + 1);
            }, retryDelay);
            return;
        }
        
        if (syncEl) { 
            syncEl.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Sin conexión'; 
            syncEl.className = 'user-bar-sync error';
        }
        
        SFStorage.setItem('pendingSync', JSON.stringify(data));
    }
};

function checkPendingSync() {
    const pendingData = SFStorage.getItem('pendingSync');
    if (pendingData) {
        try {
            const data = JSON.parse(pendingData);
            window._sfSaveToCloud(data);
            SFStorage.removeItem('pendingSync');
        } catch(e) {
            console.error('Error al procesar sincronización pendiente:', e);
        }
    }
}

setInterval(checkPendingSync, 30000);

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

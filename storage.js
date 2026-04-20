/**
 * SFStorage - Storage abstraction layer for Capacitor compatibility.
 * Uses in-memory cache for synchronous access, with @capacitor/preferences
 * for persistence. Falls back to in-memory-only when Capacitor is unavailable.
 */
(function() {
    const cache = {};
    let Preferences = null;
    let ready = false;
    let saveTimer = null;
    const pendingKeys = new Set();

    async function init() {
        try {
            const mod = await import('@capacitor/preferences');
            Preferences = mod.Preferences;
        } catch(e) {
            Preferences = null;
        }
        await loadAll();
        ready = true;
        window.dispatchEvent(new Event('sfStorage:ready'));
    }

    async function loadAll() {
        if (!Preferences) return;
        try {
            const { value } = await Preferences.keys();
            const keys = JSON.parse(value || '[]');
            if (keys.length === 0) return;
            const results = await Promise.all(
                keys.map(k => Preferences.get({ key: k }).catch(() => ({ value: null })))
            );
            results.forEach((r, i) => {
                if (r.value !== null) cache[keys[i]] = r.value;
            });
        } catch(e) {
            console.warn('[SFStorage] Error loading preferences:', e);
        }
    }

    function scheduleSave(key) {
        pendingKeys.add(key);
        clearTimeout(saveTimer);
        saveTimer = setTimeout(flushPending, 200);
    }

    async function flushPending() {
        if (!Preferences || pendingKeys.size === 0) return;
        const keys = [...pendingKeys];
        pendingKeys.clear();
        try {
            await Promise.all(keys.map(k =>
                Preferences.set({ key: k, value: cache[k] !== undefined ? cache[k] : '' })
            ));
            const { value } = await Preferences.keys();
            const allKeys = JSON.parse(value || '[]');
            const newKeys = [...new Set([...allKeys, ...keys])];
            await Preferences.set({ key: '__sf_keys', value: JSON.stringify(newKeys) });
        } catch(e) {
            console.warn('[SFStorage] Error saving:', e);
        }
    }

    window.SFStorage = {
        getItem(key) {
            const v = cache[key];
            return v !== undefined ? v : null;
        },
        setItem(key, value) {
            cache[key] = String(value);
            scheduleSave(key);
        },
        removeItem(key) {
            delete cache[key];
            if (Preferences) {
                Preferences.remove({ key }).catch(() => {});
            }
        },
        async clear() {
            Object.keys(cache).forEach(k => delete cache[k]);
            if (Preferences) {
                try { await Preferences.clear(); } catch(e) {}
            }
        },
        get isReady() { return ready; },
        async waitForReady() {
            if (ready) return;
            return new Promise(resolve => {
                window.addEventListener('sfStorage:ready', resolve, { once: true });
            });
        }
    };

    init();
})();

(function runIntro() {
    const el = document.getElementById('introScreen');
    if (!el) return;

    const lastIntro = parseInt(localStorage.getItem('lastIntro') || '0');
    const now = Date.now();
    if (now - lastIntro < 60 * 60 * 1000) {
        el.style.display = 'none';
        return;
    }
    localStorage.setItem('lastIntro', now);

    const fill     = document.getElementById('introBarFill');
    const barText  = document.getElementById('introBarText');
    const countdown = document.getElementById('introCountdown');

    const steps = [
        { pct: 15,  text: 'Cargando...', delay: 400 },
        { pct: 35,  text: 'Cargando bibliotecas...', delay: 300 },
        { pct: 55,  text: 'Cargando películas...', delay: 250 },
        { pct: 75,  text: 'Casi listo...', delay: 200 },
        { pct: 92,  text: 'Iniciando...', delay: 150 },
        { pct: 100, text: '¡LISTO!', delay: 100 },
    ];

    let t = 2300;
    steps.forEach(step => {
        t += step.delay;
        setTimeout(() => {
            if (fill) fill.style.width = step.pct + '%';
            if (barText) barText.textContent = step.text;
        }, t);
    });

    let flashT = t + 200;
    [1, 2, 3].forEach((_, i) => {
        flashT += 80;
        setTimeout(() => {
            if (countdown) {
                countdown.classList.remove('show');
                void countdown.offsetWidth;
                countdown.classList.add('show');
            }
        }, flashT);
    });

    const exitT = flashT + 300;
    setTimeout(() => {
        el.classList.add('intro-exit');
        setTimeout(() => { el.style.display = 'none'; }, 850);
    }, exitT);
})();

const API_KEY = '808c0f44efd9afa0e316f4c383a0dc1e';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMG_BASE = 'https://image.tmdb.org/t/p/w300';
const IMG_ORIGINAL = 'https://image.tmdb.org/t/p/original';
const IMG_PROFILE = 'https://image.tmdb.org/t/p/w185';

let LANGUAGE = 'es-ES';
let REGION   = 'ES';


const _tmdbCache = new Map();
async function tmdbFetch(url) {
    if (_tmdbCache.has(url)) return _tmdbCache.get(url);
    const promise = fetch(url).then(r => r.json()).catch(e => { _tmdbCache.delete(url); throw e; });
    _tmdbCache.set(url, promise);
    return promise;
}

const I18N = {
    'es-ES': {
        search:      'Buscar películas...',
        all:         'Todo',
        forYou:      'Para ti',
        upcoming:    'Próximamente',
        profile:     'Perfil',
        popular:     '⭐ Popular',
        favorites:   'Favoritos',
        watchLater:  'Ver después',
        history:     'Historial',
        stats:       'Estadísticas',
        challenges:  'Desafíos',
        achievements:'Logros',
        ranking:     'Ranking',
        friends:     'Amigos',
        play:        'Reproducir',
        noRating:    'Sin valorar',
        myRating:    'Tu valoración',
        myNote:      'Nota',
        notePlaceholder: 'Añadir nota...',
        saveNote:    'Guardar',
        popularMovies: 'Películas populares',
        sectionUpcoming: 'Próximos estrenos',
        home:        'Inicio',
        lang:        'ES',
        synopsis:    'Sinopsis no disponible.',
    },
};

function t(key) { return (I18N[LANGUAGE] || I18N['es-ES'])[key] || key; }

function applyLang(lang) {
    // Language switching is disabled; app always uses Spanish.
    LANGUAGE = 'es-ES';
    REGION   = 'ES';
    loadGenres().then(() => refreshCurrentView());
}

function sfConfirm({ icon='⚠️', kanji='OK', title='¿Estás seguro?', body='', confirmText='Confirmar', cancelText='Cancelar', variant='danger' } = {}) {
    return new Promise(resolve => {
        const overlay = document.getElementById('sfDialogOverlay');
        const dialog  = document.getElementById('sfDialog');
        if (!overlay) { resolve(window.confirm(body || title)); return; }

        document.getElementById('sfDialogIcon').textContent  = icon;
        document.getElementById('sfDialogKanji').textContent = kanji;
        document.getElementById('sfDialogTitle').textContent = title;
        document.getElementById('sfDialogBody').textContent  = body;

        dialog.className = `sf-dialog variant-${variant}`;

        const actions = document.getElementById('sfDialogActions');
        actions.className = 'sf-dialog-actions row';
        actions.innerHTML = `
            <button class="sf-btn sf-btn-cancel" id="sfBtnCancel" style="flex:1">${cancelText}</button>
            <button class="sf-btn sf-btn-${variant==='warning'?'primary':'danger'}" id="sfBtnConfirm" style="flex:1">${confirmText}</button>
        `;

        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';

        const close = (result) => {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
            resolve(result);
        };

        document.getElementById('sfBtnConfirm').onclick = () => close(true);
        document.getElementById('sfBtnCancel').onclick  = () => close(false);
        overlay.onclick = e => { if (e.target === overlay) close(false); };
    });
}

const moviesGrid      = document.getElementById('moviesGrid');
const searchInput     = document.getElementById('searchInput');
const searchBtn       = document.getElementById('searchBtn');
const navBtns         = document.querySelectorAll('.nav-btn');
const sectionTitle    = document.getElementById('sectionTitle');
const sectionCount    = document.getElementById('sectionCount');
const modal           = document.getElementById('modal');
const modalBody       = document.getElementById('modalBody');
const closeModalBtn   = document.querySelector('.close');
const genresContainer = document.getElementById('genresContainer');
const heroBanner      = document.getElementById('heroBanner');
const heroBg          = document.getElementById('heroBg');
const gridViewBtn     = document.getElementById('gridViewBtn');
const listViewBtn     = document.getElementById('listViewBtn');
const filterBar       = document.getElementById('filterBar');
const sortSelect      = document.getElementById('sortSelect');
const themeToggleBtn  = document.getElementById('themeToggle');

let isPremium          = JSON.parse(localStorage.getItem('sf_premium')) || false;
let premiumTheme       = localStorage.getItem('sf_theme') || 'red';
let currentView        = 'all';
let currentGenre       = 'popular';
let currentData        = [];
let favorites          = JSON.parse(localStorage.getItem('favorites'))    || [];
let watchLater         = JSON.parse(localStorage.getItem('watchLater'))   || [];
let watchHistory       = JSON.parse(localStorage.getItem('watchHistory')) || [];
let userRatings        = JSON.parse(localStorage.getItem('userRatings'))  || {};
let userNotes          = JSON.parse(localStorage.getItem('userNotes'))    || {};
let genresList         = [];
let tvGenresList       = [];
let currentPage        = 1;
let totalPages         = 1;
let isLoadingMore      = false;
let currentMediaType   = 'movie';
let currentSortBy      = 'popularity.desc';
let isSearchMode       = false;
let currentSearchQuery = '';
let isPersonSearch     = false;
let listSortBy         = 'default';
let searchMode         = 'content'; // 'content' | 'person'
let currentDecade      = ''; // '' | '70s' | '80s' | '90s' | '2000s' | '2010s' | '2020s'
let customLists        = JSON.parse(localStorage.getItem('customLists')) || {};

let advFilters = { ratingMin: 0, runtimeMax: 0, language: '', voteMin: 0 };
let cinemaMode = { active: false, itemId: null, type: null, serverIndex: 0 };

let marathonQueue    = JSON.parse(localStorage.getItem('marathonQueue'))    || [];
let seriesProgress   = JSON.parse(localStorage.getItem('seriesProgress'))   || {};
let userBio          = localStorage.getItem('sf_bio') || '';
let profileBg        = localStorage.getItem('sf_profileBg') || '';
const AVATAR_ICONS = ['👤','🤖','🎃','👾','👽','🐺','💀','👻','🐶','🐵','🐯','👺','🐸','🕊️','🐭','🐱'];
let userAvatarIcon   = localStorage.getItem('sf_avatarIcon') || '';
let top10List        = JSON.parse(localStorage.getItem('top10List'))        || [];
let searchHistory    = JSON.parse(localStorage.getItem('searchHistory'))    || [];
let streakData       = JSON.parse(localStorage.getItem('streakData'))       || { lastWatch: null, streak: 0, longest: 0 };
let achievements     = JSON.parse(localStorage.getItem('achievements'))     || {};
let deferredInstall  = null;

let currentUid = null;
let cloudSaveTimer = null;
let leaderboardUnsubscribe = null;

function getDefaultAvatarIcon(seed='') {
    if (!seed) return AVATAR_ICONS[0];
    let hash = 0;
    for (let i = 0; i < seed.length; i++) {
        hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
    }
    return AVATAR_ICONS[hash % AVATAR_ICONS.length];
}

window._sfLoadUserData = function(data) {
    if (data.favorites)    { favorites    = data.favorites;    }
    if (data.watchLater)   { watchLater   = data.watchLater;   }
    if (data.watchHistory) { watchHistory = data.watchHistory; }
    if (data.top10List)    { top10List    = data.top10List;    }
    if (data.userRatings)  { userRatings  = data.userRatings;  }
    if (data.userNotes)    { userNotes    = data.userNotes;    }
    if (data.customLists)  { customLists  = data.customLists;  }
    if (data.achievements) { achievements = data.achievements; }
    if (data.streakData)   { streakData   = data.streakData;   }
    if (data.marathonQueue){ marathonQueue= data.marathonQueue;}
    if (data.avatarIcon)   {
        userAvatarIcon = data.avatarIcon;
        localStorage.setItem('sf_avatarIcon', userAvatarIcon);
    }
    if (!userAvatarIcon) {
        userAvatarIcon = getDefaultAvatarIcon(currentUid || data.email || '');
        localStorage.setItem('sf_avatarIcon', userAvatarIcon);
        cloudSave();
    }
    const userBarAvatar = document.getElementById('userBarAvatar');
    if (userBarAvatar && userAvatarIcon) userBarAvatar.textContent = userAvatarIcon;

    if (data.isPremium === true) {
        isPremium = true;
        localStorage.setItem('sf_premium', '1');
    } else if (data.isPremium === false) {

        isPremium = false;
        localStorage.removeItem('sf_premium');
        localStorage.removeItem('sf_theme');
        applyPremiumTheme('red');
    }

    if (currentView === 'profile') loadProfileView();
    updateMarathonPanel();
};

function cloudSave() {
    if (!window._sfSaveToCloud) return;
    clearTimeout(cloudSaveTimer);
    cloudSaveTimer = setTimeout(() => {
        window._sfSaveToCloud({
            favorites, watchLater, watchHistory, top10List,
            userRatings, userNotes, customLists, achievements,
            streakData, marathonQueue,
            avatarIcon: userAvatarIcon,
        });
    }, 2500);
}

// Native loading="lazy" + decoding="async" handles lazy loading without JS overhead

document.addEventListener('DOMContentLoaded', async () => {
    applyTheme(localStorage.getItem('theme') || 'dark');

    const savedLang = localStorage.getItem('sf_lang') || 'es-ES';
    // Idioma fijo en español (no hay selección de idioma)
    LANGUAGE = 'es-ES';
    REGION = 'ES';
    const si = document.getElementById('searchInput');
    if (si) si.placeholder = t('search');

    if (isPremium && localStorage.getItem('sf_theme') && localStorage.getItem('sf_theme') !== 'red') {
        setTimeout(() => applyPremiumTheme(localStorage.getItem('sf_theme')), 50);
    }
    setupEventListeners();
    initCardDelegation();
    setupInfiniteScroll();
    await loadGenres();
});

window.addEventListener('sf:userReady', async (e) => {
    currentUid = e.detail.uid;
    await loadPopularMovies();
});

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('theme', theme);
    const icon = themeToggleBtn.querySelector('i');
    icon.className = theme === 'dark' ? 'fas fa-sun' : 'fas fa-moon';
    themeToggleBtn.title = theme === 'dark' ? 'Modo claro' : 'Modo oscuro';
}

function applyPremiumTheme(t) {
    if (!isPremium) { t = 'red'; }
    const themes = {
        red:    {'--red':'#cc0000','--red-bright':'#ff1a1a','--red-dark':'#8b0000','--red-glow':'rgba(204,0,0,0.4)'},
        blue:   {'--red':'#0066cc','--red-bright':'#1a8aff','--red-dark':'#004a99','--red-glow':'rgba(0,102,204,0.4)'},
        green:  {'--red':'#00a550','--red-bright':'#00cc66','--red-dark':'#007a3a','--red-glow':'rgba(0,165,80,0.4)'},
        purple: {'--red':'#7b2dcc','--red-bright':'#9b4dff','--red-dark':'#5a1f99','--red-glow':'rgba(123,45,204,0.4)'},
        gold:   {'--red':'#c9a84c','--red-bright':'#f0d080','--red-dark':'#9a7b2e','--red-glow':'rgba(201,168,76,0.4)'},
    };
    const th = themes[t] || themes.red;
    Object.entries(th).forEach(([k,v]) => document.documentElement.style.setProperty(k,v));
    premiumTheme = t;
    if (isPremium) localStorage.setItem('sf_theme', t);
}
function toggleTheme() {
    applyTheme((document.documentElement.getAttribute('data-theme') || 'dark') === 'dark' ? 'light' : 'dark');
}

function getUserRating(itemId) { return userRatings[String(itemId)] || 0; }
function setUserRating(itemId, stars) {
    userRatings[String(itemId)] = stars;
    localStorage.setItem('userRatings', JSON.stringify(userRatings));
    cloudSave();
}
function renderStars(itemId, interactive = false) {
    const current = getUserRating(itemId);
    const stars = [1,2,3,4,5].map(n => {
        const filled = n <= current;
        return interactive
            ? `<button class="star-btn ${filled ? 'filled' : ''}" data-id="${itemId}" data-star="${n}"><i class="fas fa-star"></i></button>`
            : `<span class="star-display ${filled ? 'filled' : ''}"><i class="fas fa-star"></i></span>`;
    }).join('');
    return `<div class="${interactive ? 'star-rating-interactive' : 'star-rating-display'}">${stars}</div>`;
}

function getUserNote(itemId) { return userNotes[String(itemId)] || ''; }
function setUserNote(itemId, note) {
    if (note.trim()) userNotes[String(itemId)] = note.trim();
    else delete userNotes[String(itemId)];
    localStorage.setItem('userNotes', JSON.stringify(userNotes));
}

function addToHistory(item, type) {
    if (!item) return;
    watchHistory = watchHistory.filter(h => h.id !== item.id);
    watchHistory.unshift({ ...item, _type: type, _watchedAt: Date.now() });
    if (!isPremium && watchHistory.length > 50) watchHistory = watchHistory.slice(0, 50);
    localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
    cloudSave();
    updateStreak();
    checkAchievements();
}
function isWatched(itemId) { return watchHistory.some(h => h.id === Number(itemId)); }

function exportData() {
    const data = {
        exportDate: new Date().toISOString(),
        version: 2,
        favorites,
        watchLater,
        watchHistory,
        userRatings,
        userNotes
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = `streamflex-backup-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('<i class="fas fa-download"></i> Datos exportados correctamente');
}

function importData(file) {
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const data = JSON.parse(e.target.result);
            if (!data.version) throw new Error('Formato inválido');
            if (data.favorites)    { favorites    = data.favorites;    localStorage.setItem('favorites',    JSON.stringify(favorites)); }
            if (data.watchLater)   { watchLater   = data.watchLater;   localStorage.setItem('watchLater',   JSON.stringify(watchLater)); }
            if (data.watchHistory) { watchHistory = data.watchHistory; localStorage.setItem('watchHistory', JSON.stringify(watchHistory)); }
            if (data.userRatings)  { userRatings  = data.userRatings;  localStorage.setItem('userRatings',  JSON.stringify(userRatings)); }
            if (data.userNotes)    { userNotes    = data.userNotes;    localStorage.setItem('userNotes',    JSON.stringify(userNotes)); }
            showToast('<i class="fas fa-check"></i> Datos importados correctamente');
            refreshCurrentView();
        } catch(err) {
            showToast('<i class="fas fa-exclamation-triangle"></i> Error: archivo inválido');
        }
    };
    reader.readAsText(file);
}

function sortList(items, sortBy) {
    const copy = [...items];
    switch(sortBy) {
        case 'title_asc':   return copy.sort((a,b) => (a.title||a.name||'').localeCompare(b.title||b.name||''));
        case 'title_desc':  return copy.sort((a,b) => (b.title||b.name||'').localeCompare(a.title||a.name||''));
        case 'year_desc':   return copy.sort((a,b) => ((b.release_date||b.first_air_date||'')<(a.release_date||a.first_air_date||'') ? -1 : 1));
        case 'year_asc':    return copy.sort((a,b) => ((a.release_date||a.first_air_date||'')<(b.release_date||b.first_air_date||'') ? -1 : 1));
        case 'rating_desc': return copy.sort((a,b) => (b.vote_average||0) - (a.vote_average||0));
        case 'myrating_desc': return copy.sort((a,b) => getUserRating(b.id) - getUserRating(a.id));
        case 'added_asc':   return copy.reverse();
        default:            return copy;
    }
}

function renderListToolbar(view) {
    const hasNote = view !== 'all' && view !== 'recommended';
    if (!hasNote) return '';
    return `
        <div class="list-toolbar" id="listToolbar">
            <div class="list-sort-group">
                <label><i class="fas fa-sort"></i> Ordenar</label>
                <select id="listSortSelect">
                    <option value="default" ${listSortBy==='default'?'selected':''}>Por defecto</option>
                    <option value="added_asc" ${listSortBy==='added_asc'?'selected':''}>Más antiguos primero</option>
                    <option value="title_asc" ${listSortBy==='title_asc'?'selected':''}>Título A-Z</option>
                    <option value="title_desc" ${listSortBy==='title_desc'?'selected':''}>Título Z-A</option>
                    <option value="year_desc" ${listSortBy==='year_desc'?'selected':''}>Año más reciente</option>
                    <option value="year_asc" ${listSortBy==='year_asc'?'selected':''}>Año más antiguo</option>
                    <option value="rating_desc" ${listSortBy==='rating_desc'?'selected':''}>Mejor puntuación</option>
                    <option value="myrating_desc" ${listSortBy==='myrating_desc'?'selected':''}>Mi mejor valoración</option>
                </select>
            </div>
            <div class="list-actions-group">
                <button class="list-action-btn" id="exportBtn" title="Exportar datos"><i class="fas fa-download"></i> Exportar</button>
                <label class="list-action-btn" title="Importar datos" style="cursor:pointer">
                    <i class="fas fa-upload"></i> Importar
                    <input type="file" id="importFile" accept=".json" style="display:none">
                </label>
            </div>
        </div>`;
}

function getTopGenresFromFavorites() {
    const genreCount = {};
    favorites.forEach(fav => {
        if (fav.genre_ids) fav.genre_ids.forEach(gid => { genreCount[gid] = (genreCount[gid]||0)+1; });
    });
    return Object.entries(genreCount).sort((a,b)=>b[1]-a[1]).slice(0,3).map(([id])=>id);
}
async function loadRecommendations() {
    const topGenres = getTopGenresFromFavorites();
    showLoading();
    heroBanner.classList.remove('visible');

    moviesGrid.className = 'movies-grid';
    const sectionHeader = document.querySelector('.section-header');
    if (sectionHeader) sectionHeader.style.display = 'flex';
    if (!topGenres.length) {
        moviesGrid.innerHTML = `<div class="empty-state"><span class="empty-kanji">好</span><p>Añade películas a favoritos para recibir recomendaciones personalizadas</p></div>`;
        sectionTitle.textContent = 'Recomendado para ti';
        sectionCount.textContent = '';
        return;
    }
    try {
        const favIds = new Set(favorites.map(f => f.id));
        const genreParam = topGenres.join('|');
        const [p1, p2] = await Promise.all([
            fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&language=${LANGUAGE}&with_genres=${genreParam}&sort_by=vote_average.desc&vote_count.gte=200&page=1`),
            fetch(`${BASE_URL}/discover/movie?api_key=${API_KEY}&language=${LANGUAGE}&with_genres=${genreParam}&sort_by=popularity.desc&page=2`)
        ]);
        const d1 = await p1.json(); const d2 = await p2.json();
        const seen = new Set();
        const filtered = [...(d1.results||[]), ...(d2.results||[])]
            .filter(m => { if (seen.has(m.id)||favIds.has(m.id)) return false; seen.add(m.id); return true; })
            .slice(0, 40);
        currentData = filtered;
        displayItems(filtered, 'movie');
        sectionTitle.textContent = 'Recomendado para ti';
        const usedNames = topGenres.map(id=>genresList.find(g=>g.id==id)?.name).filter(Boolean).join(', ');
        const subtitle = document.createElement('p');
        subtitle.className = 'reco-subtitle';
        subtitle.textContent = `Basado en tus géneros favoritos: ${usedNames}`;
        document.querySelector('.section-header').after(subtitle);
    } catch(e) { console.error('Error recomendaciones:', e); }
}

async function searchPerson(query) {
    showLoading();
    heroBanner.classList.remove('visible');
    isPersonSearch = true;
    cleanupExtras();
    moviesGrid.className = moviesGrid.classList.contains('list-view') ? 'movies-grid list-view' : 'movies-grid';
    try {
        const data = await tmdbFetch(`${BASE_URL}/search/person?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=${LANGUAGE}&page=1`);
        const persons = data.results || [];
        if (!persons.length) {
            moviesGrid.innerHTML = `<div class="empty-state"><span class="empty-kanji">人</span><p>No se encontraron personas</p></div>`;
            sectionTitle.textContent = `Persona: "${query}"`;
            sectionCount.textContent = '';
            return;
        }
        renderPersonResults(persons, query);
    } catch(e) { console.error('Error búsqueda persona:', e); }
}
function renderPersonResults(persons, query) {
    sectionTitle.textContent = `Personas · "${query}"`;
    sectionCount.textContent = `${persons.length} resultados`;
    moviesGrid.innerHTML = persons.slice(0,12).map((p,i) => {
        const photo = p.profile_path ? `https://image.tmdb.org/t/p/w185${p.profile_path}` : 'https://placehold.co/185x278/1a1a1a/666?text=?';
        const knownFor = (p.known_for||[]).map(k=>k.title||k.name).slice(0,2).join(', ');
        return `<div class="person-card" data-person-id="${p.id}" style="animation-delay:${i*0.05}s">
            <img src="${photo}" alt="${p.name}" loading="lazy">
            <div class="person-info">
                <div class="person-name">${p.name}</div>
                <div class="person-dept">${p.known_for_department||''}</div>
                <div class="person-known">${knownFor}</div>
            </div>
        </div>`;
    }).join('');
    document.querySelectorAll('.person-card').forEach(card => {
        card.addEventListener('click', () => loadPersonMovies(card.dataset.personId, card.querySelector('.person-name').textContent));
    });
}
async function loadPersonMovies(personId, personName) {
    isPersonSearch = false;
    showLoading();
    try {
        const [creditsRes, detailRes] = await Promise.all([
            fetch(`${BASE_URL}/person/${personId}/combined_credits?api_key=${API_KEY}&language=${LANGUAGE}`),
            fetch(`${BASE_URL}/person/${personId}?api_key=${API_KEY}&language=${LANGUAGE}`)
        ]);
        const creditsData = await creditsRes.json();
        const personData  = await detailRes.json();
        const photo = personData.profile_path ? `https://image.tmdb.org/t/p/w185${personData.profile_path}` : null;
        const bioHeader = document.createElement('div');
        bioHeader.className = 'person-bio-header';
        bioHeader.innerHTML = `
            ${photo ? `<img src="${photo}" alt="${personData.name}" class="person-bio-photo">` : ''}
            <div class="person-bio-info">
                <div class="person-bio-label">PERSONA</div>
                <h2 class="person-bio-name">${personData.name}</h2>
                <div class="person-bio-meta">
                    <span><i class="fas fa-briefcase"></i> ${personData.known_for_department||''}</span>
                    ${personData.birthday?`<span><i class="fas fa-calendar"></i> ${personData.birthday}</span>`:''}
                    ${personData.place_of_birth?`<span><i class="fas fa-map-marker-alt"></i> ${personData.place_of_birth}</span>`:''}
                </div>
                ${personData.biography?`<p class="person-bio-text">${personData.biography.slice(0,280)}${personData.biography.length>280?'...':''}</p>`:''}
            </div>`;
        const seen = new Set();
        const unique = [...(creditsData.cast||[]), ...(creditsData.crew||[]).filter(c=>c.job==='Director')]
            .filter(m => { if (seen.has(m.id)) return false; seen.add(m.id); return true; })
            .sort((a,b)=>(b.popularity||0)-(a.popularity||0)).slice(0,40);
        currentData = unique;
        sectionTitle.textContent = `Filmografía: ${personData.name}`;
        sectionCount.textContent = `${unique.length} títulos`;
        document.querySelector('.person-bio-header')?.remove();
        document.querySelector('.section-header').after(bioHeader);
        moviesGrid.innerHTML = unique.map((m,i) => renderCard(m, i, m.media_type||(m.first_air_date?'tv':'movie'))).join('');
        bindCardEvents();
    } catch(e) { console.error('Error filmografía:', e); }
}

function setupEventListeners() {
    searchBtn.addEventListener('click', handleSearch);
    searchInput.addEventListener('keypress', e => { if (e.key==='Enter') handleSearch(); });
    navBtns.forEach(btn => btn.addEventListener('click', () => switchView(btn.dataset.view)));
    
    // Logo click - go to home/inicio
    const logoElement = document.querySelector('.logo');
    if (logoElement) {
        logoElement.style.cursor = 'pointer';
        logoElement.addEventListener('click', () => switchView('all'));
    }
    
    closeModalBtn.addEventListener('click', closeModalFn);
    window.addEventListener('click', e => { if (e.target===modal) closeModalFn(); });
    window.addEventListener('keydown', e => { if (e.key==='Escape') closeModalFn(); });
    gridViewBtn.addEventListener('click', () => setViewMode('grid'));
    listViewBtn.addEventListener('click', () => setViewMode('list'));
    sortSelect.addEventListener('change', e => { currentSortBy = e.target.value; resetAndReload(); });
    document.getElementById('toggleMovies').addEventListener('click', () => switchMediaType('movie'));
    document.getElementById('toggleTV').addEventListener('click', () => switchMediaType('tv'));
    themeToggleBtn.addEventListener('click', toggleTheme);
    document.getElementById('searchModeToggle').addEventListener('click', toggleSearchMode);

    document.querySelectorAll('.decade-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            currentDecade = btn.dataset.decade;
            document.querySelectorAll('.decade-btn').forEach(b => b.classList.toggle('active', b.dataset.decade === currentDecade));
            currentYear = decadeToYear(currentDecade);
            resetAndReload();
        });
    });

    document.getElementById('ruletaBtn').addEventListener('click', handleRuleta);

    document.getElementById('compareBtn').addEventListener('click', openCompareModal);

    document.getElementById('listsBtn').addEventListener('click', openListsManager);

    document.getElementById('marathonBtn').addEventListener('click', openMarathonManager);
    document.getElementById('top10Btn').addEventListener('click', openTop10Modal);

    document.getElementById('heroMarathonBtn').addEventListener('click', () => {
        const heroTitle = document.getElementById('heroTitle').textContent;
        const heroCard = currentData[0];
        if (heroCard) addToMarathon(heroCard, currentMediaType);
    });

    document.getElementById('voiceSearchBtn').addEventListener('click', startVoiceSearch);

    searchInput.addEventListener('focus', showSearchHistory);
    searchInput.addEventListener('blur', () => setTimeout(() => document.getElementById('searchHistoryDropdown').style.display = 'none', 200));

    document.addEventListener('keydown', handleKeyboardShortcuts);

    document.getElementById('cheatsheetOverlay').addEventListener('click', e => {
        if (e.target === document.getElementById('cheatsheetOverlay')) toggleCheatsheet(false);
    });

    document.getElementById('marathonCloseBtn').addEventListener('click', closeMarathon);
    document.getElementById('marathonPanelBtn').addEventListener('click', toggleMarathonQueue);

    document.querySelectorAll('.bottom-nav-btn[data-view]').forEach(btn =>
        btn.addEventListener('click', () => {
            document.querySelectorAll('.bottom-nav-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            switchView(btn.dataset.view);
        }));
    document.getElementById('bottomNoSeBtn')?.addEventListener('click', openMoodPicker);

    window.addEventListener('beforeinstallprompt', e => {
        const installBtn = document.getElementById('installPWABtn');
        if (!installBtn) return;
        e.preventDefault();
        deferredInstall = e;
        installBtn.style.display = 'flex';
    });
    document.getElementById('installPWABtn')?.addEventListener('click', async () => {
        if (!deferredInstall) return;
        try {
            await deferredInstall.prompt();
            const { outcome } = await deferredInstall.userChoice;
            if (outcome === 'accepted') document.getElementById('installPWABtn').style.display = 'none';
        } catch (err) {
            console.warn('PWA install prompt failed:', err);
        }
    });
    const qrBtn = document.getElementById('qrBtn');
    const qrModal = document.getElementById('qrModal');
    const qrClose = document.getElementById('qrClose');
    const qrCodeEl = document.getElementById('qrCode');
    const qrUrlEl = document.getElementById('qrUrl');
    if (qrBtn && qrModal && qrCodeEl && qrUrlEl) {
        const renderQR = () => {
            if (typeof QRCode !== 'function') {
                console.warn('QRCode library not loaded.');
                return;
            }
            const url = `${location.origin}${location.pathname}`;
            qrCodeEl.innerHTML = '';
            qrUrlEl.textContent = url;
            new QRCode(qrCodeEl, {
                text: url,
                width: 220,
                height: 220,
                colorDark: '#111111',
                colorLight: '#ffffff',
                correctLevel: QRCode.CorrectLevel.M
            });
        };
        qrBtn.addEventListener('click', () => {
            renderQR();
            qrModal.style.display = 'block';
            document.body.style.overflow = 'hidden';
        });
        qrClose?.addEventListener('click', () => {
            qrModal.style.display = 'none';
            document.body.style.overflow = '';
        });
        qrModal.addEventListener('click', e => {
            if (e.target === qrModal) {
                qrModal.style.display = 'none';
                document.body.style.overflow = '';
            }
        });
    }

    setupCardSwipeGestures();

    document.getElementById('advancedFilterBtn').addEventListener('click', toggleAdvancedPanel);
    document.getElementById('ratingMinSlider').addEventListener('input', e => {
        advFilters.ratingMin = parseFloat(e.target.value);
        document.getElementById('ratingMinVal').textContent = advFilters.ratingMin || '0';
    });
    document.getElementById('runtimeMaxSlider').addEventListener('input', e => {
        advFilters.runtimeMax = parseInt(e.target.value);
        document.getElementById('runtimeMaxVal').textContent = advFilters.runtimeMax >= 240 ? 'Cualquiera' : advFilters.runtimeMax + ' min';
    });
    document.getElementById('languageFilter').addEventListener('change', e => { advFilters.language = e.target.value; });
    document.getElementById('voteCountSlider').addEventListener('input', e => {
        advFilters.voteMin = parseInt(e.target.value);
        document.getElementById('voteCountVal').textContent = advFilters.voteMin.toLocaleString();
    });
    document.getElementById('afpApplyBtn').addEventListener('click', () => { toggleAdvancedPanel(); resetAndReload(); });
    document.getElementById('afpResetBtn').addEventListener('click', () => {
        advFilters = { ratingMin: 0, runtimeMax: 0, language: '', voteMin: 0 };
        document.getElementById('ratingMinSlider').value = 0;
        document.getElementById('runtimeMaxSlider').value = 240;
        document.getElementById('languageFilter').value = '';
        document.getElementById('voteCountSlider').value = 0;
        document.getElementById('ratingMinVal').textContent = '0';
        document.getElementById('runtimeMaxVal').textContent = 'Cualquiera';
        document.getElementById('voteCountVal').textContent = '0';
        resetAndReload();
    });

    document.getElementById('noSéBtn').addEventListener('click', openMoodPicker);

    document.getElementById('cinemaExitBtn').addEventListener('click', exitCinemaMode);
    document.getElementById('cinemaPrevServer').addEventListener('click', () => changeCinemaServer(-1));
    document.getElementById('cinemaNextServer').addEventListener('click', () => changeCinemaServer(1));
}
function toggleSearchMode() {
    searchMode = searchMode === 'content' ? 'person' : 'content';
    const btn = document.getElementById('searchModeToggle');
    if (searchMode === 'person') {
        btn.innerHTML = '<i class="fas fa-user"></i>';
        btn.title = 'Buscando personas - click para buscar títulos';
        btn.classList.add('person-mode');
        searchInput.placeholder = 'Buscar actor, director...';
    } else {
        btn.innerHTML = '<i class="fas fa-film"></i>';
        btn.title = 'Buscando títulos - click para buscar personas';
        btn.classList.remove('person-mode');
        searchInput.placeholder = 'Buscar películas...';
    }
}

async function handleRuleta() {
    const btn = document.getElementById('ruletaBtn');
    btn.classList.add('spinning');
    setTimeout(() => btn.classList.remove('spinning'), 700);

    let pool = [];
    if (watchLater.length > 0) {
        pool = watchLater;
        showToast('<i class="fas fa-dice"></i> Selección aleatoria de "Ver después"...');
    } else if (currentData.length > 0) {
        pool = currentData;
        showToast('<i class="fas fa-dice"></i> Ruleta: eligiendo de populares...');
    } else {

        try {
            const data = await tmdbFetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}&language=${LANGUAGE}&region=${REGION}&page=1`);
            pool = data.results || [];
        } catch(e) { showToast('<i class="fas fa-exclamation-triangle"></i> Error al cargar películas'); return; }
    }
    if (!pool.length) { showToast('<i class="fas fa-dice"></i> No hay películas disponibles'); return; }
    const item = pool[Math.floor(Math.random() * pool.length)];
    const type = item._type || (item.first_air_date ? 'tv' : 'movie');
    setTimeout(() => openModal(item.id, false, type), 400);
}

async function openCompareModal() {
    document.body.style.overflow = 'hidden';
    modal.style.display = 'block';
    modalBody.innerHTML = `
        <div class="compare-container">
            <div class="compare-header">
                <div class="compare-title-jp">COMPARAR</div>
                <h2>Comparar películas</h2>
                <p class="compare-subtitle">Busca dos títulos para comparar lado a lado</p>
            </div>
            <div class="compare-search-row">
                <div class="compare-search-col">
                    <input type="text" class="compare-input" id="compareInput1" placeholder="Película 1...">
                    <div class="compare-suggestions" id="compareSuggestions1"></div>
                </div>
                <div class="compare-vs">VS</div>
                <div class="compare-search-col">
                    <input type="text" class="compare-input" id="compareInput2" placeholder="Película 2...">
                    <div class="compare-suggestions" id="compareSuggestions2"></div>
                </div>
            </div>
            <div id="compareResults"></div>
        </div>`;

    let selected = [null, null];

    function setupCompareInput(inputId, suggestionsId, index) {
        const input = document.getElementById(inputId);
        const sugBox = document.getElementById(suggestionsId);
        let debounce;
        input.addEventListener('input', () => {
            clearTimeout(debounce);
            const q = input.value.trim();
            if (q.length < 2) { sugBox.innerHTML = ''; sugBox.style.display='none'; return; }
            debounce = setTimeout(async () => {
                const data = await tmdbFetch(`${BASE_URL}/search/movie?api_key=${API_KEY}&query=${encodeURIComponent(q)}&language=${LANGUAGE}&page=1`);
                const items = (data.results||[]).slice(0,5);
                sugBox.innerHTML = items.map(m => {
                    const yr = (m.release_date||'').split('-')[0];
                    const poster = m.poster_path ? IMG_BASE+m.poster_path : '';
                    return `<div class="compare-sug-item" data-id="${m.id}">
                        ${poster ? `<img src="${poster}" alt="">` : '<div class="compare-sug-no-img"></div>'}
                        <span>${m.title} ${yr?`<em>(${yr})</em>`:''}</span>
                    </div>`;
                }).join('');
                sugBox.style.display = items.length ? 'block' : 'none';
                sugBox.querySelectorAll('.compare-sug-item').forEach(item => {
                    item.addEventListener('click', async () => {
                        input.value = item.querySelector('span').textContent.trim();
                        sugBox.style.display = 'none';
                        selected[index] = parseInt(item.dataset.id);
                        if (selected[0] && selected[1]) renderComparison(selected[0], selected[1]);
                    });
                });
            }, 350);
        });
    }

    setupCompareInput('compareInput1', 'compareSuggestions1', 0);
    setupCompareInput('compareInput2', 'compareSuggestions2', 1);
}

async function renderComparison(id1, id2) {
    const container = document.getElementById('compareResults');
    container.innerHTML = `<div class="loading-spinner" style="padding:2rem 0"><div class="spinner"></div></div>`;
    try {
        const [r1, r2] = await Promise.all([
            fetch(`${BASE_URL}/movie/${id1}?api_key=${API_KEY}&language=${LANGUAGE}`),
            fetch(`${BASE_URL}/movie/${id2}?api_key=${API_KEY}&language=${LANGUAGE}`)
        ]);
        const [m1, m2] = await Promise.all([r1.json(), r2.json()]);

        function statRow(label, val1, val2, higherIsBetter=true) {
            const n1 = parseFloat(val1) || 0, n2 = parseFloat(val2) || 0;
            const win1 = higherIsBetter ? n1 > n2 : n1 < n2;
            const win2 = higherIsBetter ? n2 > n1 : n2 < n1;
            return `<tr>
                <td class="compare-val ${win1&&n1!==n2?'compare-winner':''}">${val1||''}</td>
                <td class="compare-label">${label}</td>
                <td class="compare-val ${win2&&n1!==n2?'compare-winner':''}">${val2||''}</td>
            </tr>`;
        }

        const poster1 = m1.poster_path ? IMG_BASE+m1.poster_path : 'https://placehold.co/175x263/1a1a1a/444?text=N/A';
        const poster2 = m2.poster_path ? IMG_BASE+m2.poster_path : 'https://placehold.co/175x263/1a1a1a/444?text=N/A';

        container.innerHTML = `
            <div class="compare-table-container">
                <div class="compare-posters">
                    <div class="compare-poster-col">
                        <img src="${poster1}" alt="${m1.title}" class="compare-poster">
                        <div class="compare-movie-title">${m1.title}</div>
                    </div>
                    <div class="compare-poster-spacer"></div>
                    <div class="compare-poster-col">
                        <img src="${poster2}" alt="${m2.title}" class="compare-poster">
                        <div class="compare-movie-title">${m2.title}</div>
                    </div>
                </div>
                <table class="compare-table">
                    <tbody>
                        ${statRow('Puntuación TMDB', m1.vote_average?.toFixed(1), m2.vote_average?.toFixed(1), true)}
                        ${statRow('Votos', m1.vote_count?.toLocaleString(), m2.vote_count?.toLocaleString(), true)}
                        ${statRow('Año', (m1.release_date||'').split('-')[0], (m2.release_date||'').split('-')[0], false)}
                        ${statRow('Duración (min)', m1.runtime, m2.runtime, false)}
                        ${statRow('Presupuesto', m1.budget ? `$${(m1.budget/1e6).toFixed(0)}M` : null, m2.budget ? `$${(m2.budget/1e6).toFixed(0)}M` : null, true)}
                        ${statRow('Taquilla', m1.revenue ? `$${(m1.revenue/1e6).toFixed(0)}M` : null, m2.revenue ? `$${(m2.revenue/1e6).toFixed(0)}M` : null, true)}
                        <tr>
                            <td class="compare-val compare-genres">${(m1.genres||[]).map(g=>`<span>${g.name}</span>`).join('')||''}</td>
                            <td class="compare-label">Géneros</td>
                            <td class="compare-val compare-genres">${(m2.genres||[]).map(g=>`<span>${g.name}</span>`).join('')||''}</td>
                        </tr>
                        <tr>
                            <td class="compare-val">${m1.original_language?.toUpperCase()||''}</td>
                            <td class="compare-label">Idioma</td>
                            <td class="compare-val">${m2.original_language?.toUpperCase()||''}</td>
                        </tr>
                        <tr>
                            <td class="compare-val">${m1.status||''}</td>
                            <td class="compare-label">Estado</td>
                            <td class="compare-val">${m2.status||''}</td>
                        </tr>
                    </tbody>
                </table>
                <div class="compare-actions">
                    <button class="detail-btn detail-btn-secondary" onclick="openModal(${m1.id}, false, 'movie')"><i class="fas fa-info-circle"></i> ${m1.title}</button>
                    <button class="detail-btn detail-btn-secondary" onclick="openModal(${m2.id}, false, 'movie')"><i class="fas fa-info-circle"></i> ${m2.title}</button>
                </div>
            </div>`;
    } catch(e) {
        container.innerHTML = `<p style="text-align:center;color:var(--text-muted);padding:1rem">Error cargando datos</p>`;
    }
}

async function loadUpcoming() {
    showLoading();
    heroBanner.classList.remove('visible');
    sectionTitle.textContent = 'Próximos estrenos';
    filterBar.style.display = 'none';

    moviesGrid.className = 'movies-grid';
    const sectionHeader = document.querySelector('.section-header');
    if (sectionHeader) sectionHeader.style.display = 'flex';
    cleanupExtras();
    try {
        const data = await tmdbFetch(`${BASE_URL}/movie/upcoming?api_key=${API_KEY}&language=${LANGUAGE}&region=${REGION}&page=1`);
        const items = (data.results || []).sort((a,b) => new Date(a.release_date) - new Date(b.release_date));
        const today = new Date(); today.setHours(0,0,0,0);

        sectionCount.textContent = `${items.length} estrenos`;
        moviesGrid.innerHTML = items.map((item, i) => {
            const releaseDate = new Date(item.release_date);
            const diffMs = releaseDate - today;
            const diffDays = Math.ceil(diffMs / (1000*60*60*24));
            const poster = item.poster_path ? IMG_BASE+item.poster_path : 'https://placehold.co/300x450/1a1a1a/666?text=Sin+imagen';
            const title = item.title || item.name || '';
            const rating = item.vote_average?.toFixed(1) || 'N/A';
            const relStr = item.release_date || '?';

            let countdownHTML = '';
            if (diffDays > 0) {
                countdownHTML = `<div class="upcoming-countdown" data-release="${item.release_date}">
                    <i class="fas fa-rocket"></i> <span class="countdown-days">${diffDays}</span> día${diffDays!==1?'s':''}
                </div>`;
            } else if (diffDays === 0) {
                countdownHTML = `<div class="upcoming-countdown today"><i class="fas fa-star"></i> ¡Hoy!</div>`;
            } else {
                countdownHTML = `<div class="upcoming-countdown past"><i class="fas fa-check"></i> En cines</div>`;
            }

            return `<div class="movie-card upcoming-card" data-id="${item.id}" data-type="movie" style="animation-delay:${Math.min(i*0.04,0.8)}s">
                <img src="${poster}" alt="${title}" loading="lazy" decoding="async">
                <div class="movie-rating-badge">⭐ ${rating}</div>
                ${countdownHTML}
                <div class="upcoming-date-badge"><i class="fas fa-calendar"></i> ${relStr}</div>
                <div class="movie-info">
                    <h3>${title}</h3>
                    <span class="movie-year">${relStr.split('-')[0]}</span>
                </div>
                <div class="movie-actions">
                    <button class="action-btn wl-btn ${watchLater.some(f=>f.id===item.id)?'watchlater-active':''}" data-id="${item.id}" title="Ver después"><i class="fas fa-clock"></i></button>
                    <button class="action-btn fav-btn ${favorites.some(f=>f.id===item.id)?'active':''}" data-id="${item.id}" title="Favoritos"><i class="fas fa-star"></i></button>
                    <button class="action-btn play-quick-btn" data-id="${item.id}" data-type="movie" title="Más info"><i class="fas fa-info-circle"></i></button>
                </div>
            </div>`;
        }).join('');

        bindCardEvents();
        startCountdowns();
    } catch(e) {
        console.error('Error upcoming:', e);
        moviesGrid.innerHTML = `<div class="empty-state"><span class="empty-kanji">誤</span><p>Error al cargar próximos estrenos</p></div>`;
    }
}

function startCountdowns() {

    const cards = document.querySelectorAll('.upcoming-countdown[data-release]');
    cards.forEach(el => {
        const releaseDate = new Date(el.dataset.release);
        const update = () => {
            const today = new Date(); today.setHours(0,0,0,0);
            const diffDays = Math.ceil((releaseDate - today) / (1000*60*60*24));
            if (diffDays > 0) el.querySelector('.countdown-days').textContent = diffDays;
        };
        setInterval(update, 60000);
    });
}
let _globalWatchTimer = null;
function closeModalFn() {
    modal.style.display='none';
    document.body.style.overflow='';

    if (_globalWatchTimer) { clearTimeout(_globalWatchTimer); _globalWatchTimer = null; }
}

function decadeToYear(decade) {

    const map = {
        '70s': { from: 1970, to: 1979 },
        '80s': { from: 1980, to: 1989 },
        '90s': { from: 1990, to: 1999 },
        '2000s': { from: 2000, to: 2009 },
        '2010s': { from: 2010, to: 2019 },
        '2020s': { from: 2020, to: 2029 },
    };
    return map[decade] || null;
}
function setViewMode(mode) {
    moviesGrid.classList.toggle('list-view', mode==='list');
    gridViewBtn.classList.toggle('active', mode==='grid');
    listViewBtn.classList.toggle('active', mode==='list');
}

function switchMediaType(type) {
    if (currentMediaType === type) return;
    currentMediaType = type;
    isSearchMode = false;
    searchInput.value = '';
    document.getElementById('toggleMovies').classList.toggle('active', type==='movie');
    document.getElementById('toggleTV').classList.toggle('active', type==='tv');
    rebuildGenreButtons();
    currentGenre = 'popular'; currentView = 'all';
    navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.view==='all'));
    filterBar.style.display = 'flex';
    currentPage = 1; currentData = [];
    cleanupExtras();
    if (type==='movie') loadPopularMovies(); else loadPopularTV();
}
function cleanupExtras() {
    document.querySelector('.person-bio-header')?.remove();
    document.querySelector('.reco-subtitle')?.remove();
    document.getElementById('listToolbar')?.remove();
}

async function loadGenres() {
    try {
        const [mr, tr] = await Promise.all([
            fetch(`${BASE_URL}/genre/movie/list?api_key=${API_KEY}&language=${LANGUAGE}`),
            fetch(`${BASE_URL}/genre/tv/list?api_key=${API_KEY}&language=${LANGUAGE}`)
        ]);
        genresList   = (await mr.json()).genres || [];
        tvGenresList = (await tr.json()).genres || [];
        rebuildGenreButtons();
    } catch(e) { console.error('Error géneros:', e); }
}
function rebuildGenreButtons() {
    genresContainer.innerHTML = '';
    const pop = document.createElement('button');
    pop.className = 'genre-btn active'; pop.dataset.genre = 'popular'; pop.textContent = '⭐ Populares';
    pop.addEventListener('click', () => selectGenre('popular'));
    genresContainer.appendChild(pop);
    (currentMediaType==='movie' ? genresList : tvGenresList).forEach(genre => {
        const btn = document.createElement('button');
        btn.className = 'genre-btn'; btn.dataset.genre = genre.id; btn.textContent = genre.name;
        btn.addEventListener('click', () => selectGenre(genre.id));
        genresContainer.appendChild(btn);
    });
}
function selectGenre(genreId) {
    currentGenre = genreId;
    document.querySelectorAll('.genre-btn').forEach(btn => btn.classList.toggle('active', String(btn.dataset.genre)===String(genreId)));
    if (currentView !== 'all') return;
    currentPage = 1; currentData = []; isSearchMode = false;
    cleanupExtras();
    if (genreId==='popular') { if (currentMediaType==='movie') loadPopularMovies(); else loadPopularTV(); }
    else loadByGenre(genreId);
}

function resetAndReload() {
    if (currentView !== 'all') return;
    currentPage = 1; currentData = []; isSearchMode = false;
    cleanupExtras();
    if (currentGenre==='popular') { if (currentMediaType==='movie') loadPopularMovies(); else loadPopularTV(); }
    else loadByGenre(currentGenre);
}

function setupInfiniteScroll() {
    window.addEventListener('scroll', () => {
        if (isLoadingMore || currentView!=='all' || isPersonSearch) return;
        if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500 && currentPage < totalPages) loadMoreContent();
    });
}
async function loadMoreContent() {
    if (isLoadingMore || currentPage >= totalPages) return;
    isLoadingMore = true; showLoadMoreSpinner();
    try {
        currentPage++;
        let url;
        const type = currentMediaType;
        if (isSearchMode) url = `${BASE_URL}/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(currentSearchQuery)}&language=${LANGUAGE}&page=${currentPage}`;
        else if (currentGenre==='popular') url = type==='movie' ? `${BASE_URL}/movie/popular?api_key=${API_KEY}&language=${LANGUAGE}&region=${REGION}&page=${currentPage}` : `${BASE_URL}/tv/popular?api_key=${API_KEY}&language=${LANGUAGE}&page=${currentPage}`;
        else url = buildDiscoverURL(type, currentGenre, currentPage);
        const data = await (await fetch(url)).json();
        const newItems = data.results || [];
        currentData = [...currentData, ...newItems];
        appendItems(newItems, type);
        sectionCount.textContent = `${currentData.length} títulos`;
    } catch(e) { console.error('Error cargando más:', e); }
    finally { isLoadingMore=false; removeLoadMoreSpinner(); }
}
function buildDiscoverURL(type, genreId, page=1) {
    let url = `${BASE_URL}/discover/${type}?api_key=${API_KEY}&with_genres=${genreId}&language=${LANGUAGE}&sort_by=${currentSortBy}&page=${page}`;
    const range = decadeToYear(currentDecade);
    if (range) {
        if (type==='movie') url += `&primary_release_date.gte=${range.from}-01-01&primary_release_date.lte=${range.to}-12-31`;
        else url += `&first_air_date.gte=${range.from}-01-01&first_air_date.lte=${range.to}-12-31`;
    }
    if (advFilters.ratingMin > 0) url += `&vote_average.gte=${advFilters.ratingMin}`;
    if (advFilters.runtimeMax > 0 && advFilters.runtimeMax < 240) url += `&with_runtime.lte=${advFilters.runtimeMax}`;
    if (advFilters.language) url += `&with_original_language=${advFilters.language}`;
    if (advFilters.voteMin > 0) url += `&vote_count.gte=${advFilters.voteMin}`;
    return url;
}
function showLoadMoreSpinner() {
    if (document.getElementById('loadMoreSpinner')) return;
    const s = document.createElement('div'); s.id='loadMoreSpinner'; s.className='load-more-spinner';
    s.innerHTML='<div class="spinner"></div><span>Cargando más...</span>'; moviesGrid.after(s);
}
function removeLoadMoreSpinner() { document.getElementById('loadMoreSpinner')?.remove(); }

function switchView(view) {
    currentView = view; isPersonSearch = false;
    navBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.view===view));
    document.querySelectorAll('.bottom-nav-btn[data-view]').forEach(btn => btn.classList.toggle('active', btn.dataset.view===view));

    const isMain = view === 'all';
    const isProfile = view === 'profile' || (!['all','upcoming','recommended'].includes(view));
    const mediaTypeBar   = document.querySelector('.media-type-bar');
    const sectionHeader  = document.querySelector('.section-header');

    filterBar.style.display        = isMain ? 'flex'  : 'none';
    if (mediaTypeBar)  mediaTypeBar.style.display  = isMain ? 'flex'  : 'none';
    genresContainer.style.display  = isMain ? 'flex'  : 'none';
    if (sectionHeader) sectionHeader.style.display  = isProfile ? 'none' : 'flex';

    cleanupExtras();
    listSortBy = 'default';

    if (view === 'all') {
        heroBanner.classList.add('visible');
        if (currentGenre === 'popular') {
            if (currentMediaType === 'movie') loadPopularMovies(); else loadPopularTV();
        } else loadByGenre(currentGenre);
    } else if (view === 'upcoming') {
        heroBanner.classList.remove('visible');
        loadUpcoming();
    } else if (view === 'recommended') {
        heroBanner.classList.remove('visible');
        loadRecommendations();
    } else if (view === 'profile') {
        heroBanner.classList.remove('visible');
        loadProfileView();
    } else {
        heroBanner.classList.remove('visible');
        loadProfileView();
    }
}

function renderListView(items, view) {

    const sectionHeader = document.querySelector('.section-header');
    document.getElementById('listToolbar')?.remove();
    const toolbarDiv = document.createElement('div');
    toolbarDiv.innerHTML = renderListToolbar(view);
    sectionHeader.after(toolbarDiv.firstElementChild || document.createDocumentFragment());

    setTimeout(() => {
        const lss = document.getElementById('listSortSelect');
        if (lss) lss.addEventListener('change', e => { listSortBy = e.target.value; renderListView(getListForView(view), view); });
        const exportBtn = document.getElementById('exportBtn');
        if (exportBtn) exportBtn.addEventListener('click', exportData);
        const importFile = document.getElementById('importFile');
        if (importFile) importFile.addEventListener('change', e => { if (e.target.files[0]) importData(e.target.files[0]); });
    }, 0);

    const sorted = sortList(items, listSortBy);
    displayItems(sorted, view === 'history' ? undefined : 'movie');
    sectionCount.textContent = `${items.length} títulos`;
}
function getListForView(view) {
    if (view==='favorites') return favorites;
    if (view==='watchlater') return watchLater;
    if (view==='history') return watchHistory.map(h=>({...h}));
    return [];
}

async function loadPopularMovies() {
    showLoading();
    moviesGrid.className = moviesGrid.classList.contains('list-view') ? 'movies-grid list-view' : 'movies-grid';
    const sh = document.querySelector('.section-header'); if (sh) sh.style.display = 'flex';
    try {
        const data = await tmdbFetch(`${BASE_URL}/movie/popular?api_key=${API_KEY}&language=${LANGUAGE}&region=${REGION}&page=${currentPage}`);
        totalPages = data.total_pages||1;
        currentData = [...currentData, ...(data.results||[])];
        displayItems(currentData, 'movie');
        sectionTitle.textContent = 'Películas populares';
        setHero(data.results[0], 'movie');
        heroBanner.classList.add('visible');
    } catch(e) { console.error('Error populares:', e); }
}
async function loadPopularTV() {
    showLoading();
    moviesGrid.className = moviesGrid.classList.contains('list-view') ? 'movies-grid list-view' : 'movies-grid';
    const sh = document.querySelector('.section-header'); if (sh) sh.style.display = 'flex';
    try {
        const data = await tmdbFetch(`${BASE_URL}/tv/popular?api_key=${API_KEY}&language=${LANGUAGE}&page=${currentPage}`);
        totalPages = data.total_pages||1;
        currentData = [...currentData, ...(data.results||[])];
        displayItems(currentData, 'tv');
        sectionTitle.textContent = 'Series populares';
        setHero(data.results[0], 'tv');
        heroBanner.classList.add('visible');
    } catch(e) { console.error('Error series:', e); }
}
async function loadByGenre(genreId) {
    showLoading();
    try {
        const type = currentMediaType;
        const data = await (await fetch(buildDiscoverURL(type, genreId, currentPage))).json();
        totalPages = data.total_pages||1;
        currentData = [...currentData, ...(data.results||[])];
        displayItems(currentData, type);
        const list = type==='movie' ? genresList : tvGenresList;
        sectionTitle.textContent = `${type==='movie'?'Películas':'Series'} de ${list.find(g=>g.id==genreId)?.name||''}`;
        setHero(data.results[0], type);
        heroBanner.classList.add('visible');
    } catch(e) { console.error('Error género:', e); }
}

function setHero(item, type='movie') {
    if (!item) return;
    const kanjiChars = ['夢','影','風','月','光','雪','桜','星'];
    document.getElementById('heroKanji').textContent = kanjiChars[Math.floor(Math.random()*kanjiChars.length)];
    const displayTitle = item.title||item.name;
    const displayDate  = item.release_date||item.first_air_date;
    if (item.backdrop_path) {
        document.getElementById('heroBgNext')?.remove();
        const next = document.createElement('div');
        next.id='heroBgNext'; next.className='hero-bg hero-bg-next';
        next.style.backgroundImage = `url(${IMG_ORIGINAL}${item.backdrop_path})`;
        heroBanner.insertBefore(next, heroBanner.firstChild);
        requestAnimationFrame(() => requestAnimationFrame(() => {
            next.classList.add('hero-bg-fade-in');
            setTimeout(() => { heroBg.style.backgroundImage = next.style.backgroundImage; next.remove(); }, 900);
        }));
    }
    const heroContent = document.querySelector('.hero-content');
    heroContent.style.opacity='0'; heroContent.style.transform='translateY(10px)';
    setTimeout(() => {
        document.getElementById('heroTitle').textContent    = displayTitle;
        document.getElementById('heroRating').innerHTML     = `<i class="fas fa-star"></i> ${item.vote_average?.toFixed(1)||'N/A'}`;
        document.getElementById('heroYear').innerHTML       = `<i class="fas fa-calendar"></i> ${displayDate?.split('-')[0]||'?'}`;
        document.getElementById('heroRuntime').innerHTML    = type==='tv' ? `<i class="fas fa-tv"></i> Serie` : `<i class="fas fa-clock"></i>`;
        document.getElementById('heroOverview').textContent = item.overview||'Sin sinopsis disponible.';
        heroContent.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
        heroContent.style.opacity='1'; heroContent.style.transform='translateY(0)';
    }, 200);
    document.getElementById('heroPlayBtn').onclick = () => openModal(item.id, true, type);
    document.getElementById('heroInfoBtn').onclick = () => openModal(item.id, false, type);
}

async function handleSearch() {
    const query = searchInput.value.trim();
    if (!query) return;

    searchHistory = [query, ...searchHistory.filter(q => q !== query)].slice(0, 10);
    localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
    document.getElementById('searchHistoryDropdown').style.display = 'none';
    if (searchMode==='person') {
        currentView='all'; navBtns.forEach(btn=>btn.classList.toggle('active',btn.dataset.view==='all'));
        await searchPerson(query); return;
    }
    heroBanner.classList.remove('visible');
    isSearchMode=true; isPersonSearch=false; currentSearchQuery=query;
    currentPage=1; currentData=[]; cleanupExtras(); showLoading();
    try {
        const type = currentMediaType;
        const data = await tmdbFetch(`${BASE_URL}/search/${type}?api_key=${API_KEY}&query=${encodeURIComponent(query)}&language=${LANGUAGE}&page=1`);
        totalPages = data.total_pages||1; currentData = data.results||[];
        displayItems(currentData, type);
        sectionTitle.textContent = `結果: "${query}"`;
    } catch(e) { console.error('Error búsqueda:', e); }
}

function showLoading() {
    moviesGrid.innerHTML = `<div class="loading-spinner"><div class="spinner"></div><span>Cargando...</span></div>`;
}
function displayItems(items, type) {
    type = type||currentMediaType;
    moviesGrid.className = moviesGrid.classList.contains('list-view') ? 'movies-grid list-view' : 'movies-grid';
    if (!items||items.length===0) {
        moviesGrid.innerHTML=`<div class="empty-state"><span class="empty-kanji">空</span><p>No hay elementos</p></div>`;
        sectionCount.textContent=''; return;
    }
    sectionCount.textContent = `${items.length} títulos`;

    const frag = document.createDocumentFragment();
    items.forEach((item,i) => {
        const div = document.createElement('div');
        div.innerHTML = renderCard(item, i, item._type||type);
        const card = div.firstElementChild;
        if (card) frag.appendChild(card);
    });
    moviesGrid.innerHTML = '';
    moviesGrid.appendChild(frag);
}
function appendItems(items, type) {
    if (!items||!items.length) return;
    const frag = document.createDocumentFragment();
    items.forEach((item,i) => {
        const d = document.createElement('div');
        d.innerHTML = renderCard(item, i, type);
        if (d.firstElementChild) frag.appendChild(d.firstElementChild);
    });
    moviesGrid.appendChild(frag);
}
function renderCard(item, i, type) {
    const poster       = item.poster_path ? IMG_BASE+item.poster_path : 'https://placehold.co/300x450/1a1a1a/666?text=Sin+imagen';
    const isFav        = favorites.some(f=>f.id===item.id);
    const isWL         = watchLater.some(f=>f.id===item.id);
    const watched      = isWatched(item.id);
    const title        = item.title||item.name||'';
    const year         = (item.release_date||item.first_air_date||'').split('-')[0];
    const rating       = item.vote_average?.toFixed(1)||'N/A';
    const tvBadge      = type==='tv' ? '<span class="type-badge">SERIE</span>' : '';
    const watchedBadge = watched ? '<span class="watched-badge"><i class="fas fa-check"></i></span>' : '';
    const userRating   = getUserRating(item.id);
    const userRatingBadge = userRating > 0 ? `<span class="user-rating-badge">${'⭐'.repeat(userRating)}</span>` : '';
    const hasNote      = getUserNote(item.id) ? '<span class="note-badge" title="Tiene nota"><i class="fas fa-sticky-note"></i></span>' : '';
    return `
        <div class="movie-card ${watched?'is-watched':''}" data-id="${item.id}" data-type="${type}" style="animation-delay:${Math.min(i*0.04,0.8)}s">
            <img src="${poster}" alt="${title}" loading="lazy">
            <div class="movie-rating-badge">⭐ ${rating}</div>
            ${tvBadge}${watchedBadge}${userRatingBadge}${hasNote}
            <div class="movie-info">
                <h3>${title}</h3>
                <span class="movie-year">${year}</span>
            </div>
            <div class="movie-actions">
                <button class="action-btn fav-btn ${isFav?'active':''}" data-id="${item.id}" title="Favoritos"><i class="fas fa-star"></i></button>
                <button class="action-btn wl-btn ${isWL?'watchlater-active':''}" data-id="${item.id}" title="Ver después"><i class="fas fa-clock"></i></button>
                <button class="action-btn play-quick-btn" data-id="${item.id}" data-type="${type}" title="Reproducir"><i class="fas fa-play"></i></button>
            </div>
        </div>`;
}
function bindCardEvents() {  }

let cardDelegationInitialized = false;
function initCardDelegation() {
    if (cardDelegationInitialized) return;
    cardDelegationInitialized = true;

    moviesGrid.addEventListener('click', e => {
        const btn  = e.target.closest('.fav-btn, .wl-btn, .play-quick-btn');
        const card = e.target.closest('.movie-card');
        if (btn) {
            e.stopPropagation();
            if (btn.classList.contains('fav-btn'))       toggleFavorite(btn.dataset.id);
            else if (btn.classList.contains('wl-btn'))   toggleWatchLater(btn.dataset.id);
            else if (btn.classList.contains('play-quick-btn')) openModal(btn.dataset.id, true, btn.dataset.type);
        } else if (card && !e.target.closest('button')) {
            openModal(card.dataset.id, false, card.dataset.type);
        }
    });
}

function isFavorite(id)   { return favorites.some(f => f.id === Number(id)); }
function isWatchLater(id) { return watchLater.some(f => f.id === Number(id)); }

function toggleFavorite(itemId) {
    const item = findItemById(itemId); if (!item) return;
    const idx = favorites.findIndex(f=>f.id===item.id);
    if (idx===-1) { favorites.push(item); showToast(`<i class="fas fa-star"></i> Añadido a favoritos`); }
    else { favorites.splice(idx,1); showToast(`<i class="fas fa-star"></i> Eliminado de favoritos`); }
    localStorage.setItem('favorites', JSON.stringify(favorites));
    cloudSave();
    if (currentView==='favorites') renderListView(favorites,'favorites'); else refreshCurrentView();
}
function toggleWatchLater(itemId) {
    const item = findItemById(itemId); if (!item) return;
    const idx = watchLater.findIndex(f=>f.id===item.id);
    if (idx===-1) { watchLater.push(item); showToast(`<i class="fas fa-clock"></i> Añadido a ver después`); }
    else { watchLater.splice(idx,1); showToast(`<i class="fas fa-clock"></i> Eliminado de ver después`); }
    localStorage.setItem('watchLater', JSON.stringify(watchLater));
    cloudSave();
    if (currentView==='watchlater') renderListView(watchLater,'watchlater'); else refreshCurrentView();
}
function findItemById(id) {
    id = Number(id);
    return currentData.find(m=>m.id===id)||favorites.find(m=>m.id===id)||watchLater.find(m=>m.id===id)||watchHistory.find(m=>m.id===id);
}
function refreshCurrentView() {
    if (currentView==='all') displayItems(currentData);
    else if (currentView==='favorites') renderListView(favorites,'favorites');
    else if (currentView==='watchlater') renderListView(watchLater,'watchlater');
    else if (currentView==='history') renderListView(watchHistory.map(h=>({...h})),'history');
    else if (currentView==='recommended') loadRecommendations();
}

function showToast(message) {
    document.querySelector('.toast')?.remove();
    const t = document.createElement('div'); t.className='toast'; t.innerHTML=message;
    document.body.appendChild(t); setTimeout(()=>t.remove(),3000);
}
// Servidores para películas - Los marked como premium son solo para usuarios premium
const SERVERS_MOVIE = [
    { label:'⭐ Premium', url: id=>`https://vidlink.pro/movie/${id}?autoplay=true`, premium: true },
    { label:'⭐ Premium', url: id=>`https://vidsrc.me/embed/movie?tmdb=${id}`, premium: true },
    { label:'Free', url: id=>`https://vimeus.com/e/movie?tmdb=${id}&view_key=FQN-PxWI4fy3NJkWYCQ6GKAj6ezrUYrG6zhn310489U` },
];

// Servidores para series - Los marcados como premium son solo para usuarios premium
const SERVERS_TV = [
    { label:'⭐ Premium', url: id=>`https://vidlink.pro/tv/${id}/1/1?autoplay=true`, premium: true },
    { label:'⭐ Premium', url: id=>`https://vidsrc.me/embed/tv?tmdb=${id}&season=1&episode=1`, premium: true },
    { label:'Free', url: (id, s=1, e=1)=>`https://www.2embed.stream/embed/tv/${id}/${s}/${e}` },
];

async function openModal(itemId, autoPlay=false, type='movie') {
    document.body.style.overflow='hidden'; modal.style.display='block';
    modalBody.innerHTML=`<div class="loading-spinner" style="padding:4rem 0"><div class="spinner"></div><span>Cargando...</span></div>`;
    try {
        const ep = type==='tv'?'tv':'movie';
        
        // Crear controladores de abort para timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000); // 15 segundos timeout
        
        const fetchOptions = { signal: controller.signal };
        
        const [detailRes, creditsRes, similarRes] = await Promise.all([
            fetch(`${BASE_URL}/${ep}/${itemId}?api_key=${API_KEY}&language=${LANGUAGE}&append_to_response=videos,translations`, fetchOptions).then(r => { if (!r.ok) throw new Error('Error fetching details'); return r; }),
            fetch(`${BASE_URL}/${ep}/${itemId}/credits?api_key=${API_KEY}&language=${LANGUAGE}`, fetchOptions).then(r => { if (!r.ok) throw new Error('Error fetching credits'); return r; }),
            fetch(`${BASE_URL}/${ep}/${itemId}/similar?api_key=${API_KEY}&language=${LANGUAGE}&page=1`, fetchOptions).then(r => { if (!r.ok) throw new Error('Error fetching similar'); return r; })
        ]);
        
        clearTimeout(timeoutId);
        
        const item    = await detailRes.json();
        const credits = await creditsRes.json();
        const simData = await similarRes.json();
        
        // Verificar si la respuesta es válida
        if (item.status_code) {
            throw new Error(item.status_message || 'Película no encontrada');
        }

        let displayTitle = item.title||item.name;
        if (type==='movie'&&item.translations?.translations) {
            const t = item.translations.translations.find(t=>t.iso_639_1==='es');
            if (t?.data?.title) displayTitle = t.data.title;
        }

        const isFav   = favorites.some(f=>f.id===item.id);
        const isWL    = watchLater.some(f=>f.id===item.id);
        const watched = isWatched(item.id);
        const cast    = (credits.cast||[]).slice(0,10);
        const director = (credits.crew||[]).find(c => c.job === 'Director');
        const writers  = (credits.crew||[]).filter(c => ['Screenplay','Writer','Story'].includes(c.job)).slice(0,2);

        const allSimilar = simData.results||[];
        const simTotalPages = simData.total_pages||1;

        const videos  = item.videos?.results||[];
        const trailer = videos.find(v=>v.type==='Trailer'&&v.site==='YouTube')||videos.find(v=>v.site==='YouTube');
        const trailerHTML = trailer ? `
            <div class="trailer-section">
                <h4>Tráiler oficial</h4>
                <div class="trailer-thumb" id="trailerThumb" data-ytkey="${trailer.key}">
                    <img src="https://img.youtube.com/vi/${trailer.key}/hqdefault.jpg" alt="Tráiler">
                    <div class="trailer-play-btn"><i class="fas fa-play"></i></div>
                    <div class="trailer-label">Tráiler oficial</div>
                </div>
                <div class="trailer-embed" id="trailerEmbed" style="display:none"></div>
            </div>` : '';

        const castHTML = cast.length ? `
            <div class="cast-section">
                <h4>Reparto</h4>
                <div class="cast-list">
                    ${cast.map(p=>`
                        <div class="cast-item clickable-cast" data-person-name="${p.name}">
                            <img src="${p.profile_path?IMG_PROFILE+p.profile_path:'https://placehold.co/60x60/1a1a1a/444?text=?'}" alt="${p.name}" onerror="this.src='https://placehold.co/60x60/1a1a1a/444?text=?'">
                            <div class="cast-name">${p.name}</div>
                        </div>`).join('')}
                </div>
            </div>` : '';

        const similarSection = buildSimilarHTML(allSimilar.slice(0,12), type, 1, simTotalPages, item.id);

        const allServers = type==='tv' ? SERVERS_TV : SERVERS_MOVIE;
        // Premium: ve todos los servidores | Free: solo servidores gratuitos
        const SERVERS = isPremium ? allServers : allServers.filter(s => !s.premium);
        const serverListHTML = SERVERS.map((s,i)=>`<button class="server-btn ${i===0?'active':''}" data-index="${i}">${s.label}</button>`).join('');
        const backdropHTML   = item.backdrop_path ? `<div class="modal-backdrop"><img src="${IMG_ORIGINAL}${item.backdrop_path}" alt=""></div>` : '';
        const releaseYear    = (item.release_date||item.first_air_date||'?').split('-')[0];
        const runtimeInfo    = type==='movie' ? `<span class="meta-item"><i class="fas fa-clock"></i> ${item.runtime||'?'} min</span>` : `<span class="meta-item"><i class="fas fa-tv"></i> ${item.number_of_seasons||'?'} temp.</span>`;
        const watchedLabel   = watched ? `<span class="meta-item watched-label"><i class="fas fa-check-circle"></i> Visto</span>` : '';

        const starsHTML = `
            <div class="user-rating-section">
                <div class="user-rating-label"><i class="fas fa-user-star"></i> Tu valoración</div>
                ${renderStars(item.id, true)}
                <span class="user-rating-value" id="ratingValue">${getUserRating(item.id)>0?getUserRating(item.id)+'/5':t('noRating')}</span>
            </div>`;

        const currentNote = getUserNote(item.id);
        const noteHTML = `
            <div class="note-section">
                <div class="note-header">
                    <h4><i class="fas fa-sticky-note"></i> Mi nota</h4>
                    <button class="note-save-btn" id="noteSaveBtn"><i class="fas fa-save"></i> Guardar</button>
                </div>
                <textarea class="note-textarea" id="noteTextarea" placeholder="Añade una nota personal... (ej: quiero verla con Ana)">${currentNote}</textarea>
            </div>`;

        const reviewsHTML = `
            <div class="sf-reviews-section" id="sfReviewsSection">
                <div class="sf-reviews-header">
                    <h4><i class="fas fa-comments"></i> Reseñas de la comunidad</h4>
                    <span class="sf-reviews-count" id="sfReviewsCount"></span>
                </div>
                <div class="sf-review-write" id="sfReviewWrite">
                    <textarea class="sf-review-textarea" id="sfReviewText" maxlength="300" placeholder="Escribe tu reseña (max 300 caracteres)..."></textarea>
                    <div class="sf-review-actions">
                        <span class="sf-review-chars" id="sfReviewChars">0/300</span>
                        <button class="sf-review-submit" id="sfReviewSubmit"><i class="fas fa-paper-plane"></i> Publicar reseña</button>
                    </div>
                </div>
                <div class="sf-reviews-list" id="sfReviewsList">
                    <div class="sf-reviews-loading"><i class="fas fa-spinner fa-spin"></i> Cargando reseñas...</div>
                </div>
            </div>`;

        modalBody.innerHTML = `
            ${backdropHTML}
            <div class="movie-detail">
                <div class="movie-detail-header">
                    <img class="movie-detail-poster" src="${item.poster_path?IMG_BASE+item.poster_path:'https://placehold.co/175x263/1a1a1a/444?text=N/A'}" alt="${displayTitle}">
                    <div class="movie-detail-info">
                        <div class="modal-title-jp">${type==='tv'?'SERIE':'DETALLES'}</div>
                        <h2>${displayTitle} <span style="font-weight:300;opacity:0.5;font-size:0.7em">(${releaseYear})</span></h2>
                        <div class="movie-meta-row">
                            <span class="meta-item highlight"><i class="fas fa-star"></i> ${item.vote_average?.toFixed(1)} <span style="font-size:.75em;color:#888">(${item.vote_count?.toLocaleString()} votos)</span></span>
                            ${runtimeInfo}
                            <span class="meta-item"><i class="fas fa-globe"></i> ${item.original_language?.toUpperCase()}</span>
                            ${item.budget?`<span class="meta-item"><i class="fas fa-dollar-sign"></i> $${(item.budget/1e6).toFixed(0)}M`:''}
                            ${watchedLabel}
                        </div>
                        <div class="genres-tags">${(item.genres||[]).map(g=>`<span class="genre-tag">${g.name}</span>`).join('')}</div>
                        ${director ? `<div class="director-row"><span class="director-label">Director</span> <button class="director-link clickable-cast" data-person-name="${director.name}"><i class="fas fa-video"></i> ${director.name}</button>${writers.length ? ` <span class="director-label" style="margin-left:1rem">Guión</span> ${writers.map(w=>`<button class="director-link clickable-cast" data-person-name="${w.name}">${w.name}</button>`).join(', ')}` : ''}</div>` : ''}
                        <p class="movie-overview">${item.overview||'Sinopsis no disponible.'}</p>
                        ${starsHTML}
                        <div class="movie-detail-actions">
                            <button class="detail-btn detail-btn-primary" id="playBtn"><i class="fas fa-play"></i> Reproducir</button>
                            <button class="detail-btn detail-btn-secondary" id="cinemaBtn" style="display:none"><i class="fas fa-expand"></i> Vista Cine</button>
                            <button class="detail-btn detail-btn-secondary ${isFav?'active-btn':''}" id="favDetailBtn"><i class="fas fa-star"></i> ${isFav?'En favoritos':'Favoritos'}</button>
                            <button class="detail-btn detail-btn-secondary ${isWL?'active-btn':''}" id="wlDetailBtn"><i class="fas fa-clock"></i> ${isWL?'En lista':'Ver después'}</button>
                            <button class="detail-btn detail-btn-secondary" id="shareDetailBtn"><i class="fas fa-share-alt"></i> 共有</button>
                            <button class="detail-btn detail-btn-secondary" id="addToListDetailBtn"><i class="fas fa-list-ul"></i> Añadir a lista</button>
                            <button class="detail-btn detail-btn-secondary" id="addToMarathonBtn"><i class="fas fa-film"></i> + Maratón</button>
                        </div>
                    </div>
                </div>
                ${noteHTML}
                ${reviewsHTML}
                ${trailerHTML}
                <div class="server-selector" id="serverSelector">
                    <h4>Servidor de reproducción</h4>
                    <div class="server-list">${serverListHTML}</div>
                </div>
                <div class="video-container" id="videoContainer"></div>
                <div class="donde-ver-section" id="dondeVerSection"><div class="donde-ver-loading"><div class="spinner" style="width:20px;height:20px;border-width:2px"></div> Buscando dónde ver...</div></div>
                <div id="collectionSection"></div>
                <div id="triviaSection"></div>
                ${castHTML}
                <div id="tvSeasonsSection"></div>
                <div id="porqueVisteContainer"></div>
                <div id="similarContainer">${similarSection}</div>
            </div>`;

        document.getElementById('noteSaveBtn').addEventListener('click', () => {
            const note = document.getElementById('noteTextarea').value;
            setUserNote(item.id, note);
            showToast(note.trim() ? `<i class="fas fa-sticky-note"></i> Nota guardada` : `<i class="fas fa-sticky-note"></i> Nota eliminada`);
            refreshCurrentView();
        });

        initReviews(item.id, type);

        document.querySelectorAll('.star-btn').forEach(btn => {
            btn.addEventListener('mouseenter', () => {
                const n = parseInt(btn.dataset.star);
                document.querySelectorAll('.star-btn').forEach((b,idx) => b.classList.toggle('hover', idx<n));
            });
            btn.addEventListener('mouseleave', () => document.querySelectorAll('.star-btn').forEach(b=>b.classList.remove('hover')));
            btn.addEventListener('click', () => {
                const n = parseInt(btn.dataset.star); const id = btn.dataset.id;
                const newRating = getUserRating(id)===n ? 0 : n;
                setUserRating(id, newRating);
                document.querySelectorAll('.star-btn').forEach((b,idx) => b.classList.toggle('filled', idx<newRating));
                document.getElementById('ratingValue').textContent = newRating>0 ? `${newRating}/5` : 'Sin valorar';
                showToast(newRating>0 ? `<i class="fas fa-star"></i> Valorado con ${newRating} estrella${newRating>1?'s':''}` : `<i class="fas fa-star"></i> Valoración eliminada`);
                refreshCurrentView();
            });
        });

        document.getElementById('trailerThumb')?.addEventListener('click', () => {
            const key = document.getElementById('trailerThumb').dataset.ytkey;
            const emb = document.getElementById('trailerEmbed');
            emb.innerHTML=`<iframe src="https://www.youtube.com/embed/${key}?autoplay=1" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
            emb.style.display='block'; document.getElementById('trailerThumb').style.display='none';
        });

        document.querySelectorAll('.clickable-cast').forEach(el => {
            el.addEventListener('click', () => { closeModalFn(); searchMode='person'; searchInput.value=el.dataset.personName; searchPerson(el.dataset.personName); });
        });

        bindSimilarEvents(type, item.id);
        let simPage = 1;
        document.getElementById('similarLoadMore')?.addEventListener('click', async () => {
            simPage++;
            const btn = document.getElementById('similarLoadMore');
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando...'; btn.disabled = true;
            try {
                const d = await tmdbFetch(`${BASE_URL}/${ep}/${item.id}/similar?api_key=${API_KEY}&language=${LANGUAGE}&page=${simPage}`);
                const grid = document.querySelector('.similar-grid');
                const newSims = d.results || [];
                if (!grid || !newSims.length) {
                    btn.innerHTML = '<i class="fas fa-plus"></i> Ver más similares';
                    btn.disabled = false;
                    return;
                }
                newSims.forEach(s => {
                    const st=s.title||s.name, sy=(s.release_date||s.first_air_date||'').split('-')[0];
                    const sp=s.poster_path?IMG_BASE+s.poster_path:'https://placehold.co/120x180/1a1a1a/666?text=N/A';
                    const card = document.createElement('div');
                    card.className='similar-card'; card.dataset.id=s.id; card.dataset.type=type;
                    card.innerHTML=`<img src="${sp}" alt="${st}" loading="lazy"><div class="similar-rating">⭐ ${s.vote_average?.toFixed(1)||'N/A'}</div><div class="similar-title">${st}</div><div class="similar-year">${sy}</div>`;
                    card.addEventListener('click', ()=>openModal(s.id, false, type));
                    grid.appendChild(card);
                });
                if (simPage >= d.total_pages) btn.remove();
                else { btn.innerHTML='<i class="fas fa-plus"></i> Ver más similares'; btn.disabled=false; }
            } catch(e) { btn.innerHTML='Error - reintentar'; btn.disabled=false; }
        });

        let currentServerIndex = 0;
        // Obtener primer episodio de primera temporada para series
        const firstSeason = type==='tv' ? (item.seasons?.find(s=>s.season_number>0)?.season_number || 1) : 1;
        const firstEpisode = 1;
        
        function loadServer(index) {
            currentServerIndex = index;
            const c = document.getElementById('videoContainer');
            // Para series pasar temporada y episodio, para películas solo el ID
            const url = type==='tv' ? SERVERS[index].url(item.id, firstSeason, firstEpisode) : SERVERS[index].url(item.id);
            c.innerHTML=`<iframe src="${url}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
            c.classList.add('visible');
            document.querySelectorAll('.server-btn').forEach((b,i)=>b.classList.toggle('active',i===index));
        }
        // Watch timer - registers as "seen" after 10min or 20% of runtime
        let watchRegistered = false;
        function startWatchTimer() {
            if (watchRegistered || _globalWatchTimer) return;
            const runtimeMs = (item.runtime || 50) * 60 * 1000;
            const threshold = Math.max(10 * 60 * 1000, runtimeMs * 0.2);
            const mins = Math.round(threshold / 60000);
            showToast(`<i class="fas fa-clock"></i> Se registrará como vista en ${mins} min`);
            _globalWatchTimer = setTimeout(() => {
                _globalWatchTimer = null;
                if (!watchRegistered) {
                    watchRegistered = true;
                    addToHistory(item, type);
                    showToast('<i class="fas fa-check-circle"></i> ¡Registrada como vista!');
                }
            }, threshold);
        }

        document.getElementById('playBtn').addEventListener('click', ()=>{
            document.getElementById('serverSelector').classList.add('visible');
            loadServer(currentServerIndex);
            document.getElementById('cinemaBtn').style.display = 'inline-flex';
            startWatchTimer();
        });
        document.querySelectorAll('.server-btn').forEach((btn,i)=>btn.addEventListener('click',()=>loadServer(i)));
        document.getElementById('favDetailBtn').addEventListener('click',()=>{
            toggleFavorite(item.id);
            const b=document.getElementById('favDetailBtn'); const now=favorites.some(f=>f.id===item.id);
            b.innerHTML=`<i class="fas fa-star"></i> ${now?'En favoritos':'Favoritos'}`; b.classList.toggle('active-btn',now);
        });
        document.getElementById('wlDetailBtn').addEventListener('click',()=>{
            toggleWatchLater(item.id);
            const b=document.getElementById('wlDetailBtn'); const now=watchLater.some(f=>f.id===item.id);
            b.innerHTML=`<i class="fas fa-clock"></i> ${now?'En lista':'Ver después'}`; b.classList.toggle('active-btn',now);
        });

        document.getElementById('shareDetailBtn').addEventListener('click', () => openShareModal(item, type));
        document.getElementById('addToListDetailBtn').addEventListener('click', () => openAddToListPicker(item, type));
        document.getElementById('addToMarathonBtn').addEventListener('click', () => { addToMarathon(item, type); });

        document.getElementById('cinemaBtn').addEventListener('click', () => {
            enterCinemaMode(item, type, currentServerIndex, SERVERS);
        });

        loadDondeVer(item.id, type);

        if (item.belongs_to_collection) loadCollection(item.belongs_to_collection.id, item.id);

        loadTrivia(item);

        if (type === 'tv') loadTVSeasons(item);
        // Load "porque viste X"
        loadPorqueViste(item.id, type);

        if (autoPlay) {
            document.getElementById('serverSelector').classList.add('visible');
            loadServer(0);
            document.getElementById('cinemaBtn').style.display = 'inline-flex';
            startWatchTimer();
        }
    } catch(e) {
        console.error('Error modal:', e);
        modalBody.innerHTML=`<div class="empty-state"><span class="empty-kanji">誤</span><p>Error al cargar los datos.</p></div>`;
    }
}

function buildSimilarHTML(items, type, page, totalPages, itemId) {
    if (!items.length) return '';
    const cards = items.map(s => {
        const st=s.title||s.name, sy=(s.release_date||s.first_air_date||'').split('-')[0];
        const sp=s.poster_path?IMG_BASE+s.poster_path:'https://placehold.co/120x180/1a1a1a/666?text=N/A';
        return `<div class="similar-card" data-id="${s.id}" data-type="${type}">
            <img src="${sp}" alt="${st}" loading="lazy">
            <div class="similar-rating">⭐ ${s.vote_average?.toFixed(1)||'N/A'}</div>
            <div class="similar-title">${st}</div>
            <div class="similar-year">${sy}</div>
        </div>`;
    }).join('');
    const moreBtn = page < totalPages
        ? `<button class="load-more-similar-btn" id="similarLoadMore"><i class="fas fa-plus"></i> Ver más similares</button>` : '';
    return `
        <div class="similar-section">
            <h4>${type==='tv'?'Series similares':'Películas similares'}</h4>
            <div class="similar-grid">${cards}</div>
            ${moreBtn}
        </div>`;
}
function bindSimilarEvents(type, currentItemId) {
    document.querySelectorAll('.similar-card').forEach(card =>
        card.addEventListener('click', ()=>openModal(card.dataset.id, false, card.dataset.type||type)));
}

async function loadProfileView() {
    filterBar.style.display = 'none';
    sectionTitle.textContent = ''; sectionCount.textContent = '';
    cleanupExtras();
    checkAchievements();

    moviesGrid.className = 'movies-grid profile-view-grid';

    const totalWatched = watchHistory.length;
    const totalFavs    = favorites.length;
    const totalWL      = watchLater.length;
    const totalMin     = totalWatched * 110;
    const totalH       = Math.floor(totalMin / 60);
    const totalD       = Math.floor(totalH / 24);
    const timeStr      = totalD > 0 ? `${totalD}d ${totalH%24}h` : totalH > 0 ? `${totalH}h` : `${totalMin}min`;
    const unlockedAch  = Object.keys(achievements).length;

    const genreCount = {};
    [...watchHistory,...favorites].forEach(item =>
        (item.genre_ids||[]).forEach(g => { genreCount[g] = (genreCount[g]||0)+1; }));
    const topGenres = Object.entries(genreCount).sort((a,b)=>b[1]-a[1]).slice(0,6)
        .map(([id,c]) => ({ name: genresList.find(g=>g.id==id)?.name||`G${id}`, count:c }));

    const decCounts = {};
    watchHistory.forEach(it => {
        const y = parseInt((it.release_date||it.first_air_date||'0').split('-')[0]);
        if (y>=1970) { const d=Math.floor(y/10)*10; decCounts[d]=(decCounts[d]||0)+1; }
    });
    const topDec = Object.entries(decCounts).sort((a,b)=>b[1]-a[1])[0];

    const MN = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const byMonth = {};
    watchHistory.forEach(it => {
        const d = new Date(it._watchedAt||0);
        const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        (byMonth[k]||(byMonth[k]=[])).push(it);
    });
    const months = Object.keys(byMonth).sort((a,b)=>b.localeCompare(a));

    const cardRow = (item) => {
        const type   = item._type||(item.first_air_date?'tv':'movie');
        const title  = item.title||item.name||'';
        const yr     = (item.release_date||item.first_air_date||'').split('-')[0];
        const poster = item.poster_path ? IMG_BASE+item.poster_path : null;
        const rating = item.vote_average ? item.vote_average.toFixed(1) : '';
        const stars  = getUserRating(item.id);
        return `<div class="prow-item" data-id="${item.id}" data-type="${type}">
            ${poster?`<img src="${poster}" alt="" loading="lazy">`:'<div class="prow-noposter"></div>'}
            <div class="prow-info">
                <div class="prow-title">${title}</div>
                <div class="prow-meta">${yr}${type==='tv'?' · Serie':' · Película'}${rating?' · ⭐'+rating:''}</div>
            </div>
            ${stars?`<div class="prow-stars">${'⭐'.repeat(stars)}</div>`:''}
            <div class="prow-actions">
                <button class="prow-btn prow-fav ${isFavorite(item.id)?'active':''}" data-id="${item.id}" title="Favorito"><i class="fas fa-star"></i></button>
                <button class="prow-btn prow-wl ${isWatchLater(item.id)?'active':''}" data-id="${item.id}" title="Ver después"><i class="fas fa-clock"></i></button>
            </div>
        </div>`;
    };

    const { data: { user: fbUser } } = await window._sb?.auth?.getUser() || { data: { user: null } };
    const fbName    = fbUser?.user_metadata?.display_name || fbUser?.email?.split('@')[0] || 'Cinéfilo';
    const fbEmail   = fbUser?.email || '';
    const fbInitial = fbName.charAt(0).toUpperCase();
    const avatarHtml = userAvatarIcon
        ? `<span class="pv-avatar-icon">${userAvatarIcon}</span>`
        : `<span class="pv-avatar-initial">${fbInitial}</span>`;

    const level   = getUserLevel();
    const xp      = getUserXP();
    const lvlPct  = getLevelProgress();
    const challenge = getCurrentWeekChallenge();
    const chalProgress = getWeeklyProgress(challenge);
    const chalPct = Math.min(100, Math.round(chalProgress / challenge.target * 100));
    const stats   = buildAdvancedStats();

    moviesGrid.innerHTML = `
    <div class="pv-wrap">

      <!-- HERO BAR -->
      <div class="pv-hero">
        <div class="pv-hero-identity">
          <div class="pv-avatar">${avatarHtml}</div>
          <div>
            <div class="pv-hero-eyebrow">PERFIL</div>
            <div class="pv-hero-name">${fbName} <button class="pv-edit-btn" id="pvEditProfileBtn" title="Editar perfil"><i class="fas fa-pen"></i></button></div>
            <div class="pv-hero-email">${fbEmail}</div>
            <div class="pv-level-badge" style="color:${level.color}">${level.icon} ${level.label}</div>
            <div class="pv-level-bar-wrap">
                <div class="pv-level-bar"><div class="pv-level-fill" style="width:${lvlPct}%;background:${level.color}"></div></div>
                <span class="pv-level-xp">${xp} XP</span>
            </div>
            <div class="pv-hero-streak">🔥 Racha <strong>${streakData.streak}</strong> día${streakData.streak!==1?'s':''} · Récord <strong>${streakData.longest}</strong></div>
          </div>
        </div>
        <div class="pv-hero-kpis">
          <div class="pv-kpi"><span class="pv-kpi-n">${totalWatched}</span><span class="pv-kpi-l">Vistas</span></div>
          <div class="pv-kpi"><span class="pv-kpi-n">${totalFavs}</span><span class="pv-kpi-l">Favoritas</span></div>
          <div class="pv-kpi"><span class="pv-kpi-n">${totalWL}</span><span class="pv-kpi-l">Pendientes</span></div>
          <div class="pv-kpi"><span class="pv-kpi-n">${timeStr}</span><span class="pv-kpi-l">Invertido</span></div>
          <div class="pv-kpi"><span class="pv-kpi-n">${unlockedAch}<small>/${ACHIEVEMENTS_DEF.length}</small></span><span class="pv-kpi-l">Logros</span></div>
        </div>
      </div>

      <!-- TAB BAR -->
      <div class="pv-tabs">
        <button class="pvt active" data-tab="resumen"><i class="fas fa-chart-pie"></i> Resumen</button>
        <button class="pvt" data-tab="favoritos"><i class="fas fa-star"></i> Favoritos <em>${totalFavs}</em></button>
        <button class="pvt" data-tab="verdespues"><i class="fas fa-clock"></i> Ver después <em>${totalWL}</em></button>
        <button class="pvt" data-tab="historial"><i class="fas fa-history"></i> Historial <em>${totalWatched}</em></button>
        <button class="pvt" data-tab="estadisticas"><i class="fas fa-chart-bar"></i> Stats ${isPremium ? '' : '<span class="pv-lock-badge">⭐</span>'}</button>
        <button class="pvt" data-tab="retos"><i class="fas fa-fire"></i> Retos</button>
        <button class="pvt" data-tab="logros"><i class="fas fa-trophy"></i> Logros <em>${unlockedAch}</em></button>
        <button class="pvt" data-tab="leaderboard"><i class="fas fa-crown"></i> Ranking</button>
        <button class="pvt" data-tab="amigos"><i class="fas fa-user-friends"></i> Amigos <span id="friendsBadge"></span></button>
        ${isPremium ? '<button class="pvt sf-prem-tab" data-tab="continuar"><i class="fas fa-play-circle"></i> Continuar</button><button class="pvt sf-prem-tab" data-tab="recomendados"><i class="fas fa-magic"></i> Recomendados</button><button class="pvt sf-prem-tab" data-tab="perfil-bg"><i class="fas fa-image"></i> Mi perfil+</button>' : ''}
      </div>

      <!-- PANEL: RESUMEN -->
      <div class="pvp active" id="pvp-resumen">
        <div class="pvp-inner">

          <!-- PREMIUM CARD -->
          ${isPremium ?
            `<div class="sf-premium-active-card">
              <div class="sf-premium-active-icon">⭐</div>
              <div class="sf-premium-active-info">
                <div class="sf-premium-active-title">Eres miembro Premium</div>
                <div class="sf-premium-active-sub">Gracias por apoyar StreamFlex</div>
                <div class="sf-theme-picker">
                  <span class="sf-theme-label">Color de acento:</span>
                  <button class="sf-theme-dot ${premiumTheme==='red'?'active':''}"    data-theme="red"    style="background:#cc0000" title="Rojo"></button>
                  <button class="sf-theme-dot ${premiumTheme==='blue'?'active':''}"   data-theme="blue"   style="background:#0066cc" title="Azul"></button>
                  <button class="sf-theme-dot ${premiumTheme==='green'?'active':''}"  data-theme="green"  style="background:#00a550" title="Verde"></button>
                  <button class="sf-theme-dot ${premiumTheme==='purple'?'active':''}" data-theme="purple" style="background:#7b2dcc" title="Morado"></button>
                  <button class="sf-theme-dot ${premiumTheme==='gold'?'active':''}"   data-theme="gold"   style="background:#c9a84c" title="Dorado"></button>
                </div>
              </div>
              <button class="sf-premium-manage-btn" id="sfPremiumManageBtn">Gestionar</button>
            </div>` :
            `<div class="sf-premium-banner">
              <div class="sf-premium-banner-left">
                <div class="sf-premium-banner-title">⭐ StreamFlex Premium</div>
                <div class="sf-premium-banner-perks">
                  <span>✓ Sin popups</span><span>✓ Perfil+</span><span>✓ Recomendaciones pro</span><span>✓ Stats avanzadas</span>
                  <span>✓ Servidores Premium</span>
                </div>
              </div>
              <button class="sf-premium-banner-btn" id="sfPremiumOpenBtn">Ver planes</button>
            </div>`
          }

          <div class="pv-row-2col">
            <!-- Mini stats -->
            <div class="pv-miniblock">
              <div class="pv-block-label">Estadísticas generales</div>
              <div class="pv-minis">
                <div class="pv-mini"><i class="fas fa-eye"></i><span>${totalWatched} películas vistas</span></div>
                <div class="pv-mini"><i class="fas fa-clock"></i><span>${timeStr} de contenido</span></div>
                <div class="pv-mini"><i class="fas fa-star"></i><span>${totalFavs} en favoritos</span></div>
                <div class="pv-mini"><i class="fas fa-clock"></i><span>${totalWL} por ver</span></div>
                <div class="pv-mini"><i class="fas fa-list"></i><span>${Object.keys(customLists).length} listas creadas</span></div>
                <div class="pv-mini"><i class="fas fa-star-half-alt"></i><span>${Object.keys(userRatings).length} valoraciones dadas</span></div>
                ${topDec?`<div class="pv-mini"><i class="fas fa-calendar-alt"></i><span>Década favorita: <strong>${topDec[0]}s</strong></span></div>`:''}
                <div class="pv-mini">🔥<span>Racha actual: <strong>${streakData.streak} días</strong></span></div>
              </div>
            </div>
            <!-- Genre chart -->
            ${topGenres.length?`
            <div class="pv-miniblock">
              <div class="pv-block-label">Géneros más vistos</div>
              <div class="pv-chart-wrap"><canvas id="pvGenreChart" height="220"></canvas></div>
            </div>`:''}
          </div>

          <!-- Recent row -->
          ${watchHistory.length?`
          <div class="pv-recents-block">
            <div class="pv-block-label">Visto recientemente</div>
            <div class="pv-recents-scroll">
              ${watchHistory.slice(0,12).map(it => {
                const t = it._type||(it.first_air_date?'tv':'movie');
                const p = it.poster_path?IMG_BASE+it.poster_path:null;
                return `<div class="pv-rec-thumb" data-id="${it.id}" data-type="${t}" title="${it.title||it.name||''}">
                  ${p?`<img src="${p}" alt="" loading="lazy">`:'<div class="pv-rec-blank"></div>'}
                  <div class="pv-rec-overlay"><i class="fas fa-play"></i></div>
                </div>`;
              }).join('')}
            </div>
          </div>`:''}

          <!-- Data actions -->
          <div class="pv-data-section">
            <div class="pv-block-label">Datos y sincronización</div>
            <div class="pv-data-btns">
              <button class="pv-dbtn" id="pvExport"><i class="fas fa-download"></i> Exportar</button>
              <label class="pv-dbtn" style="cursor:pointer"><i class="fas fa-upload"></i> Importar<input type="file" id="pvImport" accept=".json" style="display:none"></label>
              <button class="pv-dbtn" id="pvSync"><i class="fas fa-link"></i> URL Sync</button>
              <button class="pv-dbtn pv-dbtn-danger" id="pvClear"><i class="fas fa-trash"></i> Borrar historial</button>
            </div>
          </div>
        </div>
      </div>

      <!-- PANEL: FAVORITOS -->
      <div class="pvp" id="pvp-favoritos">
        <div class="pvp-inner">
          ${totalFavs?`
          <div class="pv-list-hdr">
            <span class="pv-list-count"><i class="fas fa-star"></i> ${totalFavs} película${totalFavs!==1?'s':''}</span>
          </div>
          <div class="prow-list" id="pvFavList">
            ${favorites.map(it=>cardRow(it)).join('')}
          </div>`:`
          <div class="pv-empty-tab"><span>⭐</span><p>No tienes favoritos todavía.</p><small>Pulsa <i class="fas fa-star"></i> en cualquier película.</small></div>`}
        </div>
      </div>

      <!-- PANEL: VER DESPUÉS -->
      <div class="pvp" id="pvp-verdespues">
        <div class="pvp-inner">
          ${totalWL?`
          <div class="pv-list-hdr">
            <span class="pv-list-count"><i class="fas fa-clock"></i> ${totalWL} pendiente${totalWL!==1?'s':''} · ~${Math.round(totalWL*110/60)}h estimadas</span>
          </div>
          <div class="prow-list" id="pvWLList">
            ${watchLater.map(it=>cardRow(it)).join('')}
          </div>`:`
          <div class="pv-empty-tab"><span>⏰</span><p>Tu lista de "Ver después" está vacía.</p><small>Presiona el ícono <i class="fas fa-clock"></i> en cualquier película.</small></div>`}
        </div>
      </div>

      <!-- PANEL: HISTORIAL -->
      <div class="pvp" id="pvp-historial">
        <div class="pvp-inner">
          ${totalWatched?`
          <div class="pv-list-hdr">
            <span class="pv-list-count"><i class="fas fa-history"></i> ${totalWatched} vista${totalWatched!==1?'s':''} · ${timeStr}</span>
          </div>
          <div class="prow-list prow-history" id="pvHistList">
            ${watchHistory.map((it,i) => {
              const type = it._type||(it.first_air_date?'tv':'movie');
              const title = it.title||it.name||'';
              const yr    = (it.release_date||it.first_air_date||'').split('-')[0];
              const poster= it.poster_path?IMG_BASE+it.poster_path:null;
              const stars = getUserRating(it.id);
              const d     = new Date(it._watchedAt||0);
              const ds    = it._watchedAt?d.toLocaleDateString('es-ES',{day:'numeric',month:'short'}):'';
              return `<div class="prow-item prow-hist-item" data-id="${it.id}" data-type="${type}">
                <span class="prow-n">${i+1}</span>
                ${poster?`<img src="${poster}" alt="" loading="lazy">`:'<div class="prow-noposter"></div>'}
                <div class="prow-info">
                  <div class="prow-title">${title}</div>
                  <div class="prow-meta">${yr}${ds?' · '+ds:''}</div>
                </div>
                ${stars?`<div class="prow-stars">${'⭐'.repeat(stars)}</div>`:''}
                <button class="prow-del" data-id="${it.id}" title="Eliminar"><i class="fas fa-times"></i></button>
              </div>`;
            }).join('')}
          </div>`:`
          <div class="pv-empty-tab"><span>📅</span><p>Tu historial está vacío.</p><small>Reproduce películas para que aparezcan aquí.</small></div>`}
        </div>
      </div>

      <!-- PANEL: DIARIO -->
      <div class="pvp" id="pvp-diario">
        <div class="pvp-inner">
          ${months.length?`
          <div class="pv-diary-summary">
            <span><i class="fas fa-film"></i> ${totalWatched} vistas</span>
            <span><i class="fas fa-calendar"></i> ${months.length} mes${months.length!==1?'es':''} activos</span>
          </div>
          ${months.map(key => {
            const [y,m] = key.split('-');
            const items = byMonth[key];
            return `<div class="pv-diary-month">
              <div class="pv-diary-mhdr">
                <span class="pv-diary-mname">${MN[parseInt(m)-1]}</span>
                <span class="pv-diary-myear">${y}</span>
                <span class="pv-diary-mcount">${items.length} vista${items.length!==1?'s':''}</span>
              </div>
              <div class="pv-diary-row">
                ${items.map(it => {
                  const p = it.poster_path?IMG_BASE+it.poster_path:null;
                  const type = it._type||(it.first_air_date?'tv':'movie');
                  const da = it._watchedAt?new Date(it._watchedAt).getDate():'';
                  const stars = getUserRating(it.id);
                  return `<div class="pv-diary-card" data-id="${it.id}" data-type="${type}" title="${it.title||it.name||''}">
                    ${p?`<img src="${p}" alt="" loading="lazy">`:'<div class="pv-diary-blank"></div>'}
                    ${da?`<div class="pv-diary-day">${da}</div>`:''}
                    ${stars?`<div class="pv-diary-star">${'⭐'.repeat(Math.min(stars,5))}</div>`:''}
                  </div>`;
                }).join('')}
              </div>
            </div>`;
          }).join('')}`:`
          <div class="pv-empty-tab"><span>📅</span><p>Tu diario está vacío.</p><small>Empieza a ver películas para llenar tu diario.</small></div>`}
        </div>
      </div>

      <!-- PANEL: LOGROS -->
      <div class="pvp" id="pvp-logros">
        <div class="pvp-inner">
          <div class="pv-logros-header">
            <div class="pv-logros-streak">🔥 Racha: <strong>${streakData.streak}</strong> día${streakData.streak!==1?'s':''} · Récord: <strong>${streakData.longest}</strong></div>
            <div class="pv-logros-bar-wrap">
              <div class="pv-logros-bar"><div style="width:${Math.round(unlockedAch/ACHIEVEMENTS_DEF.length*100)}%"></div></div>
              <span>${unlockedAch}/${ACHIEVEMENTS_DEF.length} desbloqueados</span>
            </div>
          </div>
          <div class="pv-logros-grid">
            ${ACHIEVEMENTS_DEF.map(a => {
              const ok = !!achievements[a.id];
              const dt = ok?new Date(achievements[a.id]).toLocaleDateString('es-ES'):null;
              return `<div class="pv-logro-card ${ok?'pv-logro-ok':'pv-logro-locked'}">
                <div class="pv-logro-icon">${ok?a.icon:'🔒'}</div>
                <div class="pv-logro-label">${a.label}</div>
                <div class="pv-logro-desc">${a.desc}</div>
                ${dt?`<div class="pv-logro-date">${dt}</div>`:''}
              </div>`;
            }).join('')}
          </div>
        </div>
      </div>

      <!-- PANEL: ESTADÍSTICAS AVANZADAS -->
      <div class="pvp" id="pvp-estadisticas">
        <div class="pvp-inner">
          ${!isPremium ? `
          <div class="sf-locked-feature">
            <div class="sf-locked-icon">📊</div>
            <div class="sf-locked-title">Estadísticas Avanzadas</div>
            <div class="sf-locked-sub">Accede a tus estadísticas detalladas con Premium</div>
            <button class="sf-locked-btn" id="sfStatsUnlockBtn">⭐ Ver planes Premium</button>
          </div>` : `<div class="pv-stats-grid">` }
          ${isPremium ? `` : ``}
          ${isPremium ? '<div class="pv-stats-grid">' : ''}
            <div class="pv-stat-card"><div class="pv-stat-icon">⏱️</div><div class="pv-stat-val">${Math.round(stats.totalHrs)}h</div><div class="pv-stat-label">Tiempo total</div></div>
            <div class="pv-stat-card"><div class="pv-stat-icon">⭐</div><div class="pv-stat-val">${stats.avgRating}</div><div class="pv-stat-label">Valoración media</div></div>
            <div class="pv-stat-card"><div class="pv-stat-icon">📅</div><div class="pv-stat-val">${stats.topMonth?stats.topMonth[0]:''}</div><div class="pv-stat-label">Mes más activo</div></div>
            <div class="pv-stat-card"><div class="pv-stat-icon">🔥</div><div class="pv-stat-val">${stats.topDecade?stats.topDecade[0]+"s":''}</div><div class="pv-stat-label">Década favorita</div></div>
          </div>
          ${stats.topGenreHours.length ? `
          <div class="pv-block-label" style="margin-top:1.5rem">⏱️ Horas por género</div>
          <div class="pv-genre-hours">
            ${stats.topGenreHours.map(([name,hrs]) =>
              "<div class=\"pv-gh-row\"><span class=\"pv-gh-name\">"+name+"</span><div class=\"pv-gh-bar-wrap\"><div class=\"pv-gh-bar\" style=\"width:"+Math.round(hrs/stats.topGenreHours[0][1]*100)+"%\"></div></div><span class=\"pv-gh-val\">"+hrs.toFixed(1)+"h</span></div>"
            ).join("")}
          </div>` : ""}
          ${stats.monthHistory.length > 1 ? `
          <div class="pv-block-label" style="margin-top:1.5rem">📈 Actividad mensual</div>
          <div class="pv-month-bars">
            ${stats.monthHistory.map(([month,count]) => {
              const mc = Math.max(...stats.monthHistory.map(m=>m[1]));
              return "<div class=\"pv-month-col\"><div class=\"pv-month-bar-wrap\"><div class=\"pv-month-bar\" style=\"height:"+Math.round(count/mc*80)+"px\"></div></div><div class=\"pv-month-label\">"+month.split(" ")[0]+"</div><div class=\"pv-month-count\">"+count+"</div></div>";
            }).join("")}
          </div>` : ""}
        </div>
      </div>

      ${isPremium ? '</div>' : ''}
      <!-- PANEL: RETOS SEMANALES -->
      <div class="pvp" id="pvp-retos">
        <div class="pvp-inner">
          <div class="pv-block-label">🔥 Reto activo esta semana</div>
          <div class="pv-challenge-card ${chalPct >= 100 ? "pv-challenge-done" : ""}">
            <div class="pv-challenge-icon">${challenge.icon}</div>
            <div class="pv-challenge-info">
              <div class="pv-challenge-label">${challenge.label}</div>
              <div class="pv-challenge-desc">${challenge.desc}</div>
              <div class="pv-challenge-progress-wrap">
                <div class="pv-challenge-bar"><div style="width:${chalPct}%"></div></div>
                <span>${chalProgress}/${challenge.target}${chalPct>=100?" ¡Completado!":""}</span>
              </div>
            </div>
          </div>
          <div class="pv-block-label" style="margin-top:2rem">📋 Todos los retos</div>
          <div class="pv-challenges-list">
            ${WEEKLY_CHALLENGES.map(c => {
              const isCurr = c.id === challenge.id;
              return "<div class=\"pv-challenge-row"+(isCurr?" pv-challenge-current":"")+"\">" +
                "<span class=\"pv-cr-icon\">"+c.icon+"</span>" +
                "<div class=\"pv-cr-info\"><div class=\"pv-cr-label\">"+c.label+(isCurr?" <span class=\"pv-cr-badge\">Esta semana</span>":"")+"</div><div class=\"pv-cr-desc\">"+c.desc+"</div></div>" +
                "</div>";
            }).join("")}
          </div>
        </div>
      </div>

      <!-- PANEL: AMIGOS -->
      <div class="pvp" id="pvp-amigos">
        <div class="pvp-inner">
          <div class="sf-friends-wrap">
            <!-- Search -->
            <div class="sf-friends-search-row">
              <div class="sf-friends-search-box">
                <i class="fas fa-search sf-friends-search-icon"></i>
                <input type="text" id="sfFriendSearch" class="sf-friends-search-input" placeholder="Buscar usuario por nombre...">
              </div>
              <button class="sf-friends-search-btn" id="sfFriendSearchBtn"><i class="fas fa-search"></i> Buscar</button>
            </div>
            <div id="sfFriendSearchResults"></div>
            <!-- Friend requests -->
            <div class="pv-block-label" style="margin-top:1.2rem"><i class="fas fa-bell"></i> Solicitudes de amistad <span id="requestsBadge"></span></div>
            <div id="sfFriendRequests"><div class="sf-friends-loading"><i class="fas fa-spinner fa-spin"></i></div></div>
            <!-- My friends -->
            <div class="pv-block-label" style="margin-top:1.2rem"><i class="fas fa-user-friends"></i> Mis amigos</div>
            <div id="sfFriendsList"><div class="sf-friends-loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</div></div>
            <!-- Activity feed -->
            <div class="pv-block-label" style="margin-top:1.5rem"><i class="fas fa-rss"></i> Actividad reciente</div>
            <div id="sfFriendsActivity"><div class="sf-friends-loading"><i class="fas fa-spinner fa-spin"></i></div></div>
          </div>
        </div>
      </div>

            <!-- PANEL: CONTINUAR VIENDO PREMIUM -->
      <div class="pvp" id="pvp-continuar"><div class="pvp-inner" id="pvContinuarInner"><div class="pv-empty-tab"><span>Play</span><p>Cargando...</p></div></div></div>

      <!-- PANEL: RECOMENDADOS PREMIUM -->
      <div class="pvp" id="pvp-recomendados"><div class="pvp-inner" id="pvRecomInner"><div class="pv-empty-tab"><span>Target</span><p>Cargando...</p></div></div></div>

      <!-- PANEL: PERFIL+ PREMIUM -->
      <div class="pvp" id="pvp-perfil-bg"><div class="pvp-inner" id="pvPerfilBgInner"><div class="loading-spinner" style="padding:2rem 0"><div class="spinner"></div></div></div></div>

      <!-- PANEL: LEADERBOARD -->
      <div class="pvp" id="pvp-leaderboard">
        <div class="pvp-inner">
          <div class="loading-spinner" style="padding:3rem 0"><div class="spinner"></div><span>Cargando ranking...</span></div>
        </div>
      </div>

    </div>`;

    document.querySelectorAll('.pvt').forEach(tab => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('.pvt').forEach(t=>t.classList.remove('active'));
            document.querySelectorAll('.pvp').forEach(p=>p.classList.remove('active'));
            tab.classList.add('active');
            const panel = document.getElementById(`pvp-${tab.dataset.tab}`);
            if (panel) panel.classList.add('active');
            if (tab.dataset.tab === 'resumen') setTimeout(()=>drawGenreChart(topGenres),50);
            if (tab.dataset.tab === 'leaderboard') loadLeaderboard();
        });
    });

    document.getElementById('pvEditProfileBtn')?.addEventListener('click', openEditProfile);

    initCardDelegation();

    document.querySelectorAll('.sf-theme-dot').forEach(dot => {
        dot.addEventListener('click', () => {
            if (!isPremium) return;
            applyPremiumTheme(dot.dataset.theme);
            document.querySelectorAll('.sf-theme-dot').forEach(d => d.classList.toggle('active', d === dot));
            showToast('⭐ Tema ' + dot.title + ' aplicado');
        });
    });

    document.getElementById('sfPremiumOpenBtn')?.addEventListener('click', () => {
        openPremiumModal();
    });
    document.getElementById('sfPremiumManageBtn')?.addEventListener('click', () => {
        openPremiumModal();
    });
    document.getElementById('sfStatsUnlockBtn')?.addEventListener('click', () => {
        openPremiumModal();
    });

    document.querySelectorAll('.pv-rec-thumb').forEach(el =>
        el.addEventListener('click', () => openModal(el.dataset.id, false, el.dataset.type)));

    document.querySelectorAll('.prow-item').forEach(el => {
        el.addEventListener('click', e => {
            if (e.target.closest('.prow-btn,.prow-del')) return;
            openModal(el.dataset.id, false, el.dataset.type);
        });
    });
    document.querySelectorAll('.prow-fav').forEach(btn =>
        btn.addEventListener('click', e => { e.stopPropagation(); toggleFavorite(btn.dataset.id); btn.classList.toggle('active'); }));
    document.querySelectorAll('.prow-wl').forEach(btn =>
        btn.addEventListener('click', e => { e.stopPropagation(); toggleWatchLater(btn.dataset.id); btn.classList.toggle('active'); }));
    document.querySelectorAll('.prow-del').forEach(btn =>
        btn.addEventListener('click', e => {
            e.stopPropagation();
            watchHistory = watchHistory.filter(h=>h.id!==parseInt(btn.dataset.id));
            localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
            btn.closest('.prow-item').remove();
            showToast('<i class="fas fa-trash"></i> Eliminado del historial');
        }));

    document.querySelectorAll('.pv-diary-card').forEach(el =>
        el.addEventListener('click', ()=>openModal(el.dataset.id, false, el.dataset.type)));

    document.getElementById('pvExport')?.addEventListener('click', exportData);
    document.getElementById('pvImport')?.addEventListener('change', e=>{ if(e.target.files[0]) importData(e.target.files[0]); });
    document.getElementById('pvSync')?.addEventListener('click', ()=>
        navigator.clipboard.writeText(generateSyncURL()).then(()=>showToast('<i class="fas fa-link"></i> URL de sync copiada')));
    document.getElementById('pvClear')?.addEventListener('click', async ()=>{
        const ok = await sfConfirm({
            icon: '⚠️', kanji: 'OK',
            title: 'Borrar historial',
            body: 'Se eliminará todo tu historial de visualización. Esta acción no se puede deshacer.',
            confirmText: '<i class="fas fa-trash"></i> Borrar todo',
            cancelText: 'Cancelar',
            variant: 'danger'
        });
        if (!ok) return;
        watchHistory=[]; localStorage.setItem('watchHistory', JSON.stringify(watchHistory));
        showToast('<i class="fas fa-trash"></i> Historial borrado'); loadProfileView();
    });

    drawGenreChart(topGenres);
}

function drawGenreChart(topGenres) {
    if (!topGenres.length) return;
    const canvas = document.getElementById('pvGenreChart');
    if (!canvas) return;
    if (canvas._chart) { canvas._chart.destroy(); canvas._chart = null; }
    const dark = document.documentElement.getAttribute('data-theme') !== 'light';
    canvas._chart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
            labels: topGenres.map(g=>g.name),
            datasets: [{ data: topGenres.map(g=>g.count),
                backgroundColor:['#cc0000','#8b0000','#c9a84c','#666','#444','#2a2a2a'],
                borderWidth:0, borderRadius:3 }]
        },
        options: { responsive:true, plugins:{ legend:{display:false},
            tooltip:{ backgroundColor:'#1a1a1a', titleColor:'#f0ede8', bodyColor:'#888',
                callbacks:{ label: c=>` ${c.raw} películas` } } },
            scales: {
                x:{ ticks:{color:dark?'#888':'#555', font:{family:'Noto Sans JP',size:11}}, grid:{color:'transparent'} },
                y:{ ticks:{color:dark?'#888':'#555', stepSize:1}, grid:{color:dark?'rgba(255,255,255,0.05)':'rgba(0,0,0,0.06)'} }
            }
        }
    });
}

function saveCustomLists() {
    localStorage.setItem('customLists', JSON.stringify(customLists));
    cloudSave();
}

function openListsManager() {
    document.body.style.overflow = 'hidden';
    modal.style.display = 'block';
    renderListsManager();
}

function renderListsManager() {
    const listIds = Object.keys(customLists);
    modalBody.innerHTML = `
        <div class="lists-container">
            <div class="lists-header">
                <div class="lists-title-jp">COLECCIONES</div>
                <h2>Mis listas</h2>
            </div>
            <div class="lists-create-row">
                <input type="text" id="newListNameInput" class="lists-name-input" placeholder="Ej: Terror para Halloween..." maxlength="40">
                <button class="lists-create-btn" id="createListBtn"><i class="fas fa-plus"></i> Crear lista</button>
            </div>
            <div class="lists-grid" id="listsGrid">
                ${listIds.length === 0 ? `
                    <div class="lists-empty"><span>📋</span><p>No tienes listas todavía. ¡Crea una!</p></div>
                ` : listIds.map(id => {
                    const list = customLists[id];
                    const count = list.items.length;
                    const previewPosters = list.items.slice(0,3).map(item =>
                        item.poster_path ? `<img src="${IMG_BASE}${item.poster_path}" alt="">` : '<div class="list-card-noposter"></div>'
                    ).join('');
                    return `<div class="list-card" data-list-id="${id}">
                        <div class="list-card-posters">${previewPosters}</div>
                        <div class="list-card-info">
                            <div class="list-card-name">${list.name}</div>
                            <div class="list-card-count">${count} título${count!==1?'s':''}</div>
                        </div>
                        <div class="list-card-actions">
                            <button class="list-card-btn open-list-btn" data-list-id="${id}"><i class="fas fa-folder-open"></i></button>
                            <button class="list-card-btn delete-list-btn" data-list-id="${id}"><i class="fas fa-trash"></i></button>
                        </div>
                    </div>`;
                }).join('')}
            </div>
        </div>`;

    document.getElementById('createListBtn').addEventListener('click', () => {
        const name = document.getElementById('newListNameInput').value.trim();
        if (!name) return;
        if (!isPremium && Object.keys(customLists).length >= 3) {
            showToast('⭐ Límite de 3 listas. Hazte Premium para listas ilimitadas.');
            return;
        }
        const id = 'list_' + Date.now();
        customLists[id] = { name, items: [] };
        saveCustomLists();
        showToast(`<i class="fas fa-list-ul"></i> Lista "${name}" creada`);
        renderListsManager();
    });

    document.getElementById('newListNameInput').addEventListener('keypress', e => {
        if (e.key === 'Enter') document.getElementById('createListBtn').click();
    });

    document.querySelectorAll('.open-list-btn').forEach(btn => {
        btn.addEventListener('click', e => { e.stopPropagation(); renderListDetail(btn.dataset.listId); });
    });
    document.querySelectorAll('.list-card').forEach(card => {
        card.addEventListener('click', () => renderListDetail(card.dataset.listId));
    });
    document.querySelectorAll('.delete-list-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            e.stopPropagation();
            const name = customLists[btn.dataset.listId]?.name;
            const delOk = await sfConfirm({
                icon: '🗑️', kanji: 'OK',
                title: 'Eliminar lista',
                body: `¿Eliminar la lista "${name}"? Se perderán todas las películas guardadas en ella.`,
                confirmText: '<i class="fas fa-trash"></i> Eliminar',
                cancelText: 'Cancelar',
                variant: 'danger'
            });
            if (delOk) {
                delete customLists[btn.dataset.listId];
                saveCustomLists();
                renderListsManager();
            }
        });
    });
}

function renderListDetail(listId) {
    const list = customLists[listId];
    if (!list) return;
    modalBody.innerHTML = `
        <div class="lists-container">
            <button class="lists-back-btn" id="listsBackBtn"><i class="fas fa-arrow-left"></i> Mis listas</button>
            <div class="lists-detail-header">
                <div class="lists-title-jp">LISTA</div>
                <h2>${list.name}</h2>
                <span class="lists-count">${list.items.length} títulos</span>
            </div>
            ${list.items.length === 0 ? `<div class="lists-empty"><span>空</span><p>Esta lista está vacía. Abre una película y añádela.</p></div>` :
            `<div class="movies-grid" style="padding:0">
                ${list.items.map((item,i) => renderCard(item, i, item._type||(item.first_air_date?'tv':'movie'))).join('')}
            </div>`}
        </div>`;

    document.getElementById('listsBackBtn').addEventListener('click', renderListsManager);
    bindCardEvents();
}

function openAddToListPicker(item, type) {
    const listIds = Object.keys(customLists);
    const popup = document.createElement('div');
    popup.className = 'add-to-list-popup';
    popup.innerHTML = `
        <div class="atl-header"><i class="fas fa-list-ul"></i> Añadir a lista</div>
        ${listIds.length === 0 ? `<div class="atl-empty">No tienes listas. Créalas con el botón <i class="fas fa-list-ul"></i></div>` :
        listIds.map(id => {
            const l = customLists[id];
            const inList = l.items.some(it => it.id === item.id);
            return `<button class="atl-item ${inList?'in-list':''}" data-list-id="${id}">
                ${inList ? '<i class="fas fa-check"></i>' : '<i class="fas fa-plus"></i>'} ${l.name}
            </button>`;
        }).join('')}
        <button class="atl-new-btn" id="atlNewBtn"><i class="fas fa-folder-plus"></i> Nueva lista...</button>`;

    document.querySelector('.movie-detail-info').appendChild(popup);

    document.querySelectorAll('.atl-item').forEach(btn => {
        btn.addEventListener('click', () => {
            const lid = btn.dataset.listId;
            const l = customLists[lid];
            const idx = l.items.findIndex(it => it.id === item.id);
            if (idx === -1) {
                l.items.push({ ...item, _type: type });
                btn.innerHTML = `<i class="fas fa-check"></i> ${l.name}`;
                btn.classList.add('in-list');
                showToast(`<i class="fas fa-list-ul"></i> Añadido a "${l.name}"`);
            } else {
                l.items.splice(idx, 1);
                btn.innerHTML = `<i class="fas fa-plus"></i> ${l.name}`;
                btn.classList.remove('in-list');
                showToast(`<i class="fas fa-list-ul"></i> Eliminado de "${l.name}"`);
            }
            saveCustomLists();
        });
    });

    document.getElementById('atlNewBtn')?.addEventListener('click', () => {
        popup.remove();
        openListsManager();
    });

    setTimeout(() => {
        const handler = e => { if (!popup.contains(e.target) && e.target.id !== 'addToListDetailBtn') { popup.remove(); document.removeEventListener('click', handler); } };
        document.addEventListener('click', handler);
    }, 100);
}

function openShareModal(item, type) {
    const shareModal = document.getElementById('shareModal');
    const shareBody = document.getElementById('shareModalBody');
    document.body.style.overflow = 'hidden';
    shareModal.style.display = 'block';

    const title = item.title || item.name || '';
    const year = (item.release_date||item.first_air_date||'').split('-')[0];
    const rating = item.vote_average?.toFixed(1) || 'N/A';
    const genres = (item.genres||[]).map(g=>g.name).join(', ') || (item.genre_ids||[]).slice(0,2).map(id => genresList.find(g=>g.id==id)?.name).filter(Boolean).join(', ');
    const overview = (item.overview||'').slice(0,120) + ((item.overview||'').length > 120 ? '...' : '');
    const shareUrl = `https://www.themoviedb.org/${type}/${item.id}`;
    const poster = item.poster_path ? `${IMG_BASE}${item.poster_path}` : null;

    shareBody.innerHTML = `
        <div class="share-container">
            <div class="share-title-jp">COMPARTIR</div>
            <h2>Compartir película</h2>

            <div class="share-card-preview" id="shareCardPreview">
                <div class="share-card" id="shareCard">
                    <div class="share-card-bg" style="${poster?`background-image:url(${poster});`:'background:#1a1a1a;'}"></div>
                    <div class="share-card-overlay"></div>
                    <div class="share-card-content">
                        <div class="share-card-badge">StreamFlex</div>
                        ${poster ? `<img class="share-card-poster" src="${poster}" alt="${title}">` : ''}
                        <div class="share-card-info">
                            <div class="share-card-title">${title}</div>
                            <div class="share-card-meta">
                                <span>⭐ ${rating}</span>
                                <span>${year}</span>
                                ${genres ? `<span>${genres}</span>` : ''}
                            </div>
                            ${overview ? `<div class="share-card-overview">${overview}</div>` : ''}
                        </div>
                    </div>
                </div>
            </div>

            <div class="share-actions">
                <button class="share-action-btn primary" id="copyLinkBtn">
                    <i class="fas fa-link"></i> Copiar enlace
                </button>
                <button class="share-action-btn" id="copyTextBtn">
                    <i class="fas fa-copy"></i> Copiar texto
                </button>
                <button class="share-action-btn" id="downloadCardBtn">
                    <i class="fas fa-image"></i> Descargar tarjeta
                </button>
            </div>
            <div class="share-url-display">${shareUrl}</div>
        </div>`;

    document.getElementById('copyLinkBtn').addEventListener('click', () => {
        navigator.clipboard.writeText(shareUrl).then(() => showToast('<i class="fas fa-check"></i> Enlace copiado'));
    });

    document.getElementById('copyTextBtn').addEventListener('click', () => {
        const text = `🎬 ${title} (${year})\n⭐ ${rating}/10\n${genres}\n\n${overview}\n\n🔗 ${shareUrl}`;
        navigator.clipboard.writeText(text).then(() => showToast('<i class="fas fa-check"></i> Texto copiado'));
    });

    document.getElementById('downloadCardBtn').addEventListener('click', () => {
        downloadShareCard(item, type);
    });

    document.querySelector('.share-close').addEventListener('click', () => {
        shareModal.style.display = 'none';
        document.body.style.overflow = '';
    });
    shareModal.addEventListener('click', e => { if (e.target === shareModal) { shareModal.style.display='none'; document.body.style.overflow=''; } });
}

function downloadShareCard(item, type) {
    const title = item.title || item.name || '';
    const year = (item.release_date||item.first_air_date||'').split('-')[0];
    const rating = item.vote_average?.toFixed(1) || 'N/A';
    const genres = (item.genres||[]).map(g=>g.name).slice(0,2).join(' · ') ||
        (item.genre_ids||[]).slice(0,2).map(id => genresList.find(g=>g.id==id)?.name).filter(Boolean).join(' · ');
    const overview = (item.overview||'').slice(0,100);
    const poster = item.poster_path ? `${IMG_BASE}${item.poster_path}` : null;

    const canvas = document.createElement('canvas');
    canvas.width = 600; canvas.height = 340;
    const ctx = canvas.getContext('2d');

    const draw = (posterImg) => {

        ctx.fillStyle = '#0a0a0a';
        ctx.fillRect(0, 0, 600, 340);

        if (posterImg) {
            ctx.save();
            ctx.filter = 'blur(20px) brightness(0.25)';
            ctx.drawImage(posterImg, -40, -40, 680, 420);
            ctx.filter = 'none';
            ctx.restore();
        }

        ctx.fillStyle = '#cc0000';
        ctx.fillRect(0, 0, 4, 340);

        if (posterImg) {
            ctx.drawImage(posterImg, 30, 30, 160, 240);

            ctx.strokeStyle = 'rgba(255,255,255,0.1)';
            ctx.lineWidth = 1;
            ctx.strokeRect(30, 30, 160, 240);
        }

        ctx.fillStyle = '#cc0000';
        ctx.fillRect(210, 30, 120, 20);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 10px sans-serif';
        ctx.fillText('StreamFlex', 216, 44);

        ctx.fillStyle = '#f0ede8';
        ctx.font = 'bold 26px serif';
        const titleStr = title.length > 30 ? title.slice(0,27)+'...' : title;
        ctx.fillText(titleStr, 210, 90);

        ctx.fillStyle = '#888';
        ctx.font = '14px sans-serif';
        ctx.fillText(year, 210, 115);

        ctx.fillStyle = '#c9a84c';
        ctx.font = 'bold 18px sans-serif';
        ctx.fillText(`⭐ ${rating}`, 210, 145);

        if (genres) {
            ctx.fillStyle = '#666';
            ctx.font = '12px sans-serif';
            ctx.fillText(genres, 210, 168);
        }

        if (overview) {
            ctx.fillStyle = '#aaa';
            ctx.font = '11px sans-serif';
            const words = overview.split(' ');
            let line = '', y = 200, lineH = 16;
            for (const word of words) {
                const test = line + word + ' ';
                if (ctx.measureText(test).width > 355 && line) {
                    ctx.fillText(line.trim(), 210, y); line = word + ' '; y += lineH;
                    if (y > 270) break;
                } else { line = test; }
            }
            if (line.trim() && y <= 270) ctx.fillText(line.trim(), 210, y);
        }

        ctx.fillStyle = 'rgba(204,0,0,0.8)';
        ctx.fillRect(0, 300, 600, 40);
        ctx.fillStyle = '#fff';
        ctx.font = '11px sans-serif';
        ctx.fillText('streamflex.app · themoviedb.org', 210, 325);

        const a = document.createElement('a');
        a.download = `streamflex-${title.replace(/[^a-z0-9]/gi,'_').toLowerCase()}.png`;
        a.href = canvas.toDataURL('image/png');
        a.click();
        showToast('<i class="fas fa-image"></i> Tarjeta descargada');
    };

    if (poster) {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => draw(img);
        img.onerror = () => draw(null);
        img.src = poster;
    } else { draw(null); }
}

function toggleAdvancedPanel() {
    const panel = document.getElementById('advancedFilterPanel');
    const isVisible = panel.style.display !== 'none';
    panel.style.display = isVisible ? 'none' : 'block';
    document.getElementById('advancedFilterBtn').classList.toggle('active', !isVisible);
}

function hasActiveAdvFilters() {
    return advFilters.ratingMin > 0 || (advFilters.runtimeMax > 0 && advFilters.runtimeMax < 240) || advFilters.language || advFilters.voteMin > 0;
}

async function loadDondeVer(itemId, type) {
    const section = document.getElementById('dondeVerSection');
    if (!section) return;
    try {
        const res = await tmdbFetch(`${BASE_URL}/${type}/${itemId}/watch/providers?api_key=${API_KEY}`);
        const data = await res.json();

        const results = data.results || {};
        const region = results['ES'] || results['US'] || results['GB'] || Object.values(results)[0];

        if (!region) {
            section.innerHTML = `<div class="donde-ver-empty"><i class="fas fa-tv"></i> Sin datos de plataformas disponibles</div>`;
            return;
        }

        const streaming = region.flatrate || [];
        const rent = region.rent || [];
        const buy = region.buy || [];
        const justWatchLink = region.link || '#';

        const renderProviders = (providers, label) => {
            if (!providers.length) return '';
            return `<div class="dv-group">
                <div class="dv-group-label">${label}</div>
                <div class="dv-providers">
                    ${providers.slice(0,8).map(p => `
                        <div class="dv-provider" title="${p.provider_name}">
                            <img src="https://image.tmdb.org/t/p/original${p.logo_path}" alt="${p.provider_name}" loading="lazy">
                            <span>${p.provider_name}</span>
                        </div>`).join('')}
                </div>
            </div>`;
        };

        const hasAny = streaming.length || rent.length || buy.length;
        section.innerHTML = `
            <div class="donde-ver-content">
                <div class="dv-header">
                    <h4><i class="fas fa-tv"></i> Dónde ver</h4>
                    <a href="${justWatchLink}" target="_blank" rel="noopener" class="dv-justwatch-link">
                        <img src="https://www.justwatch.com/appassets/img/logo/JustWatch-logo-Large.png" alt="JustWatch" class="dv-justwatch-logo">
                    </a>
                </div>
                ${hasAny ? `
                    ${renderProviders(streaming, '<i class="fas fa-play-circle"></i> Streaming incluido')}
                    ${renderProviders(rent, '<i class="fas fa-euro-sign"></i> Alquiler')}
                    ${renderProviders(buy, '<i class="fas fa-shopping-cart"></i> Compra')}
                ` : '<div class="donde-ver-empty">No disponible en plataformas de streaming en tu región</div>'}
            </div>`;
    } catch(e) {
        const section = document.getElementById('dondeVerSection');
        if (section) section.innerHTML = '';
    }
}

async function loadPorqueViste(currentItemId, type) {
    const container = document.getElementById('porqueVisteContainer');
    if (!container || watchHistory.length < 2) return;

    const historyItem = watchHistory.find(h => h.id !== Number(currentItemId));
    if (!historyItem) return;

    try {
        const ep = historyItem._type === 'tv' ? 'tv' : 'movie';
        const res = await tmdbFetch(`${BASE_URL}/${ep}/${historyItem.id}/recommendations?api_key=${API_KEY}&language=${LANGUAGE}&page=1`);
        const data = await res.json();
        const items = (data.results || []).filter(m => m.id !== Number(currentItemId)).slice(0, 8);
        if (!items.length) return;

        const basedTitle = historyItem.title || historyItem.name || '';
        container.innerHTML = `
            <div class="porque-viste-section">
                <h4><i class="fas fa-history"></i> Porque viste <em>"${basedTitle}"</em></h4>
                <div class="similar-grid">
                    ${items.map(s => {
                        const st = s.title||s.name, sy = (s.release_date||s.first_air_date||'').split('-')[0];
                        const sp = s.poster_path ? IMG_BASE+s.poster_path : 'https://placehold.co/120x180/1a1a1a/666?text=N/A';
                        const mt = s.media_type || type;
                        return `<div class="similar-card" data-id="${s.id}" data-type="${mt}">
            <img src="${sp}" alt="${st}" loading="lazy">
            <div class="similar-rating">⭐ ${s.vote_average?.toFixed(1)||'N/A'}</div>
            <div class="similar-title">${st}</div>
                            <div class="similar-year">${sy}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        container.querySelectorAll('.similar-card').forEach(card =>
            card.addEventListener('click', () => openModal(card.dataset.id, false, card.dataset.type || type)));
    } catch(e) {  }
}

// ===== MODO "NO SÉ QUÉ VER" =====

const MOODS = [
    { id: 'action', label: '💥 Adrenalina', emoji: '💥', desc: 'Acción y emoción', genres: [28, 12], sort: 'popularity.desc' },
    { id: 'laugh', label: '😂 Reír', emoji: '😂', desc: 'Comedia ligera', genres: [35], sort: 'vote_average.desc' },
    { id: 'cry', label: '😭 Llorar', emoji: '😭', desc: 'Drama emotivo', genres: [18, 10749], sort: 'vote_average.desc' },
    { id: 'think', label: '🤔 Pensar', emoji: '🤔', desc: 'Thriller e intriga', genres: [9648, 53], sort: 'vote_average.desc' },
    { id: 'fear', label: '😱 Miedo', emoji: '😱', desc: 'Terror puro', genres: [27], sort: 'popularity.desc' },
    { id: 'wonder', label: '😮 Asombro', emoji: '😮', desc: 'Fantasia y ciencia ficción', genres: [878, 14], sort: 'vote_average.desc' },
    { id: 'relax', label: '😌 Relajar', emoji: '😌', desc: 'Animación y familia', genres: [16, 10751], sort: 'popularity.desc' },
    { id: 'short', label: '⏱ Rápida', emoji: '⏱', desc: 'Menos de 90 min', genres: [35, 28], sort: 'popularity.desc', runtimeMax: 90 },
];

function openMoodPicker() {
    document.body.style.overflow = 'hidden';
    modal.style.display = 'block';
    modalBody.innerHTML = `
        <div class="mood-container">
            <div class="mood-header">
                <div class="mood-title-jp">¿QUÉ VER?</div>
                <h2>¿Cómo te sientes hoy?</h2>
                <p class="mood-subtitle">Elige un estado de ánimo y te recomendamos la película perfecta</p>
            </div>
            <div class="mood-grid">
                ${MOODS.map(m => `
                    <button class="mood-card" data-mood="${m.id}">
                        <div class="mood-emoji">${m.emoji}</div>
                        <div class="mood-label">${m.label.replace(m.emoji+' ','')}</div>
                        <div class="mood-desc">${m.desc}</div>
                    </button>`).join('')}
            </div>
            <div class="mood-result" id="moodResult" style="display:none"></div>
        </div>`;

    document.querySelectorAll('.mood-card').forEach(card => {
        card.addEventListener('click', () => loadMoodRecommendation(card.dataset.mood, card));
    });
}

async function loadMoodRecommendation(moodId, cardEl) {
    const mood = MOODS.find(m => m.id === moodId);
    if (!mood) return;

    document.querySelectorAll('.mood-card').forEach(c => c.classList.toggle('selected', c === cardEl));

    const result = document.getElementById('moodResult');
    result.style.display = 'block';
    result.innerHTML = `<div class="mood-result-loading"><div class="spinner"></div><span>Buscando la película perfecta...</span></div>`;

    try {
        const page = Math.floor(Math.random() * 5) + 1;
        const genreParam = mood.genres.join(',');
        let url = `${BASE_URL}/discover/movie?api_key=${API_KEY}&language=${LANGUAGE}&with_genres=${genreParam}&sort_by=${mood.sort}&vote_count.gte=200&vote_average.gte=6&page=${page}`;
        if (mood.runtimeMax) url += `&with_runtime.lte=${mood.runtimeMax}`;

        const res = await fetch(url);
        const data = await res.json();
        const items = data.results || [];
        if (!items.length) { result.innerHTML = `<div class="mood-result-empty">No se encontraron películas. ¡Inténtalo de nuevo!</div>`; return; }

        const pick = items[Math.floor(Math.random() * Math.min(items.length, 10))];
        const poster = pick.poster_path ? IMG_BASE+pick.poster_path : null;
        const year = (pick.release_date||'').split('-')[0];

        result.innerHTML = `
            <div class="mood-result-card">
                <div class="mood-result-label">🍿 Tu película para esta noche</div>
                <div class="mood-result-inner">
                    ${poster ? `<img src="${poster}" alt="${pick.title}" class="mood-result-poster">` : ''}
                    <div class="mood-result-info">
                        <h3 class="mood-result-title">${pick.title}</h3>
                        <div class="mood-result-meta">
                            <span>⭐ ${pick.vote_average?.toFixed(1)}</span>
                            <span>${year}</span>
                        </div>
                        <p class="mood-result-overview">${(pick.overview||'').slice(0,160)}${(pick.overview||'').length > 160 ? '...' : ''}</p>
                        <div class="mood-result-actions">
                            <button class="detail-btn detail-btn-primary" id="moodOpenBtn"><i class="fas fa-info-circle"></i> Ver detalles</button>
                            <button class="detail-btn detail-btn-secondary" id="moodRerollBtn"><i class="fas fa-dice"></i> Otra película</button>
                        </div>
                    </div>
                </div>
            </div>`;

        document.getElementById('moodOpenBtn').addEventListener('click', () => openModal(pick.id, false, 'movie'));
        document.getElementById('moodRerollBtn').addEventListener('click', () => loadMoodRecommendation(moodId, cardEl));
    } catch(e) {
        result.innerHTML = `<div class="mood-result-empty">Error buscando películas. Inténtalo de nuevo.</div>`;
    }
}

function enterCinemaMode(item, type, serverIndex, servers) {
    const overlay = document.getElementById('cinemaOverlay');
    const player = document.getElementById('cinemaPlayer');
    const title = item.title || item.name || '';

    cinemaMode = { active: true, item, type, serverIndex, servers };
    document.getElementById('cinemaTitleBar').textContent = `${title} · StreamFlex`;
    document.getElementById('cinemaServerLabel').textContent = servers[serverIndex]?.label || 'Servidor 1';

    player.innerHTML = `<iframe src="${servers[serverIndex].url(item.id)}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media; fullscreen"></iframe>`;

    // Mostrar overlay de seguridad inicialmente
    const playerOverlay = document.getElementById('playerOverlay');
    if (playerOverlay) playerOverlay.style.display = 'flex';

    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';

    let hideTimeout;
    overlay.addEventListener('mousemove', () => {
        document.getElementById('cinemaTopbar').classList.remove('hidden');
        clearTimeout(hideTimeout);
        hideTimeout = setTimeout(() => document.getElementById('cinemaTopbar').classList.add('hidden'), 3000);
    });
    // Event listener para activar controles del player
    document.getElementById('activatePlayerBtn')?.addEventListener('click', () => {
        const iframe = player.querySelector('iframe');
        if (iframe) iframe.style.pointerEvents = 'auto';
        playerOverlay.style.display = 'none';
        showToast('<i class="fas fa-play"></i> Controles activados - usa con precaución');
    });

    modal.style.display = 'none';
}

function exitCinemaMode() {
    document.getElementById('cinemaOverlay').style.display = 'none';
    document.getElementById('cinemaPlayer').innerHTML = '';
    document.body.style.overflow = '';
    cinemaMode.active = false;
}

function changeCinemaServer(dir) {
    if (!cinemaMode.active) return;
    const { servers, item } = cinemaMode;
    cinemaMode.serverIndex = (cinemaMode.serverIndex + dir + servers.length) % servers.length;
    document.getElementById('cinemaPlayer').innerHTML = `<iframe src="${servers[cinemaMode.serverIndex].url(item.id)}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media; fullscreen"></iframe>`;
    document.getElementById('cinemaServerLabel').textContent = servers[cinemaMode.serverIndex].label;
    document.getElementById('cinemaTopbar').classList.remove('hidden');

    // Resetear overlay de seguridad al cambiar servidor
    const playerOverlay = document.getElementById('playerOverlay');
    if (playerOverlay) playerOverlay.style.display = 'flex';
    const iframe = document.querySelector('#cinemaPlayer iframe');
    if (iframe) iframe.style.pointerEvents = 'none';
}

function loadDiaryView() {
    sectionTitle.textContent = 'Diario de cine';
    sectionCount.textContent = '';
    cleanupExtras();

    if (!watchHistory.length) {
        moviesGrid.innerHTML = `<div class="empty-state"><span class="empty-kanji">📅</span><p>Tu diario está vacío. Empieza a ver películas.</p></div>`;
        return;
    }

    const byMonth = {};
    watchHistory.forEach(item => {
        const d = new Date(item._watchedAt || Date.now());
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        if (!byMonth[key]) byMonth[key] = [];
        byMonth[key].push(item);
    });

    const monthNames = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
    const sortedMonths = Object.keys(byMonth).sort((a,b) => b.localeCompare(a));

    moviesGrid.innerHTML = `
        <div class="diary-container">
            <div class="diary-stats-bar">
                <span><i class="fas fa-film"></i> ${watchHistory.length} películas vistas</span>
                <span><i class="fas fa-calendar"></i> ${sortedMonths.length} mese${sortedMonths.length!==1?'s':''} de actividad</span>
            </div>
            ${sortedMonths.map(monthKey => {
                const [year, month] = monthKey.split('-');
                const items = byMonth[monthKey];
                const monthName = monthNames[parseInt(month)-1];
                return `
                    <div class="diary-month">
                        <div class="diary-month-header">
                            <div class="diary-month-label">
                                <span class="diary-month-name">${monthName}</span>
                                <span class="diary-month-year">${year}</span>
                            </div>
                            <span class="diary-month-count">${items.length} vista${items.length!==1?'s':''}</span>
                        </div>
                        <div class="diary-items">
                            ${items.map(item => {
                                const poster = item.poster_path ? IMG_BASE+item.poster_path : null;
                                const title = item.title||item.name||'';
                                const yr = (item.release_date||item.first_air_date||'').split('-')[0];
                                const rating = getUserRating(item.id);
                                const d = new Date(item._watchedAt||0);
                                const dayStr = item._watchedAt ? `${d.getDate()} ${monthNames[d.getMonth()].slice(0,3)}` : '';
                                const type = item._type||(item.first_air_date?'tv':'movie');
                                return `<div class="diary-item" data-id="${item.id}" data-type="${type}">
                                    ${poster ? `<img src="${poster}" alt="${title}" loading="lazy">` : '<div class="diary-no-poster"></div>'}
                                    <div class="diary-item-info">
                                        <div class="diary-item-title">${title}</div>
                                        <div class="diary-item-meta">
                                            <span>${yr}</span>
                                            ${dayStr ? `<span class="diary-item-date"><i class="fas fa-calendar"></i> ${dayStr}</span>` : ''}
                                            ${rating ? `<span class="diary-item-rating">${'⭐'.repeat(rating)}</span>` : ''}
                                        </div>
                                    </div>
                                </div>`;
                            }).join('')}
                        </div>
                    </div>`;
            }).join('')}
        </div>`;

    document.querySelectorAll('.diary-item').forEach(el => {
        el.addEventListener('click', () => openModal(el.dataset.id, false, el.dataset.type));
    });
}

function handleKeyboardShortcuts(e) {
    const tag = document.activeElement.tagName.toLowerCase();
    if (['input','textarea','select'].includes(tag)) return;

    if (document.getElementById('cheatsheetOverlay').style.display !== 'none') {
        if (e.key === 'Escape' || e.key === '?') { toggleCheatsheet(false); return; }
    }

    if (cinemaMode.active) {
        if (e.key === 'Escape') exitCinemaMode();
        if (e.key === 'ArrowLeft') changeCinemaServer(-1);
        if (e.key === 'ArrowRight') changeCinemaServer(1);
        return;
    }

    switch(e.key) {
        case '/': e.preventDefault(); searchInput.focus(); break;
        case '?': toggleCheatsheet(true); break;
        case 'Escape': if (modal.style.display !== 'none') closeModalFn(); break;
        case 'r': case 'R': if (modal.style.display === 'none') handleRuleta(); break;
        case 't': case 'T': if (modal.style.display === 'none') toggleTheme(); break;
        case 'm': case 'M': if (modal.style.display === 'none') openMarathonManager(); break;
        case 'v': case 'V': startVoiceSearch(); break;
    }
}

function toggleCheatsheet(show) {
    document.getElementById('cheatsheetOverlay').style.display = show ? 'flex' : 'none';
}

function showSearchHistory() {
    if (!searchHistory.length) return;
    const dd = document.getElementById('searchHistoryDropdown');
    dd.innerHTML = `
        <div class="sh-header"><span>Búsquedas recientes</span><button id="shClearBtn"><i class="fas fa-trash"></i></button></div>
        ${searchHistory.map(q => `<div class="sh-item" data-q="${q}"><i class="fas fa-history"></i> ${q}</div>`).join('')}`;
    dd.style.display = 'block';
    dd.querySelectorAll('.sh-item').forEach(el => {
        el.addEventListener('mousedown', e => {
            e.preventDefault();
            searchInput.value = el.dataset.q;
            handleSearch();
        });
    });
    dd.querySelector('#shClearBtn')?.addEventListener('mousedown', e => {
        e.preventDefault();
        searchHistory = []; localStorage.setItem('searchHistory', JSON.stringify(searchHistory));
        dd.style.display = 'none';
    });
}

function startVoiceSearch() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) { showToast('<i class="fas fa-microphone-slash"></i> Tu navegador no soporta búsqueda por voz'); return; }
    const recognition = new SpeechRecognition();
    recognition.lang = 'es-ES';
    recognition.interimResults = false;
    const btn = document.getElementById('voiceSearchBtn');
    btn.classList.add('listening');
    showToast('<i class="fas fa-microphone"></i> Escuchando...');
    recognition.onresult = e => {
        const transcript = e.results[0][0].transcript;
        searchInput.value = transcript;
        btn.classList.remove('listening');
        handleSearch();
    };
    recognition.onerror = () => { btn.classList.remove('listening'); showToast('<i class="fas fa-microphone-slash"></i> No se pudo escuchar'); };
    recognition.onend = () => btn.classList.remove('listening');
    recognition.start();
}

function setupCardSwipeGestures() {
    const grid = document.getElementById('moviesGrid');
    let touchStartX = 0, touchStartY = 0, activeCard = null;

    grid.addEventListener('touchstart', e => {
        const card = e.target.closest('.movie-card');
        if (!card) return;
        touchStartX = e.touches[0].clientX;
        touchStartY = e.touches[0].clientY;
        activeCard = card;
    }, { passive: true });

    grid.addEventListener('touchend', e => {
        if (!activeCard) return;
        const dx = e.changedTouches[0].clientX - touchStartX;
        const dy = e.changedTouches[0].clientY - touchStartY;
        if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(dy) * 1.5) {
            const id = activeCard.dataset.id;
            if (dx > 0) {
                toggleFavorite(id);
                showSwipeIndicator(activeCard, '⭐ Favorito', 'right');
            } else {
                toggleWatchLater(id);
                showSwipeIndicator(activeCard, '⏰ Ver después', 'left');
            }
        }
        activeCard = null;
    }, { passive: true });
}

function showSwipeIndicator(card, text, dir) {
    const el = document.createElement('div');
    el.className = `swipe-indicator swipe-${dir}`;
    el.textContent = text;
    card.appendChild(el);
    setTimeout(() => el.remove(), 1000);
}

function saveMarathon() { localStorage.setItem('marathonQueue', JSON.stringify(marathonQueue)); cloudSave(); }

function addToMarathon(item, type) {
    if (marathonQueue.find(m => m.id === item.id)) { showToast('<i class="fas fa-film"></i> Ya está en el maratón'); return; }
    marathonQueue.push({ ...item, _type: type });
    saveMarathon();
    updateMarathonPanel();
    showToast(`<i class="fas fa-film"></i> "${item.title||item.name}" añadida al maratón`);
}

function closeMarathon() {
    marathonQueue = []; saveMarathon();
    document.getElementById('marathonPanel').style.display = 'none';
}

function toggleMarathonQueue() {
    const q = document.getElementById('marathonQueue');
    const isVisible = q.style.display !== 'none';
    q.style.display = isVisible ? 'none' : 'block';
    document.getElementById('marathonPanelBtn').innerHTML = isVisible
        ? '<i class="fas fa-chevron-down"></i> Ver cola'
        : '<i class="fas fa-chevron-up"></i> Ocultar';
}

function updateMarathonPanel() {
    const panel = document.getElementById('marathonPanel');
    if (!marathonQueue.length) { panel.style.display = 'none'; return; }
    panel.style.display = 'block';
    const totalMin = marathonQueue.length * 110;
    const h = Math.floor(totalMin/60), m = totalMin % 60;
    const watched = marathonQueue.filter(i => isWatched(i.id)).length;
    document.getElementById('marathonProgressFill').style.width = `${(watched/marathonQueue.length)*100}%`;
    document.getElementById('marathonProgressText').textContent = `${watched}/${marathonQueue.length}`;
    document.getElementById('marathonTimeLeft').textContent = `~${h}h ${m}min total`;

    const qEl = document.getElementById('marathonQueue');
    qEl.innerHTML = marathonQueue.map((item, i) => {
        const poster = item.poster_path ? IMG_BASE+item.poster_path : '';
        const watched = isWatched(item.id);
        return `<div class="marathon-item ${watched?'marathon-watched':''}">
            ${poster ? `<img src="${poster}" alt="">` : '<div class="marathon-noposter"></div>'}
            <span class="marathon-item-title">${item.title||item.name||''}</span>
            <div class="marathon-item-actions">
                <button class="marathon-play-btn" data-id="${item.id}" data-type="${item._type||'movie'}"><i class="fas fa-play"></i></button>
                <button class="marathon-remove-btn" data-idx="${i}"><i class="fas fa-times"></i></button>
            </div>
        </div>`;
    }).join('');

    qEl.querySelectorAll('.marathon-play-btn').forEach(btn =>
        btn.addEventListener('click', () => openModal(btn.dataset.id, true, btn.dataset.type)));
    qEl.querySelectorAll('.marathon-remove-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            marathonQueue.splice(parseInt(btn.dataset.idx), 1);
            saveMarathon(); updateMarathonPanel();
        }));
}

function openMarathonManager() {
    document.body.style.overflow = 'hidden';
    modal.style.display = 'block';
    const totalMin = marathonQueue.length * 110;
    const h = Math.floor(totalMin/60), m = totalMin % 60;
    const watched = marathonQueue.filter(i => isWatched(i.id)).length;

    modalBody.innerHTML = `
        <div class="marathon-manager">
            <div class="marathon-mgr-header">
                <div class="marathon-title-jp">MARATÓN</div>
                <h2>Modo Maratón</h2>
                <p class="marathon-mgr-sub">Crea una sesión de películas en cola</p>
            </div>
            ${marathonQueue.length ? `
            <div class="marathon-mgr-stats">
                <span><i class="fas fa-film"></i> ${marathonQueue.length} películas</span>
                <span><i class="fas fa-clock"></i> ~${h}h ${m}min</span>
                <span><i class="fas fa-check"></i> ${watched} vistas</span>
            </div>
            <div class="marathon-mgr-list">
                ${marathonQueue.map((item,i) => {
                    const poster = item.poster_path ? IMG_BASE+item.poster_path : '';
                    const yr = (item.release_date||item.first_air_date||'').split('-')[0];
                    const watched = isWatched(item.id);
                    return `<div class="marathon-mgr-item ${watched?'marathon-mgr-watched':''}">
                        <span class="marathon-mgr-num">${i+1}</span>
                        ${poster ? `<img src="${poster}" alt="">` : ''}
                        <div class="marathon-mgr-info">
                            <div class="marathon-mgr-title">${item.title||item.name||''}</div>
                            <div class="marathon-mgr-meta">${yr} · ~110 min ${watched?'<span class="marathon-seen">✓ Vista</span>':''}</div>
                        </div>
                        <div class="marathon-mgr-actions">
                            <button class="mgr-play-btn" data-id="${item.id}" data-type="${item._type||'movie'}"><i class="fas fa-play"></i> Ver</button>
                            <button class="mgr-rm-btn" data-idx="${i}"><i class="fas fa-times"></i></button>
                        </div>
                    </div>`;
                }).join('')}
            </div>
            <div class="marathon-mgr-actions-bar">
                <button class="detail-btn detail-btn-primary" id="playNextMarathonBtn"><i class="fas fa-play"></i> Reproducir siguiente</button>
                <button class="detail-btn detail-btn-secondary" id="clearMarathonBtn"><i class="fas fa-trash"></i> Limpiar cola</button>
            </div>` : `
            <div class="marathon-empty">
                <span>🎬</span>
                <p>Tu maratón está vacío. Añade películas usando el botón <strong>+ Maratón</strong> en cualquier película.</p>
                <p style="font-size:0.75rem;color:var(--text-muted);margin-top:0.4rem">También puedes pulsar <strong>+</strong> en el hero banner.</p>
            </div>`}
        </div>`;

    document.querySelectorAll('.mgr-play-btn').forEach(btn =>
        btn.addEventListener('click', () => openModal(btn.dataset.id, true, btn.dataset.type)));
    document.querySelectorAll('.mgr-rm-btn').forEach(btn =>
        btn.addEventListener('click', () => {
            marathonQueue.splice(parseInt(btn.dataset.idx), 1);
            saveMarathon(); openMarathonManager();
        }));
    document.getElementById('playNextMarathonBtn')?.addEventListener('click', () => {
        const next = marathonQueue.find(i => !isWatched(i.id));
        if (next) openModal(next.id, true, next._type||'movie');
        else showToast('<i class="fas fa-check"></i> ¡Maratón completado!');
    });
    document.getElementById('clearMarathonBtn')?.addEventListener('click', () => {
        marathonQueue = []; saveMarathon(); updateMarathonPanel(); closeModalFn();
    });
}

function openTop10Modal() {
    document.body.style.overflow = 'hidden';
    modal.style.display = 'block';
    renderTop10();
}

function renderTop10() {
    const allItems = [...favorites, ...watchHistory].filter((v,i,a) => a.findIndex(t=>t.id===v.id)===i).slice(0,30);
    modalBody.innerHTML = `
        <div class="top10-container">
            <div class="top10-header">
                <div class="top10-jp">MI TOP 10</div>
                <h2>Mi Ranking Personal</h2>
                <p class="top10-sub">Arrastra para reordenar · Haz click en + para añadir</p>
            </div>
            <div class="top10-layout">
                <div class="top10-list" id="top10List">
                    ${top10List.length === 0 ? '<div class="top10-empty">Añade películas desde la lista de la derecha</div>' :
                    top10List.map((item,i) => `
                        <div class="top10-item" draggable="true" data-id="${item.id}" data-idx="${i}">
                            <div class="top10-rank">${i+1}</div>
                            ${item.poster_path ? `<img src="${IMG_BASE}${item.poster_path}" alt="">` : '<div class="top10-noposter"></div>'}
                            <div class="top10-item-info">
                                <div class="top10-item-title">${item.title||item.name||''}</div>
                                <div class="top10-item-year">${(item.release_date||'').split('-')[0]}</div>
                            </div>
                            <button class="top10-remove" data-idx="${i}"><i class="fas fa-times"></i></button>
                        </div>`).join('')}
                </div>
                <div class="top10-picker">
                    <div class="top10-picker-label">Añadir película</div>
                    <div class="top10-picker-list">
                        ${allItems.filter(i => !top10List.find(t=>t.id===i.id)).slice(0,15).map(item => `
                            <div class="top10-pick-item" data-id="${item.id}">
                                ${item.poster_path ? `<img src="${IMG_BASE}${item.poster_path}" alt="">` : ''}
                                <span>${item.title||item.name||''}</span>
                                <button class="top10-add-btn" data-id="${item.id}"><i class="fas fa-plus"></i></button>
                            </div>`).join('')}
                    </div>
                </div>
            </div>
            <div class="top10-actions">
                <button class="detail-btn detail-btn-primary" id="exportTop10Btn"><i class="fas fa-image"></i> Exportar como imagen</button>
                <button class="detail-btn detail-btn-secondary" id="clearTop10Btn"><i class="fas fa-trash"></i> Limpiar</button>
            </div>
        </div>`;

    setupTop10DragDrop();

    document.querySelectorAll('.top10-add-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            if (top10List.length >= 10) { showToast('Ya tienes 10 películas en tu ranking'); return; }
            const item = allItems.find(i => i.id === parseInt(btn.dataset.id));
            if (item) { top10List.push(item); localStorage.setItem('top10List', JSON.stringify(top10List)); renderTop10(); }
        });
    });
    document.querySelectorAll('.top10-remove').forEach(btn => {
        btn.addEventListener('click', () => {
            top10List.splice(parseInt(btn.dataset.idx), 1);
            localStorage.setItem('top10List', JSON.stringify(top10List)); renderTop10();
        });
    });
    document.getElementById('exportTop10Btn')?.addEventListener('click', exportTop10Image);
    document.getElementById('clearTop10Btn')?.addEventListener('click', () => {
        top10List = []; localStorage.setItem('top10List', JSON.stringify(top10List)); renderTop10();
    });
}

function setupTop10DragDrop() {
    const list = document.getElementById('top10List');
    if (!list) return;
    let dragIdx = null;
    list.querySelectorAll('.top10-item').forEach((item, i) => {
        item.addEventListener('dragstart', () => { dragIdx = i; item.classList.add('dragging'); });
        item.addEventListener('dragend', () => item.classList.remove('dragging'));
        item.addEventListener('dragover', e => { e.preventDefault(); item.classList.add('drag-over'); });
        item.addEventListener('dragleave', () => item.classList.remove('drag-over'));
        item.addEventListener('drop', e => {
            e.preventDefault(); item.classList.remove('drag-over');
            const targetIdx = parseInt(item.dataset.idx);
            if (dragIdx !== null && dragIdx !== targetIdx) {
                const [moved] = top10List.splice(dragIdx, 1);
                top10List.splice(targetIdx, 0, moved);
                localStorage.setItem('top10List', JSON.stringify(top10List));
                renderTop10();
            }
        });
    });
}

function exportTop10Image() {
    const canvas = document.createElement('canvas');
    const cols = 5, rows = 2, pw = 120, ph = 180, pad = 12, headerH = 80;
    canvas.width  = cols * (pw + pad) + pad;
    canvas.height = rows * (ph + 50 + pad) + headerH + pad;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#cc0000';
    ctx.fillRect(0, 0, canvas.width, 4);

    ctx.fillStyle = '#f0ede8';
    ctx.font = 'bold 24px serif';
    ctx.textAlign = 'center';
    ctx.fillText('Mi Top 10 · StreamFlex', canvas.width/2, 40);
    ctx.fillStyle = '#888';
    ctx.font = '11px sans-serif';
    ctx.fillText(new Date().toLocaleDateString('es-ES', {year:'numeric',month:'long'}), canvas.width/2, 62);
    ctx.textAlign = 'left';

    const drawItem = (item, i, img) => {
        const col = i % cols, row = Math.floor(i / cols);
        const x = pad + col * (pw + pad), y = headerH + pad + row * (ph + 50 + pad);
        if (img) ctx.drawImage(img, x, y, pw, ph);
        else { ctx.fillStyle = '#1a1a1a'; ctx.fillRect(x, y, pw, ph); }
        ctx.fillStyle = '#cc0000';
        ctx.fillRect(x, y, 24, 24);
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(i+1, x+12, y+16);
        ctx.textAlign = 'left';
        ctx.fillStyle = '#f0ede8';
        ctx.font = '10px sans-serif';
        const t = (item.title||item.name||'').slice(0,18);
        ctx.fillText(t, x, y + ph + 14);
    };

    let loaded = 0;
    const items = top10List.slice(0,10);
    if (!items.length) { showToast('Añade películas al ranking primero'); return; }

    items.forEach((item, i) => {
        if (!item.poster_path) { drawItem(item, i, null); loaded++; if (loaded===items.length) finalize(); return; }
        const img = new Image(); img.crossOrigin = 'anonymous';
        img.onload = () => { drawItem(item, i, img); loaded++; if (loaded===items.length) finalize(); };
        img.onerror = () => { drawItem(item, i, null); loaded++; if (loaded===items.length) finalize(); };
        img.src = `${IMG_BASE}${item.poster_path}`;
    });

    function finalize() {
        const a = document.createElement('a');
        a.download = 'streamflex-top10.png';
        a.href = canvas.toDataURL('image/png');
        a.click();
        showToast('<i class="fas fa-image"></i> Top 10 exportado');
    }
}

async function loadCollection(collectionId, currentItemId) {
    const section = document.getElementById('collectionSection');
    if (!section) return;
    try {
        const res = await tmdbFetch(`${BASE_URL}/collection/${collectionId}?api_key=${API_KEY}&language=${LANGUAGE}`);
        const data = await res.json();
        const parts = (data.parts||[]).sort((a,b)=>(a.release_date||'') > (b.release_date||'') ? 1 : -1);
        if (parts.length <= 1) return;
        section.innerHTML = `
            <div class="collection-section">
                <h4><i class="fas fa-layer-group"></i> Saga: ${data.name}</h4>
                <div class="collection-grid">
                    ${parts.map((p,i) => {
                        const poster = p.poster_path ? IMG_BASE+p.poster_path : 'https://placehold.co/80x120/1a1a1a/444?text=N/A';
                        const isCurrent = p.id === Number(currentItemId);
                        return `<div class="collection-item ${isCurrent?'collection-current':''}" data-id="${p.id}">
                            <div class="collection-num">${i+1}</div>
                            <img src="${poster}" alt="${p.title||''}" loading="lazy">
                            <div class="collection-item-title">${p.title||''}</div>
                            <div class="collection-item-year">${(p.release_date||'').split('-')[0]}</div>
                        </div>`;
                    }).join('')}
                </div>
            </div>`;
        section.querySelectorAll('.collection-item:not(.collection-current)').forEach(el =>
            el.addEventListener('click', () => openModal(el.dataset.id, false, 'movie')));
    } catch(e) {}
}

function loadTrivia(item) {
    const section = document.getElementById('triviaSection');
    if (!section) return;
    const facts = [];
    const budget = item.budget || 0, revenue = item.revenue || 0;
    if (budget > 0) facts.push(`💰 Presupuesto: <strong>$${(budget/1e6).toFixed(0)}M</strong>`);
    if (revenue > 0) facts.push(`💰 Taquilla mundial: <strong>$${(revenue/1e6).toFixed(0)}M</strong>`);
    if (budget > 0 && revenue > 0) {
        const roi = ((revenue - budget) / budget * 100).toFixed(0);
        const profit = revenue - budget;
        facts.push(profit > 0
            ? `📈 Beneficio: <strong>$${(profit/1e6).toFixed(0)}M</strong> (${roi}% ROI)`
            : `📉 Pérdidas estimadas: <strong>$${(Math.abs(profit)/1e6).toFixed(0)}M</strong>`);
    }
    if (item.runtime > 0) {
        const h = Math.floor(item.runtime/60), m = item.runtime % 60;
        facts.push(`⏱️ Duración: <strong>${h}h ${m}min</strong> (${item.runtime} minutos)`);
    }
    if (item.vote_count > 0) facts.push(`⭐ Valoraciones: <strong>${item.vote_count?.toLocaleString()}</strong> votos en TMDB`);
    if (item.spoken_languages?.length > 1) facts.push(`🌍 Idiomas: <strong>${item.spoken_languages.map(l=>l.name).join(', ')}</strong>`);
    if (item.production_countries?.length) facts.push(`🌎 País: <strong>${item.production_countries.map(c=>c.name).join(', ')}</strong>`);
    if (item.production_companies?.length) facts.push(`🏭 Producción: <strong>${item.production_companies.slice(0,2).map(c=>c.name).join(', ')}</strong>`);

    if (!facts.length) return;
    section.innerHTML = `
        <div class="trivia-section">
            <h4><i class="fas fa-chart-bar"></i> Datos de producción</h4>
            <div class="trivia-grid">
                ${facts.map(f => `<div class="trivia-item">${f}</div>`).join('')}
            </div>
        </div>`;
}

function updateStreak() {
    const today = new Date().toDateString();
    const lastDate = streakData.lastWatch ? new Date(streakData.lastWatch).toDateString() : null;
    const yesterday = new Date(Date.now() - 86400000).toDateString();

    if (lastDate === today) return;
    if (lastDate === yesterday) {
        streakData.streak++;
    } else {
        streakData.streak = 1;
    }
    streakData.lastWatch = Date.now();
    streakData.longest = Math.max(streakData.longest, streakData.streak);
    localStorage.setItem('streakData', JSON.stringify(streakData));
    cloudSave();

    if (streakData.streak > 1) showToast(`🔥 ¡${streakData.streak} días de racha!`);
}

const ACHIEVEMENTS_DEF = [

    { id: 'first_watch',    icon: '🎬', label: 'Primera vez',        desc: 'Ve tu primera película',                  check: () => watchHistory.length >= 1 },
    { id: 'ten_movies',     icon: '🎥', label: 'Cinéfilo',           desc: '10 películas vistas',                     check: () => watchHistory.length >= 10 },
    { id: 'fifty_movies',   icon: '🏆', label: 'Maratonista',        desc: '50 películas vistas',                     check: () => watchHistory.length >= 50 },
    { id: 'hundred_movies', icon: '👑', label: 'Centenario',         desc: '100 películas vistas',                    check: () => watchHistory.length >= 100 },
    { id: 'twofit_movies',  icon: '🌟', label: 'Leyenda',            desc: '250 películas vistas',                    check: () => watchHistory.length >= 250 },

    { id: 'streak_3',       icon: '🔥', label: 'Racha de fuego',     desc: '3 días consecutivos',                     check: () => streakData.streak >= 3 },
    { id: 'streak_7',       icon: '💪', label: 'Semana perfecta',    desc: '7 días consecutivos',                     check: () => streakData.streak >= 7 },
    { id: 'streak_30',      icon: '🌙', label: 'Mes de cine',        desc: '30 días consecutivos',                    check: () => streakData.streak >= 30 },

    { id: 'five_favs',      icon: '⭐', label: 'Coleccionista',      desc: '5 películas en favoritos',                check: () => favorites.length >= 5 },
    { id: 'twenty_favs',    icon: '💫', label: 'Gran colección',     desc: '20 películas en favoritos',               check: () => favorites.length >= 20 },
    { id: 'lister',         icon: '📋', label: 'Organizador',        desc: 'Crea 3 listas personalizadas',            check: () => Object.keys(customLists).length >= 3 },
    { id: 'ten_lists',      icon: '📚', label: 'Archivista',        desc: '10 listas personalizadas',                check: () => Object.keys(customLists).length >= 10 },

    { id: 'rater',          icon: '📝', label: 'Crítico',            desc: 'Valora 10 películas',                     check: () => Object.keys(userRatings).length >= 10 },
    { id: 'critic_pro',     icon: '🏅', label: 'Crítico pro',       desc: 'Valora 50 películas',                     check: () => Object.keys(userRatings).length >= 50 },
    { id: 'notetaker',      icon: '📒', label: 'Anotador',           desc: 'Escribe 5 notas en películas',            check: () => Object.keys(userNotes).filter(k=>userNotes[k]?.trim()).length >= 5 },

    { id: 'explorer',       icon: '🧭', label: 'Explorador',         desc: '5 géneros distintos vistos',              check: () => { const gs=new Set(); watchHistory.forEach(h=>(h.genre_ids||[]).forEach(g=>gs.add(g))); return gs.size>=5; } },
    { id: 'omnivore',       icon: '🎭', label: 'Omnívoro',           desc: '10 géneros distintos vistos',             check: () => { const gs=new Set(); watchHistory.forEach(h=>(h.genre_ids||[]).forEach(g=>gs.add(g))); return gs.size>=10; } },
    { id: 'decade_80s',     icon: '📼', label: 'Cinéfilo de los 80s',desc: '5 películas de los 80s',                 check: () => watchHistory.filter(h=>(h.release_date||'').startsWith('198')).length >= 5 },
    { id: 'decade_90s',     icon: '📀', label: 'Noventero',          desc: '5 películas de los 90s',                 check: () => watchHistory.filter(h=>(h.release_date||'').startsWith('199')).length >= 5 },
    { id: 'classics',       icon: '🎞️', label: 'Clásicos eternos',  desc: '3 películas anteriores a 1970',           check: () => watchHistory.filter(h=>parseInt((h.release_date||'9999').split('-')[0])<1970).length >= 3 },

    { id: 'top10_full',     icon: '🔟', label: 'Mi Top 10',          desc: 'Completa tu Top 10',                     check: () => top10List.length >= 10 },
    { id: 'marathon_5',     icon: '🏃', label: 'Maratón épico',      desc: 'Crea un maratón de 5+ películas',        check: () => marathonQueue.length >= 5 },
    { id: 'marathon_10',    icon: '🏅', label: 'Maratón legendario', desc: 'Crea un maratón de 10+ películas',       check: () => marathonQueue.length >= 10 },

    { id: 'sharer',         icon: '📤', label: 'Embajador',          desc: 'Comparte tu primera película',            check: () => (localStorage.getItem('shareCount')||0) >= 1 },



    { id: 'premium_join',    icon: '⭐', label: 'Miembro Premium',    desc: 'Exclusivo Premium - Únete al club',   check: () => isPremium, premium: true },
    { id: 'premium_200',     icon: '💎', label: 'Centenario Premium', desc: 'Exclusivo - 200 películas vistas',    check: () => isPremium && watchHistory.length >= 200, premium: true },
    { id: 'premium_streak50',icon: '🔥', label: 'Racha Legendaria',   desc: 'Exclusivo - Racha de 50 días',        check: () => isPremium && streakData.streak >= 50, premium: true },
];

function checkAchievements() {
    let newUnlocked = [];
    ACHIEVEMENTS_DEF.forEach(a => {
        if (!achievements[a.id] && a.check()) {
            achievements[a.id] = Date.now();
            newUnlocked.push(a);
        }
    });
    if (newUnlocked.length) {
        localStorage.setItem('achievements', JSON.stringify(achievements));
        cloudSave();

        newUnlocked.forEach((a, i) => {
            setTimeout(() => showAchievementPopup(a), i * 2200);
        });
    }
}

function showAchievementPopup(a) {
    let el = document.getElementById('achUnlockPopup');
    if (!el) {
        el = document.createElement('div');
        el.id = 'achUnlockPopup';
        el.className = 'ach-unlock-popup';
        document.body.appendChild(el);
    }
    el.innerHTML = `
        <div class="aup-icon">${a.icon}</div>
        <div class="aup-info">
            <div class="aup-eyebrow">🎉 LOGRO DESBLOQUEADO</div>
            <div class="aup-label">${a.label}</div>
            <div class="aup-desc">${a.desc}</div>
        </div>`;
    el.classList.remove('hide');
    el.classList.add('show');
    setTimeout(() => {
        el.classList.remove('show');
        el.classList.add('hide');
    }, 2000);
}

function loadAchievementsView() {
    sectionTitle.textContent = 'Logros';
    sectionCount.textContent = `${Object.keys(achievements).length}/${ACHIEVEMENTS_DEF.length}`;
    checkAchievements();

    moviesGrid.innerHTML = `
        <div class="achievements-container">
            <div class="ach-header">
                <div class="ach-jp">LOGROS</div>
                <div class="ach-streak">🔥 Racha actual: <strong>${streakData.streak}</strong> día${streakData.streak!==1?'s':''} · Récord: <strong>${streakData.longest}</strong></div>
            </div>
            <div class="ach-grid">
                ${ACHIEVEMENTS_DEF.map(a => {
                    const unlocked = !!achievements[a.id];
                    const date = unlocked ? new Date(achievements[a.id]).toLocaleDateString('es-ES') : null;
                    return `<div class="ach-card ${unlocked?'ach-unlocked':'ach-locked'}">
                        <div class="ach-icon">${unlocked ? a.icon : '🔒'}</div>
                        <div class="ach-label">${a.label}</div>
                        <div class="ach-desc">${a.desc}</div>
                        ${date ? `<div class="ach-date">${date}</div>` : ''}
                    </div>`;
                }).join('')}
            </div>
        </div>`;
}

function generateSyncURL() {
    const data = { favorites, watchLater, top10List, userRatings };
    const compressed = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
    return `${location.href.split('?')[0]}?sync=${compressed}`;
}
function importFromSyncURL() {
    const params = new URLSearchParams(location.search);
    const sync = params.get('sync');
    if (!sync) return;
    try {
        const data = JSON.parse(decodeURIComponent(escape(atob(sync))));
        if (data.favorites)   { favorites = data.favorites;   localStorage.setItem('favorites', JSON.stringify(favorites)); }
        if (data.watchLater)  { watchLater = data.watchLater;  localStorage.setItem('watchLater', JSON.stringify(watchLater)); }
        if (data.top10List)   { top10List = data.top10List;    localStorage.setItem('top10List', JSON.stringify(top10List)); }
        if (data.userRatings) { userRatings = data.userRatings; localStorage.setItem('userRatings', JSON.stringify(userRatings)); }
        showToast('<i class="fas fa-sync"></i> Datos sincronizados desde URL');
        history.replaceState({}, '', location.pathname);
    } catch(e) {}
}

document.addEventListener('DOMContentLoaded', () => {
    importFromSyncURL();
    updateMarathonPanel();
});

async function loadTVSeasons(item) {
    const container = document.getElementById('tvSeasonsSection');
    if (!container) return;
    const seasons = (item.seasons || []).filter(s => s.season_number > 0);
    if (!seasons.length) return;

    container.innerHTML = `
    <div class="tv-seasons">
        <h4><i class="fas fa-tv"></i> Temporadas y episodios</h4>
        <div class="season-tabs">
            ${seasons.map((s,i) => `<button class="season-tab ${i===0?'active':''}" data-season="${s.season_number}">T${s.season_number}</button>`).join('')}
        </div>
        <div class="season-episodes" id="seasonEpisodesContainer">
            <div class="loading-spinner" style="padding:2rem 0"><div class="spinner"></div></div>
        </div>
    </div>`;

    const loadSeason = async (seasonNum) => {
        const ep = document.getElementById('seasonEpisodesContainer');
        ep.innerHTML = `<div class="loading-spinner" style="padding:2rem 0"><div class="spinner"></div></div>`;
        try {
            const data = await tmdbFetch(`${BASE_URL}/tv/${item.id}/season/${seasonNum}?api_key=${API_KEY}&language=${LANGUAGE}`);
            const eps = data.episodes || [];
            ep.innerHTML = `
            <div class="episodes-grid">
                ${eps.map(e => {
                    const still = e.still_path ? `https://image.tmdb.org/t/p/w300${e.still_path}` : null;
                    const air = e.air_date ? new Date(e.air_date).toLocaleDateString('es-ES',{day:'numeric',month:'short',year:'numeric'}) : '';
                    const rating = e.vote_average ? e.vote_average.toFixed(1) : '';
                    return `<div class="episode-card" data-id="${item.id}" data-season="${seasonNum}" data-ep="${e.episode_number}">
                        <div class="episode-still">
                            ${still ? `<img src="${still}" alt="" loading="lazy">` : '<div class="episode-no-still"><i class="fas fa-film"></i></div>'}
                            <div class="episode-num">E${e.episode_number}</div>
                            <div class="episode-play-overlay"><i class="fas fa-play"></i></div>
                        </div>
                        <div class="episode-info">
                            <div class="episode-title">${e.name || `Episodio ${e.episode_number}`}</div>
                            <div class="episode-meta">${air}${rating ? ` · ⭐ ${rating}` : ''}${e.runtime ? ` · ${e.runtime}min` : ''}</div>
                            <div class="episode-overview">${(e.overview||'').slice(0,120)}${e.overview?.length>120?'...':''}</div>
                        </div>
                    </div>`;
                }).join('')}
            </div>`;

            ep.querySelectorAll('.episode-card').forEach(card => {
                card.addEventListener('click', () => {
                    const id = card.dataset.id, s = card.dataset.season, epNum = card.dataset.ep;
                    const vc = document.getElementById('videoContainer');
                    if (isPremium) { seriesProgress[id]={s,ep:epNum,updatedAt:Date.now()}; localStorage.setItem('seriesProgress',JSON.stringify(seriesProgress)); }
                    
                    // Servidores para episodios
                    const SERVERS_EP = [
                        { label:'⭐ Premium', url: `https://vidlink.pro/tv/${id}/${s}/${epNum}?autoplay=true`, premium: true },
                        { label:'⭐ Premium', url: `https://vidsrc.me/embed/tv?tmdb=${id}&season=${s}&episode=${epNum}`, premium: true },
                        { label:'Free', url: `https://www.2embed.stream/embed/tv/${id}/${s}/${epNum}` },
                    ];
                    
                    // Filtrar servidores según el tipo de usuario
                    const filteredServers = isPremium ? SERVERS_EP : SERVERS_EP.filter(s => !s.premium);
                    vc.innerHTML = `
                    <div class="ep-server-bar">
                        ${filteredServers.map((sv,i)=>`<button class="ep-srv-btn ${i===0?'active':''}" data-url="${sv.url}">${sv.label}</button>`).join('')}
                    </div>
                    <iframe src="${filteredServers[0].url}" frameborder="0" allowfullscreen allow="autoplay; encrypted-media"></iframe>`;
                    vc.classList.add('visible');
                    vc.querySelectorAll('.ep-srv-btn').forEach(btn => {
                        btn.addEventListener('click', () => {
                            vc.querySelector('iframe').src = btn.dataset.url;
                            vc.querySelectorAll('.ep-srv-btn').forEach(b=>b.classList.toggle('active', b===btn));
                        });
                    });
                    vc.scrollIntoView({behavior:'smooth', block:'center'});

                    if (isPremium) {
                        const allCards = [...document.querySelectorAll('.episode-card')];
                        const idx = allCards.indexOf(card);
                        const nextCard = allCards[idx + 1];
                        if (nextCard) {
                            vc.insertAdjacentHTML('beforeend', `
                            <div class="sf-autoplay-bar" id="sfAutoplayBar">
                                <span>⭐ Próximo episodio: <strong>${nextCard.querySelector('.ep-title')?.textContent || 'Episodio ' + (parseInt(epNum)+1)}</strong></span>
                                <div class="sf-autoplay-actions">
                                    <button class="sf-autoplay-play" id="sfAutoplayPlay"><i class="fas fa-forward"></i> Reproducir</button>
                                    <button class="sf-autoplay-cancel" id="sfAutoplayCancel">Cancelar</button>
                                </div>
                            </div>`);
                            document.getElementById('sfAutoplayPlay')?.addEventListener('click', () => nextCard.click());
                            document.getElementById('sfAutoplayCancel')?.addEventListener('click', () => document.getElementById('sfAutoplayBar')?.remove());
                        }
                    }
                });
            });
        } catch(e) { document.getElementById('seasonEpisodesContainer').innerHTML = '<p style="color:#888;padding:1rem">Error cargando episodios.</p>'; }
    };

    await loadSeason(seasons[0].season_number);
    container.querySelectorAll('.season-tab').forEach(tab => {
        tab.addEventListener('click', () => {
            container.querySelectorAll('.season-tab').forEach(t=>t.classList.toggle('active', t===tab));
            loadSeason(parseInt(tab.dataset.season));
        });
    });
}

const LEVELS = [
    { min:0,   max:4,   label:'Espectador',  icon:'👤',  color:'#666' },
    { min:5,   max:14,  label:'Cinéfilo',    icon:'🎬',  color:'#888' },
    { min:15,  max:29,  label:'Crítico',     icon:'⭐',  color:'#c9a84c' },
    { min:30,  max:59,  label:'Experto',     icon:'🏆',  color:'#cc7700' },
    { min:60,  max:99,  label:'Maestro',     icon:'👑',  color:'#cc0000' },
    { min:100, max:Infinity, label:'Leyenda', icon:'🌟', color:'#ffd700' },
];
function getUserLevel() {
    const n = watchHistory.length;
    return LEVELS.find(l => n >= l.min && n <= l.max) || LEVELS[0];
}
function getUserXP() {
    const base = watchHistory.length * 10 + Object.keys(userRatings).length * 5 + favorites.length * 3 + Object.keys(achievements).length * 20;
    return isPremium ? base * 2 : base;
}
function getLevelProgress() {
    const n = watchHistory.length;
    const lvl = getUserLevel();
    if (lvl.max === Infinity) return 100;
    return Math.round(((n - lvl.min) / (lvl.max - lvl.min + 1)) * 100);
}

const WEEKLY_CHALLENGES_PREMIUM = [
    { id:'week_prem_doc',  label:'Semana Documental', desc:'Ve 3 documentales esta semana',    genre:99, target:3, icon:'📽️' },
    { id:'week_prem_anim', label:'Semana Animacion',  desc:'Ve 3 animaciones esta semana',     genre:16, target:3, icon:'🐭' },
    { id:'week_prem_10',   label:'Maraton Elite',     desc:'Ve 10 titulos esta semana',        genre:0,  target:10,icon:'🔥' },
    { id:'week_prem_hist', label:'Historia Viva',     desc:'Ve 2 peliculas historicas',        genre:36, target:2, icon:'🏛️' },
];
const WEEKLY_CHALLENGES = [
    { id:'week_horror',  label:'Terror semanal',   desc:'Ve 3 películas de Terror',        genre:27, target:3, icon:'👻' },
    { id:'week_action',  label:'Semana de acción',  desc:'Ve 3 películas de Acción',       genre:28, target:3, icon:'💥' },
    { id:'week_comedy',  label:'Ríe con nosotros',  desc:'Ve 2 comedias esta semana',      genre:35, target:2, icon:'😂' },
    { id:'week_drama',   label:'Drama profundo',    desc:'Ve 2 dramas esta semana',         genre:18, target:2, icon:'🎭' },
    { id:'week_scifi',   label:'Ciencia ficción',   desc:'Ve 2 películas de Sci-Fi',       genre:878,target:2, icon:'🚀' },
    { id:'week_any',     label:'Maratón semanal',   desc:'Ve 5 películas esta semana',      genre:0,  target:5, icon:'🏃' },
    { id:'week_old',     label:'Clásicos eternos',  desc:'Ve 2 películas anteriores a 1990',genre:0,  target:2, icon:'🎞️', pre1990:true },
];
function getCurrentWeekChallenge() {

    const now = new Date();
    const start = new Date(now.getFullYear(), 0, 1);
    const week = Math.floor((now - start) / 604800000);
    return WEEKLY_CHALLENGES[week % WEEKLY_CHALLENGES.length];
}
function getWeeklyProgress(challenge) {
    const weekStart = new Date(); weekStart.setHours(0,0,0,0);
    weekStart.setDate(weekStart.getDate() - weekStart.getDay());
    return watchHistory.filter(h => {
        if (!h._watchedAt || h._watchedAt < weekStart.getTime()) return false;
        if (challenge.pre1990) {
            const yr = parseInt((h.release_date||h.first_air_date||'9999').split('-')[0]);
            return yr < 1990;
        }
        if (challenge.genre === 0) return true;
        return (h.genre_ids||[]).includes(challenge.genre);
    }).length;
}

// Función para renderizar el ranking
function renderLeaderboardHTML(topUsers, own, user) {
    const rankRows = topUsers.length ? topUsers.map((u, idx) => {
        const isSelf = u.id === user.uid;
        const isPrem = !!u.isPremium;
        const icon = u.avatarIcon || getDefaultAvatarIcon(u.id || u.name || '');
        return `<div class="lb-row${isSelf ? ' lb-row-self' : ''}${isPrem ? ' lb-row-premium' : ''}">
            <div class="lb-rank">${idx+1}</div>
            <div class="lb-user">
                <div class="lb-avatar"><span class="lb-avatar-icon">${icon}</span></div>
                <div class="lb-user-info">
                    <div class="lb-name">${u.name||'Usuario'}${isPrem ? ' <i class="fas fa-star lb-premium-star" title="Premium"></i>' : ''}</div>
                    <div class="lb-sub">${u.xp||0} XP · ${u.watched||0} vistas</div>
                </div>
            </div>
            <div class="lb-xp">${u.xp||0}</div>
        </div>`;
    }).join('') : `<div class="lb-empty"><span>🏆</span><p>Aún no hay datos de clasificación. Abre la app para generar tu registro.</p></div>`;

    const ownIcon = own.avatarIcon || userAvatarIcon || getDefaultAvatarIcon(user.uid);
    return `
    <div class="lb-wrap">
        <div class="lb-title"><i class="fas fa-trophy"></i> Clasificación global <span class="lb-live-indicator"><span class="lb-live-dot"></span>En vivo</span></div>
        <div class="lb-subtitle">Tu posición en la comunidad StreamFlex</div>
        <div class="lb-own-card">
            <div class="lb-own-avatar"><span class="lb-avatar-icon">${ownIcon}</span></div>
            <div class="lb-own-info">
                <div class="lb-own-name" style="${isPremium ? 'color:var(--gold);font-weight:700' : ''}">${own.name || user.email.split('@')[0]} ${isPremium ? '<span class="sf-premium-badge">⭐ PREMIUM</span>' : ''}</div>
                <div class="lb-own-stats">${getUserXP()} XP · ${watchHistory.length} vistas · ${getUserLevel().icon} ${getUserLevel().label}</div>
            </div>
            <div class="lb-own-xp">${getUserXP()}<span>XP</span></div>
        </div>
        <div class="lb-info-note"><i class="fas fa-sync-alt"></i> El ranking se actualiza en tiempo real cuando otros usuarios ganan XP.</div>
        <div class="lb-share-btn-wrap">
            <button class="lb-share-btn" id="lbShareBtn"><i class="fas fa-share-alt"></i> Compartir mi perfil</button>
        </div>
        <div class="lb-list">
            ${rankRows}
        </div>
    </div>`;
}

async function loadLeaderboard() {
    if (!window._sb) return;
    const sb = window._sb;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    if (leaderboardUnsubscribe) {
        leaderboardUnsubscribe.unsubscribe();
        leaderboardUnsubscribe = null;
    }

    try {
        const avatarIcon = userAvatarIcon || getDefaultAvatarIcon(user.id);
        const { error } = await sb.from('leaderboard').upsert({
            id: user.id,
            name: user.user_metadata?.display_name || user.email.split('@')[0],
            is_premium: isPremium,
            avatar_icon: avatarIcon,
            watched: watchHistory.length,
            xp: getUserXP(),
            level: getUserLevel().label,
            updated_at: new Date().toISOString(),
        }, { onConflict: 'id' });
        if (error) console.error('Leaderboard save:', error);
    } catch(e) { console.error('Leaderboard save:', e); }

    const container = document.getElementById('pvp-leaderboard');
    if (!container) return;
    const inner = container.querySelector('.pvp-inner');
    inner.innerHTML = `<div class="loading-spinner" style="padding:3rem 0"><div class="spinner"></div><span>Cargando clasificación...</span></div>`;

    try {
        const { data: ownData } = await sb.from('leaderboard').select('*').eq('id', user.id).single();
        const own = ownData || {};

        const { data: topUsers, error: lbError } = await sb
            .from('leaderboard')
            .select('*')
            .order('xp', { ascending: false })
            .limit(10);

        if (lbError) throw lbError;

        if (topUsers) {
            inner.innerHTML = renderLeaderboardHTML(topUsers, own, user);
            document.getElementById('lbShareBtn')?.addEventListener('click', () => {
                const text = `🎬 Soy ${getUserLevel().icon} ${getUserLevel().label} en StreamFlex con ${getUserXP()} XP y ${watchHistory.length} películas vistas. ¡Supérame!`;
                navigator.clipboard.writeText(text).then(() => showToast('<i class="fas fa-share-alt"></i> Copiado para compartir'));
            });
        }

        leaderboardUnsubscribe = sb.channel('leaderboard')
            .on('postgres_changes', { event: '*', schema: 'public', table: 'leaderboard' }, () => {
                loadLeaderboard();
            })
            .subscribe();

    } catch(e) {
        console.error('Leaderboard load error:', e);
        inner.innerHTML = `<div class="pv-empty-tab"><span>🏆</span><p>No se pudo cargar la clasificación.</p><small>Verifica tu conexión a internet.</small></div>`;
    }
}

function openEditProfile() {
    const user = window._sb?.auth?.user();
    if (!user) return;
    document.body.style.overflow = 'hidden';
    modal.style.display = 'block';
    const currentName = user.displayName || '';
    const currentIcon = userAvatarIcon || getDefaultAvatarIcon(currentUid || user.uid || currentName || '');
    modalBody.innerHTML = `
    <div class="edit-profile-modal">
        <div class="modal-title-jp">EDITAR PERFIL</div>
        <h2>Editar perfil</h2>
        <div class="ep-avatar-wrap">
            <div class="ep-avatar" id="epAvatarPreview">
                ${currentIcon ? `<span class="ep-avatar-icon">${currentIcon}</span>` : `<span>${currentName.charAt(0)||'?'}</span>`}
            </div>
        </div>
        <div class="ep-icon-picker">
            <label>Elige tu icono</label>
            <div class="ep-icon-grid" id="epIconGrid">
                ${AVATAR_ICONS.map(ic => `<button class="ep-icon-btn ${ic===currentIcon?'active':''}" data-icon="${ic}" type="button">${ic}</button>`).join('')}
            </div>
        </div>
        <div class="ep-field">
            <label>Nombre de usuario</label>
            <input type="text" id="epNameInput" value="${currentName}" placeholder="Tu nombre..." maxlength="30">
        </div>
        <div class="ep-field">
            <label>Correo electrónico</label>
            <input type="email" value="${user.email}" disabled style="opacity:0.4;cursor:not-allowed">
        </div>
        <div class="ep-error" id="epError" style="display:none"></div>
        <div class="ep-actions">
            <button class="ep-save-btn" id="epSaveBtn"><i class="fas fa-save"></i> Guardar cambios</button>
        </div>
    </div>`;
    document.getElementById('epIconGrid')?.querySelectorAll('.ep-icon-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.ep-icon-btn').forEach(b => b.classList.toggle('active', b === btn));
            const icon = btn.dataset.icon;
            const preview = document.getElementById('epAvatarPreview');
            preview.innerHTML = `<span class="ep-avatar-icon">${icon}</span>`;
            preview.dataset.newIcon = icon;
        });
    });

    document.getElementById('epSaveBtn')?.addEventListener('click', async () => {
        const newName = document.getElementById('epNameInput').value.trim();
        const errEl = document.getElementById('epError');
        if (!newName) { errEl.textContent = 'El nombre no puede estar vacío'; errEl.style.display='block'; return; }
        const btn = document.getElementById('epSaveBtn');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Guardando...';
        try {
            const avatarEl = document.getElementById('epAvatarPreview');
            const newIcon = avatarEl?.dataset?.newIcon || currentIcon || '';
            await window._sb.auth.updateUser({ data: { display_name: newName } });

            if (window._sfSaveToCloud) {
                await window._sfSaveToCloud({ displayName: newName, avatarIcon: newIcon });
            }

            document.getElementById('userBarName').textContent = newName.split(' ')[0];
            const userBarAvatar = document.getElementById('userBarAvatar');
            if (userBarAvatar) userBarAvatar.textContent = newIcon || newName.charAt(0).toUpperCase();
            userAvatarIcon = newIcon;
            localStorage.setItem('sf_avatarIcon', userAvatarIcon);
            showToast('<i class="fas fa-check"></i> Perfil actualizado');
            closeModalFn();
            if (currentView === 'profile') loadProfileView();
        } catch(e) {
            errEl.textContent = 'Error al guardar. Inténtalo de nuevo.';
            errEl.style.display = 'block';
            btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> Guardar cambios';
        }
    });
}

function buildAdvancedStats() {

    const genreHours = {};
    watchHistory.forEach(h => {
        const hrs = (h.runtime || 110) / 60;
        (h.genre_ids||[]).forEach(gid => {
            const name = genresList.find(g=>g.id==gid)?.name || `G${gid}`;
            genreHours[name] = (genreHours[name]||0) + hrs;
        });
    });
    const topGenreHours = Object.entries(genreHours).sort((a,b)=>b[1]-a[1]).slice(0,5);

    const monthCounts = {};
    const MN = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
    watchHistory.forEach(h => {
        if (!h._watchedAt) return;
        const d = new Date(h._watchedAt);
        const k = `${MN[d.getMonth()]} ${d.getFullYear()}`;
        monthCounts[k] = (monthCounts[k]||0) + 1;
    });
    const topMonth = Object.entries(monthCounts).sort((a,b)=>b[1]-a[1])[0];
    const monthHistory = Object.entries(monthCounts).sort((a,b)=>a[0].localeCompare(b[0])).slice(-6);

    const ratings = Object.values(userRatings).filter(r => r > 0);
    const avgRating = ratings.length ? (ratings.reduce((a,b)=>a+b,0)/ratings.length).toFixed(1) : '?';

    const decCounts = {};
    watchHistory.forEach(h => {
        const y = parseInt((h.release_date||h.first_air_date||'0').split('-')[0]);
        if (y >= 1920) { const d = Math.floor(y/10)*10; decCounts[d] = (decCounts[d]||0)+1; }
    });
    const topDecade = Object.entries(decCounts).sort((a,b)=>b[1]-a[1])[0];

    const totalHrs = watchHistory.reduce((a,h) => a + (h.runtime||110)/60, 0);

    return { topGenreHours, topMonth, monthHistory, avgRating, topDecade, totalHrs };
}

(function initDonation() {
    document.addEventListener('DOMContentLoaded', () => {
        const fab      = document.getElementById('donateFab');
        if (fab && isPremium) { fab.style.display = 'none'; }
        const overlay  = document.getElementById('donateOverlay');
        const closeBtn = document.getElementById('donateClose');
        const amtBtns  = document.querySelectorAll('.donate-amount-btn');
        const custom   = document.getElementById('donateCustom');
        const paypalBtn = document.getElementById('donatePaypalBtn');
        const thanks   = document.getElementById('donateThanks');
        if (!fab) return;

        let selectedAmount = 3;

        function open() {
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
        }
        function close() {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        }

        fab.addEventListener('click', open);
        closeBtn.addEventListener('click', close);
        overlay.addEventListener('click', e => { if (e.target === overlay) close(); });

        amtBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                amtBtns.forEach(b => b.classList.remove('active'));
                btn.classList.add('active');
                selectedAmount = parseInt(btn.dataset.amount);
                custom.value = '';
                updatePaypalLink();
            });
        });

        custom.addEventListener('input', () => {
            const val = parseInt(custom.value);
            if (val > 0) {
                amtBtns.forEach(b => b.classList.remove('active'));
                selectedAmount = val;
                updatePaypalLink();
            }
        });

        function updatePaypalLink() {
            paypalBtn.href = `https://paypal.me/LorenzoButen/${selectedAmount}`;
            paypalBtn.textContent = '';

            paypalBtn.innerHTML = `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><path d="M7.144 19.532l1.049-5.751c.11-.605.691-1.047 1.304-1.047h5.76c2.295 0 4.1-1.254 4.485-3.484.131-.752.072-1.385-.13-1.9.717.358 1.23.97 1.399 1.82.379 1.97-.9 3.967-3.23 4.613l-.042.012H13.08c-.602 0-1.12.424-1.24 1.016l-.804 4.409-.107.586-.784 4.303H7.072l.072-.577zm-4.5-14.5c-.379-1.97.9-3.967 3.23-4.613l.042-.012h5.76c.602 0 1.12-.424 1.24-1.016l.804-4.409.107-.586.784-4.303h3.073l-.072.577-1.049 5.751c-.11.605-.691 1.047-1.304 1.047H9.499c-2.295 0-4.1 1.254-4.485 3.484-.131.752-.072 1.385.13 1.9-.717-.358-1.23-.97-1.399-1.82z"/></svg> Donar $${selectedAmount} con PayPal`;
        }

        paypalBtn.addEventListener('click', () => {
            setTimeout(() => {
                if (thanks) {
                    document.querySelector('.donate-header').style.display = 'none';
                    document.querySelector('.donate-amounts').style.display = 'none';
                    document.querySelector('.donate-custom-wrap').style.display = 'none';
                    paypalBtn.style.display = 'none';
                    document.querySelector('.donate-note').style.display = 'none';
                    thanks.style.display = 'block';
                    setTimeout(close, 3000);
                }
            }, 500);
        });
    });
})();

function loadContinuarViendo() {
    const inner = document.getElementById('pvContinuarInner');
    if (!inner) return;
    if (!isPremium) {
        inner.innerHTML = '<div class="sf-locked-feature"><div class="sf-locked-icon">▶️</div><div class="sf-locked-title">Continuar viendo</div><div class="sf-locked-sub">Recuerda en que episodio quedaste en cada serie con Premium</div><button class="sf-locked-btn sf-open-premium">⭐ Ver planes Premium</button></div>';
        inner.querySelector('.sf-open-premium')?.addEventListener('click', () => { openPremiumModal(); });
        return;
    }
    const entries = Object.entries(seriesProgress).sort((a,b) => b[1].updatedAt - a[1].updatedAt);
    if (!entries.length) {
        inner.innerHTML = '<div class="pv-empty-tab"><span>▶️</span><p>Aqui apareceran las series que estes viendo.</p><small>Reproduce un episodio para registrar tu progreso.</small></div>';
        return;
    }
    let html = '<div class="pv-block-label"><i class="fas fa-play-circle"></i> Series en progreso</div><div class="prow-list">';
    entries.forEach(([sid, prog]) => {
        const item = watchHistory.find(h => String(h.id) === String(sid) && h._type === 'tv') || watchLater.find(h => String(h.id) === String(sid));
        const title = item?.title || item?.name || 'Serie #' + sid;
        const poster = item?.poster_path ? IMG_BASE + item.poster_path : null;
        html += '<div class="prow-item sf-continue-item" data-id="' + sid + '" data-type="tv">' +
            (poster ? '<img src="' + poster + '" alt="" loading="lazy">' : '<div class="prow-noposter"></div>') +
            '<div class="prow-info"><div class="prow-title">' + title + '</div><div class="prow-meta">Temporada ' + prog.s + ' · Episodio ' + prog.ep + '</div></div>' +
            '<span class="sf-continue-badge">▶ Continuar</span></div>';
    });
    html += '</div>';
    inner.innerHTML = html;
    inner.querySelectorAll('.sf-continue-item').forEach(el => {
        el.addEventListener('click', () => openModal(parseInt(el.dataset.id), false, 'tv'));
    });
}

async function loadRecomendados() {
    const inner = document.getElementById('pvRecomInner');
    if (!inner) return;
    if (!isPremium) {
        inner.innerHTML = '<div class="sf-locked-feature"><div class="sf-locked-icon">🎯</div><div class="sf-locked-title">Recomendaciones Para Ti</div><div class="sf-locked-sub">Recomendaciones personalizadas basadas en tu historial con Premium</div><button class="sf-locked-btn sf-open-premium">⭐ Ver planes Premium</button></div>';
        inner.querySelector('.sf-open-premium')?.addEventListener('click', () => { openPremiumModal(); });
        return;
    }
    if (!watchHistory.length) {
        inner.innerHTML = '<div class="pv-empty-tab"><span>🎯</span><p>Ve mas peliculas para recibir recomendaciones personalizadas.</p></div>';
        return;
    }
    inner.innerHTML = '<div class="loading-spinner" style="padding:3rem 0"><div class="spinner"></div><span>Calculando tus gustos...</span></div>';
    try {

        const genreCount = {};
        watchHistory.forEach(item => (item.genre_ids||[]).forEach(g => { genreCount[g] = (genreCount[g]||0)+1; }));
        const topGenreId = Object.entries(genreCount).sort((a,b)=>b[1]-a[1])[0]?.[0];
        const watchedIds = new Set(watchHistory.map(h => h.id));

        const lastItem = watchHistory[0];
        const type = lastItem._type === 'tv' ? 'tv' : 'movie';
        const [simRes, genreRes] = await Promise.all([
            fetch(`https://api.themoviedb.org/3/${type}/${lastItem.id}/recommendations?api_key=${API_KEY}&language=es-ES&page=1`),
            topGenreId ? fetch(`https://api.themoviedb.org/3/discover/movie?api_key=${API_KEY}&language=es-ES&with_genres=${topGenreId}&sort_by=popularity.desc&page=1`) : Promise.resolve(null)
        ]);
        const simData = await simRes.json();
        const genreData = genreRes ? await genreRes.json() : { results: [] };

        const simItems = (simData.results||[]).filter(i => !watchedIds.has(i.id)).slice(0, 6);
        const genreItems = (genreData.results||[]).filter(i => !watchedIds.has(i.id) && !simItems.find(s=>s.id===i.id)).slice(0, 6);
        const genreName = genresList.find(g => String(g.id) === String(topGenreId))?.name || 'tu genero favorito';

        let html = '';
        if (simItems.length) {
            html += '<div class="pv-block-label"><i class="fas fa-fire"></i> Porque viste "' + (lastItem.title||lastItem.name||'') + '"</div><div class="pv-recents-scroll">';
            simItems.forEach(it => {
                const p = it.poster_path ? IMG_BASE + it.poster_path : null;
                html += '<div class="pv-rec-thumb" data-id="' + it.id + '" data-type="' + type + '" title="' + (it.title||it.name||'') + '">' +
                    (p ? '<img src="' + p + '" alt="" loading="lazy">' : '<div class="pv-rec-blank"></div>') +
                    '<div class="pv-rec-overlay"><i class="fas fa-play"></i></div></div>';
            });
            html += '</div>';
        }
        if (genreItems.length) {
            html += '<div class="pv-block-label" style="margin-top:1.5rem"><i class="fas fa-star"></i> Mas de ' + genreName + ' que te puede gustar</div><div class="pv-recents-scroll">';
            genreItems.forEach(it => {
                const p = it.poster_path ? IMG_BASE + it.poster_path : null;
                html += '<div class="pv-rec-thumb" data-id="' + it.id + '" data-type="movie" title="' + (it.title||it.name||'') + '">' +
                    (p ? '<img src="' + p + '" alt="" loading="lazy">' : '<div class="pv-rec-blank"></div>') +
                    '<div class="pv-rec-overlay"><i class="fas fa-play"></i></div></div>';
            });
            html += '</div>';
        }
        if (!html) html = '<div class="pv-empty-tab"><span>🎯</span><p>No encontramos recomendaciones por ahora.</p></div>';
        inner.innerHTML = html;
        inner.querySelectorAll('.pv-rec-thumb').forEach(el => {
            el.addEventListener('click', () => openModal(parseInt(el.dataset.id), false, el.dataset.type));
        });
    } catch(e) {
        inner.innerHTML = '<div class="pv-empty-tab"><span>🎯</span><p>Error cargando recomendaciones.</p></div>';
    }
}

function loadPerfilBg() {
    const inner = document.getElementById('pvPerfilBgInner');
    if (!inner) return;
    if (!isPremium) {
        inner.innerHTML = '<div class="sf-locked-feature"><div class="sf-locked-icon">⭐</div><div class="sf-locked-title">Perfil Personalizado</div><div class="sf-locked-sub">Agrega una bio y fondo personalizado a tu perfil</div><button class="sf-locked-btn sf-open-premium">⭐ Ver planes Premium</button></div>';
        inner.querySelector('.sf-open-premium')?.addEventListener('click', () => { openPremiumModal(); });
        return;
    }
    inner.innerHTML = '<div class="sf-perfil-bg-wrap">' +
        '<div class="pv-block-label"><i class="fas fa-image"></i> Fondo de perfil</div>' +
        '<div class="sf-bg-preview" id="sfBgPreview" style="background-image:url(' + (profileBg||'') + ')">' +
        (profileBg ? '' : '<span class="sf-bg-placeholder">Sin fondo — Sube una imagen</span>') + '</div>' +
        '<label class="sf-bg-upload-btn"><i class="fas fa-upload"></i> Subir imagen<input type="file" id="sfBgInput" accept="image/*" style="display:none"></label>' +
        (profileBg ? '<button class="sf-bg-remove-btn" id="sfBgRemove"><i class="fas fa-trash"></i> Quitar fondo</button>' : '') +
        '<div class="pv-block-label" style="margin-top:1.5rem"><i class="fas fa-pen"></i> Bio personal</div>' +
        '<textarea class="sf-bio-input" id="sfBioInput" placeholder="Cuéntale a la comunidad algo sobre ti... (max 150 caracteres)" maxlength="150">' + (userBio||'') + '</textarea>' +
        '<div class="sf-bio-actions"><span class="sf-bio-count" id="sfBioCount">' + (userBio?.length||0) + '/150</span><button class="sf-bio-save" id="sfBioSave"><i class="fas fa-save"></i> Guardar bio</button></div>' +
        '<div class="pv-block-label" style="margin-top:1.5rem"><i class="fas fa-share-alt"></i> Tarjeta de perfil</div>' +
        '<button class="sf-share-card-btn" id="sfShareCardBtn"><i class="fas fa-image"></i> Generar tarjeta para compartir</button>' +
        '<canvas id="sfShareCanvas" style="display:none"></canvas>' +
        '</div>';

    document.getElementById('sfBioInput')?.addEventListener('input', e => {
        document.getElementById('sfBioCount').textContent = e.target.value.length + '/150';
    });

    document.getElementById('sfBioSave')?.addEventListener('click', () => {
        userBio = document.getElementById('sfBioInput').value.trim();
        localStorage.setItem('sf_bio', userBio);
        showToast('<i class="fas fa-save"></i> Bio guardada');
    });

    document.getElementById('sfBgInput')?.addEventListener('change', e => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            profileBg = ev.target.result;
            localStorage.setItem('sf_profileBg', profileBg);
            document.getElementById('sfBgPreview').style.backgroundImage = 'url(' + profileBg + ')';
            showToast('<i class="fas fa-image"></i> Fondo actualizado');
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('sfBgRemove')?.addEventListener('click', () => {
        profileBg = '';
        localStorage.removeItem('sf_profileBg');
        loadPerfilBg();
        showToast('<i class="fas fa-trash"></i> Fondo eliminado');
    });

    document.getElementById('sfShareCardBtn')?.addEventListener('click', generateShareCard);
}

function generateShareCard() {
    const canvas = document.getElementById('sfShareCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    canvas.width = 800; canvas.height = 400;

    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, 800, 400);

    ctx.fillStyle = getComputedStyle(document.documentElement).getPropertyValue('--red') || '#cc0000';
    ctx.fillRect(0, 0, 8, 400);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 36px Arial';
    const { data: { user: fbUser } } = await window._sb?.auth?.getUser() || { data: { user: null } };
    const name = fbUser?.user_metadata?.display_name || fbUser?.email?.split('@')[0] || 'Cinefilo';
    ctx.fillText(name + (isPremium ? ' ⭐' : ''), 40, 80);

    ctx.fillStyle = '#888';
    ctx.font = '18px Arial';
    ctx.fillText(getUserLevel().label + '  |  ' + getUserXP() + ' XP  |  ' + watchHistory.length + ' peliculas', 40, 120);

    if (userBio) {
        ctx.fillStyle = '#aaa';
        ctx.font = '16px Arial';
        ctx.fillText(userBio.substring(0, 80), 40, 160);
    }

    ctx.fillStyle = '#333';
    ctx.font = 'bold 14px Arial';
    ctx.fillText('StreamFlex', 700, 380);

    canvas.style.display = 'none';
    const link = document.createElement('a');
    link.download = 'mi-perfil-streamflex.png';
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('<i class="fas fa-image"></i> Tarjeta descargada');
}

document.addEventListener('DOMContentLoaded', () => {

    document.addEventListener('click', async e => {
        if (!e.target.closest('#sfPipBtn')) return;
        const iframe = document.querySelector('#playerContainer iframe, #cinemaPlayer iframe, #videoContainer iframe');
        if (!iframe) { showToast('Primero reproduce un video'); return; }
        if (!isPremium) { showToast('⭐ Picture-in-Picture es exclusivo Premium'); return; }
        try {
            if (document.pictureInPictureElement) {
                await document.exitPictureInPicture();
            } else {
                showToast('PiP disponible solo en videos HTML5 nativos');
            }
        } catch(e) { showToast('PiP no disponible en este servidor'); }
    });

    if (isPremium && 'Notification' in window && Notification.permission === 'default') {
        setTimeout(() => {
            const genreCount = {};
            watchHistory.forEach(item => (item.genre_ids||[]).forEach(g => { genreCount[g] = (genreCount[g]||0)+1; }));
            const hasHistory = watchHistory.length > 3;
            if (hasHistory) {
                Notification.requestPermission().then(perm => {
                    if (perm === 'granted') {
                        showToast('<i class="fas fa-bell"></i> Notificaciones activadas para nuevos estrenos');
                    }
                });
            }
        }, 5000);
    }

    if (isPremium && Notification.permission === 'granted') {
        const lastNotif = parseInt(localStorage.getItem('sf_last_notif') || '0');
        const weekMs = 7 * 24 * 60 * 60 * 1000;
        if (Date.now() - lastNotif > weekMs) {
            localStorage.setItem('sf_last_notif', Date.now().toString());
            fetch('https://api.themoviedb.org/3/movie/now_playing?api_key=' + API_KEY + '&language=es-ES&page=1')
                .then(r => r.json())
                .then(data => {
                    const latest = data.results?.[0];
                    if (latest) {
                        new Notification('StreamFlex - Esta semana en cines', {
                            body: latest.title + ' - ' + (latest.vote_average?.toFixed(1)||'?') + '/10',
                            icon: latest.poster_path ? 'https://image.tmdb.org/t/p/w92' + latest.poster_path : '/icons/icon-192x192.png'
                        });
                    }
                }).catch(()=>{});
        }
    }

    document.addEventListener('click', e => {
        const tab = e.target.closest('.pvt[data-tab="perfil-bg"]');
        if (tab) setTimeout(loadPerfilBg, 50);
        const contTab = e.target.closest('.pvt[data-tab="continuar"]');
        if (contTab) setTimeout(loadContinuarViendo, 50);
        const recTab = e.target.closest('.pvt[data-tab="recomendados"]');
        if (recTab) setTimeout(loadRecomendados, 50);
        const friendTab = e.target.closest('.pvt[data-tab="amigos"]');
        if (friendTab) setTimeout(loadFriendsTab, 50);
    });

    document.addEventListener('click', e => {
        if (e.target.closest('#sfPremiumOpenBtn') || e.target.closest('#sfPremiumManageBtn') || e.target.closest('.sf-open-premium')) {
            openPremiumModal();
        }
    });
});

function openPremiumModal() {
    let overlay = document.getElementById('sfPremiumOverlay');
    if (!overlay) {
        overlay = document.createElement('div');
        overlay.id = 'sfPremiumOverlay';
        overlay.innerHTML = `
        <div class="sf-prem-modal">
          <button class="sf-prem-close" id="sfPremClose"><i class="fas fa-times"></i></button>
          <div class="sf-prem-header">
            <div class="sf-prem-star">⭐</div>
            <div class="sf-prem-title">StreamFlex Premium</div>
            <div class="sf-prem-sub">Apoya el proyecto y desbloquea funciones pro</div>
          </div>
          <div class="sf-prem-section-title">Incluye</div>
          <div class="sf-prem-perks">
            <div class="sf-prem-perk"><i class="fas fa-times-circle" style="color:var(--red)"></i> Sin popup de anuncios</div>
            <div class="sf-prem-perk"><i class="fas fa-palette" style="color:#9b4dff"></i> Temas de color exclusivos</div>
            <div class="sf-prem-perk"><i class="fas fa-user-astronaut" style="color:#f0d080"></i> Perfil+ con bio y fondo</div>
            <div class="sf-prem-perk"><i class="fas fa-play-circle" style="color:#00cc66"></i> Continuar viendo con progreso</div>
            <div class="sf-prem-perk"><i class="fas fa-magic" style="color:#1a8aff"></i> Recomendaciones inteligentes</div>
            <div class="sf-prem-perk"><i class="fas fa-chart-line" style="color:var(--gold)"></i> Estadísticas avanzadas y rachas</div>
            <div class="sf-prem-perk"><i class="fas fa-layer-group" style="color:#7b2dcc"></i> Listas ilimitadas + notas privadas</div>
            <div class="sf-prem-perk"><i class="fas fa-filter" style="color:#00c2ff"></i> Búsqueda avanzada con filtros pro</div>
            <div class="sf-prem-perk"><i class="fas fa-server" style="color:#ff6b6b"></i> <strong>Servidores Premium exclusivos</strong></div>
          </div>
          <div class="sf-prem-section-title">Próximamente</div>
          <div class="sf-prem-perks">
            <div class="sf-prem-perk sf-prem-perk-soon"><i class="fas fa-download" style="color:#4ade80"></i> Descargas offline <span class="sf-prem-soon">Próximamente</span></div>
            <div class="sf-prem-perk sf-prem-perk-soon"><i class="fas fa-users" style="color:#38bdf8"></i> Watch Party con chat <span class="sf-prem-soon">Próximamente</span></div>
            <div class="sf-prem-perk sf-prem-perk-soon"><i class="fas fa-bell" style="color:#fbbf24"></i> Alertas de estreno <span class="sf-prem-soon">Próximamente</span></div>
            <div class="sf-prem-perk sf-prem-perk-soon"><i class="fas fa-compress-arrows-alt" style="color:#f87171"></i> Cine Mode limpio <span class="sf-prem-soon">Próximamente</span></div>
            <div class="sf-prem-perk sf-prem-perk-soon"><i class="fas fa-user-shield" style="color:#a78bfa"></i> Perfiles extra + control parental <span class="sf-prem-soon">Próximamente</span></div>
          </div>
          <div class="sf-prem-actions">
            <a href="https://www.patreon.com/streamflex" target="_blank" class="sf-prem-btn sf-prem-patreon">
              <i class="fab fa-patreon"></i> Patreon — $5/mes
            </a>
            <a href="https://ko-fi.com/streamflex" target="_blank" class="sf-prem-btn sf-prem-kofi">
              <i class="fas fa-coffee"></i> Ko-fi — Donacion unica
            </a>
          </div>
          <div class="sf-prem-code-section">
            <div class="sf-prem-code-label">🔑 Ya tienes un codigo?</div>
            <div class="sf-prem-code-row">
              <input type="text" id="sfPremCodeInput" placeholder="Introduce tu codigo Premium" class="sf-prem-code-input">
              <button id="sfPremCodeBtn" class="sf-prem-code-btn">Activar</button>
            </div>
            <div id="sfPremCodeMsg" class="sf-prem-code-msg"></div>
          </div>
          ${isPremium ? '<div class="sf-prem-active-note">⭐ Ya eres miembro Premium — Gracias por apoyar StreamFlex!</div>' : ''}
        </div>`;
        document.body.appendChild(overlay);

        document.getElementById('sfPremClose').addEventListener('click', closePremiumModal);
        overlay.addEventListener('click', e => { if (e.target === overlay) closePremiumModal(); });

        document.getElementById('sfPremCodeBtn').addEventListener('click', async () => {
            const code = document.getElementById('sfPremCodeInput').value.trim().toUpperCase();
            const msg  = document.getElementById('sfPremCodeMsg');
            const btn  = document.getElementById('sfPremCodeBtn');
            if (!code) { msg.style.color='var(--red)'; msg.textContent='Introduce un codigo.'; return; }

            const { data: { user } } = await window._sb.auth.getUser();
            if (!user) { msg.style.color='var(--red)'; msg.textContent='Debes iniciar sesion primero.'; return; }

            btn.disabled = true;
            btn.textContent = 'Verificando...';
            msg.style.color = 'var(--text-muted)';
            msg.textContent = 'Consultando servidor...';

            try {
                const { data: codeData, error: codeError } = await window._sb
                    .from('codes')
                    .select('*')
                    .eq('code', code)
                    .single();

                if (codeError || !codeData) {
                    msg.style.color = 'var(--red)';
                    msg.textContent = 'Codigo invalido. Verifica que este bien escrito.';
                    btn.disabled = false; btn.textContent = 'Activar';
                    return;
                }

                if (codeData.used) {
                    msg.style.color = 'var(--red)';
                    msg.textContent = 'Este codigo ya fue usado. Cada codigo es de un solo uso.';
                    btn.disabled = false; btn.textContent = 'Activar';
                    return;
                }

                await window._sb.from('codes').update({
                    used: true,
                    used_by: user.id,
                    used_at: new Date().toISOString(),
                }).eq('code', code);

                const userRef = doc(db, 'users', user.uid);
                await updateDoc(userRef, { isPremium: true, premiumSince: new Date().toISOString() });

                isPremium = true;
                localStorage.setItem('sf_premium', '1');
                msg.style.color = '#00cc66';
                msg.textContent = 'Codigo valido! Premium activado. Bienvenido!';
                setTimeout(() => { closePremiumModal(); location.reload(); }, 1800);

            } catch(e) {
                console.error(e);
                msg.style.color = 'var(--red)';
                msg.textContent = 'Error al verificar. Intenta de nuevo.';
                btn.disabled = false; btn.textContent = 'Activar';
            }
        });
    }
    overlay.style.display = 'flex';
    document.body.style.overflow = 'hidden';
}

function closePremiumModal() {
    const overlay = document.getElementById('sfPremiumOverlay');
    if (overlay) overlay.style.display = 'none';
    document.body.style.overflow = '';
}

async function initReviews(itemId, mediaType) {
    const sb = window._sb;
    const { data: { user } } = await sb.auth.getUser();
    const list = document.getElementById('sfReviewsList');
    const countEl = document.getElementById('sfReviewsCount');
    if (!list) return;

    document.getElementById('sfReviewText')?.addEventListener('input', e => {
        document.getElementById('sfReviewChars').textContent = e.target.value.length + '/300';
    });

    document.getElementById('sfReviewSubmit')?.addEventListener('click', async () => {
        if (!user) { showToast('<i class="fas fa-user"></i> Debes iniciar sesión para reseñar'); return; }
        const text = document.getElementById('sfReviewText')?.value.trim();
        if (!text) { showToast('<i class="fas fa-exclamation"></i> Escribe algo primero'); return; }
        const rating = getUserRating(itemId);
        const btn = document.getElementById('sfReviewSubmit');
        btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        try {
            const reviewId = `${itemId}_${user.id}`;
            await sb.from('reviews').upsert({
                id: reviewId,
                item_id: String(itemId),
                media_type: mediaType,
                user_id: user.id,
                user_name: user.user_metadata?.display_name || user.email.split('@')[0],
                user_avatar_icon: userAvatarIcon || getDefaultAvatarIcon(user.id),
                text,
                rating,
                is_premium: isPremium,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
            }, { onConflict: 'id' });
            document.getElementById('sfReviewText').value = '';
            document.getElementById('sfReviewChars').textContent = '0/300';
            showToast('<i class="fas fa-comments"></i> Reseña publicada');
            await loadReviews(itemId, user?.id);
        } catch(e) {
            showToast('<i class="fas fa-exclamation-triangle"></i> Error al publicar');
            console.error(e);
        }
        btn.disabled = false; btn.innerHTML = '<i class="fas fa-paper-plane"></i> Publicar reseña';
    });

    await loadReviews(itemId, user?.id);
}

async function loadReviews(itemId, currentUid) {
    const sb = window._sb;
    const list = document.getElementById('sfReviewsList');
    const countEl = document.getElementById('sfReviewsCount');
    if (!list || !sb) return;

    list.innerHTML = '<div class="sf-reviews-loading"><i class="fas fa-spinner fa-spin"></i> Cargando...</div>';

    try {
        const { data: reviews, error } = await sb
            .from('reviews')
            .select('*')
            .eq('item_id', String(itemId))
            .order('created_at', { ascending: false });

        if (error) throw error;

        if (countEl) countEl.textContent = reviews?.length ? `${reviews.length} reseña${reviews.length > 1 ? 's' : ''}` : '';

        if (!reviews?.length) {
            list.innerHTML = '<div class="sf-reviews-empty"><i class="fas fa-comment-slash"></i> Sé el primero en reseñar esta película</div>';
            return;
        }

        list.innerHTML = reviews.map(r => {
            const stars = r.rating > 0 ? '<span class="sf-rev-stars">' + '⭐'.repeat(r.rating) + '<span style="opacity:0.3">' + '⭐'.repeat(5 - r.rating) + '</span></span>' : '';
            const isOwn = r.user_id === currentUid;
            const premBadge = r.is_premium ? '<span class="sf-rev-prem">⭐</span>' : '';
            const avatarIcon = r.user_avatar_icon || getDefaultAvatarIcon(r.user_id || r.user_name || '');
            const avatar = `<div class="sf-rev-avatar-letter">${avatarIcon}</div>`;
            const dateStr = r.created_at ? new Date(r.created_at).toLocaleDateString('es-ES', {day:'2-digit',month:'short',year:'numeric'}) : '';
            return `<div class="sf-review-card ${isOwn ? 'sf-review-own' : ''}">
                <div class="sf-rev-top">
                    <div class="sf-rev-avatar">${avatar}</div>
                    <div class="sf-rev-meta">
                        <span class="sf-rev-name">${r.user_name}${premBadge}</span>
                        <span class="sf-rev-date">${dateStr}</span>
                    </div>
                    ${stars}
                    ${isOwn ? `<button class="sf-rev-delete" data-id="${r.id}" title="Eliminar"><i class="fas fa-trash"></i></button>` : ''}
                </div>
                <p class="sf-rev-text">${r.text}</p>
            </div>`;
        }).join('');

        list.querySelectorAll('.sf-rev-delete').forEach(btn => {
            btn.addEventListener('click', async () => {
                if (!confirm('¿Eliminar tu reseña?')) return;
                try {
                    await sb.from('reviews').delete().eq('id', btn.dataset.id);
                    showToast('<i class="fas fa-trash"></i> Reseña eliminada');
                    await loadReviews(itemId, currentUid);
                } catch(e) { showToast('Error al eliminar'); }
            });
        });

    } catch(e) {
        console.error('Reviews error:', e);
        list.innerHTML = '<div class="sf-reviews-empty">Error cargando reseñas.</div>';
    }
}

async function loadFriendsTab() {
    const sb = window._sb;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;

    const searchBtn = document.getElementById('sfFriendSearchBtn');
    const searchInput = document.getElementById('sfFriendSearch');
    if (searchBtn && !searchBtn._wired) {
        searchBtn._wired = true;
        searchBtn.addEventListener('click', () => searchUsers(searchInput.value.trim()));
        searchInput.addEventListener('keydown', e => { if (e.key === 'Enter') searchUsers(searchInput.value.trim()); });
    }

    await renderFriendsList(user.id);
    await renderFriendsActivity(user.id);
    await renderFriendRequests(user.id);
}

async function searchUsers(query) {
    const sb = window._sb;
    const { data: { user } } = await sb.auth.getUser();
    const resultsEl = document.getElementById('sfFriendSearchResults');
    if (!resultsEl || !query) return;

    resultsEl.innerHTML = '<div class="sf-friends-loading"><i class="fas fa-spinner fa-spin"></i> Buscando...</div>';

    try {
        const { data: allProfiles } = await sb.from('profiles').select('*');
        const q = query.toLowerCase();
        const results = (allProfiles || [])
            .filter(u => u.id !== user?.id && (
                (u.display_name || '').toLowerCase().includes(q) ||
                (u.email || '').toLowerCase().includes(q)
            ))
            .slice(0, 8);

        const { data: myProfile } = await sb.from('profiles').select('friends').eq('id', user.id).single();
        const myFriends = myProfile?.friends || [];

        const { data: outgoingReqs } = await sb.from('friend_requests').select('to').eq('from', user.id);
        const outgoing = (outgoingReqs || []).map(d => d.to);

        if (!results.length) {
            resultsEl.innerHTML = '<div class="sf-friends-empty"><i class="fas fa-user-slash"></i> No se encontraron usuarios con ese nombre</div>';
            return;
        }

        resultsEl.innerHTML = '<div class="pv-block-label"><i class="fas fa-search"></i> Resultados</div>' +
            results.map(u => {
                const isFriend = myFriends.includes(u.id);
                const hasSentReq = outgoing.includes(u.id);
                const icon = u.avatar_icon || getDefaultAvatarIcon(u.id || u.display_name || '');
                let btnText, btnClass, btnIcon, btnAction;
                if (isFriend) {
                    btnText = 'Amigo'; btnClass = 'sf-friend-btn-remove'; btnIcon = 'user-minus'; btnAction = 'remove';
                } else if (hasSentReq) {
                    btnText = 'Enviada'; btnClass = 'sf-friend-btn-pending'; btnIcon = 'clock'; btnAction = 'none';
                } else {
                    btnText = 'Agregar'; btnClass = 'sf-friend-btn-add'; btnIcon = 'user-plus'; btnAction = 'add';
                }
                return `<div class="sf-friend-card" data-uid="${u.id}">
                    <div class="sf-friend-avatar"><span>${icon}</span></div>
                    <div class="sf-friend-info">
                        <div class="sf-friend-name">${u.display_name || 'Usuario'} ${u.is_premium ? '<span class="sf-rev-prem">⭐</span>' : ''}</div>
                        <div class="sf-friend-meta">${(u.watch_history||[]).length} vistas · ${getUserLevel_fromData(u).label}</div>
                    </div>
                    <button class="sf-friend-btn ${btnClass}" data-uid="${u.id}" data-action="${btnAction}" ${btnAction === 'none' ? 'disabled' : ''}>
                        <i class="fas fa-${btnIcon}"></i>
                        ${btnText}
                    </button>
                </div>`;
            }).join('');

        resultsEl.querySelectorAll('.sf-friend-btn').forEach(btn => {
            btn.addEventListener('click', () => toggleFriend(btn.dataset.uid, btn.dataset.action));
        });

    } catch(e) {
        console.error(e);
        resultsEl.innerHTML = '<div class="sf-friends-empty">Error en la búsqueda.</div>';
    }
}

async function toggleFriend(targetUid, action) {
    const sb = window._sb;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    try {
        if (action === 'add') {
            const { data: existingReq } = await sb.from('friend_requests').select('*').eq('id', `${user.id}_${targetUid}`).single();
            if (existingReq) {
                showToast('<i class="fas fa-clock"></i> Solicitud ya enviada');
                return;
            }
            await sb.from('friend_requests').insert({
                id: `${user.id}_${targetUid}`,
                from_uid: user.id,
                to_uid: targetUid,
                status: 'pending',
                from_name: user.user_metadata?.display_name || user.email.split('@')[0],
                from_avatar_icon: userAvatarIcon || getDefaultAvatarIcon(user.id),
                created_at: new Date().toISOString(),
            });
            showToast('<i class="fas fa-paper-plane"></i> Solicitud de amistad enviada');
        } else {
            const { data: myData } = await sb.from('profiles').select('friends').eq('id', user.id).single();
            const { data: targetData } = await sb.from('profiles').select('friends').eq('id', targetUid).single();
            let myFriends = myData?.friends || [];
            let targetFriends = targetData?.friends || [];
            myFriends = myFriends.filter(f => f !== targetUid);
            targetFriends = targetFriends.filter(f => f !== user.id);
            await Promise.all([
                sb.from('profiles').update({ friends: myFriends }).eq('id', user.id),
                sb.from('profiles').update({ friends: targetFriends }).eq('id', targetUid)
            ]);
            showToast('<i class="fas fa-user-minus"></i> Amigo eliminado');
        }

        const searchVal = document.getElementById('sfFriendSearch')?.value.trim();
        if (searchVal) await searchUsers(searchVal);
        await renderFriendsList(user.id);
        await renderFriendsActivity(user.id);

        const badge = document.getElementById('friendsBadge');
        if (badge) {
            const { data: myProfile } = await sb.from('profiles').select('friends').eq('id', user.id).single();
            badge.textContent = (myProfile?.friends || []).length || '';
        }
    } catch(e) {
        showToast('<i class="fas fa-exclamation-triangle"></i> Error al actualizar');
    }
}

async function renderFriendsList(uid) {
    const sb = window._sb;
    const el = document.getElementById('sfFriendsList');
    if (!el) return;
    try {
        const { data: myProfile } = await sb.from('profiles').select('friends').eq('id', uid).single();
        const friends = myProfile?.friends || [];

        const badge = document.getElementById('friendsBadge');
        if (badge) badge.textContent = friends.length || '';

        if (!friends.length) {
            el.innerHTML = '<div class="sf-friends-empty"><i class="fas fa-user-friends"></i> Aún no tienes amigos. ¡Búscalos arriba!</div>';
            return;
        }

        const { data: profiles } = await sb.from('profiles').select('*').in('id', friends);
        const valid = profiles || [];

        el.innerHTML = valid.map(u => {
            const icon = u.avatar_icon || getDefaultAvatarIcon(u.id || u.display_name || '');
            const watched = (u.watch_history || []).length;
            const lastItem = (u.watch_history || [])[0];
            const lastTitle = lastItem ? (lastItem.title || lastItem.name || '') : null;
            return `<div class="sf-friend-card">
                <div class="sf-friend-avatar"><span>${icon}</span></div>
                <div class="sf-friend-info">
                    <div class="sf-friend-name">${u.display_name || 'Usuario'} ${u.is_premium ? '<span class="sf-rev-prem">⭐</span>' : ''}</div>
                    <div class="sf-friend-meta">${watched} vistas · ${getUserLevel_fromData(u).label}
                        ${lastTitle ? `<span class="sf-friend-last"> · Vio: ${lastTitle.substring(0,28)}${lastTitle.length>28?'...':''}</span>` : ''}
                    </div>
                </div>
                <button class="sf-friend-btn sf-friend-btn-remove" data-uid="${u.id}" data-action="remove">
                    <i class="fas fa-user-minus"></i>
                </button>
            </div>`;
        }).join('');

        el.querySelectorAll('.sf-friend-btn').forEach(btn => {
            btn.addEventListener('click', () => toggleFriend(btn.dataset.uid, btn.dataset.action));
        });

    } catch(e) {
        el.innerHTML = '<div class="sf-friends-empty">Error cargando amigos.</div>';
    }
}

async function renderFriendsActivity(uid) {
    const sb = window._sb;
    const el = document.getElementById('sfFriendsActivity');
    if (!el) return;
    try {
        const { data: myProfile } = await sb.from('profiles').select('friends').eq('id', uid).single();
        const friends = myProfile?.friends || [];
        if (!friends.length) {
            el.innerHTML = '<div class="sf-friends-empty">Agrega amigos para ver su actividad</div>';
            return;
        }

        const { data: profiles } = await sb.from('profiles').select('*').in('id', friends);

        const events = [];
        (profiles || []).forEach(u => {
            (u.watch_history || []).slice(0, 5).forEach(item => {
                events.push({
                    uid: u.id,
                    name: u.display_name || 'Usuario',
                    avatarIcon: u.avatar_icon || getDefaultAvatarIcon(u.id || u.display_name || ''),
                    action: 'vio',
                    item,
                    ts: item._watchedAt || 0,
                });
            });
            (u.favorites || []).slice(0, 3).forEach(item => {
                events.push({
                    uid: u.id,
                    name: u.display_name || 'Usuario',
                    avatarIcon: u.avatar_icon || getDefaultAvatarIcon(u.id || u.display_name || ''),
                    action: 'marcó favorita',
                    item,
                    ts: item._addedAt || 0,
                });
            });
        });

        events.sort((a, b) => b.ts - a.ts);
        const recent = events.slice(0, 20);

        if (!recent.length) {
            el.innerHTML = '<div class="sf-friends-empty">Tus amigos no tienen actividad reciente</div>';
            return;
        }

        el.innerHTML = recent.map(ev => {
            const title   = ev.item?.title || ev.item?.name || 'Título desconocido';
            const poster  = ev.item?.poster_path ? IMG_BASE + ev.item.poster_path : null;
            const icon = ev.avatarIcon || getDefaultAvatarIcon(ev.uid || ev.name || '');
            const timeStr = ev.ts ? timeAgo(ev.ts) : '';
            return `<div class="sf-activity-row" data-id="${ev.item?.id}" data-type="${ev.item?._type||'movie'}">
                <div class="sf-act-avatar"><span>${icon}</span></div>
                <div class="sf-act-body">
                    <span class="sf-act-name">${ev.name}</span>
                    <span class="sf-act-verb"> ${ev.action} </span>
                    <span class="sf-act-title">${title}</span>
                    ${timeStr ? `<span class="sf-act-time"> · ${timeStr}</span>` : ''}
                </div>
                ${poster ? `<img src="${poster}" class="sf-act-poster" alt="">` : ''}
            </div>`;
        }).join('');

        el.querySelectorAll('.sf-activity-row').forEach(row => {
            row.addEventListener('click', () => openModal(parseInt(row.dataset.id), false, row.dataset.type));
        });

    } catch(e) {
        el.innerHTML = '<div class="sf-friends-empty">Error cargando actividad.</div>';
    }
}

async function renderFriendRequests(uid) {
    const sb = window._sb;
    const el = document.getElementById('sfFriendRequests');
    if (!el) return;
    try {
        const { data: requests } = await sb.from('friend_requests').select('*').eq('to_uid', uid).eq('status', 'pending');

        const badge = document.getElementById('requestsBadge');
        if (badge) badge.textContent = (requests || []).length || '';

        if (!requests?.length) {
            el.innerHTML = '<div class="sf-friends-empty">No tienes solicitudes pendientes</div>';
            return;
        }

        el.innerHTML = requests.map(req => {
            const icon = req.from_avatar_icon || getDefaultAvatarIcon(req.from_uid || req.from_name || '');
            return `<div class="sf-friend-card">
                <div class="sf-friend-avatar"><span>${icon}</span></div>
                <div class="sf-friend-info">
                    <div class="sf-friend-name">${req.from_name || 'Usuario'}</div>
                    <div class="sf-friend-meta">Te envió una solicitud</div>
                </div>
                <div class="sf-friend-actions">
                    <button class="sf-friend-btn sf-friend-btn-accept" data-req-id="${req.id}" data-from="${req.from_uid}">
                        <i class="fas fa-check"></i> Aceptar
                    </button>
                    <button class="sf-friend-btn sf-friend-btn-reject" data-req-id="${req.id}">
                        <i class="fas fa-times"></i> Rechazar
                    </button>
                </div>
            </div>`;
        }).join('');

        el.querySelectorAll('.sf-friend-btn-accept').forEach(btn => {
            btn.addEventListener('click', () => handleFriendRequest(btn.dataset.reqId, btn.dataset.from, 'accept'));
        });
        el.querySelectorAll('.sf-friend-btn-reject').forEach(btn => {
            btn.addEventListener('click', () => handleFriendRequest(btn.dataset.reqId, null, 'reject'));
        });

    } catch(e) {
        el.innerHTML = '<div class="sf-friends-empty">Error cargando solicitudes.</div>';
    }
}

async function handleFriendRequest(reqId, fromUid, action) {
    const sb = window._sb;
    const { data: { user } } = await sb.auth.getUser();
    if (!user) return;
    try {
        if (action === 'accept') {
            const { data: myProfile } = await sb.from('profiles').select('friends').eq('id', user.id).single();
            const { data: fromProfile } = await sb.from('profiles').select('friends').eq('id', fromUid).single();
            let myFriends = myProfile?.friends || [];
            let fromFriends = fromProfile?.friends || [];
            if (!myFriends.includes(fromUid)) myFriends.push(fromUid);
            if (!fromFriends.includes(user.id)) fromFriends.push(user.id);
            await Promise.all([
                sb.from('profiles').update({ friends: myFriends }).eq('id', user.id),
                sb.from('profiles').update({ friends: fromFriends }).eq('id', fromUid)
            ]);
            showToast('<i class="fas fa-user-plus"></i> Amigo añadido');
        } else {
            showToast('<i class="fas fa-times"></i> Solicitud rechazada');
        }
        await sb.from('friend_requests').delete().eq('id', reqId);
        await renderFriendRequests(user.id);
        await renderFriendsList(user.id);
        await renderFriendsActivity(user.id);
    } catch(e) {
        showToast('<i class="fas fa-exclamation-triangle"></i> Error procesando solicitud');
    }
}

function getUserLevel_fromData(data) {
    const n = (data.watchHistory||[]).length;
    const LEVELS = [
        { min:0,   label:'Espectador',  icon:'👤',  color:'#888' },
        { min:5,   label:'Aficionado',  icon:'🎬',  color:'#4ade80' },
        { min:15,  label:'Crítico',     icon:'⭐',  color:'#60a5fa' },
        { min:30,  label:'Cinéfilo',    icon:'🏆',  color:'#c084fc' },
        { min:60,  label:'Maestro',     icon:'👑',  color:'#f59e0b' },
        { min:100, label:'Experto',     icon:'🔥',  color:'#f97316' },
        { min:200, label:'Leyenda',     icon:'🌟',  color:'#cc0000' },
    ];
    for (let i = LEVELS.length - 1; i >= 0; i--) {
        if (n >= LEVELS[i].min) return LEVELS[i];
    }
    return LEVELS[0];
}

function timeAgo(ts) {
    const diff = Date.now() - ts;
    const m = Math.floor(diff / 60000);
    if (m < 1)   return 'ahora';
    if (m < 60)  return `hace ${m}m`;
    const h = Math.floor(m / 60);
    if (h < 24)  return `hace ${h}h`;
    const d = Math.floor(h / 24);
    if (d < 7)   return `hace ${d}d`;
    return new Date(ts).toLocaleDateString('es-ES', { day:'2-digit', month:'short' });
}
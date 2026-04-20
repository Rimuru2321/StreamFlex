import { 
  downloadShareCard, generateShareCard, currentUid, I18N, SERVERS_MOVIE, applyLang, moviesGrid, isWatchLater, renderListsManager, loadPopularTV, loadPorqueViste, loadDiaryView, profileBg, changeCinemaServer, loadDondeVer, exportTop10Image, heroBanner, saveCustomLists, timeAgo, currentData, leaderboardUnsubscribe, openMarathonManager, heroBg, displayItems, toggleWatchLater, setUserNote, toggleCheatsheet, enterCinemaMode, updateMarathonPanel, IMG_PROFILE, setUserRating, loadContinuarViendo, loadByGenre, achievements, exportData, currentPage, tmdbFetch, loadPersonMovies, openCompareModal, closePremiumModal, isPremium, userRatings, handleRuleta, initCardDelegation, getCurrentWeekChallenge, showSwipeIndicator, showLoading, isFavorite, searchHistory, isLoadingMore, modal, getUserRating, openListsManager, getUserNote, t, toggleSearchMode, listViewBtn, closeModalFn, cardDelegationInitialized, applyPremiumTheme, renderFriendsList, initReviews, setupEventListeners, currentGenre, openPremiumModal, openMoodPicker, getWeeklyProgress, advFilters, ACHIEVEMENTS_DEF, resetAndReload, generateSyncURL, navBtns, loadCollection, sortSelect, searchPerson, themeToggleBtn, favorites, setupCardSwipeGestures, REGION, renderStars, buildSimilarHTML, setViewMode, toggleFavorite, safeSet, _globalWatchTimer, SERVERS_TV, loadPerfilBg, renderLeaderboardHTML, showSearchHistory, tvGenresList, bindCardEvents, exitCinemaMode, toggleAdvancedPanel, getUserLevel_fromData, BASE_URL, currentDecade, applyTheme, watchLater, renderComparison, showToast, rebuildGenreButtons, loadTVSeasons, setHero, cloudSaveTimer, loadTrivia, selectGenre, removeLoadMoreSpinner, currentView, saveMarathon, sectionCount, toggleMarathonQueue, LEVELS, showLoadMoreSpinner, streakData, MOODS, _tmdbCache, userNotes, userAvatarIcon, currentSortBy, renderTop10, loadRecomendados, currentMediaType, checkAchievements, switchView, renderListView, renderFriendsActivity, decadeToYear, sortList, renderFriendRequests, gridViewBtn, isSearchMode, loadLeaderboard, handleSearch, openAddToListPicker, currentSearchQuery, userBio, watchHistory, genresList, hasActiveAdvFilters, filterBar, cloudSave, renderCard, WEEKLY_CHALLENGES, renderListToolbar, switchMediaType, findItemById, closeMarathon, startVoiceSearch, buildDiscoverURL, sectionTitle, getListForView, getUserLevel, isWatched, loadMoreContent, importFromSyncURL, renderPersonResults, searchUsers, closeModalBtn, cinemaMode, loadReviews, openModal, genresContainer, addToMarathon, modalBody, deferredInstall, renderListDetail, bindSimilarEvents, openShareModal, handleFriendRequest, LANGUAGE, loadUpcoming, searchBtn, customLists, startCountdowns, loadProfileView, loadRecommendations, handleKeyboardShortcuts, premiumTheme, marathonQueue, getTopGenresFromFavorites, setupTop10DragDrop, addToHistory, totalPages, openEditProfile, seriesProgress, setupInfiniteScroll, loadFriendsTab, openTop10Modal, showAchievementPopup, getLevelProgress, toggleFriend, listSortBy, searchInput, AVATAR_ICONS, loadPopularMovies, buildAdvancedStats, WEEKLY_CHALLENGES_PREMIUM, loadGenres, IMG_BASE, loadAchievementsView, appendItems, getDefaultAvatarIcon, importData, sfConfirm, cleanupExtras, IMG_ORIGINAL, updateStreak, API_KEY, searchMode, loadMoodRecommendation, top10List, drawGenreChart, getUserXP, toggleTheme, refreshCurrentView, isPersonSearch, 
  setWatchHistory, 
  setCurrentData, 
  setIsPersonSearch 
} from '../script.js';

export async function loadProfileView() {
    if (heroBanner) heroBanner.classList.remove('visible');
    if (filterBar) filterBar.style.display = 'none';
    if (sectionTitle) sectionTitle.textContent = '';
    if (sectionCount) sectionCount.textContent = '';
    cleanupExtras();
    checkAchievements();
    removeLoadMoreSpinner();

    if (!moviesGrid) {
        console.warn('moviesGrid no encontrado');
        return;
    }
    moviesGrid.innerHTML = '';
    moviesGrid.className = 'movies-grid profile-view-grid';

    const totalWatched = watchHistory?.length || 0;
    const totalFavs    = favorites?.length || 0;
    const totalWL      = watchLater?.length || 0;
    const totalMin     = totalWatched * 110;
    const totalH       = Math.floor(totalMin / 60);
    const totalD       = Math.floor(totalH / 24);
    const timeStr      = totalD > 0 ? `${totalD}d ${totalH%24}h` : totalH > 0 ? `${totalH}h` : `${totalMin}min`;
    const unlockedAch  = achievements ? Object.keys(achievements).length : 0;

    const genreCount = {};
    [...(watchHistory||[]), ...(favorites||[])].forEach(item =>
        (item.genre_ids||[]).forEach(g => { genreCount[g] = (genreCount[g]||0)+1; }));
    const topGenres = Object.entries(genreCount).sort((a,b)=>b[1]-a[1]).slice(0,6)
        .map(([id,c]) => ({ name: (genresList||[]).find(g=>g.id==id)?.name||`G${id}`, count:c }));

    const decCounts = {};
    (watchHistory||[]).forEach(it => {
        const y = parseInt((it.release_date||it.first_air_date||'0').split('-')[0]);
        if (y>=1970) { const d=Math.floor(y/10)*10; decCounts[d]=(decCounts[d]||0)+1; }
    });
    const topDec = Object.entries(decCounts).sort((a,b)=>b[1]-a[1])[0];

    const byMonth = {};
    (watchHistory||[]).forEach(it => {
        const d = new Date(it._watchedAt||0);
        const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}`;
        (byMonth[k]||(byMonth[k]=[])).push(it);
    });
    const months = Object.keys(byMonth).sort((a,b)=>b.localeCompare(a));
    const MN = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

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

    let fbName = 'Cinéfilo';
    let fbEmail = '';
    try {
        const { data: { user: fbUser } } = await window._sb?.auth?.getUser() || { data: { user: null } };
        fbName = fbUser?.user_metadata?.display_name || fbUser?.email?.split('@')[0] || 'Cinéfilo';
        fbEmail = fbUser?.email || '';
    } catch(e) {
        console.warn('Error al obtener usuario de Supabase:', e);
    }
    
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
    const streak = streakData?.streak || 0;
    const streakLongest = streakData?.longest || 0;

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
            <div class="pv-hero-streak">🔥 Racha <strong>${streak}</strong> día${streak!==1?'s':''} · Récord <strong>${streakLongest}</strong></div>
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
                <div class="pv-mini"><i class="fas fa-star-half-alt"></i><span>${Object.keys(userRatings).length} valoracionesadas</span></div>
                ${topDec?`<div class="pv-mini"><i class="fas fa-calendar-alt"></i><span>Década favorita: <strong>${topDec[0]}s</strong></span></div>`:''}
                <div class="pv-mini">🔥<span>Racha actual: <strong>${streak} días</strong></span></div>
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
          ${(watchHistory?.length || 0) ? `
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
            setWatchHistory(watchHistory.filter(h=>h.id!==parseInt(btn.dataset.id)));
            SFStorage.setItem('watchHistory', JSON.stringify(watchHistory));
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
        setWatchHistory([]); SFStorage.setItem('watchHistory', JSON.stringify(watchHistory));
        showToast('<i class="fas fa-trash"></i> Historial borrado'); loadProfileView();
    });

    drawGenreChart(topGenres);
}
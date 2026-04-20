import { 
  downloadShareCard, generateShareCard, currentUid, I18N, SERVERS_MOVIE, applyLang, moviesGrid, isWatchLater, renderListsManager, loadPopularTV, loadPorqueViste, loadDiaryView, profileBg, changeCinemaServer, loadDondeVer, exportTop10Image, heroBanner, saveCustomLists, timeAgo, currentData, leaderboardUnsubscribe, openMarathonManager, heroBg, displayItems, toggleWatchLater, setUserNote, toggleCheatsheet, enterCinemaMode, updateMarathonPanel, IMG_PROFILE, setUserRating, loadContinuarViendo, loadByGenre, achievements, exportData, currentPage, tmdbFetch, loadPersonMovies, openCompareModal, closePremiumModal, isPremium, userRatings, handleRuleta, initCardDelegation, getCurrentWeekChallenge, showSwipeIndicator, showLoading, isFavorite, searchHistory, isLoadingMore, modal, getUserRating, openListsManager, getUserNote, t, toggleSearchMode, listViewBtn, closeModalFn, cardDelegationInitialized, applyPremiumTheme, renderFriendsList, initReviews, setupEventListeners, currentGenre, openPremiumModal, openMoodPicker, getWeeklyProgress, advFilters, ACHIEVEMENTS_DEF, resetAndReload, generateSyncURL, navBtns, loadCollection, sortSelect, searchPerson, themeToggleBtn, favorites, setupCardSwipeGestures, REGION, renderStars, buildSimilarHTML, setViewMode, toggleFavorite, safeSet, _globalWatchTimer, SERVERS_TV, loadPerfilBg, renderLeaderboardHTML, showSearchHistory, tvGenresList, bindCardEvents, exitCinemaMode, toggleAdvancedPanel, getUserLevel_fromData, BASE_URL, currentDecade, applyTheme, watchLater, renderComparison, showToast, rebuildGenreButtons, loadTVSeasons, setHero, cloudSaveTimer, loadTrivia, selectGenre, removeLoadMoreSpinner, currentView, saveMarathon, sectionCount, toggleMarathonQueue, LEVELS, showLoadMoreSpinner, streakData, MOODS, _tmdbCache, userNotes, userAvatarIcon, currentSortBy, renderTop10, loadRecomendados, currentMediaType, checkAchievements, switchView, renderListView, renderFriendsActivity, decadeToYear, sortList, renderFriendRequests, gridViewBtn, isSearchMode, loadLeaderboard, handleSearch, openAddToListPicker, currentSearchQuery, userBio, watchHistory, genresList, hasActiveAdvFilters, filterBar, cloudSave, renderCard, WEEKLY_CHALLENGES, renderListToolbar, switchMediaType, findItemById, closeMarathon, startVoiceSearch, buildDiscoverURL, sectionTitle, getListForView, getUserLevel, isWatched, loadMoreContent, importFromSyncURL, renderPersonResults, searchUsers, closeModalBtn, cinemaMode, loadReviews, openModal, genresContainer, addToMarathon, modalBody, deferredInstall, renderListDetail, bindSimilarEvents, openShareModal, handleFriendRequest, LANGUAGE, loadUpcoming, searchBtn, customLists, startCountdowns, loadProfileView, loadRecommendations, handleKeyboardShortcuts, premiumTheme, marathonQueue, getTopGenresFromFavorites, setupTop10DragDrop, addToHistory, totalPages, openEditProfile, seriesProgress, setupInfiniteScroll, loadFriendsTab, openTop10Modal, showAchievementPopup, getLevelProgress, toggleFriend, listSortBy, searchInput, AVATAR_ICONS, loadPopularMovies, buildAdvancedStats, WEEKLY_CHALLENGES_PREMIUM, loadGenres, IMG_BASE, loadAchievementsView, appendItems, getDefaultAvatarIcon, importData, sfConfirm, cleanupExtras, IMG_ORIGINAL, updateStreak, API_KEY, searchMode, loadMoodRecommendation, top10List, drawGenreChart, getUserXP, toggleTheme, refreshCurrentView, isPersonSearch, 
  setWatchHistory, 
  setCurrentData, 
  setIsPersonSearch 
} from '../script.js';

export async function loadUpcoming() {
    showLoading();
    heroBanner.classList.remove('visible');
    sectionTitle.textContent = 'Próximos estrenos';
    filterBar.style.display = 'none';

    moviesGrid.className = 'movies-grid';
    moviesGrid.innerHTML = '';
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
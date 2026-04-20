import { 
  downloadShareCard, generateShareCard, currentUid, I18N, SERVERS_MOVIE, applyLang, moviesGrid, isWatchLater, renderListsManager, loadPopularTV, loadPorqueViste, loadDiaryView, profileBg, changeCinemaServer, loadDondeVer, exportTop10Image, heroBanner, saveCustomLists, timeAgo, currentData, leaderboardUnsubscribe, openMarathonManager, heroBg, displayItems, toggleWatchLater, setUserNote, toggleCheatsheet, enterCinemaMode, updateMarathonPanel, IMG_PROFILE, setUserRating, loadContinuarViendo, loadByGenre, achievements, exportData, currentPage, tmdbFetch, loadPersonMovies, openCompareModal, closePremiumModal, isPremium, userRatings, handleRuleta, initCardDelegation, getCurrentWeekChallenge, showSwipeIndicator, showLoading, isFavorite, searchHistory, isLoadingMore, modal, getUserRating, openListsManager, getUserNote, t, toggleSearchMode, listViewBtn, closeModalFn, cardDelegationInitialized, applyPremiumTheme, renderFriendsList, initReviews, setupEventListeners, currentGenre, openPremiumModal, openMoodPicker, getWeeklyProgress, advFilters, ACHIEVEMENTS_DEF, resetAndReload, generateSyncURL, navBtns, loadCollection, sortSelect, searchPerson, themeToggleBtn, favorites, setupCardSwipeGestures, REGION, renderStars, buildSimilarHTML, setViewMode, toggleFavorite, safeSet, _globalWatchTimer, SERVERS_TV, loadPerfilBg, renderLeaderboardHTML, showSearchHistory, tvGenresList, bindCardEvents, exitCinemaMode, toggleAdvancedPanel, getUserLevel_fromData, BASE_URL, currentDecade, applyTheme, watchLater, renderComparison, showToast, rebuildGenreButtons, loadTVSeasons, setHero, cloudSaveTimer, loadTrivia, selectGenre, removeLoadMoreSpinner, currentView, saveMarathon, sectionCount, toggleMarathonQueue, LEVELS, showLoadMoreSpinner, streakData, MOODS, _tmdbCache, userNotes, userAvatarIcon, currentSortBy, renderTop10, loadRecomendados, currentMediaType, checkAchievements, switchView, renderListView, renderFriendsActivity, decadeToYear, sortList, renderFriendRequests, gridViewBtn, isSearchMode, loadLeaderboard, handleSearch, openAddToListPicker, currentSearchQuery, userBio, watchHistory, genresList, hasActiveAdvFilters, filterBar, cloudSave, renderCard, WEEKLY_CHALLENGES, renderListToolbar, switchMediaType, findItemById, closeMarathon, startVoiceSearch, buildDiscoverURL, sectionTitle, getListForView, getUserLevel, isWatched, loadMoreContent, importFromSyncURL, renderPersonResults, searchUsers, closeModalBtn, cinemaMode, loadReviews, openModal, genresContainer, addToMarathon, modalBody, deferredInstall, renderListDetail, bindSimilarEvents, openShareModal, handleFriendRequest, LANGUAGE, loadUpcoming, searchBtn, customLists, startCountdowns, loadProfileView, loadRecommendations, handleKeyboardShortcuts, premiumTheme, marathonQueue, getTopGenresFromFavorites, setupTop10DragDrop, addToHistory, totalPages, openEditProfile, seriesProgress, setupInfiniteScroll, loadFriendsTab, openTop10Modal, showAchievementPopup, getLevelProgress, toggleFriend, listSortBy, searchInput, AVATAR_ICONS, loadPopularMovies, buildAdvancedStats, WEEKLY_CHALLENGES_PREMIUM, loadGenres, IMG_BASE, loadAchievementsView, appendItems, getDefaultAvatarIcon, importData, sfConfirm, cleanupExtras, IMG_ORIGINAL, updateStreak, API_KEY, searchMode, loadMoodRecommendation, top10List, drawGenreChart, getUserXP, toggleTheme, refreshCurrentView, isPersonSearch, 
  setWatchHistory, 
  setCurrentData, 
  setIsPersonSearch 
} from '../script.js';

export async function loadRecommendations() {
    const topGenres = getTopGenresFromFavorites();
    showLoading();
    heroBanner.classList.remove('visible');

    moviesGrid.className = 'movies-grid';
    moviesGrid.innerHTML = '';
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
        setCurrentData(filtered);
        displayItems(filtered, 'movie');
        sectionTitle.textContent = 'Recomendado para ti';
        const usedNames = topGenres.map(id=>genresList.find(g=>g.id==id)?.name).filter(Boolean).join(', ');
        const subtitle = document.createElement('p');
        subtitle.className = 'reco-subtitle';
        subtitle.textContent = `Basado en tus géneros favoritos: ${usedNames}`;
        document.querySelector('.section-header').after(subtitle);
    } catch(e) { console.error('Error recomendaciones:', e); }
}
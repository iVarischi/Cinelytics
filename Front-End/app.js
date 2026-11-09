document.addEventListener('DOMContentLoaded', () => {

    // ===== CONFIG =====
    // TMDB_API_TOKEN e API_BASE_URL vêm do config.js (carregado antes deste arquivo)
    const TMDB_BASE_URL = 'https://api.themoviedb.org/3';
    const API_URL = (typeof API_BASE_URL !== 'undefined' && API_BASE_URL) ? API_BASE_URL : 'http://localhost:8000';
    const STORAGE_KEY = 'cinelytics:v1';
    const TIERS = ['S', 'A', 'B', 'C', 'D'];
    const REC_PLACEHOLDER = 'As recomendações personalizadas aparecem aqui depois da análise.';

    // ===== ELEMENTOS =====
    const homePage = document.getElementById('home-page');
    const appPage = document.getElementById('app-page');
    const navBack = document.getElementById('nav-back');
    const navLogo = document.getElementById('nav-logo');
    const startButtons = document.querySelectorAll('.btn-start');
    const searchInput = document.getElementById('search-input');
    const searchResults = document.getElementById('search-results');
    const recList = document.getElementById('rec-list');
    const btnShare = document.getElementById('btn-share');
    const btnAnalyze = document.getElementById('btn-analyze');
    const analysisEmpty = document.getElementById('analysis-empty');
    const analysisResult = document.getElementById('analysis-result');
    const analysisArchetype = document.getElementById('analysis-archetype');
    const analysisSummary = document.getElementById('analysis-summary');
    const analysisAxes = document.getElementById('analysis-axes');
    const analysisStaleNote = document.getElementById('analysis-stale');

    // ===== ESTADO =====
    let userMovies = loadMovies();  // [{ id, title, year, genres, tier }]
    let analysis = null;            // resposta do back-end: { archetype, summary, axes, recommendations }
    let analysisStale = false;      // true quando a Tier List mudou depois da análise
    let analyzing = false;
    let listVersion = 0;            // sobe a cada mudança na Tier List
    let searchRequestId = 0;        // ignora respostas de buscas antigas
    let debounceTimer;
    let toastTimer;

    function loadMovies() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
            if (!Array.isArray(saved)) return [];
            return saved
                .filter(m => m && m.id && m.title && TIERS.includes(m.tier))
                .map(m => ({
                    id: m.id,
                    title: m.title,
                    year: m.year || '',
                    genres: Array.isArray(m.genres) ? m.genres : [],
                    tier: m.tier
                }));
        } catch {
            return [];
        }
    }

    function saveMovies() {
        try { localStorage.setItem(STORAGE_KEY, JSON.stringify(userMovies)); } catch { /* storage indisponível */ }
    }

    // ===== NAVEGAÇÃO (home <-> app) =====
    function setView(view) {
        const isApp = view === 'app';
        homePage.classList.toggle('hidden', isApp);
        appPage.classList.toggle('hidden', !isApp);
        navBack.classList.toggle('hidden', !isApp);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
    startButtons.forEach(btn => btn.addEventListener('click', () => setView('app')));
    navLogo.addEventListener('click', () => setView('home'));
    navBack.addEventListener('click', () => setView('home'));

    // ===== TMDB (busca de filmes) =====
    async function fetchFromTMDB(endpoint, params = '') {
        if (typeof TMDB_API_TOKEN === 'undefined' || !TMDB_API_TOKEN) {
            console.error('Token do TMDB ausente. Verifique se o config.js existe e é carregado antes do app.js.');
            return null;
        }
        try {
            const res = await fetch(`${TMDB_BASE_URL}${endpoint}?${params}`, {
                headers: { accept: 'application/json', Authorization: `Bearer ${TMDB_API_TOKEN}` }
            });
            if (!res.ok) throw new Error(`TMDB respondeu ${res.status}`);
            return await res.json();
        } catch (err) {
            console.error(err);
            return null;
        }
    }

    searchInput.addEventListener('input', (e) => {
        clearTimeout(debounceTimer);
        const query = e.target.value.trim();
        const requestId = ++searchRequestId; // invalida buscas anteriores

        if (query.length < 2) {
            searchResults.classList.add('hidden');
            return;
        }

        debounceTimer = setTimeout(async () => {
            showSearchMessage('Buscando...');
            const data = await fetchFromTMDB('/search/movie', `query=${encodeURIComponent(query)}&language=pt-BR`);
            if (requestId !== searchRequestId) return; // chegou atrasada, descarta
            if (!data) return showSearchMessage('Não foi possível buscar agora. Tente de novo.');
            renderSearchResults(data.results || []);
        }, 400);
    });

    searchInput.addEventListener('focus', () => {
        if (searchResults.children.length > 0 && searchInput.value.trim().length >= 2) {
            searchResults.classList.remove('hidden');
        }
    });

    function showSearchMessage(text) {
        searchResults.innerHTML = '';
        const div = document.createElement('div');
        div.className = 'search-item search-message';
        div.textContent = text;
        searchResults.appendChild(div);
        searchResults.classList.remove('hidden');
    }

    function renderSearchResults(movies) {
        if (movies.length === 0) return showSearchMessage('Nenhum filme encontrado.');
        searchResults.innerHTML = '';
        movies.slice(0, 6).forEach(movie => {
            const year = movie.release_date ? ` (${movie.release_date.slice(0, 4)})` : '';
            const div = document.createElement('div');
            div.className = 'search-item';
            div.textContent = `${movie.title}${year}`;
            div.addEventListener('click', () => addMovie(movie));
            searchResults.appendChild(div);
        });
        searchResults.classList.remove('hidden');
    }

    // O resultado da busca já traz título, ano e gêneros: não precisa de segunda requisição
    function addMovie(movie) {
        searchInput.value = '';
        searchResults.classList.add('hidden');
        searchRequestId++; // cancela buscas pendentes

        if (userMovies.some(m => m.id === movie.id)) {
            return showToast('Esse filme já está na sua lista.');
        }

        userMovies.push({
            id: movie.id,
            title: movie.title,
            year: movie.release_date ? movie.release_date.slice(0, 4) : '',
            genres: movie.genre_ids || [],
            tier: 'S'
        });
        onTierListChanged();
    }

    // ===== TIER LIST =====
    const nextTier = (tier) => TIERS[(TIERS.indexOf(tier) + 1) % TIERS.length];

    function onTierListChanged() {
        listVersion++;
        saveMovies();
        renderTierList();

        if (userMovies.length === 0) {
            analysis = null;
            analysisStale = false;
            showRecMessage(REC_PLACEHOLDER);
        } else if (analysis) {
            analysisStale = true;
        }
        updateAnalysisUI();
    }

    function renderTierList() {
        TIERS.forEach(tier => {
            const container = document.getElementById(`tier-${tier}`);
            container.innerHTML = '';
            userMovies
                .filter(m => m.tier === tier)
                .forEach(movie => container.appendChild(createMovieTag(movie)));
        });
    }

    function createMovieTag(movie) {
        const tag = document.createElement('div');
        tag.className = 'movie-tag';
        const yearText = movie.year ? ` (${movie.year})` : '';

        const titleBtn = document.createElement('button');
        titleBtn.type = 'button';
        titleBtn.className = 'movie-tag-title';
        titleBtn.textContent = movie.title;
        titleBtn.title = `${movie.title}${yearText} — Tier ${movie.tier}. Clique para mover para ${nextTier(movie.tier)}`;
        titleBtn.addEventListener('click', () => {
            movie.tier = nextTier(movie.tier); // S -> A -> B -> C -> D -> S (nunca apaga)
            onTierListChanged();
        });

        const removeBtn = document.createElement('button');
        removeBtn.type = 'button';
        removeBtn.className = 'movie-tag-remove';
        removeBtn.textContent = '×';
        removeBtn.title = 'Remover da lista';
        removeBtn.setAttribute('aria-label', `Remover ${movie.title}`);
        removeBtn.addEventListener('click', () => {
            userMovies = userMovies.filter(m => m.id !== movie.id);
            onTierListChanged();
        });

        tag.append(titleBtn, removeBtn);
        return tag;
    }

    // ===== ANÁLISE (back-end Python) =====
    function updateAnalysisUI() {
        analysisEmpty.classList.toggle('hidden', Boolean(analysis));
        analysisResult.classList.toggle('hidden', !analysis);
        analysisStaleNote.classList.toggle('hidden', !(analysis && analysisStale));
        btnAnalyze.disabled = analyzing || userMovies.length === 0;
        btnAnalyze.textContent = analyzing ? 'Analisando...' : 'Analisar meu gosto';
    }

    async function analyze() {
        if (analyzing || userMovies.length === 0) return;
        analyzing = true;
        updateAnalysisUI();
        const versionAtStart = listVersion;

        try {
            const res = await fetch(`${API_URL}/api/analyze`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    movies: userMovies.map(({ id, title, year, genres, tier }) => ({ id, title, year, genres, tier }))
                })
            });
            if (!res.ok) {
                let detail = '';
                try {
                    const body = await res.json();
                    if (typeof body.detail === 'string') detail = body.detail;
                } catch { /* resposta sem corpo JSON */ }
                throw new Error(detail || `Back-end respondeu ${res.status}`);
            }

            const data = await res.json();
            if (!data || typeof data !== 'object') throw new Error('Resposta inválida do back-end.');
            if (userMovies.length === 0) return; // a lista foi esvaziada enquanto analisava

            analysis = data;
            analysisStale = versionAtStart !== listVersion; // mudou durante a espera?
            analyzing = false;
            updateAnalysisUI();   // mostra o painel antes de desenhar (as barras animam)
            renderAnalysis();
        } catch (err) {
            console.error(err);
            const offline = err instanceof TypeError; // fetch falhou: servidor desligado
            showToast(offline ? 'Não foi possível falar com o back-end. Ele está rodando?' : (err.message || 'Não foi possível analisar agora.'), 4500);
        } finally {
            analyzing = false;
            updateAnalysisUI();
        }
    }

    // Os eixos vêm da IA: quantidade e nomes variam a cada análise
    function renderAnalysis() {
        analysisArchetype.textContent = analysis.archetype || '';
        analysisSummary.textContent = analysis.summary || '';

        analysisAxes.innerHTML = '';
        const axes = Array.isArray(analysis.axes) ? analysis.axes : [];
        axes.forEach(axis => {
            const pct = Math.min(100, Math.max(0, Math.round(Number(axis.value) || 0)));

            const row = document.createElement('div');
            row.className = 'stat-bar';

            const name = document.createElement('span');
            name.textContent = axis.name || '';

            const bar = document.createElement('div');
            bar.className = 'bar';
            const fill = document.createElement('div');
            fill.className = 'fill';
            fill.style.width = '0%';
            bar.appendChild(fill);

            const percentage = document.createElement('span');
            percentage.className = 'percentage';
            percentage.textContent = `${pct}%`;

            row.append(name, bar, percentage);
            analysisAxes.appendChild(row);

            void fill.offsetWidth; // força o navegador a registrar o 0% antes de animar
            fill.style.width = `${pct}%`;
        });

        renderRecommendations(Array.isArray(analysis.recommendations) ? analysis.recommendations : []);
    }

    // ===== RECOMENDAÇÕES (vêm da análise) =====
    function showRecMessage(text) {
        recList.innerHTML = '';
        const p = document.createElement('p');
        p.className = 'empty-msg';
        p.textContent = text;
        recList.appendChild(p);
    }

    function renderRecommendations(items) {
        if (items.length === 0) return showRecMessage('Nenhuma recomendação retornada.');
        recList.innerHTML = '';

        items.forEach(rec => {
            const item = document.createElement('div');
            item.className = 'rec-item';

            const info = document.createElement('div');
            const title = document.createElement('div');
            title.className = 'rec-title';
            title.textContent = rec.title || '';
            const meta = document.createElement('div');
            meta.className = 'rec-meta';
            meta.textContent = rec.reason || '';
            info.append(title, meta);
            item.appendChild(info);

            if (rec.year) {
                const badge = document.createElement('div');
                badge.className = 'rec-badge';
                badge.textContent = rec.year;
                item.appendChild(badge);
            }

            recList.appendChild(item);
        });
    }

    btnAnalyze.addEventListener('click', analyze);

    // ===== COMPARTILHAR =====
    function buildShareText() {
        const lines = ['Minha Tier List no CineLytics 🎬'];
        TIERS.forEach(tier => {
            const titles = userMovies
                .filter(m => m.tier === tier)
                .map(m => (m.year ? `${m.title} (${m.year})` : m.title));
            if (titles.length) lines.push(`${tier}: ${titles.join(', ')}`);
        });
        return lines.join('\n');
    }

    function copyText(text) {
        if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
        return new Promise((resolve, reject) => { // fallback (ex.: abrindo via file://)
            const ta = document.createElement('textarea');
            ta.value = text;
            ta.style.cssText = 'position:fixed;opacity:0';
            document.body.appendChild(ta);
            ta.select();
            const ok = document.execCommand('copy');
            ta.remove();
            ok ? resolve() : reject(new Error('copy falhou'));
        });
    }

    function showToast(message, duration = 2200) {
        let toast = document.getElementById('toast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'toast';
            toast.className = 'toast';
            toast.setAttribute('role', 'status');
            document.body.appendChild(toast);
        }
        toast.textContent = message;
        toast.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(() => toast.classList.remove('show'), duration);
    }

    btnShare.addEventListener('click', async () => {
        if (userMovies.length === 0) return showToast('Adicione filmes antes de compartilhar.');
        try {
            await copyText(buildShareText());
            showToast('Tier List copiada!');
        } catch {
            showToast('Não foi possível copiar.');
        }
    });

    // Fechar dropdown ao clicar fora da busca
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.search-box')) searchResults.classList.add('hidden');
    });

    // ===== INICIALIZAÇÃO =====
    renderTierList();
    updateAnalysisUI();
});
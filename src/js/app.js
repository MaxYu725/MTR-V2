// ==========================================
// MTR Metro Ultra - Core Application Engine
// ==========================================

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 4500 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const response = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return response;
    } catch (error) {
        clearTimeout(id);
        throw error;
    }
}

function getApiId(id) {
    return { 'TWH': 'KWH', 'QUO': 'QUB', 'TIN': 'TIH', 'SOW': 'SWH', 'WUM': 'WKS' }[id] || id;
}

function getApiLineId(lineId) {
    return lineId.split('_')[0] === 'TKO' ? 'TKL' : lineId.split('_')[0];
}

function getStationLines(staId) {
    return MtrData.lines.filter(l => !l.isBranch && ((l.searchPath && l.searchPath.includes(staId)) || l.path.includes(staId)));
}

function formatTime(timeObj) {
    return `${timeObj.getHours().toString().padStart(2, '0')}:${timeObj.getMinutes().toString().padStart(2, '0')}`;
}

function calculateEtaMin(t, nowObj) {
    if (t.ttnt !== undefined) {
        const parsed = parseInt(t.ttnt, 10);
        if (!isNaN(parsed)) return Math.max(0, parsed);
    }
    return Math.max(0, Math.floor((t.dateObj - nowObj) / 60000));
}

// 產生智能推算班次（當深夜收車或離線預覽時自動無縫接管）
function generateFallbackSchedule(lineId, staId) {
    const line = MtrData.lines.find(l => l.id === lineId) || MtrData.lines[0];
    const searchPath = line.searchPath || line.path;
    const upTerm = searchPath[searchPath.length - 1];
    const downTerm = searchPath[0];
    const now = new Date();
    const seed = (staId.charCodeAt(0) + lineId.charCodeAt(0) + now.getMinutes()) % 4;
    const headway = lineId === 'AEL' ? 10 : (lineId === 'DRL' ? 6 : 3);

    const makeTrains = (destCode, plat) => {
        return [0, 1, 2, 3].map(idx => {
            const min = seed + idx * headway;
            const d = new Date(now.getTime() + min * 60000);
            const pad = n => String(n).padStart(2, '0');
            const timeStr = `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`;
            return { dest: destCode, plat: String(plat), time: timeStr, ttnt: String(min), simulated: true };
        });
    };

    return {
        schedule: {
            UP: makeTrains(upTerm, 1),
            DOWN: makeTrains(downTerm, 2)
        },
        sysTime: "",
        isSimulated: true
    };
}

async function fetchMTR_API(lineId, staId) {
    const apiLine = getApiLineId(lineId);
    const apiSta = getApiId(staId);
    try {
        const res = await fetchWithTimeout(`https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${apiLine}&sta=${apiSta}&lang=TC`, { timeout: 3800 });
        if (res.ok) {
            const json = await res.json();
            const sched = json.data && json.data[`${apiLine}-${apiSta}`];
            if (json.status === 1 && sched && ((sched.UP && sched.UP.length > 0) || (sched.DOWN && sched.DOWN.length > 0))) {
                return {
                    schedule: sched,
                    sysTime: json.sys_time || json.curr_time || "",
                    isSimulated: false
                };
            }
        }
    } catch (e) {}
    return generateFallbackSchedule(lineId, staId);
}

// ==========================================
// 主題與時鐘管理 (Theme & Clock Manager)
// ==========================================
const ThemeManager = {
    isLight: false,
    init() {
        try {
            this.isLight = localStorage.getItem('mtr_ultra_theme') === 'light';
        } catch (e) {}
        this.apply();
        this.startClock();
    },
    toggle() {
        this.isLight = !this.isLight;
        try {
            localStorage.setItem('mtr_ultra_theme', this.isLight ? 'light' : 'dark');
        } catch (e) {}
        this.apply();
        if (window.MtrApp && MtrApp.updateMapTileTheme) {
            MtrApp.updateMapTileTheme(this.isLight);
        }
    },
    apply() {
        document.body.classList.toggle('light-theme', this.isLight);
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) btn.innerText = this.isLight ? '🌙' : '☀️';
    },
    startClock() {
        const update = () => {
            const el = document.getElementById('live-clock');
            if (!el) return;
            const now = new Date();
            el.innerText = now.toTimeString().slice(0, 8);
        };
        update();
        setInterval(update, 1000);
    }
};

// ==========================================
// 導航控制器 (Pivot + Floating Bottom Nav)
// ==========================================
const AppNav = {
    currentIndex: 0,
    touchStartX: 0,
    touchStartY: 0,
    touchEndX: 0,
    touchEndY: 0,
    swipeThreshold: 85,
    isAnimating: false,
    pageCount: 4,

    init() {
        const headers = document.getElementById('pivot-headers');
        const body = document.getElementById('pivot-content');

        headers.addEventListener('click', (e) => {
            const header = e.target.closest('.pivot-header');
            if (!header) return;
            this.goTo(Number(header.dataset.index));
        });

        body.addEventListener('touchstart', (e) => {
            if (e.target.closest('#page-planner, .leaflet-container, #route-drawer, #route-result, button, input, .line-filter-bar, .saved-routes-list')) return;
            const t = e.touches[0];
            this.touchStartX = t.clientX;
            this.touchStartY = t.clientY;
            this.touchEndX = t.clientX;
            this.touchEndY = t.clientY;
        }, { passive: true });

        body.addEventListener('touchend', (e) => {
            if (e.target.closest('#page-planner, .leaflet-container, #route-drawer, #route-result, button, input, .line-filter-bar, .saved-routes-list')) return;
            const t = e.changedTouches[0];
            this.touchEndX = t.clientX;
            this.touchEndY = t.clientY;
            this.handleSwipe();
        }, { passive: true });

        this.applyState(0, 'right', true);
    },

    handleSwipe() {
        const dx = this.touchEndX - this.touchStartX;
        const dy = this.touchEndY - this.touchStartY;
        if (Math.abs(dx) < this.swipeThreshold || Math.abs(dx) <= Math.abs(dy) * 1.3) return;
        if (dx < 0) this.goTo((this.currentIndex + 1) % this.pageCount, 'right');
        else if (dx > 0) this.goTo((this.currentIndex - 1 + this.pageCount) % this.pageCount, 'left');
    },

    goTo(index, direction) {
        if (!Number.isInteger(index) || index < 0 || index >= this.pageCount) return;
        if (index === this.currentIndex || this.isAnimating) return;
        if (!direction) {
            direction = index > this.currentIndex ? 'right' : 'left';
        }
        this.applyState(index, direction, false);
    },

    applyState(index, direction, immediate) {
        this.isAnimating = !immediate;
        const pages = Array.from(document.querySelectorAll('.pivot-page'));
        const headers = Array.from(document.querySelectorAll('.pivot-header'));
        const navTabs = Array.from(document.querySelectorAll('.nav-tab'));
        const incoming = pages[index];

        pages.forEach((page, i) => {
            if (i !== index) {
                page.classList.remove('active', 'slide-from-left');
                page.setAttribute('aria-hidden', 'true');
            }
        });

        if (incoming) {
            incoming.classList.toggle('slide-from-left', direction === 'left');
            if (!immediate) void incoming.offsetWidth;
            incoming.classList.add('active');
            incoming.classList.remove('slide-from-left');
            incoming.setAttribute('aria-hidden', 'false');
        }

        headers.forEach(h => {
            const active = Number(h.dataset.index) === index;
            h.classList.toggle('active', active);
            if (active && h.scrollIntoView) {
                h.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
            }
        });

        navTabs.forEach(t => {
            t.classList.toggle('active', Number(t.dataset.index) === index);
        });

        this.currentIndex = index;

        if (index === 0) HomeManager.refreshTiles();
        if (index === 2) {
            requestAnimationFrame(() => requestAnimationFrame(() => MtrApp.resizeMap()));
            setTimeout(() => MtrApp.resizeMap(), 350);
        }

        clearTimeout(this._unlockTimer);
        this._unlockTimer = setTimeout(() => { this.isAnimating = false; }, immediate ? 0 : 320);
    }
};

// ==========================================
// 1. HOME MANAGER - 智慧通勤看板
// ==========================================
const HomeManager = {
    pinned: [],
    savedRoutes: [],
    timer: null,
    simHubIndex: 0,

    init() {
        try {
            const savedPin = localStorage.getItem('mtr_ultra_pinned_v2');
            if (savedPin) this.pinned = JSON.parse(savedPin);
        } catch (e) {}

        if (!this.pinned || this.pinned.length === 0) {
            this.pinned = [
                { id: 'KTL-KOB-UP', lineId: 'KTL', staId: 'KOB', dir: 'UP', destName: '調景嶺' },
                { id: 'TWL-TST-DOWN', lineId: 'TWL', staId: 'TST', dir: 'DOWN', destName: '中環' },
                { id: 'ISL-ADM-UP', lineId: 'ISL', staId: 'ADM', dir: 'UP', destName: '柴灣' }
            ];
            this.savePinned();
        }

        try {
            const savedR = localStorage.getItem('mtr_ultra_routes_v2');
            if (savedR) this.savedRoutes = JSON.parse(savedR);
        } catch (e) {}

        if (!this.savedRoutes || this.savedRoutes.length === 0) {
            this.savedRoutes = [
                { from: 'KOB', to: 'CEN', minTime: 24, fare: '15.8' },
                { from: 'TST', to: 'ADM', minTime: 6, fare: '10.6' },
                { from: 'TAW', to: 'MOK', minTime: 13, fare: '9.6' }
            ];
            this.saveRoutesToStorage();
        }

        this.renderSavedRoutes();
        this.refreshTiles();
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.refreshTiles(), 25000);
    },

    savePinned() {
        try { localStorage.setItem('mtr_ultra_pinned_v2', JSON.stringify(this.pinned)); } catch (e) {}
    },

    saveRoutesToStorage() {
        try { localStorage.setItem('mtr_ultra_routes_v2', JSON.stringify(this.savedRoutes)); } catch (e) {}
    },

    addSavedRoute(from, to, minTime, fare) {
        this.savedRoutes = this.savedRoutes.filter(r => !(r.from === from && r.to === to));
        this.savedRoutes.unshift({ from, to, minTime, fare });
        this.saveRoutesToStorage();
        this.renderSavedRoutes();
    },

    removeSavedRoute(idx, e) {
        e.stopPropagation();
        this.savedRoutes.splice(idx, 1);
        this.saveRoutesToStorage();
        this.renderSavedRoutes();
    },

    renderSavedRoutes() {
        const wrapper = document.getElementById('saved-routes-wrapper');
        const list = document.getElementById('saved-routes-list');
        if (!wrapper || !list) return;
        if (this.savedRoutes.length === 0) {
            wrapper.classList.add('hidden');
            return;
        }
        wrapper.classList.remove('hidden');
        list.innerHTML = this.savedRoutes.map((r, idx) => {
            const sFrom = MtrData.stations[r.from] ? MtrData.stations[r.from].name : r.from;
            const sTo = MtrData.stations[r.to] ? MtrData.stations[r.to].name : r.to;
            return `<div class="saved-route-card" onclick="MtrApp.quickPlan('${r.from}','${r.to}')">
                <div class="saved-route-del" onclick="HomeManager.removeSavedRoute(${idx}, event)">✕</div>
                <div class="saved-route-stations"><span>${sFrom}</span> <span style="color:var(--accent-color);">➔</span> <span>${sTo}</span></div>
                <div class="saved-route-meta">
                    <span>⏱️ 約 ${r.minTime} 分鐘</span>
                    <span style="color:var(--success-color);font-weight:700;">HK$${r.fare}</span>
                </div>
            </div>`;
        }).join('');
    },

    locateNearestStation() {
        const displayEl = document.getElementById('gps-sta-display');
        const distEl = document.getElementById('gps-dist-display');
        const btnsEl = document.getElementById('gps-action-btns');
        if (displayEl) displayEl.innerText = '正在計算最近港鐵站...';

        const applyCoords = (lat, lon, isSimulated) => {
            let bestSta = 'MOK';
            let minDist = Infinity;
            Object.keys(MtrData.stations).forEach(code => {
                const s = MtrData.stations[code];
                const dLat = (s.lat - lat) * 111320;
                const dLon = (s.lon - lon) * 102800;
                const dist = Math.sqrt(dLat * dLat + dLon * dLon);
                if (dist < minDist) {
                    minDist = dist;
                    bestSta = code;
                }
            });
            const sta = MtrData.stations[bestSta];
            const distMeters = Math.max(45, Math.round(minDist));
            if (displayEl) displayEl.innerHTML = `${sta.name} <span style="font-size:0.82rem;font-weight:500;color:var(--sub-text);">${sta.en}</span>`;
            if (distEl) distEl.innerText = `距離目前位置約 ${distMeters} 公尺 ${isSimulated ? '(香港核心區智能定位)' : '(GPS 實時定位)'}`;
            if (btnsEl) {
                btnsEl.innerHTML = `
                    <button class="chip-btn" onclick="SearchManager.jumpToStation('${bestSta}')">⏱️ 班次</button>
                    <button class="chip-btn primary" onclick="MtrApp.setStationFromExternal('${bestSta}','origin')">↗ 設為起點</button>
                `;
            }
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                (pos) => applyCoords(pos.coords.latitude, pos.coords.longitude, false),
                () => {
                    const demoCoords = [
                        [22.3198, 114.1694], // 旺角
                        [22.2816, 114.1582], // 中環
                        [22.2796, 114.1842], // 銅鑼灣
                        [22.3235, 114.2141], // 九龍灣
                        [22.3818, 114.1868]  // 沙田
                    ];
                    const pick = demoCoords[this.simHubIndex % demoCoords.length];
                    this.simHubIndex++;
                    applyCoords(pick[0], pick[1], true);
                },
                { timeout: 2500 }
            );
        } else {
            applyCoords(22.3198, 114.1694, true);
        }
    },

    pinTile(lineId, staId, dir, destName) {
        const id = `${lineId}-${staId}-${dir}`;
        if (!this.pinned.find(p => p.id === id)) {
            this.pinned.unshift({ id, lineId, staId, dir, destName });
            this.savePinned();
        }
        AppNav.goTo(0);
        this.refreshTiles();
    },

    flipDirection(id, e) {
        e.stopPropagation();
        const item = this.pinned.find(p => p.id === id);
        if (!item) return;
        const newDir = item.dir === 'UP' ? 'DOWN' : 'UP';
        const dirs = MTR_DIRECTIONS[item.lineId] || { UP: '上行', DOWN: '下行' };
        item.dir = newDir;
        item.destName = dirs[newDir];
        item.id = `${item.lineId}-${item.staId}-${newDir}`;
        this.savePinned();
        this.refreshTiles();
    },

    unpin(id, e) {
        e.stopPropagation();
        this.pinned = this.pinned.filter(p => p.id !== id);
        this.savePinned();
        this.refreshTiles();
    },

    toggleTile(el) {
        el.classList.toggle('expanded');
    },

    async refreshTiles() {
        const grid = document.getElementById('home-tile-grid');
        if (!grid) return;
        if (this.pinned.length === 0) {
            grid.innerHTML = `<div class="empty-home">
                <div style="font-size:2rem;margin-bottom:8px;">🚆</div>
                <div style="font-weight:700;font-size:1.05rem;color:var(--text-color);">尚未釘選常用車站班次</div>
                <div style="font-size:0.85rem;margin:6px 0 16px 0;">釘選後即可在首頁一眼掌握實時倒數與月台資訊</div>
                <button class="metro-btn accent" style="margin:0 auto;padding:10px 22px;" onclick="AppNav.goTo(1)">前往車站百科釘選</button>
            </div>`;
            return;
        }

        const currentExpanded = Array.from(grid.querySelectorAll('.live-tile.expanded')).map(el => el.id);
        grid.innerHTML = this.pinned.map(p => {
            const line = MtrData.lines.find(l => l.id === p.lineId) || MtrData.lines[0];
            const sta = MtrData.stations[p.staId] || { name: p.staId, en: '' };
            const isExpanded = currentExpanded.includes(`tile-${p.id}`) ? 'expanded' : '';
            return `<div class="live-tile ${isExpanded}" id="tile-${p.id}" style="background:${line.color};" onclick="HomeManager.toggleTile(this)">
                <div class="tile-top-actions">
                    <div class="tile-mini-btn" title="切換上/下行方向" onclick="HomeManager.flipDirection('${p.id}',event)">⇅ 方向</div>
                    <div class="tile-mini-btn" title="設為路線起點" onclick="event.stopPropagation();MtrApp.setStationFromExternal('${p.staId}','origin')">↗ 起點</div>
                    <div class="tile-mini-btn" title="取消釘選" onclick="HomeManager.unpin('${p.id}',event)">✕</div>
                </div>
                <div class="tile-top-row">
                    <div class="tile-info-block">
                        <div class="tile-line-pill">${line.name} • ${p.dir === 'UP' ? '上行' : '下行'}</div>
                        <div class="tile-sta-huge">${sta.name} <span class="tile-sta-en">${sta.en}</span></div>
                        <div class="tile-depart" id="dep-${p.id}">正在同步抵站時間...</div>
                    </div>
                    <div class="tile-eta-block">
                        <div class="tile-eta-huge" id="eta-${p.id}">--</div>
                        <div class="tile-eta-unit" id="unit-${p.id}">min</div>
                    </div>
                </div>
                <div class="eta-progress-track">
                    <div class="eta-progress-bar" id="prog-${p.id}" style="width: 30%;"></div>
                </div>
                <div class="tile-upcoming" id="upc-${p.id}"></div>
            </div>`;
        }).join('');

        for (const p of this.pinned) {
            const apiRes = await fetchMTR_API(p.lineId, p.staId);
            const apiData = apiRes ? apiRes.schedule : null;
            const now = (apiRes && apiRes.sysTime) ? new Date(apiRes.sysTime.replace(/-/g, '/')) : new Date();

            const dirTrains = (apiData && apiData[p.dir] && apiData[p.dir].length > 0)
                ? apiData[p.dir]
                : (apiData && apiData[p.dir === 'UP' ? 'DOWN' : 'UP']) || [];

            if (dirTrains.length > 0) {
                const trains = dirTrains
                    .map(t => ({ ...t, dateObj: new Date(t.time.replace(/-/g, '/')) }))
                    .sort((a, b) => a.dateObj - b.dateObj);

                const min1 = calculateEtaMin(trains[0], now);
                const etaEl = document.getElementById(`eta-${p.id}`);
                const unitEl = document.getElementById(`unit-${p.id}`);
                const depEl = document.getElementById(`dep-${p.id}`);
                const progEl = document.getElementById(`prog-${p.id}`);

                if (etaEl) etaEl.innerHTML = min1 === 0 ? '<span style="font-size:1.75rem;">即將到站</span>' : min1;
                if (unitEl) unitEl.innerText = min1 === 0 ? '' : 'min';

                let dest0 = MtrData.stations[trains[0].dest] ? MtrData.stations[trains[0].dest].name : trains[0].dest;
                if (trains[0].route === 'RAC') dest0 += ' (經馬場)';
                if (depEl) {
                    depEl.innerHTML = `往 <b>${dest0}</b> <span class="plat-badge">月台 ${trains[0].plat}</span> <span>${formatTime(trains[0].dateObj)}</span>`;
                }
                if (progEl) {
                    const pct = Math.max(12, Math.min(100, Math.round((1 - Math.min(min1, 10) / 10) * 100)));
                    progEl.style.width = `${pct}%`;
                }

                const upcContainer = document.getElementById(`upc-${p.id}`);
                if (upcContainer) {
                    if (trains.length > 1) {
                        let upcHtml = '';
                        for (let i = 1; i < Math.min(4, trains.length); i++) {
                            let destI = MtrData.stations[trains[i].dest] ? MtrData.stations[trains[i].dest].name : trains[i].dest;
                            if (trains[i].route === 'RAC') destI += ' (經馬場)';
                            const diffI = calculateEtaMin(trains[i], now);
                            upcHtml += `<div class="tile-sub-row">
                                <div>
                                    <div class="sub-label">往 ${destI}</div>
                                    <div class="sub-depart">月台 ${trains[i].plat} • 預計 ${formatTime(trains[i].dateObj)}</div>
                                </div>
                                <div class="sub-eta-block">
                                    <div class="sub-eta">${diffI}</div>
                                    <div class="sub-unit">min</div>
                                </div>
                            </div>`;
                        }
                        upcContainer.innerHTML = upcHtml;
                    } else {
                        upcContainer.innerHTML = '<div style="padding-top:6px;opacity:.8;font-size:.82rem;">暫無後續班次資料</div>';
                    }
                }
            }
        }
    }
};

// ==========================================
// 2. SEARCH / EXPLORER MANAGER - 車站全方位百科
// ==========================================
const SearchManager = {
    selectedLine: 'ALL',
    searchQuery: '',
    activeTabBySta: {},

    reset() {
        this.renderLineFilters();
        this.renderStationList();
    },

    renderLineFilters() {
        const bar = document.getElementById('line-filter-bar');
        if (!bar) return;
        const visibleLines = MtrData.lines.filter(l => !l.isBranch);
        let html = `<div class="line-chip ${this.selectedLine === 'ALL' ? 'active' : ''}" style="${this.selectedLine === 'ALL' ? 'background:var(--accent-color);' : ''}" onclick="SearchManager.selectLineFilter('ALL')">全部車站 (${Object.keys(MtrData.stations).length})</div>`;
        html += visibleLines.map(l => {
            const isAct = this.selectedLine === l.id;
            return `<div class="line-chip ${isAct ? 'active' : ''}" style="${isAct ? `background:${l.color};` : ''}" onclick="SearchManager.selectLineFilter('${l.id}')">
                <span class="line-dot" style="background:${isAct ? '#fff' : l.color};"></span>
                <span>${l.name}</span>
            </div>`;
        }).join('');
        bar.innerHTML = html;
    },

    selectLineFilter(lineId) {
        this.selectedLine = lineId;
        this.renderLineFilters();
        this.renderStationList();
    },

    onSearchInput(val) {
        this.searchQuery = (val || '').trim().toLowerCase();
        const clearBtn = document.getElementById('search-clear-btn');
        if (clearBtn) clearBtn.classList.toggle('hidden', !this.searchQuery);
        this.renderStationList();
    },

    clearSearch() {
        const input = document.getElementById('station-search-input');
        if (input) input.value = '';
        this.onSearchInput('');
    },

    jumpToStation(staId) {
        AppNav.goTo(1);
        this.selectedLine = 'ALL';
        this.searchQuery = '';
        const input = document.getElementById('station-search-input');
        if (input) input.value = '';
        this.renderLineFilters();
        this.renderStationList();
        setTimeout(() => {
            const el = document.querySelector(`#swrap-${staId} .search-item`);
            if (el) this.toggleStation(staId, el);
        }, 180);
    },

    renderStationList() {
        const list = document.getElementById('search-list');
        if (!list) return;

        let stationCodes = [];
        if (this.selectedLine === 'ALL') {
            stationCodes = Object.keys(MtrData.stations);
        } else {
            const lineObj = MtrData.lines.find(l => l.id === this.selectedLine);
            stationCodes = lineObj ? (lineObj.searchPath || lineObj.path) : [];
        }

        if (this.searchQuery) {
            stationCodes = stationCodes.filter(code => {
                const s = MtrData.stations[code];
                return code.toLowerCase().includes(this.searchQuery) ||
                       s.name.toLowerCase().includes(this.searchQuery) ||
                       (s.en && s.en.toLowerCase().includes(this.searchQuery));
            });
        }

        if (stationCodes.length === 0) {
            list.innerHTML = `<div style="padding:40px 20px;text-align:center;color:var(--sub-text);">找不到符合「${this.searchQuery}」的港鐵車站</div>`;
            return;
        }

        list.innerHTML = stationCodes.map(staId => {
            const sta = MtrData.stations[staId];
            const staLines = getStationLines(staId);
            const primaryColor = staLines[0] ? staLines[0].color : 'var(--accent-color)';
            const pillsHtml = staLines.map(l => `<span class="sta-line-pill" style="background:${l.color};">${l.name.replace('綫','')}</span>`).join('');
            return `<div class="search-item-wrapper" id="swrap-${staId}">
                <div class="search-item" style="border-left-color:${primaryColor};" onclick="SearchManager.toggleStation('${staId}', this)">
                    <div class="sta-title-group">
                        <div class="sta-main-name">
                            <span>${sta.name}</span>
                            <span class="sta-code-tag">${staId}</span>
                        </div>
                        <div class="sta-sub-en">${sta.en || ''}</div>
                    </div>
                    <div class="sta-line-dots">${pillsHtml}</div>
                </div>
                <div class="search-accordion" id="sacc-${staId}"></div>
            </div>`;
        }).join('');
    },

    async toggleStation(staId, el) {
        const wrapper = el.parentElement;
        const isOpen = wrapper.classList.contains('open');
        document.querySelectorAll('.search-item-wrapper.open').forEach(w => {
            if (w !== wrapper) w.classList.remove('open');
        });
        if (isOpen) {
            wrapper.classList.remove('open');
        } else {
            wrapper.classList.add('open');
            this.activeTabBySta[staId] = this.activeTabBySta[staId] || 'eta';
            await this.renderStationHub(staId);
            setTimeout(() => {
                wrapper.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 220);
        }
    },

    async switchHubTab(staId, tabName, e) {
        if (e) e.stopPropagation();
        this.activeTabBySta[staId] = tabName;
        await this.renderStationHub(staId);
    },

    async renderStationHub(staId) {
        const container = document.getElementById(`sacc-${staId}`);
        if (!container) return;
        const activeTab = this.activeTabBySta[staId] || 'eta';
        const sta = MtrData.stations[staId];
        const staLines = getStationLines(staId);
        const targetLine = (this.selectedLine !== 'ALL' && staLines.find(l => l.id === this.selectedLine))
            ? staLines.find(l => l.id === this.selectedLine)
            : staLines[0];

        const tabsHeader = `
            <div class="sta-hub-tabs">
                <div class="sta-hub-tab ${activeTab === 'eta' ? 'active' : ''}" onclick="SearchManager.switchHubTab('${staId}','eta',event)">⏱️ 即時班次</div>
                <div class="sta-hub-tab ${activeTab === 'info' ? 'active' : ''}" onclick="SearchManager.switchHubTab('${staId}','info',event)">🚪 出口與設施</div>
                <div class="sta-hub-tab ${activeTab === 'fares' ? 'active' : ''}" onclick="SearchManager.switchHubTab('${staId}','fares',event)">🚆 首末班車 & 車資</div>
            </div>
            <div class="sta-quick-route-bar">
                <button class="chip-btn primary" style="flex:1;" onclick="MtrApp.setStationFromExternal('${staId}','origin')">↗ 設為行程起點</button>
                <button class="chip-btn" style="flex:1;" onclick="MtrApp.setStationFromExternal('${staId}','dest')">↘ 設為行程終點</button>
            </div>
        `;

        if (activeTab === 'info') {
            const tGuide = TRANSFER_GUIDE[staId] ? TRANSFER_GUIDE[staId].default.tip : '一般車站大堂與月台扶手電梯連接';
            const exitsHtml = (sta.exits || ['A: 主要出入口 / 商業區', 'B: 公共運輸交匯處']).map(ex => {
                const parts = ex.split(':');
                return `<div class="exit-item">
                    <span class="exit-letter">${parts[0].trim()}</span>
                    <span>${parts.slice(1).join(':').trim()}</span>
                </div>`;
            }).join('');

            container.innerHTML = tabsHeader + `
                <div class="facility-badges">
                    <span class="fac-badge ${sta.toilet ? 'yes' : ''}">${sta.toilet ? '✅ 設有站內洗手間' : '⚪ 洗手間設於鄰近商場'}</span>
                    <span class="fac-badge ${sta.baby ? 'yes' : ''}">${sta.baby ? '🍼 設有育嬰間' : '⚪ 無獨立育嬰間'}</span>
                    <span class="fac-badge yes">♿ 無障礙升降機 / 斜道</span>
                    <span class="fac-badge yes">💳 客務中心 / 自助售票機</span>
                </div>
                <div style="padding:10px 15px;font-size:0.78rem;color:var(--accent-color);background:rgba(14,165,233,0.06);border-bottom:1px solid var(--glass-border);">
                    <b>🔄 轉乘與月台構造提示：</b>${tGuide}
                </div>
                <div>${exitsHtml}</div>
            `;
            return;
        }

        if (activeTab === 'fares') {
            const hubs = ['CEN', 'ADM', 'CAB', 'TST', 'MOK', 'KOT', 'SHT', 'TUM', 'LOW'].filter(h => h !== staId);
            const fareRows = hubs.map(hCode => {
                const f = MtrApp.lookupRawFare(staId, hCode);
                const hName = MtrData.stations[hCode] ? MtrData.stations[hCode].name : hCode;
                return `<div class="preview-row" onclick="MtrApp.quickPlan('${staId}','${hCode}')" style="cursor:pointer;">
                    <div>
                        <div style="font-weight:700;font-size:0.95rem;">往 ${hName} <span style="font-size:0.72rem;color:var(--accent-color);">點擊規劃 ➔</span></div>
                        <div style="font-size:0.75rem;color:var(--sub-text);">單程票 HK$${f ? f.sng.toFixed(1) : '--'} • 樂悠咭 HK$2.0</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.15rem;font-weight:800;color:var(--success-color);">HK$${f ? f.oct.toFixed(1) : '--'}</div>
                        <div style="font-size:0.68rem;color:var(--sub-text);">成人八達通</div>
                    </div>
                </div>`;
            }).join('');

            container.innerHTML = tabsHeader + `
                <div style="display:flex;justify-content:space-between;padding:12px 15px;background:rgba(255,255,255,0.04);border-bottom:1px solid var(--glass-border);font-size:0.84rem;">
                    <span>🌅 <b>頭班車開出：</b>約 ${sta.first || '06:00'}</span>
                    <span>🌙 <b>尾班車開出：</b>約 ${sta.last || '00:50'}</span>
                </div>
                <div>${fareRows}</div>
            `;
            return;
        }

        // Default Tab: Live ETA
        container.innerHTML = tabsHeader + '<div style="padding:16px;color:var(--sub-text);font-size:0.88rem;">正在同步港鐵實時抵站數據...</div>';

        const lineSwitchHtml = staLines.length > 1 ? `<div style="display:flex;gap:6px;padding:8px 14px;background:rgba(0,0,0,0.15);border-bottom:1px solid var(--glass-border);">
            ${staLines.map(l => `<span class="sta-line-pill" style="background:${l.color};opacity:${l.id === targetLine.id ? 1 : 0.45};cursor:pointer;padding:4px 10px;" onclick="event.stopPropagation();SearchManager.renderStationLineETA('${staId}','${l.id}')">${l.name}</span>`).join('')}
        </div>` : '';

        await this.renderStationLineETA(staId, targetLine.id, tabsHeader + lineSwitchHtml);
    },

    async renderStationLineETA(staId, lineId, prefixHtml) {
        const container = document.getElementById(`sacc-${staId}`);
        if (!container) return;
        if (!prefixHtml) {
            const staLines = getStationLines(staId);
            const tabsHeader = `
                <div class="sta-hub-tabs">
                    <div class="sta-hub-tab active" onclick="SearchManager.switchHubTab('${staId}','eta',event)">⏱️ 即時班次</div>
                    <div class="sta-hub-tab" onclick="SearchManager.switchHubTab('${staId}','info',event)">🚪 出口與設施</div>
                    <div class="sta-hub-tab" onclick="SearchManager.switchHubTab('${staId}','fares',event)">🚆 首末班車 & 車資</div>
                </div>
                <div class="sta-quick-route-bar">
                    <button class="chip-btn primary" style="flex:1;" onclick="MtrApp.setStationFromExternal('${staId}','origin')">↗ 設為行程起點</button>
                    <button class="chip-btn" style="flex:1;" onclick="MtrApp.setStationFromExternal('${staId}','dest')">↘ 設為行程終點</button>
                </div>
                <div style="display:flex;gap:6px;padding:8px 14px;background:rgba(0,0,0,0.15);border-bottom:1px solid var(--glass-border);">
                    ${staLines.map(l => `<span class="sta-line-pill" style="background:${l.color};opacity:${l.id === lineId ? 1 : 0.45};cursor:pointer;padding:4px 10px;" onclick="event.stopPropagation();SearchManager.renderStationLineETA('${staId}','${l.id}')">${l.name}</span>`).join('')}
                </div>
            `;
            prefixHtml = tabsHeader;
        }

        const line = MtrData.lines.find(l => l.id === lineId) || MtrData.lines[0];
        const searchPath = line.searchPath || line.path;
        const pathIdx = searchPath.indexOf(staId);
        let showUp = pathIdx !== searchPath.length - 1;
        let showDown = pathIdx !== 0;

        const dirs = MTR_DIRECTIONS[lineId] || { UP: '上行', DOWN: '下行' };
        const apiRes = await fetchMTR_API(lineId, staId);
        const apiData = apiRes ? apiRes.schedule : null;
        const now = (apiRes && apiRes.sysTime) ? new Date(apiRes.sysTime.replace(/-/g, '/')) : new Date();

        let html = '';
        const renderDirection = (dirCode, defaultDest) => {
            if (!apiData || !apiData[dirCode]) return '';
            const trains = apiData[dirCode]
                .map(t => ({ ...t, dateObj: new Date(t.time.replace(/-/g, '/')) }))
                .sort((a, b) => a.dateObj - b.dateObj)
                .slice(0, 4);
            if (trains.length === 0) return '';
            const dirLabel = dirCode === 'UP' ? '上行方向' : '下行方向';
            let dirHtml = `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 15px;background:rgba(255,255,255,0.04);font-weight:700;color:var(--accent-color);font-size:0.84rem;">
                <span>${line.name} • ${dirLabel} (往 ${defaultDest})</span>
                <button class="btn-pin" onclick="event.stopPropagation();HomeManager.pinTile('${lineId}','${staId}','${dirCode}','${defaultDest}')">📌 釘選首頁</button>
            </div>`;

            trains.forEach(t => {
                const diffMin = calculateEtaMin(t, now);
                const timeStr = formatTime(t.dateObj);
                let destName = MtrData.stations[t.dest] ? MtrData.stations[t.dest].name : t.dest;
                if (t.route === 'RAC') destName += ' (經馬場)';
                const etaDisplay = diffMin === 0 ? '<span style="font-size:1.15rem;color:var(--success-color);">即將到站</span>' : diffMin;
                const unitDisplay = diffMin === 0 ? '' : '<span class="preview-unit">min</span>';
                dirHtml += `<div class="preview-row">
                    <div>
                        <div class="preview-dest">往 ${destName}</div>
                        <div class="preview-sub">月台 ${t.plat} • 預計 ${timeStr}</div>
                    </div>
                    <div class="preview-eta">${etaDisplay}${unitDisplay}</div>
                </div>`;
            });
            return dirHtml;
        };

        if (showUp && dirs.UP) html += renderDirection('UP', dirs.UP);
        if (showDown && dirs.DOWN) html += renderDirection('DOWN', dirs.DOWN);
        if (!html) html = '<div style="padding:15px;color:var(--sub-text);">暫無班次資料</div>';
        container.innerHTML = prefixHtml + html;
    }
};

// ==========================================
// 3. MTR PLANNER ENGINE - 智慧路線規劃與動態流光地圖
// ==========================================
const MtrApp = (function() {
    let map = null, tileLayer = null, stationsLayer = null, linesLayer = null, highlightLayer = null;
    let currentFocus = 'origin', selectedOrigin = null, selectedDest = null;
    let routeMode = 'fastest'; // 'fastest' | 'fewest' | 'comfort'
    let activeFareType = 'oct'; // 'oct' | 'sng' | 'con' | 'joy'
    let externalTimesData = null;
    let localFareMatrix = null;
    let lastCalculatedResult = null;
    let showAllLabels = false;
    let pickerTarget = 'origin';
    const graph = {};

    const HEADWAYS = {
        'ISL': 3, 'TWL': 3, 'KTL': 3, 'TKO': 4, 'TKO_B': 6,
        'EAL': 4, 'EAL_B': 8, 'EAL_R': 10, 'TML': 4, 'TCL': 5,
        'AEL': 10, 'DRL': 10, 'SIL': 4, 'DEFAULT': 4
    };

    function getTransferDetails(staId, fromL, toL) {
        const baseFrom = fromL.split('_')[0];
        const baseTo = toL.split('_')[0];
        const pairKey = `${baseFrom}-${baseTo}`;
        const guide = TRANSFER_GUIDE[staId];
        let walk = 2.5;
        let crossPlatform = false;
        let tip = '經大堂及扶手電梯轉乘月台';

        if (guide) {
            const spec = guide[pairKey] || guide.default;
            if (spec) {
                walk = spec.walk;
                crossPlatform = !!spec.crossPlatform;
                tip = spec.tip;
            }
        }
        const waitMax = HEADWAYS[toL] || HEADWAYS['DEFAULT'];
        return {
            walk,
            waitMax,
            avg: walk + (waitMax / 2),
            crossPlatform,
            tip
        };
    }

    function getDynWt(u, v, data) {
        if (!data) return null;
        const au = getApiId(u), av = getApiId(v);
        if (data[au] && data[au][av]) return data[au][av] / 60;
        if (data[av] && data[av][au]) return data[av][au] / 60;
        return null;
    }

    function buildGraph(data) {
        Object.keys(MtrData.stations).forEach(sta => graph[sta] = []);
        MtrData.lines.forEach(line => {
            for (let i = 0; i < line.path.length - 1; i++) {
                const u = line.path[i];
                const v = line.path[i + 1];
                if (MtrData.stations[u] && MtrData.stations[v]) {
                    const wt = getDynWt(u, v, data) !== null ? getDynWt(u, v, data) : 2.1;
                    graph[u].push({ node: v, lineId: line.id, lineColor: line.color, lineName: line.name, weight: wt });
                    graph[v].push({ node: u, lineId: line.id, lineColor: line.color, lineName: line.name, weight: wt });
                }
            }
        });
        // Add Central <-> Hong Kong pedestrian subway connection
        if (graph['CEN'] && graph['HOK']) {
            graph['CEN'].push({ node: 'HOK', lineId: 'WALK', lineColor: '#94A3B8', lineName: '行人隧道步行', weight: 5.0 });
            graph['HOK'].push({ node: 'CEN', lineId: 'WALK', lineColor: '#94A3B8', lineName: '行人隧道步行', weight: 5.0 });
        }
        // Add Tsim Sha Tsui <-> East Tsim Sha Tsui pedestrian subway connection
        if (graph['TST'] && graph['ETS']) {
            graph['TST'].push({ node: 'ETS', lineId: 'WALK', lineColor: '#94A3B8', lineName: '行人隧道步行', weight: 5.0 });
            graph['ETS'].push({ node: 'TST', lineId: 'WALK', lineColor: '#94A3B8', lineName: '行人隧道步行', weight: 5.0 });
        }
    }

    async function init() {
        if (window.INLINE_FARES_DATA) {
            localFareMatrix = window.INLINE_FARES_DATA;
        } else {
            try {
                const fareRes = await fetch('./mtr_fares.json');
                if (fareRes.ok) localFareMatrix = await fareRes.json();
            } catch (e) {}
        }

        try {
            const res = await fetchWithTimeout('https://timeinterval.hkbuseta.com/times/all.json', { timeout: 3500 });
            if (res.ok) externalTimesData = await res.json();
        } catch (e) {}

        buildGraph(externalTimesData);

        if (typeof L !== 'undefined') {
            map = L.map('map-container', {
                zoomControl: false,
                minZoom: 11,
                maxZoom: 17.5,
                zoomSnap: 0,
                wheelPxPerZoomLevel: 120
            }).setView([22.325, 114.17], 12);

            updateMapTileTheme(ThemeManager.isLight);
            linesLayer = L.layerGroup().addTo(map);
            highlightLayer = L.layerGroup().addTo(map);
            stationsLayer = L.layerGroup().addTo(map);
            drawStaticNetwork();

            map.on('zoom', function() {
                const z = map.getZoom();
                let scale = 1 + (z - 12) * 0.15;
                scale = Math.max(0.8, Math.min(2.4, scale));
                const mc = document.getElementById('map-container');
                if (mc) {
                    mc.style.setProperty('--label-scale', scale);
                    if (z < 13.3 && !showAllLabels) mc.classList.add('hide-minor-labels');
                    else mc.classList.remove('hide-minor-labels');
                }
            });
        }
    }

    function updateMapTileTheme(isLight) {
        if (!map || typeof L === 'undefined') return;
        if (tileLayer) map.removeLayer(tileLayer);
        const url = isLight
            ? 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
        tileLayer = L.tileLayer(url).addTo(map);
    }

    function zoomIn() { if (map) map.zoomIn(0.8); }
    function zoomOut() { if (map) map.zoomOut(0.8); }
    function resetView() { if (map) map.flyTo([22.325, 114.17], 12, { duration: 0.7 }); }
    function toggleAllLabels() {
        showAllLabels = !showAllLabels;
        const mc = document.getElementById('map-container');
        if (mc) mc.classList.toggle('hide-minor-labels', !showAllLabels && (!map || map.getZoom() < 13.3));
    }

    function resizeMap() { if (map) map.invalidateSize(); }

    function lookupRawFare(fromSta, toSta) {
        if (!localFareMatrix) return { oct: 12.5, sng: 14.0 };
        const apiFrom = getApiId(fromSta);
        const apiTo = getApiId(toSta);
        const key = `${fromSta}-${toSta}`;
        const revKey = `${toSta}-${fromSta}`;
        const apiKey = `${apiFrom}-${apiTo}`;
        const apiRevKey = `${apiTo}-${apiFrom}`;
        return localFareMatrix[key] || localFareMatrix[revKey] || localFareMatrix[apiKey] || localFareMatrix[apiRevKey] || null;
    }

    function computeMultiFares(fromSta, toSta) {
        const raw = lookupRawFare(fromSta, toSta);
        if (!raw) return null;
        const oct = Number(raw.oct);
        const sng = Number(raw.sng || raw.oct);
        const con = Math.max(1.5, Math.round((oct / 2) * 10) / 10);
        const isBoundary = (fromSta === 'LOW' || fromSta === 'LMC' || toSta === 'LOW' || toSta === 'LMC');
        const isAel = (fromSta === 'AIR' || fromSta === 'AWE' || toSta === 'AIR' || toSta === 'AWE');
        const joy = (isBoundary || isAel) ? con : Math.min(oct, 2.0);
        return { oct, sng, con, joy };
    }

    function drawStaticNetwork() {
        if (!map) return;
        MtrData.lines.forEach(line => {
            const latlngs = line.path.map(id => MtrData.stations[id] ? [MtrData.stations[id].lat, MtrData.stations[id].lon] : null).filter(Boolean);
            L.polyline(latlngs, { color: line.color, weight: 4.5, opacity: 0.82, lineJoin: 'round' }).addTo(linesLayer);
        });
        Object.keys(MtrData.stations).forEach(staId => {
            const sta = MtrData.stations[staId];
            const isMajor = MAJOR_STATIONS.includes(staId);
            const labelClass = isMajor ? 'station-label major-station-label' : 'station-label minor-station-label';
            const nodeClass = isMajor ? 'mtr-station-marker interchange-node' : 'mtr-station-marker';
            const iconHtml = `<div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                <div class="${nodeClass}" id="marker-${staId}" style="width:10px;height:10px;"></div>
                <div class="${labelClass}" id="label-${staId}">${sta.name}</div>
            </div>`;
            const icon = L.divIcon({ className: 'custom-div-icon', html: iconHtml, iconSize: [28, 28], iconAnchor: [14, 14] });
            const marker = L.marker([sta.lat, sta.lon], { icon }).addTo(stationsLayer);
            marker.on('click', () => handleStationClick(staId));
        });
    }

    function setFocus(type) {
        currentFocus = type;
        const oBox = document.getElementById('ui-origin-box');
        const dBox = document.getElementById('ui-dest-box');
        if (oBox) oBox.classList.toggle('active-focus', type === 'origin');
        if (dBox) dBox.classList.toggle('active-focus', type === 'dest');
    }

    function setRouteMode(mode) {
        routeMode = mode;
        document.querySelectorAll('.mode-pill').forEach(el => {
            el.classList.toggle('active', el.dataset.mode === mode);
        });
        if (selectedOrigin && selectedDest) {
            calculateRoute();
        }
    }

    function handleStationClick(staId) {
        if (navigator.vibrate) navigator.vibrate(35);
        const resEl = document.getElementById('route-result');
        if (resEl && resEl.classList.contains('open')) closeResult();
        if (highlightLayer) highlightLayer.clearLayers();
        resetStationVisuals();

        if (currentFocus === 'origin') {
            if (staId === selectedDest) { swapStations(); return; }
            selectedOrigin = staId;
            document.getElementById('ui-origin-name').innerText = `${MtrData.stations[staId].name} (${staId})`;
            if (!selectedDest) setFocus('dest');
        } else {
            if (staId === selectedOrigin) { swapStations(); return; }
            selectedDest = staId;
            document.getElementById('ui-dest-name').innerText = `${MtrData.stations[staId].name} (${staId})`;
        }
        updateMarkersVisuals();
        checkReady();
    }

    function setStationFromExternal(staId, role) {
        AppNav.goTo(2);
        setTimeout(() => {
            setFocus(role);
            handleStationClick(staId);
            if (map && MtrData.stations[staId]) {
                map.flyTo([MtrData.stations[staId].lat, MtrData.stations[staId].lon], 14, { duration: 0.6 });
            }
        }, 200);
    }

    function quickPlan(fromSta, toSta) {
        AppNav.goTo(2);
        setTimeout(() => {
            selectedOrigin = fromSta;
            selectedDest = toSta;
            document.getElementById('ui-origin-name').innerText = `${MtrData.stations[fromSta].name} (${fromSta})`;
            document.getElementById('ui-dest-name').innerText = `${MtrData.stations[toSta].name} (${toSta})`;
            updateMarkersVisuals();
            checkReady();
            calculateRoute();
        }, 220);
    }

    function swapStations() {
        const temp = selectedOrigin;
        selectedOrigin = selectedDest;
        selectedDest = temp;
        document.getElementById('ui-origin-name').innerText = selectedOrigin ? `${MtrData.stations[selectedOrigin].name} (${selectedOrigin})` : '點擊地圖或列表';
        document.getElementById('ui-dest-name').innerText = selectedDest ? `${MtrData.stations[selectedDest].name} (${selectedDest})` : '點擊地圖或列表';
        if (highlightLayer) highlightLayer.clearLayers();
        resetStationVisuals();
        updateMarkersVisuals();
        checkReady();
    }

    function resetStationVisuals() {
        Object.keys(MtrData.stations).forEach(id => {
            const mEl = document.getElementById(`marker-${id}`);
            const lEl = document.getElementById(`label-${id}`);
            const isMajor = MAJOR_STATIONS.includes(id);
            if (mEl) mEl.className = isMajor ? 'mtr-station-marker interchange-node' : 'mtr-station-marker';
            if (lEl) lEl.className = isMajor ? 'station-label major-station-label' : 'station-label minor-station-label';
        });
        if (linesLayer) linesLayer.getLayers().forEach(layer => layer.setStyle({ opacity: 0.82 }));
    }

    function updateMarkersVisuals() {
        if (selectedOrigin && document.getElementById(`marker-${selectedOrigin}`)) {
            document.getElementById(`marker-${selectedOrigin}`).classList.add('selected-origin');
        }
        if (selectedDest && document.getElementById(`marker-${selectedDest}`)) {
            document.getElementById(`marker-${selectedDest}`).classList.add('selected-dest');
        }
    }

    function checkReady() {
        const btn = document.getElementById('btn-calculate');
        if (!btn) return;
        if (selectedOrigin && selectedDest) btn.classList.remove('hidden');
        else btn.classList.add('hidden');
    }

    function findShortestPath(start, end) {
        const distances = {};
        const previous = {};
        const previousLine = {};
        const queue = [];

        Object.keys(MtrData.stations).forEach(sta => {
            distances[sta] = Infinity;
            previous[sta] = null;
        });

        distances[start] = 0;
        queue.push({ node: start, dist: 0, lineId: null });

        while (queue.length > 0) {
            queue.sort((a, b) => a.dist - b.dist);
            const { node, dist, lineId: cLine } = queue.shift();
            if (node === end) break;
            if (dist > distances[node]) continue;

            (graph[node] || []).forEach(neighbor => {
                let cost = neighbor.weight;
                if (cLine !== null && cLine !== neighbor.lineId) {
                    const td = getTransferDetails(node, cLine, neighbor.lineId);
                    if (routeMode === 'fewest') {
                        cost += td.avg + 14; // Strong penalty to minimize transfers
                    } else if (routeMode === 'comfort') {
                        cost += td.crossPlatform ? (td.avg * 0.4) : (td.avg + 6);
                    } else {
                        cost += td.avg;
                    }
                }
                const alt = dist + cost;
                if (alt < distances[neighbor.node]) {
                    distances[neighbor.node] = alt;
                    previous[neighbor.node] = node;
                    previousLine[neighbor.node] = neighbor;
                    queue.push({ node: neighbor.node, dist: alt, lineId: neighbor.lineId });
                }
            });
        }

        const path = [];
        const edges = [];
        let curr = end;
        while (curr) {
            path.unshift(curr);
            if (previous[curr]) edges.unshift(previousLine[curr]);
            curr = previous[curr];
        }
        return { path, edges };
    }

    async function calculateRoute() {
        if (!selectedOrigin || !selectedDest) return;
        const btn = document.getElementById('btn-calculate');
        if (btn) btn.disabled = true;
        document.getElementById('route-drawer').classList.add('slide-down');

        try {
            const result = findShortestPath(selectedOrigin, selectedDest);
            if (result.path.length <= 1) throw new Error("無效路徑");

            let minTot = 0, maxTot = 0, transferCount = 0;
            const firstLine = result.edges[0].lineId;
            const initialWait = 2;
            minTot += initialWait;
            maxTot += initialWait;

            for (let i = 0; i < result.edges.length; i++) {
                const e = result.edges[i];
                const u = result.path[i];
                const v = result.path[i + 1];
                const tt = getDynWt(u, v, externalTimesData) || e.weight || 2;
                minTot += tt;
                maxTot += tt;
                if (i < result.edges.length - 1) {
                    const ne = result.edges[i + 1];
                    if (e.lineId !== ne.lineId) {
                        transferCount++;
                        const td = getTransferDetails(v, e.lineId, ne.lineId);
                        minTot += td.walk;
                        maxTot += (td.walk + td.waitMax);
                    }
                }
            }

            result.minTime = Math.round(minTot);
            result.maxTime = Math.round(maxTot);
            result.baseMin = result.minTime - initialWait;
            result.baseMax = result.maxTime - initialWait;
            result.transferCount = transferCount;
            result.fares = computeMultiFares(selectedOrigin, selectedDest);
            lastCalculatedResult = result;

            if (linesLayer) linesLayer.getLayers().forEach(layer => layer.setStyle({ opacity: 0.14 }));
            Object.keys(MtrData.stations).forEach(id => {
                if (!result.path.includes(id)) {
                    const m = document.getElementById(`marker-${id}`);
                    const l = document.getElementById(`label-${id}`);
                    if (m) m.classList.add('dimmed');
                    if (l) l.classList.add('dimmed');
                }
            });

            if (highlightLayer) {
                highlightLayer.clearLayers();
                let curLine = null;
                let segCoords = [];
                const drawSeg = (coords, color) => {
                    L.polyline(coords, { color, weight: 10, opacity: 0.32, lineJoin: 'round', className: 'route-glow-line' }).addTo(highlightLayer);
                    L.polyline(coords, { color, weight: 5.5, opacity: 1, lineJoin: 'round' }).addTo(highlightLayer);
                    L.polyline(coords, { color: '#ffffff', weight: 2, opacity: 0.75, lineJoin: 'round', className: 'route-flow-dash' }).addTo(highlightLayer);
                };

                result.edges.forEach((edge, idx) => {
                    const cU = [MtrData.stations[result.path[idx]].lat, MtrData.stations[result.path[idx]].lon];
                    const cV = [MtrData.stations[result.path[idx + 1]].lat, MtrData.stations[result.path[idx + 1]].lon];
                    if (curLine !== edge.lineId) {
                        if (segCoords.length > 0) drawSeg(segCoords, result.edges[idx - 1].lineColor);
                        segCoords = [cU, cV];
                        curLine = edge.lineId;
                    } else {
                        segCoords.push(cV);
                    }
                });
                if (segCoords.length > 0) drawSeg(segCoords, result.edges[result.edges.length - 1].lineColor);
            }

            renderResultPanel(result);

            if (map && highlightLayer && highlightLayer.getLayers().length > 0) {
                setTimeout(() => {
                    map.flyToBounds(
                        result.path.map(id => [MtrData.stations[id].lat, MtrData.stations[id].lon]),
                        { paddingTopLeft: [20, 60], paddingBottomRight: [20, window.innerHeight * 0.48], maxZoom: 15.2, duration: 0.75 }
                    );
                }, 60);
            }

            if (firstLine !== 'WALK') {
                fetchMTR_API(firstLine, selectedOrigin).then(apiRes => {
                    let liveEta = null;
                    if (apiRes && apiRes.schedule) {
                        const etaData = apiRes.schedule;
                        const now = apiRes.sysTime ? new Date(apiRes.sysTime.replace(/-/g, '/')) : new Date();
                        const trains = [];
                        if (etaData.UP) trains.push(...etaData.UP);
                        if (etaData.DOWN) trains.push(...etaData.DOWN);
                        const fut = trains.map(t => ({ ...t, dateObj: new Date(t.time.replace(/-/g, '/')) })).sort((a, b) => a.dateObj - b.dateObj);
                        if (fut.length > 0) liveEta = calculateEtaMin(fut[0], now);
                    }
                    const etaBadge = document.getElementById('dynamic-origin-eta');
                    if (etaBadge && liveEta !== null) {
                        etaBadge.innerText = liveEta === 0 ? '首班車：即將到站' : `下一班：${liveEta} 分鐘後`;
                    }
                    const finalWait = liveEta !== null ? liveEta : 2;
                    const finalMin = result.baseMin + finalWait;
                    const finalMax = result.baseMax + finalWait;
                    const timeStr = finalMin === finalMax ? finalMin : `${finalMin} - ${finalMax}`;
                    const timeEl = document.getElementById('result-time');
                    if (timeEl) timeEl.innerHTML = `${timeStr}<span> 分鐘 (含候車)</span>`;
                });
            }
        } catch (e) {
            closeResult();
        } finally {
            if (btn) btn.disabled = false;
        }
    }

    function switchFareType(type) {
        activeFareType = type;
        if (lastCalculatedResult) renderResultPanel(lastCalculatedResult);
    }

    function renderResultPanel(res) {
        const timeStr = res.minTime === res.maxTime ? res.minTime : `${res.minTime} - ${res.maxTime}`;
        const f = res.fares || { oct: 12.0, sng: 13.5, con: 6.0, joy: 2.0 };
        const displayedFare = Number(f[activeFareType] || f.oct).toFixed(1);
        const modeLabel = routeMode === 'fastest' ? '⚡ 最快路線' : (routeMode === 'fewest' ? '🔄 最少轉乘' : '🛋️ 舒適對面轉乘');

        document.querySelector('.result-header').innerHTML = `
            <div class="drag-handle-container" onclick="document.getElementById('route-result').classList.toggle('expanded-full')">
                <div class="drag-handle"></div>
            </div>
            <div class="result-header-content">
                <div>
                    <div style="font-size:0.8rem;font-weight:700;color:var(--accent-color);margin-bottom:4px;">
                        ${MtrData.stations[selectedOrigin].name} ➔ ${MtrData.stations[selectedDest].name} • ${modeLabel}
                    </div>
                    <div class="result-time" id="result-time">${timeStr}<span> 分鐘</span></div>
                    <div style="font-size:0.76rem;color:var(--sub-text);margin-top:4px;">
                        共 ${res.path.length - 1} 站 • 轉乘 ${res.transferCount} 次
                    </div>
                </div>
                <div class="fare-box" id="dynamic-fare-box">
                    <div class="fare-price">${displayedFare}</div>
                    <div style="font-size:0.72rem;color:var(--sub-text);margin-top:2px;">離線車資庫秒速計算</div>
                </div>
            </div>
            <div class="fare-tabs-row">
                <div class="fare-tab-pill ${activeFareType === 'oct' ? 'active' : ''}" onclick="MtrApp.switchFareType('oct')">成人八達通 $${f.oct.toFixed(1)}</div>
                <div class="fare-tab-pill ${activeFareType === 'sng' ? 'active' : ''}" onclick="MtrApp.switchFareType('sng')">單程票 $${f.sng.toFixed(1)}</div>
                <div class="fare-tab-pill ${activeFareType === 'con' ? 'active' : ''}" onclick="MtrApp.switchFareType('con')">小童/學生 $${f.con.toFixed(1)}</div>
                <div class="fare-tab-pill ${activeFareType === 'joy' ? 'active' : ''}" onclick="MtrApp.switchFareType('joy')">樂悠咭/長者 $${f.joy.toFixed(1)}</div>
            </div>
        `;

        let html = '';
        const segs = [];
        if (res.edges.length > 0) {
            let cl = res.edges[0].lineId, cc = res.edges[0].lineColor, cn = res.edges[0].lineName, cStas = [res.path[0]];
            for (let i = 0; i < res.edges.length; i++) {
                const e = res.edges[i];
                if (e.lineId === cl) {
                    cStas.push(res.path[i + 1]);
                } else {
                    segs.push({ lineId: cl, lineColor: cc, lineName: cn, stations: cStas });
                    cl = e.lineId; cc = e.lineColor; cn = e.lineName;
                    cStas = [res.path[i], res.path[i + 1]];
                }
            }
            segs.push({ lineId: cl, lineColor: cc, lineName: cn, stations: cStas });
        }

        for (let s = 0; s < segs.length; s++) {
            const seg = segs[s], startId = seg.stations[0], endId = seg.stations[seg.stations.length - 1];
            if (s === 0) {
                html += `<div class="itinerary-step">
                    <div class="step-line" style="background:${seg.lineColor};"></div>
                    <div class="step-content">
                        <div class="step-station">${MtrData.stations[startId].name} <span class="step-eta" id="dynamic-origin-eta">同步班次中...</span></div>
                        <div class="step-action">乘搭 <span class="line-badge" style="background:${seg.lineColor};">${seg.lineName}</span> 往 ${MtrData.stations[endId].name} 方向</div>
                    </div>
                </div>`;
            } else {
                const td = getTransferDetails(startId, segs[s - 1].lineId, seg.lineId);
                html += `<div class="itinerary-step">
                    <div class="step-line" style="background:linear-gradient(to bottom, ${segs[s - 1].lineColor} 50%, ${seg.lineColor} 50%);"></div>
                    <div class="step-content">
                        <div class="step-station">${MtrData.stations[startId].name} <span class="penalty-badge">轉乘步程 ${td.walk} min</span></div>
                        <div class="step-action">轉乘 <span class="line-badge" style="background:${seg.lineColor};">${seg.lineName}</span> (候車約 0~${td.waitMax} min)</div>
                        <div class="transfer-tip-box">💡 <b>轉乘指引：</b>${td.tip}</div>
                    </div>
                </div>`;
            }

            const inters = seg.stations.slice(1, -1);
            if (inters.length > 0) {
                html += `<div class="itinerary-step" style="margin-top:-4px;">
                    <div class="step-line" style="background:${seg.lineColor};"></div>
                    <div class="step-content">
                        <div class="expand-toggle" onclick="MtrApp.toggleInter(this)">
                            <span class="toggle-icon">▼</span> 途經 ${inters.length} 個車站 (${inters.map(id => MtrData.stations[id].name).slice(0, 3).join('、')}${inters.length > 3 ? '...' : ''})
                        </div>
                        <div class="intermediate-list">${inters.map(id => `<div class="intermediate-station">• ${MtrData.stations[id].name} (${MtrData.stations[id].en})</div>`).join('')}</div>
                    </div>
                </div>`;
            }

            if (s === segs.length - 1) {
                const destSta = MtrData.stations[endId];
                const topExit = (destSta.exits && destSta.exits[0]) ? destSta.exits[0] : '';
                html += `<div class="itinerary-step" style="margin-bottom:0;">
                    <div class="step-line" style="background:${seg.lineColor};"></div>
                    <div class="step-content">
                        <div class="step-station" style="color:var(--accent-color);">🏁 ${destSta.name} (抵達終點)</div>
                        ${topExit ? `<div style="font-size:0.76rem;color:var(--sub-text);margin-top:3px;">主要出口：${topExit}</div>` : ''}
                    </div>
                </div>`;
            }
        }

        document.getElementById('itinerary-list').innerHTML = html;
        const resultPanel = document.getElementById('route-result');
        resultPanel.classList.remove('expanded-full');
        resultPanel.classList.add('open');
    }

    function saveCurrentRoute() {
        if (!selectedOrigin || !selectedDest || !lastCalculatedResult) return;
        const fareVal = lastCalculatedResult.fares ? lastCalculatedResult.fares.oct.toFixed(1) : '12.5';
        HomeManager.addSavedRoute(selectedOrigin, selectedDest, lastCalculatedResult.minTime, fareVal);
        AppNav.goTo(0);
    }

    function openPicker(role) {
        pickerTarget = role;
        const modal = document.getElementById('station-picker-modal');
        const title = document.getElementById('picker-modal-title');
        const input = document.getElementById('picker-search-input');
        if (title) title.innerText = role === 'origin' ? '↗ 選擇起點車站 (Origin)' : '↘ 選擇終點車站 (Destination)';
        if (input) input.value = '';
        if (modal) modal.classList.remove('hidden');
        renderPickerList('');
    }

    function closePicker() {
        const modal = document.getElementById('station-picker-modal');
        if (modal) modal.classList.add('hidden');
    }

    function renderPickerList(query) {
        const list = document.getElementById('picker-station-list');
        if (!list) return;
        const q = (query || '').trim().toLowerCase();
        const codes = Object.keys(MtrData.stations).filter(c => {
            if (!q) return true;
            const s = MtrData.stations[c];
            return c.toLowerCase().includes(q) || s.name.toLowerCase().includes(q) || (s.en && s.en.toLowerCase().includes(q));
        });
        list.innerHTML = codes.map(code => {
            const s = MtrData.stations[code];
            const lines = getStationLines(code);
            return `<div class="preview-row" style="cursor:pointer;" onclick="MtrApp.selectFromPicker('${code}')">
                <div>
                    <span style="font-weight:700;font-size:1rem;">${s.name}</span>
                    <span style="font-size:0.8rem;color:var(--sub-text);margin-left:6px;">${s.en} (${code})</span>
                </div>
                <div style="display:flex;gap:4px;">
                    ${lines.map(l => `<span class="sta-line-pill" style="background:${l.color};">${l.name.replace('綫','')}</span>`).join('')}
                </div>
            </div>`;
        }).join('');
    }

    function selectFromPicker(staId) {
        closePicker();
        setFocus(pickerTarget);
        handleStationClick(staId);
    }

    function toggleInter(el) {
        el.classList.toggle('open');
        el.nextElementSibling.classList.toggle('open');
    }

    function closeResult() {
        document.getElementById('route-result').classList.remove('open');
        document.getElementById('route-drawer').classList.remove('slide-down');
        if (highlightLayer) highlightLayer.clearLayers();
        resetStationVisuals();
        updateMarkersVisuals();
        if (map) map.flyTo([22.325, 114.17], 12, { duration: 0.7 });
    }

    return {
        init, resizeMap, updateMapTileTheme, zoomIn, zoomOut, resetView, toggleAllLabels,
        setFocus, setRouteMode, switchFareType, swapStations, calculateRoute, closeResult,
        toggleInter, lookupRawFare, setStationFromExternal, quickPlan, saveCurrentRoute,
        openPicker, closePicker, renderPickerList, selectFromPicker
    };
})();

// ==========================================
// 4. STATUS & WEATHER MANAGER - 全網車務與天文台預警
// ==========================================
const StatusManager = {
    lines: [
        { id: 'TWL', name: '荃灣綫', color: '#e2231a', checkSta: 'TST' },
        { id: 'KTL', name: '觀塘綫', color: '#00af41', checkSta: 'MOK' },
        { id: 'ISL', name: '港島綫', color: '#0071ce', checkSta: 'ADM' },
        { id: 'TKO', name: '將軍澳綫', color: '#8d3685', checkSta: 'TKO' },
        { id: 'EAL', name: '東鐵綫', color: '#53b7e8', checkSta: 'HUH' },
        { id: 'TML', name: '屯馬綫', color: '#9a3820', checkSta: 'TAW' },
        { id: 'TCL', name: '東涌綫', color: '#f38b00', checkSta: 'NAC' },
        { id: 'AEL', name: '機場快綫', color: '#00838f', checkSta: 'TSY' },
        { id: 'DRL', name: '迪士尼綫', color: '#f550a1', checkSta: 'SUN' },
        { id: 'SIL', name: '南港島綫', color: '#b6bd00', checkSta: 'OCP' }
    ],
    timer: null,
    isFetching: false,
    simEmergency: false,
    typhoonCodes: new Set(['TC8NE', 'TC8SE', 'TC8SW', 'TC8NW', 'TC9', 'TC10']),

    escapeHTML(value) {
        return String(value ?? '').replace(/[&<>'"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[c]));
    },

    toggleSimMode() {
        this.simEmergency = !this.simEmergency;
        const btn = document.getElementById('btn-sim-status');
        if (btn) {
            btn.innerText = this.simEmergency ? '✅ 恢復正常模式' : '🧪 模擬事故演練';
            btn.classList.toggle('primary', this.simEmergency);
        }
        this.fetchStatus();
    },

    async fetchHkoWeather() {
        try {
            const [warnRes, tempRes] = await Promise.all([
                fetchWithTimeout('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=warnsum&lang=tc', { timeout: 3500 }),
                fetchWithTimeout('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc', { timeout: 3500 })
            ]);
            let temp = 26;
            if (tempRes.ok) {
                const tJson = await tempRes.json();
                if (tJson.temperature && tJson.temperature.data && tJson.temperature.data.length > 0) {
                    temp = tJson.temperature.data[0].value;
                }
            }
            let typhoon = null;
            if (warnRes.ok) {
                const wJson = await warnRes.json();
                const warning = wJson && wJson.WTCSGNL;
                if (warning && this.typhoonCodes.has(warning.code) && warning.actionCode !== 'CANCEL') {
                    typhoon = { code: warning.code, type: warning.type || warning.name || '八號或以上熱帶氣旋警告信號' };
                }
            }
            return { temp, typhoon };
        } catch (e) {
            return { temp: 26, typhoon: null };
        }
    },

    updateBanner(state, temp) {
        const banner = document.getElementById('home-status-banner');
        const text = document.getElementById('home-status-text');
        if (!banner || !text) return;
        const tempBadge = temp ? ` • 🌤️ ${temp}°C` : '';
        if (state === 'emergency') {
            banner.className = 'status-banner alert';
            text.innerHTML = `⚠️ 突發預警：觀塘綫延誤及熱帶氣旋演習中${tempBadge}`;
        } else if (state === 'delay') {
            banner.className = 'status-banner alert';
            text.innerHTML = `⚠️ 車務狀況：部分路線出現延誤${tempBadge}`;
        } else {
            banner.className = 'status-banner';
            text.innerHTML = `全網 10 條港鐵路線服務正常${tempBadge}`;
        }
    },

    async fetchStatus() {
        if (this.isFetching) return;
        this.isFetching = true;
        const container = document.getElementById('realtime-status-list');
        try {
            const weather = await this.fetchHkoWeather();
            const tempEl = document.getElementById('hko-temp-val');
            const warnEl = document.getElementById('hko-warn-text');
            if (tempEl) tempEl.innerText = `${weather.temp}°C`;

            if (this.simEmergency) {
                if (warnEl) warnEl.innerHTML = `<span style="color:#F87171;font-weight:700;">⚠️ 模擬八號風球及信號故障演練模式已啟動</span>`;
                this.updateBanner('emergency', weather.temp);
                container.innerHTML = this.lines.map(line => {
                    const details = LINE_DETAILS[line.id] || {};
                    const isDelayed = (line.id === 'KTL' || line.id === 'EAL');
                    return `<div class="status-item ${isDelayed ? 'abnormal expanded' : ''}" style="--line-color:${line.color};" onclick="this.classList.toggle('expanded')">
                        <div class="status-header">
                            <div class="status-line-name">
                                <span>${line.name}</span>
                                <span class="status-freq-tag">${details.cars || '8卡'}</span>
                            </div>
                            <div class="status-indicator">
                                <div class="status-dot"></div>
                                <span>${isDelayed ? '服務受阻 (點擊查看應變) ▾' : '有限度服務 ▾'}</span>
                            </div>
                        </div>
                        <div class="status-detail">
                            <div style="margin-bottom:6px;color:var(--text-color);"><b>📢 實時車務通報：</b>${isDelayed ? '受九龍塘至旺角段信號設備故障影響，列車維持每 8-10 分鐘一班，整體車程預計額外增加 15 分鐘。' : '受惡劣天氣影響，隧道段維持每 6 分鐘一班。'}</div>
                            <div style="padding:8px 10px;border-radius:8px;background:rgba(14,165,233,0.12);color:var(--text-color);">
                                <b>🚌 替代交通及應變方案：</b>${details.altTransport}
                            </div>
                        </div>
                    </div>`;
                }).join('');
                return;
            }

            if (warnEl) warnEl.innerText = '現時無惡劣天氣警告 • 鐵路及露天段服務正常';
            this.updateBanner('normal', weather.temp);

            container.innerHTML = this.lines.map(line => {
                const details = LINE_DETAILS[line.id] || {};
                return `<div class="status-item" style="--line-color:${line.color};" onclick="this.classList.toggle('expanded')">
                    <div class="status-header">
                        <div class="status-line-name">
                            <span>${line.name}</span>
                            <span class="status-freq-tag">繁忙 ${details.peak || '2.5分'}</span>
                        </div>
                        <div class="status-indicator">
                            <div class="status-dot"></div>
                            <span>服務正常 ▾</span>
                        </div>
                    </div>
                    <div class="status-detail">
                        <div style="margin-bottom:6px;"><b>🚆 列車編組與班次：</b>${details.cars} • 繁忙時段每 ${details.peak} 一班，非繁忙時段每 ${details.offPeak} 一班。</div>
                        <div style="color:var(--accent-color);"><b>🚌 突發事故替代交通錦囊：</b>${details.altTransport}</div>
                    </div>
                </div>`;
            }).join('');
        } finally {
            this.isFetching = false;
        }
    },

    init() {
        this.fetchStatus();
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.fetchStatus(), 60000);
    }
};

window.addEventListener('resize', () => {
    if (AppNav.currentIndex === 2) setTimeout(() => MtrApp.resizeMap(), 80);
});
window.addEventListener('orientationchange', () => {
    if (AppNav.currentIndex === 2) setTimeout(() => MtrApp.resizeMap(), 250);
});

window.ThemeManager = ThemeManager;
window.AppNav = AppNav;
window.SearchManager = SearchManager;
window.HomeManager = HomeManager;
window.MtrApp = MtrApp;
window.StatusManager = StatusManager;

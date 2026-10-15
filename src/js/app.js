// =========================================================
// MTR AURA OS 3.6 PRO - Clean Hierarchy & State-Graph Routing
// =========================================================

const AuraToast = {
    timer: null,
    show(msg) {
        const el = document.getElementById('aura-toast');
        if (!el) return;
        el.innerText = msg;
        el.classList.add('show');
        clearTimeout(this.timer);
        this.timer = setTimeout(() => el.classList.remove('show'), 2200);
    }
};

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 3500 } = options;
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), timeout);
    try {
        const res = await fetch(resource, { ...options, signal: controller.signal });
        clearTimeout(id);
        return res;
    } catch (e) {
        clearTimeout(id);
        throw e;
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

function formatHHMM(dateObj) {
    return `${String(dateObj.getHours()).padStart(2, '0')}:${String(dateObj.getMinutes()).padStart(2, '0')}`;
}

function calcEtaMin(t, nowObj) {
    if (t.ttnt !== undefined) {
        const p = parseInt(t.ttnt, 10);
        if (!isNaN(p)) return Math.max(0, p);
    }
    return Math.max(0, Math.floor((t.dateObj - nowObj) / 60000));
}

function isTerminusForDir(lineId, staId, dirKey) {
    const baseLine = lineId.split('_')[0];
    const upTermini = {
        'TWL': ['TSW'], 'KTL': ['TIK'], 'ISL': ['CHW'], 'TKO': ['POA', 'LHP'],
        'EAL': ['LOW', 'LMC'], 'TML': ['WUM'], 'TCL': ['TUC'], 'AEL': ['AWE'],
        'DRL': ['DIS'], 'SIL': ['SOH']
    };
    const downTermini = {
        'TWL': ['CEN'], 'KTL': ['WHA'], 'ISL': ['KET'], 'TKO': ['NOP'],
        'EAL': ['ADM'], 'TML': ['TUM'], 'TCL': ['HOK'], 'AEL': ['HOK'],
        'DRL': ['SUN'], 'SIL': ['ADM']
    };
    if (dirKey === 'UP') return (upTermini[baseLine] || []).includes(staId);
    if (dirKey === 'DOWN') return (downTermini[baseLine] || []).includes(staId);
    return false;
}

function makeSimulatedSchedule(lineId, staId) {
    const baseLine = lineId.split('_')[0];
    const line = MtrData.lines.find(l => l.id === baseLine) || MtrData.lines[0];
    const sp = line.searchPath || line.path;
    const upTerm = sp[sp.length - 1];
    const downTerm = sp[0];
    const now = new Date();
    const seed = (staId.charCodeAt(0) + baseLine.charCodeAt(0) + now.getMinutes()) % 3;
    const hw = baseLine === 'AEL' ? 10 : (baseLine === 'DRL' ? 6 : 3);

    const buildList = (dest, plat, dirKey) => {
        if (isTerminusForDir(baseLine, staId, dirKey)) return [];
        return [0, 1, 2].map(i => {
            const m = seed + i * hw;
            const d = new Date(now.getTime() + m * 60000);
            const pad = n => String(n).padStart(2, '0');
            let finalDest = dest;
            if (baseLine === 'EAL' && dirKey === 'UP' && i % 2 === 1 && staId !== 'LOW') finalDest = 'LMC';
            if (baseLine === 'TKO' && dirKey === 'UP' && i % 2 === 1 && staId !== 'POA') finalDest = 'LHP';
            return {
                dest: finalDest,
                plat: String(plat),
                time: `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:00`,
                ttnt: String(m)
            };
        });
    };
    return {
        schedule: {
            UP: buildList(upTerm, 1, 'UP'),
            DOWN: buildList(downTerm, 2, 'DOWN')
        },
        sysTime: ""
    };
}

async function fetchLiveMtrEta(lineId, staId) {
    const apiLine = getApiLineId(lineId);
    const apiSta = getApiId(staId);
    try {
        const res = await fetchWithTimeout(`https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${apiLine}&sta=${apiSta}&lang=TC`, { timeout: 3200 });
        if (res.ok) {
            const json = await res.json();
            const sched = json.data && json.data[`${apiLine}-${apiSta}`];
            if (json.status === 1 && sched && ((sched.UP && sched.UP.length > 0) || (sched.DOWN && sched.DOWN.length > 0))) {
                return { schedule: sched, sysTime: json.sys_time || json.curr_time || "" };
            }
        }
    } catch (e) {}
    return makeSimulatedSchedule(lineId, staId);
}

// 1. Theme
const AuraTheme = {
    isLight: false,
    init() {
        try { this.isLight = localStorage.getItem('mtr_aura_theme') === 'light'; } catch (e) {}
        this.apply();
    },
    toggle() {
        this.isLight = !this.isLight;
        try { localStorage.setItem('mtr_aura_theme', this.isLight ? 'light' : 'dark'); } catch (e) {}
        this.apply();
        if (window.AuraCockpit) AuraCockpit.syncMapTiles(this.isLight);
        AuraToast.show(this.isLight ? '☀️ 已切換至日照淺色主題' : '🌙 已切換至極光深色主題');
    },
    apply() {
        document.body.classList.toggle('light-mode', this.isLight);
        const btn = document.getElementById('aura-theme-btn');
        if (btn) btn.innerText = this.isLight ? '🌙' : '☀️';
    }
};

// 2. Navigation
const AuraNav = {
    currentTab: 0,
    switchTab(idx) {
        this.currentTab = idx;
        document.querySelectorAll('.aura-view').forEach((v, i) => v.classList.toggle('active', i === idx));
        document.querySelectorAll('.dock-item').forEach((d, i) => d.classList.toggle('active', i === idx));
        if (idx === 0) AuraDashboard.refreshAllBoards(false);
        if (idx === 1) {
            setTimeout(() => AuraCockpit.invalidateMap(), 80);
            setTimeout(() => AuraCockpit.invalidateMap(), 280);
        }
    }
};

// 3. Tab 0: Clean Dual-Platform PIDS Dashboard
const AuraDashboard = {
    monitored: [],
    commutes: [],
    simIdx: 0,
    timer: null,

    init() {
        try {
            const m = localStorage.getItem('mtr_aura_monitored');
            if (m) this.monitored = JSON.parse(m);
        } catch (e) {}
        if (!this.monitored || this.monitored.length === 0) {
            this.monitored = [
                { lineId: 'KTL', staId: 'KOB' },
                { lineId: 'TWL', staId: 'TST' },
                { lineId: 'ISL', staId: 'ADM' }
            ];
            this.saveMonitored();
        }

        try {
            const c = localStorage.getItem('mtr_aura_commutes');
            if (c) this.commutes = JSON.parse(c);
        } catch (e) {}
        if (!this.commutes || this.commutes.length === 0) {
            this.commutes = [
                { from: 'KOB', to: 'FAN' },
                { from: 'KOB', to: 'CEN' },
                { from: 'ADM', to: 'TST' }
            ];
            this.saveCommutes();
        }

        this.renderCommutes();
        this.refreshAllBoards(false);
        if (this.timer) clearInterval(this.timer);
        this.timer = setInterval(() => this.refreshAllBoards(false), 25000);
    },

    saveMonitored() {
        try { localStorage.setItem('mtr_aura_monitored', JSON.stringify(this.monitored)); } catch (e) {}
    },
    saveCommutes() {
        try { localStorage.setItem('mtr_aura_commutes', JSON.stringify(this.commutes)); } catch (e) {}
    },

    addStationMonitor(staId) {
        const lines = getStationLines(staId);
        const lineId = lines[0] ? lines[0].id : 'TWL';
        if (!this.monitored.find(m => m.staId === staId && m.lineId === lineId)) {
            this.monitored.unshift({ lineId, staId });
            this.saveMonitored();
        }
        AuraNav.switchTab(0);
        this.refreshAllBoards(false);
        AuraToast.show(`📺 已新增 ${MtrData.stations[staId].name}站 看板`);
    },

    switchCardLine(idx, newLineId) {
        if (this.monitored[idx]) {
            this.monitored[idx].lineId = newLineId;
            this.saveMonitored();
            this.refreshAllBoards(false);
        }
    },

    removeMonitor(idx) {
        this.monitored.splice(idx, 1);
        this.saveMonitored();
        this.refreshAllBoards(false);
    },

    addCommuteBookmark(from, to) {
        this.commutes = this.commutes.filter(c => !(c.from === from && c.to === to));
        this.commutes.unshift({ from, to });
        this.saveCommutes();
        this.renderCommutes();
        AuraToast.show(`⭐ 已收藏「${MtrData.stations[from].name} ➔ ${MtrData.stations[to].name}」`);
    },

    removeCommute(idx, e) {
        if (e) e.stopPropagation();
        this.commutes.splice(idx, 1);
        this.saveCommutes();
        this.renderCommutes();
    },

    renderCommutes() {
        const bar = document.getElementById('commute-pills-bar');
        if (!bar) return;
        if (this.commutes.length === 0) {
            bar.innerHTML = `<span style="font-size:0.74rem;color:var(--text-sub);">於「路線導航」可一鍵收藏常用路線</span>`;
            return;
        }
        bar.innerHTML = this.commutes.map((c, idx) => {
            const fName = MtrData.stations[c.from] ? MtrData.stations[c.from].name : c.from;
            const tName = MtrData.stations[c.to] ? MtrData.stations[c.to].name : c.to;
            const fareObj = AuraCockpit.getRawFare(c.from, c.to);
            const fareStr = fareObj ? `$${Number(fareObj.oct).toFixed(1)}` : '';
            return `<div class="commute-pill" onclick="AuraCockpit.launchRoute('${c.from}','${c.to}')">
                <span>${fName} ➔ ${tName}</span>
                <span style="color:#10B981;">${fareStr}</span>
                <span style="color:var(--text-sub);font-size:0.65rem;" onclick="AuraDashboard.removeCommute(${idx}, event)">✕</span>
            </div>`;
        }).join('');
    },

    locateNearest() {
        const titleEl = document.getElementById('hero-nearest-sta');
        if (titleEl) titleEl.innerText = '正在掃描...';

        const applyNearest = (lat, lon) => {
            let best = 'MOK', minD = 1e9;
            Object.keys(MtrData.stations).forEach(code => {
                const s = MtrData.stations[code];
                const d = Math.hypot((s.lat - lat) * 111300, (s.lon - lon) * 102800);
                if (d < minD) { minD = d; best = code; }
            });
            const st = MtrData.stations[best];
            const distM = Math.max(45, Math.round(minD));
            if (titleEl) titleEl.innerText = `${st.name} (約 ${distM}m)`;
            const btnO = document.getElementById('hero-btn-origin');
            const btnH = document.getElementById('hero-btn-holo');
            if (btnO) btnO.setAttribute('onclick', `AuraCockpit.setExternal('${best}','origin')`);
            if (btnH) btnH.setAttribute('onclick', `AuraHub.openHologram('${best}')`);
            AuraToast.show(`📡 最近車站：${st.name}站`);
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                p => applyNearest(p.coords.latitude, p.coords.longitude),
                () => {
                    const hubs = [[22.3236,114.2140],[22.3198,114.1694],[22.2815,114.1580],[22.3820,114.1870]];
                    const pick = hubs[this.simIdx++ % hubs.length];
                    applyNearest(pick[0], pick[1]);
                },
                { timeout: 2000 }
            );
        } else {
            applyNearest(22.3236, 114.2140);
        }
    },

    async refreshAllBoards(showFeedback) {
        if (showFeedback) AuraToast.show('↻ 正在同步實時班次...');
        const container = document.getElementById('pids-board-container');
        if (!container) return;
        if (this.monitored.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:32px;background:var(--bento-bg);border-radius:20px;border:1px dashed var(--glass-border);">
                <div style="font-weight:800;margin-bottom:10px;">尚未新增監測車站</div>
                <button class="pids-icon-btn" style="color:var(--aura-cyan);" onclick="AuraPicker.open('pin')">＋ 新增車站</button>
            </div>`;
            return;
        }

        container.innerHTML = this.monitored.map((m, idx) => {
            const sta = MtrData.stations[m.staId] || { name: m.staId };
            const staLines = getStationLines(m.staId);
            const curLine = MtrData.lines.find(l => l.id === m.lineId) || staLines[0] || MtrData.lines[0];
            const dirs = MTR_DIRECTIONS[curLine.id] || { UP: '上行', DOWN: '下行' };

            const lineSwitcher = staLines.map(l =>
                `<span onclick="AuraDashboard.switchCardLine(${idx},'${l.id}')" style="cursor:pointer;padding:2px 8px;border-radius:6px;font-size:0.68rem;font-weight:800;color:#fff;background:${l.color};opacity:${l.id===curLine.id?1:0.32};">${l.name.replace('綫','')}</span>`
            ).join('');

            return `<div class="pids-station-card">
                <div class="pids-card-header">
                    <div class="pids-line-bar" style="background:${curLine.color};"></div>
                    <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                        <span class="pids-sta-name">${sta.name}</span>
                        <div style="display:flex;gap:4px;">${lineSwitcher}</div>
                    </div>
                    <div style="display:flex;gap:6px;">
                        <button class="pids-icon-btn" onclick="AuraHub.openHologram('${m.staId}')">詳情</button>
                        <button class="pids-icon-btn" onclick="AuraDashboard.removeMonitor(${idx})">✕</button>
                    </div>
                </div>

                <div class="pids-dual-grid">
                    <div class="pids-dir-pane" onclick="AuraHub.openHologram('${m.staId}')">
                        <div class="pids-dest-row">
                            <span class="pids-dest-main" id="dest-up-${idx}">往 ${dirs.UP}</span>
                            <span class="pids-plat-badge" id="plat-up-${idx}">1號月台</span>
                        </div>
                        <div class="pids-eta-hero">
                            <span class="pids-eta-num" id="eta-up-${idx}">--</span>
                            <span class="pids-eta-unit" id="unit-up-${idx}">min</span>
                        </div>
                        <div class="pids-sub-eta" id="next-up-${idx}">同步中...</div>
                    </div>

                    <div class="pids-dir-pane" onclick="AuraHub.openHologram('${m.staId}')">
                        <div class="pids-dest-row">
                            <span class="pids-dest-main" id="dest-down-${idx}">往 ${dirs.DOWN}</span>
                            <span class="pids-plat-badge" style="color:#F472B6;border-color:rgba(244,114,182,0.4);background:rgba(244,114,182,0.14);" id="plat-down-${idx}">2號月台</span>
                        </div>
                        <div class="pids-eta-hero">
                            <span class="pids-eta-num" id="eta-down-${idx}">--</span>
                            <span class="pids-eta-unit" id="unit-down-${idx}">min</span>
                        </div>
                        <div class="pids-sub-eta" id="next-down-${idx}">同步中...</div>
                    </div>
                </div>
            </div>`;
        }).join('');

        for (let idx = 0; idx < this.monitored.length; idx++) {
            const m = this.monitored[idx];
            const res = await fetchLiveMtrEta(m.lineId, m.staId);
            const sched = res ? res.schedule : null;
            const now = (res && res.sysTime) ? new Date(res.sysTime.replace(/-/g, '/')) : new Date();

            const fillPane = (dirKey, suffix) => {
                const etaEl = document.getElementById(`eta-${suffix}-${idx}`);
                const unitEl = document.getElementById(`unit-${suffix}-${idx}`);
                const platEl = document.getElementById(`plat-${suffix}-${idx}`);
                const destEl = document.getElementById(`dest-${suffix}-${idx}`);
                const nextEl = document.getElementById(`next-${suffix}-${idx}`);
                if (!etaEl) return;

                if (isTerminusForDir(m.lineId, m.staId, dirKey)) {
                    etaEl.innerText = '落客終點';
                    etaEl.className = 'pids-eta-num terminus';
                    if (unitEl) unitEl.innerText = '';
                    if (nextEl) nextEl.innerText = '此方向為終點站';
                    return;
                }

                const rawList = (sched && sched[dirKey]) ? sched[dirKey] : [];
                const trains = rawList.map(t => ({ ...t, dateObj: new Date(t.time.replace(/-/g, '/')) })).sort((a, b) => a.dateObj - b.dateObj);

                if (trains.length === 0) {
                    etaEl.innerText = '暫無班次';
                    etaEl.className = 'pids-eta-num terminus';
                    if (unitEl) unitEl.innerText = '';
                    if (nextEl) nextEl.innerText = '非行車時段';
                    return;
                }

                const m0 = calcEtaMin(trains[0], now);
                const d0Name = MtrData.stations[trains[0].dest] ? MtrData.stations[trains[0].dest].name : trains[0].dest;
                if (destEl) destEl.innerText = `往 ${d0Name}`;
                if (platEl) platEl.innerText = `${trains[0].plat || (dirKey === 'UP' ? '1' : '2')}號月台`;

                if (m0 === 0) {
                    etaEl.innerText = '即將到站';
                    etaEl.className = 'pids-eta-num arriving';
                    if (unitEl) unitEl.innerText = '';
                } else {
                    etaEl.innerText = m0;
                    etaEl.className = 'pids-eta-num';
                    if (unitEl) unitEl.innerText = 'min';
                }

                const subMins = trains.slice(1, 3).map(t => {
                    const mi = calcEtaMin(t, now);
                    return mi === 0 ? '即將' : `${mi} min`;
                });
                if (nextEl) {
                    nextEl.innerHTML = subMins.length > 0 ? `下班：<b>${subMins.join(' / ')}</b>` : '尾班車已開出';
                }
            };

            fillPane('UP', 'up');
            fillPane('DOWN', 'down');
        }
    }
};

// 4. Tab 1: Spatial Route Cockpit (State-Graph Multi-Route Engine)
const AuraCockpit = (function() {
    let map = null, tileLayer = null, linesLayer = null, highlightLayer = null, stationsLayer = null;
    let activeSlot = 'origin', originSta = 'KOB', destSta = 'FAN';
    let currentStrategy = 'fewest';
    let sheetSnap = 'normal';
    let cachedRoutes = {};
    let faresDB = null;
    let showAllLabels = false;
    const graph = {};

    const HEADWAYS = { 'ISL':2.5,'TWL':2.5,'KTL':2.5,'TKO':3.5,'EAL':3.5,'TML':3.5,'TCL':4.5,'AEL':10,'DRL':8,'SIL':3.5,'DEFAULT':3.5 };

    // Realistic MTR segment travel times (minutes)
    const REAL_SEG_MINS = {
        'KOT-TAW': 3.8, 'TAW-SHT': 2.2, 'SHT-FOT': 2.2, 'FOT-UNI': 2.8, 'UNI-TAP': 5.2, 'TAP-TWO': 2.2, 'TWO-FAN': 4.8, 'FAN-SHS': 2.5, 'SHS-LOW': 3.8, 'SHS-LMC': 4.5,
        'ADM-EXC': 2.2, 'EXC-HUH': 3.8, 'HUH-MKK': 2.5, 'MKK-KOT': 2.5,
        'DIH-HIK': 2.8, 'HIK-TAW': 2.2,
        'TWW-KSR': 6.5, 'KSR-YUL': 3.5, 'TIS-SIH': 3.8,
        'LAK-TSY': 3.2, 'TSY-SUN': 5.2, 'SUN-TUC': 6.8,
        'YAT-QUO': 4.2, 'NOP-QUO': 1.8, 'ADM-TST': 3.2, 'ADM-OCP': 4.2
    };

    function getSegWeight(u, v) {
        return REAL_SEG_MINS[`${u}-${v}`] || REAL_SEG_MINS[`${v}-${u}`] || 2.1;
    }

    function getTransferInfo(staId, fromL, toL) {
        const bf = fromL.split('_')[0], bt = toL.split('_')[0];
        const g = TRANSFER_GUIDE[staId];
        let walk = 2.5, cross = false, tip = '經大堂扶手電梯轉乘', cars = [4, 5, 6];
        if (g) {
            const spec = g[`${bf}-${bt}`] || g.default;
            if (spec) {
                walk = spec.walk;
                cross = !!spec.crossPlatform;
                tip = spec.tip;
                if (tip.includes('3-5')) cars = [3, 4, 5];
                else if (tip.includes('3-6')) cars = [3, 4, 5, 6];
                else if (tip.includes('5-7')) cars = [5, 6, 7];
                else if (tip.includes('4-5')) cars = [4, 5];
            }
        }
        const waitMax = HEADWAYS[bt] || 3.5;
        return { walk, waitMax, avg: walk + waitMax / 2, cross, tip, cars };
    }

    function buildNetworkGraph() {
        Object.keys(MtrData.stations).forEach(s => graph[s] = []);
        MtrData.lines.forEach(line => {
            for (let i = 0; i < line.path.length - 1; i++) {
                const u = line.path[i], v = line.path[i + 1];
                if (MtrData.stations[u] && MtrData.stations[v]) {
                    const wt = getSegWeight(u, v);
                    graph[u].push({ node: v, lineId: line.id, lineColor: line.color, lineName: line.name, weight: wt });
                    graph[v].push({ node: u, lineId: line.id, lineColor: line.color, lineName: line.name, weight: wt });
                }
            }
        });
        if (graph['CEN'] && graph['HOK']) {
            graph['CEN'].push({ node: 'HOK', lineId: 'WALK', lineColor: '#94A3B8', lineName: '行人隧道步行', weight: 5 });
            graph['HOK'].push({ node: 'CEN', lineId: 'WALK', lineColor: '#94A3B8', lineName: '行人隧道步行', weight: 5 });
        }
        if (graph['TST'] && graph['ETS']) {
            graph['TST'].push({ node: 'ETS', lineId: 'WALK', lineColor: '#94A3B8', lineName: '行人隧道步行', weight: 5 });
            graph['ETS'].push({ node: 'TST', lineId: 'WALK', lineColor: '#94A3B8', lineName: '行人隧道步行', weight: 5 });
        }
    }

    async function init() {
        if (window.INLINE_FARES_DATA) {
            faresDB = window.INLINE_FARES_DATA;
        }
        buildNetworkGraph();

        if (typeof L !== 'undefined') {
            map = L.map('aura-map-canvas', { zoomControl: false, minZoom: 11, maxZoom: 17.5, zoomSnap: 0 }).setView([22.34, 114.17], 12);
            syncMapTiles(AuraTheme.isLight);
            linesLayer = L.layerGroup().addTo(map);
            highlightLayer = L.layerGroup().addTo(map);
            stationsLayer = L.layerGroup().addTo(map);
            renderMapNodes();

            map.on('zoom', () => {
                const z = map.getZoom();
                const sc = Math.max(0.8, Math.min(2.2, 1 + (z - 12) * 0.15));
                const mc = document.getElementById('aura-map-canvas');
                if (mc) {
                    mc.style.setProperty('--label-scale', sc);
                    mc.classList.toggle('hide-minor-labels', z < 13.3 && !showAllLabels);
                }
            });
        }
        updateCapsuleUI();
    }

    function syncMapTiles(isLight) {
        if (!map || typeof L === 'undefined') return;
        if (tileLayer) map.removeLayer(tileLayer);
        const u = isLight
            ? 'https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png'
            : 'https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png';
        tileLayer = L.tileLayer(u).addTo(map);
    }

    function renderMapNodes() {
        if (!map) return;
        MtrData.lines.forEach(l => {
            const pts = l.path.map(id => MtrData.stations[id] ? [MtrData.stations[id].lat, MtrData.stations[id].lon] : null).filter(Boolean);
            L.polyline(pts, { color: l.color, weight: 4.5, opacity: 0.8, lineJoin: 'round' }).addTo(linesLayer);
        });
        Object.keys(MtrData.stations).forEach(staId => {
            const s = MtrData.stations[staId];
            const maj = MAJOR_STATIONS.includes(staId);
            const html = `<div style="position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;">
                <div class="mtr-station-marker ${maj?'interchange-node':''}" id="marker-${staId}" style="width:10px;height:10px;"></div>
                <div class="station-label ${maj?'major-station-label':'minor-station-label'}" id="label-${staId}">${s.name}</div>
            </div>`;
            const icon = L.divIcon({ className: 'custom-div-icon', html, iconSize: [28, 28], iconAnchor: [14, 14] });
            const m = L.marker([s.lat, s.lon], { icon }).addTo(stationsLayer);
            m.on('click', () => onStationPicked(staId));
        });
    }

    function focusSlot(slot) {
        activeSlot = slot;
        document.getElementById('slot-origin').classList.toggle('active-slot', slot === 'origin');
        document.getElementById('slot-dest').classList.toggle('active-slot', slot === 'dest');
    }

    function onStationPicked(staId) {
        if (navigator.vibrate) navigator.vibrate(25);
        if (activeSlot === 'origin') {
            if (staId === destSta) { swapStations(); return; }
            originSta = staId;
            focusSlot('dest');
        } else {
            if (staId === originSta) { swapStations(); return; }
            destSta = staId;
        }
        updateCapsuleUI();
        computeAllStrategies();
    }

    function updateCapsuleUI() {
        const oEl = document.getElementById('slot-origin-val');
        const dEl = document.getElementById('slot-dest-val');
        if (oEl) oEl.innerText = originSta ? MtrData.stations[originSta].name : '選擇起點';
        if (dEl) dEl.innerText = destSta ? MtrData.stations[destSta].name : '選擇終點';
    }

    function swapStations() {
        const t = originSta; originSta = destSta; destSta = t;
        updateCapsuleUI();
        computeAllStrategies();
    }

    function setSheetSnap(mode) {
        sheetSnap = mode;
        const sh = document.getElementById('cockpit-route-sheet');
        if (!sh) return;
        sh.classList.remove('mini', 'tall');
        if (mode === 'mini') sh.classList.add('mini');
        if (mode === 'tall') sh.classList.add('tall');
    }

    function cycleSheetSnap() {
        const order = ['normal', 'tall', 'mini'];
        const next = order[(order.indexOf(sheetSnap) + 1) % order.length];
        setSheetSnap(next);
    }

    function clearRoute() {
        const sh = document.getElementById('cockpit-route-sheet');
        if (sh) sh.classList.remove('open', 'mini', 'tall');
        if (highlightLayer) highlightLayer.clearLayers();
        if (linesLayer) linesLayer.getLayers().forEach(l => l.setStyle({ opacity: 0.8 }));
        Object.keys(MtrData.stations).forEach(id => {
            const m = document.getElementById(`marker-${id}`);
            const l = document.getElementById(`label-${id}`);
            const maj = MAJOR_STATIONS.includes(id);
            if (m) m.className = `mtr-station-marker ${maj?'interchange-node':''}`;
            if (l) l.className = `station-label ${maj?'major-station-label':'minor-station-label'}`;
        });
        if (map) map.flyTo([22.34, 114.17], 12, { duration: 0.5 });
    }

    // State-Space Dijkstra: keys by `${station}|${baseLine}` so interchange hubs never overwrite each other!
    function runStateDijkstra(start, end, mode, bannedHubs = new Set()) {
        const dist = {}, prevState = {}, prevEdge = {}, pq = [];
        const startKey = `${start}|START`;
        dist[startKey] = 0;
        pq.push({ key: startKey, node: start, lineId: null, d: 0 });

        let bestEndKey = null;

        while (pq.length > 0) {
            pq.sort((a, b) => a.d - b.d);
            const { key, node, lineId: curL, d } = pq.shift();
            if (node === end) {
                bestEndKey = key;
                break;
            }
            if (d > (dist[key] ?? 1e9)) continue;

            (graph[node] || []).forEach(nb => {
                if (nb.node === 'RAC' && start !== 'RAC' && end !== 'RAC') return;
                let c = nb.weight;
                const bCur = curL ? curL.split('_')[0] : null;
                const bNext = nb.lineId.split('_')[0];
                if (bCur !== null && bCur !== bNext && nb.lineId !== 'WALK') {
                    const ti = getTransferInfo(node, curL, nb.lineId);
                    if (mode === 'fewest') c += ti.avg + 55;
                    else if (mode === 'comfort') c += ti.cross ? (ti.avg * 0.25) : (ti.avg + 9);
                    else c += ti.avg;
                    if (bannedHubs.has(node)) c += 45;
                }
                const nextKey = `${nb.node}|${bNext}`;
                if (d + c < (dist[nextKey] ?? 1e9)) {
                    dist[nextKey] = d + c;
                    prevState[nextKey] = key;
                    prevEdge[nextKey] = nb;
                    pq.push({ key: nextKey, node: nb.node, lineId: nb.lineId, d: dist[nextKey] });
                }
            });
        }

        const path = [], edges = [];
        let currKey = bestEndKey;
        while (currKey) {
            const node = currKey.split('|')[0];
            path.unshift(node);
            if (prevState[currKey]) edges.unshift(prevEdge[currKey]);
            currKey = prevState[currKey];
        }

        let realMin = 1, transfers = 0, transferStations = [], firstTransferInfo = null;
        for (let i = 0; i < edges.length; i++) {
            realMin += edges[i].weight;
            if (i < edges.length - 1) {
                const l1 = edges[i].lineId.split('_')[0];
                const l2 = edges[i + 1].lineId.split('_')[0];
                if (l1 !== l2 && l2 !== 'WALK') {
                    transfers++;
                    transferStations.push(path[i + 1]);
                    const ti = getTransferInfo(path[i + 1], edges[i].lineId, edges[i + 1].lineId);
                    realMin += (l1 === 'WALK' ? 2 : ti.avg);
                    if (!firstTransferInfo) firstTransferInfo = { staId: path[i + 1], ...ti };
                }
            }
        }
        const viaLabel = transferStations.length === 0
            ? '直達免轉乘'
            : '經' + transferStations.map(s => MtrData.stations[s].name).join('・');
        return { path, edges, totalMin: Math.round(realMin), transfers, transferStations, viaLabel, firstTransferInfo };
    }

    function getRawFare(fromSta, toSta) {
        if (!faresDB) return { oct: 12.5, sng: 14.0 };
        const af = getApiId(fromSta), at = getApiId(toSta);
        return faresDB[`${fromSta}-${toSta}`] || faresDB[`${toSta}-${fromSta}`] || faresDB[`${af}-${at}`] || faresDB[`${at}-${af}`] || { oct: 12.5, sng: 14.0 };
    }

    function computeAllStrategies() {
        if (!originSta || !destSta || originSta === destSta) return;
        const rFastest = runStateDijkstra(originSta, destSta, 'fastest');
        const rFewest = runStateDijkstra(originSta, destSta, 'fewest');
        let rComfort = runStateDijkstra(originSta, destSta, 'comfort');

        const sig = r => r.path.join('-');
        // Ensure the 3 tabs offer distinct transfer hubs whenever possible!
        if (sig(rFastest) === sig(rFewest) && rFastest.transferStations.length > 0) {
            const altFast = runStateDijkstra(originSta, destSta, 'fastest', new Set(rFewest.transferStations));
            if (altFast.path.length > 1 && altFast.totalMin <= rFewest.totalMin + 12) {
                cachedRoutes['fewest'] = rFewest;
                cachedRoutes['fastest'] = altFast;
            } else {
                cachedRoutes['fastest'] = rFastest;
                cachedRoutes['fewest'] = rFewest;
            }
        } else {
            cachedRoutes['fastest'] = rFastest;
            cachedRoutes['fewest'] = rFewest;
        }

        const usedHubs = new Set([
            ...(cachedRoutes['fastest'].transferStations || []),
            ...(cachedRoutes['fewest'].transferStations || [])
        ]);
        if (sig(rComfort) === sig(cachedRoutes['fastest']) || sig(rComfort) === sig(cachedRoutes['fewest'])) {
            if (usedHubs.size > 0) {
                const alt3 = runStateDijkstra(originSta, destSta, 'fastest', usedHubs);
                if (alt3.path.length > 1 && alt3.totalMin <= cachedRoutes['fastest'].totalMin + 16) {
                    rComfort = alt3;
                }
            }
        }
        cachedRoutes['comfort'] = rComfort;

        const icons = { fastest: '⚡', fewest: '🔄', comfort: '🛋️' };
        ['fastest', 'fewest', 'comfort'].forEach(mode => {
            const r = cachedRoutes[mode];
            const tEl = document.getElementById(`strat-title-${mode}`);
            const sEl = document.getElementById(`strat-sub-${mode}`);
            if (tEl) tEl.innerText = `${icons[mode]} ${r.viaLabel}`;
            if (sEl) sEl.innerText = `${r.totalMin}分 • ${r.transfers}轉乘`;
        });

        selectStrategy(currentStrategy);
    }

    function selectStrategy(mode) {
        currentStrategy = mode;
        document.querySelectorAll('.strategy-card').forEach(c => c.classList.toggle('active', c.dataset.mode === mode));
        const res = cachedRoutes[mode] || runStateDijkstra(originSta, destSta, mode);
        renderRouteOnMapAndSheet(res);
    }

    function toggleSegStations(idx) {
        const el = document.getElementById(`seg-stops-${idx}`);
        if (el) el.classList.toggle('hidden');
    }

    function toggleExtraDrawer() {
        const el = document.getElementById('extra-fare-consist-box');
        if (el) el.classList.toggle('hidden');
    }

    async function renderRouteOnMapAndSheet(res) {
        if (!res || res.path.length <= 1) return;

        // 1. Highlight on Map
        if (linesLayer) linesLayer.getLayers().forEach(l => l.setStyle({ opacity: 0.15 }));
        Object.keys(MtrData.stations).forEach(id => {
            const m = document.getElementById(`marker-${id}`);
            const l = document.getElementById(`label-${id}`);
            const maj = MAJOR_STATIONS.includes(id);
            if (m) m.className = `mtr-station-marker ${maj?'interchange-node':''} ${!res.path.includes(id)?'dimmed':''}`;
            if (l) l.className = `station-label ${maj?'major-station-label':'minor-station-label'} ${!res.path.includes(id)?'dimmed':''}`;
        });
        if (document.getElementById(`marker-${originSta}`)) document.getElementById(`marker-${originSta}`).classList.add('selected-origin');
        if (document.getElementById(`marker-${destSta}`)) document.getElementById(`marker-${destSta}`).classList.add('selected-dest');

        if (highlightLayer) {
            highlightLayer.clearLayers();
            let curL = null, coords = [];
            const drawGlow = (pts, col) => {
                L.polyline(pts, { color: col, weight: 10, opacity: 0.3, lineJoin: 'round' }).addTo(highlightLayer);
                L.polyline(pts, { color: col, weight: 5, opacity: 1, lineJoin: 'round' }).addTo(highlightLayer);
                L.polyline(pts, { color: '#fff', weight: 2, opacity: 0.85, lineJoin: 'round', className: 'route-flow-dash' }).addTo(highlightLayer);
            };
            res.edges.forEach((e, i) => {
                const pU = [MtrData.stations[res.path[i]].lat, MtrData.stations[res.path[i]].lon];
                const pV = [MtrData.stations[res.path[i + 1]].lat, MtrData.stations[res.path[i + 1]].lon];
                if (curL !== e.lineId) {
                    if (coords.length > 0) drawGlow(coords, res.edges[i - 1].lineColor);
                    coords = [pU, pV]; curL = e.lineId;
                } else coords.push(pV);
            });
            if (coords.length > 0) drawGlow(coords, res.edges[res.edges.length - 1].lineColor);

            if (map) {
                map.flyToBounds(res.path.map(id => [MtrData.stations[id].lat, MtrData.stations[id].lon]), {
                    paddingTopLeft: [24, 135],
                    paddingBottomRight: [24, window.innerHeight * 0.44],
                    maxZoom: 14.5,
                    duration: 0.6
                });
            }
        }

        // 2. First-Glance 3-Metric Hero Strip
        const rawF = getRawFare(originSta, destSta);
        const oct = Number(rawF.oct);
        const sng = Number(rawF.sng || oct);
        const con = Math.max(1.5, Math.round((oct / 2) * 10) / 10);
        const isBound = ['LOW','LMC','AIR','AWE'].includes(originSta) || ['LOW','LMC','AIR','AWE'].includes(destSta);
        const joy = isBound ? con : Math.min(oct, 2.0);
        const arrClock = formatHHMM(new Date(Date.now() + res.totalMin * 60000));

        const bmBtn = document.getElementById('btn-bookmark-route');
        if (bmBtn) bmBtn.setAttribute('onclick', `AuraDashboard.addCommuteBookmark('${originSta}','${destSta}')`);

        document.getElementById('cockpit-hero-metrics').innerHTML = `
            <div class="metric-box">
                <div class="metric-label">⏱️ 預計車程 (${arrClock} 到)</div>
                <div class="metric-val">${res.totalMin} 分鐘 <span style="font-size:0.72rem;color:var(--aura-cyan);">${res.transfers}轉乘</span></div>
            </div>
            <div class="metric-box">
                <div class="metric-label">💳 成人八達通</div>
                <div class="metric-val" style="color:#10B981;">$${oct.toFixed(1)}</div>
            </div>
            <div class="metric-box">
                <div class="metric-label">🟢 起點下班車</div>
                <div class="metric-val" id="cockpit-live-origin-eta" style="color:#34D399;">同步中</div>
            </div>
        `;

        // 3. Collapsible Extra Drawer (Other Fares + Recommended Train Car)
        const firstRailEdge = res.edges.find(e => e.lineId !== 'WALK') || res.edges[0];
        const firstLineBase = firstRailEdge.lineId.split('_')[0];
        const totalCars = firstLineBase === 'EAL' ? 9 : (firstLineBase === 'SIL' ? 3 : (firstLineBase === 'DRL' ? 4 : 8));
        let bestCars = res.firstTransferInfo ? res.firstTransferInfo.cars : [4, 5];
        bestCars = bestCars.filter(c => c <= totalCars);
        if (bestCars.length === 0) bestCars = [Math.ceil(totalCars / 2)];

        const carsHtml = Array.from({ length: totalCars }, (_, i) => i + 1).map(c => {
            const isBest = bestCars.includes(c);
            return `<div style="flex:1;height:22px;border-radius:5px;background:${isBest?'#10B981':'var(--chip-inactive-bg)'};color:${isBest?'#fff':'var(--text-sub)'};font-size:0.65rem;font-weight:800;display:flex;align-items:center;justify-content:center;">${isBest?'★':''}${c}卡</div>`;
        }).join('');

        document.getElementById('cockpit-extra-drawer').innerHTML = `
            <div onclick="AuraCockpit.toggleExtraDrawer()" style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;margin-top:6px;background:var(--chip-inactive-bg);border-radius:10px;font-size:0.74rem;font-weight:800;color:var(--text-sub);cursor:pointer;">
                <span>🚆 建議登車：第 <b style="color:#34D399;">${bestCars.join(', ')}</b> 卡 • 單程 $${sng.toFixed(1)} / 小童 $${con.toFixed(1)} / 樂悠 $${joy.toFixed(1)}</span>
                <span style="color:var(--aura-cyan);">車廂圖 ▾</span>
            </div>
            <div id="extra-fare-consist-box" class="hidden" style="margin-top:6px;padding:8px 10px;background:rgba(59,130,246,0.08);border:1px solid rgba(59,130,246,0.25);border-radius:12px;">
                <div style="font-size:0.68rem;color:var(--aura-cyan);font-weight:800;margin-bottom:5px;">${firstRailEdge.lineName} (${totalCars}卡列車) • ★綠卡對準轉乘扶手梯</div>
                <div style="display:flex;gap:4px;">${carsHtml}</div>
            </div>
        `;

        // 4. Clean Step-by-Step Timeline
        const segs = [];
        let cl = res.edges[0].lineId, cc = res.edges[0].lineColor, cn = res.edges[0].lineName, stas = [res.path[0]];
        res.edges.forEach((e, i) => {
            if (e.lineId === cl) stas.push(res.path[i + 1]);
            else {
                segs.push({ lineId: cl, color: cc, name: cn, stas });
                cl = e.lineId; cc = e.lineColor; cn = e.lineName;
                stas = [res.path[i], res.path[i + 1]];
            }
        });
        segs.push({ lineId: cl, color: cc, name: cn, stas });

        let tlHtml = '';
        segs.forEach((seg, idx) => {
            const s0 = seg.stas[0], sEnd = seg.stas[seg.stas.length - 1];
            const midStas = seg.stas.slice(1, -1);
            if (idx > 0 && seg.lineId !== 'WALK') {
                const prevL = segs[idx - 1].lineId === 'WALK' && idx >= 2 ? segs[idx - 2].lineId : segs[idx - 1].lineId;
                const ti = getTransferInfo(s0, prevL, seg.lineId);
                tlHtml += `<div style="margin:6px 0 8px 14px;padding:7px 11px;border-radius:10px;background:rgba(56,189,248,0.10);border-left:3px solid var(--aura-cyan);font-size:0.76rem;display:flex;justify-content:space-between;align-items:center;">
                    <span><b>🔄 於 ${MtrData.stations[s0].name} 轉乘 ${seg.name}</b></span>
                    <span style="color:var(--aura-cyan);font-weight:800;">${ti.cross?'⚡ 對面月台':'步程約 '+ti.walk+' 分'}</span>
                </div>`;
            }
            const expandBtn = midStas.length > 0
                ? `<span style="color:var(--aura-cyan);cursor:pointer;margin-left:8px;font-weight:800;" onclick="AuraCockpit.toggleSegStations(${idx})">途經 ${midStas.length} 站 ▾</span>`
                : `<span style="color:var(--text-sub);margin-left:8px;">直達下站</span>`;
            const midListHtml = midStas.length > 0
                ? `<div id="seg-stops-${idx}" class="hidden" style="margin-top:5px;padding:6px 10px;background:var(--chip-inactive-bg);border-radius:8px;font-size:0.74rem;color:var(--text-sub);display:flex;flex-wrap:wrap;gap:6px;">
                    ${midStas.map(id => `<span>• ${MtrData.stations[id].name}</span>`).join('')}
                   </div>`
                : '';

            tlHtml += `<div style="display:flex;gap:10px;align-items:center;margin-bottom:6px;">
                <div style="width:5px;height:36px;border-radius:3px;background:${seg.color};flex-shrink:0;"></div>
                <div style="flex:1;">
                    <div style="display:flex;justify-content:space-between;align-items:center;">
                        <span style="font-weight:900;font-size:0.96rem;">${MtrData.stations[s0].name} ➔ ${MtrData.stations[sEnd].name}</span>
                        <span style="font-size:0.73rem;"><span style="background:${seg.color};color:#fff;padding:2px 6px;border-radius:5px;font-weight:800;">${seg.name}</span>${expandBtn}</span>
                    </div>
                    ${midListHtml}
                </div>
            </div>`;
        });

        document.getElementById('cockpit-timeline-list').innerHTML = tlHtml;
        setSheetSnap('normal');
        document.getElementById('cockpit-route-sheet').classList.add('open');

        // 5. Live Origin Countdown
        if (firstRailEdge && firstRailEdge.lineId !== 'WALK') {
            const etaRes = await fetchLiveMtrEta(firstRailEdge.lineId, originSta);
            const sched = etaRes ? etaRes.schedule : null;
            const now = (etaRes && etaRes.sysTime) ? new Date(etaRes.sysTime.replace(/-/g, '/')) : new Date();
            const allT = [...((sched && sched.UP) || []), ...((sched && sched.DOWN) || [])]
                .map(t => ({ ...t, dateObj: new Date(t.time.replace(/-/g, '/')) }))
                .sort((a, b) => a.dateObj - b.dateObj);
            const liveSub = document.getElementById('cockpit-live-origin-eta');
            if (liveSub && allT.length > 0) {
                const waitM = calcEtaMin(allT[0], now);
                liveSub.innerHTML = waitM === 0 ? '即將到站' : `${waitM} min`;
            }
        }
    }

    function setExternal(staId, role) {
        AuraNav.switchTab(1);
        setTimeout(() => {
            if (role === 'origin') originSta = staId;
            else destSta = staId;
            updateCapsuleUI();
            computeAllStrategies();
        }, 140);
    }

    function launchRoute(from, to) {
        originSta = from; destSta = to;
        AuraNav.switchTab(1);
        setTimeout(() => {
            updateCapsuleUI();
            computeAllStrategies();
        }, 140);
    }

    return {
        init, syncMapTiles, invalidateMap: () => map && map.invalidateSize(),
        zoomIn: () => map && map.zoomIn(0.8), zoomOut: () => map && map.zoomOut(0.8),
        resetMap: () => map && map.flyTo([22.34, 114.17], 12, { duration: 0.5 }),
        toggleLabels: () => {
            showAllLabels = !showAllLabels;
            const mc = document.getElementById('aura-map-canvas');
            if (mc) mc.classList.toggle('hide-minor-labels', !showAllLabels);
            AuraToast.show(showAllLabels ? '🏷️ 已顯示全部站名' : '🏷️ 已切換為重點站名');
        },
        focusSlot, swapStations, selectStrategy, onStationPicked, getRawFare,
        setExternal, launchRoute, setSheetSnap, cycleSheetSnap, clearRoute, toggleSegStations, toggleExtraDrawer
    };
})();

// 5. Station Picker Modal
const AuraPicker = {
    mode: 'origin',
    lineFilter: 'ALL',
    open(mode) {
        this.mode = mode;
        this.lineFilter = 'ALL';
        const titles = { origin: '↗ 選擇起點車站', dest: '↘ 選擇終點車站', pin: '📺 新增看板車站' };
        document.getElementById('matrix-picker-title').innerText = titles[mode] || '選擇車站';
        document.getElementById('matrix-picker-input').value = '';
        document.getElementById('matrix-picker-modal').classList.remove('hidden');
        this.renderLines();
        this.renderStations('');
    },
    close() {
        document.getElementById('matrix-picker-modal').classList.add('hidden');
    },
    renderLines() {
        const bar = document.getElementById('matrix-picker-lines');
        const vis = MtrData.lines.filter(l => !l.isBranch);
        let h = `<span onclick="AuraPicker.setLine('ALL')" style="padding:5px 11px;border-radius:12px;font-size:0.74rem;font-weight:800;cursor:pointer;white-space:nowrap;background:${this.lineFilter==='ALL'?'var(--aura-blue)':'var(--chip-inactive-bg)'};color:${this.lineFilter==='ALL'?'#fff':'var(--text-main)'};">全部</span>`;
        h += vis.map(l => `<span onclick="AuraPicker.setLine('${l.id}')" style="padding:5px 11px;border-radius:12px;font-size:0.74rem;font-weight:800;cursor:pointer;white-space:nowrap;background:${l.color};opacity:${this.lineFilter===l.id?1:0.45};color:#fff;">${l.name}</span>`).join('');
        bar.innerHTML = h;
    },
    setLine(lid) {
        this.lineFilter = lid;
        this.renderLines();
        this.renderStations(document.getElementById('matrix-picker-input').value);
    },
    renderStations(q) {
        const query = (q || '').trim().toLowerCase();
        let codes = Object.keys(MtrData.stations);
        if (this.lineFilter !== 'ALL') {
            const l = MtrData.lines.find(x => x.id === this.lineFilter);
            codes = l ? (l.searchPath || l.path) : codes;
        }
        if (query) {
            codes = codes.filter(c => c.toLowerCase().includes(query) || MtrData.stations[c].name.includes(query) || (MtrData.stations[c].en || '').toLowerCase().includes(query));
        }
        document.getElementById('matrix-picker-grid').innerHTML = codes.map(c => {
            const s = MtrData.stations[c];
            const ls = getStationLines(c);
            const col = ls[0] ? ls[0].color : '#3B82F6';
            return `<div onclick="AuraPicker.pick('${c}')" style="background:var(--bento-bg);border:1px solid var(--glass-border);border-left:4px solid ${col};border-radius:10px;padding:9px;cursor:pointer;">
                <div style="font-weight:900;font-size:0.92rem;">${s.name}</div>
                <div style="font-size:0.65rem;color:var(--text-sub);margin-top:1px;">${s.en || ''}</div>
            </div>`;
        }).join('');
    },
    pick(staId) {
        this.close();
        if (this.mode === 'pin') {
            AuraDashboard.addStationMonitor(staId);
        } else {
            AuraCockpit.focusSlot(this.mode);
            AuraCockpit.onStationPicked(staId);
        }
    }
};

// 6. Tab 2: Station Hologram Hub (Clean Grid + Centered Spatial Card Modal)
const AuraHub = {
    lineFilter: 'ALL',
    query: '',
    currentSta: 'CEN',
    currentModalTab: 'pids',

    init() {
        this.renderLinePills();
        this.renderGrid();
    },
    renderLinePills() {
        const vis = MtrData.lines.filter(l => !l.isBranch);
        let h = `<span onclick="AuraHub.setLine('ALL')" style="padding:5px 12px;border-radius:14px;font-size:0.75rem;font-weight:800;cursor:pointer;white-space:nowrap;background:${this.lineFilter==='ALL'?'var(--aura-blue)':'var(--bento-bg)'};color:${this.lineFilter==='ALL'?'#fff':'var(--text-main)'};border:1px solid var(--glass-border);">全部車站</span>`;
        h += vis.map(l => `<span onclick="AuraHub.setLine('${l.id}')" style="padding:5px 12px;border-radius:14px;font-size:0.75rem;font-weight:800;cursor:pointer;white-space:nowrap;background:${l.color};opacity:${this.lineFilter===l.id?1:0.5};color:#fff;">${l.name}</span>`).join('');
        document.getElementById('hub-line-pills').innerHTML = h;
    },
    setLine(lid) {
        this.lineFilter = lid;
        this.renderLinePills();
        this.renderGrid();
    },
    onSearch(val) {
        this.query = (val || '').trim().toLowerCase();
        this.renderGrid();
    },
    renderGrid() {
        let codes = Object.keys(MtrData.stations);
        if (this.lineFilter !== 'ALL') {
            const l = MtrData.lines.find(x => x.id === this.lineFilter);
            codes = l ? (l.searchPath || l.path) : codes;
        }
        if (this.query) {
            codes = codes.filter(c => c.toLowerCase().includes(this.query) || MtrData.stations[c].name.includes(this.query) || (MtrData.stations[c].en || '').toLowerCase().includes(this.query));
        }
        document.getElementById('hub-bento-grid').innerHTML = codes.map(c => {
            const s = MtrData.stations[c];
            const ls = getStationLines(c);
            const tags = ls.map(l => `<span class="hub-line-tag" style="background:${l.color};">${l.name.replace('綫','')}</span>`).join('');
            return `<div class="hub-station-card" onclick="AuraHub.openHologram('${c}','pids')">
                <div>
                    <div class="hub-sta-zh">${s.name}</div>
                    <div class="hub-sta-en">${s.en || ''}</div>
                </div>
                <div class="hub-line-dots">${tags}</div>
            </div>`;
        }).join('');
    },
    async openHologram(staId, tab) {
        this.currentSta = staId;
        this.currentModalTab = tab || 'pids';
        const s = MtrData.stations[staId];
        const ls = getStationLines(staId);
        const primaryColor = ls[0] ? ls[0].color : '#0EA5E9';
        const modal = document.getElementById('hologram-modal');
        const sheet = document.getElementById('hologram-sheet-content');
        modal.classList.remove('hidden');

        const lineBadges = ls.map(l => `<span style="background:${l.color};color:#fff;font-size:0.68rem;font-weight:800;padding:2px 8px;border-radius:6px;">${l.name}</span>`).join('');

        const headerHtml = `
            <div style="background:linear-gradient(135deg, ${primaryColor}33, rgba(15,23,42,0.4));border:1px solid ${primaryColor}55;border-radius:18px;padding:12px 14px;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                        <div style="font-size:1.35rem;font-weight:900;">${s.name} <span style="font-size:0.82rem;color:var(--text-sub);font-weight:600;">${s.en}</span></div>
                        <div style="display:flex;gap:5px;margin-top:6px;flex-wrap:wrap;">${lineBadges}</div>
                    </div>
                    <button class="pids-icon-btn" onclick="AuraHub.closeHologram()">✕</button>
                </div>
                <div style="display:flex;gap:12px;margin-top:10px;padding-top:8px;border-top:1px solid var(--glass-border);font-size:0.74rem;color:var(--text-sub);">
                    <span>🌅 首車 <b>${s.first || '06:00'}</b></span>
                    <span>🌙 尾車 <b>${s.last || '00:50'}</b></span>
                    <span>${s.toilet ? '🚻 設洗手間' : '🚻 商場洗手間'}</span>
                </div>
            </div>
            <div style="display:flex;gap:6px;">
                <button class="pids-icon-btn" style="flex:1;background:rgba(14,165,233,0.18);color:var(--aura-cyan);border-color:rgba(14,165,233,0.4);" onclick="AuraHub.closeHologram();AuraDashboard.addStationMonitor('${staId}')">📺 釘選看板</button>
                <button class="pids-icon-btn" style="flex:1;" onclick="AuraHub.closeHologram();AuraCockpit.setExternal('${staId}','origin')">↗ 設為起點</button>
                <button class="pids-icon-btn" style="flex:1;" onclick="AuraHub.closeHologram();AuraCockpit.setExternal('${staId}','dest')">↘ 設為終點</button>
            </div>
            <div class="holo-tab-bar">
                <div class="holo-tab-btn ${this.currentModalTab==='pids'?'active':''}" onclick="AuraHub.openHologram('${staId}','pids')">📺 實時班次</div>
                <div class="holo-tab-btn ${this.currentModalTab==='exits'?'active':''}" onclick="AuraHub.openHologram('${staId}','exits')">🚪 出口地標</div>
                <div class="holo-tab-btn ${this.currentModalTab==='fares'?'active':''}" onclick="AuraHub.openHologram('${staId}','fares')">💳 車資速查</div>
            </div>
        `;

        if (this.currentModalTab === 'exits') {
            const exitsHtml = (s.exits || ['A: 主要出入口', 'B: 公共運輸交匯處']).map(e => {
                const p = e.split(':');
                return `<div style="padding:10px 12px;border-bottom:1px solid var(--glass-border);font-size:0.84rem;display:flex;gap:10px;align-items:center;">
                    <span style="background:${primaryColor};color:#fff;font-weight:900;padding:2px 8px;border-radius:6px;font-size:0.75rem;">${p[0]}</span>
                    <span style="font-weight:700;">${p.slice(1).join(':')}</span>
                </div>`;
            }).join('');

            sheet.innerHTML = headerHtml + `
                <div style="flex:1;overflow-y:auto;">
                    <div style="background:var(--bento-bg);border-radius:14px;border:1px solid var(--glass-border);overflow:hidden;">${exitsHtml}</div>
                </div>
            `;
            return;
        }

        if (this.currentModalTab === 'fares') {
            const hubs = ['CEN', 'ADM', 'CAB', 'TST', 'MOK', 'KOT', 'TAW', 'FAN', 'TUM', 'LOW'].filter(h => h !== staId);
            const rows = hubs.map(h => {
                const rf = AuraCockpit.getRawFare(staId, h);
                const oct = Number(rf.oct);
                const sng = Number(rf.sng || oct);
                return `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 12px;border-bottom:1px solid var(--glass-border);cursor:pointer;" onclick="AuraHub.closeHologram();AuraCockpit.launchRoute('${staId}','${h}')">
                    <span style="font-weight:800;font-size:0.9rem;">往 ${MtrData.stations[h].name} <span style="font-size:0.72rem;color:var(--text-sub);">(單程 $${sng.toFixed(1)})</span></span>
                    <span style="font-size:1.02rem;font-weight:900;color:#10B981;">$${oct.toFixed(1)} ➔</span>
                </div>`;
            }).join('');

            sheet.innerHTML = headerHtml + `
                <div style="flex:1;overflow-y:auto;">
                    <div style="background:var(--bento-bg);border-radius:14px;border:1px solid var(--glass-border);overflow:hidden;">${rows}</div>
                </div>
            `;
            return;
        }

        // Default Tab: Clean Live PIDS
        sheet.innerHTML = headerHtml + `<div id="holo-pids-body" style="flex:1;overflow-y:auto;"><div style="padding:20px;text-align:center;color:var(--text-sub);">正在同步月台班次...</div></div>`;
        let pidsHtml = '';
        for (const l of ls) {
            const res = await fetchLiveMtrEta(l.id, staId);
            const sched = res ? res.schedule : null;
            const now = (res && res.sysTime) ? new Date(res.sysTime.replace(/-/g, '/')) : new Date();

            const renderDirRows = (dirKey, label) => {
                if (isTerminusForDir(l.id, staId, dirKey)) {
                    return `<div style="padding:8px 12px;font-size:0.78rem;color:var(--text-sub);">${label}：終點落客月台</div>`;
                }
                const list = ((sched && sched[dirKey]) || [])
                    .map(t => ({ ...t, dateObj: new Date(t.time.replace(/-/g, '/')) }))
                    .sort((a, b) => a.dateObj - b.dateObj)
                    .slice(0, 2);
                if (list.length === 0) return '';
                return list.map(t => {
                    const m = calcEtaMin(t, now);
                    const dName = MtrData.stations[t.dest] ? MtrData.stations[t.dest].name : t.dest;
                    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 12px;border-top:1px solid rgba(255,255,255,0.06);font-size:0.86rem;">
                        <span><b>往 ${dName}</b> <span style="font-size:0.72rem;color:#94A3B8;margin-left:6px;">${t.plat}號月台</span></span>
                        <span style="font-weight:900;color:#34D399;font-size:0.95rem;">${m === 0 ? '即將到站' : m + ' min'}</span>
                    </div>`;
                }).join('');
            };

            pidsHtml += `<div style="background:var(--pids-pane);color:#F8FAFC;border-radius:14px;overflow:hidden;margin-bottom:8px;border:1px solid var(--glass-border);">
                <div style="background:${l.color};padding:6px 12px;font-size:0.78rem;font-weight:900;color:#fff;display:flex;justify-content:space-between;">
                    <span>${l.name}</span>
                    <span>LIVE</span>
                </div>
                ${renderDirRows('UP', '上行')}
                ${renderDirRows('DOWN', '下行')}
            </div>`;
        }
        const bodyEl = document.getElementById('holo-pids-body');
        if (bodyEl) bodyEl.innerHTML = pidsHtml;
    },
    closeHologram() {
        document.getElementById('hologram-modal').classList.add('hidden');
    }
};

// 7. Tab 3: Network Pulse
const AuraPulse = {
    drillMode: false,
    lines: [
        { id: 'TWL', name: '荃灣綫', color: '#e2231a' },
        { id: 'KTL', name: '觀塘綫', color: '#00af41' },
        { id: 'ISL', name: '港島綫', color: '#0071ce' },
        { id: 'TKO', name: '將軍澳綫', color: '#8d3685' },
        { id: 'EAL', name: '東鐵綫', color: '#53b7e8' },
        { id: 'TML', name: '屯馬綫', color: '#9a3820' },
        { id: 'TCL', name: '東涌綫', color: '#f38b00' },
        { id: 'AEL', name: '機場快綫', color: '#00838f' },
        { id: 'DRL', name: '迪士尼綫', color: '#f550a1' },
        { id: 'SIL', name: '南港島綫', color: '#b6bd00' }
    ],
    init() {
        this.refresh(false);
    },
    toggleDrill() {
        this.drillMode = !this.drillMode;
        const btn = document.getElementById('btn-drill-toggle');
        if (btn) btn.innerText = this.drillMode ? '✅ 結束演練' : '🚨 事故演練';
        this.refresh(false);
        AuraToast.show(this.drillMode ? '🚨 已開啟事故應變演練' : '✅ 已恢復全網正常狀態');
    },
    async refresh(showFeedback) {
        if (showFeedback) AuraToast.show('↻ 正在同步全網車務...');
        let temp = 26;
        try {
            const r = await fetchWithTimeout('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc', { timeout: 2800 });
            if (r.ok) {
                const j = await r.json();
                if (j.temperature && j.temperature.data && j.temperature.data[0]) temp = j.temperature.data[0].value;
            }
        } catch (e) {}

        const tEl = document.getElementById('pulse-temp-val');
        const dEl = document.getElementById('pulse-weather-desc');
        const pill = document.getElementById('dynamic-island-pill');
        const pillTxt = document.getElementById('island-status-text');

        if (tEl) tEl.innerText = `${temp}°C`;
        if (this.drillMode) {
            if (dEl) dEl.innerHTML = '<span style="color:#F43F5E;font-weight:800;">⚠️ 演練：觀塘綫/東鐵綫延誤</span>';
            if (pill) pill.classList.add('alert');
            if (pillTxt) pillTxt.innerText = `⚠️ 事故演習 • ${temp}°C`;
        } else {
            if (dEl) dEl.innerText = '全網鐵路及露天段正常';
            if (pill) pill.classList.remove('alert');
            if (pillTxt) pillTxt.innerText = `全網正常 • ${temp}°C`;
        }

        const grid = document.getElementById('pulse-lines-grid');
        if (!grid) return;
        grid.innerHTML = this.lines.map(l => {
            const det = LINE_DETAILS[l.id] || {};
            const isDel = this.drillMode && (l.id === 'KTL' || l.id === 'EAL');
            return `<div class="pulse-line-bento ${isDel?'delayed':''}" style="border-left:4px solid ${l.color};" onclick="this.querySelector('.alt-box').classList.toggle('hidden')">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:900;font-size:0.98rem;">${l.name}</span>
                    <span style="font-size:0.74rem;font-weight:800;color:${isDel?'#F43F5E':'#10B981'};">${isDel?'⚠️ 延誤':'● 正常'}</span>
                </div>
                <div style="font-size:0.72rem;color:var(--text-sub);margin-top:3px;">繁忙每 ${det.peak || '2.5 分鐘'}一班</div>
                <div class="alt-box ${isDel?'':'hidden'}" style="margin-top:7px;padding-top:7px;border-top:1px solid var(--glass-border);font-size:0.72rem;color:var(--aura-cyan);line-height:1.4;">
                    <b>🚌 替代巴士：</b>${det.altTransport}
                </div>
            </div>`;
        }).join('');
    }
};

document.addEventListener('DOMContentLoaded', () => {
    AuraTheme.init();
    AuraDashboard.init();
    AuraCockpit.init();
    AuraHub.init();
    AuraPulse.init();
    setTimeout(() => {
        AuraCockpit.launchRoute('KOB', 'FAN');
        AuraNav.switchTab(0);
    }, 220);
});

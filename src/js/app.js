// =========================================================
// MTR AURA OS 3.0 PRO - Spatial Transit & Dual-PIDS Engine
// =========================================================

const AuraToast = {
    timer: null,
    show(msg) {
        const el = document.getElementById('aura-toast');
        if (!el) return;
        el.innerText = msg;
        el.classList.add('show');
        clearTimeout(this.timer);
        this.timer = setTimeout(() => el.classList.remove('show'), 2400);
    }
};

async function fetchWithTimeout(resource, options = {}) {
    const { timeout = 3800 } = options;
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

// 精準判斷該站是否為某路綫該方向的落客終點站
function isTerminusForDir(lineId, staId, dirKey) {
    const baseLine = lineId.split('_')[0];
    const upTermini = {
        'TWL': ['TSW'],
        'KTL': ['TIK'],
        'ISL': ['CHW'],
        'TKO': ['POA', 'LHP'],
        'EAL': ['LOW', 'LMC'],
        'TML': ['WUM'],
        'TCL': ['TUC'],
        'AEL': ['AWE'],
        'DRL': ['DIS'],
        'SIL': ['SOH']
    };
    const downTermini = {
        'TWL': ['CEN'],
        'KTL': ['WHA'],
        'ISL': ['KET'],
        'TKO': ['NOP'],
        'EAL': ['ADM'],
        'TML': ['TUM'],
        'TCL': ['HOK'],
        'AEL': ['HOK'],
        'DRL': ['SUN'],
        'SIL': ['ADM']
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
        return [0, 1, 2, 3].map(i => {
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
        const res = await fetchWithTimeout(`https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${apiLine}&sta=${apiSta}&lang=TC`, { timeout: 3500 });
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

// 1. Theme & Live Clock
const AuraTheme = {
    isLight: false,
    init() {
        try { this.isLight = localStorage.getItem('mtr_aura_theme') === 'light'; } catch (e) {}
        this.apply();
        const tick = () => {
            const now = new Date();
            const cl = document.getElementById('aura-live-clock');
            if (cl) cl.innerText = `HKT ${now.toTimeString().slice(0, 8)}`;
            const hr = now.getHours();
            const gr = document.getElementById('hero-greeting-text');
            if (gr) {
                gr.innerText = hr < 12 ? '🌅 早安香港 • 晨間極光通勤雷達' : (hr < 18 ? '☀️ 午安香港 • 城市極光空間領航' : '🌙 晚安香港 • 夜歸極速月台雷達');
            }
        };
        tick();
        setInterval(tick, 1000);
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

// 2. Spatial Navigation
const AuraNav = {
    currentTab: 0,
    switchTab(idx) {
        this.currentTab = idx;
        document.querySelectorAll('.aura-view').forEach((v, i) => v.classList.toggle('active', i === idx));
        document.querySelectorAll('.dock-item').forEach((d, i) => d.classList.toggle('active', i === idx));
        if (idx === 0) AuraDashboard.refreshAllBoards(false);
        if (idx === 1) {
            setTimeout(() => AuraCockpit.invalidateMap(), 100);
            setTimeout(() => AuraCockpit.invalidateMap(), 320);
        }
    }
};

// 3. Tab 0: Aurora Bento Dashboard (Dual-Platform PIDS Live Boards)
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
                { from: 'KOB', to: 'CEN', label: '💼 上班過海' },
                { from: 'ADM', to: 'TST', label: '🏠 維港通勤' },
                { from: 'TAW', to: 'MOK', label: '⚡ 新界出九龍' }
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
        AuraToast.show(`📺 已將 ${MtrData.stations[staId].name}站 加入雙向電視看板`);
    },

    switchCardLine(idx, newLineId) {
        if (this.monitored[idx]) {
            this.monitored[idx].lineId = newLineId;
            this.saveMonitored();
            this.refreshAllBoards(false);
        }
    },

    removeMonitor(idx) {
        const removed = this.monitored[idx];
        this.monitored.splice(idx, 1);
        this.saveMonitored();
        this.refreshAllBoards(false);
        if (removed && MtrData.stations[removed.staId]) {
            AuraToast.show(`已移除 ${MtrData.stations[removed.staId].name}站 看板`);
        }
    },

    addCommuteBookmark(from, to) {
        this.commutes = this.commutes.filter(c => !(c.from === from && c.to === to));
        this.commutes.unshift({ from, to, label: '⭐ 收藏通勤' });
        this.saveCommutes();
        this.renderCommutes();
        AuraToast.show(`⭐ 已收藏「${MtrData.stations[from].name} ➔ ${MtrData.stations[to].name}」至極光看板`);
    },

    removeCommute(idx, e) {
        if (e) e.stopPropagation();
        this.commutes.splice(idx, 1);
        this.saveCommutes();
        this.renderCommutes();
        AuraToast.show('已移除收藏路線');
    },

    renderCommutes() {
        const bar = document.getElementById('commute-pills-bar');
        if (!bar) return;
        if (this.commutes.length === 0) {
            bar.innerHTML = `<div style="font-size:0.76rem;color:var(--text-sub);">於「路線導航艙」規劃路線後可一鍵收藏至此</div>`;
            return;
        }
        bar.innerHTML = this.commutes.map((c, idx) => {
            const fName = MtrData.stations[c.from] ? MtrData.stations[c.from].name : c.from;
            const tName = MtrData.stations[c.to] ? MtrData.stations[c.to].name : c.to;
            const fareObj = AuraCockpit.getRawFare(c.from, c.to);
            const fareStr = fareObj ? `$${Number(fareObj.oct).toFixed(1)}` : '';
            return `<div class="commute-pill" onclick="AuraCockpit.launchRoute('${c.from}','${c.to}')">
                <div>
                    <div style="font-size:0.61rem;color:var(--aura-cyan);font-weight:800;">${c.label || '常用路線'}</div>
                    <div class="commute-pill-route">${fName} ➔ ${tName}</div>
                </div>
                <div class="commute-pill-meta">${fareStr}</div>
                <span class="commute-del-btn" title="移除" onclick="AuraDashboard.removeCommute(${idx}, event)">✕</span>
            </div>`;
        }).join('');
    },

    locateNearest() {
        const titleEl = document.getElementById('hero-nearest-sta');
        const metaEl = document.getElementById('hero-nearest-meta');
        if (titleEl) titleEl.innerText = '📡 正在掃描最近車站...';

        const applyNearest = (lat, lon, isSim) => {
            let best = 'MOK', minD = 1e9;
            Object.keys(MtrData.stations).forEach(code => {
                const s = MtrData.stations[code];
                const d = Math.hypot((s.lat - lat) * 111300, (s.lon - lon) * 102800);
                if (d < minD) { minD = d; best = code; }
            });
            const st = MtrData.stations[best];
            const distM = Math.max(45, Math.round(minD));
            const walkMin = Math.max(1, Math.round(distM / 75));
            const lines = getStationLines(best).map(l => l.name).join(' / ');
            if (titleEl) titleEl.innerHTML = `${st.name} <span style="font-size:0.86rem;color:var(--text-sub);font-weight:600;">${st.en} (${best})</span>`;
            if (metaEl) metaEl.innerHTML = `直線約 ${distM}m (步行約 ${walkMin} 分鐘) • ${lines} <span style="color:var(--aura-cyan);cursor:pointer;margin-left:6px;font-weight:800;" onclick="AuraCockpit.setExternal('${best}','origin')">[設為起點 ↗]</span> <span style="color:#34D399;cursor:pointer;margin-left:6px;font-weight:800;" onclick="AuraHub.openHologram('${best}')">[全息百科 🏢]</span>`;
            AuraToast.show(`📡 已定位最近港鐵站：${st.name}站`);
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                p => applyNearest(p.coords.latitude, p.coords.longitude, false),
                () => {
                    const hubs = [[22.3198,114.1694],[22.2815,114.1580],[22.2795,114.1840],[22.3236,114.2140],[22.3820,114.1870]];
                    const pick = hubs[this.simIdx++ % hubs.length];
                    applyNearest(pick[0], pick[1], true);
                },
                { timeout: 2200 }
            );
        } else {
            applyNearest(22.3198, 114.1694, true);
        }
    },

    async refreshAllBoards(showFeedback) {
        if (showFeedback) AuraToast.show('↻ 正在同步全網月台實時數據...');
        const container = document.getElementById('pids-board-container');
        if (!container) return;
        if (this.monitored.length === 0) {
            container.innerHTML = `<div style="text-align:center;padding:36px 20px;background:var(--bento-bg);border-radius:24px;border:1px dashed var(--glass-border);">
                <div style="font-size:2rem;margin-bottom:8px;">📺</div>
                <div style="font-weight:800;">尚未新增雙向月台電視看板</div>
                <button class="radar-btn" style="margin-top:12px;" onclick="AuraPicker.open('pin')">＋ 立即新增車站</button>
            </div>`;
            return;
        }

        container.innerHTML = this.monitored.map((m, idx) => {
            const sta = MtrData.stations[m.staId] || { name: m.staId, en: '' };
            const staLines = getStationLines(m.staId);
            const curLine = MtrData.lines.find(l => l.id === m.lineId) || staLines[0] || MtrData.lines[0];
            const dirs = MTR_DIRECTIONS[curLine.id] || { UP: '上行終點', DOWN: '下行終點' };

            const lineSwitcher = staLines.length > 1 ? staLines.map(l =>
                `<span onclick="AuraDashboard.switchCardLine(${idx},'${l.id}')" style="cursor:pointer;padding:3px 8px;border-radius:6px;font-size:0.68rem;font-weight:800;color:#fff;background:${l.color};opacity:${l.id===curLine.id?1:0.35};">${l.name.replace('綫','')}</span>`
            ).join('') : `<span class="pids-sta-badge" style="background:${curLine.color};">${curLine.name}</span>`;

            return `<div class="pids-station-card">
                <div class="pids-card-header">
                    <div class="pids-line-bar" style="background:${curLine.color};"></div>
                    <div class="pids-sta-title">
                        <div>
                            <div style="display:flex;align-items:center;gap:6px;">
                                <span class="pids-sta-name">${sta.name}</span>
                                <span class="pids-sta-en">${sta.en}</span>
                            </div>
                            <div style="display:flex;gap:4px;margin-top:4px;flex-wrap:wrap;">${lineSwitcher}</div>
                        </div>
                    </div>
                    <div class="pids-header-btns">
                        <button class="pids-icon-btn" onclick="AuraHub.openHologram('${m.staId}')">🏢 全息艙</button>
                        <button class="pids-icon-btn" onclick="AuraDashboard.removeMonitor(${idx})">✕</button>
                    </div>
                </div>

                <div class="pids-dual-grid">
                    <!-- UP Platform Pane -->
                    <div class="pids-dir-pane" id="pids-up-${idx}">
                        <div class="pids-dir-top">
                            <div>
                                <div class="pids-dir-tag">▲ 上行月台 UP</div>
                                <div class="pids-dest-main" id="dest-up-${idx}">往 ${dirs.UP}</div>
                            </div>
                            <div class="pids-plat-circle" id="plat-up-${idx}">1</div>
                        </div>
                        <div class="pids-eta-hero">
                            <div><span class="pids-eta-num" id="eta-up-${idx}">--</span><span class="pids-eta-unit" id="unit-up-${idx}">min</span></div>
                        </div>
                        <div class="pids-prog-track"><div class="pids-prog-fill" id="prog-up-${idx}" style="width:20%;"></div></div>
                        <div class="pids-next-list" id="next-up-${idx}">
                            <div class="pids-next-row"><span>同步訊號中...</span></div>
                        </div>
                    </div>

                    <!-- DOWN Platform Pane -->
                    <div class="pids-dir-pane" id="pids-down-${idx}">
                        <div class="pids-dir-top">
                            <div>
                                <div class="pids-dir-tag" style="color:#F472B6;">▼ 下行月台 DOWN</div>
                                <div class="pids-dest-main" id="dest-down-${idx}">往 ${dirs.DOWN}</div>
                            </div>
                            <div class="pids-plat-circle" style="border-color:#F472B6;color:#F472B6;" id="plat-down-${idx}">2</div>
                        </div>
                        <div class="pids-eta-hero">
                            <div><span class="pids-eta-num" id="eta-down-${idx}">--</span><span class="pids-eta-unit" id="unit-down-${idx}">min</span></div>
                        </div>
                        <div class="pids-prog-track"><div class="pids-prog-fill" id="prog-down-${idx}" style="width:20%;background:linear-gradient(90deg,#F472B6,#A855F7);"></div></div>
                        <div class="pids-next-list" id="next-down-${idx}">
                            <div class="pids-next-row"><span>同步訊號中...</span></div>
                        </div>
                    </div>
                </div>

                <div class="pids-card-footer">
                    <span style="color:var(--text-sub);">🕐 首末車：${sta.first || '06:00'} - ${sta.last || '00:50'}</span>
                    <div style="display:flex;gap:12px;">
                        <span style="color:var(--aura-cyan);font-weight:800;cursor:pointer;" onclick="AuraCockpit.setExternal('${m.staId}','origin')">↗ 設為起點</span>
                        <span style="color:#34D399;font-weight:800;cursor:pointer;" onclick="AuraCockpit.setExternal('${m.staId}','dest')">↘ 設為終點</span>
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
                const progEl = document.getElementById(`prog-${suffix}-${idx}`);
                const nextEl = document.getElementById(`next-${suffix}-${idx}`);
                if (!etaEl) return;

                if (isTerminusForDir(m.lineId, m.staId, dirKey)) {
                    etaEl.innerText = '🏁 落客終點';
                    etaEl.className = 'pids-eta-num terminus';
                    if (unitEl) unitEl.innerText = '';
                    if (progEl) progEl.style.width = '100%';
                    if (nextEl) nextEl.innerHTML = '<div class="pids-next-row"><span>此月台為終點落客專用</span></div>';
                    return;
                }

                const rawList = (sched && sched[dirKey]) ? sched[dirKey] : [];
                const trains = rawList.map(t => ({ ...t, dateObj: new Date(t.time.replace(/-/g, '/')) })).sort((a, b) => a.dateObj - b.dateObj);

                if (trains.length === 0) {
                    etaEl.innerText = '暫無班次';
                    etaEl.className = 'pids-eta-num terminus';
                    if (unitEl) unitEl.innerText = '';
                    if (nextEl) nextEl.innerHTML = '<div class="pids-next-row"><span>非行車時段或調整中</span></div>';
                    return;
                }

                const m0 = calcEtaMin(trains[0], now);
                const d0Name = MtrData.stations[trains[0].dest] ? MtrData.stations[trains[0].dest].name : trains[0].dest;
                if (destEl) destEl.innerText = `往 ${d0Name}${trains[0].route === 'RAC' ? '(經馬場)' : ''}`;
                if (platEl) platEl.innerText = trains[0].plat || (dirKey === 'UP' ? '1' : '2');

                if (m0 === 0) {
                    etaEl.innerText = '即將到站';
                    etaEl.className = 'pids-eta-num arriving';
                    if (unitEl) unitEl.innerText = '';
                    if (progEl) progEl.style.width = '100%';
                } else {
                    etaEl.innerText = m0;
                    etaEl.className = 'pids-eta-num';
                    if (unitEl) unitEl.innerText = 'min';
                    if (progEl) progEl.style.width = `${Math.max(15, Math.min(95, Math.round((1 - Math.min(m0, 10) / 10) * 100)))}%`;
                }

                let nextHtml = '';
                for (let i = 1; i < Math.min(3, trains.length); i++) {
                    const mi = calcEtaMin(trains[i], now);
                    const dName = MtrData.stations[trains[i].dest] ? MtrData.stations[trains[i].dest].name : trains[i].dest;
                    nextHtml += `<div class="pids-next-row"><span>往 ${dName} (${formatHHMM(trains[i].dateObj)})</span><b>${mi === 0 ? '即將到站' : mi + ' min'}</b></div>`;
                }
                if (nextEl) nextEl.innerHTML = nextHtml || '<div class="pids-next-row"><span>暫無後續班次</span></div>';
            };

            fillPane('UP', 'up');
            fillPane('DOWN', 'down');
        }
    }
};

// 4. Tab 1: Spatial Route Cockpit
const AuraCockpit = (function() {
    let map = null, tileLayer = null, linesLayer = null, highlightLayer = null, stationsLayer = null;
    let activeSlot = 'origin', originSta = 'KOB', destSta = 'CEN';
    let currentStrategy = 'fastest';
    let sheetSnap = 'normal'; // 'mini' | 'normal' | 'tall'
    let cachedRoutes = {};
    let faresDB = null;
    let timesDB = null;
    let showAllLabels = false;
    const graph = {};

    const HEADWAYS = { 'ISL':3,'TWL':3,'KTL':3,'TKO':4,'EAL':4,'TML':4,'TCL':5,'AEL':10,'DRL':10,'SIL':4,'DEFAULT':4 };

    function getTransferInfo(staId, fromL, toL) {
        const bf = fromL.split('_')[0], bt = toL.split('_')[0];
        const g = TRANSFER_GUIDE[staId];
        let walk = 2.5, cross = false, tip = '經車站大堂扶手電梯轉乘（建議車廂：第 4-6 卡）', cars = [4, 5, 6];
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
        const waitMax = HEADWAYS[toL] || 4;
        return { walk, waitMax, avg: walk + waitMax / 2, cross, tip, cars };
    }

    function buildNetworkGraph() {
        Object.keys(MtrData.stations).forEach(s => graph[s] = []);
        MtrData.lines.forEach(line => {
            for (let i = 0; i < line.path.length - 1; i++) {
                const u = line.path[i], v = line.path[i + 1];
                if (MtrData.stations[u] && MtrData.stations[v]) {
                    let wt = 2.1;
                    const au = getApiId(u), av = getApiId(v);
                    if (timesDB && timesDB[au] && timesDB[au][av]) wt = timesDB[au][av] / 60;
                    else if (timesDB && timesDB[av] && timesDB[av][au]) wt = timesDB[av][au] / 60;
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
        } else {
            try {
                const r = await fetch('./mtr_fares.json');
                if (r.ok) faresDB = await r.json();
            } catch (e) {}
        }
        try {
            const tr = await fetchWithTimeout('https://timeinterval.hkbuseta.com/times/all.json', { timeout: 3000 });
            if (tr.ok) timesDB = await tr.json();
        } catch (e) {}

        buildNetworkGraph();

        if (typeof L !== 'undefined') {
            map = L.map('aura-map-canvas', { zoomControl: false, minZoom: 11, maxZoom: 17.5, zoomSnap: 0 }).setView([22.32, 114.17], 12);
            syncMapTiles(AuraTheme.isLight);
            linesLayer = L.layerGroup().addTo(map);
            highlightLayer = L.layerGroup().addTo(map);
            stationsLayer = L.layerGroup().addTo(map);
            renderMapNodes();

            map.on('zoom', () => {
                const z = map.getZoom();
                const sc = Math.max(0.8, Math.min(2.3, 1 + (z - 12) * 0.15));
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
        if (navigator.vibrate) navigator.vibrate(30);
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
        if (oEl) oEl.innerText = originSta ? `${MtrData.stations[originSta].name} (${originSta})` : '選擇起點';
        if (dEl) dEl.innerText = destSta ? `${MtrData.stations[destSta].name} (${destSta})` : '選擇終點';
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
        if (map) map.flyTo([22.32, 114.17], 12, { duration: 0.6 });
    }

    function runDijkstra(start, end, mode) {
        const dist = {}, prev = {}, prevEdge = {}, pq = [];
        Object.keys(MtrData.stations).forEach(s => { dist[s] = 1e9; prev[s] = null; });
        dist[start] = 0;
        pq.push({ node: start, d: 0, lineId: null });

        while (pq.length > 0) {
            pq.sort((a, b) => a.d - b.d);
            const { node, d, lineId: curL } = pq.shift();
            if (node === end) break;
            if (d > dist[node]) continue;

            (graph[node] || []).forEach(nb => {
                let c = nb.weight;
                const bCur = curL ? curL.split('_')[0] : null;
                const bNext = nb.lineId.split('_')[0];
                if (bCur !== null && bCur !== bNext && nb.lineId !== 'WALK') {
                    const ti = getTransferInfo(node, curL, nb.lineId);
                    if (mode === 'fewest') c += ti.avg + 15;
                    else if (mode === 'comfort') c += ti.cross ? (ti.avg * 0.35) : (ti.avg + 7);
                    else c += ti.avg;
                }
                if (d + c < dist[nb.node]) {
                    dist[nb.node] = d + c;
                    prev[nb.node] = node;
                    prevEdge[nb.node] = nb;
                    pq.push({ node: nb.node, d: dist[nb.node], lineId: nb.lineId });
                }
            });
        }

        const path = [], edges = [];
        let curr = end;
        while (curr) {
            path.unshift(curr);
            if (prev[curr]) edges.unshift(prevEdge[curr]);
            curr = prev[curr];
        }

        let realMin = 2, transfers = 0, firstTransferInfo = null;
        for (let i = 0; i < edges.length; i++) {
            realMin += edges[i].weight;
            if (i < edges.length - 1) {
                const l1 = edges[i].lineId.split('_')[0];
                const l2 = edges[i + 1].lineId.split('_')[0];
                if (l1 !== l2 && l2 !== 'WALK') {
                    transfers++;
                    const ti = getTransferInfo(path[i + 1], edges[i].lineId, edges[i + 1].lineId);
                    realMin += (l1 === 'WALK' ? 2 : ti.avg);
                    if (!firstTransferInfo) firstTransferInfo = { staId: path[i + 1], ...ti };
                }
            }
        }
        return { path, edges, totalMin: Math.round(realMin), transfers, firstTransferInfo };
    }

    function getRawFare(fromSta, toSta) {
        if (!faresDB) return { oct: 12.5, sng: 14.0 };
        const af = getApiId(fromSta), at = getApiId(toSta);
        return faresDB[`${fromSta}-${toSta}`] || faresDB[`${toSta}-${fromSta}`] || faresDB[`${af}-${at}`] || faresDB[`${at}-${af}`] || { oct: 12.5, sng: 14.0 };
    }

    function computeAllStrategies() {
        if (!originSta || !destSta || originSta === destSta) return;
        ['fastest', 'fewest', 'comfort'].forEach(mode => {
            const res = runDijkstra(originSta, destSta, mode);
            cachedRoutes[mode] = res;
            const subEl = document.getElementById(`strat-sub-${mode}`);
            if (subEl) subEl.innerText = `${res.totalMin} 分 • ${res.transfers} 轉乘`;
        });
        selectStrategy(currentStrategy);
    }

    function selectStrategy(mode) {
        currentStrategy = mode;
        document.querySelectorAll('.strategy-card').forEach(c => c.classList.toggle('active', c.dataset.mode === mode));
        const res = cachedRoutes[mode] || runDijkstra(originSta, destSta, mode);
        renderRouteOnMapAndSheet(res);
    }

    function toggleSegStations(idx) {
        const el = document.getElementById(`seg-stops-${idx}`);
        if (el) el.classList.toggle('hidden');
    }

    async function renderRouteOnMapAndSheet(res) {
        if (!res || res.path.length <= 1) return;

        // 1. Highlight on Map
        if (linesLayer) linesLayer.getLayers().forEach(l => l.setStyle({ opacity: 0.14 }));
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
                L.polyline(pts, { color: col, weight: 11, opacity: 0.32, lineJoin: 'round' }).addTo(highlightLayer);
                L.polyline(pts, { color: col, weight: 5.5, opacity: 1, lineJoin: 'round' }).addTo(highlightLayer);
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
                    paddingTopLeft: [20, 150],
                    paddingBottomRight: [20, window.innerHeight * 0.48],
                    maxZoom: 15,
                    duration: 0.7
                });
            }
        }

        // 2. Populate Header & 4-Ticket Fare Matrix
        const rawF = getRawFare(originSta, destSta);
        const oct = Number(rawF.oct);
        const sng = Number(rawF.sng || oct);
        const con = Math.max(1.5, Math.round((oct / 2) * 10) / 10);
        const isBound = ['LOW','LMC','AIR','AWE'].includes(originSta) || ['LOW','LMC','AIR','AWE'].includes(destSta);
        const joy = isBound ? con : Math.min(oct, 2.0);
        const arrClock = formatHHMM(new Date(Date.now() + res.totalMin * 60000));

        document.getElementById('cockpit-sheet-header').innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;">
                <div>
                    <div style="font-size:1.38rem;font-weight:900;">全程約 ${res.totalMin} 分鐘 <span style="font-size:0.78rem;color:var(--aura-cyan);font-weight:800;">• 預計 ${arrClock} 抵達</span></div>
                    <div style="font-size:0.74rem;color:var(--text-sub);margin-top:2px;" id="cockpit-live-origin-eta">
                        途經 ${res.path.length - 1} 站 • 轉乘 ${res.transfers} 次 • 正在同步首班車倒數...
                    </div>
                </div>
                <button class="pids-icon-btn" style="color:var(--aura-cyan);border-color:var(--aura-cyan);" onclick="AuraDashboard.addCommuteBookmark('${originSta}','${destSta}')">⭐ 收藏</button>
            </div>
        `;

        document.getElementById('cockpit-fare-grid').innerHTML = `
            <div class="fare-cell highlight"><div class="fare-cell-label">成人八達通</div><div class="fare-cell-val">$${oct.toFixed(1)}</div></div>
            <div class="fare-cell"><div class="fare-cell-label">單程車票</div><div class="fare-cell-val">$${sng.toFixed(1)}</div></div>
            <div class="fare-cell"><div class="fare-cell-label">小童 / 學生</div><div class="fare-cell-val">$${con.toFixed(1)}</div></div>
            <div class="fare-cell"><div class="fare-cell-label">樂悠咭 $2</div><div class="fare-cell-val">$${joy.toFixed(1)}</div></div>
        `;

        // 3. Dynamic Car Consist Visualizer (3 / 4 / 8 / 9 Cars)
        const firstRailEdge = res.edges.find(e => e.lineId !== 'WALK') || res.edges[0];
        const firstLineBase = firstRailEdge.lineId.split('_')[0];
        const totalCars = firstLineBase === 'EAL' ? 9 : (firstLineBase === 'SIL' ? 3 : (firstLineBase === 'DRL' ? 4 : 8));
        let bestCars = res.firstTransferInfo ? res.firstTransferInfo.cars : [4, 5];
        bestCars = bestCars.filter(c => c <= totalCars);
        if (bestCars.length === 0) bestCars = [Math.ceil(totalCars / 2)];

        const targetStaName = res.firstTransferInfo ? MtrData.stations[res.firstTransferInfo.staId].name : MtrData.stations[destSta].name;
        const carNums = Array.from({ length: totalCars }, (_, i) => i + 1);
        const carsHtml = carNums.map(c => {
            const isBest = bestCars.includes(c);
            const isFirstClass = (firstLineBase === 'EAL' && c === 4);
            return `<div class="train-car-unit ${isBest?'best-car':''}">${isBest?'★':''}${c}卡${isFirstClass?'(頭等)':''}</div>`;
        }).join('');

        document.getElementById('cockpit-consist-container').innerHTML = `
            <div class="train-consist-box">
                <div class="train-consist-title">
                    <span>🚆 ${firstRailEdge.lineName} (${totalCars}卡編組) • 對準 ${targetStaName}站 轉乘梯/出口</span>
                    <span style="color:#34D399;">推薦第 ${bestCars.join(', ')} 卡</span>
                </div>
                <div class="train-cars-row">${carsHtml}</div>
            </div>
        `;

        // 4. Segment Timeline with Expandable Intermediate Stops
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
                tlHtml += `<div style="margin:6px 0 8px 14px;padding:8px 12px;border-radius:12px;background:rgba(14,165,233,0.12);border-left:3px solid var(--aura-cyan);font-size:0.75rem;">
                    <b>🔄 於 ${MtrData.stations[s0].name} 轉乘 ${seg.name}</b> (${ti.cross?'⚡ 同層對面月台直達':'步程約 '+ti.walk+' 分鐘'})<br>
                    <span style="color:var(--text-sub);">${ti.tip}</span>
                </div>`;
            }
            const expandBtn = midStas.length > 0
                ? `<span style="color:var(--aura-cyan);cursor:pointer;margin-left:8px;font-weight:700;" onclick="AuraCockpit.toggleSegStations(${idx})">▼ 展開途經 ${midStas.length} 站</span>`
                : '';
            const midListHtml = midStas.length > 0
                ? `<div id="seg-stops-${idx}" class="hidden" style="margin-top:6px;padding:6px 10px;background:var(--chip-inactive-bg);border-radius:10px;font-size:0.74rem;color:var(--text-sub);display:flex;flex-wrap:wrap;gap:6px;">
                    ${midStas.map(id => `<span>• ${MtrData.stations[id].name}</span>`).join('')}
                   </div>`
                : '';

            tlHtml += `<div style="display:flex;gap:12px;align-items:flex-start;margin-bottom:8px;">
                <div style="width:6px;min-height:46px;border-radius:3px;background:${seg.color};margin-top:4px;"></div>
                <div style="flex:1;">
                    <div style="font-weight:900;font-size:0.96rem;">${MtrData.stations[s0].name} ➔ ${MtrData.stations[sEnd].name}</div>
                    <div style="font-size:0.75rem;color:var(--text-sub);margin-top:2px;">
                        <span style="background:${seg.color};color:#fff;padding:1px 6px;border-radius:5px;font-weight:800;">${seg.name}</span> • 共 ${seg.stas.length - 1} 站 ${expandBtn}
                    </div>
                    ${midListHtml}
                </div>
            </div>`;
        });

        const destEx = (MtrData.stations[destSta].exits || [])[0] || '';
        if (destEx) {
            tlHtml += `<div style="margin-top:8px;padding:8px 12px;border-radius:12px;background:rgba(16,185,129,0.12);font-size:0.76rem;color:#34D399;font-weight:700;">
                🏁 抵達 ${MtrData.stations[destSta].name} • 焦點出口：${destEx}
            </div>`;
        }

        document.getElementById('cockpit-timeline-list').innerHTML = tlHtml;
        setSheetSnap('normal');
        document.getElementById('cockpit-route-sheet').classList.add('open');

        // 5. Fetch live origin train countdown
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
                liveSub.innerHTML = `途經 ${res.path.length - 1} 站 • 轉乘 ${res.transfers} 次 • <span style="color:#34D399;font-weight:800;">🟢 起點下一班車：${waitM === 0 ? '即將到站' : waitM + ' 分鐘後'} (月台 ${allT[0].plat || '1'})</span>`;
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
        }, 160);
    }

    function launchRoute(from, to) {
        originSta = from; destSta = to;
        AuraNav.switchTab(1);
        setTimeout(() => {
            updateCapsuleUI();
            computeAllStrategies();
        }, 160);
    }

    return {
        init, syncMapTiles, invalidateMap: () => map && map.invalidateSize(),
        zoomIn: () => map && map.zoomIn(0.8), zoomOut: () => map && map.zoomOut(0.8),
        resetMap: () => map && map.flyTo([22.32, 114.17], 12, { duration: 0.6 }),
        toggleLabels: () => {
            showAllLabels = !showAllLabels;
            const mc = document.getElementById('aura-map-canvas');
            if (mc) mc.classList.toggle('hide-minor-labels', !showAllLabels);
            AuraToast.show(showAllLabels ? '🏷️ 已顯示全網所有車站名稱' : '🏷️ 已切換為智能縮放站名');
        },
        focusSlot, swapStations, selectStrategy, onStationPicked, getRawFare,
        setExternal, launchRoute, setSheetSnap, cycleSheetSnap, clearRoute, toggleSegStations
    };
})();

// 5. Visual Line-Matrix Station Picker Modal
const AuraPicker = {
    mode: 'origin',
    lineFilter: 'ALL',
    open(mode) {
        this.mode = mode;
        this.lineFilter = 'ALL';
        const titles = { origin: '↗ 選擇起點車站', dest: '↘ 選擇終點車站', pin: '📺 新增雙向月台監測車站' };
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
        let h = `<span onclick="AuraPicker.setLine('ALL')" style="padding:5px 11px;border-radius:14px;font-size:0.74rem;font-weight:800;cursor:pointer;white-space:nowrap;background:${this.lineFilter==='ALL'?'var(--aura-blue)':'var(--chip-inactive-bg)'};color:${this.lineFilter==='ALL'?'#fff':'var(--text-main)'};border:1px solid var(--glass-border);">全部</span>`;
        h += vis.map(l => `<span onclick="AuraPicker.setLine('${l.id}')" style="padding:5px 11px;border-radius:14px;font-size:0.74rem;font-weight:800;cursor:pointer;white-space:nowrap;background:${l.color};opacity:${this.lineFilter===l.id?1:0.45};color:#fff;">${l.name}</span>`).join('');
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
            return `<div onclick="AuraPicker.pick('${c}')" style="background:var(--bento-bg);border:1px solid var(--glass-border);border-left:4px solid ${col};border-radius:12px;padding:10px;cursor:pointer;">
                <div style="font-weight:900;font-size:0.92rem;">${s.name}</div>
                <div style="font-size:0.65rem;color:var(--text-sub);margin-top:2px;">${c} • ${s.en || ''}</div>
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

// 6. Tab 2: Station Hologram Hub (2-Col Bento Grid + 3-Tab Hologram Modal)
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
        let h = `<span onclick="AuraHub.setLine('ALL')" style="padding:6px 12px;border-radius:16px;font-size:0.75rem;font-weight:800;cursor:pointer;white-space:nowrap;background:${this.lineFilter==='ALL'?'var(--aura-blue)':'var(--bento-bg)'};color:${this.lineFilter==='ALL'?'#fff':'var(--text-main)'};border:1px solid var(--glass-border);">全部 (${Object.keys(MtrData.stations).length})</span>`;
        h += vis.map(l => `<span onclick="AuraHub.setLine('${l.id}')" style="padding:6px 12px;border-radius:16px;font-size:0.75rem;font-weight:800;cursor:pointer;white-space:nowrap;background:${l.color};opacity:${this.lineFilter===l.id?1:0.5};color:#fff;">${l.name}</span>`).join('');
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
                <div class="hub-card-top">
                    <div>
                        <div class="hub-sta-zh">${s.name}</div>
                        <div class="hub-sta-en">${s.en || ''}</div>
                    </div>
                    <span class="hub-code-pill">${c}</span>
                </div>
                <div class="hub-card-bottom">
                    <div class="hub-line-dots">${tags}</div>
                    <div class="hub-fac-icons">${s.toilet?'🚻':''}${s.baby?'🍼':''}♿</div>
                </div>
            </div>`;
        }).join('');
    },
    async openHologram(staId, tab) {
        this.currentSta = staId;
        this.currentModalTab = tab || 'pids';
        const s = MtrData.stations[staId];
        const ls = getStationLines(staId);
        const modal = document.getElementById('hologram-modal');
        const sheet = document.getElementById('hologram-sheet-content');
        modal.classList.remove('hidden');

        const headerHtml = `
            <div style="display:flex;justify-content:space-between;align-items:center;padding-bottom:8px;border-bottom:1px solid var(--glass-border);">
                <div>
                    <span style="font-size:1.32rem;font-weight:900;">${s.name}</span>
                    <span style="font-size:0.82rem;color:var(--text-sub);margin-left:6px;">${s.en} (${staId})</span>
                </div>
                <button class="pids-icon-btn" onclick="AuraHub.closeHologram()">✕ 關閉</button>
            </div>
            <div style="display:flex;gap:8px;margin-top:10px;">
                <button class="radar-btn" style="flex:1;" onclick="AuraHub.closeHologram();AuraDashboard.addStationMonitor('${staId}')">📺 釘選首頁看板</button>
                <button class="pids-icon-btn" style="flex:1;" onclick="AuraHub.closeHologram();AuraCockpit.setExternal('${staId}','origin')">↗ 設為起點</button>
                <button class="pids-icon-btn" style="flex:1;" onclick="AuraHub.closeHologram();AuraCockpit.setExternal('${staId}','dest')">↘ 設為終點</button>
            </div>
            <div class="holo-tab-bar">
                <div class="holo-tab-btn ${this.currentModalTab==='pids'?'active':''}" onclick="AuraHub.openHologram('${staId}','pids')">📺 實時月台 PIDS</div>
                <div class="holo-tab-btn ${this.currentModalTab==='exits'?'active':''}" onclick="AuraHub.openHologram('${staId}','exits')">🚪 出口與設施</div>
                <div class="holo-tab-btn ${this.currentModalTab==='fares'?'active':''}" onclick="AuraHub.openHologram('${staId}','fares')">💳 車資與首末車</div>
            </div>
        `;

        if (this.currentModalTab === 'exits') {
            const tGuide = TRANSFER_GUIDE[staId] ? TRANSFER_GUIDE[staId].default.tip : '一般車站大堂與月台扶手電梯連接';
            const exitsHtml = (s.exits || ['A: 主要出入口', 'B: 公共運輸交匯處']).map(e => {
                const p = e.split(':');
                return `<div style="padding:9px 12px;border-bottom:1px solid var(--glass-border);font-size:0.82rem;display:flex;gap:10px;align-items:center;">
                    <span style="background:#00af41;color:#fff;font-weight:900;padding:2px 8px;border-radius:6px;font-size:0.74rem;">${p[0]}</span>
                    <span>${p.slice(1).join(':')}</span>
                </div>`;
            }).join('');

            sheet.innerHTML = headerHtml + `
                <div style="flex:1;overflow-y:auto;">
                    <div style="display:grid;grid-template-columns:repeat(2,1fr);gap:8px;margin-bottom:10px;">
                        <div style="background:var(--bento-bg);padding:10px;border-radius:12px;border:1px solid var(--glass-border);font-size:0.78rem;">
                            <b>🚻 站內洗手間：</b>${s.toilet ? '<span style="color:#34D399;font-weight:800;">設有洗手間</span>' : '設於鄰近商場'}
                        </div>
                        <div style="background:var(--bento-bg);padding:10px;border-radius:12px;border:1px solid var(--glass-border);font-size:0.78rem;">
                            <b>🍼 育嬰室設施：</b>${s.baby ? '<span style="color:#34D399;font-weight:800;">設有育嬰間</span>' : '無獨立育嬰間'}
                        </div>
                    </div>
                    <div style="padding:9px 12px;border-radius:12px;background:rgba(14,165,233,0.1);border-left:3px solid var(--aura-cyan);font-size:0.76rem;margin-bottom:10px;">
                        <b>🔄 轉乘月台構造秘笈：</b>${tGuide}
                    </div>
                    <div style="font-size:0.75rem;font-weight:800;color:var(--aura-cyan);margin-bottom:6px;">🚪 主要出口與地標指南</div>
                    <div style="background:var(--bento-bg);border-radius:14px;border:1px solid var(--glass-border);overflow:hidden;">${exitsHtml}</div>
                </div>
            `;
            return;
        }

        if (this.currentModalTab === 'fares') {
            const hubs = ['CEN', 'ADM', 'CAB', 'TST', 'MOK', 'KOT', 'SHT', 'TUM', 'LOW'].filter(h => h !== staId);
            const rows = hubs.map(h => {
                const rf = AuraCockpit.getRawFare(staId, h);
                const oct = Number(rf.oct);
                const sng = Number(rf.sng || oct);
                const con = Math.max(1.5, Math.round((oct / 2) * 10) / 10);
                return `<div style="display:flex;justify-content:space-between;align-items:center;padding:10px 12px;border-bottom:1px solid var(--glass-border);cursor:pointer;" onclick="AuraHub.closeHologram();AuraCockpit.launchRoute('${staId}','${h}')">
                    <div>
                        <div style="font-weight:800;font-size:0.92rem;">往 ${MtrData.stations[h].name} <span style="font-size:0.7rem;color:var(--aura-cyan);">導航 ➔</span></div>
                        <div style="font-size:0.72rem;color:var(--text-sub);">單程 $${sng.toFixed(1)} • 小童/學生 $${con.toFixed(1)} • 樂悠咭 $2.0</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:1.1rem;font-weight:900;color:#10B981;">$${oct.toFixed(1)}</div>
                        <div style="font-size:0.64rem;color:var(--text-sub);">成人八達通</div>
                    </div>
                </div>`;
            }).join('');

            sheet.innerHTML = headerHtml + `
                <div style="flex:1;overflow-y:auto;">
                    <div style="display:flex;justify-content:space-between;padding:10px 12px;background:var(--bento-bg);border-radius:12px;border:1px solid var(--glass-border);font-size:0.8rem;margin-bottom:10px;">
                        <span>🌅 <b>頭班車：</b>${s.first || '06:00'}</span>
                        <span>🌙 <b>尾班車：</b>${s.last || '00:50'}</span>
                    </div>
                    <div style="background:var(--bento-bg);border-radius:14px;border:1px solid var(--glass-border);overflow:hidden;">${rows}</div>
                </div>
            `;
            return;
        }

        // Default Tab: Live PIDS across all lines at this station
        sheet.innerHTML = headerHtml + `<div id="holo-pids-body" style="flex:1;overflow-y:auto;padding-top:4px;"><div style="padding:20px;text-align:center;color:var(--text-sub);">正在同步月台實時班次...</div></div>`;
        let pidsHtml = '';
        for (const l of ls) {
            const res = await fetchLiveMtrEta(l.id, staId);
            const sched = res ? res.schedule : null;
            const now = (res && res.sysTime) ? new Date(res.sysTime.replace(/-/g, '/')) : new Date();
            const dirs = MTR_DIRECTIONS[l.id] || { UP: '上行', DOWN: '下行' };

            const renderDirRows = (dirKey, label) => {
                if (isTerminusForDir(l.id, staId, dirKey)) {
                    return `<div style="padding:8px 12px;font-size:0.76rem;color:var(--text-sub);">${label}：🏁 終點落客月台</div>`;
                }
                const list = ((sched && sched[dirKey]) || [])
                    .map(t => ({ ...t, dateObj: new Date(t.time.replace(/-/g, '/')) }))
                    .sort((a, b) => a.dateObj - b.dateObj)
                    .slice(0, 2);
                if (list.length === 0) return '';
                return list.map(t => {
                    const m = calcEtaMin(t, now);
                    const dName = MtrData.stations[t.dest] ? MtrData.stations[t.dest].name : t.dest;
                    return `<div style="display:flex;justify-content:space-between;align-items:center;padding:7px 12px;border-top:1px solid rgba(255,255,255,0.06);font-size:0.82rem;">
                        <span><b>往 ${dName}</b> <span style="font-size:0.72rem;color:#94A3B8;margin-left:6px;">月台 ${t.plat} (${formatHHMM(t.dateObj)})</span></span>
                        <span style="font-weight:900;color:#34D399;">${m === 0 ? '即將到站' : m + ' min'}</span>
                    </div>`;
                }).join('');
            };

            pidsHtml += `<div style="background:var(--pids-pane);color:#F8FAFC;border-radius:16px;overflow:hidden;margin-bottom:10px;border:1px solid var(--glass-border);">
                <div style="background:${l.color};padding:6px 12px;font-size:0.78rem;font-weight:900;color:#fff;display:flex;justify-content:space-between;">
                    <span>${l.name} (${l.en})</span>
                    <span>LIVE PIDS</span>
                </div>
                ${renderDirRows('UP', '▲ 上行')}
                ${renderDirRows('DOWN', '▼ 下行')}
            </div>`;
        }
        const bodyEl = document.getElementById('holo-pids-body');
        if (bodyEl) bodyEl.innerHTML = pidsHtml;
    },
    closeHologram() {
        document.getElementById('hologram-modal').classList.add('hidden');
    }
};

// 7. Tab 3: Network Pulse & HKO Weather
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
        if (btn) btn.innerText = this.drillMode ? '✅ 結束事故演練' : '🚨 颱風/事故演練';
        this.refresh(false);
        AuraToast.show(this.drillMode ? '🚨 已啟動八號風球及信號故障應變演練' : '✅ 已恢復全網正常運作模式');
    },
    async refresh(showFeedback) {
        if (showFeedback) AuraToast.show('↻ 正在同步天文台與全網車務...');
        let temp = 26;
        try {
            const r = await fetchWithTimeout('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc', { timeout: 3000 });
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
            if (dEl) dEl.innerHTML = '<span style="color:#F43F5E;font-weight:800;">⚠️ 演習模式：八號風球及觀塘綫信號延誤生效中</span>';
            if (pill) pill.classList.add('alert');
            if (pillTxt) pillTxt.innerText = `⚠️ 事故演習 • ${temp}°C`;
        } else {
            if (dEl) dEl.innerText = '現時無惡劣天氣警告 • 全網鐵路及露天段正常';
            if (pill) pill.classList.remove('alert');
            if (pillTxt) pillTxt.innerText = `全網正常 • ${temp}°C`;
        }

        const grid = document.getElementById('pulse-lines-grid');
        if (!grid) return;
        grid.innerHTML = this.lines.map(l => {
            const det = LINE_DETAILS[l.id] || {};
            const isDel = this.drillMode && (l.id === 'KTL' || l.id === 'EAL');
            return `<div class="pulse-line-bento ${isDel?'delayed':''}" style="border-top:4px solid ${l.color};" onclick="this.querySelector('.alt-box').classList.toggle('hidden')">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <span style="font-weight:900;font-size:1rem;">${l.name}</span>
                    <span style="font-size:0.72rem;font-weight:800;color:${isDel?'#F43F5E':'#10B981'};">${isDel?'⚠️ 延誤 +12分':'● 正常'}</span>
                </div>
                <div style="font-size:0.72rem;color:var(--text-sub);margin-top:4px;">${det.cars || '8卡'} • 繁忙每 ${det.peak || '2.5分'}</div>
                <div class="alt-box ${isDel?'':'hidden'}" style="margin-top:8px;padding-top:8px;border-top:1px solid var(--glass-border);font-size:0.72rem;color:var(--aura-cyan);line-height:1.4;">
                    <b>🚌 應變替代巴士：</b>${det.altTransport}
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
        AuraCockpit.launchRoute('KOB', 'CEN');
        AuraNav.switchTab(0);
    }, 280);
});

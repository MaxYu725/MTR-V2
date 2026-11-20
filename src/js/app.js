/* =========================================================
   MTR AURA OS 3.7 PRO — CORE ENGINE & MOTION CONTROLLER
   ========================================================= */

const AuraToast = {
    timer: null,
    show(msg) {
        const el = document.getElementById('aura-toast');
        if (!el) return;
        el.innerText = msg;
        el.classList.add('show');
        clearTimeout(this.timer);
        this.timer = setTimeout(() => el.classList.remove('show'), 2300);
    }
};

const AuraTheme = {
    isLight: false,
    init() {
        try {
            if (localStorage.getItem('aura_theme') === 'light') this.apply(true);
        } catch(e) {}
    },
    toggle() {
        this.apply(!this.isLight);
        AuraToast.show(this.isLight ? '☀️ 已切換極光淺色模式' : '🌙 已切換極光深邃模式');
    },
    apply(light) {
        this.isLight = light;
        document.body.classList.toggle('light-theme', light);
        const btn = document.getElementById('theme-toggle-btn');
        if (btn) btn.innerText = light ? '🌙' : '☀️';
        try { localStorage.setItem('aura_theme', light ? 'light' : 'dark'); } catch(e) {}
        if (window.AuraCockpit) AuraCockpit.updateTileLayer();
    }
};

const AuraNav = {
    currentTab: 0,
    switchTab(idx) {
        this.currentTab = idx;
        document.querySelectorAll('.aura-view').forEach((v, i) => v.classList.toggle('active', i === idx));
        document.querySelectorAll('.dock-item').forEach((d, i) => d.classList.toggle('active', i === idx));
        const pill = document.getElementById('dock-active-pill');
        if (pill) pill.style.transform = `translateX(${idx * 100}%)`;
        if (idx === 0) AuraDashboard.refreshAllBoards(false);
        if (idx === 1) {
            setTimeout(() => AuraCockpit.invalidateMap(), 80);
            setTimeout(() => AuraCockpit.invalidateMap(), 300);
        }
        if (idx === 2) AuraHub.renderGrid();
        if (idx === 3) AuraPulse.refresh(false);
    }
};

/* =========================================================
   LIVE MTR NEXT TRAIN API + REALISTIC FALLBACK GENERATOR
   ========================================================= */
async function fetchLiveMtrSchedule(lineId, staId) {
    const apiLine = MTR_LINES[lineId] && MTR_LINES[lineId].base ? MTR_LINES[lineId].base : lineId;
    const url = `https://rt.data.gov.hk/v1/transport/mtr/getSchedule.php?line=${apiLine}&sta=${staId}&lang=TC`;
    try {
        const ctrl = new AbortController();
        const tid = setTimeout(() => ctrl.abort(), 4500);
        const res = await fetch(url, { signal: ctrl.signal });
        clearTimeout(tid);
        if (res.ok) {
            const json = await res.json();
            const key = `${apiLine}-${staId}`;
            if (json && json.status === 1 && json.data && json.data[key]) {
                return { live: true, data: json.data[key] };
            }
        }
    } catch(e) {}
    return { live: false, data: buildFallbackSchedule(apiLine, staId) };
}

function buildFallbackSchedule(lineId, staId) {
    const line = MTR_LINES[lineId];
    if (!line) return { UP: [], DOWN: [] };
    const now = Date.now();
    const seed = (staId.charCodeAt(0) + staId.charCodeAt(1) + Math.floor(now / 30000)) % 4;
    const upDest = line.stations[line.stations.length - 1];
    const dnDest = line.stations[0];
    const makeTrains = (dest, plat, offset) => [0, 1, 2].map(i => {
        const mins = offset + i * 3;
        const dt = new Date(now + mins * 60000);
        const hh = String(dt.getHours()).padStart(2, '0');
        const mm = String(dt.getMinutes()).padStart(2, '0');
        return { dest, plat: String(plat), ttnt: String(mins), time: `2026-01-01 ${hh}:${mm}:00` };
    });
    return {
        UP: staId === upDest ? [] : makeTrains(upDest, 1, seed),
        DOWN: staId === dnDest ? [] : makeTrains(dnDest, 2, (seed + 2) % 4)
    };
}

function isTerminusForDir(lineId, staId, dirKey) {
    const line = MTR_LINES[lineId];
    if (!line) return false;
    if (dirKey === 'UP') return staId === line.stations[line.stations.length - 1] && staId !== 'TKO' && staId !== 'SHS';
    return staId === line.stations[0];
}

/* =========================================================
   VIEW 0: DUAL-PLATFORM PIDS DASHBOARD
   ========================================================= */
const AuraDashboard = {
    nearestSta: 'KOB',
    pinned: [
        { lineId: 'KTL', staId: 'KOB' },
        { lineId: 'EAL', staId: 'KOT' },
        { lineId: 'ISL', staId: 'ADM' }
    ],
    init() {
        try {
            const saved = JSON.parse(localStorage.getItem('aura_pinned_v37') || 'null');
            if (Array.isArray(saved) && saved.length) this.pinned = saved;
        } catch(e) {}
        this.renderBoards();
        this.refreshAllBoards(false);
    },
    savePinned() {
        try { localStorage.setItem('aura_pinned_v37', JSON.stringify(this.pinned)); } catch(e) {}
    },
    pinStation(staId) {
        const lines = getStationLines(staId);
        const lineId = lines[0] || 'KTL';
        const exists = this.pinned.some(p => p.staId === staId && p.lineId === lineId);
        if (exists) {
            AuraToast.show(`📌 ${MTR_STATIONS[staId].name}站已在首頁看板`);
            return;
        }
        this.pinned.unshift({ lineId, staId });
        if (this.pinned.length > 6) this.pinned.pop();
        this.savePinned();
        this.renderBoards();
        this.refreshAllBoards(false);
        AuraToast.show(`📌 已釘選 ${MTR_STATIONS[staId].name}站至首頁看板`);
    },
    removePin(idx) {
        if (this.pinned.length <= 1) {
            AuraToast.show('最少保留一個首頁看板車站');
            return;
        }
        this.pinned.splice(idx, 1);
        this.savePinned();
        this.renderBoards();
        this.refreshAllBoards(false);
    },
    renderBoards() {
        const host = document.getElementById('pids-boards-container');
        if (!host) return;
        host.innerHTML = this.pinned.map((m, idx) => {
            const st = MTR_STATIONS[m.staId] || { name: m.staId, en: '' };
            const ln = MTR_LINES[m.lineId] || { name: m.lineId, color: '#38BDF8', up: '上行', down: '下行' };
            return `<div class="pids-station-card anim-stagger" style="--i:${idx};">
                <div class="pids-card-head">
                    <div style="display:flex;align-items:center;gap:8px;cursor:pointer;" onclick="AuraHub.openHologram('${m.staId}','pids')">
                        <div class="pids-line-bar" style="background:${ln.color};"></div>
                        <div>
                            <div style="display:flex;align-items:center;gap:6px;">
                                <span class="pids-sta-name">${st.name}</span>
                                <span class="pids-line-tag" style="background:${ln.color};">${ln.name}</span>
                            </div>
                        </div>
                    </div>
                    <div style="display:flex;gap:5px;">
                        <button class="pids-icon-btn" onclick="AuraCockpit.setOriginAndGo('${m.staId}')">出發</button>
                        <button class="pids-icon-btn" onclick="AuraDashboard.removePin(${idx})">✕</button>
                    </div>
                </div>
                <div class="pids-dual-grid">
                    <div class="pids-pane">
                        <div class="pids-dir-label" id="dest-up-${idx}">往 ${ln.up}</div>
                        <div class="pids-eta-row">
                            <span class="pids-eta-num" id="eta-up-${idx}">--</span>
                            <span class="pids-eta-unit" id="unit-up-${idx}">min</span>
                        </div>
                        <div class="pids-rail-track"><div class="pids-rail-fill" id="prog-up-${idx}" style="width:25%;"></div></div>
                        <div class="pids-sub-eta" id="next-up-${idx}">同步中...</div>
                    </div>
                    <div class="pids-pane">
                        <div class="pids-dir-label" id="dest-down-${idx}">往 ${ln.down}</div>
                        <div class="pids-eta-row">
                            <span class="pids-eta-num" id="eta-down-${idx}">--</span>
                            <span class="pids-eta-unit" id="unit-down-${idx}">min</span>
                        </div>
                        <div class="pids-rail-track"><div class="pids-rail-fill down-fill" id="prog-down-${idx}" style="width:25%;"></div></div>
                        <div class="pids-sub-eta" id="next-down-${idx}">同步中...</div>
                    </div>
                </div>
            </div>`;
        }).join('');
    },
    async refreshAllBoards(showFeedback) {
        if (showFeedback) {
            AuraToast.show('↻ 正在同步實時班次...');
            const ic = document.getElementById('dash-refresh-icon');
            if (ic) { ic.classList.remove('spinning-icon'); void ic.offsetWidth; ic.classList.add('spinning-icon'); }
        }
        await Promise.all(this.pinned.map(async (m, idx) => {
            const res = await fetchLiveMtrSchedule(m.lineId, m.staId);
            const fillPane = (dirKey, suffix) => {
                const etaEl = document.getElementById(`eta-${suffix}-${idx}`);
                const unitEl = document.getElementById(`unit-${suffix}-${idx}`);
                const destEl = document.getElementById(`dest-${suffix}-${idx}`);
                const nextEl = document.getElementById(`next-${suffix}-${idx}`);
                const progEl = document.getElementById(`prog-${suffix}-${idx}`);
                if (!etaEl) return;

                if (isTerminusForDir(m.lineId, m.staId, dirKey)) {
                    etaEl.innerText = '落客終點';
                    etaEl.className = 'pids-eta-num terminus';
                    if (unitEl) unitEl.innerText = '';
                    if (progEl) progEl.style.width = '100%';
                    if (nextEl) nextEl.innerText = '此方向為終點站';
                    return;
                }
                const list = (res.data && res.data[dirKey]) ? res.data[dirKey] : [];
                if (!list.length) {
                    etaEl.innerText = '--';
                    etaEl.className = 'pids-eta-num terminus';
                    if (unitEl) unitEl.innerText = '';
                    if (progEl) progEl.style.width = '8%';
                    if (nextEl) nextEl.innerText = '暫無班次資料';
                    return;
                }
                const first = list[0];
                const dName = (MTR_STATIONS[first.dest] && MTR_STATIONS[first.dest].name) || first.dest;
                if (destEl) destEl.innerText = `往 ${dName} • 月台 ${first.plat || '-'}`;
                const m0 = Math.max(0, parseInt(first.ttnt, 10) || 0);
                if (m0 === 0) {
                    etaEl.innerText = '即將到站';
                    etaEl.className = 'pids-eta-num arriving';
                    if (unitEl) unitEl.innerText = '';
                    if (progEl) progEl.style.width = '100%';
                } else {
                    etaEl.innerText = m0;
                    etaEl.className = 'pids-eta-num eta-pop';
                    if (unitEl) unitEl.innerText = 'min';
                    if (progEl) progEl.style.width = `${Math.max(15, Math.min(96, Math.round((1 - Math.min(m0, 10) / 10) * 100)))}%`;
                }
                if (nextEl) {
                    const tail = list.slice(1, 3).map(x => `${x.ttnt}分`).join(' / ');
                    nextEl.innerText = tail ? `隨後班次：${tail}${res.live ? '' : ' (推算)'}` : (res.live ? '實時同步' : '推算班次');
                }
            };
            fillPane('UP', 'up');
            fillPane('DOWN', 'down');
        }));
    },
    locateNearest() {
        const titleEl = document.getElementById('radar-nearest-title');
        const subEl = document.getElementById('radar-nearest-sub');
        if (titleEl) titleEl.innerText = '正在掃描...';
        const strip = document.querySelector('#view-dashboard .quick-radar-strip');
        if (strip) { strip.classList.remove('radar-scanning'); void strip.offsetWidth; strip.classList.add('radar-scanning'); }

        const finishWithCoords = (lat, lng, isFallback) => {
            let bestCode = 'KOB', bestDist = Infinity;
            Object.entries(MTR_STATIONS).forEach(([code, s]) => {
                const d = Math.hypot((s.lat - lat) * 111, (s.lng - lng) * 102);
                if (d < bestDist) { bestDist = d; bestCode = code; }
            });
            this.nearestSta = bestCode;
            const st = MTR_STATIONS[bestCode];
            const lines = getStationLines(bestCode).map(id => MTR_LINES[id].name).join(' / ');
            if (titleEl) titleEl.innerText = `${st.name}站 (${bestCode})`;
            if (subEl) subEl.innerText = isFallback
                ? `${lines} • 預設九龍東定位`
                : `${lines} • 距離約 ${bestDist < 1 ? Math.round(bestDist * 1000) + 'm' : bestDist.toFixed(1) + 'km'}`;
            AuraToast.show(`📡 已鎖定最近車站：${st.name}站`);
        };

        if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
                pos => finishWithCoords(pos.coords.latitude, pos.coords.longitude, false),
                () => finishWithCoords(22.3235, 114.2141, true),
                { timeout: 4000 }
            );
        } else {
            finishWithCoords(22.3235, 114.2141, true);
        }
    },
    navFromNearest() {
        AuraCockpit.setOriginAndGo(this.nearestSta);
    }
};

/* =========================================================
   VIEW 1: ROUTE COCKPIT — (station, baseLine) STATE-SPACE DIJKSTRA
   ========================================================= */
const AuraCockpit = (function() {
    let originSta = 'KOB';
    let destSta = 'FAN';
    let activeStrategy = 'fastest';
    let cachedRoutes = {};
    let map = null;
    let tileLayer = null;
    let routeLayerGroup = null;
    let mapExpanded = false;

    function buildStateGraph() {
        const adj = {};
        const addEdge = (u, v, time, type, lineId, walkMin, isCross) => {
            if (!adj[u]) adj[u] = [];
            adj[u].push({ to: v, time, type, lineId, walkMin: walkMin || 0, isCross: !!isCross });
        };

        const stationBaseLines = {};
        Object.values(MTR_LINES).forEach(line => {
            const base = line.base || line.id;
            const stas = line.stations;
            for (let i = 0; i < stas.length; i++) {
                const s = stas[i];
                if (!stationBaseLines[s]) stationBaseLines[s] = new Set();
                stationBaseLines[s].add(base);
                if (i < stas.length - 1) {
                    const a = stas[i], b = stas[i + 1];
                    const sa = MTR_STATIONS[a], sb = MTR_STATIONS[b];
                    const distKm = Math.hypot((sa.lat - sb.lat) * 111, (sa.lng - sb.lng) * 102);
                    const segMin = base === 'AEL'
                        ? Math.max(4, Math.round(distKm * 1.1))
                        : Math.max(2, Math.min(7, Math.round(1.4 + distKm * 1.35)));
                    addEdge(`${a}|${base}`, `${b}|${base}`, segMin, 'ride', base);
                    addEdge(`${b}|${base}`, `${a}|${base}`, segMin, 'ride', base);
                }
            }
        });

        // In-station transfers between different baseLines
        Object.entries(stationBaseLines).forEach(([sta, lineSet]) => {
            const arr = Array.from(lineSet);
            if (arr.length < 2) return;
            const meta = MTR_TRANSFERS[sta] || { cross: false, walk: 2.5 };
            for (let i = 0; i < arr.length; i++) {
                for (let j = 0; j < arr.length; j++) {
                    if (i === j) continue;
                    addEdge(`${sta}|${arr[i]}`, `${sta}|${arr[j]}`, meta.walk + 1.5, 'transfer', arr[j], meta.walk, meta.cross);
                }
            }
        });

        // Out-of-station pedestrian transfer links (CEN<->HOK, TST<->ETS)
        MTR_WALK_LINKS.forEach(([a, b, walkMin]) => {
            const la = Array.from(stationBaseLines[a] || []);
            const lb = Array.from(stationBaseLines[b] || []);
            la.forEach(x => lb.forEach(y => {
                addEdge(`${a}|${x}`, `${b}|${y}`, walkMin + 2.0, 'walk', y, walkMin, false);
                addEdge(`${b}|${y}`, `${a}|${x}`, walkMin + 2.0, 'walk', x, walkMin, false);
            }));
        });

        return { adj, stationBaseLines };
    }

    const GRAPH = buildStateGraph();

    function runStateDijkstra(fromSta, toSta, mode) {
        if (fromSta === toSta) return null;
        const startLines = Array.from(GRAPH.stationBaseLines[fromSta] || []);
        const dist = {};
        const prev = {};
        const visited = new Set();
        const pq = [];

        startLines.forEach(l => {
            const k = `${fromSta}|${l}`;
            dist[k] = 0;
            pq.push({ node: k, cost: 0, realTime: 0, transfers: 0 });
        });

        let bestGoal = null;
        let bestGoalCost = Infinity;

        while (pq.length) {
            pq.sort((a, b) => a.cost - b.cost);
            const cur = pq.shift();
            if (visited.has(cur.node)) continue;
            visited.add(cur.node);

            const [curSta] = cur.node.split('|');
            if (curSta === toSta) {
                if (cur.cost < bestGoalCost) {
                    bestGoalCost = cur.cost;
                    bestGoal = cur.node;
                }
                continue;
            }

            const edges = GRAPH.adj[cur.node] || [];
            for (const e of edges) {
                if (visited.has(e.to)) continue;
                let weight = e.time;
                if (e.type === 'transfer' || e.type === 'walk') {
                    if (mode === 'fewest') weight += 18;
                    else if (mode === 'cross') weight += e.isCross ? 1.5 : 14;
                    else weight += 1.0;
                }
                if (e.lineId === 'AEL' && toSta !== 'AIR' && toSta !== 'AWE' && fromSta !== 'AIR' && fromSta !== 'AWE') {
                    weight += 25; // avoid Airport Express surcharge for normal trips
                }
                const nextCost = cur.cost + weight;
                if (nextCost < (dist[e.to] ?? Infinity)) {
                    dist[e.to] = nextCost;
                    prev[e.to] = { from: cur.node, edge: e };
                    pq.push({ node: e.to, cost: nextCost });
                }
            }
        }

        if (!bestGoal) return null;

        // Reconstruct segments
        const steps = [];
        let cur = bestGoal;
        while (prev[cur]) {
            steps.unshift({ from: prev[cur].from, to: cur, edge: prev[cur].edge });
            cur = prev[cur].from;
        }

        const segments = [];
        let totalMin = 0;
        let totalStops = 0;
        let transferHubs = [];
        let usesCrossHarbour = false;
        let usesBorder = false;
        let usesAEL = false;

        const harbourPairs = new Set(['ADM-TST','TST-ADM','ADM-EXC','EXC-ADM','EXC-HUH','HUH-EXC','QUB-YAT','YAT-QUB','HOK-KOW','KOW-HOK']);

        steps.forEach(s => {
            const [fSta, fLine] = s.from.split('|');
            const [tSta, tLine] = s.to.split('|');
            totalMin += s.edge.time;
            if (s.edge.type === 'ride') {
                totalStops += 1;
                if (harbourPairs.has(`${fSta}-${tSta}`)) usesCrossHarbour = true;
                if (tSta === 'LOW' || tSta === 'LMC' || fSta === 'LOW' || fSta === 'LMC') usesBorder = true;
                if (tLine === 'AEL') usesAEL = true;
                const last = segments[segments.length - 1];
                if (last && last.type === 'ride' && last.lineId === tLine) {
                    last.stops.push(tSta);
                    last.to = tSta;
                    last.min += s.edge.time;
                } else {
                    segments.push({ type: 'ride', lineId: tLine, from: fSta, to: tSta, stops: [fSta, tSta], min: s.edge.time });
                }
            } else {
                transferHubs.push(fSta);
                segments.push({
                    type: s.edge.type,
                    at: fSta,
                    toSta: tSta,
                    fromLine: fLine,
                    toLine: tLine,
                    walkMin: s.edge.walkMin,
                    isCross: s.edge.isCross
                });
            }
        });

        totalMin = Math.max(3, Math.round(totalMin));
        const fare = estimateMtrFare(fromSta, toSta, totalStops, usesCrossHarbour, usesBorder, usesAEL);
        const viaLabel = transferHubs.length
            ? '經 ' + transferHubs.map(c => MTR_STATIONS[c].name).join('・')
            : '直達免轉乘';

        return {
            mode,
            totalMin,
            totalStops,
            transfers: transferHubs.length,
            transferHubs,
            viaLabel,
            segments,
            fare
        };
    }

    function updateCapsuleUI() {
        const oEl = document.getElementById('cockpit-origin-txt');
        const dEl = document.getElementById('cockpit-dest-txt');
        if (oEl && MTR_STATIONS[originSta]) oEl.innerText = `${MTR_STATIONS[originSta].name} (${originSta})`;
        if (dEl && MTR_STATIONS[destSta]) dEl.innerText = `${MTR_STATIONS[destSta].name} (${destSta})`;
    }

    function computeAllStrategies() {
        cachedRoutes = {
            fastest: runStateDijkstra(originSta, destSta, 'fastest'),
            fewest: runStateDijkstra(originSta, destSta, 'fewest'),
            cross: runStateDijkstra(originSta, destSta, 'cross')
        };
        ['fastest', 'fewest', 'cross'].forEach(k => {
            const r = cachedRoutes[k];
            const mEl = document.getElementById(`strat-meta-${k}`);
            const vEl = document.getElementById(`strat-via-${k}`);
            if (r) {
                if (mEl) mEl.innerText = `${r.totalMin} 分 • ${r.transfers} 轉乘`;
                if (vEl) vEl.innerText = r.viaLabel;
            } else {
                if (mEl) mEl.innerText = '相同車站';
                if (vEl) vEl.innerText = '請選不同終點';
            }
        });
        renderActiveRoute();
    }

    function selectStrategy(mode) {
        activeStrategy = mode;
        ['fastest', 'fewest', 'cross'].forEach(k => {
            const b = document.getElementById(`strat-btn-${k}`);
            if (b) b.classList.toggle('active', k === mode);
        });
        renderActiveRoute();
    }

    function renderActiveRoute() {
        const host = document.getElementById('cockpit-result-host');
        if (!host) return;
        const res = cachedRoutes[activeStrategy];
        if (!res) {
            host.innerHTML = `<div class="route-result-card" style="text-align:center;color:var(--text-sub);font-size:0.85rem;">請選擇不同的起點與終點車站。</div>`;
            drawRouteOnMap(null);
            return;
        }

        const etaDate = new Date(Date.now() + res.totalMin * 60000);
        const etaStr = `${String(etaDate.getHours()).padStart(2,'0')}:${String(etaDate.getMinutes()).padStart(2,'0')}`;
        const oct = res.fare.oct;

        // First transfer hub boarding car recommendation
        const firstRide = res.segments.find(s => s.type === 'ride');
        const firstHub = res.transferHubs[0] || destSta;
        const tMeta = MTR_TRANSFERS[firstHub] || { cars: [4, 5], tip: '建議中間車廂較近扶手電梯' };
        const totalCars = (firstRide && MTR_LINES[firstRide.lineId] && MTR_LINES[firstRide.lineId].cars) || 8;
        const carsHtml = Array.from({ length: totalCars }, (_, i) => {
            const c = i + 1;
            const isBest = tMeta.cars.includes(c);
            return `<div class="${isBest?'best-car-shimmer':''}" style="flex:1;height:22px;border-radius:5px;background:${isBest?'linear-gradient(135deg,#10B981,#059669)':'var(--chip-inactive-bg)'};color:${isBest?'#fff':'var(--text-sub)'};font-size:0.65rem;font-weight:800;display:flex;align-items:center;justify-content:center;">${isBest?'★':''}${c}卡</div>`;
        }).join('');

        let tlHtml = '';
        res.segments.forEach((seg, idx) => {
            if (seg.type === 'ride') {
                const ln = MTR_LINES[seg.lineId];
                const midStops = seg.stops.slice(1, -1);
                tlHtml += `<div class="anim-stagger" style="--i:${idx};display:flex;gap:10px;align-items:center;margin-bottom:6px;">
                    <div style="width:4px;align-self:stretch;border-radius:4px;background:${ln.color};min-height:38px;"></div>
                    <div style="flex:1;padding:6px 0;">
                        <div style="font-size:0.92rem;font-weight:900;">${MTR_STATIONS[seg.from].name} ➔ ${MTR_STATIONS[seg.to].name}</div>
                        <div style="display:flex;align-items:center;gap:6px;margin-top:3px;flex-wrap:wrap;">
                            <span style="font-size:0.66rem;font-weight:800;padding:2px 7px;border-radius:6px;background:${ln.color};color:#fff;">${ln.name}</span>
                            <span style="font-size:0.72rem;color:var(--text-sub);">共 ${seg.stops.length - 1} 站 • 約 ${Math.round(seg.min)} 分鐘</span>
                            ${midStops.length ? `<span style="font-size:0.7rem;color:var(--aura-cyan);font-weight:700;cursor:pointer;" onclick="document.getElementById('seg-stops-${idx}').classList.toggle('hidden')">▾ 展開途經 ${midStops.length} 站</span>` : ''}
                        </div>
                        ${midStops.length ? `<div id="seg-stops-${idx}" class="hidden drawer-anim" style="margin-top:6px;padding:7px 9px;border-radius:9px;background:var(--chip-inactive-bg);font-size:0.7rem;color:var(--text-sub);line-height:1.5;">${midStops.map(c => MTR_STATIONS[c].name).join(' → ')}</div>` : ''}
                    </div>
                </div>`;
            } else {
                const toLn = MTR_LINES[seg.toLine];
                const meta = MTR_TRANSFERS[seg.at] || { tip: '按站內指示前往轉乘月台' };
                tlHtml += `<div class="anim-stagger" style="--i:${idx};padding:8px 10px;border-radius:12px;background:rgba(56,189,248,0.09);border:1px solid rgba(56,189,248,0.25);margin:4px 0 8px 12px;">
                    <div style="font-size:0.76rem;font-weight:800;">🔄 於 ${MTR_STATIONS[seg.at].name} 轉乘 ${toLn.name} ${seg.isCross ? '⚡同月台' : ''}（步行約 ${seg.walkMin} 分鐘）</div>
                    <div style="font-size:0.68rem;color:var(--text-sub);margin-top:2px;">${meta.tip}</div>
                </div>`;
            }
        });

        const destExits = (MTR_STATIONS[destSta] && MTR_STATIONS[destSta].exits) || [];

        host.innerHTML = `<div class="route-result-card">
            <div class="hero-metrics-grid">
                <div class="hero-metric-box">
                    <div class="metric-lbl">⏱️ 總車程</div>
                    <div class="metric-val eta-pop">${res.totalMin} 分鐘</div>
                    <div class="metric-sub">預計 ${etaStr} 抵達</div>
                </div>
                <div class="hero-metric-box">
                    <div class="metric-lbl">💳 成人八達通</div>
                    <div class="metric-val eta-pop" style="color:#10B981;">$${oct.toFixed(1)}</div>
                    <div class="metric-sub">樂悠咭 $${res.fare.joy.toFixed(1)}</div>
                </div>
                <div class="hero-metric-box">
                    <div class="metric-lbl">🚇 行程</div>
                    <div class="metric-val">${res.totalStops} 站</div>
                    <div class="metric-sub">${res.transfers === 0 ? '直達免轉乘' : `轉乘 ${res.transfers} 次`}</div>
                </div>
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
                <span style="font-size:0.72rem;font-weight:800;color:var(--aura-cyan);">${res.viaLabel}</span>
                <button class="pids-icon-btn" onclick="document.getElementById('extra-fare-consist-box').classList.toggle('hidden')">🚆 車廂建議 & 詳細票價 ▾</button>
            </div>

            <div id="extra-fare-consist-box" class="hidden drawer-anim" style="margin-bottom:10px;padding:10px;border-radius:13px;background:rgba(0,0,0,0.2);border:1px solid var(--glass-border);">
                <div style="display:flex;justify-content:space-between;font-size:0.7rem;margin-bottom:6px;">
                    <span style="font-weight:800;">對準 ${MTR_STATIONS[firstHub].name} 轉乘梯/出口</span>
                    <span style="color:#10B981;font-weight:800;">推薦第 ${tMeta.cars.join(', ')} 卡</span>
                </div>
                <div style="display:flex;gap:4px;margin-bottom:8px;">${carsHtml}</div>
                <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;text-align:center;font-size:0.7rem;">
                    <div style="padding:5px;border-radius:8px;background:var(--chip-inactive-bg);">單程票<br><b>$${res.fare.single.toFixed(1)}</b></div>
                    <div style="padding:5px;border-radius:8px;background:var(--chip-inactive-bg);">小童/學生<br><b>$${res.fare.child.toFixed(1)}</b></div>
                    <div style="padding:5px;border-radius:8px;background:var(--chip-inactive-bg);">樂悠咭<br><b>$${res.fare.joy.toFixed(1)}</b></div>
                </div>
            </div>

            <div>${tlHtml}</div>

            ${destExits.length ? `<div style="margin-top:8px;padding:8px 10px;border-radius:11px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.3);font-size:0.72rem;font-weight:700;">🏁 抵達 ${MTR_STATIONS[destSta].name} • 焦點出口：${destExits[0]}</div>` : ''}
        </div>`;

        drawRouteOnMap(res);
    }

    function initMap() {
        if (map || typeof L === 'undefined') return;
        map = L.map('aura-map', { zoomControl: false, attributionControl: false }).setView([22.33, 114.17], 11);
        updateTileLayer();
        routeLayerGroup = L.layerGroup().addTo(map);
        computeAllStrategies();
    }

    function updateTileLayer() {
        if (!map || typeof L === 'undefined') return;
        if (tileLayer) map.removeLayer(tileLayer);
        // Keyless ArcGIS MapServer tiles work smoothly in both Canvas iframe and Android WebView
        const url = AuraTheme.isLight
            ? 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Light_Gray_Base/MapServer/tile/{z}/{y}/{x}'
            : 'https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}';
        tileLayer = L.tileLayer(url, { maxZoom: 16 }).addTo(map);
    }

    function drawRouteOnMap(res) {
        if (!map || !routeLayerGroup || typeof L === 'undefined') return;
        routeLayerGroup.clearLayers();
        if (!res) return;

        const allCoords = [];
        res.segments.forEach(seg => {
            if (seg.type === 'ride') {
                const ln = MTR_LINES[seg.lineId];
                const pts = seg.stops.map(c => [MTR_STATIONS[c].lat, MTR_STATIONS[c].lng]);
                pts.forEach(p => allCoords.push(p));
                L.polyline(pts, { color: ln.color, weight: 5, opacity: 0.92 }).addTo(routeLayerGroup);
                seg.stops.forEach(c => {
                    const s = MTR_STATIONS[c];
                    const cls = c === originSta ? 'mtr-station-marker selected-origin'
                              : c === destSta ? 'mtr-station-marker selected-dest'
                              : 'mtr-station-marker';
                    const icon = L.divIcon({
                        className: '',
                        html: `<div class="${cls}" style="background:${ln.color};"></div>`,
                        iconSize: c === originSta || c === destSta ? [16, 16] : [10, 10],
                        iconAnchor: c === originSta || c === destSta ? [8, 8] : [5, 5]
                    });
                    L.marker([s.lat, s.lng], { icon }).bindTooltip(s.name, { direction: 'top' }).addTo(routeLayerGroup);
                });
            }
        });
        if (allCoords.length >= 2) {
            map.fitBounds(allCoords, { padding: [26, 26] });
        }
    }

    function swapStations() {
        const btn = document.querySelector('.capsule-swap-circle');
        if (btn) { btn.classList.remove('swap-spinning'); void btn.offsetWidth; btn.classList.add('swap-spinning'); }
        const t = originSta; originSta = destSta; destSta = t;
        updateCapsuleUI();
        computeAllStrategies();
    }

    function setStation(role, code) {
        if (role === 'origin') originSta = code;
        else destSta = code;
        updateCapsuleUI();
        computeAllStrategies();
    }

    function quickPlan(from, to) {
        originSta = from; destSta = to;
        updateCapsuleUI();
        computeAllStrategies();
        AuraNav.switchTab(1);
    }

    function setOriginAndGo(code) {
        originSta = code;
        if (destSta === code) destSta = (code === 'CEN' ? 'KOB' : 'CEN');
        updateCapsuleUI();
        computeAllStrategies();
        AuraNav.switchTab(1);
    }

    function setDestAndGo(code) {
        destSta = code;
        if (originSta === code) originSta = (code === 'KOB' ? 'CEN' : 'KOB');
        updateCapsuleUI();
        computeAllStrategies();
        AuraNav.switchTab(1);
    }

    function toggleMapSize() {
        mapExpanded = !mapExpanded;
        const wrap = document.getElementById('aura-map-wrap');
        const btn = document.getElementById('map-expand-btn');
        if (wrap) wrap.classList.toggle('expanded', mapExpanded);
        if (btn) btn.innerText = mapExpanded ? '⤡ 收合地圖' : '⤢ 放大地圖';
        setTimeout(() => invalidateMap(), 360);
    }

    function invalidateMap() {
        if (!map) initMap();
        if (map) {
            map.invalidateSize();
            if (cachedRoutes[activeStrategy]) drawRouteOnMap(cachedRoutes[activeStrategy]);
        }
    }

    function fitRouteBounds() {
        if (cachedRoutes[activeStrategy]) drawRouteOnMap(cachedRoutes[activeStrategy]);
    }

    return {
        init() { updateCapsuleUI(); initMap(); },
        swapStations,
        setStation,
        selectStrategy,
        quickPlan,
        setOriginAndGo,
        setDestAndGo,
        toggleMapSize,
        invalidateMap,
        fitRouteBounds,
        updateTileLayer,
        runStateDijkstra
    };
})();

/* =========================================================
   STATION PICKER MODAL
   ========================================================= */
const AuraPicker = {
    role: 'origin',
    open(role) {
        this.role = role;
        const t = document.getElementById('picker-modal-title');
        const inp = document.getElementById('picker-search-input');
        if (t) t.innerText = role === 'origin' ? '↗ 選擇起點車站' : '↘ 選擇終點車站';
        if (inp) inp.value = '';
        this.renderList();
        document.getElementById('station-picker-modal').classList.remove('hidden');
    },
    close() {
        document.getElementById('station-picker-modal').classList.add('hidden');
    },
    renderList() {
        const q = (document.getElementById('picker-search-input').value || '').trim().toLowerCase();
        const body = document.getElementById('picker-list-body');
        if (!body) return;
        const codes = Object.keys(MTR_STATIONS).filter(c => {
            const s = MTR_STATIONS[c];
            return !q || c.toLowerCase().includes(q) || s.name.includes(q) || s.en.toLowerCase().includes(q);
        });
        body.innerHTML = codes.map(c => {
            const s = MTR_STATIONS[c];
            const lines = getStationLines(c);
            const color = (MTR_LINES[lines[0]] && MTR_LINES[lines[0]].color) || '#38BDF8';
            return `<button class="hub-station-card" style="text-align:left;border-left:3px solid ${color};" onclick="AuraCockpit.setStation('${this.role}','${c}');AuraPicker.close();">
                <div style="font-size:0.86rem;font-weight:900;">${s.name}</div>
                <div style="font-size:0.65rem;color:var(--text-sub);">${c} • ${s.en}</div>
            </button>`;
        }).join('');
    }
};

/* =========================================================
   VIEW 2: STATION HOLOGRAM HUB + CENTERED MODAL
   ========================================================= */
const AuraHub = {
    activeLine: 'ALL',
    currentHoloSta: null,
    currentHoloTab: 'pids',
    init() {
        this.renderLineChips();
        this.renderGrid();
    },
    renderLineChips() {
        const host = document.getElementById('hub-line-chips');
        if (!host) return;
        const mainLines = Object.values(MTR_LINES).filter(l => !l.base);
        const total = Object.keys(MTR_STATIONS).length;
        host.innerHTML = `<button class="hub-chip ${this.activeLine==='ALL'?'active':''}" onclick="AuraHub.setLine('ALL')">全部 (${total})</button>` +
            mainLines.map(l => `<button class="hub-chip ${this.activeLine===l.id?'active':''}" style="${this.activeLine===l.id?`background:${l.color};border-color:transparent;color:#fff;`:''}" onclick="AuraHub.setLine('${l.id}')">${l.name}</button>`).join('');
    },
    setLine(id) {
        this.activeLine = id;
        this.renderLineChips();
        this.renderGrid();
    },
    renderGrid() {
        const q = (document.getElementById('hub-search-box')?.value || '').trim().toLowerCase();
        const codes = Object.keys(MTR_STATIONS).filter(c => {
            const s = MTR_STATIONS[c];
            const lineMatch = this.activeLine === 'ALL' || getStationLines(c).includes(this.activeLine);
            const textMatch = !q || c.toLowerCase().includes(q) || s.name.includes(q) || s.en.toLowerCase().includes(q);
            return lineMatch && textMatch;
        });
        document.getElementById('hub-bento-grid').innerHTML = codes.map((c, idx) => {
            const s = MTR_STATIONS[c];
            const lines = getStationLines(c);
            const badges = lines.map(lid => `<span style="font-size:0.6rem;font-weight:800;padding:2px 6px;border-radius:5px;background:${MTR_LINES[lid].color};color:#fff;">${MTR_LINES[lid].name.replace('綫','')}</span>`).join('');
            const facs = `${s.wc?'🚻':''}${s.bf?'🍼':''}${s.bfree?'♿':''}`;
            return `<div class="hub-station-card anim-stagger" style="--i:${Math.min(idx, 12)};" onclick="AuraHub.openHologram('${c}','pids')">
                <div class="hub-sta-top">
                    <span class="hub-sta-zh">${s.name}</span>
                    <span class="hub-sta-code">${c}</span>
                </div>
                <div class="hub-sta-en">${s.en}</div>
                <div class="hub-badges-row">
                    <div style="display:flex;gap:3px;flex-wrap:wrap;">${badges}</div>
                    <span style="font-size:0.7rem;">${facs}</span>
                </div>
            </div>`;
        }).join('');
    },
    async openHologram(code, tab) {
        this.currentHoloSta = code;
        this.currentHoloTab = tab || 'pids';
        const st = MTR_STATIONS[code];
        const lines = getStationLines(code);
        const primaryLn = MTR_LINES[lines[0]] || { color: '#38BDF8', name: '港鐵' };

        const modal = document.getElementById('station-hologram-modal');
        const box = document.getElementById('hologram-modal-content');
        modal.classList.remove('hidden');

        box.innerHTML = `
            <div style="margin:-16px -16px 12px -16px;padding:14px 16px;background:linear-gradient(135deg,${primaryLn.color},rgba(15,23,42,0.92));color:#fff;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                    <div>
                        <div style="font-size:1.25rem;font-weight:900;">${st.name} <span style="font-size:0.8rem;opacity:0.85;">${st.en} (${code})</span></div>
                        <div style="font-size:0.72rem;margin-top:4px;opacity:0.92;">首班車 ${st.first} • 尾班車 ${st.last} • ${st.wc?'🚻 設洗手間':'無站內洗手間'}</div>
                    </div>
                    <button class="pids-icon-btn" style="background:rgba(0,0,0,0.35);color:#fff;border-color:rgba(255,255,255,0.25);" onclick="AuraHub.closeHologram()">✕</button>
                </div>
            </div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;">
                <button class="pids-icon-btn" style="padding:8px;background:var(--aura-blue);color:#fff;border:none;" onclick="AuraDashboard.pinStation('${code}')">📌 釘選看板</button>
                <button class="pids-icon-btn" style="padding:8px;" onclick="AuraHub.closeHologram();AuraCockpit.setOriginAndGo('${code}')">↗ 設為起點</button>
                <button class="pids-icon-btn" style="padding:8px;" onclick="AuraHub.closeHologram();AuraCockpit.setDestAndGo('${code}')">↘ 設為終點</button>
            </div>

            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-bottom:10px;">
                <button class="pids-icon-btn" style="padding:7px;${this.currentHoloTab==='pids'?'background:rgba(56,189,248,0.2);border-color:var(--aura-cyan);color:var(--aura-cyan);':''}" onclick="AuraHub.openHologram('${code}','pids')">📺 實時月台</button>
                <button class="pids-icon-btn" style="padding:7px;${this.currentHoloTab==='exits'?'background:rgba(56,189,248,0.2);border-color:var(--aura-cyan);color:var(--aura-cyan);':''}" onclick="AuraHub.openHologram('${code}','exits')">🚪 出口設施</button>
                <button class="pids-icon-btn" style="padding:7px;${this.currentHoloTab==='fares'?'background:rgba(56,189,248,0.2);border-color:var(--aura-cyan);color:var(--aura-cyan);':''}" onclick="AuraHub.openHologram('${code}','fares')">💳 常用車資</button>
            </div>

            <div id="holo-pids-body" class="holo-tab-content-anim" style="flex:1;overflow-y:auto;"></div>
        `;

        const body = document.getElementById('holo-pids-body');
        if (this.currentHoloTab === 'pids') {
            body.innerHTML = `<div style="text-align:center;padding:24px;color:var(--text-sub);font-size:0.82rem;">正在同步 ${st.name}站實時列車資料...</div>`;
            const parts = await Promise.all(lines.map(async lid => {
                const ln = MTR_LINES[lid];
                const res = await fetchLiveMtrSchedule(lid, code);
                const rows = [...(res.data.UP || []).slice(0, 2), ...(res.data.DOWN || []).slice(0, 2)];
                const rowsHtml = rows.length ? rows.map(r => {
                    const dn = (MTR_STATIONS[r.dest] && MTR_STATIONS[r.dest].name) || r.dest;
                    const t = parseInt(r.ttnt, 10) === 0 ? '<span style="color:var(--aura-amber);font-weight:900;">即將到站</span>' : `<span style="color:var(--aura-cyan);font-weight:900;">${r.ttnt} min</span>`;
                    return `<div style="display:flex;justify-content:space-between;padding:7px 10px;border-top:1px solid var(--glass-border);font-size:0.78rem;">
                        <span>往 <b>${dn}</b> <span style="color:var(--text-sub);">月台 ${r.plat || '-'}</span></span>
                        ${t}
                    </div>`;
                }).join('') : `<div style="padding:10px;font-size:0.76rem;color:var(--text-sub);">暫無即時班次</div>`;
                return `<div style="border:1px solid var(--glass-border);border-radius:14px;overflow:hidden;margin-bottom:9px;">
                    <div style="background:${ln.color};color:#fff;padding:6px 10px;font-size:0.76rem;font-weight:800;display:flex;justify-content:space-between;">
                        <span>${ln.name} (${ln.en})</span>
                        <span>${res.live ? 'LIVE PIDS' : '推算班次'}</span>
                    </div>
                    ${rowsHtml}
                </div>`;
            }));
            body.innerHTML = parts.join('');
        } else if (this.currentHoloTab === 'exits') {
            body.innerHTML = `
                <div style="padding:10px;border-radius:14px;background:var(--chip-inactive-bg);margin-bottom:10px;font-size:0.78rem;display:flex;gap:12px;">
                    <span>${st.wc ? '✅ 站內洗手間' : '❌ 無洗手間'}</span>
                    <span>${st.bf ? '✅ 育嬰室' : '❌ 無育嬰室'}</span>
                    <span>✅ 無障礙升降機</span>
                </div>
                ${(st.exits || []).map(ex => `<div style="padding:9px 11px;border-radius:12px;border:1px solid var(--glass-border);margin-bottom:7px;font-size:0.8rem;font-weight:700;">🚪 ${ex}</div>`).join('')}
            `;
        } else {
            const hubs = ['CEN', 'ADM', 'MOK', 'KOT', 'TAW', 'AIR'].filter(h => h !== code);
            body.innerHTML = hubs.map(h => {
                const r = AuraCockpit.runStateDijkstra(code, h, 'fastest');
                return r ? `<div style="display:flex;justify-content:space-between;align-items:center;padding:9px 11px;border-radius:12px;border:1px solid var(--glass-border);margin-bottom:7px;cursor:pointer;" onclick="AuraHub.closeHologram();AuraCockpit.quickPlan('${code}','${h}')">
                    <div>
                        <div style="font-size:0.82rem;font-weight:800;">➔ 往 ${MTR_STATIONS[h].name}站</div>
                        <div style="font-size:0.68rem;color:var(--text-sub);">約 ${r.totalMin} 分鐘 • ${r.viaLabel}</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:0.9rem;font-weight:900;color:#10B981;">$${r.fare.oct.toFixed(1)}</div>
                        <div style="font-size:0.64rem;color:var(--text-sub);">八達通</div>
                    </div>
                </div>` : '';
            }).join('');
        }
    },
    closeHologram() {
        document.getElementById('station-hologram-modal').classList.add('hidden');
    }
};

/* =========================================================
   VIEW 3: NETWORK PULSE & HKO WEATHER + DRILL MODE
   ========================================================= */
const AuraPulse = {
    lines: Object.values(MTR_LINES).filter(l => !l.base),
    delayedSet: new Set(),
    drillActive: false,
    tempText: '24°C',
    init() {
        this.refresh(false);
    },
    async fetchWeather() {
        try {
            const res = await fetch('https://data.weather.gov.hk/weatherAPI/opendata/weather.php?dataType=rhrread&lang=tc');
            if (res.ok) {
                const j = await res.json();
                const tItem = (j.temperature && j.temperature.data && j.temperature.data.find(x => x.place === '香港天文台')) || (j.temperature && j.temperature.data && j.temperature.data[0]);
                const hItem = j.humidity && j.humidity.data && j.humidity.data[0];
                if (tItem) {
                    this.tempText = `${tItem.value}°C`;
                    const mainEl = document.getElementById('pulse-weather-main');
                    const subEl = document.getElementById('pulse-weather-sub');
                    if (mainEl) mainEl.innerText = `${tItem.value}°C • 濕度 ${hItem ? hItem.value + '%' : '--'}`;
                    if (subEl) subEl.innerText = `${tItem.place}實時觀測 • ${j.warningMessage && j.warningMessage.length ? j.warningMessage[0] : '天氣穩定，適合鐵路出行'}`;
                }
            }
        } catch(e) {}
        this.updateIsland();
    },
    updateIsland() {
        const pill = document.getElementById('aura-island-pill');
        const txt = document.getElementById('island-status-txt');
        const count = this.delayedSet.size;
        if (pill) pill.classList.toggle('alert', count > 0);
        if (txt) txt.innerText = count > 0 ? `${count} 條路綫延誤 • ${this.tempText}` : `全網正常 • ${this.tempText}`;
    },
    toggleDrill() {
        this.drillActive = !this.drillActive;
        if (this.drillActive) {
            this.delayedSet.add('KTL');
            this.delayedSet.add('EAL');
            AuraToast.show('🚨 已啟動延誤演習：觀塘綫 & 東鐵綫');
        } else {
            this.delayedSet.clear();
            AuraToast.show('✅ 已結束延誤演習，全網恢復正常');
        }
        const btn = document.getElementById('pulse-drill-btn');
        if (btn) btn.innerText = this.drillActive ? '✅ 恢復正常' : '🚨 延誤演習';
        this.updateIsland();
        this.renderGrid();
    },
    toggleLineDelay(id) {
        if (this.delayedSet.has(id)) this.delayedSet.delete(id);
        else this.delayedSet.add(id);
        this.updateIsland();
        this.renderGrid();
    },
    renderGrid() {
        const grid = document.getElementById('pulse-lines-grid');
        if (!grid) return;
        grid.innerHTML = this.lines.map((l, idx) => {
            const isDel = this.delayedSet.has(l.id);
            return `<div class="pulse-line-bento anim-stagger ${isDel?'delayed':''}" style="--i:${idx};border-left:4px solid ${l.color};" onclick="AuraPulse.toggleLineDelay('${l.id}')">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:0.9rem;font-weight:900;">${l.name} <span style="font-size:0.68rem;color:var(--text-sub);font-weight:600;">${l.en}</span></div>
                        <div style="font-size:0.68rem;color:var(--text-sub);margin-top:2px;">${l.stations.length} 個車站 • ${l.cars} 卡編組</div>
                    </div>
                    <span style="font-size:0.72rem;font-weight:800;padding:4px 9px;border-radius:999px;background:${isDel?'rgba(244,63,94,0.2)':'rgba(16,185,129,0.16)'};color:${isDel?'#FB7185':'#34D399'};">${isDel ? '⚠️ 預計額外 +12 分鐘' : '● 服務正常'}</span>
                </div>
                <div class="alt-box drawer-anim ${isDel?'':'hidden'}">
                    <b>🚨 建議替代路綫：</b>系統已偵測 ${l.name} 班次受阻，建議改乘屯馬綫或前往路綫導航艙切換「最少轉乘 / 同月台優先」避開擠塞路段。
                </div>
            </div>`;
        }).join('');
    },
    refresh(showFeedback) {
        if (showFeedback) {
            AuraToast.show('↻ 正在同步全網車務...');
            const ic = document.getElementById('pulse-refresh-icon');
            if (ic) { ic.classList.remove('spinning-icon'); void ic.offsetWidth; ic.classList.add('spinning-icon'); }
        }
        this.fetchWeather();
        this.renderGrid();
    }
};

/* =========================================================
   BOOT SEQUENCE
   ========================================================= */
function startHktClock() {
    const el = document.getElementById('aura-hkt-clock');
    const tick = () => {
        if (!el) return;
        const d = new Date();
        const hkt = new Date(d.getTime() + (d.getTimezoneOffset() + 480) * 60000);
        el.innerText = 'HKT ' + hkt.toTimeString().slice(0, 8);
    };
    tick();
    setInterval(tick, 1000);
}

window.addEventListener('DOMContentLoaded', () => {
    AuraTheme.init();
    startHktClock();
    AuraDashboard.init();
    AuraCockpit.init();
    AuraHub.init();
    AuraPulse.init();
    // Try loading mtr_fares.json only when running inside native Capacitor APK
    if (window.Capacitor && typeof window.fetch === 'function') {
        window.fetch('./' + 'mtr_fares.json').then(r => r.ok ? r.json() : null).then(d => {
            if (d) window.MTR_FARES_TABLE = d;
        }).catch(() => {});
    }
});

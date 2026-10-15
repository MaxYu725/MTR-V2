// ==========================================
// MTR Metro Ultra - 全網資料庫 (車站、路線、轉乘指引、出口與設施)
// ==========================================

const MTR_DIRECTIONS = {
    'TWL': { UP: '荃灣', DOWN: '中環' },
    'KTL': { UP: '調景嶺', DOWN: '黃埔' },
    'ISL': { UP: '柴灣', DOWN: '堅尼地城' },
    'TKO': { UP: '寶琳 / 康城', DOWN: '北角' },
    'EAL': { UP: '羅湖 / 落馬洲', DOWN: '金鐘' },
    'TML': { UP: '烏溪沙', DOWN: '屯門' },
    'TCL': { UP: '東涌', DOWN: '香港' },
    'AEL': { UP: '博覽館', DOWN: '香港' },
    'DRL': { UP: '迪士尼', DOWN: '欣澳' },
    'SIL': { UP: '海怡半島', DOWN: '金鐘' }
};

const MAJOR_STATIONS = [
    'CEN', 'ADM', 'TST', 'MOK', 'PRE', 'KOT', 'TAW', 'HUH', 'MEF', 'LAK', 'NAC', 'TSY',
    'HOK', 'QUO', 'NOP', 'YAT', 'TIK', 'TKO', 'DIH', 'HOM', 'WHA', 'KET', 'CHW', 'TSW',
    'TUM', 'WUM', 'POA', 'LOW', 'LMC', 'AIR', 'SOH'
];

const LINE_DETAILS = {
    'TWL': { peak: '2.0 分鐘', offPeak: '3.5 - 5 分鐘', cars: '8 卡列車', altTransport: '建議改乘渡輪（天星小輪來往尖沙咀/中環灣仔）或彌敦道沿線九巴（如 1, 2, 6, 9, 102, 104, 905 號線）。' },
    'KTL': { peak: '2.1 分鐘', offPeak: '3.5 - 5 分鐘', cars: '8 卡列車', altTransport: '建議改乘觀塘道及龍翔道沿線巴士（如 1A, 11B, 38, 42C, 74X, 89, 101, 619 號線）。' },
    'ISL': { peak: '1.9 分鐘', offPeak: '3.5 - 5 分鐘', cars: '8 卡列車', altTransport: '建議改乘香港電車（叮叮）或軒尼詩道/英皇道沿線城巴（如 2, 5B, 8P, 10, 720, 788 號線）。' },
    'TKO': { peak: '2.5 分鐘', offPeak: '4 - 6 分鐘', cars: '8 卡列車', altTransport: '建議於調景嶺/將軍澳改乘 796X, 798, 98D, 690, 694 號巴士前往九龍或港島。' },
    'EAL': { peak: '2.7 分鐘', offPeak: '4 - 8 分鐘', cars: '9 卡列車（設頭等車廂）', altTransport: '建議改乘 72X, 74X, 81C, 270A, 277X, 307 或過海隧巴 170, 182, 978 號線。' },
    'TML': { peak: '2.7 分鐘', offPeak: '4 - 6 分鐘', cars: '8 卡列車', altTransport: '新界西可改乘屯門公路轉車站巴士（58M, 60X, 960, 961）；馬鞍山可改乘 85X, 89D, 680, 681 號線。' },
    'TCL': { peak: '3.5 分鐘', offPeak: '5 - 7 分鐘', cars: '8 卡列車', altTransport: '建議改乘城巴 E11, E21, E22, E23 或青嶼幹線轉車站巴士路線。' },
    'AEL': { peak: '10 分鐘', offPeak: '10 - 15 分鐘', cars: '8 卡專列', altTransport: '建議改乘城巴機場快線（A11 往港島、A21 往尖沙咀旺角、A29 往將軍澳）或東涌綫轉乘 S1 巴士。' },
    'DRL': { peak: '5 分鐘', offPeak: '10 分鐘', cars: '4 卡主題列車', altTransport: '建議於欣澳站改乘港鐵免費接駁巴士或迪士尼樂園巴士 R8 號線。' },
    'SIL': { peak: '3.3 分鐘', offPeak: '4.5 - 6 分鐘', cars: '3 卡全自動列車', altTransport: '建議經香港仔隧道改乘城巴 37A, 37B, 70, 72, 75, 90, 97, 592 號線前往金鐘及銅鑼灣。' }
};

const TRANSFER_GUIDE = {
    'ADM': {
        'TWL-ISL': { walk: 0.5, crossPlatform: true, tip: '同層對面月台直達轉乘（建議車廂：第 4-6 卡）' },
        'ISL-TWL': { walk: 0.5, crossPlatform: true, tip: '同層對面月台直達轉乘（建議車廂：第 4-6 卡）' },
        'default': { walk: 2.5, crossPlatform: false, tip: '經金鐘站擴建大堂扶手電梯轉乘東鐵綫或南港島綫（建議車廂：第 5-7 卡）' }
    },
    'MOK': {
        'TWL-KTL': { walk: 0.5, crossPlatform: true, tip: '同層對面月台直達轉乘（同方向轉乘極速 30 秒，建議車廂：第 3-6 卡）' },
        'KTL-TWL': { walk: 0.5, crossPlatform: true, tip: '同層對面月台直達轉乘（同方向轉乘極速 30 秒，建議車廂：第 3-6 卡）' },
        'default': { walk: 1.0, crossPlatform: true, tip: '月台扶手電梯上下層轉乘' }
    },
    'PRE': {
        'TWL-KTL': { walk: 0.5, crossPlatform: true, tip: '同層對面月台直達轉乘（逆方向過海首選，建議車廂：第 3-6 卡）' },
        'KTL-TWL': { walk: 0.5, crossPlatform: true, tip: '同層對面月台直達轉乘（逆方向過海首選，建議車廂：第 3-6 卡）' },
        'default': { walk: 1.0, crossPlatform: true, tip: '月台扶手電梯上下層轉乘' }
    },
    'CEN': {
        'TWL-ISL': { walk: 1.0, crossPlatform: false, tip: '經月台扶手電梯直接上下層轉乘（建議車廂：第 4-5 卡）' },
        'ISL-TWL': { walk: 1.0, crossPlatform: false, tip: '經月台扶手電梯直接上下層轉乘（建議車廂：第 4-5 卡）' },
        'default': { walk: 5.5, crossPlatform: false, tip: '經行人隧道步行前往香港站轉乘東涌綫／機場快綫（設自動行人道）' }
    },
    'HOK': {
        'default': { walk: 5.5, crossPlatform: false, tip: '經中環／香港站行人隧道轉乘荃灣綫或港島綫' }
    },
    'NOP': {
        'ISL-TKO': { walk: 0.5, crossPlatform: true, tip: '同層對面月台直達轉乘（過海往將軍澳最快捷，建議車廂：第 4-6 卡）' },
        'TKO-ISL': { walk: 0.5, crossPlatform: true, tip: '同層對面月台直達轉乘（往港島東/中環最快捷，建議車廂：第 4-6 卡）' },
        'default': { walk: 1.0, crossPlatform: true, tip: '同層月台通道轉乘' }
    },
    'QUO': {
        'default': { walk: 3.5, crossPlatform: false, tip: '需經長通道及升降機／扶手電梯轉乘（建議改於北角站同月台轉乘更省時）' }
    },
    'YAT': {
        'KTL-TKO': { walk: 0.5, crossPlatform: true, tip: '上下層／對面月台轉乘（過海往北角在此轉乘，建議車廂：第 4-5 卡）' },
        'TKO-KTL': { walk: 0.5, crossPlatform: true, tip: '上下層／對面月台轉乘（往觀塘／九龍塘在此轉乘，建議車廂：第 4-5 卡）' },
        'default': { walk: 1.5, crossPlatform: false, tip: '經月台扶手電梯上下層轉乘' }
    },
    'TIK': {
        'KTL-TKO': { walk: 0.5, crossPlatform: true, tip: '同層對面月台直達轉乘（往將軍澳／寶琳／康城在此轉乘，建議車廂：第 3-5 卡）' },
        'TKO-KTL': { walk: 0.5, crossPlatform: true, tip: '同層對面月台直達轉乘（往九龍方向始發站有座位，建議車廂：第 3-5 卡）' },
        'default': { walk: 1.2, crossPlatform: true, tip: '同層月台或扶手電梯轉乘' }
    },
    'LAK': {
        'TWL-TCL': { walk: 0.5, crossPlatform: true, tip: '同層對面月台直達轉乘（往香港站／中環快速通道，建議車廂：第 4-6 卡）' },
        'TCL-TWL': { walk: 0.5, crossPlatform: true, tip: '同層對面月台直達轉乘（往葵芳／荃灣／旺角，建議車廂：第 4-6 卡）' },
        'default': { walk: 1.5, crossPlatform: false, tip: '月台橋樑通道轉乘' }
    },
    'NAC': {
        'default': { walk: 2.0, crossPlatform: false, tip: '東涌綫往香港方向與屯馬綫往屯門方向可同層通道轉乘（建議車廂：第 5-6 卡）' }
    },
    'MEF': {
        'default': { walk: 4.5, crossPlatform: false, tip: '需經轉乘通道步行約 4-5 分鐘連接荃灣綫與屯馬綫大堂' }
    },
    'KOT': {
        'default': { walk: 3.5, crossPlatform: false, tip: '經轉乘大堂行人通道連接觀塘綫與東鐵綫（建議車廂：觀塘綫第 3-5 卡 / 東鐵綫第 5-6 卡）' }
    },
    'TAW': {
        'default': { walk: 1.5, crossPlatform: false, tip: '南行往九龍方向設月台跨橋直達轉乘（建議車廂：第 4-6 卡）' }
    },
    'HUH': {
        'default': { walk: 2.0, crossPlatform: false, tip: '上下層月台直接扶手電梯轉乘東鐵綫與屯馬綫（建議車廂：第 4-6 卡）' }
    },
    'DIH': {
        'default': { walk: 2.0, crossPlatform: false, tip: '經轉乘大堂通道連接觀塘綫與屯馬綫（建議車廂：第 3-5 卡）' }
    },
    'HOM': {
        'default': { walk: 2.5, crossPlatform: false, tip: '經中層十字轉乘大堂扶手電梯連接觀塘綫與屯馬綫' }
    },
    'SUN': {
        'default': { walk: 1.5, crossPlatform: false, tip: '經月台天橋對面轉乘迪士尼綫主題列車' }
    },
    'TSY': {
        'default': { walk: 2.0, crossPlatform: false, tip: '同層大堂轉乘機場快綫或東涌綫' }
    }
};

const MtrData = {
    lines: [
        { id: 'TWL', name: '荃灣綫', en: 'Tsuen Wan Line', color: '#e2231a', path: ['CEN','ADM','TST','JOR','YMT','MOK','PRE','SSP','CSW','LCK','MEF','LAK','KWF','TWH','TSW'] },
        { id: 'KTL', name: '觀塘綫', en: 'Kwun Tong Line', color: '#00af41', path: ['WHA','HOM','YMT','MOK','PRE','SKM','KOT','LOF','WTS','DIH','CHH','KOB','NTK','KWT','LAT','YAT','TIK'] },
        { id: 'ISL', name: '港島綫', en: 'Island Line', color: '#0071ce', path: ['KET','HKU','SYP','SHW','CEN','ADM','WAC','CAB','TIN','FOH','NOP','QUO','TAK','SOW','HFC','CHW'] },
        { id: 'TKO', name: '將軍澳綫', en: 'Tseung Kwan O Line', color: '#8d3685', path: ['NOP','QUO','YAT','TIK','TKO','HAH','POA'], searchPath: ['NOP','QUO','YAT','TIK','TKO','HAH','POA','LHP'] },
        { id: 'TKO_B', name: '將軍澳綫(康城)', en: 'TKO Line (LOHAS Park)', color: '#8d3685', path: ['TKO','LHP'], isBranch: true },
        { id: 'EAL', name: '東鐵綫', en: 'East Rail Line', color: '#53b7e8', path: ['ADM','EXC','HUH','MKK','KOT','TAW','SHT','FOT','UNI','TAP','TWO','FAN','SHS','LOW'], searchPath: ['ADM','EXC','HUH','MKK','KOT','TAW','SHT','FOT','RAC','UNI','TAP','TWO','FAN','SHS','LOW','LMC'] },
        { id: 'EAL_B', name: '東鐵綫(落馬洲)', en: 'East Rail (Lok Ma Chau)', color: '#53b7e8', path: ['SHS','LMC'], isBranch: true },
        { id: 'EAL_R', name: '東鐵綫(馬場)', en: 'East Rail (Racecourse)', color: '#53b7e8', path: ['FOT','RAC','UNI'], isBranch: true },
        { id: 'TML', name: '屯馬綫', en: 'Tuen Ma Line', color: '#9a3820', path: ['TUM','SIH','TIS','LOP','YUL','KSR','TWW','MEF','NAC','AUS','ETS','HUH','HOM','TKW','SUW','KAT','DIH','HIK','TAW','CKT','STW','CIO','SHM','TSH','HEO','MOS','WUM'] },
        { id: 'TCL', name: '東涌綫', en: 'Tung Chung Line', color: '#f38b00', path: ['HOK','KOW','OLY','NAC','LAK','TSY','SUN','TUC'] },
        { id: 'AEL', name: '機場快綫', en: 'Airport Express', color: '#00838f', path: ['HOK','KOW','TSY','AIR','AWE'] },
        { id: 'DRL', name: '迪士尼綫', en: 'Disneyland Resort Line', color: '#f550a1', path: ['SUN','DIS'] },
        { id: 'SIL', name: '南港島綫', en: 'South Island Line', color: '#b6bd00', path: ['ADM','OCP','WCH','LET','SOH'] }
    ],
    stations: {
        'KET': { name: '堅尼地城', en: 'Kennedy Town', lat: 22.2818, lon: 114.1273, toilet: true, baby: true, first: '06:00', last: '00:50', exits: ['A: 士美菲路 / 小巴總站', 'B: 石山街 / 北街', 'C: 科士街 / 加多近街海濱長廊'] },
        'HKU': { name: '香港大學', en: 'HKU', lat: 22.2835, lon: 114.1350, toilet: true, baby: true, first: '06:02', last: '00:52', exits: ['A: 香港大學本部校園', 'B: 屈地街 / 石塘咀市政大廈', 'C: 薄扶林道 / 寶翠園'] },
        'SYP': { name: '西營盤', en: 'Sai Ying Pun', lat: 22.2860, lon: 114.1420, toilet: true, baby: false, first: '06:04', last: '00:54', exits: ['A: 皇后大道西 / 東邊街', 'B: 第一街 / 第二街 / 正街', 'C: 般咸道 / 英皇書院'] },
        'SHW': { name: '上環', en: 'Sheung Wan', lat: 22.2865, lon: 114.1520, toilet: false, baby: false, first: '06:06', last: '00:56', exits: ['A: 永樂街 / 德輔道中', 'D: 信德中心 / 港澳碼頭', 'E: 無限極廣場 / 中環中心'] },
        'CEN': { name: '中環', en: 'Central', lat: 22.2815, lon: 114.1580, toilet: true, baby: true, first: '06:06', last: '00:54', exits: ['A: 中環碼頭 / IFC 國際金融中心', 'D: 畢打街 / 蘭桂坊 / 置地廣場', 'J: 遮打花園 / 終審法院', 'K: 皇后像廣場 / 滙豐總行大廈'] },
        'ADM': { name: '金鐘', en: 'Admiralty', lat: 22.2798, lon: 114.1648, toilet: true, baby: true, first: '06:04', last: '00:56', exits: ['A: 海富中心 / 政府總部', 'B: 海洋公園巴士站 / 德立街', 'C: 金鐘廊 / 太古廣場', 'E: 香港公園 / 山頂纜車徑'] },
        'WAC': { name: '灣仔', en: 'Wan Chai', lat: 22.2775, lon: 114.1725, toilet: false, baby: false, first: '06:06', last: '00:58', exits: ['A1: 入境事務大樓 / 香港會議展覽中心', 'A3: 太原街 / 莊士敦道', 'B: 修頓球場 / 利東街（囍帖街）'] },
        'CAB': { name: '銅鑼灣', en: 'Causeway Bay', lat: 22.2795, lon: 114.1840, toilet: false, baby: false, first: '06:08', last: '01:00', exits: ['A: 時代廣場 (Times Square)', 'D: 崇光百貨 (SOGO)', 'E: 維多利亞公園 / 皇室堡', 'F: 希慎廣場 (Hysan Place) / 渣甸坊'] },
        'TIN': { name: '天后', en: 'Tin Hau', lat: 22.2825, lon: 114.1915, toilet: true, baby: false, first: '06:10', last: '01:02', exits: ['A1: 英皇道 / 維多利亞公園泳池', 'A2: 電氣道美食街', 'B: 銅鑼灣天后廟'] },
        'FOH': { name: '炮台山', en: 'Fortress Hill', lat: 22.2885, lon: 114.1940, toilet: false, baby: false, first: '06:11', last: '01:04', exits: ['A: 油街實現 / 東岸公園主題區', 'B: 康澤花園 / 炮台山道'] },
        'NOP': { name: '北角', en: 'North Point', lat: 22.2915, lon: 114.2005, toilet: true, baby: true, first: '05:58', last: '01:06', exits: ['A1: 渣華道 / 北角匯 (Harbour North)', 'B1: 英皇道 / 新光戲院', 'B4: 七姊妹道'] },
        'QUO': { name: '鰂魚涌', en: 'Quarry Bay', lat: 22.2830, lon: 114.2115, toilet: true, baby: false, first: '06:00', last: '01:08', exits: ['A: 太古坊 (Taikoo Place) / 英皇道', 'B: 芬尼街', 'C: 模範里 / 怪獸大廈（海山樓）'] },
        'TAK': { name: '太古', en: 'Tai Koo', lat: 22.2840, lon: 114.2205, toilet: false, baby: false, first: '06:02', last: '01:10', exits: ['A: 太古城中心 / 康怡廣場', 'D: 太古城道', 'E: 康山花園 / 吉之島'] },
        'SOW': { name: '西灣河', en: 'Sai Wan Ho', lat: 22.2820, lon: 114.2230, toilet: true, baby: false, first: '06:04', last: '01:12', exits: ['A: 蘇豪東 (Soho East) / 鯉景灣 / 香港電影資料館', 'B: 筲箕灣道 / 太安樓美食街'] },
        'HFC': { name: '杏花邨', en: 'Heng Fa Chuen', lat: 22.2770, lon: 114.2385, toilet: false, baby: false, first: '06:00', last: '01:16', exits: ['A1: 杏花新城 (Paradise Mall)', 'A2: 杏花邨海濱長廊'] },
        'CHW': { name: '柴灣', en: 'Chai Wan', lat: 22.2645, lon: 114.2395, toilet: true, baby: false, first: '05:55', last: '00:35', exits: ['A: 新翠商場 / 青年廣場', 'C: 利眾街工業區', 'D: 怡順街 / 柴灣公園'] },
        'TST': { name: '尖沙咀', en: 'Tsim Sha Tsui', lat: 22.2975, lon: 114.1725, toilet: true, baby: true, first: '06:06', last: '00:59', exits: ['A1: 九龍公園 / 海防道', 'B2: 金馬倫道', 'E: 半島酒店 / 香港太空館 / 文化中心', 'H: iSQUARE 國際廣場', 'L6: 1881 Heritage / 天星碼頭'] },
        'JOR': { name: '佐敦', en: 'Jordan', lat: 22.3045, lon: 114.1715, toilet: false, baby: false, first: '06:08', last: '01:01', exits: ['A: 廟街夜市 / 裕華國貨', 'C2: 寶靈街 / 澳洲牛奶公司', 'D: 柯士甸道'] },
        'YMT': { name: '油麻地', en: 'Yau Ma Tei', lat: 22.3130, lon: 114.1706, toilet: true, baby: false, first: '06:06', last: '01:03', exits: ['A2: 碧街 / 廣華醫院', 'B2: 油麻地戲院 / 果欄', 'C: 文明里 / 廟街'] },
        'MOK': { name: '旺角', en: 'Mong Kok', lat: 22.3200, lon: 114.1695, toilet: true, baby: false, first: '06:05', last: '01:05', exits: ['B3: 旺角道 / 新世紀廣場通道', 'C3: 朗豪坊 (Langham Place)', 'D2: 女人街（通菜街）', 'E2: 波鞋街（花園街）/ 銀行中心'] },
        'PRE': { name: '太子', en: 'Prince Edward', lat: 22.3245, lon: 114.1682, toilet: true, baby: true, first: '06:04', last: '01:07', exits: ['A: 旺角大球場', 'B1: 花墟道 / 太子道西', 'B2: 始創中心 / 西洋菜北街', 'C1: 金都商場 / 彌敦道'] },
        'SSP': { name: '深水埗', en: 'Sham Shui Po', lat: 22.3305, lon: 114.1610, toilet: false, baby: false, first: '06:06', last: '01:09', exits: ['A2: 鴨寮街電子市場', 'B2: 北河街市政大廈', 'C2: 西九龍中心', 'D2: 高登 / 黃金電腦商場'] },
        'CSW': { name: '長沙灣', en: 'Cheung Sha Wan', lat: 22.3340, lon: 114.1555, toilet: false, baby: false, first: '06:04', last: '01:11', exits: ['A1: 長沙灣道', 'A3: 東京街 / 麗閣商場', 'C2: 長沙灣政府合署'] },
        'LCK': { name: '荔枝角', en: 'Lai Chi Kok', lat: 22.3365, lon: 114.1485, toilet: false, baby: false, first: '06:02', last: '01:13', exits: ['A: 長沙灣廣場', 'B1: 大南西街工業區', 'D2: D2 Place 一期及二期'] },
        'MEF': { name: '美孚', en: 'Mei Foo', lat: 22.3330, lon: 114.1385, toilet: true, baby: true, first: '06:00', last: '01:15', exits: ['A: 美孚新邨百老匯街', 'B: 萬事達廣場', 'D: 荔枝角公園 / 饒宗頤文化館', 'G: 曼克頓山'] },
        'LAK': { name: '荔景', en: 'Lai King', lat: 22.3530, lon: 114.1335, toilet: true, baby: false, first: '06:02', last: '01:18', exits: ['A1: 荔景邨 / 賢麗苑', 'B: 貨櫃碼頭路', 'C: 浩景臺'] },
        'KWF': { name: '葵芳', en: 'Kwai Fong', lat: 22.3590, lon: 114.1275, toilet: true, baby: false, first: '06:04', last: '01:20', exits: ['C: 葵涌運動場', 'D: 新都會廣場 / 葵涌廣場美食街'] },
        'TWH': { name: '葵興', en: 'Kwai Hing', lat: 22.3685, lon: 114.1270, toilet: true, baby: false, first: '06:02', last: '01:22', exits: ['A: 新葵興廣場 / 葵興邨', 'B: 九龍貿易中心 (KCC)'] },
        'TSW': { name: '荃灣', en: 'Tsuen Wan', lat: 22.3735, lon: 114.1185, toilet: true, baby: true, first: '06:00', last: '00:30', exits: ['A: 愉景新城 (D-Park) / 綠楊坊', 'B: 千色匯 / 眾安街', 'C: 大河道'] },
        'WHA': { name: '黃埔', en: 'Whampoa', lat: 22.3032, lon: 114.1885, toilet: true, baby: true, first: '06:10', last: '00:40', exits: ['A: 民兆街 / 紅磡邨', 'B: 紅磡道', 'C: 黃埔天地（聚寶坊/美食坊）', 'D: 黃埔號 / 海濱長廊'] },
        'HOM': { name: '何文田', en: 'Ho Man Tin', lat: 22.3090, lon: 114.1810, toilet: true, baby: true, first: '06:06', last: '00:58', exits: ['A3: 何文田邨 / 愛民邨 / 香港公開大學', 'B1: 蕪湖街 / 紅磡觀音廟'] },
        'SKM': { name: '石硤尾', en: 'Shek Kip Mei', lat: 22.3320, lon: 114.1690, toilet: true, baby: false, first: '06:05', last: '01:02', exits: ['A: 南山邨 / 大坑東道', 'B1: 窩仔街', 'C: 賽馬會創意藝術中心 (JCCAC) / 美荷樓'] },
        'KOT': { name: '九龍塘', en: 'Kowloon Tong', lat: 22.3372, lon: 114.1759, toilet: true, baby: true, first: '05:56', last: '01:05', exits: ['C2: 又一城 (Festival Walk) / 香港城市大學', 'D: 公共交通交匯處', 'E: 教育局九龍塘教育服務中心', 'F: 香港浸會大學'] },
        'LOF': { name: '樂富', en: 'Lok Fu', lat: 22.3385, lon: 114.1870, toilet: false, baby: false, first: '06:05', last: '01:07', exits: ['A: 樂富廣場 (Lok Fu Place)', 'B: 聯合道 / 九龍寨城公園'] },
        'WTS': { name: '黃大仙', en: 'Wong Tai Sin', lat: 22.3418, lon: 114.1939, toilet: true, baby: false, first: '06:03', last: '01:09', exits: ['B2: 嗇色園黃大仙祠', 'B3: 黃大仙中心北館', 'D3: 黃大仙中心南館'] },
        'DIH': { name: '鑽石山', en: 'Diamond Hill', lat: 22.3400, lon: 114.2016, toilet: true, baby: true, first: '06:01', last: '01:11', exits: ['A2: 采頤花園 / 新蒲崗', 'B: 采頤花園巴士總站', 'C1: 志蓮淨苑 / 南蓮園池', 'C2: 荷里活廣場 (Plaza Hollywood)'] },
        'CHH': { name: '彩虹', en: 'Choi Hung', lat: 22.3335, lon: 114.2040, toilet: false, baby: false, first: '06:00', last: '01:13', exits: ['A2: 坪石邨', 'C3: 彩虹邨（打卡籃球場）/ 牛池灣文娛中心'] },
        'KOB': { name: '九龍灣', en: 'Kowloon Bay', lat: 22.3236, lon: 114.2140, toilet: true, baby: true, first: '06:01', last: '01:15', exits: ['A: 德福廣場 (Telford Plaza) / 零碳天地 / MegaBox 穿梭巴', 'B: 淘大商場 / 東九文化中心'] },
        'NTK': { name: '牛頭角', en: 'Ngau Tau Kok', lat: 22.3155, lon: 114.2200, toilet: true, baby: false, first: '06:03', last: '01:17', exits: ['A: 創紀之城一期 / 花園大廈', 'B: 牛頭角道 / 鴻圖道工業區'] },
        'KWT': { name: '觀塘', en: 'Kwun Tong', lat: 22.3125, lon: 114.2265, toilet: true, baby: true, first: '06:00', last: '01:19', exits: ['A1: 裕民坊 (YM²) / 觀塘道', 'A2: apm 商場 / 創紀之城五期', 'B: 開源道 / 駱駝漆大廈美食區', 'D4: 觀塘海濱花園'] },
        'LAT': { name: '藍田', en: 'Lam Tin', lat: 22.3060, lon: 114.2375, toilet: false, baby: false, first: '06:02', last: '01:21', exits: ['A: 匯景廣場 / 藍田邨', 'D1: 茜發道 / 麗港城'] },
        'YAT': { name: '油塘', en: 'Yau Tong', lat: 22.2945, lon: 114.2360, toilet: true, baby: true, first: '06:00', last: '01:23', exits: ['A1: 大本型 (Domain) / 油塘邨', 'B2: 茶果嶺道 / 鯉魚門海鮮街'] },
        'TIK': { name: '調景嶺', en: 'Tiu Keng Leng', lat: 22.3045, lon: 114.2525, toilet: true, baby: true, first: '05:58', last: '01:25', exits: ['A1: 都會駅商場 / 公共圖書館', 'B: 維景灣畔 / 知專設計學院'] },
        'TKO': { name: '將軍澳', en: 'Tseung Kwan O', lat: 22.3075, lon: 114.2595, toilet: true, baby: true, first: '06:02', last: '01:16', exits: ['A: 將軍澳廣場 / 尚德邨', 'B: 將軍澳中心 / 海濱南橋', 'C: PopCorn 商場'] },
        'HAH': { name: '坑口', en: 'Hang Hau', lat: 22.3155, lon: 114.2645, toilet: true, baby: false, first: '06:00', last: '01:18', exits: ['A: 東港城 (East Point City) / 連理街', 'B: 新寶城 / 坑口文曲里公園'] },
        'POA': { name: '寶琳', en: 'Po Lam', lat: 22.3225, lon: 114.2590, toilet: true, baby: true, first: '06:00', last: '00:50', exits: ['A: 新都城中心二期 (MCP Central)', 'B: 新都城中心三期', 'C: 貿業路'] },
        'LHP': { name: '康城', en: 'LOHAS Park', lat: 22.2965, lon: 114.2680, toilet: true, baby: true, first: '06:00', last: '00:45', exits: ['A: 首都 / 領都', 'B: The LOHAS 康城商場 / 溜冰場', 'C: 日出公園'] },
        'EXC': { name: '會展', en: 'Exhibition Centre', lat: 22.2818, lon: 114.1740, toilet: true, baby: true, first: '06:02', last: '00:55', exits: ['A: 灣仔碼頭 / 海濱長廊', 'B: 香港會議展覽中心 / 鷹君中心'] },
        'HUH': { name: '紅磡', en: 'Hung Hom', lat: 22.3030, lon: 114.1818, toilet: true, baby: true, first: '05:55', last: '01:02', exits: ['A: 理工大學 (PolyU)', 'B: 紅磡海底隧道收費廣場巴士站', 'D1: 香港體育館（紅館）/ 置富都會'] },
        'MKK': { name: '旺角東', en: 'Mong Kok East', lat: 22.3225, lon: 114.1720, toilet: true, baby: true, first: '05:58', last: '01:04', exits: ['B: 旺角政府合署 / 花園街', 'C: 染布房街', 'D: MOKO 新世紀廣場'] },
        'TAW': { name: '大圍', en: 'Tai Wai', lat: 22.3730, lon: 114.1785, toilet: true, baby: true, first: '05:50', last: '01:12', exits: ['A: 村南道（單車租賃區）', 'B: 圍方 (The Wai) 商場 / 公共運輸交匯處', 'C: 美田路'] },
        'SHT': { name: '沙田', en: 'Sha Tin', lat: 22.3820, lon: 114.1870, toilet: true, baby: true, first: '05:45', last: '01:14', exits: ['A: 新城市廣場 (New Town Plaza) / 史諾比開心世界', 'B: 排頭村 / 萬佛寺'] },
        'FOT': { name: '火炭', en: 'Fo Tan', lat: 22.3955, lon: 114.1955, toilet: true, baby: false, first: '05:48', last: '01:16', exits: ['A: 火炭工業區', 'C: 駿洋商場 / 御龍山', 'D: 星凱‧堤岸'] },
        'RAC': { name: '馬場', en: 'Racecourse', lat: 22.4000, lon: 114.2050, toilet: true, baby: false, first: '賽馬日提供', last: '賽馬日提供', exits: ['A: 沙田馬場看台（僅於沙田賽馬日及特定活動開放）'] },
        'UNI': { name: '大學', en: 'University', lat: 22.4135, lon: 114.2105, toilet: true, baby: false, first: '05:51', last: '01:20', exits: ['A: 香港中文大學 (CUHK) 校園巴士站', 'B: 澤祥街 / 馬料水碼頭（往塔門/東平洲）', 'D: 崇基學院'] },
        'TAP': { name: '大埔墟', en: 'Tai Po Market', lat: 22.4430, lon: 114.1685, toilet: true, baby: true, first: '05:45', last: '01:25', exits: ['A: 新達廣場 / 大埔綜合大樓街市', 'B: 香港鐵路博物館 / 廣福邨'] },
        'TWO': { name: '太和', en: 'Tai Wo', lat: 22.4510, lon: 114.1610, toilet: true, baby: false, first: '05:43', last: '01:27', exits: ['A: 太和廣場 / 太和邨', 'B: 寶雅苑 / 大埔頭'] },
        'FAN': { name: '粉嶺', en: 'Fanling', lat: 22.4920, lon: 114.1390, toilet: true, baby: false, first: '05:40', last: '01:31', exits: ['A: 粉嶺名都 / 粉嶺中心', 'B: 蓬瀛仙館', 'C: 百福田心公園'] },
        'SHS': { name: '上水', en: 'Sheung Shui', lat: 22.5020, lon: 114.1280, toilet: true, baby: true, first: '05:38', last: '01:33', exits: ['A4: 上水廣場 (Landmark North) / 石湖墟', 'B2: 彩園廣場', 'C: 公共小巴總站'] },
        'LOW': { name: '羅湖', en: 'Lo Wu', lat: 22.5285, lon: 114.1130, toilet: true, baby: true, first: '05:55', last: '23:55', exits: ['A: 羅湖管制站（前往深圳羅湖口岸，服務時間至午夜 12 時）'] },
        'LMC': { name: '落馬洲', en: 'Lok Ma Chau', lat: 22.5165, lon: 114.0655, toilet: true, baby: true, first: '06:30', last: '22:30', exits: ['A: 落馬洲支線管制站（前往深圳福田口岸，服務時間 06:30 - 22:30）'] },
        'WUM': { name: '烏溪沙', en: 'Wu Kai Sha', lat: 22.4285, lon: 114.2435, toilet: true, baby: true, first: '05:38', last: '00:40', exits: ['A1: 迎海 (Double Cove) / 烏溪沙沙灘', 'B: 銀湖‧天峰 / 公共運輸交匯處'] },
        'MOS': { name: '馬鞍山', en: 'Ma On Shan', lat: 22.4245, lon: 114.2315, toilet: true, baby: true, first: '05:40', last: '00:42', exits: ['A: 馬鞍山廣場 / 新港城中心 (MOSTown)', 'B: 馬鞍山公園 / 海濱長廊'] },
        'HEO': { name: '恆安', en: 'Heng On', lat: 22.4180, lon: 114.2245, toilet: true, baby: false, first: '05:42', last: '00:44', exits: ['A: 聽濤雅苑', 'B: 恆安邨 / 頌安邨'] },
        'TSH': { name: '大水坑', en: 'Tai Shui Hang', lat: 22.4095, lon: 114.2215, toilet: true, baby: false, first: '05:44', last: '00:46', exits: ['A: 錦泰苑', 'B: 富安花園 / 梅子林路'] },
        'SHM': { name: '石門', en: 'Shek Mun', lat: 22.3875, lon: 114.2085, toilet: true, baby: false, first: '05:47', last: '00:49', exits: ['A: 碩門邨', 'C: 京瑞廣場一期及二期美食區'] },
        'CIO': { name: '第一城', en: 'City One', lat: 22.3825, lon: 114.2035, toilet: true, baby: false, first: '05:49', last: '00:51', exits: ['C: 置富第一城 / 沙田第一城', 'D: 威爾斯親王醫院'] },
        'STW': { name: '沙田圍', en: 'Sha Tin Wai', lat: 22.3775, lon: 114.1955, toilet: true, baby: false, first: '05:51', last: '00:53', exits: ['A: 乙明邨', 'C: 沙角邨 / 博康邨'] },
        'CKT': { name: '車公廟', en: 'Che Kung Temple', lat: 22.3745, lon: 114.1865, toilet: true, baby: false, first: '05:53', last: '00:55', exits: ['A: 香港文化博物館', 'B: 車公廟', 'D: 秦石邨'] },
        'HIK': { name: '顯徑', en: 'Hin Keng', lat: 22.3645, lon: 114.1725, toilet: true, baby: true, first: '05:55', last: '00:58', exits: ['A: 顯徑邨 / 顯徑商場 / 顯田游泳池'] },
        'KAT': { name: '啟德', en: 'Kai Tak', lat: 22.3325, lon: 114.2005, toilet: true, baby: true, first: '06:00', last: '01:02', exits: ['A: 啟晴邨 / 晴朗商場', 'C: AIRSIDE 商場 / 雙子匯', 'D: 啟德體育園 (Kai Tak Sports Park)'] },
        'SUW': { name: '宋皇臺', en: 'Sung Wong Toi', lat: 22.3275, lon: 114.1905, toilet: true, baby: true, first: '06:02', last: '01:04', exits: ['B: 九龍城美食區（衙前圍道）', 'D: 宋皇臺公園 / 啟德體育園主場館'] },
        'TKW': { name: '土瓜灣', en: 'To Kwa Wan', lat: 22.3165, lon: 114.1885, toilet: true, baby: true, first: '06:04', last: '01:06', exits: ['A: 土瓜灣街市 / 牛棚藝術村', 'D: 美善同道'] },
        'ETS': { name: '尖東', en: 'East Tsim Sha Tsui', lat: 22.2955, lon: 114.1755, toilet: true, baby: true, first: '06:06', last: '01:10', exits: ['J: 星光大道 / K11 MUSEA / 維港海濱', 'N5: 河內道 / K11 購物藝術館', 'P: 漆咸道南 / 香港歷史博物館'] },
        'AUS': { name: '柯士甸', en: 'Austin', lat: 22.3045, lon: 114.1655, toilet: true, baby: true, first: '06:08', last: '01:12', exits: ['B: 圓方 (Elements)', 'C: 香港西九龍高鐵站', 'D: 戲曲中心 / 西九文化區'] },
        'NAC': { name: '南昌', en: 'Nam Cheong', lat: 22.3255, lon: 114.1535, toilet: true, baby: true, first: '06:00', last: '01:15', exits: ['A: V Walk 商場 / 富昌邨', 'D: 南昌公園 / 深水埗海濱'] },
        'TWW': { name: '荃灣西', en: 'Tsuen Wan West', lat: 22.3685, lon: 114.1115, toilet: true, baby: true, first: '05:56', last: '01:22', exits: ['A: 荃灣海濱長廊', 'C: 海之戀 (OP Mall)', 'D: 如心廣場 (Nina Mall) / 荃新天地'] },
        'KSR': { name: '錦上路', en: 'Kam Sheung Road', lat: 22.4335, lon: 114.0625, toilet: true, baby: true, first: '05:50', last: '01:28', exits: ['A: 錦田吉慶圍', 'B: 跳蚤市場', 'C: 公共運輸交匯處'] },
        'YUL': { name: '元朗', en: 'Yuen Long', lat: 22.4460, lon: 114.0350, toilet: true, baby: true, first: '05:47', last: '01:31', exits: ['B: 元朗舊墟', 'G: 輕鐵元朗總站', 'K: 形點 I & II (YOHO Mall)'] },
        'LOP': { name: '朗屏', en: 'Long Ping', lat: 22.4490, lon: 114.0250, toilet: true, baby: true, first: '05:45', last: '01:33', exits: ['B: 朗屏邨', 'E: 大橋街市 / 元朗廣場'] },
        'TIS': { name: '天水圍', en: 'Tin Shui Wai', lat: 22.4455, lon: 114.0040, toilet: true, baby: true, first: '05:42', last: '01:36', exits: ['A: 天耀邨', 'B: 天盛苑', 'C: 屏山文物徑（聚星樓）', 'E: 輕鐵天水圍站'] },
        'SIH': { name: '兆康', en: 'Siu Hong', lat: 22.4110, lon: 113.9785, toilet: true, baby: true, first: '05:39', last: '01:39', exits: ['A: 嶺南大學', 'C: 輕鐵兆康站', 'F: 欣田邨'] },
        'TUM': { name: '屯門', en: 'Tuen Mun', lat: 22.3955, lon: 113.9740, toilet: true, baby: true, first: '05:38', last: '00:35', exits: ['B: 輕鐵屯門站', 'C: 屯門市廣場 / V city 商場', 'F: 新墟街市'] },
        'HOK': { name: '香港', en: 'Hong Kong', lat: 22.2840, lon: 114.1580, toilet: true, baby: true, first: '05:50', last: '00:48', exits: ['A: 國際金融中心商場 (IFC Mall)', 'C: 行人隧道往中環站', 'E: 交易廣場 / 中環天星碼頭 / 摩天輪'] },
        'KOW': { name: '九龍', en: 'Kowloon', lat: 22.3040, lon: 114.1610, toilet: true, baby: true, first: '05:53', last: '00:52', exits: ['C: 圓方 (Elements) / 天際100 (Sky100)', 'D: 西九文化區 (M+ 博物館 / 香港故宮文化博物館)'] },
        'OLY': { name: '奧運', en: 'Olympic', lat: 22.3170, lon: 114.1600, toilet: true, baby: false, first: '06:04', last: '00:56', exits: ['B: 奧海城一期', 'D: 奧海城二期及三期'] },
        'TSY': { name: '青衣', en: 'Tsing Yi', lat: 22.3580, lon: 114.1060, toilet: true, baby: true, first: '06:00', last: '01:02', exits: ['A1: 青衣城一期 (Maritime Square)', 'A2: 青衣城二期', 'C: 青衣海濱公園'] },
        'SUN': { name: '欣澳', en: 'Sunny Bay', lat: 22.3310, lon: 114.0300, toilet: true, baby: true, first: '06:02', last: '01:08', exits: ['A: 欣澳公共運輸交匯處（往愉景灣 DB03R 巴士）/ 欣澳海濱'] },
        'TUC': { name: '東涌', en: 'Tung Chung', lat: 22.2890, lon: 113.9400, toilet: true, baby: true, first: '06:00', last: '00:43', exits: ['B: 昂坪 360 纜車站 / 東涌巴士總站（往大澳 11 號線）', 'C: 東薈城名店倉 (Citygate Outlets)'] },
        'AIR': { name: '機場', en: 'Airport', lat: 22.3150, lon: 113.9360, toilet: true, baby: true, first: '05:54', last: '00:48', exits: ['A: 香港國際機場一號客運大樓 (T1) 離境及抵港大堂', 'B: 11 SKIES / 航天城'] },
        'AWE': { name: '博覽館', en: 'AsiaWorld-Expo', lat: 22.3210, lon: 113.9430, toilet: true, baby: true, first: '06:00', last: '00:45', exits: ['A: 亞洲國際博覽館東面入口', 'B: 亞洲國際博覽館西面入口'] },
        'DIS': { name: '迪士尼', en: 'Disneyland Resort', lat: 22.3150, lon: 114.0440, toilet: true, baby: true, first: '06:20', last: '00:40', exits: ['A: 香港迪士尼樂園正門迎樂路 / 迪欣湖'] },
        'OCP': { name: '海洋公園', en: 'Ocean Park', lat: 22.2470, lon: 114.1750, toilet: true, baby: true, first: '06:05', last: '01:02', exits: ['A: 海洋公園水上樂園穿梭巴士站', 'B: 香港海洋公園正門廣場'] },
        'WCH': { name: '黃竹坑', en: 'Wong Chuk Hang', lat: 22.2480, lon: 114.1670, toilet: true, baby: true, first: '06:03', last: '01:04', exits: ['A: 香葉道 / 黃竹坑商貿區', 'B: THE SOUTHSIDE 商場'] },
        'LET': { name: '利東', en: 'Lei Tung', lat: 22.2410, lon: 114.1560, toilet: true, baby: false, first: '06:01', last: '01:06', exits: ['A1: 鴨脷洲大街（街渡往香港仔海濱）', 'B: 利東邨 / 玉桂山行山徑'] },
        'SOH': { name: '海怡半島', en: 'South Horizons', lat: 22.2430, lon: 114.1450, toilet: true, baby: true, first: '06:00', last: '00:45', exits: ['A: 海怡廣場東翼', 'B: 海怡西商場', 'C: 新海怡廣場 (Horizon Plaza Outlet)'] }
    }
};


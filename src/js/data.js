/* MTR Aura OS 3.7 Pro — Hong Kong MTR 98-Station Network Data */
const MTR_LINES = {
    TWL: { id:'TWL', name:'荃灣綫', en:'Tsuen Wan Line', color:'#E2231A', cars:8, up:'荃灣', down:'中環',
           stations:['CEN','ADM','TST','JOR','YMT','MOK','PRE','SSP','CSW','LCK','MEF','LAK','KWF','KWH','TWH','TSW'] },
    KTL: { id:'KTL', name:'觀塘綫', en:'Kwun Tong Line', color:'#00AF41', cars:8, up:'調景嶺', down:'黃埔',
           stations:['WHA','HOM','YMT','MOK','PRE','SKM','KOT','LOF','WTS','DIH','CHH','KOB','NTK','KWT','LAT','YAT','TIK'] },
    ISL: { id:'ISL', name:'港島綫', en:'Island Line', color:'#0071CE', cars:8, up:'柴灣', down:'堅尼地城',
           stations:['KET','HKU','SYP','SHW','CEN','ADM','WAC','CAB','TIH','FOH','NOP','QUB','TAK','SWH','SKW','HFC','CHW'] },
    SIL: { id:'SIL', name:'南港島綫', en:'South Island Line', color:'#BAC429', cars:3, up:'海怡半島', down:'金鐘',
           stations:['ADM','OCP','WCH','LET','SOH'] },
    TKL: { id:'TKL', name:'將軍澳綫', en:'Tseung Kwan O Line', color:'#7D499D', cars:8, up:'寶琳 / 康城', down:'北角',
           stations:['NOP','QUB','YAT','TIK','TKO','HAH','POA'] },
    TKL_LHP: { id:'TKL_LHP', base:'TKL', name:'將軍澳綫(康城)', en:'TKO Line (LOHAS)', color:'#7D499D', cars:8, up:'康城', down:'北角',
           stations:['NOP','QUB','YAT','TIK','TKO','LHP'] },
    TCL: { id:'TCL', name:'東涌綫', en:'Tung Chung Line', color:'#F38B00', cars:8, up:'東涌', down:'香港',
           stations:['HOK','KOW','OLY','NAC','LAK','TSY','SUN','TUC'] },
    AEL: { id:'AEL', name:'機場快綫', en:'Airport Express', color:'#00888A', cars:8, up:'博覽館', down:'香港',
           stations:['HOK','KOW','TSY','AIR','AWE'] },
    DRL: { id:'DRL', name:'迪士尼綫', en:'Disneyland Resort Line', color:'#F173AC', cars:4, up:'迪士尼', down:'欣澳',
           stations:['SUN','DIS'] },
    TML: { id:'TML', name:'屯馬綫', en:'Tuen Ma Line', color:'#9A3B26', cars:8, up:'屯門', down:'烏溪沙',
           stations:['WKS','MOS','HEO','TSH','SHM','CIO','STW','CKT','TAW','HIK','DIH','KAT','SUW','TKW','HOM','HUH','ETS','AUS','NAC','MEF','TWW','KSR','YUL','LOP','TIS','SIH','TUM'] },
    EAL: { id:'EAL', name:'東鐵綫', en:'East Rail Line', color:'#53B7E8', cars:9, up:'羅湖 / 落馬洲', down:'金鐘',
           stations:['ADM','EXC','HUH','MKK','KOT','TAW','SHT','FOT','UNI','TAP','TWO','FAN','SHS','LOW'] },
    EAL_LMC: { id:'EAL_LMC', base:'EAL', name:'東鐵綫(落馬洲)', en:'East Rail (LMC)', color:'#53B7E8', cars:9, up:'落馬洲', down:'金鐘',
           stations:['ADM','EXC','HUH','MKK','KOT','TAW','SHT','FOT','UNI','TAP','TWO','FAN','SHS','LMC'] },
    EAL_RAC: { id:'EAL_RAC', base:'EAL', name:'東鐵綫(馬場)', en:'East Rail (Racecourse)', color:'#53B7E8', cars:9, up:'羅湖', down:'金鐘',
           stations:['SHT','RAC','UNI'] }
};

const MTR_STATIONS = {
    // Tsuen Wan Line & Central Hub
    CEN:{name:'中環',en:'Central',lat:22.2819,lng:114.1581,wc:1,bf:1,bfree:1,first:'06:06',last:'00:54',exits:['A: 干諾道中/交易廣場','D: 畢打街/置地廣場','K: 皇后像廣場']},
    ADM:{name:'金鐘',en:'Admiralty',lat:22.2790,lng:114.1646,wc:1,bf:1,bfree:1,first:'06:03',last:'00:56',exits:['A: 海富中心','C: 金鐘廊/太古廣場','E: 樂禮街/政府總部']},
    TST:{name:'尖沙咀',en:'Tsim Sha Tsui',lat:22.2974,lng:114.1722,wc:0,bf:0,bfree:1,first:'06:05',last:'00:58',exits:['A1: 九龍公園/海防道','C1: 彌敦道/北京道','H: 國際廣場 iSQUARE']},
    JOR:{name:'佐敦',en:'Jordan',lat:22.3049,lng:114.1717,wc:0,bf:0,bfree:1,first:'06:07',last:'01:00',exits:['A: 裕華國貨','C2: 寶靈街','E: 恒豐中心']},
    YMT:{name:'油麻地',en:'Yau Ma Tei',lat:22.3130,lng:114.1707,wc:0,bf:0,bfree:1,first:'06:09',last:'01:02',exits:['A1: 碧街/廣華醫院','C: 文明里/廟街']},
    MOK:{name:'旺角',en:'Mong Kok',lat:22.3193,lng:114.1694,wc:1,bf:0,bfree:1,first:'06:11',last:'01:04',exits:['B3: 西洋菜南街','C3: 朗豪坊','E2: 銀行中心/女人街']},
    PRE:{name:'太子',en:'Prince Edward',lat:22.3245,lng:114.1683,wc:1,bf:0,bfree:1,first:'06:12',last:'01:06',exits:['B1: 始創中心/花墟','C2: 荔枝角道','E: 彌敦道']},
    SSP:{name:'深水埗',en:'Sham Shui Po',lat:22.3308,lng:114.1622,wc:0,bf:0,bfree:1,first:'06:14',last:'01:08',exits:['C2: 鴨寮街/桂林街','D2: 黃金電腦商場']},
    CSW:{name:'長沙灣',en:'Cheung Sha Wan',lat:22.3354,lng:114.1563,wc:0,bf:0,bfree:1,first:'06:16',last:'01:10',exits:['A3: 長沙灣廣場','C2: 元州街']},
    LCK:{name:'荔枝角',en:'Lai Chi Kok',lat:22.3372,lng:114.1483,wc:0,bf:0,bfree:1,first:'06:18',last:'01:12',exits:['A: 長沙灣廣場','D2: D2 Place 商場']},
    MEF:{name:'美孚',en:'Mei Foo',lat:22.3380,lng:114.1376,wc:1,bf:1,bfree:1,first:'06:00',last:'01:14',exits:['A: 美孚新邨','D: 荔枝角公園']},
    LAK:{name:'荔景',en:'Lai King',lat:22.3484,lng:114.1261,wc:1,bf:0,bfree:1,first:'06:02',last:'01:16',exits:['A1: 荔景邨','C: 荔景山路']},
    KWF:{name:'葵芳',en:'Kwai Fong',lat:22.3569,lng:114.1279,wc:0,bf:0,bfree:1,first:'06:05',last:'01:18',exits:['D: 新都會廣場','E: 葵涌廣場']},
    KWH:{name:'葵興',en:'Kwai Hing',lat:22.3632,lng:114.1312,wc:0,bf:0,bfree:1,first:'06:07',last:'01:20',exits:['A: 葵興路','E: 九龍貿易中心 KCC']},
    TWH:{name:'大窩口',en:'Tai Wo Hau',lat:22.3708,lng:114.1251,wc:0,bf:0,bfree:1,first:'06:09',last:'01:22',exits:['A: 青山公路','B: 國瑞路']},
    TSW:{name:'荃灣',en:'Tsuen Wan',lat:22.3736,lng:114.1178,wc:1,bf:0,bfree:1,first:'06:00',last:'00:30',exits:['A: 愉景新城/南豐中心','B: 眾安街/千色匯']},
    // Kwun Tong Line
    WHA:{name:'黃埔',en:'Whampoa',lat:22.3050,lng:114.1897,wc:1,bf:1,bfree:1,first:'06:10',last:'00:40',exits:['A: 民兆街','C: 黃埔天地']},
    HOM:{name:'何文田',en:'Ho Man Tin',lat:22.3091,lng:114.1828,wc:1,bf:1,bfree:1,first:'06:08',last:'00:45',exits:['A3: 愛民邨/何文田邨','B1: 漆咸道北']},
    SKM:{name:'石硤尾',en:'Shek Kip Mei',lat:22.3319,lng:114.1684,wc:0,bf:0,bfree:1,first:'06:15',last:'00:58',exits:['A: 南昌街','C: 偉智街/賽馬會創意藝術中心']},
    KOT:{name:'九龍塘',en:'Kowloon Tong',lat:22.3369,lng:114.1761,wc:1,bf:1,bfree:1,first:'06:05',last:'00:55',exits:['C2: 又一城/城市大學','D: 沙福道/浸會大學']},
    LOF:{name:'樂富',en:'Lok Fu',lat:22.3381,lng:114.1871,wc:0,bf:0,bfree:1,first:'06:12',last:'00:52',exits:['A: 樂富廣場','B: 橫頭磡南道']},
    WTS:{name:'黃大仙',en:'Wong Tai Sin',lat:22.3417,lng:114.1939,wc:1,bf:0,bfree:1,first:'06:10',last:'00:50',exits:['B2: 黃大仙祠','C2: 黃大仙中心北館']},
    DIH:{name:'鑽石山',en:'Diamond Hill',lat:22.3400,lng:114.2017,wc:1,bf:1,bfree:1,first:'06:06',last:'00:56',exits:['C2: 荷里活廣場','A2: 彩虹道/志蓮淨苑']},
    CHH:{name:'彩虹',en:'Choi Hung',lat:22.3348,lng:114.2089,wc:0,bf:0,bfree:1,first:'06:05',last:'00:58',exits:['C4: 彩虹邨','B: 牛池灣街市']},
    KOB:{name:'九龍灣',en:'Kowloon Bay',lat:22.3235,lng:114.2141,wc:1,bf:0,bfree:1,first:'06:02',last:'00:55',exits:['A: 德福廣場一期','B: 淘大商場/宏照道']},
    NTK:{name:'牛頭角',en:'Ngau Tau Kok',lat:22.3155,lng:114.2191,wc:0,bf:0,bfree:1,first:'06:04',last:'00:57',exits:['A: 創紀之城','B6: 觀塘海濱花園']},
    KWT:{name:'觀塘',en:'Kwun Tong',lat:22.3122,lng:114.2264,wc:1,bf:0,bfree:1,first:'06:01',last:'00:59',exits:['A2: apm 商場','B1: 開源道/觀塘廣場']},
    LAT:{name:'藍田',en:'Lam Tin',lat:22.3067,lng:114.2331,wc:0,bf:0,bfree:1,first:'06:03',last:'01:01',exits:['A: 啟田商場','D1: 滙景廣場']},
    YAT:{name:'油塘',en:'Yau Tong',lat:22.2977,lng:114.2374,wc:1,bf:0,bfree:1,first:'06:05',last:'01:03',exits:['A1: 大本型商場','B1: 油麗邨']},
    TIK:{name:'調景嶺',en:'Tiu Keng Leng',lat:22.3042,lng:114.2525,wc:1,bf:1,bfree:1,first:'06:00',last:'00:40',exits:['A2: 都會駅','B: 彩明商場']},
    // Island Line
    KET:{name:'堅尼地城',en:'Kennedy Town',lat:22.2812,lng:114.1288,wc:1,bf:1,bfree:1,first:'06:00',last:'00:50',exits:['A: 士美菲路','C: 科士街']},
    HKU:{name:'香港大學',en:'HKU',lat:22.2840,lng:114.1355,wc:1,bf:1,bfree:1,first:'06:02',last:'00:52',exits:['A2: 香港大學','C1: 寶翠園/西寶城']},
    SYP:{name:'西營盤',en:'Sai Ying Pun',lat:22.2858,lng:114.1426,wc:1,bf:1,bfree:1,first:'06:04',last:'00:54',exits:['A1: 皇后大道西','C: 般咸道']},
    SHW:{name:'上環',en:'Sheung Wan',lat:22.2866,lng:114.1517,wc:0,bf:0,bfree:1,first:'06:05',last:'00:56',exits:['D: 信德中心/港澳碼頭','E2: 無限極廣場']},
    WAC:{name:'灣仔',en:'Wan Chai',lat:22.2775,lng:114.1731,wc:1,bf:0,bfree:1,first:'06:04',last:'01:00',exits:['A5: 香港會議展覽中心','D: 利東街']},
    CAB:{name:'銅鑼灣',en:'Causeway Bay',lat:22.2802,lng:114.1850,wc:1,bf:0,bfree:1,first:'06:06',last:'01:02',exits:['A: 時代廣場','D2: 崇光百貨 SOGO','F1: 希慎廣場']},
    TIH:{name:'天后',en:'Tin Hau',lat:22.2827,lng:114.1917,wc:0,bf:0,bfree:1,first:'06:08',last:'01:04',exits:['A2: 維多利亞公園','B: 英皇道']},
    FOH:{name:'炮台山',en:'Fortress Hill',lat:22.2881,lng:114.1939,wc:0,bf:0,bfree:1,first:'06:10',last:'01:06',exits:['A: 油街實現','B: 英皇道']},
    NOP:{name:'北角',en:'North Point',lat:22.2909,lng:114.2007,wc:1,bf:0,bfree:1,first:'06:05',last:'01:08',exits:['A1: 渣華道/北角匯','B1: 英皇道']},
    QUB:{name:'鰂魚涌',en:'Quarry Bay',lat:22.2879,lng:114.2097,wc:1,bf:0,bfree:1,first:'06:07',last:'01:10',exits:['A: 太古坊','C: 模範里']},
    TAK:{name:'太古',en:'Tai Koo',lat:22.2846,lng:114.2165,wc:0,bf:0,bfree:1,first:'06:09',last:'01:12',exits:['D2: 太古城中心','E1: 康怡廣場']},
    SWH:{name:'西灣河',en:'Sai Wan Ho',lat:22.2820,lng:114.2220,wc:0,bf:0,bfree:1,first:'06:11',last:'01:14',exits:['A: 嘉亨灣/蘇豪東','B: 筲箕灣道']},
    SKW:{name:'筲箕灣',en:'Shau Kei Wan',lat:22.2791,lng:114.2289,wc:0,bf:0,bfree:1,first:'06:13',last:'01:16',exits:['B1: 筲箕灣東大街','C: 望隆街']},
    HFC:{name:'杏花邨',en:'Heng Fa Chuen',lat:22.2768,lng:114.2396,wc:1,bf:0,bfree:1,first:'06:01',last:'01:18',exits:['A1: 杏花新城']},
    CHW:{name:'柴灣',en:'Chai Wan',lat:22.2643,lng:114.2369,wc:1,bf:0,bfree:1,first:'05:55',last:'00:35',exits:['A: 新翠商場','C: 利眾街']},
    // South Island Line
    OCP:{name:'海洋公園',en:'Ocean Park',lat:22.2486,lng:114.1743,wc:1,bf:1,bfree:1,first:'06:05',last:'00:40',exits:['B: 海洋公園正門']},
    WCH:{name:'黃竹坑',en:'Wong Chuk Hang',lat:22.2481,lng:114.1680,wc:1,bf:1,bfree:1,first:'06:03',last:'00:42',exits:['A1: 香葉道','B: THE SOUTHSIDE 商場']},
    LET:{name:'利東',en:'Lei Tung',lat:22.2423,lng:114.1560,wc:1,bf:1,bfree:1,first:'06:01',last:'00:44',exits:['A1: 鴨脷洲大街','B: 利東邨']},
    SOH:{name:'海怡半島',en:'South Horizons',lat:22.2426,lng:114.1490,wc:1,bf:1,bfree:1,first:'06:00',last:'00:35',exits:['A: 海怡廣場','C: 美康閣']},
    // Tseung Kwan O Line
    TKO:{name:'將軍澳',en:'Tseung Kwan O',lat:22.3075,lng:114.2600,wc:1,bf:0,bfree:1,first:'06:03',last:'00:48',exits:['C: PopCorn 商場','A1: 尚德廣場']},
    HAH:{name:'坑口',en:'Hang Hau',lat:22.3156,lng:114.2644,wc:0,bf:0,bfree:1,first:'06:01',last:'00:46',exits:['A1: 連理街/東港城','B1: 坑口村']},
    POA:{name:'寶琳',en:'Po Lam',lat:22.3225,lng:114.2581,wc:1,bf:0,bfree:1,first:'06:00',last:'00:40',exits:['A2: 新都城中心二期','B1: 疊翠軒']},
    LHP:{name:'康城',en:'LOHAS Park',lat:22.2957,lng:114.2689,wc:1,bf:1,bfree:1,first:'05:57',last:'00:48',exits:['B: The LOHAS 康城商場']},
    // Tung Chung & Airport Express & Disneyland
    HOK:{name:'香港',en:'Hong Kong',lat:22.2849,lng:114.1583,wc:1,bf:1,bfree:1,first:'05:50',last:'00:50',exits:['A: 國際金融中心商場 ifc','F: 交易廣場']},
    KOW:{name:'九龍',en:'Kowloon',lat:22.3048,lng:114.1615,wc:1,bf:1,bfree:1,first:'05:53',last:'00:53',exits:['C1: 圓方 ELEMENTS','D1: 環球貿易廣場 ICC']},
    OLY:{name:'奧運',en:'Olympic',lat:22.3177,lng:114.1602,wc:1,bf:0,bfree:1,first:'06:04',last:'00:56',exits:['D3: 奧海城二期','A2: 維港灣']},
    NAC:{name:'南昌',en:'Nam Cheong',lat:22.3267,lng:114.1534,wc:1,bf:1,bfree:1,first:'06:02',last:'00:58',exits:['A1: V Walk 商場','D1: 富昌邨']},
    TSY:{name:'青衣',en:'Tsing Yi',lat:22.3585,lng:114.1069,wc:1,bf:1,bfree:1,first:'06:00',last:'01:02',exits:['A1: 青衣城一期','F: 青衣城二期']},
    SUN:{name:'欣澳',en:'Sunny Bay',lat:22.3316,lng:114.0289,wc:1,bf:1,bfree:1,first:'06:08',last:'00:45',exits:['A: 欣澳公共運輸交匯處']},
    TUC:{name:'東涌',en:'Tung Chung',lat:22.2891,lng:113.9415,wc:1,bf:1,bfree:1,first:'06:02',last:'00:43',exits:['C: 東薈城名店倉','B: 昂坪360纜車站']},
    DIS:{name:'迪士尼',en:'Disneyland Resort',lat:22.3156,lng:114.0450,wc:1,bf:1,bfree:1,first:'06:20',last:'00:40',exits:['A: 香港迪士尼樂園']},
    AIR:{name:'機場',en:'Airport',lat:22.3160,lng:113.9367,wc:1,bf:1,bfree:1,first:'05:54',last:'00:48',exits:['一號客運大樓離境/接機大堂']},
    AWE:{name:'博覽館',en:'AsiaWorld-Expo',lat:22.3216,lng:113.9411,wc:1,bf:1,bfree:1,first:'06:00',last:'00:45',exits:['A: 亞洲國際博覽館東大堂']},
    // Tuen Ma Line
    WKS:{name:'烏溪沙',en:'Wu Kai Sha',lat:22.4290,lng:114.2436,wc:1,bf:1,bfree:1,first:'05:40',last:'00:35',exits:['A1: 銀湖・天峰','B: 迎海薈']},
    MOS:{name:'馬鞍山',en:'Ma On Shan',lat:22.4247,lng:114.2316,wc:1,bf:0,bfree:1,first:'05:42',last:'00:37',exits:['A1: 馬鞍山廣場','B: MOSTown 新港城中心']},
    HEO:{name:'恆安',en:'Heng On',lat:22.4177,lng:114.2259,wc:1,bf:0,bfree:1,first:'05:44',last:'00:39',exits:['A: 恆安商場','C: 聽濤雅苑']},
    TSH:{name:'大水坑',en:'Tai Shui Hang',lat:22.4088,lng:114.2229,wc:1,bf:0,bfree:1,first:'05:46',last:'00:41',exits:['A: 錦泰苑','B: 富安花園']},
    SHM:{name:'石門',en:'Shek Mun',lat:22.3879,lng:114.2084,wc:1,bf:0,bfree:1,first:'05:49',last:'00:44',exits:['C: 京瑞廣場']},
    CIO:{name:'第一城',en:'City One',lat:22.3829,lng:114.2036,wc:1,bf:0,bfree:1,first:'05:51',last:'00:46',exits:['C: 沙田第一城','B: 威爾斯親王醫院']},
    STW:{name:'沙田圍',en:'Sha Tin Wai',lat:22.3772,lng:114.1950,wc:1,bf:0,bfree:1,first:'05:53',last:'00:48',exits:['A: 博康邨','C: 沙角邨']},
    CKT:{name:'車公廟',en:'Che Kung Temple',lat:22.3748,lng:114.1862,wc:1,bf:0,bfree:1,first:'05:55',last:'00:50',exits:['A: 香港文化博物館','B: 車公廟']},
    TAW:{name:'大圍',en:'Tai Wai',lat:22.3729,lng:114.1786,wc:1,bf:1,bfree:1,first:'05:48',last:'00:55',exits:['B: 圍方 The Wai','A: 村南道']},
    HIK:{name:'顯徑',en:'Hin Keng',lat:22.3645,lng:114.1707,wc:1,bf:1,bfree:1,first:'05:58',last:'00:53',exits:['A: 顯徑商場/車公廟路']},
    KAT:{name:'啟德',en:'Kai Tak',lat:22.3304,lng:114.1995,wc:1,bf:1,bfree:1,first:'06:00',last:'00:56',exits:['C: AIRSIDE 商場','D: 啟德體育園']},
    SUW:{name:'宋皇臺',en:'Sung Wong Toi',lat:22.3257,lng:114.1912,wc:1,bf:1,bfree:1,first:'06:02',last:'00:58',exits:['B2: 九龍城/衙前圍道','D: 啟德體育園西']},
    TKW:{name:'土瓜灣',en:'To Kwa Wan',lat:22.3173,lng:114.1874,wc:1,bf:1,bfree:1,first:'06:04',last:'01:00',exits:['A: 炮仗街','D2: 馬頭圍道']},
    HUH:{name:'紅磡',en:'Hung Hom',lat:22.3029,lng:114.1816,wc:1,bf:1,bfree:1,first:'05:55',last:'00:55',exits:['A1: 香港理工大學','C2: 香港體育館 (紅館)']},
    ETS:{name:'尖東',en:'East Tsim Sha Tsui',lat:22.2956,lng:114.1753,wc:1,bf:1,bfree:1,first:'06:05',last:'01:02',exits:['J: K11 MUSEA/星光大道','L6: 半島酒店']},
    AUS:{name:'柯士甸',en:'Austin',lat:22.3048,lng:114.1665,wc:1,bf:1,bfree:1,first:'06:04',last:'01:00',exits:['C: 香港西九龍高鐵站','D2: 戲曲中心']},
    TWW:{name:'荃灣西',en:'Tsuen Wan West',lat:22.3687,lng:114.1097,wc:1,bf:1,bfree:1,first:'05:58',last:'00:50',exits:['C2: 海之戀商場 OP Mall','D: 如心廣場/荃灣廣場']},
    KSR:{name:'錦上路',en:'Kam Sheung Road',lat:22.4348,lng:114.0634,wc:1,bf:1,bfree:1,first:'05:54',last:'00:46',exits:['B: 跳蚤市場','C: 錦上路公共運輸交匯處']},
    YUL:{name:'元朗',en:'Yuen Long',lat:22.4461,lng:114.0352,wc:1,bf:1,bfree:1,first:'05:51',last:'00:43',exits:['K: YOHO MALL 形點 I','F: YOHO MALL 形點 II']},
    LOP:{name:'朗屏',en:'Long Ping',lat:22.4478,lng:114.0253,wc:1,bf:0,bfree:1,first:'05:49',last:'00:41',exits:['B2: 元朗廣場','E: 朗屏邨']},
    TIS:{name:'天水圍',en:'Tin Shui Wai',lat:22.4481,lng:114.0044,wc:1,bf:1,bfree:1,first:'05:46',last:'00:38',exits:['E1: 屏欣苑','C: 天耀廣場']},
    SIH:{name:'兆康',en:'Siu Hong',lat:22.4118,lng:113.9788,wc:1,bf:0,bfree:1,first:'05:42',last:'00:34',exits:['A: 兆康苑','F: 嶺南大學']},
    TUM:{name:'屯門',en:'Tuen Mun',lat:22.3953,lng:113.9731,wc:1,bf:1,bfree:1,first:'05:40',last:'00:30',exits:['C2: V city 商場','B: 屯門公園']},
    // East Rail Line
    EXC:{name:'會展',en:'Exhibition Centre',lat:22.2816,lng:114.1753,wc:1,bf:1,bfree:1,first:'05:58',last:'00:52',exits:['B3: 香港會議展覽中心','A3: 灣仔北公共運輸交匯處']},
    MKK:{name:'旺角東',en:'Mong Kok East',lat:22.3222,lng:114.1729,wc:1,bf:1,bfree:1,first:'05:50',last:'00:52',exits:['D: MOKO 新世紀廣場','B: 旺角政府合署']},
    SHT:{name:'沙田',en:'Sha Tin',lat:22.3826,lng:114.1874,wc:1,bf:1,bfree:1,first:'05:45',last:'00:48',exits:['A3: 新城市廣場','B: 排頭村/沙田政府合署']},
    FOT:{name:'火炭',en:'Fo Tan',lat:22.3953,lng:114.1983,wc:1,bf:0,bfree:1,first:'05:43',last:'00:46',exits:['C: 銀禧薈/御龍山','D: 坳背灣街']},
    RAC:{name:'馬場',en:'Racecourse',lat:22.4005,lng:114.2028,wc:1,bf:0,bfree:1,first:'賽馬日開放',last:'賽馬日開放',exits:['A: 沙田馬場看台']},
    UNI:{name:'大學',en:'University',lat:22.4133,lng:114.2102,wc:1,bf:1,bfree:1,first:'05:40',last:'00:43',exits:['A: 香港中文大學','B: 澤祥街/科學園轉車站']},
    TAP:{name:'大埔墟',en:'Tai Po Market',lat:22.4446,lng:114.1704,wc:1,bf:1,bfree:1,first:'05:36',last:'00:39',exits:['A1: 新達廣場','B: 廣福邨']},
    TWO:{name:'太和',en:'Tai Wo',lat:22.4510,lng:114.1611,wc:1,bf:0,bfree:1,first:'05:34',last:'00:37',exits:['A: 太和廣場','B: 大埔頭']},
    FAN:{name:'粉嶺',en:'Fanling',lat:22.4921,lng:114.1387,wc:1,bf:1,bfree:1,first:'05:30',last:'00:32',exits:['A: 粉嶺名都/粉嶺中心','C: 粉嶺站路']},
    SHS:{name:'上水',en:'Sheung Shui',lat:22.5012,lng:114.1277,wc:1,bf:1,bfree:1,first:'05:28',last:'00:30',exits:['A4: 上水廣場','C: 新運路/彩園廣場']},
    LOW:{name:'羅湖',en:'Lo Wu',lat:22.5283,lng:114.1133,wc:1,bf:1,bfree:1,first:'05:55',last:'00:30',exits:['羅湖口岸出入境管制站']},
    LMC:{name:'落馬洲',en:'Lok Ma Chau',lat:22.5144,lng:114.0658,wc:1,bf:1,bfree:1,first:'06:38',last:'22:55',exits:['福田口岸/落馬洲支線管制站']}
};

// Transfer metadata (walking time, cross-platform flag, best boarding cars, guidance)
const MTR_TRANSFERS = {
    'ADM': { cross:true, walk:1.5, cars:[3,4,5], tip:'金鐘超級轉車站設扶手電梯直達各層月台（建議第 3-5 卡）' },
    'CEN': { cross:false, walk:3.5, cars:[4,5], tip:'經大堂通道連接港島綫、荃灣綫及香港站（建議第 4-5 卡）' },
    'HOK': { cross:false, walk:4.5, cars:[3,4], tip:'經行人隧道步行約 4.5 分鐘往返中環站（建議第 3-4 卡）' },
    'MOK': { cross:true, walk:1.0, cars:[3,4,5], tip:'荃灣綫與觀塘綫設同層對面月台轉乘（建議第 3-5 卡）' },
    'PRE': { cross:true, walk:1.0, cars:[3,4,5], tip:'荃灣綫與觀塘綫同月台對面轉乘極速過車（建議第 3-5 卡）' },
    'YMT': { cross:false, walk:1.5, cars:[4,5], tip:'上下層月台扶手電梯轉乘（建議第 4-5 卡）' },
    'KOT': { cross:false, walk:2.5, cars:[4,5,6], tip:'經轉乘大堂通道連接觀塘綫與東鐵綫（建議第 4-6 卡）' },
    'DIH': { cross:false, walk:2.0, cars:[3,4,5], tip:'經轉乘大堂通道連接觀塘綫與屯馬綫（建議第 3-5 卡）' },
    'TAW': { cross:true, walk:1.5, cars:[4,5,6], tip:'南行往九龍方向設月台跨橋直達轉乘（建議第 4-6 卡）' },
    'HUH': { cross:false, walk:2.0, cars:[4,5,6], tip:'上下層月台直達連接東鐵綫與屯馬綫（建議第 4-6 卡）' },
    'HOM': { cross:false, walk:2.0, cars:[3,4,5], tip:'上下層月台扶手電梯連接觀塘綫與屯馬綫（建議第 3-5 卡）' },
    'YAT': { cross:true, walk:1.0, cars:[3,4,5], tip:'觀塘綫與將軍澳綫同月台對面轉乘（建議第 3-5 卡）' },
    'TIK': { cross:true, walk:1.0, cars:[3,4,5], tip:'觀塘綫與將軍澳綫同月台對面轉乘（建議第 3-5 卡）' },
    'NOP': { cross:true, walk:1.0, cars:[4,5], tip:'港島綫與將軍澳綫同層對面月台轉乘（建議第 4-5 卡）' },
    'QUB': { cross:false, walk:2.5, cars:[3,4], tip:'經轉乘通道連接港島綫與將軍澳綫（建議第 3-4 卡）' },
    'LAK': { cross:true, walk:1.0, cars:[3,4,5], tip:'荃灣綫與東涌綫同層對面月台轉乘（建議第 3-5 卡）' },
    'MEF': { cross:false, walk:4.0, cars:[1,2], tip:'經長行人隧道連接荃灣綫與屯馬綫（建議車頭第 1-2 卡）' },
    'NAC': { cross:true, walk:1.5, cars:[4,5], tip:'屯馬綫往屯門與東涌綫往香港設同月台轉乘（建議第 4-5 卡）' },
    'SUN': { cross:true, walk:1.0, cars:[3,4], tip:'東涌綫與迪士尼綫同層對面月台轉乘（建議第 3-4 卡）' },
    'TSY': { cross:false, walk:2.0, cars:[4,5], tip:'經大堂層轉乘東涌綫與機場快綫（建議第 4-5 卡）' },
    'TST': { cross:false, walk:4.5, cars:[5,6], tip:'經地下行人隧道往返尖東站（建議第 5-6 卡）' },
    'ETS': { cross:false, walk:4.5, cars:[4,5], tip:'經地下行人隧道往返尖沙咀站（建議第 4-5 卡）' }
};

// Pedestrian transfer links between paired stations (e.g. CEN<->HOK, TST<->ETS)
const MTR_WALK_LINKS = [
    ['CEN','HOK', 4.5],
    ['TST','ETS', 4.5]
];

// External fares store (auto-loaded from mtr_fares.json if packaged in APK)
window.MTR_FARES_TABLE = null;

function getStationLines(staCode) {
    const out = [];
    Object.values(MTR_LINES).forEach(l => {
        if (l.base) return; // skip branch duplicates for badge display
        if (l.stations.includes(staCode)) out.push(l.id);
    });
    // Check branch-only stations (LHP, LMC, RAC)
    if (staCode === 'LHP' && !out.includes('TKL')) out.push('TKL');
    if ((staCode === 'LMC' || staCode === 'RAC') && !out.includes('EAL')) out.push('EAL');
    return out;
}

function estimateMtrFare(fromCode, toCode, stopsCount, usesCrossHarbour, usesBorder, usesAEL) {
    if (fromCode === toCode) return { oct: 0, single: 0, child: 0, joy: 0 };
    if (window.MTR_FARES_TABLE) {
        const key = `${fromCode}-${toCode}`;
        const rev = `${toCode}-${fromCode}`;
        const hit = window.MTR_FARES_TABLE[key] || window.MTR_FARES_TABLE[rev];
        if (hit && hit.oct) return hit;
    }
    if (usesAEL) {
        const oct = (fromCode === 'AIR' || toCode === 'AIR' || fromCode === 'AWE' || toCode === 'AWE') ? 110.0 : 65.0;
        return { oct, single: oct + 5, child: +(oct / 2).toFixed(1), joy: +(oct / 2).toFixed(1) };
    }
    if (usesBorder) {
        const oct = Math.min(54.5, +(26.5 + stopsCount * 1.4).toFixed(1));
        return { oct, single: +(oct + 2.5).toFixed(1), child: +(oct * 0.5).toFixed(1), joy: +(oct * 0.5).toFixed(1) };
    }
    let oct = 4.9 + Math.max(0, stopsCount - 1) * 1.05;
    if (usesCrossHarbour) oct += 4.2;
    oct = Math.min(26.5, Math.round(oct * 2) / 2);
    const single = Math.round((oct + 1.0) * 2) / 2;
    const child = Math.max(3.2, Math.round((oct * 0.5) * 10) / 10);
    return { oct, single, child, joy: 2.0 };
}

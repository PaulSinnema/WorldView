// WorldView translations: shared by the Blazor UI (via getStrings) and the globe engine
export const LANGS = { en: 'English', nl: 'Nederlands', de: 'Deutsch', fr: 'Français', zh: '中文' };
export const LOCALES = { en: 'en-GB', nl: 'nl-NL', de: 'de-DE', fr: 'fr-FR', zh: 'zh-CN' };

// key: [en, nl, de, fr, zh]
const S = {
    // boot / errors
    'boot.init': ['WORLDVIEW · INITIALISING GLOBE…', 'WORLDVIEW · GLOBE INITIALISEREN…', 'WORLDVIEW · GLOBUS WIRD INITIALISIERT…', 'WORLDVIEW · INITIALISATION DU GLOBE…', 'WORLDVIEW · 正在初始化地球…'],
    'boot.fail': ['WorldView could not start.', 'WorldView kon niet starten.', 'WorldView konnte nicht starten.', 'WorldView n’a pas pu démarrer.', 'WorldView 无法启动。'],
    'err.cesium': ['CesiumJS could not be loaded (check the internet connection).', 'CesiumJS kon niet worden geladen (controleer de internetverbinding).', 'CesiumJS konnte nicht geladen werden (Internetverbindung prüfen).', 'CesiumJS n’a pas pu être chargé (vérifiez la connexion Internet).', '无法加载 CesiumJS（请检查网络连接）。'],

    // HUD
    'hud.optics': ['OPTICS', 'OPTIEK', 'OPTIK', 'OPTIQUE', '光学'],
    'hud.detect': ['DETECTION', 'DETECTIE', 'ERKENNUNG', 'DÉTECTION', '检测'],
    'hud.target': ['TARGET', 'DOEL', 'ZIEL', 'CIBLE', '目标'],
    'dir.n': ['N', 'N', 'N', 'N', 'N'],
    'dir.s': ['S', 'Z', 'S', 'S', 'S'],
    'dir.e': ['E', 'O', 'O', 'E', 'E'],
    'dir.w': ['W', 'W', 'W', 'O', 'W'],

    // top bar
    'search.placeholder': ['Search place or lat, lon…', 'Zoek plaats of lat, lon…', 'Ort oder Breite, Länge suchen…', 'Rechercher un lieu ou lat, lon…', '搜索地点或纬度, 经度…'],
    'search.title': ['Search', 'Zoeken', 'Suchen', 'Rechercher', '搜索'],
    'voice.title': ['Voice control', 'Spraakbesturing', 'Sprachsteuerung', 'Commande vocale', '语音控制'],
    'panel.title': ['Panel', 'Paneel', 'Bedienfeld', 'Panneau', '面板'],

    // panel sections
    'sec.lang': ['LANGUAGE', 'TAAL', 'SPRACHE', 'LANGUE', '语言'],
    'sec.layers': ['DATA LAYERS', 'DATALAGEN', 'DATENEBENEN', 'COUCHES DE DONNÉES', '数据图层'],
    'sec.optics': ['OPTICS', 'OPTIEK', 'OPTIK', 'OPTIQUE', '光学'],
    'sec.display': ['DISPLAY', 'WEERGAVE', 'ANZEIGE', 'AFFICHAGE', '显示'],
    'sec.map': ['MAP', 'KAART', 'KARTE', 'CARTE', '地图'],
    'zoom.on': ['Zoom in on click: on', 'Inzoomen bij klikken: aan', 'Beim Klicken zoomen: an', 'Zoom au clic : activé', '点击时缩放：开'],
    'zoom.off': ['Zoom in on click: off', 'Inzoomen bij klikken: uit', 'Beim Klicken zoomen: aus', 'Zoom au clic : désactivé', '点击时缩放：关'],

    // layers
    'layer.flights': ['Flights', 'Vluchten', 'Flüge', 'Vols', '航班'],
    'layer.military': ['Military flights', 'Militaire vluchten', 'Militärflüge', 'Vols militaires', '军用航班'],
    'layer.trains': ['Trains (NL, FI, US, CA)', 'Treinen (NL, FI, US, CA)', 'Züge (NL, FI, US, CA)', 'Trains (NL, FI, US, CA)', '火车（荷兰、芬兰、美国、加拿大）'],
    'layer.satellites': ['Satellites', 'Satellieten', 'Satelliten', 'Satellites', '卫星'],
    'layer.telescopes': ['Space telescopes', 'Ruimtetelescopen', 'Weltraumteleskope', 'Télescopes spatiaux', '太空望远镜'],
    'layer.quakes': ['Earthquakes', 'Aardbevingen', 'Erdbeben', 'Séismes', '地震'],
    'layer.fires': ['Wildfires', 'Bosbranden', 'Waldbrände', 'Feux de forêt', '山火'],
    'layer.launches': ['Launches', 'Lanceringen', 'Raketenstarts', 'Lancements', '发射'],
    'layer.radio': ['Radio', 'Radio', 'Radio', 'Radio', '电台'],
    'layer.cameras': ['Traffic cameras', 'Verkeerscamera\'s', 'Verkehrskameras', 'Caméras de trafic', '交通摄像头'],

    // optics
    'style.normal': ['Normal', 'Normaal', 'Normal', 'Normal', '正常'],
    'style.snow': ['Snow', 'Sneeuw', 'Schnee', 'Neige', '雪'],

    // display
    'btn.detect': ['Detection', 'Detectie', 'Erkennung', 'Détection', '检测'],
    'btn.daynight': ['Day/night', 'Dag/nacht', 'Tag/Nacht', 'Jour/nuit', '昼夜'],
    'btn.borders': ['Borders', 'Grenzen', 'Grenzen', 'Frontières', '边界'],
    'btn.regions': ['Provinces/states', 'Provincies/staten', 'Bundesländer/Regionen', 'Provinces/États', '省/州'],
    'btn.cities': ['Cities', 'Steden', 'Städte', 'Villes', '城市'],
    'night': ['Night', 'Nacht', 'Nacht', 'Nuit', '夜晚'],
    'night.aria': ['Night side brightness', 'Helderheid nachtzijde', 'Helligkeit der Nachtseite', 'Luminosité côté nuit', '夜侧亮度'],

    // map
    'map.esri': ['Esri satellite', 'Esri satelliet', 'Esri Satellit', 'Esri satellite', 'Esri 卫星图'],
    'map.dark': ['Dark (CARTO)', 'Donker (CARTO)', 'Dunkel (CARTO)', 'Sombre (CARTO)', '暗色 (CARTO)'],
    'map.osm': ['OpenStreetMap', 'OpenStreetMap', 'OpenStreetMap', 'OpenStreetMap', 'OpenStreetMap'],
    'map.google': ['Google 3D (ion token)', 'Google 3D (ion-token)', 'Google 3D (ion-Token)', 'Google 3D (jeton ion)', 'Google 3D（ion 令牌）'],
    'btn.reset': ['Reset globe', 'Reset globe', 'Globus zurücksetzen', 'Réinitialiser', '重置地球'],
    'btn.share': ['Share link', 'Deel link', 'Link teilen', 'Partager', '分享链接'],
    'btn.save': ['Save', 'Opslaan', 'Speichern', 'Enregistrer', '保存'],
    'ion.placeholder': ['Cesium ion token', 'Cesium ion-token', 'Cesium-ion-Token', 'Jeton Cesium ion', 'Cesium ion 令牌'],
    'hint.ion': ['Optional. A free token from cesium.com/ion enables Google 3D cities and world terrain. Stored in this browser only.', 'Optioneel. Gratis token via cesium.com/ion schakelt Google 3D-steden en wereldterrein in. Wordt alleen in deze browser bewaard.', 'Optional. Ein kostenloses Token von cesium.com/ion aktiviert Google-3D-Städte und Weltgelände. Wird nur in diesem Browser gespeichert.', 'Facultatif. Un jeton gratuit sur cesium.com/ion active les villes 3D Google et le relief mondial. Conservé uniquement dans ce navigateur.', '可选。从 cesium.com/ion 获取的免费令牌可启用 Google 3D 城市和全球地形。仅保存在此浏览器中。'],
    'hint.sources': ['Flight data: OpenSky Network · military: adsb.lol (ODbL) · places: GeoNames (CC BY 4.0) · borders: geoBoundaries (CC BY 4.0), Natural Earth', 'Vluchtdata: OpenSky Network · militair: adsb.lol (ODbL) · plaatsen: GeoNames (CC BY 4.0) · grenzen: geoBoundaries (CC BY 4.0), Natural Earth', 'Flugdaten: OpenSky Network · Militär: adsb.lol (ODbL) · Orte: GeoNames (CC BY 4.0) · Grenzen: geoBoundaries (CC BY 4.0), Natural Earth', 'Données de vol : OpenSky Network · militaire : adsb.lol (ODbL) · lieux : GeoNames (CC BY 4.0) · frontières : geoBoundaries (CC BY 4.0), Natural Earth', '航班数据：OpenSky Network · 军用：adsb.lol (ODbL) · 地点：GeoNames (CC BY 4.0) · 边界：geoBoundaries (CC BY 4.0)、Natural Earth'],
    'hint.keys': ['←↑↓→ move · +/− zoom · 1–7 optics · H HUD · D detection · N day/night · B borders · C cockpit · Esc release', '←↑↓→ verschuiven · +/− zoomen · 1–7 optiek · H HUD · D detectie · N dag/nacht · B grenzen · C cockpit · Esc loslaten', '←↑↓→ bewegen · +/− zoomen · 1–7 Optik · H HUD · D Erkennung · N Tag/Nacht · B Grenzen · C Cockpit · Esc loslassen', '←↑↓→ déplacer · +/− zoomer · 1–7 optique · H HUD · D détection · N jour/nuit · B frontières · C cockpit · Échap relâcher', '←↑↓→ 移动 · +/− 缩放 · 1–7 光学 · H HUD · D 检测 · N 昼夜 · B 边界 · C 驾驶舱 · Esc 释放'],

    // info panel
    'info.close': ['Close', 'Sluiten', 'Schließen', 'Fermer', '关闭'],
    'info.enlarge': ['Click to enlarge', 'Klik om te vergroten', 'Zum Vergrößern klicken', 'Cliquer pour agrandir', '点击放大'],
    'info.shrink': ['Click to shrink', 'Klik om te verkleinen', 'Zum Verkleinern klicken', 'Cliquer pour réduire', '点击缩小'],
    'info.zoomHint': ['scroll or pinch to zoom, drag to pan, double-click to reset', 'scrollen of knijpen om te zoomen, slepen om te verschuiven, dubbelklik om te herstellen', 'Scrollen oder Ziehen mit zwei Fingern zum Zoomen, Ziehen zum Verschieben, Doppelklick zum Zurücksetzen', 'molette ou pincement pour zoomer, glisser pour déplacer, double-clic pour réinitialiser', '滚轮或双指缩放，拖动平移，双击复位'],
    'info.wiki': ['More on Wikipedia ↗', 'Meer op Wikipedia ↗', 'Mehr auf Wikipedia ↗', 'En savoir plus sur Wikipédia ↗', '在维基百科上了解更多 ↗'],
    'btn.enlarge': ['Enlarge', 'Vergroot', 'Vergrößern', 'Agrandir', '放大'],
    'btn.contacts': ['Contacts 250 km', 'Contacten 250 km', 'Kontakte 250 km', 'Contacts 250 km', '250 公里内目标'],
    'btn.stopRadio': ['Stop radio', 'Stop radio', 'Radio stoppen', 'Arrêter la radio', '停止电台'],
    // radio panel
    'radio.title': ['RADIO', 'RADIO', 'RADIO', 'RADIO', '电台'],
    'radio.search': ['Search station…', 'Zoek zender…', 'Sender suchen…', 'Rechercher une station…', '搜索电台…'],
    'radio.allCountries': ['All countries', 'Alle landen', 'Alle Länder', 'Tous les pays', '所有国家'],
    'radio.allGenres': ['All genres', 'Alle genres', 'Alle Genres', 'Tous les genres', '所有类型'],
    'radio.inView': ['In view', 'In beeld', 'Im Bild', 'Dans la vue', '视野内'],
    'radio.favorites': ['Favourites', 'Favorieten', 'Favoriten', 'Favoris', '收藏'],
    'radio.count': ['{n} stations', '{n} zenders', '{n} Sender', '{n} stations', '{n} 个电台'],
    'radio.none': ['No stations found', 'Geen zenders gevonden', 'Keine Sender gefunden', 'Aucune station trouvée', '未找到电台'],
    'radio.prev': ['Previous station', 'Vorige zender', 'Vorheriger Sender', 'Station précédente', '上一个电台'],
    'radio.next': ['Next station', 'Volgende zender', 'Nächster Sender', 'Station suivante', '下一个电台'],
    'radio.playPause': ['Play/pause', 'Afspelen/pauze', 'Wiedergabe/Pause', 'Lecture/pause', '播放/暂停'],
    'radio.stop': ['Stop', 'Stop', 'Stopp', 'Arrêt', '停止'],
    'radio.volume': ['Volume', 'Volume', 'Lautstärke', 'Volume', '音量'],
    'radio.fav': ['Add/remove favourite', 'Favoriet aan/uit', 'Favorit an/aus', 'Ajouter/retirer des favoris', '添加/移除收藏'],
    'radio.collapse': ['Collapse/expand', 'In-/uitklappen', 'Ein-/ausklappen', 'Réduire/développer', '折叠/展开'],
    'radio.noGeo': ['no location', 'geen locatie', 'kein Standort', 'sans position', '无位置'],
    'genre.news': ['News', 'Nieuws', 'Nachrichten', 'Infos', '新闻'],
    'genre.talk': ['Talk', 'Praat', 'Talk', 'Débat', '谈话'],
    'genre.pop': ['Pop', 'Pop', 'Pop', 'Pop', '流行'],
    'genre.rock': ['Rock', 'Rock', 'Rock', 'Rock', '摇滚'],
    'genre.classical': ['Classical', 'Klassiek', 'Klassik', 'Classique', '古典'],
    'genre.jazz': ['Jazz', 'Jazz', 'Jazz', 'Jazz', '爵士'],
    'genre.dance': ['Dance', 'Dance', 'Dance', 'Dance', '舞曲'],
    'genre.electronic': ['Electronic', 'Elektronisch', 'Elektronisch', 'Électronique', '电子'],
    'genre.hiphop': ['Hip hop', 'Hiphop', 'Hip-Hop', 'Hip-hop', '嘻哈'],
    'genre.country': ['Country', 'Country', 'Country', 'Country', '乡村'],
    'genre.oldies': ['Oldies', 'Oldies', 'Oldies', 'Rétro', '怀旧'],
    'genre.sports': ['Sports', 'Sport', 'Sport', 'Sport', '体育'],
    'genre.religious': ['Religious', 'Religieus', 'Religiös', 'Religieux', '宗教'],
    'genre.chillout': ['Chill-out', 'Chill-out', 'Chill-out', 'Chill-out', '放松'],

    // toasts (UI)
    'toast.notFound': ['Not found: {q}', 'Niet gevonden: {q}', 'Nicht gefunden: {q}', 'Introuvable : {q}', '未找到：{q}'],
    'toast.shared': ['Link with camera, layers and optics copied', 'Link met camera, lagen en optiek gekopieerd', 'Link mit Kamera, Ebenen und Optik kopiert', 'Lien avec caméra, couches et optique copié', '已复制包含视角、图层和光学的链接'],
    'toast.noVoice': ['Speech recognition is not supported in this browser', 'Spraakherkenning wordt niet ondersteund in deze browser', 'Spracherkennung wird in diesem Browser nicht unterstützt', 'La reconnaissance vocale n’est pas prise en charge par ce navigateur', '此浏览器不支持语音识别'],
    'toast.noContacts': ['No aircraft within 250 km', 'Geen vliegtuigen binnen 250 km', 'Keine Flugzeuge im Umkreis von 250 km', 'Aucun avion dans un rayon de 250 km', '250 公里内没有飞机'],

    // toasts (engine)
    'err.ionNeeded': ['Google 3D requires a Cesium ion token (POWER UP).', 'Google 3D vereist een Cesium ion-token (POWER UP).', 'Google 3D benötigt ein Cesium-ion-Token (POWER UP).', 'Google 3D nécessite un jeton Cesium ion (POWER UP).', 'Google 3D 需要 Cesium ion 令牌（POWER UP）。'],
    'err.google3d': ['Google 3D not available: {e}', 'Google 3D niet beschikbaar: {e}', 'Google 3D nicht verfügbar: {e}', 'Google 3D indisponible : {e}', 'Google 3D 不可用：{e}'],
    'toast.noGpu': ['No GPU acceleration: enable hardware acceleration in the browser', 'Geen GPU-versnelling actief: zet hardwareversnelling aan in de browser', 'Keine GPU-Beschleunigung: Hardwarebeschleunigung im Browser aktivieren', 'Pas d’accélération GPU : activez l’accélération matérielle du navigateur', '未启用 GPU 加速：请在浏览器中开启硬件加速'],
    'toast.bordersFail': ['Country borders could not be loaded', 'Landgrenzen konden niet worden geladen', 'Landesgrenzen konnten nicht geladen werden', 'Impossible de charger les frontières', '无法加载国界'],
    'toast.regionsFail': ['Province borders could not be loaded', 'Provinciegrenzen konden niet worden geladen', 'Regionsgrenzen konnten nicht geladen werden', 'Impossible de charger les limites des provinces', '无法加载省界'],
    'toast.citiesFail': ['Cities could not be loaded', 'Steden konden niet worden geladen', 'Städte konnten nicht geladen werden', 'Impossible de charger les villes', '无法加载城市'],
    'toast.radioFail': ['Station could not be played', 'Zender kon niet worden afgespeeld', 'Sender konnte nicht abgespielt werden', 'Impossible de lire la station', '无法播放电台'],
    'toast.opticsFail': ['Optics not available: {e}', 'Optiek niet beschikbaar: {e}', 'Optik nicht verfügbar: {e}', 'Optique indisponible : {e}', '光学效果不可用：{e}'],
    'toast.selectPlane': ['Select an aircraft first', 'Selecteer eerst een vliegtuig', 'Zuerst ein Flugzeug auswählen', 'Sélectionnez d’abord un avion', '请先选择一架飞机'],
    'toast.detectOff': ['Detection switched off: {e}', 'Detectie uitgeschakeld: {e}', 'Erkennung ausgeschaltet: {e}', 'Détection désactivée : {e}', '检测已关闭：{e}'],
    'toast.voiceErr': ['Speech: {e}', 'Spraak: {e}', 'Sprache: {e}', 'Voix : {e}', '语音：{e}'],

    // layer status lines
    'st.error': ['error: {e}', 'fout: {e}', 'Fehler: {e}', 'erreur : {e}', '错误：{e}'],
    'st.feedDown': ['data feed unreachable, retrying…', 'datafeed niet bereikbaar, nieuwe poging…', 'Datenfeed nicht erreichbar, neuer Versuch…', 'flux de données inaccessible, nouvel essai…', '数据源无法访问，正在重试…'],
    'st.sourceDown': ['source unreachable, retrying…', 'bron niet bereikbaar, nieuwe poging…', 'Quelle nicht erreichbar, neuer Versuch…', 'source inaccessible, nouvel essai…', '数据源无法访问，正在重试…'],
    'st.sourceDownLimit': ['source unreachable (rate limit?), retrying…', 'bron niet bereikbaar (limiet?), nieuwe poging…', 'Quelle nicht erreichbar (Limit?), neuer Versuch…', 'source inaccessible (limite ?), nouvel essai…', '数据源无法访问（频率限制？），正在重试…'],
    'st.age': ['{src}, {s} s old', '{src}, {s} s oud', '{src}, {s} s alt', '{src}, il y a {s} s', '{src}，{s} 秒前'],
    'st.quakes': ['USGS, last 24 hours', 'USGS, laatste 24 uur', 'USGS, letzte 24 Stunden', 'USGS, dernières 24 heures', 'USGS，过去 24 小时'],
    'st.fires': ['NASA EONET, active fires', 'NASA EONET, open branden', 'NASA EONET, aktive Brände', 'NASA EONET, feux actifs', 'NASA EONET，活跃火点'],
    'st.launches': ['Launch Library 2, upcoming launches', 'Launch Library 2, komende lanceringen', 'Launch Library 2, kommende Starts', 'Launch Library 2, prochains lancements', 'Launch Library 2，即将发射'],
    'st.telescopes': ['CelesTrak (SGP4) + {n} at L2 (approximate)', 'CelesTrak (SGP4) + {n} op L2 (bij benadering)', 'CelesTrak (SGP4) + {n} bei L2 (ungefähr)', 'CelesTrak (SGP4) + {n} en L2 (approximatif)', 'CelesTrak (SGP4) + {n} 个位于 L2（近似）'],
    'st.camsDown': ['unreachable: {list}', 'niet bereikbaar: {list}', 'nicht erreichbar: {list}', 'inaccessibles : {list}', '无法访问：{list}'],

    // satellite groups
    'grp.stations': ['Space station', 'Ruimtestation', 'Raumstation', 'Station spatiale', '空间站'],
    'grp.visual': ['Bright / visible', 'Helder zichtbaar', 'Hell sichtbar', 'Bien visible', '肉眼可见'],
    'grp.gps': ['GPS', 'GPS', 'GPS', 'GPS', 'GPS'],
    'grp.weather': ['Weather satellite', 'Weersatelliet', 'Wettersatellit', 'Satellite météo', '气象卫星'],
    'grp.science': ['Science', 'Wetenschap', 'Wissenschaft', 'Science', '科学'],
    'grp.geo': ['Geostationary', 'Geostationair', 'Geostationär', 'Géostationnaire', '地球静止'],
    'grp.telescope': ['Space telescope', 'Ruimtetelescoop', 'Weltraumteleskop', 'Télescope spatial', '太空望远镜'],
    'grp.telescopeL2': ['Space telescope (L2)', 'Ruimtetelescoop (L2)', 'Weltraumteleskop (L2)', 'Télescope spatial (L2)', '太空望远镜（L2）'],

    // camera regions
    'cam.london': ['London', 'Londen', 'London', 'Londres', '伦敦'],
    'cam.finland': ['Finland', 'Finland', 'Finnland', 'Finlande', '芬兰'],
    'cam.california': ['California', 'Californië', 'Kalifornien', 'Californie', '加利福尼亚'],
    'cam.austin': ['Austin', 'Austin', 'Austin', 'Austin', '奥斯汀'],
    'cam.calgary': ['Calgary', 'Calgary', 'Calgary', 'Calgary', '卡尔加里'],
    'cam.hongkong': ['Hong Kong', 'Hongkong', 'Hongkong', 'Hong Kong', '香港'],

    // info fields
    'f.rollingStock': ['Rolling stock', 'Materieel', 'Fahrzeug', 'Matériel', '车型'],
    'f.units': ['Units', 'Treinstellen', 'Triebzüge', 'Rames', '编组'],
    'f.seats': ['Seats', 'Zitplaatsen', 'Sitzplätze', 'Places assises', '座位'],
    'f.length': ['Length', 'Lengte', 'Länge', 'Longueur', '长度'],
    'f.bikes': ['Bike spaces', 'Fietsplekken', 'Fahrradplätze', 'Places vélo', '自行车位'],
    'f.facilities': ['Facilities', 'Voorzieningen', 'Ausstattung', 'Équipements', '设施'],
    'v.cars': ['{n} carriages', '{n} bakken', '{n} Wagen', '{n} voitures', '{n} 节车厢'],
    'v.seats': ['1st {a} · 2nd {b}', '1e {a} · 2e {b}', '1. {a} · 2. {b}', '1re {a} · 2e {b}', '一等 {a} · 二等 {b}'],
    'fac.toilet': ['toilet', 'toilet', 'WC', 'toilettes', '厕所'],
    'fac.stroom': ['power sockets', 'stopcontacten', 'Steckdosen', 'prises', '电源插座'],
    'fac.fiets': ['bikes', 'fietsen', 'Fahrräder', 'vélos', '自行车'],
    'fac.toegankelijk': ['step-free', 'toegankelijk', 'barrierefrei', 'accessible', '无障碍'],
    'fac.wifi': ['Wi-Fi', 'wifi', 'WLAN', 'Wi-Fi', 'Wi-Fi'],
    'fac.stilte': ['quiet zone', 'stiltecoupé', 'Ruhebereich', 'zone calme', '静音车厢'],
    'f.route': ['Route', 'Route', 'Strecke', 'Ligne', '线路'],
    'f.from': ['From', 'Van', 'Von', 'De', '始发'],
    'f.to': ['To', 'Naar', 'Nach', 'À', '终点'],
    'f.train': ['Train', 'Trein', 'Zug', 'Train', '列车'],
    'f.callsign': ['Callsign', 'Callsign', 'Rufzeichen', 'Indicatif', '呼号'],
    'f.country': ['Country', 'Land', 'Land', 'Pays', '国家'],
    'f.icao': ['ICAO', 'ICAO', 'ICAO', 'OACI', 'ICAO'],
    'f.squawk': ['Squawk', 'Squawk', 'Squawk', 'Squawk', '应答码'],
    'f.registration': ['Registration', 'Registratie', 'Kennzeichen', 'Immatriculation', '注册号'],
    'f.type': ['Type', 'Type', 'Typ', 'Type', '机型'],
    'f.altitude': ['Altitude', 'Hoogte', 'Höhe', 'Altitude', '高度'],
    'f.elevation': ['Elevation', 'Hoogte', 'Höhe', 'Altitude', '海拔'],
    'f.speed': ['Speed', 'Snelheid', 'Geschwindigkeit', 'Vitesse', '速度'],
    'f.heading': ['Heading', 'Koers', 'Kurs', 'Cap', '航向'],
    'f.position': ['Position', 'Positie', 'Position', 'Position', '位置'],
    'f.group': ['Group', 'Groep', 'Gruppe', 'Groupe', '类别'],
    'f.location': ['Location', 'Locatie', 'Ort', 'Lieu', '地点'],
    'f.distance': ['Distance', 'Afstand', 'Entfernung', 'Distance', '距离'],
    'f.norad': ['NORAD', 'NORAD', 'NORAD', 'NORAD', 'NORAD'],
    'f.period': ['Orbital period', 'Omlooptijd', 'Umlaufzeit', 'Période orbitale', '轨道周期'],
    'f.magnitude': ['Magnitude', 'Magnitude', 'Magnitude', 'Magnitude', '震级'],
    'f.depth': ['Depth', 'Diepte', 'Tiefe', 'Profondeur', '深度'],
    'f.time': ['Time', 'Tijd', 'Zeit', 'Heure', '时间'],
    'f.tsunami': ['Tsunami', 'Tsunami', 'Tsunami', 'Tsunami', '海啸'],
    'f.name': ['Name', 'Naam', 'Name', 'Nom', '名称'],
    'f.date': ['Date', 'Datum', 'Datum', 'Date', '日期'],
    'f.source': ['Source', 'Bron', 'Quelle', 'Source', '来源'],
    'f.extent': ['Extent', 'Omvang', 'Ausdehnung', 'Étendue', '范围'],
    'f.mission': ['Mission', 'Missie', 'Mission', 'Mission', '任务'],
    'f.launchTime': ['Launch time', 'Tijdstip', 'Startzeit', 'Heure de lancement', '发射时间'],
    'f.countdown': ['Countdown', 'Countdown', 'Countdown', 'Compte à rebours', '倒计时'],
    'f.status': ['Status', 'Status', 'Status', 'Statut', '状态'],
    'f.provider': ['Provider', 'Aanbieder', 'Anbieter', 'Opérateur', '发射商'],
    'f.rocket': ['Rocket', 'Raket', 'Rakete', 'Fusée', '火箭'],
    'f.pad': ['Launch pad', 'Platform', 'Startrampe', 'Pas de tir', '发射台'],
    'f.description': ['Description', 'Omschrijving', 'Beschreibung', 'Description', '描述'],
    'f.station': ['Station', 'Zender', 'Sender', 'Station', '电台'],
    'f.genre': ['Genre', 'Genre', 'Genre', 'Genre', '类型'],
    'f.codec': ['Codec', 'Codec', 'Codec', 'Codec', '编码'],
    'f.camera': ['Camera', 'Camera', 'Kamera', 'Caméra', '摄像头'],
    'f.region': ['Region', 'Regio', 'Region', 'Région', '地区'],
    'f.operator': ['Operator', 'Beheerder', 'Betreiber', 'Gestionnaire', '运营方'],
    'f.province': ['Province/region', 'Provincie/regio', 'Bundesland/Region', 'Province/région', '省/地区'],
    'f.population': ['Population', 'Inwoners', 'Einwohner', 'Population', '人口'],
    'f.timezone': ['Time zone', 'Tijdzone', 'Zeitzone', 'Fuseau horaire', '时区'],

    // info values
    'v.onGround': ['on the ground', 'aan de grond', 'am Boden', 'au sol', '在地面'],
    'v.warning': ['warning', 'waarschuwing', 'Warnung', 'alerte', '警报'],
    'v.no': ['no', 'nee', 'nein', 'non', '无'],
    'v.unknown': ['unknown', 'onbekend', 'unbekannt', 'inconnu', '未知'],
    'v.capital': ['Capital', 'Hoofdstad', 'Hauptstadt', 'Capitale', '首都'],
    'v.provCapital': ['Province/region capital', 'Hoofdplaats provincie/regio', 'Hauptstadt der Region', 'Chef-lieu de province/région', '省/地区首府'],
    'v.l2': ['Sun–Earth Lagrange point L2', 'Zon-aarde Lagrangepunt L2', 'Sonne-Erde-Lagrange-Punkt L2', 'Point de Lagrange Soleil-Terre L2', '日地拉格朗日点 L2'],
    'v.approx': ['approximate (no orbital data)', 'bij benadering (geen baangegevens)', 'ungefähr (keine Bahndaten)', 'approximatif (pas de données orbitales)', '近似（无轨道数据）'],
    'v.millionKm': ['± {n} million km', '± {n} mln km', '± {n} Mio. km', '± {n} millions de km', '约 {n} 百万公里'],
    'v.nowTime': ['{tz} (now {t})', '{tz} (nu {t})', '{tz} (jetzt {t})', '{tz} (maintenant {t})', '{tz}（当前 {t}）'],
    'v.wikiLoading': ['Loading Wikipedia…', 'Wikipedia laden…', 'Wikipedia wird geladen…', 'Chargement de Wikipédia…', '正在加载维基百科…'],
    'u.kmh': ['km/h', 'km/u', 'km/h', 'km/h', '公里/时'],
    'u.hour': ['h', 'u', 'h', 'h', '时'],
    'u.day': ['d', 'd', 'T', 'j', '天'],

    // voice
    'v.notUnderstood': ['not understood', 'niet begrepen', 'nicht verstanden', 'pas compris', '未能理解'],
    'v.locNotFound': ['location not found', 'locatie niet gevonden', 'Ort nicht gefunden', 'lieu introuvable', '未找到地点'],
    'v.on': ['on', 'aan', 'an', 'activé', '开'],
    'v.off': ['off', 'uit', 'aus', 'désactivé', '关']
};

const IDX = { en: 0, nl: 1, de: 2, fr: 3, zh: 4 };

export function pickLang(saved) {
    if (saved && saved in LANGS) return saved;
    for (const l of navigator.languages || [navigator.language || 'en']) {
        const k = String(l).slice(0, 2).toLowerCase();
        if (k in LANGS) return k;
    }
    return 'en';
}

// Translate with {name} placeholders; falls back to English, then the key
export function t(lang, key, params) {
    const row = S[key];
    let s = row ? (row[IDX[lang] ?? 0] ?? row[0]) : key;
    if (params) for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v));
    return s;
}

export function strings(lang) {
    const out = {};
    for (const k of Object.keys(S)) out[k] = t(lang, k);
    return out;
}

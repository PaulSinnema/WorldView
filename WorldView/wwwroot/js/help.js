// Help page content per language: [icon, title, html]
const K = s => s.split(' ').map(k => `<kbd>${k}</kbd>`).join(' ');

const en = [
    ['🌍', 'Welcome', `<p><b>WorldView</b> is a live 3D globe in your browser: aircraft, trains, public transport, satellites, space telescopes, earthquakes, wildfires, launches, traffic cameras and internet radio, all on one map. Nothing to install; new versions load automatically (version at the top right).</p>`],
    ['🖱️', 'Moving around', `<ul>
        <li><b>Mouse</b>: drag to rotate, scroll to zoom, right-drag or Ctrl-drag to tilt.</li>
        <li><b>Keyboard</b>: ${K('← ↑ ↓ →')} move, ${K('+ −')} zoom.</li>
        <li><b>Search</b> (top): a place name or coordinates such as <code>52.21, 5.97</code>.</li>
        <li><b>Reset globe</b> returns to the overview; <b>Share link</b> copies a link to the current view.</li></ul>`],
    ['🛰️', 'Data layers', `<p>Switch layers on and off in the side panel. The number shows how many objects are loaded, with the source and age below.</p><ul>
        <li><b>Flights</b> and <b>Military flights</b>: live positions, type, registration and a photo of the aircraft.</li>
        <li><b>Trains</b>: the Netherlands (NS, with rolling stock and seats), Finland, the US and Canada.</li>
        <li><b>Bus, tram, metro</b>: all Dutch public transport.</li>
        <li><b>Satellites</b> and <b>Space telescopes</b> (Hubble, JWST, …) with their orbits.</li>
        <li><b>Earthquakes</b>, <b>Wildfires</b>, <b>Launches</b>, <b>Radio</b> and <b>Traffic cameras</b>.</li></ul>
        <p>The <b>⌖</b> button next to a layer sets whether the globe zooms in when you click an object of that layer.</p>`],
    ['ℹ️', 'Info box', `<p>Click an object, a city or a country name for details, usually with a photo and a Wikipedia summary. Click a photo or camera image to enlarge it; zoom with the wheel, buttons or pinch and drag to pan. Click beside the info box to close it.</p>
        <p>For aircraft: <b>Cockpit</b> (${K('C')}) rides along, <b>Nearby</b> lists traffic around it.</p>`],
    ['🎨', 'Optics', `<p>Seven views of the globe, keys ${K('1')}–${K('7')}: Normal, CRT, night vision, FLIR thermal, Ironbow, Noir and Snow.</p>`],
    ['👁️', 'Display', `<ul>
        <li><b>HUD</b> (${K('H')}): time, position and altitude top left.</li>
        <li><b>Detection</b> (${K('D')}): frames with names and speeds around objects.</li>
        <li><b>Day/night</b> (${K('N')}): the night side with city lights; the slider sets its brightness.</li>
        <li><b>Borders</b> (${K('B')}): countries with names, optionally provinces/states and cities.</li>
        <li><b>Time zones</b> (${K('Z')}): coloured zones with the local time; click a zone in the legend to highlight it.</li></ul>`],
    ['📻', 'Radio', `<p>Open the radio bar at the bottom. Search by name, country or genre, show only stations in view, or your ★ favourites. ⏮ ⏭ step through the list; the station keeps playing when you close the info box.</p>`],
    ['🗺️', 'Map & Power up', `<p>Choose the base map: Esri satellite, Dark, OpenStreetMap or Google 3D.</p>
        <p><b>Cesium ion token</b> (optional, free): create an account at <a href="https://cesium.com/ion" target="_blank" rel="noopener">cesium.com/ion</a>, copy your <i>Default token</i> under <i>Access Tokens</i> and paste it under Power up. This enables Google photorealistic 3D cities and world terrain. The token is only stored in this browser.</p>`],
    ['🎙️', 'Voice', `<p>Press the microphone and say for example “flights”, “trains”, “radio”, “night vision” or a place name.</p>`],
    ['⌨️', 'Keyboard shortcuts', `<table>
        <tr><td>${K('← ↑ ↓ →')}</td><td>move</td></tr><tr><td>${K('+ −')}</td><td>zoom</td></tr>
        <tr><td>${K('1')}–${K('7')}</td><td>optics</td></tr><tr><td>${K('H')} ${K('D')} ${K('N')} ${K('B')} ${K('Z')}</td><td>HUD, detection, day/night, borders, time zones</td></tr>
        <tr><td>${K('C')}</td><td>cockpit</td></tr><tr><td>${K('Esc')}</td><td>release / close</td></tr></table>`],
    ['📚', 'Sources', `<p>OpenSky Network, adsb.lol (ODbL), Planespotters.net, tar1090-db, NS, Digitraffic (CC BY 4.0), Amtraker, OVapi/NDOV, CelesTrak, USGS, NASA EONET, Launch Library 2, Radio Browser, Wikipedia/Wikidata, GeoNames (CC BY 4.0), Natural Earth, geoBoundaries (CC BY 4.0), Esri, OpenStreetMap, CesiumJS. Camera images: TfL, Fintraffic, Caltrans, Austin, Calgary, Hong Kong, Vegagerðin, DriveBC, Transport for NSW, NZTA.</p>`]
];

const nl = [
    ['🌍', 'Welkom', `<p><b>WorldView</b> is een live 3D-wereldbol in je browser: vliegtuigen, treinen, openbaar vervoer, satellieten, ruimtetelescopen, aardbevingen, bosbranden, lanceringen, verkeerscamera's en internetradio, allemaal op één kaart. Niets te installeren; nieuwe versies laden automatisch (versie rechtsboven).</p>`],
    ['🖱️', 'Bewegen', `<ul>
        <li><b>Muis</b>: slepen om te draaien, scrollen om te zoomen, rechts slepen of Ctrl-slepen om te kantelen.</li>
        <li><b>Toetsenbord</b>: ${K('← ↑ ↓ →')} verschuiven, ${K('+ −')} zoomen.</li>
        <li><b>Zoeken</b> (bovenaan): een plaatsnaam of coördinaten zoals <code>52.21, 5.97</code>.</li>
        <li><b>Reset globe</b> gaat terug naar het overzicht; <b>Deel link</b> kopieert een link naar het huidige beeld.</li></ul>`],
    ['🛰️', 'Datalagen', `<p>Zet lagen aan en uit in het zijpaneel. Het getal toont hoeveel objecten geladen zijn, met eronder de bron en hoe oud de gegevens zijn.</p><ul>
        <li><b>Vluchten</b> en <b>Militaire vluchten</b>: live posities, type, registratie en een foto van het toestel.</li>
        <li><b>Treinen</b>: Nederland (NS, met materieel en zitplaatsen), Finland, de VS en Canada.</li>
        <li><b>Bus, tram, metro</b>: al het Nederlandse openbaar vervoer.</li>
        <li><b>Satellieten</b> en <b>Ruimtetelescopen</b> (Hubble, JWST, …) met hun banen.</li>
        <li><b>Aardbevingen</b>, <b>Bosbranden</b>, <b>Lanceringen</b>, <b>Radio</b> en <b>Verkeerscamera's</b>.</li></ul>
        <p>Met de knop <b>⌖</b> naast een laag stel je in of de globe inzoomt als je een object van die laag aanklikt.</p>`],
    ['ℹ️', 'Infovenster', `<p>Klik op een object, een stad of een landnaam voor details, meestal met een foto en een samenvatting van Wikipedia. Klik op een foto of camerabeeld om te vergroten; zoom met het wiel, de knoppen of knijpen en sleep om te verschuiven. Klik naast het infovenster om het te sluiten.</p>
        <p>Bij vliegtuigen: <b>Cockpit</b> (${K('C')}) vliegt mee, <b>In de buurt</b> toont het verkeer eromheen.</p>`],
    ['🎨', 'Optiek', `<p>Zeven weergaven van de globe, toetsen ${K('1')}–${K('7')}: Normaal, CRT, nachtzicht, FLIR-warmtebeeld, Ironbow, Noir en Sneeuw.</p>`],
    ['👁️', 'Weergave', `<ul>
        <li><b>HUD</b> (${K('H')}): tijd, positie en hoogte linksboven.</li>
        <li><b>Detectie</b> (${K('D')}): kaders met namen en snelheden rond objecten.</li>
        <li><b>Dag/nacht</b> (${K('N')}): de nachtzijde met stadslichten; de schuif regelt de helderheid.</li>
        <li><b>Grenzen</b> (${K('B')}): landen met namen, eventueel provincies/staten en steden.</li>
        <li><b>Tijdzones</b> (${K('Z')}): gekleurde zones met de lokale tijd; klik een zone in de legenda om hem te laten oplichten.</li></ul>`],
    ['📻', 'Radio', `<p>Open de radiobalk onderaan. Zoek op naam, land of genre, toon alleen zenders in beeld, of je ★ favorieten. ⏮ ⏭ bladeren door de lijst; de zender blijft spelen als je het infovenster sluit.</p>`],
    ['🗺️', 'Kaart & Power up', `<p>Kies de ondergrond: Esri satelliet, Donker, OpenStreetMap of Google 3D.</p>
        <p><b>Cesium ion-token</b> (optioneel, gratis): maak een account op <a href="https://cesium.com/ion" target="_blank" rel="noopener">cesium.com/ion</a>, kopieer onder <i>Access Tokens</i> je <i>Default token</i> en plak die bij Power up. Dat schakelt fotorealistische Google 3D-steden en wereldterrein in. Het token wordt alleen in deze browser bewaard.</p>`],
    ['🎙️', 'Spraak', `<p>Druk op de microfoon en zeg bijvoorbeeld “vluchten”, “treinen”, “radio”, “nachtzicht” of een plaatsnaam.</p>`],
    ['⌨️', 'Sneltoetsen', `<table>
        <tr><td>${K('← ↑ ↓ →')}</td><td>verschuiven</td></tr><tr><td>${K('+ −')}</td><td>zoomen</td></tr>
        <tr><td>${K('1')}–${K('7')}</td><td>optiek</td></tr><tr><td>${K('H')} ${K('D')} ${K('N')} ${K('B')} ${K('Z')}</td><td>HUD, detectie, dag/nacht, grenzen, tijdzones</td></tr>
        <tr><td>${K('C')}</td><td>cockpit</td></tr><tr><td>${K('Esc')}</td><td>loslaten / sluiten</td></tr></table>`],
    ['📚', 'Bronnen', en[10][2]]
];

const de = [
    ['🌍', 'Willkommen', `<p><b>WorldView</b> ist ein Live-3D-Globus im Browser: Flugzeuge, Züge, ÖPNV, Satelliten, Weltraumteleskope, Erdbeben, Waldbrände, Raketenstarts, Verkehrskameras und Internetradio auf einer Karte. Keine Installation; neue Versionen laden automatisch (Version oben rechts).</p>`],
    ['🖱️', 'Bewegen', `<ul><li><b>Maus</b>: ziehen zum Drehen, scrollen zum Zoomen, rechts oder mit Strg ziehen zum Neigen.</li>
        <li><b>Tastatur</b>: ${K('← ↑ ↓ →')} bewegen, ${K('+ −')} zoomen.</li>
        <li><b>Suche</b> (oben): Ortsname oder Koordinaten wie <code>52.21, 5.97</code>.</li>
        <li><b>Globus zurücksetzen</b> zeigt die Übersicht; <b>Link teilen</b> kopiert einen Link zur Ansicht.</li></ul>`],
    ['🛰️', 'Datenebenen', `<p>Ebenen im Seitenbereich ein- und ausschalten; die Zahl zeigt die geladenen Objekte, darunter Quelle und Alter.</p><ul>
        <li><b>Flüge</b> und <b>Militärflüge</b> mit Typ, Kennzeichen und Foto.</li><li><b>Züge</b>: Niederlande (NS), Finnland, USA und Kanada.</li>
        <li><b>Bus, Tram, U-Bahn</b>: der gesamte niederländische ÖPNV.</li><li><b>Satelliten</b> und <b>Weltraumteleskope</b> mit Bahnen.</li>
        <li><b>Erdbeben</b>, <b>Waldbrände</b>, <b>Raketenstarts</b>, <b>Radio</b> und <b>Verkehrskameras</b>.</li></ul>
        <p><b>⌖</b> neben einer Ebene: zoomen beim Anklicken ein/aus.</p>`],
    ['ℹ️', 'Infofenster', `<p>Objekt, Stadt oder Ländername anklicken für Details mit Foto und Wikipedia-Text. Bilder vergrößern per Klick, zoomen mit Rad oder Fingern, verschieben durch Ziehen. Klick daneben schließt das Fenster. Bei Flugzeugen: <b>Cockpit</b> (${K('C')}) und <b>Umgebung</b>.</p>`],
    ['🎨', 'Optik', `<p>Sieben Ansichten, Tasten ${K('1')}–${K('7')}: Normal, CRT, Nachtsicht, FLIR, Ironbow, Noir und Schnee.</p>`],
    ['👁️', 'Anzeige', `<ul><li><b>HUD</b> (${K('H')}), <b>Erkennung</b> (${K('D')}) mit Namen und Geschwindigkeit.</li><li><b>Tag/Nacht</b> (${K('N')}) mit Helligkeitsregler.</li>
        <li><b>Grenzen</b> (${K('B')}) mit Provinzen und Städten.</li><li><b>Zeitzonen</b> (${K('Z')}): farbige Zonen mit Ortszeit; Zone in der Legende anklicken zum Hervorheben.</li></ul>`],
    ['📻', 'Radio', `<p>Radioleiste unten öffnen; Suche nach Name, Land oder Genre, nur Sender im Bild oder ★ Favoriten. ⏮ ⏭ blättern; die Wiedergabe läuft weiter.</p>`],
    ['🗺️', 'Karte & Power up', `<p>Grundkarte: Esri-Satellit, Dunkel, OpenStreetMap oder Google 3D.</p><p><b>Cesium-ion-Token</b> (optional, kostenlos): Konto auf <a href="https://cesium.com/ion" target="_blank" rel="noopener">cesium.com/ion</a> anlegen, unter <i>Access Tokens</i> den <i>Default token</i> kopieren und bei Power up einfügen. Aktiviert Google-3D-Städte und Weltgelände; wird nur in diesem Browser gespeichert.</p>`],
    ['🎙️', 'Sprache', `<p>Mikrofon drücken und z. B. „Flüge“, „Züge“, „Radio“, „Nachtsicht“ oder einen Ortsnamen sagen.</p>`],
    ['⌨️', 'Tastenkürzel', en[9][2].replace('move', 'bewegen').replace('zoom', 'zoomen').replace('optics', 'Optik').replace('HUD, detection, day/night, borders, time zones', 'HUD, Erkennung, Tag/Nacht, Grenzen, Zeitzonen').replace('release / close', 'loslassen / schließen')],
    ['📚', 'Quellen', en[10][2]]
];

const fr = [
    ['🌍', 'Bienvenue', `<p><b>WorldView</b> est un globe 3D en direct dans votre navigateur : avions, trains, transports publics, satellites, télescopes spatiaux, séismes, feux, lancements, caméras de trafic et radio internet sur une seule carte. Rien à installer ; les nouvelles versions se chargent automatiquement (version en haut à droite).</p>`],
    ['🖱️', 'Se déplacer', `<ul><li><b>Souris</b> : glisser pour tourner, molette pour zoomer, clic droit ou Ctrl pour incliner.</li>
        <li><b>Clavier</b> : ${K('← ↑ ↓ →')} déplacer, ${K('+ −')} zoomer.</li>
        <li><b>Recherche</b> (en haut) : un lieu ou des coordonnées comme <code>52.21, 5.97</code>.</li>
        <li><b>Réinitialiser</b> revient à la vue d'ensemble ; <b>Partager</b> copie un lien vers la vue.</li></ul>`],
    ['🛰️', 'Couches', `<p>Activez les couches dans le panneau latéral ; le nombre indique les objets chargés, avec la source et l'âge.</p><ul>
        <li><b>Vols</b> et <b>Vols militaires</b> avec type, immatriculation et photo.</li><li><b>Trains</b> : Pays-Bas (NS), Finlande, États-Unis et Canada.</li>
        <li><b>Bus, tram, métro</b> : tous les transports publics néerlandais.</li><li><b>Satellites</b> et <b>télescopes spatiaux</b> avec leurs orbites.</li>
        <li><b>Séismes</b>, <b>feux</b>, <b>lancements</b>, <b>radio</b> et <b>caméras</b>.</li></ul><p><b>⌖</b> à côté d'une couche : zoom au clic activé ou non.</p>`],
    ['ℹ️', "Fenêtre d'info", `<p>Cliquez sur un objet, une ville ou un pays pour les détails, avec photo et résumé Wikipédia. Cliquez sur une image pour l'agrandir, zoomez à la molette ou aux doigts et faites glisser. Cliquez à côté pour fermer. Avions : <b>Cockpit</b> (${K('C')}) et <b>À proximité</b>.</p>`],
    ['🎨', 'Optique', `<p>Sept vues, touches ${K('1')}–${K('7')} : Normal, CRT, vision nocturne, FLIR, Ironbow, Noir et Neige.</p>`],
    ['👁️', 'Affichage', `<ul><li><b>HUD</b> (${K('H')}), <b>Détection</b> (${K('D')}) avec noms et vitesses.</li><li><b>Jour/nuit</b> (${K('N')}) avec réglage de luminosité.</li>
        <li><b>Frontières</b> (${K('B')}) avec provinces et villes.</li><li><b>Fuseaux horaires</b> (${K('Z')}) : zones colorées avec l'heure locale ; cliquez dans la légende pour mettre une zone en évidence.</li></ul>`],
    ['📻', 'Radio', `<p>Ouvrez la barre radio en bas ; recherche par nom, pays ou genre, stations à l'écran ou ★ favoris. ⏮ ⏭ pour parcourir ; la lecture continue.</p>`],
    ['🗺️', 'Carte & Power up', `<p>Fond de carte : satellite Esri, Sombre, OpenStreetMap ou Google 3D.</p><p><b>Jeton Cesium ion</b> (optionnel, gratuit) : créez un compte sur <a href="https://cesium.com/ion" target="_blank" rel="noopener">cesium.com/ion</a>, copiez le <i>Default token</i> sous <i>Access Tokens</i> et collez-le dans Power up. Active les villes 3D Google et le relief mondial ; enregistré uniquement dans ce navigateur.</p>`],
    ['🎙️', 'Voix', `<p>Appuyez sur le micro et dites par exemple « vols », « trains », « radio », « vision nocturne » ou un lieu.</p>`],
    ['⌨️', 'Raccourcis', en[9][2].replace('move', 'déplacer').replace('zoom', 'zoomer').replace('optics', 'optique').replace('HUD, detection, day/night, borders, time zones', 'HUD, détection, jour/nuit, frontières, fuseaux').replace('release / close', 'relâcher / fermer')],
    ['📚', 'Sources', en[10][2]]
];

const zh = [
    ['🌍', '欢迎', `<p><b>WorldView</b> 是浏览器中的实时 3D 地球：飞机、火车、公共交通、卫星、太空望远镜、地震、山火、发射、交通摄像头和网络电台都在一张地图上。无需安装；新版本自动加载（版本号在右上角）。</p>`],
    ['🖱️', '移动', `<ul><li><b>鼠标</b>：拖动旋转，滚轮缩放，右键或 Ctrl 拖动倾斜。</li><li><b>键盘</b>：${K('← ↑ ↓ →')} 移动，${K('+ −')} 缩放。</li>
        <li><b>搜索</b>（顶部）：地名或坐标，例如 <code>52.21, 5.97</code>。</li><li><b>重置地球</b>回到全景；<b>分享链接</b>复制当前视图的链接。</li></ul>`],
    ['🛰️', '数据图层', `<p>在侧边栏开关图层；数字为已加载对象数量，下方为来源和数据时间。</p><ul><li><b>航班</b>和<b>军用航班</b>：机型、注册号和照片。</li>
        <li><b>火车</b>：荷兰（NS）、芬兰、美国和加拿大。</li><li><b>公交、电车、地铁</b>：荷兰全部公共交通。</li><li><b>卫星</b>和<b>太空望远镜</b>及其轨道。</li>
        <li><b>地震</b>、<b>山火</b>、<b>发射</b>、<b>电台</b>和<b>交通摄像头</b>。</li></ul><p>图层旁的 <b>⌖</b>：点击对象时是否缩放。</p>`],
    ['ℹ️', '信息窗口', `<p>点击对象、城市或国家名称查看详情，含照片和维基百科摘要。点击图片放大，可用滚轮或手指缩放并拖动。点击窗口外关闭。飞机：<b>驾驶舱</b>（${K('C')}）和<b>附近</b>。</p>`],
    ['🎨', '光学', `<p>七种视图，按键 ${K('1')}–${K('7')}：正常、CRT、夜视、FLIR 热成像、Ironbow、黑白和雪。</p>`],
    ['👁️', '显示', `<ul><li><b>HUD</b>（${K('H')}）、<b>检测</b>（${K('D')}）显示名称和速度。</li><li><b>昼夜</b>（${K('N')}）及亮度滑块。</li>
        <li><b>边界</b>（${K('B')}）含省份和城市。</li><li><b>时区</b>（${K('Z')}）：彩色时区与当地时间；在图例中点击时区可高亮。</li></ul>`],
    ['📻', '电台', `<p>打开底部电台栏；按名称、国家或类型搜索，仅显示视野内电台或 ★ 收藏。⏮ ⏭ 切换；关闭信息窗口后继续播放。</p>`],
    ['🗺️', '地图与 Power up', `<p>底图：Esri 卫星、暗色、OpenStreetMap 或 Google 3D。</p><p><b>Cesium ion 令牌</b>（可选，免费）：在 <a href="https://cesium.com/ion" target="_blank" rel="noopener">cesium.com/ion</a> 注册，在 <i>Access Tokens</i> 中复制 <i>Default token</i> 并粘贴到 Power up。启用 Google 3D 城市和全球地形；仅保存在此浏览器中。</p>`],
    ['🎙️', '语音', `<p>按下麦克风，说出例如“航班”“火车”“电台”“夜视”或地名。</p>`],
    ['⌨️', '快捷键', en[9][2].replace('move', '移动').replace('zoom', '缩放').replace('optics', '光学').replace('HUD, detection, day/night, borders, time zones', 'HUD、检测、昼夜、边界、时区').replace('release / close', '释放 / 关闭')],
    ['📚', '来源', en[10][2]]
];

const HELP = { en, nl, de, fr, zh };
export const getHelp = lang => JSON.stringify((HELP[lang] || en).map(([icon, title, html]) => ({ icon, title, html })));

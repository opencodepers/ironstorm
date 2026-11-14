// ------------------------------------------------------------------
//  Localization — a compact string table for the command shell. Keys
//  fall back to English, and Arabic switches the document to RTL.
// ------------------------------------------------------------------

export const LANGS = [
  { code: 'en', label: 'ENGLISH', dir: 'ltr' },
  { code: 'es', label: 'ESPAÑOL', dir: 'ltr' },
  { code: 'fr', label: 'FRANÇAIS', dir: 'ltr' },
  { code: 'ar', label: 'العربية', dir: 'rtl' },
];

const EN = {
  'nav.warzones': 'WARZONES',
  'nav.arsenal': 'ARSENAL',
  'nav.deploy': 'DEPLOY NOW',
  'nav.garage': 'ENTER THE GARAGE',
  'nav.signin': 'SIGN IN',
  'auth.guest': 'PLAY AS GUEST',
  'auth.note': 'Guest progress is saved on this device only.',
  'menu.play': 'PLAY',
  'menu.quick': 'QUICK MATCH',
  'menu.equipped': 'EQUIPPED',
  'rail.upgrades': 'UPGRADES',
  'rail.garage': 'GARAGE',
  'rail.shop': 'SHOP',
  'rail.squad': 'SQUAD',
  'rail.friends': 'FRIENDS',
  'rail.career': 'CAREER',
  'rail.medals': 'MEDALS',
  'rail.servers': 'SERVERS',
  'rail.leaderboards': 'LEADERBOARDS',
  'rail.gameplay': 'GAMEPLAY',
  'rail.academy': 'ACADEMY',
  'rail.maps': 'MAP LAB',
  'rail.ranked': 'RANKED',
  'rail.theater': 'THEATER',
  'pane.academy.title': 'ACADEMY',
  'pane.academy.sub': 'Learn the hull, then take the free-fire range',
  'pane.maps.title': 'MAP LAB',
  'pane.maps.sub': 'Build a battlefield and share it with a code',
  'pane.ranked.title': 'RANKED',
  'pane.ranked.sub': 'Placements, rating and a seat in the ladder',
  'pane.theater.title': 'THEATER',
  'pane.theater.sub': 'Watch your last battle back with a free camera',
  'academy.start': 'START ACADEMY',
  'academy.range': 'FREE-FIRE RANGE',
  'academy.step1': 'DRIVE THE HULL',
  'academy.step1s': 'Roll forward, turn, and get a feel for the tracks',
  'academy.step2': 'FIRE AND RELOAD',
  'academy.step2s': 'Put three shells into the target dummies',
  'academy.step3': 'DASH TO THE ZONE',
  'academy.step3s': 'Dash into the marked circle and hold it',
  'academy.done': 'ACADEMY COMPLETE',
  'academy.exit': 'RETURN TO BASE',
  'pause.paused': 'PAUSED',
  'pause.resume': 'RESUME BATTLE',
  'pause.leave': 'LEAVE BATTLE',
  'settings.language': 'LANGUAGE',
  'settings.text': 'TEXT SIZE',
  'settings.contrast': 'HIGH CONTRAST',
  'settings.onehand': 'ONE-HANDED TOUCH',
  'settings.on': 'ON',
  'settings.off': 'OFF',
  'lb.all': 'ALL TIME',
  'lb.week': 'THIS WEEK',
  'lb.friends': 'FRIENDS',
  'lb.vehicle': 'VEHICLE',
  'common.copy': 'COPY CODE',
  'common.play': 'PLAY',
  'common.close': 'CLOSE',
  'common.claim': 'CLAIM',
  'common.claimed': 'CLAIMED',
  'common.saved': 'SAVED',
  'common.delete': 'DELETE',
};

const ES = {
  'nav.warzones': 'ZONAS', 'nav.arsenal': 'ARSENAL', 'nav.deploy': 'DESPLEGAR',
  'nav.garage': 'ENTRAR AL GARAJE', 'nav.signin': 'INICIAR SESIÓN',
  'auth.guest': 'JUGAR COMO INVITADO', 'auth.note': 'El progreso de invitado solo se guarda en este dispositivo.',
  'menu.play': 'JUGAR', 'menu.quick': 'PARTIDA RÁPIDA', 'menu.equipped': 'EQUIPADO',
  'rail.upgrades': 'MEJORAS', 'rail.garage': 'GARAJE', 'rail.shop': 'TIENDA', 'rail.squad': 'ESCUADRÓN',
  'rail.friends': 'AMIGOS', 'rail.career': 'CARRERA', 'rail.medals': 'MEDALLAS', 'rail.servers': 'SERVIDORES',
  'rail.leaderboards': 'CLASIFICACIÓN', 'rail.gameplay': 'JUEGO', 'rail.academy': 'ACADEMIA',
  'rail.maps': 'MAPAS', 'rail.ranked': 'CLASIFICATORIA', 'rail.theater': 'REPETICIÓN',
  'pane.academy.title': 'ACADEMIA', 'pane.academy.sub': 'Aprende el blindado y pasa al campo de tiro',
  'pane.maps.title': 'LABORATORIO', 'pane.maps.sub': 'Crea un campo de batalla y compártelo con un código',
  'pane.ranked.title': 'CLASIFICATORIA', 'pane.ranked.sub': 'Colocación, puntuación y puesto en la escalera',
  'pane.theater.title': 'REPETICIÓN', 'pane.theater.sub': 'Revisa tu última batalla con cámara libre',
  'academy.start': 'EMPEZAR ACADEMIA', 'academy.range': 'CAMPO DE TIRO',
  'academy.step1': 'CONDUCE EL BLINDADO', 'academy.step1s': 'Avanza, gira y siente las orugas',
  'academy.step2': 'DISPARA Y RECARGA', 'academy.step2s': 'Impacta tres veces en los blancos',
  'academy.step3': 'CORRE A LA ZONA', 'academy.step3s': 'Entra en el círculo y mantenlo',
  'academy.done': 'ACADEMIA COMPLETA', 'academy.exit': 'VOLVER A LA BASE',
  'pause.paused': 'PAUSA', 'pause.resume': 'REANUDAR', 'pause.leave': 'SALIR',
  'settings.language': 'IDIOMA', 'settings.text': 'TAMAÑO DEL TEXTO', 'settings.contrast': 'ALTO CONTRASTE',
  'settings.onehand': 'TOQUE A UNA MANO', 'settings.on': 'SÍ', 'settings.off': 'NO',
  'lb.all': 'HISTÓRICO', 'lb.week': 'ESTA SEMANA', 'lb.friends': 'AMIGOS', 'lb.vehicle': 'VEHÍCULO',
  'common.copy': 'COPIAR CÓDIGO', 'common.play': 'JUGAR', 'common.close': 'CERRAR',
  'common.claim': 'RECLAMAR', 'common.claimed': 'RECLAMADO', 'common.saved': 'GUARDADO', 'common.delete': 'BORRAR',
};

const FR = {
  'nav.warzones': 'ZONES', 'nav.arsenal': 'ARSENAL', 'nav.deploy': 'DÉPLOYER',
  'nav.garage': 'ENTRER AU GARAGE', 'nav.signin': 'CONNEXION',
  'auth.guest': 'JOUER EN INVITÉ', 'auth.note': "La progression d'invité est locale à cet appareil.",
  'menu.play': 'JOUER', 'menu.quick': 'PARTIE RAPIDE', 'menu.equipped': 'ÉQUIPÉ',
  'rail.upgrades': 'AMÉLIORATIONS', 'rail.garage': 'GARAGE', 'rail.shop': 'BOUTIQUE', 'rail.squad': 'ESCADRON',
  'rail.friends': 'AMIS', 'rail.career': 'CARRIÈRE', 'rail.medals': 'MÉDAILLES', 'rail.servers': 'SERVEURS',
  'rail.leaderboards': 'CLASSEMENT', 'rail.gameplay': 'JEU', 'rail.academy': 'ACADÉMIE',
  'rail.maps': 'CARTES', 'rail.ranked': 'CLASSÉ', 'rail.theater': 'REPLAY',
  'pane.academy.title': 'ACADÉMIE', 'pane.academy.sub': 'Apprenez le char, puis passez au champ de tir',
  'pane.maps.title': 'ATELIER', 'pane.maps.sub': 'Créez un champ de bataille et partagez-le par code',
  'pane.ranked.title': 'CLASSÉ', 'pane.ranked.sub': 'Placements, note et place dans l’échelle',
  'pane.theater.title': 'REPLAY', 'pane.theater.sub': 'Revivez votre dernière bataille en caméra libre',
  'academy.start': 'COMMENCER', 'academy.range': 'CHAMP DE TIR',
  'academy.step1': 'CONDUIRE LE CHAR', 'academy.step1s': 'Avancez, tournez et sentez les chenilles',
  'academy.step2': 'TIRER ET RECHARGER', 'academy.step2s': 'Touchez trois fois les cibles',
  'academy.step3': 'FONCER VERS LA ZONE', 'academy.step3s': 'Entrez dans le cercle et tenez-le',
  'academy.done': 'ACADÉMIE TERMINÉE', 'academy.exit': 'RETOUR À LA BASE',
  'pause.paused': 'PAUSE', 'pause.resume': 'REPRENDRE', 'pause.leave': 'QUITTER',
  'settings.language': 'LANGUE', 'settings.text': 'TAILLE DU TEXTE', 'settings.contrast': 'CONTRASTE ÉLEVÉ',
  'settings.onehand': 'TACTILE À UNE MAIN', 'settings.on': 'OUI', 'settings.off': 'NON',
  'lb.all': 'TOUT TEMPS', 'lb.week': 'CETTE SEMAINE', 'lb.friends': 'AMIS', 'lb.vehicle': 'VÉHICULE',
  'common.copy': 'COPIER LE CODE', 'common.play': 'JOUER', 'common.close': 'FERMER',
  'common.claim': 'RÉCLAMER', 'common.claimed': 'RÉCLAMÉ', 'common.saved': 'ENREGISTRÉ', 'common.delete': 'SUPPRIMER',
};

const AR = {
  'nav.warzones': 'المناطق', 'nav.arsenal': 'الترسانة', 'nav.deploy': 'انطلق',
  'nav.garage': 'ادخل المرآب', 'nav.signin': 'تسجيل الدخول',
  'auth.guest': 'العب كضيف', 'auth.note': 'يُحفظ تقدم الضيف على هذا الجهاز فقط.',
  'menu.play': 'العب', 'menu.quick': 'مباراة سريعة', 'menu.equipped': 'مجهز',
  'rail.upgrades': 'الترقيات', 'rail.garage': 'المرآب', 'rail.shop': 'المتجر', 'rail.squad': 'الفريق',
  'rail.friends': 'الأصدقاء', 'rail.career': 'المسيرة', 'rail.medals': 'الأوسمة', 'rail.servers': 'الخوادم',
  'rail.leaderboards': 'المتصدرون', 'rail.gameplay': 'اللعب', 'rail.academy': 'الأكاديمية',
  'rail.maps': 'مختبر الخرائط', 'rail.ranked': 'التصنيف', 'rail.theater': 'الإعادة',
  'pane.academy.title': 'الأكاديمية', 'pane.academy.sub': 'تعلم الدبابة ثم انتقل إلى ميدان الرماية',
  'pane.maps.title': 'مختبر الخرائط', 'pane.maps.sub': 'ابنِ ساحة معركة وشاركها برمز',
  'pane.ranked.title': 'التصنيف', 'pane.ranked.sub': 'التأهيل والنقاط ومكانك في السلم',
  'pane.theater.title': 'الإعادة', 'pane.theater.sub': 'شاهد آخر معركة بكاميرا حرة',
  'academy.start': 'ابدأ الأكاديمية', 'academy.range': 'ميدان الرماية',
  'academy.step1': 'قُد الدبابة', 'academy.step1s': 'تقدم واستدر وشعر بالجنازير',
  'academy.step2': 'أطلق وأعد التلقيم', 'academy.step2s': 'أصب ثلاث قذائف في الأهداف',
  'academy.step3': 'اندفع إلى المنطقة', 'academy.step3s': 'ادخل الدائرة وابقَ داخلها',
  'academy.done': 'اكتملت الأكاديمية', 'academy.exit': 'العودة إلى القاعدة',
  'pause.paused': 'متوقف', 'pause.resume': 'متابعة', 'pause.leave': 'مغادرة',
  'settings.language': 'اللغة', 'settings.text': 'حجم النص', 'settings.contrast': 'تباين عالٍ',
  'settings.onehand': 'لمس بيد واحدة', 'settings.on': 'نعم', 'settings.off': 'لا',
  'lb.all': 'كل الأوقات', 'lb.week': 'هذا الأسبوع', 'lb.friends': 'الأصدقاء', 'lb.vehicle': 'المركبة',
  'common.copy': 'نسخ الرمز', 'common.play': 'العب', 'common.close': 'إغلاق',
  'common.claim': 'استلام', 'common.claimed': 'تم الاستلام', 'common.saved': 'محفوظ', 'common.delete': 'حذف',
};

const TABLES = { en: EN, es: ES, fr: FR, ar: AR };
let current = 'en';

export function lang() { return current; }
export function langDir(code = current) {
  return LANGS.find((l) => l.code === code)?.dir || 'ltr';
}
export function t(key, fallback = '') {
  return TABLES[current]?.[key] || EN[key] || fallback || key;
}

export function setLang(code) {
  current = TABLES[code] ? code : 'en';
  document.documentElement.lang = current;
  document.documentElement.dir = langDir();
  applyI18n();
  return current;
}

// Static labels opt in with data-i18n; dynamic panes call t() themselves.
export function applyI18n(root = document) {
  root.querySelectorAll('[data-i18n]').forEach((el) => {
    const key = el.dataset.i18n;
    const value = TABLES[current]?.[key] || EN[key];
    if (value) el.textContent = value;
  });
  root.querySelectorAll('[data-i18n-ph]').forEach((el) => {
    const value = TABLES[current]?.[el.dataset.i18nPh] || EN[el.dataset.i18nPh];
    if (value) el.placeholder = value;
  });
}

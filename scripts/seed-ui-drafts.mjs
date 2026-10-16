import { mkdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
import { join } from "node:path";

// This seed contains deliberately unapproved contributor drafts. Every locale
// receives a complete UI key tree; the wording and native review still require
// contributor review. The script never reads the private application
// repository and leaves the separately exported CMS catalog untouched.
const locales = ["pt-BR", "es", "id", "tr", "fil", "de", "fr", "ar", "ru"];
const namespaces = ["Blog", "Common", "Home", "releases", "search"];

const shared = {
  "Features": { "pt-BR": "Recursos", es: "Funciones", id: "Fitur", tr: "Özellikler", fil: "Mga feature", de: "Funktionen", fr: "Fonctionnalités", ar: "الميزات", ru: "Возможности" },
  "Releases": { "pt-BR": "Lançamentos", es: "Versiones", id: "Rilis", tr: "Sürümler", fil: "Mga release", de: "Veröffentlichungen", fr: "Versions", ar: "الإصدارات", ru: "Релизы" },
  "Journal": { "pt-BR": "Diário", es: "Diario", id: "Jurnal", tr: "Günlük", fil: "Journal", de: "Journal", fr: "Journal", ar: "المجلة", ru: "Журнал" },
  "Support": { "pt-BR": "Suporte", es: "Soporte", id: "Dukungan", tr: "Destek", fil: "Suporta", de: "Support", fr: "Assistance", ar: "الدعم", ru: "Поддержка" },
  "Product": { "pt-BR": "Produto", es: "Producto", id: "Produk", tr: "Ürün", fil: "Produkto", de: "Produkt", fr: "Produit", ar: "المنتج", ru: "Продукт" },
  "Menu": { "pt-BR": "Menu", es: "Menú", id: "Menu", tr: "Menü", fil: "Menu", de: "Menü", fr: "Menu", ar: "القائمة", ru: "Меню" },
  "Latest": { "pt-BR": "Mais recente", es: "Más reciente", id: "Terbaru", tr: "En yeni", fil: "Pinakabago", de: "Neueste", fr: "Dernière", ar: "الأحدث", ru: "Последняя" },
  "Unavailable": { "pt-BR": "Indisponível", es: "No disponible", id: "Tidak tersedia", tr: "Kullanılamıyor", fil: "Hindi available", de: "Nicht verfügbar", fr: "Indisponible", ar: "غير متاح", ru: "Недоступно" },
  "Download v": { "pt-BR": "Baixar v", es: "Descargar v", id: "Unduh v", tr: "v indir", fil: "I-download ang v", de: "v herunterladen", fr: "Télécharger v", ar: "تنزيل v", ru: "Скачать v" },
  "View releases": { "pt-BR": "Ver lançamentos", es: "Ver versiones", id: "Lihat rilis", tr: "Sürümleri görüntüle", fil: "Tingnan ang mga release", de: "Veröffentlichungen ansehen", fr: "Voir les versions", ar: "عرض الإصدارات", ru: "Смотреть релизы" },
  "Primary navigation": { "pt-BR": "Navegação principal", es: "Navegación principal", id: "Navigasi utama", tr: "Ana navigasyon", fil: "Pangunahing nabigasyon", de: "Hauptnavigation", fr: "Navigation principale", ar: "التنقل الرئيسي", ru: "Основная навигация" },
  "Open navigation menu": { "pt-BR": "Abrir o menu de navegação", es: "Abrir el menú de navegación", id: "Buka menu navigasi", tr: "Navigasyon menüsünü aç", fil: "Buksan ang navigation menu", de: "Navigationsmenü öffnen", fr: "Ouvrir le menu de navigation", ar: "فتح قائمة التنقل", ru: "Открыть меню навигации" },
  "Close navigation menu": { "pt-BR": "Fechar o menu de navegação", es: "Cerrar el menú de navegación", id: "Tutup menu navigasi", tr: "Navigasyon menüsünü kapat", fil: "Isara ang navigation menu", de: "Navigationsmenü schließen", fr: "Fermer le menu de navigation", ar: "إغلاق قائمة التنقل", ru: "Закрыть меню навигации" },
  "Social links": { "pt-BR": "Links sociais", es: "Enlaces sociales", id: "Tautan sosial", tr: "Sosyal bağlantılar", fil: "Mga social link", de: "Soziale Links", fr: "Liens sociaux", ar: "الروابط الاجتماعية", ru: "Ссылки на соцсети" },
  "Legal": { "pt-BR": "Legal", es: "Legal", id: "Hukum", tr: "Yasal", fil: "Legal", de: "Rechtliches", fr: "Mentions légales", ar: "قانوني", ru: "Правовая информация" },
  "Language": { "pt-BR": "Idioma", es: "Idioma", id: "Bahasa", tr: "Dil", fil: "Wika", de: "Sprache", fr: "Langue", ar: "اللغة", ru: "Язык" },
  "Email address": { "pt-BR": "Endereço de e-mail", es: "Dirección de correo electrónico", id: "Alamat email", tr: "E-posta adresi", fil: "Email address", de: "E-Mail-Adresse", fr: "Adresse e-mail", ar: "عنوان البريد الإلكتروني", ru: "Адрес электронной почты" },
  "Join release notes": { "pt-BR": "Receber notas de lançamento", es: "Recibir notas de versión", id: "Ikuti catatan rilis", tr: "Sürüm notlarına katıl", fil: "Sumali sa release notes", de: "Release-Notizen abonnieren", fr: "Recevoir les notes de version", ar: "الاشتراك في ملاحظات الإصدار", ru: "Подписаться на заметки о релизах" },
  "Check your inbox": { "pt-BR": "Confira sua caixa de entrada", es: "Revisa tu bandeja de entrada", id: "Periksa kotak masuk Anda", tr: "Gelen kutunuzu kontrol edin", fil: "Tingnan ang iyong inbox", de: "Posteingang prüfen", fr: "Consultez votre boîte de réception", ar: "تحقق من صندوق الوارد", ru: "Проверьте входящие" },
  "Privacy": { "pt-BR": "Privacidade", es: "Privacidad", id: "Privasi", tr: "Gizlilik", fil: "Privacy", de: "Datenschutz", fr: "Confidentialité", ar: "الخصوصية", ru: "Конфиденциальность" },
  "Terms": { "pt-BR": "Termos", es: "Términos", id: "Ketentuan", tr: "Koşullar", fil: "Mga tuntunin", de: "Bedingungen", fr: "Conditions", ar: "الشروط", ru: "Условия" },
  "Color theme": { "pt-BR": "Tema de cores", es: "Tema de color", id: "Tema warna", tr: "Renk teması", fil: "Tema ng kulay", de: "Farbschema", fr: "Thème de couleurs", ar: "نمط الألوان", ru: "Цветовая тема" },
  "Change color theme": { "pt-BR": "Mudar o tema de cores", es: "Cambiar el tema de color", id: "Ubah tema warna", tr: "Renk temasını değiştir", fil: "Baguhin ang tema ng kulay", de: "Farbschema ändern", fr: "Changer le thème de couleurs", ar: "تغيير نمط الألوان", ru: "Изменить цветовую тему" },
  "Light": { "pt-BR": "Claro", es: "Claro", id: "Terang", tr: "Açık", fil: "Maliwanag", de: "Hell", fr: "Clair", ar: "فاتح", ru: "Светлая" },
  "Dark": { "pt-BR": "Escuro", es: "Oscuro", id: "Gelap", tr: "Koyu", fil: "Madilim", de: "Dunkel", fr: "Sombre", ar: "داكن", ru: "Тёмная" },
  "System": { "pt-BR": "Sistema", es: "Sistema", id: "Sistem", tr: "Sistem", fil: "System", de: "System", fr: "Système", ar: "النظام", ru: "Системная" },
  "Share": { "pt-BR": "Compartilhar", es: "Compartir", id: "Bagikan", tr: "Paylaş", fil: "Ibahagi", de: "Teilen", fr: "Partager", ar: "مشاركة", ru: "Поделиться" },
  "Copied": { "pt-BR": "Copiado", es: "Copiado", id: "Disalin", tr: "Kopyalandı", fil: "Nakopya", de: "Kopiert", fr: "Copié", ar: "تم النسخ", ru: "Скопировано" },
  "Copy link": { "pt-BR": "Copiar link", es: "Copiar enlace", id: "Salin tautan", tr: "Bağlantıyı kopyala", fil: "Kopyahin ang link", de: "Link kopieren", fr: "Copier le lien", ar: "نسخ الرابط", ru: "Копировать ссылку" },
  "Download": { "pt-BR": "Baixar", es: "Descargar", id: "Unduh", tr: "İndir", fil: "I-download", de: "Herunterladen", fr: "Télécharger", ar: "تنزيل", ru: "Скачать" },
  "Release notes": { "pt-BR": "Notas de lançamento", es: "Notas de versión", id: "Catatan rilis", tr: "Sürüm notları", fil: "Release notes", de: "Release-Notizen", fr: "Notes de version", ar: "ملاحظات الإصدار", ru: "Заметки о релизе" },
  "Browse releases": { "pt-BR": "Explorar lançamentos", es: "Explorar versiones", id: "Jelajahi rilis", tr: "Sürümlere göz at", fil: "Mag-browse ng mga release", de: "Veröffentlichungen durchsuchen", fr: "Parcourir les versions", ar: "تصفح الإصدارات", ru: "Открыть список релизов" },
  "Installation guide": { "pt-BR": "Guia de instalação", es: "Guía de instalación", id: "Panduan instalasi", tr: "Kurulum rehberi", fil: "Gabay sa pag-install", de: "Installationsanleitung", fr: "Guide d'installation", ar: "دليل التثبيت", ru: "Руководство по установке" },
  "See how it works": { "pt-BR": "Veja como funciona", es: "Descubre cómo funciona", id: "Lihat cara kerjanya", tr: "Nasıl çalıştığını gör", fil: "Tingnan kung paano ito gumagana", de: "So funktioniert es", fr: "Voir comment ça marche", ar: "شاهد كيف يعمل", ru: "Посмотреть, как это работает" },
  "View app screen": { "pt-BR": "Ver tela do app", es: "Ver pantalla de la app", id: "Lihat layar aplikasi", tr: "Uygulama ekranını görüntüle", fil: "Tingnan ang screen ng app", de: "App-Bildschirm ansehen", fr: "Voir l'écran de l'application", ar: "عرض شاشة التطبيق", ru: "Посмотреть экран приложения" },
  "Get Started": { "pt-BR": "Comece agora", es: "Primeros pasos", id: "Mulai", tr: "Başlayın", fil: "Magsimula", de: "Erste Schritte", fr: "Commencer", ar: "ابدأ الآن", ru: "Начать" },
  "Common Questions": { "pt-BR": "Perguntas frequentes", es: "Preguntas frecuentes", id: "Pertanyaan umum", tr: "Sık sorulan sorular", fil: "Mga karaniwang tanong", de: "Häufige Fragen", fr: "Questions fréquentes", ar: "الأسئلة الشائعة", ru: "Частые вопросы" },
  "Privacy controls": { "pt-BR": "Controles de privacidade", es: "Controles de privacidad", id: "Kontrol privasi", tr: "Gizlilik kontrolleri", fil: "Mga kontrol sa privacy", de: "Datenschutzeinstellungen", fr: "Contrôles de confidentialité", ar: "عناصر التحكم بالخصوصية", ru: "Настройки конфиденциальности" },
  "Media tools": { "pt-BR": "Ferramentas de mídia", es: "Herramientas multimedia", id: "Alat media", tr: "Medya araçları", fil: "Mga media tool", de: "Medienwerkzeuge", fr: "Outils multimédias", ar: "أدوات الوسائط", ru: "Медиаинструменты" },
  "Interface choices": { "pt-BR": "Opções de interface", es: "Opciones de interfaz", id: "Pilihan antarmuka", tr: "Arayüz seçenekleri", fil: "Mga pagpipilian sa interface", de: "Oberflächenoptionen", fr: "Choix d'interface", ar: "خيارات الواجهة", ru: "Настройки интерфейса" },
  "Latest release": { "pt-BR": "Lançamento mais recente", es: "Última versión", id: "Rilis terbaru", tr: "En yeni sürüm", fil: "Pinakabagong release", de: "Neueste Veröffentlichung", fr: "Dernière version", ar: "أحدث إصدار", ru: "Последний релиз" },
  "Compatibility": { "pt-BR": "Compatibilidade", es: "Compatibilidad", id: "Kompatibilitas", tr: "Uyumluluk", fil: "Compatibility", de: "Kompatibilität", fr: "Compatibilité", ar: "التوافق", ru: "Совместимость" },
  "Device requirements": { "pt-BR": "Requisitos do dispositivo", es: "Requisitos del dispositivo", id: "Persyaratan perangkat", tr: "Cihaz gereksinimleri", fil: "Mga kinakailangan ng device", de: "Geräteanforderungen", fr: "Configuration requise", ar: "متطلبات الجهاز", ru: "Требования к устройству" },
  "Search": { "pt-BR": "Pesquisar", es: "Buscar", id: "Cari", tr: "Ara", fil: "Maghanap", de: "Suchen", fr: "Rechercher", ar: "بحث", ru: "Поиск" },
  "Search published content": { "pt-BR": "Pesquisar conteúdo publicado", es: "Buscar contenido publicado", id: "Cari konten yang diterbitkan", tr: "Yayınlanmış içerikte ara", fil: "Maghanap ng na-publish na content", de: "Veröffentlichte Inhalte durchsuchen", fr: "Rechercher dans le contenu publié", ar: "البحث في المحتوى المنشور", ru: "Искать опубликованный контент" },
  "No public records matched that phrase.": { "pt-BR": "Nenhum registro público correspondeu a essa frase.", es: "Ningún registro público coincide con esa frase.", id: "Tidak ada catatan publik yang cocok dengan frasa itu.", tr: "Bu ifadeyle eşleşen herkese açık kayıt yok.", fil: "Walang pampublikong rekord na tumugma sa pariralang iyon.", de: "Keine öffentlichen Einträge passen zu diesem Ausdruck.", fr: "Aucun contenu public ne correspond à cette expression.", ar: "لم يطابق هذه العبارة أي سجل عام.", ru: "Публичных записей с такой фразой не найдено." },
  "No published stories yet.": { "pt-BR": "Ainda não há histórias publicadas.", es: "Todavía no hay historias publicadas.", id: "Belum ada cerita yang diterbitkan.", tr: "Henüz yayınlanmış hikâye yok.", fil: "Wala pang na-publish na kuwento.", de: "Noch keine Geschichten veröffentlicht.", fr: "Aucune histoire publiée pour le moment.", ar: "لا توجد قصص منشورة بعد.", ru: "Опубликованных историй пока нет." },
  "MyInsta team": { "pt-BR": "Equipe MyInsta", es: "Equipo de MyInsta", id: "Tim MyInsta", tr: "MyInsta ekibi", fil: "MyInsta team", de: "MyInsta-Team", fr: "Équipe MyInsta", ar: "فريق MyInsta", ru: "Команда MyInsta" },
  "Unscheduled": { "pt-BR": "Sem agendamento", es: "Sin programar", id: "Belum dijadwalkan", tr: "Planlanmadı", fil: "Hindi nakaiskedyul", de: "Nicht geplant", fr: "Non planifié", ar: "غير مجدول", ru: "Не запланировано" },
  "All": { "pt-BR": "Todos", es: "Todas", id: "Semua", tr: "Tümü", fil: "Lahat", de: "Alle", fr: "Toutes", ar: "الكل", ru: "Все" },
  "Stable": { "pt-BR": "Estável", es: "Estable", id: "Stabil", tr: "Kararlı", fil: "Stable", de: "Stabil", fr: "Stable", ar: "مستقر", ru: "Стабильный" },
  "Beta": { "pt-BR": "Beta", es: "Beta", id: "Beta", tr: "Beta", fil: "Beta", de: "Beta", fr: "Bêta", ar: "بيتا", ru: "Бета" },
  "Alpha": { "pt-BR": "Alpha", es: "Alpha", id: "Alfa", tr: "Alfa", fil: "Alpha", de: "Alpha", fr: "Alpha", ar: "ألفا", ru: "Альфа" },
  "Legacy": { "pt-BR": "Legado", es: "Antigua", id: "Lama", tr: "Legacy", fil: "Legacy", de: "Legacy", fr: "Ancienne", ar: "قديم", ru: "Legacy" },
  "Home": { "pt-BR": "Início", es: "Inicio", id: "Beranda", tr: "Ana sayfa", fil: "Home", de: "Startseite", fr: "Accueil", ar: "الرئيسية", ru: "Главная" },
  "Build": { "pt-BR": "Build", es: "Compilación", id: "Build", tr: "Derleme", fil: "Build", de: "Build", fr: "Build", ar: "البنية", ru: "Сборка" },
  "Channel": { "pt-BR": "Canal", es: "Canal", id: "Saluran", tr: "Kanal", fil: "Channel", de: "Kanal", fr: "Canal", ar: "القناة", ru: "Канал" },
  "Base": { "pt-BR": "Base", es: "Base", id: "Basis", tr: "Temel", fil: "Base", de: "Basis", fr: "Base", ar: "الأساس", ru: "Основа" },
  "Version": { "pt-BR": "Versão", es: "Versión", id: "Versi", tr: "Sürüm", fil: "Bersyon", de: "Version", fr: "Version", ar: "الإصدار", ru: "Версия" },
  "All releases": { "pt-BR": "Todos os lançamentos", es: "Todas las versiones", id: "Semua rilis", tr: "Tüm sürümler", fil: "Lahat ng release", de: "Alle Veröffentlichungen", fr: "Toutes les versions", ar: "كل الإصدارات", ru: "Все релизы" },
  "Current": { "pt-BR": "Atual", es: "Actual", id: "Saat ini", tr: "Geçerli", fil: "Kasalukuyan", de: "Aktuell", fr: "Actuelle", ar: "الحالي", ru: "Текущий" },
  "Choose your APK": { "pt-BR": "Escolha seu APK", es: "Elige tu APK", id: "Pilih APK Anda", tr: "APK'nı seç", fil: "Piliin ang iyong APK", de: "APK auswählen", fr: "Choisissez votre APK", ar: "اختر APK الخاص بك", ru: "Выберите APK" },
  "Installation": { "pt-BR": "Instalação", es: "Instalación", id: "Instalasi", tr: "Kurulum", fil: "Pag-install", de: "Installation", fr: "Installation", ar: "التثبيت", ru: "Установка" },
  "Upgrade": { "pt-BR": "Atualização", es: "Actualización", id: "Pembaruan", tr: "Yükseltme", fil: "Upgrade", de: "Upgrade", fr: "Mise à niveau", ar: "الترقية", ru: "Обновление" },
  "Screenshots": { "pt-BR": "Capturas de tela", es: "Capturas de pantalla", id: "Tangkapan layar", tr: "Ekran görüntüleri", fil: "Mga screenshot", de: "Screenshots", fr: "Captures d'écran", ar: "لقطات الشاشة", ru: "Скриншоты" },
  "Verification details": { "pt-BR": "Detalhes da verificação", es: "Detalles de verificación", id: "Detail verifikasi", tr: "Doğrulama ayrıntıları", fil: "Mga detalye ng verification", de: "Verifizierungsdetails", fr: "Détails de vérification", ar: "تفاصيل التحقق", ru: "Сведения о проверке" },
  "Release notes": { "pt-BR": "Notas de lançamento", es: "Notas de versión", id: "Catatan rilis", tr: "Sürüm notları", fil: "Release notes", de: "Release-Notizen", fr: "Notes de version", ar: "ملاحظات الإصدار", ru: "Заметки о релизе" },
  "Read more": { "pt-BR": "Leia mais", es: "Leer más", id: "Baca selengkapnya", tr: "Devamını oku", fil: "Magbasa pa", de: "Mehr lesen", fr: "Lire la suite", ar: "اقرأ المزيد", ru: "Читать далее" },
  "Show less": { "pt-BR": "Mostrar menos", es: "Mostrar menos", id: "Tampilkan lebih sedikit", tr: "Daha az göster", fil: "Magpakita nang kaunti", de: "Weniger anzeigen", fr: "Afficher moins", ar: "عرض أقل", ru: "Свернуть" },
};

const pathOverrides = {
  "Common.aria.home": { "pt-BR": "Início de {siteName}", es: "Inicio de {siteName}", id: "Beranda {siteName}", tr: "{siteName} ana sayfası", fil: "Home ng {siteName}", de: "{siteName}-Startseite", fr: "Accueil de {siteName}", ar: "الصفحة الرئيسية لـ {siteName}", ru: "Главная {siteName}" },
  "Common.footer.description": { "pt-BR": "Atualizações, lançamentos e recursos de suporte do {siteName} em um só lugar.", es: "Actualizaciones, versiones y recursos de soporte de {siteName} en un solo lugar.", id: "Pembaruan, rilis, dan sumber dukungan {siteName} di satu tempat.", tr: "{siteName} güncellemeleri, sürümleri ve destek kaynakları tek yerde.", fil: "Mga update, release, at support resource ng {siteName} sa isang lugar.", de: "Updates, Veröffentlichungen und Support-Ressourcen von {siteName} an einem Ort.", fr: "Les mises à jour, versions et ressources d'assistance de {siteName} au même endroit.", ar: "تحديثات {siteName} وإصداراته وموارد الدعم في مكان واحد.", ru: "Обновления, релизы и материалы поддержки {siteName} в одном месте." },
  "Home.actions.downloadMyInsta": { "pt-BR": "Baixar o MyInsta", es: "Descargar MyInsta", id: "Unduh MyInsta", tr: "MyInsta'yı indir", fil: "I-download ang MyInsta", de: "MyInsta herunterladen", fr: "Télécharger MyInsta", ar: "تنزيل MyInsta", ru: "Скачать MyInsta" },
  "Home.cta.appForAndroid": { "pt-BR": "{applicationName} para Android", es: "{applicationName} para Android", id: "{applicationName} untuk Android", tr: "Android için {applicationName}", fil: "{applicationName} para sa Android", de: "{applicationName} für Android", fr: "{applicationName} pour Android", ar: "{applicationName} لنظام Android", ru: "{applicationName} для Android" },
  "Home.cta.title": { "pt-BR": "Pronto para deixar o Instagram com a sua cara?", es: "¿Listo para hacer que Instagram sea más tuyo?", id: "Siap membuat Instagram terasa seperti milik Anda?", tr: "Instagram'ı kendinize göre şekillendirmeye hazır mısınız?", fil: "Handa ka bang gawing iyo ang Instagram?", de: "Bereit, Instagram zu deinem zu machen?", fr: "Prêt à personnaliser Instagram?", ar: "هل أنت مستعد لجعل Instagram على ذوقك؟", ru: "Готовы сделать Instagram своим?" },
  "Home.journal.title": { "pt-BR": "Notas que vale a pena guardar.", es: "Notas que vale la pena guardar.", id: "Catatan yang layak disimpan.", tr: "Saklamaya değer notlar.", fil: "Mga tala na sulit itago.", de: "Notizen, die bleiben.", fr: "Des notes à garder.", ar: "ملاحظات تستحق الاحتفاظ بها.", ru: "Заметки, которые стоит сохранить." },
  "Home.screenshots.title": { "pt-BR": "Veja por dentro.", es: "Mira lo que hay dentro.", id: "Lihat bagian dalamnya.", tr: "İçine göz atın.", fil: "Silipin ang loob.", de: "Ein Blick ins Innere.", fr: "Découvrez l'intérieur.", ar: "ألقِ نظرة من الداخل.", ru: "Загляните внутрь." },
  "search.titleAccent": { "pt-BR": "tudo público.", es: "todo lo público.", id: "semua yang publik.", tr: "herkese açık her şey.", fil: "lahat ng pampubliko.", de: "alles Öffentliche.", fr: "tout ce qui est public.", ar: "كل ما هو عام.", ru: "всё публичное." },
  "search.eyebrow": { "pt-BR": "Encontre o registro", es: "Encuentra el registro", id: "Temukan catatan", tr: "Kaydı bul", fil: "Hanapin ang rekord", de: "Eintrag finden", fr: "Trouver le contenu", ar: "اعثر على السجل", ru: "Найдите запись" },
};

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function translateDocument(document, locale, namespace) {
  const output = structuredClone(document);
  function visit(value, path) {
    if (typeof value === "string") {
      const key = `${namespace}.${path.join(".")}`;
      const override = pathOverrides[key]?.[locale];
      if (override) return override;
      return shared[value]?.[locale] ?? value;
    }
    if (Array.isArray(value)) return value.map((item, index) => visit(item, [...path, String(index)]));
    if (value && typeof value === "object") {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, visit(item, [...path, key])]));
    }
    return value;
  }
  return visit(output, []);
}

// Regeneration must retain contributor wording that is already present. A
// value equal to the English source is treated as an unfilled seed and may be
// refreshed from the current shared/path translation tables.
function mergePreservingTranslations(source, generated, existing) {
  if (typeof source === "string") {
    return typeof existing === "string" && existing !== source ? existing : generated;
  }
  if (Array.isArray(source)) {
    return source.map((item, index) => mergePreservingTranslations(item, generated[index], existing?.[index]));
  }
  if (source && typeof source === "object") {
    return Object.fromEntries(Object.entries(source).map(([key, item]) => [
      key,
      mergePreservingTranslations(item, generated[key], existing?.[key]),
    ]));
  }
  return generated;
}

async function main() {
  const root = new URL("..", import.meta.url).pathname;
  const english = {};
  for (const namespace of namespaces) {
    const file = namespace === "releases" ? "releases.json" : namespace === "search" ? "search.json" : `${namespace}.json`;
    english[namespace === "releases" ? "Releases" : namespace === "search" ? "Search" : namespace] = JSON.parse(await readFile(join(root, "messages", "en", file), "utf8"));
  }
  for (const locale of locales) {
    const translated = {};
    for (const namespace of namespaces) {
      const file = namespace === "releases" ? "releases.json" : namespace === "search" ? "search.json" : `${namespace}.json`;
      const runtimeNamespace = namespace === "releases" ? "Releases" : namespace === "search" ? "Search" : namespace;
      const source = english[runtimeNamespace];
      const generated = translateDocument(source, locale, runtimeNamespace);
      let existing;
      try {
        existing = JSON.parse(await readFile(join(root, "messages", locale, file), "utf8"));
      } catch {
        existing = undefined;
      }
      const document = mergePreservingTranslations(source, generated, existing);
      translated[runtimeNamespace] = document;
      await writeFile(join(root, "messages", locale, file), `${JSON.stringify(document, null, 2)}\n`);
    }
    await writeFile(join(root, "translations", locale, "ui.json"), `${JSON.stringify(translated, null, 2)}\n`);
  }
  await mkdir(join(root, "translations", "source"), { recursive: true });
  await writeFile(join(root, "translations", "source", "ui.json"), `${JSON.stringify(english, null, 2)}\n`);
  await writeFile(join(root, "translations", "ui-manifest.json"), `${JSON.stringify({
    schemaVersion: 1,
    sourceLocale: "en",
    sourceFile: "translations/source/ui.json",
    sourceContentHash: sha256(stableJson(english)),
    namespaces: Object.keys(english).sort(),
  }, null, 2)}\n`);
  let existingStatus;
  try {
    existingStatus = JSON.parse(await readFile(join(root, "translations", "draft-status.json"), "utf8"));
  } catch {
    existingStatus = undefined;
  }
  await writeFile(join(root, "translations", "draft-status.json"), `${JSON.stringify({
    schemaVersion: 1,
    approvalPolicy: "unapproved",
    generatedBy: "scripts/seed-ui-drafts.mjs",
    sourceFiles: ["translations/source/ui.json"],
    locales: Object.fromEntries(locales.map((locale) => {
      const existingCms = existingStatus?.locales?.[locale]?.cms;
      return [locale, {
        status: "DRAFT",
        approved: false,
        nativeReviewRequired: true,
        keyCoverage: "complete",
        translation: "needs-review",
        nativeReview: "needs-review",
        ...(existingCms === undefined ? {} : { cms: existingCms }),
      }];
    })),
  }, null, 2)}\n`);
}

await main();

/**
 * GroundTruth Translations
 *
 * Crisis tools need to speak the user's language. This covers:
 * - SMS pre-composition (most critical — life-safety message)
 * - Dispatcher guidance ("what to tell them")
 * - Emergency panel UI strings
 * - Settings and report form labels
 *
 * Languages: English, French, Spanish, Portuguese, Arabic, Yoruba,
 * Hausa, Hindi, Swahili, Indonesian
 */

export const SUPPORTED_LOCALES = [
  { code: "en", label: "English",    nativeLabel: "English"     },
  { code: "fr", label: "French",     nativeLabel: "Français"    },
  { code: "es", label: "Spanish",    nativeLabel: "Español"     },
  { code: "pt", label: "Portuguese", nativeLabel: "Português"   },
  { code: "ar", label: "Arabic",     nativeLabel: "العربية"     },
  { code: "yo", label: "Yoruba",     nativeLabel: "Yorùbá"      },
  { code: "ha", label: "Hausa",      nativeLabel: "Hausa"       },
  { code: "hi", label: "Hindi",      nativeLabel: "हिन्दी"      },
  { code: "sw", label: "Swahili",    nativeLabel: "Kiswahili"   },
  { code: "id", label: "Indonesian", nativeLabel: "Bahasa Indonesia" },
] as const;

export type LocaleCode = typeof SUPPORTED_LOCALES[number]["code"];

export interface Translations {
  dir: "ltr" | "rtl";
  emergency: {
    title: string;
    subtitle: string;
    callButton: string;
    smsButton: string;
    shareButton: string;
    gpsAcquiring: string;
    gpsFailed: string;
    copyLink: string;
    copied: string;
    showAgencies: string;
    hideAgencies: string;
    localNumbers: string;
    noLocation: string;
    whatToTell: string;
    tell: {
      location: string;
      locationDetail: string;
      nature: string;
      natureDetail: string;
      people: string;
      peopleDetail: string;
      condition: string;
      conditionDetail: string;
      stayOn: string;
      stayOnDetail: string;
    };
    smsBody: (mapsUrl: string, lat: number, lng: number) => string;
    smsBodyNoGps: string;
    shareTitle: string;
    shareText: (mapsUrl: string) => string;
  };
  report: {
    title: string;
    subtitle: string;
    submitButton: string;
    submitting: string;
    successTitle: string;
    successSubtitle: string;
    shareQR: string;
    textLabel: string;
    textPlaceholder: string;
    photoLabel: string;
    voiceLabel: string;
    takePhoto: string;
    chooseFromLibrary: string;
    remove: string;
    useMyLocation: string;
    pickOnMap: string;
    movePin: string;
    submitAnother: string;
    viewDashboard: string;
    locationLabel: string;
  };
  settings: {
    title: string;
    language: string;
    languageDesc: string;
    save: string;
    saving: string;
    saved: string;
    testConnection: string;
    testing: string;
  };
}

const en: Translations = {
  dir: "ltr",
  emergency: {
    title: "Need rescue?",
    subtitle: "Call emergency services first — then submit a report.",
    callButton: "Call",
    smsButton: "SMS Location",
    shareButton: "Share My Location",
    gpsAcquiring: "📡 Acquiring GPS…",
    gpsFailed: "⚠ GPS unavailable — share your address verbally",
    copyLink: "Copy link",
    copied: "✓ Copied",
    showAgencies: "See local agency numbers & guidance",
    hideAgencies: "Hide local agencies",
    localNumbers: "Local emergency numbers",
    noLocation: "Enable location to see numbers for your area. Default: dial 112.",
    whatToTell: "What to tell them",
    tell: {
      location: "Your location",
      locationDetail: "street name, landmark, or GPS coordinates",
      nature: "Nature of emergency",
      natureDetail: "flooding / collapsed structure / wildfire / injury",
      people: "Number of people",
      peopleDetail: "how many need rescue",
      condition: "Your condition",
      conditionDetail: "injured, trapped, or mobile",
      stayOn: "Stay on the line",
      stayOnDetail: "don't hang up until told to",
    },
    smsBody: (mapsUrl, lat, lng) =>
      `EMERGENCY SOS — I need rescue assistance.\nLocation: ${mapsUrl}\nGPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nSent via GroundTruth.`,
    smsBodyNoGps:
      "EMERGENCY SOS — I need rescue assistance. Please call me immediately.",
    shareTitle: "Emergency SOS — My Location",
    shareText: (mapsUrl) => `I need rescue assistance. My location: ${mapsUrl}`,
  },
  report: {
    title: "Submit a Report",
    subtitle: "Help others by sharing what you see.",
    submitButton: "Submit Report",
    submitting: "Submitting…",
    successTitle: "Report submitted",
    successSubtitle: "Gemma is analyzing your report.",
    shareQR: "Share via QR",
    textLabel: "Text report",
    textPlaceholder: "Describe what you see — water level, road conditions, number of people affected…",
    photoLabel: "Photo report",
    voiceLabel: "Voice report",
    takePhoto: "Take photo",
    chooseFromLibrary: "Choose from library",
    remove: "Remove",
    useMyLocation: "Use my location",
    pickOnMap: "Pick on map",
    movePin: "Move pin",
    submitAnother: "Submit another",
    viewDashboard: "View dashboard",
    locationLabel: "Location",
  },
  settings: {
    title: "Settings",
    language: "Language",
    languageDesc: "Used for SMS messages, emergency guidance, and the app interface.",
    save: "Save Settings",
    saving: "Saving…",
    saved: "✓ Settings saved",
    testConnection: "Test Connection",
    testing: "Testing…",
  },
};

const fr: Translations = {
  dir: "ltr",
  emergency: {
    title: "Besoin de secours ?",
    subtitle: "Appelez les secours d'abord — puis soumettez un signalement.",
    callButton: "Appeler",
    smsButton: "SMS Localisation",
    shareButton: "Partager ma position",
    gpsAcquiring: "📡 Localisation GPS en cours…",
    gpsFailed: "⚠ GPS indisponible — communiquez votre adresse verbalement",
    copyLink: "Copier le lien",
    copied: "✓ Copié",
    showAgencies: "Voir les numéros locaux & conseils",
    hideAgencies: "Masquer les agences locales",
    localNumbers: "Numéros d'urgence locaux",
    noLocation: "Activez la localisation pour voir les numéros de votre région. Par défaut : composez le 112.",
    whatToTell: "Que leur dire",
    tell: {
      location: "Votre position",
      locationDetail: "nom de rue, point de repère ou coordonnées GPS",
      nature: "Nature de l'urgence",
      natureDetail: "inondation / effondrement / incendie / blessure",
      people: "Nombre de personnes",
      peopleDetail: "combien ont besoin de secours",
      condition: "Votre état",
      conditionDetail: "blessé, coincé ou mobile",
      stayOn: "Restez en ligne",
      stayOnDetail: "ne raccrochez pas avant qu'on vous le dise",
    },
    smsBody: (mapsUrl, lat, lng) =>
      `SOS URGENCE — J'ai besoin d'aide et de secours.\nLocalisation : ${mapsUrl}\nGPS : ${lat.toFixed(6)}, ${lng.toFixed(6)}\nEnvoyé via GroundTruth.`,
    smsBodyNoGps:
      "SOS URGENCE — J'ai besoin d'aide et de secours. Appelez-moi immédiatement.",
    shareTitle: "SOS Urgence — Ma position",
    shareText: (mapsUrl) => `J'ai besoin d'aide et de secours. Ma position : ${mapsUrl}`,
  },
  report: {
    title: "Soumettre un signalement",
    subtitle: "Aidez les autres en partageant ce que vous voyez.",
    submitButton: "Soumettre",
    submitting: "Envoi en cours…",
    successTitle: "Signalement envoyé",
    successSubtitle: "Gemma analyse votre signalement.",
    shareQR: "Partager via QR",
    textLabel: "Signalement texte",
    textPlaceholder: "Décrivez ce que vous voyez — niveau d'eau, état des routes, nombre de personnes affectées…",
    photoLabel: "Signalement photo",
    voiceLabel: "Signalement vocal",
    takePhoto: "Prendre une photo",
    chooseFromLibrary: "Choisir dans la galerie",
    remove: "Supprimer",
    useMyLocation: "Utiliser ma position",
    pickOnMap: "Choisir sur la carte",
    movePin: "Déplacer l'épingle",
    submitAnother: "Soumettre un autre",
    viewDashboard: "Voir le tableau de bord",
    locationLabel: "Position",
  },
  settings: {
    title: "Paramètres",
    language: "Langue",
    languageDesc: "Utilisée pour les SMS, les conseils d'urgence et l'interface.",
    save: "Enregistrer",
    saving: "Enregistrement…",
    saved: "✓ Paramètres enregistrés",
    testConnection: "Tester la connexion",
    testing: "Test en cours…",
  },
};

const es: Translations = {
  dir: "ltr",
  emergency: {
    title: "¿Necesitas rescate?",
    subtitle: "Llama a los servicios de emergencia primero — luego envía un reporte.",
    callButton: "Llamar",
    smsButton: "SMS Ubicación",
    shareButton: "Compartir mi ubicación",
    gpsAcquiring: "📡 Obteniendo GPS…",
    gpsFailed: "⚠ GPS no disponible — comunica tu dirección verbalmente",
    copyLink: "Copiar enlace",
    copied: "✓ Copiado",
    showAgencies: "Ver números locales y orientación",
    hideAgencies: "Ocultar agencias locales",
    localNumbers: "Números de emergencia locales",
    noLocation: "Activa la ubicación para ver los números de tu área. Por defecto: marca el 112.",
    whatToTell: "Qué decirles",
    tell: {
      location: "Tu ubicación",
      locationDetail: "nombre de calle, punto de referencia o coordenadas GPS",
      nature: "Tipo de emergencia",
      natureDetail: "inundación / derrumbe / incendio / herido",
      people: "Número de personas",
      peopleDetail: "cuántas necesitan rescate",
      condition: "Tu condición",
      conditionDetail: "herido, atrapado o móvil",
      stayOn: "Permanece en línea",
      stayOnDetail: "no cuelgues hasta que te lo indiquen",
    },
    smsBody: (mapsUrl, lat, lng) =>
      `SOS EMERGENCIA — Necesito asistencia de rescate.\nUbicación: ${mapsUrl}\nGPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nEnviado por GroundTruth.`,
    smsBodyNoGps:
      "SOS EMERGENCIA — Necesito asistencia de rescate. Llámame de inmediato.",
    shareTitle: "SOS Emergencia — Mi ubicación",
    shareText: (mapsUrl) => `Necesito asistencia de rescate. Mi ubicación: ${mapsUrl}`,
  },
  report: {
    title: "Enviar un reporte",
    subtitle: "Ayuda a otros compartiendo lo que ves.",
    submitButton: "Enviar reporte",
    submitting: "Enviando…",
    successTitle: "Reporte enviado",
    successSubtitle: "Gemma está analizando tu reporte.",
    shareQR: "Compartir por QR",
    textLabel: "Reporte de texto",
    textPlaceholder: "Describe lo que ves — nivel del agua, condición de las vías, número de personas afectadas…",
    photoLabel: "Reporte fotográfico",
    voiceLabel: "Reporte de voz",
    takePhoto: "Tomar foto",
    chooseFromLibrary: "Elegir de la galería",
    remove: "Eliminar",
    useMyLocation: "Usar mi ubicación",
    pickOnMap: "Elegir en el mapa",
    movePin: "Mover marcador",
    submitAnother: "Enviar otro",
    viewDashboard: "Ver el panel",
    locationLabel: "Ubicación",
  },
  settings: {
    title: "Configuración",
    language: "Idioma",
    languageDesc: "Usado para mensajes SMS, orientación de emergencia e interfaz.",
    save: "Guardar configuración",
    saving: "Guardando…",
    saved: "✓ Configuración guardada",
    testConnection: "Probar conexión",
    testing: "Probando…",
  },
};

const pt: Translations = {
  dir: "ltr",
  emergency: {
    title: "Precisa de resgate?",
    subtitle: "Chame os serviços de emergência primeiro — depois envie um relatório.",
    callButton: "Ligar",
    smsButton: "SMS Localização",
    shareButton: "Partilhar minha localização",
    gpsAcquiring: "📡 A obter GPS…",
    gpsFailed: "⚠ GPS indisponível — partilhe o seu endereço verbalmente",
    copyLink: "Copiar link",
    copied: "✓ Copiado",
    showAgencies: "Ver números locais e orientações",
    hideAgencies: "Ocultar agências locais",
    localNumbers: "Números de emergência locais",
    noLocation: "Ative a localização para ver os números da sua área. Padrão: marque 112.",
    whatToTell: "O que dizer",
    tell: {
      location: "A sua localização",
      locationDetail: "nome da rua, ponto de referência ou coordenadas GPS",
      nature: "Tipo de emergência",
      natureDetail: "inundação / colapso de estrutura / incêndio / lesão",
      people: "Número de pessoas",
      peopleDetail: "quantas precisam de resgate",
      condition: "O seu estado",
      conditionDetail: "ferido, preso ou em movimento",
      stayOn: "Fique na linha",
      stayOnDetail: "não desligue até ser instruído",
    },
    smsBody: (mapsUrl, lat, lng) =>
      `SOS EMERGÊNCIA — Preciso de resgate e socorro.\nLocalização: ${mapsUrl}\nGPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nEnviado pelo GroundTruth.`,
    smsBodyNoGps:
      "SOS EMERGÊNCIA — Preciso de resgate e socorro. Ligue-me imediatamente.",
    shareTitle: "SOS Emergência — Minha localização",
    shareText: (mapsUrl) => `Preciso de resgate e socorro. Minha localização: ${mapsUrl}`,
  },
  report: {
    title: "Enviar um relatório",
    subtitle: "Ajude outros partilhando o que vê.",
    submitButton: "Enviar relatório",
    submitting: "A enviar…",
    successTitle: "Relatório enviado",
    successSubtitle: "O Gemma está a analisar o seu relatório.",
    shareQR: "Partilhar por QR",
    textLabel: "Relatório de texto",
    textPlaceholder: "Descreva o que vê — nível da água, condições das estradas, número de pessoas afetadas…",
    photoLabel: "Relatório fotográfico",
    voiceLabel: "Relatório de voz",
    takePhoto: "Tirar foto",
    chooseFromLibrary: "Escolher da galeria",
    remove: "Remover",
    useMyLocation: "Usar minha localização",
    pickOnMap: "Escolher no mapa",
    movePin: "Mover marcador",
    submitAnother: "Enviar outro",
    viewDashboard: "Ver painel",
    locationLabel: "Localização",
  },
  settings: {
    title: "Configurações",
    language: "Idioma",
    languageDesc: "Usado para SMS, orientações de emergência e interface.",
    save: "Guardar configurações",
    saving: "A guardar…",
    saved: "✓ Configurações guardadas",
    testConnection: "Testar ligação",
    testing: "A testar…",
  },
};

const ar: Translations = {
  dir: "rtl",
  emergency: {
    title: "تحتاج إلى نجدة؟",
    subtitle: "اتصل بخدمات الطوارئ أولاً — ثم أرسل تقريرًا.",
    callButton: "اتصال",
    smsButton: "إرسال الموقع",
    shareButton: "مشاركة موقعي",
    gpsAcquiring: "📡 جارٍ تحديد الموقع…",
    gpsFailed: "⚠ GPS غير متاح — أخبر المكان بالكلام",
    copyLink: "نسخ الرابط",
    copied: "✓ تم النسخ",
    showAgencies: "عرض الأرقام المحلية والإرشادات",
    hideAgencies: "إخفاء الجهات المحلية",
    localNumbers: "أرقام الطوارئ المحلية",
    noLocation: "فعّل الموقع الجغرافي لعرض أرقام منطقتك. الافتراضي: اتصل بـ 112.",
    whatToTell: "ماذا تقول لهم",
    tell: {
      location: "موقعك",
      locationDetail: "اسم الشارع، معلم قريب، أو إحداثيات GPS",
      nature: "نوع الطارئ",
      natureDetail: "فيضان / انهيار مبنى / حريق / إصابة",
      people: "عدد الأشخاص",
      peopleDetail: "كم شخصًا يحتاج إلى إنقاذ",
      condition: "حالتك",
      conditionDetail: "مصاب، محاصر، أو قادر على التحرك",
      stayOn: "ابقَ على الخط",
      stayOnDetail: "لا تغلق الخط حتى يُطلب منك ذلك",
    },
    smsBody: (mapsUrl, lat, lng) =>
      `نداء استغاثة — أحتاج إلى المساعدة والإنقاذ.\nالموقع: ${mapsUrl}\nإحداثيات GPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nأُرسل عبر GroundTruth.`,
    smsBodyNoGps:
      "نداء استغاثة — أحتاج إلى المساعدة والإنقاذ. اتصل بي فورًا.",
    shareTitle: "نداء استغاثة — موقعي",
    shareText: (mapsUrl) => `أحتاج إلى المساعدة والإنقاذ. موقعي: ${mapsUrl}`,
  },
  report: {
    title: "إرسال تقرير",
    subtitle: "ساعد الآخرين بمشاركة ما تراه.",
    submitButton: "إرسال التقرير",
    submitting: "جارٍ الإرسال…",
    successTitle: "تم إرسال التقرير",
    successSubtitle: "Gemma يحلل تقريرك الآن.",
    shareQR: "مشاركة بـ QR",
    textLabel: "تقرير نصي",
    textPlaceholder: "صِف ما تراه — مستوى المياه، حالة الطرق، عدد المتضررين…",
    photoLabel: "تقرير صوري",
    voiceLabel: "تقرير صوتي",
    takePhoto: "التقط صورة",
    chooseFromLibrary: "اختر من المكتبة",
    remove: "إزالة",
    useMyLocation: "استخدام موقعي",
    pickOnMap: "اختر على الخريطة",
    movePin: "تحريك الدبوس",
    submitAnother: "إرسال آخر",
    viewDashboard: "عرض لوحة التحكم",
    locationLabel: "الموقع",
  },
  settings: {
    title: "الإعدادات",
    language: "اللغة",
    languageDesc: "تُستخدم في رسائل SMS وإرشادات الطوارئ وواجهة التطبيق.",
    save: "حفظ الإعدادات",
    saving: "جارٍ الحفظ…",
    saved: "✓ تم حفظ الإعدادات",
    testConnection: "اختبار الاتصال",
    testing: "جارٍ الاختبار…",
  },
};

const yo: Translations = {
  dir: "ltr",
  emergency: {
    title: "Ṣé o nílò ìgbàlà?",
    subtitle: "Pe iṣẹ́ pajawiri kọ́kọ́ — lẹ́hìn náà fi ìjábọ̀ sílẹ̀.",
    callButton: "Pè",
    smsButton: "Firanṣẹ́ Ibi",
    shareButton: "Pín ibi mi",
    gpsAcquiring: "📡 Wà ibi GPS…",
    gpsFailed: "⚠ GPS kò sí — sọ àdírẹ́ẹ̀sì rẹ ní ẹnu",
    copyLink: "Daakọ ọna-abayo",
    copied: "✓ Ti daakọ",
    showAgencies: "Wo àwọn nọ́mbà àti ìtọ́sọ́nà ìbílẹ̀",
    hideAgencies: "Pa àwọn ẹ̀ka ìbílẹ̀ mọ́",
    localNumbers: "Àwọn nọ́mbà pajawiri ìbílẹ̀",
    noLocation: "Jẹ́ kí ìmúdópin ṣiṣẹ́ láti rí àwọn nọ́mbà ní àgbègbè rẹ. Ìpilẹ̀ṣẹ̀: pe 112.",
    whatToTell: "Kí ni o máa sọ fún wọn",
    tell: {
      location: "Ibi tí o wà",
      locationDetail: "orukọ ọ̀nà, àmì ìdánimọ̀, tàbí àwọn àkọsílẹ̀ GPS",
      nature: "Irú pajawiri",
      natureDetail: "ìkún-omi / ibi tó wó / iná / ìfarapa",
      people: "Iye ènìyàn",
      peopleDetail: "mélòó ni ó nílò ìgbàlà",
      condition: "Ìpò rẹ",
      conditionDetail: "farapa, wà nínú ewu, tàbí ó lè gbe",
      stayOn: "Ṣẹ̀ mọ́ ẹ̀rọ náà",
      stayOnDetail: "má pa ẹ̀rọ nígbà tí a kò tíì sọ",
    },
    smsBody: (mapsUrl, lat, lng) =>
      `ÌPÍ ÀÁRỌ̀ — Mo nílò ìrànlọ́wọ́ àti ìgbàlà.\nÀdírẹ́ẹ̀sì: ${mapsUrl}\nGPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nTí a fi GroundTruth ránṣẹ́.`,
    smsBodyNoGps:
      "ÌPÍ ÀÁRỌ̀ — Mo nílò ìrànlọ́wọ́ àti ìgbàlà. Ẹ pe mí lẹ́sẹ̀kẹsẹ̀.",
    shareTitle: "Ìpí Àárọ̀ — Ibi mi",
    shareText: (mapsUrl) => `Mo nílò ìrànlọ́wọ́ àti ìgbàlà. Ibi mi: ${mapsUrl}`,
  },
  report: {
    title: "Fi ìjábọ̀ sílẹ̀",
    subtitle: "Ràn àwọn míì lọ́wọ́ nípa pínpín ohun tí o rí.",
    submitButton: "Fi ìjábọ̀ sílẹ̀",
    submitting: "Ń firanṣẹ́…",
    successTitle: "Ìjábọ̀ ti fi sílẹ̀",
    successSubtitle: "Gemma ń ṣe ìtúpalẹ̀ ìjábọ̀ rẹ.",
    shareQR: "Pín pẹ̀lú QR",
    textLabel: "Ìjábọ̀ ọ̀rọ̀",
    textPlaceholder: "Ṣàpèjúwe ohun tí o rí — ìpele omi, ipò ọ̀nà, iye ènìyàn tí ó kan…",
    photoLabel: "Ìjábọ̀ fọ́tò",
    voiceLabel: "Ìjábọ̀ ohun",
    takePhoto: "Ya fọ́tò",
    chooseFromLibrary: "Yan láti ìkójọpọ̀",
    remove: "Yọ kúrò",
    useMyLocation: "Lo ipò mi",
    pickOnMap: "Yan lórí maapu",
    movePin: "Gbé àmì",
    submitAnother: "Fi ìjábọ̀ mìíràn sílẹ̀",
    viewDashboard: "Wo ìgbàpadà",
    locationLabel: "Ipò",
  },
  settings: {
    title: "Ètò",
    language: "Èdè",
    languageDesc: "Ló máa ń ṣiṣẹ́ fún àwọn ìfiranṣẹ́ SMS, ìtọ́sọ́nà pajawiri, àti atọ́kùn ètò.",
    save: "Fi ètò pamọ́",
    saving: "Ń fi pamọ́…",
    saved: "✓ Ètò ti fi pamọ́",
    testConnection: "Ṣe ìdánwò ìsopọ̀",
    testing: "Ń ṣe ìdánwò…",
  },
};

const ha: Translations = {
  dir: "ltr",
  emergency: {
    title: "Kana bukatar ceto?",
    subtitle: "Kira sabis na gaggawa da farko — sa'an nan ka aika rahoto.",
    callButton: "Kira",
    smsButton: "Aika Wurin",
    shareButton: "Raba wurina",
    gpsAcquiring: "📡 Ana nemo GPS…",
    gpsFailed: "⚠ GPS ba ya aiki — faɗa adireshi da baki",
    copyLink: "Kwafi hanyar haɗi",
    copied: "✓ An kwafi",
    showAgencies: "Duba lambobin gida & jagorar",
    hideAgencies: "Ɓoye hukumomin gida",
    localNumbers: "Lambobin gaggawa na gida",
    noLocation: "Kunna wuri don ganin lambobi na yankin ka. Na asali: kira 112.",
    whatToTell: "Abin da za ka gaya musu",
    tell: {
      location: "Wurinku",
      locationDetail: "sunan titi, alamar wuri, ko GPS",
      nature: "Nau'in gaggawa",
      natureDetail: "ambaliyar ruwa / rushewar gini / gobara / raunuka",
      people: "Yawan mutane",
      peopleDetail: "nawa ne ke bukata ceto",
      condition: "Halin ka",
      conditionDetail: "rauni, makiyaya, ko mai motsi",
      stayOn: "Ci gaba da layi",
      stayOnDetail: "kada ka rufe har an faɗa maka",
    },
    smsBody: (mapsUrl, lat, lng) =>
      `SOS GAGGAWA — Ina bukatar taimako da ceto.\nWuri: ${mapsUrl}\nGPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nAika ta hanyar GroundTruth.`,
    smsBodyNoGps:
      "SOS GAGGAWA — Ina bukatar taimako da ceto. Kira ni yanzu.",
    shareTitle: "SOS Gaggawa — Wurina",
    shareText: (mapsUrl) => `Ina bukatar taimako da ceto. Wurina: ${mapsUrl}`,
  },
  report: {
    title: "Aika Rahoto",
    subtitle: "Taimaka wa waɗansu ta hanyar raba abin da ka gani.",
    submitButton: "Aika Rahoto",
    submitting: "Ana aika…",
    successTitle: "An aika rahoto",
    successSubtitle: "Gemma yana nazarin rahoton ka.",
    shareQR: "Raba ta QR",
    textLabel: "Rahoto na rubutu",
    textPlaceholder: "Bayyana abin da ka gani — matakin ruwa, halin hanya, yawan mutanen da abin ya shafa…",
    photoLabel: "Rahoto na hoto",
    voiceLabel: "Rahoto na murya",
    takePhoto: "Ɗauki hoto",
    chooseFromLibrary: "Zaɓi daga ɗakin hoto",
    remove: "Cire",
    useMyLocation: "Yi amfani da wurina",
    pickOnMap: "Zaɓi a taswira",
    movePin: "Matsa karafuni",
    submitAnother: "Aika wani",
    viewDashboard: "Duba allon",
    locationLabel: "Wuri",
  },
  settings: {
    title: "Saiti",
    language: "Harshe",
    languageDesc: "Ana amfani don SMS, jagoran gaggawa, da fuska.",
    save: "Adana Saiti",
    saving: "Ana adana…",
    saved: "✓ An adana saiti",
    testConnection: "Gwada haɗin",
    testing: "Ana gwadawa…",
  },
};

const hi: Translations = {
  dir: "ltr",
  emergency: {
    title: "बचाव चाहिए?",
    subtitle: "पहले आपातकालीन सेवाओं को कॉल करें — फिर रिपोर्ट दर्ज करें।",
    callButton: "कॉल करें",
    smsButton: "SMS स्थान",
    shareButton: "मेरा स्थान साझा करें",
    gpsAcquiring: "📡 GPS खोजा जा रहा है…",
    gpsFailed: "⚠ GPS उपलब्ध नहीं — अपना पता मौखिक रूप से बताएं",
    copyLink: "लिंक कॉपी करें",
    copied: "✓ कॉपी हो गया",
    showAgencies: "स्थानीय एजेंसी नंबर और मार्गदर्शन देखें",
    hideAgencies: "स्थानीय एजेंसियां छुपाएं",
    localNumbers: "स्थानीय आपातकालीन नंबर",
    noLocation: "अपने क्षेत्र के नंबर देखने के लिए स्थान सक्षम करें। डिफ़ॉल्ट: 112 डायल करें।",
    whatToTell: "उन्हें क्या बताएं",
    tell: {
      location: "आपका स्थान",
      locationDetail: "सड़क का नाम, स्थलचिह्न, या GPS निर्देशांक",
      nature: "आपातकाल का प्रकार",
      natureDetail: "बाढ़ / ढहन / आग / चोट",
      people: "लोगों की संख्या",
      peopleDetail: "कितने लोगों को बचाव की ज़रूरत है",
      condition: "आपकी स्थिति",
      conditionDetail: "घायल, फंसे हुए, या चलने में सक्षम",
      stayOn: "लाइन पर रहें",
      stayOnDetail: "जब तक न कहा जाए तब तक फोन मत काटें",
    },
    smsBody: (mapsUrl, lat, lng) =>
      `SOS आपातकाल — मुझे बचाव सहायता चाहिए।\nस्थान: ${mapsUrl}\nGPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nGroundTruth द्वारा भेजा गया।`,
    smsBodyNoGps:
      "SOS आपातकाल — मुझे बचाव सहायता चाहिए। मुझे तुरंत कॉल करें।",
    shareTitle: "SOS आपातकाल — मेरा स्थान",
    shareText: (mapsUrl) => `मुझे बचाव सहायता चाहिए। मेरा स्थान: ${mapsUrl}`,
  },
  report: {
    title: "रिपोर्ट दर्ज करें",
    subtitle: "जो आप देखते हैं उसे साझा करके दूसरों की मदद करें।",
    submitButton: "रिपोर्ट भेजें",
    submitting: "भेजा जा रहा है…",
    successTitle: "रिपोर्ट भेज दी गई",
    successSubtitle: "Gemma आपकी रिपोर्ट का विश्लेषण कर रहा है।",
    shareQR: "QR से साझा करें",
    textLabel: "टेक्स्ट रिपोर्ट",
    textPlaceholder: "जो देखते हैं उसका वर्णन करें — जल स्तर, सड़क की स्थिति, प्रभावित लोगों की संख्या…",
    photoLabel: "फोटो रिपोर्ट",
    voiceLabel: "वॉइस रिपोर्ट",
    takePhoto: "फ़ोटो लें",
    chooseFromLibrary: "गैलरी से चुनें",
    remove: "हटाएं",
    useMyLocation: "मेरी लोकेशन उपयोग करें",
    pickOnMap: "नक्शे पर चुनें",
    movePin: "पिन हटाएं",
    submitAnother: "और सबमिट करें",
    viewDashboard: "डैशबोर्ड देखें",
    locationLabel: "स्थान",
  },
  settings: {
    title: "सेटिंग्स",
    language: "भाषा",
    languageDesc: "SMS संदेशों, आपातकालीन मार्गदर्शन और ऐप इंटरफ़ेस के लिए उपयोग की जाती है।",
    save: "सेटिंग्स सहेजें",
    saving: "सहेजा जा रहा है…",
    saved: "✓ सेटिंग्स सहेज ली गईं",
    testConnection: "कनेक्शन जांचें",
    testing: "जांच हो रही है…",
  },
};

const sw: Translations = {
  dir: "ltr",
  emergency: {
    title: "Unahitaji uokoaji?",
    subtitle: "Piga simu huduma za dharura kwanza — kisha tuma ripoti.",
    callButton: "Piga simu",
    smsButton: "Tuma Mahali",
    shareButton: "Shiriki mahali pangu",
    gpsAcquiring: "📡 Inapata GPS…",
    gpsFailed: "⚠ GPS haipatikani — sema anwani yako kwa maneno",
    copyLink: "Nakili kiungo",
    copied: "✓ Imenakiliwa",
    showAgencies: "Ona nambari za ndani na mwongozo",
    hideAgencies: "Ficha wakala wa ndani",
    localNumbers: "Nambari za dharura za ndani",
    noLocation: "Wezesha eneo kupata nambari za eneo lako. Chaguo-msingi: piga 112.",
    whatToTell: "Unachowaambia",
    tell: {
      location: "Mahali ulipo",
      locationDetail: "jina la barabara, alama, au kuratibu za GPS",
      nature: "Aina ya dharura",
      natureDetail: "mafuriko / muundo kuanguka / moto / majeraha",
      people: "Idadi ya watu",
      peopleDetail: "wangapi wanahitaji uokoaji",
      condition: "Hali yako",
      conditionDetail: "kujeruhiwa, kunaswa, au kuweza kusogea",
      stayOn: "Kaa mtandaoni",
      stayOnDetail: "usisimamishe hadi uambiwe",
    },
    smsBody: (mapsUrl, lat, lng) =>
      `SOS DHARURA — Ninahitaji msaada wa uokoaji.\nMahali: ${mapsUrl}\nGPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nImetumwa kupitia GroundTruth.`,
    smsBodyNoGps:
      "SOS DHARURA — Ninahitaji msaada wa uokoaji. Nipigie simu sasa hivi.",
    shareTitle: "SOS Dharura — Mahali pangu",
    shareText: (mapsUrl) => `Ninahitaji msaada wa uokoaji. Mahali pangu: ${mapsUrl}`,
  },
  report: {
    title: "Tuma ripoti",
    subtitle: "Saidia wengine kwa kushiriki unachokiona.",
    submitButton: "Tuma ripoti",
    submitting: "Inatuma…",
    successTitle: "Ripoti imetumwa",
    successSubtitle: "Gemma inachambua ripoti yako.",
    shareQR: "Shiriki kwa QR",
    textLabel: "Ripoti ya maandishi",
    textPlaceholder: "Elezea unachokiona — kina cha maji, hali ya barabara, idadi ya watu walioathirika…",
    photoLabel: "Ripoti ya picha",
    voiceLabel: "Ripoti ya sauti",
    takePhoto: "Piga picha",
    chooseFromLibrary: "Chagua kutoka galeria",
    remove: "Ondoa",
    useMyLocation: "Tumia eneo langu",
    pickOnMap: "Chagua kwenye ramani",
    movePin: "Sogeza pini",
    submitAnother: "Tuma nyingine",
    viewDashboard: "Tazama dashibodi",
    locationLabel: "Eneo",
  },
  settings: {
    title: "Mipangilio",
    language: "Lugha",
    languageDesc: "Inatumika kwa ujumbe wa SMS, mwongozo wa dharura, na kiolesura.",
    save: "Hifadhi mipangilio",
    saving: "Inahifadhi…",
    saved: "✓ Mipangilio imehifadhiwa",
    testConnection: "Jaribu muunganisho",
    testing: "Inajaribu…",
  },
};

const id: Translations = {
  dir: "ltr",
  emergency: {
    title: "Butuh pertolongan?",
    subtitle: "Hubungi layanan darurat dulu — lalu kirim laporan.",
    callButton: "Telepon",
    smsButton: "SMS Lokasi",
    shareButton: "Bagikan lokasi saya",
    gpsAcquiring: "📡 Mendapatkan GPS…",
    gpsFailed: "⚠ GPS tidak tersedia — sampaikan alamat Anda secara lisan",
    copyLink: "Salin tautan",
    copied: "✓ Tersalin",
    showAgencies: "Lihat nomor lokal & panduan",
    hideAgencies: "Sembunyikan lembaga lokal",
    localNumbers: "Nomor darurat lokal",
    noLocation: "Aktifkan lokasi untuk melihat nomor di area Anda. Default: hubungi 112.",
    whatToTell: "Apa yang harus disampaikan",
    tell: {
      location: "Lokasi Anda",
      locationDetail: "nama jalan, landmark, atau koordinat GPS",
      nature: "Jenis kedaruratan",
      natureDetail: "banjir / bangunan runtuh / kebakaran / cedera",
      people: "Jumlah orang",
      peopleDetail: "berapa yang membutuhkan penyelamatan",
      condition: "Kondisi Anda",
      conditionDetail: "terluka, terjebak, atau dapat bergerak",
      stayOn: "Tetap di saluran",
      stayOnDetail: "jangan menutup telepon sampai diperintahkan",
    },
    smsBody: (mapsUrl, lat, lng) =>
      `SOS DARURAT — Saya membutuhkan bantuan penyelamatan.\nLokasi: ${mapsUrl}\nGPS: ${lat.toFixed(6)}, ${lng.toFixed(6)}\nDikirim melalui GroundTruth.`,
    smsBodyNoGps:
      "SOS DARURAT — Saya membutuhkan bantuan penyelamatan. Hubungi saya segera.",
    shareTitle: "SOS Darurat — Lokasi saya",
    shareText: (mapsUrl) => `Saya membutuhkan bantuan penyelamatan. Lokasi saya: ${mapsUrl}`,
  },
  report: {
    title: "Kirim Laporan",
    subtitle: "Bantu orang lain dengan berbagi apa yang Anda lihat.",
    submitButton: "Kirim laporan",
    submitting: "Mengirim…",
    successTitle: "Laporan terkirim",
    successSubtitle: "Gemma sedang menganalisis laporan Anda.",
    shareQR: "Bagikan via QR",
    textLabel: "Laporan teks",
    textPlaceholder: "Jelaskan yang Anda lihat — ketinggian air, kondisi jalan, jumlah orang yang terdampak…",
    photoLabel: "Laporan foto",
    voiceLabel: "Laporan suara",
    takePhoto: "Ambil foto",
    chooseFromLibrary: "Pilih dari galeri",
    remove: "Hapus",
    useMyLocation: "Gunakan lokasi saya",
    pickOnMap: "Pilih di peta",
    movePin: "Pindah pin",
    submitAnother: "Kirim lagi",
    viewDashboard: "Lihat dasbor",
    locationLabel: "Lokasi",
  },
  settings: {
    title: "Pengaturan",
    language: "Bahasa",
    languageDesc: "Digunakan untuk pesan SMS, panduan darurat, dan antarmuka aplikasi.",
    save: "Simpan pengaturan",
    saving: "Menyimpan…",
    saved: "✓ Pengaturan tersimpan",
    testConnection: "Uji koneksi",
    testing: "Menguji…",
  },
};

export const translations: Record<LocaleCode, Translations> = {
  en, fr, es, pt, ar, yo, ha, hi, sw, id,
};

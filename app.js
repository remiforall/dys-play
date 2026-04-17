/**
 * Dys-Play - Application JavaScript Principale
 * PWA de lecture augmentée pour personnes dyslexiques
 * Conforme WCAG 2.1 AA
 */

// ============================================
// 1. CONSTANTES ET CONFIGURATION
// ============================================

const CONFIG = {
  DB_NAME: "DysPlayDB",
  DB_VERSION: 1,
  STORE_LIBRARY: "library",
  STORE_SETTINGS: "settings",
  LS_PREFIX: "dysplay_",
  OCR_LANGUAGES: ["fra", "eng", "ara"],
  DEFAULT_LANGUAGE: "fr",
  MASK_HEIGHT: 60,
  MIN_FONT_SIZE: 14,
  MAX_FONT_SIZE: 40,
  PERFORMANCE_THRESHOLD: 100, // ms
  // OCR Advanced Settings
  OCR: {
    CONFIDENCE_THRESHOLD: 0.65,
    ENABLE_PREPROCESSING: true,
    ENABLE_VALIDATION: true,
    AUTO_CORRECT: true,
    RETRY_COUNT: 2,
    PREPROCESSOR_OPTIONS: {
      improveContrast: true,
      denoise: false,
      binarize: false,
      detectOrientation: true,
    },
  },
};

// ============================================
// 2. ÉTAT GLOBAL (State Management)
// ============================================

const state = {
  isOnline: navigator.onLine,
  isFocusMode: false,
  isPlaying: false,
  isLoading: false,
  isFirstTime: true,
  currentPage: "acquisition", // 'onboarding', 'acquisition', 'results'
  currentLang: CONFIG.DEFAULT_LANGUAGE,
  textContent: "",
  settings: {
    theme: "light",
    font: "system-ui",
    fontSize: 20,
    letterSpacing: 0.12,
    wordSpacing: 0.25,
    lineHeight: 1.7,
    zebraMode: false,
    syllableColor: false,
    maskOpacity: 0.7,
    voiceRate: 1.0,
    reducedMotion: false,
    overlayColor: null,
    overlayOpacity: 0.15,
    rulerMode: "window",
  },
  library: [],
  utterance: null,
  tesseractWorker: null,
  // OCR State
  ocrState: {
    processedImage: null,
    zoneSelector: null,
    selectedZone: null,
    ocrResults: null,
    validation: null,
    confidence: 0,
    recognizedText: null,
  },
};

// ============================================
// 3. INTERNATIONALISATION (i18n)
// ============================================

const i18n = {
  // Language metadata
  metadata: {
    fr: { dir: "ltr", name: "🇫🇷 Français", nativeName: "Français" },
    en: { dir: "ltr", name: "🇬🇧 English", nativeName: "English" },
    ar: { dir: "rtl", name: "🇸🇦 العربية", nativeName: "العربية" },
  },

  fr: {
    // Onboarding
    "onboarding.title": "Bienvenue dans Dys-Play Pro",
    "onboarding.subtitle":
      "Une application spécialement conçue pour la lecture augmentée. Prenez quelques secondes pour configurer vos préférences.",
    "onboarding.language": "Langue préférée",
    "onboarding.font": "Police d'écriture",
    "onboarding.fontDesc.system": "Système (défaut)",
    "onboarding.fontDesc.opendyslexic": "OpenDyslexic (optimisée dyslexie)",
    "onboarding.fontDesc.comicneue": "Comic Neue (claire et aérée)",
    "onboarding.fontDesc.arial": "Arial (épurée)",
    "onboarding.fontDesc.georgia": "Georgia (serif lisible)",
    "onboarding.theme": "Thème",
    "onboarding.themeLight": "☀️ Clair",
    "onboarding.themeDark": "🌙 Sombre",
    "onboarding.buttonSkip": "Plus tard",
    "onboarding.buttonApply": "Appliquer →",
    "onboarding.quickSetup": "⚙️ Configuration rapide",

    // Main Interface
    "app.title": "Dys-Play Pro",
    "status.online": "En ligne",
    "status.offline": "Hors-ligne",
    "btn.import": "Importer",
    "btn.scan": "Scanner",
    "btn.play": "Lecture",
    "btn.pause": "Pause",
    "btn.focus": "Mode Focus",
    "btn.settings": "Réglages",
    "btn.library": "Bibliothèque",
    "section.acquisition": "Acquisition",
    "section.audio": "Audio",
    "section.focus": "Aide Visuelle",
    "section.typography": "Typographie",
    "section.advanced": "Options Avancées",
    "section.data": "Données",
    "label.font": "Police",
    "label.fontSize": "Taille",
    "label.letterSpacing": "Espacement lettres",
    "label.wordSpacing": "Espacement mots",
    "label.lineHeight": "Interlignage",
    "label.voiceRate": "Vitesse",
    "toggle.zebra": "Mode Zèbre",
    "toggle.syllable": "Coloration syllabique",
    "toggle.reducedMotion": "Mode calme",
    "section.overlay": "Overlay couleur",
    "overlay.desc": "Filtre coloré pour le stress visuel (syndrome d'Irlen)",
    "label.overlayOpacity": "Intensité",
    "label.rulerMode": "Mode règle",
    "ruler.line": "Ligne",
    "ruler.window": "Fenêtre",
    "ruler.top": "Masque haut",
    "ruler.spotlight": "Spot",
    "msg.saving": "Sauvegarde...",
    "msg.saved": "Sauvegardé",
    "msg.error": "Erreur",
    "msg.offline": "Mode hors-ligne",
    "msg.ocr.processing": "Reconnaissance de texte en cours...",
    "msg.ocr.complete": "Texte reconnu",
    "msg.ocr.validating": "Validation du texte...",
    "msg.ocr.improving": "Amélioration de l'image...",
    "msg.ocr.success": "Reconnaissance réussie!",
    "ocr.confidence": "Confiance",
    "ocr.recognized": "Texte reconnu",
    "ocr.issues": "Mots détectés comme suspects",
    "ocr.settings": "Paramètres OCR",
    "ocr.preprocessing": "Pré-traitement Image",
    "ocr.validation": "Validation & Correction",
    "msg.library.empty": "Aucun document sauvegardé",
    "placeholder.textInput": "Ou saisissez votre texte ici...",
    "title.settings": "Réglages",
    "title.library": "Ma Bibliothèque",
    "title.menu": "Menu",
    "action.save": "Sauvegarder ce document",
    "action.reset": "Réinitialiser",
  },

  en: {
    // Onboarding
    "onboarding.title": "Welcome to Dys-Play Pro",
    "onboarding.subtitle":
      "An application specially designed for enhanced reading. Take a few seconds to configure your preferences.",
    "onboarding.language": "Preferred Language",
    "onboarding.font": "Font",
    "onboarding.fontDesc.system": "System (default)",
    "onboarding.fontDesc.opendyslexic": "OpenDyslexic (dyslexia friendly)",
    "onboarding.fontDesc.comicneue": "Comic Neue (clear and spacious)",
    "onboarding.fontDesc.arial": "Arial (clean)",
    "onboarding.fontDesc.georgia": "Georgia (readable serif)",
    "onboarding.theme": "Theme",
    "onboarding.themeLight": "☀️ Light",
    "onboarding.themeDark": "🌙 Dark",
    "onboarding.buttonSkip": "Later",
    "onboarding.buttonApply": "Apply →",
    "onboarding.quickSetup": "⚙️ Quick Setup",

    // Main Interface
    "app.title": "Dys-Play Pro",
    "status.online": "Online",
    "status.offline": "Offline",
    "btn.import": "Import",
    "btn.scan": "Scan",
    "btn.play": "Play",
    "btn.pause": "Pause",
    "btn.focus": "Focus Mode",
    "btn.settings": "Settings",
    "btn.library": "Library",
    "section.acquisition": "Acquisition",
    "section.audio": "Audio",
    "section.focus": "Visual Aid",
    "section.typography": "Typography",
    "section.advanced": "Advanced Options",
    "section.data": "Data",
    "label.font": "Font",
    "label.fontSize": "Size",
    "label.letterSpacing": "Letter Spacing",
    "label.wordSpacing": "Word Spacing",
    "label.lineHeight": "Line Height",
    "label.voiceRate": "Speed",
    "toggle.zebra": "Zebra Mode",
    "toggle.syllable": "Syllable Color",
    "toggle.reducedMotion": "Calm mode",
    "section.overlay": "Color Overlay",
    "overlay.desc": "Colored filter for visual stress (Irlen syndrome)",
    "label.overlayOpacity": "Intensity",
    "label.rulerMode": "Ruler Mode",
    "ruler.line": "Line",
    "ruler.window": "Window",
    "ruler.top": "Top Mask",
    "ruler.spotlight": "Spotlight",
    "msg.saving": "Saving...",
    "msg.saved": "Saved",
    "msg.error": "Error",
    "msg.offline": "Offline mode",
    "msg.ocr.processing": "Text recognition in progress...",
    "msg.ocr.complete": "Text recognized",
    "msg.library.empty": "No documents saved",
    "placeholder.textInput": "Or type your text here...",
    "title.settings": "Settings",
    "title.library": "My Library",
    "title.menu": "Menu",
    "action.save": "Save this document",
    "action.reset": "Reset",
  },

  ar: {
    // Onboarding
    "onboarding.title": "مرحبا بك في Dys-Play Pro",
    "onboarding.subtitle":
      "تطبيق مصمم خصيصا للقراءة المحسنة. خذ بضع ثوان لتكوين تفضيلاتك.",
    "onboarding.language": "اللغة المفضلة",
    "onboarding.font": "الخط",
    "onboarding.fontDesc.system": "النظام (الافتراضي)",
    "onboarding.fontDesc.opendyslexic": "OpenDyslexic (صديقة الديسلكسيا)",
    "onboarding.fontDesc.comicneue": "Comic Neue (واضحة وفسيحة)",
    "onboarding.fontDesc.arial": "Arial (نظيفة)",
    "onboarding.fontDesc.georgia": "Georgia (serif سهلة القراءة)",
    "onboarding.theme": "المظهر",
    "onboarding.themeLight": "☀️ فاتح",
    "onboarding.themeDark": "🌙 غامق",
    "onboarding.buttonSkip": "لاحقا",
    "onboarding.buttonApply": "تطبيق →",
    "onboarding.quickSetup": "⚙️ إعداد سريع",

    // Main Interface
    "app.title": "Dys-Play Pro",
    "status.online": "متصل",
    "status.offline": "غير متصل",
    "btn.import": "استيراد",
    "btn.scan": "مسح",
    "btn.play": "تشغيل",
    "btn.pause": "إيقاف",
    "btn.focus": "وضع التركيز",
    "btn.settings": "الإعدادات",
    "btn.library": "المكتبة",
    "section.acquisition": "الاستحواذ",
    "section.audio": "صوتي",
    "section.focus": "المساعدة البصرية",
    "section.typography": "الطباعة",
    "section.advanced": "خيارات متقدمة",
    "section.data": "البيانات",
    "label.font": "الخط",
    "label.fontSize": "الحجم",
    "label.letterSpacing": "تباعد الأحرف",
    "label.wordSpacing": "تباعد الكلمات",
    "label.lineHeight": "ارتفاع السطر",
    "label.voiceRate": "السرعة",
    "toggle.zebra": "وضع الحمار الوحشي",
    "toggle.syllable": "تلوين المقاطع",
    "toggle.reducedMotion": "الوضع الهادئ",
    "section.overlay": "تراكب لوني",
    "overlay.desc": "مرشح ملون للإجهاد البصري",
    "label.overlayOpacity": "الكثافة",
    "label.rulerMode": "وضع المسطرة",
    "ruler.line": "خط",
    "ruler.window": "نافذة",
    "ruler.top": "قناع علوي",
    "ruler.spotlight": "بقعة ضوء",
    "msg.saving": "جاري الحفظ...",
    "msg.saved": "تم الحفظ",
    "msg.error": "خطأ",
    "msg.offline": "وضع غير متصل",
    "msg.ocr.processing": "جاري التعرف على النص...",
    "msg.ocr.complete": "تم التعرف على النص",
    "msg.library.empty": "لا توجد مستندات محفوظة",
    "placeholder.textInput": "أو اكتب نصك هنا...",
    "title.settings": "الإعدادات",
    "title.library": "مكتبتي",
    "title.menu": "القائمة",
    "action.save": "احفظ هذا المستند",
    "action.reset": "إعادة تعيين",
  },

  /**
   * Get translated string
   * @param {string} key - Translation key (e.g., 'btn.play')
   * @param {string} [lang] - Language code (fr, en, ar). Uses current language if not specified
   * @returns {string} - Translated string or key if translation not found
   */
  t(key, lang = state.currentLang) {
    return (
      (this[lang] && this[lang][key]) ||
      (this[CONFIG.DEFAULT_LANGUAGE] && this[CONFIG.DEFAULT_LANGUAGE][key]) ||
      key
    );
  },

  /**
   * Get language metadata
   * @param {string} lang - Language code
   * @returns {object} - Language metadata {dir, name, nativeName}
   */
  getLangMetadata(lang) {
    return this.metadata[lang] || { dir: "ltr", name: lang, nativeName: lang };
  },
};

// ============================================
// 4. INDEXEDDB - Base de données locale
// ============================================

class Database {
  constructor() {
    this.db = null;
  }

  async init() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(CONFIG.DB_NAME, CONFIG.DB_VERSION);

      request.onerror = () => reject(request.error);
      request.onsuccess = () => {
        this.db = request.result;
        resolve(this.db);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Store pour la bibliothèque
        if (!db.objectStoreNames.contains(CONFIG.STORE_LIBRARY)) {
          const libraryStore = db.createObjectStore(CONFIG.STORE_LIBRARY, {
            keyPath: "id",
            autoIncrement: true,
          });
          libraryStore.createIndex("date", "date", { unique: false });
          libraryStore.createIndex("lang", "lang", { unique: false });
        }

        // Store pour les settings
        if (!db.objectStoreNames.contains(CONFIG.STORE_SETTINGS)) {
          db.createObjectStore(CONFIG.STORE_SETTINGS, { keyPath: "key" });
        }
      };
    });
  }

  async addDocument(text, lang = CONFIG.DEFAULT_LANGUAGE) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [CONFIG.STORE_LIBRARY],
        "readwrite",
      );
      const store = transaction.objectStore(CONFIG.STORE_LIBRARY);

      const doc = {
        text,
        lang,
        date: Date.now(),
      };

      const request = store.add(doc);
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getAllDocuments() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [CONFIG.STORE_LIBRARY],
        "readonly",
      );
      const store = transaction.objectStore(CONFIG.STORE_LIBRARY);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async getDocument(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [CONFIG.STORE_LIBRARY],
        "readonly",
      );
      const store = transaction.objectStore(CONFIG.STORE_LIBRARY);
      const request = store.get(id);

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  async deleteDocument(id) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [CONFIG.STORE_LIBRARY],
        "readwrite",
      );
      const store = transaction.objectStore(CONFIG.STORE_LIBRARY);
      const request = store.delete(id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async clearLibrary() {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [CONFIG.STORE_LIBRARY],
        "readwrite",
      );
      const store = transaction.objectStore(CONFIG.STORE_LIBRARY);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async saveSetting(key, value) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [CONFIG.STORE_SETTINGS],
        "readwrite",
      );
      const store = transaction.objectStore(CONFIG.STORE_SETTINGS);
      const request = store.put({ key, value });

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error);
    });
  }

  async getSetting(key) {
    return new Promise((resolve, reject) => {
      const transaction = this.db.transaction(
        [CONFIG.STORE_SETTINGS],
        "readonly",
      );
      const store = transaction.objectStore(CONFIG.STORE_SETTINGS);
      const request = store.get(key);

      request.onsuccess = () => resolve(request.result?.value);
      request.onerror = () => reject(request.error);
    });
  }
}

const db = new Database();

// ============================================
// 5. LOCALSTORAGE - Préférences
// ============================================

const Storage = {
  get(key) {
    try {
      const item = localStorage.getItem(CONFIG.LS_PREFIX + key);
      if (!item) {
        return null;
      }
      const parsed = JSON.parse(item);
      return parsed;
    } catch (e) {
      return null;
    }
  },

  set(key, value) {
    try {
      localStorage.setItem(CONFIG.LS_PREFIX + key, JSON.stringify(value));
    } catch (e) {
      showToast("Erreur de sauvegarde des paramètres", "error");
    }
  },

  remove(key) {
    localStorage.removeItem(CONFIG.LS_PREFIX + key);
  },

  clear() {
    const keys = Object.keys(localStorage);
    keys.forEach((key) => {
      if (key.startsWith(CONFIG.LS_PREFIX)) {
        localStorage.removeItem(key);
      }
    });
  },
};

// ============================================
// 5b. UTILITAIRES DE SÉCURITÉ
// ============================================

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

// ============================================
// 6. MOTEUR OCR (Tesseract.js) - AMÉLIORÉ
// ============================================

class OCREngine {
  constructor() {
    this.worker = null;
    this.isInitialized = false;
    this.preprocessor = null;
    this.validator = null;
    this.retryCount = 0;
  }

  _ensureModules() {
    if (!this.preprocessor && typeof ImagePreprocessor !== "undefined") {
      this.preprocessor = new ImagePreprocessor();
    }
    if (!this.validator && typeof OCRValidator !== "undefined") {
      this.validator = new OCRValidator();
    }
  }

  async init(lang = "fra") {
    if (this.isInitialized && this.worker) {
      return this.worker;
    }

    showLoader(true, "Initialisation OCR...");

    try {
      // Créer le worker Tesseract (chemins locaux, zéro CDN)
      this.worker = await Tesseract.createWorker(lang, 1, {
        workerPath: "libs/tesseract-worker.min.js",
        corePath: "libs/tesseract-core.wasm.js",
        logger: (m) => {
          if (m.status === "recognizing text") {
            updateLoaderProgress(Math.round(m.progress * 100));
          }
        },
      });

      this.isInitialized = true;
      showLoader(false);
      return this.worker;
    } catch (error) {
      console.error("Erreur initialisation OCR:", error);
      showLoader(false);
      throw error;
    }
  }

  /**
   * Reconnaissance avec pré-traitement et validation
   */
  async recognize(imageFile, options = {}) {
    this._ensureModules();
    if (!this.worker) {
      await this.init();
    }

    const {
      enablePreprocessing = CONFIG.OCR.ENABLE_PREPROCESSING,
      enableValidation = CONFIG.OCR.ENABLE_VALIDATION,
      retryCount = CONFIG.OCR.RETRY_COUNT,
    } = options;

    showLoader(true, i18n[state.currentLang]["msg.ocr.processing"]);

    try {
      let processedImage = imageFile;

      // 1. Pré-traitement
      if (enablePreprocessing) {
        showLoader(true, "Amélioration image...");
        const preprocessed = await this.preprocessor.processImage(
          imageFile,
          CONFIG.OCR.PREPROCESSOR_OPTIONS,
        );
        processedImage = preprocessed;
      }

      // 2. OCR avec retry
      let ocrText = "";
      let ocrData = null;
      this.retryCount = 0;

      while (this.retryCount < retryCount + 1) {
        try {
          showLoader(
            true,
            `Reconnaissance texte (tentative ${this.retryCount + 1})...`,
          );

          const imageSource = processedImage.dataUrl || imageFile;
          const result = await this.worker.recognize(imageSource);

          ocrText = result.data.text;
          ocrData = result.data;
          break; // Succès
        } catch (error) {
          this.retryCount++;
          if (this.retryCount >= retryCount + 1) {
            throw error;
          }
          console.warn(`OCR retry ${this.retryCount}:`, error.message);
        }
      }

      // 3. Validation et correction
      let validation = null;
      if (enableValidation && ocrText.trim()) {
        showLoader(true, "Validation texte...");
        validation = this.validator.validateAndCorrect(
          ocrText,
          state.currentLang,
          CONFIG.OCR.AUTO_CORRECT,
        );
      }

      // 4. Calculer confiance
      const confidence = this.validator.getOverallConfidence(ocrText, ocrData);

      // Sauvegarder résultats
      state.ocrState.ocrResults = {
        text: ocrText,
        dataUrl: processedImage.dataUrl || null,
        confidence: confidence,
        retries: this.retryCount,
      };
      state.ocrState.validation = validation;
      state.ocrState.confidence = confidence;

      showLoader(false);

      // Afficher les résultats
      displayOCRResults(ocrText, confidence, validation);

      return {
        text: ocrText,
        confidence: confidence,
        validation: validation,
        preprocessed: processedImage,
      };
    } catch (error) {
      console.error("Erreur OCR:", error);
      showLoader(false);
      showToast(
        i18n[state.currentLang]["msg.error"] + ": " + error.message,
        "error",
      );
      throw error;
    }
  }

  /**
   * Reconnaissance d'une zone sélectionnée
   */
  async recognizeZone(imageDataUrl) {
    this._ensureModules();
    if (!this.worker) {
      await this.init();
    }

    showLoader(true, "Traitement zone sélectionnée...");

    try {
      // Pré-traiter la zone
      const preprocessed = await this.preprocessor.processZone(
        imageDataUrl,
        CONFIG.OCR.PREPROCESSOR_OPTIONS,
      );

      // OCR sur la zone
      const result = await this.worker.recognize(preprocessed);
      const text = result.data.text;

      // Validation
      const validation = this.validator.validateAndCorrect(
        text,
        state.currentLang,
        CONFIG.OCR.AUTO_CORRECT,
      );
      const confidence = this.validator.getOverallConfidence(text, result.data);

      showLoader(false);
      return {
        text: text,
        confidence: confidence,
        validation: validation,
      };
    } catch (error) {
      console.error("Erreur reconnaissance zone:", error);
      showLoader(false);
      throw error;
    }
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.isInitialized = false;
    }
  }
}

const ocr = new OCREngine();

// ============================================
// 7. MOTEUR TTS (Web Speech API)
// ============================================

class TTSEngine {
  constructor() {
    this.synth = window.speechSynthesis;
    this.utterance = null;
    this.voices = [];
    this.loadVoices();
  }

  loadVoices() {
    const load = () => {
      this.voices = this.synth.getVoices();
    };

    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = load;
    }
    load();
  }

  getVoiceForLang(lang) {
    const langMap = {
      fr: ["fr-FR", "fr"],
      en: ["en-US", "en-GB", "en"],
      ar: ["ar-SA", "ar"],
    };

    const prefs = langMap[lang] || [lang];
    return (
      this.voices.find((voice) =>
        prefs.some((pref) => voice.lang.startsWith(pref)),
      ) || this.voices[0]
    );
  }

  speak(text, lang = CONFIG.DEFAULT_LANGUAGE, rate = 1.0) {
    // Arrêter la lecture en cours
    this.stop();

    this.utterance = new SpeechSynthesisUtterance(text);
    this.utterance.lang =
      lang === "ar" ? "ar-SA" : lang === "en" ? "en-US" : "fr-FR";
    this.utterance.rate = rate;
    this.utterance.pitch = 1;
    this.utterance.volume = 1;

    const voice = this.getVoiceForLang(lang);
    if (voice) {
      this.utterance.voice = voice;
    }

    // Events
    this.utterance.onstart = () => {
      state.isPlaying = true;
      updatePlayButton();
    };

    this.utterance.onend = () => {
      state.isPlaying = false;
      updatePlayButton();
      clearSpeakingHighlight();
    };

    this.utterance.onerror = (e) => {
      console.error("TTS Error:", e);
      state.isPlaying = false;
      updatePlayButton();
    };

    // Highlight des mots
    this.utterance.onboundary = (e) => {
      if (e.name === "word") {
        highlightWord(e.charIndex);
      }
    };

    this.synth.speak(this.utterance);
    state.utterance = this.utterance;
    state.isPlaying = true;
    updatePlayButton();
  }

  pause() {
    if (this.synth.paused) {
      this.synth.resume();
    } else {
      this.synth.pause();
    }
  }

  stop() {
    this.synth.cancel();
    state.isPlaying = false;
    clearSpeakingHighlight();
    updatePlayButton();
  }

  setRate(rate) {
    state.settings.voiceRate = rate;
    if (this.utterance) {
      this.utterance.rate = rate;
    }
  }
}

const tts = new TTSEngine();

// ============================================
// 8. MOTEUR FOCUS MASK (Règle de lecture)
// ============================================

class FocusMaskEngine {
  constructor() {
    this.maskElement = document.getElementById("focus-mask");
    this.guideElement = document.getElementById("ruler-guide");
    this.readerElement = document.getElementById("reader-area");
    this.isActive = false;
  }

  toggle() {
    this.isActive = !this.isActive;

    if (this.isActive) {
      this.enable();
    } else {
      this.disable();
    }

    return this.isActive;
  }

  enable() {
    state.isFocusMode = true;
    this.maskElement.hidden = false;
    this.guideElement.hidden = false;
    document.documentElement.style.setProperty(
      "--mask-opacity",
      state.settings.maskOpacity,
    );
    // En mode "line", le masque sombre est invisible
    if (state.settings.rulerMode === "line") {
      this.maskElement.style.opacity = "0";
    }
  }

  disable() {
    state.isFocusMode = false;
    this.maskElement.hidden = true;
    this.guideElement.hidden = true;
    // Réinitialiser le mask-image inline
    this.maskElement.style.maskImage = "";
    this.maskElement.style.webkitMaskImage = "";
  }

  setPosition(y, x) {
    if (!this.isActive) return;

    const rect = this.readerElement.getBoundingClientRect();
    const scrollTop = this.readerElement.scrollTop;
    const mode = state.settings.rulerMode || "window";

    // Position relative dans le conteneur
    let relativeY = y - rect.top + scrollTop;
    const height = CONFIG.MASK_HEIGHT;
    const mid = height / 2;

    // Limiter aux bords
    const maxScroll = this.readerElement.scrollHeight - rect.height;
    relativeY = Math.max(mid, Math.min(relativeY + mid, maxScroll + mid));
    const topPos = relativeY - mid;

    // Position X relative (pour spotlight)
    let relativeX = rect.width / 2;
    if (x !== undefined) {
      relativeX = x - rect.left;
    }

    // Appliquer les variables CSS pour la ruler-guide
    document.documentElement.style.setProperty("--mask-top", `${topPos}px`);
    document.documentElement.style.setProperty(
      "--mask-bottom",
      `${topPos + height}px`,
    );

    // Appliquer le mode de masque
    this._applyMaskMode(mode, topPos, height, relativeX, relativeY);
  }

  _applyMaskMode(mode, topPos, height, relativeX, relativeY) {
    const el = this.maskElement;

    switch (mode) {
      case "line":
        // Pas de masque sombre, seulement la ruler-guide
        el.style.maskImage = "none";
        el.style.webkitMaskImage = "none";
        el.style.opacity = "0";
        break;

      case "window": {
        // Fenêtre transparente, sombre au-dessus et en-dessous
        el.style.opacity = state.settings.maskOpacity;
        const wm = `linear-gradient(to bottom, black 0%, black ${topPos}px, transparent ${topPos}px, transparent ${topPos + height}px, black ${topPos + height}px, black 100%)`;
        el.style.maskImage = wm;
        el.style.webkitMaskImage = wm;
        break;
      }

      case "top": {
        // Masque uniquement au-dessus de la ligne de lecture
        el.style.opacity = state.settings.maskOpacity;
        const tm = `linear-gradient(to bottom, black 0%, black ${topPos}px, transparent ${topPos}px, transparent 100%)`;
        el.style.maskImage = tm;
        el.style.webkitMaskImage = tm;
        break;
      }

      case "spotlight": {
        // Ellipse transparente autour du curseur
        el.style.opacity = state.settings.maskOpacity;
        const rx = 200;
        const ry = height;
        const sm = `radial-gradient(ellipse ${rx}px ${ry}px at ${relativeX}px ${relativeY}px, transparent 0%, transparent 80%, black 100%)`;
        el.style.maskImage = sm;
        el.style.webkitMaskImage = sm;
        break;
      }
    }
  }

  setOpacity(opacity) {
    state.settings.maskOpacity = opacity;
    document.documentElement.style.setProperty("--mask-opacity", opacity);
    Storage.set("maskOpacity", opacity);
  }

  syncWithTTS(wordElement) {
    if (!this.isActive || !wordElement) return;

    const rect = wordElement.getBoundingClientRect();
    const readerRect = this.readerElement.getBoundingClientRect();
    const scrollTop = this.readerElement.scrollTop;

    // Position du mot au centre de la fenêtre
    const wordCenter = rect.top - readerRect.top + rect.height / 2 + scrollTop;
    const mid = CONFIG.MASK_HEIGHT / 2;
    const topPos = wordCenter - mid;

    document.documentElement.style.setProperty("--mask-top", `${topPos}px`);
    document.documentElement.style.setProperty(
      "--mask-bottom",
      `${topPos + CONFIG.MASK_HEIGHT}px`,
    );

    // Appliquer le mode pour le mot courant
    const wordCenterX = rect.left + rect.width / 2 - readerRect.left;
    this._applyMaskMode(
      state.settings.rulerMode || "window",
      topPos,
      CONFIG.MASK_HEIGHT,
      wordCenterX,
      wordCenter,
    );

    // Scroll vers le mot si nécessaire
    if (rect.top < readerRect.top || rect.bottom > readerRect.bottom) {
      wordElement.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }
}

const focusMask = new FocusMaskEngine();

// ============================================
// 9. MOTEUR TYPOGRAPHIE
// ============================================

class TypographyEngine {
  constructor() {
    this.root = document.documentElement;
  }

  applySettings(settings) {
    const startTime = performance.now();

    // Applicher les variables CSS
    this.root.style.setProperty("--font-size", `${settings.fontSize}px`);
    this.root.style.setProperty(
      "--letter-spacing",
      `${settings.letterSpacing}em`,
    );
    this.root.style.setProperty("--line-height", settings.lineHeight);
    if (settings.wordSpacing !== undefined) {
      this.root.style.setProperty(
        "--word-spacing",
        `${settings.wordSpacing}em`,
      );
    }

    // Police
    if (settings.font === "OpenDyslexic") {
      this.root.style.setProperty(
        "--font-family",
        "'OpenDyslexic', 'Comic Neue', sans-serif",
      );
    } else if (settings.font === "Comic Neue") {
      this.root.style.setProperty(
        "--font-family",
        "'Comic Neue', 'Comic Sans MS', cursive",
      );
    } else {
      this.root.style.setProperty("--font-family", settings.font);
    }

    const elapsed = performance.now() - startTime;

    // Objectif: < 100ms pour feedback immédiat
    if (elapsed > CONFIG.PERFORMANCE_THRESHOLD) {
      console.warn(
        `Performance: Typography took ${elapsed.toFixed(2)}ms (>${CONFIG.PERFORMANCE_THRESHOLD}ms)`,
      );
    }
  }

  setFontSize(size) {
    state.settings.fontSize = size;
    this.root.style.setProperty("--font-size", `${size}px`);
    Storage.set("fontSize", size);
  }

  setLetterSpacing(spacing) {
    state.settings.letterSpacing = spacing;
    this.root.style.setProperty("--letter-spacing", `${spacing}em`);
    Storage.set("letterSpacing", spacing);
  }

  setLineHeight(height) {
    state.settings.lineHeight = height;
    this.root.style.setProperty("--line-height", height);
    Storage.set("lineHeight", height);
  }

  setWordSpacing(spacing) {
    state.settings.wordSpacing = spacing;
    this.root.style.setProperty("--word-spacing", `${spacing}em`);
    Storage.set("wordSpacing", spacing);
  }

  setFont(font) {
    state.settings.font = font;
    // Les polices Google Fonts sont pré-chargées dans le head
    if (font === "OpenDyslexic") {
      this.root.style.setProperty(
        "--font-family",
        "'OpenDyslexic', 'Comic Neue', sans-serif",
      );
    } else if (font === "Comic Neue") {
      this.root.style.setProperty(
        "--font-family",
        "'Comic Neue', 'Comic Sans MS', cursive",
      );
    } else {
      this.root.style.setProperty("--font-family", font);
    }
    Storage.set("font", font);
  }
}

const typography = new TypographyEngine();

// Gestion overlay couleur Irlen
const colorOverlay = {
  element: null,

  init() {
    this.element = document.getElementById("color-overlay");
  },

  setColor(color) {
    state.settings.overlayColor = color;
    Storage.set("overlayColor", color);
    if (color) {
      document.documentElement.style.setProperty("--overlay-color", color);
      this.element.hidden = false;
    } else {
      this.element.hidden = true;
    }
  },

  setOpacity(opacity) {
    state.settings.overlayOpacity = opacity;
    Storage.set("overlayOpacity", opacity);
    document.documentElement.style.setProperty("--overlay-opacity", opacity);
  },
};

// ============================================
// 10. MOTEUR ZÈBRE & SYLLABES
// ============================================

class RenderEngine {
  constructor() {
    this.container = document.getElementById("text-content");
  }

  render(text, options = {}) {
    const startTime = performance.now();

    const { zebra = false, syllables = false } = options;

    // Préparer le contenu
    const allParagraphs = text.split("\n").filter((p) => p.trim() !== "");

    // Pagination : max 50 paragraphes par page pour limiter le DOM
    const PAGE_SIZE = 50;
    this._allParagraphs = allParagraphs;
    this._renderOptions = options;
    this._currentPage = 0;
    this._totalPages = Math.ceil(allParagraphs.length / PAGE_SIZE);

    const paragraphs = allParagraphs.slice(0, PAGE_SIZE);

    const html = this._renderParagraphs(paragraphs, 0, syllables);

    // Ajouter navigation si nécessaire
    let paginationHtml = "";
    if (this._totalPages > 1) {
      paginationHtml = `<nav class="text-pagination" aria-label="Navigation du texte">
        <span>Page 1 / ${this._totalPages}</span>
        <button id="text-page-next" class="btn btn-secondary" style="padding: var(--space-sm) var(--space-md); min-height: 44px;">Page suivante</button>
      </nav>`;
    }

    this.container.innerHTML = html + paginationHtml;

    // Brancher le bouton de pagination
    if (this._totalPages > 1) {
      this._bindPagination(zebra, syllables);
    }

    // Mode zèbre
    this.container.classList.toggle("zebra-mode", zebra);

    const elapsed = performance.now() - startTime;
    if (elapsed > CONFIG.PERFORMANCE_THRESHOLD) {
      console.warn(`Performance: Render took ${elapsed.toFixed(2)}ms`);
    }
  }

  _renderParagraphs(paragraphs, startIndex, syllables) {
    return paragraphs
      .map((paragraph, i) => {
        const pIndex = startIndex + i;
        const words = paragraph.split(/(\s+)/);
        const renderedWords = words
          .map((word, wIndex) => {
            if (/\S/.test(word)) {
              const content = syllables
                ? this.syllabify(word)
                : escapeHtml(word);
              return `<span id="w-${pIndex}-${wIndex}" class="word-span">${content}</span>`;
            }
            return escapeHtml(word);
          })
          .join("");
        return `<p>${renderedWords}</p>`;
      })
      .join("");
  }

  _bindPagination(zebra, syllables) {
    const PAGE_SIZE = 50;
    const nextBtn = document.getElementById("text-page-next");
    const prevBtn = document.getElementById("text-page-prev");

    const updatePage = () => {
      const start = this._currentPage * PAGE_SIZE;
      const paragraphs = this._allParagraphs.slice(start, start + PAGE_SIZE);
      const html = this._renderParagraphs(paragraphs, start, syllables);

      let navHtml = `<nav class="text-pagination" aria-label="Navigation du texte">`;
      if (this._currentPage > 0) {
        navHtml += `<button id="text-page-prev" class="btn btn-secondary" style="padding: var(--space-sm) var(--space-md); min-height: 44px;">Page précédente</button>`;
      }
      navHtml += `<span>Page ${this._currentPage + 1} / ${this._totalPages}</span>`;
      if (this._currentPage < this._totalPages - 1) {
        navHtml += `<button id="text-page-next" class="btn btn-secondary" style="padding: var(--space-sm) var(--space-md); min-height: 44px;">Page suivante</button>`;
      }
      navHtml += `</nav>`;

      this.container.innerHTML = html + navHtml;
      this.container.classList.toggle("zebra-mode", zebra);
      this.container.scrollTop = 0;
      this._bindPagination(zebra, syllables);
    };

    if (nextBtn) {
      nextBtn.addEventListener("click", () => {
        if (this._currentPage < this._totalPages - 1) {
          this._currentPage++;
          updatePage();
        }
      });
    }
    if (prevBtn) {
      prevBtn.addEventListener("click", () => {
        if (this._currentPage > 0) {
          this._currentPage--;
          updatePage();
        }
      });
    }
  }

  syllabify(word) {
    if (state.currentLang === "ar") return word;
    if (word.length <= 3) return word;

    // Pattern V-C-V simplifié pour le français
    const vowels = "aeiouyàâéèêëîïôûù";
    const pattern = `[^${vowels}]*[${vowels}]+(?:[^${vowels}](?![${vowels}]))?`;

    const syllables = word.match(new RegExp(pattern, "gi"));

    if (!syllables) return word;

    return syllables
      .map((syl, i) => {
        const className = i % 2 === 0 ? "syllable-s1" : "syllable-s2";
        return `<span class="${className}">${escapeHtml(syl)}</span>`;
      })
      .join("");
  }

  highlightWord(charIndex) {
    // Retirer le highlight précédent
    clearSpeakingHighlight();

    // Trouver le mot à highlight
    const spans = this.container.querySelectorAll(".word-span");
    let currentIndex = 0;

    for (const span of spans) {
      const text = span.textContent;
      const start = currentIndex;
      const end = currentIndex + text.length;

      if (charIndex >= start && charIndex < end) {
        span.classList.add("speaking-word");
        span.scrollIntoView({ behavior: "smooth", block: "center" });

        // Sync Focus Mask
        focusMask.syncWithTTS(span);
        break;
      }

      currentIndex = end;
    }
  }

  clear() {
    this.container.innerHTML = `
            <div class="empty-state">
                <svg class="icon-huge" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                    <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
                    <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
                </svg>
                <p>${i18n[state.currentLang]["placeholder.textInput"]}</p>
            </div>
        `;
  }
}

const renderEngine = new RenderEngine();

// ============================================
// 11. FONCTIONS UTILITAIRES
// ============================================

function showLoader(show, text = "") {
  const loader = document.getElementById("loader");
  const loaderText = document.getElementById("loader-text");

  if (show) {
    loader.classList.remove("hidden");
    loaderText.textContent = text;
  } else {
    loader.classList.add("hidden");
  }
}

function updateLoaderProgress(progress) {
  const progressBar = document.getElementById("loader-progress");
  if (progressBar) {
    progressBar.style.width = progress + "%";
    progressBar.setAttribute("aria-valuenow", progress);
  }
}

/**
 * Afficher résultats OCR avec score de confiance
 */
function displayOCRResults(text, confidence, validation = null) {
  const modal = document.getElementById("ocr-results-modal");
  if (!modal) {
    console.warn("OCR results modal not found");
    return;
  }

  // Stocker le texte pour export
  state.ocrState.recognizedText = text;
  state.ocrState.confidence = confidence;

  // Résultat principal
  document.getElementById("ocr-result-text").value = text;

  // Score de confiance
  const confBar = document.getElementById("ocr-confidence-bar");
  const confText = document.getElementById("ocr-confidence-text");
  if (confBar) {
    confBar.style.width = confidence + "%";
    confBar.className =
      "ocr-confidence-bar " +
      (confidence >= 80 ? "high" : confidence >= 60 ? "medium" : "low");
  }
  if (confText) {
    confText.textContent = Math.round(confidence) + "%";
  }

  // Afficher problèmes si present
  const issuesContainer = document.getElementById("ocr-issues");
  if (validation && validation.issues.length > 0) {
    issuesContainer.innerHTML =
      "<h4>⚠️ Mots détectés comme suspects:</h4>" +
      validation.issues
        .map((issue) => {
          const suggestions = issue.suggestions
            .map((s) => escapeHtml(s.word))
            .join(", ");
          return `
                    <div class="ocr-issue">
                        <span class="ocr-issue-word">"${escapeHtml(issue.original)}"</span>
                        ${suggestions ? `<span class="ocr-suggestion">Suggestions: ${suggestions}</span>` : ""}
                    </div>
                `;
        })
        .join("");
    issuesContainer.hidden = false;
  } else {
    issuesContainer.hidden = true;
  }

  // Afficher modal
  modal.hidden = false;
  modal.setAttribute("aria-modal", "true");
}

/**
 * Exporter le texte OCR en PDF
 */
function exportToPDF() {
  const text =
    state.ocrState.recognizedText ||
    document.getElementById("ocr-result-text").value;
  if (!text) {
    showToast("Aucun texte à exporter", "warning");
    return;
  }

  try {
    // Créer un canvas pour simuler l'apparence
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = 800;
    canvas.height = 600;

    // Fond blanc
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Titre
    ctx.fillStyle = "#2563eb";
    ctx.font = "bold 24px Arial";
    ctx.fillText("Texte reconnu par OCR", 40, 50);

    // Confiance
    ctx.fillStyle = "#666";
    ctx.font = "14px Arial";
    ctx.fillText(
      `Confiance: ${Math.round(state.ocrState.confidence || 0)}%`,
      40,
      80,
    );

    // Texte
    ctx.fillStyle = "#000";
    ctx.font = "14px Arial";
    const lines = text.split("\n");
    let y = 120;
    lines.forEach((line) => {
      if (y < canvas.height - 40) {
        ctx.fillText(line.substring(0, 80), 40, y);
        y += 20;
      }
    });

    // Convertir en image et télécharger
    canvas.toBlob((blob) => {
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `ocr_result_${new Date().getTime()}.png`;
      link.click();
      URL.revokeObjectURL(url);
      showToast("Image exportée avec succès", "success");
    });
  } catch (error) {
    console.error("Erreur export PDF:", error);
    showToast("Erreur lors de l'export", "error");
  }
}

/**
 * Partager le texte OCR reconnu
 */
function shareResults() {
  const text =
    state.ocrState.recognizedText ||
    document.getElementById("ocr-result-text").value;
  if (!text) {
    showToast("Aucun texte à partager", "warning");
    return;
  }

  // Vérifier Web Share API
  if (navigator.share) {
    navigator
      .share({
        title: "Texte reconnu par Dys-Play",
        text: text.substring(0, 500) + (text.length > 500 ? "..." : ""),
      })
      .then(() => {
        showToast("Texte partagé avec succès", "success");
      })
      .catch((error) => {
        console.log("Partage annulé:", error);
      });
  } else {
    // Fallback: copier en presse-papiers
    navigator.clipboard
      .writeText(text)
      .then(() => {
        showToast("Texte copié en presse-papiers", "success");
      })
      .catch((error) => {
        console.error("Erreur copie:", error);
        showToast("Erreur lors de la copie", "error");
      });
  }
}

/**
 * Initialiser sélection de zone pour une image
 */
function initZoneSelector(imageElement) {
  if (!imageElement) return;

  const container = imageElement.parentElement;

  // Créer le sélecteur de zone
  state.ocrState.zoneSelector = new ZoneSelector(imageElement, container);

  // Bouton "Image entière" (reset la sélection)
  document.getElementById("preset-full")?.addEventListener("click", () => {
    state.ocrState.zoneSelector.reset();
  });
}

/**
 * Extraire zone et lancer OCR
 */
async function extractAndOCR() {
  if (!state.ocrState.zoneSelector) {
    showToast("Pas de zone sélectionnée", "error");
    return;
  }

  try {
    // Extraire la zone
    const zoneImage = state.ocrState.zoneSelector.extractZoneImage();
    state.ocrState.selectedZone = state.ocrState.zoneSelector.getSelectedZone();

    // Converter dataUrl en Blob pour Tesseract
    const blob = await (await fetch(zoneImage)).blob();
    const file = new File([blob], "zone.png", { type: "image/png" });

    // OCR sur la zone
    const result = await ocr.recognizeZone(zoneImage);
    return result;
  } catch (error) {
    console.error("Erreur extraction zone:", error);
    showToast("Erreur lors de l'extraction", "error");
  }
}

/**
 * Fermer modal résultats OCR et appliquer texte
 */
function applyOCRResults() {
  const text = document.getElementById("ocr-result-text").value;
  if (text.trim()) {
    state.textContent = text;
    renderEngine.render(text, {
      zebra: state.settings.zebraMode,
      syllables: state.settings.syllableColor,
    });
    updatePlayButton();
    closeOCRResultsModal();
    // Sauvegarder automatiquement en bibliothèque
    libraryManager.saveCurrentDocument();
  }
}

/**
 * Fermer modal résultats
 */
function closeOCRResultsModal() {
  const modal = document.getElementById("ocr-results-modal");
  if (modal) {
    modal.hidden = true;
    modal.removeAttribute("aria-modal");
  }
}

/**
 * Afficher modal sélection zone
 */
function openZoneSelectorModal(imageElement) {
  const modal = document.getElementById("zone-selector-modal");
  if (modal) {
    modal.hidden = false;
    modal.setAttribute("aria-modal", "true");
    initZoneSelector(imageElement);
  }
}

/**
 * Afficher modal paramètres OCR avancés
 */
function openOCRSettingsModal() {
  const modal = document.getElementById("ocr-settings-modal");
  if (modal) {
    modal.hidden = false;
    modal.setAttribute("aria-modal", "true");

    // Synchroniser les paramètres
    document.getElementById("ocr-contrast-toggle").checked =
      CONFIG.OCR.PREPROCESSOR_OPTIONS.improveContrast;
    document.getElementById("ocr-denoise-toggle").checked =
      CONFIG.OCR.PREPROCESSOR_OPTIONS.denoise;
    document.getElementById("ocr-binarize-toggle").checked =
      CONFIG.OCR.PREPROCESSOR_OPTIONS.binarize;
    document.getElementById("ocr-orientation-toggle").checked =
      CONFIG.OCR.PREPROCESSOR_OPTIONS.detectOrientation;
    document.getElementById("ocr-validation-toggle").checked =
      CONFIG.OCR.ENABLE_VALIDATION;
    document.getElementById("ocr-auto-correct-toggle").checked =
      CONFIG.OCR.AUTO_CORRECT;
    document.getElementById("ocr-confidence-threshold").value =
      CONFIG.OCR.CONFIDENCE_THRESHOLD * 100;
  }
}

/**
 * Sauvegarder paramètres OCR avancés
 */
function saveOCRSettings() {
  CONFIG.OCR.PREPROCESSOR_OPTIONS.improveContrast = document.getElementById(
    "ocr-contrast-toggle",
  ).checked;
  CONFIG.OCR.PREPROCESSOR_OPTIONS.denoise =
    document.getElementById("ocr-denoise-toggle").checked;
  CONFIG.OCR.PREPROCESSOR_OPTIONS.binarize = document.getElementById(
    "ocr-binarize-toggle",
  ).checked;
  CONFIG.OCR.PREPROCESSOR_OPTIONS.detectOrientation = document.getElementById(
    "ocr-orientation-toggle",
  ).checked;
  CONFIG.OCR.ENABLE_VALIDATION = document.getElementById(
    "ocr-validation-toggle",
  ).checked;
  CONFIG.OCR.AUTO_CORRECT = document.getElementById(
    "ocr-auto-correct-toggle",
  ).checked;
  CONFIG.OCR.CONFIDENCE_THRESHOLD =
    document.getElementById("ocr-confidence-threshold").value / 100;

  Storage.set("ocrSettings", CONFIG.OCR);
  showToast("Paramètres OCR sauvegardés", "success");
  closeOCRSettingsModal();
}

function closeOCRSettingsModal() {
  const modal = document.getElementById("ocr-settings-modal");
  if (modal) {
    modal.hidden = true;
    modal.removeAttribute("aria-modal");
  }
}

function closeZoneSelectorModal() {
  const modal = document.getElementById("zone-selector-modal");
  if (modal) {
    modal.hidden = true;
    modal.removeAttribute("aria-modal");
  }
}

function updatePlayButton() {
  const btn = document.getElementById("play-pause-btn");
  const playIcon = document.getElementById("play-icon");
  const pauseIcon = document.getElementById("pause-icon");

  btn.disabled = !state.textContent;

  if (state.isPlaying) {
    playIcon.classList.add("hidden");
    pauseIcon.classList.remove("hidden");
  } else {
    playIcon.classList.remove("hidden");
    pauseIcon.classList.add("hidden");
  }
}

function clearSpeakingHighlight() {
  document.querySelectorAll(".speaking-word").forEach((el) => {
    el.classList.remove("speaking-word");
  });
}

function updateStatus() {
  const statusEl = document.getElementById("connection-status");
  if (!statusEl) return;
  const statusText = statusEl.querySelector(".status-text");
  const statusDot = statusEl.querySelector(".status-dot");

  if (state.isOnline) {
    statusEl.classList.remove("offline");
    statusEl.classList.add("online");
    if (statusText)
      statusText.textContent = i18n[state.currentLang]["status.online"];
  } else {
    statusEl.classList.remove("online");
    statusEl.classList.add("offline");
    if (statusText)
      statusText.textContent = i18n[state.currentLang]["status.offline"];
  }
}

function showToast(message, type = "info") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.setAttribute("role", "alert");
  toast.setAttribute("aria-live", "assertive");
  toast.textContent = message;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ============================================
// 12. GESTION DES DRAWERS
// ============================================

class DrawerManager {
  constructor() {
    this.activeDrawer = null;
    this.overlay = document.getElementById("drawer-overlay");
  }

  open(drawerId) {
    const drawer = document.getElementById(drawerId);
    if (!drawer) return;

    this.close();

    drawer.classList.add("open");
    drawer.hidden = false;
    this.activeDrawer = drawerId;

    const trigger = document.querySelector(`[aria-controls="${drawerId}"]`);
    if (trigger) trigger.setAttribute("aria-expanded", "true");

    if (this.overlay) {
      this.overlay.classList.add("visible");
      this.overlay.hidden = false;
    }

    trapFocus(drawer);
    setInert(true, drawer);

    const closeBtn = drawer.querySelector(".btn-close");
    if (closeBtn) closeBtn.focus();
  }

  close() {
    if (!this.activeDrawer) return;

    const closingDrawerId = this.activeDrawer;
    const drawer = document.getElementById(closingDrawerId);
    if (drawer) {
      drawer.classList.remove("open");
      setTimeout(() => {
        drawer.hidden = true;
      }, 300);
      releaseFocusTrap(drawer);
    }

    if (this.overlay) {
      this.overlay.classList.remove("visible");
      this.overlay.hidden = true;
    }
    this.activeDrawer = null;
    setInert(false);

    const trigger = document.querySelector(
      `[aria-controls="${closingDrawerId}"]`,
    );
    if (trigger) {
      trigger.setAttribute("aria-expanded", "false");
      trigger.focus();
    }
  }

  toggle(drawerId) {
    if (this.activeDrawer === drawerId) {
      this.close();
    } else {
      this.open(drawerId);
    }
  }
}

// ============================================
// 12b. A11Y — Piège de focus et inert background
// ============================================

const FOCUSABLE_SEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

function trapFocus(container) {
  if (!container) return;
  const handler = (e) => {
    if (e.key !== "Tab") return;
    const focusables = Array.from(
      container.querySelectorAll(FOCUSABLE_SEL),
    ).filter((el) => !el.hidden && el.offsetParent !== null);
    if (focusables.length === 0) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };
  container.addEventListener("keydown", handler);
  container.__focusTrapHandler = handler;
}

function releaseFocusTrap(container) {
  if (!container || !container.__focusTrapHandler) return;
  container.removeEventListener("keydown", container.__focusTrapHandler);
  delete container.__focusTrapHandler;
}

function setInert(state, exceptNode) {
  const root = document.body;
  const directChildren = Array.from(root.children);
  directChildren.forEach((node) => {
    if (node === exceptNode) return;
    if (node.id === "drawer-overlay") return;
    if (state) {
      if (!node.hasAttribute("inert")) {
        node.setAttribute("inert", "");
        node.dataset.inertSetByApp = "true";
      }
    } else if (node.dataset.inertSetByApp) {
      node.removeAttribute("inert");
      delete node.dataset.inertSetByApp;
    }
  });
}

const drawers = new DrawerManager();

// ============================================
// 13. GESTION DE LA BIBLIOTHÈQUE
// ============================================

class LibraryManager {
  async refresh() {
    try {
      const documents = await db.getAllDocuments();
      state.library = Array.isArray(documents) ? documents.reverse() : [];
    } catch (e) {
      state.library = [];
    }
    updateLibraryCount();
    renderLibrary();
  }

  async saveCurrentDocument() {
    if (!state.textContent.trim()) {
      showToast(i18n[state.currentLang]["msg.error"], "error");
      return;
    }

    showToast(i18n[state.currentLang]["msg.saving"], "info");

    try {
      await db.addDocument(state.textContent, state.currentLang);
      await this.refresh();
      showToast(i18n[state.currentLang]["msg.saved"], "success");
    } catch (error) {
      console.error("Erreur sauvegarde:", error);
      showToast(i18n[state.currentLang]["msg.error"], "error");
    }
  }

  async loadDocument(id) {
    try {
      const doc = await db.getDocument(id);
      if (doc) {
        state.textContent = doc.text;
        state.currentLang = doc.lang;
        document.getElementById("lang-select").value = doc.lang;
        renderEngine.render(state.textContent, {
          zebra: state.settings.zebraMode,
          syllables: state.settings.syllableColor,
        });
        updatePlayButton();
        drawers.close();
      }
    } catch (error) {
      console.error("Erreur chargement document:", error);
      showToast(i18n[state.currentLang]["msg.error"], "error");
    }
  }

  async deleteDocument(id) {
    try {
      await db.deleteDocument(id);
      await this.refresh();
      showToast(i18n[state.currentLang]["msg.saved"], "success");
    } catch (error) {
      console.error("Erreur suppression:", error);
      showToast(i18n[state.currentLang]["msg.error"], "error");
    }
  }

  async clearAll() {
    try {
      await db.clearLibrary();
      await this.refresh();
      showToast(i18n[state.currentLang]["msg.saved"], "success");
    } catch (error) {
      console.error("Erreur clear:", error);
      showToast(i18n[state.currentLang]["msg.error"], "error");
    }
  }
}

const libraryManager = new LibraryManager();

function updateLibraryCount() {
  const badge = document.getElementById("library-count");
  if (!badge) return;
  const count = state.library.length;
  badge.textContent = count;
  badge.hidden = count === 0;
  badge.setAttribute(
    "aria-label",
    count === 0
      ? "Bibliothèque vide"
      : `${count} document${count > 1 ? "s" : ""} en bibliothèque`,
  );
  const libBtn = document.getElementById("library-btn");
  if (libBtn) {
    libBtn.setAttribute(
      "aria-label",
      count === 0
        ? "Ouvrir ma bibliothèque (vide)"
        : `Ouvrir ma bibliothèque (${count} document${count > 1 ? "s" : ""})`,
    );
  }
}

function renderLibrary() {
  const list = document.getElementById("library-list");
  const empty = document.getElementById("library-empty");

  if (state.library.length === 0) {
    list.innerHTML = "";
    empty.hidden = false;
    return;
  }

  empty.hidden = true;

  list.innerHTML = state.library
    .map(
      (doc) => `
        <div class="library-item" tabindex="0" role="button" aria-label="Ouvrir ${escapeHtml(doc.text.substring(0, 50))}..." data-id="${escapeHtml(String(doc.id))}">
            <div class="library-item-title">${escapeHtml(doc.text.substring(0, 100))}${doc.text.length > 100 ? "..." : ""}</div>
            <div class="library-item-date">${new Date(doc.date).toLocaleDateString()} • ${escapeHtml(doc.lang.toUpperCase())}</div>
        </div>
    `,
    )
    .join("");
}

// ============================================
// 13b. MODALE D'ACQUISITION (Scanner / Importer)
// ============================================

function openImportModal() {
  const modal = document.getElementById("import-modal");
  if (!modal) return;
  modal.hidden = false;
  modal.setAttribute("aria-modal", "true");
  trapFocus(modal);
  setInert(true, modal);
  const firstOption = modal.querySelector(".import-option");
  if (firstOption) firstOption.focus();
}

function closeImportModal() {
  const modal = document.getElementById("import-modal");
  if (!modal) return;
  modal.hidden = true;
  modal.removeAttribute("aria-modal");
  releaseFocusTrap(modal);
  setInert(false);
  const trigger = document.getElementById("acquire-btn");
  if (trigger) trigger.focus();
}

function emptyNode(node) {
  while (node.firstChild) node.removeChild(node.firstChild);
}

async function processAcquiredFile(file) {
  if (!file) return;

  if (file.type.startsWith("image/")) {
    const tempImg = document.createElement("img");
    tempImg.onload = () => {
      const zoneContent = document.getElementById("zone-selector-content");
      if (zoneContent) {
        emptyNode(zoneContent);
        tempImg.style.display = "none";
        zoneContent.appendChild(tempImg);
      }

      const analyzeBtn = document.getElementById("analyze-zone-btn");
      if (analyzeBtn) {
        analyzeBtn.onclick = async () => {
          closeZoneSelectorModal();
          if (state.ocrState.zoneSelector) {
            const zoneDataUrl = state.ocrState.zoneSelector.extractZoneImage();
            const blob = await (await fetch(zoneDataUrl)).blob();
            const zoneFile = new File([blob], "zone.png", {
              type: "image/png",
            });
            await handleFile(zoneFile);
          } else {
            await handleFile(file);
          }
        };
      }

      // openZoneSelectorModal appelle initZoneSelector en interne :
      // ne pas l'appeler ici sous peine de créer 2 canvas (image doublée).
      openZoneSelectorModal(tempImg);
    };
    tempImg.src = URL.createObjectURL(file);
  } else {
    await handleFile(file);
  }
}

async function pasteTextFromClipboard() {
  let text = "";
  try {
    if (navigator.clipboard && navigator.clipboard.readText) {
      text = await navigator.clipboard.readText();
    }
  } catch (err) {
    // Permission refusée ou API indisponible → fallback prompt
  }

  if (!text) {
    text = window.prompt(
      i18n[state.currentLang]?.["import.paste_prompt"] ||
        "Collez votre texte ici (Ctrl+V ou \u2318+V)",
    );
  }

  if (text && text.trim()) {
    state.textContent = text;
    renderEngine.render(text, {
      zebra: state.settings.zebraMode,
      syllables: state.settings.syllableColor,
    });
    updatePlayButton();
    libraryManager.saveCurrentDocument();
    showToast(
      i18n[state.currentLang]?.["msg.text_imported"] || "Texte importé",
      "success",
    );
  }
}

// ============================================
// 14. GESTION DES ÉVÉNEMENTS
// ============================================

function initEventListeners() {
  try {
    // Helper function to safely add event listener
    function safeAddEventListener(id, event, handler) {
      const element = document.getElementById(id);
      if (!element) {
        return;
      }
      element.addEventListener(event, handler);
    }

    // Status online/offline
    window.addEventListener("online", () => {
      state.isOnline = true;
      updateStatus();
    });

    window.addEventListener("offline", () => {
      state.isOnline = false;
      updateStatus();
      showToast(i18n[state.currentLang]["msg.offline"], "info");
    });

    // Menu
    safeAddEventListener("menu-btn", "click", () => {
      drawers.toggle("menu-drawer");
    });

    safeAddEventListener("close-menu", "click", () => {
      drawers.close();
    });

    // Library
    safeAddEventListener("library-btn", "click", () => {
      drawers.toggle("library-drawer");
      libraryManager.refresh();
    });

    safeAddEventListener("close-library", "click", () => {
      drawers.close();
    });

    // Settings
    safeAddEventListener("settings-btn", "click", () => {
      drawers.toggle("settings-drawer");
    });

    safeAddEventListener("close-settings", "click", () => {
      drawers.close();
    });

    // Overlay
    safeAddEventListener("drawer-overlay", "click", () => {
      drawers.close();
    });

    // Menu navigation links - prevent default and close drawer
    document.querySelectorAll(".nav-link").forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const navId = e.currentTarget.id;

        // Handle different navigation actions
        switch (navId) {
          case "nav-home":
            // Already on home, just close drawer
            break;
          case "nav-library":
            drawers.close();
            setTimeout(() => {
              drawers.open("library-drawer");
              libraryManager.refresh();
            }, 300);
            break;
          case "nav-help":
            showToast(
              "Aide: Utilisez les boutons Importer/Scanner pour ajouter du texte, puis Lecture pour écouter",
              "info",
            );
            break;
          case "nav-legal":
            {
              const legalModal = document.getElementById("legal-modal");
              if (legalModal) {
                legalModal.hidden = false;
                legalModal.setAttribute("aria-modal", "true");
                const closeBtn = document.getElementById("close-legal");
                const backdrop = document.getElementById("legal-backdrop");
                const closeFn = () => {
                  legalModal.hidden = true;
                  legalModal.removeAttribute("aria-modal");
                };
                if (closeBtn) closeBtn.onclick = closeFn;
                if (backdrop) backdrop.onclick = closeFn;
              }
            }
            break;
        }
        drawers.close();
      });
    });

    // Bouton unifié "Scanner ou importer" → ouvre la modale d'acquisition
    safeAddEventListener("acquire-btn", "click", () => {
      openImportModal();
    });

    // Fermeture de la modale d'import
    safeAddEventListener("close-import-modal", "click", closeImportModal);
    safeAddEventListener("import-modal-backdrop", "click", closeImportModal);

    // Option « Photographier un texte »
    safeAddEventListener("modal-camera-btn", "click", () => {
      const input = document.getElementById("modal-camera-input");
      if (input) input.click();
    });
    safeAddEventListener("modal-camera-input", "change", async (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      closeImportModal();
      if (file) await processAcquiredFile(file);
    });

    // Option « Choisir un fichier »
    safeAddEventListener("modal-file-btn", "click", () => {
      const input = document.getElementById("modal-file-input");
      if (input) input.click();
    });
    safeAddEventListener("modal-file-input", "change", async (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      closeImportModal();
      if (file) await processAcquiredFile(file);
    });

    // Option « Coller du texte »
    safeAddEventListener("modal-paste-btn", "click", async () => {
      closeImportModal();
      await pasteTextFromClipboard();
    });

    // Compat : ancien input caché éventuellement déclenché ailleurs
    safeAddEventListener("file-input-unified", "change", async (e) => {
      const file = e.target.files[0];
      e.target.value = "";
      if (file) await processAcquiredFile(file);
    });

    // OCR Results Modal
    const ocrResultsModal = document.getElementById("ocr-results-modal");
    if (ocrResultsModal) {
      safeAddEventListener("close-ocr-results", "click", closeOCRResultsModal);
      safeAddEventListener("apply-ocr-btn", "click", applyOCRResults);
      safeAddEventListener("export-pdf-btn", "click", exportToPDF);
      safeAddEventListener("share-results-btn", "click", shareResults);
      safeAddEventListener(
        "ocr-results-backdrop",
        "click",
        closeOCRResultsModal,
      );
    }

    // OCR Settings Modal
    const ocrSettingsModal = document.getElementById("ocr-settings-modal");
    if (ocrSettingsModal) {
      document
        .getElementById("close-ocr-settings")
        .addEventListener("click", closeOCRSettingsModal);
      document
        .getElementById("save-ocr-settings-btn")
        .addEventListener("click", saveOCRSettings);
      document
        .getElementById("ocr-settings-backdrop")
        .addEventListener("click", closeOCRSettingsModal);
      document
        .getElementById("open-ocr-settings-btn")
        .addEventListener("click", openOCRSettingsModal);

      // Update confidence threshold display
      document
        .getElementById("ocr-confidence-threshold")
        .addEventListener("input", (e) => {
          document.getElementById(
            "ocr-confidence-threshold-value",
          ).textContent = e.target.value;
        });
    }

    // Zone Selector Modal
    const zoneSelectorModal = document.getElementById("zone-selector-modal");
    if (zoneSelectorModal) {
      const closeBtn = document.getElementById("close-zone-selector-btn");
      if (closeBtn) {
        closeBtn.addEventListener("click", closeZoneSelectorModal);
      }
      const backdrop = document.getElementById("zone-selector-backdrop");
      if (backdrop) {
        backdrop.addEventListener("click", closeZoneSelectorModal);
      }
    }

    // Text input
    safeAddEventListener("apply-text-btn", "click", () => {
      const input = document.getElementById("text-input");
      if (input.value.trim()) {
        state.textContent = input.value.trim();
        renderEngine.render(state.textContent, {
          zebra: state.settings.zebraMode,
          syllables: state.settings.syllableColor,
        });
        updatePlayButton();
        input.value = "";
      }
    });

    // Play/Pause
    safeAddEventListener("play-pause-btn", "click", () => {
      if (!state.textContent) {
        showToast("Importez ou saisissez un texte d'abord", "info");
        return;
      }

      if (state.isPlaying) {
        tts.pause();
      } else {
        tts.speak(
          state.textContent,
          state.currentLang,
          state.settings.voiceRate,
        );
      }
    });

    // Voice rate
    document.getElementById("voice-rate").addEventListener("input", (e) => {
      const rate = parseFloat(e.target.value);
      document.getElementById("rate-value").textContent = rate.toFixed(1) + "x";
      tts.setRate(rate);
    });

    // Focus toggle
    document.getElementById("focus-toggle").addEventListener("click", (e) => {
      const isActive = focusMask.toggle();
      e.currentTarget.setAttribute("aria-pressed", isActive);
      e.currentTarget.classList.toggle("active", isActive);
      // Afficher/masquer les contrôles de la règle
      document
        .getElementById("ruler-mode-selector")
        .classList.toggle("hidden", !isActive);
      document
        .getElementById("opacity-control")
        .classList.toggle("hidden", !isActive);
    });

    // Sélection du mode règle de lecture
    document.querySelectorAll('input[name="ruler-mode"]').forEach((radio) => {
      radio.addEventListener("change", (e) => {
        state.settings.rulerMode = e.target.value;
        Storage.set("rulerMode", e.target.value);
        document.documentElement.dataset.rulerMode = e.target.value;
        if (state.isFocusMode) {
          focusMask.enable();
        }
      });
    });

    // Opacity control
    document.getElementById("mask-opacity").addEventListener("input", (e) => {
      focusMask.setOpacity(parseFloat(e.target.value));
    });

    // Theme
    document.querySelectorAll(".theme-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        const theme = btn.dataset.theme;
        document.documentElement.dataset.theme = theme;
        document.body.dataset.theme = theme;
        state.settings.theme = theme;
        Storage.set("theme", theme);
      });
    });

    // Language
    document.getElementById("lang-select").addEventListener("change", (e) => {
      state.currentLang = e.target.value;
      document.documentElement.lang = state.currentLang;
      document.body.dir = state.currentLang === "ar" ? "rtl" : "ltr";
      Storage.set("lang", state.currentLang);
    });

    // Typography settings
    document.getElementById("font-select").addEventListener("change", (e) => {
      typography.setFont(e.target.value);
    });

    document.getElementById("font-size").addEventListener("input", (e) => {
      const size = parseInt(e.target.value);
      document.getElementById("font-size-value").textContent = size;
      typography.setFontSize(size);
    });

    document.getElementById("letter-spacing").addEventListener("input", (e) => {
      const spacing = parseFloat(e.target.value);
      document.getElementById("letter-spacing-value").textContent =
        spacing.toFixed(2);
      typography.setLetterSpacing(spacing);
    });

    document.getElementById("word-spacing").addEventListener("input", (e) => {
      const spacing = parseFloat(e.target.value);
      document.getElementById("word-spacing-value").textContent =
        spacing.toFixed(2);
      typography.setWordSpacing(spacing);
    });

    document.getElementById("line-height").addEventListener("input", (e) => {
      const height = parseFloat(e.target.value);
      document.getElementById("line-height-value").textContent =
        height.toFixed(1);
      typography.setLineHeight(height);
    });

    // Zebra mode
    document.getElementById("zebra-mode").addEventListener("change", (e) => {
      state.settings.zebraMode = e.target.checked;
      Storage.set("zebraMode", state.settings.zebraMode);
      if (state.textContent) {
        renderEngine.render(state.textContent, {
          zebra: state.settings.zebraMode,
          syllables: state.settings.syllableColor,
        });
      }
    });

    // Syllable color
    document
      .getElementById("syllable-color")
      .addEventListener("change", (e) => {
        state.settings.syllableColor = e.target.checked;
        Storage.set("syllableColor", state.settings.syllableColor);
        if (state.textContent) {
          renderEngine.render(state.textContent, {
            zebra: state.settings.zebraMode,
            syllables: state.settings.syllableColor,
          });
        }
      });

    // Mode calme (faible stimulation)
    document
      .getElementById("reduced-motion")
      .addEventListener("change", (e) => {
        state.settings.reducedMotion = e.target.checked;
        Storage.set("reducedMotion", state.settings.reducedMotion);
        if (e.target.checked) {
          document.documentElement.dataset.reducedMotion = "";
        } else {
          delete document.documentElement.dataset.reducedMotion;
        }
      });

    // Overlay couleur Irlen
    document.querySelectorAll(".overlay-color-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        document
          .querySelectorAll(".overlay-color-btn")
          .forEach((b) => b.classList.remove("active"));
        const color = btn.dataset.color;
        if (color) {
          btn.classList.add("active");
          colorOverlay.setColor(color);
        } else {
          btn.classList.add("active");
          colorOverlay.setColor(null);
        }
      });
    });

    document
      .getElementById("overlay-opacity")
      .addEventListener("input", (e) => {
        const opacity = parseFloat(e.target.value);
        document.getElementById("overlay-opacity-value").textContent =
          opacity.toFixed(2);
        colorOverlay.setOpacity(opacity);
      });

    // Save library
    document
      .getElementById("save-library-btn")
      .addEventListener("click", () => {
        libraryManager.saveCurrentDocument();
      });

    // Reset
    document.getElementById("reset-btn").addEventListener("click", async () => {
      if (confirm("Êtes-vous sûr de vouloir supprimer toutes vos données?")) {
        Storage.clear();
        await db.clearLibrary();
        location.reload();
      }
    });

    // Library item click
    document.getElementById("library-list").addEventListener("click", (e) => {
      const item = e.target.closest(".library-item");
      if (item) {
        const id = parseInt(item.dataset.id);
        libraryManager.loadDocument(id);
      }
    });

    // Focus mask mouse/touch tracking
    const readerArea = document.getElementById("reader-area");

    readerArea.addEventListener("mousemove", (e) => {
      if (state.isFocusMode) {
        focusMask.setPosition(e.clientY, e.clientX);
      }
    });

    readerArea.addEventListener(
      "touchmove",
      (e) => {
        if (state.isFocusMode && e.touches.length > 0) {
          e.preventDefault();
          focusMask.setPosition(e.touches[0].clientY, e.touches[0].clientX);
        }
      },
      { passive: false },
    );

    // Keyboard navigation (Echap pour fermer)
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        const importModal = document.getElementById("import-modal");
        if (importModal && !importModal.hidden) {
          closeImportModal();
          return;
        }
        drawers.close();
      }

      // Espace pour play/pause (hors champs de saisie)
      if (
        e.key === " " &&
        !["TEXTAREA", "INPUT", "SELECT"].includes(e.target.tagName) &&
        state.textContent
      ) {
        e.preventDefault();
        document.getElementById("play-pause-btn").click();
      }

      // Raccourcis clavier avec Ctrl/Cmd
      if (e.ctrlKey || e.metaKey) {
        switch (e.key) {
          case "p":
            e.preventDefault();
            document.getElementById("play-pause-btn").click();
            break;
          case "f":
            e.preventDefault();
            document.getElementById("focus-toggle").click();
            break;
          case "s":
            e.preventDefault();
            libraryManager.saveCurrentDocument();
            break;
        }
      }
    });

    // Onboarding event listeners
    const completeBtn = document.getElementById("complete-onboarding-btn");
    if (completeBtn) {
      completeBtn.addEventListener("click", completeOnboarding);
    }

    const skipBtn = document.getElementById("skip-onboarding-btn");
    if (skipBtn) {
      skipBtn.addEventListener("click", () => {
        completeOnboarding();
      });
    }

    // Theme selection in onboarding
    const themeBtns = document.querySelectorAll(".onboarding-theme-btn");
    themeBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        // Retirer la sélection précédente
        themeBtns.forEach((b) => {
          b.dataset.selected = "false";
          b.style.borderColor = "var(--color-border)";
          b.style.borderWidth = "2px";
        });
        // Ajouter la sélection nouvelle
        btn.dataset.selected = "true";
        btn.style.borderColor = "var(--color-primary)";
        btn.style.borderWidth = "2px";
      });
    });

    // Language selection in onboarding
    const langBtns = document.querySelectorAll(".onboarding-lang-btn");
    langBtns.forEach((btn) => {
      btn.addEventListener("click", () => {
        const lang = btn.dataset.lang;
        if (lang) {
          // Retirer la sélection précédente
          langBtns.forEach((b) => {
            b.dataset.selected = "false";
            b.style.borderColor = "var(--color-border)";
          });
          // Ajouter la sélection nouvelle
          btn.dataset.selected = "true";
          btn.style.borderColor = "var(--color-primary)";
          btn.style.borderWidth = "2px";
          // Appliquer la langue
          applyLanguage(lang);
        }
      });
    });

    // Onboarding page navigation (prev/next)
    function showOnboardingPage(pageNum) {
      for (let i = 1; i <= 3; i++) {
        const page = document.getElementById("onboarding-page-" + i);
        if (page) page.hidden = i !== pageNum;
      }
    }
    safeAddEventListener("onboarding-page-1-next", "click", () =>
      showOnboardingPage(2),
    );
    safeAddEventListener("onboarding-page-2-prev", "click", () =>
      showOnboardingPage(1),
    );
    safeAddEventListener("onboarding-page-2-next", "click", () =>
      showOnboardingPage(3),
    );
    safeAddEventListener("onboarding-page-3-prev", "click", () =>
      showOnboardingPage(2),
    );
    safeAddEventListener("onboarding-page-3-complete", "click", () =>
      completeOnboarding(),
    );

    // Onboarding presets (page 3)
    const PRESETS = {
      compact: {
        fontSize: 16,
        letterSpacing: 0.05,
        lineHeight: 1.5,
        wordSpacing: 0.15,
      },
      aere: {
        fontSize: 20,
        letterSpacing: 0.12,
        lineHeight: 1.8,
        wordSpacing: 0.25,
      },
      "tres-aere": {
        fontSize: 24,
        letterSpacing: 0.2,
        lineHeight: 2.2,
        wordSpacing: 0.4,
      },
    };
    document.querySelectorAll(".onboarding-preset-btn").forEach((btn) => {
      btn.addEventListener("click", () => {
        // Retirer sélection précédente
        document.querySelectorAll(".onboarding-preset-btn").forEach((b) => {
          b.style.borderColor = "var(--color-border)";
        });
        btn.style.borderColor = "var(--color-primary)";
        btn.style.borderWidth = "3px";
        // Appliquer le preset
        const preset = PRESETS[btn.dataset.preset];
        if (preset) {
          state.settings.fontSize = preset.fontSize;
          state.settings.letterSpacing = preset.letterSpacing;
          state.settings.wordSpacing = preset.wordSpacing;
          state.settings.lineHeight = preset.lineHeight;
          Storage.set("fontSize", preset.fontSize);
          Storage.set("letterSpacing", preset.letterSpacing);
          Storage.set("wordSpacing", preset.wordSpacing);
          Storage.set("lineHeight", preset.lineHeight);
          typography.applySettings(state.settings);
        }
      });
    });
  } catch (error) {}
}

// ============================================
// 15. EXTRACTION PDF (PDF.js)
// ============================================

/**
 * Extraire le texte d'un fichier PDF via PDF.js
 * Fallback OCR si le PDF est un scan (texte vide)
 */
async function extractTextFromPDF(file) {
  // Configurer le worker PDF.js en local
  pdfjsLib.GlobalWorkerOptions.workerSrc = "libs/pdf.worker.min.js";

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;
  const textParts = [];

  for (let i = 1; i <= totalPages; i++) {
    showLoader(true, `Extraction page ${i}/${totalPages}...`);
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    const pageText = content.items.map((item) => item.str).join(" ");
    if (pageText.trim()) {
      textParts.push(pageText);
    }
  }

  const extractedText = textParts.join("\n\n");

  // Si très peu de texte extrait, c'est probablement un PDF scanné
  if (extractedText.trim().length < 20 && totalPages > 0) {
    showToast("PDF scanné détecté, lancement OCR...", "info");
    // Rendre la première page en image et lancer l'OCR
    const page = await pdf.getPage(1);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext("2d");
    await page.render({ canvasContext: ctx, viewport }).promise;

    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    const imageFile = new File([blob], "pdf-page-1.png", {
      type: "image/png",
    });
    const result = await ocr.recognize(imageFile, {
      enablePreprocessing: CONFIG.OCR.ENABLE_PREPROCESSING,
      enableValidation: CONFIG.OCR.ENABLE_VALIDATION,
    });
    return result.text;
  }

  return extractedText;
}

// ============================================
// 16. GESTION DES FICHIERS
// ============================================

async function handleFile(file, useZoneSelection = false) {
  const MAX_FILE_BYTES = 20 * 1024 * 1024;
  if (file.size > MAX_FILE_BYTES) {
    showToast(
      "Fichier trop volumineux (maximum 20 Mo). Essayez avec un document plus petit.",
      "error",
    );
    return;
  }
  const lowerName = (file.name || "").toLowerCase();
  if (file.type === "image/svg+xml" || lowerName.endsWith(".svg")) {
    showToast(
      "Format SVG non supporté pour des raisons de sécurité. Utilisez JPG, PNG ou PDF.",
      "warning",
    );
    return;
  }

  showLoader(true, "Traitement du fichier...");

  try {
    let text = "";

    if (file.type === "text/plain" || file.name.endsWith(".txt")) {
      // Fichier texte brut
      text = await file.text();
    } else if (file.type === "application/pdf") {
      // PDF - extraction via PDF.js si disponible
      if (typeof pdfjsLib !== "undefined") {
        text = await extractTextFromPDF(file);
      } else {
        showToast("Import PDF non disponible (PDF.js requis)", "warning");
        return;
      }
    } else if (file.type.startsWith("image/")) {
      // Image - OCR avec Tesseract + amélioration
      const result = await ocr.recognize(file, {
        enablePreprocessing: CONFIG.OCR.ENABLE_PREPROCESSING,
        enableValidation: CONFIG.OCR.ENABLE_VALIDATION,
      });
      text = result.text;
    } else {
      showToast("Type de fichier non supporté", "warning");
      return;
    }

    if (text.trim()) {
      state.textContent = text;
      renderEngine.render(text, {
        zebra: state.settings.zebraMode,
        syllables: state.settings.syllableColor,
      });
      updatePlayButton();
      // Sauvegarder automatiquement en bibliothèque
      libraryManager.saveCurrentDocument();
    }
  } catch (error) {
    console.error("Erreur traitement fichier:", error);
    const msg = error.message || "";
    if (msg.includes("load language")) {
      showToast(
        "Le moteur de reconnaissance n'a pas pu se charger. Vérifiez votre connexion.",
        "error",
      );
    } else if (msg.includes("recognize") || msg.includes("OCR")) {
      showToast(
        "Le texte n'a pas pu être lu. Essayez avec une image plus nette ou mieux éclairée.",
        "error",
      );
    } else {
      showToast(
        "Une erreur est survenue lors du traitement du fichier.",
        "error",
      );
    }
  } finally {
    showLoader(false);
  }
}

// ============================================
// 16. CHARGEMENT DES PARAMÈTRES
// ============================================

async function loadSettings() {
  // Vérifier si URL contient resetOnboarding
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.has("resetOnboarding")) {
    Storage.set("isFirstTime", true);
    Storage.remove("theme");
    Storage.remove("font");
  }

  // Vérifier si première visite
  const savedFirstTime = Storage.get("isFirstTime");
  state.isFirstTime = savedFirstTime === null ? true : savedFirstTime;

  // Charger depuis localStorage
  const settings = {
    theme: Storage.get("theme") || "light",
    font: Storage.get("font") || "system-ui",
    fontSize: Storage.get("fontSize") || 20,
    letterSpacing: Storage.get("letterSpacing") || 0.12,
    wordSpacing: Storage.get("wordSpacing") || 0.25,
    lineHeight: Storage.get("lineHeight") || 1.7,
    zebraMode: Storage.get("zebraMode") || false,
    syllableColor: Storage.get("syllableColor") || false,
    maskOpacity: Storage.get("maskOpacity") || 0.7,
    voiceRate: Storage.get("voiceRate") || 1.0,
    reducedMotion: Storage.get("reducedMotion") || false,
    overlayColor: Storage.get("overlayColor") || null,
    overlayOpacity: Storage.get("overlayOpacity") || 0.15,
    rulerMode: Storage.get("rulerMode") || "window",
    lang: Storage.get("lang") || CONFIG.DEFAULT_LANGUAGE,
  };

  state.settings = { ...state.settings, ...settings };

  // Validation des données localStorage (sécurité)
  const validThemes = ["light", "cream", "sepia", "dark", "dark-blue"];
  if (!validThemes.includes(state.settings.theme))
    state.settings.theme = "light";
  const validFonts = [
    "system-ui",
    "OpenDyslexic",
    "Comic Neue",
    "Arial",
    "Georgia",
  ];
  if (!validFonts.includes(state.settings.font))
    state.settings.font = "system-ui";
  state.settings.fontSize = Math.max(
    CONFIG.MIN_FONT_SIZE,
    Math.min(CONFIG.MAX_FONT_SIZE, Number(state.settings.fontSize) || 20),
  );
  state.settings.letterSpacing = Math.max(
    0,
    Math.min(0.5, Number(state.settings.letterSpacing) || 0.12),
  );
  state.settings.wordSpacing = Math.max(
    0,
    Math.min(1.0, Number(state.settings.wordSpacing) || 0.25),
  );
  state.settings.lineHeight = Math.max(
    1.2,
    Math.min(2.5, Number(state.settings.lineHeight) || 1.7),
  );
  state.settings.maskOpacity = Math.max(
    0.3,
    Math.min(0.9, Number(state.settings.maskOpacity) || 0.7),
  );
  state.settings.voiceRate = Math.max(
    0.5,
    Math.min(2, Number(state.settings.voiceRate) || 1.0),
  );
  state.settings.overlayOpacity = Math.max(
    0.05,
    Math.min(0.4, Number(state.settings.overlayOpacity) || 0.15),
  );
  const validOverlayColors = [
    null,
    "#fef9c3",
    "#dbeafe",
    "#fce7f3",
    "#dcfce7",
    "#fed7aa",
  ];
  if (
    state.settings.overlayColor &&
    !validOverlayColors.includes(state.settings.overlayColor)
  ) {
    state.settings.overlayColor = null;
  }
  const validRulerModes = ["line", "window", "top", "spotlight"];
  if (!validRulerModes.includes(state.settings.rulerMode)) {
    state.settings.rulerMode = "window";
  }
  const validLangs = ["fr", "en", "ar"];
  if (!validLangs.includes(state.settings.lang))
    state.settings.lang = CONFIG.DEFAULT_LANGUAGE;

  // Charger la langue sauvegardée
  state.currentLang = state.settings.lang || CONFIG.DEFAULT_LANGUAGE;
  applyLanguage(state.currentLang);

  // Charger paramètres OCR avancés (validés)
  const ocrSettings = Storage.get("ocrSettings");
  if (ocrSettings && typeof ocrSettings === "object") {
    if (typeof ocrSettings.ENABLE_PREPROCESSING === "boolean")
      CONFIG.OCR.ENABLE_PREPROCESSING = ocrSettings.ENABLE_PREPROCESSING;
    if (typeof ocrSettings.ENABLE_VALIDATION === "boolean")
      CONFIG.OCR.ENABLE_VALIDATION = ocrSettings.ENABLE_VALIDATION;
    if (typeof ocrSettings.AUTO_CORRECT === "boolean")
      CONFIG.OCR.AUTO_CORRECT = ocrSettings.AUTO_CORRECT;
    if (typeof ocrSettings.CONFIDENCE_THRESHOLD === "number")
      CONFIG.OCR.CONFIDENCE_THRESHOLD = Math.max(
        0,
        Math.min(1, ocrSettings.CONFIDENCE_THRESHOLD),
      );
  }

  // Appliquer les settings
  document.documentElement.dataset.theme = state.settings.theme;
  document.body.dataset.theme = state.settings.theme;
  document.getElementById("font-select").value = state.settings.font;
  document.getElementById("font-size").value = state.settings.fontSize;
  document.getElementById("font-size-value").textContent =
    state.settings.fontSize;
  document.getElementById("letter-spacing").value =
    state.settings.letterSpacing;
  document.getElementById("letter-spacing-value").textContent =
    state.settings.letterSpacing.toFixed(2);
  document.getElementById("word-spacing").value = state.settings.wordSpacing;
  document.getElementById("word-spacing-value").textContent =
    state.settings.wordSpacing.toFixed(2);
  document.getElementById("line-height").value = state.settings.lineHeight;
  document.getElementById("line-height-value").textContent =
    state.settings.lineHeight.toFixed(1);
  document.getElementById("zebra-mode").checked = state.settings.zebraMode;
  document.getElementById("syllable-color").checked =
    state.settings.syllableColor;
  document.getElementById("mask-opacity").value = state.settings.maskOpacity;
  document.getElementById("voice-rate").value = state.settings.voiceRate;
  document.getElementById("rate-value").textContent =
    state.settings.voiceRate.toFixed(1) + "x";
  document.getElementById("lang-select").value = state.settings.lang;

  // Mode calme (faible stimulation)
  document.getElementById("reduced-motion").checked =
    state.settings.reducedMotion;
  if (state.settings.reducedMotion) {
    document.documentElement.dataset.reducedMotion = "";
  }
  // Respecter la préférence OS si pas de réglage explicite
  if (Storage.get("reducedMotion") === null) {
    const prefersReduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (prefersReduced) {
      state.settings.reducedMotion = true;
      document.documentElement.dataset.reducedMotion = "";
      document.getElementById("reduced-motion").checked = true;
    }
  }

  // Règle de lecture - mode
  const rulerRadio = document.querySelector(
    `input[name="ruler-mode"][value="${state.settings.rulerMode}"]`,
  );
  if (rulerRadio) rulerRadio.checked = true;
  document.documentElement.dataset.rulerMode = state.settings.rulerMode;

  // Overlay couleur
  colorOverlay.init();
  if (state.settings.overlayColor) {
    colorOverlay.setColor(state.settings.overlayColor);
    colorOverlay.setOpacity(state.settings.overlayOpacity);
    document
      .querySelectorAll(".overlay-color-btn")
      .forEach((b) => b.classList.remove("active"));
    const activeBtn = document.querySelector(
      `.overlay-color-btn[data-color="${state.settings.overlayColor}"]`,
    );
    if (activeBtn) activeBtn.classList.add("active");
  }
  document.getElementById("overlay-opacity").value =
    state.settings.overlayOpacity;
  document.getElementById("overlay-opacity-value").textContent =
    state.settings.overlayOpacity.toFixed(2);

  document.documentElement.lang = state.currentLang;
  document.body.dir = state.currentLang === "ar" ? "rtl" : "ltr";

  // Appliquer la typographie
  typography.applySettings(state.settings);
}

// ============================================
// 16. GESTION DE LA LANGUE (i18n)
// ============================================

function applyLanguage(lang) {
  state.currentLang = lang;
  Storage.set("lang", lang);
  document.documentElement.lang = lang;
  document.documentElement.dir = i18n.getLangMetadata(lang).dir;
  updateOnboardingText(lang);
  updateMainUIText(lang);

  // Mettre à jour la sélection du bouton de langue
  const langBtns = document.querySelectorAll(".onboarding-lang-btn");
  langBtns.forEach((btn) => {
    const isSelected = btn.dataset.lang === lang;
    if (isSelected) {
      btn.style.borderColor = "var(--color-primary)";
      btn.style.borderWidth = "2px";
    } else {
      btn.style.borderColor = "var(--color-border)";
      btn.style.borderWidth = "2px";
    }
  });
}

function updateOnboardingText(lang) {
  const elements = {
    "onboarding-title": "onboarding.title",
    "onboarding-subtitle": "onboarding.subtitle",
    "onboarding-language-label": "onboarding.language",
    "onboarding-font-label": "onboarding.font",
    "onboarding-theme-label": "onboarding.theme",
    "onboarding-quick-setup": "onboarding.quickSetup",
    "skip-onboarding-btn": "onboarding.buttonSkip",
    "complete-onboarding-btn": "onboarding.buttonApply",
    "theme-light-label": "onboarding.themeLight",
    "theme-dark-label": "onboarding.themeDark",
  };

  for (const [id, key] of Object.entries(elements)) {
    const el = document.getElementById(id);
    if (el) {
      const text = i18n.t(key, lang);
      if (text && text !== key) {
        el.textContent = text;
      }
    }
  }

  // Mettre à jour les options de police
  const fontOptions = document.querySelectorAll(
    '[data-key^="onboarding.fontDesc."]',
  );
  fontOptions.forEach((option) => {
    const key = option.dataset.key;
    if (key) {
      const text = i18n.t(key, lang);
      if (text && text !== key) {
        option.textContent = text;
      }
    }
  });
}

function updateMainUIText(lang) {
  // Mettre à jour header
  const headerTitle = document.querySelector('[data-translate="header.title"]');
  if (headerTitle) {
    headerTitle.textContent = i18n.t("header.title", lang);
  }

  // Mettre à jour tous les éléments avec data-translate
  document.querySelectorAll("[data-translate]").forEach((el) => {
    const key = el.dataset.translate;
    const translated = i18n.t(key, lang);
    if (translated !== key) {
      el.textContent = translated;
    }
  });
}

// ============================================
// 17. SERVICE WORKER ENREGISTREMENT
// ============================================

async function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    try {
      const registration = await navigator.serviceWorker.register("./sw.js");

      // Vérifier les mises à jour
      registration.addEventListener("updatefound", () => {
        const newWorker = registration.installing;
        newWorker.addEventListener("statechange", () => {
          if (
            newWorker.state === "installed" &&
            navigator.serviceWorker.controller
          ) {
            showToast("Nouvelle version disponible!", "info");
          }
        });
      });
    } catch (error) {
      console.error("Erreur Service Worker:", error);
    }
  }
}

// ============================================
// 17. ONBOARDING & PAGE ROUTING
// ============================================

function showOnboarding() {
  const modal = document.getElementById("onboarding-modal");

  if (modal) {
    modal.removeAttribute("hidden");
    modal.setAttribute("aria-modal", "true");
  }

  // Sélectionner le thème par défaut
  const defaultThemeBtn = document.querySelector(
    `.onboarding-theme-btn[data-theme="${state.settings.theme}"]`,
  );
  if (defaultThemeBtn) {
    defaultThemeBtn.dataset.selected = "true";
    defaultThemeBtn.style.borderColor = "var(--color-primary)";
    defaultThemeBtn.style.borderWidth = "2px";
  }

  // Sélectionner la langue par défaut
  const defaultLangBtn = document.querySelector(
    `.onboarding-lang-btn[data-lang="${state.currentLang}"]`,
  );
  if (defaultLangBtn) {
    defaultLangBtn.dataset.selected = "true";
    defaultLangBtn.style.borderColor = "var(--color-primary)";
    defaultLangBtn.style.borderWidth = "2px";
  }
}

function hideOnboarding() {
  const modal = document.getElementById("onboarding-modal");
  if (modal) {
    modal.setAttribute("hidden", "");
    modal.removeAttribute("aria-modal");
  }
}

function completeOnboarding() {
  // Marquer comme complété
  state.isFirstTime = false;
  Storage.set("isFirstTime", false);

  // La langue doit déjà être définie avant completeOnboarding
  // (Elle est définie dynamiquement lors du clic sur les boutons de langue)

  // Récupérer la sélection thème
  const themeBtn = document.querySelector(
    '.onboarding-theme-btn[data-selected="true"]',
  );
  if (themeBtn) {
    const theme = themeBtn.dataset.theme;
    state.settings.theme = theme;
    Storage.set("theme", theme);
    document.documentElement.dataset.theme = theme;
    document.body.dataset.theme = theme;
  } else {
  }

  // Récupérer la sélection police
  const fontSelect = document.getElementById("onboarding-font");
  if (fontSelect && fontSelect.value) {
    typography.setFont(fontSelect.value);
  }

  hideOnboarding();
  navigateToPage("acquisition");
}

function navigateToPage(pageName) {
  state.currentPage = pageName;
  const reader = document.getElementById("reader-area");
  const dashboard = document.querySelector(".dashboard");
  const inputSection = document.querySelector(".input-section");

  switch (pageName) {
    case "acquisition":
      // Afficher dashboard avec scanner/importer
      if (dashboard) dashboard.style.display = "grid";
      if (reader)
        reader.innerHTML = `
                <div class="empty-state">
                    <svg class="icon-huge" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path>
                        <circle cx="12" cy="13" r="4"></circle>
                    </svg>
                    <h2 style="margin: var(--space-md) 0;">Importer, scanner ou saisir</h2>
                    <p style="margin: 0; color: var(--color-text-secondary);">Choisissez une source pour commencer</p>
                </div>
            `;
      if (inputSection) inputSection.style.display = "block";
      break;

    case "results":
      // Afficher les résultats OCR
      if (dashboard) dashboard.style.display = "none";
      if (inputSection) inputSection.style.display = "none";
      // Les résultats seront affichés dans le reader-area
      break;
  }
}

// ============================================
// 18. INITIALISATION
// ============================================

async function init() {
  // Les handlers doivent toujours être attachés, même si une étape en amont
  // échoue — sans quoi tous les contrôles UI deviennent morts en cascade.
  try {
    initEventListeners();
  } catch (error) {
    console.error("Erreur initEventListeners:", error);
  }

  try {
    await db.init();
    await loadSettings();
    await registerServiceWorker();
    updateStatus();
    await libraryManager.refresh();

    // Vérifier si première visite
    if (state.isFirstTime) {
      showOnboarding();
    } else {
      navigateToPage("acquisition");
    }
  } catch (error) {
    console.error("Erreur initialisation Dys-Play:", error);
    showToast("Erreur d'initialisation : " + error.message, "error");
  }
}

// Démarrer l'application
document.addEventListener("DOMContentLoaded", init);

// Export pour utilisation
window.DysPlay = {
  db,
  ocr,
  tts,
  focusMask,
  typography,
  renderEngine,
  libraryManager,
  drawers,
  state,
  // OCR advanced modules
  ImagePreprocessor: window.ImagePreprocessor,
  OCRValidator: window.OCRValidator,
  ZoneSelector: window.ZoneSelector,
};

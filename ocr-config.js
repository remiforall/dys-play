/**
 * Configuration OCR Dys-Play
 * Tesseract.js local uniquement (zéro CDN)
 */

const OCR_CONFIG = {
    // Seuils de confiance
    CONFIDENCE: {
        // Confiance acceptable (pas de warning)
        acceptableThreshold: 0.85,
        // Confiance minimale pour accepter le résultat
        minimumAcceptable: 0.65
    },

    // Cache des corrections
    CACHE: {
        maxSize: 100,
        enabled: true,
        evictionPolicy: 'LRU'
    },

    // Dictionnaire
    DICTIONARY: {
        preloadDefault: true,
        adaptiveLearning: true,
        persistCustom: true,
        storageKey: 'dys-play-custom-dict'
    },

    // Zones de faible confiance
    LOW_CONFIDENCE_ZONES: {
        detectEnabled: true,
        threshold: 0.70,
        prioritizeShortWords: true,
        detectConfusablePairs: true
    },

    // Post-traitement
    POST_PROCESSING: {
        normalizeSpaces: true,
        capitalizeAfterPunctuation: true,
        detectDyslexiaErrors: true,
        autoCorrect: true,
        autoCorrectLevel: 'moderate'
    },

    // Performance
    PERFORMANCE: {
        logMetrics: false,
        slowThreshold: 6000,
        maxTextLength: 0
    },

    // Langue
    LANGUAGE: {
        default: 'fra',
        supported: ['fra', 'eng', 'ara'],
        autoDetect: false,
        customDictionaries: {
            fra: [],
            eng: [],
            ara: []
        }
    }
};

// Presets de configuration
const OCR_PRESETS = {
    // Documents standards, images nettes — rapide
    performance: {
        ...OCR_CONFIG,
        CONFIDENCE: { acceptableThreshold: 0.85, minimumAcceptable: 0.65 },
        CACHE: { maxSize: 100, enabled: true },
        PERFORMANCE: { slowThreshold: 4000 }
    },

    // Documents importants, images dégradées — précis
    precision: {
        ...OCR_CONFIG,
        CONFIDENCE: { acceptableThreshold: 0.90, minimumAcceptable: 0.60 },
        CACHE: { maxSize: 200, enabled: true },
        LOW_CONFIDENCE_ZONES: { threshold: 0.65, prioritizeShortWords: true, detectConfusablePairs: true }
    },

    // Mobile lent, batterie faible — économe
    economy: {
        ...OCR_CONFIG,
        CACHE: { maxSize: 50, enabled: true },
        POST_PROCESSING: { ...OCR_CONFIG.POST_PROCESSING, autoCorrect: false }
    }
};

function loadOCRPreset(presetName) {
    if (!OCR_PRESETS[presetName]) {
        console.warn('[OCR_CONFIG] Preset inconnu:', presetName);
        return OCR_CONFIG;
    }
    return Object.assign({}, OCR_CONFIG, OCR_PRESETS[presetName]);
}

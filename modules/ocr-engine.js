/**
 * Dys-Play — Moteur OCR (orchestration Tesseract.js v7)
 * ======================================================
 *
 * Rôle
 * ----
 * Ce module encapsule toute l'interaction avec Tesseract.js et résout les
 * problèmes mémoire documentés depuis 2018 en appliquant les bonnes
 * pratiques :
 *
 *   1. Pré-traitement image systématique via ./image-preprocessor.js
 *      (les crashes mémoire viennent de photos 12 MP envoyées brutes —
 *      avec un redimensionnement à 2000 px max, le problème disparaît).
 *
 *   2. Workers recyclés après N reconnaissances pour limiter le "learning
 *      drift" documenté par Tesseract (un worker qui a vu trop d'images
 *      différentes devient moins bon) et pour forcer la libération de la
 *      mémoire WASM accumulée.
 *
 *   3. Tesseract.js v6+ recommandé (fuites mémoire corrigées dans v6,
 *      +15 à 35 % de vitesse en v7). Compatible v5 en dégradé.
 *
 *   4. Chargement à la demande des fichiers .traineddata par langue
 *      (pas de bundle monolithique multi-langues au démarrage).
 *
 *   5. Tous les fichiers Tesseract (worker, core WASM, traineddata) servis
 *      en local depuis /vendor/tesseract/ — jamais depuis un CDN.
 *
 * Prérequis
 * ---------
 * Tesseract.js doit être accessible via un import ES (ex: via <script type="importmap">
 * pointant sur /vendor/tesseract/tesseract.esm.min.js) ou via un chargement
 * dynamique (utilisé ici pour rester sans bundler).
 *
 * Dépose recommandée des fichiers dans le projet :
 *
 *   /vendor/tesseract/
 *     tesseract.esm.min.js      — le code JS de Tesseract.js
 *     worker.min.js             — le worker
 *     tesseract-core-simd.wasm  — le noyau WASM (une des variantes)
 *     tesseract-core-simd.wasm.js
 *   /vendor/tesseract/langs/
 *     fra.traineddata           — données entraînées pour le français
 *     eng.traineddata
 *     ara.traineddata
 *
 * Usage
 * -----
 *   import { createOCRService } from './modules/ocr-engine.js';
 *
 *   const ocr = createOCRService({
 *     workerPath:     '/vendor/tesseract/worker.min.js',
 *     corePath:       '/vendor/tesseract/',
 *     langPath:       '/vendor/tesseract/langs',
 *     defaultLang:    'fra',
 *   });
 *
 *   const result = await ocr.recognize(file, {
 *     lang: 'fra',
 *     onProgress: (step, pct) => console.log(step, pct),
 *   });
 *   // result = { text, confidence, words, preprocessingTimeMs, ocrTimeMs, detectedAngle }
 *
 *   // En fin de vie de l'application :
 *   await ocr.destroy();
 *
 * @module ocr-engine
 */

// @ts-check
"use strict";

import { preprocessForOCR } from "./image-preprocessor.js";

// -------------------------------------------------------------------------
// Configuration par défaut
// -------------------------------------------------------------------------

/**
 * Nombre de reconnaissances consécutives au-delà duquel on remplace le worker
 * par une instance neuve. Limite le "learning drift" et force la libération
 * mémoire. Valeur conservatrice choisie d'après les recommandations officielles
 * Tesseract.js (issue #993).
 */
const WORKER_MAX_USES = 15;

/**
 * Liste blanche des langues supportées. Empêche l'utilisateur / le code
 * appelant de déclencher le téléchargement arbitraire de n'importe quel
 * fichier traineddata depuis le dossier local.
 */
const SUPPORTED_LANGUAGES = Object.freeze(["fra", "eng", "ara"]);

/**
 * Options Tesseract par défaut. Choisies pour réduire la mémoire et le temps
 * de traitement.
 *
 * Notes :
 *   - tessedit_pageseg_mode = 3  → Auto, sans OSD (orientation/script detection)
 *                                   Suffit pour la plupart des documents.
 *                                   Notre deskew maison s'occupe de l'angle.
 *   - tessedit_ocr_engine_mode = 1 → LSTM only (plus rapide, plus précis
 *                                     que le moteur legacy)
 *
 * Ces valeurs peuvent être surchargées par l'appelant.
 */
const DEFAULT_TESSERACT_PARAMS = Object.freeze({
  tessedit_pageseg_mode: "3",
  tessedit_ocr_engine_mode: "1",
  preserve_interword_spaces: "1",
});

// -------------------------------------------------------------------------
// Types JSDoc
// -------------------------------------------------------------------------

/**
 * @typedef {Object} OCRServiceConfig
 * @property {string} workerPath
 *   Chemin vers le fichier worker Tesseract (servi localement).
 * @property {string} corePath
 *   Chemin vers le dossier contenant tesseract-core*.wasm.
 * @property {string} langPath
 *   Chemin vers le dossier contenant les fichiers *.traineddata.
 * @property {string} defaultLang
 *   Langue utilisée si l'appelant ne spécifie pas de langue (ex: 'fra').
 * @property {Partial<import('./image-preprocessor.js').PreprocessOptions>} [preprocessOptions]
 *   Options passées au pré-processeur d'image.
 */

/**
 * @typedef {Object} RecognizeOptions
 * @property {string} [lang]               Code langue ISO 639-2 ('fra', 'eng', 'ara').
 * @property {boolean} [preprocess]        Activer le pré-traitement (défaut: true).
 * @property {OCRProgressCallback} [onProgress]
 * @property {AbortSignal} [signal]        Pour annuler la reconnaissance en cours.
 */

/**
 * @callback OCRProgressCallback
 * @param {string} step     Nom de l'étape ('preprocess', 'loading', 'recognizing').
 * @param {number} percent  0-100.
 * @returns {void}
 */

/**
 * @typedef {Object} RecognizeResult
 * @property {string} text                  Texte reconnu.
 * @property {number} confidence            Confiance moyenne 0-100.
 * @property {Array<RecognizedWord>} words  Mots reconnus avec positions.
 * @property {number} preprocessingTimeMs
 * @property {number} ocrTimeMs
 * @property {number} detectedAngle         Angle corrigé par le deskew (°).
 * @property {string} lang                  Langue utilisée.
 */

/**
 * @typedef {Object} RecognizedWord
 * @property {string} text
 * @property {number} confidence
 * @property {{ x0: number, y0: number, x1: number, y1: number }} bbox
 */

// -------------------------------------------------------------------------
// Chargement dynamique de Tesseract.js
// -------------------------------------------------------------------------

/**
 * Charge dynamiquement le module Tesseract.js (ES module attendu).
 * On ne le charge qu'au premier usage OCR, pas au démarrage de l'app,
 * pour ne pas payer le coût (~40 Ko gzippé + parsing) à l'ouverture.
 *
 * @param {string} scriptPath  Chemin du fichier ESM de Tesseract.
 * @returns {Promise<*>}       Module Tesseract.
 */
let _tesseractModule = null;
async function loadTesseract(scriptPath) {
  if (_tesseractModule) return _tesseractModule;

  // Import dynamique ES natif. Fonctionne sans bundler.
  // IMPORTANT : import() NE résout PAS un specifier "nu" (ex.
  // "libs/tesseract/tesseract.esm.min.js" sans ./ ni /) — il le traite comme
  // un nom de package → TypeError "failed to resolve module specifier".
  // On force une URL absolue relative au document (new URL est idempotent
  // si scriptPath est déjà absolu).
  const url =
    typeof document !== "undefined"
      ? new URL(scriptPath, document.baseURI).href
      : scriptPath;
  // Le chemin doit être servi avec le bon MIME type (application/javascript).
  _tesseractModule = await import(/* @vite-ignore */ url);
  return _tesseractModule;
}

// -------------------------------------------------------------------------
// Création du service OCR
// -------------------------------------------------------------------------

/**
 * Crée un service OCR réutilisable. Maintient en interne un worker Tesseract
 * pour éviter de payer le coût de création à chaque appel, et le recycle
 * périodiquement pour prévenir les dérives mémoire.
 *
 * @param {OCRServiceConfig} config
 * @returns {OCRService}
 */
export function createOCRService(config) {
  if (!config.workerPath || !config.corePath || !config.langPath) {
    throw new Error(
      "createOCRService : workerPath, corePath et langPath sont requis.",
    );
  }

  /** @type {*} */ let worker = null;
  /** @type {string|null} */ let currentLang = null;
  /** @type {number} */ let useCount = 0;
  /** @type {boolean} */ let destroyed = false;

  /**
   * Vérifie que la langue demandée est bien dans la liste blanche.
   * @param {string} lang
   */
  function assertLangAllowed(lang) {
    if (!SUPPORTED_LANGUAGES.includes(lang)) {
      throw new Error(
        `Langue '${lang}' non supportée. Langues disponibles : ${SUPPORTED_LANGUAGES.join(", ")}.`,
      );
    }
  }

  /**
   * Initialise un nouveau worker Tesseract, ou remplace l'ancien si besoin.
   * Idempotent tant que la langue ne change pas et que useCount < max.
   *
   * @param {string} lang
   * @returns {Promise<*>}  Le worker Tesseract prêt.
   */
  async function getWorker(lang) {
    if (destroyed) {
      throw new Error("Service OCR déjà détruit.");
    }

    const needsRecreate =
      worker === null || currentLang !== lang || useCount >= WORKER_MAX_USES;

    if (needsRecreate) {
      // Terminer proprement l'ancien worker pour libérer la mémoire WASM
      if (worker !== null) {
        try {
          await worker.terminate();
        } catch {
          // Si la terminaison échoue, on passe outre (le worker était peut-être
          // déjà mort). L'important est de ne pas bloquer.
        }
        worker = null;
      }

      const Tesseract = await loadTesseract(
        config.workerPath.replace(
          /\/worker\.min\.js$/,
          "/tesseract.esm.min.js",
        ),
      );

      // createWorker API Tesseract.js v6+.
      // Les fichiers sont servis en local depuis les chemins fournis.
      worker = await Tesseract.createWorker(lang, 1, {
        workerPath: config.workerPath,
        corePath: config.corePath,
        langPath: config.langPath,
        // Pas de logger verbeux par défaut : l'appelant a son propre
        // onProgress qu'on alimente manuellement.
        logger: () => {},
        // cachePath: où IndexedDB stocke les traineddata après premier téléchargement
        cachePath: ".",
      });

      await worker.setParameters({ ...DEFAULT_TESSERACT_PARAMS });

      currentLang = lang;
      useCount = 0;
    }

    return worker;
  }

  /** @type {OCRService} */
  const service = {
    /**
     * Reconnaît le texte d'une image (photo, scan, import).
     *
     * @param {Blob|File|ImageBitmap|HTMLImageElement|HTMLCanvasElement} source
     * @param {RecognizeOptions} [options]
     * @returns {Promise<RecognizeResult>}
     */
    async recognize(source, options = {}) {
      if (destroyed) {
        throw new Error("Service OCR déjà détruit.");
      }

      const lang = options.lang ?? config.defaultLang;
      assertLangAllowed(lang);

      const progress = options.onProgress ?? (() => {});
      const doPreprocess = options.preprocess !== false; // Par défaut true

      // 1. Pré-traitement image (résout les crashes mémoire)
      const preT0 = performance.now();
      let preprocessed;
      if (doPreprocess) {
        preprocessed = await preprocessForOCR(source, {
          ...(config.preprocessOptions || {}),
          onProgress: (step, pct) => progress(`preprocess.${step}`, pct * 0.4),
        });
      } else {
        // Pas de pré-traitement demandé : on envoie brut. Dangereux pour
        // les grandes images, à l'appelant de gérer.
        preprocessed = {
          blob:
            source instanceof Blob
              ? source
              : await fetch(source.toString()).then((r) => r.blob()),
          width: 0,
          height: 0,
          detectedAngle: 0,
          processingTimeMs: 0,
        };
      }
      const preprocessingTimeMs = performance.now() - preT0;

      // Vérification d'annulation avant de lancer l'OCR
      if (options.signal?.aborted) {
        throw new DOMException("Reconnaissance annulée", "AbortError");
      }

      // 2. OCR proprement dit
      progress("ocr.loading", 45);
      const w = await getWorker(lang);
      progress("ocr.recognizing", 50);

      const ocrT0 = performance.now();
      const { data } = await w.recognize(preprocessed.blob);
      const ocrTimeMs = performance.now() - ocrT0;

      useCount++;

      progress("done", 100);

      return {
        text: data.text,
        confidence: data.confidence,
        words: (data.words || []).map((wrd) => ({
          text: wrd.text,
          confidence: wrd.confidence,
          bbox: wrd.bbox,
        })),
        preprocessingTimeMs,
        ocrTimeMs,
        detectedAngle: preprocessed.detectedAngle,
        lang,
      };
    },

    /**
     * Force la recréation immédiate du worker sur le prochain recognize.
     * Utile si l'utilisateur signale un résultat étrange (reset du "learning").
     */
    resetWorker() {
      useCount = WORKER_MAX_USES; // Sera recréé au prochain appel
    },

    /**
     * Libère toutes les ressources (worker Tesseract, mémoire WASM).
     * À appeler quand l'app se ferme ou que l'utilisateur désactive l'OCR.
     *
     * @returns {Promise<void>}
     */
    async destroy() {
      destroyed = true;
      if (worker !== null) {
        try {
          await worker.terminate();
        } catch {
          // Idem : si la terminaison échoue, on continue proprement.
        }
        worker = null;
        currentLang = null;
        useCount = 0;
      }
    },

    /**
     * Diagnostic : retourne des infos sur l'état interne.
     * @returns {{ ready: boolean, currentLang: string|null, useCount: number, destroyed: boolean }}
     */
    getStatus() {
      return {
        ready: worker !== null && !destroyed,
        currentLang,
        useCount,
        destroyed,
      };
    },
  };

  return service;
}

/**
 * @typedef {Object} OCRService
 * @property {(source: Blob|File|ImageBitmap|HTMLImageElement|HTMLCanvasElement, options?: RecognizeOptions) => Promise<RecognizeResult>} recognize
 * @property {() => void} resetWorker
 * @property {() => Promise<void>} destroy
 * @property {() => { ready: boolean, currentLang: string|null, useCount: number, destroyed: boolean }} getStatus
 */

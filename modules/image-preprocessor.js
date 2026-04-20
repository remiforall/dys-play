/**
 * Dys-Play — Module de pré-traitement image pour OCR
 * ===================================================
 *
 * Objectif
 * --------
 * Préparer une image (photo smartphone, scan, import) avant de l'envoyer au
 * moteur OCR, de façon à :
 *
 *   1. Éliminer les crashes mémoire en redimensionnant les images trop grandes
 *      (une photo 12 MP passée brute à Tesseract.js fait exploser le tas WASM
 *      sur mobile — cf. issues GitHub naptha/tesseract.js #178, #207, #446,
 *      #476, #900).
 *
 *   2. Améliorer la précision OCR via binarisation adaptative, correction
 *      d'inclinaison (deskew) et ajustement de contraste — des leviers
 *      documentés pour améliorer la précision OCR de façon significative
 *      (Electronics MDPI 2023 : binarisation ≈ +40 %, redimensionnement
 *      optimal ≈ +28 %, deskew ≈ +10 %, ajustement contraste ≈ +15 %).
 *
 * Contraintes respectées
 * ----------------------
 *   - 100 % local (aucune requête réseau, aucune donnée qui sort)
 *   - Vanilla JavaScript (modules ES, ES2020+)
 *   - Aucune dépendance externe (ni OpenCV.js, ni canvas libs, ni ML)
 *   - Canvas 2D natif uniquement
 *   - Compatible tous navigateurs modernes (Chrome 89+, Firefox 90+, Safari 14+)
 *   - Utilise OffscreenCanvas quand disponible pour ne pas bloquer le thread UI
 *
 * Pipeline par défaut
 * -------------------
 *   Image brute → redimensionnement → niveaux de gris → stretch contraste →
 *   deskew (optionnel) → binarisation adaptative Sauvola → résultat
 *
 * Usage typique
 * -------------
 *   import { preprocessForOCR } from './modules/image-preprocessor.js';
 *
 *   const file = input.files[0];
 *   const processed = await preprocessForOCR(file, {
 *     maxDimension: 2000,       // Grand côté max en px après redim
 *     binarize: true,           // Binarisation adaptative (recommandé)
 *     deskew: true,             // Correction d'inclinaison
 *     stretchContrast: true,    // Étirement de l'histogramme
 *     onProgress: (step, pct) => console.log(step, pct),
 *   });
 *   // processed est un Blob image prêt pour Tesseract / PaddleOCR
 *
 * @module image-preprocessor
 */

// @ts-check
"use strict";

// -------------------------------------------------------------------------
// Constantes et options par défaut
// -------------------------------------------------------------------------

/**
 * Options par défaut du pré-traitement.
 * Conçues pour donner un bon résultat sur la majorité des photos de texte
 * prises à la volée au smartphone.
 * @type {Readonly<PreprocessOptions>}
 */
const DEFAULT_OPTIONS = Object.freeze({
  maxDimension: 2000,
  minDimension: 800,
  grayscale: true,
  stretchContrast: true,
  deskew: true,
  binarize: true,
  sauvolaWindow: 25,
  sauvolaK: 0.34,
  outputFormat: "image/png",
  outputQuality: 0.92,
  onProgress: null,
});

/**
 * Angle maximum testé pour le deskew, en degrés.
 * On ne cherche pas à redresser des pages tournées à 90°, juste des
 * inclinaisons de photo main levée (typiquement ±10°).
 */
const DESKEW_MAX_ANGLE = 10;

/**
 * Pas initial de recherche du deskew (en degrés).
 * On cherche d'abord grossièrement, puis on affine autour du meilleur angle.
 */
const DESKEW_COARSE_STEP = 1;

/**
 * Pas fin de recherche du deskew (en degrés).
 */
const DESKEW_FINE_STEP = 0.25;

// -------------------------------------------------------------------------
// Types JSDoc
// -------------------------------------------------------------------------

/**
 * @typedef {Object} PreprocessOptions
 * @property {number} maxDimension
 *   Grand côté maximum de l'image après redimensionnement, en pixels.
 *   2000 est un bon compromis entre précision OCR et coût mémoire.
 * @property {number} minDimension
 *   Grand côté minimum. Si l'image est plus petite, on l'agrandit par
 *   interpolation bicubique pour aider l'OCR à reconnaître les caractères
 *   (équivalent ≥ 300 DPI sur une page A4).
 * @property {boolean} grayscale
 *   Convertir en niveaux de gris. Presque toujours souhaité pour l'OCR.
 * @property {boolean} stretchContrast
 *   Étirer l'histogramme pour utiliser toute la dynamique 0-255.
 *   Utile pour les photos sous-exposées ou surexposées.
 * @property {boolean} deskew
 *   Détecter et corriger l'inclinaison de la page.
 * @property {boolean} binarize
 *   Appliquer une binarisation adaptative (noir/blanc) via algorithme Sauvola.
 *   Fortement recommandé : c'est ce qui élimine les fonds bruités et aide
 *   Tesseract à reconnaître les caractères.
 * @property {number} sauvolaWindow
 *   Taille (en pixels) de la fenêtre locale pour l'algorithme Sauvola.
 *   À ajuster en fonction de la taille du texte : plus gros texte → fenêtre
 *   plus grande. 25 est un bon défaut pour du texte imprimé standard.
 * @property {number} sauvolaK
 *   Paramètre de sensibilité de Sauvola (entre 0.2 et 0.5 typiquement).
 *   0.34 est un bon défaut. Plus petit = plus de texte préservé mais plus
 *   de bruit ; plus grand = plus de bruit éliminé mais risque de perdre
 *   du texte fin.
 * @property {string} outputFormat
 *   Format MIME de la sortie. 'image/png' pour la fidélité (lossless),
 *   'image/jpeg' ou 'image/webp' pour un fichier plus léger.
 *   PNG recommandé car l'OCR bénéficie de l'absence d'artefacts de compression.
 * @property {number} outputQuality
 *   Qualité de compression pour JPEG/WebP (0.0 à 1.0). Ignoré pour PNG.
 * @property {ProgressCallback|null} onProgress
 *   Callback optionnel pour remonter la progression à l'UI.
 */

/**
 * @callback ProgressCallback
 * @param {string} step  Nom de l'étape en cours (pour i18n si besoin).
 * @param {number} percent  Progression globale (0 à 100).
 * @returns {void}
 */

/**
 * @typedef {Object} PreprocessResult
 * @property {Blob} blob
 *   Image traitée, prête à être passée à un moteur OCR.
 * @property {number} width
 *   Largeur finale en pixels.
 * @property {number} height
 *   Hauteur finale en pixels.
 * @property {number} detectedAngle
 *   Angle de rotation appliqué par le deskew (en degrés, 0 si non appliqué).
 * @property {number} processingTimeMs
 *   Temps total de pré-traitement en millisecondes.
 */

// -------------------------------------------------------------------------
// Point d'entrée public
// -------------------------------------------------------------------------

/**
 * Pré-traite une image pour maximiser la précision OCR et éviter les crashes
 * mémoire.
 *
 * @param {Blob|File|ImageBitmap|HTMLImageElement|HTMLCanvasElement} source
 *   Source image. Si Blob ou File, sera décodée automatiquement.
 * @param {Partial<PreprocessOptions>} [userOptions]
 *   Options de pré-traitement (mélangées aux défauts).
 * @returns {Promise<PreprocessResult>}
 *   Blob image prêt pour l'OCR + métadonnées.
 *
 * @throws {Error}
 *   Si la source ne peut pas être décodée ou si un navigateur ne supporte
 *   pas les APIs nécessaires (Canvas 2D, createImageBitmap).
 */
export async function preprocessForOCR(source, userOptions = {}) {
  const t0 = performance.now();

  /** @type {PreprocessOptions} */
  const options = { ...DEFAULT_OPTIONS, ...userOptions };

  const report = (step, percent) => {
    if (typeof options.onProgress === "function") {
      try {
        options.onProgress(step, percent);
      } catch {
        // On ignore silencieusement les erreurs du callback utilisateur
        // pour ne pas casser le pipeline.
      }
    }
  };

  report("decode", 0);

  // 1. Décodage de la source en ImageBitmap
  //    createImageBitmap est asynchrone et natif, gère JPEG, PNG, WebP,
  //    GIF, BMP. Plus efficace qu'un HTMLImageElement + canvas.
  const bitmap = await decodeSource(source);

  report("resize", 10);

  // 2. Redimensionnement intelligent vers une taille raisonnable
  //    C'est l'étape qui résout les crashes : on n'enverra jamais 12 MP
  //    à Tesseract, on lui donne une image 2000×1500 max.
  const { canvas: resizedCanvas, ctx: resizedCtx } = await resizeWithQuality(
    bitmap,
    options.maxDimension,
    options.minDimension,
  );
  bitmap.close?.(); // Libérer la mémoire du bitmap source

  report("grayscale", 30);

  // 3. Extraction des données pixel pour traitement
  const imageData = resizedCtx.getImageData(
    0,
    0,
    resizedCanvas.width,
    resizedCanvas.height,
  );

  // 4. Conversion en niveaux de gris (écrit en place dans imageData)
  if (options.grayscale) {
    toGrayscale(imageData);
  }

  report("contrast", 45);

  // 5. Étirement d'histogramme (stretch contraste)
  //    Utile pour les photos à faible contraste (page éclairée mollement,
  //    papier jauni, etc.).
  if (options.stretchContrast) {
    stretchContrast(imageData);
  }

  // On réécrit l'image modifiée dans le canvas avant deskew/binarisation
  resizedCtx.putImageData(imageData, 0, 0);

  report("deskew", 60);

  // 6. Correction d'inclinaison (deskew)
  //    On détecte l'angle optimal par recherche de la direction qui
  //    maximise la variance des projections horizontales, puis on applique
  //    la rotation au canvas.
  let detectedAngle = 0;
  let workingCanvas = resizedCanvas;
  let workingCtx = resizedCtx;

  if (options.deskew) {
    detectedAngle = detectSkewAngle(imageData);
    if (Math.abs(detectedAngle) > 0.1) {
      const rotated = rotateCanvas(workingCanvas, -detectedAngle);
      workingCanvas = rotated.canvas;
      workingCtx = rotated.ctx;
    }
  }

  report("binarize", 80);

  // 7. Binarisation adaptative (Sauvola)
  //    Chaque pixel reçoit un seuil calculé à partir de sa fenêtre locale,
  //    ce qui gère bien les photos avec éclairage inégal (contrairement
  //    à un seuil global type Otsu).
  if (options.binarize) {
    const finalData = workingCtx.getImageData(
      0,
      0,
      workingCanvas.width,
      workingCanvas.height,
    );
    sauvolaBinarize(finalData, options.sauvolaWindow, options.sauvolaK);
    workingCtx.putImageData(finalData, 0, 0);
  }

  report("encode", 95);

  // 8. Encodage du canvas en Blob
  const blob = await canvasToBlob(
    workingCanvas,
    options.outputFormat,
    options.outputQuality,
  );

  report("done", 100);

  return {
    blob,
    width: workingCanvas.width,
    height: workingCanvas.height,
    detectedAngle,
    processingTimeMs: performance.now() - t0,
  };
}

// -------------------------------------------------------------------------
// Étape 1 — Décodage
// -------------------------------------------------------------------------

/**
 * Décode n'importe quelle source image en ImageBitmap.
 * ImageBitmap est la représentation la plus efficace côté navigateur :
 * elle peut être transférée entre workers, dessinée sur canvas en zéro copie,
 * et libérée explicitement avec .close().
 *
 * @param {Blob|File|ImageBitmap|HTMLImageElement|HTMLCanvasElement} source
 * @returns {Promise<ImageBitmap>}
 */
async function decodeSource(source) {
  if (typeof ImageBitmap !== "undefined" && source instanceof ImageBitmap) {
    return source;
  }

  if (source instanceof Blob) {
    // createImageBitmap gère tous les formats raster supportés par le navigateur
    return await createImageBitmap(source);
  }

  if (source instanceof HTMLImageElement) {
    // On attend que l'image soit complètement chargée
    if (!source.complete) {
      await new Promise((resolve, reject) => {
        source.addEventListener("load", () => resolve(undefined), {
          once: true,
        });
        source.addEventListener("error", reject, { once: true });
      });
    }
    return await createImageBitmap(source);
  }

  if (source instanceof HTMLCanvasElement) {
    return await createImageBitmap(source);
  }

  throw new Error(
    "Source image non supportée : fournir un Blob, File, ImageBitmap, HTMLImageElement ou HTMLCanvasElement.",
  );
}

// -------------------------------------------------------------------------
// Étape 2 — Redimensionnement à deux passes pour qualité
// -------------------------------------------------------------------------

/**
 * Redimensionne une image source vers une taille cible, en effectuant
 * un downscaling par paliers si le facteur est important, pour éviter
 * le crénelage que produit un drawImage direct sur un ratio > 2.
 *
 * Si l'image est plus petite que minDimension, on l'agrandit (upscale)
 * pour aider l'OCR à reconnaître les caractères fins.
 *
 * @param {ImageBitmap} bitmap
 * @param {number} maxDim  Grand côté max en pixels.
 * @param {number} minDim  Grand côté min en pixels.
 * @returns {Promise<{ canvas: HTMLCanvasElement|OffscreenCanvas, ctx: CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D }>}
 */
async function resizeWithQuality(bitmap, maxDim, minDim) {
  const srcW = bitmap.width;
  const srcH = bitmap.height;
  const longSide = Math.max(srcW, srcH);

  // Calculer le ratio cible
  let targetRatio = 1;
  if (longSide > maxDim) {
    targetRatio = maxDim / longSide;
  } else if (longSide < minDim) {
    targetRatio = minDim / longSide;
  }

  const targetW = Math.round(srcW * targetRatio);
  const targetH = Math.round(srcH * targetRatio);

  // Si pas besoin de redimensionner, on crée juste un canvas copie
  if (targetRatio === 1) {
    const { canvas, ctx } = createCanvas2D(targetW, targetH);
    ctx.drawImage(bitmap, 0, 0);
    return { canvas, ctx };
  }

  // Pour un downscaling > 2×, on passe par un ou plusieurs paliers
  // intermédiaires pour éviter le crénelage. C'est le "stepped downscaling"
  // recommandé par les bonnes pratiques Canvas depuis 2012+.
  if (targetRatio < 0.5) {
    return await steppedDownscale(bitmap, targetW, targetH);
  }

  // Downscaling direct pour des ratios modérés ou upscaling
  const { canvas, ctx } = createCanvas2D(targetW, targetH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bitmap, 0, 0, targetW, targetH);
  return { canvas, ctx };
}

/**
 * Downscaling par paliers successifs de facteur 2 jusqu'à la taille cible,
 * puis un dernier drawImage pour la taille finale exacte.
 * Donne un résultat nettement plus propre qu'un drawImage unique pour de
 * gros ratios, car chaque étape laisse le navigateur appliquer son filtre
 * d'interpolation sur un ratio proche de 2.
 *
 * @param {ImageBitmap} bitmap
 * @param {number} targetW
 * @param {number} targetH
 * @returns {Promise<{ canvas: HTMLCanvasElement|OffscreenCanvas, ctx: CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D }>}
 */
async function steppedDownscale(bitmap, targetW, targetH) {
  let currentW = bitmap.width;
  let currentH = bitmap.height;

  const { canvas: firstCanvas, ctx: firstCtx } = createCanvas2D(
    currentW,
    currentH,
  );
  firstCtx.imageSmoothingEnabled = true;
  firstCtx.imageSmoothingQuality = "high";
  firstCtx.drawImage(bitmap, 0, 0);

  /** @type {HTMLCanvasElement|OffscreenCanvas} */
  let source = firstCanvas;

  // Chaque itération divise par ~2 jusqu'à être à moins de 2× de la cible
  while (currentW > targetW * 2 && currentH > targetH * 2) {
    const nextW = Math.max(Math.floor(currentW / 2), targetW);
    const nextH = Math.max(Math.floor(currentH / 2), targetH);

    const { canvas: stepCanvas, ctx: stepCtx } = createCanvas2D(nextW, nextH);
    stepCtx.imageSmoothingEnabled = true;
    stepCtx.imageSmoothingQuality = "high";
    // drawImage accepte un canvas comme source
    // @ts-ignore — les types DOM acceptent Canvas ou OffscreenCanvas
    stepCtx.drawImage(source, 0, 0, nextW, nextH);

    source = stepCanvas;
    currentW = nextW;
    currentH = nextH;

    // Yield au thread principal pour ne pas bloquer l'UI
    await new Promise((resolve) => setTimeout(resolve, 0));
  }

  // Dernière passe à la taille cible exacte
  const { canvas, ctx } = createCanvas2D(targetW, targetH);
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";
  // @ts-ignore
  ctx.drawImage(source, 0, 0, targetW, targetH);

  return { canvas, ctx };
}

/**
 * Crée un canvas 2D (OffscreenCanvas si disponible pour de meilleures
 * performances et pour libérer le thread UI, sinon HTMLCanvasElement).
 *
 * @param {number} width
 * @param {number} height
 * @returns {{ canvas: HTMLCanvasElement|OffscreenCanvas, ctx: CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D }}
 */
function createCanvas2D(width, height) {
  if (typeof OffscreenCanvas !== "undefined") {
    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) {
      throw new Error(
        "Impossible de créer un contexte 2D sur OffscreenCanvas.",
      );
    }
    return { canvas, ctx };
  }

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) {
    throw new Error(
      "Impossible de créer un contexte 2D. Navigateur trop ancien ?",
    );
  }
  return { canvas, ctx };
}

// -------------------------------------------------------------------------
// Étape 3 — Niveaux de gris
// -------------------------------------------------------------------------

/**
 * Convertit une ImageData en niveaux de gris, en place.
 * Utilise la pondération luminance ITU-R BT.601 (perceptuellement correcte
 * pour la vision humaine, standard en vidéo et imagerie).
 *
 * @param {ImageData} imageData
 * @returns {void}
 */
function toGrayscale(imageData) {
  const data = imageData.data; // Uint8ClampedArray, 4 octets par pixel (RGBA)
  for (let i = 0, n = data.length; i < n; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    // Y = 0.299 R + 0.587 G + 0.114 B (coefficients ITU-R BT.601)
    // Multiplication entière rapide : (R*77 + G*150 + B*29) >> 8
    const y = (r * 77 + g * 150 + b * 29) >> 8;
    data[i] = y;
    data[i + 1] = y;
    data[i + 2] = y;
    // L'alpha (data[i + 3]) reste inchangé
  }
}

// -------------------------------------------------------------------------
// Étape 4 — Étirement de l'histogramme
// -------------------------------------------------------------------------

/**
 * Étire l'histogramme de l'image en niveaux de gris pour qu'il couvre
 * toute la dynamique 0-255. Utile pour les photos sous-exposées ou prises
 * sous éclairage mou.
 *
 * On calcule les percentiles 1 % et 99 % plutôt que min/max stricts pour
 * être robuste aux pixels aberrants (poussières, éclats, taches).
 *
 * @param {ImageData} imageData
 * @returns {void}
 */
function stretchContrast(imageData) {
  const data = imageData.data;
  const n = data.length;

  // Histogramme (256 niveaux)
  const hist = new Uint32Array(256);
  for (let i = 0; i < n; i += 4) {
    hist[data[i]]++;
  }

  const totalPixels = n / 4;
  const lowThreshold = totalPixels * 0.01;
  const highThreshold = totalPixels * 0.99;

  // Trouver les percentiles 1 % et 99 %
  let lowCut = 0;
  let highCut = 255;
  let cumul = 0;

  for (let v = 0; v < 256; v++) {
    cumul += hist[v];
    if (cumul >= lowThreshold) {
      lowCut = v;
      break;
    }
  }

  cumul = 0;
  for (let v = 0; v < 256; v++) {
    cumul += hist[v];
    if (cumul >= highThreshold) {
      highCut = v;
      break;
    }
  }

  // Si l'image est déjà bien étalée, ne rien faire
  if (highCut - lowCut < 10) return;

  // Table de correspondance (plus rapide qu'un calcul par pixel)
  const lut = new Uint8ClampedArray(256);
  const range = highCut - lowCut;
  for (let v = 0; v < 256; v++) {
    const mapped = Math.round(((v - lowCut) / range) * 255);
    lut[v] = mapped < 0 ? 0 : mapped > 255 ? 255 : mapped;
  }

  // Application via LUT (très rapide)
  for (let i = 0; i < n; i += 4) {
    const y = lut[data[i]];
    data[i] = y;
    data[i + 1] = y;
    data[i + 2] = y;
  }
}

// -------------------------------------------------------------------------
// Étape 5 — Détection et correction d'inclinaison (deskew)
// -------------------------------------------------------------------------

/**
 * Détecte l'angle d'inclinaison dominant d'une image de texte.
 * Méthode : projection horizontale. Pour chaque angle candidat, on calcule
 * la variance de la somme des pixels sombres par ligne. L'angle qui
 * maximise cette variance est le bon : quand les lignes de texte sont
 * horizontales, les creux (inter-lignes) et pics (lignes) sont très marqués.
 *
 * Recherche en deux passes : grossière d'abord (pas 1°), puis fine (pas 0.25°)
 * autour du meilleur angle trouvé.
 *
 * @param {ImageData} imageData  Image en niveaux de gris.
 * @returns {number}  Angle détecté en degrés (positif = rotation horaire).
 */
function detectSkewAngle(imageData) {
  // Passe grossière
  let bestAngle = 0;
  let bestVariance = -Infinity;

  for (
    let angle = -DESKEW_MAX_ANGLE;
    angle <= DESKEW_MAX_ANGLE;
    angle += DESKEW_COARSE_STEP
  ) {
    const variance = projectionVariance(imageData, angle);
    if (variance > bestVariance) {
      bestVariance = variance;
      bestAngle = angle;
    }
  }

  // Passe fine autour du meilleur angle
  const fineMin = bestAngle - DESKEW_COARSE_STEP;
  const fineMax = bestAngle + DESKEW_COARSE_STEP;

  for (let angle = fineMin; angle <= fineMax; angle += DESKEW_FINE_STEP) {
    const variance = projectionVariance(imageData, angle);
    if (variance > bestVariance) {
      bestVariance = variance;
      bestAngle = angle;
    }
  }

  return bestAngle;
}

/**
 * Calcule la variance de la projection horizontale après rotation virtuelle.
 * On ne tourne pas réellement l'image, on projette le long d'une direction
 * inclinée — plus rapide.
 *
 * @param {ImageData} imageData
 * @param {number} angleDeg
 * @returns {number}  Variance (plus c'est grand, mieux les lignes sont alignées).
 */
function projectionVariance(imageData, angleDeg) {
  const { data, width, height } = imageData;
  const rad = (angleDeg * Math.PI) / 180;
  const sin = Math.sin(rad);
  const cos = Math.cos(rad);

  // On échantillonne 1 pixel sur 2 pour la performance (l'échantillonnage
  // ne dégrade pas significativement la qualité de la mesure)
  const sampleStep = 2;
  const numBins = height;
  const bins = new Float32Array(numBins);

  const cx = width / 2;
  const cy = height / 2;

  for (let y = 0; y < height; y += sampleStep) {
    for (let x = 0; x < width; x += sampleStep) {
      // Rotation inverse pour trouver à quelle ligne "virtuelle" ce pixel
      // appartient dans l'image redressée.
      const dx = x - cx;
      const dy = y - cy;
      const rotY = -dx * sin + dy * cos + cy;

      const bin = Math.round(rotY);
      if (bin >= 0 && bin < numBins) {
        // Pixel "sombre" = contribution forte (on inverse la luminance)
        const idx = (y * width + x) * 4;
        bins[bin] += 255 - data[idx];
      }
    }
  }

  // Variance des bins
  let sum = 0;
  for (let i = 0; i < numBins; i++) sum += bins[i];
  const mean = sum / numBins;

  let variance = 0;
  for (let i = 0; i < numBins; i++) {
    const d = bins[i] - mean;
    variance += d * d;
  }

  return variance / numBins;
}

/**
 * Applique une rotation à un canvas et retourne un nouveau canvas de taille
 * ajustée pour contenir toute l'image tournée, avec fond blanc pour ne pas
 * créer de zones noires qui tromperaient la binarisation.
 *
 * @param {HTMLCanvasElement|OffscreenCanvas} srcCanvas
 * @param {number} angleDeg
 * @returns {{ canvas: HTMLCanvasElement|OffscreenCanvas, ctx: CanvasRenderingContext2D|OffscreenCanvasRenderingContext2D }}
 */
function rotateCanvas(srcCanvas, angleDeg) {
  const rad = (angleDeg * Math.PI) / 180;
  const absCos = Math.abs(Math.cos(rad));
  const absSin = Math.abs(Math.sin(rad));

  const srcW = srcCanvas.width;
  const srcH = srcCanvas.height;

  // Nouvelle taille englobante
  const newW = Math.ceil(srcW * absCos + srcH * absSin);
  const newH = Math.ceil(srcW * absSin + srcH * absCos);

  const { canvas, ctx } = createCanvas2D(newW, newH);

  // Fond blanc pour éviter les zones noires dans les coins après rotation
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, newW, newH);

  ctx.translate(newW / 2, newH / 2);
  ctx.rotate(rad);
  // @ts-ignore — drawImage accepte HTMLCanvasElement ou OffscreenCanvas
  ctx.drawImage(srcCanvas, -srcW / 2, -srcH / 2);
  // Reset de la transformation au cas où le canvas serait réutilisé
  ctx.setTransform(1, 0, 0, 1, 0, 0);

  return { canvas, ctx };
}

// -------------------------------------------------------------------------
// Étape 6 — Binarisation adaptative Sauvola
// -------------------------------------------------------------------------

/**
 * Applique l'algorithme de Sauvola pour binariser l'image.
 *
 * Formule :  T(x,y) = m(x,y) × (1 + k × (s(x,y)/R − 1))
 *
 * Où :
 *   - m(x,y) = moyenne des pixels dans la fenêtre locale centrée sur (x,y)
 *   - s(x,y) = écart-type dans la même fenêtre
 *   - k      = paramètre de sensibilité (typiquement 0.2 à 0.5)
 *   - R      = dynamique max de l'écart-type (128 standard pour images 8 bits)
 *
 * Avantage vs seuil global (type Otsu) : gère les variations d'éclairage
 * sur la même image (coin sombre, coin clair) — cas typique d'une photo
 * prise à main levée.
 *
 * Implémentation efficace via images intégrales (tables de sommes
 * cumulatives) : calcul du seuil en O(1) par pixel après un pré-calcul
 * en O(N), donc complexité globale O(N) indépendante de la taille de
 * fenêtre.
 *
 * @param {ImageData} imageData
 * @param {number} windowSize  Taille de la fenêtre carrée (doit être impair).
 * @param {number} k           Paramètre de sensibilité Sauvola.
 * @returns {void}
 */
function sauvolaBinarize(imageData, windowSize, k) {
  const { data, width, height } = imageData;

  // Extraire le canal de luminance dans un buffer typé (performance)
  const lum = new Uint8Array(width * height);
  for (let i = 0, j = 0; j < lum.length; i += 4, j++) {
    lum[j] = data[i];
  }

  // Images intégrales des valeurs et des carrés des valeurs
  // (pour calcul en O(1) de la moyenne et de l'écart-type sur une fenêtre)
  const integral = new Float64Array((width + 1) * (height + 1));
  const integralSq = new Float64Array((width + 1) * (height + 1));

  for (let y = 0; y < height; y++) {
    let rowSum = 0;
    let rowSumSq = 0;
    for (let x = 0; x < width; x++) {
      const v = lum[y * width + x];
      rowSum += v;
      rowSumSq += v * v;
      const idx = (y + 1) * (width + 1) + (x + 1);
      const idxUp = y * (width + 1) + (x + 1);
      integral[idx] = integral[idxUp] + rowSum;
      integralSq[idx] = integralSq[idxUp] + rowSumSq;
    }
  }

  // Demi-fenêtre (la fenêtre est centrée sur le pixel traité)
  const half = Math.floor(windowSize / 2);
  const R = 128.0; // Dynamique max typique d'un écart-type sur image 8 bits

  // Binarisation pixel par pixel
  for (let y = 0; y < height; y++) {
    // Bornes de la fenêtre en y
    const y0 = Math.max(0, y - half);
    const y1 = Math.min(height - 1, y + half);

    for (let x = 0; x < width; x++) {
      const x0 = Math.max(0, x - half);
      const x1 = Math.min(width - 1, x + half);

      const area = (x1 - x0 + 1) * (y1 - y0 + 1);

      // Somme sur la fenêtre via image intégrale :
      // S = I(x1+1, y1+1) - I(x0, y1+1) - I(x1+1, y0) + I(x0, y0)
      const sum =
        integral[(y1 + 1) * (width + 1) + (x1 + 1)] -
        integral[(y1 + 1) * (width + 1) + x0] -
        integral[y0 * (width + 1) + (x1 + 1)] +
        integral[y0 * (width + 1) + x0];

      const sumSq =
        integralSq[(y1 + 1) * (width + 1) + (x1 + 1)] -
        integralSq[(y1 + 1) * (width + 1) + x0] -
        integralSq[y0 * (width + 1) + (x1 + 1)] +
        integralSq[y0 * (width + 1) + x0];

      const mean = sum / area;
      const variance = sumSq / area - mean * mean;
      // Variance parfois très légèrement négative en flottant → clamp à 0
      const std = Math.sqrt(variance > 0 ? variance : 0);

      // Formule de Sauvola
      const threshold = mean * (1 + k * (std / R - 1));

      // Décision binaire
      const pixelIdx = (y * width + x) * 4;
      const pixelValue = lum[y * width + x];
      const binary = pixelValue < threshold ? 0 : 255;

      data[pixelIdx] = binary;
      data[pixelIdx + 1] = binary;
      data[pixelIdx + 2] = binary;
      // L'alpha reste à 255
    }
  }
}

// -------------------------------------------------------------------------
// Étape 7 — Encodage en Blob
// -------------------------------------------------------------------------

/**
 * Convertit un canvas en Blob, en gérant uniformément HTMLCanvasElement
 * (API callback) et OffscreenCanvas (API Promise).
 *
 * @param {HTMLCanvasElement|OffscreenCanvas} canvas
 * @param {string} mimeType
 * @param {number} quality
 * @returns {Promise<Blob>}
 */
function canvasToBlob(canvas, mimeType, quality) {
  if (canvas instanceof OffscreenCanvas) {
    return canvas.convertToBlob({ type: mimeType, quality });
  }
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error("Échec de la conversion canvas → Blob."));
      },
      mimeType,
      quality,
    );
  });
}

// -------------------------------------------------------------------------
// Utilitaires de diagnostic (facultatifs)
// -------------------------------------------------------------------------

/**
 * Retourne la taille en pixels d'une image avant décodage.
 * Utile pour décider si on affiche un avertissement "grande image en cours
 * de traitement" à l'utilisateur.
 *
 * @param {Blob|File} blob
 * @returns {Promise<{ width: number, height: number }>}
 */
export async function getImageDimensions(blob) {
  const bitmap = await createImageBitmap(blob);
  const dims = { width: bitmap.width, height: bitmap.height };
  bitmap.close?.();
  return dims;
}

/**
 * Indique si une image dépasse un seuil de mégapixels (utile pour afficher
 * un message à l'utilisateur genre "image volumineuse, cela peut prendre
 * quelques secondes").
 *
 * @param {Blob|File} blob
 * @param {number} [megapixelThreshold=5]
 * @returns {Promise<boolean>}
 */
export async function isLargeImage(blob, megapixelThreshold = 5) {
  const { width, height } = await getImageDimensions(blob);
  const megapixels = (width * height) / 1_000_000;
  return megapixels >= megapixelThreshold;
}

/**
 * Image Preprocessor Module - Amélioration image pour OCR
 * Gère le contraste, l'orientation, le débruitage
 */

class ImagePreprocessor {
  constructor() {
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d", { willReadFrequently: true });
  }

  /**
   * Amélioration contraste adaptatif (CLAHE simple)
   */
  improveContrast(imageData, clipLimit = 40) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Convertir en grayscale et calculer histogramme
    const gray = [];
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      gray.push(y);
    }

    // CLAHE basique: diviser en tuiles et adapter histogramme local
    const tileSize = 32;
    const tilesX = Math.ceil(width / tileSize);
    const tilesY = Math.ceil(height / tileSize);

    // Pour simplicité, appliquer une version simplifiée
    // Amélioration du contraste global
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < gray.length; i++) {
      histogram[Math.floor(gray[i])]++;
    }

    // Cumulative histogram
    const cumsum = histogram.reduce((acc, val) => {
      acc.push((acc[acc.length - 1] || 0) + val);
      return acc;
    }, []);

    // Normaliser
    const minCum = cumsum[0];
    const maxCum = cumsum[255];

    // Appliquer LUT (Lookup Table)
    const lut = histogram.map((_, i) => {
      if (maxCum === minCum) return i;
      return Math.round(((cumsum[i] - minCum) / (maxCum - minCum)) * 255);
    });

    // Appliquer la transformation
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const y = 0.299 * r + 0.587 * g + 0.114 * b;
      const newY = lut[Math.floor(y)];

      // Preserving color while enhancing contrast
      const factor = y > 0 ? newY / y : 1;
      data[i] = Math.min(255, Math.round(r * factor));
      data[i + 1] = Math.min(255, Math.round(g * factor));
      data[i + 2] = Math.min(255, Math.round(b * factor));
    }

    return imageData;
  }

  /**
   * Détection et correction d'orientation
   * (Tesseract.js peut le faire natif, mais utile pour pré-validation)
   */
  detectOrientation(imageData) {
    // Heuristique simple: vérifier texture horizontale vs verticale
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    let horizontalEdges = 0;
    let verticalEdges = 0;

    // Sobel edge detection simplifié
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const idx = (y * width + x) * 4;
        const center = data[idx];

        // Gradient horizontal
        const hGrad = Math.abs(data[idx - 4] - data[idx + 4]);
        // Gradient vertical
        const vGrad = Math.abs(data[idx - width * 4] - data[idx + width * 4]);

        if (hGrad > vGrad) horizontalEdges++;
        else verticalEdges++;
      }
    }

    // Si plus d'arêtes verticales, image peut être rotée de 90°
    if (verticalEdges > horizontalEdges * 1.2) {
      return {
        angle: 90,
        confidence:
          (verticalEdges - horizontalEdges) / (verticalEdges + horizontalEdges),
      };
    }

    return { angle: 0, confidence: 0 };
  }

  /**
   * Débruitage bilatéral simplifié
   */
  denoise(imageData, radius = 2, sigma = 50) {
    const data = imageData.data;
    const width = imageData.width;
    const height = imageData.height;

    // Copie pour ne pas modifier pendant le calcul
    const output = new Uint8ClampedArray(data);

    // Filtre bilatéral
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4;
        let r = 0,
          g = 0,
          b = 0,
          count = 0;

        const centerR = data[idx];
        const centerG = data[idx + 1];
        const centerB = data[idx + 2];

        // Fenêtre locale
        for (let dy = -radius; dy <= radius; dy++) {
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            const ny = y + dy;

            if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
              const nIdx = (ny * width + nx) * 4;
              const neighborR = data[nIdx];
              const neighborG = data[nIdx + 1];
              const neighborB = data[nIdx + 2];

              // Distance spatiale
              const spatialDist = Math.sqrt(dx * dx + dy * dy);
              // Distance de couleur
              const colorDist = Math.sqrt(
                (neighborR - centerR) ** 2 +
                  (neighborG - centerG) ** 2 +
                  (neighborB - centerB) ** 2,
              );

              // Poids Gaussien
              const weight = Math.exp(
                -(spatialDist * spatialDist + colorDist * colorDist) /
                  (2 * sigma * sigma),
              );

              r += neighborR * weight;
              g += neighborG * weight;
              b += neighborB * weight;
              count += weight;
            }
          }
        }

        output[idx] = Math.round(r / count);
        output[idx + 1] = Math.round(g / count);
        output[idx + 2] = Math.round(b / count);
      }
    }

    imageData.data.set(output);
    return imageData;
  }

  /**
   * Binarisation adaptative (convertir en noir/blanc)
   */
  binarize(imageData, threshold = 128) {
    const data = imageData.data;

    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const gray = 0.299 * r + 0.587 * g + 0.114 * b;

      const bw = gray > threshold ? 255 : 0;
      data[i] = bw;
      data[i + 1] = bw;
      data[i + 2] = bw;
    }

    return imageData;
  }

  /**
   * Pipeline complet d'amélioration
   */
  async processImage(file, options = {}) {
    const {
      improveContrast: doContrast = true,
      denoise: doDenoise = false,
      binarize: doBinarize = false,
      detectOrientation: doDetectOrientation = true,
    } = options;

    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          URL.revokeObjectURL(img.src);
          // Limiter la taille sur mobile pour économiser la RAM
          const maxDim =
            navigator.deviceMemory && navigator.deviceMemory < 4 ? 1200 : 2000;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            const ratio = Math.min(maxDim / w, maxDim / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }

          this.canvas.width = w;
          this.canvas.height = h;

          // Contraste via ctx.filter (GPU-accéléré, ne bloque pas l'UI)
          if (doContrast) {
            this.ctx.filter = "grayscale(100%) contrast(150%)";
          } else {
            this.ctx.filter = "none";
          }
          this.ctx.drawImage(img, 0, 0, w, h);
          this.ctx.filter = "none";

          // Détection orientation
          let orientation = { angle: 0, confidence: 0 };
          if (doDetectOrientation) {
            const tempData = this.ctx.getImageData(0, 0, w, h);
            orientation = this.detectOrientation(tempData);
          }

          // Traitements pixel uniquement si demandés (binarise/denoise)
          if (doDenoise || doBinarize) {
            let imageData = this.ctx.getImageData(0, 0, w, h);
            if (doDenoise) imageData = this.denoise(imageData, 1);
            if (doBinarize) imageData = this.binarize(imageData);
            this.ctx.putImageData(imageData, 0, 0);
          }

          const resultDataUrl = this.canvas.toDataURL("image/png");

          resolve({
            dataUrl: resultDataUrl,
            canvas: this.canvas,
            orientation,
            width: w,
            height: h,
          });
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(img.src);
        reject(new Error("Impossible de charger l'image"));
      };
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Traiter une zone extraite d'image
   */
  async processZone(imageDataUrl, options = {}) {
    return new Promise((resolve, reject) => {
      const img = new Image();

      img.onload = () => {
        try {
          this.canvas.width = img.width;
          this.canvas.height = img.height;

          this.ctx.drawImage(img, 0, 0);
          let imageData = this.ctx.getImageData(
            0,
            0,
            this.canvas.width,
            this.canvas.height,
          );

          // Appliquer transformations
          if (options.improveContrast)
            imageData = this.improveContrast(imageData);
          if (options.denoise) imageData = this.denoise(imageData);
          if (options.binarize) imageData = this.binarize(imageData);

          this.ctx.putImageData(imageData, 0, 0);
          const result = this.canvas.toDataURL("image/png");

          resolve(result);
        } catch (error) {
          reject(error);
        }
      };

      img.onerror = () => reject(new Error("Impossible de charger l'image"));
      img.src = imageDataUrl;
    });
  }
}

// Export
window.ImagePreprocessor = ImagePreprocessor;

/**
 * Zone Selector Module — Sélection de zone sur image
 *
 * Pattern :
 *   1. Pose initiale en 2 taps : coin 1 → coin 2 → rectangle créé
 *   2. Ajustement : drag des 4 poignées de coin (pointer events unifiés
 *      touch + mouse + stylet), contraint aux bornes de l'image et à
 *      une taille minimale (30×30 px).
 *
 * Cibles tactiles : rayon de tolérance 22 px canvas autour de chaque coin
 * (≥ cible AAA 44×44). Dessin agrandi avec halo blanc pour visibilité.
 *
 * Presets : image entière, A4, moitié sup, tiers sup.
 */

class ZoneSelector {
  constructor(imageElement, containerElement) {
    this.image = imageElement;
    this.container = containerElement;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");

    // Zone sélectionnée (coordonnées image originale)
    this.rect = { x: 0, y: 0, width: 0, height: 0 };

    // État du mode pose initiale
    this.tap1 = null;
    this.tap2 = null;
    this.rectCreated = false;

    // État du drag
    this.activeHandle = null; // 'tl' | 'tr' | 'bl' | 'br'
    this.dragStartImg = null; // point de départ (coord image)
    this.dragStartRect = null; // rect au début du drag
    this.activePointerId = null;

    // Échelle d'affichage et tolérance de hit test (canvas px)
    this.displayScale = 1;
    this.handleHitRadius = 22; // ~44px diamètre

    this.init();
  }

  init() {
    const natW = this.image.naturalWidth || this.image.width;
    const natH = this.image.naturalHeight || this.image.height;

    const containerWidth = this.container.clientWidth || 300;
    this.displayScale = Math.min(containerWidth / natW, 1);

    this.canvas.width = Math.round(natW * this.displayScale);
    this.canvas.height = Math.round(natH * this.displayScale);
    this.canvas.className = "zone-canvas";
    this.canvas.style.display = "block";
    this.canvas.style.maxWidth = "100%";
    this.canvas.style.borderRadius = "8px";
    this.canvas.style.cursor = "crosshair";
    this.canvas.style.touchAction = "none"; // empêche pan/zoom natif

    this.image.style.display = "none";
    this.image.parentElement.insertBefore(this.canvas, this.image.nextSibling);

    // Pointer Events : unifie touch + mouse + stylet sur tous navigateurs modernes
    this.canvas.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    this.canvas.addEventListener("pointermove", (e) => this._onPointerMove(e));
    this.canvas.addEventListener("pointerup", (e) => this._onPointerUp(e));
    this.canvas.addEventListener("pointercancel", (e) => this._onPointerUp(e));

    // Sélection par défaut : image entière (état "pas encore posé")
    this.applyPreset("full");
    this.rectCreated = false; // applyPreset force rectCreated=true, on reset
  }

  // ---------------------------------------------------------------------
  // Pointer handlers
  // ---------------------------------------------------------------------

  _onPointerDown(e) {
    // Un seul pointeur à la fois (évite les conflits multi-touch)
    if (this.activePointerId !== null) return;

    const img = this._pointerToImageCoords(e);

    // Si un rectangle existe, tester la proximité avec un coin
    if (this.rectCreated) {
      const handle = this._hitTestHandle(img);
      if (handle) {
        this.activeHandle = handle;
        this.dragStartImg = img;
        this.dragStartRect = { ...this.rect };
        this.activePointerId = e.pointerId;
        try {
          this.canvas.setPointerCapture(e.pointerId);
        } catch {
          // Certaines vieilles implémentations refusent — on s'en passe
        }
        this.canvas.style.cursor = "grabbing";
        e.preventDefault();
        return;
      }
      // Tap hors poignée : on ne casse pas la sélection (presets = reset)
      return;
    }

    // Pose initiale : pattern 2 taps
    if (!this.tap1) {
      this.tap1 = { x: img.x, y: img.y };
      this.tap2 = null;
      this._renderWithMarker();
    } else {
      this.tap2 = { x: img.x, y: img.y };
      const x = Math.min(this.tap1.x, this.tap2.x);
      const y = Math.min(this.tap1.y, this.tap2.y);
      const w = Math.abs(this.tap2.x - this.tap1.x);
      const h = Math.abs(this.tap2.y - this.tap1.y);

      if (w < 30 || h < 30) {
        // Sélection trop petite : on annule
        this.tap1 = null;
        this.tap2 = null;
        this.applyPreset("full");
        this.rectCreated = false;
        return;
      }

      this.rect = { x, y, width: w, height: h };
      this.tap1 = null;
      this.tap2 = null;
      this.rectCreated = true;
      this.render();
    }
  }

  _onPointerMove(e) {
    if (this.activePointerId !== e.pointerId || !this.activeHandle) return;
    const img = this._pointerToImageCoords(e);
    this._applyHandleMove(this.activeHandle, img);
    this.render();
  }

  _onPointerUp(e) {
    if (this.activePointerId !== e.pointerId) return;
    this.activeHandle = null;
    this.dragStartImg = null;
    this.dragStartRect = null;
    this.activePointerId = null;
    try {
      this.canvas.releasePointerCapture(e.pointerId);
    } catch {
      // Pointer déjà relâché, on ignore
    }
    this.canvas.style.cursor = "crosshair";
  }

  // ---------------------------------------------------------------------
  // Hit testing et transformations
  // ---------------------------------------------------------------------

  _pointerToImageCoords(e) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = e.clientX - rect.left;
    const canvasY = e.clientY - rect.top;
    return {
      x: canvasX / this.displayScale,
      y: canvasY / this.displayScale,
      canvasX,
      canvasY,
    };
  }

  _hitTestHandle(img) {
    const tolImg = this.handleHitRadius / this.displayScale;
    const corners = {
      tl: { x: this.rect.x, y: this.rect.y },
      tr: { x: this.rect.x + this.rect.width, y: this.rect.y },
      bl: { x: this.rect.x, y: this.rect.y + this.rect.height },
      br: {
        x: this.rect.x + this.rect.width,
        y: this.rect.y + this.rect.height,
      },
    };
    let best = null;
    let bestDist = Infinity;
    for (const [key, c] of Object.entries(corners)) {
      const dx = img.x - c.x;
      const dy = img.y - c.y;
      const d = Math.hypot(dx, dy);
      if (d < tolImg && d < bestDist) {
        best = key;
        bestDist = d;
      }
    }
    return best;
  }

  _applyHandleMove(handle, img) {
    const natW = this.image.naturalWidth || this.image.width;
    const natH = this.image.naturalHeight || this.image.height;
    const MIN = 30;

    // Clamper le point dans l'image
    const px = Math.max(0, Math.min(natW, img.x));
    const py = Math.max(0, Math.min(natH, img.y));

    const r = { ...this.rect };

    switch (handle) {
      case "tl": {
        const maxX = r.x + r.width - MIN;
        const maxY = r.y + r.height - MIN;
        const nx = Math.min(px, maxX);
        const ny = Math.min(py, maxY);
        r.width = r.x + r.width - nx;
        r.height = r.y + r.height - ny;
        r.x = nx;
        r.y = ny;
        break;
      }
      case "tr": {
        const minX = r.x + MIN;
        const maxY = r.y + r.height - MIN;
        const nx = Math.max(px, minX);
        const ny = Math.min(py, maxY);
        r.width = nx - r.x;
        r.height = r.y + r.height - ny;
        r.y = ny;
        break;
      }
      case "bl": {
        const maxX = r.x + r.width - MIN;
        const minY = r.y + MIN;
        const nx = Math.min(px, maxX);
        const ny = Math.max(py, minY);
        r.width = r.x + r.width - nx;
        r.height = ny - r.y;
        r.x = nx;
        break;
      }
      case "br": {
        const minX = r.x + MIN;
        const minY = r.y + MIN;
        const nx = Math.max(px, minX);
        const ny = Math.max(py, minY);
        r.width = nx - r.x;
        r.height = ny - r.y;
        break;
      }
    }

    this.rect = r;
  }

  // ---------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------

  _renderWithMarker() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.scale(this.displayScale, this.displayScale);
    this.ctx.drawImage(this.image, 0, 0);
    this.ctx.restore();

    if (this.tap1) {
      const sx = this.tap1.x * this.displayScale;
      const sy = this.tap1.y * this.displayScale;
      // Halo blanc + point bleu pour visibilité sur tout fond
      this.ctx.fillStyle = "white";
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, 12, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.fillStyle = "#2563eb";
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      this.ctx.fill();

      this.ctx.fillStyle = "rgba(37, 99, 235, 0.95)";
      this.ctx.font = "bold 14px system-ui";
      this.ctx.fillText("Touchez le coin opposé", sx + 16, sy + 5);
    }
  }

  applyPreset(presetName) {
    const natW = this.image.naturalWidth || this.image.width;
    const natH = this.image.naturalHeight || this.image.height;

    this.tap1 = null;
    this.tap2 = null;
    this.activeHandle = null;

    switch (presetName) {
      case "full":
        this.rect = { x: 0, y: 0, width: natW, height: natH };
        break;
      case "a4":
        this.rect = {
          x: 0,
          y: 0,
          width: natW,
          height: Math.min(Math.round(natW * 1.414), natH),
        };
        break;
      case "half":
        this.rect = {
          x: 0,
          y: 0,
          width: natW,
          height: Math.round(natH / 2),
        };
        break;
      case "third":
        this.rect = {
          x: 0,
          y: 0,
          width: natW,
          height: Math.round(natH / 3),
        };
        break;
      default:
        this.rect = { x: 0, y: 0, width: natW, height: natH };
    }

    this.rectCreated = true;
    this.render();
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.scale(this.displayScale, this.displayScale);

    this.ctx.drawImage(this.image, 0, 0);

    const natW = this.image.naturalWidth || this.image.width;
    const natH = this.image.naturalHeight || this.image.height;

    // Overlay sombre hors sélection
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    this.ctx.fillRect(0, 0, natW, this.rect.y);
    this.ctx.fillRect(
      0,
      this.rect.y + this.rect.height,
      natW,
      natH - this.rect.y - this.rect.height,
    );
    this.ctx.fillRect(0, this.rect.y, this.rect.x, this.rect.height);
    this.ctx.fillRect(
      this.rect.x + this.rect.width,
      this.rect.y,
      natW - this.rect.x - this.rect.width,
      this.rect.height,
    );

    // Bordure rectangle
    this.ctx.strokeStyle = "#2563eb";
    this.ctx.lineWidth = 3 / this.displayScale;
    this.ctx.strokeRect(
      this.rect.x,
      this.rect.y,
      this.rect.width,
      this.rect.height,
    );

    this.ctx.restore();

    // Poignées dessinées en coords canvas (pas scalées) pour taille constante
    const corners = [
      { x: this.rect.x, y: this.rect.y },
      { x: this.rect.x + this.rect.width, y: this.rect.y },
      { x: this.rect.x, y: this.rect.y + this.rect.height },
      { x: this.rect.x + this.rect.width, y: this.rect.y + this.rect.height },
    ];
    const outer = 14; // rayon halo (cible tactile visuelle)
    const inner = 7; // rayon centre
    for (const c of corners) {
      const cx = c.x * this.displayScale;
      const cy = c.y * this.displayScale;

      // Halo blanc pour visibilité sur fond foncé ou clair
      this.ctx.fillStyle = "white";
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, outer, 0, Math.PI * 2);
      this.ctx.fill();

      // Centre bleu plein
      this.ctx.fillStyle = "#2563eb";
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, inner, 0, Math.PI * 2);
      this.ctx.fill();

      // Contour bleu foncé pour contraste AAA sur le halo blanc
      this.ctx.strokeStyle = "#1e3a8a";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(cx, cy, outer, 0, Math.PI * 2);
      this.ctx.stroke();
    }
  }

  // ---------------------------------------------------------------------
  // API publique
  // ---------------------------------------------------------------------

  getSelectedZone() {
    const natW = this.image.naturalWidth || this.image.width;
    const natH = this.image.naturalHeight || this.image.height;
    return {
      x: this.rect.x / natW,
      y: this.rect.y / natH,
      width: this.rect.width / natW,
      height: this.rect.height / natH,
      pixelX: this.rect.x,
      pixelY: this.rect.y,
      pixelWidth: this.rect.width,
      pixelHeight: this.rect.height,
    };
  }

  extractZoneImage() {
    const canvas = document.createElement("canvas");
    canvas.width = this.rect.width;
    canvas.height = this.rect.height;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(
      this.image,
      this.rect.x,
      this.rect.y,
      this.rect.width,
      this.rect.height,
      0,
      0,
      this.rect.width,
      this.rect.height,
    );
    return canvas.toDataURL("image/png");
  }

  reset() {
    this.tap1 = null;
    this.tap2 = null;
    this.activeHandle = null;
    this.applyPreset("full");
  }
}

window.ZoneSelector = ZoneSelector;

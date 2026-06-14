/**
 * Zone Selector Module — Sélection de zone sur image (refonte 2026-06-14)
 *
 * Modèle d'interaction :
 *   - À l'ouverture, la zone = IMAGE ENTIÈRE (déjà posée, visible). On rétrécit
 *     plutôt que de dessiner — pas d'état vide, pas de pattern « 2 taps ».
 *   - Déplacer : tap-drag À L'INTÉRIEUR du rectangle le translate.
 *   - Redimensionner : tap-drag sur une des 4 poignées de coin.
 *   - Presets (boutons externes) : image entière / haut / bas.
 *   - Clavier (AAA) : 4 poignées de coin focusables (Tab) déplacées aux flèches.
 *
 * Fit-to-viewport : l'image entière tient TOUJOURS dans la modale (échelle
 * contrainte sur les deux axes), donc aucun scroll, tous les coins atteignables.
 *
 * Mapping écran→image robuste : via getBoundingClientRect (taille affichée
 * réelle), insensible à l'échelle CSS.
 */

class ZoneSelector {
  constructor(imageElement, containerElement) {
    this.image = imageElement;
    this.container = containerElement;

    this.natW = imageElement.naturalWidth || imageElement.width || 1;
    this.natH = imageElement.naturalHeight || imageElement.height || 1;

    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");

    // Zone sélectionnée (coordonnées image originale)
    this.rect = { x: 0, y: 0, width: this.natW, height: this.natH };

    // État du drag (pointeur)
    this.activeHandle = null; // 'tl' | 'tr' | 'bl' | 'br' | 'move'
    this.dragStartImg = null;
    this.dragStartRect = null;
    this.activePointerId = null;

    this.displayScale = 1;
    this.handleHitRadius = 24; // ~48px diamètre (cible AAA)

    this._a11yHandles = {};
    this._liveRegion = null;

    this.init();
  }

  init() {
    this.container.style.position = "relative";

    this.canvas.className = "zone-canvas";
    this.canvas.style.display = "block";
    this.canvas.style.margin = "0 auto";
    this.canvas.style.touchAction = "none"; // pas de pan/zoom natif sur le canvas
    this.canvas.style.cursor = "grab";

    this.image.style.display = "none";
    this.container.appendChild(this.canvas);

    this.canvas.addEventListener("pointerdown", (e) => this._onPointerDown(e));
    this.canvas.addEventListener("pointermove", (e) => this._onPointerMove(e));
    this.canvas.addEventListener("pointerup", (e) => this._onPointerUp(e));
    this.canvas.addEventListener("pointercancel", (e) => this._onPointerUp(e));
    this.canvas.addEventListener("pointermove", (e) => this._onHover(e));

    this._buildA11y();

    // Le conteneur a besoin d'un layout pour connaître sa taille → 1 frame.
    requestAnimationFrame(() => {
      this._computeScale();
      this.render();
    });
    // Recalcule si l'orientation/viewport change pendant la sélection.
    this._onResize = () => {
      this._computeScale();
      this.render();
    };
    window.addEventListener("resize", this._onResize);
  }

  /** Échelle d'affichage contrainte sur LES DEUX axes → image entière visible. */
  _computeScale() {
    const maxW = this.container.clientWidth || 320;
    // Hauteur dispo : le conteneur, borné à un raisonnable si non encore mesuré.
    const maxH =
      this.container.clientHeight || Math.round(window.innerHeight * 0.5);
    this.displayScale = Math.min(maxW / this.natW, maxH / this.natH, 1);
    this.canvas.width = Math.max(1, Math.round(this.natW * this.displayScale));
    this.canvas.height = Math.max(1, Math.round(this.natH * this.displayScale));
  }

  // ---------------------------------------------------------------------
  // Mapping écran → image (robuste à l'échelle CSS)
  // ---------------------------------------------------------------------

  _pointerToImageCoords(e) {
    const r = this.canvas.getBoundingClientRect();
    // clientWidth/clientLeft = zone de contenu hors bordure → mapping exact
    const cw = this.canvas.clientWidth || r.width || 1;
    const ch = this.canvas.clientHeight || r.height || 1;
    return {
      x: (e.clientX - r.left - this.canvas.clientLeft) * (this.natW / cw),
      y: (e.clientY - r.top - this.canvas.clientTop) * (this.natH / ch),
    };
  }

  // ---------------------------------------------------------------------
  // Pointer handlers
  // ---------------------------------------------------------------------

  _onPointerDown(e) {
    if (this.activePointerId !== null) return;
    const img = this._pointerToImageCoords(e);

    let mode = this._hitTestHandle(img);
    if (!mode && this._hitTestBody(img)) mode = "move";
    if (!mode) return; // tap hors zone : ne casse rien

    this.activeHandle = mode;
    this.dragStartImg = img;
    this.dragStartRect = { ...this.rect };
    this.activePointerId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* vieux navigateurs : on s'en passe */
    }
    this.canvas.style.cursor = mode === "move" ? "grabbing" : "crosshair";
    e.preventDefault();
  }

  _onPointerMove(e) {
    if (this.activePointerId !== e.pointerId || !this.activeHandle) return;
    const img = this._pointerToImageCoords(e);
    if (this.activeHandle === "move") this._moveRect(img);
    else this._applyHandleMove(this.activeHandle, img);
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
      /* déjà relâché */
    }
    this.canvas.style.cursor = "grab";
    this._announce();
  }

  /** Curseur contextuel au survol (souris uniquement). */
  _onHover(e) {
    if (this.activeHandle || e.pointerType === "touch") return;
    const img = this._pointerToImageCoords(e);
    if (this._hitTestHandle(img)) this.canvas.style.cursor = "crosshair";
    else if (this._hitTestBody(img)) this.canvas.style.cursor = "grab";
    else this.canvas.style.cursor = "default";
  }

  // ---------------------------------------------------------------------
  // Hit testing
  // ---------------------------------------------------------------------

  _hitTestHandle(img) {
    const tol = this.handleHitRadius / this.displayScale;
    const r = this.rect;
    const corners = {
      tl: { x: r.x, y: r.y },
      tr: { x: r.x + r.width, y: r.y },
      bl: { x: r.x, y: r.y + r.height },
      br: { x: r.x + r.width, y: r.y + r.height },
    };
    let best = null;
    let bestDist = Infinity;
    for (const [key, c] of Object.entries(corners)) {
      const d = Math.hypot(img.x - c.x, img.y - c.y);
      if (d < tol && d < bestDist) {
        best = key;
        bestDist = d;
      }
    }
    return best;
  }

  _hitTestBody(img) {
    const tol = this.handleHitRadius / this.displayScale;
    const r = this.rect;
    return (
      img.x > r.x + tol &&
      img.x < r.x + r.width - tol &&
      img.y > r.y + tol &&
      img.y < r.y + r.height - tol
    );
  }

  // ---------------------------------------------------------------------
  // Transformations
  // ---------------------------------------------------------------------

  _moveRect(img) {
    const dx = img.x - this.dragStartImg.x;
    const dy = img.y - this.dragStartImg.y;
    const r = this.dragStartRect;
    this.rect = {
      x: Math.max(0, Math.min(this.natW - r.width, r.x + dx)),
      y: Math.max(0, Math.min(this.natH - r.height, r.y + dy)),
      width: r.width,
      height: r.height,
    };
  }

  _applyHandleMove(handle, img) {
    const MIN = 30;
    const px = Math.max(0, Math.min(this.natW, img.x));
    const py = Math.max(0, Math.min(this.natH, img.y));
    const r = { ...this.rect };

    if (handle === "tl") {
      const nx = Math.min(px, r.x + r.width - MIN);
      const ny = Math.min(py, r.y + r.height - MIN);
      r.width = r.x + r.width - nx;
      r.height = r.y + r.height - ny;
      r.x = nx;
      r.y = ny;
    } else if (handle === "tr") {
      const nx = Math.max(px, r.x + MIN);
      const ny = Math.min(py, r.y + r.height - MIN);
      r.width = nx - r.x;
      r.height = r.y + r.height - ny;
      r.y = ny;
    } else if (handle === "bl") {
      const nx = Math.min(px, r.x + r.width - MIN);
      const ny = Math.max(py, r.y + MIN);
      r.width = r.x + r.width - nx;
      r.height = ny - r.y;
      r.x = nx;
    } else if (handle === "br") {
      r.width = Math.max(px, r.x + MIN) - r.x;
      r.height = Math.max(py, r.y + MIN) - r.y;
    }
    this.rect = r;
  }

  // ---------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------

  render() {
    const ctx = this.ctx;
    const s = this.displayScale;
    ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    ctx.save();
    ctx.scale(s, s);
    ctx.drawImage(this.image, 0, 0, this.natW, this.natH);

    const r = this.rect;
    // Voile sombre hors sélection
    ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    ctx.fillRect(0, 0, this.natW, r.y);
    ctx.fillRect(0, r.y + r.height, this.natW, this.natH - r.y - r.height);
    ctx.fillRect(0, r.y, r.x, r.height);
    ctx.fillRect(r.x + r.width, r.y, this.natW - r.x - r.width, r.height);

    // Bordure
    ctx.strokeStyle = "#2563eb";
    ctx.lineWidth = 3 / s;
    ctx.strokeRect(r.x, r.y, r.width, r.height);
    ctx.restore();

    // Poignées (taille constante à l'écran, dessinées hors scale)
    const corners = [
      { x: r.x, y: r.y },
      { x: r.x + r.width, y: r.y },
      { x: r.x, y: r.y + r.height },
      { x: r.x + r.width, y: r.y + r.height },
    ];
    for (const c of corners) {
      const cx = c.x * s;
      const cy = c.y * s;
      ctx.fillStyle = "white";
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#2563eb";
      ctx.beginPath();
      ctx.arc(cx, cy, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "#1e3a8a";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(cx, cy, 14, 0, Math.PI * 2);
      ctx.stroke();
    }

    this._updateA11yPositions();
  }

  // ---------------------------------------------------------------------
  // Accessibilité clavier (poignées focusables + annonce)
  // ---------------------------------------------------------------------

  _buildA11y() {
    const labels = {
      tl: "Coin haut-gauche",
      tr: "Coin haut-droit",
      bl: "Coin bas-gauche",
      br: "Coin bas-droit",
    };
    for (const key of ["tl", "tr", "bl", "br"]) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "zone-a11y-handle";
      btn.setAttribute("aria-label", labels[key] + " — flèches pour ajuster");
      // pointer-events:none → le tactile va au canvas ; le clavier (Tab) marche.
      btn.style.cssText =
        "position:absolute;width:44px;height:44px;padding:0;margin:0;" +
        "transform:translate(-50%,-50%);background:transparent;border:0;" +
        "border-radius:50%;pointer-events:none;cursor:pointer;z-index:2";
      btn.addEventListener("keydown", (e) => this._onHandleKey(key, e));
      this._a11yHandles[key] = btn;
      this.container.appendChild(btn);
    }
    // Région d'annonce
    this._liveRegion = document.createElement("span");
    this._liveRegion.className = "sr-only";
    this._liveRegion.setAttribute("aria-live", "polite");
    this.container.appendChild(this._liveRegion);
  }

  _onHandleKey(key, e) {
    const step = (e.shiftKey ? 0.1 : 0.02) * Math.max(this.natW, this.natH);
    let dx = 0;
    let dy = 0;
    if (e.key === "ArrowLeft") dx = -step;
    else if (e.key === "ArrowRight") dx = step;
    else if (e.key === "ArrowUp") dy = -step;
    else if (e.key === "ArrowDown") dy = step;
    else return;
    e.preventDefault();
    const r = this.rect;
    const corner = {
      tl: { x: r.x, y: r.y },
      tr: { x: r.x + r.width, y: r.y },
      bl: { x: r.x, y: r.y + r.height },
      br: { x: r.x + r.width, y: r.y + r.height },
    }[key];
    this._applyHandleMove(key, { x: corner.x + dx, y: corner.y + dy });
    this.render();
    this._a11yHandles[key].focus();
    this._announce();
  }

  _updateA11yPositions() {
    const s = this.displayScale;
    const r = this.rect;
    const pos = {
      tl: { x: r.x, y: r.y },
      tr: { x: r.x + r.width, y: r.y },
      bl: { x: r.x, y: r.y + r.height },
      br: { x: r.x + r.width, y: r.y + r.height },
    };
    // Décalage du canvas dans le conteneur (canvas centré horizontalement)
    const offX = this.canvas.offsetLeft;
    const offY = this.canvas.offsetTop;
    for (const key of Object.keys(this._a11yHandles)) {
      const btn = this._a11yHandles[key];
      btn.style.left = offX + pos[key].x * s + "px";
      btn.style.top = offY + pos[key].y * s + "px";
    }
  }

  _announce() {
    if (!this._liveRegion) return;
    const pctW = Math.round((this.rect.width / this.natW) * 100);
    const pctH = Math.round((this.rect.height / this.natH) * 100);
    this._liveRegion.textContent = `Zone sélectionnée : ${pctW} % de largeur, ${pctH} % de hauteur.`;
  }

  // ---------------------------------------------------------------------
  // Presets
  // ---------------------------------------------------------------------

  applyPreset(presetName) {
    this.activeHandle = null;
    const W = this.natW;
    const H = this.natH;
    switch (presetName) {
      case "top":
      case "half":
        this.rect = { x: 0, y: 0, width: W, height: Math.round(H / 2) };
        break;
      case "bottom":
        this.rect = {
          x: 0,
          y: Math.round(H / 2),
          width: W,
          height: Math.round(H / 2),
        };
        break;
      case "third":
        this.rect = { x: 0, y: 0, width: W, height: Math.round(H / 3) };
        break;
      case "full":
      default:
        this.rect = { x: 0, y: 0, width: W, height: H };
    }
    this.render();
    this._announce();
  }

  reset() {
    this.applyPreset("full");
  }

  destroy() {
    if (this._onResize) window.removeEventListener("resize", this._onResize);
  }

  // ---------------------------------------------------------------------
  // API publique : extraction
  // ---------------------------------------------------------------------

  getSelectedZone() {
    return {
      x: this.rect.x / this.natW,
      y: this.rect.y / this.natH,
      width: this.rect.width / this.natW,
      height: this.rect.height / this.natH,
      pixelX: this.rect.x,
      pixelY: this.rect.y,
      pixelWidth: this.rect.width,
      pixelHeight: this.rect.height,
    };
  }

  _buildZoneCanvas() {
    if (!this.rect || !this.rect.width || !this.rect.height) {
      this.rect = { x: 0, y: 0, width: this.natW, height: this.natH };
    }
    const sw = this.rect.width;
    const sh = this.rect.height;

    // Plafond adapté à l'appareil (anti-OOM mobile bas de gamme).
    const mem = navigator.deviceMemory;
    const cores = navigator.hardwareConcurrency || 4;
    const MAX_DIM = (mem ? mem <= 4 : cores <= 6)
      ? 1400
      : (mem ? mem <= 6 : cores <= 8)
        ? 1700
        : 2000;
    const scale = Math.min(1, MAX_DIM / Math.max(sw, sh));
    const dw = Math.max(1, Math.round(sw * scale));
    const dh = Math.max(1, Math.round(sh * scale));

    const canvas = document.createElement("canvas");
    canvas.width = dw;
    canvas.height = dh;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(this.image, this.rect.x, this.rect.y, sw, sh, 0, 0, dw, dh);
    return canvas;
  }

  // Blob PNG (pas de data: URL → compatible CSP connect-src 'self' blob:)
  extractZoneBlob() {
    return new Promise((resolve, reject) => {
      try {
        this._buildZoneCanvas().toBlob((blob) => {
          if (blob) resolve(blob);
          else reject(new Error("canvas.toBlob a renvoyé null"));
        }, "image/png");
      } catch (err) {
        reject(err);
      }
    });
  }

  extractZoneImage() {
    return this._buildZoneCanvas().toDataURL("image/png");
  }
}

window.ZoneSelector = ZoneSelector;

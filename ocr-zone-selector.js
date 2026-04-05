/**
 * Zone Selector Module - Sélection de zone sur image
 * Permet au utilisateur de dessiner un rectangle personnalisable
 */

class ZoneSelector {
  constructor(imageElement, containerElement) {
    this.image = imageElement;
    this.container = containerElement;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");

    // État du rectangle
    this.rect = {
      x: 0,
      y: 0,
      width: 0,
      height: 0,
      startX: 0,
      startY: 0,
      isDrawing: false,
    };

    // Presets configuration
    this.presets = {
      full: { name: "Image entière", ratio: null },
      a4: { name: "Format A4", ratio: 1.414 },
      half: { name: "Moitié supérieure", ratio: null },
      third: { name: "Tiers supérieur", ratio: null },
    };

    this.selectedPreset = "full";
    this.zoomLevel = 1;
    this.panX = 0;
    this.panY = 0;
    this.minWidth = 50;
    this.minHeight = 50;

    this.init();
  }

  init() {
    // Adapter la taille du canvas au conteneur (responsive mobile)
    const containerWidth = this.container.clientWidth || 300;
    const natW = this.image.naturalWidth || this.image.width;
    const natH = this.image.naturalHeight || this.image.height;
    const scale = Math.min(containerWidth / natW, 1);
    this.displayScale = scale;

    this.canvas.width = Math.round(natW * scale);
    this.canvas.height = Math.round(natH * scale);
    this.canvas.className = "zone-canvas";
    this.canvas.style.touchAction = "none";
    this.canvas.style.userSelect = "none";
    this.canvas.style.WebkitUserSelect = "none";
    this.canvas.style.display = "block";
    this.canvas.style.maxWidth = "100%";

    // Insérer après l'image
    this.image.parentElement.insertBefore(this.canvas, this.image.nextSibling);

    // Event listeners — souris
    this.canvas.addEventListener("mousedown", (e) => this.startDraw(e));
    this.canvas.addEventListener("mousemove", (e) => this.draw(e));
    this.canvas.addEventListener("mouseup", (e) => this.stopDraw(e));
    this.canvas.addEventListener("mouseleave", (e) => this.stopDraw(e));

    // Event listeners — tactile (passive: false pour pouvoir preventDefault)
    this.canvas.addEventListener(
      "touchstart",
      (e) => {
        e.preventDefault();
        this.startDraw(e);
      },
      { passive: false },
    );
    this.canvas.addEventListener(
      "touchmove",
      (e) => {
        e.preventDefault();
        this.draw(e);
      },
      { passive: false },
    );
    this.canvas.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        this.stopDraw(e);
      },
      { passive: false },
    );
    this.canvas.addEventListener(
      "touchcancel",
      (e) => {
        e.preventDefault();
        this.stopDraw(e);
      },
      { passive: false },
    );

    // Wheel zoom
    this.canvas.addEventListener("wheel", (e) => this.handleZoom(e));

    // Initialiser avec preset 'full'
    this.applyPreset("full");
  }

  getCanvasPos(e) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches[0].clientX) - rect.left;
    const y = (e.clientY || e.touches[0].clientY) - rect.top;

    // Appliquer zoom et pan
    return {
      x: (x - this.panX) / this.zoomLevel,
      y: (y - this.panY) / this.zoomLevel,
    };
  }

  startDraw(e) {
    e.preventDefault();
    const pos = this.getCanvasPos(e);

    this.rect.startX = pos.x;
    this.rect.startY = pos.y;
    this.rect.isDrawing = true;
  }

  draw(e) {
    if (!this.rect.isDrawing) return;
    e.preventDefault();

    const pos = this.getCanvasPos(e);

    this.rect.x = Math.min(this.rect.startX, pos.x);
    this.rect.y = Math.min(this.rect.startY, pos.y);
    this.rect.width = Math.abs(pos.x - this.rect.startX);
    this.rect.height = Math.abs(pos.y - this.rect.startY);

    this.render();
  }

  stopDraw(e) {
    e.preventDefault();
    this.rect.isDrawing = false;

    // Validation taille minimum
    if (this.rect.width < this.minWidth || this.rect.height < this.minHeight) {
      this.applyPreset("full");
    }

    this.render();
  }

  handleZoom(e) {
    e.preventDefault();
    const oldZoom = this.zoomLevel;
    const delta = e.deltaY > 0 ? 0.9 : 1.1;

    this.zoomLevel = Math.max(0.5, Math.min(3, this.zoomLevel * delta));

    // Zoom vers le curseur
    const pos = this.getCanvasPos(e);
    this.panX -= pos.x * (this.zoomLevel - oldZoom);
    this.panY -= pos.y * (this.zoomLevel - oldZoom);

    this.render();
  }

  applyPreset(presetName) {
    const preset = this.presets[presetName];
    if (!preset) return;

    this.selectedPreset = presetName;
    const w = this.image.naturalWidth;
    const h = this.image.naturalHeight;

    switch (presetName) {
      case "full":
        this.rect = { x: 0, y: 0, width: w, height: h, isDrawing: false };
        break;
      case "a4":
        const a4Height = w * preset.ratio;
        this.rect = {
          x: 0,
          y: 0,
          width: w,
          height: Math.min(a4Height, h),
          isDrawing: false,
        };
        break;
      case "half":
        this.rect = { x: 0, y: 0, width: w, height: h / 2, isDrawing: false };
        break;
      case "third":
        this.rect = { x: 0, y: 0, width: w, height: h / 3, isDrawing: false };
        break;
    }

    this.render();
  }

  render() {
    // Effacer
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

    // Appliquer transformations
    this.ctx.save();
    this.ctx.translate(this.panX, this.panY);
    this.ctx.scale(this.zoomLevel, this.zoomLevel);

    // Dessiner l'image
    this.ctx.drawImage(this.image, 0, 0);

    // Overlay sombre
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
    this.ctx.fillRect(0, 0, this.image.naturalWidth, this.image.naturalHeight);

    // Zone claire (sélectionnée)
    this.ctx.clearRect(
      this.rect.x,
      this.rect.y,
      this.rect.width,
      this.rect.height,
    );

    // Border du rectangle
    this.ctx.strokeStyle = "#2563eb";
    this.ctx.lineWidth = 3;
    this.ctx.strokeRect(
      this.rect.x,
      this.rect.y,
      this.rect.width,
      this.rect.height,
    );

    // Poignées de redimensionnement
    const handleSize = 8;
    this.ctx.fillStyle = "#2563eb";
    const corners = [
      { x: this.rect.x, y: this.rect.y },
      { x: this.rect.x + this.rect.width, y: this.rect.y },
      { x: this.rect.x, y: this.rect.y + this.rect.height },
      { x: this.rect.x + this.rect.width, y: this.rect.y + this.rect.height },
    ];

    corners.forEach((corner) => {
      this.ctx.fillRect(
        corner.x - handleSize / 2,
        corner.y - handleSize / 2,
        handleSize,
        handleSize,
      );
    });

    this.ctx.restore();
  }

  getSelectedZone() {
    // Retourner les coordonnées normalisées (0-1)
    const w = this.image.naturalWidth;
    const h = this.image.naturalHeight;

    return {
      x: this.rect.x / w,
      y: this.rect.y / h,
      width: this.rect.width / w,
      height: this.rect.height / h,
      // Aussi retourner les coordonnées pixels
      pixelX: this.rect.x,
      pixelY: this.rect.y,
      pixelWidth: this.rect.width,
      pixelHeight: this.rect.height,
    };
  }

  extractZoneImage() {
    // Créer une nouvelle canvas avec la zone sélectionnée
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
    this.applyPreset("full");
  }
}

// Export
window.ZoneSelector = ZoneSelector;

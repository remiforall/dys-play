/**
 * Zone Selector Module - Sélection de zone sur image
 * Mode 2 taps : tap coin 1, tap coin 2 → zone sélectionnée
 * Presets : image entière, A4, moitié sup, tiers sup
 */

class ZoneSelector {
  constructor(imageElement, containerElement) {
    this.image = imageElement;
    this.container = containerElement;
    this.canvas = document.createElement("canvas");
    this.ctx = this.canvas.getContext("2d");

    // Zone sélectionnée (coordonnées image originale)
    this.rect = { x: 0, y: 0, width: 0, height: 0 };

    // État du mode 2 taps
    this.tap1 = null; // Premier tap (coin)
    this.tap2 = null; // Deuxième tap (coin opposé)

    // Ratio d'affichage
    this.displayScale = 1;

    this.init();
  }

  init() {
    // Dimensions de l'image originale
    const natW = this.image.naturalWidth || this.image.width;
    const natH = this.image.naturalHeight || this.image.height;

    // Adapter au conteneur
    const containerWidth = this.container.clientWidth || 300;
    this.displayScale = Math.min(containerWidth / natW, 1);

    this.canvas.width = Math.round(natW * this.displayScale);
    this.canvas.height = Math.round(natH * this.displayScale);
    this.canvas.className = "zone-canvas";
    this.canvas.style.display = "block";
    this.canvas.style.maxWidth = "100%";
    this.canvas.style.borderRadius = "8px";
    this.canvas.style.cursor = "crosshair";

    // Insérer après l'image (l'image sera cachée)
    this.image.style.display = "none";
    this.image.parentElement.insertBefore(this.canvas, this.image.nextSibling);

    // Clic / tap → sélection par 2 points
    this.canvas.addEventListener("click", (e) => this._handleTap(e));
    this.canvas.addEventListener(
      "touchend",
      (e) => {
        e.preventDefault();
        // Convertir le touch en coordonnées
        const touch = e.changedTouches[0];
        this._handleTapAt(touch.clientX, touch.clientY);
      },
      { passive: false },
    );

    // Empêcher le pull-to-refresh et le scroll sur le canvas
    this.canvas.addEventListener("touchmove", (e) => e.preventDefault(), {
      passive: false,
    });

    // Sélection par défaut : image entière
    this.applyPreset("full");
  }

  _handleTap(e) {
    this._handleTapAt(e.clientX, e.clientY);
  }

  _handleTapAt(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const canvasX = clientX - rect.left;
    const canvasY = clientY - rect.top;

    // Convertir en coordonnées image originale
    const imgX = Math.round(canvasX / this.displayScale);
    const imgY = Math.round(canvasY / this.displayScale);

    if (!this.tap1) {
      // Premier tap
      this.tap1 = { x: imgX, y: imgY };
      this.tap2 = null;
      this._renderWithMarker();
    } else {
      // Deuxième tap → créer le rectangle
      this.tap2 = { x: imgX, y: imgY };
      const x = Math.min(this.tap1.x, this.tap2.x);
      const y = Math.min(this.tap1.y, this.tap2.y);
      const w = Math.abs(this.tap2.x - this.tap1.x);
      const h = Math.abs(this.tap2.y - this.tap1.y);

      // Taille minimale
      if (w < 30 || h < 30) {
        this.tap1 = null;
        this.tap2 = null;
        this.applyPreset("full");
        return;
      }

      this.rect = { x, y, width: w, height: h };
      this.tap1 = null;
      this.tap2 = null;
      this.render();
    }
  }

  _renderWithMarker() {
    // Dessiner l'image + marqueur du premier tap
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.scale(this.displayScale, this.displayScale);
    this.ctx.drawImage(this.image, 0, 0);
    this.ctx.restore();

    // Marqueur du premier point
    if (this.tap1) {
      const sx = this.tap1.x * this.displayScale;
      const sy = this.tap1.y * this.displayScale;
      this.ctx.fillStyle = "#2563eb";
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.strokeStyle = "white";
      this.ctx.lineWidth = 2;
      this.ctx.beginPath();
      this.ctx.arc(sx, sy, 8, 0, Math.PI * 2);
      this.ctx.stroke();

      // Texte d'aide
      this.ctx.fillStyle = "rgba(37, 99, 235, 0.9)";
      this.ctx.font = "bold 14px system-ui";
      this.ctx.fillText("Touchez le coin opposé", sx + 14, sy + 5);
    }
  }

  applyPreset(presetName) {
    const natW = this.image.naturalWidth || this.image.width;
    const natH = this.image.naturalHeight || this.image.height;

    this.tap1 = null;
    this.tap2 = null;

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

    this.render();
  }

  render() {
    this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
    this.ctx.save();
    this.ctx.scale(this.displayScale, this.displayScale);

    // Image complète
    this.ctx.drawImage(this.image, 0, 0);

    const natW = this.image.naturalWidth || this.image.width;
    const natH = this.image.naturalHeight || this.image.height;

    // Overlay sombre sur la zone NON sélectionnée
    this.ctx.fillStyle = "rgba(0, 0, 0, 0.45)";
    // Haut
    this.ctx.fillRect(0, 0, natW, this.rect.y);
    // Bas
    this.ctx.fillRect(
      0,
      this.rect.y + this.rect.height,
      natW,
      natH - this.rect.y - this.rect.height,
    );
    // Gauche
    this.ctx.fillRect(0, this.rect.y, this.rect.x, this.rect.height);
    // Droite
    this.ctx.fillRect(
      this.rect.x + this.rect.width,
      this.rect.y,
      natW - this.rect.x - this.rect.width,
      this.rect.height,
    );

    // Bordure du rectangle sélectionné
    this.ctx.strokeStyle = "#2563eb";
    this.ctx.lineWidth = 3 / this.displayScale;
    this.ctx.strokeRect(
      this.rect.x,
      this.rect.y,
      this.rect.width,
      this.rect.height,
    );

    // Poignées aux coins
    const hs = 6 / this.displayScale;
    this.ctx.fillStyle = "#2563eb";
    [
      [this.rect.x, this.rect.y],
      [this.rect.x + this.rect.width, this.rect.y],
      [this.rect.x, this.rect.y + this.rect.height],
      [this.rect.x + this.rect.width, this.rect.y + this.rect.height],
    ].forEach(([cx, cy]) => {
      this.ctx.fillRect(cx - hs, cy - hs, hs * 2, hs * 2);
    });

    this.ctx.restore();
  }

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
    this.applyPreset("full");
  }
}

// Export
window.ZoneSelector = ZoneSelector;

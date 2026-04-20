# libs/ — dépendances locales (zéro CDN)

Toutes les libs sont servies depuis le domaine Dys-Play — souveraineté numérique, zéro tracker.

## Structure

```
libs/
├── pdf.min.js                       PDF.js v3.11 — extraction texte
├── pdf.worker.min.js                Worker PDF.js
└── tesseract/                       Tesseract.js v7 (ESM, migration 2026-04-20)
    ├── tesseract.esm.min.js         Entry point ES module (~62 Ko)
    ├── worker.min.js                Worker OCR (~110 Ko)
    ├── tesseract-core-simd.wasm     Noyau WASM SIMD (~3,3 Mo)
    ├── tesseract-core-simd.wasm.js  Loader WASM (~4,6 Mo)
    └── langs/                       Modèles de langue (tessdata_fast)
        ├── fra.traineddata          Français (~1,1 Mo)
        ├── eng.traineddata          Anglais (~3,9 Mo)
        └── ara.traineddata          Arabe (~1,4 Mo)
```

## Chargement

- `libs/pdf.min.js` est chargé en `<script defer>` dans `index.html`
- `libs/tesseract/*` est chargé **dynamiquement** (import ES) par `modules/ocr-engine.js` au premier usage OCR. Aucun Mo téléchargé avant le premier scan.
- Les `.traineddata` sont mis en cache IndexedDB par Tesseract après le 1er scan d'une langue (`cachePath: '.'` dans `createOCRService`).

## Rafraîchir depuis les sources

```bash
# Tesseract.js v7 + core SIMD depuis jsdelivr
BASE_JS="https://cdn.jsdelivr.net/npm/tesseract.js@7/dist"
BASE_CORE="https://cdn.jsdelivr.net/npm/tesseract.js-core@7"
curl -sSL "$BASE_JS/tesseract.esm.min.js"           -o libs/tesseract/tesseract.esm.min.js
curl -sSL "$BASE_JS/worker.min.js"                  -o libs/tesseract/worker.min.js
curl -sSL "$BASE_CORE/tesseract-core-simd.wasm"     -o libs/tesseract/tesseract-core-simd.wasm
curl -sSL "$BASE_CORE/tesseract-core-simd.wasm.js"  -o libs/tesseract/tesseract-core-simd.wasm.js

# Traineddata depuis tessdata_fast (modèles légers, précision suffisante)
BASE_LANG="https://github.com/tesseract-ocr/tessdata_fast/raw/main"
curl -sSL "$BASE_LANG/fra.traineddata" -o libs/tesseract/langs/fra.traineddata
curl -sSL "$BASE_LANG/eng.traineddata" -o libs/tesseract/langs/eng.traineddata
curl -sSL "$BASE_LANG/ara.traineddata" -o libs/tesseract/langs/ara.traineddata
```

Vérifier : `file libs/tesseract/*.wasm` → « WebAssembly binary » et `file libs/tesseract/langs/*.traineddata` → « data ». Tout fichier < 10 Ko = signe d'un HTML d'erreur — refaire le téléchargement.

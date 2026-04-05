# Dossier libs - Bibliothèques Externes

Ce dossier contient les dépendances locales pour le fonctionnement offline.

## Tesseract.js (OCR)

Pour un fonctionnement offline complet, téléchargez Tesseract.js:

### Option 1: CDN (par défaut)
L'application utilise Tesseract.js depuis le CDN dans `app.js`.

### Option 2: Installation locale
1. Créer le dossier `libs/tesseract/`
2. Télécharger les fichiers depuis: https://github.com/naptha/tesseract.js
3. Ou installer via npm:
```bash
npm install tesseract.js
cp node_modules/tesseract.js/dist/tesseract.min.js libs/
```

## Structure attendue
```
libs/
├── tesseract.min.js    # OCR Engine
├── worker.min.js        # Web Worker
└── traineddata/        # Langues (fra, eng, ara)
    ├── fra.traineddata
    ├── eng.traineddata
    └── ara.traineddata
```

## Note
Les fichiers traineddata sont volumineux (~20MB par langue).
L'application les chargera automatiquement depuis le CDN si pas disponibles localement.

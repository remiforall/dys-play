# 🔤 Polices de Caractère - Dys-Play

Ce dossier contient la configuration et les fichiers des polices utilisées par Dys-Play.

## Polices Intégrées

### OpenDyslexic
- **Description**: Police optimisée pour les personnes dyslexiques
- **Fichiers**: `OpenDyslexic-Regular.woff2`, `OpenDyslexic-Bold.woff2`
- **Source**: https://github.com/antijingoist/open-dyslexic
- **License**: MIT

### Comic Neue
- **Description**: Police claire et aérée, variante moderne du Comic Sans
- **Fichiers**: `ComicNeue-Regular.woff2`, `ComicNeue-Bold.woff2`
- **Source**: https://github.com/crommie/comic-neue
- **License**: SIL Open Font License

## 📥 Installation des Polices

### Automatique (avec bash)
```bash
cd fonts/
chmod +x download-fonts.sh
./download-fonts.sh
```

### Manuel
Téléchargez les fichiers WOFF2 depuis les sources officielles et placez-les dans ce dossier:

**OpenDyslexic**:
- https://github.com/antijingoist/open-dyslexic/raw/master/fonts/OpenDyslexic-Regular.woff2
- https://github.com/antijingoist/open-dyslexic/raw/master/fonts/OpenDyslexic-Bold.woff2

**Comic Neue**:
- https://github.com/crommie/comic-neue/raw/master/dist/ComicNeue-Regular.woff2
- https://github.com/crommie/comic-neue/raw/master/dist/ComicNeue-Bold.woff2

## 📋 Structure Attendue

```
fonts/
├── fonts.css                          # Règles @font-face
├── download-fonts.sh                  # Script de téléchargement
├── README.md                          # Ce fichier
├── OpenDyslexic-Regular.woff2         # Fichiers de polices
├── OpenDyslexic-Bold.woff2
├── ComicNeue-Regular.woff2
└── ComicNeue-Bold.woff2
```

## ⚙️ Configuration

Le fichier `fonts.css` est inclus dans `index.html` et contient:
- Les règles `@font-face` pour OpenDyslexic et Comic Neue
- Les chemins relatifs vers les fichiers WOFF2
- Support fallback pour WOFF

## 🚀 Intégration dans l'App

Les polices sont disponibles dans les sélecteurs:
- **Page d'onboarding**: Configuration initiale de la police
- **Paramètres** (menu): Changement dynamique de la police
- **Stockage**: Le choix est sauvegardé en localStorage

## 📊 Performance

- **WOFF2**: Format compressé moderne (~40 KB par police)
- **WOFF**: Fallback pour navigateurs plus anciens (~60 KB par police)
- **font-display: swap**: Affichage du texte immédiat avec remplacement des polices
- **Pas de requêtes externes**: Les polices sont servies localement

## ✅ Vérification

Après téléchargement, vérifiez que les fichiers sont présents:
```bash
ls -lh fonts/*.woff*
```

Devrait afficher quelque chose comme:
```
-rw-r--r--  ComicNeue-Bold.woff2 (~35 KB)
-rw-r--r--  ComicNeue-Regular.woff2 (~35 KB)
-rw-r--r--  OpenDyslexic-Bold.woff2 (~45 KB)
-rw-r--r--  OpenDyslexic-Regular.woff2 (~45 KB)
```

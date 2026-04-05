#!/bin/bash
# Script pour télécharger les polices OpenDyslexic et Comic Neue
# Ce script doit être exécuté depuis le dossier du projet

FONTS_DIR="./fonts"
mkdir -p "$FONTS_DIR"

echo "📥 Téléchargement des polices..."

# OpenDyslexic Regular
echo "⬇️ OpenDyslexic Regular (woff2)..."
curl -L -o "$FONTS_DIR/OpenDyslexic-Regular.woff2" \
  "https://github.com/antijingoist/open-dyslexic/raw/master/fonts/OpenDyslexic-Regular.woff2"

echo "⬇️ OpenDyslexic Regular (woff)..."
curl -L -o "$FONTS_DIR/OpenDyslexic-Regular.woff" \
  "https://github.com/antijingoist/open-dyslexic/raw/master/fonts/OpenDyslexic-Regular.woff"

# OpenDyslexic Bold
echo "⬇️ OpenDyslexic Bold (woff2)..."
curl -L -o "$FONTS_DIR/OpenDyslexic-Bold.woff2" \
  "https://github.com/antijingoist/open-dyslexic/raw/master/fonts/OpenDyslexic-Bold.woff2"

echo "⬇️ OpenDyslexic Bold (woff)..."
curl -L -o "$FONTS_DIR/OpenDyslexic-Bold.woff" \
  "https://github.com/antijingoist/open-dyslexic/raw/master/fonts/OpenDyslexic-Bold.woff"

# Comic Neue Regular
echo "⬇️ Comic Neue Regular (woff2)..."
curl -L -o "$FONTS_DIR/ComicNeue-Regular.woff2" \
  "https://github.com/crommie/comic-neue/raw/master/dist/ComicNeue-Regular.woff2"

echo "⬇️ Comic Neue Regular (woff)..."
curl -L -o "$FONTS_DIR/ComicNeue-Regular.woff" \
  "https://github.com/crommie/comic-neue/raw/master/dist/ComicNeue-Regular.woff"

# Comic Neue Bold
echo "⬇️ Comic Neue Bold (woff2)..."
curl -L -o "$FONTS_DIR/ComicNeue-Bold.woff2" \
  "https://github.com/crommie/comic-neue/raw/master/dist/ComicNeue-Bold.woff2"

echo "⬇️ Comic Neue Bold (woff)..."
curl -L -o "$FONTS_DIR/ComicNeue-Bold.woff" \
  "https://github.com/crommie/comic-neue/raw/master/dist/ComicNeue-Bold.woff"

echo "✅ Téléchargement terminé!"
echo "📂 Les polices sont disponibles dans le dossier ./fonts/"
echo ""
echo "📝 Vérifiez que les fichiers suivants sont présents:"
ls -lh "$FONTS_DIR"/*.woff*

# Dys-Play

**Application web progressive d'aide a la lecture pour les personnes dyslexiques, dysorthographiques et TDA/H.**

Dys-Play transforme n'importe quel texte pour faciliter la lecture : police adaptee, espacement personnalisable, syllabation coloree, regle de lecture, synthese vocale.

## Fonctionnalites

- **OCR local** : photographiez un texte imprime, Dys-Play le convertit (Tesseract.js)
- **Import PDF** : extraction de texte depuis des documents PDF (PDF.js)
- **Saisie libre** : collez ou tapez directement votre texte
- **Polices adaptees** : OpenDyslexic, Comic Neue
- **Syllabation coloree** : chaque syllabe coloree differemment pour faciliter le decodage
- **Mode zebre** : lignes alternees en couleur
- **Regle de lecture (Focus Mask)** : masque de focus qui suit la ligne lue
- **Synthese vocale** : lecture a voix haute avec suivi mot par mot
- **4 themes** : clair, creme, sepia, sombre
- **i18n** : francais, anglais, arabe (RTL)
- **Bibliotheque locale** : sauvegarde des textes dans IndexedDB
- **PWA** : fonctionne hors-ligne, installable sur mobile

## Vie privee

- Zero collecte de donnees
- Zero cookie, zero tracker, zero CDN externe
- Tout le traitement se fait localement dans le navigateur
- Conforme RGPD

## Installation locale

```bash
cd dys-play
python3 -m http.server 8080
# Ouvrir http://localhost:8080
```

## Stack technique

- HTML / CSS / JavaScript vanilla (zero framework)
- Tesseract.js v5.1.1 (OCR local)
- PDF.js v3.11 (extraction texte PDF)
- Service Worker pour le mode hors-ligne
- IndexedDB + localStorage pour la persistance

## Accessibilite

- Cible WCAG 2.2 AAA
- Navigation clavier complete
- Support lecteurs d'ecran (ARIA)
- Contrastes verifies sur les 4 themes
- Cibles tactiles minimum 44x44px
- Support RTL (arabe)
- `prefers-reduced-motion`, `prefers-contrast`, `forced-colors`

## Licence

Projet open-source par PostHack.

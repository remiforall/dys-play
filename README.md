# Dys-Play

**Application web progressive d'aide à la lecture pour les personnes dyslexiques, dysorthographiques et TDA/H.**

Dys-Play transforme n'importe quel texte pour faciliter la lecture : police adaptée, espacement personnalisable, syllabation colorée, règle de lecture, synthèse vocale.

- **Application** : https://dys-play.net
- **Aide et premiers pas** : https://dys-play.net/aide.html
- **À propos (mission, sources, licences)** : https://dys-play.net/a-propos.html
- **Soutenir le projet** : https://liberapay.com/PostHack/donate

## Fonctionnalités

- **OCR local** : photographie un texte imprimé, Dys-Play le convertit (Tesseract.js v7, WASM, 100 % dans le navigateur)
- **Import PDF** : extraction de texte depuis des documents PDF (PDF.js)
- **Saisie libre** : colle ou tape directement ton texte
- **Polices adaptées** : Luciole (recommandée), Atkinson Hyperlegible, Comic Neue, OpenDyslexic (expérimentale)
- **Syllabation colorée** : chaque syllabe colorée différemment pour faciliter le décodage
- **Mode zèbre** : lignes alternées en couleur
- **Règle de lecture** : guidage visuel ligne à ligne, 4 modes
- **Synthèse vocale** : lecture à voix haute avec suivi mot par mot
- **4 thèmes** : clair, crème, sépia, sombre
- **i18n** : français, anglais, arabe (RTL)
- **Bibliothèque locale** : sauvegarde des textes dans IndexedDB
- **PWA** : fonctionne hors-ligne, installable sur mobile ; scan hors-ligne activable dans les réglages

## Vie privée

- Zéro collecte de données
- Zéro cookie, zéro tracker, zéro CDN externe
- Tout le traitement se fait localement dans le navigateur
- Conforme RGPD

## Installation locale

```bash
cd dys-play
python3 -m http.server 8080
# Ouvrir http://localhost:8080
```

## Stack technique

- HTML / CSS / JavaScript vanilla (zéro framework, zéro bundler)
- Tesseract.js v7 ESM (OCR local, WASM SIMD) + pipeline de prétraitement maison (Sauvola adaptatif, deskew)
- PDF.js v3.11 (extraction texte PDF)
- Service Worker pour le mode hors-ligne
- IndexedDB + localStorage pour la persistance

## Accessibilité

- Cible RGAA 4.1.2 / WCAG 2.1 AA (conformité partielle en cours, audit externe planifié)
- Navigation clavier complète
- Support lecteurs d'écran (ARIA)
- Contrastes vérifiés sur les 4 thèmes
- Cibles tactiles 56×56 px
- Support RTL (arabe)
- `prefers-reduced-motion`, `prefers-contrast`, `forced-colors`

Voir la [déclaration d'accessibilité](https://dys-play.net/accessibilite.html).

## Licence

Dys-Play est un logiciel libre publié sous licence **GNU AGPL-3.0** (voir [LICENSE](LICENSE)) par PostHack.

Les composants tiers embarqués (Tesseract.js, PDF.js, polices) sont listés avec leurs licences dans [CREDITS.md](CREDITS.md).

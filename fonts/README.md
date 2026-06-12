# Polices de caractères — Dys-Play

Ce dossier contient les fichiers WOFF2 des polices distribuées avec Dys-Play
et les règles `@font-face` (`fonts.css`). Toutes les polices sont servies
localement — zéro CDN.

## Polices intégrées

### Luciole (recommandée)

- **Description** : police conçue par le CTRDV et le studio typographies.fr,
  démarche académique française (soutien du ministère de la Culture)
- **Fichiers** : `Luciole-Regular.woff2`, `Luciole-Bold.woff2`
- **Source** : https://luciole-vision.com
- **Licence** : Creative Commons Attribution 4.0 (CC-BY 4.0)

### Atkinson Hyperlegible

- **Description** : maximise la distinction entre lettres proches (b/d, i/l)
- **Fichiers** : `AtkinsonHyperlegible-Regular.woff2`, `AtkinsonHyperlegible-Bold.woff2`
- **Source** : https://brailleinstitute.org/freefont
- **Licence** : SIL Open Font License 1.1

### Comic Neue

- **Description** : police claire et aérée, variante moderne du Comic Sans
- **Fichiers** : `ComicNeue-Regular.woff2`, `ComicNeue-Bold.woff2`
- **Source** : https://github.com/crozynski/comicneue
- **Licence** : SIL Open Font License 1.1

### OpenDyslexic (expérimentale)

- **Description** : police expérimentale — les études (Wery & Diliberto 2017,
  Kuster et al. 2018) ne montrent pas de bénéfice propre à la forme des lettres
- **Fichiers** : `OpenDyslexic-Regular.woff2`, `OpenDyslexic-Bold.woff2`
- **Source** : https://opendyslexic.org
- **Licence** : SIL Open Font License 1.1

## Règles projet

- Ordre imposé dans les sélecteurs : Luciole → Atkinson Hyperlegible → Système
  → Arial/Verdana → Comic Neue → OpenDyslexic → Georgia (cf. CLAUDE.md)
- `font-display: swap` obligatoire
- Vérifier après tout ajout que le fichier est une vraie fonte :
  `file *.woff2` → « Web Open Font Format (Version 2) »

## Vérification

```bash
ls -lh fonts/*.woff2
file fonts/*.woff2
```

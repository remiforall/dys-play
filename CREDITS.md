# Crédits et licences — Dys-Play

Dys-Play est publié sous licence **GNU AGPL-3.0** (voir [LICENSE](LICENSE)).
© PostHack — Rémi Vincent.

L'application embarque les composants tiers suivants, tous servis localement
(aucun CDN, aucune requête externe à l'exécution).

## Composants logiciels

| Composant                                                 | Version                    | Licence    | Source                                         |
| --------------------------------------------------------- | -------------------------- | ---------- | ---------------------------------------------- |
| Tesseract.js (moteur OCR JavaScript)                      | v7 (ESM)                   | Apache 2.0 | https://github.com/naptha/tesseract.js         |
| tesseract-core (WASM SIMD)                                | livré avec Tesseract.js v7 | Apache 2.0 | https://github.com/naptha/tesseract.js-core    |
| Modèles de reconnaissance `tessdata_fast` (fra, eng, ara) | —                          | Apache 2.0 | https://github.com/tesseract-ocr/tessdata_fast |
| PDF.js (extraction de texte PDF)                          | v3.11                      | Apache 2.0 | https://mozilla.github.io/pdf.js/              |

## Polices de caractères

| Police                | Licence     | Auteur / éditeur                                                        | Source                                |
| --------------------- | ----------- | ----------------------------------------------------------------------- | ------------------------------------- |
| Luciole               | CC-BY 4.0   | CTRDV / typographies.fr (projet soutenu par le ministère de la Culture) | https://luciole-vision.com            |
| Atkinson Hyperlegible | SIL OFL 1.1 | Braille Institute of America                                            | https://brailleinstitute.org/freefont |
| OpenDyslexic          | SIL OFL 1.1 | Abbie Gonzalez                                                          | https://opendyslexic.org              |
| Comic Neue            | SIL OFL 1.1 | Craig Rozynski                                                          | https://comicneue.com                 |

Les autres polices proposées (Arial, Verdana, Georgia, police système) ne sont
pas distribuées avec l'application : elles sont utilisées uniquement si elles
sont déjà présentes sur l'appareil.

## Sources scientifiques citées

- Zorzi et al. (2012), _Extra-large letter spacing improves reading in dyslexia_, PNAS — espacement des lettres et des mots.
- Ding et al. (CHI 2023) — règle de lecture numérique pour dyslexie et TDAH.
- Wery & Diliberto (2017), Kuster et al. (2018) — absence de preuve d'efficacité spécifique des polices « dyslexie » (d'où l'étiquette « expérimentale » d'OpenDyslexic).

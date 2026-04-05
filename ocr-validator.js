/**
 * OCR Validator Module - Validation et correction résultats OCR
 * Score de confiance, détection erreurs, suggestions alternatives
 */

class OCRValidator {
    constructor() {
        // Dictionnaire français basique (peut être étendu)
        this.frenchDictionary = new Set([
            'le', 'la', 'les', 'un', 'une', 'des', 'de', 'du',
            'et', 'ou', 'mais', 'donc', 'car', 'parce', 'que',
            'il', 'elle', 'ils', 'elles', 'je', 'tu', 'nous', 'vous',
            'est', 'sont', 'avoir', 'être', 'faire', 'pouvoir', 'vouloir',
            'bonjour', 'bonsoir', 'nuit', 'jour', 'matin', 'après', 'midi',
            'merci', 'oui', 'non', 'alors', 'très', 'bien', 'mal', 'bon', 'mauvais',
            'texte', 'document', 'page', 'ligne', 'mot', 'phrase', 'texte',
            'maison', 'école', 'travail', 'famille', 'amis', 'gens', 'monde',
            'temps', 'année', 'mois', 'semaine', 'heure', 'minute', 'seconde',
            'avec', 'sans', 'pour', 'par', 'dans', 'sur', 'sous', 'entre',
            'aller', 'venir', 'partir', 'rester', 'entrer', 'sortir', 'monter', 'descendre',
            'lire', 'écrire', 'regarder', 'écouter', 'parler', 'dire', 'penser', 'savoir'
        ]);
        
        this.englishDictionary = new Set([
            'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'of', 'for',
            'is', 'are', 'was', 'were', 'be', 'have', 'has', 'had', 'do', 'does', 'did',
            'can', 'could', 'will', 'would', 'should', 'may', 'might', 'must', 'shall',
            'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them',
            'this', 'that', 'these', 'those', 'my', 'your', 'his', 'her', 'its', 'our', 'their',
            'hello', 'goodbye', 'yes', 'no', 'please', 'thank', 'thanks', 'sorry', 'excuse',
            'good', 'bad', 'big', 'small', 'long', 'short', 'new', 'old', 'high', 'low',
            'text', 'document', 'page', 'word', 'letter', 'line', 'paragraph'
        ]);
        
        // Erreurs OCR courantes
        this.commonErrors = {
            '0': ['O'], // zéro -> lettre O
            '1': ['l', 'I'], // 1 -> l ou I
            '8': ['B'],
            'S': ['5'],
            '5': ['S'],
            'l': ['1', 'I'],
            'I': ['1', 'l'],
            'O': ['0'],
            'rn': ['m'],
            'm': ['rn'],
            'fi': ['f', 'i'],
            'fl': ['f', 'l'],
            'cl': ['d'],
            'd': ['cl'],
        };
        
        // Diacritiques à corriger
        this.diacriticsMap = {
            'é': ['e'],
            'è': ['e'],
            'ê': ['e'],
            'ë': ['e'],
            'à': ['a'],
            'â': ['a'],
            'ü': ['u'],
            'ù': ['u'],
            'û': ['u'],
            'ô': ['o'],
            'ç': ['c'],
            'î': ['i'],
            'ï': ['i']
        };
    }

    /**
     * Analyser résultats Tesseract (data.result)
     */
    analyzeResults(tesseractData) {
        const results = [];
        
        if (tesseractData.paragraphs) {
            tesseractData.paragraphs.forEach(paragraph => {
                if (paragraph.lines) {
                    paragraph.lines.forEach(line => {
                        if (line.words) {
                            line.words.forEach(word => {
                                results.push({
                                    text: word.text,
                                    confidence: word.confidence / 100,
                                    bbox: word.bbox
                                });
                            });
                        }
                    });
                }
            });
        }
        
        return results;
    }

    /**
     * Calculer confiance globale
     */
    getOverallConfidence(text, tesseractData = null) {
        if (tesseractData) {
            // Utiliser données Tesseract si disponibles
            const words = this.analyzeResults(tesseractData);
            const avg = words.reduce((sum, w) => sum + w.confidence, 0) / words.length;
            return Math.round(avg * 100);
        }
        
        // Fallback: heuristique basique
        return this.calculateTextQuality(text);
    }

    /**
     * Qualité du texte (heuristique)
     */
    calculateTextQuality(text) {
        let score = 100;
        const words = text.toLowerCase().split(/\s+/);
        
        // Pénalité pour mots suspects
        words.forEach(word => {
            if (word.length < 2) return; // Ignorer mots courts
            
            // Vérifier si mot est reconnaissable
            const foundLang = this.getDictionary();
            const isValid = foundLang.has(word) || this.isSimilarToWord(word, foundLang);
            
            if (!isValid && word.length > 2) {
                score -= 5;
            }
        });
        
        // Pénalité pour caractères suspects
        const suspectChars = (text.match(/[0O][lI1][m\/\\|]/g) || []).length;
        score -= suspectChars * 2;
        
        return Math.max(0, score);
    }

    /**
     * Obtenir dictionnaire selon langue
     */
    getDictionary(lang = 'fr') {
        return lang === 'en' ? this.englishDictionary : this.frenchDictionary;
    }

    /**
     * Distance de Levenshtein
     */
    levenshteinDistance(a, b) {
        const m = a.length;
        const n = b.length;
        const d = [];
        
        for (let i = 0; i <= m; i++) d[i] = [i];
        for (let j = 0; j <= n; j++) d[0][j] = j;
        
        for (let i = 1; i <= m; i++) {
            for (let j = 1; j <= n; j++) {
                const cost = a[i - 1] === b[j - 1] ? 0 : 1;
                d[i][j] = Math.min(
                    d[i - 1][j] + 1,
                    d[i][j - 1] + 1,
                    d[i - 1][j - 1] + cost
                );
            }
        }
        
        return d[m][n];
    }

    /**
     * Similarité au dictionnaire
     */
    isSimilarToWord(word, dictionary, maxDistance = 2) {
        for (const dictWord of dictionary) {
            const distance = this.levenshteinDistance(word, dictWord);
            if (distance <= maxDistance) {
                return true;
            }
        }
        return false;
    }

    /**
     * Suggestions pour un mot
     */
    suggestCorrections(word, dictionary = null, lang = 'fr') {
        if (!dictionary) {
            dictionary = this.getDictionary(lang);
        }
        
        const suggestions = [];
        const lowerWord = word.toLowerCase();
        
        // Chercher mots proches par distance Levenshtein
        for (const dictWord of dictionary) {
            const distance = this.levenshteinDistance(lowerWord, dictWord);
            
            if (distance > 0 && distance <= 2) {
                suggestions.push({
                    word: dictWord,
                    distance: distance,
                    score: 1 / (distance + 1)
                });
            }
        }
        
        // Corriger erreurs OCR courantes
        for (const [pattern, replacements] of Object.entries(this.commonErrors)) {
            if (word.includes(pattern)) {
                replacements.forEach(replacement => {
                    const corrected = word.replaceAll(pattern, replacement);
                    if (dictionary.has(corrected.toLowerCase())) {
                        suggestions.push({
                            word: corrected,
                            reason: 'erreur OCR commune',
                            score: 0.8
                        });
                    }
                });
            }
        }
        
        // Trier par score
        suggestions.sort((a, b) => b.score - a.score);
        
        return suggestions.slice(0, 3); // Top 3
    }

    /**
     * Valider et corriger texte complet
     */
    validateAndCorrect(text, lang = 'fr', autoCorrect = true) {
        const dictionary = this.getDictionary(lang);
        const words = text.split(/(\s+)/);
        
        const validated = words.map(word => {
            if (!/\S/.test(word)) return word; // Espacements
            
            const lowerWord = word.toLowerCase();
            const cleanWord = word.replace(/[.,!?;:'"]/g, '');
            
            // Vérifier si valide
            if (dictionary.has(cleanWord.toLowerCase())) {
                return {
                    original: word,
                    corrected: word,
                    isValid: true,
                    confidence: 1.0
                };
            }
            
            // Chercher corrections
            const suggestions = this.suggestCorrections(cleanWord, dictionary, lang);
            
            if (suggestions.length > 0) {
                const best = suggestions[0];
                return {
                    original: word,
                    corrected: autoCorrect ? best.word : word,
                    isValid: false,
                    confidence: best.score,
                    suggestions: suggestions,
                    autoCorrectApplied: autoCorrect && best.score > 0.7
                };
            }
            
            return {
                original: word,
                corrected: word,
                isValid: false,
                confidence: 0.3,
                suggestions: []
            };
        });
        
        return {
            original: text,
            corrected: validated.map(w => w.corrected).join(''),
            words: validated,
            qualityScore: this.calculateTextQuality(text),
            issues: validated.filter(w => !w.isValid)
        };
    }

    /**
     * Analyse de confiance par mot
     */
    highlightProblematicWords(text, lang = 'fr') {
        const validation = this.validateAndCorrect(text, lang, false);
        
        return validation.words.map(wordObj => {
            if (!wordObj.isValid) {
                return {
                    ...wordObj,
                    html: `<span class="ocr-error" title="Alternatives: ${
                        wordObj.suggestions.map(s => s.word).join(', ')
                    }">${wordObj.original}</span>`
                };
            }
            return {
                ...wordObj,
                html: wordObj.original
            };
        });
    }

    /**
     * Exporter résultats avec métadonnées
     */
    exportResults(text, confidence, validation = null) {
        return {
            text: text,
            confidence: confidence,
            validation: validation,
            timestamp: new Date().toISOString(),
            metadata: {
                length: text.length,
                wordCount: text.split(/\s+/).length,
                hasNumbers: /\d/.test(text),
                hasSpecialChars: /[^a-zA-Z0-9\s\.,!?;:—\-'"à-ÿÀ-Ÿ]/g.test(text)
            }
        };
    }
}

// Export
window.OCRValidator = OCRValidator;

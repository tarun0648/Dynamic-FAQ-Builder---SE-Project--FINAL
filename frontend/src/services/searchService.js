class SearchService {
  constructor() {
    this.stopWords = new Set([
      'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
      'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
      'to', 'was', 'will', 'with', 'what', 'when', 'where', 'who', 'how'
    ]);
  }

  // Tokenize and clean text
  tokenize(text) {
    if (!text) return []; // Guard against undefined text
    return text
      .toLowerCase()
      .replace(/[^\w\s]/g, ' ')
      .split(/\s+/)
      .filter(word => word.length > 2 && !this.stopWords.has(word));
  }

  // Calculate term frequency
  calculateTF(term, tokens) {
    if (tokens.length === 0) return 0;
    const count = tokens.filter(token => token === term).length;
    return count / tokens.length;
  }

  // Calculate inverse document frequency
  calculateIDF(term, documents) {
    const docsWithTerm = documents.filter(doc => 
      this.tokenize(doc.question + ' ' + doc.answer + ' ' + (doc.tags?.join(' ') || '') + ' ' + (doc.keywords?.join(' ') || ''))
        .includes(term)
    ).length;
    
    // ✅ FIXED: Use a smoothed IDF formula that is always positive
    // This prevents common terms from getting negative scores and being filtered out.
    return Math.log(1 + (documents.length / (1 + docsWithTerm)));
  }

  // Calculate TF-IDF score for a set of tokens
  calculateFieldScore(queryTokens, fieldTokens, allDocuments) {
    let score = 0;
    const uniqueQueryTerms = [...new Set(queryTokens)];
    
    uniqueQueryTerms.forEach(term => {
      const tf = this.calculateTF(term, fieldTokens);
      const idf = this.calculateIDF(term, allDocuments); // IDF is global
      score += tf * idf;
    });
    return score;
  }


  // Rank FAQs based on search query
  rankFAQs(query, faqs) {
    if (!query || query.trim().length === 0) {
      return faqs;
    }

    const queryTokens = this.tokenize(query);

    // Calculate scores for each FAQ
    const scoredFAQs = faqs.map(faq => {
      
      // ✅ FIXED: Tokenize each field separately for weighted scoring
      const questionTokens = this.tokenize(faq.question);
      const answerTokens = this.tokenize(faq.answer);
      const keywordTokens = faq.keywords ? this.tokenize(faq.keywords.join(' ')) : [];
      const tagTokens = faq.tags ? this.tokenize(faq.tags.join(' ')) : [];

      // 5.0x boost for Keywords
      const keywordScore = this.calculateFieldScore(queryTokens, keywordTokens, faqs) * 5.0;
      
      // 3.0x boost for Question
      const questionScore = this.calculateFieldScore(queryTokens, questionTokens, faqs) * 3.0;

      // 1.0x boost for Answer (baseline)
      const answerScore = this.calculateFieldScore(queryTokens, answerTokens, faqs) * 1.0;
      
      // (Self-correction: Tags weren't specified, but are good to include at baseline)
      const tagScore = this.calculateFieldScore(queryTokens, tagTokens, faqs) * 1.0;
      
      // Combine weighted scores
      const totalScore = keywordScore + questionScore + answerScore + tagScore;

      // Popularity boost (remains the same)
      const popularityBoost = Math.log((faq.views || 0) + 1) * 0.1 + 
                             ((faq.helpful || 0) - (faq.notHelpful || 0)) * 0.2;

      const finalScore = totalScore + popularityBoost;

      return {
        ...faq,
        relevanceScore: finalScore
      };
    });

    // Filter out FAQs with no score
    const relevantFAQs = scoredFAQs.filter(faq => faq.relevanceScore > 0);

    // Sort by relevance score
    return relevantFAQs.sort((a, b) => b.relevanceScore - a.relevanceScore);
  }

  // Fuzzy search (no change)
  fuzzySearch(query, faqs, threshold = 0.7) {
    const queryTokens = this.tokenize(query);
    
    return faqs.filter(faq => {
      const faqText = this.tokenize(`${faq.question} ${faq.answer} ${faq.tags?.join(' ') || ''}`);
      
      return queryTokens.some(queryToken => {
        return faqText.some(faqToken => {
          const similarity = this.stringSimilarity(queryToken, faqToken);
          return similarity >= threshold;
        });
      });
    });
  }

  // Levenshtein distance (no change)
  stringSimilarity(str1, str2) {
    const longer = str1.length > str2.length ? str1 : str2;
    const shorter = str1.length > str2.length ? str2 : str1;
    
    if (longer.length === 0) return 1.0;
    
    const editDistance = this.levenshteinDistance(longer, shorter);
    return (longer.length - editDistance) / longer.length;
  }

  levenshteinDistance(str1, str2) {
    const matrix = [];
    for (let i = 0; i <= str2.length; i++) { matrix[i] = [i]; }
    for (let j = 0; j <= str1.length; j++) { matrix[0][j] = j; }
    for (let i = 1; i <= str2.length; i++) {
      for (let j = 1; j <= str1.length; j++) {
        if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1,
            matrix[i][j - 1] + 1,
            matrix[i - 1][j] + 1
          );
        }
      }
    }
    return matrix[str2.length][str1.length];
  }

  // Get search suggestions - Now includes keywords
  getSearchSuggestions(query, faqs, limit = 5) {
    if (!query || query.trim().length < 2) {
      return [];
    }

    const lowerQuery = query.toLowerCase();
    const queryTokens = this.tokenize(query);
    const suggestions = new Set();

    faqs.forEach(faq => {
      // Check question
      const questionLower = faq.question.toLowerCase();
      if (questionLower.includes(lowerQuery)) {
        suggestions.add(faq.question);
      } else {
        const questionTokens = this.tokenize(faq.question);
        if (queryTokens.some(qt => questionTokens.includes(qt))) {
          suggestions.add(faq.question);
        }
      }

      // ✅ ADDED: Check keywords
      faq.keywords?.forEach(keyword => {
        const kwLower = keyword.toLowerCase();
        if (kwLower.includes(lowerQuery) || queryTokens.includes(kwLower)) {
          suggestions.add(keyword); // Add the keyword itself as a suggestion
        }
      });

      // Check tags
      faq.tags?.forEach(tag => {
        if (tag.toLowerCase().includes(lowerQuery)) {
          suggestions.add(tag);
        } else if (queryTokens.includes(tag.toLowerCase())) {
          suggestions.add(tag);
        }
      });
    });

    return Array.from(suggestions).slice(0, limit);
  }

  // Advanced search with filters (no change)
  advancedSearch(query, faqs, filters = {}) {
    let results = this.rankFAQs(query, faqs);
    // ... (rest of the function is unchanged) ...
    if (filters.category && filters.category !== 'all') {
      results = results.filter(faq => 
        faq.category?.toLowerCase() === filters.category.toLowerCase()
      );
    }
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(faq =>
        filters.tags.some(tag => 
          faq.tags?.some(faqTag => 
            faqTag.toLowerCase() === tag.toLowerCase()
          )
        )
      );
    }
    if (filters.dateFrom) {
      results = results.filter(faq => 
        faq.createdAt?.toDate() >= new Date(filters.dateFrom)
      );
    }
    if (filters.dateTo) {
      results = results.filter(faq => 
        faq.createdAt?.toDate() <= new Date(filters.dateTo)
      );
    }
    return results;
  }

  // Highlight search terms (no change)
  highlightSearchTerms(text, query) {
    if (!query || !text) return text;
    const tokens = this.tokenize(query);
    let highlightedText = text;
    tokens.forEach(token => {
      const regex = new RegExp(`\\b${token}\\b`, 'gi');
      highlightedText = highlightedText.replace(regex, match => 
        `<mark class="bg-yellow-200 px-1 rounded">${match}</mark>`
      );
    });
    return highlightedText;
  }
}

export default new SearchService();
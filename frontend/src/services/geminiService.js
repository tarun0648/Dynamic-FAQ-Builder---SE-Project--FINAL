import { GoogleGenerativeAI } from '@google/generative-ai';

// ✅ FIXED: Use process.env for server-side (Node.js) or import.meta.env for client-side (Vite)
const env = typeof import.meta.env !== 'undefined' ? import.meta.env : process.env;
const API_KEY = env.VITE_GEMINI_API_KEY;

const genAI = new GoogleGenerativeAI(API_KEY);

class GeminiService {
  constructor() {
    // ✅ FIXED: Changed to the latest stable model 'gemini-1.5-pro-latest'
    this.model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });
    this.cache = new Map();
  }
  
  // Add generateAnswer method for test compatibility
  async generateAnswer(question, contextFAQs = []) {
    try {
      if (contextFAQs.length > 0) {
        const primaryContext = contextFAQs[0];
        const additionalFAQs = contextFAQs.slice(1, 5);
        return await this.generateResponseWithContext(question, primaryContext, additionalFAQs);
      } else {
        return await this.generateResponseWithContext(question, null, []);
      }
    } catch (error) {
      console.error('Gemini generation error:', error);
      // Return fallback answer
      if (contextFAQs.length > 0) {
        const mostRelevant = contextFAQs[0];
        return `Based on our FAQ database, here's related information:\n\n${mostRelevant.answer}\n\nIf this doesn't fully answer your question about "${question}", please contact support for more specific assistance.`;
      }
      return `I couldn't find specific information about "${question}" in our FAQ database. Please try rephrasing your question or contact support for assistance.`;
    }
  }

  // Enhanced: Generate AI response with multiple FAQ context
  async generateResponseWithContext(question, primaryContext = null, additionalFAQs = []) {
    try {
      // Check cache first
      const cacheKey = `enhanced-${question}-${primaryContext?.question}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      let prompt = '';
      
      if (primaryContext) {
        // We have a relevant FAQ to use as context
        prompt = `You are a helpful FAQ assistant. The user has asked a question, and I've found relevant FAQ information that might help answer it.

**User's Question**: ${question}

**Most Relevant FAQ**:
Q: ${primaryContext.question}
A: ${primaryContext.answer}
Category: ${primaryContext.category || 'General'}
Tags: ${primaryContext.tags?.join(', ') || 'None'}

${additionalFAQs.length > 0 ? `
**Additional Related FAQs**:
${additionalFAQs.map((faq, idx) => `${idx + 1}. Q: ${faq.question}\n   A: ${faq.answer}`).join('\n\n')}
` : ''}

**Your Task**:
1. Provide a comprehensive, direct answer to the user's question
2. Use information from the FAQ(s) above as a foundation
3. Expand with additional helpful context, examples, or clarifications
4. If the user's question is slightly different from the FAQ, address those differences
5. Keep the tone friendly and professional
6. Format the answer clearly with paragraphs if needed

**Important**: 
- Don't say "based on the FAQ" or reference that you're looking at FAQs
- Answer as if you're directly helping the user
- If multiple FAQs are relevant, synthesize the information naturally

**Your Answer**:`;
      } else {
        // No relevant FAQ found, generate general answer
        prompt = `You are a helpful FAQ assistant. The user has asked a question, but we don't have a specific FAQ entry for it yet.

**User's Question**: ${question}

${additionalFAQs.length > 0 ? `
**Potentially Related FAQs**:
${additionalFAQs.map((faq, idx) => `${idx + 1}. Q: ${faq.question}\n   A: ${faq.answer}`).join('\n\n')}
` : ''}

**Your Task**:
1. Provide a helpful, comprehensive answer to the user's question
2. If any related FAQs exist above, incorporate relevant information
3. Provide practical guidance and examples
4. Keep the tone professional yet friendly
5. Be clear and concise

**Your Answer**:`;
      }

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Cache the response (limit cache size to 50 entries)
      if (this.cache.size > 50) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, text);

      return text;
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error('Failed to generate AI response. Please try again.');
    }
  }

  // Original method - kept for backward compatibility
  async generateResponse(question, context = null) {
    try {
      // Check cache first
      const cacheKey = `${question}-${context}`;
      if (this.cache.has(cacheKey)) {
        return this.cache.get(cacheKey);
      }

      let prompt = '';
      
      if (context) {
        prompt = `You are a helpful FAQ assistant. Based on the following FAQ information, provide a detailed, comprehensive, and user-friendly answer to the question.

FAQ Question: ${context.question}
FAQ Answer: ${context.answer}
Category: ${context.category}
Tags: ${context.tags?.join(', ') || 'None'}

User's Question: ${question}

Please provide:
1. A direct answer to the user's question
2. Additional helpful information related to the topic
3. Any relevant examples or clarifications
4. Keep the tone professional yet friendly

Response:`;
      } else {
        prompt = `You are a helpful FAQ assistant. The user has asked: "${question}"

Please provide a comprehensive and helpful response that:
1. Directly answers their question
2. Provides additional context or information that might be useful
3. Uses a professional yet friendly tone
4. Is well-structured and easy to understand

Response:`;
      }

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();

      // Cache the response
      if (this.cache.size > 50) {
        const firstKey = this.cache.keys().next().value;
        this.cache.delete(firstKey);
      }
      this.cache.set(cacheKey, text);

      return text;
    } catch (error) {
      console.error('Error generating AI response:', error);
      throw new Error('Failed to generate AI response. Please try again.');
    }
  }

  // Generate answer suggestions based on question
  async generateAnswerSuggestion(question, category = null) {
    try {
      let prompt = `Generate a comprehensive FAQ answer for the following question. 
      
Question: ${question}
${category ? `Category: ${category}` : ''}

Provide a detailed, accurate, and helpful answer that:
1. Directly addresses the question
2. Includes relevant details and examples
3. Is well-structured with clear sections if needed
4. Uses professional language
5. Is between 150-300 words

Answer:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error generating answer suggestion:', error);
      throw error;
    }
  }

  // Improve existing answer
  async improveAnswer(question, currentAnswer) {
    try {
      const prompt = `Improve the following FAQ answer to make it more comprehensive, clear, and helpful.

Question: ${question}
Current Answer: ${currentAnswer}

Provide an improved version that:
1. Maintains the core information
2. Adds more clarity and detail where needed
3. Improves structure and readability
4. Ensures professional tone
5. Adds examples if helpful

Improved Answer:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error('Error improving answer:', error);
      throw error;
    }
  }

  // Generate related questions
  async generateRelatedQuestions(question, count = 3) {
    try {
      const prompt = `Based on the following question, generate ${count} related questions that users might also ask.

Main Question: ${question}

Generate ${count} related questions that are:
1. Relevant to the main topic
2. Different from the original question
3. Commonly asked by users
4. Clear and specific

Format: Return only the questions, one per line, numbered.

Related Questions:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      
      // Parse the numbered list
      return text
        .split('\n')
        .filter(line => line.trim())
        .map(line => line.replace(/^\d+\.\s*/, '').trim())
        .slice(0, count);
    } catch (error) {
      console.error('Error generating related questions:', error);
      return [];
    }
  }

  // Categorize a question
  async categorizeQuestion(question, categories = null) {
    try {
      const categoryList = categories || ['General', 'Technical', 'Account', 'Billing', 'Support', 'Product'];
      const prompt = `Categorize the following question into one of these categories: 
${categoryList.map(cat => `      - ${cat}`).join('\n')}

Question: ${question}

Return only the category name, nothing else.

Category:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const categoryText = response.text().trim();
      
      // Find the best matching category
      const matchedCategory = categoryList.find(cat => 
        categoryText.toLowerCase().includes(cat.toLowerCase())
      );
      
      return matchedCategory || categoryList[0];
    } catch (error) {
      console.error('Categorization error:', error);
      return categories ? categories[0] : 'General';
    }
  }

  // Generate tags for a question
  async generateTags(question, answer) {
    try {
      const prompt = `Generate 3-5 relevant tags for the following FAQ:

Question: ${question}
Answer: ${answer}

Tags should be:
1. Single words or short phrases
2. Relevant to the content
3. Useful for searching
4. Lowercase

Return only the tags, comma-separated.

Tags:`;

      const result = await this.model.generateContent(prompt);
      const response = await result.response;
      const tagsText = response.text().trim();
      const tags = tagsText.split(',').map(tag => tag.trim().toLowerCase()).filter(tag => tag.length > 0);
      return tags;
    } catch (error) {
      console.error('Tag generation error:', error);
      return [];
    }
  }

  // Clear cache
  clearCache() {
    this.cache.clear();
  }
}

export default new GeminiService();
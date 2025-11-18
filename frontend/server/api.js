// ============================================
// COMPLETE EXPRESS API SERVER - api.js
// Fixed import paths for services
// ============================================

// ✅ FIXED: Load .env file for Node.js server environment
import 'dotenv/config';

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { body, validationResult } from 'express-validator';
// ✅ FIXED: Correct import paths
import faqService from '../src/services/faqService.js';
import geminiService from '../src/services/geminiService.js';
import searchService from '../src/services/searchService.js';

const app = express();
const PORT = process.env.PORT || 3001;

// ============================================
// MIDDLEWARE CONFIGURATION
// ============================================

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
    },
  },
}));

app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting for search
const searchLimiter = rateLimit({
  windowMs: 1000,
  max: 50,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Rate limiting for admin
const adminLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' }
});

// ============================================
// AUTHENTICATION
// ============================================

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_EXPIRES_IN = '24h';

const loginAttempts = new Map();
const MAX_LOGIN_ATTEMPTS = 3;
const LOCKOUT_DURATION = 60000;

function checkBruteForce(ip) {
  const attempts = loginAttempts.get(ip) || { count: 0, lockedUntil: null };
  
  if (attempts.lockedUntil && Date.now() < attempts.lockedUntil) {
    return { locked: true, remainingTime: attempts.lockedUntil - Date.now() };
  }
  
  if (attempts.lockedUntil && Date.now() >= attempts.lockedUntil) {
    loginAttempts.delete(ip);
  }
  
  return { locked: false };
}

function recordFailedLogin(ip) {
  const attempts = loginAttempts.get(ip) || { count: 0, lockedUntil: null };
  attempts.count += 1;
  
  if (attempts.count >= MAX_LOGIN_ATTEMPTS) {
    attempts.lockedUntil = Date.now() + LOCKOUT_DURATION;
    attempts.count = 0;
    console.warn(`[SECURITY] Account locked for IP: ${ip}`);
  }
  
  loginAttempts.set(ip, attempts);
}

function clearLoginAttempts(ip) {
  loginAttempts.delete(ip);
}

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access denied. No token provided.' });
  }

  try {
    const verified = jwt.verify(token, JWT_SECRET);
    req.user = verified;
    next();
  } catch (error) {
    res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// ============================================
// INPUT VALIDATION
// ============================================

// ✅ FIXED: Robust sanitizer to remove event handlers (with or without quotes) and dangerous tags
function sanitizeInput(text) {
  if (!text) return text;
  return text
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove <script> tags
    .replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, '') // Remove <iframe> tags
    .replace(/<img\b[^>]*>/gi, '') // Remove <img> tags
    .replace(/on\w+\s*=\s*("[^"]*"|'[^']*'|[^>\s]+)/gi, '') // Remove on... event handlers
    .replace(/javascript:/gi, ''); // Remove javascript: protocol
}

const faqValidationRules = [
  body('question')
    .trim()
    .isLength({ min: 10, max: 255 })
    .withMessage('Question must be between 10 and 255 characters')
    .customSanitizer(sanitizeInput),
  body('answer')
    .trim()
    .isLength({ min: 20, max: 5000 })
    .withMessage('Answer must be between 20 and 5000 characters')
    .customSanitizer(sanitizeInput),
  body('keywords')
    .optional()
    .isArray({ max: 10 })
    .withMessage('Maximum 10 keywords allowed'),
];

const validate = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({ errors: errors.array() });
  }
  next();
};

// ============================================
// ROUTES
// ============================================

// Health check
app.get('/api/v1/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// Admin login
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientIp = req.ip;

    const bruteForceCheck = checkBruteForce(clientIp);
    if (bruteForceCheck.locked) {
      return res.status(429).json({ 
        error: 'Too many failed login attempts. Please try again later.',
        remainingTime: Math.ceil(bruteForceCheck.remainingTime / 1000)
      });
    }

    const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'admin@faqbuilder.com';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'Admin@123';

    if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
      recordFailedLogin(clientIp);
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    clearLoginAttempts(clientIp);

    const token = jwt.sign(
      { email, role: 'admin' },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      token,
      user: { email, role: 'admin' },
      expiresIn: JWT_EXPIRES_IN
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Verify token
app.get('/api/v1/auth/verify', authenticateToken, (req, res) => {
  res.json({ valid: true, user: req.user });
});

// Public search endpoint
app.get('/api/v1/search', searchLimiter, async (req, res) => {
  try {
    const { q: query, category, tags, page = 1, limit = 20 } = req.query;

    if (!query || query.trim().length < 3) {
      return res.status(400).json({ 
        error: 'Search query must be at least 3 characters long' 
      });
    }

    const allFAQs = await faqService.getAllFAQs();

    const filters = {
      category: category || 'all',
      tags: tags ? tags.split(',') : []
    };

    let results = searchService.advancedSearch(query, allFAQs, filters);

    const startIndex = (page - 1) * limit;
    const endIndex = startIndex + parseInt(limit);
    const paginatedResults = results.slice(startIndex, endIndex);

    res.json({
      status: 'success',
      query: query,
      total: results.length,
      page: parseInt(page),
      limit: parseInt(limit),
      totalPages: Math.ceil(results.length / limit),
      results: paginatedResults.map(faq => ({
        faqId: faq.id,
        question: faq.question,
        answer: faq.answer,
        category: faq.category,
        tags: faq.tags,
        relevanceScore: faq.relevanceScore?.toFixed(4),
        views: faq.views,
        helpful: faq.helpful
      }))
    });
  } catch (error) {
    console.error('Search error:', error);
    res.status(500).json({ 
      error: 'Search service temporarily unavailable',
      status: 'error' 
    });
  }
});

// Search suggestions
app.get('/api/v1/search/suggestions', searchLimiter, async (req, res) => {
  try {
    const { q: query } = req.query;
    
    if (!query || query.length < 2) {
      return res.json({ suggestions: [] });
    }

    const allFAQs = await faqService.getAllFAQs();
    const suggestions = searchService.getSearchSuggestions(query, allFAQs, 5);

    res.json({ suggestions });
  } catch (error) {
    console.error('Suggestions error:', error);
    res.status(500).json({ suggestions: [] });
  }
});

// Create FAQ
app.post('/api/v1/faqs', 
  authenticateToken, 
  adminLimiter,
  faqValidationRules, 
  validate,
  async (req, res) => {
    try {
      const faqData = {
        question: req.body.question,
        answer: req.body.answer,
        keywords: req.body.keywords || [],
        category: req.body.category || 'General',
        tags: req.body.tags || []
      };

      const newFAQ = await faqService.createFAQ(faqData);
      console.log(`[INDEXING] FAQ created: ${newFAQ.id}`);

      res.status(201).json({
        status: 'success',
        message: 'FAQ created successfully',
        faq: newFAQ
      });
    } catch (error) {
      console.error('Create FAQ error:', error);
      res.status(500).json({ error: 'Failed to create FAQ' });
    }
  }
);

// Get all FAQs
app.get('/api/v1/faqs', authenticateToken, async (req, res) => {
  try {
    const faqs = await faqService.getAllFAQs();
    res.json({ status: 'success', faqs });
  } catch (error) {
    console.error('Get FAQs error:', error);
    res.status(500).json({ error: 'Failed to retrieve FAQs' });
  }
});

// Get FAQ by ID
app.get('/api/v1/faqs/:id', authenticateToken, async (req, res) => {
  try {
    const faq = await faqService.getFAQById(req.params.id);
    res.json({ status: 'success', faq });
  } catch (error) {
    console.error('Get FAQ error:', error);
    res.status(404).json({ error: 'FAQ not found' });
  }
});

// Update FAQ
app.put('/api/v1/faqs/:id', 
  authenticateToken,
  adminLimiter,
  faqValidationRules,
  validate,
  async (req, res) => {
    try {
      const updates = {
        question: req.body.question,
        answer: req.body.answer,
        keywords: req.body.keywords,
        category: req.body.category,
        tags: req.body.tags
      };

      const updatedFAQ = await faqService.updateFAQ(req.params.id, updates);
      console.log(`[INDEXING] FAQ updated: ${req.params.id}`);

      res.json({
        status: 'success',
        message: 'FAQ updated successfully',
        faq: updatedFAQ
      });
    } catch (error) {
      console.error('Update FAQ error:', error);
      res.status(500).json({ error: 'Failed to update FAQ' });
    }
  }
);

// Delete FAQ
app.delete('/api/v1/faqs/:id', authenticateToken, adminLimiter, async (req, res) => {
  try {
    await faqService.deleteFAQ(req.params.id);
    console.log(`[INDEXING] FAQ deleted: ${req.params.id}`);

    res.json({
      status: 'success',
      message: 'FAQ deleted successfully'
    });
  } catch (error) {
    console.error('Delete FAQ error:', error);
    res.status(500).json({ error: 'Failed to delete FAQ' });
  }
});

// Dashboard
app.get('/api/v1/admin/dashboard', authenticateToken, async (req, res) => {
  try {
    const faqs = await faqService.getAllFAQs();
    
    const totalFAQs = faqs.length;
    const recentUpdates = faqs
      .sort((a, b) => b.updatedAt?.toMillis() - a.updatedAt?.toMillis())
      .slice(0, 5);
    
    const categoryCount = {};
    faqs.forEach(faq => {
      categoryCount[faq.category] = (categoryCount[faq.category] || 0) + 1;
    });

    const topViewed = [...faqs]
      .sort((a, b) => (b.views || 0) - (a.views || 0))
      .slice(0, 10);

    res.json({
      status: 'success',
      dashboard: {
        totalFAQs,
        recentUpdates,
        categoryDistribution: categoryCount,
        topViewedFAQs: topViewed
      }
    });
  } catch (error) {
    console.error('Dashboard error:', error);
    res.status(500).json({ error: 'Failed to load dashboard' });
  }
});

// AI search
app.post('/api/v1/ai/search', searchLimiter, async (req, res) => {
  try {
    const { question } = req.body;
    
    if (!question || question.trim().length < 3) {
      return res.status(400).json({ 
        error: 'Question must be at least 3 characters long' 
      });
    }

    const allFAQs = await faqService.getAllFAQs();
    const rankedFAQs = searchService.rankFAQs(question, allFAQs);
    const topFAQs = rankedFAQs.slice(0, 5);

    const aiResponse = await geminiService.generateAnswer(question, topFAQs);

    res.json({
      status: 'success',
      question,
      answer: aiResponse,
      relatedFAQs: topFAQs.slice(0, 3)
    });
  } catch (error) {
    console.error('AI search error:', error);
    res.status(500).json({ error: 'AI service temporarily unavailable' });
  }
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Endpoint not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// Start server
app.listen(PORT, () => {
  console.log(`✅ FAQ Builder API Server running on port ${PORT}`);
  console.log(`📡 Health check: http://localhost:${PORT}/api/v1/health`);
  console.log(`🔍 Search endpoint: http://localhost:${PORT}/api/v1/search`);
  console.log(`🔐 Admin endpoints: http://localhost:${PORT}/api/v1/faqs`);
});

export default app;
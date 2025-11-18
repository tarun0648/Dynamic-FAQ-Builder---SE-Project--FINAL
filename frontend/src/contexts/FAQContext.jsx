import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import faqService from '../services/faqService';
import { toast } from 'react-toastify';

const FAQContext = createContext({});

export const useFAQ = () => {
  const context = useContext(FAQContext);
  if (!context) {
    throw new Error('useFAQ must be used within FAQProvider');
  }
  return context;
};

export const FAQProvider = ({ children }) => {
  const [faqs, setFaqs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [selectedFAQ, setSelectedFAQ] = useState(null);

  // Load FAQs on mount
  useEffect(() => {
    loadFAQs();
    
    // Subscribe to real-time updates
    const unsubscribe = faqService.subscribeFAQs((updatedFAQs) => {
      setFaqs(updatedFAQs);
    });

    return () => unsubscribe();
  }, []);

  const loadFAQs = async () => {
    try {
      setLoading(true);
      const data = await faqService.getAllFAQs();
      setFaqs(data);
      setError(null);
    } catch (err) {
      setError(err.message);
      toast.error('Failed to load FAQs');
    } finally {
      setLoading(false);
    }
  };

  const createFAQ = async (faqData) => {
    try {
      const newFAQ = await faqService.createFAQ(faqData);
      setFaqs(prev => [newFAQ, ...prev]);
      toast.success('FAQ created successfully!');
      return newFAQ;
    } catch (err) {
      toast.error('Failed to create FAQ');
      throw err;
    }
  };

  const updateFAQ = async (id, updates) => {
    try {
      await faqService.updateFAQ(id, updates);
      setFaqs(prev => prev.map(faq => 
        faq.id === id ? { ...faq, ...updates } : faq
      ));
      toast.success('FAQ updated successfully!');
    } catch (err) {
      toast.error('Failed to update FAQ');
      throw err;
    }
  };

  const deleteFAQ = async (id) => {
    try {
      await faqService.deleteFAQ(id);
      setFaqs(prev => prev.filter(faq => faq.id !== id));
      toast.success('FAQ deleted successfully!');
    } catch (err) {
      toast.error('Failed to delete FAQ');
      throw err;
    }
  };

  const getFAQById = useCallback(async (id) => {
    try {
      const faq = await faqService.getFAQById(id);
      setSelectedFAQ(faq);
      return faq;
    } catch (err) {
      toast.error('FAQ not found');
      throw err;
    }
  }, []);

  const incrementViews = async (id) => {
    try {
      await faqService.incrementViews(id);
      setFaqs(prev => prev.map(faq => 
        faq.id === id ? { ...faq, views: (faq.views || 0) + 1 } : faq
      ));
    } catch (err) {
      console.error('Failed to increment views:', err);
    }
  };

  const markAsHelpful = async (id) => {
    try {
      await faqService.markAsHelpful(id);
      setFaqs(prev => prev.map(faq => 
        faq.id === id ? { ...faq, helpful: (faq.helpful || 0) + 1 } : faq
      ));
      toast.success('Thank you for your feedback!');
    } catch (err) {
      toast.error('Failed to submit feedback');
    }
  };

  const markAsNotHelpful = async (id) => {
    try {
      await faqService.markAsNotHelpful(id);
      setFaqs(prev => prev.map(faq => 
        faq.id === id ? { ...faq, notHelpful: (faq.notHelpful || 0) + 1 } : faq
      ));
      toast.info('Thank you for your feedback!');
    } catch (err) {
      toast.error('Failed to submit feedback');
    }
  };

  const getCategories = useCallback(() => {
    const categories = new Set(faqs.map(faq => faq.category).filter(Boolean));
    return Array.from(categories);
  }, [faqs]);

  const getAllTags = useCallback(() => {
    const tags = new Set();
    faqs.forEach(faq => {
      faq.tags?.forEach(tag => tags.add(tag));
    });
    return Array.from(tags);
  }, [faqs]);

  const value = {
    faqs,
    loading,
    error,
    selectedFAQ,
    createFAQ,
    updateFAQ,
    deleteFAQ,
    getFAQById,
    incrementViews,
    markAsHelpful,
    markAsNotHelpful,
    getCategories,
    getAllTags,
    refreshFAQs: loadFAQs
  };

  return (
    <FAQContext.Provider value={value}>
      {children}
    </FAQContext.Provider>
  );
};

export default FAQContext;

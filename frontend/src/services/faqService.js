import {
  collection,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
  getDocs,
  getDoc,
  query,
  where,
  orderBy,
  Timestamp,
  onSnapshot,
  limit
} from 'firebase/firestore';
import { db } from '../services/firebase.js';

const FAQ_COLLECTION = 'faqs';
const AI_QA_COLLECTION = 'ai_qa_history'; // New collection for AI Q&A history

class FAQService {
  // ============= AI Q&A History Methods =============
  
  // Save AI question and answer to history
  async saveAIQA(questionData) {
    try {
      const docRef = await addDoc(collection(db, AI_QA_COLLECTION), {
        question: questionData.question,
        answer: questionData.answer,
        relatedFAQs: questionData.relatedFAQs || [], // IDs of related FAQs
        category: questionData.category || 'General',
        tags: questionData.tags || [],
        upvotes: 0,
        downvotes: 0,
        views: 0,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now()
      });
      
      return { id: docRef.id, ...questionData };
    } catch (error) {
      console.error('Error saving AI Q&A:', error);
      throw error;
    }
  }

  // Get all AI Q&A history
  async getAllAIQA() {
    try {
      const q = query(
        collection(db, AI_QA_COLLECTION), 
        orderBy('createdAt', 'desc'),
        limit(100) // Limit to last 100 for performance
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting AI Q&A history:', error);
      throw error;
    }
  }

  // Search AI Q&A history by keyword
  async searchAIQAHistory(searchTerm) {
    try {
      const allQA = await this.getAllAIQA();
      const lowerSearchTerm = searchTerm.toLowerCase();
      
      return allQA.filter(qa => 
        qa.question.toLowerCase().includes(lowerSearchTerm) ||
        qa.answer.toLowerCase().includes(lowerSearchTerm) ||
        qa.tags?.some(tag => tag.toLowerCase().includes(lowerSearchTerm))
      );
    } catch (error) {
      console.error('Error searching AI Q&A history:', error);
      throw error;
    }
  }

  // Get AI Q&A by ID
  async getAIQAById(id) {
    try {
      const docRef = doc(db, AI_QA_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error('AI Q&A not found');
      }
    } catch (error) {
      console.error('Error getting AI Q&A:', error);
      throw error;
    }
  }

  // Increment views for AI Q&A
  async incrementAIQAViews(id) {
    try {
      const docRef = doc(db, AI_QA_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const currentViews = docSnap.data().views || 0;
        await updateDoc(docRef, {
          views: currentViews + 1
        });
      }
    } catch (error) {
      console.error('Error incrementing AI Q&A views:', error);
    }
  }

  // Vote on AI Q&A
  async voteAIQA(id, isUpvote) {
    try {
      const docRef = doc(db, AI_QA_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        if (isUpvote) {
          await updateDoc(docRef, {
            upvotes: (data.upvotes || 0) + 1
          });
        } else {
          await updateDoc(docRef, {
            downvotes: (data.downvotes || 0) + 1
          });
        }
      }
    } catch (error) {
      console.error('Error voting on AI Q&A:', error);
      throw error;
    }
  }

  // Delete AI Q&A from history
  async deleteAIQA(id) {
    try {
      const docRef = doc(db, AI_QA_COLLECTION, id);
      await deleteDoc(docRef);
      return id;
    } catch (error) {
      console.error('Error deleting AI Q&A:', error);
      throw error;
    }
  }

  // Subscribe to AI Q&A history updates
  subscribeAIQA(callback) {
    const q = query(
      collection(db, AI_QA_COLLECTION), 
      orderBy('createdAt', 'desc'),
      limit(100)
    );
    return onSnapshot(q, (querySnapshot) => {
      const qaHistory = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(qaHistory);
    });
  }

  // ============= Original FAQ Methods =============
  
  // Create a new FAQ
  async createFAQ(faqData) {
    try {
      const docRef = await addDoc(collection(db, FAQ_COLLECTION), {
        ...faqData,
        createdAt: Timestamp.now(),
        updatedAt: Timestamp.now(),
        views: 0,
        helpful: 0,
        notHelpful: 0
      });
      return { id: docRef.id, ...faqData };
    } catch (error) {
      console.error('Error creating FAQ:', error);
      throw error;
    }
  }

  // Get all FAQs
  async getAllFAQs() {
    try {
      const q = query(collection(db, FAQ_COLLECTION), orderBy('createdAt', 'desc'));
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting FAQs:', error);
      throw error;
    }
  }

  // Get FAQ by ID
  async getFAQById(id) {
    try {
      const docRef = doc(db, FAQ_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() };
      } else {
        throw new Error('FAQ not found');
      }
    } catch (error) {
      console.error('Error getting FAQ:', error);
      throw error;
    }
  }

  // Update FAQ
  async updateFAQ(id, updates) {
    try {
      const docRef = doc(db, FAQ_COLLECTION, id);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      });
      return { id, ...updates };
    } catch (error) {
      console.error('Error updating FAQ:', error);
      throw error;
    }
  }

  // Delete FAQ
  async deleteFAQ(id) {
    try {
      const docRef = doc(db, FAQ_COLLECTION, id);
      await deleteDoc(docRef);
      return id;
    } catch (error) {
      console.error('Error deleting FAQ:', error);
      throw error;
    }
  }

  // Get FAQs by category
  async getFAQsByCategory(category) {
    try {
      const q = query(
        collection(db, FAQ_COLLECTION),
        where('category', '==', category),
        orderBy('createdAt', 'desc')
      );
      const querySnapshot = await getDocs(q);
      return querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
    } catch (error) {
      console.error('Error getting FAQs by category:', error);
      throw error;
    }
  }

  // Search FAQs
  async searchFAQs(searchTerm) {
    try {
      const allFAQs = await this.getAllFAQs();
      const lowerSearchTerm = searchTerm.toLowerCase();
      
      return allFAQs.filter(faq => 
        faq.question.toLowerCase().includes(lowerSearchTerm) ||
        faq.answer.toLowerCase().includes(lowerSearchTerm) ||
        faq.tags?.some(tag => tag.toLowerCase().includes(lowerSearchTerm))
      );
    } catch (error) {
      console.error('Error searching FAQs:', error);
      throw error;
    }
  }

  // Increment view count
  async incrementViews(id) {
    try {
      const docRef = doc(db, FAQ_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const currentViews = docSnap.data().views || 0;
        await updateDoc(docRef, {
          views: currentViews + 1
        });
      }
    } catch (error) {
      console.error('Error incrementing views:', error);
    }
  }

  // Mark as helpful
  async markAsHelpful(id) {
    try {
      const docRef = doc(db, FAQ_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const currentHelpful = docSnap.data().helpful || 0;
        await updateDoc(docRef, {
          helpful: currentHelpful + 1
        });
      }
    } catch (error) {
      console.error('Error marking as helpful:', error);
      throw error;
    }
  }

  // Mark as not helpful
  async markAsNotHelpful(id) {
    try {
      const docRef = doc(db, FAQ_COLLECTION, id);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const currentNotHelpful = docSnap.data().notHelpful || 0;
        await updateDoc(docRef, {
          notHelpful: currentNotHelpful + 1
        });
      }
    } catch (error) {
      console.error('Error marking as not helpful:', error);
      throw error;
    }
  }

  // Subscribe to real-time updates
  subscribeFAQs(callback) {
    const q = query(collection(db, FAQ_COLLECTION), orderBy('createdAt', 'desc'));
    return onSnapshot(q, (querySnapshot) => {
      const faqs = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      callback(faqs);
    });
  }
}

export default new FAQService();

import { useState, useEffect } from 'react';
import { 
  Container, 
  Box, 
  Typography, 
  Paper, 
  Grid, 
  Alert, 
  Chip,
  Pagination, // ✅ ADDED: Pagination component
  Skeleton
} from '@mui/material';
import SearchBar from '../components/User/SearchBar';
import FAQDisplay from '../components/User/FAQDisplay';
import LoadingSpinner from '../components/Common/LoadingSpinner';
import { useFAQ } from '../contexts/FAQContext';
import searchService from '../services/searchService';
import faqService from '../services/faqService';
import { 
  HelpOutline, 
  TipsAndUpdates, 
  AutoAwesome,
} from '@mui/icons-material';
import { toast } from 'react-toastify';

const Home = () => {
  const { faqs, loading } = useFAQ();
  const [filteredFAQs, setFilteredFAQs] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [filters, setFilters] = useState({ category: 'all' });
  const [popularQuestions, setPopularQuestions] = useState([]);
  const [loadingPopular, setLoadingPopular] = useState(true);

  // ✅ ADDED: Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10; // As specified in FAQ-FR-014 

  // Load FAQs when component mounts or faqs change
  useEffect(() => {
    handleSearch(searchQuery, filters);
  }, [faqs, searchQuery, filters]); // ✅ ADDED: searchQuery and filters to dependency array

  // Load popular questions on mount
  useEffect(() => {
    loadPopularQuestions();
  }, []);

  const loadPopularQuestions = async () => {
    // ... (this function is unchanged)
    try {
      setLoadingPopular(true);
      const qaHistory = await faqService.getAllAIQA();
      const scored = qaHistory.map(qa => ({
        ...qa,
        score: (qa.views || 0) + (qa.upvotes || 0) * 5 - (qa.downvotes || 0) * 2
      }));
      const sorted = scored
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
      setPopularQuestions(sorted);
    } catch (error) {
      console.error('Error loading popular questions:', error);
      setPopularQuestions([]);
    } finally {
      setLoadingPopular(false);
    }
  };

  const handleSearch = (query, filterOptions = filters) => {
    setSearchQuery(query);
    setFilters(filterOptions);
    setCurrentPage(1); // Reset to page 1 on every new search

    if (!query || query.trim().length === 0) {
      // No search query, apply only filters
      let results = faqs;
      if (filterOptions.category !== 'all') {
        results = results.filter(faq => faq.category === filterOptions.category);
      }
      setFilteredFAQs(results);
    } else {
      // Apply search with ranking
      const results = searchService.advancedSearch(query, faqs, filterOptions);
      setFilteredFAQs(results);
    }
  };

  const handleAIResponse = (response) => {
    // This is called by SearchBar when AI generates an answer
    // We don't need to do anything special here
  };
  
  // ... (handlePopularQuestionClick, formatDate, etc. are unchanged) ...
  const handlePopularQuestionClick = async (qa) => {
    try {
      setSearchQuery(qa.question);
      await faqService.incrementAIQAViews(qa.id);
      setPopularQuestions(prev => 
        prev.map(q => 
          q.id === qa.id 
            ? { ...q, views: (q.views || 0) + 1 }
            : q
        )
      );
      handleSearch(qa.question, filters);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      toast.success('Question loaded! Click "Ask AI" to see the saved answer.', {
        position: 'bottom-right',
        autoClose: 3000
      });
    } catch (error) {
      console.error('Error loading popular question:', error);
      toast.error('Failed to load question. Please try again.');
    }
  };

  if (loading) return <LoadingSpinner message="Loading FAQs..." />;

  // ✅ ADDED: Pagination logic
  const pageCount = Math.ceil(filteredFAQs.length / itemsPerPage);
  const paginatedFAQs = filteredFAQs.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  
  const handlePageChange = (event, value) => {
    setCurrentPage(value);
    window.scrollTo({ top: 400, behavior: 'smooth' }); // Scroll to top of results
  };

  const shouldShowSearchNoResults = searchQuery && filteredFAQs.length === 0;

  return (
    <Box sx={{ minHeight: '80vh', py: 6 }}>
      <Container maxWidth="lg">
        {/* Hero Section (unchanged) */}
        <Box sx={{ textAlign: 'center', mb: 6 }}>
          <HelpOutline sx={{ fontSize: 80, color: 'white', mb: 2 }} />
          <Typography
            variant="h2"
            component="h1"
            gutterBottom
            sx={{
              fontWeight: 800,
              color: 'white',
              textShadow: '2px 2px 4px rgba(0,0,0,0.3)'
            }}
          >
            Ask Anything!
          </Typography>
          <Typography
            variant="h6"
            sx={{
              color: 'rgba(255,255,255,0.95)',
              mb: 4,
              maxWidth: '800px',
              mx: 'auto'
            }}
          >
            Type your question and get instant AI-powered answers with relevant FAQs ranked by intelligence
          </Typography>
          <Box sx={{ display: 'flex', gap: 2, justifyContent: 'center', flexWrap: 'wrap', mb: 2 }}>
            <Chip
              icon={<AutoAwesome />}
              label="AI-Powered Answers"
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                backdropFilter: 'blur(10px)',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}
            />
            <Chip
              icon={<TipsAndUpdates />}
              label="Smart FAQ Filtering"
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                backdropFilter: 'blur(10px)',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}
            />
            <Chip
              label="Instant Results"
              sx={{ 
                bgcolor: 'rgba(255,255,255,0.2)', 
                color: 'white',
                backdropFilter: 'blur(10px)',
                fontWeight: 600,
                fontSize: '0.9rem'
              }}
            />
          </Box>
        </Box>

        {/* Search Section (unchanged) */}
        <Paper
          elevation={4}
          sx={{
            p: 4,
            borderRadius: 3,
            mb: 4,
            background: 'white'
          }}
        >
          <SearchBar
            faqs={faqs}
            onSearch={handleSearch}
            onFilterChange={(filterOptions) => handleSearch(searchQuery, filterOptions)}
            onAIResponse={handleAIResponse}
          />
        </Paper>

        {/* ✅ MODIFIED: Results Section with Pagination */}
        <Grid container spacing={4}>
          <Grid item xs={12} md={8}>
            {/* Results Title */}
            <Typography variant="h5" sx={{ fontWeight: 600, color: 'white', mb: 2 }}>
              {searchQuery ? 'Search Results' : ''}
            </Typography>

            {/* Loading Skeletons */}
            {loading && (
              <Box>
                <Skeleton variant="rectangular" height={100} sx={{ mb: 2, borderRadius: 2 }} />
                <Skeleton variant="rectangular" height={100} sx={{ mb: 2, borderRadius: 2 }} />
                <Skeleton variant="rectangular" height={100} sx={{ mb: 2, borderRadius: 2 }} />
              </Box>
            )}

            {/* No Results */}
            {!loading && shouldShowSearchNoResults && (
              <Alert severity="info">
                No FAQs found for your query: "{searchQuery}". Try asking the AI!
              </Alert>
            )}
            
            {/* ✅ MODIFIED: Map over paginatedFAQs instead of filteredFAQs */}
            {!loading && paginatedFAQs.length > 0 && (
              <Box>
                {paginatedFAQs.map((faq) => (
                  <FAQDisplay key={faq.id} faq={faq} searchQuery={searchQuery} />
                ))}
              </Box>
            )}

            {/* ✅ ADDED: Pagination Controls */}
            {pageCount > 1 && (
              <Box sx={{ display: 'flex', justifyContent: 'center', mt: 4 }}>
                <Pagination
                  count={pageCount}
                  page={currentPage}
                  onChange={handlePageChange}
                  color="primary"
                  sx={{
                    '& .MuiPaginationItem-root': {
                      color: 'white',
                      backgroundColor: 'rgba(0,0,0,0.1)',
                    },
                    '& .Mui-selected': {
                      backgroundColor: 'white',
                      color: 'primary.main',
                      fontWeight: 'bold',
                    },
                  }}
                />
              </Box>
            )}

          </Grid>
          
          {/* ... (Popular Questions sidebar is unchanged) ... */}
          <Grid item xs={12} md={4}>
            {/* ... */}
          </Grid>
        </Grid>
      </Container>
    </Box>
  );
};

export default Home;
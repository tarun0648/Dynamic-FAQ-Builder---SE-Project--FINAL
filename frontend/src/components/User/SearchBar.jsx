import { useState, useEffect } from 'react';
import {
  Box,
  TextField,
  InputAdornment,
  Autocomplete,
  IconButton,
  Chip,
  Button,
  Paper,
  Typography,
  CircularProgress,
  Divider,
  List,
  ListItem,
  ListItemButton,
  ListItemText,
  Tooltip
} from '@mui/material';
import { 
  Search, 
  Clear, 
  SmartToy, 
  History,
  ThumbUp,
  ThumbDown,
  Visibility
} from '@mui/icons-material';
import searchService from '../../services/searchService';
import geminiService from '../../services/geminiService';
import faqService from '../../services/faqService';
import { toast } from 'react-toastify';

const SearchBar = ({ faqs, onSearch, onFilterChange, onAIResponse }) => {
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState([]);
  const [historySuggestions, setHistorySuggestions] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [categories, setCategories] = useState([]);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiAnswer, setAiAnswer] = useState('');
  const [showAIAnswer, setShowAIAnswer] = useState(false);
  const [currentAIQAId, setCurrentAIQAId] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [qaHistory, setQAHistory] = useState([]);

  useEffect(() => {
    // Extract unique categories
    const uniqueCategories = [...new Set(faqs.map(faq => faq.category).filter(Boolean))];
    setCategories(uniqueCategories);
    
    // Set the first category as selected if none is selected
    if (!selectedCategory && uniqueCategories.length > 0) {
      setSelectedCategory(uniqueCategories[0]);
      onFilterChange({ category: uniqueCategories[0] });
    }
    
    // Load AI Q&A history
    loadAIHistory();

    // Subscribe to AI Q&A history updates
    const unsubscribe = faqService.subscribeAIQA((history) => {
      setQAHistory(history);
    });

    return () => unsubscribe();
  }, [faqs, selectedCategory, onFilterChange]);
    
  useEffect(() => {
    if (query.length >= 2) {
      // Get FAQ suggestions
      const newSuggestions = searchService.getSearchSuggestions(query, faqs, 5);
      setSuggestions(newSuggestions);

      // Get AI history suggestions only if we're not showing an AI answer
      if (!showAIAnswer) {
        searchAIHistory(query);
      }
    } else {
      setSuggestions([]);
      setHistorySuggestions([]);
      setShowHistory(false);
    }
  }, [query, faqs, qaHistory]);

  const loadAIHistory = async () => {
    try {
      const history = await faqService.getAllAIQA();
      setQAHistory(history);
    } catch (error) {
      console.error('Error loading AI history:', error);
    }
  };

  const searchAIHistory = (searchQuery) => {
    const lowerQuery = searchQuery.toLowerCase();
    const matches = qaHistory.filter(qa =>
      qa.question.toLowerCase().includes(lowerQuery)
    ).slice(0, 5); // Show top 5 matches

    setHistorySuggestions(matches);
    setShowHistory(matches.length > 0);
  };

  const handleSearch = (searchQuery) => {
    setQuery(searchQuery);
    setShowAIAnswer(false);
    setAiAnswer('');
    setCurrentAIQAId(null);
    onSearch(searchQuery, { category: selectedCategory });
  };

  const handleClear = () => {
    setQuery('');
    setShowAIAnswer(false);
    setAiAnswer('');
    setCurrentAIQAId(null);
    setShowHistory(false);
    onSearch('', { category: selectedCategory });
  };

  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
    onFilterChange({ category });
    onSearch(query, { category });
  };

  const handleHistoryClick = async (qa) => {
    // Load the saved Q&A
    setQuery(qa.question);
    setAiAnswer(qa.answer);
    setShowAIAnswer(true);
    setCurrentAIQAId(qa.id);
    setShowHistory(false);

    // Increment view count
    await faqService.incrementAIQAViews(qa.id);

    // Filter FAQs based on the question
    onSearch(qa.question, { category: selectedCategory });

    // Notify parent
    if (onAIResponse) {
      onAIResponse(qa.answer);
    }

    toast.info('Loaded from history!');
  };

  const handleAskAI = async () => {
    if (!query || query.trim().length < 3) {
      toast.error('Please enter a question (at least 3 characters)');
      return;
    }

    // Hide history suggestions when asking AI
    setShowHistory(false);

    // Check if similar question exists in history
    const similarQuestion = qaHistory.find(qa => 
      qa.question.toLowerCase() === query.toLowerCase()
    );

    if (similarQuestion) {
      // Load from history instead of calling AI
      handleHistoryClick(similarQuestion);
      return;
    }

    setLoadingAI(true);
    setShowAIAnswer(false);
    
    try {
      // Find the most relevant FAQ
      const rankedFAQs = searchService.rankFAQs(query, faqs);
      
      // ✅ FIXED: Call the main generateAnswer() function which handles errors
      const response = await geminiService.generateAnswer(
        query, 
        rankedFAQs.slice(0, 5) // Pass the top 5 relevant FAQs
      );
      
      setAiAnswer(response);
      setShowAIAnswer(true);

      // Save to history
      const savedQA = await faqService.saveAIQA({
        question: query,
        answer: response,
        relatedFAQs: rankedFAQs.slice(0, 3).map(faq => faq.id),
        category: rankedFAQs.length > 0 ? rankedFAQs[0].category : 'General',
        tags: extractKeywords(query)
      });

      setCurrentAIQAId(savedQA.id);

      if (onAIResponse) {
        onAIResponse(response);
      }

      toast.success('AI answer generated and saved!');
    } catch (error) {
      // This catch block is for errors in saving, not in generation
      // Generation errors are handled inside geminiService.generateAnswer()
      console.error('Error in handleAskAI:', error);
      toast.error('Failed to save AI answer. Please try again.');
    } finally {
      setLoadingAI(false);
    }
  };

  const handleVote = async (isUpvote) => {
    if (!currentAIQAId) {
      toast.error('No AI answer to vote on');
      return;
    }

    try {
      await faqService.voteAIQA(currentAIQAId, isUpvote);
      toast.success(isUpvote ? 'Marked as helpful!' : 'Feedback recorded');
    } catch (error) {
      toast.error('Failed to record vote');
    }
  };

  const extractKeywords = (text) => {
    const words = text.toLowerCase()
      .replace(/[^\w\s]/g, '')
      .split(/\s+/)
      .filter(word => word.length > 3);
    return [...new Set(words)].slice(0, 5);
  };

  const handleKeyPress = (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      handleAskAI();
    }
  };

  return (
    <Box sx={{ mb: 4 }}>
      {/* Search Input with AI Button */}
      <Box sx={{ display: 'flex', gap: 1, mb: 2, position: 'relative' }}>
        <Box sx={{ flex: 1, position: 'relative' }}>
          <Autocomplete
            freeSolo
            fullWidth
            options={suggestions}
            inputValue={query}
            onInputChange={(event, newValue) => {
              if (event) {
                handleSearch(newValue);
              }
            }}
            renderInput={(params) => (
              <TextField
                {...params}
                placeholder="Ask a question... (e.g., 'How do I reset my password?')"
                variant="outlined"
                onKeyPress={handleKeyPress}
                InputProps={{
                  ...params.InputProps,
                  startAdornment: (
                    <InputAdornment position="start">
                      <Search color="action" />
                    </InputAdornment>
                  ),
                  endAdornment: (
                    <>
                      {query && (
                        <InputAdornment position="end">
                          <IconButton onClick={handleClear} size="small">
                            <Clear />
                          </IconButton>
                        </InputAdornment>
                      )}
                      {params.InputProps.endAdornment}
                    </>
                  ),
                  sx: {
                    fontSize: '1.1rem',
                    bgcolor: 'white',
                    borderRadius: 2,
                    '& .MuiOutlinedInput-notchedOutline': {
                      borderWidth: 2,
                    },
                    '&:hover .MuiOutlinedInput-notchedOutline': {
                      borderColor: 'primary.main',
                    },
                  },
                }}
              />
            )}
          />

          {/* History Suggestions Dropdown */}
          {showHistory && historySuggestions.length > 0 && (
            <Paper
              elevation={4}
              sx={{
                position: 'absolute',
                top: '100%',
                left: 0,
                right: 0,
                zIndex: 1000,
                mt: 1,
                maxHeight: '300px',
                overflow: 'auto'
              }}
            >
              <Box sx={{ p: 2, bgcolor: '#f5f5f5', borderBottom: '1px solid #e0e0e0' }}>
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <History color="primary" />
                  <Typography variant="subtitle2" sx={{ fontWeight: 600 }}>
                    Previously Asked Questions
                  </Typography>
                </Box>
                <Typography variant="caption" color="text.secondary">
                  Click to load saved answer
                </Typography>
              </Box>
              <List>
                {historySuggestions.map((qa) => (
                  <ListItem key={qa.id} disablePadding>
                    <ListItemButton onClick={() => handleHistoryClick(qa)}>
                      <ListItemText
                        primary={qa.question}
                        secondary={
                          <Box sx={{ display: 'flex', gap: 2, mt: 0.5 }}>
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <Visibility fontSize="small" sx={{ fontSize: 14 }} />
                              {qa.views || 0}
                            </Typography>
                            <Typography variant="caption" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                              <ThumbUp fontSize="small" sx={{ fontSize: 14 }} />
                              {qa.upvotes || 0}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              {qa.createdAt?.toDate?.()?.toLocaleDateString?.() || 'Recently'}
                            </Typography>
                          </Box>
                        }
                        primaryTypographyProps={{
                          sx: { fontWeight: 500 }
                        }}
                      />
                    </ListItemButton>
                  </ListItem>
                ))}
              </List>
            </Paper>
          )}
        </Box>

        {/* Ask AI Button */}
        <Button
          variant="contained"
          size="large"
          onClick={handleAskAI}
          disabled={!query || query.trim().length < 3 || loadingAI}
          startIcon={loadingAI ? <CircularProgress size={20} color="inherit" /> : <SmartToy />}
          sx={{
            minWidth: '140px',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            textTransform: 'none',
            fontWeight: 600,
            whiteSpace: 'nowrap'
          }}
        >
          {loadingAI ? 'Thinking...' : 'Ask AI'}
        </Button>
      </Box>

      {/* AI Answer Display */}
      {showAIAnswer && aiAnswer && (
        <Paper
          elevation={3}
          sx={{
            p: 3,
            mb: 2,
            borderRadius: 2,
            background: 'linear-gradient(135deg, #f5f7fa 0%, #c3cfe2 100%)',
            border: '2px solid #667eea',
            animation: 'fadeIn 0.5s ease-in'
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
            <SmartToy sx={{ color: '#667eea', mr: 1, fontSize: 28 }} />
            <Typography variant="h6" sx={{ fontWeight: 700, color: '#667eea' }}>
              AI Answer
            </Typography>
            {currentAIQAId && (
              <Chip
                icon={<History />}
                label="Saved"
                size="small"
                color="success"
                sx={{ ml: 1 }}
              />
            )}
            <IconButton
              size="small"
              onClick={() => setShowAIAnswer(false)}
              sx={{ ml: 'auto' }}
            >
              <Clear />
            </IconButton>
          </Box>
          
          <Typography
            variant="body1"
            sx={{
              whiteSpace: 'pre-line',
              lineHeight: 1.8,
              color: '#334155',
              mb: 2
            }}
          >
            {aiAnswer}
          </Typography>

          <Divider sx={{ my: 2 }} />
          
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <Typography variant="body2" color="text.secondary" sx={{ fontStyle: 'italic' }}>
              💡 Scroll down to see relevant FAQs
            </Typography>
            
            {currentAIQAId && (
              <Box sx={{ display: 'flex', gap: 1 }}>
                <Tooltip title="Helpful">
                  <IconButton 
                    size="small" 
                    onClick={() => handleVote(true)}
                    sx={{ color: 'success.main' }}
                  >
                    <ThumbUp fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Not helpful">
                  <IconButton 
                    size="small" 
                    onClick={() => handleVote(false)}
                    sx={{ color: 'error.main' }}
                  >
                    <ThumbDown fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Box>
            )}
          </Box>
        </Paper>
      )}

      {/* Hint Text */}
      {!query && (
        <Box sx={{ mb: 2, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            💡 Type your question - if it was asked before, you'll see history suggestions!
          </Typography>
        </Box>
      )}

      {/* Category Filters */}
      <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, alignItems: 'center' }}>
        <Typography variant="body2" sx={{ fontWeight: 600, mr: 1, color: 'white' }}>
          Filter by:
        </Typography>
        {categories.map((category) => (
          <Chip
            key={category}
            label={category.charAt(0).toUpperCase() + category.slice(1)}
            onClick={() => handleCategoryChange(category)}
            color={selectedCategory === category ? 'primary' : 'default'}
            variant={selectedCategory === category ? 'filled' : 'outlined'}
            sx={{
              fontWeight: selectedCategory === category ? 600 : 400,
              cursor: 'pointer',
              bgcolor: selectedCategory === category ? 'primary.main' : 'white',
              '&:hover': {
                bgcolor: selectedCategory === category ? 'primary.dark' : 'grey.100',
              }
            }}
          />
        ))}
      </Box>
    </Box>
  );
};

export default SearchBar;
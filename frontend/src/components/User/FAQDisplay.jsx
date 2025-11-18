import React from 'react';
import {
  Box,
  Typography,
  Paper,
  List,
  ListItem,
  ListItemText,
  Divider,
  Chip,
  Collapse,
  IconButton,
  Button,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  CircularProgress
} from '@mui/material';
import {
  ExpandMore,
  ExpandLess,
  SmartToy,
  Visibility,
  ThumbUp,
  ThumbDown,
  Category
} from '@mui/icons-material';
import { useFAQ } from '../../contexts/FAQContext';
import geminiService from '../../services/geminiService';
import { toast } from 'react-toastify';

const FAQDisplay = ({ faqs, searchQuery }) => {
  const [expandedId, setExpandedId] = React.useState(null);
  const [aiModalOpen, setAiModalOpen] = React.useState(false);
  const [aiResponse, setAiResponse] = React.useState('');
  const [loadingAI, setLoadingAI] = React.useState(false);
  const { incrementViews, markAsHelpful, markAsNotHelpful } = useFAQ();

  const handleToggle = (id) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleGetAIResponse = async (faq) => {
    setAiModalOpen(true);
    setLoadingAI(true);
    
    try {
      // ✅ FIXED: Call the main generateAnswer() function which handles errors
      const response = await geminiService.generateAnswer(searchQuery || faq.question, [faq]);
      setAiResponse(response);
    } catch (error) {
      // This will only catch errors if generateAnswer itself fails, not the AI call
      toast.error('Failed to get AI response');
      console.error(error);
    } finally {
      setLoadingAI(false);
    }
  };

  const highlightText = (text) => {
    if (!searchQuery) return text;
    // Use a more robust regex to avoid highlighting parts of words
    const tokens = searchService.tokenize(searchQuery);
    if (tokens.length === 0) return text;
    
    const regex = new RegExp(`\\b(${tokens.join('|')})\\b`, 'gi');
    return text.replace(regex, '<mark class="bg-yellow-200 px-1 rounded">$1</mark>');
  };

  if (!faqs || faqs.length === 0) {
    return (
      <Box sx={{ width: '100%', mt: 3 }}>
        {/* Empty state - renders nothing */}
      </Box>
    );
  }

  return (
    <Box sx={{ width: '100%', mt: 3 }}>
      <List sx={{ width: '100%', bgcolor: 'transparent' }}>
        {faqs.map((faq) => (
          <Paper
            key={faq.id}
            elevation={2}
            sx={{
              mb: 2,
              overflow: 'hidden',
              borderRadius: 2,
              bgcolor: 'rgba(255, 255, 255, 0.9)',
              '&:hover': {
                bgcolor: 'rgba(255, 255, 255, 1)',
                boxShadow: 3,
              }
            }}
          >
            <ListItem 
              button 
              onClick={() => handleToggle(faq.id)}
              sx={{ 
                display: 'flex', 
                flexDirection: 'column', 
                alignItems: 'stretch',
                p: 2
              }}
            >
              <Box sx={{ 
                display: 'flex', 
                width: '100%', 
                alignItems: 'flex-start',
                justifyContent: 'space-between'
              }}>
                <ListItemText
                  primary={
                    <Typography 
                      variant="h6" 
                      component="div"
                      sx={{ 
                        color: '#2c3e50',
                        fontWeight: 600,
                        mb: 1
                      }}
                    >
                      {faq.question}
                    </Typography>
                  }
                />
                {expandedId === faq.id ? <ExpandLess /> : <ExpandMore />}
              </Box>
              
              <Collapse in={expandedId === faq.id} timeout="auto" unmountOnExit>
                <Box sx={{ mt: 2 }}>
                  <Typography 
                    variant="body1" 
                    sx={{ 
                      color: '#34495e',
                      whiteSpace: 'pre-line',
                      mb: 2
                    }}
                  >
                    {faq.answer}
                  </Typography>
                  {faq.category && (
                    <Chip 
                      label={faq.category}
                      size="small"
                      sx={{ 
                        bgcolor: '#667eea',
                        color: 'white',
                        fontWeight: 500
                      }}
                    />
                  )}

                  <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 2, pt: 2, borderTop: '1px solid #e0e0e0' }}>
                    <Box sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
                      <Typography variant="caption" color="text.secondary" sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                        <Visibility fontSize="small" /> {faq.views || 0} views
                      </Typography>
                      <IconButton
                        size="small"
                        onClick={() => markAsHelpful(faq.id)}
                        sx={{ color: 'success.main' }}
                      >
                        <ThumbUp fontSize="small" />
                      </IconButton>
                      <Typography variant="caption">{faq.helpful || 0}</Typography>
                      <IconButton
                        size="small"
                        onClick={() => markAsNotHelpful(faq.id)}
                        sx={{ color: 'error.main' }}
                      >
                        <ThumbDown fontSize="small" />
                      </IconButton>
                      <Typography variant="caption">{faq.notHelpful || 0}</Typography>
                    </Box>

                    <Button
                      variant="contained"
                      size="small"
                      startIcon={<SmartToy />}
                      onClick={() => handleGetAIResponse(faq)}
                      sx={{
                        textTransform: 'none',
                        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
                      }}
                    >
                      Get AI Response
                    </Button>
                  </Box>
                </Box>
              </Collapse>
            </ListItem>
          </Paper>
        ))}
      </List>

      {/* AI Response Modal */}
      <Dialog
        open={aiModalOpen}
        onClose={() => setAiModalOpen(false)}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle sx={{ bgcolor: 'primary.main', color: 'white', display: 'flex', alignItems: 'center', gap: 1 }}>
          <SmartToy />
          AI-Enhanced Response
        </DialogTitle>
        <DialogContent sx={{ mt: 2 }}>
          {loadingAI ? (
            <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', py: 4 }}>
              <CircularProgress />
              <Typography sx={{ mt: 2 }} color="text.secondary">
                Generating AI response...
              </Typography>
            </Box>
          ) : (
            <>
              <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 600 }}>
                Original Question:
              </Typography>
              <Typography variant="body1" paragraph sx={{ mb: 3 }}>
                {faq.question}
              </Typography>
              
              <Typography variant="subtitle2" color="primary" gutterBottom sx={{ fontWeight: 600 }}>
                AI-Enhanced Answer:
              </Typography>
              <Typography
                variant="body1"
                sx={{ whiteSpace: 'pre-line', lineHeight: 1.7 }}
              >
                {aiResponse}
              </Typography>
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAiModalOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

export default FAQDisplay;
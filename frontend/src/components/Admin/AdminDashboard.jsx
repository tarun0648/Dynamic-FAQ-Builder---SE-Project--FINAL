import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useFAQ } from '../../contexts/FAQContext';
import {
  Container,
  Box,
  Typography,
  Button,
  Grid,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  DialogContent,
  TextField,
  DialogActions,
  IconButton,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Alert
} from '@mui/material';
import {
  Add,
  Edit,
  Delete,
  QuestionAnswer,
  Visibility,
  ThumbUp,
  Category as CategoryIcon
} from '@mui/icons-material';
import { toast } from 'react-toastify';
import LoadingSpinner from '../Common/LoadingSpinner';
import geminiService from '../../services/geminiService';

const AdminDashboard = () => {
  const { isAdmin } = useAuth();
  const { faqs, loading, createFAQ, updateFAQ, deleteFAQ } = useFAQ();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingFAQ, setEditingFAQ] = useState(null);
  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: '',
    tags: '',
    keywords: '' // ✅ ADDED: Keywords state
  });
  const [aiSuggesting, setAiSuggesting] = useState(false);

  if (!isAdmin) {
    return (
      <Container sx={{ mt: 4 }}>
        <Alert severity="error">You don't have permission to access this page.</Alert>
      </Container>
    );
  }

  const handleOpenDialog = (faq = null) => {
    if (faq) {
      setEditingFAQ(faq);
      setFormData({
        question: faq.question,
        answer: faq.answer,
        category: faq.category || '',
        tags: faq.tags?.join(', ') || '',
        keywords: faq.keywords?.join(', ') || '' // ✅ ADDED: Load keywords into form
      });
    } else {
      setEditingFAQ(null);
      setFormData({ question: '', answer: '', category: '', tags: '', keywords: '' });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingFAQ(null);
    setFormData({ question: '', answer: '', category: '', tags: '', keywords: '' });
  };

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSuggestAnswer = async () => {
    if (!formData.question) {
      toast.error('Please enter a question first');
      return;
    }

    setAiSuggesting(true);
    try {
      const suggestion = await geminiService.generateAnswerSuggestion(
        formData.question,
        formData.category
      );
      setFormData({ ...formData, answer: suggestion });
      toast.success('AI suggestion generated!');
    } catch (error) {
      toast.error('Failed to generate suggestion');
    } finally {
      setAiSuggesting(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const faqData = {
      question: formData.question.trim(),
      answer: formData.answer.trim(),
      category: formData.category.trim() || 'General',
      tags: formData.tags.split(',').map(tag => tag.trim()).filter(Boolean),
      keywords: formData.keywords.split(',').map(kw => kw.trim()).filter(Boolean) // ✅ ADDED: Process keywords
    };

    // ✅ ADDED: Validate keywords count
    if (faqData.keywords.length > 10) {
      toast.error('You can only have a maximum of 10 keywords.');
      return;
    }

    try {
      if (editingFAQ) {
        await updateFAQ(editingFAQ.id, faqData);
      } else {
        await createFAQ(faqData);
      }
      handleCloseDialog();
    } catch (error) {
      console.error('Error saving FAQ:', error);
    }
  };

  const handleDelete = async (id) => {
    if (window.confirm('Are you sure you want to delete this FAQ?')) {
      try {
        await deleteFAQ(id);
      } catch (error) {
        console.error('Error deleting FAQ:', error);
      }
    }
  };

  if (loading) return <LoadingSpinner message="Loading dashboard..." />;

  const totalViews = faqs.reduce((sum, faq) => sum + (faq.views || 0), 0);
  const totalHelpful = faqs.reduce((sum, faq) => sum + (faq.helpful || 0), 0);
  const categories = [...new Set(faqs.map(faq => faq.category))].length;

  return (
    <Container maxWidth="xl" sx={{ mt: 4, mb: 4 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 4 }}>
        <Typography variant="h4" sx={{ fontWeight: 700 }}>
          Admin Dashboard
        </Typography>
        <Button
          variant="contained"
          startIcon={<Add />}
          onClick={() => handleOpenDialog()}
          sx={{
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            textTransform: 'none',
            px: 3
          }}
        >
          Add New FAQ
        </Button>
      </Box>

      {/* Stats Cards */}
      <Grid container spacing={3} sx={{ mb: 4 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#667eea', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>{faqs.length}</Typography>
                  <Typography variant="body2">Total FAQs</Typography>
                </Box>
                <QuestionAnswer sx={{ fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#764ba2', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>{totalViews}</Typography>
                  <Typography variant="body2">Total Views</Typography>
                </Box>
                <Visibility sx={{ fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#10b981', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>{totalHelpful}</Typography>
                  <Typography variant="body2">Helpful Votes</Typography>
                </Box>
                <ThumbUp sx={{ fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Card sx={{ bgcolor: '#f59e0b', color: 'white' }}>
            <CardContent>
              <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <Box>
                  <Typography variant="h3" sx={{ fontWeight: 700 }}>{categories}</Typography>
                  <Typography variant="body2">Categories</Typography>
                </Box>
                <CategoryIcon sx={{ fontSize: 48, opacity: 0.8 }} />
              </Box>
            </CardContent>
          </Card>
        </Grid>
      </Grid>

      {/* FAQ Table */}
      <Card>
        <CardContent>
          <Typography variant="h6" sx={{ mb: 2, fontWeight: 600 }}>
            All FAQs
          </Typography>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell sx={{ fontWeight: 600 }}>Question</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Category</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Views</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Helpful</TableCell>
                  <TableCell sx={{ fontWeight: 600 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {faqs.map((faq) => (
                  <TableRow key={faq.id} hover>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontWeight: 500 }}>
                        {faq.question}
                      </Typography>
                      <Box sx={{ mt: 0.5 }}>
                        {faq.tags?.slice(0, 3).map((tag, idx) => (
                          <Chip key={idx} label={tag} size="small" sx={{ mr: 0.5, mt: 0.5 }} />
                        ))}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <Chip label={faq.category || 'General'} size="small" color="primary" variant="outlined" />
                    </TableCell>
                    <TableCell>{faq.views || 0}</TableCell>
                    <TableCell>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <ThumbUp fontSize="small" color="success" />
                        {faq.helpful || 0}
                      </Box>
                    </TableCell>
                    <TableCell>
                      <IconButton
                        size="small"
                        onClick={() => handleOpenDialog(faq)}
                        color="primary"
                      >
                        <Edit />
                      </IconButton>
                      <IconButton
                        size="small"
                        onClick={() => handleDelete(faq.id)}
                        color="error"
                      >
                        <Delete />
                      </IconButton>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        </CardContent>
      </Card>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={handleCloseDialog} maxWidth="md" fullWidth>
        <DialogTitle>
          {editingFAQ ? 'Edit FAQ' : 'Add New FAQ'}
        </DialogTitle>
        <form onSubmit={handleSubmit}>
          <DialogContent>
            <TextField
              fullWidth
              label="Question"
              name="question"
              value={formData.question}
              onChange={handleChange}
              margin="normal"
              required
              multiline
              rows={2}
            />

            <Box sx={{ display: 'flex', gap: 1, alignItems: 'center', mt: 2 }}>
              <TextField
                fullWidth
                label="Answer"
                name="answer"
                value={formData.answer}
                onChange={handleChange}
                margin="normal"
                required
                multiline
                rows={6}
              />
            </Box>

            <Button
              variant="outlined"
              size="small"
              onClick={handleSuggestAnswer}
              disabled={aiSuggesting}
              sx={{ mt: 1, textTransform: 'none' }}
            >
              {aiSuggesting ? 'Generating...' : 'AI Suggest Answer'}
            </Button>

            <TextField
              fullWidth
              label="Category"
              name="category"
              value={formData.category}
              onChange={handleChange}
              margin="normal"
              helperText="e.g., Technical, Account, Billing"
            />
            
            {/* ✅ ADDED: Keywords Field */}
            <TextField
              fullWidth
              label="Keywords"
              name="keywords"
              value={formData.keywords}
              onChange={handleChange}
              margin="normal"
              helperText="Comma-separated keywords (Max 10). These are critical for search ranking."
            />

            <TextField
              fullWidth
              label="Tags"
              name="tags"
              value={formData.tags}
              onChange={handleChange}
              margin="normal"
              helperText="Comma-separated tags (e.g., password, security, login)"
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={handleCloseDialog}>Cancel</Button>
            <Button type="submit" variant="contained">
              {editingFAQ ? 'Update' : 'Create'}
            </Button>
          </DialogActions>
        </form>
      </Dialog>
    </Container>
  );
};

export default AdminDashboard;
import { Box, Container, Typography, Link, Grid } from '@mui/material';
import { GitHub, LinkedIn } from '@mui/icons-material';

const Footer = () => {
  return (
    <Box
      component="footer"
      sx={{
        py: 4,
        px: 2,
        mt: 'auto',
        background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        color: 'white'
      }}
    >
      <Container maxWidth="lg">
        <Grid container spacing={4}>
          <Grid item xs={12} sm={4}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 700 }}>
              Dynamic FAQ Builder
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              AI-powered FAQ management system with intelligent search and real-time responses.
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Project Info
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              <strong>Course:</strong> UE23CS341A<br />
              <strong>Team:</strong> Tesseract<br />
              <strong>Project ID:</strong> P31<br />
              <strong>Institution:</strong> PES University
            </Typography>
          </Grid>
          <Grid item xs={12} sm={4}>
            <Typography variant="h6" gutterBottom sx={{ fontWeight: 600 }}>
              Team Members
            </Typography>
            <Typography variant="body2" sx={{ opacity: 0.9 }}>
              • Tarun S (Scrum Master)<br />
              • Adityaa Kumar H<br />
              • Akshay P Shetti<br />
              • Akshay Nadadhur
            </Typography>
          </Grid>
        </Grid>
        <Box sx={{ mt: 3, pt: 3, borderTop: '1px solid rgba(255,255,255,0.2)' }}>
          <Grid container justifyContent="space-between" alignItems="center">
            <Grid item>
              <Typography variant="body2" sx={{ opacity: 0.8 }}>
                © 2025 Team Tesseract. All rights reserved.
              </Typography>
            </Grid>
            <Grid item>
              <Link
                href="https://github.com/pestechnology/PESU_RR_AIML_A_P31_Dynamic_FAQ_Builder_Tesseract"
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'white', mx: 1 }}
              >
                <GitHub />
              </Link>
            </Grid>
          </Grid>
        </Box>
      </Container>
    </Box>
  );
};

export default Footer;

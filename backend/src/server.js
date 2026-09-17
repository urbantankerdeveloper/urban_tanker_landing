import express from 'express';
import cors from 'cors';
import compression from 'compression';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import { closeConnection, contentCollection } from './database/connection.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;
const contentCache = new Map();
const contentCacheTtlMs = Number(process.env.CONTENT_CACHE_TTL_MS || 60000);

app.disable('x-powered-by');
app.set('trust proxy', 1);

// Middleware
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:5173',
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(compression());
app.use(express.json({ limit: '64kb' }));
app.use(express.urlencoded({ extended: true, limit: '64kb' }));

// Request logging middleware
app.use((req, res, next) => {
  if (process.env.NODE_ENV !== 'production') console.log(`${req.method} ${req.path}`);
  next();
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.get('/api/content/:clientId', async (req, res) => {
  try {
    const clientId = req.params.clientId;
    const cached = contentCache.get(clientId);
    if (cached && cached.expiresAt > Date.now()) {
      res.set('Cache-Control', 'public, max-age=60');
      return res.json(cached.value);
    }
    const document = await contentCollection.findOne({ client_id: clientId }, { projection: { _id: 0, config: 1, coupons: 1 } });
    if (!document) return res.status(404).json({ message: 'Content configuration was not found.' });
    const value = { ...document.config, coupons: document.coupons || [] };
    contentCache.set(clientId, { value, expiresAt: Date.now() + contentCacheTtlMs });
    res.set('Cache-Control', 'public, max-age=60');
    res.json(value);
  } catch (error) {
    console.error('Content lookup error:', error);
    res.status(500).json({ message: 'Unable to load content configuration.' });
  }
});

// API Routes
app.use('/api/auth', authRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Urban Tanker Backend running on http://0.0.0.0:${PORT}`);
  console.log(`📝 Health check: http://localhost:${PORT}/health`);
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('SIGTERM received. Closing server...');
  await closeConnection();
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('SIGINT received. Closing server...');
  await closeConnection();
  process.exit(0);
});

export default app;

import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { createServer } from 'http';
import { testConnection } from './config/database';
import models from './models';
import socketService from './services/socketService';

// Routes
import authRoutes from './routes/authRoutes';
import errandRoutes from './routes/errandRoutes';
import runnerRoutes from './routes/runnerRoutes'; // Added based on console log

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Create HTTP server for WebSockets
const server = createServer(app);

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Database connection (only in non-test environment)
if (process.env.NODE_ENV !== 'test') {
  testConnection();
}

// Initialize WebSocket service
socketService.initialize(server);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/errands', errandRoutes);
app.use('/api/runners', runnerRoutes); // Added based on console log

// Health check route
app.get('/api/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'Campus Connect API is running',
    timestamp: new Date().toISOString(),
    database: 'Connected'
  });
});

// Test database route
app.get('/api/test-db', async (req, res) => {
  try {
    const userCount = await models.User.count();
    const runnerCount = await models.Runner.count();
    const errandCount = await models.Errand.count();
    
    res.status(200).json({ 
      message: 'Database test successful',
      counts: {
        users: userCount,
        runners: runnerCount,
        errands: errandCount
      }
    });
  } catch (error) {
    console.error('Database test failed:', error);
    res.status(500).json({ 
      message: 'Database test failed',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Basic error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error(err.stack);
  res.status(500).json({ message: 'Something went wrong!' });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

// Update the server listen at the bottom:
// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  server.listen(PORT, () => {
    console.log(`🚀 Campus Connect API running on port ${PORT}`);
    console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Database: ${process.env.DATABASE_URL?.split('@')[1] || 'localhost'}`);
    console.log(`🔑 Authentication routes: /api/auth/*`);
    console.log(`📦 Errand routes: /api/errands/*`);
    console.log(`🏃 Runner routes: /api/runners/*`);
    console.log(`🔌 WebSocket server: Active on port ${PORT}`);
  });
}

export default app;
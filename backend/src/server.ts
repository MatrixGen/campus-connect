import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import dotenv from 'dotenv';
import { testConnection } from './config/database';
import models from './models';

// Routes
import authRoutes from './routes/authRoutes';
import errandRoutes from './routes/errandRoutes';


// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(helmet());
app.use(cors());
app.use(morgan('combined'));
app.use(express.json());

// Database connection (only in non-test environment)
if (process.env.NODE_ENV !== 'test') {
  testConnection();
}

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/errands', errandRoutes);

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

// Only start server if not in test environment
if (process.env.NODE_ENV !== 'test') {
  app.listen(PORT, () => {
    console.log(`🚀 Campus Connect API running on port ${PORT}`);
    console.log(`📚 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Database: ${process.env.DATABASE_URL?.split('@')[1] || 'localhost'}`);
    console.log(`🔑 Authentication routes: /api/auth/*`);
  });
}

export default app;
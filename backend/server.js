require('dotenv').config();
const express = require('express');
const cors = require('cors');
const { initDB, getDBType } = require('./database/db');
const chatRoutes = require('./routes/chat');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api/chat', chatRoutes);

// Root health check endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'SmartChat AI Backend API',
    status: 'running',
    version: '1.1.0',
    database: getDBType(),
    documentation: 'Send POST requests to /api/chat/message with { message, conversationId }'
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error', details: err.message });
});

// Initialize database then start server
initDB().then(() => {
  app.listen(PORT, () => {
    console.log(`=======================================================`);
    console.log(`  SmartChat AI Server running on http://localhost:${PORT}`);
    console.log(`  Database: ${getDBType()}`);
    console.log(`  Provider: ${process.env.LLM_PROVIDER || 'openai'}`);
    console.log(`  Context Window Limit: ${process.env.CONTEXT_WINDOW_LIMIT || 10} messages`);
    console.log(`=======================================================`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});

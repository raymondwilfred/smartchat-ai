const express = require('express');
const router = express.Router();
const { v4: uuidv4 } = require('uuid');
const {
  processChatMessage,
  getHistory,
  clearHistory,
  getAllConversations,
  getDBType,
  CONTEXT_WINDOW_LIMIT
} = require('../services/aiService');

/**
 * GET /api/chat/health
 * Returns service status, active database, and configuration
 */
router.get('/health', (req, res) => {
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('your_'));
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('your_'));

  res.json({
    status: 'healthy',
    provider,
    model: provider === 'gemini' ? (process.env.GEMINI_MODEL || 'gemini-1.5-flash') : (process.env.OPENAI_MODEL || 'gpt-4o-mini'),
    database: getDBType(),
    contextWindowLimit: CONTEXT_WINDOW_LIMIT,
    keysConfigured: {
      openai: hasOpenAI,
      gemini: hasGemini
    }
  });
});

/**
 * GET /api/chat/conversations
 * Returns list of all persisted conversations from database
 */
router.get('/conversations', async (req, res) => {
  try {
    const list = await getAllConversations();
    res.json({
      database: getDBType(),
      count: list.length,
      conversations: list
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve conversations from database', details: err.message });
  }
});

/**
 * POST /api/chat/message
 * Sends user message to LLM with multi-turn context and database persistence
 */
router.post('/message', async (req, res) => {
  try {
    const { message, conversationId } = req.body;

    if (!message || typeof message !== 'string' || message.trim() === '') {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const convId = conversationId && conversationId.trim() !== '' ? conversationId : uuidv4();

    const result = await processChatMessage(convId, message.trim());
    return res.json(result);
  } catch (err) {
    console.error('Chat error:', err.message);

    const statusCode = err.status || 500;
    return res.status(statusCode).json({
      error: err.message || 'An unexpected error occurred while communicating with the AI service.',
      type: err.type || 'SERVER_ERROR',
      hint: statusCode === 401 ? 'Please verify your API key in backend/.env' : undefined
    });
  }
});

/**
 * GET /api/chat/history/:conversationId
 * Returns full conversation history from database
 */
router.get('/history/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const history = await getHistory(conversationId);
    res.json({
      conversationId,
      database: getDBType(),
      totalMessages: history.length,
      messages: history
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch conversation history from database', details: err.message });
  }
});

/**
 * DELETE /api/chat/history/:conversationId
 * Clears conversation history from database
 */
router.delete('/history/:conversationId', async (req, res) => {
  try {
    const { conversationId } = req.params;
    const cleared = await clearHistory(conversationId);
    res.json({
      conversationId,
      cleared,
      message: 'Conversation history deleted from database.'
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to delete conversation from database', details: err.message });
  }
});

module.exports = router;

const { OpenAI } = require('openai');
const db = require('../database/db');

// Configurable Context Window Limit (default: last 10 messages)
const CONTEXT_WINDOW_LIMIT = parseInt(process.env.CONTEXT_WINDOW_LIMIT, 10) || 10;

// Defined System Prompt: Gives SmartChat AI identity, role, and context awareness
const SYSTEM_PROMPT = `You are SmartChat AI, a friendly, perceptive, and highly capable conversational assistant.
Your core strengths:
1. Memory & Continuity: You actively remember personal details, academic background, goals, and interests that the user shares earlier in the conversation (such as their name, college, study area, and projects).
2. Persona: Warm, encouraging, concise, and articulate.
3. Natural Recall: Whenever the user asks you to recall or synthesize things they mentioned previously, accurately provide them with full conversational awareness.`;

/**
 * Call OpenAI API with context window
 */
async function callOpenAI(recentMessages, systemPrompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey || apiKey.startsWith('your_') || apiKey.trim() === '') {
    const error = new Error('OpenAI API key is missing. Please set OPENAI_API_KEY in your backend/.env file.');
    error.status = 401;
    error.type = 'MISSING_API_KEY';
    throw error;
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  const messagesPayload = [
    { role: 'system', content: systemPrompt },
    ...recentMessages.map(m => ({ role: m.role, content: m.content }))
  ];

  try {
    const response = await client.chat.completions.create({
      model,
      messages: messagesPayload,
      temperature: 0.7
    });

    const reply = response.choices[0]?.message?.content;
    if (!reply) {
      throw new Error('Received an empty response from OpenAI.');
    }
    return reply.trim();
  } catch (err) {
    if (err.status === 401) {
      const error = new Error('Invalid OpenAI API key. Check OPENAI_API_KEY in backend/.env.');
      error.status = 401;
      error.type = 'INVALID_API_KEY';
      throw error;
    }
    if (err.status === 429) {
      const error = new Error('OpenAI rate limit or billing quota exceeded. Please check your OpenAI account.');
      error.status = 429;
      error.type = 'RATE_LIMIT';
      throw error;
    }
    throw err;
  }
}

/**
 * Call Google Gemini API (Free tier support via native fetch)
 */
async function callGemini(recentMessages, systemPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey.startsWith('your_') || apiKey.trim() === '') {
    const error = new Error('Gemini API key is missing. Set GEMINI_API_KEY in backend/.env.');
    error.status = 401;
    error.type = 'MISSING_API_KEY';
    throw error;
  }

  const model = process.env.GEMINI_MODEL || 'gemini-1.5-flash';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const contents = recentMessages.map(m => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }]
  }));

  const requestBody = {
    contents,
    systemInstruction: {
      parts: [{ text: systemPrompt }]
    },
    generationConfig: {
      temperature: 0.7
    }
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(requestBody)
  });

  const data = await response.json();

  if (!response.ok) {
    const message = data.error?.message || 'Gemini API error';
    const error = new Error(message);
    error.status = response.status;
    error.type = response.status === 429 ? 'RATE_LIMIT' : 'API_ERROR';
    throw error;
  }

  const reply = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!reply) {
    throw new Error('Received an empty response from Gemini.');
  }
  return reply.trim();
}

/**
 * Main chat handler:
 * 1. Saves user message to database
 * 2. Fetches full history from database
 * 3. Applies Context Window Management (last N messages)
 * 4. Sends prompt + context window to LLM
 * 5. Saves assistant reply to database
 * 6. Returns reply and telemetry stats
 */
async function processChatMessage(conversationId, userMessageText) {
  // 1. Persist user message to database
  await db.saveMessage(conversationId, 'user', userMessageText);

  // 2. Fetch full conversation history from database
  const history = await db.getHistory(conversationId);

  // 3. CONTEXT WINDOW MANAGEMENT: Slice the last N messages
  // Retaining the latest N messages along with the system prompt
  const recentMessages = history.slice(-CONTEXT_WINDOW_LIMIT);
  const truncatedCount = Math.max(0, history.length - recentMessages.length);

  // 4. Determine LLM provider (OpenAI vs Gemini)
  const provider = (process.env.LLM_PROVIDER || 'openai').toLowerCase();
  let botReply = '';

  const hasOpenAI = Boolean(process.env.OPENAI_API_KEY && !process.env.OPENAI_API_KEY.startsWith('your_'));
  const hasGemini = Boolean(process.env.GEMINI_API_KEY && !process.env.GEMINI_API_KEY.startsWith('your_'));

  if (provider === 'gemini' || (!hasOpenAI && hasGemini)) {
    botReply = await callGemini(recentMessages, SYSTEM_PROMPT);
  } else {
    botReply = await callOpenAI(recentMessages, SYSTEM_PROMPT);
  }

  // 5. Persist assistant reply to database
  await db.saveMessage(conversationId, 'assistant', botReply);

  // 6. Return response and context stats
  return {
    reply: botReply,
    conversationId,
    stats: {
      totalStoredMessages: history.length + 1,
      contextMessagesSent: recentMessages.length,
      truncatedMessagesCount: truncatedCount,
      windowLimit: CONTEXT_WINDOW_LIMIT,
      database: db.getDBType()
    }
  };
}

module.exports = {
  processChatMessage,
  getHistory: db.getHistory,
  clearHistory: db.clearHistory,
  getAllConversations: db.getAllConversations,
  getDBType: db.getDBType,
  CONTEXT_WINDOW_LIMIT,
  SYSTEM_PROMPT
};

# 🧠 SmartChat AI — Context-Aware Multi-Turn Chatbot

> A Full-Stack conversational AI chatbot built with **React.js**, **Node.js + Express.js**, and the **OpenAI API** (with Google Gemini support), featuring active **Context Window Management** so it genuinely remembers earlier conversation turns.

---

## 🌟 What is SmartChat AI?

Most basic chatbots are stateless: they only answer one question at a time and immediately forget who you are. 

**SmartChat AI** solves this through **Multi-Turn Conversation Memory** and **Context Window Management**:
- **Multi-Turn Memory**: Maintains conversation state per session. If you tell the bot your name on Turn 1, your college on Turn 2, and your interests on Turn 3, it remembers and synthesizes them on Turn 5.
- **Context Window Management**: Rather than sending unlimited history forever (which crashes against token limits and wastes money), SmartChat AI implements a **Sliding Context Window** that retains the **last 10 messages** (`history.slice(-10)`) plus a custom **System Prompt**.

---

## 📋 Requirements Fulfilled

| Requirement | What it means | Implementation in SmartChat AI |
| :--- | :--- | :--- |
| **Backend API** | Endpoint communicating with OpenAI/Gemini | Express.js server with `POST /api/chat/message` |
| **Conversation History** | Store previous user and bot messages | In-memory session store tracking messages per `conversationId` |
| **Context Management** | Limit messages sent to the API | Sliding window slicing the last 10 messages (`history.slice(-10)`) |
| **System Prompt** | Define identity, role, and personality | Defined persona instructing the bot to actively recall user details |
| **Error Handling** | Understandable errors if API fails | Catches missing keys (401), rate limits (429), timeouts with clear UI banners |
| **Environment Variables** | Securely store API keys | Keys loaded from `.env` via `dotenv`, strictly ignored in `.gitignore` |
| **Frontend UI** | Modern usable interface | Responsive React.js SPA with message bubbles, typing indicators, and clear chat |

---

## 🛠 Tech Stack

- **Frontend**: React.js (Vite), Lucide Icons, Modern CSS
- **Backend**: Node.js, Express.js, CORS, Dotenv, UUID
- **LLM APIs**: Official OpenAI SDK (`gpt-4o-mini`) + Native Google Gemini API support (`gemini-1.5-flash`)

---

## 📁 Project Structure

```text
smartchat-ai/
├── backend/
│   ├── routes/
│   │   └── chat.js          # REST endpoints (/api/chat/message, /history, /health)
│   ├── services/
│   │   └── aiService.js     # Context window manager (history.slice(-10)) & LLM caller
│   ├── .env.example         # Sample environment variables
│   ├── .gitignore           # Excludes .env, node_modules, logs
│   ├── package.json         # Backend dependencies (Express, OpenAI, Dotenv, CORS)
│   └── server.js            # Express server initialization
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   └── Chat.jsx     # Chat viewport, message bubbles, telemetry, clear chat
│   │   ├── App.jsx          # Root React container
│   │   ├── index.css        # Modern dark theme stylesheet
│   │   └── main.jsx         # React DOM entry point
│   ├── index.html           # HTML template
│   ├── vite.config.js       # Vite bundler & API proxy configuration
│   └── package.json         # Frontend dependencies (React, Vite, Lucide)
├── .gitignore               # Root git ignore (guarantees .env is never committed)
└── README.md                # Project documentation and evaluation guide
```

---

## 🚀 Step-by-Step Setup Guide

### 1. Configure the Backend

Navigate to the `backend/` folder:
```bash
cd backend
```

Install backend dependencies:
```bash
npm install
```

Create your `.env` file from `.env.example`:
```bash
# On Windows PowerShell:
Copy-Item .env.example .env

# On macOS/Linux:
cp .env.example .env
```

Open `backend/.env` and insert your API key:
```env
PORT=5000
LLM_PROVIDER=openai
OPENAI_API_KEY=sk-proj-...your_openai_api_key_here
OPENAI_MODEL=gpt-4o-mini

# Or if using Google Gemini (Free tier from Google AI Studio):
# LLM_PROVIDER=gemini
# GEMINI_API_KEY=AIzaSy...your_gemini_api_key_here
# GEMINI_MODEL=gemini-1.5-flash

CONTEXT_WINDOW_LIMIT=10
```

Start the backend server:
```bash
npm start
```
*The server will run on `http://localhost:5000`.*

---

### 2. Configure and Run the Frontend

In a new terminal window, navigate to `frontend/`:
```bash
cd frontend
npm install
npm run dev
```

Open your browser to:
👉 **[http://localhost:3000](http://localhost:3000)**

---

## 🔍 How Context Window Management Works

When a user chats with an LLM, the model does not retain state on the server. If a user sends 50 messages, sending all 50 messages every time consumes excessive tokens and eventually exceeds model context limits.

SmartChat AI implements a **Sliding Context Window** inside `backend/services/aiService.js`:

```javascript
// 1. Record incoming user message
history.push({ role: 'user', content: userMessageText });

// 2. Retain only the last N messages (e.g. 10 messages)
const recentMessages = history.slice(-CONTEXT_WINDOW_LIMIT);

// 3. Dispatch system prompt + recent messages to LLM API
const messagesPayload = [
  { role: 'system', content: SYSTEM_PROMPT },
  ...recentMessages.map(m => ({ role: m.role, content: m.content }))
];

const completion = await openai.chat.completions.create({
  model: 'gpt-4o-mini',
  messages: messagesPayload,
  temperature: 0.7
});
```

This ensures:
1. Active memory persists for recent turns.
2. Token consumption remains predictable and bounded.
3. System identity and rules are permanently retained.

---

## 🧪 5-Turn Evaluation Test (Memory Recall)

Here is the exact multi-turn test to verify that context memory persists across turns:

```text
Turn 1:
User: My name is Raymond.
Bot:  Nice to meet you, Raymond! How can I assist you today?

Turn 2:
User: I'm studying Computer Science Engineering.
Bot:  That's a fantastic field, Raymond! Computer Science Engineering opens up so many possibilities. What specific subjects or technologies are you currently exploring?

Turn 3:
User: I'm interested in Artificial Intelligence and Cloud Computing.
Bot:  Great combination! AI and Cloud Computing go hand in hand—especially with modern distributed training, serverless model deployment, and cloud infrastructure.

Turn 4:
User: Can you suggest two project ideas combining these?
Bot:  Here are two project ideas for you, Raymond:
      1. Cloud-Native AI Document Summarizer using AWS Lambda / Cloud Functions.
      2. Distributed Model Inference Engine deployed on Kubernetes with Redis caching.

Turn 5 (The Memory Test):
User: What is my name, college and interest?
Bot:  Your name is Raymond, you are studying Computer Science Engineering, and your interests are Artificial Intelligence and Cloud Computing!
```

---

## 📤 How to Push to GitHub

Initialize and push to your public GitHub repository:

```bash
# In the project root (smartchat-ai/):
git add .
git commit -m "feat: complete SmartChat AI with React, Node.js, Express, and context window management"
git remote add origin https://github.com/<your-username>/smartchat-ai.git
git branch -M main
git push -u origin main
```

*(Your `.gitignore` automatically guarantees `.env` and `node_modules` are never committed).*

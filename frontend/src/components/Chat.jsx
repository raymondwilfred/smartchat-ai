import React, { useState, useEffect, useRef } from 'react';
import { Send, Trash2, Bot, Sparkles, AlertCircle, RefreshCw } from 'lucide-react';

export default function Chat() {
  const [conversationId, setConversationId] = useState('');
  const [messages, setMessages] = useState([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [stats, setStats] = useState({
    totalStoredMessages: 0,
    contextMessagesSent: 0,
    truncatedMessagesCount: 0,
    windowLimit: 10
  });

  const messagesEndRef = useRef(null);

  // Initialize unique conversation ID on mount
  useEffect(() => {
    const id = 'chat-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
    setConversationId(id);
  }, []);

  // Auto-scroll to latest message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const handleSendMessage = async (e, directText = null) => {
    if (e) e.preventDefault();
    const textToSend = (directText || inputMessage).trim();
    if (!textToSend || isLoading) return;

    // 1. Optimistically append user message to UI
    const newUserMessage = {
      role: 'user',
      content: textToSend,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages((prev) => [...prev, newUserMessage]);
    setInputMessage('');
    setIsLoading(true);
    setErrorMessage('');

    try {
      // 2. Call backend endpoint
      const response = await fetch('/api/chat/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          message: textToSend
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to receive reply from SmartChat AI');
      }

      // 3. Append assistant reply to UI
      const newBotMessage = {
        role: 'assistant',
        content: data.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        stats: data.stats
      };

      setMessages((prev) => [...prev, newBotMessage]);
      if (data.stats) {
        setStats(data.stats);
      }
    } catch (err) {
      console.error('Error sending message:', err);
      setErrorMessage(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = async () => {
    if (!window.confirm('Reset conversation memory and start fresh?')) return;
    try {
      if (conversationId) {
        await fetch(`/api/chat/history/${conversationId}`, { method: 'DELETE' });
      }
    } catch (err) {
      console.error('Failed to clear backend history:', err);
    }

    // Generate new conversation session
    const newId = 'chat-' + Math.random().toString(36).substring(2, 9) + '-' + Date.now();
    setConversationId(newId);
    setMessages([]);
    setErrorMessage('');
    setStats({
      totalStoredMessages: 0,
      contextMessagesSent: 0,
      truncatedMessagesCount: 0,
      windowLimit: 10
    });
  };

  return (
    <div className="chat-app-wrapper">
      {/* Header */}
      <header className="chat-header">
        <div className="header-brand">
          <div className="brand-avatar">
            <Bot size={24} color="#fff" />
          </div>
          <div className="header-info">
            <h1>SmartChat AI</h1>
            <p>Multi-turn Context Aware Assistant</p>
          </div>
        </div>

        <div className="header-actions">
          <div className="context-badge" title="Context Window: Up to last 10 messages retained in active prompt">
            <Sparkles size={14} />
            <span>
              Context Window: {stats.contextMessagesSent}/{stats.totalStoredMessages} msgs (Max {stats.windowLimit})
            </span>
          </div>

          <button className="btn-clear" onClick={handleClearChat} title="Clear conversation memory">
            <Trash2 size={15} />
            <span>Clear Chat</span>
          </button>
        </div>
      </header>

      {/* Error Banner */}
      {errorMessage && (
        <div className="alert-banner">
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <AlertCircle size={18} />
            <span><strong>Error:</strong> {errorMessage}</span>
          </div>
          <button className="alert-close" onClick={() => setErrorMessage('')}>&times;</button>
        </div>
      )}

      {/* Messages Viewport */}
      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-screen">
            <div className="welcome-icon">🧠</div>
            <h2>Welcome to SmartChat AI</h2>
            <p>
              I maintain conversation context across turns. I remember details you share and manage a sliding context window so I never lose important continuity.
            </p>

            <div className="sample-prompts">
              <span style={{ fontSize: '0.78rem', color: '#94a3b8', fontWeight: 600 }}>
                Try Raymond's 5-turn multi-turn evaluation test:
              </span>
              <button
                className="sample-chip"
                onClick={() => handleSendMessage(null, "My name is Raymond.")}
              >
                1. "My name is Raymond."
              </button>
              <button
                className="sample-chip"
                onClick={() => handleSendMessage(null, "I'm studying Computer Science Engineering.")}
              >
                2. "I'm studying Computer Science Engineering."
              </button>
              <button
                className="sample-chip"
                onClick={() => handleSendMessage(null, "I'm interested in Artificial Intelligence and Cloud Computing.")}
              >
                3. "I'm interested in Artificial Intelligence and Cloud Computing."
              </button>
              <button
                className="sample-chip"
                onClick={() => handleSendMessage(null, "What is my name, college and interest?")}
              >
                4. "What is my name, college and interest?" (Tests Memory Recall)
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <div key={index} className={`message-row ${msg.role}`}>
              <span className="message-label">
                {msg.role === 'user' ? 'You' : 'SmartChat AI'}
              </span>
              <div className="message-bubble">{msg.content}</div>
              <span className="message-meta">
                {msg.timestamp}
                {msg.stats && ` • Sent with ${msg.stats.contextMessagesSent} context turns`}
              </span>
            </div>
          ))
        )}

        {/* Loading Indicator */}
        {isLoading && (
          <div className="message-row assistant">
            <span className="message-label">SmartChat AI</span>
            <div className="typing-bubble">
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
              <span className="typing-dot"></span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Chat Input Footer */}
      <footer className="chat-footer">
        <form className="chat-input-form" onSubmit={handleSendMessage}>
          <input
            type="text"
            className="chat-input-field"
            placeholder="Type your message... (e.g. 'My name is Raymond')"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            disabled={isLoading}
            autoFocus
          />
          <button type="submit" className="btn-send" disabled={isLoading || !inputMessage.trim()}>
            {isLoading ? <RefreshCw className="animate-spin" size={18} /> : <Send size={18} />}
            <span>Send</span>
          </button>
        </form>
        <div className="footer-hint">
          <span>Active Session: <code>{conversationId.substring(0, 16)}...</code></span>
          <span>Context Strategy: Last 10 Messages (Sliding Window)</span>
        </div>
      </footer>
    </div>
  );
}

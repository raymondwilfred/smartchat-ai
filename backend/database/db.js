const fs = require('fs');
const path = require('path');
const mongoose = require('mongoose');

// Path for local disk-backed persistent database fallback
const DATA_DIR = path.join(__dirname, '..', 'data');
const DB_FILE = path.join(DATA_DIR, 'conversations.json');

// Ensure data directory exists
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

let isMongoConnected = false;
let ConversationModel = null;

// Define Mongoose Schema for MongoDB persistence
const MessageSubSchema = new mongoose.Schema({
  role: { type: String, required: true, enum: ['user', 'assistant', 'system'] },
  content: { type: String, required: true },
  timestamp: { type: String, default: () => new Date().toISOString() }
}, { _id: false });

const ConversationSchema = new mongoose.Schema({
  conversationId: { type: String, required: true, unique: true, index: true },
  title: { type: String, default: 'New Conversation' },
  messages: [MessageSubSchema],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

try {
  ConversationModel = mongoose.model('Conversation', ConversationSchema);
} catch (e) {
  ConversationModel = mongoose.model('Conversation');
}

/**
 * Local persistent file store helpers (fallback if MongoDB is not running)
 */
function readLocalDB() {
  try {
    if (!fs.existsSync(DB_FILE)) {
      fs.writeFileSync(DB_FILE, JSON.stringify({ conversations: {} }, null, 2), 'utf-8');
      return { conversations: {} };
    }
    const data = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading local DB, initializing empty store:', err.message);
    return { conversations: {} };
  }
}

function writeLocalDB(data) {
  try {
    fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Error writing local DB:', err.message);
  }
}

/**
 * Initialize Database Connection
 */
async function initDB() {
  const mongoUri = process.env.MONGODB_URI;

  if (mongoUri && mongoUri.trim() !== '') {
    try {
      console.log(`[Database] Connecting to MongoDB at ${mongoUri}...`);
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 4000 });
      isMongoConnected = true;
      console.log('[Database] ✓ Connected successfully to MongoDB!');
      return;
    } catch (err) {
      console.warn(`[Database] ⚠️ MongoDB connection failed: ${err.message}`);
      console.warn('[Database] → Falling back to Local Disk-Backed Database (data/conversations.json)');
    }
  } else {
    console.log('[Database] ✓ Using Local Disk-Backed Database (data/conversations.json)');
  }

  // Ensure local DB file exists
  readLocalDB();
}

/**
 * Get active database engine description
 */
function getDBType() {
  return isMongoConnected ? 'MongoDB' : 'Local Persistent Database (JSON File Store)';
}

/**
 * Retrieve conversation messages
 */
async function getHistory(conversationId) {
  if (isMongoConnected) {
    const doc = await ConversationModel.findOne({ conversationId }).lean();
    return doc ? doc.messages : [];
  }

  const db = readLocalDB();
  const conv = db.conversations[conversationId];
  return conv ? conv.messages : [];
}

/**
 * Append message to conversation history and persist to database
 */
async function saveMessage(conversationId, role, content) {
  const newMsg = {
    role,
    content,
    timestamp: new Date().toISOString()
  };

  if (isMongoConnected) {
    let doc = await ConversationModel.findOne({ conversationId });
    if (!doc) {
      doc = new ConversationModel({
        conversationId,
        title: content.substring(0, 30) + '...',
        messages: [newMsg]
      });
    } else {
      doc.messages.push(newMsg);
      doc.updatedAt = new Date();
    }
    await doc.save();
    return newMsg;
  }

  // Local Disk DB
  const db = readLocalDB();
  if (!db.conversations[conversationId]) {
    db.conversations[conversationId] = {
      conversationId,
      title: content.substring(0, 30) + '...',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    };
  }

  db.conversations[conversationId].messages.push(newMsg);
  db.conversations[conversationId].updatedAt = new Date().toISOString();
  writeLocalDB(db);

  return newMsg;
}

/**
 * Retrieve list of all conversations (metadata)
 */
async function getAllConversations() {
  if (isMongoConnected) {
    const list = await ConversationModel.find({}, 'conversationId title updatedAt createdAt messages').sort({ updatedAt: -1 }).lean();
    return list.map(c => ({
      conversationId: c.conversationId,
      title: c.title,
      messageCount: c.messages?.length || 0,
      updatedAt: c.updatedAt
    }));
  }

  const db = readLocalDB();
  return Object.values(db.conversations).map(c => ({
    conversationId: c.conversationId,
    title: c.title,
    messageCount: c.messages.length,
    updatedAt: c.updatedAt
  })).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
}

/**
 * Reset / clear conversation messages
 */
async function clearHistory(conversationId) {
  if (isMongoConnected) {
    await ConversationModel.deleteOne({ conversationId });
    return true;
  }

  const db = readLocalDB();
  if (db.conversations[conversationId]) {
    delete db.conversations[conversationId];
    writeLocalDB(db);
    return true;
  }
  return false;
}

module.exports = {
  initDB,
  getDBType,
  getHistory,
  saveMessage,
  getAllConversations,
  clearHistory
};


import Database from "better-sqlite3";
import path from "path";

let db: any;
let isMock = false;

// In-memory mock store for when SQLite fails
const mockStore: Record<string, any[]> = {
  users: [
    { id: 1, email: 'alex@example.com', password: 'pass', name: 'Alex Rivera', headline: 'Product Strategist & Explorer', primary_intent: 'finding collaborators' },
    { id: 2, email: 'anna@example.com', password: 'pass', name: 'Anna Chen', headline: 'AI Product Designer', primary_intent: 'professional networking' },
    { id: 3, email: 'marcus@example.com', password: 'pass', name: 'Marcus Thorne', headline: 'Full-stack Engineer', primary_intent: 'co-founder search' },
    { id: 4, email: 'elena@example.com', password: 'pass', name: 'Elena Rodriguez', headline: 'Philosophy Student', primary_intent: 'idea exchange' }
  ],
  messages: [],
  behavioral_signals: [
    { 
      user_id: 1, 
      summary: 'A strategic thinker focused on the intersection of product-market fit and emerging technologies.', 
      communication_style: 'analytical structured', 
      reasoning_style: '["systems thinking", "commercial reasoning"]', 
      interaction_type: 'strategist', 
      decision_orientation: 'execution-focused', 
      knowledge_domains: '[{"name": "Product Strategy", "confidence": 0.9, "conversation_count": 12}, {"name": "Market Dynamics", "confidence": 0.85, "conversation_count": 8}]', 
      active_explorations: '[{"name": "AI Infrastructure", "confidence": 0.95, "last_active_at": "2024-03-10T10:00:00Z"}, {"name": "Venture Capital", "confidence": 0.8, "last_active_at": "2024-03-05T14:30:00Z"}]', 
      primary_intent: 'finding collaborators' 
    },
    { 
      user_id: 2, 
      summary: 'Passionate about the intersection of AI and human-centric design.', 
      communication_style: 'narrative exploratory', 
      reasoning_style: '["design thinking", "empathy-driven"]', 
      interaction_type: 'builder', 
      decision_orientation: 'exploratory', 
      knowledge_domains: '[{"name": "UX Design", "confidence": 0.92, "conversation_count": 15}, {"name": "AI Interfaces", "confidence": 0.88, "conversation_count": 10}]', 
      active_explorations: '[{"name": "Generative Art", "confidence": 0.9, "last_active_at": "2024-03-12T09:15:00Z"}, {"name": "Human-AI Interaction", "confidence": 0.94, "last_active_at": "2024-03-11T16:45:00Z"}]', 
      primary_intent: 'professional networking' 
    },
    { 
      user_id: 3, 
      summary: 'Pragmatic builder focused on scalable systems and distributed databases.', 
      communication_style: 'concise pragmatic', 
      reasoning_style: '["structured thinking", "first principles"]', 
      interaction_type: 'operator', 
      decision_orientation: 'execution-focused', 
      knowledge_domains: '[{"name": "Backend Systems", "confidence": 0.95, "conversation_count": 20}, {"name": "Distributed Databases", "confidence": 0.92, "conversation_count": 14}]', 
      active_explorations: '[{"name": "Rust", "confidence": 0.85, "last_active_at": "2024-03-08T11:20:00Z"}, {"name": "PostgreSQL Architecture", "confidence": 0.9, "last_active_at": "2024-03-09T13:10:00Z"}]', 
      primary_intent: 'co-founder search' 
    },
    { 
      user_id: 4, 
      summary: 'Deep thinker exploring the ethical implications of autonomous agents.', 
      communication_style: 'reflective exploratory', 
      reasoning_style: '["philosophical inquiry", "synthesis-driven"]', 
      interaction_type: 'researcher', 
      decision_orientation: 'synthesis-driven', 
      knowledge_domains: '[{"name": "AI Ethics", "confidence": 0.98, "conversation_count": 18}, {"name": "Political Philosophy", "confidence": 0.9, "conversation_count": 12}]', 
      active_explorations: '[{"name": "Ancient History", "confidence": 0.75, "last_active_at": "2024-03-01T10:00:00Z"}, {"name": "Linguistics", "confidence": 0.82, "last_active_at": "2024-03-04T15:20:00Z"}]', 
      primary_intent: 'idea exchange' 
    }
  ],
  topic_clusters: [],
  conversations: [],
  matches: []
};

export function initDb() {
  console.log("Initializing database...");
  try {
    db = new Database("agentmatch.db");
    db.pragma('journal_mode = WAL');
    db.pragma('busy_timeout = 5000');

    db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        email TEXT UNIQUE,
        password_hash TEXT NOT NULL,
        name TEXT,
        headline TEXT,
        location TEXT,
        languages TEXT,
        primary_intent TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS behavioral_signals (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT UNIQUE NOT NULL,
        summary TEXT,
        communication_style TEXT,
        reasoning_style TEXT,
        interaction_type TEXT,
        decision_orientation TEXT,
        knowledge_domains TEXT,
        active_explorations TEXT,
        primary_intent TEXT,
        embedding TEXT,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS topic_clusters (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        name TEXT NOT NULL,
        summary TEXT,
        conversation_count INTEGER DEFAULT 0,
        word_count INTEGER DEFAULT 0,
        last_activity DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id)
      );

      CREATE TABLE IF NOT EXISTS conversations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id TEXT NOT NULL,
        topic_cluster_id INTEGER,
        title TEXT,
        raw_text TEXT NOT NULL,
        message_count INTEGER,
        word_count INTEGER,
        source TEXT,
        detected_domain TEXT,
        detected_active_topic TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id),
        FOREIGN KEY (topic_cluster_id) REFERENCES topic_clusters(id)
      );

      CREATE TABLE IF NOT EXISTS matches (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_a_id TEXT NOT NULL,
        user_b_id TEXT NOT NULL,
        score REAL,
        explanation TEXT,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_a_id) REFERENCES users(id),
        FOREIGN KEY (user_b_id) REFERENCES users(id)
      );
    `);

    // Migrations
    const columns = [
      { table: "behavioral_signals", col: "reasoning_style", type: "TEXT" },
      { table: "behavioral_signals", col: "interaction_type", type: "TEXT" },
      { table: "behavioral_signals", col: "decision_orientation", type: "TEXT" },
      { table: "behavioral_signals", col: "knowledge_domains", type: "TEXT" },
      { table: "behavioral_signals", col: "active_explorations", type: "TEXT" },
      { table: "behavioral_signals", col: "primary_intent", type: "TEXT" },
      { table: "conversations", col: "title", type: "TEXT" },
      { table: "conversations", col: "detected_domain", type: "TEXT" },
      { table: "conversations", col: "detected_active_topic", type: "TEXT" },
      { table: "conversations", col: "topic_cluster_id", type: "INTEGER" },
      { table: "conversations", col: "source", type: "TEXT" },
      { table: "conversations", col: "message_count", type: "INTEGER" },
      { table: "conversations", col: "word_count", type: "INTEGER" },
      { table: "users", col: "headline", type: "TEXT" },
      { table: "users", col: "location", type: "TEXT" },
      { table: "users", col: "languages", type: "TEXT" },
      { table: "users", col: "primary_intent", type: "TEXT" }
    ];

    for (const { table, col, type } of columns) {
      try { db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${type}`); } catch (e) {}
    }

    // Seed
    const userCount = db.prepare("SELECT COUNT(*) as count FROM users").get().count;
    if (userCount === 0) {
      const insertUser = db.prepare("INSERT INTO users (id, email, password, name, headline, primary_intent) VALUES (?, ?, ?, ?, ?, ?)");
      for (const user of mockStore.users) {
        insertUser.run(String(user.id), user.email, user.password, user.name, user.headline, user.primary_intent);
      }

      const insertSignal = db.prepare(`
        INSERT INTO behavioral_signals (user_id, summary, communication_style, reasoning_style, interaction_type, decision_orientation, knowledge_domains, active_explorations, primary_intent)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      for (const signal of mockStore.behavioral_signals) {
        insertSignal.run(
          String(signal.user_id), signal.summary, signal.communication_style, signal.reasoning_style, 
          signal.interaction_type, signal.decision_orientation, signal.knowledge_domains, 
          signal.active_explorations, signal.primary_intent
        );
      }
    }

    console.log("SQLite database initialized successfully.");
    return db;
  } catch (error) {
    console.error("Failed to initialize SQLite, falling back to mock store:", error);
    isMock = true;
    return createMockDb();
  }
}

function createMockDb() {
  return {
    prepare: (sql: string) => {
      return {
        get: (...params: any[]) => {
          console.log(`[MOCK DB GET] ${sql}`, params);
          if (sql.includes("FROM users WHERE id = ?")) return mockStore.users.find(u => u.id === params[0]);
          if (sql.includes("FROM behavioral_signals WHERE user_id = ?")) return mockStore.behavioral_signals.find(s => s.user_id === params[0]);
          if (sql.includes("FROM conversations")) return mockStore.conversations[0];
          if (sql.includes("COUNT(*) as count FROM conversations")) return { conversation_count: mockStore.conversations.length, total_messages: 0, total_words: 0 };
          return null;
        },
        all: (...params: any[]) => {
          console.log(`[MOCK DB ALL] ${sql}`, params);
          if (sql.includes("FROM messages")) return mockStore.messages.filter(m => m.user_id === params[0]);
          if (sql.includes("FROM topic_clusters")) return mockStore.topic_clusters.filter(t => t.user_id === params[0]);
          if (sql.includes("FROM conversations")) return mockStore.conversations.filter(c => c.user_id === params[0]);
          if (sql.includes("FROM users u JOIN behavioral_signals s")) {
            return mockStore.users
              .filter(u => u.id !== params[0])
              .map(u => ({ ...u, ...mockStore.behavioral_signals.find(s => s.user_id === u.id) }));
          }
          if (sql.includes("FROM topic_clusters GROUP BY name")) {
            const groups: Record<string, any> = {};
            mockStore.topic_clusters.forEach(c => {
              if (!groups[c.name]) groups[c.name] = { name: c.name, total_count: 0, last_act: c.last_activity };
              groups[c.name].total_count += c.conversation_count;
            });
            return Object.values(groups);
          }
          return [];
        },
        run: (...params: any[]) => {
          console.log(`[MOCK DB RUN] ${sql}`, params);
          if (sql.includes("INSERT INTO messages")) {
            mockStore.messages.push({ user_id: params[0], role: params[1], content: params[2], created_at: new Date().toISOString() });
          }
          if (sql.includes("INSERT INTO conversations")) {
            const id = mockStore.conversations.length + 1;
            mockStore.conversations.push({ id, user_id: params[0], raw_text: params[1], source: params[2], message_count: params[3], word_count: params[4], created_at: new Date().toISOString() });
            return { lastInsertRowid: id };
          }
          if (sql.includes("UPDATE conversations")) {
             const conv = mockStore.conversations.find(c => c.id === params[3]);
             if (conv) {
               conv.title = params[0];
               conv.detected_domain = params[1];
               conv.detected_active_topic = params[2];
             }
          }
          if (sql.includes("INSERT INTO behavioral_signals")) {
            const existing = mockStore.behavioral_signals.find(s => s.user_id === params[0]);
            const signal = {
              user_id: params[0], summary: params[1], communication_style: params[2], reasoning_style: params[3],
              interaction_type: params[4], decision_orientation: params[5], knowledge_domains: params[6],
              active_explorations: params[7], primary_intent: params[8]
            };
            if (existing) Object.assign(existing, signal);
            else mockStore.behavioral_signals.push(signal);
          }
          return { lastInsertRowid: 1 };
        }
      };
    },
    transaction: (fn: Function) => fn(),
    exec: (sql: string) => console.log(`[MOCK DB EXEC] ${sql}`)
  };
}

export function getDb() {
  if (!db) return initDb();
  return db;
}

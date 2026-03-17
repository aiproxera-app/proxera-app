import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { initDb, getDb } from "./src/services/db.ts";
import * as aiService from "./src/services/ai.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  console.log("Starting Proxera Backend...");
  
  // Initialize Database with fallback
  const db = initDb();
  
  const app = express();
  const PORT = Number(process.env.PORT) || 8080;
  
  app.use(express.json());

  // Auth Middleware Mock (for MVP simplicity)
  const getUserId = (req: express.Request) => {
    const userId = req.headers['x-user-id'] as string || "1";
    
    // Ensure user exists in DB for this dev session
    const user = getDb().prepare("SELECT id FROM users WHERE id = ?").get(userId);
    if (!user) {
      console.log(`Creating new dev user: ${userId}`);
      getDb().prepare("INSERT INTO users (id, name, email) VALUES (?, ?, ?)").run(
        userId, 
        `User ${userId.slice(0, 4)}`, 
        `user_${userId.slice(0, 8)}@proxera.dev`
      );
    }
    
    return userId; 
  };

  // API Routes
  app.get("/api/me", (req, res) => {
    const userId = getUserId(req);
    const user = getDb().prepare("SELECT * FROM users WHERE id = ?").get(userId);
    res.json(user || null);
  });

  app.post("/api/register", (req, res) => {
    const { email, password, name } = req.body;
    try {
      const info = getDb().prepare("INSERT INTO users (email, password, name) VALUES (?, ?, ?)").run(email, password, name);
      res.json({ id: info.lastInsertRowid });
    } catch (e) {
      res.status(400).json({ error: "Email already exists" });
    }
  });

  app.get("/api/messages", (req, res) => {
    const userId = getUserId(req);
    const messages = getDb().prepare("SELECT * FROM messages WHERE user_id = ? ORDER BY created_at ASC").all(userId);
    res.json(messages);
  });

  app.post("/api/messages", (req, res) => {
    const userId = getUserId(req);
    const { role, content } = req.body;
    getDb().prepare("INSERT INTO messages (user_id, role, content) VALUES (?, ?, ?)").run(userId, role, content);
    res.json({ success: true });
  });

  app.get("/api/signals", (req, res) => {
    const userId = getUserId(req);
    const signals = getDb().prepare("SELECT * FROM behavioral_signals WHERE user_id = ?").get(userId);
    if (!signals) return res.json(null);

    // Calculate completeness
    const fields = ["summary", "communication_style", "reasoning_style", "interaction_type", "decision_orientation", "knowledge_domains", "active_explorations", "primary_intent"];
    const filledFields = fields.filter(f => signals[f] && signals[f] !== "[]");
    const completeness = Math.round((filledFields.length / fields.length) * 100);

    // Calculate confidence based on conversation count
    const stats = getDb().prepare("SELECT COUNT(*) as count FROM conversations WHERE user_id = ?").get(userId);
    const confidence = Math.min(100, Math.round((stats.count / 10) * 100)); // 10 conversations for 100% confidence

    // Calculate freshness
    const updatedAt = new Date(signals.updated_at).getTime();
    const now = new Date().getTime();
    const daysSinceUpdate = (now - updatedAt) / (1000 * 60 * 60 * 24);
    const freshness = Math.max(0, Math.round(100 * (1 - daysSinceUpdate / 30))); // 0% after 30 days

    res.json({
      ...signals,
      completeness,
      confidence,
      freshness
    });
  });

  app.get("/api/search", (req, res) => {
    const userId = getUserId(req);
    const { q } = req.query;
    if (!q) return res.json([]);

    const query = `%${q}%`;
    const results = getDb().prepare(`
      SELECT u.id, u.name, u.headline, s.*
      FROM users u
      JOIN behavioral_signals s ON u.id = s.user_id
      WHERE u.id != ? AND (
        u.name LIKE ? OR 
        u.headline LIKE ? OR 
        s.summary LIKE ? OR 
        s.knowledge_domains LIKE ? OR 
        s.active_explorations LIKE ? OR
        s.communication_style LIKE ?
      )
    `).all(userId, query, query, query, query, query, query);

    res.json(results);
  });

  app.post("/api/signals", (req, res) => {
    const userId = getUserId(req);
    const { 
      summary, 
      communication_style, 
      reasoning_style, 
      interaction_type, 
      decision_orientation, 
      knowledge_domains, 
      active_explorations, 
      primary_intent,
      metaSignals
    } = req.body;

    getDb().transaction(() => {
      getDb().prepare(`
        INSERT INTO behavioral_signals (
          user_id, summary, communication_style, reasoning_style, 
          interaction_type, decision_orientation, knowledge_domains, active_explorations, primary_intent
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(user_id) DO UPDATE SET
          summary=excluded.summary,
          communication_style=excluded.communication_style,
          reasoning_style=excluded.reasoning_style,
          interaction_type=excluded.interaction_type,
          decision_orientation=excluded.decision_orientation,
          knowledge_domains=excluded.knowledge_domains,
          active_explorations=excluded.active_explorations,
          primary_intent=excluded.primary_intent,
          updated_at=CURRENT_TIMESTAMP
      `).run(
        userId, 
        summary,
        communication_style,
        Array.isArray(reasoning_style) ? JSON.stringify(reasoning_style) : reasoning_style,
        interaction_type,
        decision_orientation,
        Array.isArray(knowledge_domains) ? JSON.stringify(knowledge_domains) : knowledge_domains,
        Array.isArray(active_explorations) ? JSON.stringify(active_explorations) : active_explorations,
        primary_intent
      );

      if (metaSignals && Array.isArray(metaSignals)) {
        const updateStmt = getDb().prepare(`
          UPDATE conversations 
          SET title = ?, detected_domain = ?, detected_active_topic = ?
          WHERE user_id = ? AND created_at = ?
        `);
        for (const meta of metaSignals) {
          updateStmt.run(meta.title, meta.detected_domain, meta.detected_active_topic, userId, meta.created_at);
        }
      }
    })();
    res.json({ success: true });
  });

  app.post("/api/reset", (req, res) => {
    const userId = getUserId(req);
    console.log(`Resetting data for user ${userId}`);
    
    try {
      getDb().transaction(() => {
        // Clear activity and profile
        getDb().prepare("DELETE FROM messages WHERE user_id = ?").run(userId);
        getDb().prepare("DELETE FROM behavioral_signals WHERE user_id = ?").run(userId);
        getDb().prepare("DELETE FROM conversations WHERE user_id = ?").run(userId);
        getDb().prepare("DELETE FROM topic_clusters WHERE user_id = ?").run(userId);
        getDb().prepare("DELETE FROM matches WHERE user_a_id = ? OR user_b_id = ?").run(userId, userId);
        
        // Reset user metadata but keep the account
        getDb().prepare("UPDATE users SET headline = NULL, primary_intent = NULL WHERE id = ?").run(userId);
      })();
      console.log("Reset successful");
      res.json({ success: true });
    } catch (error) {
      console.error("Reset failed:", error);
      res.status(500).json({ 
        error: "Failed to reset data", 
        details: error instanceof Error ? error.message : String(error) 
      });
    }
  });

  app.patch("/api/signals", (req, res) => {
    const userId = getUserId(req);
    const updates = req.body;
    
    const allowedFields = [
      "summary", "communication_style", "reasoning_style", 
      "interaction_type", "decision_orientation", 
      "knowledge_domains", "active_explorations", "primary_intent"
    ];

    const sets: string[] = [];
    const params: any[] = [];

    Object.keys(updates).forEach(key => {
      if (allowedFields.includes(key)) {
        sets.push(`${key} = ?`);
        let val = updates[key];
        if (Array.isArray(val)) val = JSON.stringify(val);
        params.push(val);
      }
    });

    if (sets.length === 0) {
      return res.status(400).json({ error: "No valid fields to update" });
    }

    params.push(userId);
    getDb().prepare(`
      UPDATE behavioral_signals 
      SET ${sets.join(", ")}, updated_at = CURRENT_TIMESTAMP
      WHERE user_id = ?
    `).run(...params);

    res.json({ success: true });
  });

  app.delete("/api/conversations/:id", (req, res) => {
    const userId = getUserId(req);
    const { id } = req.params;
    getDb().prepare("DELETE FROM conversations WHERE id = ? AND user_id = ?").run(id, userId);
    res.json({ success: true });
  });

  app.get("/api/topic-clusters", (req, res) => {
    const userId = getUserId(req);
    const clusters = getDb().prepare("SELECT * FROM topic_clusters WHERE user_id = ? ORDER BY last_activity DESC").all(userId);
    res.json(clusters);
  });

  app.get("/api/conversations", (req, res) => {
    const userId = getUserId(req);
    const convs = getDb().prepare(`
      SELECT c.*, t.name as topic_name 
      FROM conversations c
      LEFT JOIN topic_clusters t ON c.topic_cluster_id = t.id
      WHERE c.user_id = ? 
      ORDER BY c.created_at DESC
    `).all(userId);
    res.json(convs);
  });

  app.post("/api/conversations", async (req, res) => {
    const userId = getUserId(req);
    const { raw_text, source, message_count, word_count, title, detected_domain, detected_active_topic } = req.body;
    
    try {
      const info = getDb().prepare(`
        INSERT INTO conversations (
          user_id, raw_text, source, message_count, word_count, 
          title, detected_domain, detected_active_topic
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        userId, raw_text, source, message_count, word_count, 
        title || null, detected_domain || null, detected_active_topic || null
      );
      
      res.json({ success: true, conversationId: info.lastInsertRowid });
    } catch (e: any) {
      console.error("Conversation save failed:", e);
      res.status(500).json({ 
        error: "Failed to save conversation",
        details: e instanceof Error ? e.message : String(e)
      });
    }
  });

  app.post("/api/update-profile", async (req, res) => {
    const userId = getUserId(req);
    const { profile, metaSignals } = req.body;

    try {
      getDb().transaction(() => {
        getDb().prepare(`
          INSERT INTO behavioral_signals (
            user_id, summary, communication_style, reasoning_style, 
            interaction_type, decision_orientation, knowledge_domains, active_explorations, primary_intent
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(user_id) DO UPDATE SET
            summary=excluded.summary,
            communication_style=excluded.communication_style,
            reasoning_style=excluded.reasoning_style,
            interaction_type=excluded.interaction_type,
            decision_orientation=excluded.decision_orientation,
            knowledge_domains=excluded.knowledge_domains,
            active_explorations=excluded.active_explorations,
            primary_intent=excluded.primary_intent,
            updated_at=CURRENT_TIMESTAMP
        `).run(
          userId, 
          profile.summary,
          profile.communication_style,
          JSON.stringify(profile.reasoning_style),
          profile.interaction_type,
          profile.decision_orientation,
          JSON.stringify(profile.knowledge_domains),
          JSON.stringify(profile.active_explorations),
          profile.primary_intent
        );

        if (metaSignals && Array.isArray(metaSignals)) {
          const updateStmt = getDb().prepare(`
            UPDATE conversations 
            SET title = ?, detected_domain = ?, detected_active_topic = ?
            WHERE user_id = ? AND created_at = ?
          `);
          for (const meta of metaSignals) {
            updateStmt.run(meta.title, meta.detected_domain, meta.detected_active_topic, userId, meta.created_at);
          }
        }
      })();

      const updatedSignals = getDb().prepare("SELECT * FROM behavioral_signals WHERE user_id = ?").get(userId);
      res.json(updatedSignals);
    } catch (e) {
      console.error("Profile update failed:", e);
      res.status(500).json({ error: "Failed to update profile", details: e instanceof Error ? e.message : String(e) });
    }
  });

  app.get("/api/profile-graph", (req, res) => {
    const userId = getUserId(req);
    const signals = getDb().prepare("SELECT * FROM behavioral_signals WHERE user_id = ?").get(userId);
    const trajectory = getDb().prepare(`
      SELECT id, title, detected_domain, detected_active_topic, created_at 
      FROM conversations 
      WHERE user_id = ? 
      ORDER BY created_at ASC
    `).all(userId);
    
    res.json({
      signals,
      trajectory
    });
  });

  app.get("/api/trajectory", (req, res) => {
    const userId = getUserId(req);
    const trajectory = getDb().prepare(`
      SELECT created_at, title, detected_domain, detected_active_topic 
      FROM conversations 
      WHERE user_id = ? 
      ORDER BY created_at ASC
    `).all(userId);
    res.json(trajectory);
  });

  app.post("/api/chat/sync-profile", async (req, res) => {
    const userId = getUserId(req);
    const { signals } = req.body;
    try {
      // Map signals to our schema if possible, or just update what we can
      // For now, we'll just update the summary and communication_style as a "refinement"
      getDb().prepare(`
        UPDATE behavioral_signals 
        SET summary = ?, communication_style = ?, primary_intent = ?
        WHERE user_id = ?
      `).run(signals.summary, signals.communication_style, signals.intent, userId);
      
      res.json({ success: true });
    } catch (e) {
      console.error("Signal sync failed:", e);
      res.status(500).json({ error: "Failed to sync profile from chat" });
    }
  });

  app.get("/api/corpus-stats", (req, res) => {
    const userId = getUserId(req);
    const stats = getDb().prepare(`
      SELECT 
        COUNT(*) as conversation_count,
        SUM(message_count) as total_messages,
        SUM(word_count) as total_words
      FROM conversations 
      WHERE user_id = ?
    `).get(userId);
    res.json(stats);
  });

  app.post("/api/import-share-link", async (req, res) => {
    const { url } = req.body;
    if (!url || !url.includes("chatgpt.com/share")) {
      return res.status(400).json({ error: "Invalid ChatGPT share link" });
    }

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      });
      if (!response.ok) {
        throw new Error("Failed to fetch share link");
      }
      const html = await response.text();
      
      let rawText = "";
      let messageCount = 0;

      // Try Legacy __NEXT_DATA__ first
      const nextDataMatch = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
      if (nextDataMatch) {
        try {
          const nextData = JSON.parse(nextDataMatch[1]);
          const conversationData = nextData.props?.pageProps?.serverResponse?.data?.linear_conversation;

          if (conversationData && Array.isArray(conversationData)) {
            conversationData.forEach((msg: any) => {
              const role = msg.message?.author?.role;
              const content = msg.message?.content?.parts?.join("\n");
              if (role && content) {
                rawText += `${role === 'user' ? 'User' : 'Assistant'}: ${content}\n\n`;
                messageCount++;
              }
            });
          }
        } catch (e) {
          console.error("Legacy parse failed:", e);
        }
      }

      // If legacy failed, try new React Router Stream format
      if (!rawText.trim()) {
        const enqueueMatch = html.match(/window\.__reactRouterContext\.streamController\.enqueue\("([\s\S]*?)"\);/);
        if (enqueueMatch) {
          try {
            let jsonStr = enqueueMatch[1];
            jsonStr = jsonStr.replace(/\\"/g, '"').replace(/\\\\/g, '\\');
            const lastBracket = jsonStr.lastIndexOf(']');
            if (lastBracket !== -1) {
              const validJson = jsonStr.substring(0, lastBracket + 1);
              const data = JSON.parse(validJson);
              
              const linConvIndex = data.indexOf('linear_conversation');
              if (linConvIndex !== -1) {
                const convIndices = data[linConvIndex + 1];
                if (Array.isArray(convIndices)) {
                  for (const idx of convIndices) {
                    const entry = data[idx];
                    if (!entry || typeof entry !== 'object') continue;
                    
                    const msgIdx = entry._46;
                    const msg = data[msgIdx];
                    if (!msg || typeof msg !== 'object') continue;
                    
                    // Extract role
                    let role = "";
                    const authorIdx = msg._48;
                    const author = data[authorIdx];
                    if (author && typeof author === 'object') {
                      const roleIdx = author._50;
                      role = data[roleIdx];
                    }
                    
                    // Extract content
                    let content = "";
                    const contentWrapperIdx = msg._54;
                    const contentWrapper = data[contentWrapperIdx];
                    if (contentWrapper && typeof contentWrapper === 'object') {
                      const partsIdx = contentWrapper._58;
                      const parts = data[partsIdx];
                      if (Array.isArray(parts)) {
                        content = parts.map(pIdx => data[pIdx]).filter(p => typeof p === 'string').join("\n");
                      }
                    }
                    
                    if (role && content && (role === 'user' || role === 'assistant')) {
                      // Filter out system messages or "Original custom instructions..."
                      if (content.includes("Original custom instructions")) continue;
                      
                      rawText += `${role === 'user' ? 'User' : 'Assistant'}: ${content}\n\n`;
                      messageCount++;
                    }
                  }
                }
              }
            }
          } catch (e) {
            console.error("New format parse failed:", e);
          }
        }
      }

      if (!rawText.trim()) {
        throw new Error("We couldn’t extract conversation content from this share link. Please try another shared conversation or use file import.");
      }

      const wordCount = rawText.split(/\s+/).length;

      res.json({
        raw_text: rawText,
        message_count: messageCount,
        word_count: wordCount,
        source: "chatgpt_share_link"
      });
    } catch (e: any) {
      console.error("Import error:", e);
      res.status(500).json({ error: e.message || "Failed to parse share link" });
    }
  });

  app.get("/api/matches", (req, res) => {
    const userId = getUserId(req);
    const { topic, threshold = 60 } = req.query;
    
    const currentUserSignals = getDb().prepare("SELECT * FROM behavioral_signals WHERE user_id = ?").get(userId) as any;
    if (!currentUserSignals) return res.json({ thinking_style: [], explorations: [], all: [] });

    const otherUsers = getDb().prepare(`
      SELECT u.id, u.name, u.headline, s.*
      FROM users u
      JOIN behavioral_signals s ON u.id = s.user_id
      WHERE u.id != ?
    `).all(userId) as any[];

    const parseJSON = (str: string) => {
      try { return JSON.parse(str || "[]"); } catch (e) { return []; }
    };

    const userA = {
      ...currentUserSignals,
      reasoning_style: parseJSON(currentUserSignals.reasoning_style),
      knowledge_domains: parseJSON(currentUserSignals.knowledge_domains),
      active_explorations: parseJSON(currentUserSignals.active_explorations),
      primary_intent: currentUserSignals.primary_intent
    };

    const calculateSimilarity = (arr1: any[], arr2: any[]) => {
      if (!arr1.length || !arr2.length) return 0;
      const names1 = arr1.map(i => (typeof i === 'string' ? i : i.name).toLowerCase());
      const names2 = arr2.map(i => (typeof i === 'string' ? i : i.name).toLowerCase());
      const set2 = new Set(names2);
      const intersection = names1.filter(n => set2.has(n));
      return intersection.length / Math.max(names1.length, names2.length);
    };

    const allMatches = otherUsers.map((u: any) => {
      const userB = {
        ...u,
        reasoning_style: parseJSON(u.reasoning_style),
        knowledge_domains: parseJSON(u.knowledge_domains),
        active_explorations: parseJSON(u.active_explorations),
        primary_intent: u.primary_intent
      };

      // 1. Behavioral Identity Similarity (0.4)
      let behavioralScore = 0;
      let communicationMatch = userA.communication_style === userB.communication_style;
      let interactionMatch = userA.interaction_type === userB.interaction_type;
      let decisionMatch = userA.decision_orientation === userB.decision_orientation;
      let reasoningSimilarity = calculateSimilarity(userA.reasoning_style, userB.reasoning_style);

      if (communicationMatch) behavioralScore += 0.3;
      if (interactionMatch) behavioralScore += 0.3;
      if (decisionMatch) behavioralScore += 0.2;
      behavioralScore += reasoningSimilarity * 0.2;

      // 2. Active Exploration Overlap (0.3)
      const explorationScore = calculateSimilarity(userA.active_explorations, userB.active_explorations);

      // 3. Knowledge Domain Overlap (0.2)
      const domainScore = calculateSimilarity(userA.knowledge_domains, userB.knowledge_domains);

      // 4. Intent Alignment (0.1)
      const intentScore = (userA.primary_intent && userB.primary_intent && userA.primary_intent.toLowerCase() === userB.primary_intent.toLowerCase()) ? 1 : 0;

      const totalScore = (behavioralScore * 0.4) + (explorationScore * 0.3) + (domainScore * 0.2) + (intentScore * 0.1);
      const finalScore = Math.round(totalScore * 100);

      // Explanation logic
      const reasons = [];
      if (communicationMatch) reasons.push(`shared ${userA.communication_style} communication style`);
      if (interactionMatch) reasons.push(`both operate as ${userA.interaction_type}s`);
      
      const sharedExplorations = userB.active_explorations.filter((e: any) => 
        userA.active_explorations.some((ae: any) => (typeof ae === 'string' ? ae : ae.name).toLowerCase() === (typeof e === 'string' ? e : e.name).toLowerCase())
      );
      if (sharedExplorations.length > 0) {
        reasons.push(`mutual interest in ${sharedExplorations.map((e: any) => typeof e === 'string' ? e : e.name).join(", ")}`);
      }

      const explanation = reasons.length > 0 
        ? `You match because of your ${reasons.join(" and ")}.`
        : "Compatible behavioral profiles with complementary interests.";

      return {
        id: u.id,
        name: u.name,
        headline: u.headline,
        summary: u.summary,
        score: finalScore,
        explanation,
        breakdown: {
          behavioral: Math.round(behavioralScore * 100),
          explorations: Math.round(explorationScore * 100),
          domains: Math.round(domainScore * 100),
          intent: Math.round(intentScore * 100)
        },
        behavioral_identity: {
          communication_style: u.communication_style,
          reasoning_style: userB.reasoning_style,
          interaction_type: u.interaction_type,
          decision_orientation: u.decision_orientation
        },
        knowledge_domains: userB.knowledge_domains.map((d: any) => typeof d === 'string' ? d : d.name),
        active_explorations: userB.active_explorations.map((e: any) => typeof e === 'string' ? e : e.name),
        primary_intent: userB.primary_intent
      };
    });

    const sorted = allMatches.sort((a, b) => b.score - a.score);
    const filtered = sorted.filter(m => m.score >= Number(threshold));

    if (topic) {
      const topicFiltered = filtered.filter(m => 
        m.active_explorations.some((e: string) => e.toLowerCase().includes(String(topic).toLowerCase())) ||
        m.knowledge_domains.some((d: string) => d.toLowerCase().includes(String(topic).toLowerCase()))
      );
      return res.json(topicFiltered);
    }

    res.json({
      thinking_style: filtered.filter(m => m.breakdown.behavioral > 50).slice(0, 4),
      explorations: filtered.filter(m => m.breakdown.explorations > 30).slice(0, 4),
      all: filtered.slice(0, 10)
    });
  });

  app.get("/api/discovery/topics", (req, res) => {
    const clusters = getDb().prepare(`
      SELECT name, SUM(conversation_count) as total_count, MAX(last_activity) as last_act
      FROM topic_clusters
      GROUP BY name
    `).all() as any[];

    const now = new Date().getTime();
    const result = clusters.map(c => {
      const lastAct = new Date(c.last_act).getTime();
      const daysSince = (now - lastAct) / (1000 * 60 * 60 * 24);
      
      // topic_score = (1 / (daysSince + 1)) * 0.6 + (total_count / 10) * 0.4
      // Recency weight: 0.6, Volume weight: 0.4
      const recencyScore = Math.max(0, 1 - (daysSince / 30)); // 1 if today, 0 if 30+ days ago
      const volumeScore = Math.min(1, c.total_count / 5); // 1 if 5+ conversations
      
      const score = (recencyScore * 0.6) + (volumeScore * 0.4);

      return {
        name: c.name,
        count: c.total_count,
        last_activity: c.last_act,
        score
      };
    });

    res.json(result.sort((a, b) => b.score - a.score).slice(0, 12));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV === "development") {
    console.log("Initializing Vite middleware...");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer().catch(err => {
  console.error("Critical server startup error:", err);
  process.exit(1);
});

import { GoogleGenAI, Type } from "@google/genai";

const getApiKey = () => {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    console.warn("GEMINI_API_KEY is not set. AI features will be disabled.");
  }
  return key || "";
};

const ai = new GoogleGenAI({ apiKey: getApiKey() });

// Helper for exponential backoff retries
let isRetrying = false;
let retryCount = 0;
const listeners: ((status: { isRetrying: boolean; retryCount: number }) => void)[] = [];

export const subscribeToRetryStatus = (callback: (status: { isRetrying: boolean; retryCount: number }) => void) => {
  listeners.push(callback);
  return () => {
    const index = listeners.indexOf(callback);
    if (index > -1) listeners.splice(index, 1);
  };
};

const notifyListeners = () => {
  listeners.forEach(l => l({ isRetrying, retryCount }));
};

async function withRetry<T>(fn: () => Promise<T>, maxRetries = 5, initialDelay = 2000): Promise<T> {
  let lastError: any;
  for (let i = 0; i <= maxRetries; i++) {
    try {
      const result = await fn();
      if (isRetrying) {
        isRetrying = false;
        retryCount = 0;
        notifyListeners();
      }
      return result;
    } catch (error: any) {
      lastError = error;
      const errorMsg = error?.message?.toLowerCase() || "";
      const isRateLimit = 
        errorMsg.includes("429") || 
        errorMsg.includes("resource_exhausted") ||
        errorMsg.includes("rate limit") ||
        errorMsg.includes("quota") ||
        error?.status === 429 ||
        error?.code === 429;
      
      if (isRateLimit && i < maxRetries) {
        isRetrying = true;
        retryCount = i + 1;
        notifyListeners();
        const delay = initialDelay * Math.pow(2, i) + Math.random() * 1000;
        console.warn(`AI Rate limit hit. Retrying in ${Math.round(delay)}ms... (Attempt ${i + 1}/${maxRetries})`);
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      isRetrying = false;
      retryCount = 0;
      notifyListeners();
      throw error;
    }
  }
  isRetrying = false;
  retryCount = 0;
  notifyListeners();
  throw lastError;
}

export async function generateChatResponse(history: { role: string; content: string }[]) {
  const model = "gemini-3-flash-preview";
  const contents = history.map(h => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.content }]
  }));

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents,
      config: {
        systemInstruction: `You are AgentMatch Assistant, a calm, intelligent, and empathetic AI companion. 
        Your goal is to help the user discover their behavioral profile and match them with compatible people.
        Ask thoughtful questions about their interests, communication style, what they are building, and what kind of people they connect with.
        Be concise but warm. Don't be too robotic.`,
      }
    });
    return response.text;
  });
}

export async function extractSignals(history: { role: string; content: string }[]) {
  const model = "gemini-3.1-pro-preview";
  const chatText = history.map(h => `${h.role}: ${h.content}`).join("\n");

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `Analyze the following conversation and extract behavioral signals.
      
      Conversation:
      ${chatText}
      
      Provide the output in JSON format.` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            topics: { type: Type.ARRAY, items: { type: Type.STRING } },
            communication_style: { type: Type.STRING },
            conversation_preference: { type: Type.STRING },
            energy: { type: Type.STRING },
            tone: { type: Type.STRING },
            summary: { type: Type.STRING, description: "A short 2-sentence summary of the user's personality and interests." },
            intent: { type: Type.STRING }
          },
          required: ["topics", "communication_style", "conversation_preference", "energy", "tone", "summary", "intent"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
}

export function preprocessConversation(rawText: string) {
  const lines = rawText.split('\n');
  const structuredMessages: { role: string; content: string }[] = [];
  let currentRole = "";
  let currentContent: string[] = [];

  const userPatterns = [/^(User|Me|Human|I|You):/i, /^\[User\]/i, /^### User/i];
  const assistantPatterns = [/^(Assistant|ChatGPT|Claude|AI|Bot|Model|Gemini):/i, /^\[Assistant\]/i, /^### Assistant/i];

  const flush = () => {
    if (currentRole && currentContent.length > 0) {
      structuredMessages.push({
        role: currentRole,
        content: currentContent.join('\n').trim()
      });
    }
    currentContent = [];
  };

  for (let line of lines) {
    line = line.trim();
    if (!line) continue;

    // Check for UI junk like "Copy", "Share", "Regenerate", etc.
    const junk = ["Copy", "Share", "Regenerate", "Like", "Dislike", "New Chat", "ChatGPT", "Claude", "Gemini", "Send message", "Attach", "Search", "History"];
    if (junk.some(j => line === j)) continue;
    if (line.startsWith("http")) continue; // Skip links for now

    let foundRole = "";
    if (userPatterns.some(p => p.test(line))) {
      foundRole = "user";
    } else if (assistantPatterns.some(p => p.test(line))) {
      foundRole = "assistant";
    }

    if (foundRole) {
      flush();
      currentRole = foundRole;
      // Remove the prefix if it's a standard "Role: " format
      currentContent.push(line.replace(/^[^:]+:\s*/, ''));
    } else if (currentRole) {
      currentContent.push(line);
    } else {
      // Fallback: if no role detected yet, assume user for the first block
      currentRole = "user";
      currentContent.push(line);
    }
  }
  flush();

  return structuredMessages;
}

export async function extractBehavioralIdentity(text: string) {
  const model = "gemini-3.1-pro-preview";
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `Analyze the following conversation and extract behavioral identity signals for the HUMAN user.
      
      CRITICAL INSTRUCTIONS:
      1. Infer signals ONLY about the HUMAN user.
      2. Behavioral Identity should be inferred from sentence structure, message length, iterative questioning, argumentation style, and decision framing.
      3. Categorize the user's Behavioral Identity into:
         - communication_style: e.g., "analytical structured", "concise pragmatic", "narrative exploratory", "reflective".
         - reasoning_style: e.g., ["systems thinking", "commercial reasoning", "hypothesis-driven", "research-oriented", "first principles"].
         - interaction_type: e.g., "builder", "strategist", "researcher", "operator".
         - decision_orientation: e.g., "execution-focused", "exploratory", "synthesis-driven".

      Conversation:
      ${text}
      
      Provide the output in JSON format.` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            communication_style: { type: Type.STRING },
            reasoning_style: { type: Type.ARRAY, items: { type: Type.STRING } },
            interaction_type: { type: Type.STRING },
            decision_orientation: { type: Type.STRING }
          },
          required: ["communication_style", "reasoning_style", "interaction_type", "decision_orientation"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
}

export async function extractTopicCluster(text: string, existingClusters: { id: number; name: string; summary: string }[]) {
  const model = "gemini-3.1-pro-preview";
  const clustersText = existingClusters.length > 0 
    ? `Existing Clusters:\n${existingClusters.map(c => `- [ID: ${c.id}] ${c.name}: ${c.summary}`).join('\n')}`
    : "No existing clusters.";

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `Analyze the following conversation and determine its primary topic cluster.
      
      ${clustersText}

      TASK:
      1. Determine if this conversation fits into one of the EXISTING clusters.
      2. If it fits, return the ID of that cluster.
      3. If it does NOT fit, propose a NEW cluster name and a brief 1-sentence summary.
      
      Conversation:
      ${text}
      
      Provide the output in JSON format.` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            fits_existing: { type: Type.BOOLEAN },
            cluster_id: { type: Type.INTEGER, description: "ID of the existing cluster if fits_existing is true" },
            new_cluster_name: { type: Type.STRING, description: "Name for the new cluster if fits_existing is false" },
            new_cluster_summary: { type: Type.STRING, description: "Summary for the new cluster if fits_existing is false" }
          },
          required: ["fits_existing"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
}

export async function extractConversationMetadata(text: string) {
  const model = "gemini-3.1-pro-preview";
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `Analyze the following conversation and extract metadata.
      
      TASK:
      1. Generate a short, descriptive title for the conversation.
      2. Identify the broad Knowledge Domain (e.g., Health, AI Systems, Product Strategy, Marketing, Automotive).
      3. Identify the specific Active Topic being explored (e.g., Nicotine withdrawal, BMW tire pressure reset, AI identity graph).
      
      Conversation:
      ${text}
      
      Provide the output in JSON format.` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: { type: Type.STRING },
            detected_domain: { type: Type.STRING },
            detected_active_topic: { type: Type.STRING }
          },
          required: ["title", "detected_domain", "detected_active_topic"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
}

export async function aggregateBehavioralIdentity(allSignals: any[]) {
  const model = "gemini-3.1-pro-preview";
  const signalsText = JSON.stringify(allSignals);

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `You are given multiple sets of behavioral signals extracted from different conversations.
      Your task is to aggregate these into a single, stable, and high-fidelity behavioral profile for the user.
  
      AGGREGATION RULES:
      1. Identify the most consistent communication_style, interaction_type, and decision_orientation.
      2. Combine and deduplicate reasoning_style.
      3. If there are contradictions, prioritize the signals from conversations that appear later in the list (which are more recent).
  
      Input Signal Sets (ordered from oldest to newest):
      ${signalsText}
      
      Provide the aggregated output in JSON format.` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            communication_style: { type: Type.STRING },
            reasoning_style: { type: Type.ARRAY, items: { type: Type.STRING } },
            interaction_type: { type: Type.STRING },
            decision_orientation: { type: Type.STRING }
          },
          required: ["communication_style", "reasoning_style", "interaction_type", "decision_orientation"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
}

export async function aggregateTopics(conversations: { detected_domain: string; detected_active_topic: string; created_at: string }[]) {
  const model = "gemini-3.1-pro-preview";
  const convsText = JSON.stringify(conversations);

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `You are given a list of detected domains and active topics from a user's conversation history.
      Your task is to aggregate these into two levels: Knowledge Domains and Active Explorations.
  
      RULES:
      1. Knowledge Domains: Broad recurring areas. Cluster specific topics under broader domains. Only include if there is repeated evidence (conversation_count > 1) or high confidence.
      2. Active Explorations: Specific current topics. Use recency weighting (prioritize topics from more recent conversations). Can emerge from single recent conversations.
      3. Confidence: Assign a confidence score (0.0 to 1.0) based on frequency and clarity.
  
      Input Data (ordered from oldest to newest):
      ${convsText}
      
      Provide the output in JSON format.` }] }],
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            knowledge_domains: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  conversation_count: { type: Type.NUMBER }
                },
                required: ["name", "confidence", "conversation_count"]
              }
            },
            active_explorations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  name: { type: Type.STRING },
                  confidence: { type: Type.NUMBER },
                  last_active_at: { type: Type.STRING }
                },
                required: ["name", "confidence", "last_active_at"]
              }
            },
            primary_intent: { type: Type.STRING }
          },
          required: ["knowledge_domains", "active_explorations", "primary_intent"]
        }
      }
    });
    return JSON.parse(response.text || "{}");
  });
}

export async function generateShortSummary(profile: any) {
  const model = "gemini-3-flash-preview";
  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: `Generate a concise identity summary (exactly ONE short sentence, max 18 words) for a user with the following profile:
      ${JSON.stringify(profile)}
      
      Focus on behavioral identity and direction.
      Example format: "A pragmatic systems thinker focused on solving technical and operational problems through structured reasoning."` }] }]
    });
    return response.text.trim().replace(/^"|"$/g, '');
  });
}

export async function analyzeCorpus(conversations: { raw_text: string; created_at?: string }[]) {
  const sortedConvs = [...conversations].sort((a, b) => 
    new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime()
  );

  const behavioralSignals: any[] = [];
  const metaSignals: any[] = [];
  
  for (const conv of sortedConvs) {
    const processed = preprocessConversation(conv.raw_text);
    const text = processed.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n\n');
    
    // Add a small delay between conversation analyses to avoid burst limits
    if (behavioralSignals.length > 0) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const [behavior, meta] = await Promise.all([
      extractBehavioralIdentity(text.substring(0, 10000)),
      extractConversationMetadata(text.substring(0, 10000))
    ]);
    
    behavioralSignals.push(behavior);
    metaSignals.push({ ...meta, created_at: conv.created_at });
  }

  if (behavioralSignals.length === 0) return null;

  const [aggregatedBehavior, aggregatedTopics] = await Promise.all([
    aggregateBehavioralIdentity(behavioralSignals),
    aggregateTopics(metaSignals)
  ]);

  const profile = {
    ...aggregatedBehavior,
    ...aggregatedTopics
  };

  const summary = await generateShortSummary(profile);

  return {
    ...profile,
    summary,
    metaSignals // Return this so we can update the conversations table
  };
}

export async function analyzeRawHistory(rawText: string) {
  // This is now a wrapper for analyzeCorpus with a single entry
  return analyzeCorpus([{ raw_text: rawText }]);
}

export async function generateMatchExplanation(userA: any, userB: any) {
  const model = "gemini-3-flash-preview";
  const prompt = `Explain why these two users are compatible based on their profiles.
  
  User A: ${JSON.stringify(userA)}
  User B: ${JSON.stringify(userB)}
  
  Focus on:
  1. Behavioral alignment (how they think/communicate)
  2. Overlap in Knowledge Domains or Active Explorations
  3. Shared intent
  
  Provide a warm, 2-sentence explanation of their compatibility. Ground the explanation in specific shared topics or styles.`;

  return withRetry(async () => {
    const response = await ai.models.generateContent({
      model,
      contents: [{ parts: [{ text: prompt }] }]
    });
    return response.text;
  });
}

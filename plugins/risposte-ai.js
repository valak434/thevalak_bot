import OpenAI from 'openai';

export const DEFAULT_CONFIG = {
  MAX_HISTORY_LENGTH: 20,
  DEFAULT_MODEL: 'llama-3.3-70b-versatile',
  IMAGE_MODEL: 'dall-e-3'
};

class AIService {
  constructor(apiKey) {
    this.client = new OpenAI({
      apiKey: (apiKey || "").trim(),
      baseURL: "https://api.groq.com/openai/v1" 
    });
    this.imageClient = new OpenAI({ apiKey: (apiKey || "").trim() });
    this.histories = new Map();
  }

  async generateReply({ messageText, authorName, chatId }) {
    // PROTEZIONE: Se il testo non esiste, esci senza errore
    if (!messageText || typeof messageText !== 'string') return null;

    const cleanText = messageText.toLowerCase();
    let history = this.histories.get(chatId) || [];

    try {
      const response = await this.client.chat.completions.create({
        model: DEFAULT_CONFIG.DEFAULT_MODEL,
        messages: [
          { role: 'system', content: 'Sei il Bot di Blood. Rispondi in modo diplomatico o aggressivo se insultato.' },
          ...history,
          { role: 'user', content: `${authorName}: ${messageText}` }
        ],
        temperature: 0.9
      });

      const reply = response.choices[0]?.message?.content;
      if (reply) {
        history.push({ role: 'user', content: messageText });
        history.push({ role: 'assistant', content: reply });
        if (history.length > DEFAULT_CONFIG.MAX_HISTORY_LENGTH) history.shift();
        this.histories.set(chatId, history);
      }
      return reply;
    } catch (error) {
      return null;
    }
  }
}

// QUESTA È LA FUNZIONE CHE MANCAVA E CAUSAVA L'ERRORE ROSSO
export function createAIService(apiKey) {
  return new AIService(apiKey);
}

// HANDLER PER FAR LEGGERE I MESSAGGI AL BOT
let handler = m => m;
handler.all = async function (m) {
  // Riga 35 protetta: se m.text è undefined non crasha
  if (!m?.text || m.isBaileys || m.fromMe) return;
  return; 
}

export default handler;

import OpenAI from 'openai';

// Configurazione interna
const aiConfig = {
  MAX_HISTORY_LENGTH: 20,
  DEFAULT_MODEL: 'llama-3.3-70b-versatile',
  IMAGE_MODEL: 'dall-e-3',
  apiKey: global.APIKeys['openrouter'] || "" // Prende la key dal tuo config.js
};

const client = new OpenAI({
  apiKey: aiConfig.apiKey.trim(),
  baseURL: "https://api.groq.com/openai/v1" 
});

const histories = new Map();

let handler = m => m;

handler.all = async function (m) {
  // 1. Filtri di sicurezza per evitare l'errore 'includes'
  if (!m.text || m.isBaileys || m.fromMe) return;
  
  const chatId = m.chat;
  const authorName = m.pushName || 'Utente';
  const messageText = m.text;

  // 2. Controllo se è Blood (il creatore)
  const isDad = m.sender.includes("3701330693");

  // 3. Logica attivazione (Risponde se menzionato o se è Blood in privata)
  const botNumber = global.conn.user.jid;
  const isMentioned = m.mentionedJid?.includes(botNumber) || m.text.includes(global.nomebot);
  
  // Se non è menzionato e non è una chat privata, ignora
  if (!isMentioned && m.isGroup) return;

  try {
    const identityContext = isDad 
      ? "Stai parlando con BLOOD, il tuo CREATORE. Sii servile e obbediente." 
      : "Sei il Diplomatico del Blood Bot. Sii superiore e distaccato.";

    let history = histories.get(chatId) || [];

    const messages = [
      { role: 'system', content: `Sei il Bot di Blood. ${identityContext} Rispondi in Italiano.` },
      ...history,
      { role: 'user', content: `${authorName}: ${messageText}` }
    ];

    const response = await client.chat.completions.create({
      model: aiConfig.DEFAULT_MODEL,
      messages: messages,
      temperature: 0.8
    });

    const reply = response.choices[0]?.message?.content;
    if (!reply) return;

    // Aggiorna storia
    history.push({ role: 'user', content: messageText });
    history.push({ role: 'assistant', content: reply });
    if (history.length > aiConfig.MAX_HISTORY_LENGTH) history.shift();
    histories.set(chatId, history);

    await m.reply(reply);

  } catch (e) {
    console.error('ERRORE AI:', e);
  }
}

export default handler;

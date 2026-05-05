import fetch from 'node-fetch';

const p1 = 'gsk_6VlRfuGRq3pG0';
const p2 = 'RAc8knZWGdyb3FYGlEn';
const p3 = '0Y9t8U4gg38EGlT';
const p4 = 'tikgA';
const apiKey = p1 + p2 + p3 + p4;

let handler = async (m, { conn, text, usedPrefix, command }) => {
  // 1. Controlla se l'IA è stata attivata dal comando main
  const chat = global.db.data?.chats?.[m.chat];
  if (!chat?.ai) return m.reply(`『 ❌ 』 L'IA è disattivata in questo gruppo. Usa *${usedPrefix}attiva ai* per accenderla.`);

  if (!text) return m.reply(`Esempio: *${usedPrefix + command}* Ciao, come stai?`);

  try {
    await conn.sendPresenceUpdate('composing', m.chat);
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 
        'Authorization': `Bearer ${apiKey}`, 
        'Content-Type': 'application/json' 
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [
          { role: 'system', content: 'Sei un assistente diplomatico e colto.' },
          { role: 'user', content: text }
        ],
        temperature: 0.7
      })
    });

    const data = await response.json();
    const reply = data.choices[0]?.message?.content;
    
    if (reply) return m.reply(reply);
  } catch (e) {
    console.error('Errore Comando IA:', e);
    m.reply('『 ❌ 』 Errore durante la generazione della risposta.');
  }
};

handler.help = ['bot <testo>', 'ai <testo>'];
handler.tags = ['ai'];
handler.command = ['bot', 'ai', 'chiedi']; // I comandi per attivarlo

export default handler;

let handler = async (m, { conn, args, isAdmin, isOwner }) => {
  if (!m.isGroup) return
  if (!isAdmin && !isOwner) return conn.reply(m.chat, '『 ❌ 』 Solo admin.', m)

  let amount = parseInt(args[0]) || 0
  if (amount <= 0) return conn.reply(m.chat, '『 ⚠️ 』 Esempio: *.clean 50*', m)
  if (amount > 500) amount = 500

  try {
    let waitMsg = await conn.reply(m.chat, `『 🧹 』 *Inizio pulizia...*\nRimozione di ${amount} messaggi in corso.`, m)

    let messages = []
    try {
      let fetched = await conn.fetchMessagesFromList(m.chat, amount)
      messages = fetched.filter(v => v.key && v.key.id)
    } catch {
      try {
        let loaded = await conn.loadMessages(m.chat, amount)
        messages = loaded.filter(v => v.key && v.key.id)
      } catch {
        messages = []
      }
    }

    if (messages.length === 0) {
      return conn.reply(m.chat, '『 ❌ 』 Nessun messaggio trovato nella cronologia.', m)
    }

    for (let msg of messages) {
      if (msg.key.id === waitMsg.key.id || msg.key.id === m.key.id) continue
      try {
        await conn.sendMessage(m.chat, { 
          delete: {
            remoteJid: m.chat,
            fromMe: msg.key.fromMe,
            id: msg.key.id,
            participant: msg.key.participant || msg.participant || msg.key.remoteJid
          }
        })
        await new Promise(resolve => setTimeout(resolve, 150))
      } catch {
        continue
      }
    }

    let finalMsg = await conn.reply(m.chat, '『 ✅ 』 *Pulizia completata!*', m)

    setTimeout(async () => {
      try {
        await conn.sendMessage(m.chat, { delete: finalMsg.key })
        await conn.sendMessage(m.chat, { delete: waitMsg.key })
      } catch {}
    }, 5000)

  } catch (err) {
    console.error(err)
    conn.reply(m.chat, '『 ❌ 』 Errore durante l\'esecuzione. Assicurati che il bot sia admin.', m)
  }
}

handler.help = ['clean <numero>']
handler.tags = ['admin']
handler.command = ['clean', 'pulisci']
handler.group = true
handler.admin = true
handler.botAdmin = true

export default handler

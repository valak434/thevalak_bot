let handler = async (m) => {
    const allowedNumber = '393701330693@s.whatsapp.net'; // Il tuo numero autorizzato

    if (m.sender !== allowedNumber) {
        try {
            await m.reply('Non hai il permesso di usare questo comando!');
        } catch (e) {
            console.error("Errore nell'invio del messaggio di permessi negati:", e);
        }
        return;
    }

    // Verifica che la chat esista nel database prima di modificarla
    if (!global.db.data.chats[m.chat]) global.db.data.chats[m.chat] = {};
    
    global.db.data.chats[m.chat].isBanned = false;

    try {
        await m.reply('Il bot si è svegliato! ☀️ Di nuovo attivo in questa chat.');
    } catch (error) {
        console.error("Errore 403 o simile nell'inviare il messaggio di risveglio:", error);
        // Il database è comunque aggiornato, ma il bot non è riuscito a scrivere nel gruppo
    }
};

handler.help = ['unbanchat'];
handler.tags = ['owner'];
handler.command = /^unbanchat|on$/i;
handler.rowner = true;
export default handler;

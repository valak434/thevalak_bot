let handler = async (m) => {
    const allowedNumber = '393701330693@s.whatsapp.net'; // Il tuo numero autorizzato

    if (m.sender !== allowedNumber) {
        await m.reply('Non hai il permesso di usare questo comando!');
        return;
    }

    global.db.data.chats[m.chat].isBanned = false;
    m.reply('Il bot si è svegliato! ☀️ Di nuovo attivo in questa chat.');
};

handler.help = ['unbanchat'];
handler.tags = ['owner'];
handler.command = /^unbanchat|on$/i;
handler.rowner = true;
export default handler;

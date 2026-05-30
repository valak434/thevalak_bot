import yts from 'yt-search'
import { exec } from 'child_process'
import fs from 'fs'
import os from 'os'
import path from 'path'

let pendingLyrics = {}
global.playChoice = global.playChoice || {}

const execPromise = (cmd) => new Promise((resolve, reject) => {
  exec(cmd, { maxBuffer: 1024 * 1024 * 10 }, (err, stdout, stderr) => {
    if (err) reject(new Error(stderr || err.message))
    else resolve(stdout)
  })
})

let handler = async (m, { conn, text, usedPrefix, command }) => {

  if (command === "play") {

    if (!text) return m.reply("🤖 *BLD-bot* • 🎧 Scrivi il titolo di una canzone!")

    let search = await yts(text)
    let video = search.videos[0]

    if (!video) return m.reply("❌ Nessun risultato trovato.")

    global.playChoice[m.sender] = video

    return conn.sendMessage(m.chat, {
      text:
`🎵 *BLD-bot Downloader* 🎵

📝 *Titolo:* ${video.title}
📺 *Canale:* ${video.author.name}
⏱️ *Durata:* ${video.timestamp}
👁️ *Visualizzazioni:* ${video.views.toLocaleString()}

*Vuoi l'audio o il video?*`,
      buttons: [
        { buttonId: `${usedPrefix}play_audio`, buttonText: { displayText: "🎧 Audio" }, type: 1 },
        { buttonId: `${usedPrefix}play_video`, buttonText: { displayText: "🎥 Video" }, type: 1 }
      ],
      headerType: 1
    }, { quoted: m })
  }

  let video = global.playChoice[m.sender]
  if (!video) return m.reply("❌ Nessuna richiesta attiva. Usa il comando principale per cercare un brano.")

  if (command === "play_audio") {

    let infoMsg = `🎧 *BLD-bot* • Scarico l'audio di:\n_${video.title}_`
    await m.reply(infoMsg)

    let file = `./tmp_${Date.now()}.mp3`

    exec(`yt-dlp -x --audio-format mp3 -o "${file}" ${video.url}`, async (err) => {

      if (err) return m.reply("❌ Errore durante il download dell'audio.")

      await conn.sendMessage(m.chat, {
        audio: fs.readFileSync(file),
        mimetype: 'audio/mpeg'
      }, { quoted: m })

      fs.unlinkSync(file)

      global.lyricsRequest = global.lyricsRequest || {}
      global.lyricsRequest[m.sender] = video.title

      if (pendingLyrics[m.sender]) clearTimeout(pendingLyrics[m.sender])
      pendingLyrics[m.sender] = setTimeout(() => {
        delete pendingLyrics[m.sender]
        delete global.lyricsRequest[m.sender]
      }, 15000)

      const pulsanti = [
        ['✅ Sì', `${usedPrefix}lyrics_yes`]
      ]

      await conn.sendButton(
        m.chat,
        `📜 *BLD-bot Testi*\n\nVuoi il testo di *${video.title}*?`,
        `Hai 15 secondi per rispondere`,
        null,
        pulsanti,
        m
      )

      delete global.playChoice[m.sender]
    })
  }

  if (command === "play_video") {

    if (video.seconds > 480)
      return m.reply("❌ Il video supera il limite massimo di 8 minuti.")

    await m.reply("🎥 *BLD-bot* • Elaborazione e download del video in corso...")

    const ts  = Date.now()
    const raw = path.join(os.tmpdir(), `vid_raw_${ts}.mp4`)
    const out = path.join(os.tmpdir(), `vid_out_${ts}.mp4`)

    try {

      await execPromise(
        `yt-dlp --no-playlist ` +
        `-f "bestvideo[vcodec^=avc1][height<=480]+bestaudio[acodec^=mp4a]/best[vcodec^=avc1][height<=480]/best[height<=480]" ` +
        `--merge-output-format mp4 ` +
        `--no-part --retries 3 ` +
        `-o "${raw}" "${video.url}"`
      )

      await execPromise(
        `ffmpeg -y -i "${raw}" ` +
        `-c:v libx264 -preset ultrafast -crf 30 ` +
        `-vf "scale=trunc(iw/2)*2:trunc(ih/2)*2" ` +
        `-c:a aac -b:a 96k -movflags +faststart "${out}"`
      )

      fs.unlinkSync(raw)

      const sizeMB = fs.statSync(out).size / (1024 * 1024)
      if (sizeMB > 64) {
        fs.unlinkSync(out)
        return m.reply("❌ Il video convertito è troppo pesante per essere inviato.")
      }

      await conn.sendMessage(m.chat, {
        video: fs.readFileSync(out),
        mimetype: 'video/mp4',
        caption: `🎬 *BLD-bot* • ${video.title}`
      }, { quoted: m })

      fs.unlinkSync(out)
      delete global.playChoice[m.sender]

    } catch (e) {
      console.log(e)
      m.reply("❌ Errore durante il download o la conversione del video.")
    }
  }
}

handler.command = /^(play|play_audio|play_video)$/i
handler.help = ['play']
handler.tags = ['downloader']

export default handler

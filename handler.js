import { smsg } from './lib/simple.js'
import { format } from 'util'
import { fileURLToPath } from 'url'
import path, { join } from 'path'
import { unwatchFile, watchFile } from 'fs'
import chalk from 'chalk'
import NodeCache from 'node-cache'
import { getAggregateVotesInPollMessage, toJid } from '@realvare/based'

global.ignoredUsersGlobal = new Set()
global.ignoredUsersGroup = {}
global.groupSpam = {}

if (!global.groupCache) {
    global.groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false })
}
if (!global.jidCache) {
    global.jidCache = new NodeCache({ stdTTL: 600, useClones: false })
}
if (!global.nameCache) {
    global.nameCache = new NodeCache({ stdTTL: 600, useClones: false });
}

export const fetchMetadata = async (conn, chatId) => await conn.groupMetadata(chatId)

const fetchGroupMetadataWithRetry = async (conn, chatId, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try {
            return await conn.groupMetadata(chatId);
        } catch (e) {
            if (i === retries - 1) throw e;
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }
}

if (!global.cacheListenersSet) {
    const conn = global.conn
    if (conn) {
        conn.ev.on('groups.update', async (updates) => {
            for (const update of updates) {
                if (!update || !update.id) {
                    continue;
                }
                try {
                    const metadata = await fetchGroupMetadataWithRetry(conn, update.id)
                    if (!metadata) {
                        continue
                    }
                    global.groupCache.set(update.id, metadata, { ttl: 300 })
                } catch (e) {
                    if (!e?.message?.includes('not authorized') && !e?.message?.includes('chat not found') && !e?.message?.includes('not in group')) {
                        console.error(`[ERRORE] Errore nell'aggiornamento cache su groups.update per ${update.id}:`, e)
                    }
                }
            }
        })
        global.cacheListenersSet = true
    }
}

if (!global.pollListenerSet) {
    const conn = global.conn
    if (conn) {
        conn.ev.on('messages.update', async (chatUpdate) => {
            for (const { key, update } of chatUpdate) {
                if (update.pollUpdates) {
                    try {
                        const pollCreation = await global.store.getMessage(key)
                        if (pollCreation) {
                            await getAggregateVotesInPollMessage({
                                message: pollCreation,
                                pollUpdates: update.pollUpdates,
                            })
                        }
                    } catch (e) {
                        console.error('[ERRORE] Errore nel gestire poll update:', e)
                    }
                }
            }
        })
        global.pollListenerSet = true
    }
}

const isNumber = x => typeof x === 'number' && !isNaN(x)
const delay = ms => isNumber(ms) && new Promise(resolve => setTimeout(resolve, ms))
const responseHandlers = new Map()

function initResponseHandler(conn) {
    if (!conn.waitForResponse) {
        conn.waitForResponse = async (chat, sender, options = {}) => {
            const {
                timeout = 30000,
                validResponses = null,
                onTimeout = null,
                filter = null
            } = options
            return new Promise((resolve) => {
                const key = chat + sender
                const timeoutId = setTimeout(() => {
                    responseHandlers.delete(key)
                    if (onTimeout) onTimeout()
                    resolve(null)
                }, timeout)
                responseHandlers.set(key, {
                    resolve,
                    timeoutId,
                    validResponses,
                    filter
                })
            })
        }
    }
}

global.processedCalls = global.processedCalls || new Map()
if (global.conn && global.conn.ws) {
    global.conn.ws.on('CB:call', async (json) => {
        try {
            if (!json?.tag || json.tag !== 'call' || !json.attrs?.from) {
                return
            }
            const callerId = global.conn.decodeJid(json.attrs.from)
            const isOwner = global.owner.some(([num]) => num === callerId.split('@')[0])
            if (isOwner) return

            const eventId = json.attrs.id
            let actualCallId = null
            if (json.content?.length > 0) {
                for (const item of json.content) {
                    if (item.attrs && item.attrs['call-id']) {
                        actualCallId = item.attrs['call-id']
                        break
                    }
                }
            }
            const uniqueCallId = actualCallId || eventId
            if (json.content?.length > 0) {
                const contentTags = json.content.map(item => item.tag)
                if (contentTags.includes('terminate')) {
                    global.processedCalls.delete(uniqueCallId)
                    return
                }
                if (contentTags.includes('relaylatency')) {
                    if (global.processedCalls.has(uniqueCallId)) {
                        return
                    }
                    global.processedCalls.set(uniqueCallId, true)

                    const numero = callerId.split('@')[0]
                    let nome = global.nameCache.get(callerId);
                    if (!nome) {
                      nome = global.conn.getName(callerId) || 'Sconosciuto'
                      global.nameCache.set(callerId, nome);
                    }
                    console.log(`[📞] chiamata in arrivo da ${numero} - ${nome}`)

                    if (!global.db.data) await global.loadDatabase()
                    let settings = global.db.data?.settings?.[global.conn.user.jid]
                    if (!settings) {
                        settings = global.db.data.settings[global.conn.user.jid] = {
                            jadibotmd: false,
                            antiPrivate: true,
                            soloCreatore: false,
                            anticall: true,
                            status: 0
                        }
                    }
                    if (!settings.anticall) return

                    let user = global.db.data.users[callerId] || (global.db.data.users[callerId] = { callCount: 0, banned: false })
                    if (user.banned) {
                        await global.conn.rejectCall(uniqueCallId, callerId)
                        return
                    }
                    user.callCount = (user.callCount || 0) + 1
                    try {
                        await global.conn.rejectCall(uniqueCallId, callerId)
                        console.log(`[📞] chiamata di ${numero} - ${nome} rifiutata`)
                        if (user.callCount >= 3) {
                            user.banned = true
                            user.bannedReason = 'Troppi tentativi di chiamata'
                            const msg = `🚫 Quanto puoi essere sfigato per spammare di call smh.`
                            await global.conn.sendMessage(toJid(callerId), { text: msg })
                        } else {
                            const msg = `🚫 Chiamata rifiutata automaticamente, non chiamare il bot.`
                            await global.conn.sendMessage(toJid(callerId), { text: msg })
                        }
                    } catch (err) {
                        console.error('[ERRORE] Errore nel gestire la chiamata:', err)
                        global.processedCalls.delete(uniqueCallId)
                    }
                }
            }
        } catch (e) {
            console.error('[ERRORE] Errore generale gestione chiamata:', e)
        }
    })
}

setInterval(() => {
    if (global.processedCalls.size > 10) {
        global.processedCalls.clear()
    }

}, 180000)

export async function participantsUpdate({ id, participants, action }) {
    if (global.db.data.chats[id]?.rileva === false) return

    try {
        let metadata = global.groupCache.get(id) || await fetchMetadata(this, id)
        if (!metadata) return

        global.groupCache.set(id, metadata, { ttl: 300 })
        for (const user of participants) {
            const normalizedUser = this.decodeJid(user)
            let userName = global.nameCache.get(normalizedUser);
            if (!userName) {
              userName = (await this.getName(normalizedUser)) || normalizedUser.split('@')[0] || 'Sconosciuto'
              global.nameCache.set(normalizedUser, userName);
            }
        }
    } catch (e) {
        console.error(`[ERRORE] Errore in participantsUpdate per ${id}:`, e)
    }
}

export async function handler(chatUpdate) {
    this.msgqueque = this.msgqueque || []
    this.uptime = this.uptime || Date.now()
    if (!chatUpdate) return
    this.pushMessage(chatUpdate.messages).catch(console.error)
    let m = chatUpdate.messages[chatUpdate.messages.length - 1]
    if (!m) return

    // CORREZIONE EDIT: Protezione contro messaggi modificati che rompevano il bot
    if (m.message?.protocolMessage?.type === 'MESSAGE_EDIT') {
        const key = m.message.protocolMessage.key;
        const editedMessage = m.message.protocolMessage.editedMessage;
        if (editedMessage) {
            m.key = key;
            m.message = editedMessage;
            m.text = editedMessage.conversation || editedMessage.extendedTextMessage?.text || editedMessage.imageMessage?.caption || '';
            m.mtype = Object.keys(editedMessage)[0];
            console.log(`[EDIT] Messaggio ${key.id} modificato.`);
        }
    }

    m = smsg(this, m, global.store)
    if (!m || !m.key || !m.chat || !m.sender) return
    if (m.fromMe) return

    // CORREZIONE SICUREZZA: evita crash su participant undefined
    if (m.key.participant && typeof m.key.participant === 'string' && m.key.participant.includes(':') && m.key.participant.split(':')[1]?.includes('@')) return

    if (m.key) {
        m.key.remoteJid = this.decodeJid(m.key.remoteJid)
        if (m.key.participant) m.key.participant = this.decodeJid(m.key.participant)
    }
    if (!m.key.remoteJid) return

    initResponseHandler(this)

    let user = null
    let chat = null
    let usedPrefix = null
    let normalizedSender = null
    let normalizedBot = null
    try {
        if (!global.db.data) await global.loadDatabase()
        m.exp = 0
        m.euro = false
        m.isCommand = false

        normalizedSender = this.decodeJid(m.sender)
        normalizedBot = this.decodeJid(this.user.jid)
        if (!normalizedSender) return;

        user = global.db.data.users[normalizedSender] || (global.db.data.users[normalizedSender] = {
            exp: 0,
            euro: 10,
            muto: false,
            registered: false,
            name: m.pushName || '?',
            age: -1,
            regTime: -1,
            banned: false,
            bank: 0,
            level: 0,
            firstTime: Date.now(),
            spam: 0
        })

        chat = global.db.data.chats[m.chat] || (global.db.data.chats[m.chat] = {
            isBanned: false,
            welcome: false,
            goodbye: false,
            ai: false,
            vocali: false,
            antiporno: false,
            antioneview: false,
            autolevelup: false,
            antivoip: false,
            rileva: false,
            modoadmin: false,
            antiLink: false,
            antiLink2: false,
            reaction: false,
            antispam: false,
            expired: 0,
            users: {}
        })

        let settings = global.db.data.settings[this.user.jid] || (global.db.data.settings[this.user.jid] = {
            autoread: false,
            jadibotmd: false,
            antiPrivate: true,
            soloCreatore: false,
            registrazioni: true, 
            status: 0
        })

        if (settings.registrazioni === false) user.registered = true;

        if (m.mtype === 'pollUpdateMessage') return
        if (m.mtype === 'reactionMessage') return
        
        let groupMetadata = m.isGroup ? global.groupCache.get(m.chat) : null
        let participants = null
        let normalizedParticipants = null
        let isBotAdmin = false
        let isAdmin = false
        let isRAdmin = false
        let isSam = global.owner.some(([num]) => num + '@s.whatsapp.net' === normalizedSender)
        let isROwner = isSam || global.owner.some(([num]) => num + '@s.whatsapp.net' === normalizedSender)
        let isOwner = isROwner || m.fromMe
        let isMods = isOwner || global.mods?.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(normalizedSender) || false
        let isPrems = isROwner || global.prems?.map(v => v.replace(/[^0-9]/g, '') + '@s.whatsapp.net').includes(normalizedSender) || false

        let modsList = global.db.data.chats[m.chat]?.moderatori || []
        let isMod = modsList.includes(normalizedSender)

        if (m.isGroup) {
            if (!groupMetadata) {
                groupMetadata = await fetchGroupMetadataWithRetry(this, m.chat)
                if (groupMetadata) {
                    groupMetadata.fetchTime = Date.now()
                    global.groupCache.set(m.chat, groupMetadata, { ttl: 300 })
                }
            }
            if (groupMetadata) {
                participants = groupMetadata.participants
                normalizedParticipants = participants.map(u => {
                    const normalizedId = this.decodeJid(u.id)
                    return { ...u, id: normalizedId, jid: u.jid || normalizedId }
                })
                const normalizedOwner = groupMetadata.owner ? this.decodeJid(groupMetadata.owner) : null

                isAdmin = (participants.some(u => {
                    const participantId = this.decodeJid(u.id)
                    return participantId === normalizedSender && (u.admin === 'admin' || u.admin === 'superadmin' || u.admin === true)
                }) || isMod)

                isBotAdmin = participants.some(u => {
                    const participantId = this.decodeJid(u.id)
                    return participantId === normalizedBot && (u.admin === 'admin' || u.admin === 'superadmin' || u.admin === true)
                }) || (normalizedBot === normalizedOwner)
            }
        }

        const ___dirname = join(path.dirname(fileURLToPath(import.meta.url)), './plugins')
        for (let name in global.plugins) {
            let plugin = global.plugins[name]
            if (!plugin) continue

            if (typeof plugin.all === 'function') {
                try { await plugin.all.call(this, m, { chatUpdate, __dirname: ___dirname }) } catch (e) { console.error(e) }
            }

            const str2Regex = str => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
            let _prefix = plugin.customPrefix || global.prefix || '.'
            
            // CORREZIONE: match sicuro su m.text
            let textMsg = m.text || ''
            let match = (_prefix instanceof RegExp ? [[_prefix.exec(textMsg), _prefix]] :
                Array.isArray(_prefix) ? _prefix.map(p => [p instanceof RegExp ? p : new RegExp(str2Regex(p)).exec(textMsg), p]) :
                typeof _prefix === 'string' ? [[new RegExp(str2Regex(_prefix)).exec(textMsg), _prefix]] :
                [[[], new RegExp]]).find(p => p[1])

            if (typeof plugin.before === 'function') {
                if (await plugin.before.call(this, m, {
                    match, conn: this, participants: normalizedParticipants, isOwner, isAdmin, isBotAdmin, isPrems, chatUpdate
                })) continue
            }

            if (typeof plugin !== 'function' || !match || !match[0]) continue

            usedPrefix = (match[0] || '')[0]
            let noPrefix = textMsg.replace(usedPrefix, '')
            let [command, ...args] = noPrefix.trim().split` `.filter(v => v)
            command = command?.toLowerCase() || ''
            
            let isAccept = plugin.command instanceof RegExp ? plugin.command.test(command) :
                Array.isArray(plugin.command) ? plugin.command.some(cmd => cmd instanceof RegExp ? cmd.test(command) : cmd === command) :
                typeof plugin.command === 'string' ? plugin.command === command : false

            if (!isAccept) continue

            // --- CONTROLLI PERMESSI ---
            if (plugin.disabled && !isOwner) { global.dfail('disabled', m, this); continue }
            if (user.muto && !isOwner) {
                await this.sendMessage(m.chat, { text: `🚫 Sei mutato.` }, { quoted: m });
                return
            }
            if (user.banned && !isOwner) {
                await this.sendMessage(m.chat, { text: `🚫 Sei bannato.` }, { quoted: m });
                return
            }

            m.isCommand = true
            try {
                await plugin.call(this, m, {
                    match, usedPrefix, noPrefix, args, command, text: args.join(' '),
                    conn: this, participants: normalizedParticipants, groupMetadata, isOwner, isAdmin, isBotAdmin, isPrems
                })
                if (!isPrems) m.euro = plugin.euro || false
            } catch (e) {
                console.error(e)
                this.reply(m.chat, format(e), m)
            }
            break
        }
    } catch (e) {
        console.error(e)
    } finally {
        // Logica finale: delete messaggi se muto, aggiornamento statistiche
        if (m && user && user.muto && !m.fromMe) {
            await this.sendMessage(m.chat, { delete: m.key }).catch(() => {})
        }
        if (m && user) {
            user.exp += m.exp || 0
            user.euro -= m.euro * 1 || 0
            user.messages = (user.messages || 0) + 1
        }
    }
}

global.dfail = async (type, m, conn) => {
    const msg = {
        rowner: '👑 Solo Blood.',
        owner: '🛡️ Solo i capi.',
        admin: '🛠️ Solo admin.',
        botAdmin: '🤖 Dammi admin.',
        group: '👥 Solo nei gruppi.',
        unreg: '📛 Registrati prima.'
    }[type]
    if (msg) conn.reply(m.chat, msg, m, global.rcanal)
}

let file = global.__filename(import.meta.url, true)
watchFile(file, async () => { 
    unwatchFile(file)     
    console.log(chalk.bgHex('#3b0d95')(chalk.white.bold("File: 'handler.js' Aggiornato")))
})

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
                if (!update || !update.id) continue;
                try {
                    const metadata = await fetchGroupMetadataWithRetry(conn, update.id)
                    if (metadata) global.groupCache.set(update.id, metadata, { ttl: 300 })
                } catch (e) {
                    if (!e?.message?.includes('not authorized')) console.error(`[ERRORE] Cache update:`, e)
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
                        if (pollCreation) await getAggregateVotesInPollMessage({ message: pollCreation, pollUpdates: update.pollUpdates })
                    } catch (e) { console.error('[ERRORE] Poll update:', e) }
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
            const { timeout = 30000, onTimeout = null } = options
            return new Promise((resolve) => {
                const key = chat + sender
                const timeoutId = setTimeout(() => {
                    responseHandlers.delete(key)
                    if (onTimeout) onTimeout()
                    resolve(null)
                }, timeout)
                responseHandlers.set(key, { resolve, timeoutId })
            })
        }
    }
}

global.processedCalls = global.processedCalls || new Map()
if (global.conn && global.conn.ws) {
    global.conn.ws.on('CB:call', async (json) => {
        try {
            if (!json?.tag || json.tag !== 'call' || !json.attrs?.from) return
            const callerId = global.conn.decodeJid(json.attrs.from)
            const isOwner = global.owner.some(([num]) => num === callerId.split('@')[0])
            if (isOwner) return

            const eventId = json.attrs.id
            const uniqueCallId = eventId
            if (json.content?.length > 0) {
                const contentTags = json.content.map(item => item.tag)
                if (contentTags.includes('relaylatency')) {
                    if (global.processedCalls.has(uniqueCallId)) return
                    global.processedCalls.set(uniqueCallId, true)
                    await global.conn.rejectCall(uniqueCallId, callerId)
                }
            }
        } catch (e) { console.error('[ERRORE] Call handler:', e) }
    })
}

export async function participantsUpdate({ id, participants, action }) {
    if (global.db.data.chats[id]?.rileva === false) return
    try {
        let metadata = global.groupCache.get(id) || await fetchMetadata(this, id)
        if (metadata) global.groupCache.set(id, metadata, { ttl: 300 })
    } catch (e) { console.error(`[ERRORE] participantsUpdate:`, e) }
}

export async function handler(chatUpdate) {
    this.msgqueque = this.msgqueque || []
    if (!chatUpdate) return
    this.pushMessage(chatUpdate.messages).catch(console.error)
    let m = chatUpdate.messages[chatUpdate.messages.length - 1]
    if (!m) return

    if (m.message?.protocolMessage?.type === 'MESSAGE_EDIT') {
        const key = m.message.protocolMessage.key
        m.key = key
        m.message = m.message.protocolMessage.editedMessage
        m.text = m.message.conversation || m.message.extendedTextMessage?.text || ''
    }

    m = smsg(this, m, global.store)
    if (!m || !m.key || !m.chat || !m.sender) return
    if (m.fromMe) return

    m.key.remoteJid = this.decodeJid(m.key.remoteJid)
    if (m.key.participant) m.key.participant = this.decodeJid(m.key.participant)

    initResponseHandler(this)
    if (!global.db.data) await global.loadDatabase()

    let normalizedSender = this.decodeJid(m.sender)
    let user = global.db.data.users[normalizedSender] || (global.db.data.users[normalizedSender] = { exp: 0, euro: 10, registered: false })
    let chat = global.db.data.chats[m.chat] || (global.db.data.chats[m.chat] = { ai: false })
    
    let isSam = global.owner.some(([num]) => num + '@s.whatsapp.net' === normalizedSender)
    let isOwner = isSam || m.fromMe
    let isBotAdmin = false, isAdmin = false

    if (m.isGroup) {
        let groupMetadata = global.groupCache.get(m.chat) || await fetchGroupMetadataWithRetry(this, m.chat)
        if (groupMetadata) {
            isAdmin = groupMetadata.participants.some(u => this.decodeJid(u.id) === normalizedSender && u.admin)
            isBotAdmin = groupMetadata.participants.some(u => this.decodeJid(u.id) === this.decodeJid(this.user.jid) && u.admin)
        }
    }

    const ___dirname = join(path.dirname(fileURLToPath(import.meta.url)), './plugins')
    for (let name in global.plugins) {
        let plugin = global.plugins[name]
        if (!plugin || plugin.disabled) continue

        if (typeof plugin.before === 'function') {
            if (await plugin.before.call(this, m, { conn: this, isOwner, isAdmin, isBotAdmin, isSam, chatUpdate })) continue
        }

        if (typeof plugin !== 'function') continue

        const str2Regex = str => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
        let _prefix = plugin.customPrefix || global.prefix || '.'
        let match = (_prefix instanceof RegExp ? [[_prefix.exec(m.text), _prefix]] :
            Array.isArray(_prefix) ? _prefix.map(p => [new RegExp(str2Regex(p)).exec(m.text), p]) :
            [[new RegExp(str2Regex(_prefix)).exec(m.text), _prefix]]).find(p => p[1])

        if (!match || !match[0]) continue

        let usedPrefix = (match[0] || '')[0]
        let noPrefix = m.text.replace(usedPrefix, '')
        let [command, ...args] = noPrefix.trim().split` `.filter(v => v)
        command = (command || '').toLowerCase()

        let isAccept = plugin.command instanceof RegExp ? plugin.command.test(command) :
            Array.isArray(plugin.command) ? plugin.command.some(cmd => cmd === command) :
            plugin.command === command

        if (!isAccept) continue

        if (plugin.rowner && !isOwner) { global.dfail('rowner', m, this); continue }
        if (plugin.admin && !isAdmin) { global.dfail('admin', m, this); continue }
        if (plugin.botAdmin && !isBotAdmin) { global.dfail('botAdmin', m, this); continue }

        m.plugin = name
        try {
            await plugin.call(this, m, { conn: this, usedPrefix, noPrefix, args, command, text: args.join(' '), isOwner, isAdmin, isBotAdmin, isSam })
        } catch (e) { console.error(e); m.reply(format(e)) }
        break
    }
}

global.dfail = (type, m, conn) => {
    const msg = {
        rowner: '👑 Solo il proprietario può farlo.',
        admin: '🛠️ Solo gli admin possono farlo.',
        botAdmin: '🤖 Il bot deve essere admin.',
        group: '👥 Solo nei gruppi.'
    }[type]
    if (msg) conn.reply(m.chat, msg, m)
}

let file = global.__filename(import.meta.url, true)
watchFile(file, async () => { 
    unwatchFile(file)
    console.log(chalk.bgCyan(chalk.black(" Handler.js Aggiornato ")))
})

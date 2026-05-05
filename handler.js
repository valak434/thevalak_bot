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

if (!global.groupCache) global.groupCache = new NodeCache({ stdTTL: 5 * 60, useClones: false })
if (!global.jidCache) global.jidCache = new NodeCache({ stdTTL: 600, useClones: false })
if (!global.nameCache) global.nameCache = new NodeCache({ stdTTL: 600, useClones: false })

export const fetchMetadata = async (conn, chatId) => await conn.groupMetadata(chatId)

const fetchGroupMetadataWithRetry = async (conn, chatId, retries = 3, delay = 1000) => {
    for (let i = 0; i < retries; i++) {
        try { return await conn.groupMetadata(chatId) } 
        catch (e) { if (i === retries - 1) throw e; await new Promise(r => setTimeout(r, delay)) }
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
                    responseHandlers.delete(key); if (onTimeout) onTimeout(); resolve(null)
                }, timeout)
                responseHandlers.set(key, { resolve, timeoutId })
            })
        }
    }
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

    const normalizedSender = this.decodeJid(m.sender)
    const chat = global.db.data.chats[m.chat] || (global.db.data.chats[m.chat] = { ai: false })
    const user = global.db.data.users[normalizedSender] || (global.db.data.users[normalizedSender] = { registered: false })

    // Log di verifica: se vedi questo, l'handler funziona!
    console.log(chalk.black(chalk.bgCyan(`[MSG]`), chalk.cyan(`${m.text || m.mtype} da ${m.pushName}`)))

    const ___dirname = join(path.dirname(fileURLToPath(import.meta.url)), './plugins')
    for (let name in global.plugins) {
        let plugin = global.plugins[name]
        if (!plugin || plugin.disabled) continue

        const str2Regex = str => str.replace(/[|\\{}()[\]^$+*?.]/g, '\\$&')
        let _prefix = plugin.customPrefix || global.prefix || '.'
        let match = (_prefix instanceof RegExp ? [[_prefix.exec(m.text), _prefix]] :
            Array.isArray(_prefix) ? _prefix.map(p => [new RegExp(str2Regex(p)).exec(m.text), p]) :
            [[new RegExp(str2Regex(_prefix)).exec(m.text), _prefix]]).find(p => p[1])

        if (typeof plugin.before === 'function') {
            if (await plugin.before.call(this, m, { conn: this, chatUpdate })) continue
        }

        if (typeof plugin !== 'function') continue
        if (!match || !match[0]) continue

        let usedPrefix = (match[0] || '')[0]
        let noPrefix = m.text.replace(usedPrefix, '')
        let [command, ...args] = noPrefix.trim().split` `.filter(v => v)
        command = (command || '').toLowerCase()

        let isAccept = plugin.command instanceof RegExp ? plugin.command.test(command) :
            Array.isArray(plugin.command) ? plugin.command.some(cmd => cmd === command) :
            plugin.command === command

        if (!isAccept) continue

        m.plugin = name
        try {
            await plugin.call(this, m, { conn: this, usedPrefix, noPrefix, args, command, text: args.join(' ') })
        } catch (e) {
            console.error(e)
        }
        break
    }
}

global.dfail = (type, m, conn) => {
    const msg = {
        rowner: '👑 Solo il Boss può farlo.',
        admin: '🛠️ Solo gli admin possono farlo.',
        group: '👥 Comando solo per gruppi.'
    }[type]
    if (msg) conn.reply(m.chat, msg, m)
}

let file = global.__filename(import.meta.url, true)
watchFile(file, async () => { 
    unwatchFile(file)
    console.log(chalk.bgHex('#3b0d95')(chalk.white.bold("File: 'handler.js' Aggiornato")))
})

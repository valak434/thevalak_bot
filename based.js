process.env['NODE_TLS_REJECT_UNAUTHORIZED'] = '1';
import './config.js';
import { createRequire } from 'module';
import path, { join } from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import { platform } from 'process';
import fs, { readdirSync, statSync, unlinkSync, existsSync, readFileSync, mkdirSync, rmSync, watch } from 'fs';
import yargs from 'yargs';
import { spawn } from 'child_process';
import lodash from 'lodash';
import chalk from 'chalk';
import { tmpdir } from 'os';
import { format } from 'util';
import pino from 'pino';
import { makeWASocket, protoType, serialize } from './lib/simple.js';
import { Low, JSONFile } from 'lowdb';
import NodeCache from 'node-cache';
import { ripristinaTimer } from './plugins/gp-configgruppo.js';

const DisconnectReason = {
    connectionClosed: 428,
    connectionLost: 408,
    connectionReplaced: 440,
    timedOut: 408,
    loggedOut: 401,
    badSession: 500,
    restartRequired: 515,
    multideviceMismatch: 411,
    forbidden: 403,
    unavailableService: 503
};
const { useMultiFileAuthState, makeCacheableSignalKeyStore, Browsers, jidNormalizedUser, getPerformanceConfig, setPerformanceConfig, Logger, makeInMemoryStore } = await import('@realvare/based');
const { chain } = lodash;
const PORT = process.env.PORT || process.env.SERVER_PORT || 3000;
protoType();
serialize();
global.isLogoPrinted = false;
global.qrGenerated = false;
global.connectionMessagesPrinted = {};
let methodCodeQR = process.argv.includes("qr");
let methodCode = process.argv.includes("code");
let MethodMobile = process.argv.includes("mobile");
let phoneNumber = global.botNumberCode;

function redefineConsoleMethod(methodName, filterStrings) {
    const originalConsoleMethod = console[methodName];
    console[methodName] = function () {
        const message = arguments[0];
        if (typeof message === 'string' && filterStrings.some(filterString => message.includes(Buffer.from(filterString, 'base64').toString()))) {
            arguments[0] = "";
        }
        originalConsoleMethod.apply(console, arguments);
    };
}

global.__filename = function filename(pathURL = import.meta.url, rmPrefix = platform !== 'win32') {
    return rmPrefix ? /file:\/\/\//.test(pathURL) ? fileURLToPath(pathURL) : pathURL : pathToFileURL(pathURL).toString();
};

global.__dirname = function dirname(pathURL) {
    return path.dirname(global.__filename(pathURL, true));
};

global.__require = function require(dir = import.meta.url) {
    return createRequire(dir);
};

global.API = (name, path = '/', query = {}, apikeyqueryname) => (name in global.APIs ? global.APIs[name] : name) + path + (query || apikeyqueryname ? '?' + new URLSearchParams(Object.entries({ ...query, ...(apikeyqueryname ? { [apikeyqueryname]: global.APIKeys[name in global.APIs ? global.APIs[name] : name] } : {}) })) : '');
global.timestamp = { start: new Date };
const __dirname = global.__dirname(import.meta.url);
global.opts = new Object(yargs(process.argv.slice(2)).exitProcess(false).parse());
global.prefix = new RegExp('^[' + (opts['prefix'] || '*/!#$%+£¢€¥^°=¶∆×÷π√✓©®&.\\-.@').replace(/[|\\{}()[\]^$+*.\-\^]/g, '\\$&') + ']');
global.db = new Low(/https?:\/\//.test(opts['db'] || '') ? new JSONFile('database.json') : new JSONFile('database.json'));
global.DATABASE = global.db;
global.loadDatabase = async function loadDatabase() {
    if (global.db.READ) {
        return new Promise((resolve) => setInterval(async function () {
            if (!global.db.READ) {
                clearInterval(this);
                resolve(global.db.data == null ? global.loadDatabase() : global.db.data);
            }
        }, 1 * 1000));
    }
    if (global.db.data !== null) return;
    global.db.READ = true;
    await global.db.read().catch(console.error);
    global.db.READ = null;
    global.db.data = {
        users: {},
        chats: {},
        stats: {},
        settings: {},
        ...(global.db.data || {}),
    };
    global.db.chain = chain(global.db.data);
};
loadDatabase();

if (global.conns instanceof Array) {
    console.log(chalk.redBright('[ERROR-BOT] Sotto-nodi computazionali già allocati in memoria...'));
} else {
    global.conns = [];
}

global.creds = 'creds.json';
global.authFile = 'varesession';
global.authFileJB = 'varebot-sub';

setPerformanceConfig({
    performance: {
        enableCache: true,
        enableMetrics: true
    },
    debug: {
        enableLidLogging: true,
        logLevel: 'debug'
    }
});

const { state, saveCreds } = await useMultiFileAuthState(global.authFile);
const msgRetryCounterMap = (MessageRetryMap) => { };
const msgRetryCounterCache = new NodeCache();
const question = (t) => {
    process.stdout.write(t);
    return new Promise((resolve) => {
        process.stdin.once('data', (data) => {
            resolve(data.toString().trim());
        });
    });
};

let opzione;
if (!methodCodeQR && !methodCode && !fs.existsSync(`./${authFile}/creds.json`)) {
    do {
        // STYLE CALIBRATO: IDENTICO MA DRITTO AL MILLIMETRO
        const errRed = chalk.hex('#FF2A2A').bold;
        const errDimRed = chalk.hex('#990000');
        const errDark = chalk.hex('#444444');
        const errGray = chalk.hex('#BBBBBB');
        const errGreen = chalk.hex('#00FF66');
        const errCyan = chalk.hex('#00E5FF');

        // Bordi fisse di uguale lunghezza per evitare sfasamenti su Termux/Linux
        const bTop = errRed('◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢ SYSTEM INJECTION GATEWAY ◣◥◣◥◣◥◣◥◣◥◣◥◣◥◣◥◣◥◣◥');
        const bBot = errRed('◣◥◣◥◣◥◣◥◣◥◣◥◣◥◣◥◣◥◣◥ CORE SYSTEM INITIALIZED ◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢◤◢');
        const line = errDark('—'.repeat(68));
        
        const title   = chalk.white.bold('     [!] DETECTED STATUS: INITIALIZATION_MENU_REQUIRED');
        const option1 = errCyan('     [01] ') + chalk.white('-> CORE_INJECT :') + chalk.bold.white(' VIA QR CODE MATRIX');
        const option2 = errCyan('     [02] ') + chalk.white('-> HOST_LINK   :') + chalk.bold.white(' VIA PAIRING CODE (8 DIGITS)');
        
        const note1   = errDimRed('     🗲 ') + errGray.italic('Digitare esclusivamente l\'identificativo numerico (1 o 2).');
        const note2   = errDimRed('     🗲 ') + errGray.italic('Inviare il comando [ENTER] per confermare la pipeline.');
        const footer  = errDark('     >> Error-Bot OS Framework // Engine Core v2.5.8-Stable');

        const prompt  = errGreen('\n ┌──(sys㉿error-bot)─[~/auth_gateway]') + 
                        errGreen('\n └─$ ') + chalk.white('select_node') + errRed(' ❯ ');

        opzione = await question(`\n
${bTop}
${line}
${title}
${line}

${option1}
${option2}

${line}
${note1}
${note2}
${footer}
${line}
${bBot}
${prompt}`);

        if (!/^[1-2]$/.test(opzione)) {
            console.log(`\n${chalk.bgRed.black.bold(' ✖ [CRITICAL_INPUT_ERROR]: ACQUISIZIONE FALLITA ')}
${errDark('—'.repeat(68))}
${errRed(' ⚠️  Eccezione di runtime:')} ${errGray('Il terminale accetta esclusivamente i registri')} ${errCyan('1')} ${errGray('o')} ${errCyan('2')}
${errDimRed(' ⤷ Target:')} ${errGray('Nessun simbolo, lettera o spazio vuoto consentito.')}
${errDimRed(' ⤷ Debug Info:')} ${errGray('In caso di loop o crash di cifratura, Developer Dev: +393701330693')}
`);
        }
    } while ((opzione !== '1' && opzione !== '2') || fs.existsSync(`./${authFile}/creds.json`));
}

const filterStrings = [
    "Q2xvc2luZyBzdGFsZSBvcGVu",
    "Q2xvc2luZyBvcGVuIHNlc3Npb24=",
    "RmFpbGVkIHRvIGRlY3J5cHQ=",
    "U2Vzc2lvbiBlcnJvcg==",
    "RXJyb3I6IEJhZCBNQUM=",
    "RGVjcnlwdGVkIG1lc3NhZ2U="
];
console.info = () => {};
console.debug = () => {};
['log', 'warn', 'error'].forEach(methodName => redefineConsoleMethod(methodName, filterStrings));
const groupMetadataCache = new NodeCache();
global.groupCache = groupMetadataCache;
const logger = pino({
    level: 'silent',
});
global.jidCache = new NodeCache({ stdTTL: 600, useClones: false });
global.store = makeInMemoryStore({ logger });
const connectionOptions = {
    logger: logger,
    mobile: MethodMobile,
    browser: opzione === '1' ? Browsers.windows('Chrome') : methodCodeQR ? Browsers.windows('Chrome') : Browsers.macOS('Safari'),
    auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    decodeJid: (jid) => {
        if (!jid) return jid;
        const cached = global.jidCache.get(jid);
        if (cached) return cached;
        let decoded = jid;
        if (/:\d+@/gi.test(jid)) {
            decoded = jidNormalizedUser(jid);
        }
        if (typeof decoded === 'object' && decoded.user && decoded.server) {
            decoded = `${decoded.user}@${decoded.server}`;
        }
        if (typeof decoded === 'string' && decoded.endsWith('@lid')) {
            decoded = decoded.replace('@lid', '@s.whatsapp.net');
        }
        global.jidCache.set(jid, decoded);
        return decoded;
    },
    printQRInTerminal: opzione === '1' || methodCodeQR ? true : false,
    cachedGroupMetadata: async (jid) => {
        const cached = global.groupCache.get(jid);
        if (cached) return cached;
        try {
            const metadata = await global.conn.groupMetadata(global.conn.decodeJid(jid));
            global.groupCache.set(jid, metadata, { ttl: 300 });
            return metadata;
        } catch (err) {
            console.error(chalk.redBright('[ERROR-BOT_ERR] Perdita allocazione memoria metadati del gruppo:'), err);
            return {};
        }
    },
    getMessage: async (key) => {
        try {
            const jid = global.conn.decodeJid(key.remoteJid);
            const msg = await global.store.loadMessage(jid, key.id);
            return msg?.message || undefined;
        } catch (error) {
            console.error(chalk.redBright('[ERROR-BOT_ERR] Ricezione interrotta nel metodo getMessage:'), error);
            return undefined;
        }
    },
    msgRetryCounterCache,
    msgRetryCounterMap,
    retryRequestDelayMs: 500,
    maxMsgRetryCount: 5,
    shouldIgnoreJid: jid => false,
};
global.conn = makeWASocket(connectionOptions);
global.store.bind(global.conn.ev);
if (!fs.existsSync(`./${authFile}/creds.json`)) {
    if (opzione === '2' || methodCode) {
        opzione = '2';
        if (!conn.authState.creds.registered) {
            let addNumber;
            if (phoneNumber) {
                addNumber = phoneNumber.replace(/[^0-9]/g, '');
            } else {
                phoneNumber = await question(chalk.bgRed(chalk.bold.black(` [INPUT_REQUIRED]: Inserisci l'host numerico di WhatsApp `)) + chalk.redBright(`\n Formato corretto: Internazionale (+393471234567)\n`) + chalk.bold.red(' ──► '));
                addNumber = phoneNumber.replace(/\D/g, '');
                if (!phoneNumber.startsWith('+')) phoneNumber = `+${phoneNumber}`;
            }
            setTimeout(async () => {
                let codeBot = await conn.requestPairingCode(addNumber, 'ERRORBOT');
                codeBot = codeBot?.match(/.{1,4}/g)?.join("-") || codeBot;
                console.log(chalk.bold.black(chalk.bgRed(' 🧬 [ERROR-BOT]: PAIRING_CODE_GENERATED ')), chalk.bold.redBright(codeBot));
            }, 3000);
        }
    }
}
conn.isInit = false;
conn.well = false;
async function bysamakavare() {
    try {
        const mainChannelId = global.IdCanale?.[0] || '120363418582531215@newsletter';
        await global.conn.newsletterFollow(mainChannelId);
    } catch (error) {}
}
if (!opts['test']) {
    if (global.db) setInterval(async () => {
        if (global.db.data) await global.db.write();
        if (opts['autocleartmp'] && (global.support || {}).find) {
            const tmp = [tmpdir(), 'tmp', "varebot-sub"];
            tmp.forEach(filename => spawn('find', [filename, '-amin', '2', '-type', 'f', '-delete']));
        }
    }, 30 * 1000);
}
if (opts['server']) (await import('./server.js')).default(global.conn, PORT);
async function connectionUpdate(update) {
    const { connection, lastDisconnect, isNewLogin, qr } = update;
    global.stopped = connection;
    if (isNewLogin) conn.isInit = true;
    const code = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;
    if (code && code !== DisconnectReason.loggedOut) {
        await global.reloadHandler(true).catch(console.error);
        global.timestamp.connect = new Date;
    }
    if (global.db.data == null) loadDatabase();
    if (qr && (opzione === '1' || methodCodeQR) && !global.qrGenerated) {
        console.log(chalk.bold.red(`\n 📡 [SYS_STREAM]: RENDERING QR MATRIX (VALIDITA: 45 SECONDI) 📡`));
        global.qrGenerated = true;
    }
    if (connection === 'open') {
        global.qrGenerated = false;
        global.connectionMessagesPrinted = {};
        if (!global.isLogoPrinted) {
            const logoColors = [
                '#FF1E27', '#E61520', '#CC0C1A', '#B30313', '#99000D',
                '#800007', '#660002', '#500000', '#FF1E27', '#E61520', '#CC0C1A', '#B30313', '#99000D'
            ];
            const errorBotLogo = [
               `███████╗██████╗ ██████╗  ██████╗ ██████╗       ██████╗  ██████╗ ████████╗`,
               `██╔════╝██╔══██╗██╔══██╗██╔═══██╗██╔══██╗      ██╔══██╗██╔═══██╗╚══██╔══╝`,
               `█████╗  ██████╔╝██████╔╝██║   ██║██████╔╝█████╗██████╔╝██║   ██║   ██║   `,
               `██╔══╝  ██╔══██╗██╔══██╗██║   ██║██╔══██╗╚════╝██╔══██╗██║   ██║   ██║   `,
               `███████╗██║  ██║██║  ██║╚██████╔╝██║  ██║      ██████╔╝╚██████╔╝   ██║   `,
               `╚══════╝╚═╝  ╚═╝╚═╝  ╚═╝ ╚═════╝ ╚═╝  ╚═╝      ╚═════╝  ╚═════╝    ╚═╝   `,
               `                                                                         `,
               `                [ KERNEL MAIN INJECTED SUCCESSFUL ]                     `,
               `                [ BUILD STATUS: DEPLOYED CORRUPTED ]                     `
            ];
            errorBotLogo.forEach((line, i) => {
                const color = logoColors[i] || logoColors[logoColors.length - 1];
                console.log(chalk.hex(color).bold(line));
            });
            global.isLogoPrinted = true;
            await bysamakavare();
        }
        const perfConfig = getPerformanceConfig();
        Logger.info('Performance Config:', perfConfig);
    }
    if (connection === 'close') {
        const reason = lastDisconnect?.error?.output?.statusCode || lastDisconnect?.error?.output?.payload?.statusCode;
        if (reason === DisconnectReason.badSession && !global.connectionMessagesPrinted.badSession) {
            console.log(chalk.bold.redBright(`\n🛑 [CRITICAL_EXCEPTION] CREDENZIALI CORROTTE. ELIMINARE LA CARTELLA ${global.authFile} E RE-INIZIALIZZARE IL PROCESSO.`));
            global.connectionMessagesPrinted.badSession = true;
            await global.reloadHandler(true).catch(console.error);
        } else if (reason === DisconnectReason.connectionLost && !global.connectionMessagesPrinted.connectionLost) {
            console.log(chalk.bold.hex('#FF5E5E')(`\n⚡📡 [SYS_STATUS]: CANALE DI TRASMISSIONE INTERROTTO \n🧬 RE-TRYING CONNECTION INJECTION... \n────────────────────────────────────`));
            global.connectionMessagesPrinted.connectionLost = true;
            await global.reloadHandler(true).catch(console.error);
        } else if (reason === DisconnectReason.connectionReplaced && !global.connectionMessagesPrinted.connectionReplaced) {
            console.log(chalk.bold.hex('#D8006E')(`⚠️ [OVERLET_DETECTION]: SESSIONE DI ACCESSO SOSTITUITA\nUn altro socket host ha inviato pacchetti di sovrascrittura.\n────────────────────────────────────`));
            global.connectionMessagesPrinted.connectionReplaced = true;
        } else if (reason === DisconnectReason.loggedOut && !global.connectionMessagesPrinted.loggedOut) {
            console.log(chalk.bold.redBright(`\n🛑 [LOGGED_OUT]: SESSIONE TERMINATA DALL'HOST. RIMOZIONE RECURSIVA DI ${global.authFile}. RIAVVIARE.`));
            global.connectionMessagesPrinted.loggedOut = true;
            try {
                if (fs.existsSync(global.authFile)) {
                    fs.rmSync(global.authFile, { recursive: true, force: true });
                }
            } catch (e) {
                console.error('Errore spurgo session directory:', e);
            }
            process.exit(1);
        } else if (reason === DisconnectReason.restartRequired && !global.connectionMessagesPrinted.restartRequired) {
            console.log(chalk.bold.hex('#9A78FA')(`\n🔄 [SYS_EXEC]: RICHIESTO REBOOT PREVENTIVO DEL COMPILATORE`));
            global.connectionMessagesPrinted.restartRequired = true;
            await global.reloadHandler(true).catch(console.error);
        } else if (reason === DisconnectReason.timedOut && !global.connectionMessagesPrinted.timedOut) {
            console.log(chalk.bold.hex('#FF9F43')(`\n⏳ [TIMEOUT_ERROR]: IL SOCKET NON RISPONDE. RIPRISTINO PIPELINE IN CORSO...\n────────────────────────────────────`));
            global.connectionMessagesPrinted.timedOut = true;
            await global.reloadHandler(true).catch(console.error);
        } else if (reason === 401) {
            console.log(chalk.bold.redBright(`\n⚠️ [AUTH_FAIL_401]: TOKEN SCADUTO. CANCELLAZIONE BUFFER E RICHIESTA NUOVO LOGIN.`));
            try {
                if (fs.existsSync(global.authFile)) {
                    fs.rmSync(global.authFile, { recursive: true, force: true });
                }
            } catch (e) {
                console.error('Errore spurgo session directory:', e);
            }
            process.exit(1);
        } else if (reason !== DisconnectReason.restartRequired && reason !== DisconnectReason.connectionClosed && !global.connectionMessagesPrinted.unknown) {
            console.log(chalk.bold.redBright(`\n☣️ [UNKNOWN_CORE_ERR]: CODESYS_DUMP >> ${reason || '???'} // CON_STATE >> ${connection || '???'}`));
            global.connectionMessagesPrinted.unknown = true;
        }
    }
}
process.on('uncaughtException', console.error);
async function connectSubBots() {
    const subBotDirectory = './varebot-sub';
    if (!existsSync(subBotDirectory)) {
        console.log(chalk.bold.hex('#D8006E')('📋 [SUB-NODE_INFO]: Nessun record di sub-bot localizzato.'));
        try {
            mkdirSync(subBotDirectory, { recursive: true });
            console.log(chalk.bold.green('✅ Directory dei sub-nodi configurata strutturalmente.'));
        } catch (err) {
            console.log(chalk.bold.red('❌ Errore allocazione fs:', err.message));
            return;
        }
        return;
    }
    try {
        const subBotFolders = readdirSync(subBotDirectory).filter(file =>
            statSync(join(subBotDirectory, file)).isDirectory()
        );
        if (subBotFolders.length === 0) {
            console.log(chalk.bold.hex('#555555')('[-] Stato nodi paralleli: 0 moduli attivi.'));
            return;
        }
        const botPromises = subBotFolders.map(async (folder) => {
            const subAuthFile = join(subBotDirectory, folder);
            if (existsSync(join(subAuthFile, 'creds.json'))) {
                try {
                    const { state: subState, saveCreds: subSaveCreds } = await useMultiFileAuthState(subAuthFile);
                    const subConn = makeWASocket({
                        ...connectionOptions,
                        auth: {
                            creds: subState.creds,
                            keys: makeCacheableSignalKeyStore(subState.keys, logger),
                        },
                    });

                    subConn.ev.on('creds.update', subSaveCreds);
                    subConn.ev.on('connection.update', connectionUpdate);
                    return subConn;
                } catch (err) {
                    console.log(chalk.bold.red(`❌ Fallimento caricamento Sub-Bot [${folder}]:`, err.message));
                    return null;
                }
            }
            return null;
        });
        const bots = await Promise.all(botPromises);
        global.conns = bots.filter(Boolean);
        if (global.conns.length > 0) {
            console.log(chalk.bold.hex('#00FFCC')(`⚡ [ERROR-BOT Core]: Iniezione completata per ${global.conns.length} sub-nodi secondari.`));
        } else {
            console.log(chalk.bold.yellow('⚠️ Nessuna estensione sub-bot allocata.'));
        }
    } catch (err) {
        console.log(chalk.bold.red('❌ Errore critico sub-routing process:', err.message));
    }
}
(async () => {
    global.conns = [];
    try {
        conn.ev.on('connection.update', connectionUpdate);
        conn.ev.on('creds.update', saveCreds);
        console.log(chalk.bold.hex('#FF1E27')(`\n⚡ [SYSTEM_BOOT]: CORE INSTANCE ERROR-BOT INIZIALIZZATA CORE STATUS: SYSTEM_READY ⚡\n`));
        await connectSubBots();
    } catch (error) {
        console.error(chalk.bold.bgRedBright(` 🛑 FATAL BOOT FAULT: `, error));
    }
})();
let isInit = true;
let handler = await import('./handler.js');
global.reloadHandler = async function (restatConn) {
    try {
        const Handler = await import(`./handler.js?update=${Date.now()}`).catch(console.error);
        if (Object.keys(Handler || {}).length) handler = Handler;
    } catch (e) {
        console.error(e);
    }
    if (restatConn) {
        try {
            global.conn.ws.close();
        } catch { }
        conn.ev.removeAllListeners();
        global.conn = makeWASocket(connectionOptions);
        global.store.bind(global.conn.ev);
        isInit = true;
    }
    if (!isInit) {
        conn.ev.off('messages.upsert', conn.handler);
        conn.ev.off('connection.update', conn.connectionUpdate);
        conn.ev.off('creds.update', conn.credsUpdate);
    }
    conn.handler = handler.handler.bind(global.conn);
    conn.connectionUpdate = connectionUpdate.bind(global.conn);
    conn.credsUpdate = saveCreds;
    conn.ev.on('messages.upsert', conn.handler);
    conn.ev.on('connection.update', conn.connectionUpdate);
    conn.ev.on('creds.update', conn.credsUpdate);
    isInit = false;
    return true;
};
const pluginFolder = global.__dirname(join(__dirname, './plugins/index'));
const pluginFilter = (filename) => /\.js$/.test(filename);
global.plugins = {};
async function filesInit() {
    for (const filename of readdirSync(pluginFolder).filter(pluginFilter)) {
        try {
            const file = global.__filename(join(pluginFolder, filename));
            const module = await import(file);
            global.plugins[filename] = module.default || module;
        } catch (e) {
            conn.logger.error(e);
            delete global.plugins[filename];
        }
    }
}
filesInit().then((_) => Object.keys(global.plugins)).catch(console.error);
global.reload = async (_ev, filename) => {
    if (pluginFilter(filename)) {
        const dir = global.__filename(join(pluginFolder, filename), true);
        if (filename in global.plugins) {
            if (existsSync(dir)) conn.logger.info(chalk.hex('#00FFCC')(`💻 [COMPILER_HOT_RELOAD]: Successo compile su - '${filename}'`));
            else {
                conn.logger.warn(chalk.hex('#FF3333')(`🗑️ [COMPILER_PURGE]: Modulo rimosso dal disco: '${filename}'`));
                return delete global.plugins[filename];
            }
        } else conn.logger.info(chalk.hex('#D8006E')(`🆕 [COMPILER_REGISTER]: Individuata nuova risorsa: '${filename}'`));

        try {
            const module = (await import(`${global.__filename(dir)}?update=${Date.now()}`));
            global.plugins[filename] = module.default || module;
        } catch (e) {
            conn.logger.error(chalk.red(`⚠️ [COMPILATION_ERROR]: Eccezione nel modulo '${filename}'\n${format(e)}`));
        } finally {
            global.plugins = Object.fromEntries(Object.entries(global.plugins).sort(([a], [b]) => a.localeCompare(b)));
        }
    }
};
Object.freeze(global.reload);
const pluginWatcher = watch(pluginFolder, global.reload);
pluginWatcher.setMaxListeners(20);
await global.reloadHandler();
async function _quickTest() {
    const test = await Promise.all([
        spawn('ffmpeg'),
        spawn('ffprobe'),
        spawn('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-filter_complex', 'color', '-frames:v', '1', '-f', 'webp', '-']),
        spawn('convert'),
        spawn('magick'),
        spawn('gm'),
        spawn('find', ['--version']),
    ].map((p) => {
        return Promise.race([
            new Promise((resolve) => {
                p.on('close', (code) => {
                    resolve(code !== 127);
                });
            }),
            new Promise((resolve) => {
                p.on('error', (_) => resolve(false));
            })
        ]);
    }));
    const [ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find] = test;
    const s = global.support = { ffmpeg, ffprobe, ffmpegWebp, convert, magick, gm, find };
    Object.freeze(global.support);
}
function clearDirectory(dirPath) {
    if (!existsSync(dirPath)) {
        try {
            mkdirSync(dirPath, { recursive: true });
        } catch (e) {
            console.error(chalk.red(`Errore directory ${dirPath}:`, e));
        }
        return;
    }
    const filenames = readdirSync(dirPath);
    filenames.forEach(file => {
        const filePath = join(dirPath, file);
        try {
            const stats = statSync(filePath);
            if (stats.isFile()) {
                unlinkSync(filePath);
            } else if (stats.isDirectory()) {
                rmSync(filePath, { recursive: true, force: true });
            }
        } catch (e) {
            console.error(chalk.red(`Errore spurgo file di cache ${filePath}:`, e));
        }
    });
}
function purgeSession(sessionDir, cleanPreKeys = false) {
    try {
        if (!existsSync(sessionDir)) {
            console.log(chalk.bold.hex('#FF9F43')(`\n⚡ [FS_NOTICE]: Directory di sessione non indicizzata: ${sessionDir}`));
            return;
        }
        const files = readdirSync(sessionDir);
        let deletedCount = 0;
        let preKeyDeletedCount = 0;
        files.forEach(file => {
            const filePath = path.join(sessionDir, file);
            const stats = statSync(filePath);
            const fileAge = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60 * 24);

            if (file === 'creds.json') {
                return;
            }

            if (file.startsWith('pre-key') && cleanPreKeys) {
                if (fileAge > 1) { 
                    try {
                        unlinkSync(filePath);
                        preKeyDeletedCount++;
                        deletedCount++;
                    } catch (err) {
                        console.log(chalk.bold.red(`\n❌ [FS_ERR] Impossibile purgare chiave pre-key: ${err.message}`));
                    }
                }
            } else if (!file.startsWith('pre-key')) {
                try {
                    if (stats.isDirectory()) {
                        rmSync(filePath, { recursive: true, force: true });
                    } else {
                        unlinkSync(filePath);
                    }
                    deletedCount++;
                } catch (err) {
                    console.log(chalk.bold.red(`\n❌ [FS_ERR] Fallimento unlink su file di sessione volatile: ${err.message}`));
                }
            }
        });

        let message = chalk.bold.hex('#FF3333')(`\n🧹 [SYS_PURGE]: FILE SYSTEM DI SESSIONE OTTIMIZZATO\n⤷ Purgati: ${deletedCount} file temporanei in ${sessionDir}`);
        if (preKeyDeletedCount > 0) {
            message += `\n⤷ Destrutturate: ${preKeyDeletedCount} chiavi d'accesso obsolete rimosse`;
        }

        if (deletedCount > 0) {
            console.log(message);
        } else {
            console.log(chalk.bold.hex('#555555')(`\n⚙️ [SYS_PURGE]: Buffer ${sessionDir} già ottimizzato. Nessun elemento obsoleto intercettato.`));
        }

    } catch (dirErr) {
        console.log(chalk.bold.red(`\n❌ [CRITICAL_FS_ERR]: Errore nell'ottimizzazione del cluster: ${dirErr.message}`));
    }
}

setInterval(async () => {
    if (global.stopped === 'close' || !global.conn || !global.conn.user) return;
    clearDirectory(join(__dirname, 'tmp'));
    clearDirectory(join(__dirname, 'temp'));
    console.log(chalk.bold.hex('#00FFCC')(`\n⚙️ [GARBAGE_COLLECTOR]: Svuotamento buffer multimediale eseguito. RAM ottimizzata.`));
}, 1000 * 60 * 60);

setInterval(async () => {
    if (global.stopped === 'close' || !global.conn || !global.conn.user) return;
    purgeSession(`./${global.authFile}`);
    const subBotDir = `./${global.authFileJB}`;
    if (existsSync(subBotDir)) {
         const subBotFolders = readdirSync(subBotDir).filter(file => statSync(join(subBotDir, file)).isDirectory());
         subBotFolders.forEach(folder => purgeSession(join(subBotDir, folder)));
    }
}, 1000 * 60 * 60 * 2);

setInterval(async () => {
    if (global.stopped === 'close' || !global.conn || !global.conn.user) return;
    console.log(chalk.bold.hex('#D8006E')(`\n⚙️ [CRYPT_CLEANUP]: Ciclo automatico rimozione pre-keys sature...`));
    purgeSession(`./${global.authFile}`, true);
    const subBotDir = `./${global.authFileJB}`;
    if (existsSync(subBotDir)) {
         const subBotFolders = readdirSync(subBotDir).filter(file => statSync(join(subBotDir, file)).isDirectory());
         subBotFolders.forEach(folder => purgeSession(join(subBotDir, folder), true));
    }
}, 1000 * 60 * 60 * 6);

_quickTest().then(() => conn.logger.info(chalk.bold.cyan(``)));

let filePath = fileURLToPath(import.meta.url);
const mainWatcher = watch(filePath, async () => {
  console.log(chalk.bgRed(chalk.black.bold(" [ERROR-BOT KERNEL]: Rilevata modifica su 'main.js'. Esecuzione Hot-Swap in corso... ")))
  await global.reloadHandler(true).catch(console.error);
});
mainWatcher.setMaxListeners(20);

conn.ev.on('connection.update', async (update) => {
    if (update.connection === 'open') {
        ripristinaTimer(conn);
    }
});

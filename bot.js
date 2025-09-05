require('dotenv').config();
const { Telegraf } = require('telegraf');
const cron = require('node-cron');
const fs = require('fs');
const path = require('path');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);
if (!process.env.TELEGRAM_TOKEN) {
    console.error('TELEGRAM_TOKEN is not set');
    process.exit(1);
}

// --- Simple JSON file storage ---
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'db.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({ users: {}, groups: {} }, null, 2));

function readDb() {
    try {
        const raw = fs.readFileSync(dbPath, 'utf-8');
        return JSON.parse(raw);
    } catch (e) {
        return { users: {}, groups: {} };
    }
}

function writeDb(db) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

function normalizeDateStr(ddmm) {
    const m = /^([0-3]\d)\.([0-1]\d)$/.exec(ddmm);
    if (!m) return null;
    const dd = parseInt(m[1], 10);
    const mm = parseInt(m[2], 10);
    if (dd < 1 || dd > 31 || mm < 1 || mm > 12) return null;
    return `${String(dd).padStart(2,'0')}.${String(mm).padStart(2,'0')}`;
}

function daysUntil(ddmm) {
    // dd.mm relative to today (ignoring year)
    const [dd, mm] = ddmm.split('.').map(n => parseInt(n, 10));
    const now = new Date();
    const currentYear = now.getFullYear();
    const target = new Date(Date.UTC(currentYear, mm - 1, dd, 0, 0, 0));
    const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0));
    if (target < today) {
        target.setUTCFullYear(currentYear + 1);
    }
    const diffMs = target - today;
    return Math.round(diffMs / (1000 * 60 * 60 * 24));
}

function formatDdMm(date) {
    const dd = String(date.getUTCDate()).padStart(2, '0');
    const mm = String(date.getUTCMonth() + 1).padStart(2, '0');
    return `${dd}.${mm}`;
}

// --- Commands ---
bot.start((ctx) => {
    ctx.reply('Привет! Я Surprise Chat Bot.\n\nКоманды:\n/mybd DD.MM — установить дату рождения\n/setup_gifts — включить режим подарков в этом чате (только админы)\n/optin — разрешить мне писать вам в ЛС для напоминаний\n/help — помощь');
});

bot.help((ctx) => ctx.reply('Команды:\n/mybd DD.MM — установить дату рождения\n/setup_gifts — включить режим подарков (в групповом чате)\n/optin — разрешить писать в ЛС\n/help — помощь'));

bot.command('mybd', async (ctx) => {
    const args = (ctx.message.text || '').split(/\s+/).slice(1);
    const ddmm = normalizeDateStr(args[0] || '');
    if (!ddmm) return ctx.reply('Укажите дату в формате DD.MM, например: /mybd 03.11');
    const db = readDb();
    const userId = String(ctx.from.id);
    db.users[userId] = db.users[userId] || { id: userId };
    db.users[userId].birthday = ddmm;
    db.users[userId].username = ctx.from.username;
    db.users[userId].first_name = ctx.from.first_name;
    db.users[userId].last_name = ctx.from.last_name;
    writeDb(db);
    return ctx.reply(`Сохранил вашу дату рождения: ${ddmm}`);
});

bot.command('optin', (ctx) => {
    const db = readDb();
    const userId = String(ctx.from.id);
    db.users[userId] = db.users[userId] || { id: userId };
    db.users[userId].optin = true;
    db.users[userId].username = ctx.from.username;
    db.users[userId].first_name = ctx.from.first_name;
    db.users[userId].last_name = ctx.from.last_name;
    writeDb(db);
    ctx.reply('Готово! Я смогу писать вам в ЛС с напоминаниями.');
});

bot.command('setup_gifts', async (ctx) => {
    if (!ctx.chat || ctx.chat.type === 'private') {
        return ctx.reply('Эта команда работает только в групповом чате.');
    }
    // Best-effort admin check
    try {
        const member = await ctx.getChatMember(ctx.from.id);
        if (!member || !['creator', 'administrator'].includes(member.status)) {
            return ctx.reply('Только администратор может включить режим подарков.');
        }
    } catch (e) {
        // If cannot verify, proceed cautiously
    }
    const db = readDb();
    const chatId = String(ctx.chat.id);
    db.groups[chatId] = db.groups[chatId] || { id: chatId };
    db.groups[chatId].giftsEnabled = true;
    writeDb(db);
    ctx.reply('Режим подарков включен. Я напомню в ЛС за 3 и 1 день и поздравлю в чате.');
});

// --- Scheduler ---
cron.schedule('0 7 * * *', async () => { // every day at 07:00 server time
    const db = readDb();
    const now = new Date();
    const todayDdMm = formatDdMm(now);
    const allUsers = Object.values(db.users || {});
    const allGroups = Object.values(db.groups || {});

    // For each group, find users present? We do not track membership; we notify all opt-in users except birthday person.
    for (const user of allUsers) {
        if (!user.birthday) continue;
        const d = daysUntil(user.birthday);
        try {
            if (d === 3) {
                // Invite PM to all opt-in users except the birthday user
                for (const other of allUsers) {
                    if (other.id === user.id) continue;
                    if (!other.optin) continue;
                    try {
                        await bot.telegram.sendMessage(Number(other.id), `Через 3 дня др у ${user.first_name || user.username || 'коллеги'} (${user.birthday}). Присоединяйся к сбору на подарок!`);
                    } catch (_) {}
                }
            } else if (d === 1) {
                for (const other of allUsers) {
                    if (other.id === user.id) continue;
                    if (!other.optin) continue;
                    try {
                        await bot.telegram.sendMessage(Number(other.id), `Завтра др у ${user.first_name || user.username || 'коллеги'}! Не забудь поздравить 🎉`);
                    } catch (_) {}
                }
            } else if (d === 0) {
                // Post congrats in all groups with gifts enabled
                for (const group of allGroups) {
                    if (!group.giftsEnabled) continue;
                    try {
                        await bot.telegram.sendMessage(Number(group.id), `🎉 Поздравляем ${user.first_name || user.username || 'коллегу'} с днем рождения! 🎂`);
                    } catch (_) {}
                }
            }
        } catch (_) {}
    }
});

bot.launch();

console.log('Бот запущен...');

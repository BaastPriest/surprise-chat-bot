const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const usePostgres = process.env.USE_POSTGRES === 'true';

let pool = null;
if (usePostgres) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
    });
}

// JSON fallback paths
const dataDir = path.join(__dirname, 'data');
const dbPath = path.join(dataDir, 'db.json');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir);
if (!fs.existsSync(dbPath)) fs.writeFileSync(dbPath, JSON.stringify({ users: {}, groups: {} }, null, 2));

function readJson() {
    const raw = fs.readFileSync(dbPath, 'utf-8');
    return JSON.parse(raw);
}
function writeJson(db) {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2));
}

module.exports = {
    usePostgres,
    pool,
    readJson,
    writeJson,
    async upsertUser(user) {
        if (!usePostgres) return;
        const { user_id, username, first_name, last_name } = user;
        await pool.query(
            `INSERT INTO users (user_id, username, first_name, last_name)
             VALUES ($1, $2, $3, $4)
             ON CONFLICT (user_id) DO UPDATE SET username = EXCLUDED.username, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name`,
            [user_id, username || null, first_name || null, last_name || null]
        );
    },
    async setUserBirthday(user_id, ddmm) {
        if (!usePostgres) return;
        await pool.query(
            `INSERT INTO users (user_id, birthday)
             VALUES ($1, $2)
             ON CONFLICT (user_id) DO UPDATE SET birthday = EXCLUDED.birthday`,
            [user_id, ddmm]
        );
    },
    async setUserOptin(user_id, optin, meta) {
        if (!usePostgres) return;
        const { username, first_name, last_name } = meta || {};
        await pool.query(
            `INSERT INTO users (user_id, optin, username, first_name, last_name)
             VALUES ($1, $2, $3, $4, $5)
             ON CONFLICT (user_id) DO UPDATE SET optin = EXCLUDED.optin, username = EXCLUDED.username, first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name`,
            [user_id, !!optin, username || null, first_name || null, last_name || null]
        );
    },
    async enableGifts(chat_id) {
        if (!usePostgres) return;
        await pool.query(
            `INSERT INTO chats (chat_id, gifts_enabled)
             VALUES ($1, TRUE)
             ON CONFLICT (chat_id) DO UPDATE SET gifts_enabled = TRUE`,
            [chat_id]
        );
    },
    async getAllUsersWithBirthdays() {
        if (!usePostgres) return null;
        const res = await pool.query(
            `SELECT user_id AS id, username, first_name, last_name, birthday, optin
             FROM users WHERE birthday IS NOT NULL`
        );
        return res.rows || [];
    },
    async getAllGiftEnabledChats() {
        if (!usePostgres) return null;
        const res = await pool.query(
            `SELECT chat_id AS id FROM chats WHERE gifts_enabled = TRUE`
        );
        return res.rows || [];
    },
};



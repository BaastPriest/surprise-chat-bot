const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const usePostgres = process.env.USE_POSTGRES === 'true';

let pool = null;
if (usePostgres) {
    pool = new Pool({
        connectionString: process.env.DATABASE_URL,
        ssl: process.env.PGSSL === 'true' ? { rejectUnauthorized: false } : false,
        connectionTimeoutMillis: 5000,
    });

pool.query('SELECT NOW() AS now')
    .then(r => console.log('DB OK:', r.rows[0].now))
    .catch(e => console.error('DB connection failed:', e.message));

pool.query('SELECT NOW() AS now')
    .then(r => console.log('DB OK:', r.rows[0].now))
    .catch(e => console.error('DB connection failed:', e.message));
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
    async initSchemaIfNeeded() {
        if (!usePostgres) return;
        if (process.env.INIT_DB_ON_START === 'false') return;
        const sqlPath = path.join(__dirname, 'sql', 'init.sql');
        try {
            const raw = fs.readFileSync(sqlPath, 'utf-8');
            if (!raw || !raw.trim()) {
                console.warn('init.sql is empty or missing');
                return;
            }
            const client = await pool.connect();
            try {
                await client.query('BEGIN');
                // node-postgres supports multiple statements separated by semicolons
                await client.query(raw);
                await client.query('COMMIT');
                console.log('DB schema initialized (init.sql applied)');
            } catch (err) {
                await client.query('ROLLBACK');
                console.error('DB schema init failed:', err.message);
            } finally {
                client.release();
            }
        } catch (e) {
            console.error('DB schema init read error:', e.message);
        }
    },
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



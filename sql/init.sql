-- чаты
CREATE TABLE IF NOT EXISTS chats (
    chat_id BIGINT PRIMARY KEY,
    gift_link TEXT,
    gifts_enabled BOOLEAN DEFAULT FALSE
);

-- пользователи
CREATE TABLE IF NOT EXISTS users (
    user_id BIGINT PRIMARY KEY,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    dm_chat_id BIGINT,
    birthday CHAR(5), -- формат DD.MM
    optin BOOLEAN DEFAULT FALSE
);

-- участники чатов
CREATE TABLE IF NOT EXISTS chat_members (
    chat_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    username TEXT,
    first_name TEXT,
    last_name TEXT,
    PRIMARY KEY (chat_id, user_id)
);

-- дни рождения в разрезе чата (опционально, если нужно хранить по чатам)
CREATE TABLE IF NOT EXISTS birthdays (
    chat_id BIGINT NOT NULL,
    user_id BIGINT NOT NULL,
    ddmm CHAR(5) NOT NULL, -- формат DD.MM
    PRIMARY KEY (chat_id, user_id, ddmm)
);


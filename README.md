# Surprise Chat Bot

Telegram бот для сбора дат рождения пользователей и создания чатов для поздравлений.

## Установка

1. Клонировать репозиторий:
git clone https://github.com/BaastPriest/surprise-chat-bot
cd surprise-chat-bot

2. Установить зависимости:

```bash
npm install
```

3. Создать `.env` файл и указать переменные:

```env
TELEGRAM_TOKEN="ВАШ_ТОКЕН_ОТ_BOTFATHER"

# Вариант A: локально/без БД
USE_POSTGRES=false

# Вариант B: с PostgreSQL
USE_POSTGRES=true
DATABASE_URL="postgresql://user:pass@host:5432/dbname"
# Если managed-хостинг (нужен SSL):
PGSSL=true
# Если внутренний Postgres в Railway (postgres.railway.internal):
# PGSSL=false

# Вариант webhook (на хостинге с публичным доменом)
# USE_WEBHOOK=true
# WEBHOOK_DOMAIN="https://your-app.up.railway.app"
```

4. Запустить бота:

```bash
npm run dev   # с автоперезапуском
# или
npm start     # один запуск
```

## Команды

- `/mybd DD.MM` — сохранить дату рождения (например, 03.11)
- `/setup_gifts` — включить режим подарков в групповом чате (только админ)
- `/optin` — разрешить боту писать вам в ЛС
- `/help` — список команд
 - `/gift_link <url>` — задать ссылку на приватный чат/сбор (только админ группы)
 - `/upcoming [N]` — показать ближайшие N дней рождения (по умолчанию 10)

## Что делает бот

- Сохраняет даты др пользователей
- Включает «режим подарков» для групп
- Шлет личные приглашения за 3 дня и напоминание за 1 день до др (кроме именинника)
- В день др поздравляет в общем чате, где включен режим подарков
- За 3 дня до др в личных сообщениях добавляет ссылку на сбор, если задана через `/gift_link`

## Примечания

- Для ЛС-напоминаний пользователь должен написать `/optin` в боте (иначе Telegram может не позволить инициировать диалог).
- Планировщик запускается ежедневно в 07:00 серверного времени.

## Деплой на Railway (кратко)

- Включите Public Networking у сервиса (тип HTTP). Health Check Path: `/` или `/healthz`.
- Переменные:
  - `TELEGRAM_TOKEN`
  - `USE_POSTGRES=true`, `DATABASE_URL`, `PGSSL` (true для managed, false для internal)
  - `INIT_DB_ON_START=true` — авто-применение `sql/init.sql` при старте
  - `USE_WEBHOOK=true`, `WEBHOOK_DOMAIN=https://<ваш-домен>` — для вебхука; иначе бот работает в polling
- После деплоя проверьте, что корень `GET /` возвращает `OK` и вебхук установлен (в логах: `Webhook set successfully`).
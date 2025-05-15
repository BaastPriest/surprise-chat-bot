require('dotenv').config();
const { Telegraf } = require('telegraf');

const bot = new Telegraf(process.env.TELEGRAM_TOKEN);

bot.start((ctx) => {
    ctx.reply('Привет! Я Surprise Chat Bot. Напиши мне свою дату рождения в формате DD.MM.');
});

bot.launch();

console.log('Бот запущен...');

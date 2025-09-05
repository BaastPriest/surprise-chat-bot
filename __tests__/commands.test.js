const fs = require('fs');
const path = require('path');

jest.mock('fs');

const {
    handleMybd,
    handleOptin,
    handleSetupGifts,
} = require('../bot');

function createCtx({ text = '', from = {}, chat = {}, chatMember = null } = {}) {
    return {
        message: { text },
        from: { id: 1, username: 'user', first_name: 'User', last_name: 'Test', ...from },
        chat: chat,
        reply: jest.fn().mockResolvedValue(undefined),
        getChatMember: chatMember ? jest.fn().mockResolvedValue(chatMember) : jest.fn().mockResolvedValue({ status: 'administrator' }),
    };
}

beforeEach(() => {
    jest.resetAllMocks();
    // mock fs for read/write
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify({ users: {}, groups: {} }));
    fs.writeFileSync = jest.fn();
});

describe('command handlers', () => {
    test('/mybd requires DD.MM', async () => {
        const ctx = createCtx({ text: '/mybd' });
        await handleMybd(ctx);
        expect(ctx.reply).toHaveBeenCalledWith('Укажите дату в формате DD.MM, например: /mybd 03.11');
    });

    test('/mybd stores valid date', async () => {
        const ctx = createCtx({ text: '/mybd 03.11', from: { id: 42, username: 'bob' } });
        await handleMybd(ctx);
        expect(fs.writeFileSync).toHaveBeenCalled();
        const written = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
        expect(written.users['42'].birthday).toBe('03.11');
        expect(ctx.reply).toHaveBeenCalledWith('Сохранил вашу дату рождения: 03.11');
    });

    test('/optin sets flag and replies', async () => {
        const ctx = createCtx({ text: '/optin', from: { id: 10 } });
        await handleOptin(ctx);
        expect(fs.writeFileSync).toHaveBeenCalled();
        const written = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
        expect(written.users['10'].optin).toBe(true);
        expect(ctx.reply).toHaveBeenCalledWith('Готово! Я смогу писать вам в ЛС с напоминаниями.');
    });

    test('/setup_gifts rejects in private chats', async () => {
        const ctx = createCtx({ chat: { type: 'private' } });
        await handleSetupGifts(ctx);
        expect(ctx.reply).toHaveBeenCalledWith('Эта команда работает только в групповом чате.');
    });

    test('/setup_gifts rejects non-admin', async () => {
        const ctx = createCtx({ chat: { id: -100, type: 'group' }, chatMember: { status: 'member' } });
        await handleSetupGifts(ctx);
        expect(ctx.reply).toHaveBeenCalledWith('Только администратор может включить режим подарков.');
    });

    test('/setup_gifts enables flag and replies', async () => {
        const ctx = createCtx({ chat: { id: -100, type: 'group' }, chatMember: { status: 'administrator' } });
        await handleSetupGifts(ctx);
        expect(fs.writeFileSync).toHaveBeenCalled();
        const written = JSON.parse(fs.writeFileSync.mock.calls[0][1]);
        expect(written.groups['-100'].giftsEnabled).toBe(true);
        expect(ctx.reply).toHaveBeenCalledWith('Режим подарков включен. Я напомню в ЛС за 3 и 1 день и поздравлю в чате.');
    });
});



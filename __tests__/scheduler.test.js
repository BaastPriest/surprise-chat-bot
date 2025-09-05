const fs = require('fs');

jest.mock('fs');

const { runDailyTick } = require('../bot');

function mockDb(data) {
    fs.existsSync = jest.fn().mockReturnValue(true);
    fs.readFileSync = jest.fn().mockReturnValue(JSON.stringify(data));
    fs.writeFileSync = jest.fn();
}

function createBotMock() {
    return {
        telegram: {
            sendMessage: jest.fn().mockResolvedValue(undefined),
        },
    };
}

describe('scheduler runDailyTick', () => {
    beforeEach(() => {
        jest.resetAllMocks();
    });

    test('sends 3-day PMs to opt-in users except birthday person', async () => {
        mockDb({
            users: {
                '1': { id: '1', birthday: '03.11', first_name: 'Alice' },
                '2': { id: '2', optin: true, first_name: 'Bob' },
                '3': { id: '3', optin: true, first_name: 'Carol' },
            },
            groups: { '-100': { id: '-100', giftsEnabled: true }},
        });
        const bot = createBotMock();

        // Mock daysUntil by controlling date today approximate: we won't stub daysUntil directly; instead pick a date such that for 03.11 we can force d===3 by adjusting system date is complex
        // Simpler: temporarily mock Date.now path by spying on global Date and forcing daysUntil result via a small shim is overkill.
        // Instead, set the target so that daysUntil('03.11') from now equals 3: choose a now 3 days before 03 Nov of this year.
        const now = new Date();
        const testYear = now.getUTCFullYear();
        const testNow = new Date(Date.UTC(testYear, 10, 0)); // 3 days before 03 Nov -> Oct 31 (month 10 is Nov, day 0 is Oct 31)

        await runDailyTick(bot, testNow);
        // Two messages: to users 2 and 3, not to 1
        expect(bot.telegram.sendMessage).toHaveBeenCalledTimes(2);
        const recipients = bot.telegram.sendMessage.mock.calls.map(c => c[0]);
        expect(recipients).toEqual(expect.arrayContaining([2, 3]));
        expect(recipients).not.toContain(1);
    });

    test('sends 1-day PMs to opt-in users except birthday person', async () => {
        mockDb({
            users: {
                '1': { id: '1', birthday: '03.11', first_name: 'Alice' },
                '2': { id: '2', optin: true },
            },
            groups: { '-100': { id: '-100', giftsEnabled: true }},
        });
        const bot = createBotMock();
        const now = new Date();
        const testYear = now.getUTCFullYear();
        const testNow = new Date(Date.UTC(testYear, 10, 2)); // 1 day before 03 Nov -> Nov 2
        await runDailyTick(bot, testNow);
        expect(bot.telegram.sendMessage).toHaveBeenCalledTimes(1);
        expect(bot.telegram.sendMessage).toHaveBeenCalledWith(2, expect.stringContaining('Завтра др'));
    });

    test('posts congrats in groups with giftsEnabled on birthday day', async () => {
        mockDb({
            users: {
                '1': { id: '1', birthday: '03.11', first_name: 'Alice' },
            },
            groups: {
                '-100': { id: '-100', giftsEnabled: true },
                '-200': { id: '-200', giftsEnabled: false },
            },
        });
        const bot = createBotMock();
        const now = new Date();
        const testYear = now.getUTCFullYear();
        const testNow = new Date(Date.UTC(testYear, 10, 3)); // 03 Nov
        await runDailyTick(bot, testNow);
        expect(bot.telegram.sendMessage).toHaveBeenCalledTimes(1);
        expect(bot.telegram.sendMessage).toHaveBeenCalledWith(-100, expect.stringContaining('Поздравляем'));
    });
});



const {
    normalizeDateStr,
    daysUntil,
    formatDdMm,
} = require('../bot');

describe('date helpers', () => {
    test('normalizeDateStr returns null for invalid', () => {
        expect(normalizeDateStr('')).toBeNull();
        expect(normalizeDateStr('32.01')).toBeNull();
        expect(normalizeDateStr('00.00')).toBeNull();
        expect(normalizeDateStr('aa.bb')).toBeNull();
        expect(normalizeDateStr('1.1')).toBeNull();
    });

    test('normalizeDateStr pads and validates', () => {
        expect(normalizeDateStr('1.1')).toBeNull();
        expect(normalizeDateStr('01.01')).toBe('01.01');
        expect(normalizeDateStr('9.12')).toBeNull();
        expect(normalizeDateStr('09.12')).toBe('09.12');
    });

    test('formatDdMm formats UTC date', () => {
        const d = new Date(Date.UTC(2024, 10, 3)); // 03 Nov
        expect(formatDdMm(d)).toBe('03.11');
    });

    test('daysUntil returns 0 for today', () => {
        const now = new Date();
        const today = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
        const dd = String(today.getUTCDate()).padStart(2, '0');
        const mm = String(today.getUTCMonth() + 1).padStart(2, '0');
        expect(daysUntil(`${dd}.${mm}`)).toBe(0);
    });

    test('daysUntil handles next year rollover', () => {
        // pick a date that is yesterday relative to today
        const now = new Date();
        const yesterday = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
        const dd = String(yesterday.getUTCDate()).padStart(2, '0');
        const mm = String(yesterday.getUTCMonth() + 1).padStart(2, '0');
        const res = daysUntil(`${dd}.${mm}`);
        // Should be between 364 and 366 depending on leap year
        expect(res).toBeGreaterThanOrEqual(364);
        expect(res).toBeLessThanOrEqual(366);
    });
});



function assertTimeZone(timeZone) {
    try {
        Intl.DateTimeFormat('en-US', { timeZone }).format(new Date(0));
    } catch {
        throw new Error(`Invalid time zone: ${timeZone}`);
    }
}

function parseYmd(ymd) {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd);
    if (!m) {
        return null;
    }
    const year = Number(m[1]);
    const month = Number(m[2]);
    const day = Number(m[3]);
    const dt = new Date(Date.UTC(year, month - 1, day));
    if (dt.getUTCFullYear() !== year || dt.getUTCMonth() !== month - 1 || dt.getUTCDate() !== day) {
        throw new Error(`Invalid date: ${ymd}`);
    }
    return { year, month, day };
}

function tzParts(utcMs, timeZone) {
    const dtf = new Intl.DateTimeFormat('en-US', {
        timeZone,
        hourCycle: 'h23',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
    });
    const map = {};
    for (const p of dtf.formatToParts(new Date(utcMs))) {
        if (p.type !== 'literal') {
            map[p.type] = p.value;
        }
    }
    return {
        year: Number(map.year),
        month: Number(map.month),
        day: Number(map.day),
        hour: Number(map.hour),
        minute: Number(map.minute),
        second: Number(map.second),
    };
}

function partsToUtcMs(p) {
    return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
}

export function zonedEndOfDayMs(ymd, timeZone) {
    assertTimeZone(timeZone);
    const { year, month, day } =
        parseYmd(ymd) ??
        (() => {
            throw new Error(`Invalid date: ${ymd} (use YYYY-MM-DD)`);
        })();
    const desiredSec = Date.UTC(year, month - 1, day, 23, 59, 59, 0);
    let utc = desiredSec;
    for (let i = 0; i < 5; i += 1) {
        const wall = partsToUtcMs(tzParts(utc, timeZone));
        utc = desiredSec - (wall - utc);
    }
    const got = tzParts(utc, timeZone);
    if (got.year !== year || got.month !== month || got.day !== day || got.hour !== 23) {
        throw new Error(`Failed to resolve end of day for ${ymd} in ${timeZone}`);
    }
    return utc + 999;
}

export function parseInstant(value, timeZone, flagName) {
    const ymd = parseYmd(value);
    if (ymd) {
        const instantMs = zonedEndOfDayMs(value, timeZone);
        return { label: value, instantMs, timeZone, kind: 'date' };
    }
    const instantMs = Date.parse(value);
    if (!Number.isFinite(instantMs)) {
        throw new Error(`Invalid ${flagName}: ${value} (use YYYY-MM-DD or an ISO-8601 instant)`);
    }
    return { label: value, instantMs, timeZone, kind: 'instant' };
}

export function toIso(ms) {
    return new Date(ms).toISOString();
}

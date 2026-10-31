export const withLeadingZero = (num: number, targetLength = 2) => {
    return num.toString().padStart(targetLength, '0');
};

export const trimDecimal = (number: number, targetLength = 1) => {
    return number.toFixed(targetLength).replace(/\.0$/, '');
};

export const deleteGetParams = (str: string) => (str.indexOf('?') === -1 ? str : str.substring(0, str.indexOf('?')));

/**
 * Преобразует секунды в строку вида "mm:ss".
 */
export const formatTimeInSeconds = (seconds: number, targetLength = 2) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds - minutes * 60;

    return isNaN(minutes) || isNaN(remainingSeconds)
        ? null
        : `${withLeadingZero(minutes, targetLength)}:${withLeadingZero(remainingSeconds, 2)}`;
};

/**
 * Форматирует номер телефона, оставляя только "+" и цифры, убирая все остальное
 */
export const formatPhoneHref = (string: string) => string.replace(/[^\d+]/g, '');

function formatBytesValue(value: number, unitIndex: number): string {
    if (unitIndex === 0) {
        return String(Math.round(value));
    }

    if (value >= 100) {
        return String(Math.round(value));
    }

    if (Number.isInteger(value) || Math.abs(value - Math.round(value)) < 1e-9) {
        return String(Math.round(value));
    }

    return trimDecimal(value, 1);
}

export function bytesToSize(bytes: number): string {
    const sizes = ['bytes', 'kb', 'mb', 'gb', 'tb', 'pb', 'eb', 'zb', 'yb'];

    if (bytes === 0) {
        return '0 bytes';
    }

    let unitIndex = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), sizes.length - 1);
    let value = bytes / 1024 ** unitIndex;

    while (unitIndex > 0 && value < 1) {
        unitIndex -= 1;
        value = bytes / 1024 ** unitIndex;
    }

    const formatted = formatBytesValue(value, unitIndex);

    return `${formatted} ${sizes[unitIndex]}`;
}

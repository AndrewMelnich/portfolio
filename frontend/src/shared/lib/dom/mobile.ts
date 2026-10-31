export const isMobileDevice = () =>
    /(Android|webOS|iPhone|iPad|iPod|BlackBerry|Windows Phone)/i.test(navigator.userAgent);

export const isIOS = () => /iPhone|iPad|iPod/i.test(navigator.userAgent);

export const isTelegramWebView = () =>
    'TelegramWebview' in window || 'TelegramWebviewProxy' in window || 'TelegramWebviewProxyProto' in window;

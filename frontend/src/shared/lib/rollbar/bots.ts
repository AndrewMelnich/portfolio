const BOT_USER_AGENT_PATTERN =
    /bot|crawl|spider|slurp|mediapartners|facebookexternalhit|bingpreview|linkedinbot|twitterbot|slackbot|discordbot|whatsapp|telegrambot|googlebot|adsbot|yandex|baiduspider|duckduckbot|applebot|semrush|ahrefs|petalbot|headlesschrome|lighthouse|pagespeed|wget|curl\/|python-requests|go-http-client|java\/|libwww|scrapy|feedfetcher|ia_archiver|archive\.org|embedly|pinterest|bytespider|gptbot|chatgpt|claudebot|anthropic|amazonbot|dotbot|mj12bot|rogerbot|sogou|exabot|ccbot/i;

export function isBotUserAgent(userAgent: string | undefined | null): boolean {
    return Boolean(userAgent && BOT_USER_AGENT_PATTERN.test(userAgent));
}

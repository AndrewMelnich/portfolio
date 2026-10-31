type LoadScriptResult = HTMLScriptElement | true;

const scriptCache = new Map<string, Promise<LoadScriptResult>>();

function findScript(url: string) {
    return Array.from(document.scripts).find((script) => script.src === url);
}

export default function loadScript(url: string): Promise<LoadScriptResult> {
    const cached = scriptCache.get(url);

    if (cached) {
        return cached;
    }

    const existingScript = findScript(url);

    if (existingScript) {
        const promise = Promise.resolve(existingScript);

        scriptCache.set(url, promise);

        return promise;
    }

    const promise = new Promise<LoadScriptResult>((resolve, reject) => {
        const script = document.createElement('script');

        script.async = true;
        script.src = url;
        script.onload = () => resolve(script);
        script.onerror = (err) => {
            scriptCache.delete(url);
            reject(err);
        };

        (document.head || document.documentElement).appendChild(script);
    });

    scriptCache.set(url, promise);

    return promise;
}

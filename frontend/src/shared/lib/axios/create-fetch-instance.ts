type ResponseKind = 'json' | 'text' | 'blob' | 'arraybuffer';

type QueryValue = string | number | boolean | null | undefined;

type QueryParams = Record<string, QueryValue | QueryValue[]>;

type RequestConfig = {
    baseURL?: string;
    url?: string;
    method?: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH';
    params?: QueryParams;
    data?: unknown;
    headers?: Record<string, string>;
    signal?: AbortSignal;
    responseType?: ResponseKind;
};

type HttpResponse<T> = {
    data: T;
    status: number;
    statusText: string;
    headers: Record<string, string>;
    config: RequestConfig;
};

export type HttpErrorBody = {
    status: number;
    statusText: string;
    headers: Record<string, string>;
    data: string;
};

export class HttpError extends Error {
    response: HttpErrorBody;

    constructor(status: number, statusText: string, response: HttpErrorBody) {
        super(`HTTP Error: ${status} ${statusText}`);
        this.name = 'HttpError';
        this.response = response;
    }
}

type GetConfig = Omit<RequestConfig, 'method' | 'data'>;
type WriteConfig = Omit<RequestConfig, 'method'>;

type FetchInstance = {
    request(config: RequestConfig & { responseType: 'text' }): Promise<HttpResponse<string>>;
    request(config: RequestConfig & { responseType: 'blob' }): Promise<HttpResponse<Blob>>;
    request(config: RequestConfig & { responseType: 'arraybuffer' }): Promise<HttpResponse<ArrayBuffer>>;
    request(config: RequestConfig & { responseType?: 'json' }): Promise<HttpResponse<unknown>>;
    get(url: string, config: GetConfig & { responseType: 'text' }): Promise<HttpResponse<string>>;
    get(url: string, config: GetConfig & { responseType: 'blob' }): Promise<HttpResponse<Blob>>;
    get(url: string, config: GetConfig & { responseType: 'arraybuffer' }): Promise<HttpResponse<ArrayBuffer>>;
    get(url: string, config?: GetConfig): Promise<HttpResponse<unknown>>;
    post(url: string, data?: unknown, config?: WriteConfig): Promise<HttpResponse<unknown>>;
    put(url: string, data?: unknown, config?: WriteConfig): Promise<HttpResponse<unknown>>;
    delete(url: string, config?: GetConfig): Promise<HttpResponse<unknown>>;
    patch(url: string, data?: unknown, config?: WriteConfig): Promise<HttpResponse<unknown>>;
};

const globalHeaders: Record<string, string> = {
    'X-Requested-With': 'XMLHttpRequest',
};

const buildUrl = (baseURL: string, url: string, params?: QueryParams): string => {
    const fullUrl = `${baseURL}${url}`;

    if (!params) return fullUrl;

    const searchParams = new URLSearchParams();

    Object.entries(params).forEach(([key, value]) => {
        if (Array.isArray(value)) {
            value.forEach((item) => {
                if (item !== undefined && item !== null) {
                    searchParams.append(`${key}[]`, String(item));
                }
            });

            return;
        }

        if (value !== undefined && value !== null) {
            searchParams.append(key, String(value));
        }
    });

    const queryString = searchParams.toString();

    return queryString ? `${fullUrl}?${queryString}` : fullUrl;
};

const processData = (data: unknown): string | FormData => {
    if (data instanceof FormData) return data;

    if (typeof data === 'object' && data !== null) {
        return JSON.stringify(data);
    }

    return String(data);
};

const headerRecord = (headers: Headers): Record<string, string> => {
    const record: Record<string, string> = {};

    headers.forEach((value, key) => {
        record[key] = value;
    });

    return record;
};

const readJson = async (response: Response): Promise<unknown> => response.json();

const readBody = (response: Response, responseType: ResponseKind) => {
    switch (responseType) {
        case 'json':
            return readJson(response);

        case 'text':
            return response.text();

        case 'blob':
            return response.blob();

        case 'arraybuffer':
            return response.arrayBuffer();

        default: {
            const _exhaustive: never = responseType;

            return _exhaustive;
        }
    }
};

export const createFetchInstance = (baseURL: string): FetchInstance => {
    function request(config: RequestConfig & { responseType: 'text' }): Promise<HttpResponse<string>>;
    function request(config: RequestConfig & { responseType: 'blob' }): Promise<HttpResponse<Blob>>;
    function request(config: RequestConfig & { responseType: 'arraybuffer' }): Promise<HttpResponse<ArrayBuffer>>;
    function request(config: RequestConfig): Promise<HttpResponse<unknown>>;
    async function request(config: RequestConfig): Promise<HttpResponse<unknown>> {
        const { method = 'GET', url = '', params, data, headers = {}, signal, responseType = 'json' } = config;
        const fullUrl = buildUrl(baseURL, url, params);
        const requestHeaders = { ...globalHeaders, ...headers };

        if (data && typeof data === 'object' && !(data instanceof FormData)) {
            requestHeaders['Content-Type'] = 'application/json';
        }

        const fetchConfig: RequestInit = {
            method,
            headers: requestHeaders,
            signal,
        };

        if (data && method !== 'GET') {
            fetchConfig.body = processData(data);
        }

        const response = await fetch(fullUrl, fetchConfig);

        if (!response.ok) {
            throw new HttpError(response.status, response.statusText, {
                status: response.status,
                statusText: response.statusText,
                headers: headerRecord(response.headers),
                data: await response.text().catch(() => ''),
            });
        }

        return {
            data: await readBody(response, responseType),
            status: response.status,
            statusText: response.statusText,
            headers: headerRecord(response.headers),
            config,
        };
    }

    function get(url: string, config: GetConfig & { responseType: 'text' }): Promise<HttpResponse<string>>;
    function get(url: string, config: GetConfig & { responseType: 'blob' }): Promise<HttpResponse<Blob>>;
    function get(url: string, config: GetConfig & { responseType: 'arraybuffer' }): Promise<HttpResponse<ArrayBuffer>>;
    function get(url: string, config?: GetConfig): Promise<HttpResponse<unknown>>;
    function get(url: string, config?: GetConfig): Promise<HttpResponse<unknown>> {
        return request({ ...config, method: 'GET', url });
    }

    const post: FetchInstance['post'] = (url, data, config) => request({ ...config, method: 'POST', url, data });
    const put: FetchInstance['put'] = (url, data, config) => request({ ...config, method: 'PUT', url, data });
    const remove: FetchInstance['delete'] = (url, config) => request({ ...config, method: 'DELETE', url });
    const patch: FetchInstance['patch'] = (url, data, config) => request({ ...config, method: 'PATCH', url, data });

    return { request, get, post, put, delete: remove, patch };
};

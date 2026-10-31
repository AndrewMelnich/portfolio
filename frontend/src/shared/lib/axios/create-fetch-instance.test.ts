import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createFetchInstance, HttpError } from './create-fetch-instance';

global.fetch = vi.fn();

const httpResponse = (body: BodyInit | null, status = 200, statusText = 'OK', contentType = 'application/json') =>
    new Response(body, {
        status,
        statusText,
        headers: { 'content-type': contentType },
    });

const jsonResponse = (body: unknown, status = 200, statusText = 'OK') =>
    httpResponse(JSON.stringify(body), status, statusText);

describe('createFetchInstance', () => {
    let fetchMock: ReturnType<typeof vi.fn>;
    let instance: ReturnType<typeof createFetchInstance>;

    beforeEach(() => {
        fetchMock = vi.mocked(fetch);
        fetchMock.mockClear();
        instance = createFetchInstance('https://api.example.com');
    });

    afterEach(() => {
        vi.clearAllMocks();
    });

    describe('GET requests', () => {
        it('should make a basic GET request', async () => {
            const mockResponse = { data: { id: 1, name: 'test' } };

            fetchMock.mockResolvedValueOnce(jsonResponse(mockResponse));

            const result = await instance.get('/users');

            expect(fetchMock).toHaveBeenCalledWith(
                'https://api.example.com/users',
                expect.objectContaining({
                    method: 'GET',
                    headers: expect.objectContaining({
                        'X-Requested-With': 'XMLHttpRequest',
                    }),
                }),
            );
            expect(result.data).toEqual(mockResponse);
            expect(result.status).toBe(200);
        });

        it('should handle GET request with query parameters', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

            await instance.get('/users', {
                params: { page: 1, limit: 10, search: 'test' },
            });

            expect(fetchMock).toHaveBeenCalledWith(
                'https://api.example.com/users?page=1&limit=10&search=test',
                expect.any(Object),
            );
        });

        it('should handle array parameters correctly', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse({ data: [] }));

            await instance.get('/users', {
                params: { ids: [1, 2, 3], tags: ['tag1', 'tag2'] },
            });

            expect(fetchMock).toHaveBeenCalledWith(
                'https://api.example.com/users?ids%5B%5D=1&ids%5B%5D=2&ids%5B%5D=3&tags%5B%5D=tag1&tags%5B%5D=tag2',
                expect.any(Object),
            );
        });
    });

    describe('POST requests', () => {
        it('should make a POST request with JSON data', async () => {
            const mockResponse = { data: { id: 1 } };

            fetchMock.mockResolvedValueOnce(jsonResponse(mockResponse, 201, 'Created'));

            const postData = { name: 'John', email: 'john@example.com' };
            const result = await instance.post('/users', postData);

            expect(fetchMock).toHaveBeenCalledWith(
                'https://api.example.com/users',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    }),
                    body: JSON.stringify(postData),
                }),
            );
            expect(result.status).toBe(201);
        });

        it('should handle FormData correctly', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse({ data: { id: 1 } }, 201, 'Created'));

            const formData = new FormData();

            formData.append('name', 'John');
            formData.append('file', new Blob(['test']));

            await instance.post('/users', formData);

            expect(fetchMock).toHaveBeenCalledWith(
                'https://api.example.com/users',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'X-Requested-With': 'XMLHttpRequest',
                    }),
                    body: formData,
                }),
            );
        });
    });

    describe('PUT requests', () => {
        it('should make a PUT request', async () => {
            const mockResponse = { data: { id: 1, updated: true } };

            fetchMock.mockResolvedValueOnce(jsonResponse(mockResponse));

            const putData = { name: 'Updated Name' };
            const result = await instance.put('/users/1', putData);

            expect(fetchMock).toHaveBeenCalledWith(
                'https://api.example.com/users/1',
                expect.objectContaining({
                    method: 'PUT',
                    body: JSON.stringify(putData),
                }),
            );
            expect(result.data).toEqual(mockResponse);
        });
    });

    describe('DELETE requests', () => {
        it('should make a DELETE request', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse({ data: { deleted: true } }, 200, 'No Content'));

            const result = await instance.delete('/users/1');

            expect(fetchMock).toHaveBeenCalledWith(
                'https://api.example.com/users/1',
                expect.objectContaining({
                    method: 'DELETE',
                }),
            );
            expect(result.status).toBe(200);
        });
    });

    describe('PATCH requests', () => {
        it('should make a PATCH request', async () => {
            const mockResponse = { data: { id: 1, patched: true } };

            fetchMock.mockResolvedValueOnce(jsonResponse(mockResponse));

            const patchData = { name: 'Patched Name' };
            const result = await instance.patch('/users/1', patchData);

            expect(fetchMock).toHaveBeenCalledWith(
                'https://api.example.com/users/1',
                expect.objectContaining({
                    method: 'PATCH',
                    body: JSON.stringify(patchData),
                }),
            );
            expect(result.data).toEqual(mockResponse);
        });
    });

    describe('Request method', () => {
        it('should handle custom request configuration', async () => {
            const mockResponse = { data: { custom: true } };

            fetchMock.mockResolvedValueOnce(jsonResponse(mockResponse));

            const result = await instance.request({
                method: 'POST',
                url: '/custom',
                data: { test: 'data' },
                headers: { 'Custom-Header': 'value' },
            });

            expect(fetchMock).toHaveBeenCalledWith(
                'https://api.example.com/custom',
                expect.objectContaining({
                    method: 'POST',
                    headers: expect.objectContaining({
                        'Custom-Header': 'value',
                        'Content-Type': 'application/json',
                        'X-Requested-With': 'XMLHttpRequest',
                    }),
                    body: JSON.stringify({ test: 'data' }),
                }),
            );
            expect(result.data).toEqual(mockResponse);
        });
    });

    describe('Response types', () => {
        it('should handle JSON response type', async () => {
            const mockResponse = { json: 'data' };

            fetchMock.mockResolvedValueOnce(jsonResponse(mockResponse));

            const result = await instance.get('/data', { responseType: 'json' });

            expect(result.data).toEqual(mockResponse);
        });

        it('should handle text response type', async () => {
            const mockText = 'plain text response';

            fetchMock.mockResolvedValueOnce(httpResponse(mockText, 200, 'OK', 'text/plain'));

            const result = await instance.get('/data', { responseType: 'text' });

            expect(result.data).toBe(mockText);
        });

        it('should handle blob response type', async () => {
            fetchMock.mockResolvedValueOnce(httpResponse('test', 200, 'OK', 'application/octet-stream'));

            const result = await instance.get('/file', { responseType: 'blob' });

            expect(result.data).toBeInstanceOf(Blob);
            expect(await result.data.text()).toBe('test');
        });

        it('should handle arraybuffer response type', async () => {
            fetchMock.mockResolvedValueOnce(httpResponse(new Uint8Array(8), 200, 'OK', 'application/octet-stream'));

            const result = await instance.get('/file', { responseType: 'arraybuffer' });

            expect(result.data).toBeInstanceOf(ArrayBuffer);
            expect(result.data.byteLength).toBe(8);
        });
    });

    describe('Error handling', () => {
        it('should throw error for non-ok responses', async () => {
            const errorResponse = { error: 'Not found' };

            fetchMock.mockResolvedValueOnce(jsonResponse(errorResponse, 404, 'Not Found'));

            await expect(instance.get('/not-found')).rejects.toThrow('HTTP Error: 404 Not Found');
        });

        it('should include response data in error', async () => {
            const errorResponse = { error: 'Server error' };

            const errorBody = () => jsonResponse(errorResponse, 500, 'Internal Server Error');

            fetchMock.mockResolvedValueOnce(errorBody()).mockResolvedValueOnce(errorBody());

            await expect(instance.get('/error')).rejects.toBeInstanceOf(HttpError);
            await expect(instance.get('/error')).rejects.toMatchObject({
                response: {
                    status: 500,
                    statusText: 'Internal Server Error',
                    headers: expect.any(Object),
                    data: JSON.stringify(errorResponse),
                },
            });
        });
    });

    describe('Headers', () => {
        it('should include global headers in all requests', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse({}));

            await instance.get('/test');

            expect(fetchMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-Requested-With': 'XMLHttpRequest',
                    }),
                }),
            );
        });

        it('should merge custom headers with global headers', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse({}));

            await instance.get('/test', {
                headers: { Authorization: 'Bearer token', 'Custom-Header': 'value' },
            });

            expect(fetchMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    headers: expect.objectContaining({
                        'X-Requested-With': 'XMLHttpRequest',
                        Authorization: 'Bearer token',
                        'Custom-Header': 'value',
                    }),
                }),
            );
        });
    });

    describe('AbortSignal', () => {
        it('should pass abort signal to fetch', async () => {
            const abortController = new AbortController();

            fetchMock.mockResolvedValueOnce(jsonResponse({}));

            await instance.get('/test', { signal: abortController.signal });

            expect(fetchMock).toHaveBeenCalledWith(
                expect.any(String),
                expect.objectContaining({
                    signal: abortController.signal,
                }),
            );
        });
    });

    describe('URL building', () => {
        it('should handle empty baseURL', () => {
            const instanceWithoutBase = createFetchInstance('');

            fetchMock.mockResolvedValueOnce(jsonResponse({}));

            instanceWithoutBase.get('/test');
            expect(fetchMock).toHaveBeenCalledWith('/test', expect.any(Object));
        });

        it('should handle baseURL with trailing slash', () => {
            const instanceWithTrailingSlash = createFetchInstance('https://api.example.com/');

            fetchMock.mockResolvedValueOnce(jsonResponse({}));

            instanceWithTrailingSlash.get('/users');
            expect(fetchMock).toHaveBeenCalledWith('https://api.example.com//users', expect.any(Object));
        });

        it('should filter out undefined and null parameters', async () => {
            fetchMock.mockResolvedValueOnce(jsonResponse({}));

            await instance.get('/test', {
                params: {
                    valid: 'value',
                    undefined: undefined,
                    null: null,
                    empty: '',
                },
            });

            expect(fetchMock).toHaveBeenCalledWith(
                'https://api.example.com/test?valid=value&empty=',
                expect.any(Object),
            );
        });
    });
});

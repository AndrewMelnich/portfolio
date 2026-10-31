/* eslint-disable no-console */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const filename = fileURLToPath(import.meta.url);
const dirname = path.dirname(filename);

const method = (process.argv[2] || 'get').toLowerCase();
const name = process.argv[3];
const dir = process.argv[4] || 'shared/api';
const queryType = process.argv[5] || '';

if (!name) {
    console.error('Please provide a api request name as an argument.');
    process.exit(1);
}

const nameCamelCase = name
    .split(/(-|_)/)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('')
    .replace('-', '');

const methodCamelCase = method.charAt(0).toUpperCase() + method.slice(1);

const folderPath = path.join(dirname, '..', 'src', dir, name.toLowerCase());

if (fs.existsSync(folderPath)) {
    console.error(`${name.toLowerCase()} folder already exists.`);
    process.exit(1);
}

fs.mkdirSync(folderPath, { recursive: true });

/**
 * Zod schema file
 */
const backendResponseFilePath = path.join(folderPath, 'backend-response.zod.ts');
const backendResponseFileContent = `// import from generated api types
import { BackendResource } from '@/shared/api/generated/generated-schemas';
import { catchZodErrorAndUseFallback, createApiResponseSchema } from '@/shared/api/utils';

export const Api${methodCamelCase}${nameCamelCase}ResponseSchema = createApiResponseSchema(BackendResource).catch(
    catchZodErrorAndUseFallback({
        // 
    }),
);\n`;

fs.writeFileSync(backendResponseFilePath, backendResponseFileContent);

/**
 * Request file
 */
const requestFilePath = path.join(folderPath, 'request.ts');
const requestFileContent = `${
    queryType === '--query' ? "import { keepPreviousData, useQuery } from '@tanstack/react-query';\n" : ''
}import { DEFAULT_LOCALE } from '@/shared/config';
import { axiosAPI } from '@/shared/api/axios-instance';
import type { ApiRequestParams } from '@/shared/api/types';
import { Api${methodCamelCase}${nameCamelCase}ResponseSchema } from './backend-response.zod';
import { transformApiResponse } from './transformer';
import type { Api${methodCamelCase}${nameCamelCase}Request, Api${methodCamelCase}${nameCamelCase}Response, App${methodCamelCase}${nameCamelCase}Response } from './types';

export const ${method}${nameCamelCase} = ({
    params = {},
    signal,
    locale = DEFAULT_LOCALE,
}: ApiRequestParams<Api${methodCamelCase}${nameCamelCase}Request>): Promise<App${methodCamelCase}${nameCamelCase}Response> =>
    axiosAPI
        .${method}<Api${methodCamelCase}${nameCamelCase}Response>('/v1/${name.toLowerCase()}', { params, signal, headers: { 'App-Locale': locale } })
        .then((response) => Api${methodCamelCase}${nameCamelCase}ResponseSchema.parseAsync(response.data))
        .then((data) => transformApiResponse(data));
${
    queryType === '--query'
        ? `\nexport const use${nameCamelCase}Query = (data: ApiRequestParams<Api${methodCamelCase}${nameCamelCase}Request>, initialData?: App${methodCamelCase}${nameCamelCase}Response) =>
    useQuery({
        queryKey: ['${name}', data],
        queryFn: ({ signal }) => ${method}${nameCamelCase}({ ...data, signal }),
        initialData,
        placeholderData: keepPreviousData,
    });\n`
        : ''
}`;

fs.writeFileSync(requestFilePath, requestFileContent);

/**
 * Transformer file
 */
const transformerFilePath = path.join(folderPath, 'transformer.ts');
const transformerFileContent = `import type { Api${methodCamelCase}${nameCamelCase}Response, App${methodCamelCase}${nameCamelCase}Response } from './types';

export const transformApiResponse = (response: Api${methodCamelCase}${nameCamelCase}Response): App${methodCamelCase}${nameCamelCase}Response => ({
    ...response,
    data: {
        //
    },
});\n`;

fs.writeFileSync(transformerFilePath, transformerFileContent);

/**
 * Types file
 */

fs.writeFileSync(
    path.join(folderPath, 'types.ts'),
    `import type { ApiResponse } from '@/shared/api/types';

export type Api${methodCamelCase}${nameCamelCase}Request = {}; // import from generated api types

export type Api${methodCamelCase}${nameCamelCase}Response = ApiResponse<{}>; // import from generated api types

export type App${methodCamelCase}${nameCamelCase}Response = ApiResponse<{
    //
}>;\n`,
);

/**
 * Index file
 */

const indexFilePath = path.join(folderPath, 'index.ts');
const indexFileContent = `export { ${method}${nameCamelCase}${
    queryType === '--query' ? `, use${nameCamelCase}Query` : ''
} } from './request';
export type { Api${methodCamelCase}${nameCamelCase}Request, App${methodCamelCase}${nameCamelCase}Response } from './types';\n`;

fs.writeFileSync(indexFilePath, indexFileContent);

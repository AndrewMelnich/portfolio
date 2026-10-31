import { PUBLIC_API_HOST } from 'astro:env/client';

export type ApiUploadResponse = string[];

export type ApiUploadDeleteResponse = unknown;

export const UPLOAD_ENDPOINT = `${PUBLIC_API_HOST}/api/v1/files/upload`;

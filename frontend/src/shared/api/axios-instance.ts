import { PUBLIC_API_HOST } from 'astro:env/client';
import { createFetchInstance } from '@/shared/lib/axios';

export const baseNextURL = `/api`;

export const axiosAPI = createFetchInstance(`${PUBLIC_API_HOST}/api`);

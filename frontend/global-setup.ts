import { type FullConfig } from '@playwright/test';
import dotenv from 'dotenv';

async function globalSetup(config: FullConfig) {
    dotenv.config({ path: '.env' });
    dotenv.config({ path: '.env.local', override: true });
}

export default globalSetup;

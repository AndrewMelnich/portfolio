#!/usr/bin/env node
import path from 'node:path';
import { detectArchetype } from './detect.mjs';

const repo = path.resolve(process.argv[2] ?? process.cwd());
console.log(JSON.stringify({ repo, ...detectArchetype(repo) }, null, 2));

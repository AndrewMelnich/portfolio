#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BRANCH = 'chore/agent-scaffolding-sync';
const COMMIT_MSG = `Обновил обвязку агентов: skills из Plenum, единый дом .agents/skills.

Сохранены проектные команды и fstack; archetype-адаптация через sync-agent-scaffolding.`;

function loadTargets() {
    return JSON.parse(fs.readFileSync(path.join(__dirname, 'targets.active.json'), 'utf8'));
}

function run(cmd, cwd) {
    return execFileSync(cmd[0], cmd.slice(1), { cwd, encoding: 'utf8' }).trim();
}

function gitDirty(cwd) {
    return run(['git', 'status', '--porcelain'], cwd).length > 0;
}

function resolveDefaultBranch(cwd, entry) {
    if (entry.defaultBranch) {
        return entry.defaultBranch;
    }
    try {
        const ref = run(['git', 'symbolic-ref', 'refs/remotes/origin/HEAD'], cwd);
        return ref.replace('refs/remotes/origin/', '');
    } catch {
        return 'master';
    }
}

const manifest = loadTargets();
const root = manifest.sitesRoot;
const results = [];

for (const entry of manifest.targets) {
    if (entry.action === 'skip') {
        results.push({ name: entry.name, status: 'skip' });
        continue;
    }
    const repo = path.join(root, entry.name);
    if (!fs.existsSync(path.join(repo, '.git'))) {
        results.push({ name: entry.name, status: 'no-git' });
        continue;
    }
    if (gitDirty(repo)) {
        results.push({ name: entry.name, status: 'dirty' });
        continue;
    }

    try {
        run(['git', 'fetch', 'origin'], repo);
        const base = resolveDefaultBranch(repo, entry);
        const remoteBase = `origin/${base}`;
        try {
            run(['git', 'rev-parse', '--verify', remoteBase], repo);
        } catch {
            results.push({ name: entry.name, status: `no-${remoteBase}` });
            continue;
        }

        const current = run(['git', 'branch', '--show-current'], repo);
        if (current !== BRANCH) {
            try {
                run(['git', 'switch', BRANCH], repo);
            } catch {
                run(['git', 'switch', '-c', BRANCH, '--no-track', remoteBase], repo);
            }
        }

        execFileSync('node', [path.join(__dirname, 'sync.mjs'), '--target', repo, '--apply'], {
            stdio: 'inherit',
        });

        const addPaths = ['.agents', '.cursor', 'AGENTS.md', 'frontend/AGENTS.md', 'docs/agents'].filter((p) =>
            fs.existsSync(path.join(repo, p)),
        );
        if (addPaths.length) {
            run(['git', 'add', ...addPaths], repo);
        }
        const staged = run(['git', 'diff', '--cached', '--name-only'], repo);
        if (!staged) {
            results.push({ name: entry.name, status: 'nothing-to-commit' });
            continue;
        }
        run(
            [
                'git',
                'commit',
                '-m',
                COMMIT_MSG,
            ],
            repo,
        );
        results.push({ name: entry.name, status: 'committed' });
    } catch (e) {
        results.push({ name: entry.name, status: 'error', detail: String(e.message ?? e) });
    }
}

console.log('\n--- rollout summary ---');
for (const r of results) {
    console.log(`${r.name}: ${r.status}${r.detail ? ` (${r.detail})` : ''}`);
}

const failed = results.filter((r) => r.status === 'error' || r.status === 'dirty');
process.exit(failed.length ? 1 : 0);

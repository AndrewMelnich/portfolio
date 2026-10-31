#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { detectArchetype } from './detect.mjs';
import { archetypeConfig } from './archetypes.mjs';
import { matchesAny } from './lib/glob.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function usage() {
    console.error(`Usage:
  node sync.mjs --target <repo> [--source plenumPath] [--dry-run|--apply]
                [--archetype bitrix|astro|...] [--skills-only]
  node sync.mjs --all-active [--dry-run|--apply]`);
    process.exit(1);
}

function parseArgs(argv) {
    const opts = {
        source: '/Users/andrewmelnichenko/Sites/plenum',
        target: null,
        allActive: false,
        dryRun: true,
        apply: false,
        archetype: null,
        skillsOnly: false,
    };
    for (let i = 2; i < argv.length; i += 1) {
        const a = argv[i];
        if (a === '--source') {
            opts.source = argv[++i];
        } else if (a === '--target') {
            opts.target = argv[++i];
        } else if (a === '--all-active') {
            opts.allActive = true;
        } else if (a === '--dry-run') {
            opts.dryRun = true;
            opts.apply = false;
        } else if (a === '--apply') {
            opts.apply = true;
            opts.dryRun = false;
        } else if (a === '--archetype') {
            opts.archetype = argv[++i];
        } else if (a === '--skills-only') {
            opts.skillsOnly = true;
        } else {
            usage();
        }
    }
    if (!opts.allActive && !opts.target) {
        usage();
    }
    if (opts.dryRun && opts.apply) {
        usage();
    }
    return opts;
}

function loadActiveTargets() {
    const file = path.join(__dirname, 'targets.active.json');
    return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function ensureDir(p) {
    fs.mkdirSync(p, { recursive: true });
}

function copyFile(src, dest, dryRun) {
    if (dryRun) {
        return 'would-copy';
    }
    ensureDir(path.dirname(dest));
    fs.copyFileSync(src, dest);
    return 'copied';
}

function removeDir(dir, dryRun) {
    if (!fs.existsSync(dir)) {
        return 'absent';
    }
    if (dryRun) {
        return 'would-remove';
    }
    fs.rmSync(dir, { recursive: true, force: true });
    return 'removed';
}

function syncSkills(source, target, dryRun) {
    const src = path.join(source, '.agents/skills');
    const dest = path.join(target, '.agents/skills');
    if (!fs.existsSync(src)) {
        throw new Error(`Missing skills upstream: ${src}`);
    }
    const args = ['-a'];
    if (!dryRun) {
        args.push('--delete');
    } else {
        args.push('--dry-run', '--itemize-changes');
    }
    args.push(`${src}/`, `${dest}/`);
    execFileSync('rsync', args, { stdio: 'inherit' });
}

function walkFiles(root, callback) {
    if (!fs.existsSync(root)) {
        return;
    }
    for (const entry of fs.readdirSync(root, { withFileTypes: true })) {
        const full = path.join(root, entry.name);
        if (entry.isDirectory()) {
            walkFiles(full, callback);
        } else {
            callback(full);
        }
    }
}

function applyPathRewrites(text, rewrites) {
    if (!rewrites.length) {
        return text;
    }
    let next = text;
    const bitrixPrefix = 'local/templates/main/frontend/';
    if (rewrites.some((r) => r.to === bitrixPrefix || r.to.startsWith(bitrixPrefix))) {
        next = next.replace(/(^|\s|"|`|[-*])frontend\//gm, `$1${bitrixPrefix}`);
        next = next.replace(/(^|\s|"|`|[-*])frontend\/\*\*/gm, `$1${bitrixPrefix}**`);
        return next;
    }
    for (const { from, to } of rewrites) {
        next = next.split(from).join(to);
    }
    return next;
}

function rewritePathsInTree(root, rewrites, dryRun) {
    if (!rewrites.length) {
        return 0;
    }
    let count = 0;
    walkFiles(root, (file) => {
        if (!/\.(md|mdc|yaml|yml|json)$/.test(file)) {
            return;
        }
        const text = fs.readFileSync(file, 'utf8');
        const next = applyPathRewrites(text, rewrites);
        if (next !== text) {
            count += 1;
            if (!dryRun) {
                fs.writeFileSync(file, next);
            }
        }
    });
    return count;
}

function fixBitrixDoublePaths(root, dryRun) {
    const bad = 'local/templates/main/local/templates/main/frontend/';
    const good = 'local/templates/main/frontend/';
    let count = 0;
    walkFiles(root, (file) => {
        if (!/\.(md|mdc|yaml|yml|json)$/.test(file)) {
            return;
        }
        const text = fs.readFileSync(file, 'utf8');
        if (!text.includes(bad)) {
            return;
        }
        count += 1;
        if (!dryRun) {
            fs.writeFileSync(file, text.split(bad).join(good));
        }
    });
    return count;
}

function shouldPreserveCopy(relativePath, targetRoot, preservePatterns) {
    const targetFile = path.join(targetRoot, relativePath);
    if (!fs.existsSync(targetFile)) {
        return false;
    }
    return matchesAny(relativePath, preservePatterns);
}

function syncCursorPartial(source, target, config, dryRun) {
    const actions = [];
    for (const rel of config.copyFromSourceRelative) {
        if (matchesAny(rel, config.skipCopyFromSourceRelative)) {
            actions.push({ rel, action: 'skip-forbidden' });
            continue;
        }
        if (shouldPreserveCopy(rel, target, config.preserveRelative)) {
            actions.push({ rel, action: 'preserve-target' });
            continue;
        }
        const src = path.join(source, rel);
        const dest = path.join(target, rel);
        if (!fs.existsSync(src)) {
            actions.push({ rel, action: 'missing-source' });
            continue;
        }
        actions.push({ rel, action: copyFile(src, dest, dryRun) });
    }
    return actions;
}

function patchPnpmAuditFix(target, templatePath, dryRun) {
    const dest = path.join(target, '.agents/skills/pnpm-audit-fix/SKILL.md');
    if (!fs.existsSync(templatePath)) {
        return 'no-template';
    }
    if (dryRun) {
        return 'would-patch';
    }
    ensureDir(path.dirname(dest));
    fs.copyFileSync(templatePath, dest);
    return 'patched';
}

function patchAgentsSkillHomes(target, dryRun) {
    const candidates = ['AGENTS.md', 'frontend/AGENTS.md'].map((p) => path.join(target, p));
    const block = `- \`.agents/skills\` — fstack + Matt + cursor-only (единый дом)
- Overrides: \`.cursor/fstack/project.md\` (+ per-skill \`.cursor/fstack/<skill>.md\`)
- Kept: project-specific commands under \`.cursor/commands/\` and hooks under \`.cursor/hooks/\``;
    let patched = 0;
    for (const file of candidates) {
        if (!fs.existsSync(file)) {
            continue;
        }
        let text = fs.readFileSync(file, 'utf8');
        if (!text.includes('## Skill homes')) {
            continue;
        }
        const replaced = text.replace(
            /## Skill homes[\s\S]*?(?=\n## |\n# |$)/,
            `## Skill homes\n\n${block}\n\n`,
        );
        if (replaced !== text) {
            patched += 1;
            if (!dryRun) {
                fs.writeFileSync(file, replaced);
            }
        }
    }
    return patched;
}

function gitDirty(repo) {
    try {
        const out = execFileSync('git', ['status', '--porcelain'], { cwd: repo, encoding: 'utf8' });
        return out.trim().length > 0;
    } catch {
        return true;
    }
}

function runOne(opts, targetPath, entry) {
    const name = entry?.name ?? path.basename(targetPath);
    const action = entry?.action ?? 'sync';
    if (action === 'skip') {
        console.log(`\n=== ${name}: skip ===`);
        return 0;
    }

    console.log(`\n=== ${name}: ${targetPath} ===`);
    if (!fs.existsSync(targetPath)) {
        console.error('Target path missing');
        return 1;
    }
    if (opts.apply && gitDirty(targetPath)) {
        console.error('Refusing --apply: git working tree is dirty');
        return 1;
    }

    const detected = detectArchetype(targetPath);
    const archetypeId = opts.archetype ?? entry?.archetype ?? detected.id;
    if (archetypeId === 'unknown') {
        console.error(`Unknown archetype (detected ${detected.id})`);
        return 1;
    }
    const config = archetypeConfig(archetypeId);
    console.log(`Archetype: ${archetypeId} (app: ${detected.app ?? entry?.app ?? '?'})`);

    syncSkills(opts.source, targetPath, opts.dryRun);

    if (!opts.skillsOnly) {
        const cursorActions = syncCursorPartial(opts.source, targetPath, config, opts.dryRun);
        const changed = cursorActions.filter((a) => a.action === 'copied' || a.action === 'would-copy');
        console.log(`Cursor files: ${changed.length} updates, ${cursorActions.filter((a) => a.action === 'preserve-target').length} preserved`);
    }

    const skillsRoot = path.join(targetPath, '.agents/skills');
    const rewritten = rewritePathsInTree(skillsRoot, config.pathRewrites, opts.dryRun);
    console.log(`Path rewrites touched ${rewritten} files`);
    if (archetypeId === 'bitrix') {
        const fixed = fixBitrixDoublePaths(skillsRoot, opts.dryRun);
        if (fixed) {
            console.log(`Fixed ${fixed} files with doubled Bitrix frontend paths`);
        }
    }

    if (config.patchPnpmAuditFix) {
        const tpl = path.join(__dirname, 'templates/pnpm-audit-fix-bitrix.SKILL.md');
        console.log(`pnpm-audit-fix: ${patchPnpmAuditFix(targetPath, tpl, opts.dryRun)}`);
    }

    if (config.removeCursorSkills) {
        const cursorSkills = path.join(targetPath, '.cursor/skills');
        console.log(`.cursor/skills: ${removeDir(cursorSkills, opts.dryRun)}`);
    }

    if (!opts.skillsOnly) {
        const patched = patchAgentsSkillHomes(targetPath, opts.dryRun);
        console.log(`AGENTS.md skill homes patched: ${patched}`);
    }

    return 0;
}

const opts = parseArgs(process.argv);
let exit = 0;

if (opts.allActive) {
    const manifest = loadActiveTargets();
    opts.source = manifest.source ?? opts.source;
    const root = manifest.sitesRoot ?? '/Users/andrewmelnichenko/Sites';
    for (const entry of manifest.targets) {
        const targetPath = path.join(root, entry.name);
        exit = Math.max(exit, runOne(opts, targetPath, entry));
    }
} else {
    exit = runOne(opts, path.resolve(opts.target), null);
}

process.exit(exit);

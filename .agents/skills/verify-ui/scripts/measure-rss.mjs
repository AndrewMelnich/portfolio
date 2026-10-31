#!/usr/bin/env node
import { execFileSync, spawn } from "node:child_process";
import { answerHelp } from "./cli-help.mjs";

const USAGE = `Usage: measure-rss.mjs [--interval MS] [--json] -- <command> [args...]
       measure-rss.mjs [--interval MS] [--json] --pid N [--pid N ...] [--for S]

Peak resident set size (RSS) summed over a process tree, sampled from \`ps\` every --interval ms (default 200).
The tree of a root is every descendant by parent pid plus every process in the root's process group, so a detached server (control up) and a Chromium started by a script are both counted.
With -- it runs the command, samples until it exits and exits with the command's code. With --pid it samples the given pids for --for seconds (default 10).
Prints "peak RSS <n> MB across <p> processes (<k> samples, <t> s)"; --json prints {peakRssMb, peakProcesses, samples, seconds, top}.
RSS counts pages shared between processes once per process and omits pages macOS has compressed or swapped out, so it can read high for Chromium and low on a machine under memory pressure. docs: slot-sizing.md.

Examples:
  node .agents/skills/verify-ui/scripts/measure-rss.mjs -- node .agents/skills/verify-ui/scripts/layout-proof.mjs --dir .cursor/fstack/artifacts/project/manifests
  node .agents/skills/verify-ui/scripts/measure-rss.mjs --pid "$(cat .cursor/fstack/artifacts/servers/dev.pid)" --for 20`;

answerHelp(USAGE);

function usageError() {
  console.error(USAGE);
  process.exit(1);
}

function parse(argv) {
  const opts = { interval: 200, json: false, pids: [], seconds: 10, command: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--") {
      opts.command = argv.slice(i + 1);
      break;
    }
    if (arg === "--json") opts.json = true;
    else if (arg === "--interval") opts.interval = Number(argv[++i]);
    else if (arg === "--pid") opts.pids.push(Number(argv[++i]));
    else if (arg === "--for") opts.seconds = Number(argv[++i]);
    else usageError();
  }
  const bad = [opts.interval, opts.seconds, ...opts.pids].some((n) => !Number.isFinite(n) || n <= 0);
  if (bad || (!opts.command?.length && opts.pids.length === 0)) usageError();
  return opts;
}

function table() {
  const out = execFileSync("ps", ["-axo", "pid=,ppid=,pgid=,rss=,command="], {
    encoding: "utf8",
    maxBuffer: 64 << 20,
  });
  const rows = [];
  for (const line of out.split("\n")) {
    const m = line.trim().match(/^(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(.*)$/);
    if (m) rows.push({ pid: +m[1], ppid: +m[2], pgid: +m[3], rss: +m[4], command: m[5] });
  }
  return rows;
}

function treeOf(rows, roots) {
  const members = new Set(roots);
  for (let grew = true; grew; ) {
    grew = false;
    for (const row of rows) {
      if (!members.has(row.pid) && (members.has(row.ppid) || roots.includes(row.pgid))) {
        members.add(row.pid);
        grew = true;
      }
    }
  }
  return rows.filter((row) => members.has(row.pid) && row.pid !== process.pid);
}

const opts = parse(process.argv.slice(2));
const started = Date.now();
const peak = { kb: 0, processes: 0, top: [], samples: 0 };
let child = null;
let childCode = 0;
if (opts.command?.length) {
  child = spawn(opts.command[0], opts.command.slice(1), { stdio: "inherit", detached: true });
  child.on("exit", (code, signal) => {
    childCode = code ?? (signal ? 1 : 0);
  });
}
const roots = () => (child ? [child.pid] : opts.pids);
const running = () => (child ? child.exitCode === null && child.signalCode === null : Date.now() - started < opts.seconds * 1000);

function sample() {
  const tree = treeOf(table(), roots());
  peak.samples += 1;
  const kb = tree.reduce((sum, row) => sum + row.rss, 0);
  if (kb > peak.kb) {
    peak.kb = kb;
    peak.processes = tree.length;
    peak.top = tree
      .sort((a, b) => b.rss - a.rss)
      .slice(0, 5)
      .map((row) => `${Math.round(row.rss / 1024)} MB ${row.command.slice(0, 100)}`);
  }
}

while (running()) {
  sample();
  await new Promise((resolve) => setTimeout(resolve, opts.interval));
}
if (peak.samples === 0) sample();

const report = {
  peakRssMb: Math.round(peak.kb / 1024),
  peakProcesses: peak.processes,
  samples: peak.samples,
  seconds: Math.round((Date.now() - started) / 100) / 10,
  top: peak.top,
};
console.log(
  opts.json
    ? JSON.stringify(report)
    : `peak RSS ${report.peakRssMb} MB across ${report.peakProcesses} processes (${report.samples} samples, ${report.seconds} s)`,
);
process.exit(childCode);

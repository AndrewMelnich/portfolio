# Parallel sections

**You own the page fan-out: worktrees, implementers, acceptance. You act on two signals only: a section Task completing, and the output of `receipt.mjs` and `accept.mjs`. Accept a section on `accept.mjs`, never on its report.**

Branch names, ticket order, and the implementer prompt are in `page.md`. This playbook is the orchestration `page.md` (implement-spec) points to. `$CTRL` is `node .agents/skills/verify-ui/scripts/control.mjs`. The main checkout is never edited for a section.

Orchestrator rules:

- Between signals you wait. A section's progress is its Task completion and its receipt.
- A background-shell completion notice from an implementer gets one line ("noted") and no file read. Only the two signals above change what you do.
- Work outside the plan that surfaces mid-fan-out (a broken CI job, a stale branch) goes to one background Task, so acceptance never waits on it.
- A subagent's terminal, output file, and server log belong to that subagent. You never read, tail, or retell them. When a section needs a look, run `receipt.mjs` in its worktree, or resume it with a message.
- Every server and heavy process belongs to `control` (`up`, `down`, `status`, `launch`, `cleanup`). You start nothing by hand, and you never kill a subagent's process; `accept.mjs` stops a section's dev server.
- A section reaches the assembly branch only through `accept.mjs`. The main checkout holds no merge, no conflict resolution, and no edit while sections are accepted.

1. Check the stub on the assembly branch before any section starts.
   **Done:** `git ls-tree -r --name-only <assembly branch>` lists the route file, the page view, and a placeholder slice for every fresh section. When one is missing, run `page.md` Outer step 5 first.

2. Free the slots that do not belong to this fan-out, before reading the caps. The worktrees do not exist yet, so pick each fresh section's worktree path now, under `~/.cursor/worktrees/` (step 5 cuts it at exactly that path). From the main checkout run `$CTRL release-foreign --allow <section worktree path>` once per section worktree of this page. It stops every other slot holder (a stuck build or browser run of another checkout) and frees its slot; servers hold no slot and are left running. The main checkout is not passed, so it counts as foreign.
   **Done:** the `released` list of its JSON names every holder you did not expect to keep, and `$CTRL holders` lists only holders whose `root` is one of the section worktrees.

3. Run the project check once on the assembly branch, before any worktree is cut: `pnpm pc` in `frontend/` of the checkout that holds it. Fix every finding there and commit, so each section worktree inherits a green branch and lint debt never surfaces at a first `accept.mjs`.
   **Done:** `pnpm pc` exits 0 on the assembly branch tip, and `git status` shows no change.

4. Read the implementer cap N from the `Implementer cap now: <N>` line of `$CTRL --help` (not the `Slots now:` line, which is the heavy cap for Chromium and builds). You run at most N section implementers at once. The next section starts when a running one is accepted (step 12).
   **Done:** N is in the todo list.

5. Cut and set up every fresh section's worktree now, all in parallel (one shell job per section, then `wait`), so a launch after an accept is immediate. Cut each from the assembly branch on its section branch (`git worktree add -b <section branch> <path> <assembly branch>`, with the path picked in step 2) when it does not exist. Set it up from inside it: `ROOT_WORKTREE_PATH=<main checkout> bash .cursor/scripts/setup-worktree.sh`. The script copies `frontend/.env*`, checks the hook and `pnpm pc` binaries, and installs. A download lands in the worktree only when `localPath` is the worktree's absolute path (`assets-mcp.md`, CRITICAL).
   **Done:** every fresh section has a worktree on its own section branch, each setup printed `worktree setup ok`, and `PUBLIC_API_HOST` is set in each worktree's `frontend/.env` or `frontend/.env.local`.

6. Cache the Figma data every section reads, so implementers read disk. `<pack dir>` is one folder outside every checkout (for example `~/.cursor/fanout/<page>/`). Run this step in one background Task, so the dumps stay out of your context; its Done commands are your check. For each fresh section and each of its frame widths:
   - node cache, from `frontend/`: `pnpm figma:node-cache -- get <figma-url> --cache-dir <pack dir>/figma-cache` prints the cached path. On a miss, call Framelink `get_figma_data` for the node yourself (`figma-design-to-code`, rungs 0 to 3), save the result text as the dump with its frame header (`figma-snapshot.md`, Shape), and `put` it with the same flags. The Task writes no fetch script of its own;
   - snapshot: `pnpm figma:snapshot -- <dump file> --out <pack dir>/snapshot/<section>-<width>.figma.yml`, so implementers read a ready `.figma.yml` and call Framelink only for a node the dump lacks;
   - `figmaFile`: save the frame's `/v1/files/:key/nodes` JSON, `curl -sf -H "X-Figma-Token: $FIGMA_API_KEY" "https://api.figma.com/v1/files/<fileKey>/nodes?ids=<frameId>" -o <pack dir>/figma/<section>-<width>.json`. The token stays out of every reply and file. A width with no frame of its own uses the nearest wider frame's JSON.

   **Done:** for every section and frame width, `pnpm figma:node-cache -- get <figma-url> --cache-dir <pack dir>/figma-cache` exits 0 on a path that exists, `<pack dir>/snapshot/<section>-<width>.figma.yml` exists, and `node -e 'const n=require("<pack dir>/figma/<section>-<width>.json").nodes; process.exit(n["<frameId>"] ? 0 : 1)'` exits 0.

7. Write each implementer's context pack. The prompt opens with the ticket's first line (`Follow ui-mode. Path: … Scope: …`) and `<worktree>/.agents/skills/ui-mode/SKILL.md`, and the Task is `subagent_type: "ui-agent"`. Then it holds this file's path, the ticket number, the worktree path, the section branch, the assembly branch, the frame ids and widths, and the snapshot paths. The pack adds the paths implementers would otherwise search for:
   - the node-cache path and the snapshot path of each of the section's nodes, per width (step 6);
   - the `figmaFile` path per frame (step 6);
   - for static images, the ready Framelink `localPath`: the worktree's absolute path plus `/<images-dir>/<category>`;
   - the canonical `proof.json` example, `<worktree>/.agents/skills/figma-design-to-code/references/proof.example.json`: copy its shape, set `figmaFile` to the pack's path for that frame, replace `fileKey`, `frameId`, `url`, selectors and node ids. It lives once, beside `layout-proof.md`; the pack points at it and never inlines it.

   Do not list other skills to re-read (`ui-mode` is the one exception); the section contract stays in the ticket. Put Explore notes in one file outside the repo and pass its path next to `page.md`, which the agent reads first. The implementer runs the Scope its ticket names (Outer, fresh ticket, or assembly).
   **Done:** each prompt names this file's path, the ticket number, the worktree path, the section branch, the assembly branch, the frame ids with their widths, the snapshot paths, the node-cache paths, the `figmaFile` paths, the Framelink `localPath` and the `proof.json` example path, `test -e` exits 0 on every path the prompt lists (the `localPath` directory excepted), and the prompt opens with `Follow ui-mode.` and the `ui-mode` path, and lists no other skill to re-read.

8. Order the frontier largest first, so the longest section never starts last. Rank each fresh section by its count of cards, states (hover, open, scroll), repeated items, and widths without a frame of their own; the most of these first, ties in ticket order.
   **Done:** the todo list holds the queue in that order, each section with its four counts.

9. Launch each implementer, in queue order, as a background Task with the model `page.md` (implement-spec) gives the `implementer` role. Before a launch, `git merge-base --is-ancestor <assembly branch> HEAD` in its worktree must exit 0; when an accepted section moved the assembly branch on, reset the unstarted worktree onto it (`git reset --hard <assembly branch>`). Record the launch time (`date -u +%Y-%m-%dT%H:%M:%SZ`) per section in the todo list; a resume keeps the first launch time.
   **Done:** each Task's `model` equals the roster's `implementer` value, each launched section's ancestor check exited 0, each section has its launch time, and no more than N section Tasks run.

10. On a transport drop, resume the same section agent. Its first action is `git status` in its worktree. Start a new section agent only when resume is unavailable, and that new agent stops when `glab mr list --source-branch <section branch> --target-branch <assembly branch>` already lists an open MR.
   **Done:** the resumed agent's first tool call was `git status`, and `glab mr list --source-branch <section branch> --target-branch <assembly branch>` lists at most one MR.

11. When a section Task completes, accept it. Run these in order:
    1. stop that section's Task (`TaskStop`), so it cannot recreate its worktree or open another MR;
    2. `node .agents/skills/verify-ui/scripts/accept.mjs --worktree <path> --section <section branch> --assembly <assembly branch> --widths <every frame width assigned to the section> --started-at <the section's launch time from step 9>`.

    `accept.mjs` requires a clean tree, `diff-in-slice`, `receipt.mjs` exit 0, one passing layout-proof per width, `pnpm pc`, and `pnpm fallow:audit`. Then it merges into the assembly branch, pushes, closes the section MR, stops the section's dev server, removes the worktree, and deletes the branch. Re-running it after a drop finishes the job.
    - Exit 0: record the accept time (`date -u +%Y-%m-%dT%H:%M:%SZ`) in the todo list next to the section's launch time, and paste its table (width → verdict, check → exit, wall time) in your reply.
    - Exit 1 on a check: resume the same section agent (step 10) with the `refused:` lines, and run this step again when its Task completes. Exit 1 on a step (merge, push, glab): fix the state the output names, then re-run.
    - Exit 2: fix the flag or the state it names, then re-run.

    **Done:** `accept.mjs` exits 0 for the section, its table is in your reply with a wall time that shows `start: --started-at`, the section's accept time is in the todo list next to its launch time, and `git worktree list` no longer lists the section worktree.

12. Start the next queued section (step 9) as soon as step 11 succeeds, until every fresh section is accepted. Keep the main checkout's assembly branch clean (`git status` shows no change), because `accept.mjs` refuses to merge into a dirty one.
    **Done:** every fresh section has an accepted table, and no more than N section Tasks ran at once.

13. Start the assembly ticket's Task at once, without waiting for the user, on the `implementer` role's model (step 9).
    **Done:** the assembly branch holds each section's merge, and the assembly ticket's Task is running.

Anti-shortcut: a section that passes on its implementer's report and is refused by `accept.mjs` is returned, not merged by hand. A width missing from the table is a missing proof, not a skipped one.

**Reply:** the shape in `ui-mode` § Reply, plus one row per section: branch, section MR, assigned widths with verdicts, the check exits, and wall time from the `accept.mjs` table. Add the assembly ticket's status and any section that came back. The final page reply carries the wall time per section, the run's wall time (first launch to last accept), and the average sections in flight (sum of section minutes divided by the run's wall minutes), all from the todo list's launch and accept times.

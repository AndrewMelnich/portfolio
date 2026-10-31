# Stale view

**You own the question of which origin the developer sees. Settle it with the doctor before anything else. A stale view never changes code.**

1. Run the doctor on the origin the developer named, before any edit: `node .agents/skills/verify-ui/scripts/control.mjs doctor --user-origin <url>`.
   **Done:** the JSON prints with `names` for `localhost` and `127.0.0.1`, and `listeners` lists the processes on that port.

2. Read `stale` and each host in `names`. `stale: true` means a loopback name serves a build with another stamp, or with no stamp at all.
   **Done:** the todo list states, per host, whether it answers and whether it is fresh or stale.

3. For a stale origin, tell the developer to restart their dev server or rebuild it. Name the port and the PID from `listeners`. Never kill that process, and make no code edit for the stale view.
   **Done:** the reply holds the restart instruction with the port and PID.

4. For a fresh origin (`ok: true`) where the developer reports a dev-only bug, check their console on their URL: `VERIFY_BASE_URL=<user origin> node .agents/skills/verify-ui/scripts/console-check.mjs /<path>/`. Otherwise mark this step `skip: not dev-only`.
   **Done:** the output names the console error, or exits 0 and the reply says the page is clean at that origin.

5. For a fresh origin where the bug also shows on the verify origin, reproduce it there: `$CTRL relaunch`, then `$CTRL doctor` prints `"ok": true`. Then continue on the path `ui-mode` names for the bug.
   **Done:** the defect reproduces on the verify origin, or the reply names how the developer's view differs.

6. Before any claim that the view is fixed, prove it on the verify origin with the path's own proof.
   **Done:** doctor reports `ok: true` and `stale: false` on the fresh build.

Anti-shortcut: "I don't see the change" never starts a code edit. The stamp decides first, and the developer's process stays theirs.

**Reply:** the shape in `ui-mode` § Reply, plus per host (answers or not, fresh or stale), the listener PIDs, the restart instruction or the reproduction, and the verify origin's doctor line.

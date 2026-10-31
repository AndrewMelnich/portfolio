# Session pickup

**You own the resume point. Rebuild what the user asked for from their own words, then check the trail. Do not redo what already landed.**

1. Locate the prior trail: the chat's `<uuid>.jsonl` in this workspace's `agent-transcripts/` directory (the system prompt names it), or the pushed branch the user names. Do not search other projects' transcripts.
   **Done:** the file path or the branch is named in the reply.

2. Rebuild the requirement list from the user's messages only: lines whose `role` is `user`, text in `message.content`, oldest first. One line per constraint, quoted in the user's words. A long transcript goes to a subagent that returns the list, not the whole file.
   **Done:** the todo list holds each constraint with its quote, and no assistant summary is counted as a requirement.

3. Reconstruct the state: `git status`, `git log --oneline origin/<base>..HEAD` for the branch, and `git worktree list`. The base is the one the trail names, `master` when it names none.
   **Done:** the branch, its commits, and its uncommitted files are named.

4. Mark each requirement landed (with its commit or file path) or pending. Do not re-run the prior repro and do not redo landed work.
   **Done:** every requirement carries one of the two marks, and no landed item was rebuilt.

5. Route each pending item to its path and playbook in `ui-mode` § Paths. A pending UI change takes its path's playbook, copied into the todo list.
   **Done:** each pending item names its path and playbook, or `none`.

6. Check each inherited claim on the real artifact (`principle-prove-it-works`). For UI work that is `receipt.mjs` on the current source stamp, not the prior run's output.
   **Done:** the receipt verdict for the current stamp is in the reply, and no stale or red proof is cited as done.

Anti-shortcut: a prior chat's "done" is a claim to check, not a finished proof. The user's requirements list decides what is pending.

**Reply:** where the prior agent stopped, what was inherited and what was redone (ideally nothing), the resume point, and the outcome. A UI task also carries the `ui-mode` § Reply shape.

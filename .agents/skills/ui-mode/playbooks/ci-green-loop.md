# CI green loop

**You own a red pipeline until it is green or a stop report names the job and its blocker. You fix the code; you do not change the pipeline to pass it.**

1. Find the red jobs on this branch: `glab ci status --compact`.
   **Done:** each red job is named with its stage.

2. Read each red job's log with `glab ci trace <job-name>`. Classify it as diff-caused (an error in a file this branch changed) or flaky (a timeout, a network fetch, or a runner failure).
   **Done:** each red job carries its class and the log line that decides it.

3. Run the premerge set locally from `frontend/` before pushing: `pnpm pc`, `pnpm exec vitest run --changed origin/<MR target branch>`, and `pnpm fallow:audit`.
   **Done:** each command exits 0 locally, or its failure matches a diff-caused job from step 2.

4. Retry flaky jobs only, once each: `glab ci retry <job-name>`. A job that stays red on the same diff is diff-caused, not flaky.
   **Done:** each retried job has a second result, and no diff-caused job was retried.

5. Fix each diff-caused job in the code. Edit CI files (`.gitlab-ci.yml` and `ci/*.yml`) only when the user asked for that in this chat, and quote the request in the reply.
   **Done:** `git diff --name-only` lists no CI file, or the reply quotes the user's request for the CI edit.

6. Push, then wait for the pipeline to finish: `glab ci status --wait`.
   **Done:** the pipeline reports finished.

7. Repeat from step 1 until the pipeline is green. Stop and report when a red job is out of this branch's reach: a runner outage, a flaky job still red after its retry, or a CI edit the user did not ask for.
   **Done:** the pipeline is green, or the stop report names the job, its class, and the blocker.

Anti-shortcut: a red job is fixed in code, or classified as flaky with its log line. The pipeline config and the test thresholds stay as they are.

**Reply:** the shape in `ui-mode` § Reply, with the Proof row holding the pipeline link. Add each red job with its class and log line, the local commands with their exit codes, the retries used, and the final status.

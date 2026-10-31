---
name: gitlab-glab
description: >
  Read GitLab merge requests, pipelines and files through the glab CLI instead of an MCP server.
  Use for any GitLab task: MR, diff, pipeline, job, repository file, REST call.
---

# GitLab via glab

Auth: `GITLAB_TOKEN` from the environment. Self-hosted GitLab: `GITLAB_HOST` too. Never put a token in a command, file or reply. Inside the clone `glab` picks the project from `git remote`; elsewhere pass `-R group/project`.

- MRs: `glab mr list` (`-A` all states, `-P 10`), `glab mr view <iid>` (`--comments` for discussions), `glab mr diff <iid> --raw`.
- Changed files only: `glab api projects/:id/merge_requests/<iid>/diffs | jq -r '.[].new_path'`.
- Pipelines: `glab ci list -r <branch> -P 5`, `glab ci status -b <branch> -c`, `glab ci get -b <branch>` (jobs of the last pipeline). `glab ci view` is an interactive TUI: do not run it.
- File: `glab api "projects/:id/repository/files/<url-encoded path>/raw?ref=<branch>"`.
- Create an MR: `glab mr create -b <target> -t <title> -d <description> -y` (source is the current branch). `-d` takes the description; `--body` does not exist. `-y` skips the confirmation prompt, so the call never waits for input. The target branch is on the remote before this runs. A description from a file: `--description-file <path>`.
- Anything else: `glab api <REST path>`; flags: `glab <cmd> --help`.
- Trim output: `-F json | jq '…'` for the fields you need; pipe big diffs through `head` or a path filter.
- CI configuration (`.gitlab-ci.yml`, `ci/*.yml`) is edited only when the user asks for that change in the same message. A CI-green check reads pipelines and reports; it does not edit CI files.
- Read-only by default. `glab api -X POST/PUT/PATCH/DELETE`, `glab mr create/update/merge/close/note`, `glab ci run/retry/cancel/delete` and other mutations only when the user asked for that exact action. The page procedure (`ui-mode` `page.md`) is that ask for its section and assembly MRs, and `accept.mjs` for closing a section MR.

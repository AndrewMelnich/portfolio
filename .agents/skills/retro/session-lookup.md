# Session lookup

Resolve the id the user gave to the session's primary sources. Two id shapes; try the first, fall back to the second.

## Chat id

A chat id is the folder name under the project's transcripts:

```sh
ls ~/.cursor/projects/*/agent-transcripts/<id>/
```

The folder holds `<id>.jsonl` (the main transcript), `subagents/` (one transcript per subagent) and `compaction/`. Read subagent transcripts too: delegated work lives there, not in the main file.

No folder: treat the id as a request id.

## Request id

A request id is the `latestChatGenerationUUID` of one chat. The chat's `composerData:<chat id>` row in the Cursor IDE store holds it.

Store: `~/Library/Application Support/Cursor/User/globalStorage/state.vscdb`, table `cursorDiskKV`, `key` and `value` columns, `value` is JSON. Cursor runs in WAL mode; the newest rows sit in `state.vscdb-wal` until a checkpoint.

```sh
cd ~/Library/Application\ Support/Cursor/User/globalStorage
sqlite3 state.vscdb "select key from cursorDiskKV where key like 'composerData:%' and json_extract(value,'\$.latestChatGenerationUUID')='<request id>';"
```

- Open the store with a plain `sqlite3 state.vscdb`, not `-readonly` or `immutable=1`: only a normal open reads the `-wal` rows.
- Run `select` only. Cursor holds the store open; a write corrupts the user's IDE state.
- The scan covers every `composerData` row of a store tens of GB large: expect about 80 s. Set the tool timeout to 300000 ms.
- The result is `composerData:<chat id>`; list `~/.cursor/projects/*/agent-transcripts/<chat id>/` as above.

Verified: request id `efd8ce70-dcbd-4452-85e2-9ba0207e2b9b` returns `composerData:6e351bd0-47f5-46bc-8617-d6686765e0fe`, and `~/.cursor/projects/*/agent-transcripts/6e351bd0-47f5-46bc-8617-d6686765e0fe/` holds `6e351bd0-47f5-46bc-8617-d6686765e0fe.jsonl`, `compaction/`, `subagents/`.

No row: the id belongs to a chat already deleted from the store; report that the session is unreachable rather than guessing.

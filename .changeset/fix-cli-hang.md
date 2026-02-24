---
"aspectcode": patch
---

Fix CLI hanging on startup when AGENTS.md exists

Move the ownership prompt (selectPrompt) to run before the Ink dashboard mounts, preventing a stdin deadlock between Ink's useInput and the raw-mode readline prompt.

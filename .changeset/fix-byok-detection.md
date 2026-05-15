---
"aspectcode": patch
"@aspectcode/optimizer": patch
---

Fix BYOK key detection. A personal API key now takes precedence over the hosted proxy, so a key in `.env` (`ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `ASPECTCODE_LLM_KEY`) is honored even while logged in. API keys are trimmed before use, so a key copy-pasted with stray whitespace is no longer rejected as invalid. Tier detection and `aspectcode usage` now read the `.env` file, not just `process.env`. The Sonnet diagnosis model is no longer forced onto OpenAI BYOK providers. Removed hosted-tier / BYOK jargon from the dashboard and `usage` output.

Rotated the hardcoded model IDs to current releases: the Anthropic provider default is now `claude-haiku-4-5-20251001` (was the retired `claude-3-5-haiku-20241022`), and the diagnosis step uses `claude-sonnet-4-6`.

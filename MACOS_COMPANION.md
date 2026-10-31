# Station Japo local Codex companion

## Start on this Mac

```sh
cd "/Users/raojawad/Documents/Codex/2026-09-22/files-pasted-by-the-user-build/station-japo"
npm run companion
```

If an older companion is running, stop it with Control-C first, then run the commands above. Keep the terminal open. Refresh Station Japo → Research → Connect your Mac companion. Paste the NEW temporary token printed by the terminal and click Connect Codex. A small local companion window opens: keep it open and return to Station Japo. The token is kept only in that tab's session storage, not in the cloud database or popup URL. Restarting the companion changes the token. Stop with Control-C.

Requires Node.js 22+, installed project dependencies, and the Codex CLI bundled with the ChatGPT Mac app at `/Applications/ChatGPT.app/Contents/Resources/codex`. If not signed in:

```sh
/Applications/ChatGPT.app/Contents/Resources/codex login
```

Use ChatGPT sign-in, not an API key. On a fresh checkout run `npm ci` first. Never paste the local token into research prompts or share it.

## Controls and privacy

- Listens only on `127.0.0.1:4318`. Exact Station Japo origin, Host and bearer token are checked. No shell-command endpoint exists.
- Safari uses a top-level local companion window, not an insecure fetch from the HTTPS website. Messages require the exact allowed origin, original opener window and a random per-window channel. The local window forwards only approved API routes; every API request still requires the token. It cannot be embedded in another page.
- Only six validated actions are accepted. Codex runs with fixed arguments, read-only sandbox, no shell, plugins, apps, hooks, computer/browser control or multi-agent tools. Local ranking is deterministic.
- One running task; 4 new tasks/minute, 30/hour, 100/session. Requests have size limits, timeouts and cancellation. Retries reuse request IDs so a lost response does not intentionally create another run. Restarted sessions never silently rerun old work.
- Temporary connectivity failures retry automatically. Login/token failures require your action. Health means local ChatGPT sign-in is detected, not that a model request has succeeded.
- Model inference and web search still use OpenAI services and your account's usage allowance. This is a local bridge, not an offline model. Research sends query/filters; other actions send only their displayed inputs and selected records.
- Results stay in companion memory for at most an hour. Research results saved by the app use its existing authenticated workspace. Reasoning suggestions are not automatically saved or sent. Failure logs omit prompts, message bodies and tokens. Codex may maintain its own diagnostic runtime state; ephemeral mode disables persisted conversation sessions.
- Origin checks protect against other browser sites, not malware running as your Mac user. Keep the token private and stop the companion when unused. No LAN exposure, tunnel or public port is needed.

For local development only: `npm run companion -- --dev` also permits the exact origin `http://localhost:5173`. Production mode permits only `https://station-japo.rao431728.chatgpt.site`.

If the local window fails to load, restart the companion and click Open companion window again. If it opens but rejects the token, use the current terminal token. After refreshing Station Japo, reopen the companion window to reconnect. If Safari blocks the requested popup, allow that popup through Safari's normal prompt; never disable browser security or install certificates. Unknown actions, failed CLI calls and invalid evidence are errors, never synthetic successes. Source citations require manual review; AI-reported evidence is not independently verified.

# Backtalk scripts: notes for agents

- JavaScript ports of SandFly Lua scripts for the Backtalk screen reader (trypsynth/backtalk). API reference: `docs/scripting.md` in the Backtalk repo; the runtime is `talkback/src/phone/assets/scripting/prelude.js`.
- One `.js` file per script at the repository root. Backtalk lists the source's `.js` files; a script's `id` is its file name.
- A port ships only if it does everything the original does. Ports blocked by missing API are listed in README.md under "Not ported yet"; port them when Backtalk adds the API.
- Backtalk API differences from SandFly that matter here:
  - Queries know only id, text, textContains, contentDescription, className, role, clickable, parentId, inside (one query), has. Filter other fields (focusable, editable, scrollable, heading, longClickable, checkable) in code.
  - `findAll` returns at most 200 items. Backtalk keeps only the last 500 items a script was given, so use found items soon.
  - No touch, no text recognition, no `waitFor`, no `sleep` (use a `setTimeout` promise), no `sf.keys`, no device volume.
  - Keys must start with `backtalk+`.
  - Item actions return promises. A command that should fall back must return `false` synchronously, before any `await`.
  - Speech hooks (`onFocus`, `onSpeech`) get 30 ms: no searching there; defer with `setTimeout(fn, 0)`.
  - Unnamed Android actions go by number: focus 1, show on screen 16908342, IME enter 16908372.
- All user-facing text is English.
- Check: every file passes `node --check` as an ES module (copy to `.mjs`).

---
name: Protected files — never edit
description: Certain config files must never be modified by the agent under any circumstance.
---

## Rule
Never modify, rewrite, or touch these files in any artifact or workspace location:

- `vite.config.ts` / `vite.config.js`
- `tailwind.config.js`
- `package.json` (anywhere in the monorepo)
- `postcss.config.js`

**Why:** A previous task agent modified these files and caused the entire system to break. The user explicitly forbids touching them to prevent recurrence.

**How to apply:** Before any edit, check the file path. If it matches any of the above, stop and find another way — or ask the user first.

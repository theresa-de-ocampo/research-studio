<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

## Coding Guidelines

- Always use curly braces `{}` for control flow statements (`if`, `else`, `for`, `while`, etc.), even for single-line bodies. Never use inline control flow statements such as `if (recipe) return recipe;`.
- Use **only one `return` statement per function**. Avoid early returns. Use conditional logic to determine the result before returning.
- Do not create or modify tests unless explicitly requested.
- Never mock external APIs. Run tests only when explicitly instructed; permission to create or modify tests does not authorize running them.

## Stop Conditions Requiring Human Intervention

Immediately stop execution if any of the following conditions are encountered. Do not attempt to resolve, bypass, or work around them autonomously.

- **Database Changes:** Creating, altering, or deleting database objects, roles, or permissions is required.
- **Permission Issues:** Any permission or access restriction prevents progress.
- **Database Migrations:** A database migration needs to be executed.
- **Testing:** Testing or verification is required. Do not create or run tests unless explicitly requested. A human will verify each completed goal.
- **Package Installation:** Installing, updating, or removing dependencies is required.
- **Docker:** Building images, starting containers, or running Docker services is required.
- **Missing Credentials:** Required credentials or environment variables are missing or invalid.

**When a stop condition is encountered:**

1. Stop all further execution immediately.
2. Clearly explain the blocker and the human action required.
3. Do not continue with other tasks or attempt alternative approaches.
4. Resume only after receiving explicit instructions from the human.

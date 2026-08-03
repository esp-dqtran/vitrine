# Project working rules

## Product naming

- The product name is **Vitrines**, not Astryx.
- Use **Vitrines** in user-facing copy, product discussions, marketing, documentation, and new UI text.
- The repository directory may remain named `Astryx`; treat that as a filesystem path only, not the current product name.
- Do not rename existing files, symbols, environment variables, or infrastructure identifiers solely for this naming rule unless the user explicitly requests a migration.

## Superpowers skill policy

- Do not automatically invoke or follow any `superpowers:*` skill.
- Treat Superpowers skills as opt-in. Use one only when the user explicitly asks for that specific skill or explicitly requests the Superpowers workflow.
- For ordinary tasks, execute the request directly without adding Superpowers brainstorming, specification, planning, worktree, or subagent steps.

## Git branch and worktree policy

- Work directly on the `main` branch for this project.
- Do not create or switch to a feature branch unless the user explicitly requests one.
- Do not initialize, add, or use a Git worktree unless the user explicitly requests one.
- Before editing files, verify that the current branch is `main`. If it is not, switch to `main` only when the existing working-tree changes can be preserved safely; otherwise stop and tell the user.
- Do not commit or push automatically. Commit or push `main` only when the user requests it.

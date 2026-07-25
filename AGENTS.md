# Project working rules

## Git branch and worktree policy

- Work directly on the `main` branch for this project.
- Do not create or switch to a feature branch unless the user explicitly requests one.
- Do not initialize, add, or use a Git worktree unless the user explicitly requests one.
- Before editing files, verify that the current branch is `main`. If it is not, switch to `main` only when the existing working-tree changes can be preserved safely; otherwise stop and tell the user.
- Do not commit or push automatically. Commit or push `main` only when the user requests it.

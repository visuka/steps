# Steps — project instructions for Claude Code

Claude Code reads AGENTS.md only when no CLAUDE.md exists. This import keeps its Expo instructions loaded:

@AGENTS.md

## Visual design

- **Follow `.claude/rules/visual-design.md`** for any change to how the app looks: screens, components, mockups and theme values. Claude Code loads it automatically in every session.
- **Exact values:**
  - approved per-element values: `docs/design.md`;
  - the same values in code: `src/components/plain/plain-theme.ts`.
- **Why some general design advice is set aside** for this app: `docs/design-rules-audit.md`.
- **A new design wish never overrides these rules on its own.** Ask the owner before breaking one.

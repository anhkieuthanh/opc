# Concerns and Technical Debt

- **Integration**: `paperclip` and `nanobot` are currently separate cloned repositories. They need to be integrated so that `paperclip` can manage `nanobot` instances effectively.
- **Complexity**: `nanobot` has many chat channel integrations which might overlap or conflict with `paperclip`'s control plane.
- **Duplication**: Both have their own UI and CLI tools.
- **Dependencies**: Differing environments (Node.js vs Python) require dual environment setup (pnpm + uv).

[Português](CONTRIBUTING.md) | **English**

# How to contribute to GeradorOne

Thank you for your interest. This guide explains the workflow and the rules that apply to any change.

## Workflow

1. For a bug or an idea, open an issue describing the problem or the proposal. For large changes, wait for the discussion in the issue before starting.
2. Fork the repository, create a branch from `main`, and work on it.
3. Open a pull request to `main`, explaining what changed and how you tested it. Mention the related issue.

## Rules

- **Commits in Portuguese**, in the `feat:`, `fix:`, or `docs:` style (for example, `fix: corrige o filtro da BNCC por ano`).
- **Tests:** run `npm test` before opening the PR. It starts a disposable Postgres in Docker, so Docker must be available. A behavior change comes with a test.
- **No secrets:** never include `.env`, API keys, passwords, or `APP_SECRET` in commits, issues, or PRs.
- **Language:** interface, error messages, comments, documentation, and test names in Brazilian Portuguese.
- **Interface:** the visual design follows [docs/DESIGN.en.md](docs/DESIGN.en.md) and the tokens in `public/design.css`; row actions use icon-only buttons, as in [docs/PADRAO_ICONES.en.md](docs/PADRAO_ICONES.en.md). Check the six themes and the phone screen.
- **Strict CSP:** no `style=` and no inline scripts. API addresses are relative and have no leading slash (`'api/projects'`).
- **Documentation:** if you change routes, flows, or the structure, update [docs/CODEBASE_MAP.md](docs/CODEBASE_MAP.md) ([English version](docs/CODEBASE_MAP.en.md)). If you change a button or flow in the interface, update the FAQ in `public/faq-data.js`.
- **Data:** do not invent BNCC codes, sources, norms, or citations.

## License of contributions

The project is licensed under the [AGPL-3.0](LICENSE). By submitting a contribution, you agree that it is distributed under the same license.

# LupinOS

A portfolio built as a made-up desktop operating system, plus the component library it runs on.

| Folder | What it is |
| --- | --- |
| `packages/ui` | **@lupinos/ui**: windows, dock, menu bar, menus, command palette, notifications, icons and seven themes for React. Installable on its own. |
| `apps/site` | The LupinOS portfolio: an Astro site with one React island that uses the package. |

## Use the components

```bash
npm install @lupinos/ui
```

See [packages/ui/README.md](packages/ui/README.md) for setup, themes and every component.

## Work on this repo

```bash
pnpm install
pnpm dev        # the site at http://localhost:4321, using the package source directly
pnpm test       # package and site tests
pnpm typecheck
pnpm build      # builds the package to packages/ui/dist, then the site
```

To publish the package: `pnpm --filter @lupinos/ui build`, then `pnpm --filter @lupinos/ui publish`. Inside the repo the site imports the package source; the published package ships the compiled `dist` with type definitions.

## License

MIT

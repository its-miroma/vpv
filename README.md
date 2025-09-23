# VitePress Versions

[![NPM](https://img.shields.io/npm/v/vitepress-versions.svg)](https://www.npmjs.com/package/vitepress-versions)

Build and deploy multiple versions of your VitePress documentation.

`vitepress-versions` is a command-line tool that automates the discovery and building of versioned VitePress sites, with support for sourcing versions from Git [branches](https://github.com/its-miroma/vpv-branch), [tags](https://github.com/its-miroma/vpv-tag), or local [folders](https://github.com/its-miroma/vpv-folder).

> [!CAUTION]
>
> This package is still alpha software, not yet suitable for production.
>
> Use at your own risk.

## Installation

Requires Node >= 20.

```sh
$ pnpm install -D vitepress-versions
```

Add the scripts to `package.json`:

```json
"scripts": {
  "docs:build:versions": "vitepress-versions build",
  "docs:list:versions": "vitepress-versions list"
}
```

## Quick Start

1. **Create a Config File**

   Create a config file at `.vitepress/versions.ts`. Choose the mode you want to use. Code sense will help complete available options.

   This example uses Git tags as the source for versions.

   ```ts
   import { defineVersionsConfig } from "vitepress-versions";

   export default defineVersionsConfig({
     mode: "tag",

     /**
      * The sorting strategy for versions.
      *
      * 'num_desc' is default for tags.
      */
     sortStrategy: "num_desc",

     /**
      * Glob patterns to include Git tags.
      *
      * Example: only include tags with prefix `v-`.
      */
     include: ["refs/tags/v-*"],

     /**
      * Glob patterns or regex to exclude.
      *
      * Example: exclude release candidates.
      */
     exclude: [/.*-rc.*/],

     /**
      * The tag that should be considered the "latest" release.
      *
      * By default: the first version after sorting with `sortStrategy`.
      */
     latestVersion: "refs/tags/v2.1.0",
   });
   ```

2. **List and Build Versions**

   You can check which versions the tool was able to discover:

   ```sh
   npm run docs:list:versions
   ```

   Then, build all discovered versions:

   ```sh
   npm run docs:build:versions
   ```

   Your versioned site will be built into `.vitepress/dist/`.

## Known Issues

- There is no nav bar item for selecting a version by default
- There is no warning banner for outdated versions by default
- Outdated pages are not hidden from search by default
- There is no way to build a single version except the default
- There is no way of accessing version data from the theme / content
  - There is no way of knowing in which versions a page is available
- There is no official way of adding a custom Mode
- There is no caching of built versions
- There is no support for `vitepress dev` with versions
- There are no tests for the source code
- The CLI has only been tested on Linux

## Thank You

I want to thank a few people for their valuable help and inspiration:

- [@IMB11](https://github.com/IMB11), for the original `vitepress-versioning-plugin`
- [@kevinthegreat1](https://github.com/kevinthegreat1), for the script `build_by_version`

## Contributing

Thank you for your interest!

However, I'm not accepting PRs yet because the project is still shaping up.

## License

[MIT](./LICENSE)

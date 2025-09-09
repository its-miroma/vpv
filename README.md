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

Add the script to your `package.json`:

```json
"scripts": {
  "docs:build:versions": "vitepress-versions build"
}
```

## Quick Start

1. **Create a Config File**

   Create a config file at `.vitepress/versions.ts`. Choose the mode you want to use. Code sense will help complete available options.

   This example uses Git tags (like `v1.0.2`, `v2.1.0`) as the source for versions.

   ```ts
   import { defineVersionsConfig } from "vitepress-versions";

   export default defineVersionsConfig({
     mode: "tag",

     /**
      * The sorting strategy for versions.
      * 'num_desc' is default for tags.
      */
     sortStrategy: "num_desc",

     /**
      * Glob patterns to include Git tags.
      */
     include: ["refs/tags/v*"],

     /**
      * Glob patterns or regex to exclude.
      * Exclude release candidates.
      */
     exclude: [/.*-rc.*/],

     /**
      * The tag that should be considered the "latest" stable release.
      * By default, it's the first version after sorting.
      */
     latestVersion: "refs/tags/v2.1.0",

     /**
      * The version to build at the root (`/`) of your site.
      * Defaults to the `latestVersion`.
      */
     defaultVersion: "refs/tags/v2.1.0",
   });
   ```

2. **List and Build Versions**

   You can check which versions the tool discovers:

   ```sh
   npm run docs:versions:list
   ```

   Then, build all discovered versions:

   ```sh
   npm run docs:versions:build
   ```

   Your versioned site will be built into `.vitepress/dist/`.

## Known Issues

- There is currently no way to edit the Vitepress SiteConfig before build
  - There is no nav bar item for selecting a version
  - There is no way to add a warning banner for outdated versions
  - There is no way to hide outdated pages from search
- There is no way of accessing version data from the theme / content
  - There is no way of knowing in which versions a page is available
- There is no official way of adding a custom Mode
- There is no caching of built versions
- There is no support for `vitepress dev` with versions
- There is no way to choose a base for the default version
- There are no tests for the source code

## Thank You

I want to thank a few people for their valuable help and inspiration:

- [@IMB11](https://github.com/IMB11), for the original `vitepress-versioning-plugin`
- [@kevinthegreat1](https://github.com/kevinthegreat1), for the script `build_by_version`

## Contributing

Thank you for your interest!

However, I'm not accepting PRs yet because the project is still shaping up.

## License

[MIT](./LICENSE)

# MyInsta Web Translations

This repository contains the public strings used by the MyInsta website. The
website application remains in a private repository; this repository contains
no application code, release files, media, database exports, analytics, or
credentials.

[Official website](https://myinsta.dev) · [Crowdin translation project](https://crowdin.com/project/myinsta-web)

## What is here

- `messages/en/` is the reviewable English UI source, split into the five UI
  namespaces used by the site.
- `messages/<locale>/` contains contributor drafts with the same key and ICU
  structure as English.
- `translations/source/ui.json` and `translations/<locale>/ui.json` are the
  namespace keyed files consumed by Crowdin and the private importer.
- `translations/source/en.json` and `translations/manifest.json` contain the
  reviewed static privacy source/catalog. The published CMS export is still
  pending; no private CMS content is copied into this repository.
- `translations/source/html/**/*.html` contains the static privacy policy body and
  is reserved for future published rich-content exports. HTML translations
  live under each locale's `html/` directory and are checked for markup and
  protected `code`/`pre` literals by the private importer.
- `scripts/validate-catalogs.mjs` checks keys, types, ICU placeholders,
  plural/select branches, markup, and protected product terms.

Every non-English file is an **unapproved draft**. Draft files are useful for
review and Crowdin seeding; they do not activate a locale on the website.
Production imports require a current public source hash, complete entity
coverage, and Crowdin approval records. Native-speaker and legal review remain
required before launch.

## Crowdin

`crowdin.yml` has three source groups:

1. the CMS JSON source at `translations/source/en.json`,
2. one CMS HTML source file per rich-content key under
   `translations/source/html/`, and
3. the public UI source at `translations/source/ui.json`.

Crowdin exports are configured as approved-only and keeps source changes
unapproved. The private application pins a public repository commit, verifies
the source hash, checks every approval, and imports the result atomically.
Tokens are supplied through the private deployment environment and are never
stored here.

After source files merge to public `main`,
`.github/workflows/crowdin-sources.yml` uploads the active source groups using
the repository secret `CROWDIN_SOURCE_TOKEN`. Scope that token to Crowdin
project `937181` for source uploads. The workflow never downloads translations,
approves translations, or creates a translation pull request; keep this token
separate from private publisher, importer, and draft credentials.
Manual dispatch is accepted only from the reviewed `main` ref, and the checkout
does not persist a GitHub token in the repository configuration.

The public source refresh is reviewed on a branch such as
`sync/translations/public-source`. Do not merge a generated source refresh or
approve a translation in the same change without a qualified reviewer.

## Local checks

Requires Node.js 20 or newer. No package install is needed.

```bash
node scripts/validate-catalogs.mjs
```

The draft seeder refreshes the UI source manifest and preserves existing locale
values. It leaves the separately exported CMS source and manifest unchanged,
and only reads this repository's English files for newly missing UI keys:

```bash
node scripts/seed-ui-drafts.mjs
```

All 11 configured locale catalogs contain complete draft trees for the 313 UI
strings. Some draft values remain in English while contributors refine wording;
the validator reports those as expected unchanged-value warnings. Every locale
remains explicitly unapproved and requires native review before launch.

## Adding a translation

Read [CONTRIBUTING.md](CONTRIBUTING.md), preserve placeholders and markup, and
run the validator before opening a pull request. Use
[GLOSSARY.md](GLOSSARY.md) for product terms. Changes to public source strings
must include the corresponding source hash and should be produced by the
private export workflow rather than by copying private application files.

See [TRANSLATION_STATUS.md](TRANSLATION_STATUS.md) for the current rollout
state.

## License

The catalog files, documentation, and validation scripts in this repository
are released under the MIT License. See [LICENSE](LICENSE). The license here
does not grant access to the private MyInsta application, its release assets,
or third-party content referenced by translated strings.

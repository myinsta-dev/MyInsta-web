# Contributing translations

Thank you for helping translate MyInsta. Contributions in this repository are
public catalog data and are reviewed before they can be used by the website.

## Before editing

1. Choose one configured locale directory: `pt-BR`, `es`, `id`, `tr`, `fil`,
   or `de`.
2. Read [GLOSSARY.md](GLOSSARY.md).
3. Use the English file in `messages/en/` as the source of truth. Keep the
   object shape, key spelling, ICU syntax, and required markup unchanged.

## Translation rules

- Keep every `{placeholder}` byte-for-byte identical. For plural and select
  messages, keep the variable name, branch names, offset, and `#` marker.
- Keep HTML tags and attributes in the same order. Do not translate text in
  `code` or `pre` content, URLs, ABI names, checksums, or other protected
  literals.
- Rich content is stored as one HTML file per public key under
  `translations/source/html/`. Keep its matching locale file's tag structure
  and protected literals intact; the private importer reconstructs it only
  after every translatable segment has an approval.
- Keep `MyInsta`, `Instagram`, `Android`, `APK`, `ABI`, `ARM64`, `ARM32`,
  `x86`, `x86_64`, `SHA-256`, `Google Play`, and `Play Store` unchanged unless
  the glossary explicitly gives a localized display form.
- Translate for the UI context. Short buttons, headings, error messages, and
  accessible labels may need different wording even when their English text
  is similar.
- Keep sentences concise enough for mobile layouts. Flag a likely overflow
  in the pull request instead of shortening a protected term.
- Do not translate legal or security copy by machine translation alone. A
  native speaker with the appropriate subject knowledge must review it.

## Validation

Run:

```bash
node scripts/validate-catalogs.mjs
```

Warnings for unchanged English strings are expected in draft files. Structural
errors are not expected and must be fixed before review. A passing validator
does not certify fluency, cultural fit, legal wording, or visual fit.

## Review and approval

Open a pull request with the locale and namespaces changed. Crowdin is the
translation workspace; its approval records are the authority for production
imports. A contributor must not approve their own translation. The website
will continue to use English for a locale until the private importer confirms
current source hashes, complete coverage for an entity, and approval records.

Do not add tokens, private URLs, database IDs, screenshots, release assets, or
application source code to this repository.

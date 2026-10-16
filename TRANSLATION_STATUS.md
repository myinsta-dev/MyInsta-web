# Translation rollout status

The catalog seed covers the UI namespaces for the target languages selected
from the country distribution review. All rows below are **draft only**. All
6 locale catalogs contain complete draft trees for the 308 UI strings. The
translated wording is still under review; `translations/draft-status.json`
records `keyCoverage: "complete"`, `translation: "needs-review"`, and
`nativeReview: "needs-review"` for every locale. Validator warnings for
unchanged English values are intentional for autonyms, product and technical
terms, placeholders, and labels that should remain unchanged.

| Locale | UI source | Draft file | Approval | Website launch |
| --- | --- | --- | --- | --- |
| `pt-BR` | Current | `translations/pt-BR/ui.json` | Unapproved; native review required | Not launched |
| `es` | Current | `translations/es/ui.json` | Unapproved; native review required | Not launched |
| `id` | Current | `translations/id/ui.json` | Unapproved; native review required | Not launched |
| `tr` | Current | `translations/tr/ui.json` | Unapproved; native review required | Not launched |
| `fil` | Current | `translations/fil/ui.json` | Unapproved; native review required | Not launched |
| `de` | Current | `translations/de/ui.json` | Unapproved; native review required | Not launched |

The draft seed preserves populated locale values and refreshes only missing
keys. Each locale has a draft value for all 308 UI strings; unchanged values
that the validator reports are intentional where the source term, placeholder,
or label should remain the same. Crowdin contributors should still complete
native and legal review for each namespace before a locale is considered for
launch.

The published CMS source contains 158 JSON entries (225 string leaves) and
10 HTML files, including both blogs, seven release changelogs and installation
instructions, and the privacy policy. Each retained locale has a complete
initial AI translation draft for this content. The CMS source hash is recorded
in `translations/draft-status.json`; these drafts remain unapproved and require
native and legal review before the private approved-only importer can use them.

Only published public strings are exported. Private drafts, database IDs,
credentials, media, and analytics are excluded from this repository.

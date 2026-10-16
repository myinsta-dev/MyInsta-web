# Translation rollout status

The catalog seed covers the UI namespaces for the target languages selected
from the country distribution review. All rows below are **draft only**. All
11 locale catalogs contain complete draft trees for the 313 UI strings. The
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
| `fr` | Current | `translations/fr/ui.json` | Unapproved; native review required | Not launched |
| `ar` | Current | `translations/ar/ui.json` | Unapproved; native review required | Not launched |
| `ru` | Current | `translations/ru/ui.json` | Unapproved; native review required | Not launched |
| `ja` | Current | `translations/ja/ui.json` | Unapproved; native review required | Not launched |
| `ko` | Current | `translations/ko/ui.json` | Unapproved; native review required | Not launched |

The draft seed preserves populated locale values and refreshes only missing
keys. Each locale has a draft value for all 313 UI strings; unchanged values
that the validator reports are intentional where the source term, placeholder,
or label should remain the same. Crowdin contributors should still complete
native and legal review for each namespace before a locale is considered for
launch.

The public content source currently contains only the static privacy policy
catalog: title and SEO fields in `translations/source/en.json`, plus its rich
HTML body under `translations/source/html/`. The production CMS export remains
pending and will be added only through the reviewed private export workflow.
Private posts, pages, release metadata, IDs, media, and analytics are excluded
from this repository.

import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const locales = ["pt-BR", "es", "id", "tr", "fil", "de", "fr", "ar", "ru", "ja", "ko"];
const files = ["Blog.json", "Common.json", "Home.json", "releases.json", "search.json"];
const namespaces = ["Blog", "Common", "Home", "Releases", "Search"];
const protectedTerms = ["MyInsta", "Instagram", "APK", "Android", "ABI", "ARM64", "ARM32", "x86", "x86_64", "SHA-256", "Google Play", "Play Store"];
const errors = [];
const warnings = [];

function error(message) {
  errors.push(message);
}

function warning(message) {
  warnings.push(message);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (cause) {
    error(`Invalid JSON: ${path}: ${cause instanceof Error ? cause.message : String(cause)}`);
    return undefined;
  }
}

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`)
      .join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

function hash(value) {
  return createHash("sha256").update(stableJson(value)).digest("hex");
}

function namespaceFor(file) {
  if (file === "releases.json") return "Releases";
  if (file === "search.json") return "Search";
  return file.slice(0, -5);
}

async function loadCatalog(directory) {
  const result = {};
  for (const file of files) {
    const value = await readJson(join(root, directory, file));
    if (value === undefined) continue;
    result[namespaceFor(file)] = value;
  }
  return result;
}

async function listFiles(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map((entry) => {
      const path = join(directory, entry.name);
      return entry.isDirectory() ? listFiles(path) : [path];
    }));
    return nested.flat();
  } catch {
    return [];
  }
}

function valueType(value) {
  if (Array.isArray(value)) return "array";
  if (value === null) return "null";
  return typeof value;
}

function leaves(value, path = []) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return Object.entries(value).flatMap(([key, item]) => leaves(item, [...path, key]));
  }
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => leaves(item, [...path, String(index)]));
  }
  return [{ path: path.join("."), value }];
}

function multiset(values) {
  return [...values].sort().join("\u0000");
}

function icuShape(value) {
  const placeholders = [...value.matchAll(/\{([A-Za-z][A-Za-z0-9_.-]*)(?=\s*(?:,|}))/g)].map((match) => match[1]);
  const branches = [...value.matchAll(/(=\d+|zero|one|two|few|many|other|male|female)\s*\{/g)].map((match) => match[1]);
  const tags = [...value.matchAll(/<\/?([A-Za-z][A-Za-z0-9-]*)\b[^>]*>/g)].map((match) => match[1]);
  return { placeholders, branches, tags, pounds: (value.match(/#/g) ?? []).length };
}

function compareValues(source, target, locale, file, path, allowKeyDrift = false) {
  if (valueType(source) !== valueType(target)) {
    error(`${locale}/${file}:${path}: type differs (${valueType(source)} vs ${valueType(target)})`);
    return;
  }
  if (typeof source === "string") {
    if (!target.trim()) error(`${locale}/${file}:${path}: empty translation`);
    const expected = icuShape(source);
    const actual = icuShape(target);
    if (multiset(expected.placeholders) !== multiset(actual.placeholders)) {
      error(`${locale}/${file}:${path}: ICU placeholders differ`);
    }
    if (multiset(expected.branches) !== multiset(actual.branches)) {
      error(`${locale}/${file}:${path}: plural/select branches differ`);
    }
    if (expected.pounds !== actual.pounds) error(`${locale}/${file}:${path}: # marker count differs`);
    if (multiset(expected.tags) !== multiset(actual.tags)) error(`${locale}/${file}:${path}: markup tags differ`);
    for (const term of protectedTerms) {
      const sourceCount = source.split(term).length - 1;
      const targetCount = target.split(term).length - 1;
      if (targetCount < sourceCount) error(`${locale}/${file}:${path}: protected term missing: ${term}`);
    }
    if (source === target) warning(`${locale}/${file}:${path}: unchanged English draft`);
    return;
  }
  if (source && typeof source === "object") {
    const sourceKeys = Object.keys(source).sort();
    const targetKeys = Object.keys(target).sort();
    if (stableJson(sourceKeys) !== stableJson(targetKeys)) {
      if (!allowKeyDrift) {
        error(`${locale}/${file}:${path || "(root)"}: keys differ`);
        return;
      }
      const sourceKeySet = new Set(sourceKeys);
      const targetKeySet = new Set(targetKeys);
      for (const key of sourceKeys) {
        if (!targetKeySet.has(key)) warning(`${locale}/${file}:${path || "(root)"}: missing key in stale CMS draft: ${key}`);
      }
      for (const key of targetKeys) {
        if (!sourceKeySet.has(key)) warning(`${locale}/${file}:${path || "(root)"}: obsolete key in stale CMS draft: ${key}`);
      }
    }
    for (const key of sourceKeys) {
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        compareValues(source[key], target[key], locale, file, path ? `${path}.${key}` : key, allowKeyDrift);
      }
    }
  }
}

function htmlTags(value) {
  return [...value.matchAll(/<\/?\s*([A-Za-z][A-Za-z0-9-]*)\b[^>]*>/g)].map((match) => match[1].toLowerCase());
}

function htmlAttributes(value) {
  return [...value.matchAll(/<\s*([A-Za-z][A-Za-z0-9-]*)\b([^<>]*?)>/g)].map((match) => {
    const attributes = [];
    const source = match[2].replace(/\s+\/\s*$/, "");
    const pattern = /([A-Za-z_:][A-Za-z0-9:._-]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
    for (const attribute of source.matchAll(pattern)) {
      attributes.push([attribute[1].toLowerCase(), attribute[2] ?? attribute[3] ?? attribute[4] ?? null]);
    }
    return { tag: match[1].toLowerCase(), attributes };
  });
}

function protectedHtmlLiterals(value) {
  return [...value.matchAll(/<(code|pre)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]);
}

function protectedHtmlTerms(value) {
  const text = value.replace(/<[^>]*>/g, " ");
  return protectedTerms.flatMap((term) => {
    const count = text.split(term).length - 1;
    return Array.from({ length: count }, () => term);
  });
}

async function validateHtmlSources() {
  const sourceRoot = join(root, "translations", "source", "html");
  const sourceFiles = (await listFiles(sourceRoot)).filter((path) => path.endsWith(".html"));
  for (const sourcePath of sourceFiles) {
    const relative = sourcePath.slice(sourceRoot.length + 1);
    const source = await readFile(sourcePath, "utf8");
    if (htmlTags(source).length === 0) warning(`HTML source has no tags: translations/source/html/${relative}`);
    for (const locale of locales) {
      const targetPath = join(root, "translations", locale, "html", relative);
      try {
        const target = await readFile(targetPath, "utf8");
        if (stableJson(htmlTags(source)) !== stableJson(htmlTags(target))) error(`${locale}/html/${relative}: markup tags differ`);
        if (stableJson(htmlAttributes(source)) !== stableJson(htmlAttributes(target))) error(`${locale}/html/${relative}: HTML attributes differ`);
        if (stableJson(protectedHtmlLiterals(source)) !== stableJson(protectedHtmlLiterals(target))) error(`${locale}/html/${relative}: code/pre literal changed`);
        const sourceTerms = protectedHtmlTerms(source);
        const targetTerms = protectedHtmlTerms(target);
        for (const term of new Set(sourceTerms)) {
          if (targetTerms.filter((item) => item === term).length < sourceTerms.filter((item) => item === term).length) {
            error(`${locale}/html/${relative}: protected product literal changed: ${term}`);
          }
        }
      } catch {
        warning(`${locale}/html/${relative}: draft is missing until CMS content is reviewed`);
      }
    }
  }
}

async function validateContentManifest(manifest, sourceContent) {
  if (!Array.isArray(manifest?.entries)) {
    error("translations/manifest.json is missing its entries list");
    return;
  }
  for (const entry of manifest.entries) {
    const sourcePath = entry?.sourcePath;
    if (
      typeof sourcePath !== "string" ||
      !sourcePath.startsWith("translations/source/") ||
      sourcePath.includes("\\") ||
      sourcePath.includes("..")
    ) {
      error(`translations/manifest.json has an unsafe entry source path: ${String(sourcePath)}`);
      continue;
    }
    let content;
    try {
      content = await readFile(join(root, sourcePath), "utf8");
    } catch (cause) {
      error(`translations/manifest.json entry source is missing: ${sourcePath}`);
      continue;
    }
    if (entry.format !== "html" && (!sourceContent || Object.keys(sourceContent).length === 0)) continue;
    const value = entry.format === "html" ? content : sourceContent?.[entry.key];
    if (value === undefined) {
      error(`translations/manifest.json entry is missing source content: ${entry.key}`);
      continue;
    }
    if (entry.sourceHash !== hash(value)) {
      error(`translations/manifest.json entry source hash is stale: ${entry.key}`);
    }
  }
}

function combineCatalogMessages(catalog) {
  return Object.fromEntries(namespaces.map((namespace) => [namespace, catalog[namespace]]));
}

async function main() {
  const english = await loadCatalog(join("messages", "en"));
  for (const namespace of namespaces) {
    if (!(namespace in english)) error(`messages/en is missing namespace ${namespace}`);
  }
  const sourceUi = await readJson(join(root, "translations", "source", "ui.json"));
  if (sourceUi && stableJson(sourceUi) !== stableJson(english)) error("translations/source/ui.json does not match messages/en");

  const manifest = await readJson(join(root, "translations", "manifest.json"));
  const status = await readJson(join(root, "translations", "draft-status.json"));
  const sourceContent = await readJson(join(root, "translations", "source", "en.json"));
  if (sourceContent && Object.keys(sourceContent).length === 0) warning("translations/source/en.json is empty until the private published CMS export is reviewed");
  const hasSourceContent = sourceContent && typeof sourceContent === "object" && !Array.isArray(sourceContent) && Object.keys(sourceContent).length > 0;
  await validateContentManifest(manifest, sourceContent);

  for (const locale of locales) {
    const targetContent = await readJson(join(root, "translations", locale, "en.json"));
    const cmsMarker = status?.locales?.[locale]?.cms;
    const cmsIsCurrent = cmsMarker?.sourceContentHash === manifest?.sourceContentHash && cmsMarker?.keyCoverage === "complete";
    if (hasSourceContent && !cmsIsCurrent) warning(`${locale}/en.json: CMS draft marker is stale or missing`);
    if (hasSourceContent && targetContent !== undefined) compareValues(sourceContent, targetContent, locale, "en.json", "", !cmsIsCurrent);
    const target = await loadCatalog(join("messages", locale));
    for (const file of files) {
      compareValues(
        english[namespaceFor(file)],
        target[namespaceFor(file)],
        locale,
        file,
        "",
      );
    }
    const targetUi = await readJson(join(root, "translations", locale, "ui.json"));
    if (targetUi && stableJson(targetUi) !== stableJson(target)) error(`translations/${locale}/ui.json does not match messages/${locale}`);
  }

  if (manifest) {
    if (manifest.sourceFile !== "translations/source/en.json" || manifest.sourceLocale !== "en" || manifest.schemaVersion !== 1) error("translations/manifest.json has an invalid source contract");
    if (stableJson(manifest.locales) !== stableJson(["en", ...locales])) error("translations/manifest.json locale list is out of date");
    if (manifest.sourceContentHash !== hash(sourceContent ?? {})) error("translations/manifest.json source hash is stale");
  }
  const uiManifest = await readJson(join(root, "translations", "ui-manifest.json"));
  if (uiManifest) {
    if (uiManifest.sourceFile !== "translations/source/ui.json" || uiManifest.sourceLocale !== "en" || uiManifest.schemaVersion !== 1) error("translations/ui-manifest.json has an invalid source contract");
    if (stableJson(uiManifest.namespaces) !== stableJson(namespaces.slice().sort())) error("translations/ui-manifest.json namespace list is out of date");
    if (uiManifest.sourceContentHash !== hash(sourceUi ?? {})) error("translations/ui-manifest.json source hash is stale");
  }
  if (!status || status.approvalPolicy !== "unapproved") error("translations/draft-status.json must keep all seeded files unapproved");
  if (status && stableJson(Object.keys(status.locales ?? {}).sort()) !== stableJson(locales.slice().sort())) error("translations/draft-status.json locale list is out of date");
  for (const locale of locales) {
    const marker = status?.locales?.[locale];
    if (
      marker?.approved !== false ||
      marker?.status !== "DRAFT" ||
      marker?.nativeReviewRequired !== true ||
      marker?.keyCoverage !== "complete" ||
      marker?.translation !== "needs-review" ||
      marker?.nativeReview !== "needs-review"
    ) error(`draft status for ${locale} is not explicitly unapproved`);
  }
  await validateHtmlSources();

  const expectedFiles = new Set(["en", ...locales]);
  const messageDirs = await readdir(join(root, "messages"), { withFileTypes: true });
  for (const entry of messageDirs) if (entry.isDirectory() && !expectedFiles.has(entry.name)) error(`unexpected messages locale directory: ${entry.name}`);
  if (errors.length) {
    for (const item of errors) console.error(`ERROR ${item}`);
    process.exitCode = 1;
  }
  for (const item of warnings) console.warn(`WARN ${item}`);
  console.log(`Validated ${locales.length} unapproved locales against ${leaves(english).length} UI strings: ${errors.length} errors, ${warnings.length} warnings.`);
}

await main();

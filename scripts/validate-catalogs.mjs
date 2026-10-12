import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { join } from "node:path";

const root = new URL("..", import.meta.url).pathname;
const locales = ["hi", "pt-BR", "es", "id", "tr", "fil", "de", "fr", "ar", "ru", "bn", "ja", "ko"];
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

function compareValues(source, target, locale, file, path) {
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
      if (source.includes(term) && !target.includes(term)) error(`${locale}/${file}:${path}: protected term missing: ${term}`);
    }
    if (source === target) warning(`${locale}/${file}:${path}: unchanged English draft`);
    return;
  }
  if (source && typeof source === "object") {
    const sourceKeys = Object.keys(source).sort();
    const targetKeys = Object.keys(target).sort();
    if (stableJson(sourceKeys) !== stableJson(targetKeys)) {
      error(`${locale}/${file}:${path || "(root)"}: keys differ`);
      return;
    }
    for (const key of sourceKeys) compareValues(source[key], target[key], locale, file, path ? `${path}.${key}` : key);
  }
}

function htmlTags(value) {
  return [...value.matchAll(/<\/?\s*([A-Za-z][A-Za-z0-9-]*)\b[^>]*>/g)].map((match) => match[1].toLowerCase());
}

function protectedHtmlLiterals(value) {
  return [...value.matchAll(/<(code|pre)\b[^>]*>([\s\S]*?)<\/\1>/gi)].map((match) => match[2]);
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
        if (stableJson(protectedHtmlLiterals(source)) !== stableJson(protectedHtmlLiterals(target))) error(`${locale}/html/${relative}: code/pre literal changed`);
      } catch {
        warning(`${locale}/html/${relative}: draft is missing until CMS content is reviewed`);
      }
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

  const sourceContent = await readJson(join(root, "translations", "source", "en.json"));
  if (sourceContent && Object.keys(sourceContent).length === 0) warning("translations/source/en.json is empty until the private published CMS export is reviewed");

  for (const locale of locales) {
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

  const manifest = await readJson(join(root, "translations", "manifest.json"));
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
  const status = await readJson(join(root, "translations", "draft-status.json"));
  if (!status || status.approvalPolicy !== "unapproved") error("translations/draft-status.json must keep all seeded files unapproved");
  for (const locale of locales) {
    if (status?.locales?.[locale]?.approved !== false || status?.locales?.[locale]?.status !== "DRAFT") error(`draft status for ${locale} is not explicitly unapproved`);
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

import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const CROWDIN_PROJECT_ID = 937181;

const REPOSITORY_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const LOCALE_MAPPING = {
  two_letters_code: {
    pt: "pt-BR",
    tl: "fil",
  },
};
const COMMON_FILE_OPTIONS = {
  update_option: "update_as_unapproved",
  skip_untranslated_strings: true,
  export_only_approved: true,
  languages_mapping: LOCALE_MAPPING,
};

function fail(message) {
  throw new Error(`Crowdin source configuration is invalid: ${message}`);
}

async function readJson(path) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail(`could not read JSON at ${path}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function repositoryPath(root, repositoryFile) {
  if (
    typeof repositoryFile !== "string" ||
    !repositoryFile.startsWith("translations/source/") ||
    repositoryFile.includes("\\") ||
    repositoryFile.includes("..")
  ) {
    fail(`manifest source path is not a safe source path: ${String(repositoryFile)}`);
  }
  const absolute = resolve(root, repositoryFile);
  const rootRelative = relative(root, absolute);
  if (rootRelative === ".." || rootRelative.startsWith(`..${sep}`)) {
    fail(`manifest source path escapes the repository: ${repositoryFile}`);
  }
  return absolute;
}

function manifestSource(manifest, expectedFile, manifestName) {
  if (!manifest || typeof manifest !== "object" || manifest.sourceFile !== expectedFile) {
    fail(`${manifestName} must point to ${expectedFile}`);
  }
  return manifest.sourceFile;
}

async function regularFile(path, description) {
  try {
    const details = await stat(path);
    if (!details.isFile()) fail(`${description} is not a regular file`);
  } catch (error) {
    fail(`${description} is missing: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function listHtmlFiles(directory) {
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    const nested = await Promise.all(entries.map(async (entry) => {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) return listHtmlFiles(path);
      return entry.isFile() && entry.name.endsWith(".html") ? [path] : [];
    }));
    return nested.flat().sort();
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "ENOENT") return [];
    throw error;
  }
}

function jsonSourceEntry(sourceFile, targetFile) {
  return {
    source: `/${sourceFile}`,
    translation: `/translations/%two_letters_code%/${targetFile}`,
    type: "json",
    ...COMMON_FILE_OPTIONS,
  };
}

export async function prepareCrowdinSources({ root = REPOSITORY_ROOT } = {}) {
  const uiManifest = await readJson(resolve(root, "translations/ui-manifest.json"));
  const contentManifest = await readJson(resolve(root, "translations/manifest.json"));
  const uiSourceFile = manifestSource(uiManifest, "translations/source/ui.json", "ui-manifest.json");
  const contentSourceFile = manifestSource(contentManifest, "translations/source/en.json", "manifest.json");

  const uiSourcePath = repositoryPath(root, uiSourceFile);
  await regularFile(uiSourcePath, uiSourceFile);
  const uiSource = await readJson(uiSourcePath);
  if (!uiSource || typeof uiSource !== "object" || Array.isArray(uiSource) || Object.keys(uiSource).length === 0) {
    fail("translations/source/ui.json must contain at least one namespace");
  }

  const files = [jsonSourceEntry(uiSourceFile, "ui.json")];
  const contentSourcePath = repositoryPath(root, contentSourceFile);
  await regularFile(contentSourcePath, contentSourceFile);
  const contentSource = await readJson(contentSourcePath);
  if (contentSource && typeof contentSource === "object" && !Array.isArray(contentSource) && Object.keys(contentSource).length > 0) {
    files.unshift(jsonSourceEntry(contentSourceFile, "en.json"));
  }

  const htmlRoot = resolve(root, "translations/source/html");
  for (const htmlPath of await listHtmlFiles(htmlRoot)) {
    const htmlRelative = relative(htmlRoot, htmlPath).split(sep).join("/");
    files.push({
      source: `/translations/source/html/${htmlRelative}`,
      translation: `/translations/%two_letters_code%/html/${htmlRelative}`,
      type: "html",
      translate_content: true,
      ...COMMON_FILE_OPTIONS,
    });
  }

  return {
    project_id: CROWDIN_PROJECT_ID,
    base_path: ".",
    preserve_hierarchy: true,
    files,
  };
}

async function main() {
  const outputIndex = process.argv.indexOf("--output");
  const output = outputIndex >= 0 ? process.argv[outputIndex + 1] : undefined;
  if (!output) fail("--output is required");
  const config = await prepareCrowdinSources();
  await mkdir(dirname(resolve(output)), { recursive: true });
  await writeFile(output, `${JSON.stringify(config, null, 2)}\n`, "utf8");
  console.log(`Prepared ${config.files.length} active Crowdin source file group(s).`);
}

const invokedPath = process.argv[1] ? pathToFileURL(resolve(process.argv[1])).href : undefined;
if (invokedPath === import.meta.url) await main();

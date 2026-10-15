import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { tmpdir } from "node:os";
import test from "node:test";

const publicRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function stableJson(value) {
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  if (value && typeof value === "object") {
    return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value) ?? "null";
}

async function updateContentManifest(root, sourceContent) {
  const manifestPath = join(root, "translations", "manifest.json");
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.sourceContentHash = createHash("sha256").update(stableJson(sourceContent)).digest("hex");
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
}

async function markCmsDraftsCurrent(root) {
  const manifest = JSON.parse(await readFile(join(root, "translations", "manifest.json"), "utf8"));
  const statusPath = join(root, "translations", "draft-status.json");
  const status = JSON.parse(await readFile(statusPath, "utf8"));
  for (const locale of Object.keys(status.locales ?? {})) {
    status.locales[locale].cms = {
      sourceContentHash: manifest.sourceContentHash,
      keyCoverage: "complete",
    };
  }
  await writeFile(statusPath, `${JSON.stringify(status, null, 2)}\n`);
}

function runValidator(root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, "scripts", "validate-catalogs.mjs")], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => resolve({ code, output }));
  });
}

async function fixture(t) {
  const root = await mkdtemp(join(tmpdir(), "myinsta-catalog-validation-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(join(root, "scripts"), { recursive: true });
  await cp(join(publicRoot, "scripts", "validate-catalogs.mjs"), join(root, "scripts", "validate-catalogs.mjs"), { recursive: true });
  await cp(join(publicRoot, "messages"), join(root, "messages"), { recursive: true });
  await cp(join(publicRoot, "translations"), join(root, "translations"), { recursive: true });
  return root;
}

test("rejects missing and empty static privacy JSON values", async (t) => {
  const root = await fixture(t);
  await markCmsDraftsCurrent(root);
  const hiPath = join(root, "translations", "hi", "en.json");
  const hi = JSON.parse(await readFile(hiPath, "utf8"));
  delete hi["page.privacy.title"];
  await writeFile(hiPath, `${JSON.stringify(hi, null, 2)}\n`);

  const bnPath = join(root, "translations", "bn", "en.json");
  const bn = JSON.parse(await readFile(bnPath, "utf8"));
  bn["page.privacy.title"] = "";
  await writeFile(bnPath, `${JSON.stringify(bn, null, 2)}\n`);

  const result = await runValidator(root);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /ERROR hi\/en\.json:\(root\): keys differ/);
  assert.match(result.output, /ERROR bn\/en\.json:page\.privacy\.title: empty translation/);
});

test("warns about source keys added after the CMS draft export", async (t) => {
  const root = await fixture(t);
  await markCmsDraftsCurrent(root);
  const sourcePath = join(root, "translations", "source", "en.json");
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  source["page.privacy.new"] = "New privacy detail";
  await writeFile(sourcePath, `${JSON.stringify(source, null, 2)}\n`);
  await updateContentManifest(root, source);

  const result = await runValidator(root);
  assert.equal(result.code, 0);
  assert.match(result.output, /WARN hi\/en\.json:.*missing key in stale CMS draft: page\.privacy\.new/);
  assert.doesNotMatch(result.output, /ERROR .*keys differ/);
});

test("skips static target validation while the CMS source is empty", async (t) => {
  const root = await fixture(t);
  const sourcePath = join(root, "translations", "source", "en.json");
  await writeFile(sourcePath, "{}\n");
  await updateContentManifest(root, {});

  const result = await runValidator(root);
  assert.equal(result.code, 0);
  assert.match(result.output, /WARN translations\/source\/en\.json is empty/);
  assert.match(result.output, /Validated 13 unapproved locales against 315 UI strings: 0 errors/);
});

test("rejects changed HTML URLs", async (t) => {
  const root = await fixture(t);
  const hiPath = join(root, "translations", "hi", "html", "page.privacy.body.html");
  const hi = await readFile(hiPath, "utf8");
  await writeFile(hiPath, hi.replace("https://www.cloudflare.com/privacypolicy/", "https://evil.example/privacy/"));

  const result = await runValidator(root);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /ERROR hi\/html\/page\.privacy\.body\.html: HTML attributes differ/);
});

test("rejects changed HTML IDs", async (t) => {
  const root = await fixture(t);
  const hiPath = join(root, "translations", "hi", "html", "page.privacy.body.html");
  const hi = await readFile(hiPath, "utf8");
  await writeFile(hiPath, hi.replace('id="website-title"', 'id="changed-title"'));

  const result = await runValidator(root);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /ERROR hi\/html\/page\.privacy\.body\.html: HTML attributes differ/);
});

test("rejects changed trailing slash in an unquoted HTML URL", async (t) => {
  const root = await fixture(t);
  const sourcePath = join(root, "translations", "source", "html", "page.privacy.body.html");
  const source = await readFile(sourcePath, "utf8");
  await writeFile(sourcePath, source.replace('href="https://www.cloudflare.com/privacypolicy/"', "href=https://www.cloudflare.com/privacypolicy/"));

  const hiPath = join(root, "translations", "hi", "html", "page.privacy.body.html");
  const hi = await readFile(hiPath, "utf8");
  await writeFile(hiPath, hi.replace('href="https://www.cloudflare.com/privacypolicy/"', "href=https://www.cloudflare.com/privacypolicy"));

  const result = await runValidator(root);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /ERROR hi\/html\/page\.privacy\.body\.html: HTML attributes differ/);
});

test("rejects fewer protected JSON term occurrences", async (t) => {
  const root = await fixture(t);
  const sourcePath = join(root, "translations", "source", "en.json");
  const source = JSON.parse(await readFile(sourcePath, "utf8"));
  source["page.privacy.seodescription"] = source["page.privacy.seodescription"].replace("MyInsta", "MyInsta MyInsta");
  await writeFile(sourcePath, `${JSON.stringify(source, null, 2)}\n`);
  await updateContentManifest(root, source);

  const hiPath = join(root, "translations", "hi", "en.json");
  const hi = JSON.parse(await readFile(hiPath, "utf8"));
  hi["page.privacy.seodescription"] = hi["page.privacy.seodescription"].replace("MyInsta", "MyInsta");
  await writeFile(hiPath, `${JSON.stringify(hi, null, 2)}\n`);

  const result = await runValidator(root);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /ERROR hi\/en\.json:page\.privacy\.seodescription: protected term missing: MyInsta/);
});

test("rejects changed HTML protected product literals", async (t) => {
  const root = await fixture(t);

  const bnPath = join(root, "translations", "bn", "html", "page.privacy.body.html");
  const bn = await readFile(bnPath, "utf8");
  await writeFile(bnPath, bn.replace("MyInsta টিম", "OtherProduct টিম"));

  const result = await runValidator(root);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /ERROR bn\/html\/page\.privacy\.body\.html: protected product literal changed: MyInsta/);
});

test("rejects a missing HTML source declared by the content manifest", async (t) => {
  const root = await fixture(t);
  await rm(join(root, "translations/source/html/page.privacy.body.html"));

  const result = await runValidator(root);
  assert.notEqual(result.code, 0);
  assert.match(result.output, /ERROR translations\/manifest\.json entry source is missing: translations\/source\/html\/page\.privacy\.body\.html/);
});

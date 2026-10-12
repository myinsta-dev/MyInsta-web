import assert from "node:assert/strict";
import { cp, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import test from "node:test";

const publicRoot = dirname(dirname(fileURLToPath(import.meta.url)));

function runSeeder(root) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [join(root, "scripts", "seed-ui-drafts.mjs")], {
      cwd: root,
      stdio: ["ignore", "pipe", "pipe"],
    });
    let output = "";
    child.stdout.on("data", (chunk) => { output += chunk; });
    child.stderr.on("data", (chunk) => { output += chunk; });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve(output);
      else reject(new Error(`seed-ui-drafts.mjs exited with ${code}: ${output}`));
    });
  });
}

test("UI seeder preserves exported CMS files and existing target drafts", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "myinsta-ui-seed-"));
  t.after(() => rm(root, { recursive: true, force: true }));

  await mkdir(join(root, "scripts"), { recursive: true });
  await cp(join(publicRoot, "scripts", "seed-ui-drafts.mjs"), join(root, "scripts", "seed-ui-drafts.mjs"));
  await cp(join(publicRoot, "messages"), join(root, "messages"), { recursive: true });
  await cp(join(publicRoot, "translations"), join(root, "translations"), { recursive: true });

  const sourcePath = join(root, "translations", "source", "en.json");
  const manifestPath = join(root, "translations", "manifest.json");
  const sourceText = `${JSON.stringify({ "page.privacy.title": "Privacy policy" }, null, 2)}\n`;
  const manifestText = `${JSON.stringify({
    schemaVersion: 1,
    sourceLocale: "en",
    locales: ["en", "hi"],
    sourceFile: "translations/source/en.json",
    sourceContentHash: "cms-export-sentinel",
    entries: [{ key: "page.privacy.title", format: "icu" }],
  }, null, 2)}\n`;
  await writeFile(sourcePath, sourceText);
  await writeFile(manifestPath, manifestText);

  const targetPath = join(root, "messages", "es", "Common.json");
  const target = JSON.parse(await readFile(targetPath, "utf8"));
  const sentinel = "Redacción del revisor preservada";
  assert.equal(typeof target.footer?.description, "string");
  target.footer.description = sentinel;
  await writeFile(targetPath, `${JSON.stringify(target, null, 2)}\n`);

  await runSeeder(root);

  assert.equal(await readFile(sourcePath, "utf8"), sourceText);
  assert.equal(await readFile(manifestPath, "utf8"), manifestText);
  const refreshedTarget = JSON.parse(await readFile(targetPath, "utf8"));
  assert.equal(refreshedTarget.footer.description, sentinel);
  const refreshedUi = JSON.parse(await readFile(join(root, "translations", "es", "ui.json"), "utf8"));
  assert.equal(refreshedUi.Common.footer.description, sentinel);
  const status = JSON.parse(await readFile(join(root, "translations", "draft-status.json"), "utf8"));
  assert.deepEqual(status.locales.es, {
    status: "DRAFT",
    approved: false,
    nativeReviewRequired: true,
    keyCoverage: "complete",
    translation: "needs-review",
    nativeReview: "needs-review",
  });
});

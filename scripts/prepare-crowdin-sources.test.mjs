import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { CROWDIN_PROJECT_ID, prepareCrowdinSources } from "./prepare-crowdin-sources.mjs";

async function fixture() {
  const root = await mkdtemp(join(tmpdir(), "myinsta-crowdin-sources-"));
  await mkdir(join(root, "translations/source/html/nested"), { recursive: true });
  await writeFile(join(root, "translations/ui-manifest.json"), JSON.stringify({ sourceFile: "translations/source/ui.json" }));
  await writeFile(join(root, "translations/manifest.json"), JSON.stringify({ sourceFile: "translations/source/en.json" }));
  await writeFile(join(root, "translations/source/ui.json"), JSON.stringify({ Home: { title: "MyInsta" } }));
  return root;
}

test("keeps UI active, skips empty CMS JSON, and includes present HTML files", async () => {
  const root = await fixture();
  try {
    await writeFile(join(root, "translations/source/en.json"), "{}\n");
    await writeFile(join(root, "translations/source/html/nested/article.html"), "<p>Hello</p>\n");

    const config = await prepareCrowdinSources({ root });
    assert.equal(config.project_id, CROWDIN_PROJECT_ID);
    assert.deepEqual(config.files.map((file) => file.source), [
      "/translations/source/ui.json",
      "/translations/source/html/nested/article.html",
    ]);
    assert.equal(config.files[1].translation, "/translations/%two_letters_code%/html/nested/article.html");
    for (const file of config.files) {
      assert.deepEqual(file.languages_mapping.two_letters_code, { "pt-BR": "pt-BR", fil: "fil" });
    }
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("adds CMS JSON after it becomes nonempty without changing the UI group", async () => {
  const root = await fixture();
  try {
    await writeFile(join(root, "translations/source/en.json"), JSON.stringify({ "page.home": { value: "Welcome" } }));

    const config = await prepareCrowdinSources({ root });
    assert.deepEqual(config.files.map((file) => file.source), [
      "/translations/source/en.json",
      "/translations/source/ui.json",
    ]);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("fails closed when the UI source is missing", async () => {
  const root = await fixture();
  try {
    await rm(join(root, "translations/source/ui.json"));
    await writeFile(join(root, "translations/source/en.json"), "{}\n");
    await assert.rejects(
      prepareCrowdinSources({ root }),
      /translations\/source\/ui\.json is missing/,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("does not modify the repository while preparing the config", async () => {
  const root = await fixture();
  try {
    await writeFile(join(root, "translations/source/en.json"), "{}\n");
    const before = await readFile(join(root, "translations/source/ui.json"), "utf8");
    await prepareCrowdinSources({ root });
    assert.equal(await readFile(join(root, "translations/source/ui.json"), "utf8"), before);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

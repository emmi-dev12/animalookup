import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const { GROUPS, SPECIES } = JSON.parse(
  readFileSync(join(dirname(fileURLToPath(import.meta.url)), "species.json"), "utf8"),
);

let pipe = null;
let loading = null;

async function loadModel() {
  if (pipe) return pipe;
  if (!loading) {
    loading = import("@huggingface/transformers").then(async (m) => {
      m.env.cacheDir = "/tmp/hf-cache";
      m.env.allowLocalModels = false;
      pipe = await m.pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32", {
        dtype: "q8",
      });
      return pipe;
    });
  }
  return loading;
}

function asPairs(out, labels) {
  if (Array.isArray(out) && out[0] && typeof out[0] === "object" && "label" in out[0]) {
    return out;
  }
  if (out && out.labels && out.scores) {
    return out.labels.map((label, i) => ({ label, score: out.scores[i] }));
  }
  return labels.map((label) => ({ label, score: 0 }));
}

function toImage(image) {
  if (Buffer.isBuffer(image)) {
    return "data:image/jpeg;base64," + image.toString("base64");
  }
  return image;
}

async function scoreLabels(image, labels) {
  const p = await loadModel();
  const img = toImage(image);
  const map = new Map();
  const chunk = 12;
  for (let i = 0; i < labels.length; i += chunk) {
    const part = labels.slice(i, i + chunk);
    const raw = await p(img, part);
    for (const row of asPairs(raw, part)) map.set(row.label, row.score);
  }
  return map;
}

export async function identifyImage(image) {
  const groupLabels = GROUPS.map((g) => g.clip);
  const gScores = await scoreLabels(image, groupLabels);
  const rankedGroups = GROUPS.map((g) => ({
    g,
    score: gScores.get(g.clip) ?? 0,
  })).sort((a, b) => b.score - a.score);

  const animalish = rankedGroups.filter((x) => x.g.id !== "other").reduce((s, x) => s + x.score, 0);
  const topGroups = [];
  for (const row of rankedGroups) {
    if (topGroups.length === 0 || row.score > rankedGroups[0].score * 0.55) {
      if (topGroups.length < 2) topGroups.push(row.g.id);
    }
  }

  const pool = SPECIES.filter((s) => topGroups.includes(s.group));
  const sScores = await scoreLabels(image, pool.map((s) => s.clip));
  const guesses = pool
    .map((species) => ({ species, score: sScores.get(species.clip) ?? 0 }))
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);
  const max = guesses[0]?.score || 1;
  return {
    animalish,
    guesses: guesses.map((g) => ({ ...g, score: g.score / max })),
  };
}

export async function wikiFor(species, lang) {
  const langs = [lang === "de" || lang === "fr" || lang === "it" ? lang : "en", "en"];
  for (const l of langs) {
    const r = await fetch(
      `https://${l}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(species.wiki)}`,
    );
    if (!r.ok) continue;
    const j = await r.json();
    if (j.type === "disambiguation") continue;
    return {
      title: j.title || species.latin,
      extract: (j.extract || "").slice(0, 240),
      url: j.content_urls?.desktop?.page || `https://${l}.wikipedia.org/wiki/${species.wiki}`,
    };
  }
  return null;
}

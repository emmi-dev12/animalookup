import { GROUPS, SPECIES, inSwitzerland, type Group, type Species } from "./species";

export type Guess = {
  species: Species;
  score: number;
};

type Classifier = {
  (image: string, labels: string[]): Promise<{ labels: string[]; scores: number[] } | Array<{ label: string; score: number }>>;
};

let pipe: Classifier | null = null;
let loading: Promise<Classifier> | null = null;

export function modelReady(): boolean {
  return !!pipe;
}

export async function loadModel(onStatus?: (s: string) => void): Promise<void> {
  if (pipe) return;
  if (!loading) {
    onStatus?.("model");
    loading = import("@huggingface/transformers").then(async (m) => {
      const p = await m.pipeline("zero-shot-image-classification", "Xenova/clip-vit-base-patch32", {
        dtype: "q8",
      });
      pipe = p as unknown as Classifier;
      return pipe;
    });
  }
  await loading;
}

function asPairs(out: unknown, labels: string[]): { label: string; score: number }[] {
  if (Array.isArray(out)) {
    const first = out[0];
    if (first && typeof first === "object" && "label" in first) {
      return out as { label: string; score: number }[];
    }
  }
  const o = out as { labels?: string[]; scores?: number[] };
  if (o.labels && o.scores) {
    return o.labels.map((label, i) => ({ label, score: o.scores![i] }));
  }
  return labels.map((label) => ({ label, score: 0 }));
}

async function scoreLabels(image: string, labels: string[]): Promise<Map<string, number>> {
  if (!pipe) throw new Error("no model");
  const map = new Map<string, number>();
  const chunk = 12;
  for (let i = 0; i < labels.length; i += chunk) {
    const part = labels.slice(i, i + chunk);
    const raw = await pipe(image, part);
    for (const row of asPairs(raw, part)) map.set(row.label, row.score);
  }
  return map;
}

export async function identify(
  blob: Blob,
  gps: { lat: number; lon: number } | null,
): Promise<{ guesses: Guess[]; animalish: number }> {
  await loadModel();
  const url = URL.createObjectURL(blob);
  try {
    const groupLabels = GROUPS.map((g) => g.clip);
    const gScores = await scoreLabels(url, groupLabels);
    const rankedGroups = GROUPS.map((g) => ({
      g,
      score: gScores.get(g.clip) ?? 0,
    })).sort((a, b) => b.score - a.score);

    const animalish = rankedGroups.filter((x) => x.g.id !== "other").reduce((s, x) => s + x.score, 0);
    const topGroups: Group[] = [];
    for (const row of rankedGroups) {
      if (topGroups.length === 0 || row.score > rankedGroups[0].score * 0.55) {
        if (topGroups.length < 2) topGroups.push(row.g.id);
      }
    }

    const ch = gps ? inSwitzerland(gps.lat, gps.lon) : false;
    const pool = SPECIES.filter((s) => topGroups.includes(s.group));
    const labels = pool.map((s) => s.clip);
    const sScores = await scoreLabels(url, labels);

    const guesses = pool
      .map((species) => {
        let score = sScores.get(species.clip) ?? 0;
        if (ch && species.region === "ch") score *= 1.12;
        if (ch && species.region === "world") score *= 0.92;
        return { species, score };
      })
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    const max = guesses[0]?.score || 1;
    return {
      animalish,
      guesses: guesses.map((g) => ({ ...g, score: g.score / max })),
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export type WikiCard = {
  title: string;
  extract: string;
  thumb: string | null;
  url: string;
};

export async function wikiFor(species: Species, lang: string): Promise<WikiCard | null> {
  const langs = [lang === "de" || lang === "fr" || lang === "it" ? lang : "en", "en"];
  for (const l of langs) {
    const title = species.wiki;
    const r = await fetch(
      `https://${l}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title)}`,
    );
    if (!r.ok) continue;
    const j = (await r.json()) as {
      title?: string;
      extract?: string;
      content_urls?: { desktop?: { page?: string } };
      thumbnail?: { source?: string };
      type?: string;
    };
    if (j.type === "disambiguation") continue;
    return {
      title: j.title || species.latin,
      extract: (j.extract || "").slice(0, 280),
      thumb: j.thumbnail?.source || null,
      url: j.content_urls?.desktop?.page || `https://${l}.wikipedia.org/wiki/${title}`,
    };
  }
  return null;
}

import type { Lang } from "./species";
export type { Lang };
export const LANGS: Lang[] = ["de", "en", "fr", "it"];

export const I18N: Record<
  Lang,
  {
    title: string;
    shoot: string;
    album: string;
    looking: string;
    model: string;
    retry: string;
    guess: string;
    maybe: string;
    unsure: string;
    latin: string;
    wiki: string;
    hint: string;
    fail: string;
    camfail: string;
    notanimal: string;
    v1: string;
  }
> = {
  de: {
    title: "AnimaLookup",
    shoot: "FOTO",
    album: "ALBUM",
    looking: "Schauen…",
    model: "Modell laden… einmalig",
    retry: "NOCHMAL",
    guess: "Vermutung",
    maybe: "Auch möglich",
    unsure: "Unsicher — nimm näher ran",
    latin: "Art",
    wiki: "Wikipedia",
    hint: "Foto vom Tier. Kein ChatGPT. Kann falsch liegen.",
    fail: "Konnte nicht erkennen.",
    camfail: "Kamera blockiert.",
    notanimal: "Sieht nicht nach einem Tier aus.",
    v1: "Häufige Tiere (v1), nicht alle Arten der Welt.",
  },
  en: {
    title: "AnimaLookup",
    shoot: "PHOTO",
    album: "ALBUM",
    looking: "Looking…",
    model: "Loading model… once",
    retry: "AGAIN",
    guess: "Guess",
    maybe: "Also possible",
    unsure: "Unsure — get closer",
    latin: "Species",
    wiki: "Wikipedia",
    hint: "Photo of the animal. No ChatGPT. Can be wrong.",
    fail: "Couldn’t tell.",
    camfail: "Camera blocked.",
    notanimal: "Doesn’t look like an animal.",
    v1: "Common animals (v1), not every species on Earth.",
  },
  fr: {
    title: "AnimaLookup",
    shoot: "PHOTO",
    album: "ALBUM",
    looking: "Recherche…",
    model: "Chargement du modèle…",
    retry: "ENCORE",
    guess: "Hypothèse",
    maybe: "Aussi possible",
    unsure: "Pas sûr — approche-toi",
    latin: "Espèce",
    wiki: "Wikipédia",
    hint: "Photo de l’animal. Pas de ChatGPT. Peut se tromper.",
    fail: "Pas reconnu.",
    camfail: "Caméra bloquée.",
    notanimal: "Ça ne ressemble pas à un animal.",
    v1: "Animaux courants (v1), pas toutes les espèces.",
  },
  it: {
    title: "AnimaLookup",
    shoot: "FOTO",
    album: "ALBUM",
    looking: "Cerco…",
    model: "Carico il modello…",
    retry: "DI NUOVO",
    guess: "Ipotesi",
    maybe: "Anche possibile",
    unsure: "Incerto — avvicinati",
    latin: "Specie",
    wiki: "Wikipedia",
    hint: "Foto dell’animale. Niente ChatGPT. Può sbagliare.",
    fail: "Non riconosciuto.",
    camfail: "Fotocamera bloccata.",
    notanimal: "Non sembra un animale.",
    v1: "Animali comuni (v1), non tutte le specie.",
  },
};

export function detectLang(): Lang {
  const q = new URLSearchParams(location.search).get("lang");
  if (q === "de" || q === "en" || q === "fr" || q === "it") return q;
  const saved = localStorage.getItem("animalookup-lang");
  if (saved === "de" || saved === "en" || saved === "fr" || saved === "it") return saved;
  const n = navigator.language.slice(0, 2);
  if (n === "de" || n === "fr" || n === "it") return n;
  return "en";
}

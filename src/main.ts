import "./style.css";
import { detectLang, I18N, LANGS, type Lang } from "./i18n";
import { identify, loadModel, wikiFor, type Guess, type WikiCard } from "./id";

const app = document.querySelector("#app")!;
let lang: Lang = detectLang();
let stream: MediaStream | null = null;
let gps: { lat: number; lon: number } | null = null;
let lastUrl = "";

function t() {
  return I18N[lang];
}

function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs: Record<string, string> = {},
  text?: string,
): HTMLElementTagNameMap[K] {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class") n.className = v;
    else n.setAttribute(k, v);
  }
  if (text) n.textContent = text;
  return n;
}

app.innerHTML = `
  <div class="top">
    <div class="brand">AnimaLookup</div>
    <select class="lang" id="lang"></select>
  </div>
  <div class="stage" id="stage">
    <video id="vid" playsinline autoplay muted></video>
    <div class="hint" id="hint"></div>
  </div>
  <div class="status" id="status"></div>
  <div class="dock">
    <label class="filebtn"><input id="album" type="file" accept="image/*" /><span id="album-lab">${t().album}</span></label>
    <button class="primary" id="shoot">${t().shoot}</button>
    <button id="again" hidden>${t().retry}</button>
  </div>
  <div class="sheet" id="sheet"></div>
`;

const langEl = document.querySelector("#lang") as HTMLSelectElement;
for (const l of LANGS) {
  const o = el("option", { value: l }, l.toUpperCase());
  if (l === lang) o.selected = true;
  langEl.append(o);
}
langEl.onchange = () => {
  lang = langEl.value as Lang;
  localStorage.setItem("animalookup-lang", lang);
  applyCopy();
};

const vid = document.querySelector("#vid") as HTMLVideoElement;
const hint = document.querySelector("#hint") as HTMLDivElement;
const status = document.querySelector("#status") as HTMLDivElement;
const shoot = document.querySelector("#shoot") as HTMLButtonElement;
const again = document.querySelector("#again") as HTMLButtonElement;
const album = document.querySelector("#album") as HTMLInputElement;
const sheet = document.querySelector("#sheet") as HTMLDivElement;

function applyCopy() {
  hint.textContent = t().hint;
  shoot.textContent = t().shoot;
  const lab = document.querySelector("#album-lab");
  if (lab) lab.textContent = t().album;
  again.textContent = t().retry;
}

applyCopy();

navigator.geolocation?.getCurrentPosition(
  (p) => {
    gps = { lat: p.coords.latitude, lon: p.coords.longitude };
  },
  () => {},
  { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
);

async function startCam() {
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: "environment" }, width: { ideal: 1280 } },
      audio: false,
    });
    vid.srcObject = stream;
    await vid.play();
  } catch {
    status.textContent = t().camfail;
  }
}

void startCam();
void loadModel((s) => {
  if (s === "model") status.textContent = t().model;
}).then(
  () => {
    status.textContent = "";
  },
  () => {
    status.textContent = t().fail;
  },
);

function grab(): Blob | Promise<Blob> {
  const c = document.createElement("canvas");
  c.width = vid.videoWidth || 960;
  c.height = vid.videoHeight || 1280;
  const ctx = c.getContext("2d")!;
  ctx.drawImage(vid, 0, 0, c.width, c.height);
  return new Promise((res) => c.toBlob((b) => res(b || new Blob()), "image/jpeg", 0.85));
}

shoot.onclick = async () => {
  shoot.disabled = true;
  try {
    const blob = await grab();
    await run(blob);
  } finally {
    shoot.disabled = false;
  }
};

album.onchange = async () => {
  const f = album.files?.[0];
  album.value = "";
  if (f) await run(f);
};

again.onclick = () => {
  sheet.classList.remove("open");
  app.classList.remove("shooting");
  again.hidden = true;
};

async function run(blob: Blob) {
  if (lastUrl) URL.revokeObjectURL(lastUrl);
  lastUrl = URL.createObjectURL(blob);
  status.textContent = t().looking;
  shoot.disabled = true;
  try {
    const { guesses, animalish } = await identify(blob, gps);
    await show(lastUrl, guesses, animalish);
  } catch {
    status.textContent = t().fail;
  } finally {
    shoot.disabled = false;
    status.textContent = "";
  }
}

async function show(src: string, guesses: Guess[], animalish: number) {
  const top = guesses[0];
  if (!top || animalish < 0.25 || top.score < 0.01) {
    sheet.innerHTML = `
      <img class="preview" alt="" src="${src}" />
      <p>${t().notanimal}</p>
      <p class="v1">${t().v1}</p>
      <button class="primary" id="back">${t().retry}</button>
    `;
    sheet.classList.add("open");
    app.classList.add("shooting");
    again.hidden = false;
    sheet.querySelector("#back")!.addEventListener("click", () => again.click());
    return;
  }

  let wiki: WikiCard | null = null;
  try {
    wiki = await wikiFor(top.species, lang);
  } catch {
    wiki = null;
  }
  renderGuess(src, top, guesses.slice(1), wiki, animalish);
}

function renderGuess(src: string, top: Guess, rest: Guess[], wiki: WikiCard | null, animalish: number) {
  const name = top.species.names[lang];
  const unsure = top.score < 0.55 || animalish < 0.4;
  const wikiHtml = wiki
    ? `<a class="wiki" href="${wiki.url}" target="_blank" rel="noreferrer">
        ${wiki.thumb ? `<img alt="" src="${wiki.thumb}" />` : ""}
        <div><strong>${t().wiki}</strong><p>${wiki.extract || ""}</p></div>
      </a>`
    : "";
  const others = rest
    .slice(0, 3)
    .map(
      (g, i) =>
        `<button data-i="${i}">${g.species.names[lang]} · ${g.species.latin} · ${Math.round(g.score * 100)}%</button>`,
    )
    .join("");

  sheet.innerHTML = `
    <img class="preview" alt="" src="${src}" />
    <div class="guess">
      <div>${unsure ? t().unsure : t().guess}</div>
      <h2>${name}</h2>
      <div class="latin">${top.species.latin}</div>
      <div class="bar"><i style="width:${Math.round(Math.min(1, top.score) * 100)}%"></i></div>
      ${wikiHtml}
    </div>
    <div class="maybe"><div>${t().maybe}</div>${others}</div>
    <p class="v1">${t().v1}</p>
    <button class="primary" id="back">${t().retry}</button>
  `;
  sheet.classList.add("open");
  app.classList.add("shooting");
  again.hidden = false;
  sheet.querySelector("#back")!.addEventListener("click", () => again.click());
  sheet.querySelectorAll<HTMLButtonElement>(".maybe button").forEach((b, i) => {
    b.onclick = async () => {
      const g = rest[i];
      if (!g) return;
      status.textContent = t().looking;
      let w: WikiCard | null = null;
      try {
        w = await wikiFor(g.species, lang);
      } catch {
        w = null;
      }
      status.textContent = "";
      renderGuess(src, g, [top, ...rest.filter((x) => x !== g)], w, animalish);
    };
  });
}

if ("serviceWorker" in navigator) {
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

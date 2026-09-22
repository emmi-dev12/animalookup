import { identifyImage, wikiFor } from "./identify.js";

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const APP = process.env.APP_URL || "https://animalookup.vercel.app";

async function tg(method, body) {
  const r = await fetch(`https://api.telegram.org/bot${TOKEN}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
  return r.json();
}

function langOf(msg) {
  const l = (msg.from?.language_code || "en").slice(0, 2);
  return l === "de" || l === "fr" || l === "it" ? l : "en";
}

async function fileFromTelegram(fileId) {
  const meta = await tg("getFile", { file_id: fileId });
  const path = meta?.result?.file_path;
  if (!path) throw new Error("no file");
  const r = await fetch(`https://api.telegram.org/file/bot${TOKEN}/${path}`);
  if (!r.ok) throw new Error("download " + r.status);
  return Buffer.from(await r.arrayBuffer());
}

function photoId(msg) {
  if (msg.photo?.length) return msg.photo[msg.photo.length - 1].file_id;
  const doc = msg.document;
  if (doc?.mime_type?.startsWith("image/")) return doc.file_id;
  return null;
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    res.status(200).json({
      name: "AnimaLookup",
      app: APP,
      bot: TOKEN ? "configured" : "missing TELEGRAM_BOT_TOKEN",
    });
    return;
  }
  if (req.method !== "POST") {
    res.status(405).end();
    return;
  }
  let raw = "";
  for await (const c of req) raw += c;
  let update = {};
  try {
    update = JSON.parse(raw || "{}");
  } catch {
    res.status(200).end();
    return;
  }
  const msg = update.message;
  if (!TOKEN || !msg) {
    res.status(200).end();
    return;
  }
  const chat = msg.chat.id;
  const lang = langOf(msg);
  await tg("sendChatAction", { chat_id: chat, action: "typing" });

  const fid = photoId(msg);
  if (fid) {
    try {
      const buf = await fileFromTelegram(fid);
      const tick = setInterval(() => {
        tg("sendChatAction", { chat_id: chat, action: "typing" }).catch(() => {});
      }, 4000);
      const { guesses, animalish } = await identifyImage(buf);
      clearInterval(tick);
      const top = guesses[0];
      if (!top || animalish < 0.25) {
        await tg("sendMessage", {
          chat_id: chat,
          text: "Doesn’t look like an animal I know. Try a closer photo.",
        });
      } else {
        const name = top.species.names[lang] || top.species.names.en;
        const rest = guesses
          .slice(1, 4)
          .map((g) => g.species.names[lang] || g.species.names.en)
          .join(", ");
        let wiki = null;
        try {
          wiki = await wikiFor(top.species, lang);
        } catch {
          wiki = null;
        }
        const unsure = top.score < 0.55 ? "Unsure — " : "";
        const lines = [
          unsure + name,
          top.species.latin,
          rest ? "Also: " + rest : "",
          wiki?.url || "",
          "Guess from common animals. Can be wrong.",
        ].filter(Boolean);
        await tg("sendMessage", { chat_id: chat, text: lines.join("\n") });
      }
    } catch {
      await tg("sendMessage", {
        chat_id: chat,
        text: "Couldn’t ID that photo. Try again, or the app: " + APP,
      });
    }
    res.status(200).end();
    return;
  }

  await tg("sendMessage", {
    chat_id: chat,
    text: "AnimaLookup — send a photo of an animal.\nNo ChatGPT. Common animals, can be wrong.",
  });
  res.status(200).end();
}

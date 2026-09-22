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
  const open = {
    reply_markup: {
      inline_keyboard: [[{ text: "Open AnimaLookup", url: APP }]],
    },
  };
  if (msg.photo || msg.document) {
    await tg("sendMessage", {
      chat_id: chat,
      text: "ID runs on your phone (no ChatGPT). Open the app and use the camera or album.",
      ...open,
    });
  } else {
    await tg("sendMessage", {
      chat_id: chat,
      text: "AnimaLookup — photo of an animal → species guess.\nNo ChatGPT. Common animals, can be wrong.",
      ...open,
    });
  }
  res.status(200).end();
}

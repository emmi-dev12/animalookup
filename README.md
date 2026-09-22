# AnimaLookup

Foto eines Tiers → Art-Vermutung. Öffentliche PWA. **Kein ChatGPT.**

Live: **https://animalookup.vercel.app**

## Was es tut

- Kamera oder Album
- CLIP (on-device) gegen häufige Tiere
- GPS in der CH hebt lokale Arten leicht an
- Wikipedia-Bild zur Kontrolle (echte Fotos, mit Link)

**v1 kennt nicht alle Arten der Welt.** Häufige Säuger, Vögel, Reptilien, Amphibien, Fische, Insekten. Kann falsch liegen.

## Was es nicht tut

- Kein iNaturalist-Computer-Vision (deren Endpoint ist nicht für öffentliche Apps)
- Keine generierten Bilder
- Kein Pflanzen-Fokus (Seek / Pl@ntNet sind besser für Pflanzen)

## Telegram

Bot-Token in Vercel: `TELEGRAM_BOT_TOKEN`, `APP_URL`.

Webhook:

`https://api.telegram.org/bot<token>/setWebhook?url=https://animalookup.vercel.app/api/telegram`

Der Bot öffnet die Mini-App. Erkennung läuft auf dem Telefon.

## Entwickeln

```
npm install
npm run dev
```

iPhone: Home-Bildschirm → Safari Hold-Reload nach Updates.

DE · [EN](README.en.md)

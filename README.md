# Haber Telegram Bot

Bu proje, `haber-story.psd` tasarimini otomasyona uygun hale getirir:

- Instagram story PNG uretir.
- Ayni tasarimin 15 saniyelik MP4 video halini uretir.
- Telegram botu haber fotografi, baslik, detay ve CTA metni alarak ciktilari otomatik yollar.

## Kurulum

```bash
npm install
cp .env.example .env
```

`.env` icine BotFather'dan aldiginiz tokeni yazin:

```bash
TELEGRAM_BOT_TOKEN=123456:telegram-bot-token
TELEGRAM_ALLOWED_CHAT_IDS=
TELEGRAM_HANDLER_TIMEOUT_MS=600000
```

`TELEGRAM_ALLOWED_CHAT_IDS` bos kalirsa bot herkese acik calisir. Sadece belirli
sohbetlerde kullanmak isterseniz chat ID'leri virgulle yazabilirsiniz:

```bash
TELEGRAM_ALLOWED_CHAT_IDS=123456789,987654321
```

Video uretimi ve Telegram upload'i yavas ortamlarda 90 saniyeyi asabilir.
Bu yuzden bot varsayilan handler timeout'unu 10 dakika kullanir:

```bash
TELEGRAM_HANDLER_TIMEOUT_MS=600000
```

## Ornek cikti alma

```bash
npm run sample
```

Bu komut `output/sample-story.png` ve `output/sample-story.mp4` dosyalarini uretir.

Sadece PNG kontrolu icin:

```bash
npm run check
```

## Telegram botu calistirma

```bash
npm run bot
```

Bot akisi:

1. Telegram'da `/new` yazin.
2. Haber fotografini fotograf ya da image document olarak gonderin.
3. Baslik, haber detayi, CTA ve tarih sorularini cevaplayin.
4. CTA adiminda `CTA yok` butonuyla bos gecilebilir.
5. Tarih adiminda `Bugunu kullan` butonu ya da `/bugun` komutu kullanilabilir.
6. Bot once PNG'yi yollar, ardindan 15 saniyelik MP4'u uretip gonderir.

Tarih adiminda `/bugun` yazarsaniz otomatik bugunun tarihini kullanir.

## Docker / Portainer

Lokal Docker ile calistirmak icin:

```bash
docker compose up -d --build
```

Portainer Stack olarak kaldirirken repo URL'sini kullanabilirsiniz:

```text
https://github.com/mazisel/sendikalhaber_bot.git
```

Stack environment alanina sunlari girin:

```bash
TELEGRAM_BOT_TOKEN=123456:telegram-bot-token
TELEGRAM_ALLOWED_CHAT_IDS=
TELEGRAM_HANDLER_TIMEOUT_MS=600000
```

Bot long polling ile calisir; disariya port acmaniz gerekmez. Uretilen dosyalar
Docker volume olarak `/app/storage` altinda tutulur.

Container logunda `Fontconfig error: Cannot load default config file` gorurseniz
eski imaj calisiyor demektir. Portainer'da stack'i yeniden build/recreate edin.

## Manuel render

```bash
npm run render -- \
  --photo assets/sample/photo.jpg \
  --title "HABER BASLIGI" \
  --body "Haber detayi buraya gelecek." \
  --cta "Detaylar profildeki baglantida" \
  --date "19 Mayis 2026" \
  --name haber-deneme
```

Varsayilan videoda haber fotografi sabit kalir; ust alan, fotograf, panel, baslik,
aciklama, CTA ve logo sirayla gorunur. Fotografa cok hafif yakinlasma vermek
isterseniz manuel renderda sunu ekleyebilirsiniz:

```bash
--photoMotion kenburns
```

## Tasarim sablonu

Bot PSD'yi her seferinde acmaz. PSD'deki tasarim programatik sablon olarak
`src/render/story.js` icine aktarildi. Bu daha hizli ve daha az kirilgandir.

Runtime icin gerekli sabit assetler `assets/sample` altindadir. PSD kaynak
dosyasi ve uretilen preview dosyalari repo'ya dahil edilmez.

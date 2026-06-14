"use strict";

require("dotenv").config({ quiet: true });

const fs = require("fs/promises");
const path = require("path");
const { Telegraf, Markup } = require("telegraf");
const { renderStoryPng, todayTr } = require("./render/story");
const { renderStoryVideo } = require("./render/video");

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  console.error("TELEGRAM_BOT_TOKEN eksik. .env dosyasini .env.example uzerinden olusturun.");
  process.exit(1);
}

const ROOT = path.resolve(__dirname, "..");
const VIDEO_DURATION = 15;
const VIDEO_FPS = 30;
const HANDLER_TIMEOUT_MS = readPositiveNumberEnv("TELEGRAM_HANDLER_TIMEOUT_MS", 10 * 60 * 1000);
const allowedChatIds = (process.env.TELEGRAM_ALLOWED_CHAT_IDS || "")
  .split(",")
  .map((value) => value.trim())
  .filter(Boolean);

const bot = new Telegraf(token, { handlerTimeout: HANDLER_TIMEOUT_MS });
const sessions = new Map();
const renderedJobs = new Map();

function readPositiveNumberEnv(name, fallback) {
  const value = Number(process.env[name]);
  return Number.isFinite(value) && value > 0 ? value : fallback;
}

const steps = [
  {
    key: "title",
    question: "Basligi yazin.\nOrnek: ASGARI UCRETTE YENI DONEM",
  },
  {
    key: "body",
    question: "Kisa haber detayini yazin. Bu metin mavi panelin orta alanina gelecek.",
  },
  {
    key: "cta",
    question: "CTA metnini yazin ya da asagidaki butonla bos gecin.",
    keyboard: Markup.inlineKeyboard([[Markup.button.callback("CTA yok", "skip:cta")]]),
  },
  {
    key: "date",
    question: `Tarihi yazin ya da bugunu kullanin.\nBugun: ${todayTr()}`,
    keyboard: Markup.inlineKeyboard([[Markup.button.callback("Bugunu kullan", "date:today")]]),
  },
];

function baseData() {
  return {
    brand: "sendikal.haber",
    label: "Sendikal Haber",
    logo: path.join(ROOT, "assets/sample/logo.png"),
    socialIcons: path.join(ROOT, "assets/sample/social-icons.png"),
  };
}

function newSession() {
  return {
    step: "photo",
    busy: false,
    data: baseData(),
  };
}

function getChatId(ctx) {
  return ctx.chat?.id || ctx.callbackQuery?.message?.chat?.id;
}

function isAllowed(ctx) {
  if (!allowedChatIds.length) return true;
  const chatId = getChatId(ctx);
  return chatId && allowedChatIds.includes(String(chatId));
}

function getSession(ctx) {
  const chatId = getChatId(ctx);
  if (!chatId) return null;
  if (!sessions.has(chatId)) sessions.set(chatId, newSession());
  return sessions.get(chatId);
}

function resetSession(ctx) {
  const chatId = getChatId(ctx);
  if (!chatId) return null;
  sessions.set(chatId, newSession());
  return sessions.get(chatId);
}

function currentStep(session) {
  return steps.find((item) => item.key === session.step);
}

function nextStepKey(stepKey) {
  const index = steps.findIndex((item) => item.key === stepKey);
  return steps[index + 1]?.key || null;
}

async function ensureDir(filePath) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
}

async function downloadTelegramFile(ctx, fileId, targetPath) {
  const link = await ctx.telegram.getFileLink(fileId);
  const response = await fetch(link.href);
  if (!response.ok) throw new Error(`Dosya indirilemedi: ${response.status}`);
  const buffer = Buffer.from(await response.arrayBuffer());
  await ensureDir(targetPath);
  await fs.writeFile(targetPath, buffer);
}

async function replyHelp(ctx) {
  await ctx.reply(
    [
      "Sendikal Haber story botu hazir.",
      "",
      "/new - yeni haber olustur",
      "/cancel - aktif islemi iptal et",
      "/help - komutlari goster",
      "",
      "Akis: haber gorseli -> baslik -> detay -> CTA -> tarih -> PNG + 15 sn MP4.",
    ].join("\n"),
    Markup.inlineKeyboard([[Markup.button.callback("Yeni haber", "flow:new")]])
  );
}

async function askCurrentStep(ctx, session) {
  if (session.step === "photo") {
    await ctx.reply(
      "Haber gorselini fotograf ya da image document olarak gonderin.",
      Markup.inlineKeyboard([[Markup.button.callback("Iptal", "flow:cancel")]])
    );
    return;
  }

  const step = currentStep(session);
  if (step) await ctx.reply(step.question, step.keyboard);
}

function normalizeCta(value) {
  const normalized = value.trim().toLocaleLowerCase("tr-TR");
  if (["-", "yok", "bos", "boş", "gec", "geç"].includes(normalized)) return "";
  return value.trim();
}

function rememberJob(id, data) {
  renderedJobs.set(id, { data: { ...data }, createdAt: Date.now() });

  const maxJobs = 30;
  if (renderedJobs.size <= maxJobs) return;
  const oldest = [...renderedJobs.entries()].sort((a, b) => a[1].createdAt - b[1].createdAt)[0];
  if (oldest) renderedJobs.delete(oldest[0]);
}

async function renderAndSend(ctx, session) {
  if (session.busy) return;
  session.busy = true;

  const chatId = getChatId(ctx);
  const id = `${chatId}-${Date.now()}`;
  const outputDir = path.join(ROOT, "storage/output");
  const pngPath = path.join(outputDir, `${id}.png`);
  const mp4Path = path.join(outputDir, `${id}.mp4`);

  await ctx.reply("Gorsel hazirlaniyor...");
  await ctx.telegram.sendChatAction(chatId, "upload_photo");
  await renderStoryPng(session.data, pngPath);
  await ctx.replyWithPhoto(
    { source: pngPath },
    {
      caption: "PNG hazir. Video simdi uretiliyor.",
      ...Markup.inlineKeyboard([[Markup.button.callback("Yeni haber", "flow:new")]]),
    }
  );

  await ctx.reply(`${VIDEO_DURATION} saniyelik MP4 uretiliyor, biraz surebilir...`);
  await ctx.telegram.sendChatAction(chatId, "upload_video");
  await renderStoryVideo(session.data, mp4Path, { duration: VIDEO_DURATION, fps: VIDEO_FPS });

  rememberJob(id, session.data);
  await ctx.replyWithVideo(
    { source: mp4Path },
    Markup.inlineKeyboard([
      [Markup.button.callback("Video tekrar uret", `video:${id}`)],
      [Markup.button.callback("Yeni haber", "flow:new")],
    ])
  );
  await ctx.reply("Hazir. Yeni haber icin /new yazabilirsiniz.");
  sessions.delete(chatId);
}

async function handleTextAnswer(ctx, text) {
  const session = getSession(ctx);
  if (!session) return;

  if (session.busy) {
    await ctx.reply("Su an cikti uretiliyor, bitince yeni haber baslatabilirsiniz.");
    return;
  }

  if (session.step === "photo") {
    await askCurrentStep(ctx, session);
    return;
  }

  const step = currentStep(session);
  if (!step) return;

  if (step.key === "cta") session.data.cta = normalizeCta(text);
  else session.data[step.key] = text.trim();

  const next = nextStepKey(step.key);
  if (next) {
    session.step = next;
    await askCurrentStep(ctx, session);
    return;
  }

  await renderAndSend(ctx, session);
}

bot.use(async (ctx, next) => {
  if (isAllowed(ctx)) return next();
  const chatId = getChatId(ctx);
  console.warn(`Yetkisiz Telegram istegi engellendi. chat_id=${chatId || "unknown"}`);
  if (ctx.callbackQuery) await ctx.answerCbQuery("Yetkiniz yok").catch(() => {});
  else await ctx.reply("Bu bot bu sohbet icin yetkili degil.").catch(() => {});
});

bot.start(async (ctx) => {
  resetSession(ctx);
  await replyHelp(ctx);
});

bot.help(replyHelp);

bot.command("new", async (ctx) => {
  const session = resetSession(ctx);
  await askCurrentStep(ctx, session);
});

bot.command("cancel", async (ctx) => {
  const chatId = getChatId(ctx);
  if (chatId) sessions.delete(chatId);
  await ctx.reply("Islem iptal edildi. Yeni haber icin /new yazabilirsiniz.");
});

bot.command("bugun", async (ctx) => {
  const session = getSession(ctx);
  if (!session || session.step !== "date") {
    await ctx.reply("Tarih adiminda /bugun kullanabilirsiniz. Yeni haber icin /new yazin.");
    return;
  }

  session.data.date = todayTr();
  await renderAndSend(ctx, session);
});

bot.action("flow:new", async (ctx) => {
  await ctx.answerCbQuery();
  const session = resetSession(ctx);
  await askCurrentStep(ctx, session);
});

bot.action("flow:cancel", async (ctx) => {
  await ctx.answerCbQuery("Iptal edildi");
  const chatId = getChatId(ctx);
  if (chatId) sessions.delete(chatId);
  await ctx.reply("Islem iptal edildi. Yeni haber icin /new yazabilirsiniz.");
});

bot.action("skip:cta", async (ctx) => {
  await ctx.answerCbQuery("CTA bos gecildi");
  const session = getSession(ctx);
  if (!session || session.step !== "cta") {
    await ctx.reply("CTA adiminda degilsiniz. Yeni haber icin /new yazabilirsiniz.");
    return;
  }

  session.data.cta = "";
  session.step = "date";
  await askCurrentStep(ctx, session);
});

bot.action("date:today", async (ctx) => {
  await ctx.answerCbQuery(todayTr());
  const session = getSession(ctx);
  if (!session || session.step !== "date") {
    await ctx.reply("Tarih adiminda degilsiniz. Yeni haber icin /new yazabilirsiniz.");
    return;
  }

  session.data.date = todayTr();
  await renderAndSend(ctx, session);
});

bot.action(/^video:(.+)$/, async (ctx) => {
  const id = ctx.match[1];
  const job = renderedJobs.get(id);
  await ctx.answerCbQuery(job ? "Video tekrar uretiliyor" : "Is kaydi bulunamadi");

  if (!job) {
    await ctx.reply("Bu eski isi tekrar uretemiyorum. Yeni haber icin /new yazabilirsiniz.");
    return;
  }

  const chatId = getChatId(ctx);
  const outputPath = path.join(ROOT, "storage/output", `${id}-retry-${Date.now()}.mp4`);
  await ctx.reply(`${VIDEO_DURATION} saniyelik video tekrar uretiliyor...`);
  await ctx.telegram.sendChatAction(chatId, "upload_video");
  await renderStoryVideo(job.data, outputPath, { duration: VIDEO_DURATION, fps: VIDEO_FPS });
  await ctx.replyWithVideo(
    { source: outputPath },
    Markup.inlineKeyboard([
      [Markup.button.callback("Video tekrar uret", `video:${id}`)],
      [Markup.button.callback("Yeni haber", "flow:new")],
    ])
  );
});

bot.on(["photo", "document"], async (ctx) => {
  const session = getSession(ctx);
  if (!session || session.step !== "photo") {
    await ctx.reply("Gorsel almak icin once /new yazin.");
    return;
  }

  const photo = ctx.message.photo?.at(-1);
  const document = ctx.message.document;
  if (document && document.mime_type && !document.mime_type.startsWith("image/")) {
    await ctx.reply("Lutfen gorsel dosyasi gonderin. JPG, PNG veya WEBP uygundur.");
    return;
  }

  const fileId = photo?.file_id || document?.file_id;
  if (!fileId) {
    await ctx.reply("Gorseli okuyamadim, tekrar dener misiniz?");
    return;
  }

  const ext = document?.file_name ? path.extname(document.file_name) || ".jpg" : ".jpg";
  const uploadPath = path.join(ROOT, "storage/uploads", `${ctx.chat.id}-${Date.now()}${ext}`);
  await ctx.reply("Gorsel alindi, indiriyorum...");
  await downloadTelegramFile(ctx, fileId, uploadPath);

  session.data.photo = uploadPath;
  session.step = "title";
  await askCurrentStep(ctx, session);
});

bot.on("text", async (ctx) => {
  const text = ctx.message.text.trim();
  if (text.startsWith("/")) return;
  await handleTextAnswer(ctx, text);
});

bot.catch((error, ctx) => {
  console.error("Bot hatasi", error);
  ctx.reply("Bir hata olustu. /new ile tekrar deneyebilirsiniz.").catch(() => {});
});

bot.telegram
  .setMyCommands([
    { command: "new", description: "Yeni haber olustur" },
    { command: "cancel", description: "Aktif islemi iptal et" },
    { command: "help", description: "Komutlari goster" },
  ])
  .catch(() => {});

bot.launch();
console.log(
  `Telegram bot calisiyor. Video suresi: ${VIDEO_DURATION} saniye. Handler timeout: ${HANDLER_TIMEOUT_MS} ms.`
);

process.once("SIGINT", () => bot.stop("SIGINT"));
process.once("SIGTERM", () => bot.stop("SIGTERM"));

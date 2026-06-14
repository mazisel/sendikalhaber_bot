"use strict";

const path = require("path");
const { renderStoryPng, DEFAULTS, todayTr } = require("./render/story");
const { renderStoryVideo } = require("./render/video");

function readArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 1) {
    const value = argv[index];
    if (!value.startsWith("--")) continue;
    const key = value.slice(2);
    const next = argv[index + 1];
    if (!next || next.startsWith("--")) {
      args[key] = true;
    } else {
      args[key] = next;
      index += 1;
    }
  }
  return args;
}

function storyInputFromArgs(args, sample = false) {
  return {
    brand: args.brand || DEFAULTS.brand,
    date: args.date || (sample ? "19 Mayis 2026" : todayTr()),
    label: args.label || DEFAULTS.label,
    title: args.title || (sample ? "HABER BASLIGI HABER ALT BASLIGI" : DEFAULTS.title),
    body:
      args.body ||
      (sample
        ? "Lorem ipsum yerine gercek haber spotu buraya gelecek. Metin otomatik satirlara ayrilir ve story alanina uygun kalir."
        : DEFAULTS.body),
    cta: args.cta || (sample ? "Detaylar icin profildeki baglantiyi ziyaret edin" : DEFAULTS.cta),
    photo: args.photo || DEFAULTS.photo,
    photoMotion: args.photoMotion || DEFAULTS.photoMotion,
    logo: args.logo || DEFAULTS.logo,
  };
}

async function main() {
  const [command, ...rest] = process.argv.slice(2);
  const args = readArgs(rest);
  const outputDir = path.resolve(args.outDir || "output");

  if (!command || command === "sample") {
    const input = storyInputFromArgs(args, true);
    const pngPath = path.join(outputDir, "sample-story.png");
    const mp4Path = path.join(outputDir, "sample-story.mp4");
    await renderStoryPng(input, pngPath);
    console.log(`PNG: ${pngPath}`);

    if (!args["skip-video"]) {
      await renderStoryVideo(input, mp4Path, {
        duration: args.duration || 15,
        fps: args.fps || 30,
      });
      console.log(`MP4: ${mp4Path}`);
    }
    return;
  }

  if (command === "render") {
    const input = storyInputFromArgs(args, false);
    const safeName = args.name || `haber-${Date.now()}`;
    const pngPath = path.join(outputDir, `${safeName}.png`);
    const mp4Path = path.join(outputDir, `${safeName}.mp4`);
    await renderStoryPng(input, pngPath);
    console.log(`PNG: ${pngPath}`);

    if (!args["skip-video"]) {
      await renderStoryVideo(input, mp4Path, {
        duration: args.duration || 15,
        fps: args.fps || 30,
      });
      console.log(`MP4: ${mp4Path}`);
    }
    return;
  }

  console.error(`Bilinmeyen komut: ${command}`);
  process.exitCode = 1;
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

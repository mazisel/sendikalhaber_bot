"use strict";

const fs = require("fs/promises");
const path = require("path");
const sharp = require("sharp");
const { escapeXml, multilineText, wrapText } = require("./text");

const ROOT = path.resolve(__dirname, "../..");
const WIDTH = 1080;
const HEIGHT = 1920;

const DEFAULTS = {
  brand: "sendikal.haber",
  date: "19 Mayis 2026",
  label: "Sendikal Haber",
  title: "HABER BASLIGI HABER ALT BASLIGI",
  body:
    "Haber detaylari buraya gelecek. Metin uzadiginda otomatik olarak satirlara bolunur ve panel icinde kalir.",
  cta: "CTA harekete gecirici metin gerekirse",
  photo: path.join(ROOT, "assets/sample/photo.jpg"),
  photoMotion: "none",
  logo: path.join(ROOT, "assets/sample/logo.png"),
  socialIcons: path.join(ROOT, "assets/sample/social-icons.png"),
};

function todayTr() {
  return new Intl.DateTimeFormat("tr-TR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
}

async function pathExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function imageDataUri(filePath, width, height) {
  const buffer = await sharp(filePath)
    .resize(width, height, { fit: "cover", position: "center" })
    .jpeg({ quality: 92 })
    .toBuffer();

  return `data:image/jpeg;base64,${buffer.toString("base64")}`;
}

async function logoDataUri(filePath) {
  if (!(await pathExists(filePath))) return null;
  const buffer = await sharp(filePath).resize(132, 132, { fit: "contain" }).png().toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

async function pngDataUri(filePath, width, height) {
  if (!(await pathExists(filePath))) return null;
  const buffer = await sharp(filePath).resize(width, height, { fit: "contain" }).png().toBuffer();
  return `data:image/png;base64,${buffer.toString("base64")}`;
}

function fallbackSocialIcons() {
  return `
    <circle cx="107" cy="391" r="14" fill="#2d76a0"/>
    <text x="107" y="398" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#fff" text-anchor="middle">f</text>
    <circle cx="149" cy="391" r="14" fill="#2d76a0"/>
    <text x="149" y="398" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#fff" text-anchor="middle">in</text>
    <circle cx="191" cy="391" r="14" fill="#2d76a0"/>
    <text x="191" y="398" font-family="Arial, Helvetica, sans-serif" font-size="18" font-weight="700" fill="#fff" text-anchor="middle">ig</text>
  `;
}

function renderFallbackLogo() {
  return `
    <g transform="translate(488 1626)">
      <circle cx="52" cy="52" r="52" fill="#2e354f"/>
      <path d="M34 80c21 22 58 17 68-10 8-23-9-42-34-38-24 4-24 29-7 31 9 1 13-8 26-5 12 3 15 19 2 28-18 12-42 5-55-11-8-9-19-4-16 6 2 7 8 14 16 19Z" fill="#2e7ca6"/>
      <path d="M69 20c-22-8-48 2-58 22-9 18-2 38 17 48 20 11 40 2 37-13-2-11-13-11-24-7-8 3-19-5-15-18 6-21 39-28 61-12 7 5 17 3 20-5 3-8-8-12-19-15Z" fill="#2f7fa9" opacity=".72"/>
      <path d="M72 30c13 3 25 11 34 25 6 9-4 21-15 15-12-7-26-11-38-6-8 4-9 14-1 19 6 4 16 1 25 0" fill="none" stroke="#fff" stroke-width="20" stroke-linecap="round"/>
      <path d="M34 81c9 12 24 18 38 18 12 0 22-4 29-11" fill="none" stroke="#fff" stroke-width="20" stroke-linecap="round"/>
    </g>
  `;
}

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value) {
  const t = clamp01(value);
  return 1 - Math.pow(1 - t, 3);
}

function reveal(progress, start, end) {
  if (end <= start) return progress >= end ? 1 : 0;
  return easeOutCubic((progress - start) / (end - start));
}

function animatedStyle(progress, start, end, shiftY = 0) {
  const amount = reveal(progress, start, end);
  return {
    opacity: amount.toFixed(3),
    transform: `translate(0 ${Math.round((1 - amount) * shiftY)})`,
  };
}

async function createStorySvg(input = {}) {
  const data = {
    ...DEFAULTS,
    date: input.date || DEFAULTS.date || todayTr(),
    ...input,
  };

  const progress = Math.max(0, Math.min(1, Number(data.progress ?? 1)));
  const photoUri = await imageDataUri(data.photo, 898, 432);
  const logoUri = await logoDataUri(data.logo);
  const socialIconsUri = await pngDataUri(data.socialIcons, 125, 42);
  const header = { opacity: "1", transform: "translate(0 0)" };
  const photo = { opacity: "1", transform: "translate(0 0)" };
  const panel = animatedStyle(progress, 0.0, 0.08, 34);
  const label = animatedStyle(progress, 0.04, 0.12, 12);
  const title = animatedStyle(progress, 0.09, 0.18, 18);
  const body = animatedStyle(progress, 0.16, 0.25, 18);
  const cta = animatedStyle(progress, 0.24, 0.32, 18);
  const logo = animatedStyle(progress, 0.28, 0.36, 12);

  const photoMotion = data.photoMotion === "kenburns" ? easeOutCubic(progress) : 0;
  const photoZoom = 1 + photoMotion * 0.018;
  const photoPanX = photoMotion * 5;
  const photoWidth = 898 * photoZoom;
  const photoHeight = 432 * photoZoom;
  const photoX = 91 - (photoWidth - 898) / 2 - photoPanX;
  const photoY = 467 - (photoHeight - 432) / 2;
  const titleLayout = {
    x: 139,
    y: 1025,
    maxWidth: 790,
    fontSize: 58,
    lineHeight: 62,
    maxLines: 3,
  };
  const titleLines = wrapText(
    data.title,
    titleLayout.maxWidth,
    titleLayout.fontSize,
    titleLayout.maxLines
  );
  const bodyY = Math.max(
    1153,
    titleLayout.y + Math.max(1, titleLines.length) * titleLayout.lineHeight + 4
  );

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${WIDTH}" height="${HEIGHT}" viewBox="0 0 ${WIDTH} ${HEIGHT}">
  <defs>
    <clipPath id="photoClip">
      <rect x="91" y="467" width="898" height="432" rx="26" ry="26"/>
    </clipPath>
    <filter id="softShadow" x="-20%" y="-30%" width="140%" height="170%">
      <feDropShadow dx="0" dy="10" stdDeviation="8" flood-color="#13233a" flood-opacity="0.16"/>
    </filter>
  </defs>

  <rect width="${WIDTH}" height="${HEIGHT}" fill="#ffffff"/>

  <g opacity="${header.opacity}" transform="${header.transform}">
    ${
      socialIconsUri
        ? `<image x="88" y="372" width="125" height="42" href="${socialIconsUri}" preserveAspectRatio="xMidYMid meet"/>`
        : fallbackSocialIcons()
    }
    <text x="540" y="405" font-family="Arial, Helvetica, sans-serif" font-size="58" font-weight="700" fill="#2d76a0" text-anchor="middle">${escapeXml(data.brand)}</text>
    <text x="790" y="399" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#2d76a0">${escapeXml(data.date)}</text>
  </g>

  <g opacity="${photo.opacity}" transform="${photo.transform}">
    <image x="${photoX.toFixed(2)}" y="${photoY.toFixed(2)}" width="${photoWidth.toFixed(2)}" height="${photoHeight.toFixed(2)}" href="${photoUri}" clip-path="url(#photoClip)" preserveAspectRatio="xMidYMid slice"/>
  </g>

  <g opacity="${panel.opacity}" transform="${panel.transform}">
    <rect x="69" y="868" width="941" height="725" rx="30" ry="30" fill="#2f7ea8"/>
    <g opacity="${label.opacity}" transform="${label.transform}" filter="url(#softShadow)">
      <path d="M387 820h306a27 27 0 0 1 27 27v25a27 27 0 0 1-27 27H568l-28 28-29-28H387a17 17 0 0 1-17-17v-45a17 17 0 0 1 17-17Z" fill="#303650"/>
      <text x="540" y="873" font-family="Arial, Helvetica, sans-serif" font-size="36" font-weight="700" fill="#fff" text-anchor="middle">${escapeXml(data.label)}</text>
    </g>

    <g opacity="${title.opacity}" transform="${title.transform}">
    ${multilineText({
      text: data.title,
      x: titleLayout.x,
      y: titleLayout.y,
      maxWidth: titleLayout.maxWidth,
      fontSize: titleLayout.fontSize,
      lineHeight: titleLayout.lineHeight,
      fill: "#ffffff",
      weight: 400,
      maxLines: titleLayout.maxLines,
    })}
    </g>

    <g opacity="${body.opacity}" transform="${body.transform}">
    ${multilineText({
      text: data.body,
      x: 139,
      y: bodyY,
      maxWidth: 780,
      fontSize: 30,
      lineHeight: 39,
      fill: "#b7cdf5",
      weight: 400,
      maxLines: 7,
    })}
    </g>

    <g opacity="${cta.opacity}" transform="${cta.transform}">
    ${multilineText({
      text: data.cta,
      x: 139,
      y: 1524,
      maxWidth: 760,
      fontSize: 30,
      lineHeight: 39,
      fill: "#c8daf8",
      weight: 700,
      maxLines: 2,
    })}
    </g>
  </g>

  <g opacity="${logo.opacity}" transform="${logo.transform}">
  ${
    logoUri
      ? `<image x="474" y="1626" width="132" height="132" href="${logoUri}" preserveAspectRatio="xMidYMid meet"/>`
      : renderFallbackLogo()
  }
  </g>
</svg>`;
}

async function renderStoryPng(input = {}, outputPath) {
  const svg = await createStorySvg(input);
  const buffer = await sharp(Buffer.from(svg)).png().toBuffer();
  if (outputPath) {
    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await fs.writeFile(outputPath, buffer);
  }
  return buffer;
}

module.exports = {
  DEFAULTS,
  HEIGHT,
  WIDTH,
  createStorySvg,
  renderStoryPng,
  todayTr,
};

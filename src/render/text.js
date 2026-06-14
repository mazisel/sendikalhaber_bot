"use strict";

function escapeXml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function estimateTextWidth(text, fontSize) {
  let width = 0;
  for (const char of String(text)) {
    if (char === " ") width += fontSize * 0.28;
    else if ("ilIıİ.,:;!|'".includes(char)) width += fontSize * 0.28;
    else if ("MWĞÜŞÖÇ@#%&".includes(char)) width += fontSize * 0.82;
    else if (char >= "A" && char <= "Z") width += fontSize * 0.64;
    else width += fontSize * 0.52;
  }
  return width;
}

function wrapText(text, maxWidth, fontSize, maxLines = Infinity) {
  const paragraphs = String(text ?? "")
    .replace(/\s+\n/g, "\n")
    .split(/\n+/)
    .map((part) => part.trim())
    .filter(Boolean);

  const lines = [];
  for (const paragraph of paragraphs.length ? paragraphs : [""]) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    let line = "";

    for (const word of words) {
      const candidate = line ? `${line} ${word}` : word;
      if (estimateTextWidth(candidate, fontSize) <= maxWidth || !line) {
        line = candidate;
      } else {
        lines.push(line);
        line = word;
        if (lines.length >= maxLines) break;
      }
    }

    if (line && lines.length < maxLines) lines.push(line);
    if (lines.length >= maxLines) break;
  }

  if (lines.length === maxLines) {
    const last = lines[lines.length - 1];
    if (estimateTextWidth(last, fontSize) > maxWidth) {
      lines[lines.length - 1] = `${last.slice(0, Math.max(0, last.length - 2)).trim()}...`;
    }
  }

  return lines;
}

function multilineText({
  text,
  x,
  y,
  maxWidth,
  fontSize,
  lineHeight,
  fill,
  weight = 400,
  maxLines = Infinity,
  anchor = "start",
  opacity = 1,
  transform = "",
}) {
  const lines = wrapText(text, maxWidth, fontSize, maxLines);
  const tspans = lines
    .map((line, index) => {
      const dy = index === 0 ? 0 : lineHeight;
      return `<tspan x="${x}" dy="${dy}">${escapeXml(line)}</tspan>`;
    })
    .join("");

  return [
    `<text x="${x}" y="${y}"`,
    `font-family="Arial, Helvetica, sans-serif"`,
    `font-size="${fontSize}"`,
    `font-weight="${weight}"`,
    `fill="${fill}"`,
    `text-anchor="${anchor}"`,
    `opacity="${opacity}"`,
    transform ? `transform="${transform}"` : "",
    `>${tspans}</text>`,
  ]
    .filter(Boolean)
    .join(" ");
}

module.exports = {
  escapeXml,
  multilineText,
  wrapText,
};

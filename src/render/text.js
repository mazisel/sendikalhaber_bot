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
    if (char === " ") width += fontSize * 0.32;
    else if ("ilIıİ.,:;!|'".includes(char)) width += fontSize * 0.32;
    else if ("MWĞÜŞÖÇ@#%&".includes(char)) width += fontSize * 0.86;
    else if (char >= "A" && char <= "Z") width += fontSize * 0.68;
    else width += fontSize * 0.58;
  }
  return width;
}

function splitLongToken(token, maxWidth, fontSize) {
  if (estimateTextWidth(token, fontSize) <= maxWidth) return [token];

  const chunks = [];
  let chunk = "";
  for (const char of Array.from(token)) {
    const candidate = `${chunk}${char}`;
    if (!chunk || estimateTextWidth(candidate, fontSize) <= maxWidth) {
      chunk = candidate;
    } else {
      chunks.push(chunk);
      chunk = char;
    }
  }

  if (chunk) chunks.push(chunk);
  return chunks;
}

function wrapLogicalLine(line, maxWidth, fontSize) {
  const words = line.split(/\s+/).filter(Boolean);
  const lines = [];
  let current = "";

  for (const word of words) {
    if (estimateTextWidth(word, fontSize) > maxWidth) {
      if (current) {
        lines.push(current);
        current = "";
      }

      const chunks = splitLongToken(word, maxWidth, fontSize);
      lines.push(...chunks.slice(0, -1));
      current = chunks.at(-1) || "";
      continue;
    }

    const candidate = current ? `${current} ${word}` : word;
    if (!current || estimateTextWidth(candidate, fontSize) <= maxWidth) {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }

  if (current) lines.push(current);
  return lines;
}

function truncateToWidth(text, maxWidth, fontSize) {
  const ellipsis = "...";
  if (estimateTextWidth(ellipsis, fontSize) > maxWidth) return "";

  const original = String(text ?? "").trimEnd();
  if (!original) return ellipsis;
  if (estimateTextWidth(`${original}${ellipsis}`, fontSize) <= maxWidth) {
    return `${original}${ellipsis}`;
  }

  const chars = Array.from(original);
  while (chars.length) {
    chars.pop();
    const candidate = `${chars.join("").trimEnd()}${ellipsis}`;
    if (estimateTextWidth(candidate, fontSize) <= maxWidth) return candidate;
  }

  return ellipsis;
}

function wrapText(text, maxWidth, fontSize, maxLines = Infinity) {
  const lineLimit = Number.isFinite(maxLines)
    ? Math.max(0, Math.floor(maxLines))
    : Infinity;
  if (lineLimit === 0) return [];

  const inputLines = String(text ?? "")
    .replace(/\r\n?/g, "\n")
    .split("\n");

  while (inputLines.length && !inputLines[0].trim()) inputLines.shift();
  while (inputLines.length && !inputLines[inputLines.length - 1].trim()) inputLines.pop();

  const lines = [];
  for (const rawLine of inputLines) {
    const line = rawLine.replace(/\t/g, "  ").trim();
    if (!line) {
      if (lines.length && lines[lines.length - 1] !== "") lines.push("");
      continue;
    }

    lines.push(...wrapLogicalLine(line, maxWidth, fontSize));
  }

  if (lineLimit !== Infinity && lines.length > lineLimit) {
    const limited = lines.slice(0, lineLimit);
    limited[lineLimit - 1] = truncateToWidth(limited[lineLimit - 1], maxWidth, fontSize);
    return limited;
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
      return `<tspan x="${x}" dy="${dy}">${escapeXml(line || " ")}</tspan>`;
    })
    .join("");

  return [
    `<text x="${x}" y="${y}"`,
    `font-family="Arial, Helvetica, sans-serif"`,
    `font-size="${fontSize}"`,
    `font-weight="${weight}"`,
    `fill="${fill}"`,
    `text-anchor="${anchor}"`,
    `xml:space="preserve"`,
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

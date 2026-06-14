"use strict";

const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const { spawn } = require("child_process");
const ffmpegPath = require("ffmpeg-static");
const { renderStoryPng } = require("./story");

function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { stdio: ["ignore", "pipe", "pipe"] });
    let stderr = "";
    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });
    child.on("error", reject);
    child.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(stderr || `${command} exited with code ${code}`));
    });
  });
}

async function renderStoryVideo(input = {}, outputPath, options = {}) {
  const fps = Number(options.fps || 30);
  const duration = Number(options.duration || 15);
  const totalFrames = Math.max(1, Math.round(fps * duration));
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "haber-story-video-"));

  try {
    for (let frame = 0; frame < totalFrames; frame += 1) {
      const progress = frame / Math.max(1, totalFrames - 1);
      const framePath = path.join(tmpDir, `frame-${String(frame).padStart(4, "0")}.png`);
      await renderStoryPng({ ...input, progress }, framePath);
    }

    await fs.mkdir(path.dirname(outputPath), { recursive: true });
    await run(ffmpegPath, [
      "-y",
      "-framerate",
      String(fps),
      "-i",
      path.join(tmpDir, "frame-%04d.png"),
      "-c:v",
      "libx264",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      outputPath,
    ]);
  } finally {
    await fs.rm(tmpDir, { recursive: true, force: true });
  }

  return outputPath;
}

module.exports = {
  renderStoryVideo,
};

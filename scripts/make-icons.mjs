import sharp from "sharp";
import { readFile } from "node:fs/promises";

const svg = await readFile(new URL("../public/icons/icon.svg", import.meta.url));
const out = (p) => new URL(`../public/${p}`, import.meta.url).pathname;
await sharp(svg).resize(192, 192).png().toFile(out("icons/icon-192.png"));
await sharp(svg).resize(512, 512).png().toFile(out("icons/icon-512.png"));
await sharp(svg).resize(180, 180).png().toFile(out("apple-touch-icon.png"));
await sharp(svg).resize(32, 32).png().toFile(out("favicon.png"));
// maskable: add padding so the safe zone holds the artwork
const inner = await sharp(svg).resize(400, 400).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: "#2f6b4b" } })
  .composite([{ input: inner, top: 56, left: 56 }])
  .png()
  .toFile(out("icons/icon-maskable-512.png"));
console.log("icons written");

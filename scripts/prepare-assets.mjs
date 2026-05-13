import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const input = path.join(root, "icon.png");
const assetsDir = path.join(root, "assets");
const size = 1024;
const background = "#0f172a";

async function centeredIconBuffer(source, scale = 0.72) {
  const innerSize = Math.round(size * scale);
  const icon = await sharp(source)
    .resize(innerSize, innerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer();

  const metadata = await sharp(icon).metadata();
  const left = Math.round((size - (metadata.width ?? innerSize)) / 2);
  const top = Math.round((size - (metadata.height ?? innerSize)) / 2);

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background,
    },
  })
    .composite([{ input: icon, left, top }])
    .png()
    .toBuffer();
}

async function run() {
  if (!fs.existsSync(input)) {
    throw new Error(`Root icon not found: ${input}`);
  }

  fs.mkdirSync(assetsDir, { recursive: true });
  const metadata = await sharp(input).metadata();
  console.log(`[Assets] icon.png: ${metadata.width}x${metadata.height}`);
  if ((metadata.width ?? 0) < size || (metadata.height ?? 0) < size) {
    console.warn("[Assets] icon.png is smaller than 1024x1024; generated Android icons may look soft.");
  }

  await sharp({ create: { width: size, height: size, channels: 4, background } })
    .png()
    .toFile(path.join(assetsDir, "icon-background.png"));

  const composed = await centeredIconBuffer(input);
  await sharp(composed).toFile(path.join(assetsDir, "icon-only.png"));
  await sharp(composed).toFile(path.join(assetsDir, "icon-foreground.png"));

  console.log("[Assets] Wrote assets/icon-only.png, assets/icon-foreground.png, assets/icon-background.png");
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

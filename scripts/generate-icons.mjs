import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";
import fs from "fs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = path.resolve(__dirname, "..");
const INPUT = path.join(PROJECT_ROOT, "icon.png");
const RES_DIR = path.join(PROJECT_ROOT, "android", "app", "src", "main", "res");

const densities = [
  { name: "mdpi",    launcher: 48 },
  { name: "hdpi",    launcher: 72 },
  { name: "xhdpi",   launcher: 96 },
  { name: "xxhdpi",  launcher: 144 },
  { name: "xxxhdpi", launcher: 192 },
];

const BG_COLOR = { r: 15, g: 23, b: 42, alpha: 1 }; // #0F172A

async function generate() {
  if (!fs.existsSync(INPUT)) {
    console.error(`Icon not found: ${INPUT}`);
    process.exit(1);
  }

  const metadata = await sharp(INPUT).metadata();
  console.log(`Input icon: ${metadata.width}x${metadata.height}`);

  for (const d of densities) {
    const mipmapDir = path.join(RES_DIR, `mipmap-${d.name}`);
    fs.mkdirSync(mipmapDir, { recursive: true });

    const pad = Math.round(d.launcher * 0.1);
    const innerSize = d.launcher - pad * 2;

    const iconBuf = await sharp(INPUT)
      .resize(innerSize, innerSize, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    // Square launcher
    await sharp({
      create: { width: d.launcher, height: d.launcher, channels: 4, background: BG_COLOR },
    })
      .composite([{ input: iconBuf, top: pad, left: pad }])
      .png()
      .toFile(path.join(mipmapDir, "ic_launcher.png"));

    // Round launcher (circular mask)
    const radius = d.launcher / 2;
    const circleMaskSvg = Buffer.from(
      `<svg width="${d.launcher}" height="${d.launcher}"><circle cx="${radius}" cy="${radius}" r="${radius}" fill="white"/></svg>`
    );
    const squareWithBg = await sharp({
      create: { width: d.launcher, height: d.launcher, channels: 4, background: BG_COLOR },
    })
      .composite([{ input: iconBuf, top: pad, left: pad }])
      .png()
      .toBuffer();
    await sharp(squareWithBg)
      .composite([{ input: circleMaskSvg, blend: "dest-in" }])
      .png()
      .toFile(path.join(mipmapDir, "ic_launcher_round.png"));

    console.log(`  ${d.name}: ${d.launcher}px`);
  }

  console.log("Icons generated successfully.");
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});

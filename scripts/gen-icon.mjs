import sharp from "sharp";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="180" height="180" viewBox="0 0 180 180">
  <rect width="180" height="180" rx="40" fill="#ffffff"/>
  <rect x="24" y="24" width="132" height="132" rx="28" fill="#fce8e4"/>
  <path d="M54 52h72v12H54V52zm0 26h54v12H54V78zm0 26h72v12H54V104z" fill="#b33a2b"/>
  <circle cx="136" cy="136" r="26" fill="#b33a2b"/>
  <path d="M136 124v24M124 136h24" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
</svg>`;

await sharp(Buffer.from(svg))
  .png()
  .toFile(path.join(__dirname, "..", "public", "apple-touch-icon.png"));

console.log("apple-touch-icon.png ok");

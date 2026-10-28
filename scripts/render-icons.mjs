// Draws the app icon (a plate seen from above, from the approved prototype) and
// writes assets/icon.png, adaptive-icon.png and splash-icon.png.
// Usage: node scripts/render-icons.mjs  (needs Playwright's Chromium; RHP has it)
import { writeFile } from "node:fs/promises";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
let chromium;
try {
  ({ chromium } = require("@playwright/test"));
} catch {
  ({ chromium } = require(process.env.HOME + "/Repos/RHP/node_modules/@playwright/test"));
}

// Plate centred at 512,512 with radius 300: inside the adaptive-icon safe zone.
const plate = `
  <circle cx="512" cy="530" r="300" fill="#0E3A8C" opacity=".35"/>
  <circle cx="512" cy="512" r="300" fill="#E9E6DF"/>
  <circle cx="512" cy="512" r="244" fill="#FFFFFF"/>
  <g transform="translate(512 512) scale(3.05) translate(-120 -120)">
    <g fill="#E3A84A" stroke="#B9782A" stroke-width="2.5">
      <rect x="60" y="84" width="34" height="20" rx="8" transform="rotate(-18 77 94)"/>
      <rect x="56" y="110" width="36" height="20" rx="8" transform="rotate(12 74 120)"/>
      <rect x="68" y="136" width="32" height="19" rx="8" transform="rotate(-8 84 145)"/>
      <rect x="90" y="96" width="30" height="18" rx="8" transform="rotate(28 105 105)"/>
      <rect x="94" y="120" width="30" height="18" rx="8" transform="rotate(-24 109 129)"/>
    </g>
    <path d="M128 66q14-14 30-6q14 4 12 18q6 14-8 20q-16 8-28-2q-14-10-6-30z" fill="#FFFFFF" stroke="#DCD8CC" stroke-width="2.5"/>
    <circle cx="148" cy="82" r="10" fill="#F4A21D"/>
    <path d="M126 140q22-14 46-2q8 10-2 20q-22 12-44 2q-8-10 0-20z" fill="#9C5A33" stroke="#7A4123" stroke-width="2.5"/>
    <path d="M134 164q20-10 40 0q6 9-3 16q-19 9-37 0q-6-8 0-16z" fill="#A9653B" stroke="#7A4123" stroke-width="2.5"/>
    <circle cx="90" cy="174" r="13" fill="#6E9B3E"/><circle cx="90" cy="174" r="10" fill="#DCEBC0"/>
    <circle cx="113" cy="182" r="13" fill="#6E9B3E"/><circle cx="113" cy="182" r="10" fill="#DCEBC0"/>
  </g>`;

const svg = (bg) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">${bg ? `<rect width="1024" height="1024" fill="${bg}"/>` : ""}${plate}</svg>`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1024, height: 1024 } });
async function render(markup, file, transparent) {
  await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
  await writeFile(file, await page.screenshot({ omitBackground: transparent, clip: { x: 0, y: 0, width: 1024, height: 1024 } }));
}
await render(svg("#1650B8"), "assets/icon.png", false);
await render(svg(null), "assets/adaptive-icon.png", true);
await render(svg(null), "assets/splash-icon.png", true);
await browser.close();
console.log("icons written");

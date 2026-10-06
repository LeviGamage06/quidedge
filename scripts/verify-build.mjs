import { readFileSync, existsSync } from "node:fs";

const requiredFiles = [
  "dist/index.html",
  "dist/work/index.html",
  "dist/contact/index.html",
  "dist/services/index.html",
  "dist/blog/index.html",
  "dist/sitemap-index.xml",
  "dist/robots.txt",
];

for (const file of requiredFiles) {
  if (!existsSync(file)) throw new Error(`Missing critical build output: ${file}`);
}

const read = (file) => readFileSync(file, "utf8");
const expectAll = (file, needles) => {
  const html = read(file);
  for (const needle of needles) {
    if (!html.includes(needle)) {
      throw new Error(`Critical feature marker "${needle}" missing from ${file}`);
    }
  }
};

const appsScript = "https://script.google.com/macros/s/AKfycbztf1DpfBnDGcIjIrgrrv5U_5nzL6vOhVmNZ7vNnKw1NgZAp-hZdUcRy554XGOFeM_6GQ/exec";
const casesCsv = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR3zoUDVE7TJhwtPuRyLcmKXakwXlo4_f19Ef5fbS4RmZGkYTD6MWHsEcuCpe90jG9ZfeGWB_SU0FU0/pub?gid=0&single=true&output=csv";
const testimonialsCsv = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTXvjE8M9lDwSxgVlBjnbndsN38G320jI0_L3qILSYlYdpn6-5ZNVd8Iph0K9PuVIZfsrKO_mWiQh9d/pub?gid=0&single=true&output=csv";

expectAll("dist/index.html", ["home-cases", casesCsv, "data-reel-autoplay"]);
expectAll("dist/work/index.html", ["cases-dynamic", "testimonials-grid", casesCsv, testimonialsCsv]);
expectAll("dist/contact/index.html", ["lead-form", appsScript, 'name="website"']);
expectAll("dist/services/index.html", ['id="foundation"', 'id="growth"', 'id="craft"', 'id="scale"']);
expectAll("dist/blog/index.html", ["newsletter-form", appsScript]);
expectAll("dist/robots.txt", ["Sitemap: https://www.quidedge.com/sitemap-index.xml"]);

console.log("Critical QuidEdge feature smoke checks passed.");

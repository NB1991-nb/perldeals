// Vergleicht dist/ mit dem Manifest des letzten Deploys und schreibt ein lftp-Skript,
// das nur geänderte Dateien hochlädt und entfernte löscht. Schreibt dist/.deploy-manifest.txt.
import fs from "node:fs"; import path from "node:path"; import crypto from "node:crypto";
const [oldFile, DIR = "/perldeals"] = process.argv.slice(2);
const ROOT = "dist", cur = new Map();
(function walk(d) { for (const e of fs.readdirSync(d, { withFileTypes: true })) {
  const p = path.join(d, e.name), rel = path.relative(ROOT, p).split(path.sep).join("/");
  if (rel === "data/deploy-manifest.txt" || rel.startsWith("private/")) continue;
  if (e.isDirectory()) walk(p); else cur.set(rel, crypto.createHash("md5").update(fs.readFileSync(p)).digest("hex"));
} })(ROOT);
fs.writeFileSync(path.join(ROOT, "data/deploy-manifest.txt"), [...cur].map(([f, h]) => `${h}  ${f}`).sort().join("\n") + "\n");
const old = new Map();
if (oldFile && fs.existsSync(oldFile)) for (const l of fs.readFileSync(oldFile, "utf8").split("\n")) { const m = l.match(/^([0-9a-f]{32})  (.+)$/); if (m) old.set(m[2], m[1]); }
if (!old.size) { console.log("#FULL"); process.exit(0); }
const q = s => '"' + s.replace(/(["\\$`])/g, "\\$1") + '"';
const changed = [...cur].filter(([f, h]) => old.get(f) !== h).map(([f]) => f);
const removed = [...old.keys()].filter(f => !cur.has(f));
if (changed.length > 4000) { console.log("#FULL"); process.exit(0); }
// parallel hochladen: mput -d legt Unterordner an, -P 8 = 8 gleichzeitige Uploads
const out = [`lcd ${ROOT}`];
for (let i = 0; i < changed.length; i += 150) out.push(`mput -d -P 8 -O ${q(DIR)} ` + changed.slice(i, i + 150).map(q).join(" "));
out.push("lcd ..");
for (const f of changed) out.push(`#put ${f}`);
for (const f of removed) out.push(`rm -f ${q(DIR + "/" + f)}`);
console.log(out.join("\n"));

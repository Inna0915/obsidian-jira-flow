/* One-off: backfill completed_at / completed_week / done tag for pre-upgrade
 * task files, derived from the `updated` date. Only touches files in a
 * "completed" column (mapped_column not in the incomplete set) that lack
 * completed_at. Idempotent: re-running skips already-marked files.
 * ISO week matches the plugin's getIsoWeekInfo exactly. */
const fs = require("fs");
const path = require("path");

const DIR = "D:/obsidian/WongsNote/60_JiraSync/Tasks";
const INCOMPLETE = new Set(["FUNNEL", "DEFINING", "READY", "TO DO", "EXECUTION"]);
const APPLY = process.argv.includes("--apply");

function isoWeekInfo(date) {
  const t = new Date(date);
  t.setHours(0, 0, 0, 0);
  t.setDate(t.getDate() + 3 - ((t.getDay() + 6) % 7));
  const isoYear = t.getFullYear();
  const week1 = new Date(isoYear, 0, 4);
  const week = 1 + Math.round(((t - week1) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7);
  return { year: isoYear, week };
}
function isoWeekStr(ymd) {
  const d = new Date(`${ymd}T00:00:00`);
  const { year, week } = isoWeekInfo(d);
  return `${year}-W${String(week).padStart(2, "0")}`;
}
function scalar(inner, key) {
  const m = inner.match(new RegExp(`^${key}:[ \\t]*(.*)$`, "m"));
  if (!m) return "";
  let v = m[1].trim();
  // Strip a single pair of surrounding matching quotes (frontmatterToYaml quotes
  // values; Obsidian processFrontMatter does not — handle both).
  if (v.length >= 2 && ((v[0] === '"' && v[v.length - 1] === '"') || (v[0] === "'" && v[v.length - 1] === "'"))) {
    v = v.slice(1, -1);
  }
  return v.trim();
}

const files = fs.readdirSync(DIR).filter((f) => f.endsWith(".md"));
let filled = 0, skipExisting = 0, skipIncomplete = 0, skipNoUpdated = 0, skipNoFm = 0;
const samples = [];

for (const f of files) {
  const full = path.join(DIR, f);
  const content = fs.readFileSync(full, "utf8");
  const m = content.match(/^---\n([\s\S]*?)\n---/);
  if (!m) { skipNoFm++; continue; }
  const inner = m[1];
  const after = content.slice(m[0].length);

  if (scalar(inner, "completed_at")) { skipExisting++; continue; }
  const col = (scalar(inner, "mapped_column") || "").toUpperCase();
  if (!col || INCOMPLETE.has(col)) { skipIncomplete++; continue; }
  const updated = scalar(inner, "updated");
  if (!updated || updated.length < 10) { skipNoUpdated++; continue; }

  const ymd = updated.slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd)) { skipNoUpdated++; continue; }
  const week = isoWeekStr(ymd);
  if (!/^\d{4}-W\d{2}$/.test(week)) { skipNoUpdated++; continue; }

  // 1) add done/<week> into tags list
  let lines = inner.split("\n");
  if (!inner.includes(`done/${week}`)) {
    const ti = lines.findIndex((l) => /^tags:\s*$/.test(l));
    if (ti >= 0) {
      let j = ti + 1;
      while (j < lines.length && /^\s*-\s/.test(lines[j])) j++;
      lines.splice(j, 0, `  - done/${week}`);
    } else {
      lines.push("tags:", `  - done/${week}`);
    }
  }
  // 2) append scalar marks
  let newInner = lines.join("\n");
  newInner += `\ncompleted_at: ${ymd}\ncompleted_week: ${week}`;

  const newContent = `---\n${newInner}\n---${after}`;
  if (APPLY) fs.writeFileSync(full, newContent, "utf8");
  filled++;
  if (samples.length < 5) samples.push(`${f.slice(0, 30)}… [${col}] -> ${ymd} ${week}`);
}

console.log(APPLY ? "=== APPLIED ===" : "=== DRY RUN (加 --apply 才写入) ===");
console.log(`总:${files.length} | 回填:${filled} | 已有跳过:${skipExisting} | 非完成列跳过:${skipIncomplete} | 无updated跳过:${skipNoUpdated} | 无frontmatter:${skipNoFm}`);
console.log("示例:");
samples.forEach((s) => console.log("  " + s));

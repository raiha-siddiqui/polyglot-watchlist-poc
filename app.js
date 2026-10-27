"use strict";
// Fictional reference records (the project's authored fixtures). No real people or organisations.
const RECORDS = [
  ["syn-001", "Luma Vesper", ["Luma Vesper", "L. Vesper"]],
  ["syn-002", "Lumo Vespar", ["Lumo Vespar", "L. Vespar"]],
  ["syn-003", "Élo Nivara", ["Élo Nivara", "Elo Nivara"]],
  ["syn-004", "Aster Quill Workshop", ["Aster Quill Workshop", "Aster Quill"]],
  ["syn-005", "Mira Velune", ["Mira Velune", "Мира Велуне"]],
  ["syn-006", "Naro Zefir", ["Naro Zefir", "Наро Зефир"]],
  ["syn-007", "Sira Lumen", ["Sira Lumen", "سيرا لومين"]],
  ["syn-008", "Daro Nuvem", ["Daro Nuvem", "دارو نوفيم"]],
  ["syn-009", "Copper Kite Guild", ["Copper Kite Guild", "Copper Kite"]],
  ["syn-010", "Moonberry Loom", ["Moonberry Loom", "Moonberry Loom Studio"]],
  ["syn-011", "Tavi Orlun", ["Tavi Orlun", "Tavi O."]],
  ["syn-012", "Luma Vesper", ["Luma Vesper", "Luma V."]],
  ["ml-001", "Blue Cedar Library", ["Blue Cedar Library", "مكتبة الأرز الأزرق"]],
  ["ml-002", "Blue Palm Library", ["Blue Palm Library", "مكتبة النخيل الأزرق"]],
  ["ml-003", "Golden Moon Bakery", ["Golden Moon Bakery", "مخبز القمر الذهبي"]],
  ["ml-004", "Silver Moon Bakery", ["Silver Moon Bakery", "مخبز القمر الفضي"]],
  ["ml-005", "Green River Workshop", ["Green River Workshop", "ورشة النهر الأخضر"]],
  ["ml-006", "Green Mountain Workshop", ["Green Mountain Workshop", "ورشة الجبل الأخضر"]],
  ["ml-007", "Neri Vasko", ["Neri Vasko", "نيري فاسكو"]],
  ["ml-008", "Nera Vasko", ["Nera Vasko", "نيرا فاسكو"]],
  ["ml-009", "Amber Kite Studio", ["Amber Kite Studio", "استوديو الطائرة الورقية الكهرمانية"]],
  ["ml-010", "Amber Kite Studio", ["Amber Kite Studio", "استوديو الطائرة الورقية الكهرمانية"]],
].map(([id, name, aliases]) => ({ id, name, aliases }));

const EXAMPLES = ["Luma Vesper", "Lumo Vespar", "Мира Велуне", "Naro Zefir", "سيرا لومين", "Elo Nivara", "Amber Kite", "Copper Kyte Guild"];

// Same idea as the Python normaliser: compatibility form, case-folding, collapsed spaces.
const normalize = (s) => s.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();

const CYR = { а:"a",б:"b",в:"v",г:"g",д:"d",е:"e",ё:"e",ж:"zh",з:"z",и:"i",й:"i",к:"k",л:"l",м:"m",н:"n",о:"o",п:"p",р:"r",с:"s",т:"t",у:"u",ф:"f",х:"kh",ц:"ts",ч:"ch",ш:"sh",щ:"shch",ы:"y",э:"e",ю:"yu",я:"ya",ь:"",ъ:"" };
// A deliberately rough Arabic-to-Latin map: enough to show cross-script retrieval in a mock-up.
const ARA = { "ا":"a","أ":"a","إ":"i","آ":"a","ب":"b","ت":"t","ث":"th","ج":"j","ح":"h","خ":"kh","د":"d","ذ":"dh","ر":"r","ز":"z","س":"s","ش":"sh","ص":"s","ض":"d","ط":"t","ظ":"z","ع":"a","غ":"gh","ف":"f","ق":"q","ك":"k","ل":"l","م":"m","ن":"n","ه":"h","ة":"a","و":"u","ي":"i","ى":"a","ئ":"i","ؤ":"u","ء":"" };
function transliterate(s) {
  const n = normalize(s);
  let out = "";
  for (const ch of n) out += CYR[ch] ?? ARA[ch] ?? ch;
  return out.normalize("NFD").replace(/\p{M}/gu, "");
}

function levenshtein(a, b) {
  a = [...a]; b = [...b];
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
    }
    prev = cur;
  }
  return prev[b.length];
}
// Normalised similarity x100, like RapidFuzz's normalized Levenshtein similarity.
function similarity(a, b) {
  const len = Math.max([...a].length, [...b].length);
  return len === 0 ? 100 : 100 * (1 - levenshtein(a, b) / len);
}

function score(query, alias, method) {
  const lev = similarity(normalize(query), normalize(alias));
  if (method === "lev") return lev;
  const tr = similarity(transliterate(query), transliterate(alias));
  return method === "translit" ? tr : Math.max(lev, tr);
}

function rank(query, method, k = 6) {
  return RECORDS.map((r) => {
    let best = { s: -1, direct: -1, alias: "" };
    for (const a of r.aliases) {
      // On equal scores, show the alias that matches without transliteration (same script).
      const s = score(query, a, method), direct = similarity(normalize(query), normalize(a));
      if (s > best.s || (s === best.s && direct > best.direct)) best = { s, direct, alias: a };
    }
    return { ...r, score: best.s, alias: best.alias };
  }).sort((x, y) => y.score - x.score || x.id.localeCompare(y.id)).slice(0, k);
}

const $ = (id) => document.getElementById(id);
const esc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;" })[c]);
let current = null;

function render() {
  const q = $("q").value;
  const method = $("method").value;
  if (!normalize(q)) { $("rows").innerHTML = ""; $("norm").textContent = ""; $("ambig").classList.add("hidden"); return; }
  const res = rank(q, method);
  $("norm").innerHTML = `Normalised: <b>${esc(normalize(q))}</b> · Latin transliteration: <b>${esc(transliterate(q))}</b>`;
  $("rows").innerHTML = res.map((r, i) => `
    <tr><td>${i + 1}</td>
      <td>${esc(r.name)} <span class="id">${r.id}</span></td>
      <td dir="auto">${esc(r.alias)}</td>
      <td><div class="barwrap"><div class="bar" style="width:${Math.max(2, r.score * 0.8)}%"></div><span class="score">${r.score.toFixed(1)}</span></div></td></tr>`).join("");
  const top = res[0];
  const tied = res.filter((r) => Math.abs(r.score - top.score) < 1e-9 && r.name === top.name);
  const amb = $("ambig");
  if (tied.length > 1) {
    amb.innerHTML = `<b>Shared name:</b> ${tied.map((t) => t.id).join(" and ")} are <em>different records</em> with the same name. The system shows both and leaves the decision to a person.`;
    amb.classList.remove("hidden");
  } else amb.classList.add("hidden");
  current = { query: q, method, candidates: res.slice(0, 5) };
}

let debounce;
$("q").addEventListener("input", () => { clearTimeout(debounce); debounce = setTimeout(render, 120); });
$("method").addEventListener("change", render);
$("examples").innerHTML = EXAMPLES.map((e) => `<button class="chip" type="button" dir="auto">${esc(e)}</button>`).join("");
$("examples").addEventListener("click", (ev) => {
  if (ev.target.matches(".chip")) { $("q").value = ev.target.textContent; render(); }
});

// ---------- Review + hash-chained audit ----------
const chain = [];
async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
async function append(type, payload) {
  const prev = chain.length ? chain[chain.length - 1].hash : "0".repeat(64);
  const body = JSON.stringify({ seq: chain.length + 1, type, payload, prev });
  chain.push({ seq: chain.length + 1, type, payload, prev, hash: await sha256(body) });
  drawChain();
}
function drawChain(bad = new Set()) {
  $("chain").innerHTML = chain.map((e) => `
    <li class="${bad.has(e.seq) ? "bad" : ""}"><b>#${e.seq} ${esc(e.type)}</b><br>
    <span dir="auto">${esc(JSON.stringify(e.payload))}</span><br>
    <span class="hash">hash ${e.hash.slice(0, 24)}… · prev ${e.prev.slice(0, 12)}…</span></li>`).join("") || `<li class="muted">No events yet.</li>`;
}
async function verify() {
  const bad = new Set();
  let prev = "0".repeat(64);
  for (const e of chain) {
    const h = await sha256(JSON.stringify({ seq: e.seq, type: e.type, payload: e.payload, prev }));
    if (e.prev !== prev || h !== e.hash) bad.add(e.seq);
    prev = e.hash;
  }
  drawChain(bad);
  $("chainStatus").innerHTML = !chain.length ? "" : bad.size
    ? `<span class="bad">✗ Chain broken at event #${Math.min(...bad)} — tampering detected.</span>`
    : `<span class="ok">✓ All ${chain.length} events verify.</span>`;
}

let caseNo = 0, reviewed = false;
$("q").addEventListener("change", startCase);
$("examples").addEventListener("click", (ev) => { if (ev.target.matches(".chip")) startCase(); });
async function startCase() {
  if (!current) return;
  caseNo += 1; reviewed = false;
  $("reviewCase").innerHTML = `Case <b>#${caseNo}</b> for <b dir="auto">${esc(current.query)}</b> — awaiting human review.`;
  $("outcomes").disabled = false; $("submit").disabled = false; $("reviewMsg").textContent = "";
  $("cand").innerHTML = current.candidates.map((c) => `<option value="${c.id}">${c.id} — ${esc(c.name)} (${c.score.toFixed(1)})</option>`).join("");
  await append("case_started", { case: caseNo, query: current.query, method: current.method });
  await append("evidence_packet", { case: caseNo, candidates: current.candidates.map((c) => c.id) });
}
document.querySelectorAll('input[name="o"]').forEach((r) => r.addEventListener("change", () => {
  $("cand").classList.toggle("hidden", r.value !== "candidate_for_follow_up" || !r.checked);
}));
$("submit").addEventListener("click", async () => {
  const o = document.querySelector('input[name="o"]:checked');
  const reason = $("reason").value.trim();
  if (reviewed) { $("reviewMsg").innerHTML = `<span class="bad">This case already has an accepted review — duplicates are rejected.</span>`; return; }
  if (!o || !reason) { $("reviewMsg").innerHTML = `<span class="bad">Choose an outcome and give a reason.</span>`; return; }
  reviewed = true;
  await append("review_accepted", { case: caseNo, outcome: o.value, candidate: o.value === "candidate_for_follow_up" ? $("cand").value : null, reason });
  $("reviewMsg").innerHTML = `<span class="ok">Review recorded.</span> A human annotation — not an identity finding.`;
  verify();
});
$("verify").addEventListener("click", verify);
$("tamper").addEventListener("click", () => {
  if (!chain.length) return;
  const e = chain[Math.floor(chain.length / 2)];
  e.payload = { ...e.payload, tampered: "edited after the fact" };
  verify();
});
drawChain();

// ---------- Results chart (historical, regression-only diagnostics) ----------
(function chart() {
  const sets = [["Fictional challenge", 27, [20, 26, 25]], ["Small public set", 141, [129, 141, 139]], ["Bilingual fictional", 30, [16, 25, 21]]];
  const methods = [["RapidFuzz (spelling)", "var(--bar3)"], ["E5 embeddings", "var(--bar)"], ["E5 + reranker", "var(--bar2)"]];
  const svg = $("chart"), W = 960, H = 330, x0 = 70, y0 = 270, h = 220;
  let out = "";
  for (let p = 0; p <= 100; p += 25) {
    const y = y0 - (p / 100) * h;
    out += `<line x1="${x0}" x2="${W - 20}" y1="${y}" y2="${y}" class="grid"/><text x="${x0 - 12}" y="${y + 4}" class="s" style="text-anchor:end">${p}%</text>`;
  }
  const gw = (W - x0 - 40) / sets.length;
  sets.forEach(([name, n, hits], gi) => {
    const gx = x0 + 20 + gi * gw;
    hits.forEach((v, mi) => {
      const pct = v / n, bh = pct * h, bx = gx + mi * 72;
      out += `<rect x="${bx}" y="${y0 - bh}" width="60" height="${bh}" rx="4" style="fill:${methods[mi][1]}"><title>${methods[mi][0]}: ${v}/${n}</title></rect>`;
      out += `<text x="${bx + 30}" y="${y0 - bh - 6}" class="s">${v}/${n}</text>`;
    });
    out += `<text x="${gx + 102}" y="${y0 + 22}" class="t" style="font-size:13px">${name}</text>`;
  });
  methods.forEach(([m, c], i) => {
    out += `<rect x="${x0 + i * 230}" y="${y0 + 38}" width="14" height="10" style="fill:${c}"/><text x="${x0 + i * 230 + 20}" y="${y0 + 47}" class="s" style="text-anchor:start">${m}</text>`;
  });
  svg.innerHTML = out;
})();

$("q").value = "Lumo Vespar";
render();
startCase();

// Ruleta de Loot - 100% Frontend (GitHub Pages compatible)
// - winners con contador (sin repetir loot)
// - botón borrar historial
// - animación ruleta + vuelve a posición inicial
// - selector de player arreglado (no se queda siempre en el primero)

const LS_KEY = "ruleta_loot_v2";
const $ = (id) => document.getElementById(id);

const state = {
  prizes: [],        // {id, name, qty, remaining}
  participants: [],  // {id, name, active, wins:{[lootName]:count}}
  history: [],       // {ts, participantName, prizeName}
  options: {
    uniqueWinner: true,
    noRepeatPrize: false,
    weightedByStock: true,
    spinMs: 4200,
    extraTurns: 6
  },
  lastPrizeId: null
};

/* ---------------- Storage ---------------- */
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16);
}

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state));
}

function normalizeLoadedState(parsed) {
  // Compatibilidad por si venías de versiones viejas:
  // - wins array -> objeto contador
  if (Array.isArray(parsed?.participants)) {
    parsed.participants = parsed.participants.map(p => {
      if (!p) return p;

      // wins ya es objeto contador
      if (p.wins && typeof p.wins === "object" && !Array.isArray(p.wins)) {
        return { ...p, wins: p.wins };
      }

      // wins era array ["A","A","B"] -> {A:2,B:1}
      if (Array.isArray(p.wins)) {
        const map = {};
        for (const name of p.wins) {
          const key = String(name);
          map[key] = (map[key] || 0) + 1;
        }
        return { ...p, wins: map };
      }

      return { ...p, wins: {} };
    });
  }

  // Ensure options
  parsed.options = parsed.options || {};
  parsed.options.uniqueWinner ??= true;
  parsed.options.noRepeatPrize ??= false;
  parsed.options.weightedByStock ??= true;
  parsed.options.spinMs ??= 4200;
  parsed.options.extraTurns ??= 6;

  return parsed;
}

function load() {
  const raw = localStorage.getItem(LS_KEY);
  if (!raw) return;
  try {
    const parsed = normalizeLoadedState(JSON.parse(raw));
    Object.assign(state, parsed);
  } catch (e) {
    console.warn("No se pudo cargar localStorage:", e);
  }
}

function resetAll() {
  localStorage.removeItem(LS_KEY);
  location.reload();
}

/* ---------------- Helpers ---------------- */
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  }[c]));
}

function formatWins(winsObj) {
  if (!winsObj || typeof winsObj !== "object") return "—";
  const entries = Object.entries(winsObj).filter(([, v]) => Number(v) > 0);
  if (entries.length === 0) return "—";
  entries.sort((a, b) => (b[1] - a[1]) || a[0].localeCompare(b[0]));
  return entries.map(([name, count]) => `${name} x${count}`).join(", ");
}

function setResult(text, warn = false) {
  const el = $("result");
  if (!el) return;
  el.textContent = text;
  el.classList.toggle("muted", !warn);
}

/* ---------------- UI Render ---------------- */
function renderOptions() {
  $("optUniquePrize").checked = !!state.options.uniqueWinner;
  $("optNoRepeatPrize").checked = !!state.options.noRepeatPrize;
  $("optWeighted").checked = !!state.options.weightedByStock;
  $("spinMs").value = state.options.spinMs;
  $("extraTurns").value = state.options.extraTurns;
}

function renderPrizes() {
  const el = $("prizeList");
  el.innerHTML = "";

  state.prizes.forEach(p => {
    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <div><strong>${escapeHtml(p.name)}</strong></div>
        <div class="meta">Stock: ${p.remaining}/${p.qty}</div>
      </div>
      <div class="row">
        <button data-act="minus" data-id="${p.id}">-1</button>
        <button data-act="plus" data-id="${p.id}">+1</button>
        <button data-act="del" data-id="${p.id}" class="danger">Eliminar</button>
      </div>
    `;
    el.appendChild(div);
  });

  el.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const prize = state.prizes.find(x => x.id === id);
      if (!prize) return;

      if (act === "del") {
        state.prizes = state.prizes.filter(x => x.id !== id);
      } else if (act === "minus") {
        prize.remaining = Math.max(0, prize.remaining - 1);
      } else if (act === "plus") {
        prize.qty += 1;
        prize.remaining += 1;
      }

      save();
      renderAll();
    });
  });
}

function renderParticipants() {
  const el = $("participantList");
  el.innerHTML = "";

  state.participants.forEach(p => {
    const winsText = formatWins(p.wins);

    const div = document.createElement("div");
    div.className = "item";
    div.innerHTML = `
      <div>
        <div><strong>${escapeHtml(p.name)}</strong> ${p.active ? "" : "<span class='meta'>(eliminado)</span>"}</div>
        <div class="meta">Ganó: ${escapeHtml(winsText)}</div>
      </div>
      <div class="row">
        <button data-act="toggle" data-id="${p.id}">${p.active ? "Eliminar" : "Reactivar"}</button>
        <button data-act="del" data-id="${p.id}" class="danger">Borrar</button>
      </div>
    `;
    el.appendChild(div);
  });

  el.querySelectorAll("button").forEach(btn => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id;
      const act = btn.dataset.act;
      const person = state.participants.find(x => x.id === id);
      if (!person) return;

      if (act === "del") {
        state.participants = state.participants.filter(x => x.id !== id);
      } else if (act === "toggle") {
        person.active = !person.active;
      }

      save();
      renderAll();
    });
  });

  // --- SELECT (FIX) ---
  const sel = $("participantSelect");
  const prevSelected = sel.value; // preservar selección previa
  sel.innerHTML = "";

  const actives = state.participants.filter(p => p.active);

  if (actives.length === 0) {
    const opt = document.createElement("option");
    opt.value = "";
    opt.textContent = "No hay players activos";
    sel.appendChild(opt);
    sel.disabled = true;
  } else {
    sel.disabled = false;

    actives.forEach(p => {
      const opt = document.createElement("option");
      opt.value = p.id;
      opt.textContent = p.name;
      sel.appendChild(opt);
    });

    const stillExists = actives.some(p => p.id === prevSelected);
    sel.value = stillExists ? prevSelected : actives[0].id;
  }

  // contador en el acordeón
  const countEl = document.getElementById("playersCount");
  if (countEl) countEl.textContent = `(${state.participants.length})`;
}

function renderHistory() {
  const el = $("history");
  el.innerHTML = "";

  const items = [...state.history].slice(-80).reverse();
  if (items.length === 0) {
    el.innerHTML = `<div class="muted">Aún no hay resultados.</div>`;
    return;
  }

  items.forEach(h => {
    const div = document.createElement("div");
    div.className = "badge";
    const date = new Date(h.ts).toLocaleString();
    div.innerHTML = `<span class="ok">✔</span> <strong>${escapeHtml(h.participantName)}</strong> → ${escapeHtml(h.prizeName)} <span class="meta">(${date})</span>`;
    el.appendChild(div);
  });
}

function renderAll() {
  renderOptions();
  renderPrizes();
  renderParticipants();
  renderHistory();
  drawWheel();
}

/* ---------------- Wheel (Canvas) ---------------- */
const canvas = $("wheel");
const ctx = canvas.getContext("2d");
let wheelAngle = 0;
let spinning = false;

function availablePrizes() {
  return state.prizes.filter(p => p.remaining > 0);
}

function drawWheel() {
  const prizes = availablePrizes();
  const W = canvas.width, H = canvas.height;
  const cx = W / 2, cy = H / 2;
  const r = Math.min(W, H) / 2 - 10;

  ctx.clearRect(0, 0, W, H);

  // base ring
  ctx.beginPath();
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(255,255,255,.06)";
  ctx.fill();

  if (prizes.length === 0) {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(wheelAngle);
    ctx.fillStyle = "rgba(255,255,255,.85)";
    ctx.font = "20px system-ui";
    ctx.textAlign = "center";
    ctx.fillText("Sin loot con stock", 0, 6);
    ctx.restore();
    return;
  }

  const totalSlices = prizes.length;
  const slice = (Math.PI * 2) / totalSlices;

  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(wheelAngle);

  for (let i = 0; i < totalSlices; i++) {
    const a0 = i * slice;
    const a1 = a0 + slice;

    const isEven = i % 2 === 0;
    ctx.fillStyle = isEven ? "rgba(106,163,255,.35)" : "rgba(255,255,255,.12)";

    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.arc(0, 0, r, a0, a1);
    ctx.closePath();
    ctx.fill();

    // texto
    ctx.save();
    const mid = (a0 + a1) / 2;
    ctx.rotate(mid);
    ctx.textAlign = "right";
    ctx.fillStyle = "rgba(255,255,255,.92)";
    ctx.font = "16px system-ui";
    const label = `${prizes[i].name} (${prizes[i].remaining})`;
    ctx.fillText(label, r - 12, 6);
    ctx.restore();
  }

  // centro
  ctx.beginPath();
  ctx.arc(0, 0, 70, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(0,0,0,.18)";
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,.9)";
  ctx.font = "18px system-ui";
  ctx.textAlign = "center";
  ctx.fillText("GIRAR", 0, 6);

  ctx.restore();
}

function pickPrizeIndex(prizes) {
  if (prizes.length === 1) return 0;

  // evitar repetir consecutivo si se puede
  const candidates = state.options.noRepeatPrize && state.lastPrizeId
    ? prizes.filter(p => p.id !== state.lastPrizeId)
    : prizes;

  const pool = candidates.length ? candidates : prizes;

  if (state.options.weightedByStock) {
    const weights = pool.map(p => Math.max(1, p.remaining));
    const sum = weights.reduce((a, b) => a + b, 0);
    let roll = Math.random() * sum;

    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return prizes.findIndex(p => p.id === pool[i].id);
    }
  }

  return Math.floor(Math.random() * prizes.length);
}

function angleForIndex(index, total) {
  const slice = (Math.PI * 2) / total;
  // centro del slice arriba del puntero
  return -(index * slice + slice / 2);
}

function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function normalizeAngleForward(a) {
  const two = Math.PI * 2;
  while (a < 0) a += two;
  return a;
}

// Animación para volver a 0 por el camino más corto (sin empujar vueltas raras)
function animateWheelTo(targetAngle, duration = 450) {
  const startAngle = wheelAngle;
  let delta = targetAngle - startAngle;
  const two = Math.PI * 2;
  delta = ((delta + Math.PI) % two) - Math.PI;

  const start = performance.now();
  return new Promise(resolve => {
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const e = easeInOutCubic(t);
      wheelAngle = startAngle + delta * e;
      drawWheel();
      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });
}

async function spin() {
  if (spinning) return;

  const prizes = availablePrizes();
  if (prizes.length === 0) {
    setResult("No hay loot con stock disponible.", true);
    return;
  }

  const participantId = $("participantSelect").value;
  const participant = state.participants.find(p => p.id === participantId);

  if (!participant || !participant.active) {
    setResult("Seleccioná un player activo.", true);
    return;
  }

  spinning = true;
  $("btnSpin").disabled = true;

  const idx = pickPrizeIndex(prizes);
  const total = prizes.length;

  const targetAngle = angleForIndex(idx, total);
  const turns = Math.max(2, Number(state.options.extraTurns) || 6);
  const finalAngle = targetAngle + turns * Math.PI * 2;

  const duration = Math.max(800, Number(state.options.spinMs) || 4200);
  const startAngle = wheelAngle;
  const delta = normalizeAngleForward(finalAngle - startAngle);

  const start = performance.now();
  await new Promise(resolve => {
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const e = easeOutCubic(t);
      wheelAngle = startAngle + delta * e;
      drawWheel();

      // micro “shake” final
      if (t > 0.92) {
        wheelAngle += Math.sin(now / 20) * (1 - t) * 0.06;
      }

      if (t < 1) requestAnimationFrame(frame);
      else resolve();
    };
    requestAnimationFrame(frame);
  });

  // aplicar loot
  const prize = prizes[idx];
  prize.remaining = Math.max(0, prize.remaining - 1);
  state.lastPrizeId = prize.id;

  // contador de loot por player
  participant.wins = (participant.wins && typeof participant.wins === "object" && !Array.isArray(participant.wins))
    ? participant.wins
    : {};
  participant.wins[prize.name] = (participant.wins[prize.name] || 0) + 1;

  // historial global
  state.history.push({
    ts: Date.now(),
    participantName: participant.name,
    prizeName: prize.name
  });

  // regla: un player solo gana una vez
  if (state.options.uniqueWinner) {
    participant.active = false;
  }

  save();
  setResult(`🎉 ${participant.name} ganó: ${prize.name}`, false);
  renderAll();

  // volver a posición inicial
  await animateWheelTo(0, 500);
  drawWheel();

  $("btnSpin").disabled = false;
  spinning = false;
}

/* ---------------- Actions ---------------- */
function addPrize(name, qty) {
  name = (name || "").trim();
  qty = Number(qty);
  if (!name || !Number.isFinite(qty) || qty <= 0) return;

  const existing = state.prizes.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    existing.qty += qty;
    existing.remaining += qty;
  } else {
    state.prizes.push({ id: uid(), name, qty, remaining: qty });
  }

  save();
  renderAll();
}

function addParticipant(name) {
  name = (name || "").trim();
  if (!name) return;

  const existing = state.participants.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) return;

  const newId = uid();
  state.participants.push({ id: newId, name, active: true, wins: {} });

  save();
  renderAll();

  // seleccionar automáticamente el recién agregado
  const sel = $("participantSelect");
  if (sel && !sel.disabled) sel.value = newId;
}

function addParticipantsBulk(text) {
  const lines = (text || "")
    .split("\n")
    .map(x => x.trim())
    .filter(Boolean);

  let added = 0;
  for (const line of lines) {
    const before = state.participants.length;
    addParticipant(line);
    if (state.participants.length > before) added++;
  }
  return added;
}

function skipParticipant() {
  const sel = $("participantSelect");
  if (sel.disabled) return;

  const opts = [...sel.options];
  if (opts.length <= 1) return;

  sel.selectedIndex = (sel.selectedIndex + 1) % opts.length;
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "ruleta-loot-data.json";
  a.click();
  URL.revokeObjectURL(a.href);
}

function importJSON(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsedRaw = JSON.parse(reader.result);
      const parsed = normalizeLoadedState(parsedRaw);
      if (!parsed || typeof parsed !== "object") throw new Error("Formato inválido");

      Object.assign(state, parsed);
      save();
      renderAll();
      setResult("Importado correctamente.", false);
    } catch {
      setResult("No se pudo importar el JSON.", true);
    }
  };
  reader.readAsText(file);
}

// Borra historial y wins para nueva instancia.
// (Si querés reactivar a todos los players, dejá active:true)
function clearHistoryAndWins() {
  state.history = [];
  state.participants = state.participants.map(p => ({
    ...p,
    active: true,
    wins: {}
  }));
  save();
  renderAll();
  setResult("Historial borrado. Nueva instancia lista.", false);
}

/* ---------------- Init ---------------- */
load();

$("btnAddPrize").addEventListener("click", () => {
  addPrize($("prizeName").value, $("prizeQty").value);
  $("prizeName").value = "";
  $("prizeQty").value = 1;
});

$("btnAddParticipant").addEventListener("click", () => {
  addParticipant($("participantName").value);
  $("participantName").value = "";
});

$("btnAddBulk").addEventListener("click", () => {
  const added = addParticipantsBulk($("bulkParticipants").value);
  $("bulkParticipants").value = "";
  if (added > 0) setResult(`Cargados ${added} players.`, false);
});

$("btnSpin").addEventListener("click", spin);
$("btnSkip").addEventListener("click", skipParticipant);

$("optUniquePrize").addEventListener("change", (e) => {
  state.options.uniqueWinner = e.target.checked;
  save();
});
$("optNoRepeatPrize").addEventListener("change", (e) => {
  state.options.noRepeatPrize = e.target.checked;
  save();
});
$("optWeighted").addEventListener("change", (e) => {
  state.options.weightedByStock = e.target.checked;
  save();
});
$("spinMs").addEventListener("change", (e) => {
  state.options.spinMs = Math.max(800, Number(e.target.value) || 4200);
  save();
});
$("extraTurns").addEventListener("change", (e) => {
  state.options.extraTurns = Math.max(2, Number(e.target.value) || 6);
  save();
});

$("btnReset").addEventListener("click", () => {
  if (confirm("¿Seguro? Se borra TODO (loot, players, historial) de este navegador.")) resetAll();
});

$("btnClearHistory").addEventListener("click", () => {
  if (confirm("¿Borrar historial y ganados de players? (deja loot cargado)")) {
    clearHistoryAndWins();
  }
});

$("btnExport").addEventListener("click", exportJSON);
$("btnImport").addEventListener("click", () => $("importFile").click());

$("importFile").addEventListener("change", (e) => {
  const f = e.target.files?.[0];
  if (f) importJSON(f);
  e.target.value = "";
});

// Primer render
renderAll();
drawWheel();

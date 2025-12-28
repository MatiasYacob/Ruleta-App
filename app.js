// Loot Roulette - 100% Frontend
// - Loot con stock
// - Players + carga masiva
// - Contador de loot por player (xN)
// - Historial + export/import JSON
// - Borrar historial (nueva instancia)
// - Ruleta animada + vuelve a 0 al final
// - Selector de player arreglado

const LS_KEY = "ruleta_loot_v3"
const $ = (id) => document.getElementById(id)

// Valores fijos (ya no hay inputs en Config)
const SPIN_MS = 4200
const EXTRA_TURNS = 6

const state = {
  prizes: [], // {id, name, qty, remaining}
  participants: [], // {id, name, active, wins:{[lootName]:count}}
  history: [], // {ts, participantName, prizeName}
  options: {
    uniqueWinner: true,
    noRepeatPrize: false,
    weightedByStock: true,
  },
  lastPrizeId: null,
}

/* ---------------- Storage ---------------- */
function uid() {
  return Math.random().toString(16).slice(2) + Date.now().toString(16)
}

function save() {
  localStorage.setItem(LS_KEY, JSON.stringify(state))
}

function normalizeLoadedState(parsed) {
  // Compat: wins array -> objeto contador
  if (Array.isArray(parsed?.participants)) {
    parsed.participants = parsed.participants.map((p) => {
      if (!p) return p

      if (p.wins && typeof p.wins === "object" && !Array.isArray(p.wins)) {
        return { ...p, wins: p.wins }
      }

      if (Array.isArray(p.wins)) {
        const map = {}
        for (const name of p.wins) {
          const key = String(name)
          map[key] = (map[key] || 0) + 1
        }
        return { ...p, wins: map }
      }

      return { ...p, wins: {} }
    })
  }

  parsed.options = parsed.options || {}
  parsed.options.uniqueWinner ??= true
  parsed.options.noRepeatPrize ??= false
  parsed.options.weightedByStock ??= true

  return parsed
}

function load() {
  const raw = localStorage.getItem(LS_KEY)
  if (!raw) return
  try {
    const parsed = normalizeLoadedState(JSON.parse(raw))
    Object.assign(state, parsed)
  } catch (e) {
    console.warn("No se pudo cargar localStorage:", e)
  }
}

function resetAll() {
  localStorage.removeItem(LS_KEY)
  location.reload()
}

/* ---------------- Helpers ---------------- */
function escapeHtml(s) {
  return String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c],
  )
}

function formatWins(winsObj) {
  if (!winsObj || typeof winsObj !== "object") return "—"
  const entries = Object.entries(winsObj).filter(([, v]) => Number(v) > 0)
  if (entries.length === 0) return "—"
  entries.sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
  return entries.map(([name, count]) => `${name} x${count}`).join(", ")
}

function setResult(text, warn = false) {
  const el = $("result")
  if (!el) return
  el.textContent = text
  el.classList.toggle("muted", !warn)
}

/* ---------------- UI Render ---------------- */
function renderOptions() {
  const u = $("optUniquePrize")
  const nr = $("optNoRepeatPrize")
  const w = $("optWeighted")

  if (u) u.checked = !!state.options.uniqueWinner
  if (nr) nr.checked = !!state.options.noRepeatPrize
  if (w) w.checked = !!state.options.weightedByStock
}

function renderPrizes() {
  const el = $("prizeList")
  el.innerHTML = ""

  state.prizes.forEach((p) => {
    const div = document.createElement("div")
    div.className = "item"
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
    `
    el.appendChild(div)
  })

  el.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id
      const act = btn.dataset.act
      const prize = state.prizes.find((x) => x.id === id)
      if (!prize) return

      if (act === "del") {
        state.prizes = state.prizes.filter((x) => x.id !== id)
      } else if (act === "minus") {
        prize.remaining = Math.max(0, prize.remaining - 1)
      } else if (act === "plus") {
        prize.qty += 1
        prize.remaining += 1
      }

      save()
      renderAll()
    })
  })
}

function renderParticipants() {
  const el = $("participantList")
  el.innerHTML = ""

  state.participants.forEach((p) => {
    const winsText = formatWins(p.wins)

    const div = document.createElement("div")
    div.className = "item"
    div.innerHTML = `
      <div>
        <div><strong>${escapeHtml(p.name)}</strong> ${p.active ? "" : "<span class='meta'>(eliminado)</span>"}</div>
        <div class="meta">Ganó: ${escapeHtml(winsText)}</div>
      </div>
      <div class="row">
        <button data-act="toggle" data-id="${p.id}">${p.active ? "Eliminar" : "Reactivar"}</button>
        <button data-act="del" data-id="${p.id}" class="danger">Borrar</button>
      </div>
    `
    el.appendChild(div)
  })

  el.querySelectorAll("button").forEach((btn) => {
    btn.addEventListener("click", () => {
      const id = btn.dataset.id
      const act = btn.dataset.act
      const person = state.participants.find((x) => x.id === id)
      if (!person) return

      if (act === "del") {
        state.participants = state.participants.filter((x) => x.id !== id)
      } else if (act === "toggle") {
        person.active = !person.active
      }

      save()
      renderAll()
    })
  })

  // Select (preserva selección + evita quedarse siempre en el primero)
  const sel = $("participantSelect")
  const prevSelected = sel?.value || ""
  if (sel) sel.innerHTML = ""

  const actives = state.participants.filter((p) => p.active)

  if (!sel) return

  if (actives.length === 0) {
    const opt = document.createElement("option")
    opt.value = ""
    opt.textContent = "No hay players activos"
    sel.appendChild(opt)
    sel.disabled = true
  } else {
    sel.disabled = false

    actives.forEach((p) => {
      const opt = document.createElement("option")
      opt.value = p.id
      opt.textContent = p.name
      sel.appendChild(opt)
    })

    const stillExists = actives.some((p) => p.id === prevSelected)
    sel.value = stillExists ? prevSelected : actives[0].id
  }

  // contador en el acordeón
  const countEl = document.getElementById("playersCount")
  if (countEl) countEl.textContent = `(${state.participants.length})`
}

function renderHistory() {
  const el = $("history")
  el.innerHTML = ""

  const items = [...state.history].slice(-80).reverse()
  if (items.length === 0) {
    el.innerHTML = `<div class="muted">Aún no hay resultados.</div>`
    return
  }

  items.forEach((h) => {
    const div = document.createElement("div")
    div.className = "badge"
    const date = new Date(h.ts).toLocaleString()
    div.innerHTML = `<span class="ok">✔</span> <strong>${escapeHtml(h.participantName)}</strong> → ${escapeHtml(h.prizeName)} <span class="meta">(${date})</span>`
    el.appendChild(div)
  })
}

function renderAll() {
  renderOptions()
  renderPrizes()
  renderParticipants()
  renderHistory()
  drawWheel()
}

/* ---------------- Wheel (Canvas) ---------------- */
const canvas = $("wheel")
const ctx = canvas.getContext("2d")
let wheelAngle = 0
let spinning = false

function availablePrizes() {
  return state.prizes.filter((p) => p.remaining > 0)
}

function drawWheel() {
  const prizes = availablePrizes()
  const W = canvas.width,
    H = canvas.height
  const cx = W / 2,
    cy = H / 2
  const r = Math.min(W, H) / 2 - 10

  ctx.clearRect(0, 0, W, H)

  // base ring
  ctx.beginPath()
  ctx.arc(cx, cy, r + 2, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(255,255,255,.06)"
  ctx.fill()

  if (prizes.length === 0) {
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(wheelAngle)
    ctx.fillStyle = "rgba(255,255,255,.85)"
    ctx.font = "20px system-ui"
    ctx.textAlign = "center"
    ctx.fillText("Sin loot con stock", 0, 6)
    ctx.restore()
    return
  }

  const totalSlices = prizes.length
  const slice = (Math.PI * 2) / totalSlices

  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(wheelAngle)

  for (let i = 0; i < totalSlices; i++) {
    const a0 = i * slice
    const a1 = a0 + slice

    ctx.fillStyle = i % 2 === 0 ? "rgba(106,163,255,.35)" : "rgba(255,255,255,.12)"

    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, r, a0, a1)
    ctx.closePath()
    ctx.fill()

    ctx.save()
    const mid = (a0 + a1) / 2
    ctx.rotate(mid)
    ctx.textAlign = "right"
    ctx.fillStyle = "rgba(255,255,255,.92)"
    ctx.font = "16px system-ui"
    const label = `${prizes[i].name} (${prizes[i].remaining})`
    ctx.fillText(label, r - 12, 6)
    ctx.restore()
  }

  // centro
  ctx.beginPath()
  ctx.arc(0, 0, 70, 0, Math.PI * 2)
  ctx.fillStyle = "rgba(0,0,0,.18)"
  ctx.fill()
  ctx.fillStyle = "rgba(255,255,255,.9)"
  ctx.font = "18px system-ui"
  ctx.textAlign = "center"
  ctx.fillText("GIRAR", 0, 6)

  ctx.restore()
}

function pickPrizeIndex(prizes) {
  if (prizes.length === 1) return 0

  const candidates =
    state.options.noRepeatPrize && state.lastPrizeId ? prizes.filter((p) => p.id !== state.lastPrizeId) : prizes

  const pool = candidates.length ? candidates : prizes

  if (state.options.weightedByStock) {
    const weights = pool.map((p) => Math.max(1, p.remaining))
    const sum = weights.reduce((a, b) => a + b, 0)
    let roll = Math.random() * sum

    for (let i = 0; i < pool.length; i++) {
      roll -= weights[i]
      if (roll <= 0) return prizes.findIndex((p) => p.id === pool[i].id)
    }
  }

  return Math.floor(Math.random() * prizes.length)
}

function angleForIndex(index, total) {
  const slice = (Math.PI * 2) / total
  return -(index * slice + slice / 2)
}

function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3)
}
function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
}

function normalizeAngleForward(current, target) {
  const two = Math.PI * 2
  while (current < 0) current += two
  while (target < 0) target += two

  // Always add full rotations to ensure forward motion
  while (target < current) {
    target += two
  }

  return target
}

function animateWheelTo(targetAngle, duration = 450) {
  const startAngle = wheelAngle
  const finalTarget = normalizeAngleForward(startAngle, targetAngle)
  const delta = finalTarget - startAngle

  const start = performance.now()
  return new Promise((resolve) => {
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const e = easeInOutCubic(t)
      wheelAngle = startAngle + delta * e
      drawWheel()
      if (t < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })
}

async function spin() {
  if (spinning) return

  const prizes = availablePrizes()
  if (prizes.length === 0) {
    setResult("No hay loot con stock disponible.", true)
    return
  }

  const sel = $("participantSelect")
  const participantId = sel?.value
  const participant = state.participants.find((p) => p.id === participantId)

  if (!participant || !participant.active) {
    setResult("Seleccioná un player activo.", true)
    return
  }

  spinning = true
  $("btnSpin").disabled = true

  const idx = pickPrizeIndex(prizes)
  const total = prizes.length

  const targetAngle = angleForIndex(idx, total)
  const finalAngle = targetAngle + Math.max(2, EXTRA_TURNS) * Math.PI * 2

  const duration = Math.max(800, SPIN_MS)
  const startAngle = wheelAngle
  const delta = finalAngle - startAngle + Math.PI * 2

  const start = performance.now()
  await new Promise((resolve) => {
    const frame = (now) => {
      const t = Math.min(1, (now - start) / duration)
      const e = easeOutCubic(t)
      wheelAngle = startAngle + delta * e
      drawWheel()

      if (t > 0.92) {
        wheelAngle += Math.sin(now / 20) * (1 - t) * 0.06
      }

      if (t < 1) requestAnimationFrame(frame)
      else resolve()
    }
    requestAnimationFrame(frame)
  })

  const prize = prizes[idx]
  prize.remaining = Math.max(0, prize.remaining - 1)
  state.lastPrizeId = prize.id

  participant.wins =
    participant.wins && typeof participant.wins === "object" && !Array.isArray(participant.wins) ? participant.wins : {}
  participant.wins[prize.name] = (participant.wins[prize.name] || 0) + 1

  state.history.push({
    ts: Date.now(),
    participantName: participant.name,
    prizeName: prize.name,
  })

  if (state.options.uniqueWinner) {
    participant.active = false
  }

  save()
  setResult(`🎉 ${participant.name} ganó: ${prize.name}`, false)
  renderAll()

  await animateWheelTo(0, 500)
  drawWheel()

  $("btnSpin").disabled = false
  spinning = false
}

/* ---------------- Actions ---------------- */
function addPrize(name, qty) {
  name = (name || "").trim()
  qty = Number(qty)
  if (!name || !Number.isFinite(qty) || qty <= 0) {
    setResult("Por favor ingresá un nombre y cantidad válidos para el loot.", true)
    return
  }

  const existing = state.prizes.find((p) => p.name.toLowerCase() === name.toLowerCase())
  if (existing) {
    existing.qty += qty
    existing.remaining += qty
  } else {
    state.prizes.push({ id: uid(), name, qty, remaining: qty })
  }

  save()
  renderAll()
  setResult(`Loot "${name}" agregado (x${qty})`, false)
}

function addParticipant(name) {
  name = (name || "").trim()
  if (!name) {
    setResult("Por favor ingresá un nombre para el player.", true)
    return
  }

  const existing = state.participants.find((p) => p.name.toLowerCase() === name.toLowerCase())
  if (existing) {
    setResult(`El player "${name}" ya existe en la lista.`, true)
    return
  }

  const newId = uid()
  state.participants.push({ id: newId, name, active: true, wins: {} })

  save()
  renderAll()

  const sel = $("participantSelect")
  if (sel && !sel.disabled) sel.value = newId

  setResult(`Player "${name}" agregado al raid.`, false)
}

function addParticipantsBulk(text) {
  const lines = (text || "")
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean)

  let added = 0
  for (const line of lines) {
    const before = state.participants.length
    addParticipant(line)
    if (state.participants.length > before) added++
  }
  return added
}

function skipParticipant() {
  const sel = $("participantSelect")
  if (!sel || sel.disabled) return

  const opts = [...sel.options]
  if (opts.length <= 1) return

  sel.selectedIndex = (sel.selectedIndex + 1) % opts.length
}

function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" })
  const a = document.createElement("a")
  a.href = URL.createObjectURL(blob)
  a.download = "ruleta-loot-data.json"
  a.click()
  URL.revokeObjectURL(a.href)
}

function importJSON(file) {
  const reader = new FileReader()
  reader.onload = () => {
    try {
      const parsedRaw = JSON.parse(reader.result)
      const parsed = normalizeLoadedState(parsedRaw)
      if (!parsed || typeof parsed !== "object") throw new Error("Formato inválido")

      Object.assign(state, parsed)
      save()
      renderAll()
      setResult("Importado correctamente.", false)
    } catch {
      setResult("No se pudo importar el JSON.", true)
    }
  }
  reader.readAsText(file)
}

function clearHistoryAndWins() {
  state.history = []
  state.participants = state.participants.map((p) => ({
    ...p,
    active: true,
    wins: {},
  }))
  save()
  renderAll()
  setResult("Historial borrado. Nueva instancia lista.", false)
}

/* ---------------- Init ---------------- */
load()

$("btnAddPrize")?.addEventListener("click", () => {
  const nameEl = $("prizeName")
  const qtyEl = $("prizeQty")

  if (!nameEl || !qtyEl) {
    setResult("Error: no se encontraron los campos de loot.", true)
    return
  }

  addPrize(nameEl.value, qtyEl.value)
  nameEl.value = ""
  qtyEl.value = "1"
})

$("btnAddParticipant")?.addEventListener("click", () => {
  const nameEl = $("participantName")

  if (!nameEl) {
    setResult("Error: no se encontró el campo de player.", true)
    return
  }

  addParticipant(nameEl.value)
  nameEl.value = ""
})

$("btnAddBulk")?.addEventListener("click", () => {
  const added = addParticipantsBulk($("bulkParticipants").value)
  $("bulkParticipants").value = ""
  if (added > 0) setResult(`Cargados ${added} players.`, false)
})

$("btnSpin")?.addEventListener("click", spin)
$("btnSkip")?.addEventListener("click", skipParticipant)

$("optUniquePrize")?.addEventListener("change", (e) => {
  state.options.uniqueWinner = e.target.checked
  save()
})

$("optNoRepeatPrize")?.addEventListener("change", (e) => {
  state.options.noRepeatPrize = e.target.checked
  save()
})

$("optWeighted")?.addEventListener("change", (e) => {
  state.options.weightedByStock = e.target.checked
  save()
})

$("btnReset")?.addEventListener("click", () => {
  if (confirm("¿Seguro? Se borra TODO (loot, players, historial) de este navegador.")) resetAll()
})

$("btnClearHistory")?.addEventListener("click", () => {
  if (confirm("¿Borrar historial y ganados de players? (deja loot cargado)")) {
    clearHistoryAndWins()
  }
})

$("btnExport")?.addEventListener("click", exportJSON)
$("btnImport")?.addEventListener("click", () => $("importFile")?.click())

$("importFile")?.addEventListener("change", (e) => {
  const f = e.target.files?.[0]
  if (f) importJSON(f)
  e.target.value = ""
})

// Primer render
renderAll()
drawWheel()
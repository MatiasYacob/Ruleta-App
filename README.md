# 🎁 Loot Roulette – Bulem Edition

A **100% frontend loot roulette**, designed for raids, events and item distribution with a **Lineage 2–style vibe**.  
No backend, no database, no setup headaches.

> May the RNG be in your favor 🙏

---

## 🧩 Features

- 🎡 **Animated roulette** (canvas-based)
- 💎 Loot with **stock / quantity**
- 🧑‍🤝‍🧑 Players added individually or in bulk
- 🧮 **Per-loot counter** (same item won multiple times becomes `xN`)
- 🔒 Optional *one win per player* rule
- 🔁 Option to avoid consecutive loot repetition
- 🎯 **Stock-weighted RNG** (more stock = higher chance)
- 🧾 Loot drop history
- 🧹 **Clear history** button (start a new instance)
- 📦 Export / import session data (JSON)
- 📂 Data stored in `localStorage`
- 🎮 Gamer UI inspired by Lineage 2

---

## 📁 Project Structure

```
loot-roulette/
├── index.html
├── style.css
├── app.js
└── README.md
```

---

## 🚀 How to Run

### ▶️ Open locally
Just open `index.html` in your browser.

If your browser restricts local files, run a simple local server:

```bash
python -m http.server
```

Then open:
```
http://localhost:8000
```

---

## 🧑‍🤝‍🧑 Adding Players

### Single player
Type the name and click **Invite**.

### Bulk load
Paste a list, **one name per line**:

```
LaPuchu
Bulem
DarkElf
SpoilerX
BishopHeals
Gladiator92
```

Perfect for pasting directly from party or clan chat.

---

## 💎 Adding Loot

- Item name
- Quantity (stock)
- Click **Add**

Example:
```
Enchant Weapon x3
Blessed Scroll x1
Top Grade Armor x2
```

---

## ⚙️ Raid Rules

- 🔒 **One win per player**  
  Player is removed from the draw after winning.

- 🔁 **Avoid consecutive loot repeats**  
  If other items are available.

- 🎯 **Stock-weighted RNG**  
  Higher stock = higher drop chance.

---

## 🧹 Starting a New Instance

Use **Clear History** to:
- remove loot history
- reset player winnings
- reactivate all players

Loot and configuration remain intact.

---

## 📦 Export / Import

- Export the entire session as a JSON file
- Import it later to continue the same run
- Useful for long events or streams

---

## 🧠 Technical Notes

- Pure frontend
- No frameworks
- No backend
- All data stored in `localStorage`

---

## 🛠️ Possible Future Improvements

- 🔊 Drop sound effects
- 📢 Global drop announcements
- 🎉 Confetti for rare loot
- 🎯 Manual drop chances per item
- 🧑‍⚖️ DKP / priority modes

---

## ❤️ Credits

Created by **Bulem**  
Powered by **RNGsus** ✨

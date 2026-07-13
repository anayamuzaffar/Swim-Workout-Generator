import DATA from './swim_sets.json' with { type: 'json' };

const BUCKETS = {
    under1k: { label: "Under 1,000", min: 400, max: 999, mode: "preset" },
    "1k2k": { label: "1,000–2,000", min: 1000, max: 1999, mode: "preset" },
    "2k3k": { label: "2,000–3,000", min: 2000, max: 2999, mode: "main" },
    "3k4k": { label: "3,000–4,000", min: 3000, max: 4000, mode: "main" }
};

const STROKE_LABEL = { free: "Freestyle", stroke: "Stroke", IM: "IM" };
const COURSE_LABEL = { sprint: "Sprint", distance: "Distance" };

function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
}

function matchesHardFilters(item, stroke, courseType) {
    const strokeOk = item.stroke === "universal" || item.stroke === stroke;
    const courseOk = item.courseType === "universal" || item.courseType === courseType;
    return strokeOk && courseOk;
}

// Orders items: exact difficulty match first, then moderate fallback, then anything else.
function preferenceOrder(items, difficulty) {
    const exact = items.filter(i => i.difficulty === difficulty || i.difficulty === "universal");
    const moderate = items.filter(i => i.difficulty === "moderate" && !exact.includes(i));
    const rest = items.filter(i => !exact.includes(i) && !moderate.includes(i));
    return [...shuffle(exact), ...shuffle(moderate), ...shuffle(rest)];
}

// Randomized greedy bin-pack: fill distinct items from pool into [needMin, spaceMax].
function greedyFillPresets(pool, spaceMax, needMin) {
    if (needMin <= 0 && spaceMax >= 0 && pool.length === 0) return [];
    for (let attempt = 0; attempt < 50; attempt++) {
        const candidates = shuffle(pool);
        let chosen = [], total = 0;
        for (const item of candidates) {
            if (total + item.yardage <= spaceMax) {
                chosen.push(item);
                total += item.yardage;
            }
        }
        if (total >= needMin) return chosen;
    }
    return null;
}

function buildPresetBased(filters, bucket) {
    const warmup = DATA.warmups.find(w => w.id === "wu6");
    const filtered = DATA.presets.filter(p => matchesHardFilters(p, filters.stroke, filters.courseType));
    if (filtered.length === 0) return null;
    const ordered = preferenceOrder(filtered, filters.difficulty);
    const cooldownsShuffled = shuffle(DATA.cooldowns);

    for (const cooldown of cooldownsShuffled) {
        const base = warmup.yardage + cooldown.yardage;
        if (base > bucket.max) continue;
        const need = Math.max(0, bucket.min - base);
        const space = bucket.max - base;
        const presets = greedyFillPresets(ordered, space, need);
        if (presets) return { warmup, main: null, cooldown, presets };
    }
    return null;
}

function buildMainBased(filters, bucket) {
    const mains = DATA.mainSets.filter(m => matchesHardFilters(m, filters.stroke, filters.courseType));
    if (mains.length === 0) return null;
    const mainsOrdered = preferenceOrder(mains, filters.difficulty);
    const presetsFiltered = DATA.presets.filter(p => matchesHardFilters(p, filters.stroke, filters.courseType));

    for (const main of mainsOrdered) {
        const warmupsShuffled = shuffle(DATA.warmups.filter(w => w.id !== "wu6"));
        for (const warmup of warmupsShuffled) {
            const cooldownsSorted = [...DATA.cooldowns].sort((a, b) => b.yardage - a.yardage);
            for (const cooldown of cooldownsSorted) {
                const base = warmup.yardage + main.yardage + cooldown.yardage;
                if (base > bucket.max) continue;
                if (base >= bucket.min) return { warmup, main, cooldown, presets: [] };
                const need = bucket.min - base;
                const space = bucket.max - base;
                const presets = greedyFillPresets(presetsFiltered, space, need);
                if (presets) return { warmup, main, cooldown, presets };
            }
        }
    }
    return null;
}

function generateWorkout(filters, bucketKey) {
    const bucket = BUCKETS[bucketKey];
    const result = bucket.mode === "preset"
        ? buildPresetBased(filters, bucket)
        : buildMainBased(filters, bucket);
    if (!result) return null;
    const total = result.warmup.yardage
        + (result.main ? result.main.yardage : 0)
        + result.cooldown.yardage
        + result.presets.reduce((s, p) => s + p.yardage, 0);
    return { ...result, total, bucket };
}

// ---- UI wiring ----
const state = { bucket: null, stroke: null, courseType: null, difficulty: null };

function wireOptionGroup(groupId, stateKey) {
    const group = document.getElementById(groupId);
    group.querySelectorAll(".opt").forEach(btn => {
        btn.addEventListener("click", () => {
            group.querySelectorAll(".opt").forEach(b => b.classList.remove("selected"));
            btn.classList.add("selected");
            state[stateKey] = btn.dataset.value;
        });
    });
}
wireOptionGroup("opt-bucket", "bucket");
wireOptionGroup("opt-stroke", "stroke");
wireOptionGroup("opt-course", "courseType");
wireOptionGroup("opt-difficulty", "difficulty");

// Breaks a structure string like "300 Swim / 200 Pull / 100 Kick" or
// "4x50 descend, 3x200 moderate-hard, 8x25 sprint" into separate lines.
function splitStructureLines(structure) {
    return structure
        .split(/\s*[\/,]\s*(?![^()]*\))/) // split on / or , but not inside parentheses
        .map(s => s.trim())
        .filter(Boolean);
}

// Renders a plain structure string (warmups/presets/cooldowns) as separate lines.
function structureLinesHtml(structure) {
    const lines = splitStructureLines(structure);
    return lines.map(line => `<div class="structure-line">${line}</div>`).join("");
}

// Renders a main set's segments array (steps and rounds) with per-line yardage.
function segmentsHtml(segments) {
    let html = "";
    segments.forEach(seg => {
        if (seg.type === "step") {
            html += `<div class="structure-line step-line">
        <span class="line-text">${seg.text}</span>
        <span class="line-yardage">${seg.yardage} yd</span>
      </div>`;
        } else if (seg.type === "round") {
            const roundSubtotal = seg.steps.reduce((s, x) => s + x.yardage, 0) * seg.count;
            html += `<div class="round-header">× ${seg.count} Rounds</div>`;
            seg.steps.forEach(s => {
                html += `<div class="structure-line step-line round-step">
          <span class="line-text">${s.text}</span>
          <span class="line-yardage">${s.yardage} yd</span>
        </div>`;
            });
            html += `<div class="round-subtotal">Subtotal (×${seg.count}): ${roundSubtotal} yd</div>`;
        }
    });
    return html;
}

function segmentHtml(bar, type, name, yardage, item) {
    const linesHtml = item.segments ? segmentsHtml(item.segments) : structureLinesHtml(item.structure);
    return `
    <div class="segment">
      <div class="bar ${bar}"></div>
      <div class="segment-body">
        <div class="segment-type">${type}</div>
        <div class="segment-top">
          <span class="segment-name">${name}</span>
          <span class="segment-yardage">${yardage} yd</span>
        </div>
        <div class="segment-structure">${linesHtml}</div>
      </div>
    </div>`;
}

function renderResult(workout, filters) {
    const card = document.getElementById("result-card");
    if (!workout) {
        card.innerHTML = `
      <div class="empty-msg">
        No combination of sets matches this yardage range with your current stroke and course filters.<br>
        Try a different yardage bucket, or switch stroke/course type.
      </div>`;
        document.getElementById("result").style.display = "block";
        return;
    }

    let segments = "";
    segments += segmentHtml("warmup", "Warm-up", workout.warmup.name, workout.warmup.yardage, workout.warmup);
    workout.presets.forEach((p, i) => {
        segments += segmentHtml("preset", `Preset ${i + 1}`, `Set ${p.id.toUpperCase()}`, p.yardage, p);
    });
    if (workout.main) {
        segments += segmentHtml("main", "Main Set", workout.main.name, workout.main.yardage, workout.main);
    }
    segments += segmentHtml("cooldown", "Cool-down", "Cool-down", workout.cooldown.yardage, workout.cooldown);

    card.innerHTML = `
    <div class="result-head">
      <div>
        <div class="label">Your Workout</div>
        <div class="result-meta">${STROKE_LABEL[filters.stroke]} · ${COURSE_LABEL[filters.courseType]} · ${filters.difficulty}</div>
      </div>
      <div class="total">${workout.total}<sup>YD</sup></div>
    </div>
    ${segments}
  `;
    document.getElementById("result").style.display = "block";
}

function runGenerate() {
    if (!state.bucket || !state.stroke || !state.courseType || !state.difficulty) {
        alert("Pick a yardage range, stroke focus, course type, and difficulty first.");
        return;
    }
    const workout = generateWorkout(state, state.bucket);
    renderResult(workout, state);
    document.getElementById("result").scrollIntoView({ behavior: "smooth", block: "start" });
}

document.getElementById("generate-btn").addEventListener("click", runGenerate);
document.getElementById("regenerate-btn").addEventListener("click", runGenerate);
document.getElementById("print-btn").addEventListener("click", () => window.print());
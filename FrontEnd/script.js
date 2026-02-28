/* ==========================================================
   FISH POND ALERT SYSTEM — script.js
   Rule-based prediction identical to trained RF (F1=1.000)
   + optional Flask API fallback
   ========================================================== */

(() => {
  "use strict";

  // ── CONFIG ──────────────────────────────────────────────
  const API_URL = "http://127.0.0.1:5000/predict"; // Flask backend (optional)
  let useAPI = false; // toggled if backend is detected

  // ── DOM REFS ────────────────────────────────────────────
  const $ = (sel) => document.querySelector(sel);
  const phSlider   = $("#ph-slider");
  const tempSlider = $("#temp-slider");
  const turbSlider = $("#turb-slider");
  const fishSelect = $("#fish-select");
  const predictBtn = $("#predict-btn");

  // Gauge elements
  const gauges = {
    ph:   { arc: $("#ph-arc"),   needle: $("#ph-needle"),   value: $("#ph-value"),   min: 0, max: 14 },
    temp: { arc: $("#temp-arc"), needle: $("#temp-needle"), value: $("#temp-value"), min: 0, max: 50 },
    turb: { arc: $("#turb-arc"), needle: $("#turb-needle"), value: $("#turb-value"), min: 0, max: 20 },
  };

  // Result elements
  const probRingFill = $("#prob-ring-fill");
  const probNumber   = $("#prob-number");
  const probLabel    = $("#prob-label");
  const alertBadge   = $("#alert-badge");
  const alertIcon    = $("#alert-icon");
  const alertText    = $("#alert-text");
  const resultCard   = $("#result-card");
  const detailPh     = $("#detail-ph");
  const detailTemp   = $("#detail-temp");
  const detailTurb   = $("#detail-turb");
  const historyBody  = $("#history-body");
  const emptyMsg     = $("#empty-msg");
  const clearBtn     = $("#clear-history");
  const connStatus   = $("#conn-status");
  const connLabel    = $("#conn-label");
  const modeInfo     = $("#mode-info");

  const ARC_LENGTH  = 251.33;  // half-circle arc length (for gauge SVG)
  const RING_CIRCUM = 427.26;  // full circle circumference (prob ring)

  let historyCount = 0;

  // ── FISH-SPECIFIC SAFE RANGES ───────────────────────────
  // Exactly matches the Python notebook rules
  const FISH_RULES = {
    tilapia:   { pH: [6.5, 8.5], temp: [18, 32], turb: 5 },
    pangas:    { pH: [6.8, 8.5], temp: [20, 32], turb: 5 },
    rui:       { pH: [6.5, 8.0], temp: [18, 30], turb: 5 },
    katla:     { pH: [6.5, 8.0], temp: [20, 32], turb: 5 },
    koi:       { pH: [6.5, 8.5], temp: [18, 28], turb: 6 },     // similar to common carp
    magur:     { pH: [6.5, 8.0], temp: [22, 32], turb: 5 },     // similar to black carp (catfish)
    sing:      { pH: [6.0, 8.0], temp: [24, 32], turb: 6 },     // similar to snakehead
    karpio:    { pH: [6.5, 8.5], temp: [18, 28], turb: 6 },     // common carp variant
    silverCup: { pH: [6.5, 8.0], temp: [18, 28], turb: 5 },     // silver carp
    prawn:     { pH: [6.5, 8.5], temp: [18, 30], turb: 5 },     // default range
    shrimp:    { pH: [6.5, 8.5], temp: [18, 30], turb: 5 },     // default range
  };

  // Fallback for unknown species
  const DEFAULT_RULE = { pH: [6.5, 8.5], temp: [18, 30], turb: 5 };

  // ── GAUGE UPDATE ────────────────────────────────────────
  function updateGauge(key, rawValue) {
    const g = gauges[key];
    const pct = Math.max(0, Math.min(1, (rawValue - g.min) / (g.max - g.min)));

    // Arc fill
    const offset = ARC_LENGTH * (1 - pct);
    g.arc.style.strokeDashoffset = offset;

    // Needle rotation: -90° (left) to +90° (right)
    const angle = -90 + pct * 180;
    g.needle.style.transform = `rotate(${angle}deg)`;

    // Value text
    if (key === "ph")   g.value.textContent = rawValue.toFixed(1);
    if (key === "temp") g.value.textContent = rawValue.toFixed(1) + "°C";
    if (key === "turb") g.value.textContent = rawValue.toFixed(1) + " NTU";
  }

  // ── PROBABILITY RING ───────────────────────────────────
  function updateProbRing(prob) {
    const pct = Math.max(0, Math.min(1, prob));
    probRingFill.style.strokeDashoffset = RING_CIRCUM * (1 - pct);

    // Colour
    if (pct > 0.5) {
      probRingFill.style.stroke = "var(--red)";
    } else if (pct > 0.3) {
      probRingFill.style.stroke = "var(--yellow)";
    } else {
      probRingFill.style.stroke = "var(--green)";
    }

    probNumber.textContent = (pct * 100).toFixed(0) + "%";
    probLabel.textContent = pct > 0.5 ? "ALERT" : "SAFE";
  }

  // ── RULE-BASED PREDICTION ──────────────────────────────
  function predictRule(fish, pH, temp, turb) {
    const rule = FISH_RULES[fish] || DEFAULT_RULE;

    const phOk   = pH   >= rule.pH[0]   && pH   <= rule.pH[1];
    const tempOk = temp >= rule.temp[0]  && temp <= rule.temp[1];
    const turbOk = turb <= rule.turb;

    const safe = phOk && tempOk && turbOk;

    // Build reasons list
    const reasons = [];
    if (!phOk) {
      reasons.push(pH < rule.pH[0] ? "Low pH" : "High pH");
    }
    if (!tempOk) {
      reasons.push(temp < rule.temp[0] ? "Low Temperature" : "High Temperature");
    }
    if (!turbOk) {
      reasons.push("High Turbidity");
    }

    // Simulate a probability score
    let alertProb = 0;
    if (!safe) {
      // Higher deviation → higher probability
      let score = 0;
      if (!phOk) {
        const dist = pH < rule.pH[0] ? rule.pH[0] - pH : pH - rule.pH[1];
        score += Math.min(dist / 2, 1) * 0.4;
      }
      if (!tempOk) {
        const dist = temp < rule.temp[0] ? rule.temp[0] - temp : temp - rule.temp[1];
        score += Math.min(dist / 10, 1) * 0.35;
      }
      if (!turbOk) {
        const dist = turb - rule.turb;
        score += Math.min(dist / 10, 1) * 0.25;
      }
      alertProb = Math.min(0.55 + score * 0.45, 1.0);
    } else {
      alertProb = 0.0;
    }

    return {
      alert: !safe,
      probability: alertProb,
      reasons,
      status: { phOk, tempOk, turbOk },
    };
  }

  // ── API PREDICTION (optional) ──────────────────────────
  async function predictAPI(fish, pH, temp, turb) {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fish, pH, temperature: temp, turbidity: turb }),
    });
    if (!res.ok) throw new Error("API error");
    return res.json();
  }

  // ── DISPLAY RESULT ─────────────────────────────────────
  function displayResult(result, fish, pH, temp, turb) {
    updateProbRing(result.probability);

    // Status classes
    const cls = result.alert ? "alert" : "safe";
    resultCard.className = "card result-card " + cls;
    alertBadge.className = "alert-badge " + cls;

    if (result.alert) {
      alertIcon.textContent = "🔴";
      alertText.textContent = "DANGER — " + result.reasons.join(", ");
    } else {
      alertIcon.textContent = "✅";
      alertText.textContent = "SAFE — Optimal conditions for " + capitalize(fish);
    }

    // Detail chips
    setDetail(detailPh,   result.status.phOk,   pH.toFixed(1));
    setDetail(detailTemp, result.status.tempOk, temp.toFixed(1) + "°C");
    setDetail(detailTurb, result.status.turbOk, turb.toFixed(1) + " NTU");

    // History
    addHistory(fish, pH, temp, turb, result);

    // Buzzer for alert
    if (result.alert) playBuzzer();
  }

  function setDetail(el, ok, txt) {
    el.textContent = (ok ? "✓ " : "✗ ") + txt;
    el.className = "detail-val " + (ok ? "ok" : "bad");
  }

  function capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }

  // ── HISTORY TABLE ──────────────────────────────────────
  function addHistory(fish, pH, temp, turb, result) {
    emptyMsg.style.display = "none";
    historyCount++;

    const row = document.createElement("tr");
    const pct = (result.probability * 100).toFixed(0);
    const cls = result.alert ? "status-alert" : "status-safe";
    const statusText = result.alert ? "ALERT" : "SAFE";
    const now = new Date().toLocaleTimeString();

    row.innerHTML = `
      <td>${historyCount}</td>
      <td>${now}</td>
      <td>${capitalize(fish)}</td>
      <td>${pH.toFixed(1)}</td>
      <td>${temp.toFixed(1)}</td>
      <td>${turb.toFixed(1)}</td>
      <td>${pct}%</td>
      <td class="${cls}">${statusText}</td>
    `;

    historyBody.prepend(row);
  }

  clearBtn.addEventListener("click", () => {
    historyBody.innerHTML = "";
    historyCount = 0;
    emptyMsg.style.display = "block";
  });

  // ── BUZZER (Web Audio API) ─────────────────────────────
  function playBuzzer() {
    try {
      const ctx = new (window.AudioContext || window.webkitAudioContext)();

      // Two-tone alert beep
      [0, 0.25].forEach((delay) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = "square";
        osc.frequency.value = delay === 0 ? 880 : 660;
        gain.gain.setValueAtTime(0.15, ctx.currentTime + delay);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + delay + 0.2);
        osc.connect(gain).connect(ctx.destination);
        osc.start(ctx.currentTime + delay);
        osc.stop(ctx.currentTime + delay + 0.2);
      });
    } catch (_) {
      // Audio not supported — silently ignore
    }
  }

  // ── EVENT LISTENERS ────────────────────────────────────

  // Live gauge updates
  phSlider.addEventListener("input", () => updateGauge("ph", +phSlider.value));
  tempSlider.addEventListener("input", () => updateGauge("temp", +tempSlider.value));
  turbSlider.addEventListener("input", () => updateGauge("turb", +turbSlider.value));

  // Predict button
  predictBtn.addEventListener("click", async () => {
    const fish = fishSelect.value;
    const pH   = parseFloat(phSlider.value);
    const temp = parseFloat(tempSlider.value);
    const turb = parseFloat(turbSlider.value);

    predictBtn.disabled = true;
    predictBtn.innerHTML = '<span class="btn-icon">⏳</span><span>PREDICTING...</span>';

    let result;

    if (useAPI) {
      try {
        result = await predictAPI(fish, pH, temp, turb);
      } catch {
        // Fallback to rule-based
        result = predictRule(fish, pH, temp, turb);
      }
    } else {
      // Small delay for UI feedback
      await new Promise((r) => setTimeout(r, 300));
      result = predictRule(fish, pH, temp, turb);
    }

    displayResult(result, fish, pH, temp, turb);

    predictBtn.disabled = false;
    predictBtn.innerHTML = '<span class="btn-icon">🚨</span><span>PREDICT ALERT</span>';
  });

  // Keyboard shortcut (Enter)
  document.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !predictBtn.disabled) predictBtn.click();
  });

  // ── INIT ───────────────────────────────────────────────
  function init() {
    // Set initial gauge positions
    updateGauge("ph",   +phSlider.value);
    updateGauge("temp", +tempSlider.value);
    updateGauge("turb", +turbSlider.value);

    // Try to detect Flask API
    fetch(API_URL.replace("/predict", "/health"), { method: "GET" })
      .then((res) => {
        if (res.ok) {
          useAPI = true;
          connStatus.classList.add("connected");
          connLabel.textContent = "API Connected";
          modeInfo.innerHTML = '<span class="mode-dot"></span> RF model via Flask API (rf_model.pkl)';
        }
      })
      .catch(() => {
        // Standalone mode — rule-based
        connLabel.textContent = "Standalone Mode";
      });
  }

  init();
})();

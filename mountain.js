const editor = document.querySelector("#editor");
const mistLayer = document.querySelector("#mistLayer");
const editorWrap = document.querySelector("#editorWrap");
const charCount = document.querySelector("#charCount");
const clock = document.querySelector("#clock");
const fontSizeSlider = document.querySelector("#fontSizeSlider");
const fontSizeValue = document.querySelector("#fontSizeValue");
const decreaseFont = document.querySelector("#decreaseFont");
const increaseFont = document.querySelector("#increaseFont");

const FONT_SIZE_KEY = "murmur-notes-mountain-font-size";
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 26;

function updateClock() {
  const now = new Date();
  clock.textContent = now.toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function updateCount() {
  const text = editor.textContent.replace(/\s+/g, "");
  charCount.textContent = `${text.length} 字`;
}

function applyFontSize(size) {
  const nextSize = Math.min(MAX_FONT_SIZE, Math.max(MIN_FONT_SIZE, size));
  editor.style.fontSize = `${nextSize}px`;
  editor.style.lineHeight = nextSize >= 22 ? "2.08" : "2";
  fontSizeSlider.value = String(nextSize);
  fontSizeValue.textContent = `${nextSize}px`;
  window.localStorage.setItem(FONT_SIZE_KEY, String(nextSize));
}

function restoreFontSize() {
  const saved = Number(window.localStorage.getItem(FONT_SIZE_KEY));
  const initialSize = Number.isFinite(saved) && saved >= MIN_FONT_SIZE && saved <= MAX_FONT_SIZE
    ? saved
    : Number(fontSizeSlider.value);
  applyFontSize(initialSize);
}

function getCaretPoint() {
  const selection = window.getSelection();
  if (!selection || selection.rangeCount === 0) {
    return null;
  }

  const range = selection.getRangeAt(0).cloneRange();
  range.collapse(true);

  let rect = range.getClientRects()[0];
  if (!rect) {
    const marker = document.createElement("span");
    marker.textContent = "\u200b";
    range.insertNode(marker);
    rect = marker.getBoundingClientRect();
    marker.parentNode.removeChild(marker);
    selection.removeAllRanges();
    selection.addRange(range);
  }

  if (!rect) {
    return null;
  }

  const wrapRect = editorWrap.getBoundingClientRect();
  return {
    x: rect.left - wrapRect.left,
    y: rect.top - wrapRect.top + rect.height * 0.62,
  };
}

function spawnMist(point, options) {
  const bloom = document.createElement("span");
  bloom.className = "mist-bloom";
  bloom.style.left = `${point.x + options.offsetX}px`;
  bloom.style.top = `${point.y + options.offsetY}px`;
  bloom.style.setProperty("--drift-x", `${options.driftX}px`);
  bloom.style.setProperty("--drift-y", `${options.driftY}px`);
  mistLayer.appendChild(bloom);

  bloom.addEventListener("animationend", () => {
    bloom.remove();
  }, { once: true });
}

function spawnTrace(point, options) {
  const trace = document.createElement("span");
  trace.className = "mist-trace";
  trace.style.left = `${point.x + options.offsetX}px`;
  trace.style.top = `${point.y + options.offsetY}px`;
  trace.style.setProperty("--drift-x", `${options.driftX}px`);
  trace.style.setProperty("--drift-y", `${options.driftY}px`);
  mistLayer.appendChild(trace);

  trace.addEventListener("animationend", () => {
    trace.remove();
  }, { once: true });
}

function spawnSunbreak(point, options) {
  const glow = document.createElement("span");
  glow.className = "sunbreak-glow";
  glow.style.left = `${point.x + options.offsetX}px`;
  glow.style.top = `${point.y + options.offsetY}px`;
  glow.style.setProperty("--drift-x", `${options.driftX}px`);
  glow.style.setProperty("--drift-y", `${options.driftY}px`);
  mistLayer.appendChild(glow);

  glow.addEventListener("animationend", () => {
    glow.remove();
  }, { once: true });
}

function spawnRay(point, options) {
  const ray = document.createElement("span");
  ray.className = "sunbreak-ray";
  ray.style.left = `${point.x + options.offsetX}px`;
  ray.style.top = `${point.y + options.offsetY}px`;
  ray.style.setProperty("--drift-x", `${options.driftX}px`);
  ray.style.setProperty("--drift-y", `${options.driftY}px`);
  ray.style.setProperty("--ray-rotate", `${options.rotate}deg`);
  mistLayer.appendChild(ray);

  ray.addEventListener("animationend", () => {
    ray.remove();
  }, { once: true });
}

function createMistBurst(sourcePoint) {
  const point = sourcePoint ?? {
    x: editorWrap.clientWidth * 0.5,
    y: editorWrap.clientHeight * 0.46,
  };

  const blooms = [
    { offsetX: -8, offsetY: 0, driftX: -28, driftY: -8 },
    { offsetX: 10, offsetY: -4, driftX: 26, driftY: -18 },
    { offsetX: 4, offsetY: 8, driftX: 12, driftY: -2 },
  ];

  const traces = [
    { offsetX: 0, offsetY: 2, driftX: 44, driftY: -10 },
    { offsetX: -10, offsetY: 12, driftX: -40, driftY: 6 },
    { offsetX: 8, offsetY: -8, driftX: 22, driftY: -18 },
  ];

  const sunbreaks = [
    { offsetX: 2, offsetY: -2, driftX: 18, driftY: -12 },
  ];

  const rays = [
    { offsetX: 12, offsetY: -10, driftX: 38, driftY: -18, rotate: -12 },
    { offsetX: -6, offsetY: 4, driftX: -10, driftY: -4, rotate: 8 },
  ];

  blooms.forEach((bloom) => {
    spawnMist(point, bloom);
  });

  traces.forEach((trace) => {
    spawnTrace(point, trace);
  });

  sunbreaks.forEach((sunbreak) => {
    spawnSunbreak(point, sunbreak);
  });

  rays.forEach((ray) => {
    spawnRay(point, ray);
  });
}

let mistTimer = null;
let pulseTimer = null;
let lastMistAt = 0;

function triggerTypingMist() {
  editor.classList.remove("typing-mist");
  window.clearTimeout(pulseTimer);
  void editor.offsetWidth;
  editor.classList.add("typing-mist");

  pulseTimer = window.setTimeout(() => {
    editor.classList.remove("typing-mist");
  }, 940);
}

function handleInput() {
  updateCount();
  triggerTypingMist();
  window.clearTimeout(mistTimer);
  mistTimer = window.setTimeout(() => {
    const now = Date.now();
    if (now - lastMistAt < 420) {
      return;
    }
    createMistBurst(getCaretPoint());
    lastMistAt = now;
  }, 180);
}

editor.addEventListener("input", handleInput);
editor.addEventListener("click", () => {
  createMistBurst(getCaretPoint());
  lastMistAt = Date.now();
});
editor.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    window.setTimeout(() => {
      createMistBurst(getCaretPoint());
      lastMistAt = Date.now();
    }, 140);
  }
});

fontSizeSlider.addEventListener("input", () => {
  applyFontSize(Number(fontSizeSlider.value));
});
decreaseFont.addEventListener("click", () => {
  applyFontSize(Number(fontSizeSlider.value) - 1);
});
increaseFont.addEventListener("click", () => {
  applyFontSize(Number(fontSizeSlider.value) + 1);
});

updateClock();
updateCount();
restoreFontSize();
createMistBurst();
window.setInterval(updateClock, 1000 * 30);

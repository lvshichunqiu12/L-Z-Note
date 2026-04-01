const editor = document.querySelector("#editor");
const starlightLayer = document.querySelector("#starlightLayer");
const editorWrap = document.querySelector("#editorWrap");
const charCount = document.querySelector("#charCount");
const clock = document.querySelector("#clock");
const fontSizeSlider = document.querySelector("#fontSizeSlider");
const fontSizeValue = document.querySelector("#fontSizeValue");
const decreaseFont = document.querySelector("#decreaseFont");
const increaseFont = document.querySelector("#increaseFont");

const FONT_SIZE_KEY = "murmur-notes-moon-font-size";
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
  editor.style.lineHeight = nextSize >= 22 ? "2.1" : "2";
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
    y: rect.top - wrapRect.top + rect.height * 0.6,
  };
}

function spawnStar(point, options) {
  const star = document.createElement("span");
  star.className = "typing-star";
  star.style.left = `${point.x + options.offsetX}px`;
  star.style.top = `${point.y + options.offsetY}px`;
  star.style.setProperty("--drift-x", `${options.driftX}px`);
  star.style.setProperty("--drift-y", `${options.driftY}px`);
  star.style.setProperty("--scale", options.scale.toFixed(2));
  starlightLayer.appendChild(star);

  star.addEventListener("animationend", () => {
    star.remove();
  }, { once: true });
}

function spawnDust(point, options) {
  const dust = document.createElement("span");
  dust.className = "typing-dust";
  dust.style.left = `${point.x + options.offsetX}px`;
  dust.style.top = `${point.y + options.offsetY}px`;
  dust.style.setProperty("--drift-x", `${options.driftX}px`);
  dust.style.setProperty("--drift-y", `${options.driftY}px`);
  starlightLayer.appendChild(dust);

  dust.addEventListener("animationend", () => {
    dust.remove();
  }, { once: true });
}

function createStarburst(sourcePoint) {
  const point = sourcePoint ?? {
    x: editorWrap.clientWidth * 0.52,
    y: editorWrap.clientHeight * 0.46,
  };

  const stars = [
    { offsetX: 0, offsetY: 0, driftX: 0, driftY: -24, scale: 0.96 },
    { offsetX: -8, offsetY: 6, driftX: -28, driftY: -10, scale: 0.74 },
    { offsetX: 10, offsetY: -2, driftX: 26, driftY: -18, scale: 0.68 },
  ];

  const dusts = [
    { offsetX: -2, offsetY: -4, driftX: 14, driftY: -30 },
    { offsetX: 12, offsetY: 8, driftX: 36, driftY: -8 },
    { offsetX: -10, offsetY: 10, driftX: -24, driftY: -14 },
  ];

  stars.forEach((star) => {
    spawnStar(point, star);
  });

  dusts.forEach((dust) => {
    spawnDust(point, dust);
  });
}

let glowTimer = null;
let pulseTimer = null;
let lastBurstAt = 0;

function triggerTypingGlimmer() {
  editor.classList.remove("typing-glimmer");
  window.clearTimeout(pulseTimer);
  void editor.offsetWidth;
  editor.classList.add("typing-glimmer");

  pulseTimer = window.setTimeout(() => {
    editor.classList.remove("typing-glimmer");
  }, 920);
}

function handleInput() {
  updateCount();
  triggerTypingGlimmer();
  window.clearTimeout(glowTimer);
  glowTimer = window.setTimeout(() => {
    const now = Date.now();
    if (now - lastBurstAt < 420) {
      return;
    }
    createStarburst(getCaretPoint());
    lastBurstAt = now;
  }, 220);
}

editor.addEventListener("input", handleInput);
editor.addEventListener("click", () => {
  createStarburst(getCaretPoint());
  lastBurstAt = Date.now();
});
editor.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    window.setTimeout(() => {
      createStarburst(getCaretPoint());
      lastBurstAt = Date.now();
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
createStarburst();
window.setInterval(updateClock, 1000 * 30);

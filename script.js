const editor = document.querySelector("#editor");
const rippleLayer = document.querySelector("#rippleLayer");
const editorWrap = document.querySelector("#editorWrap");
const charCount = document.querySelector("#charCount");
const clock = document.querySelector("#clock");
const fontSizeSlider = document.querySelector("#fontSizeSlider");
const fontSizeValue = document.querySelector("#fontSizeValue");
const decreaseFont = document.querySelector("#decreaseFont");
const increaseFont = document.querySelector("#increaseFont");

const FONT_SIZE_KEY = "murmur-notes-font-size";
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
  editor.style.lineHeight = nextSize >= 22 ? "2.05" : "1.95";
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

function spawnRipple(sourcePoint) {
  const point = sourcePoint ?? {
    x: editorWrap.clientWidth * 0.52,
    y: editorWrap.clientHeight * 0.48,
  };

  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.left = `${point.x}px`;
  ripple.style.top = `${point.y}px`;
  rippleLayer.appendChild(ripple);

  ripple.addEventListener("animationend", () => {
    ripple.remove();
  }, { once: true });
}

let rippleTimer = null;
let waveTimer = null;
let lastRippleAt = 0;

function triggerTypingWave() {
  editor.classList.remove("typing-wave");
  window.clearTimeout(waveTimer);
  void editor.offsetWidth;
  editor.classList.add("typing-wave");

  waveTimer = window.setTimeout(() => {
    editor.classList.remove("typing-wave");
  }, 920);
}

function handleInput() {
  updateCount();
  triggerTypingWave();
  window.clearTimeout(rippleTimer);
  rippleTimer = window.setTimeout(() => {
    const now = Date.now();
    if (now - lastRippleAt < 460) {
      return;
    }
    spawnRipple(getCaretPoint());
    lastRippleAt = now;
  }, 320);
}

editor.addEventListener("input", handleInput);
editor.addEventListener("click", () => {
  spawnRipple(getCaretPoint());
  lastRippleAt = Date.now();
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
editor.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    window.setTimeout(() => {
      spawnRipple(getCaretPoint());
      lastRippleAt = Date.now();
    }, 140);
  }
});

updateClock();
updateCount();
restoreFontSize();
spawnRipple();
window.setInterval(updateClock, 1000 * 30);

const editor = document.querySelector("#editor");
const petalLayer = document.querySelector("#petalLayer");
const editorWrap = document.querySelector("#editorWrap");
const charCount = document.querySelector("#charCount");
const clock = document.querySelector("#clock");
const fontSizeSlider = document.querySelector("#fontSizeSlider");
const fontSizeValue = document.querySelector("#fontSizeValue");
const decreaseFont = document.querySelector("#decreaseFont");
const increaseFont = document.querySelector("#increaseFont");
const saveNoteBtn = document.querySelector("#saveNoteBtn");
const exportMarkdownBtn = document.querySelector("#exportMarkdownBtn");
const exportTextBtn = document.querySelector("#exportTextBtn");
const saveState = document.querySelector("#saveState");
const saveStateText = document.querySelector("#saveStateText");

const FONT_SIZE_KEY = "murmur-notes-flower-font-size";
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 26;
const EXPORT_PREFIX = "murmur-flower-note";
const THEME_LABEL = "花";
const DEFAULT_TITLE = "花径摘录";
const INITIAL_EDITOR_MARKUP = editor.innerHTML.trim();

const saveStateController = window.MurmurNotes.saveStateUi.createSaveStateController({
  container: saveState,
  textNode: saveStateText,
});
const clockController = window.MurmurNotes.notePageCore.createClockController({
  clockEl: clock,
});
const fontSizeController = window.MurmurNotes.notePageCore.createFontSizeController({
  editor: editor,
  slider: fontSizeSlider,
  valueNode: fontSizeValue,
  storageKey: FONT_SIZE_KEY,
  min: MIN_FONT_SIZE,
  max: MAX_FONT_SIZE,
  resolveLineHeight(size) {
    return size >= 22 ? "2.1" : "2";
  },
});
const notePageController = window.MurmurNotes.notePageCore.createNotePageController({
  defaultTitle: DEFAULT_TITLE,
  editor: editor,
  exportPrefix: EXPORT_PREFIX,
  initialContent: INITIAL_EDITOR_MARKUP,
  saveStateController: saveStateController,
  themeLabel: THEME_LABEL,
});

function updateCount() {
  const text = editor.textContent.replace(/\s+/g, "");
  charCount.textContent = `${text.length} 字`;
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

function spawnPetal(point, options) {
  const petal = document.createElement("span");
  petal.className = "typing-petal";
  petal.style.left = `${point.x + options.offsetX}px`;
  petal.style.top = `${point.y + options.offsetY}px`;
  petal.style.setProperty("--drift-x", `${options.driftX}px`);
  petal.style.setProperty("--drift-y", `${options.driftY}px`);
  petal.style.setProperty("--rotate-start", `${options.rotateStart}deg`);
  petal.style.setProperty("--rotate-end", `${options.rotateEnd}deg`);
  petal.style.setProperty("--scale", options.scale.toFixed(2));
  petalLayer.appendChild(petal);

  petal.addEventListener("animationend", () => {
    petal.remove();
  }, { once: true });
}

function spawnSpark(point, options) {
  const spark = document.createElement("span");
  spark.className = "petal-spark";
  spark.style.left = `${point.x}px`;
  spark.style.top = `${point.y}px`;
  spark.style.setProperty("--drift-x", `${options.driftX}px`);
  spark.style.setProperty("--drift-y", `${options.driftY}px`);
  petalLayer.appendChild(spark);

  spark.addEventListener("animationend", () => {
    spark.remove();
  }, { once: true });
}

function createPetalBurst(sourcePoint) {
  const point = sourcePoint ?? {
    x: editorWrap.clientWidth * 0.52,
    y: editorWrap.clientHeight * 0.46,
  };

  const petals = [
    { offsetX: -6, offsetY: 2, driftX: -48, driftY: -92, rotateStart: -12, rotateEnd: 168, scale: 0.96 },
    { offsetX: 8, offsetY: -2, driftX: 32, driftY: -120, rotateStart: 18, rotateEnd: -148, scale: 0.88 },
    { offsetX: 14, offsetY: 10, driftX: 68, driftY: -74, rotateStart: 10, rotateEnd: 132, scale: 0.78 },
  ];

  petals.forEach((petal) => {
    spawnPetal(point, petal);
  });

  spawnSpark(point, { driftX: 12, driftY: -44 });
}

let bloomTimer = null;
let pulseTimer = null;
let lastBurstAt = 0;
let saveTimer = null;

function triggerTypingBloom() {
  editor.classList.remove("typing-bloom");
  window.clearTimeout(pulseTimer);
  void editor.offsetWidth;
  editor.classList.add("typing-bloom");

  pulseTimer = window.setTimeout(() => {
    editor.classList.remove("typing-bloom");
  }, 980);
}

function handleInput() {
  updateCount();
  triggerTypingBloom();
  saveStateController.setDirty("编辑中...");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void notePageController.persistDraft();
  }, 480);
  window.clearTimeout(bloomTimer);
  bloomTimer = window.setTimeout(() => {
    const now = Date.now();
    if (now - lastBurstAt < 520) {
      return;
    }
    createPetalBurst(getCaretPoint());
    lastBurstAt = now;
  }, 260);
}

editor.addEventListener("input", handleInput);
editor.addEventListener("click", () => {
  createPetalBurst(getCaretPoint());
  lastBurstAt = Date.now();
});
editor.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    window.setTimeout(() => {
      createPetalBurst(getCaretPoint());
      lastBurstAt = Date.now();
    }, 140);
  }
});

fontSizeSlider.addEventListener("input", () => {
  fontSizeController.apply(Number(fontSizeSlider.value));
});
decreaseFont.addEventListener("click", () => {
  fontSizeController.apply(Number(fontSizeSlider.value) - 1);
});
increaseFont.addEventListener("click", () => {
  fontSizeController.apply(Number(fontSizeSlider.value) + 1);
});
saveNoteBtn.addEventListener("click", () => {
  window.clearTimeout(saveTimer);
  void notePageController.persistDraft();
});
exportMarkdownBtn.addEventListener("click", () => {
  notePageController.exportMarkdown();
});
exportTextBtn.addEventListener("click", () => {
  notePageController.exportText();
});

async function initializePage() {
  clockController.start();
  fontSizeController.restore();
  updateCount();
  await notePageController.restoreDraft();
  updateCount();
  createPetalBurst();
}

void initializePage();
window.addEventListener("pagehide", () => {
  clockController.stop();
  void notePageController.persistDraft();
});

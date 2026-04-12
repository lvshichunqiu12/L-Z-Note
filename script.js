const editor = document.querySelector("#editor");
const rippleLayer = document.querySelector("#rippleLayer");
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

const FONT_SIZE_KEY = "murmur-notes-font-size";
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 26;
const EXPORT_PREFIX = "murmur-water-note";
const THEME_LABEL = "泉";
const DEFAULT_TITLE = "流水手记";
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
    return size >= 22 ? "2.05" : "1.95";
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
let saveTimer = null;

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
  saveStateController.setDirty("编辑中...");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void notePageController.persistDraft();
  }, 480);
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
editor.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    window.setTimeout(() => {
      spawnRipple(getCaretPoint());
      lastRippleAt = Date.now();
    }, 140);
  }
});

async function initializePage() {
  clockController.start();
  fontSizeController.restore();
  updateCount();
  await notePageController.restoreDraft();
  updateCount();
  spawnRipple();
}

void initializePage();
window.addEventListener("pagehide", () => {
  clockController.stop();
  void notePageController.persistDraft();
});

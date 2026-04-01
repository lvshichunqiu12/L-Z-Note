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
const STORAGE_KEY = "murmur-notes-flower-draft";
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 26;
const EXPORT_PREFIX = "murmur-flower-note";
const THEME_LABEL = "花";

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

function updateSaveState(text, state = "saved") {
  saveState.dataset.state = state;
  saveStateText.textContent = text;
}

function getEditorMarkup() {
  return editor.innerHTML.trim();
}

function getEditorText() {
  return editor.innerText.replace(/\n{3,}/g, "\n\n").trim();
}

function formatTime(value) {
  return new Date(value).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function persistDraft() {
  const payload = {
    content: getEditorMarkup(),
    updatedAt: new Date().toISOString(),
  };

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    updateSaveState(`已保存 ${formatTime(payload.updatedAt)}`, "saved");
    return true;
  } catch (error) {
    updateSaveState("保存失败", "error");
    return false;
  }
}

function restoreDraft() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      updateSaveState("自动保存已开启", "saved");
      return;
    }

    const payload = JSON.parse(raw);
    if (payload?.content) {
      editor.innerHTML = payload.content;
    }

    if (payload?.updatedAt) {
      updateSaveState(`已恢复 ${formatTime(payload.updatedAt)}`, "saved");
    } else {
      updateSaveState("已恢复本地草稿", "saved");
    }
  } catch (error) {
    updateSaveState("读取草稿失败", "error");
  }
}

function buildFileName(extension) {
  const stamp = new Date().toISOString().slice(0, 16).replace("T", "-").replace(":", "");
  return `${EXPORT_PREFIX}-${stamp}.${extension}`;
}

function downloadFile(content, extension, mimeType) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = buildFileName(extension);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  updateSaveState(`已导出 ${extension.toUpperCase()}`, "saved");
}

function exportMarkdown() {
  const content = getEditorText();
  const exportedAt = new Date().toLocaleString("zh-CN", { hour12: false });
  const markdown = [
    "# 花径摘录",
    "",
    `- 主题：${THEME_LABEL}`,
    `- 导出时间：${exportedAt}`,
    "",
    content,
    "",
  ].join("\n");
  downloadFile(markdown, "md", "text/markdown;charset=utf-8");
}

function exportText() {
  const content = getEditorText();
  downloadFile(content, "txt", "text/plain;charset=utf-8");
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
  updateSaveState("编辑中...", "dirty");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    persistDraft();
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
  applyFontSize(Number(fontSizeSlider.value));
});
decreaseFont.addEventListener("click", () => {
  applyFontSize(Number(fontSizeSlider.value) - 1);
});
increaseFont.addEventListener("click", () => {
  applyFontSize(Number(fontSizeSlider.value) + 1);
});
saveNoteBtn.addEventListener("click", () => {
  window.clearTimeout(saveTimer);
  persistDraft();
});
exportMarkdownBtn.addEventListener("click", exportMarkdown);
exportTextBtn.addEventListener("click", exportText);

updateClock();
restoreDraft();
restoreFontSize();
updateCount();
createPetalBurst();
window.setInterval(updateClock, 1000 * 30);
window.addEventListener("pagehide", () => {
  persistDraft();
});

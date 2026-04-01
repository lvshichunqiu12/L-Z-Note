const editor = document.querySelector("#editor");
const starlightLayer = document.querySelector("#starlightLayer");
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

const FONT_SIZE_KEY = "murmur-notes-moon-font-size";
const STORAGE_KEY = "murmur-notes-moon-draft";
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 26;
const EXPORT_PREFIX = "murmur-moon-note";
const THEME_LABEL = "月";

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
    "# 银夜札记",
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
let saveTimer = null;

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
  updateSaveState("编辑中...", "dirty");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    persistDraft();
  }, 480);
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
createStarburst();
window.setInterval(updateClock, 1000 * 30);
window.addEventListener("pagehide", () => {
  persistDraft();
});

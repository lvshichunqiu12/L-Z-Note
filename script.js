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
const STORAGE_KEY = "murmur-notes-water-draft";
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 26;
const EXPORT_PREFIX = "murmur-water-note";
const THEME_LABEL = "泉";

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
    "# 流水手记",
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
  updateSaveState("编辑中...", "dirty");
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    persistDraft();
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
editor.addEventListener("keydown", (event) => {
  if (event.key === "Enter") {
    window.setTimeout(() => {
      spawnRipple(getCaretPoint());
      lastRippleAt = Date.now();
    }, 140);
  }
});

updateClock();
restoreDraft();
restoreFontSize();
updateCount();
spawnRipple();
window.setInterval(updateClock, 1000 * 30);
window.addEventListener("pagehide", () => {
  persistDraft();
});

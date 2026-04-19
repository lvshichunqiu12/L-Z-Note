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
const newNoteBtn = document.querySelector("#newNoteBtn");
const activeViewBtn = document.querySelector("#activeViewBtn");
const archivedViewBtn = document.querySelector("#archivedViewBtn");
const archiveNoteBtn = document.querySelector("#archiveNoteBtn");
const clearArchivedBtn = document.querySelector("#clearArchivedBtn");
const noteSearchInput = document.querySelector("#noteSearchInput");
const noteThemeFilterButtons = document.querySelectorAll("[data-theme-filter]");
const noteListHost = document.querySelector("#noteListHost");
const noteHubCopy = document.querySelector(".note-hub-toolbar + .note-hub-copy");
const noteViewToggle = document.querySelector(".note-view-toggle");
const noteTitleInput = document.querySelector("#noteTitleInput");
const saveState = document.querySelector("#saveState");
const saveStateText = document.querySelector("#saveStateText");

const FONT_SIZE_KEY = "murmur-notes-moon-font-size";
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 26;
const EXPORT_PREFIX = "murmur-moon-note";
const THEME_LABEL = "月";
const DEFAULT_TITLE = "银夜札记";
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
let notePageController = null;
const noteListController = window.MurmurNotes.noteListUi.createNoteListController({
  container: noteListHost,
  onSelect(noteId) {
    void notePageController.switchToNote(noteId);
  },
  onAction(noteId, actionName) {
    if (actionName === "restore") {
      void notePageController.restoreArchivedNote(noteId);
    }
  },
});
notePageController = window.MurmurNotes.notePageCore.createNotePageController({
  archivedListEmptyDescription: "暂时收起的夜读笔记会放在这里，需要时可以再接回当前工作区。",
  archivedListEmptyTitle: "归档夹尚未亮灯",
  defaultTitle: DEFAULT_TITLE,
  editor: editor,
  exportPrefix: EXPORT_PREFIX,
  initialContent: INITIAL_EDITOR_MARKUP,
  noteListController: noteListController,
  noteListEmptyDescription: "这里会挂上最近编辑、恢复草稿和后续归档入口。",
  noteListEmptyTitle: "夜色里还很安静",
  onListViewChanged(view, activeNote, meta) {
    activeViewBtn.classList.toggle("is-active", view === "active");
    archivedViewBtn.classList.toggle("is-active", view === "archived");
    if (noteSearchInput && noteSearchInput.value !== (meta.searchQuery || "")) {
      noteSearchInput.value = meta.searchQuery || "";
    }
    noteThemeFilterButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.themeFilter === meta.themeFilter);
    });
    archiveNoteBtn.disabled = view !== "active";
    clearArchivedBtn.disabled = view !== "archived" || !meta.hasVisibleNotes;
  },
  onNoteChanged() {
    updateCount();
  },
  saveStateController: saveStateController,
  themeLabel: THEME_LABEL,
  titleInput: noteTitleInput,
});

if (noteViewToggle) {
  noteViewToggle.setAttribute("aria-label", "笔记视图");
}
if (activeViewBtn) {
  activeViewBtn.textContent = "当前笔记";
}
if (archivedViewBtn) {
  archivedViewBtn.textContent = "归档夹";
}
if (archiveNoteBtn) {
  archiveNoteBtn.textContent = "归档当前";
}
if (noteHubCopy) {
  noteHubCopy.textContent =
    "这里会承接前面写过的夜航笔记。正在用的留在本页，需要暂存的先放到归档。";
}

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

function schedulePersist(delay) {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void notePageController.persistDraft();
  }, delay || 480);
}

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
  saveStateController.setDirty("编辑中...");
  schedulePersist(480);
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
noteTitleInput.addEventListener("input", () => {
  saveStateController.setDirty("编辑中...");
  schedulePersist(420);
});
noteTitleInput.addEventListener("blur", () => {
  window.clearTimeout(saveTimer);
  void notePageController.persistDraft();
});
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
newNoteBtn.addEventListener("click", () => {
  window.clearTimeout(saveTimer);
  void notePageController.createNewNote().then((note) => {
    if (note) {
      createStarburst();
      lastBurstAt = Date.now();
    }
  });
});
activeViewBtn.addEventListener("click", () => {
  void notePageController.setListView("active");
});
archivedViewBtn.addEventListener("click", () => {
  void notePageController.setListView("archived");
});
noteSearchInput.addEventListener("input", () => {
  void notePageController.setSearchQuery(noteSearchInput.value);
});
noteThemeFilterButtons.forEach((button) => {
  button.addEventListener("click", () => {
    void notePageController.setThemeFilter(button.dataset.themeFilter);
  });
});
archiveNoteBtn.addEventListener("click", () => {
  window.clearTimeout(saveTimer);
  void notePageController.archiveCurrentNote();
});
clearArchivedBtn.addEventListener("click", () => {
  void notePageController.clearArchivedNotes();
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
  createStarburst();
}

void initializePage();
window.addEventListener("pagehide", () => {
  clockController.stop();
  void notePageController.persistDraft();
});

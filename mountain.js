const editor = document.querySelector("#editor");
const mistLayer = document.querySelector("#mistLayer");
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

const FONT_SIZE_KEY = "murmur-notes-mountain-font-size";
const MIN_FONT_SIZE = 16;
const MAX_FONT_SIZE = 26;
const EXPORT_PREFIX = "murmur-mountain-note";
const THEME_LABEL = "山";
const DEFAULT_TITLE = "云岭草稿";
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
    return size >= 22 ? "2.08" : "2";
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
  archivedListEmptyDescription: "暂时收起的峰线笔记会先放在这里，需要继续整理时再恢复回来。",
  archivedListEmptyTitle: "归档夹还没有内容",
  defaultTitle: DEFAULT_TITLE,
  editor: editor,
  exportPrefix: EXPORT_PREFIX,
  initialContent: INITIAL_EDITOR_MARKUP,
  noteListController: noteListController,
  noteListEmptyDescription: "这里会显示最近编辑、结构草稿和后续的归档视图。",
  noteListEmptyTitle: "山路还没有分岔",
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
    "这里会承接当前主题下的多篇笔记。常用的留在本页，完成一段的则先归档，让路径更清楚。";
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
let saveTimer = null;

function schedulePersist(delay) {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void notePageController.persistDraft();
  }, delay || 480);
}

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
  saveStateController.setDirty("编辑中...");
  schedulePersist(480);
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
noteTitleInput.addEventListener("input", () => {
  saveStateController.setDirty("编辑中...");
  schedulePersist(420);
});
noteTitleInput.addEventListener("blur", () => {
  window.clearTimeout(saveTimer);
  void notePageController.persistDraft();
});
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
      createMistBurst();
      lastMistAt = Date.now();
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
  createMistBurst();
}

void initializePage();
window.addEventListener("pagehide", () => {
  clockController.stop();
  void notePageController.persistDraft();
});

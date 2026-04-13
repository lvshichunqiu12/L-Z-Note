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
const newNoteBtn = document.querySelector("#newNoteBtn");
const activeViewBtn = document.querySelector("#activeViewBtn");
const archivedViewBtn = document.querySelector("#archivedViewBtn");
const archiveNoteBtn = document.querySelector("#archiveNoteBtn");
const clearArchivedBtn = document.querySelector("#clearArchivedBtn");
const noteListHost = document.querySelector("#noteListHost");
const noteHubCopy = document.querySelector(".note-hub-toolbar + .note-hub-copy");
const noteViewToggle = document.querySelector(".note-view-toggle");
const noteTitleInput = document.querySelector("#noteTitleInput");
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
  archivedListEmptyDescription: "这里会放暂时收起的水岸笔记，需要时可以随时恢复。",
  archivedListEmptyTitle: "归档夹还很安静",
  defaultTitle: DEFAULT_TITLE,
  editor: editor,
  exportPrefix: EXPORT_PREFIX,
  initialContent: INITIAL_EDITOR_MARKUP,
  noteListController: noteListController,
  noteListEmptyDescription: "这里会显示最近写过的草稿、水岸摘句和已恢复的本地记录。",
  noteListEmptyTitle: "还没有更多笔记",
  onListViewChanged(view, activeNote, meta) {
    activeViewBtn.classList.toggle("is-active", view === "active");
    archivedViewBtn.classList.toggle("is-active", view === "archived");
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
    "这里会承接当前主题下的多篇笔记。正在写的留在本页，暂时收起的则先放进归档。";
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

function schedulePersist(delay) {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    void notePageController.persistDraft();
  }, delay || 480);
}

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
  schedulePersist(480);
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
noteTitleInput.addEventListener("input", () => {
  saveStateController.setDirty("编辑中...");
  schedulePersist(420);
});
noteTitleInput.addEventListener("blur", () => {
  window.clearTimeout(saveTimer);
  void notePageController.persistDraft();
});
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
newNoteBtn.addEventListener("click", () => {
  window.clearTimeout(saveTimer);
  void notePageController.createNewNote().then((note) => {
    if (note) {
      spawnRipple();
      lastRippleAt = Date.now();
    }
  });
});
activeViewBtn.addEventListener("click", () => {
  void notePageController.setListView("active");
});
archivedViewBtn.addEventListener("click", () => {
  void notePageController.setListView("archived");
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

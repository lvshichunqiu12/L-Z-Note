(function attachNotePageCore(globalScope) {
  const root = globalScope.MurmurNotes || (globalScope.MurmurNotes = {});
  const PENDING_NOTE_ID_KEY = "murmur-notes-pending-note-id";

  function createClockController(options) {
    const clockEl = options && options.clockEl;
    const intervalMs = (options && options.intervalMs) || 1000 * 30;
    let intervalId = null;

    if (!clockEl) {
      throw new Error("Clock controller requires a target element.");
    }

    function update() {
      const now = new Date();
      clockEl.textContent = now.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      });
    }

    function start() {
      update();

      if (intervalId) {
        globalScope.clearInterval(intervalId);
      }

      intervalId = globalScope.setInterval(update, intervalMs);
    }

    function stop() {
      if (intervalId) {
        globalScope.clearInterval(intervalId);
        intervalId = null;
      }
    }

    return {
      start,
      stop,
      update,
    };
  }

  function createFontSizeController(options) {
    const editor = options && options.editor;
    const slider = options && options.slider;
    const valueNode = options && options.valueNode;
    const storageKey = options && options.storageKey;
    const min = Number(options && options.min);
    const max = Number(options && options.max);
    const resolveLineHeight =
      (options && options.resolveLineHeight) ||
      function defaultLineHeight(size) {
        return size >= 22 ? "2" : "1.95";
      };

    if (!editor || !slider || !valueNode || !storageKey) {
      throw new Error("Font size controller requires editor, slider, value node, and storage key.");
    }

    function clamp(size) {
      return Math.min(max, Math.max(min, size));
    }

    function apply(size) {
      const nextSize = clamp(size);
      editor.style.fontSize = `${nextSize}px`;
      editor.style.lineHeight = resolveLineHeight(nextSize);
      slider.value = String(nextSize);
      valueNode.textContent = `${nextSize}px`;
      globalScope.localStorage.setItem(storageKey, String(nextSize));
      return nextSize;
    }

    function restore() {
      const saved = Number(globalScope.localStorage.getItem(storageKey));
      const initialSize =
        Number.isFinite(saved) && saved >= min && saved <= max
          ? saved
          : Number(slider.value);

      return apply(initialSize);
    }

    return {
      apply,
      restore,
    };
  }

  function createNotePageController(options) {
    const editor = options && options.editor;
    const saveStateController = options && options.saveStateController;
    const noteListController = options && options.noteListController;
    const titleInput = options && options.titleInput;
    const defaultTitle = (options && options.defaultTitle) || "未命名笔记";
    const themeLabel = (options && options.themeLabel) || "";
    const exportPrefix = (options && options.exportPrefix) || "murmur-note";
    const noteListLimit =
      Number.isFinite(options && options.noteListLimit) && Number(options.noteListLimit) > 0
        ? Number(options.noteListLimit)
        : 5;
    const noteListEmptyTitle =
      (options && options.noteListEmptyTitle) || "还没有更多笔记";
    const noteListEmptyDescription =
      (options && options.noteListEmptyDescription) || "这里会显示最近记录的内容。";
    const archivedListEmptyTitle =
      (options && options.archivedListEmptyTitle) || "归档夹还是空的";
    const archivedListEmptyDescription =
      (options && options.archivedListEmptyDescription) || "归档过的笔记会先放在这里。";
    const clearArchivedConfirmMessage =
      (options && options.clearArchivedConfirmMessage) || "清空归档后将无法恢复，确认继续吗？";
    const onNoteChanged =
      options && typeof options.onNoteChanged === "function" ? options.onNoteChanged : null;
    const onListViewChanged =
      options && typeof options.onListViewChanged === "function" ? options.onListViewChanged : null;
    const initialContent =
      options && typeof options.initialContent === "string"
        ? options.initialContent.trim()
        : "";

    if (!editor || !saveStateController) {
      throw new Error("Note page controller requires editor and save state controller.");
    }

    let appServices = null;
    let activeNote = null;
    let listView = "active";
    let searchQuery = "";
    let themeFilter = "current";

    function getEditorMarkup() {
      return editor.innerHTML.trim();
    }

    function getEditorText() {
      return editor.innerText.replace(/\n{3,}/g, "\n\n").trim();
    }

    async function ensureServices() {
      if (!appServices) {
        appServices = await root.appInit.initializeCoreServices();
      }

      return appServices;
    }

    function getThemeMeta() {
      return appServices && appServices.themeMeta ? appServices.themeMeta : null;
    }

    function getThemeLabel() {
      return (getThemeMeta() && getThemeMeta().label) || themeLabel;
    }

    function getThemeDefaultTitle() {
      return (getThemeMeta() && getThemeMeta().defaultTitle) || defaultTitle;
    }

    function getExportPrefix() {
      return (getThemeMeta() && getThemeMeta().exportPrefix) || exportPrefix;
    }

    function getManualTitle() {
      if (!titleInput) {
        return "";
      }

      return String(titleInput.value || "").trim();
    }

    function syncTitleInput(note) {
      if (!titleInput) {
        return;
      }

      const themeDefault = getThemeDefaultTitle();
      const noteTitle = note && typeof note.title === "string" ? note.title.trim() : "";
      titleInput.value = noteTitle && noteTitle !== themeDefault ? noteTitle : "";
      titleInput.placeholder = themeDefault;
    }

    function getDefaultTitle() {
      return getManualTitle() || (activeNote && activeNote.title) || getThemeDefaultTitle();
    }

    function getActiveNote() {
      return activeNote;
    }

    function getListView() {
      return listView;
    }

    function getSearchQuery() {
      return searchQuery;
    }

    function getThemeFilter() {
      return themeFilter;
    }

    function notifyNoteChanged(note) {
      if (onNoteChanged) {
        onNoteChanged(note);
      }
    }

    function notifyListViewChanged(meta) {
      if (onListViewChanged) {
        onListViewChanged(listView, activeNote, meta || {});
      }
    }

    function hydrateListNote(repository, note) {
      const noteThemeMeta =
        root.themeConfig && note && note.theme
          ? root.themeConfig.getThemeMeta(note.theme)
          : null;

      return {
        ...note,
        displayTitle: repository.resolveNoteTitle(note, getThemeDefaultTitle()),
        themeLabel: noteThemeMeta ? noteThemeMeta.label : getThemeLabel(),
      };
    }

    function resolveThemeFilter(themeMeta) {
      if (themeFilter === "all") {
        return null;
      }

      if (themeFilter === "current") {
        return themeMeta.id;
      }

      return root.themeConfig && root.themeConfig.THEMES[themeFilter] ? themeFilter : themeMeta.id;
    }

    function readPendingNoteId() {
      try {
        return globalScope.localStorage.getItem(PENDING_NOTE_ID_KEY) || "";
      } catch (error) {
        return "";
      }
    }

    function clearPendingNoteId() {
      try {
        globalScope.localStorage.removeItem(PENDING_NOTE_ID_KEY);
      } catch (error) {
        // Ignore storage failures during cross-theme navigation cleanup.
      }
    }

    function writePendingNoteId(noteId) {
      try {
        globalScope.localStorage.setItem(PENDING_NOTE_ID_KEY, noteId);
      } catch (error) {
        // If this fails, navigation still works; the destination page will fall back to recent note.
      }
    }

    function navigateToThemeNote(note) {
      if (!note || !root.themeConfig) {
        return false;
      }

      const targetTheme = root.themeConfig.getThemeMeta(note.theme);
      if (!targetTheme || !targetTheme.page) {
        return false;
      }

      writePendingNoteId(note.id);
      globalScope.location.href = targetTheme.page;
      return true;
    }

    async function renderNoteList() {
      if (!noteListController) {
        return [];
      }

      const services = await ensureServices();
      const repository = services.repository;
      const resolvedTheme = resolveThemeFilter(services.themeMeta);
      const baseQuery = resolvedTheme
        ? {
            theme: resolvedTheme,
          }
        : {};
      const rawNotes =
        listView === "archived"
          ? await repository.listArchivedNotes(baseQuery)
          : await repository.listActiveNotes(baseQuery);
      const matchedNotes = root.notesSearch
        ? root.notesSearch.filterNotes(rawNotes, searchQuery)
        : rawNotes;
      const hydratedNotes = matchedNotes
        .slice(0, noteListLimit)
        .map(function mapNote(note) {
          return hydrateListNote(repository, note);
        });
      const hasSearch = Boolean(searchQuery.trim());
      const emptyTitle = hasSearch
        ? "没有找到匹配笔记"
        : listView === "archived"
          ? archivedListEmptyTitle
          : noteListEmptyTitle;
      const emptyDescription = hasSearch
        ? "换个关键词，或切换主题筛选后再试。"
        : listView === "archived"
          ? archivedListEmptyDescription
          : noteListEmptyDescription;

      noteListController.render(hydratedNotes, {
        activeNoteId: listView === "active" && activeNote ? activeNote.id : "",
        emptyTitle,
        emptyDescription,
        itemAction:
          listView === "archived"
            ? {
                name: "restore",
                label: "恢复",
              }
            : null,
        selectable: listView !== "archived",
      });

      notifyListViewChanged({
        hasVisibleNotes: hydratedNotes.length > 0,
        matchedCount: matchedNotes.length,
        searchQuery,
        themeFilter,
        visibleCount: hydratedNotes.length,
      });
      return hydratedNotes;
    }

    async function persistDraft() {
      try {
        const services = await ensureServices();

        if (!activeNote) {
          activeNote = await services.repository.createDraft(services.themeMeta.id, {
            title: getManualTitle(),
            content: getEditorMarkup() || initialContent,
          });
        }

        activeNote = await services.repository.saveNote({
          ...activeNote,
          title: getManualTitle(),
          content: getEditorMarkup(),
          theme: services.themeMeta.id,
        });

        syncTitleInput(activeNote);
        await renderNoteList();
        saveStateController.setSavedAt(activeNote.updatedAt);
        return true;
      } catch (error) {
        saveStateController.setError("保存失败");
        return false;
      }
    }

    async function createNewNote() {
      try {
        const services = await ensureServices();

        if (activeNote) {
          await persistDraft();
        }

        listView = "active";
        themeFilter = "current";
        searchQuery = "";
        activeNote = await services.repository.createDraft(services.themeMeta.id, {
          title: "",
          content: "",
        });

        editor.innerHTML = "";
        syncTitleInput(null);
        notifyNoteChanged(activeNote);
        await renderNoteList();
        saveStateController.setSaved("已创建新笔记");
        editor.focus();
        return activeNote;
      } catch (error) {
        saveStateController.setError("新建失败");
        return null;
      }
    }

    async function switchToNote(noteId) {
      const nextId = String(noteId || "");
      if (!nextId || listView !== "active") {
        return null;
      }

      if (activeNote && activeNote.id === nextId) {
        return activeNote;
      }

      try {
        if (activeNote) {
          await persistDraft();
        }

        const services = await ensureServices();
        const note = await services.repository.getNoteById(nextId);
        if (!note || note.archived) {
          return null;
        }

        if (note.theme !== services.themeMeta.id) {
          navigateToThemeNote(note);
          return note;
        }

        activeNote = note;
        editor.innerHTML = note.content || "";
        syncTitleInput(activeNote);
        notifyNoteChanged(activeNote);
        await renderNoteList();
        saveStateController.setRecovered(note.updatedAt);
        editor.focus();
        return note;
      } catch (error) {
        saveStateController.setError("切换失败");
        return null;
      }
    }

    async function restoreDraft() {
      try {
        const services = await ensureServices();
        const pendingNoteId = readPendingNoteId();
        let note = null;

        if (pendingNoteId) {
          const pendingNote = await services.repository.getNoteById(pendingNoteId);
          if (pendingNote && pendingNote.theme === services.themeMeta.id && !pendingNote.archived) {
            note = pendingNote;
          }

          clearPendingNoteId();
        }

        if (!note) {
          note = await services.repository.getRecentNote(services.themeMeta.id);
        }

        if (!note) {
          note = await services.repository.createDraft(services.themeMeta.id, {
            title: getManualTitle(),
            content: initialContent,
          });
          activeNote = note;
          syncTitleInput(activeNote);
          notifyNoteChanged(activeNote);
          await renderNoteList();
          saveStateController.setSaved("自动保存已开启");
          return note;
        }

        activeNote = note;
        editor.innerHTML = note.content || "";
        syncTitleInput(activeNote);
        notifyNoteChanged(activeNote);
        await renderNoteList();

        if (
          services.migrationResult &&
          Array.isArray(services.migrationResult.migrated) &&
          services.migrationResult.migrated.some(function hasMigration(item) {
            return item.theme === services.themeMeta.id;
          })
        ) {
          saveStateController.setMigrated("已迁移旧草稿");
        } else if (note.updatedAt) {
          saveStateController.setRecovered(note.updatedAt);
        } else {
          saveStateController.setSaved("已恢复本地草稿");
        }

        return note;
      } catch (error) {
        saveStateController.setError("读取草稿失败");
        return null;
      }
    }

    async function setListView(nextView) {
      const normalized = nextView === "archived" ? "archived" : "active";
      if (listView === normalized) {
        await renderNoteList();
        return listView;
      }

      listView = normalized;
      await renderNoteList();
      return listView;
    }

    async function setSearchQuery(nextQuery) {
      searchQuery = String(nextQuery || "");
      await renderNoteList();
      return searchQuery;
    }

    async function setThemeFilter(nextFilter) {
      const normalized = String(nextFilter || "current");
      themeFilter =
        normalized === "all" || normalized === "current" || (root.themeConfig && root.themeConfig.THEMES[normalized])
          ? normalized
          : "current";
      await renderNoteList();
      return themeFilter;
    }

    async function archiveCurrentNote() {
      if (!activeNote) {
        return null;
      }

      try {
        await persistDraft();
        const services = await ensureServices();
        await services.repository.archiveNote(activeNote.id);

        const fallbackNote = await services.repository.getRecentNote(services.themeMeta.id);
        listView = "active";

        if (fallbackNote) {
          activeNote = fallbackNote;
          editor.innerHTML = fallbackNote.content || "";
          syncTitleInput(activeNote);
          notifyNoteChanged(activeNote);
          await renderNoteList();
          saveStateController.setSaved("已归档当前笔记");
          return activeNote;
        }

        activeNote = await services.repository.createDraft(services.themeMeta.id, {
          title: "",
          content: "",
        });
        editor.innerHTML = "";
        syncTitleInput(activeNote);
        notifyNoteChanged(activeNote);
        await renderNoteList();
        saveStateController.setSaved("已归档当前笔记");
        return activeNote;
      } catch (error) {
        saveStateController.setError("归档失败");
        return null;
      }
    }

    async function restoreArchivedNote(noteId) {
      const nextId = String(noteId || "");
      if (!nextId) {
        return null;
      }

      try {
        const services = await ensureServices();
        const restored = await services.repository.restoreArchived(nextId);
        if (!restored) {
          return null;
        }

        if (restored.theme !== services.themeMeta.id) {
          navigateToThemeNote(restored);
          return restored;
        }

        listView = "active";
        activeNote = restored;
        editor.innerHTML = restored.content || "";
        syncTitleInput(activeNote);
        notifyNoteChanged(activeNote);
        await renderNoteList();
        saveStateController.setSaved("已恢复归档笔记");
        editor.focus();
        return restored;
      } catch (error) {
        saveStateController.setError("恢复失败");
        return null;
      }
    }

    async function clearArchivedNotes() {
      try {
        const services = await ensureServices();
        const resolvedTheme = resolveThemeFilter(services.themeMeta);
        const archivedNotes = await services.repository.listArchivedNotes({
          ...(resolvedTheme ? { theme: resolvedTheme } : {}),
        });
        const matchedNotes = root.notesSearch
          ? root.notesSearch.filterNotes(archivedNotes, searchQuery)
          : archivedNotes;

        if (!matchedNotes.length) {
          await renderNoteList();
          saveStateController.setSaved("归档夹已经清空");
          return 0;
        }

        if (!globalScope.confirm(clearArchivedConfirmMessage)) {
          return 0;
        }

        await Promise.all(
          matchedNotes.map(function removeArchivedNote(note) {
            return services.repository.deleteNote(note.id);
          })
        );
        const removedCount = matchedNotes.length;
        await renderNoteList();
        saveStateController.setSaved(
          removedCount > 0 ? `已清空归档（${removedCount} 篇）` : "归档夹已经清空"
        );
        return removedCount;
      } catch (error) {
        saveStateController.setError("清空失败");
        return 0;
      }
    }

    function buildFileName(extension) {
      const stamp = new Date()
        .toISOString()
        .slice(0, 16)
        .replace("T", "-")
        .replace(":", "");

      return `${getExportPrefix()}-${stamp}.${extension}`;
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
      globalScope.setTimeout(function revokeObjectUrl() {
        URL.revokeObjectURL(url);
      }, 1000);
      saveStateController.setExported(extension);
    }

    function exportMarkdown() {
      const content = getEditorText();
      const exportedAt = new Date().toLocaleString("zh-CN", { hour12: false });
      const markdown = [
        `# ${getDefaultTitle()}`,
        "",
        `- 主题：${getThemeLabel()}`,
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

    return {
      archiveCurrentNote,
      clearArchivedNotes,
      createNewNote,
      ensureServices,
      exportMarkdown,
      exportText,
      getActiveNote,
      getDefaultTitle,
      getEditorMarkup,
      getEditorText,
      getListView,
      getSearchQuery,
      getThemeFilter,
      getThemeLabel,
      persistDraft,
      renderNoteList,
      restoreArchivedNote,
      restoreDraft,
      setSearchQuery,
      setListView,
      setThemeFilter,
      switchToNote,
    };
  }

  root.notePageCore = {
    createClockController,
    createFontSizeController,
    createNotePageController,
  };
})(window);

(function attachNotePageCore(globalScope) {
  const root = globalScope.MurmurNotes || (globalScope.MurmurNotes = {});

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
    const defaultTitle = (options && options.defaultTitle) || "未命名笔记";
    const themeLabel = (options && options.themeLabel) || "";
    const exportPrefix = (options && options.exportPrefix) || "murmur-note";
    const initialContent =
      options && typeof options.initialContent === "string"
        ? options.initialContent.trim()
        : "";

    if (!editor || !saveStateController) {
      throw new Error("Note page controller requires editor and save state controller.");
    }

    let appServices = null;
    let activeNote = null;

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
      return appServices?.themeMeta || null;
    }

    function getThemeLabel() {
      return getThemeMeta()?.label || themeLabel;
    }

    function getDefaultTitle() {
      return activeNote?.title || getThemeMeta()?.defaultTitle || defaultTitle;
    }

    function getExportPrefix() {
      return getThemeMeta()?.exportPrefix || exportPrefix;
    }

    function getActiveNote() {
      return activeNote;
    }

    async function persistDraft() {
      try {
        const services = await ensureServices();

        if (!activeNote) {
          activeNote = await services.repository.createDraft(services.themeMeta.id, {
            title: getDefaultTitle(),
            content: getEditorMarkup() || initialContent,
          });
        }

        activeNote = await services.repository.saveNote({
          ...activeNote,
          title: getDefaultTitle(),
          content: getEditorMarkup(),
          theme: services.themeMeta.id,
        });

        saveStateController.setSavedAt(activeNote.updatedAt);
        return true;
      } catch (error) {
        saveStateController.setError("保存失败");
        return false;
      }
    }

    async function restoreDraft() {
      try {
        const services = await ensureServices();
        let note = await services.repository.getRecentNote(services.themeMeta.id);

        if (!note) {
          note = await services.repository.createDraft(services.themeMeta.id, {
            title: getDefaultTitle(),
            content: initialContent,
          });
          activeNote = note;
          saveStateController.setSaved("自动保存已开启");
          return note;
        }

        activeNote = note;

        if (note.content) {
          editor.innerHTML = note.content;
        }

        if (services.migrationResult?.migrated?.some(function hasMigration(item) {
          return item.theme === services.themeMeta.id;
        })) {
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
      ensureServices,
      exportMarkdown,
      exportText,
      getActiveNote,
      getDefaultTitle,
      getEditorMarkup,
      getEditorText,
      getThemeLabel,
      persistDraft,
      restoreDraft,
    };
  }

  root.notePageCore = {
    createClockController,
    createFontSizeController,
    createNotePageController,
  };
})(window);

(function attachSaveStateUi(globalScope) {
  const root = globalScope.MurmurNotes || (globalScope.MurmurNotes = {});

  function formatSaveTime(value) {
    return new Date(value).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  }

  function createSaveStateController(options) {
    const container = options && options.container;
    const textNode = options && options.textNode;

    if (!container || !textNode) {
      throw new Error("Save state controller requires container and text node.");
    }

    function setState(text, state) {
      container.dataset.state = state || "saved";
      textNode.textContent = text;
    }

    return {
      setState,
      setDirty(text) {
        setState(text || "编辑中...", "dirty");
      },
      setError(text) {
        setState(text || "保存失败", "error");
      },
      setExported(extension) {
        setState(`已导出 ${String(extension || "").toUpperCase()}`, "saved");
      },
      setRecovered(value) {
        setState(`已恢复 ${formatSaveTime(value)}`, "saved");
      },
      setSaved(text) {
        setState(text || "自动保存已开启", "saved");
      },
      setSavedAt(value) {
        setState(`已保存 ${formatSaveTime(value)}`, "saved");
      },
      setMigrated(text) {
        setState(text || "已迁移旧草稿", "saved");
      },
    };
  }

  root.saveStateUi = {
    createSaveStateController,
    formatSaveTime,
  };
})(window);

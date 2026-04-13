(function attachNoteListUi(globalScope) {
  const root = globalScope.MurmurNotes || (globalScope.MurmurNotes = {});

  function formatUpdatedAt(value) {
    if (!value) {
      return "刚刚更新";
    }

    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) {
      return "刚刚更新";
    }

    const deltaMinutes = Math.max(0, Math.round((Date.now() - timestamp) / 60000));
    if (deltaMinutes < 1) {
      return "刚刚更新";
    }

    if (deltaMinutes < 60) {
      return `${deltaMinutes} 分钟前`;
    }

    const deltaHours = Math.round(deltaMinutes / 60);
    if (deltaHours < 24) {
      return `${deltaHours} 小时前`;
    }

    const deltaDays = Math.round(deltaHours / 24);
    if (deltaDays < 7) {
      return `${deltaDays} 天前`;
    }

    return new Date(value).toLocaleDateString("zh-CN", {
      month: "numeric",
      day: "numeric",
    });
  }

  function createEmptyMarkup(title, description) {
    return [
      '<div class="note-list__empty" data-note-list-empty="true">',
      `  <strong class="note-list__empty-title">${title}</strong>`,
      `  <p class="note-list__empty-text">${description}</p>`,
      "</div>",
    ].join("\n");
  }

  function createItemMarkup(note, options) {
    const activeClass = options.activeNoteId === note.id ? " is-active" : "";
    const archivedClass = note.archived ? " is-archived" : "";
    const clickClass = options.selectable === false ? "" : " is-clickable";
    const stateText = note.archived ? "已归档" : "编辑中";
    const actionMarkup =
      options.itemAction && options.itemAction.label
        ? `<button class="note-list__item-action" data-note-action="${options.itemAction.name}" type="button">${options.itemAction.label}</button>`
        : "";

    return [
      `<article class="note-list__item${activeClass}${archivedClass}${clickClass}" data-note-id="${note.id}" ${options.selectable === false ? "" : 'role="button" tabindex="0"'}>`,
      '  <div class="note-list__meta">',
      `    <span class="note-list__theme">${note.themeLabel || ""}</span>`,
      `    <span class="note-list__time">${formatUpdatedAt(note.updatedAt)}</span>`,
      "  </div>",
      `  <strong class="note-list__title">${note.displayTitle || note.title || ""}</strong>`,
      `  <p class="note-list__excerpt">${note.excerpt || "这页还没有写下更多内容。"}</p>`,
      '  <div class="note-list__status">',
      `    <span>${stateText}</span>`,
      `    ${actionMarkup}`,
      "  </div>",
      "</article>",
    ].join("\n");
  }

  function createNoteListController(options) {
    const container = options && options.container;
    const onSelect = options && typeof options.onSelect === "function" ? options.onSelect : null;
    const onAction = options && typeof options.onAction === "function" ? options.onAction : null;

    if (!container) {
      throw new Error("Note list controller requires a container.");
    }

    function bindInteractiveNodes() {
      const selectableNodes = container.querySelectorAll("[data-note-id][role='button']");
      selectableNodes.forEach(function attachSelection(node) {
        node.addEventListener("click", function handleClick() {
          if (onSelect) {
            onSelect(node.dataset.noteId);
          }
        });

        node.addEventListener("keydown", function handleKeyDown(event) {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            if (onSelect) {
              onSelect(node.dataset.noteId);
            }
          }
        });
      });

      const actionNodes = container.querySelectorAll("[data-note-action]");
      actionNodes.forEach(function attachAction(node) {
        node.addEventListener("click", function handleAction(event) {
          event.stopPropagation();
          const holder = node.closest("[data-note-id]");
          if (!holder || !onAction) {
            return;
          }

          onAction(holder.dataset.noteId, node.dataset.noteAction);
        });
      });
    }

    function render(notes, options) {
      const renderOptions = options || {};
      const list = Array.isArray(notes) ? notes : [];

      if (!list.length) {
        container.innerHTML = createEmptyMarkup(
          renderOptions.emptyTitle || "还没有笔记",
          renderOptions.emptyDescription || "从这里开始记录第一篇内容。"
        );
        return;
      }

      const items = list.map(function mapNote(note) {
        return createItemMarkup(note, renderOptions);
      });

      container.innerHTML = [
        '<div class="note-list" data-note-list="true">',
        items.join("\n"),
        "</div>",
      ].join("\n");

      bindInteractiveNodes();
    }

    return {
      render,
      formatUpdatedAt,
    };
  }

  root.noteListUi = {
    createNoteListController,
    formatUpdatedAt,
  };
})(window);

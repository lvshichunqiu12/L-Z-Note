(function attachNotesRepository(globalScope) {
  const root = globalScope.MurmurNotes || (globalScope.MurmurNotes = {});

  const REQUIRED_STORAGE_METHODS = Object.freeze([
    "getNote",
    "listNotes",
    "putNote",
    "deleteNote",
  ]);

  function assertDependencies() {
    if (!root.noteModel) {
      throw new Error("Note model is not available.");
    }

    if (!root.themeConfig) {
      throw new Error("Theme config is not available.");
    }
  }

  function assertStorageAdapter(storageAdapter) {
    REQUIRED_STORAGE_METHODS.forEach(function ensureMethod(methodName) {
      if (!storageAdapter || typeof storageAdapter[methodName] !== "function") {
        throw new Error(`Storage adapter must implement ${methodName}().`);
      }
    });
  }

  function sortByUpdatedAtDesc(notes) {
    return notes.slice().sort(function compare(left, right) {
      return new Date(right.updatedAt).getTime() - new Date(left.updatedAt).getTime();
    });
  }

  function sortByCreatedAtDesc(notes) {
    return notes.slice().sort(function compare(left, right) {
      return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
    });
  }

  function normalizeListOptions(input) {
    const options = input || {};

    return {
      theme: typeof options.theme === "string" && options.theme ? options.theme : null,
      archived: typeof options.archived === "boolean" ? options.archived : null,
      includeArchived: Boolean(options.includeArchived),
      limit:
        Number.isFinite(options.limit) && Number(options.limit) > 0
          ? Number(options.limit)
          : null,
    };
  }

  function createNotesRepository(storageAdapter) {
    assertDependencies();
    assertStorageAdapter(storageAdapter);

    const noteModel = root.noteModel;
    const themeConfig = root.themeConfig;
    let initPromise = null;

    function init() {
      if (!initPromise) {
        initPromise =
          storageAdapter && typeof storageAdapter.init === "function"
            ? Promise.resolve(storageAdapter.init())
            : Promise.resolve();
      }

      return initPromise;
    }

    async function ensureReady() {
      await init();
    }

    async function createDraft(theme, overrides) {
      await ensureReady();
      const note = noteModel.createEmptyNote(theme, overrides || {});
      await storageAdapter.putNote(note);
      return note;
    }

    async function getNoteById(noteId) {
      await ensureReady();
      const raw = await storageAdapter.getNote(noteId);
      if (!raw) {
        return null;
      }

      return noteModel.normalizeNote(raw, raw.theme);
    }

    function normalizeStoredNotes(notes) {
      return notes.map(function normalize(raw) {
        return noteModel.normalizeNote(raw, raw.theme);
      });
    }

    function filterNotes(notes, filters) {
      const options = normalizeListOptions(filters);
      const filtered = notes
        .filter(function filterTheme(note) {
          return !options.theme || note.theme === options.theme;
        })
        .filter(function filterArchived(note) {
          if (typeof options.archived === "boolean") {
            return note.archived === options.archived;
          }

          if (options.includeArchived) {
            return true;
          }

          return !note.archived;
        });

      if (!options.limit) {
        return filtered;
      }

      return filtered.slice(0, options.limit);
    }

    function getThemeDefaultTitle(theme) {
      return themeConfig.getThemeMeta(theme).defaultTitle;
    }

    function resolveNoteTitle(note, fallbackTitle) {
      const explicitTitle = typeof note.title === "string" ? note.title.trim() : "";
      if (explicitTitle) {
        return explicitTitle;
      }

      const excerpt =
        typeof note.excerpt === "string" && note.excerpt.trim()
          ? note.excerpt.trim()
          : noteModel.buildExcerpt(note.content);

      if (excerpt) {
        return excerpt;
      }

      if (typeof fallbackTitle === "string" && fallbackTitle.trim()) {
        return fallbackTitle.trim();
      }

      return getThemeDefaultTitle(note.theme);
    }

    async function listAllNotes(filters) {
      await ensureReady();
      const notes = await storageAdapter.listNotes();
      const normalized = normalizeStoredNotes(notes);
      return filterNotes(sortByCreatedAtDesc(normalized), {
        ...filters,
        includeArchived: true,
      });
    }

    async function listActiveNotes(filters) {
      return listAllNotes({
        ...(filters || {}),
        archived: false,
      });
    }

    async function listArchivedNotes(filters) {
      return listAllNotes({
        ...(filters || {}),
        archived: true,
      });
    }

    async function getRecentNotes(options) {
      const query = normalizeListOptions(options);
      const notes = query.includeArchived
        ? await listAllNotes(query)
        : await listActiveNotes(query);

      if (!query.limit) {
        return notes;
      }

      return notes.slice(0, query.limit);
    }

    async function saveNote(input) {
      await ensureReady();
      const existing = input && input.id ? await storageAdapter.getNote(input.id) : null;
      const theme = input && input.theme ? input.theme : existing && existing.theme;
      const content =
        input && typeof input.content === "string"
          ? input.content
          : existing && typeof existing.content === "string"
            ? existing.content
            : "";
      const excerpt = noteModel.buildExcerpt(content);
      const nextTitle = resolveNoteTitle(
        {
          ...(existing || {}),
          ...(input || {}),
          content,
          excerpt,
          theme,
        },
        theme ? getThemeDefaultTitle(theme) : ""
      );
      const normalized = noteModel.normalizeNote(
        {
          ...(existing || {}),
          ...(input || {}),
          title: nextTitle,
          content,
          updatedAt: new Date().toISOString(),
          excerpt,
        },
        theme
      );

      await storageAdapter.putNote(normalized);
      return normalized;
    }

    async function updateTitle(noteId, title) {
      await ensureReady();
      const existing = await storageAdapter.getNote(noteId);
      if (!existing) {
        return null;
      }

      return saveNote({
        ...existing,
        title: String(title || "").trim(),
      });
    }

    async function renameNote(noteId, title) {
      return updateTitle(noteId, title);
    }

    async function archiveNote(noteId) {
      await ensureReady();
      const existing = await storageAdapter.getNote(noteId);
      if (!existing) {
        return null;
      }

      return saveNote({
        ...existing,
        archived: true,
      });
    }

    async function restoreArchived(noteId) {
      await ensureReady();
      const existing = await storageAdapter.getNote(noteId);
      if (!existing) {
        return null;
      }

      return saveNote({
        ...existing,
        archived: false,
      });
    }

    async function clearArchivedNotes(filters) {
      await ensureReady();
      const archivedNotes = await listArchivedNotes(filters);
      if (!archivedNotes.length) {
        return 0;
      }

      await Promise.all(
        archivedNotes.map(function removeArchived(note) {
          return storageAdapter.deleteNote(note.id);
        })
      );

      return archivedNotes.length;
    }

    async function deleteNote(noteId) {
      await ensureReady();
      return storageAdapter.deleteNote(noteId);
    }

    async function getRecentNote(themeOrOptions) {
      const query =
        typeof themeOrOptions === "string"
          ? {
              theme: themeOrOptions,
              includeArchived: false,
              limit: 1,
            }
          : {
              ...(themeOrOptions || {}),
              includeArchived:
                themeOrOptions && typeof themeOrOptions.includeArchived === "boolean"
                  ? themeOrOptions.includeArchived
                  : false,
              limit: 1,
            };
      await ensureReady();
      const notes = await storageAdapter.listNotes();
      const normalized = normalizeStoredNotes(notes);
      const filtered = filterNotes(sortByUpdatedAtDesc(normalized), query);

      return filtered[0] || null;
    }

    return {
      init,
      createDraft,
      deleteNote,
      getNoteById,
      getRecentNote,
      getRecentNotes,
      listAllNotes,
      listActiveNotes,
      listArchivedNotes,
      renameNote,
      resolveNoteTitle,
      restoreArchived,
      saveNote,
      archiveNote,
      clearArchivedNotes,
      updateTitle,
      themeConfig,
    };
  }

  root.notesRepository = {
    REQUIRED_STORAGE_METHODS,
    createNotesRepository,
  };
})(window);

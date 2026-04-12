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

    async function listActiveNotes(filters) {
      await ensureReady();
      const options = filters || {};
      const notes = await storageAdapter.listNotes();
      const filtered = notes
        .map(function normalize(raw) {
          return noteModel.normalizeNote(raw, raw.theme);
        })
        .filter(function filterArchived(note) {
          if (options.includeArchived) {
            return true;
          }

          return !note.archived;
        })
        .filter(function filterTheme(note) {
          return !options.theme || note.theme === options.theme;
        });

      return sortByUpdatedAtDesc(filtered);
    }

    async function saveNote(input) {
      await ensureReady();
      const existing = input && input.id ? await storageAdapter.getNote(input.id) : null;
      const theme = input && input.theme ? input.theme : existing && existing.theme;
      const normalized = noteModel.normalizeNote(
        {
          ...(existing || {}),
          ...(input || {}),
          updatedAt: new Date().toISOString(),
          excerpt: noteModel.buildExcerpt(input && typeof input.content === "string" ? input.content : existing && existing.content),
        },
        theme
      );

      await storageAdapter.putNote(normalized);
      return normalized;
    }

    async function renameNote(noteId, title) {
      await ensureReady();
      const existing = await storageAdapter.getNote(noteId);
      if (!existing) {
        return null;
      }

      return saveNote({
        ...existing,
        title: String(title || "").trim() || existing.title,
      });
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

    async function deleteNote(noteId) {
      await ensureReady();
      return storageAdapter.deleteNote(noteId);
    }

    async function getRecentNote(theme) {
      await ensureReady();
      const notes = await listActiveNotes({
        includeArchived: false,
        theme: theme || null,
      });

      return notes[0] || null;
    }

    return {
      init,
      createDraft,
      deleteNote,
      getNoteById,
      getRecentNote,
      listActiveNotes,
      renameNote,
      saveNote,
      archiveNote,
      themeConfig,
    };
  }

  root.notesRepository = {
    REQUIRED_STORAGE_METHODS,
    createNotesRepository,
  };
})(window);

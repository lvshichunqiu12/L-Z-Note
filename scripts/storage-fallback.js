(function attachFallbackStorage(globalScope) {
  const root = globalScope.MurmurNotes || (globalScope.MurmurNotes = {});

  const STORAGE_KEY = "murmur-notes-storage-v1";

  function cloneRecord(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

  function readState() {
    try {
      const raw = globalScope.localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        return {
          notesById: {},
        };
      }

      const parsed = JSON.parse(raw);

      if (!parsed || typeof parsed !== "object" || typeof parsed.notesById !== "object") {
        return {
          notesById: {},
        };
      }

      return parsed;
    } catch (error) {
      return {
        notesById: {},
      };
    }
  }

  function writeState(nextState) {
    globalScope.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextState));
  }

  function createFallbackStorage() {
    function init() {
      return Promise.resolve();
    }

    async function getNote(noteId) {
      const state = readState();
      return cloneRecord(state.notesById[noteId]) || null;
    }

    async function listNotes() {
      const state = readState();
      return Object.keys(state.notesById).map(function mapNoteId(noteId) {
        return cloneRecord(state.notesById[noteId]);
      });
    }

    async function putNote(note) {
      const state = readState();
      state.notesById[note.id] = cloneRecord(note);
      writeState(state);
    }

    async function deleteNote(noteId) {
      const state = readState();
      delete state.notesById[noteId];
      writeState(state);
    }

    return {
      type: "localstorage-fallback",
      init,
      getNote,
      listNotes,
      putNote,
      deleteNote,
      storageKey: STORAGE_KEY,
    };
  }

  root.fallbackStorage = {
    STORAGE_KEY,
    createFallbackStorage,
  };
})(window);

(function attachIndexedDbStorage(globalScope) {
  const root = globalScope.MurmurNotes || (globalScope.MurmurNotes = {});

  const DB_NAME = "murmur-notes-db";
  const DB_VERSION = 1;
  const STORE_NAME = "notes";
  const INDEX_UPDATED_AT = "updatedAt";
  const INDEX_THEME = "theme";
  const INDEX_ARCHIVED = "archived";

  function isSupported() {
    return typeof globalScope.indexedDB !== "undefined";
  }

  function cloneRecord(value) {
    return value ? JSON.parse(JSON.stringify(value)) : value;
  }

  function openDatabase() {
    if (!isSupported()) {
      return Promise.reject(new Error("IndexedDB is not supported in this environment."));
    }

    return new Promise(function openPromise(resolve, reject) {
      const request = globalScope.indexedDB.open(DB_NAME, DB_VERSION);

      request.onerror = function onError() {
        reject(request.error || new Error("Failed to open IndexedDB."));
      };

      request.onupgradeneeded = function onUpgrade() {
        const database = request.result;
        let store = null;

        if (!database.objectStoreNames.contains(STORE_NAME)) {
          store = database.createObjectStore(STORE_NAME, {
            keyPath: "id",
          });
        } else {
          store = request.transaction.objectStore(STORE_NAME);
        }

        if (!store.indexNames.contains(INDEX_UPDATED_AT)) {
          store.createIndex(INDEX_UPDATED_AT, INDEX_UPDATED_AT, { unique: false });
        }

        if (!store.indexNames.contains(INDEX_THEME)) {
          store.createIndex(INDEX_THEME, INDEX_THEME, { unique: false });
        }

        if (!store.indexNames.contains(INDEX_ARCHIVED)) {
          store.createIndex(INDEX_ARCHIVED, INDEX_ARCHIVED, { unique: false });
        }
      };

      request.onsuccess = function onSuccess() {
        const database = request.result;

        database.onversionchange = function onVersionChange() {
          database.close();
        };

        resolve(database);
      };
    });
  }

  function requestToPromise(request) {
    return new Promise(function wrapRequest(resolve, reject) {
      request.onerror = function onError() {
        reject(request.error || new Error("IndexedDB request failed."));
      };

      request.onsuccess = function onSuccess() {
        resolve(request.result);
      };
    });
  }

  function createIndexedDbStorage() {
    let dbPromise = null;

    function init() {
      if (!dbPromise) {
        dbPromise = openDatabase();
      }

      return dbPromise;
    }

    async function withStore(mode, handler) {
      const database = await init();

      return new Promise(function runTransaction(resolve, reject) {
        const transaction = database.transaction(STORE_NAME, mode);
        const store = transaction.objectStore(STORE_NAME);

        let settled = false;

        transaction.oncomplete = function onComplete() {
          if (!settled) {
            settled = true;
            resolve(undefined);
          }
        };

        transaction.onerror = function onError() {
          if (!settled) {
            settled = true;
            reject(transaction.error || new Error("IndexedDB transaction failed."));
          }
        };

        transaction.onabort = function onAbort() {
          if (!settled) {
            settled = true;
            reject(transaction.error || new Error("IndexedDB transaction aborted."));
          }
        };

        Promise.resolve(handler(store, transaction))
          .then(function onHandlerResolved(result) {
            if (typeof result !== "undefined" && !settled) {
              settled = true;
              resolve(result);
            }
          })
          .catch(function onHandlerRejected(error) {
            if (!settled) {
              settled = true;
              reject(error);
            }
          });
      });
    }

    async function getNote(noteId) {
      return withStore("readonly", async function readNote(store) {
        const result = await requestToPromise(store.get(noteId));
        return cloneRecord(result) || null;
      });
    }

    async function listNotes() {
      return withStore("readonly", async function readAll(store) {
        if (typeof store.getAll === "function") {
          const results = await requestToPromise(store.getAll());
          return Array.isArray(results) ? results.map(cloneRecord) : [];
        }

        return new Promise(function readByCursor(resolve, reject) {
          const notes = [];
          const request = store.openCursor();

          request.onerror = function onError() {
            reject(request.error || new Error("Failed to list IndexedDB notes."));
          };

          request.onsuccess = function onSuccess() {
            const cursor = request.result;

            if (!cursor) {
              resolve(notes);
              return;
            }

            notes.push(cloneRecord(cursor.value));
            cursor.continue();
          };
        });
      });
    }

    async function putNote(note) {
      return withStore("readwrite", async function writeNote(store) {
        await requestToPromise(store.put(cloneRecord(note)));
      });
    }

    async function deleteNote(noteId) {
      return withStore("readwrite", async function removeNote(store) {
        await requestToPromise(store.delete(noteId));
      });
    }

    return {
      type: "indexeddb",
      init,
      isSupported,
      getNote,
      listNotes,
      putNote,
      deleteNote,
    };
  }

  root.indexedDbStorage = {
    DB_NAME,
    DB_VERSION,
    STORE_NAME,
    INDEX_UPDATED_AT,
    INDEX_THEME,
    INDEX_ARCHIVED,
    createIndexedDbStorage,
    isSupported,
  };
})(window);

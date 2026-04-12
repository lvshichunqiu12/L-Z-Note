(function attachNotesMigration(globalScope) {
  const root = globalScope.MurmurNotes || (globalScope.MurmurNotes = {});

  const MIGRATION_VERSION = 1;
  const MIGRATION_STATE_KEY = "murmur-notes-migration-state";

  function assertDependencies() {
    if (!root.themeConfig) {
      throw new Error("Theme config is not available.");
    }

    if (!root.noteModel) {
      throw new Error("Note model is not available.");
    }
  }

  function readMigrationState() {
    try {
      const raw = globalScope.localStorage.getItem(MIGRATION_STATE_KEY);

      if (!raw) {
        return {
          version: 0,
          migratedThemes: {},
        };
      }

      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object") {
        throw new Error("Invalid migration state.");
      }

      return {
        version: Number(parsed.version || 0),
        migratedThemes:
          parsed.migratedThemes && typeof parsed.migratedThemes === "object"
            ? parsed.migratedThemes
            : {},
      };
    } catch (error) {
      return {
        version: 0,
        migratedThemes: {},
      };
    }
  }

  function writeMigrationState(nextState) {
    globalScope.localStorage.setItem(MIGRATION_STATE_KEY, JSON.stringify(nextState));
  }

  function parseLegacyDraft(rawValue) {
    if (!rawValue) {
      return null;
    }

    try {
      const parsed = JSON.parse(rawValue);
      if (!parsed || typeof parsed !== "object") {
        return null;
      }

      return {
        content: typeof parsed.content === "string" ? parsed.content : "",
        updatedAt: parsed.updatedAt || null,
      };
    } catch (error) {
      return null;
    }
  }

  function hasMeaningfulContent(noteModel, markup) {
    return Boolean(noteModel.stripMarkup(markup || ""));
  }

  function getExistingThemes(notes) {
    return notes.reduce(function collect(accumulator, note) {
      accumulator[note.theme] = true;
      return accumulator;
    }, {});
  }

  function createNotesMigration(options) {
    assertDependencies();

    const repository = options && options.repository;
    if (!repository || typeof repository.listActiveNotes !== "function") {
      throw new Error("A notes repository is required for migration.");
    }

    const themeConfig = root.themeConfig;
    const noteModel = root.noteModel;

    async function migrateLegacyDrafts() {
      await repository.init();

      const migrationState = readMigrationState();
      const existingNotes = await repository.listActiveNotes({ includeArchived: true });
      const existingThemes = getExistingThemes(existingNotes);
      const result = {
        migrated: [],
        skipped: [],
        alreadyCompleted: migrationState.version >= MIGRATION_VERSION,
      };

      themeConfig.THEME_IDS.forEach(function prepareSkip(themeId) {
        if (migrationState.migratedThemes[themeId]) {
          result.skipped.push({
            theme: themeId,
            reason: "already-migrated",
          });
        }
      });

      for (const themeId of themeConfig.THEME_IDS) {
        if (migrationState.migratedThemes[themeId]) {
          continue;
        }

        if (existingThemes[themeId]) {
          result.skipped.push({
            theme: themeId,
            reason: "new-schema-note-exists",
          });
          migrationState.migratedThemes[themeId] = {
            skipped: true,
            reason: "new-schema-note-exists",
            markedAt: new Date().toISOString(),
          };
          continue;
        }

        const themeMeta = themeConfig.getThemeMeta(themeId);
        const legacyDraft = parseLegacyDraft(
          globalScope.localStorage.getItem(themeMeta.legacyDraftKey)
        );

        if (!legacyDraft || !hasMeaningfulContent(noteModel, legacyDraft.content)) {
          result.skipped.push({
            theme: themeId,
            reason: "no-legacy-content",
          });
          migrationState.migratedThemes[themeId] = {
            skipped: true,
            reason: "no-legacy-content",
            markedAt: new Date().toISOString(),
          };
          continue;
        }

        const timestamp = legacyDraft.updatedAt || new Date().toISOString();
        const migratedNote = await repository.createDraft(themeId, {
          title: themeMeta.defaultTitle,
          content: legacyDraft.content,
          createdAt: timestamp,
          updatedAt: timestamp,
          excerpt: noteModel.buildExcerpt(legacyDraft.content),
        });

        migrationState.migratedThemes[themeId] = {
          skipped: false,
          noteId: migratedNote.id,
          migratedAt: new Date().toISOString(),
        };

        result.migrated.push({
          theme: themeId,
          noteId: migratedNote.id,
        });
      }

      migrationState.version = MIGRATION_VERSION;
      writeMigrationState(migrationState);

      return result;
    }

    return {
      migrateLegacyDrafts,
    };
  }

  root.notesMigration = {
    MIGRATION_STATE_KEY,
    MIGRATION_VERSION,
    createNotesMigration,
    parseLegacyDraft,
    readMigrationState,
    writeMigrationState,
  };
})(window);

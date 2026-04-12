(function attachAppInit(globalScope) {
  const root = globalScope.MurmurNotes || (globalScope.MurmurNotes = {});

  function assertDependencies() {
    if (!root.themeConfig) {
      throw new Error("Theme config is not available.");
    }

    if (!root.notesRepository) {
      throw new Error("Notes repository is not available.");
    }

    if (!root.indexedDbStorage || !root.fallbackStorage) {
      throw new Error("Storage adapters are not available.");
    }
  }

  function getCurrentPageName() {
    const pathname = globalScope.location.pathname || "";
    const segments = pathname.split("/");
    const lastSegment = segments[segments.length - 1];

    return lastSegment || "index.html";
  }

  function resolveThemeMeta() {
    const themeMeta = root.themeConfig.getThemeByPage(getCurrentPageName());
    if (!themeMeta) {
      throw new Error(`Unable to resolve theme for page: ${getCurrentPageName()}`);
    }

    return themeMeta;
  }

  function createPreferredStorage() {
    if (root.indexedDbStorage.isSupported()) {
      return root.indexedDbStorage.createIndexedDbStorage();
    }

    return root.fallbackStorage.createFallbackStorage();
  }

  async function createReadyStorageAdapter() {
    const preferredAdapter = createPreferredStorage();

    try {
      if (preferredAdapter && typeof preferredAdapter.init === "function") {
        await preferredAdapter.init();
      }

      return preferredAdapter;
    } catch (error) {
      const fallbackAdapter = root.fallbackStorage.createFallbackStorage();
      await fallbackAdapter.init();
      return fallbackAdapter;
    }
  }

  async function initializeCoreServices(options) {
    assertDependencies();

    const storageAdapter =
      options && options.storageAdapter
        ? options.storageAdapter
        : await createReadyStorageAdapter();
    const repository = root.notesRepository.createNotesRepository(storageAdapter);
    const migration = root.notesMigration
      ? root.notesMigration.createNotesMigration({ repository: repository })
      : null;
    const themeMeta =
      options && options.theme
        ? root.themeConfig.getThemeMeta(options.theme)
        : resolveThemeMeta();

    await repository.init();

    const migrationResult = migration
      ? await migration.migrateLegacyDrafts()
      : null;

    return {
      migrationResult,
      repository,
      storageAdapter,
      themeMeta,
    };
  }

  root.appInit = {
    createReadyStorageAdapter,
    createPreferredStorage,
    getCurrentPageName,
    initializeCoreServices,
    resolveThemeMeta,
  };
})(window);

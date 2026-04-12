(function attachNoteModel(globalScope) {
  const root = globalScope.MurmurNotes || (globalScope.MurmurNotes = {});

  const NOTE_SCHEMA_VERSION = 1;
  const DEFAULT_EXCERPT_LENGTH = 72;

  /**
   * @typedef {"spring" | "mountain" | "flower" | "moon"} NoteTheme
   */

  /**
   * @typedef {Object} NoteRecord
   * @property {string} id
   * @property {string} title
   * @property {string} content
   * @property {NoteTheme} theme
   * @property {string} createdAt
   * @property {string} updatedAt
   * @property {boolean} archived
   * @property {string} excerpt
   * @property {number} schemaVersion
   */

  function getThemeConfig() {
    if (!root.themeConfig || !root.themeConfig.THEMES) {
      throw new Error("Theme config is not available.");
    }

    return root.themeConfig;
  }

  function stripMarkup(value) {
    return String(value || "")
      .replace(/<br\s*\/?>/gi, "\n")
      .replace(/<\/(p|div|li|h[1-6])>/gi, "\n")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function buildExcerpt(content, maxLength) {
    const plainText = stripMarkup(content);
    const excerptLength = Number.isFinite(maxLength) ? maxLength : DEFAULT_EXCERPT_LENGTH;

    if (!plainText) {
      return "";
    }

    if (plainText.length <= excerptLength) {
      return plainText;
    }

    return `${plainText.slice(0, excerptLength).trimEnd()}...`;
  }

  function createNoteId() {
    return `note_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  function isValidTheme(theme) {
    const { THEME_IDS } = getThemeConfig();
    return THEME_IDS.includes(theme);
  }

  function assertValidTheme(theme) {
    if (!isValidTheme(theme)) {
      throw new Error(`Unsupported theme: ${theme}`);
    }
  }

  function createEmptyNote(theme, overrides) {
    const { getThemeMeta } = getThemeConfig();
    const themeMeta = getThemeMeta(theme);
    const now = new Date().toISOString();
    const content = overrides && typeof overrides.content === "string" ? overrides.content : "";
    const title =
      overrides && typeof overrides.title === "string" && overrides.title.trim()
        ? overrides.title.trim()
        : themeMeta.defaultTitle;

    assertValidTheme(theme);

    return normalizeNote({
      id: overrides && overrides.id ? String(overrides.id) : createNoteId(),
      title,
      content,
      theme,
      createdAt: overrides && overrides.createdAt ? overrides.createdAt : now,
      updatedAt: overrides && overrides.updatedAt ? overrides.updatedAt : now,
      archived: overrides && typeof overrides.archived === "boolean" ? overrides.archived : false,
      excerpt: overrides && typeof overrides.excerpt === "string" ? overrides.excerpt : buildExcerpt(content),
      schemaVersion: NOTE_SCHEMA_VERSION,
    });
  }

  function normalizeNote(input, fallbackTheme) {
    const theme =
      input && typeof input.theme === "string" && isValidTheme(input.theme)
        ? input.theme
        : fallbackTheme;

    assertValidTheme(theme);

    const safeContent = typeof input.content === "string" ? input.content : "";
    const safeTitle = typeof input.title === "string" && input.title.trim() ? input.title.trim() : buildExcerpt(safeContent, 18) || "未命名笔记";

    return {
      id: String(input.id || createNoteId()),
      title: safeTitle,
      content: safeContent,
      theme,
      createdAt: input.createdAt || new Date().toISOString(),
      updatedAt: input.updatedAt || new Date().toISOString(),
      archived: Boolean(input.archived),
      excerpt: typeof input.excerpt === "string" && input.excerpt.trim() ? input.excerpt.trim() : buildExcerpt(safeContent),
      schemaVersion: NOTE_SCHEMA_VERSION,
    };
  }

  function isValidNoteRecord(input) {
    if (!input || typeof input !== "object") {
      return false;
    }

    if (!input.id || !input.title || !input.createdAt || !input.updatedAt) {
      return false;
    }

    return isValidTheme(input.theme);
  }

  root.noteModel = {
    NOTE_SCHEMA_VERSION,
    DEFAULT_EXCERPT_LENGTH,
    buildExcerpt,
    createEmptyNote,
    createNoteId,
    isValidNoteRecord,
    isValidTheme,
    normalizeNote,
    stripMarkup,
  };
})(window);

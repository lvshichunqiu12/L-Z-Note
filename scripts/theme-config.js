(function attachThemeConfig(globalScope) {
  const root = globalScope.MurmurNotes || (globalScope.MurmurNotes = {});

  const THEMES = Object.freeze({
    spring: Object.freeze({
      id: "spring",
      label: "泉",
      page: "index.html",
      pageKey: "index",
      defaultTitle: "流水手记",
      exportPrefix: "murmur-water-note",
      legacyDraftKey: "murmur-notes-water-draft",
      legacyFontSizeKey: "murmur-notes-font-size",
    }),
    mountain: Object.freeze({
      id: "mountain",
      label: "山",
      page: "mountain.html",
      pageKey: "mountain",
      defaultTitle: "云岭草稿",
      exportPrefix: "murmur-mountain-note",
      legacyDraftKey: "murmur-notes-mountain-draft",
      legacyFontSizeKey: "murmur-notes-mountain-font-size",
    }),
    flower: Object.freeze({
      id: "flower",
      label: "花",
      page: "flower.html",
      pageKey: "flower",
      defaultTitle: "花径摘录",
      exportPrefix: "murmur-flower-note",
      legacyDraftKey: "murmur-notes-flower-draft",
      legacyFontSizeKey: "murmur-notes-flower-font-size",
    }),
    moon: Object.freeze({
      id: "moon",
      label: "月",
      page: "moon.html",
      pageKey: "moon",
      defaultTitle: "银夜札记",
      exportPrefix: "murmur-moon-note",
      legacyDraftKey: "murmur-notes-moon-draft",
      legacyFontSizeKey: "murmur-notes-moon-font-size",
    }),
  });

  const THEME_IDS = Object.freeze(Object.keys(THEMES));

  function getThemeMeta(themeId) {
    const theme = THEMES[themeId];

    if (!theme) {
      throw new Error(`Unknown theme: ${themeId}`);
    }

    return theme;
  }

  function getThemeByPage(pageName) {
    const match = THEME_IDS.find(function findByPage(themeId) {
      return THEMES[themeId].page === pageName;
    });

    return match ? THEMES[match] : null;
  }

  root.themeConfig = {
    THEMES,
    THEME_IDS,
    getThemeByPage,
    getThemeMeta,
  };
})(window);

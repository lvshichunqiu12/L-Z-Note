(function attachNotesSearch(globalScope) {
  const root = globalScope.MurmurNotes || (globalScope.MurmurNotes = {});

  function normalizeSearchText(value) {
    return String(value || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim();
  }

  function getSearchHaystack(note) {
    const stripMarkup =
      root.noteModel && typeof root.noteModel.stripMarkup === "function"
        ? root.noteModel.stripMarkup
        : function fallbackStripMarkup(value) {
            return String(value || "").replace(/<[^>]+>/g, " ");
          };

    return normalizeSearchText(
      [
        note && note.title,
        note && note.displayTitle,
        note && note.excerpt,
        stripMarkup(note && note.content),
      ].join(" ")
    );
  }

  function filterNotes(notes, query) {
    const list = Array.isArray(notes) ? notes : [];
    const normalizedQuery = normalizeSearchText(query);

    if (!normalizedQuery) {
      return list;
    }

    return list.filter(function matchesQuery(note) {
      return getSearchHaystack(note).includes(normalizedQuery);
    });
  }

  root.notesSearch = {
    filterNotes,
    normalizeSearchText,
  };
})(window);

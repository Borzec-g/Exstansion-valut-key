(function () {
  const searchInput = document.querySelector('.search-input');
  if (!searchInput) return;

  const container = document.querySelector('.wrap') || document.body;
  const normalize = (s) => (s || '').toString().trim().toLowerCase();

  function vkScoreMatch(text, query) {
    if (!query) return 0;
    text = normalize(text);
    query = normalize(query);
    if (!text) return 0;
    if (text === query) return 1000;
    if (text.startsWith(query)) return 700;
    const pos = text.indexOf(query);
    if (pos !== -1) return 400 - Math.min(pos, 200);
    const tokens = query.split(/\s+/).filter(Boolean);
    let score = 0;
    for (const token of tokens) {
      if (!token) continue;
      if (text.startsWith(token)) score += 80;
      else if (text.includes(token)) score += 40;
    }
    return score;
  }

  function vkReorderCards() {
    const query = normalize(searchInput.value);
    const cards = Array.from(container.querySelectorAll('.savecode'));
    if (!cards.length) return;

    const listParent = cards[0].parentElement;
    const ranked = cards.map((card, i) => {
      const nameEl = card.querySelector('.namecodetext');
      const name = nameEl ? nameEl.textContent : '';
      return { card, score: vkScoreMatch(name, query), i };
    });

    ranked.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return a.i - b.i;
    });

    for (const r of ranked) {
      listParent.appendChild(r.card);
      r.card.style.display = '';
    }
  }

  searchInput.addEventListener('input', vkReorderCards);
  vkReorderCards();
})();

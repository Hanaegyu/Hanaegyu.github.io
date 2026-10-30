/* ---------- Helpers ---------- */
function load(key) {
  try {
    return JSON.parse(localStorage.getItem(key)) || [];
  } catch (e) {
    return [];
  }
}

function save(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (e) {
    alert("Storage is full. Remove some items or use smaller pictures.");
    return false;
  }
}

/* ---------- Comments (not saved, practice only) ---------- */
function addComment() {
  const name = document.getElementById("name").value.trim();
  const message = document.getElementById("message").value.trim();
  if (!name || !message) return;

  const box = document.createElement("div");
  box.className = "comment";

  const who = document.createElement("strong");
  who.textContent = name;

  const text = document.createElement("span");
  text.textContent = message;

  box.append(who, text);
  document.getElementById("comment-list").prepend(box);

  document.getElementById("name").value = "";
  document.getElementById("message").value = "";
}

/* ---------- Books you add with the form ---------- */
let books = load("myBooks");
let newRating = 0;
const LIST_NAMES = {
  "want-grid": "Want to Read",
  "current-grid": "Current Read",
  "already-grid": "Already Read"
};

function starText(n) {
  return "★".repeat(n) + "☆".repeat(5 - n);
}

function setStars(n) {
  newRating = n;
  document.querySelectorAll("#star-picker button").forEach(function (b) {
    b.classList.toggle("on", Number(b.dataset.v) <= n);
  });
}

function showBookMsg(text) {
  document.getElementById("book-msg").textContent = text;
}

function renderBook(book) {
  const card = document.createElement("div");
  card.className = "book";

  if (book.cover) {
    const img = document.createElement("img");
    img.src = book.cover;
    img.alt = "Cover of " + book.title;
    card.append(img);
  }

  const title = document.createElement("h3");
  title.textContent = book.title;
  card.append(title);

  if (book.author) {
    const author = document.createElement("p");
    author.className = "author";
    author.textContent = book.author;
    card.append(author);
  }

  const bits = [book.format, book.country, book.year].filter(Boolean);
  if (bits.length) {
    const meta = document.createElement("p");
    meta.className = "author";
    meta.textContent = bits.join(" · ");
    card.append(meta);
  }

  if (book.genres && book.genres.length) {
    const chips = document.createElement("div");
    chips.className = "chips";
    book.genres.forEach(function (g) {
      const chip = document.createElement("span");
      chip.className = "chip";
      chip.textContent = g;
      chips.append(chip);
    });
    card.append(chips);
  }

  if (book.rating) {
    const stars = document.createElement("p");
    stars.className = "stars";
    stars.textContent = starText(book.rating);
    card.append(stars);
  }

  const del = document.createElement("button");
  del.className = "delete-btn";
  del.textContent = "Remove";
  del.onclick = function () {
    books = books.filter(b => b.id !== book.id);
    save("myBooks", books);
    card.remove();
    libRefreshAll();
  };
  card.append(del);

  document.getElementById(book.list).append(card);
}

function addBook() {
  const title = document.getElementById("book-title").value.trim();
  const author = document.getElementById("book-author").value.trim();
  const country = document.getElementById("book-country").value.trim();
  const format = document.getElementById("book-format").value;
  const y = parseInt(document.getElementById("book-year").value, 10);
  const year = y >= 1900 && y <= 2100 ? y : "";
  const genres = document.getElementById("book-genres").value
    .split(/[,;]/)
    .map(g => g.trim())
    .filter(Boolean);
  const list = document.getElementById("book-list").value;
  const rating = newRating;
  const file = document.getElementById("book-cover").files[0];

  if (!title) {
    showBookMsg("Please type a title first.");
    return;
  }

  function finish(cover) {
    const book = {
      id: Date.now(), title, author, country, format, year, genres, rating, list, cover
    };
    books.push(book);
    if (!save("myBooks", books)) {
      books.pop();
      return;
    }
    renderBook(book);
    ["book-title", "book-author", "book-country", "book-year", "book-genres", "book-cover"]
      .forEach(id => { document.getElementById(id).value = ""; });
    document.getElementById("book-format").value = "";
    setStars(0);
    libRefreshAll();
    showBookMsg("Added \"" + title + "\" to " + LIST_NAMES[list] + "!");
  }

  if (file) {
    resizeImage(file, finish);
  } else {
    finish("");
  }
}

/* ---------- Image shrinking (keeps storage small) ---------- */
function resizeImage(file, callback) {
  const reader = new FileReader();
  reader.onload = function () {
    const img = new Image();
    img.onload = function () {
      const max = 600;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const canvas = document.createElement("canvas");
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      callback(canvas.toDataURL("image/jpeg", 0.7));
    };
    img.src = reader.result;
  };
  reader.readAsDataURL(file);
}

/* ---------- Diary ---------- */
let diary = load("myDiary");

function renderEntry(entry) {
  const box = document.createElement("article");
  box.className = "entry";

  const when = new Date(entry.time);
  const meta = document.createElement("div");
  meta.className = "entry-date";
  meta.textContent =
    when.toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    }) + " · " +
    when.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  const title = document.createElement("h3");
  title.textContent = (entry.mood ? entry.mood + "  " : "") + (entry.title || "Untitled");

  const body = document.createElement("div");
  body.className = "entry-text";
  body.textContent = entry.text;

  const del = document.createElement("button");
  del.className = "delete-btn";
  del.textContent = "Delete";
  del.onclick = function () {
    if (!confirm("Delete this entry?")) return;
    diary = diary.filter(e => e.id !== entry.id);
    save("myDiary", diary);
    box.remove();
  };

  box.append(meta, title, body, del);
  document.getElementById("diary-list").prepend(box);
}

function addEntry() {
  const title = document.getElementById("diary-title").value.trim();
  const mood = document.getElementById("diary-mood").value;
  const text = document.getElementById("diary-text").value.trim();
  if (!text) return;

  const now = new Date();
  const entry = { id: now.getTime(), time: now.toISOString(), title, mood, text };

  diary.push(entry);
  if (!save("myDiary", diary)) {
    diary.pop();
    return;
  }
  renderEntry(entry);

  document.getElementById("diary-title").value = "";
  document.getElementById("diary-mood").value = "";
  document.getElementById("diary-text").value = "";
}

/* ---------- Photo album ---------- */
let photos = load("myPhotos");
let currentAlbum = "all";

function renderPhoto(photo) {
  const fig = document.createElement("figure");
  fig.className = "photo";
  fig.dataset.album = photo.album;

  const img = document.createElement("img");
  img.src = photo.src;
  img.alt = photo.caption || "Photo";

  const cap = document.createElement("figcaption");
  cap.textContent = photo.caption;

  const del = document.createElement("button");
  del.className = "delete-btn";
  del.textContent = "Remove";
  del.onclick = function () {
    photos = photos.filter(p => p.id !== photo.id);
    save("myPhotos", photos);
    fig.remove();
  };

  fig.append(img, cap, del);
  document.getElementById("photo-grid").prepend(fig);
  applyAlbumFilter();
}

function addPhotos() {
  const input = document.getElementById("photo-files");
  const caption = document.getElementById("photo-caption").value.trim();
  const album = document.getElementById("photo-album").value;
  const files = Array.from(input.files);
  if (files.length === 0) return;

  files.forEach(function (file) {
    resizeImage(file, function (src) {
      const photo = { id: Date.now() + Math.random(), src, caption, album };
      photos.push(photo);
      if (!save("myPhotos", photos)) {
        photos.pop();
        return;
      }
      renderPhoto(photo);
    });
  });

  input.value = "";
  document.getElementById("photo-caption").value = "";
}

function showAlbum(name) {
  currentAlbum = name;
  applyAlbumFilter();
}

function applyAlbumFilter() {
  document.querySelectorAll(".photo").forEach(function (el) {
    el.style.display =
      currentAlbum === "all" || el.dataset.album === currentAlbum ? "" : "none";
  });
}

/* ---------- Library (books-data.js plus the books you add) ---------- */
// Row: [0 title, 1 author, 2 country, 3 format, 4 year, 5 status, 6 genres, 7 rating,
//       8 reading list (only for books you add), 9 your rating out of 5]
const PAGE_SIZE = 50;
let libAll = [];
let libResults = [];
let libShown = 0;

function allRows() {
  const mine = books.slice().reverse().map(function (b) {
    return [b.title, b.author || "", b.country || "", b.format || "",
            b.year ? String(b.year) : "", "", b.genres || [], "",
            LIST_NAMES[b.list] || "", b.rating || 0];
  });
  return mine.concat(LIBRARY);
}

function libSetup() {
  ["lib-search", "lib-genre", "lib-format", "lib-sort"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", libRefresh);
  });

  // the 12 most recent from your spreadsheet in the Already Read section
  LIBRARY.slice(0, 12).forEach(function (b) {
    const card = document.createElement("div");
    card.className = "book text-book";
    const t = document.createElement("h3");
    t.textContent = b[0];
    card.append(t);
    if (b[3]) {
      const p = document.createElement("p");
      p.className = "author";
      p.textContent = b[3] + (b[4] ? " · " + b[4] : "");
      card.append(p);
    }
    document.getElementById("already-grid").append(card);
  });

  libRefreshAll();
}

function libBuildMenus() {
  const genreSel = document.getElementById("lib-genre");
  const formatSel = document.getElementById("lib-format");
  const keepGenre = genreSel.value;
  const keepFormat = formatSel.value;
  genreSel.length = 1;
  formatSel.length = 1;

  const genreCount = {};
  const formats = new Set();
  libAll.forEach(function (b) {
    b[6].forEach(function (g) { genreCount[g] = (genreCount[g] || 0) + 1; });
    if (b[3]) formats.add(b[3]);
  });
  Object.keys(genreCount)
    .sort((a, b) => genreCount[b] - genreCount[a])
    .slice(0, 40)
    .forEach(function (g) {
      const o = document.createElement("option");
      o.value = g;
      o.textContent = g + " (" + genreCount[g] + ")";
      genreSel.append(o);
    });
  Array.from(formats).sort().forEach(function (f) {
    const o = document.createElement("option");
    o.value = f;
    o.textContent = f;
    formatSel.append(o);
  });

  genreSel.value = keepGenre;
  formatSel.value = keepFormat;
}

function libRefreshAll() {
  libAll = allRows();
  const total = libAll.length.toLocaleString();
  document.getElementById("lib-intro").textContent =
    total + " books. Every book from your spreadsheet is marked Already Read.";
  document.getElementById("already-intro").textContent =
    "Your 12 most recent are shown here. All " + total + " books are in the Library.";
  libBuildMenus();
  libRefresh();
}

function libRefresh() {
  const q = document.getElementById("lib-search").value.trim().toLowerCase();
  const genre = document.getElementById("lib-genre").value;
  const format = document.getElementById("lib-format").value;
  const sort = document.getElementById("lib-sort").value;

  libResults = libAll.filter(function (b) {
    if (q && !(b[0].toLowerCase().includes(q) || b[1].toLowerCase().includes(q))) return false;
    if (genre && !b[6].includes(genre)) return false;
    if (format && b[3] !== format) return false;
    return true;
  });

  if (sort === "az") libResults.sort((a, b) => a[0].localeCompare(b[0]));
  if (sort === "za") libResults.sort((a, b) => b[0].localeCompare(a[0]));

  document.getElementById("lib-list").textContent = "";
  libShown = 0;
  libMore();
}

function libMore() {
  const list = document.getElementById("lib-list");
  const next = libResults.slice(libShown, libShown + PAGE_SIZE);

  next.forEach(function (b) {
    const row = document.createElement("div");
    row.className = "lib-row";

    const title = document.createElement("div");
    title.className = "lib-title";
    title.textContent = b[0];
    row.append(title);

    const bits = [b[1], b[3], b[2], b[4], b[5]].filter(Boolean);
    if (b[8] && b[8] !== "Already Read") bits.push(b[8]);
    if (b[9]) bits.push("★ " + b[9] + "/5");
    else if (b[7]) bits.push("★ " + b[7]);
    if (bits.length) {
      const meta = document.createElement("div");
      meta.className = "lib-meta";
      meta.textContent = bits.join(" · ");
      row.append(meta);
    }

    if (b[6].length) {
      const chips = document.createElement("div");
      chips.className = "chips";
      b[6].slice(0, 5).forEach(function (g) {
        const chip = document.createElement("span");
        chip.className = "chip";
        chip.textContent = g;
        chips.append(chip);
      });
      row.append(chips);
    }

    list.append(row);
  });

  libShown += next.length;
  document.getElementById("lib-count").textContent =
    libResults.length === 0
      ? "No books match. Try a different search or filter."
      : "Showing " + libShown.toLocaleString() + " of " + libResults.length.toLocaleString();
  document.getElementById("lib-more").style.display =
    libShown < libResults.length ? "" : "none";
}

/* ---------- Homepage extras ---------- */
function pickRandom() {
  const titles = Array.from(document.querySelectorAll("#want-grid .book h3"))
    .map(h => h.textContent);
  const result = document.getElementById("random-result");
  if (titles.length === 0) {
    result.textContent = "Your Want to Read list is empty. Add some books first!";
    return;
  }
  result.textContent =
    "How about: " + titles[Math.floor(Math.random() * titles.length)] + " ✨";
}

function updateHome() {
  const now = new Date();
  document.getElementById("clock").textContent =
    now.toLocaleDateString(undefined, {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    }) + " · " + now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

  document.getElementById("stat-books").textContent =
    (LIBRARY.length + books.length).toLocaleString();
  document.getElementById("stat-diary").textContent = diary.length;
  document.getElementById("stat-photos").textContent = photos.length;

  const box = document.getElementById("latest-entry");
  if (diary.length > 0) {
    const last = diary[diary.length - 1];
    const text = last.text.length > 120 ? last.text.slice(0, 120) + "..." : last.text;
    box.textContent = (last.title ? last.title + ": " : "") + text;
  } else {
    box.textContent = "No entries yet.";
  }
}

/* ---------- Start everything when the page opens ---------- */
books.forEach(renderBook);
diary.forEach(renderEntry);
photos.forEach(renderPhoto);
document.querySelectorAll("#star-picker button").forEach(function (b) {
  b.addEventListener("click", function () {
    const v = Number(b.dataset.v);
    setStars(newRating === v ? 0 : v);
  });
});
libSetup();
updateHome();
setInterval(updateHome, 1000);
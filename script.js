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

/* ---------- Covers ---------- */
// Order of preference for a book's cover:
// 1) a link you set with "Change cover"  2) the cover you gave when adding the book
// 3) covers-data.js (made by the Find covers tool)  4) results the tool found in this browser
// 5) a coloured placeholder
function own(obj, key) {
  return Object.prototype.hasOwnProperty.call(obj, key);
}

function loadObj(key) {
  try {
    const v = JSON.parse(localStorage.getItem(key));
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch (e) {
    return {};
  }
}

function normTitle(t) {
  return String(t).toLowerCase().replace(/[^\p{L}\p{N}]+/gu, "");
}

let myCovers = loadObj("myCovers");        // your own fixes: normalised title -> link
let coverFinds = loadObj("coverFinds");    // what Find covers found: normalised title -> {u, m, x}

// only normal web links, or a picture saved by the Add Book form
function safeImage(u) {
  if (typeof u !== "string" || !u) return "";
  if (/^data:image\/(png|jpe?g|webp|gif);base64,/i.test(u)) return u;
  return safeLink(u);
}

function coverFor(title, ownCover) {
  const k = normTitle(title);
  if (own(myCovers, k) && myCovers[k]) return myCovers[k];
  if (ownCover) return ownCover;
  if (typeof COVERS !== "undefined" && own(COVERS, k) && COVERS[k]) return COVERS[k];
  if (own(coverFinds, k) && coverFinds[k] && typeof coverFinds[k].u === "string") return coverFinds[k].u;
  return "";
}

// a cover picture, or a coloured card with the first letter if there isn't one
function coverBox(title, ownCover, extraClass) {
  const box = document.createElement("div");
  box.className = "cover" + (extraClass ? " " + extraClass : "");
  const url = safeImage(coverFor(title, ownCover));

  function placeholder() {
    box.textContent = "";
    box.classList.add("cover-ph");
    let hue = 0;
    for (const ch of String(title)) hue = (hue * 31 + ch.charCodeAt(0)) % 360;
    box.style.background =
      "linear-gradient(135deg, hsl(" + hue + " 85% 85%), hsl(" + ((hue + 45) % 360) + " 85% 76%))";
    const letter = document.createElement("span");
    letter.textContent = (String(title).trim().charAt(0) || "📖").toUpperCase();
    box.append(letter);
  }

  if (url) {
    const img = document.createElement("img");
    img.src = url;
    img.alt = "Cover of " + title;
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.onerror = placeholder;
    box.append(img);
  } else {
    placeholder();
  }
  return box;
}

// the "Change cover" button on a Library row
function changeCover(title) {
  const k = normTitle(title);
  const current = own(myCovers, k) ? myCovers[k] : "";
  const answer = prompt(
    "Paste a picture link for this cover.\nLeave it empty to go back to the automatic cover.",
    current
  );
  if (answer === null) return null;
  const url = answer.trim();
  if (url && !safeLink(url)) {
    alert("That link doesn't look right. It should start with https://");
    return null;
  }
  if (url) myCovers[k] = url;
  else delete myCovers[k];
  try {
    localStorage.setItem("myCovers", JSON.stringify(myCovers));
  } catch (e) {
    alert("Storage is full, so this change couldn't be saved.");
  }
  renderAllShelves();
  return coverBox(title, "", "lib-thumb");
}

/* ---------- Find covers tool (in My tools) ---------- */
const COVER_API = "https://graphql.anilist.co";
const COVER_QUERY =
  "query ($q: String) { Page(perPage: 6) { media(search: $q, type: MANGA) " +
  "{ title { romaji english native } synonyms coverImage { large } } } }";
let coverDelay = 800;          // pause between lookups (stays under about 90 a minute)
let coverRunning = false;
let coverStop = false;

function sleep(ms) {
  return new Promise(function (resolve) { setTimeout(resolve, ms); });
}

function wordsOf(s) {
  return String(s).toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
}

// 1 = same title, 0 = nothing in common
function titleScore(a, b) {
  const A = wordsOf(a);
  const B = wordsOf(b);
  if (!A.length || !B.length) return 0;
  if (A.join("") === B.join("")) return 1;
  const setA = new Set(A);
  const setB = new Set(B);
  let hit = 0;
  setA.forEach(function (w) { if (setB.has(w)) hit++; });
  return (2 * hit) / (setA.size + setB.size);
}

function pickCover(title, media) {
  let best = null;
  media.forEach(function (m) {
    if (!m || !m.coverImage || !m.coverImage.large) return;
    const t = m.title || {};
    const names = [t.romaji, t.english, t.native].concat(m.synonyms || []).filter(Boolean);
    let score = 0;
    let matched = "";
    names.forEach(function (n) {
      const s = titleScore(title, n);
      if (s > score) { score = s; matched = n; }
    });
    if (!best || score > best.score) best = { score: score, matched: matched, u: m.coverImage.large };
  });
  if (best && best.score >= 0.6) return { u: best.u, m: best.matched, x: best.score === 1 };
  return { u: "", m: "", x: false };
}

async function anilistSearch(q) {
  const res = await fetch(COVER_API, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Accept": "application/json" },
    body: JSON.stringify({ query: COVER_QUERY, variables: { q: q } })
  });
  if (res.status === 429) {
    const err = new Error("slow down");
    err.wait = Number(res.headers.get("Retry-After")) || 60;
    throw err;
  }
  if (!res.ok) throw new Error("HTTP " + res.status);
  const json = await res.json();
  if (json.errors) throw new Error("AniList reported an error");
  return (json.data && json.data.Page && json.data.Page.media) || [];
}

function coverTodo() {
  const todo = [];
  const seen = new Set();
  allRows().forEach(function (b) {
    const k = normTitle(b[0]);
    if (!k || seen.has(k)) return;
    seen.add(k);
    if (b[10] || own(myCovers, k) || own(coverFinds, k)) return;
    if (typeof COVERS !== "undefined" && own(COVERS, k)) return;
    todo.push({ k: k, title: b[0] });
  });
  return todo;
}

function updateCoverProgress() {
  const box = document.getElementById("cover-progress");
  if (!box) return;
  const keys = Object.keys(coverFinds);
  const found = keys.filter(k => coverFinds[k] && coverFinds[k].u);
  const exact = found.filter(k => coverFinds[k].x).length;
  const fileCount = typeof COVERS !== "undefined" ? Object.keys(COVERS).length : 0;
  box.textContent =
    "Looked up " + keys.length.toLocaleString() + " · found " + found.length.toLocaleString() +
    " (" + exact.toLocaleString() + " exact, " + (found.length - exact).toLocaleString() +
    " close) · not found " + (keys.length - found.length).toLocaleString() +
    " · still to look up " + coverTodo().length.toLocaleString() +
    " · saved in covers-data.js " + fileCount.toLocaleString();
}

function saveCoverFinds() {
  try {
    localStorage.setItem("coverFinds", JSON.stringify(coverFinds));
    return true;
  } catch (e) {
    return false;
  }
}

async function findCovers() {
  if (coverRunning) return;
  const msg = document.getElementById("cover-msg");
  const startBtn = document.getElementById("cover-start");
  const stopBtn = document.getElementById("cover-stop");
  const todo = coverTodo();

  if (todo.length === 0) {
    msg.textContent = "Nothing left to look up. Download covers-data.js to keep what was found.";
    return;
  }

  coverRunning = true;
  coverStop = false;
  startBtn.hidden = true;
  stopBtn.hidden = false;
  msg.textContent = "Working... keep this tab open. You can stop and carry on later.";

  let i = 0;
  let errors = 0;
  while (i < todo.length && !coverStop) {
    const item = todo[i];
    try {
      const media = await anilistSearch(item.title);
      coverFinds[item.k] = pickCover(item.title, media);
      errors = 0;
      i++;
      if (i % 10 === 0) {
        if (!saveCoverFinds()) {
          msg.textContent = "This browser's storage is full, so I stopped. Download covers-data.js now.";
          break;
        }
        updateCoverProgress();
      }
    } catch (e) {
      if (e.wait) {
        msg.textContent = "AniList asked us to slow down. Waiting " + e.wait + " seconds...";
        await sleep(e.wait * 1000);
        msg.textContent = "Working... keep this tab open. You can stop and carry on later.";
        continue;
      }
      errors++;
      if (errors >= 3) {
        msg.textContent = "Couldn't reach AniList (" + e.message +
          "). Check your internet connection and try again.";
        break;
      }
      await sleep(2000);
      continue;
    }
    await sleep(coverDelay);
  }

  saveCoverFinds();
  updateCoverProgress();
  if (i >= todo.length) {
    msg.textContent = "Finished! Click Download covers-data.js and save it in your website folder.";
  } else if (coverStop) {
    msg.textContent = "Stopped. Click Find covers again to carry on where it left off.";
  }
  coverRunning = false;
  startBtn.hidden = false;
  stopBtn.hidden = true;
  renderAllShelves();
  libRefresh();
}

function stopCovers() {
  coverStop = true;
}

function downloadCoversFile() {
  const out = {};
  if (typeof COVERS !== "undefined") Object.keys(COVERS).forEach(k => { out[k] = COVERS[k]; });
  Object.keys(coverFinds).forEach(function (k) {
    if (coverFinds[k] && coverFinds[k].u) out[k] = coverFinds[k].u;
  });
  Object.keys(myCovers).forEach(k => { out[k] = myCovers[k]; });   // your own fixes win

  const lines = Object.keys(out).sort()
    .map(k => "  " + JSON.stringify(k) + ": " + JSON.stringify(out[k]));
  const text =
    "// Covers found by the Find covers tool, plus your own fixes.\n" +
    "// Each line: \"title with only letters and numbers\": \"picture link\"\n" +
    "const COVERS = {\n" + lines.join(",\n") + "\n};\n";

  const blob = new Blob([text], { type: "text/javascript" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "covers-data.js";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  document.getElementById("cover-msg").textContent =
    "Downloaded covers-data.js with " + lines.length.toLocaleString() +
    " covers. Save it in your website folder, replacing the old covers-data.js.";
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

function buildBookCard(book) {
  const card = document.createElement("div");
  card.className = "book";

  card.append(coverBox(book.title, book.cover));

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

  return card;
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
  const coverUrl = document.getElementById("book-cover-url").value.trim();

  if (!title) {
    showBookMsg("Please type a title first.");
    return;
  }

  // check the image link
  if (!file && coverUrl) {
    try {
      const url = new URL(coverUrl);
      if (!["http:", "https:"].includes(url.protocol)) {
        throw new Error("Invalid URL");
      }
    } catch (e) {
      showBookMsg("Please enter a valid image link.");
      return;
    }
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

    [
      "book-title", "book-author", "book-country",
      "book-year", "book-genres", "book-cover", "book-cover-url"
    ].forEach(id => {
      document.getElementById(id).value = "";
    });

    document.getElementById("book-format").value = "";
    setStars(0);
    libRefreshAll();
    gardenChanged();
    showBookMsg("Added \"" + title + "\" to " + LIST_NAMES[list] + "!");
  }

  if (file) {
    resizeImage(file, finish);
  } else {
    finish(coverUrl);
  }
}

function bookLine(b) {
  return JSON.stringify([
    b.title, b.author || "", b.country || "", b.format || "",
    b.year ? String(b.year) : "", "", b.genres || [], "",
    LIST_NAMES[b.list] || "", b.rating || 0,
    /^https?:\/\//i.test(b.cover || "") ? b.cover : ""
  ]) + ",";
}

function copyBookLines() {
  const box = document.getElementById("book-lines");
  const msg = document.getElementById("book-copy-msg");

  if (books.length === 0) {
    box.value = "";
    msg.textContent = "You haven't added any books with the form yet.";
    return;
  }

  box.value = books.slice().reverse().map(bookLine).join("\n");
  const howTo = " Paste them into books-data.js right below the line that says const LIBRARY = [ (cover links are included, uploaded pictures are not).";

  function manual() {
    box.select();
    msg.textContent = "Press Ctrl+C to copy the lines above." + howTo;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(box.value).then(function () {
      msg.textContent = "Copied!" + howTo;
    }, manual);
  } else {
    manual();
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
  gardenChanged();

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
      gardenChanged();
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
//       8 reading list, 9 your rating out of 5, 10 cover link]
const PAGE_SIZE = 50;
let libAll = [];
let libResults = [];
let libShown = 0;

function allRows() {
  const mine = books.slice().reverse().map(function (b) {
    return [b.title, b.author || "", b.country || "", b.format || "",
            b.year ? String(b.year) : "", "", b.genres || [], "",
            LIST_NAMES[b.list] || "", b.rating || 0, b.cover || ""];
  });
  return mine.concat(LIBRARY);
}

// a simple card for books that come from books-data.js
function textBookCard(b) {
  const card = document.createElement("div");
  card.className = "book text-book";
  card.append(coverBox(b[0], b[10]));
  const t = document.createElement("h3");
  t.textContent = b[0];
  card.append(t);
  const bits = [b[1], b[3], b[4]].filter(Boolean);
  if (bits.length) {
    const p = document.createElement("p");
    p.className = "author";
    p.textContent = bits.join(" · ");
    card.append(p);
  }
  if (b[9]) {
    const stars = document.createElement("p");
    stars.className = "stars";
    stars.textContent = starText(b[9]);
    card.append(stars);
  }
  return card;
}

/* ---------- Reading list sections (12 at a time, with Show more) ---------- */
const SHELF_STEP = 12;
const shelfShown = {
  "want-grid": SHELF_STEP,
  "current-grid": SHELF_STEP,
  "already-grid": SHELF_STEP
};

function shelfItems(id) {
  const label = LIST_NAMES[id];
  const mine = books.filter(b => b.list === id).reverse()
    .map(b => ({ mine: true, book: b }));
  const fromFile = LIBRARY
    .filter(b => b[8] === label || (id === "already-grid" && !b[8]))
    .map(b => ({ mine: false, row: b }));
  return mine.concat(fromFile);
}

function renderShelf(id) {
  const grid = document.getElementById(id);
  const key = id.replace("-grid", "");
  const items = shelfItems(id);
  const shown = Math.min(shelfShown[id], items.length);

  grid.textContent = "";
  items.slice(0, shown).forEach(function (it) {
    grid.append(it.mine ? buildBookCard(it.book) : textBookCard(it.row));
  });

  let intro;
  if (items.length === 0) {
    intro = "Nothing here yet. Add a book from the Library menu.";
  } else if (shown < items.length) {
    intro = "Your " + shown + " most recent are shown here (of " +
      items.length.toLocaleString() + ").";
  } else {
    intro = "All " + items.length.toLocaleString() + " are shown here.";
  }
  document.getElementById(key + "-intro").textContent =
    intro + " All " + libAll.length.toLocaleString() + " books are in the Library.";
  document.getElementById(key + "-more").style.display =
    shown < items.length ? "" : "none";
}

function shelfMore(id) {
  shelfShown[id] += SHELF_STEP;
  renderShelf(id);
}

function renderAllShelves() {
  Object.keys(shelfShown).forEach(renderShelf);
}

function libSetup() {
  ["lib-search", "lib-genre", "lib-format", "lib-sort"].forEach(function (id) {
    document.getElementById(id).addEventListener("input", libRefresh);
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
    total + " books in total. Books without a label count as Already Read.";
  renderAllShelves();
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

    let thumb = coverBox(b[0], b[10], "lib-thumb");
    row.append(thumb);

    const body = document.createElement("div");
    body.className = "lib-body";

    const title = document.createElement("div");
    title.className = "lib-title";
    title.textContent = b[0];
    body.append(title);

    const bits = [b[1], b[3], b[2], b[4], b[5]].filter(Boolean);
    if (b[8] && b[8] !== "Already Read") bits.push(b[8]);
    if (b[9]) bits.push("★ " + b[9] + "/5");
    else if (b[7]) bits.push("★ " + b[7]);
    if (bits.length) {
      const meta = document.createElement("div");
      meta.className = "lib-meta";
      meta.textContent = bits.join(" · ");
      body.append(meta);
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
      body.append(chips);
    }

    const change = document.createElement("button");
    change.className = "mini-btn";
    change.textContent = "🖼 Change cover";
    change.onclick = function () {
      const fresh = changeCover(b[0]);
      if (fresh) {
        thumb.replaceWith(fresh);
        thumb = fresh;
      }
    };
    body.append(change);

    row.append(body);
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

/* ---------- Song gallery (songs-data.js plus the songs you add) ---------- */
let mySongs = load("mySongs");
let galleryView = "all";

function allSongs() {
  const mine = mySongs.slice().reverse().map(function (s) {
    return { id: s.id, title: s.title, artist: s.artist || "", link: s.link || "",
             playlist: s.playlist || "", mine: true };
  });
  const base = (typeof SONGS !== "undefined" ? SONGS : []).map(function (r) {
    return { title: r[0], artist: r[1] || "", link: r[2] || "", playlist: r[3] || "", mine: false };
  });
  return mine.concat(base);
}

// only allow normal web links
function safeLink(link) {
  try {
    const u = new URL(link);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : "";
  } catch (e) {
    return "";
  }
}

// finds the video id in a YouTube link, so the cover can be shown
function youtubeId(link) {
  try {
    const u = new URL(link);
    const host = u.hostname.replace(/^www\./, "");
    let id = "";
    if (host === "youtu.be") id = u.pathname.slice(1).split("/")[0];
    else if (host.endsWith("youtube.com")) {
      if (u.pathname === "/watch") id = u.searchParams.get("v") || "";
      else {
        const m = u.pathname.match(/^\/(shorts|embed|live)\/([\w-]+)/);
        if (m) id = m[2];
      }
    }
    return /^[\w-]{11}$/.test(id) ? id : "";
  } catch (e) {
    return "";
  }
}

function songCard(song) {
  const card = document.createElement("div");
  card.className = "song-card";

  const cover = document.createElement("div");
  cover.className = "song-cover";
  const id = youtubeId(song.link);
  function placeholder() {
    cover.textContent = "🎵";
  }
  if (id && document.getElementById("gal-covers").checked) {
    const img = document.createElement("img");
    img.src = "https://img.youtube.com/vi/" + id + "/mqdefault.jpg";
    img.alt = "Cover of " + song.title;
    img.loading = "lazy";
    img.onerror = function () { img.remove(); placeholder(); };
    cover.append(img);
  } else {
    placeholder();
  }
  card.append(cover);

  const title = document.createElement("div");
  title.className = "song-title";
  title.textContent = song.title;
  card.append(title);

  if (song.artist) {
    const artist = document.createElement("div");
    artist.className = "song-artist";
    artist.textContent = song.artist;
    card.append(artist);
  }

  if (song.playlist) {
    const chips = document.createElement("div");
    chips.className = "chips";
    const chip = document.createElement("span");
    chip.className = "chip";
    chip.textContent = song.playlist;
    chips.append(chip);
    card.append(chips);
  }

  const url = safeLink(song.link);
  if (url) {
    const open = document.createElement("a");
    open.className = "open-btn";
    open.href = url;
    open.target = "_blank";
    open.rel = "noopener noreferrer";
    open.textContent = "▶ Open on YouTube";
    card.append(open);
  }

  if (song.mine) {
    const del = document.createElement("button");
    del.className = "delete-btn";
    del.textContent = "Remove";
    del.onclick = function () {
      mySongs = mySongs.filter(x => x.id !== song.id);
      save("mySongs", mySongs);
      galleryRender();
    };
    card.append(del);
  }

  return card;
}

function songGrid(list) {
  const grid = document.createElement("div");
  grid.className = "song-grid";
  list.forEach(s => grid.append(songCard(s)));
  return grid;
}

function galleryRender() {
  const q = document.getElementById("gal-search").value.trim().toLowerCase();
  const everything = allSongs();
  const songs = everything.filter(function (s) {
    return !q || (s.title + " " + s.artist + " " + s.playlist).toLowerCase().includes(q);
  });
  const box = document.getElementById("gal-content");
  box.textContent = "";

  document.querySelectorAll(".gal-tab").forEach(function (b) {
    b.classList.toggle("active", b.dataset.view === galleryView);
  });
  document.getElementById("gal-count").textContent =
    songs.length + (songs.length === 1 ? " song" : " songs");

  // suggestions for the playlist box
  const names = new Set();
  everything.forEach(s => { if (s.playlist) names.add(s.playlist); });
  const dl = document.getElementById("playlist-options");
  dl.textContent = "";
  names.forEach(function (n) {
    const o = document.createElement("option");
    o.value = n;
    dl.append(o);
  });

  if (songs.length === 0) {
    box.textContent = q ? "No songs match your search." : "No songs yet. Add one below!";
    return;
  }

  if (galleryView === "all") {
    box.append(songGrid(songs));
    return;
  }

  const key = galleryView === "artist" ? "artist" : "playlist";
  const emptyName = galleryView === "artist" ? "Unknown artist" : "No playlist";
  const links = typeof PLAYLIST_LINKS !== "undefined" ? PLAYLIST_LINKS : {};
  const groups = Object.create(null);
  songs.forEach(function (s) {
    const k = s[key];
    (groups[k] = groups[k] || []).push(s);
  });

  Object.keys(groups)
    .sort((a, b) => (a === "" ? 1 : b === "" ? -1 : a.localeCompare(b)))
    .forEach(function (k) {
      const head = document.createElement("div");
      head.className = "gal-group-head";
      const h = document.createElement("h3");
      h.textContent = (k || emptyName) + " (" + groups[k].length + ")";
      head.append(h);

      const pl = galleryView === "playlist" && k ? safeLink(links[k] || "") : "";
      if (pl) {
        const a = document.createElement("a");
        a.className = "open-btn";
        a.href = pl;
        a.target = "_blank";
        a.rel = "noopener noreferrer";
        a.textContent = "▶ Open playlist on YouTube";
        head.append(a);
      }

      box.append(head, songGrid(groups[k]));
    });
}

function addSong() {
  const msg = document.getElementById("song-msg");
  const title = document.getElementById("song-title").value.trim();
  const artist = document.getElementById("song-artist").value.trim();
  let link = document.getElementById("song-link").value.trim();
  const playlist = document.getElementById("song-playlist").value.trim();

  if (!title) {
    msg.textContent = "Please type a title first.";
    return;
  }
  if (link && !/^https?:\/\//i.test(link)) link = "https://" + link;
  if (link && !safeLink(link)) {
    msg.textContent = "That link doesn't look right. Try copying it again from YouTube.";
    return;
  }

  const song = { id: Date.now(), title, artist, link, playlist };
  mySongs.push(song);
  if (!save("mySongs", mySongs)) {
    mySongs.pop();
    return;
  }

  ["song-title", "song-artist", "song-link", "song-playlist"]
    .forEach(id => { document.getElementById(id).value = ""; });
  msg.textContent = "Added \"" + title + "\"!";
  galleryRender();
  gardenChanged();
}

function songLine(s) {
  return "  " + JSON.stringify([s.title, s.artist || "", s.link || "", s.playlist || ""]) + ",";
}

function copySongLines() {
  const box = document.getElementById("song-lines");
  const msg = document.getElementById("copy-msg");

  if (mySongs.length === 0) {
    box.value = "";
    msg.textContent = "You haven't added any songs with the form yet.";
    return;
  }

  box.value = mySongs.map(songLine).join("\n");
  const howTo = " Paste them into songs-data.js right below the line that says const SONGS = [";

  function manual() {
    box.select();
    msg.textContent = "Press Ctrl+C to copy the lines above." + howTo;
  }

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(box.value).then(function () {
      msg.textContent = "Copied!" + howTo;
    }, manual);
  } else {
    manual();
  }
}

function showGalleryTab(name) {
  document.querySelectorAll(".gpanel").forEach(function (p) {
    p.hidden = p.id !== "panel-" + name;
  });
  document.querySelectorAll(".gtab").forEach(function (b) {
    b.classList.toggle("active", b.dataset.tab === name);
  });
  try { localStorage.setItem("galleryTab", name); } catch (e) {}
}

function galleryTabsSetup() {
  const tabs = document.querySelectorAll(".gtab");
  if (tabs.length === 0) return;
  tabs.forEach(function (b) {
    b.addEventListener("click", function () { showGalleryTab(b.dataset.tab); });
  });
  let last = "songs";
  try { last = localStorage.getItem("galleryTab") || "songs"; } catch (e) {}
  if (!document.getElementById("panel-" + last)) last = "songs";
  showGalleryTab(last);
}

function gallerySetup() {
  let covers = "1";
  try { covers = localStorage.getItem("showCovers") || "1"; } catch (e) {}
  document.getElementById("gal-covers").checked = covers !== "0";

  document.querySelectorAll(".gal-tab").forEach(function (b) {
    b.addEventListener("click", function () {
      galleryView = b.dataset.view;
      galleryRender();
    });
  });
  document.getElementById("gal-search").addEventListener("input", galleryRender);
  document.getElementById("gal-covers").addEventListener("change", function () {
    try { localStorage.setItem("showCovers", this.checked ? "1" : "0"); } catch (e) {}
    galleryRender();
  });

  galleryRender();
}

/* ---------- Homepage extras ---------- */
let luckyTimer = null;

function luckyPick() {
  const pool = libAll.length ? libAll : allRows();
  const result = document.getElementById("random-result");
  const btn = document.getElementById("lucky-btn");
  if (pool.length === 0) {
    result.textContent = "Your Library is empty. Add some books first!";
    return;
  }

  clearInterval(luckyTimer);
  const calm = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const spins = calm ? 0 : 14;       // how many titles flash by before the pick
  let ticks = 0;

  btn.disabled = true;
  result.className = "home-result shuffling";

  function land() {
    clearInterval(luckyTimer);
    showLucky(pool[Math.floor(Math.random() * pool.length)]);
    btn.disabled = false;
    btn.textContent = "Draw again";
  }

  if (spins === 0) {
    land();
    return;
  }

  luckyTimer = setInterval(function () {
    result.textContent = pool[Math.floor(Math.random() * pool.length)][0];
    ticks++;
    if (ticks >= spins) land();
  }, 90);
}

function showLucky(b) {
  const result = document.getElementById("random-result");
  result.className = "home-result lucky-result";
  result.textContent = "";
  result.append(coverBox(b[0], b[10], "lucky-cover"));

  const title = document.createElement("div");
  title.className = "lucky-title";
  title.textContent = "🍀 " + b[0];
  result.append(title);

  const bits = [b[1], b[3], b[2], b[4]].filter(Boolean);
  if (bits.length) {
    const meta = document.createElement("div");
    meta.className = "lib-meta";
    meta.textContent = bits.join(" · ");
    result.append(meta);
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
    result.append(chips);
  }

  const find = document.createElement("button");
  find.className = "find-btn";
  find.textContent = "Find in Library";
  find.onclick = function () {
    document.getElementById("lib-search").value = b[0];
    libRefresh();
    location.hash = "#library";
  };
  result.append(find);
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

/* ---------- Backup and restore ---------- */
const BACKUP_KEYS = ["myBooks", "myDiary", "myPhotos", "mySongs"];
const BACKUP_OBJECT_KEYS = ["myCovers", "coverFinds", "myGarden"];

function showBackupMsg(text) {
  document.getElementById("backup-msg").textContent = text;
}

function updateBackupInfo() {
  const box = document.getElementById("backup-info");
  if (!box) return;
  let last = "";
  try { last = localStorage.getItem("lastBackup") || ""; } catch (e) {}
  box.textContent = last
    ? "Last backup: " + new Date(last).toLocaleString()
    : "You haven't made a backup yet.";
}

function downloadBackup() {
  const data = {};
  BACKUP_KEYS.forEach(function (k) { data[k] = load(k); });
  BACKUP_OBJECT_KEYS.forEach(function (k) { data[k] = loadObj(k); });
  const file = {
    app: "my-little-world",
    version: 1,
    created: new Date().toISOString(),
    data: data
  };

  const blob = new Blob([JSON.stringify(file)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "my-little-world-backup-" + new Date().toISOString().slice(0, 10) + ".json";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);

  try { localStorage.setItem("lastBackup", new Date().toISOString()); } catch (e) {}
  showBackupMsg(
    "Backup downloaded: " + data.myDiary.length + " diary entries, " +
    data.myPhotos.length + " photos, " + data.myBooks.length + " books, " +
    data.mySongs.length + " songs. Keep the file somewhere safe, like Google Drive."
  );
  updateBackupInfo();
}

function restoreBackup(input) {
  const file = input.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = function () {
    try {
      const parsed = JSON.parse(reader.result);
      if (!parsed || parsed.app !== "my-little-world" ||
          typeof parsed.data !== "object" || parsed.data === null) {
        throw new Error("not a backup");
      }

      let added = 0;
      let ok = true;
      BACKUP_KEYS.forEach(function (k) {
        const incoming = Array.isArray(parsed.data[k]) ? parsed.data[k] : [];
        const current = load(k);
        const have = new Set(current.map(x => x && x.id));
        incoming.forEach(function (item) {
          if (!item || typeof item !== "object") return;
          if (item.id === undefined) item.id = Date.now() + Math.random();
          if (have.has(item.id)) return;      // keep what you already have
          current.push(item);
          have.add(item.id);
          added++;
        });
        if (!save(k, current)) ok = false;
      });

      BACKUP_OBJECT_KEYS.forEach(function (k) {
        const incoming = parsed.data[k];
        if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) return;
        const current = loadObj(k);
        Object.keys(incoming).forEach(function (key) {
          if (!own(current, key)) {
            current[key] = incoming[key];
            added++;
          }
        });
        if (!save(k, current)) ok = false;
      });

      if (!ok) {
        showBackupMsg("Some items didn't fit in this browser's storage, so the restore is incomplete.");
        return;
      }
      showBackupMsg(added + " items restored. Reloading...");
      setTimeout(function () { location.reload(); }, 900);
    } catch (e) {
      showBackupMsg("That file doesn't look like a backup from this site.");
    }
  };
  reader.readAsText(file);
  input.value = "";
}

/* ---------- Cozy settings (theme, floating hearts and sparkles, cursor) ---------- */
const COZY_CHOICES = {
  theme: ["pink", "lavender", "dark"],
  effect: ["hearts", "sparkles", "none"],
  cursor: ["on", "off"]
};
const cozy = { theme: "pink", effect: "hearts", cursor: "on" };
let fxTimer = null;
let lastTrail = 0;

function cozyLoad() {
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) cozy.effect = "none";
  try {
    const saved = JSON.parse(localStorage.getItem("cozy") || "{}");
    Object.keys(COZY_CHOICES).forEach(function (k) {
      if (COZY_CHOICES[k].includes(saved[k])) cozy[k] = saved[k];
    });
  } catch (e) {}
}

function fxAdd(el, seconds) {
  const layer = document.getElementById("fx-layer");
  layer.append(el);
  setTimeout(function () { el.remove(); }, seconds * 1000 + 300);
}

function floatHeart() {
  const h = document.createElement("span");
  const seconds = 9 + Math.random() * 7;
  h.className = "fx-heart";
  h.textContent = "♥";
  h.style.left = Math.random() * 96 + "vw";
  h.style.fontSize = 12 + Math.random() * 18 + "px";
  h.style.animationDuration = seconds + "s";
  h.style.setProperty("--drift", Math.round(Math.random() * 80 - 40) + "px");
  fxAdd(h, seconds);
}

function twinkle(x, y, small) {
  const st = document.createElement("span");
  const seconds = small ? 0.7 : 1.4 + Math.random() * 1.2;
  st.className = "fx-star";
  st.textContent = "✦";
  st.style.left = (x !== undefined ? x : Math.random() * 96 + "vw");
  st.style.top = (y !== undefined ? y : Math.random() * 92 + "vh");
  st.style.fontSize = (small ? 10 + Math.random() * 8 : 12 + Math.random() * 16) + "px";
  st.style.animationDuration = seconds + "s";
  fxAdd(st, seconds);
}

function startEffects() {
  clearInterval(fxTimer);
  fxTimer = null;
  document.getElementById("fx-layer").textContent = "";
  const layer = document.getElementById("fx-layer");

  if (cozy.effect === "hearts") {
    fxTimer = setInterval(function () {
      if (!document.hidden && layer.children.length < 16) floatHeart();
    }, 900);
  } else if (cozy.effect === "sparkles") {
    fxTimer = setInterval(function () {
      if (!document.hidden && layer.children.length < 24) twinkle();
    }, 450);
  }
}

function applyCozy() {
  document.documentElement.setAttribute("data-theme", cozy.theme);
  document.body.classList.toggle("cute-cursor", cozy.cursor === "on");
  document.querySelectorAll(".cozy-opts").forEach(function (group) {
    group.querySelectorAll("button").forEach(function (b) {
      b.classList.toggle("active", b.dataset.value === cozy[group.dataset.group]);
    });
  });
  startEffects();
  try { localStorage.setItem("cozy", JSON.stringify(cozy)); } catch (e) {}
}

function cozySetup() {
  const btn = document.getElementById("cozy-btn");
  const panel = document.getElementById("cozy-panel");
  if (!btn || !panel) return;

  cozyLoad();

  function setPanel(open) {
    panel.hidden = !open;
    btn.setAttribute("aria-expanded", String(open));
  }
  btn.addEventListener("click", function () { setPanel(panel.hidden); });
  document.addEventListener("click", function (e) {
    if (!panel.hidden && !panel.contains(e.target) && e.target !== btn) setPanel(false);
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") setPanel(false);
  });

  document.querySelectorAll(".cozy-opts button").forEach(function (b) {
    b.addEventListener("click", function () {
      cozy[b.parentElement.dataset.group] = b.dataset.value;
      applyCozy();
    });
  });

  // little sparkle trail behind the mouse (not on touch screens)
  document.addEventListener("pointermove", function (e) {
    if (cozy.effect !== "sparkles" || e.pointerType !== "mouse") return;
    const now = Date.now();
    if (now - lastTrail < 60) return;
    lastTrail = now;
    twinkle(e.clientX + "px", e.clientY + "px", true);
  });

  applyCozy();
}

/* ---------- My Garden (a plant and a pet that grow as you use the site) ---------- */
const PLANT_STEPS = [0, 15, 40, 80, 140, 220];
const PET_STEPS = [0, 20, 50, 100, 170, 260];
const PLANT_STAGES = ["Seed", "Sprout", "Young plant", "Bud", "In bloom", "Full bloom"];
const PET_STAGES = ["Egg", "Baby", "Little one", "Growing up", "Grown", "Shining star"];
const MOOD_TEXT = { sleepy: "sleepy 😴", calm: "relaxed 🙂", happy: "happy 😊", excited: "so excited ✨" };
const ACCESSORIES = [
  { id: "bow", name: "Bow 🎀", need: 30 },
  { id: "glasses", name: "Glasses 🕶️", need: 60 },
  { id: "flowers", name: "Flower crown 🌸", need: 110 },
  { id: "crown", name: "Crown 👑", need: 200 }
];
let garden = loadObj("myGarden");
let gardenHue = 330;

function gEl(id) { return document.getElementById(id); }
function gardenExists() { return !!(garden && garden.petName); }
function saveGarden() {
  try { localStorage.setItem("myGarden", JSON.stringify(garden)); } catch (e) {}
}

function todayStr() {
  const d = new Date();
  return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}
function dayNum(s) {
  const p = String(s).split("-").map(Number);
  return Math.round(new Date(p[0], p[1] - 1, p[2], 12).getTime() / 86400000);
}

function stageOf(xp, steps) {
  let st = 0;
  steps.forEach(function (n, i) { if (xp >= n) st = i; });
  return st;
}
function addGrowth(kind, n) {
  garden[kind + "Xp"] = (garden[kind + "Xp"] || 0) + n;
  return n;
}
function stagesNow() {
  return {
    plant: stageOf(garden.plantXp || 0, PLANT_STEPS),
    pet: stageOf(garden.petXp || 0, PET_STEPS)
  };
}
function levelNote(before) {
  const now = stagesNow();
  const notes = [];
  if (now.plant > before.plant) notes.push("🎉 " + garden.plantName + " is now: " + PLANT_STAGES[now.plant] + "!");
  if (now.pet > before.pet) notes.push("🎉 " + garden.petName + " is now: " + PET_STAGES[now.pet] + "!");
  return notes.join(" ");
}
function showGardenMsg(text) {
  const box = gEl("garden-msg");
  if (box) box.textContent = text;
}

function activeStreak() {
  if (!garden.lastCare) return 0;
  const gap = dayNum(todayStr()) - dayNum(garden.lastCare);
  return gap <= 1 ? (garden.streak || 0) : 0;
}

// the pet never gets sick: it just gets sleepy if you stay away, and cheers up when you come back
function petMood() {
  const t = todayStr();
  const since = dayNum(t) - dayNum(garden.lastCare || garden.started || t);
  if (since >= 3) return "sleepy";
  if (garden.lastPet === t && garden.lastGain === t) return "excited";
  if (garden.lastPet === t) return "happy";
  return "calm";
}

/* ----- the drawings (all made from simple shapes) ----- */
function flowerSVG(cx, cy, k, petal) {
  let f = "";
  for (let i = 0; i < 6; i++) {
    f += '<ellipse cx="' + cx + '" cy="' + (cy - 13 * k) + '" rx="' + (8 * k) + '" ry="' + (13 * k) +
      '" transform="rotate(' + (i * 60) + ' ' + cx + ' ' + cy + ')" fill="' + petal +
      '" stroke="#e0558f" stroke-width="1.5"/>';
  }
  return f + '<circle cx="' + cx + '" cy="' + cy + '" r="' + (8 * k) + '" fill="#ffd54f" stroke="#e0a800" stroke-width="1.5"/>';
}

function plantSVG(stage) {
  const stem = "#4fae5a", leaf = "#7ccf7a", leafEdge = "#3e9448";
  function leaves(y, size) {
    return '<ellipse cx="' + (60 - size) + '" cy="' + y + '" rx="' + size + '" ry="' + (size / 2.2) +
      '" transform="rotate(-25 ' + (60 - size) + ' ' + y + ')" fill="' + leaf + '" stroke="' + leafEdge + '" stroke-width="1.5"/>' +
      '<ellipse cx="' + (60 + size) + '" cy="' + y + '" rx="' + size + '" ry="' + (size / 2.2) +
      '" transform="rotate(25 ' + (60 + size) + ' ' + y + ')" fill="' + leaf + '" stroke="' + leafEdge + '" stroke-width="1.5"/>';
  }
  function line(x1, y1, x2, y2) {
    return '<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 +
      '" stroke="' + stem + '" stroke-width="4.5" stroke-linecap="round"/>';
  }
  let s = '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Your plant">';
  s += '<ellipse cx="60" cy="108" rx="40" ry="9" fill="#8a5a3b"/><ellipse cx="60" cy="105" rx="31" ry="6" fill="#a8714b"/>';
  if (stage === 0) {
    s += '<ellipse cx="60" cy="101" rx="7" ry="4.5" fill="#6b4428"/>';
  } else if (stage === 1) {
    s += line(60, 104, 60, 86) + leaves(84, 9);
  } else if (stage === 2) {
    s += line(60, 104, 60, 64) + leaves(86, 12) + leaves(72, 10);
  } else if (stage === 3) {
    s += line(60, 104, 60, 52) + leaves(90, 13) + leaves(76, 11) + leaves(64, 9);
    s += '<ellipse cx="60" cy="43" rx="9" ry="13" fill="#ff9ec4" stroke="#e0558f" stroke-width="2"/>';
    s += '<path d="M51 52 q9 -6 18 0" fill="none" stroke="' + stem + '" stroke-width="3" stroke-linecap="round"/>';
  } else if (stage === 4) {
    s += line(60, 104, 60, 50) + leaves(90, 13) + leaves(76, 11) + leaves(64, 9);
    s += flowerSVG(60, 38, 1, "#ff9ec4");
  } else {
    s += line(60, 104, 60, 46) + leaves(92, 13) + leaves(80, 11);
    s += '<path d="M60 84 q-18 -2 -26 -18" fill="none" stroke="' + stem + '" stroke-width="3.5" stroke-linecap="round"/>';
    s += '<path d="M60 78 q18 -4 28 -22" fill="none" stroke="' + stem + '" stroke-width="3.5" stroke-linecap="round"/>';
    s += flowerSVG(32, 62, 0.55, "#ffb8d8") + flowerSVG(90, 52, 0.6, "#ff9ec4");
    s += flowerSVG(60, 32, 1.15, "#ff9ec4");
  }
  return s + '</svg>';
}

function petSVG(stage, mood, worn, hue) {
  hue = Number(hue);
  if (!(hue >= 0 && hue <= 360)) hue = 330;
  worn = worn || {};
  const body = "hsl(" + hue + " 85% 83%)";
  const edge = "hsl(" + hue + " 55% 52%)";
  const soft = "hsl(" + hue + " 90% 94%)";
  const ink = "#4a2a55";
  let s = '<svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Your pet">';
  s += '<ellipse cx="60" cy="108" rx="34" ry="6" fill="rgba(0,0,0,0.12)"/>';

  if (stage === 0) {
    s += '<ellipse cx="60" cy="78" rx="24" ry="30" fill="' + soft + '" stroke="' + edge + '" stroke-width="3"/>';
    s += '<circle cx="50" cy="68" r="4" fill="' + body + '"/><circle cx="69" cy="80" r="5" fill="' + body + '"/><circle cx="57" cy="93" r="3" fill="' + body + '"/>';
    if (mood === "sleepy") s += '<text x="84" y="50" font-size="18" fill="' + edge + '">z</text>';
    if (mood === "happy" || mood === "excited") {
      s += '<path d="M92 44 l2 7 7 2 -7 2 -2 7 -2 -7 -7 -2 7 -2z" fill="#ffc83d"/>';
    }
    return s + '</svg>';
  }

  const R = [0, 22, 27, 31, 35, 38][stage];
  const cx = 60;
  const cy = 104 - R;
  const top = cy - 0.94 * R;

  if (stage >= 3) {
    s += '<circle cx="' + (cx - 0.62 * R) + '" cy="' + (cy - 0.78 * R) + '" r="' + (0.22 * R) + '" fill="' + body + '" stroke="' + edge + '" stroke-width="2.5"/>';
    s += '<circle cx="' + (cx + 0.62 * R) + '" cy="' + (cy - 0.78 * R) + '" r="' + (0.22 * R) + '" fill="' + body + '" stroke="' + edge + '" stroke-width="2.5"/>';
  }
  if (stage >= 2) {
    s += '<ellipse cx="' + (cx - 0.45 * R) + '" cy="104" rx="' + (0.28 * R) + '" ry="' + (0.14 * R) + '" fill="' + body + '" stroke="' + edge + '" stroke-width="2.5"/>';
    s += '<ellipse cx="' + (cx + 0.45 * R) + '" cy="104" rx="' + (0.28 * R) + '" ry="' + (0.14 * R) + '" fill="' + body + '" stroke="' + edge + '" stroke-width="2.5"/>';
  }
  // a little leaf grows on its head, a nod to the garden
  const lx = cx + 0.42 * R;
  const ly = top + 2;
  s += '<ellipse cx="' + lx + '" cy="' + (ly - 5 - stage) + '" rx="' + (3 + stage * 0.7) + '" ry="' + (6 + stage * 1.6) +
    '" transform="rotate(25 ' + lx + ' ' + ly + ')" fill="#7ccf7a" stroke="#3e9448" stroke-width="1.5"/>';

  s += '<ellipse cx="' + cx + '" cy="' + cy + '" rx="' + R + '" ry="' + (0.94 * R) + '" fill="' + body + '" stroke="' + edge + '" stroke-width="3"/>';
  if (stage >= 2) {
    s += '<ellipse cx="' + cx + '" cy="' + (cy + 0.3 * R) + '" rx="' + (0.55 * R) + '" ry="' + (0.46 * R) + '" fill="' + soft + '" opacity="0.85"/>';
  }

  // face
  const ex = 0.38 * R;
  const ey = cy - 0.05 * R;
  const my = cy + 0.28 * R;
  s += '<circle cx="' + (cx - 0.62 * R) + '" cy="' + (cy + 0.2 * R) + '" r="' + (0.12 * R) + '" fill="#ff9ec4" opacity="0.65"/>';
  s += '<circle cx="' + (cx + 0.62 * R) + '" cy="' + (cy + 0.2 * R) + '" r="' + (0.12 * R) + '" fill="#ff9ec4" opacity="0.65"/>';
  [-1, 1].forEach(function (d) {
    const x = cx + d * ex;
    if (mood === "happy") {
      s += '<path d="M' + (x - 5) + ' ' + ey + ' q5 -7 10 0" fill="none" stroke="' + ink + '" stroke-width="3" stroke-linecap="round"/>';
    } else if (mood === "sleepy") {
      s += '<path d="M' + (x - 5) + ' ' + ey + ' h10" stroke="' + ink + '" stroke-width="3" stroke-linecap="round"/>';
    } else if (mood === "excited") {
      s += '<circle cx="' + x + '" cy="' + ey + '" r="4.6" fill="' + ink + '"/><circle cx="' + (x - 1.4) + '" cy="' + (ey - 1.6) + '" r="1.6" fill="#fff"/>';
    } else {
      s += '<circle cx="' + x + '" cy="' + ey + '" r="3.3" fill="' + ink + '"/>';
    }
  });
  if (mood === "excited") {
    s += '<path d="M' + (cx - 6) + ' ' + my + ' q6 10 12 0z" fill="#ff7aa8" stroke="' + ink + '" stroke-width="2" stroke-linejoin="round"/>';
  } else if (mood === "happy") {
    s += '<path d="M' + (cx - 6) + ' ' + my + ' q6 7 12 0" fill="none" stroke="' + ink + '" stroke-width="2.6" stroke-linecap="round"/>';
  } else if (mood === "sleepy") {
    s += '<path d="M' + (cx - 3) + ' ' + (my + 1) + ' h6" stroke="' + ink + '" stroke-width="2.6" stroke-linecap="round"/>';
    s += '<text x="' + (cx + 0.75 * R) + '" y="' + (cy - 0.8 * R) + '" font-size="16" fill="' + edge + '">z</text>';
  } else {
    s += '<path d="M' + (cx - 4) + ' ' + my + ' q4 4 8 0" fill="none" stroke="' + ink + '" stroke-width="2.4" stroke-linecap="round"/>';
  }
  if (mood === "excited") {
    s += '<path d="M14 40 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#ffc83d"/>';
    s += '<path d="M100 34 l2 6 6 2 -6 2 -2 6 -2 -6 -6 -2 6 -2z" fill="#ffc83d"/>';
  }

  // things it can wear
  if (worn.glasses) {
    s += '<circle cx="' + (cx - ex) + '" cy="' + ey + '" r="' + (0.2 * R) + '" fill="rgba(255,255,255,0.35)" stroke="#444" stroke-width="2"/>';
    s += '<circle cx="' + (cx + ex) + '" cy="' + ey + '" r="' + (0.2 * R) + '" fill="rgba(255,255,255,0.35)" stroke="#444" stroke-width="2"/>';
    s += '<line x1="' + (cx - ex + 0.2 * R) + '" y1="' + ey + '" x2="' + (cx + ex - 0.2 * R) + '" y2="' + ey + '" stroke="#444" stroke-width="2"/>';
  }
  if (worn.flowers) {
    const cols = ["#ffd54f", "#ff9ec4", "#ffffff", "#ff9ec4", "#ffd54f"];
    for (let i = -2; i <= 2; i++) {
      const fx = cx + i * 0.3 * R;
      const fy = cy - 0.94 * R * Math.sqrt(1 - Math.pow(i * 0.3, 2)) + 1;
      s += '<circle cx="' + fx + '" cy="' + fy + '" r="' + (0.11 * R) + '" fill="' + cols[i + 2] + '" stroke="#c0457f" stroke-width="1"/>';
    }
  }
  if (worn.crown) {
    const b = top + 3;
    const w = 0.26 * R;
    s += '<polygon points="' + (cx - w) + ',' + b + ' ' + (cx - w) + ',' + (b - 0.28 * R) + ' ' + (cx - w / 2) + ',' + (b - 0.14 * R) + ' ' + cx + ',' + (b - 0.32 * R) +
      ' ' + (cx + w / 2) + ',' + (b - 0.14 * R) + ' ' + (cx + w) + ',' + (b - 0.28 * R) + ' ' + (cx + w) + ',' + b + '" fill="#ffc83d" stroke="#d99a00" stroke-width="2" stroke-linejoin="round"/>';
  }
  if (worn.bow) {
    const bx = cx - 0.62 * R;
    const by = cy - (stage >= 3 ? 0.98 : 0.8) * R;
    s += '<path d="M' + bx + ' ' + by + ' l-10 -7 v14z" fill="#ff5fa2" stroke="#d63384" stroke-width="1.2"/>';
    s += '<path d="M' + bx + ' ' + by + ' l10 -7 v14z" fill="#ff5fa2" stroke="#d63384" stroke-width="1.2"/>';
    s += '<circle cx="' + bx + '" cy="' + by + '" r="3" fill="#ff3d8b"/>';
  }
  return s + '</svg>';
}

/* ----- showing the garden ----- */
function barAndNext(xp, steps, stage, names, barId, nextId) {
  const bar = gEl(barId);
  const next = gEl(nextId);
  if (stage >= steps.length - 1) {
    bar.style.width = "100%";
    next.textContent = "Fully grown! 🌸";
  } else {
    const span = steps[stage + 1] - steps[stage];
    bar.style.width = Math.max(4, Math.min(100, ((xp - steps[stage]) / span) * 100)) + "%";
    next.textContent = (steps[stage + 1] - xp) + " more to become: " + names[stage + 1];
  }
}

function renderAccessories() {
  const box = gEl("g-acc");
  if (!box) return;
  box.textContent = "";
  garden.worn = garden.worn || {};
  ACCESSORIES.forEach(function (a) {
    const b = document.createElement("button");
    b.className = "acc-btn";
    if ((garden.petXp || 0) < a.need) {
      b.disabled = true;
      b.textContent = "🔒 " + a.name + " (at " + a.need + ")";
    } else {
      b.textContent = a.name;
      if (garden.worn[a.id]) b.classList.add("active");
      b.onclick = function () {
        garden.worn[a.id] = !garden.worn[a.id];
        saveGarden();
        renderGarden();
      };
    }
    box.append(b);
  });
}

function renderHomeGarden() {
  const box = gEl("home-garden");
  if (!box) return;
  const has = gardenExists();
  box.textContent = "";
  const art = document.createElement("div");
  art.className = "home-mini";
  art.innerHTML =
    plantSVG(has ? stageOf(garden.plantXp || 0, PLANT_STEPS) : 0) +
    petSVG(has ? stageOf(garden.petXp || 0, PET_STEPS) : 0, has ? petMood() : "calm", has ? garden.worn : {}, has ? garden.hue : 330);
  const text = document.createElement("div");
  text.textContent = has
    ? garden.petName + " is " + MOOD_TEXT[petMood()] + " · 🔥 " + activeStreak() + " day streak"
    : "Start a plant and a pet that grow as you read and write!";
  box.append(art, text);
}

function renderGarden() {
  const has = gardenExists();
  const setup = gEl("garden-setup");
  const main = gEl("garden-main");
  if (setup) setup.hidden = has;
  if (main) main.hidden = !has;
  renderHomeGarden();
  if (!has || !main) return;

  const t = todayStr();
  const mood = petMood();
  const st = stagesNow();
  garden.worn = garden.worn || {};

  gEl("g-plant-art").innerHTML = plantSVG(st.plant);
  gEl("g-pet-art").innerHTML = petSVG(st.pet, mood, garden.worn, garden.hue);
  gEl("g-pet-art").classList.toggle("sleepy", mood === "sleepy");

  gEl("g-plant-title").textContent = garden.plantName;
  gEl("g-pet-title").textContent = garden.petName;
  gEl("g-plant-stage").textContent = PLANT_STAGES[st.plant] + " · " + (garden.plantXp || 0) + " growth";
  gEl("g-pet-stage").textContent = PET_STAGES[st.pet] + " · " + MOOD_TEXT[mood];
  barAndNext(garden.plantXp || 0, PLANT_STEPS, st.plant, PLANT_STAGES, "g-plant-bar", "g-plant-next");
  barAndNext(garden.petXp || 0, PET_STEPS, st.pet, PET_STAGES, "g-pet-bar", "g-pet-next");

  const water = gEl("g-water");
  const pet = gEl("g-pet");
  water.disabled = garden.lastWater === t;
  water.textContent = garden.lastWater === t ? "💧 Watered today ✓" : "💧 Water " + garden.plantName;
  pet.disabled = garden.lastPet === t;
  pet.textContent = garden.lastPet === t ? "🤗 Petted today ✓" : "🤗 Pet " + garden.petName;

  gEl("g-streak").textContent = activeStreak();
  renderAccessories();
}

/* ----- growing ----- */
function gardenSync() {
  const out = { plant: 0, pet: 0 };
  if (!gardenExists()) return out;
  if (!garden.seen) garden.seen = {};
  const groups = { books: books, diary: diary, photos: photos, songs: mySongs };
  Object.keys(groups).forEach(function (key) {
    const seen = new Set((garden.seen[key] || []).map(String));
    groups[key].forEach(function (item) {
      const id = String(item.id);
      if (seen.has(id)) return;
      seen.add(id);
      if (key === "books") {
        out.plant += addGrowth("plant", item.list === "already-grid" ? 10 : item.list === "current-grid" ? 3 : 1);
      } else if (key === "diary") {
        out.pet += addGrowth("pet", 8);
      } else if (key === "photos") {
        out.pet += addGrowth("pet", 4);
      } else {
        out.pet += addGrowth("pet", 3);
      }
    });
    garden.seen[key] = Array.from(seen);
  });
  return out;
}

// called after you add a book, a diary entry, a photo or a song
function gardenChanged() {
  if (!gardenExists()) return;
  const before = stagesNow();
  const gained = gardenSync();
  if (gained.plant + gained.pet === 0) return;
  garden.lastGain = todayStr();
  saveGarden();
  const parts = [];
  if (gained.plant) parts.push("🌱 +" + gained.plant);
  if (gained.pet) parts.push("🐾 +" + gained.pet);
  showGardenMsg("Your garden grew: " + parts.join(" · ") + " " + levelNote(before));
  renderGarden();
}

function gardenCare(kind) {
  if (!gardenExists()) return;
  const t = todayStr();
  const key = kind === "plant" ? "lastWater" : "lastPet";
  if (garden[key] === t) return;
  const before = stagesNow();
  garden[key] = t;
  addGrowth(kind, 5);
  garden.lastGain = t;

  let bonus = "";
  if (garden.lastCare !== t) {
    garden.streak = garden.lastCare && dayNum(t) - dayNum(garden.lastCare) === 1
      ? (garden.streak || 0) + 1
      : 1;
    garden.lastCare = t;
    if ([3, 7, 14, 30].includes(garden.streak)) {
      addGrowth("plant", 10);
      addGrowth("pet", 10);
      bonus = " 🔥 " + garden.streak + "-day streak! Bonus growth for both.";
    }
  }
  saveGarden();
  showGardenMsg((kind === "plant" ? "💧 " + garden.plantName + " says thank you! +5" : "🤗 " + garden.petName + " loves it! +5") + bonus + " " + levelNote(before));
  renderGarden();
}

function startGarden() {
  const petName = gEl("g-pet-name").value.trim().slice(0, 20) || "Mochi";
  const plantName = gEl("g-plant-name").value.trim().slice(0, 20) || "Sprout";
  const t = todayStr();
  garden = {
    petName: petName, plantName: plantName, hue: gardenHue,
    petXp: 0, plantXp: 0, streak: 0,
    lastCare: "", lastWater: "", lastPet: "", lastGain: "",
    started: t, worn: {},
    // things you already have don't count, only new ones from now on
    seen: {
      books: books.map(b => String(b.id)),
      diary: diary.map(d => String(d.id)),
      photos: photos.map(p => String(p.id)),
      songs: mySongs.map(x => String(x.id))
    }
  };
  saveGarden();
  renderGarden();
  showGardenMsg("Your garden is ready! Water " + plantName + " and pet " + petName + " to begin.");
}

function renameGarden(kind) {
  if (!gardenExists()) return;
  const key = kind === "plant" ? "plantName" : "petName";
  const answer = prompt("New name:", garden[key]);
  if (answer === null) return;
  const name = answer.trim().slice(0, 20);
  if (!name) return;
  garden[key] = name;
  saveGarden();
  renderGarden();
}

function resetGarden() {
  if (!confirm("Start over? Growth, streak and names will be forgotten. Your books, diary, photos and songs stay safe.")) return;
  garden = {};
  try { localStorage.removeItem("myGarden"); } catch (e) {}
  showGardenMsg("");
  renderGarden();
}

function gardenSetup() {
  document.querySelectorAll("#g-colors .swatch").forEach(function (b) {
    b.addEventListener("click", function () {
      gardenHue = Number(b.dataset.hue);
      document.querySelectorAll("#g-colors .swatch").forEach(function (x) {
        x.classList.toggle("active", x === b);
      });
    });
  });
  gardenChanged();
  renderGarden();
  setInterval(renderGarden, 60000);     // so the buttons reset after midnight
}

/* ---------- Start everything when the page opens ---------- */
diary.forEach(renderEntry);
photos.forEach(renderPhoto);
document.querySelectorAll("#star-picker button").forEach(function (b) {
  b.addEventListener("click", function () {
    const v = Number(b.dataset.v);
    setStars(newRating === v ? 0 : v);
  });
});
libSetup();
gallerySetup();
galleryTabsSetup();
cozySetup();
updateBackupInfo();
updateCoverProgress();
gardenSetup();
updateHome();
setInterval(updateHome, 1000);

/* ---------- Menu (the Menu button on phones, tap-to-open dropdowns) ---------- */
const navEl = document.querySelector("nav");
const menuToggle = document.getElementById("menu-toggle");

function closeMenu() {
  navEl.classList.remove("open");
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.textContent = "☰ Menu";
  document.querySelectorAll(".dropdown.open").forEach(d => d.classList.remove("open"));
}

menuToggle.addEventListener("click", function () {
  const isOpen = navEl.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
  menuToggle.textContent = isOpen ? "✕ Close" : "☰ Menu";
});

document.querySelectorAll(".dropbtn").forEach(function (btn) {
  btn.addEventListener("click", function () {
    const drop = btn.parentElement;
    const wasOpen = drop.classList.contains("open");
    document.querySelectorAll(".dropdown.open").forEach(d => d.classList.remove("open"));
    if (!wasOpen) drop.classList.add("open");
  });
});

document.querySelectorAll(".dropdown").forEach(function (drop) {
  drop.addEventListener("mouseleave", function () {
    drop.classList.remove("open");
  });
});

document.querySelectorAll(".nav-links a").forEach(function (a) {
  a.addEventListener("click", closeMenu);
});
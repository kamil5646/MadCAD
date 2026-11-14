// Highlight the download for this computer and point the main button at it.
(function () {
  var ua = navigator.userAgent || "";
  var os = /Windows/i.test(ua) ? "windows" : /Mac OS X|Macintosh/i.test(ua) && !/iPhone|iPad/i.test(ua) ? "mac" : /Linux|X11/i.test(ua) && !/Android/i.test(ua) ? "linux" : null;
  if (!os) return;
  var card = document.querySelector('.download-grid [data-os="' + os + '"]');
  var hero = document.getElementById("hero-download");
  if (!card || !hero) return;
  card.classList.add("is-current");
  var badge = document.createElement("span");
  badge.className = "badge";
  badge.textContent = "Twój system";
  card.insertBefore(badge, card.firstChild);
  var link = card.querySelector("a.button");
  var name = { mac: "macOS", windows: "Windows", linux: "Linux" }[os];
  hero.href = link.href;
  hero.textContent = "Pobierz dla " + name;
})();

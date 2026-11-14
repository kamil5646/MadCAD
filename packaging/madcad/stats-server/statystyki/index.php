<?php
// MadCAD 8: usage statistics dashboard (madcad.madmagsystem.pl/statystyki/), behind a password.
// Reads private_data/madcad-stats/stats.sqlite (written by api/stats/v1) and GitHub's download
// counts (cached for an hour). No scripts: the site's CSP allows none inline, and none are needed.
declare(strict_types=1);

ini_set('display_errors', '0');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex, nofollow');
header('X-Frame-Options: DENY');

const REPO = 'kamil5646/MadCAD';
$data = dirname(__DIR__, 2) . '/private_data/madcad-stats';
$tz = new DateTimeZone('Europe/Warsaw');

session_name('madcad_stats');
session_set_cookie_params(['lifetime' => 0, 'path' => '/statystyki/', 'secure' => true, 'httponly' => true, 'samesite' => 'Strict']);
session_start();
if (empty($_SESSION['csrf'])) $_SESSION['csrf'] = bin2hex(random_bytes(16));

function h(string|int|float|null $s): string { return htmlspecialchars((string)$s, ENT_QUOTES, 'UTF-8'); }
function n(int|float $v): string { return number_format((float)$v, 0, ',', ' '); }
function duration(float $s): string {
  if ($s < 60) return round($s) . ' s';
  if ($s < 3600) return round($s / 60) . ' min';
  return number_format($s / 3600, 1, ',', ' ') . ' h';
}

function page(string $title, string $body): never {
  echo '<!doctype html><html lang="pl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">'
    . '<meta name="robots" content="noindex,nofollow"><title>' . h($title) . '</title>'
    . '<link rel="icon" href="/assets/madcad-512.png"><link rel="stylesheet" href="style.css?v=2"></head><body>' . $body . '</body></html>';
  exit;
}

// ---- login --------------------------------------------------------------------------------------

$hashFile = $data . '/admin.hash';
$failFile = $data . '/login-failures.json';

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
  if (!hash_equals($_SESSION['csrf'], (string)($_POST['csrf'] ?? ''))) { http_response_code(400); page('Błąd', '<main class="login"><p>Odśwież stronę i spróbuj ponownie.</p></main>'); }
  if (isset($_POST['logout'])) {
    $_SESSION = [];
    session_destroy();
    header('Location: ./', true, 303);
    exit;
  }
  $fails = is_file($failFile) ? (json_decode((string)file_get_contents($failFile), true) ?: []) : [];
  $fails = array_values(array_filter($fails, fn($t) => is_int($t) && $t > time() - 900));
  $error = null;
  if (count($fails) >= 8) {
    $error = 'Za dużo prób. Spróbuj za kwadrans.';
  } elseif (is_file($hashFile) && password_verify((string)($_POST['password'] ?? ''), trim((string)file_get_contents($hashFile)))) {
    session_regenerate_id(true);
    $_SESSION['ok'] = true;
    header('Location: ./', true, 303);
    exit;
  } else {
    $fails[] = time();
    @file_put_contents($failFile, json_encode($fails), LOCK_EX);
    sleep(1);
    $error = 'Nieprawidłowe hasło.';
  }
  $_SESSION['error'] = $error;
  header('Location: ./', true, 303);
  exit;
}

if (empty($_SESSION['ok'])) {
  $error = $_SESSION['error'] ?? null;
  unset($_SESSION['error']);
  page('MadCAD — statystyki', '<main class="login"><form method="post" action="./">'
    . '<img src="/assets/madcad-512.png" width="56" height="56" alt="">'
    . '<h1>Statystyki MadCAD</h1>'
    . ($error ? '<p class="error">' . h($error) . '</p>' : '')
    . '<input type="hidden" name="csrf" value="' . h($_SESSION['csrf']) . '">'
    . '<input type="text" name="username" value="admin" autocomplete="username" hidden>'
    . '<label>Hasło<input type="password" name="password" autocomplete="current-password" required autofocus></label>'
    . '<button type="submit">Zaloguj</button></form></main>');
}

// ---- data ---------------------------------------------------------------------------------------

$days = (int)($_GET['d'] ?? 30);
if (!in_array($days, [7, 30, 90, 365], true)) $days = 30;
$today = new DateTimeImmutable('today', $tz);
$from = $today->modify('-' . ($days - 1) . ' days')->format('Y-m-d');
$now = time();

$db = null;
if (is_file($data . '/stats.sqlite')) {
  $db = new PDO('sqlite:' . $data . '/stats.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
  $db->exec('PRAGMA busy_timeout = 5000');
}
function q(?PDO $db, string $sql, array $args = []): array {
  if (!$db) return [];
  $s = $db->prepare($sql);
  $s->execute($args);
  return $s->fetchAll(PDO::FETCH_ASSOC);
}
function one(?PDO $db, string $sql, array $args = []): float {
  $r = q($db, $sql, $args);
  return $r ? (float)(array_values($r[0])[0] ?? 0) : 0.0;
}

$active = fn(int $d) => one($db, 'SELECT COUNT(DISTINCT install) FROM pings WHERE ts >= ?', [$now - $d * 86400]);
$total = one($db, 'SELECT COUNT(*) FROM installs');
$newInstalls = one($db, 'SELECT COUNT(*) FROM installs WHERE first_seen >= ?', [$today->modify('-' . ($days - 1) . ' days')->getTimestamp()]);
$starts = one($db, "SELECT COUNT(*) FROM pings WHERE event = 'start' AND day >= ?", [$from]);
$sess = q($db, 'SELECT COUNT(*) c, COALESCE(SUM(seconds), 0) s, COALESCE(AVG(seconds), 0) a FROM sessions WHERE day >= ?', [$from])[0] ?? ['c' => 0, 's' => 0, 'a' => 0];

// Per day: active installations and starts.
$daily = [];
for ($d = $today->modify('-' . ($days - 1) . ' days'); $d <= $today; $d = $d->modify('+1 day')) {
  $daily[$d->format('Y-m-d')] = ['active' => 0, 'starts' => 0];
}
foreach (q($db, "SELECT day, COUNT(DISTINCT install) a, SUM(event = 'start') s FROM pings WHERE day >= ? GROUP BY day", [$from]) as $r) {
  if (isset($daily[$r['day']])) $daily[$r['day']] = ['active' => (int)$r['a'], 'starts' => (int)$r['s']];
}

$period = $today->modify('-' . ($days - 1) . ' days')->getTimestamp();
$versions = q($db, 'SELECT version k, COUNT(*) v FROM installs WHERE last_seen >= ? GROUP BY version ORDER BY v DESC, version DESC LIMIT 15', [$period]);
$systems = q($db, "SELECT os || ' ' || arch k, COUNT(*) v FROM installs WHERE last_seen >= ? GROUP BY os, arch ORDER BY v DESC", [$period]);
$langs = q($db, "SELECT CASE lang WHEN '' THEN '?' ELSE lang END k, COUNT(*) v FROM installs WHERE last_seen >= ? GROUP BY lang ORDER BY v DESC LIMIT 12", [$period]);
$tools = q($db, 'SELECT command k, SUM(uses) v, SUM(sessions) s FROM commands WHERE day >= ? GROUP BY command ORDER BY v DESC LIMIT 40', [$from]);

// Readable names: tools in Polish (commands-pl.php), systems and languages.
$names = is_file(__DIR__ . '/commands-pl.php') ? (require __DIR__ . '/commands-pl.php') : [];
foreach ($tools as &$t) {
  $id = (string)$t['k'];
  $name = $names[$id] ?? (preg_match('/^file\.export\.(\w+)$/', $id, $m) ? 'Eksport ' . strtoupper($m[1]) : null);
  $t['k'] = $name ?? $id;
  $t['id'] = $name ? $id : null;
}
unset($t);
$osNames = ['macos aarch64' => 'macOS · Apple Silicon', 'macos x86_64' => 'macOS · Intel', 'windows x86_64' => 'Windows · x64',
  'windows aarch64' => 'Windows · ARM', 'linux x86_64' => 'Linux · x64', 'linux aarch64' => 'Linux · ARM'];
foreach ($systems as &$t) { $t['k'] = $osNames[$t['k']] ?? $t['k']; }
unset($t);
$langNames = ['pl' => 'polski', 'en' => 'angielski', 'de' => 'niemiecki', 'uk' => 'ukraiński', 'cs' => 'czeski', 'fr' => 'francuski',
  'es' => 'hiszpański', 'it' => 'włoski', 'nl' => 'niderlandzki', 'pt' => 'portugalski', 'ru' => 'rosyjski', 'tr' => 'turecki',
  'ja' => 'japoński', 'zh' => 'chiński', 'ko' => 'koreański', 'sk' => 'słowacki', 'sv' => 'szwedzki'];
foreach ($langs as &$t) { $t['k'] = $langNames[$t['k']] ?? $t['k']; }
unset($t);

// GitHub download counts: asked at most once an hour; the shared host's address often hits GitHub's
// anonymous rate limit, so the last good answer is kept and shown with its date.
function github_downloads(string $data): array {
  $cache = $data . '/github.json';
  $tried = $data . '/github.tried';
  $kept = is_file($cache) ? (json_decode((string)file_get_contents($cache), true) ?: []) : [];
  if (is_file($tried) && filemtime($tried) > time() - 3600) return $kept;
  @touch($tried);
  $ch = curl_init('https://api.github.com/repos/' . REPO . '/releases?per_page=100');
  curl_setopt_array($ch, [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => 10, CURLOPT_USERAGENT => 'MadCAD-stats',
    CURLOPT_HTTPHEADER => ['Accept: application/vnd.github+json']]);
  $body = curl_exec($ch);
  $releases = curl_getinfo($ch, CURLINFO_HTTP_CODE) === 200 ? json_decode((string)$body, true) : null;
  if (!is_array($releases)) return $kept;
  $rows = [];
  foreach ($releases as $r) {
    if (!is_array($r) || !str_starts_with((string)($r['tag_name'] ?? ''), 'v8')) continue;
    $row = ['tag' => (string)$r['tag_name'], 'date' => substr((string)($r['published_at'] ?? ''), 0, 10), 'mac' => 0, 'windows' => 0, 'linux' => 0];
    foreach ($r['assets'] ?? [] as $a) {
      $name = strtolower((string)($a['name'] ?? ''));
      $count = (int)($a['download_count'] ?? 0);
      if (str_contains($name, '-mac-')) $row['mac'] += $count;
      elseif (str_contains($name, '-windows-')) $row['windows'] += $count;
      elseif (str_contains($name, '-linux-')) $row['linux'] += $count;
    }
    $rows[] = $row;
  }
  $kept = ['at' => time(), 'rows' => $rows];
  @file_put_contents($cache, json_encode($kept), LOCK_EX);
  return $kept;
}
$github = github_downloads($data);
$downloads = $github['rows'] ?? [];
$dlAt = isset($github['at']) ? (new DateTimeImmutable('@' . (int)$github['at']))->setTimezone($tz)->format('Y-m-d H:i') : null;
$dlTotal = array_sum(array_map(fn($r) => $r['mac'] + $r['windows'] + $r['linux'], $downloads));

// ---- page ---------------------------------------------------------------------------------------

function table(string $title, array $rows, string $unit, ?string $extra = null): string {
  $max = max(1, ...array_map(fn($r) => (float)$r['v'], $rows ?: [['v' => 1]]));
  $html = '<section class="card"><h2>' . h($title) . '</h2>';
  if (!$rows) return $html . '<p class="empty">Brak danych w tym okresie.</p></section>';
  $html .= '<table><thead><tr><th></th><th class="num">' . h($unit) . '</th>' . ($extra ? '<th class="num">' . h($extra) . '</th>' : '') . '</tr></thead><tbody>';
  foreach ($rows as $r) {
    $w = round(100 * (float)$r['v'] / $max);
    $html .= '<tr><td><span class="label">' . h($r['k']) . (!empty($r['id']) ? ' <code>' . h($r['id']) . '</code>' : '') . '</span><svg class="bar" viewBox="0 0 100 4" preserveAspectRatio="none" aria-hidden="true">'
      . '<rect width="' . $w . '" height="4" rx="1"/></svg></td><td class="num">' . n((float)$r['v']) . '</td>'
      . ($extra ? '<td class="num">' . n((float)($r['s'] ?? 0)) . '</td>' : '') . '</tr>';
  }
  return $html . '</tbody></table></section>';
}

function chart(array $daily): string {
  $n = count($daily);
  $max = max(1, ...array_values(array_map(fn($d) => max($d['active'], $d['starts']), $daily)));
  $w = 1000; $hgt = 220; $pad = 4;
  $step = $w / max(1, $n);
  $bar = max(1.0, $step * 0.42);
  $svg = '<svg class="chart" viewBox="0 0 ' . $w . ' ' . ($hgt + 24) . '" role="img" aria-label="Aktywne instalacje i uruchomienia dziennie">';
  foreach ([0.25, 0.5, 0.75, 1] as $f) {
    $y = round($hgt - ($hgt - $pad) * $f, 1);
    $svg .= '<line class="gl" x1="0" x2="' . $w . '" y1="' . $y . '" y2="' . $y . '"/><text class="axis" x="2" y="' . ($y - 3) . '">' . n($max * $f) . '</text>';
  }
  $i = 0;
  foreach ($daily as $day => $d) {
    $x = $i * $step + ($step - 2 * $bar) / 2;
    $ha = round(($hgt - $pad) * $d['active'] / $max, 1);
    $hs = round(($hgt - $pad) * $d['starts'] / $max, 1);
    $label = $day . ': ' . $d['active'] . ' aktywnych, ' . $d['starts'] . ' uruchomień';
    $svg .= '<g><title>' . h($label) . '</title>'
      . '<rect class="a" x="' . round($x, 1) . '" y="' . ($hgt - $ha) . '" width="' . round($bar, 1) . '" height="' . $ha . '"/>'
      . '<rect class="s" x="' . round($x + $bar, 1) . '" y="' . ($hgt - $hs) . '" width="' . round($bar, 1) . '" height="' . $hs . '"/></g>';
    $every = max(1, (int)ceil($n / 8));
    if ($i % $every === 0) {
      $svg .= '<text class="axis" x="' . round($i * $step + $step / 2, 1) . '" y="' . ($hgt + 18) . '" text-anchor="middle">' . h(substr($day, 5)) . '</text>';
    }
    $i++;
  }
  return $svg . '</svg>';
}

$tabs = '';
foreach ([7 => '7 dni', 30 => '30 dni', 90 => '90 dni', 365 => 'Rok'] as $d => $label) {
  $tabs .= '<a href="?d=' . $d . '"' . ($d === $days ? ' class="on" aria-current="page"' : '') . '>' . $label . '</a>';
}

$kpi = fn(string $label, string $value, string $note = '') => '<div class="kpi"><span>' . h($label) . '</span><strong>' . h($value) . '</strong>' . ($note ? '<small>' . h($note) . '</small>' : '') . '</div>';

$dlRows = '';
foreach ($downloads as $r) {
  $dlRows .= '<tr><td>' . h($r['tag']) . ' <small>' . h($r['date']) . '</small></td><td class="num">' . n($r['mac']) . '</td><td class="num">' . n($r['windows'])
    . '</td><td class="num">' . n($r['linux']) . '</td><td class="num"><b>' . n($r['mac'] + $r['windows'] + $r['linux']) . '</b></td></tr>';
}

page('MadCAD — statystyki', '<header><div class="brand"><img src="/assets/madcad-512.png" width="32" height="32" alt=""><b>MadCAD</b> statystyki</div>'
  . '<nav class="tabs">' . $tabs . '</nav>'
  . '<form method="post" action="./"><input type="hidden" name="csrf" value="' . h($_SESSION['csrf']) . '"><button name="logout" value="1" class="ghost">Wyloguj</button></form></header>'
  . '<main>'
  . '<section class="kpis">'
  . $kpi('Aktywne dziś', n($active(1)), 'tydzień ' . n($active(7)) . ' · miesiąc ' . n($active(30)))
  . $kpi('Instalacje', n($total), 'wszystkie, które się odezwały')
  . $kpi('Nowe instalacje', n($newInstalls), 'w okresie')
  . $kpi('Uruchomienia', n($starts), 'w okresie')
  . $kpi('Średnia sesja', duration((float)$sess['a']), n((int)$sess['c']) . ' sesji · ' . duration((float)$sess['s']) . ' łącznie')
  . $kpi('Pobrania z GitHuba', n($dlTotal), 'wszystkie wersje 8.x')
  . '</section>'
  . '<section class="card wide"><h2>Dziennie</h2><p class="legend"><i class="a"></i>aktywne instalacje <i class="s"></i>uruchomienia</p>' . chart($daily) . '</section>'
  . '<div class="grid">'
  . table('Najczęściej używane narzędzia', $tools, 'użycia', 'sesje')
  . '<div class="stack">'
  . table('Wersje', $versions, 'instalacje')
  . table('Systemy', $systems, 'instalacje')
  . table('Języki', $langs, 'instalacje')
  . '</div></div>'
  . '<section class="card wide"><h2>Pobrania z GitHuba' . ($dlAt ? ' <small>stan z ' . h($dlAt) . '</small>' : '') . '</h2>'
  . ($dlRows ? '<table><thead><tr><th>Wersja</th><th class="num">macOS</th><th class="num">Windows</th><th class="num">Linux</th><th class="num">Razem</th></tr></thead><tbody>' . $dlRows . '</tbody></table>' : '<p class="empty">Brak danych z GitHuba.</p>')
  . '</section>'
  . '<p class="foot">Dane anonimowe: losowy numer instalacji, wersja, system, język, czas sesji i użyte narzędzia. Bez adresów IP. Okres: od ' . h($from) . ' (czas polski).</p>'
  . '</main>');

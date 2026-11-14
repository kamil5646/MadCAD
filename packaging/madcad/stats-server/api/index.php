<?php
// MadCAD 8: receives the anonymous usage records the app sends (crates/ui-egui/src/stats.rs).
// Deployed to public_html/api/stats/v1/index.php; the data stays in private_data/madcad-stats.
// No IP address, cookie or header is stored: only what the record says, after checking it.
declare(strict_types=1);

ini_set('display_errors', '0');
header('Cache-Control: no-store');
header('X-Robots-Tag: noindex');

const MAX_BODY = 16384;
const MAX_PER_DAY = 30;        // records one installation may send in a day
const MAX_COMMANDS = 200;
const MAX_SESSION_S = 604800;  // a week

function done(int $status): never {
  http_response_code($status);
  exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
  header('Allow: POST');
  done(405);
}
$raw = file_get_contents('php://input', false, null, 0, MAX_BODY + 1);
if ($raw === false || strlen($raw) > MAX_BODY) done(413);
$r = json_decode($raw, true, 8);
if (!is_array($r)) done(400);

$id = $r['id'] ?? '';
$event = $r['event'] ?? '';
if (!is_string($id) || !preg_match('/^[0-9a-f]{32}$/', $id)) done(400);
if (!in_array($event, ['start', 'day'], true)) done(400);
$text = fn($v, string $re, string $else) => is_string($v) && preg_match($re, $v) ? $v : $else;
$version = $text($r['version'] ?? '', '/^\d{1,3}\.\d{1,3}\.\d{1,4}([-+][0-9A-Za-z.\-]{1,24})?$/', 'unknown');
$os = in_array($r['os'] ?? '', ['macos', 'windows', 'linux'], true) ? $r['os'] : 'other';
$arch = $text($r['arch'] ?? '', '/^[a-z0-9_]{1,16}$/', 'other');
$lang = $text($r['lang'] ?? '', '/^[a-z]{2,3}([_-][A-Za-z]{2,4})?$/', '');

$seconds = null;
$commands = [];
if (isset($r['previous']) && is_array($r['previous'])) {
  $p = $r['previous'];
  if (isset($p['seconds']) && is_int($p['seconds']) && $p['seconds'] >= 0) {
    $seconds = min($p['seconds'], MAX_SESSION_S);
  }
  if (isset($p['commands']) && is_array($p['commands'])) {
    foreach ($p['commands'] as $name => $n) {
      if (count($commands) >= MAX_COMMANDS) break;
      if (is_string($name) && preg_match('/^[A-Za-z0-9_.:\-]{1,64}$/', $name) && is_int($n) && $n > 0) {
        $commands[$name] = min($n, 10000);
      }
    }
  }
}

$dir = dirname(__DIR__, 4) . '/private_data/madcad-stats';
if (!is_dir($dir) && !mkdir($dir, 0700, true) && !is_dir($dir)) done(500);

try {
  $db = new PDO('sqlite:' . $dir . '/stats.sqlite', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
  $db->exec('PRAGMA busy_timeout = 5000');
  $db->exec('PRAGMA journal_mode = WAL');
  $db->exec('CREATE TABLE IF NOT EXISTS installs (id TEXT PRIMARY KEY, first_seen INTEGER NOT NULL, last_seen INTEGER NOT NULL,
      version TEXT NOT NULL, os TEXT NOT NULL, arch TEXT NOT NULL, lang TEXT NOT NULL, starts INTEGER NOT NULL DEFAULT 0)');
  $db->exec('CREATE TABLE IF NOT EXISTS pings (ts INTEGER NOT NULL, day TEXT NOT NULL, install TEXT NOT NULL, event TEXT NOT NULL,
      version TEXT NOT NULL, os TEXT NOT NULL)');
  $db->exec('CREATE INDEX IF NOT EXISTS pings_day ON pings(day)');
  $db->exec('CREATE INDEX IF NOT EXISTS pings_install ON pings(install, day)');
  $db->exec('CREATE TABLE IF NOT EXISTS sessions (ts INTEGER NOT NULL, day TEXT NOT NULL, install TEXT NOT NULL, seconds INTEGER NOT NULL)');
  $db->exec('CREATE INDEX IF NOT EXISTS sessions_day ON sessions(day)');
  $db->exec('CREATE TABLE IF NOT EXISTS commands (day TEXT NOT NULL, command TEXT NOT NULL, uses INTEGER NOT NULL, sessions INTEGER NOT NULL,
      PRIMARY KEY (day, command))');

  $now = time();
  $day = (new DateTimeImmutable('now', new DateTimeZone('Europe/Warsaw')))->format('Y-m-d');

  $count = $db->prepare('SELECT COUNT(*) FROM pings WHERE install = ? AND day = ?');
  $count->execute([$id, $day]);
  if ((int)$count->fetchColumn() >= MAX_PER_DAY) done(429);

  $db->beginTransaction();
  $db->prepare('INSERT INTO pings (ts, day, install, event, version, os) VALUES (?, ?, ?, ?, ?, ?)')
     ->execute([$now, $day, $id, $event, $version, $os]);
  $db->prepare('INSERT INTO installs (id, first_seen, last_seen, version, os, arch, lang, starts) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET last_seen = excluded.last_seen, version = excluded.version, os = excluded.os,
      arch = excluded.arch, lang = excluded.lang, starts = starts + excluded.starts')
     ->execute([$id, $now, $now, $version, $os, $arch, $lang, $event === 'start' ? 1 : 0]);
  if ($seconds !== null && $seconds > 0) {
    $db->prepare('INSERT INTO sessions (ts, day, install, seconds) VALUES (?, ?, ?, ?)')->execute([$now, $day, $id, $seconds]);
  }
  $add = $db->prepare('INSERT INTO commands (day, command, uses, sessions) VALUES (?, ?, ?, 1)
      ON CONFLICT(day, command) DO UPDATE SET uses = uses + excluded.uses, sessions = sessions + 1');
  foreach ($commands as $name => $n) {
    $add->execute([$day, $name, $n]);
  }
  $db->commit();
} catch (Throwable $e) {
  error_log('madcad stats: ' . $e->getMessage());
  done(500);
}
done(204);

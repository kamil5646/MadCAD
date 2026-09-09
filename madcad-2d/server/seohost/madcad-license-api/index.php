<?php
declare(strict_types=1);

const MADCAD_TRIAL_DAYS = 40;
const MADCAD_SESSION_DAYS = 30;
const MADCAD_OFFLINE_DAYS = 30;
const MADCAD_MAX_BODY_BYTES = 32768;

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store, max-age=0');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: no-referrer');

final class MadcadHttpResponse extends RuntimeException {
  private $responseStatus;
  private $responsePayload;
  public function __construct(int $status, array $payload) {
    parent::__construct((string)($payload['error'] ?? 'HTTP response'));
    $this->responseStatus = $status;
    $this->responsePayload = $payload;
  }
  public function status(): int { return $this->responseStatus; }
  public function payload(): array { return $this->responsePayload; }
}

function respond(int $status, array $payload): void {
  if (!empty($GLOBALS['madcad_store_transaction'])) throw new MadcadHttpResponse($status, $payload);
  http_response_code($status);
  echo json_encode($payload, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
  exit;
}

function data_root(): string {
  $configured = getenv('MADCAD_LICENSE_DATA_DIR');
  return $configured !== false && trim($configured) !== ''
    ? rtrim($configured, DIRECTORY_SEPARATOR)
    : dirname(__DIR__, 4) . '/private_data/madcad-licensing';
}

function data_path(string $name): string {
  $root = data_root();
  if (!is_dir($root) && !mkdir($root, 0700, true) && !is_dir($root)) throw new RuntimeException('Nie można utworzyć prywatnego magazynu licencji.');
  return $root . '/' . $name;
}

function with_store(callable $callback) {
  $path = data_path('store.json');
  $lockPath = data_path('store.lock');
  $handle = fopen($lockPath, 'c');
  if ($handle === false || !flock($handle, LOCK_EX)) throw new RuntimeException('Magazyn licencji jest chwilowo niedostępny.');
  try {
    $raw = is_file($path) ? file_get_contents($path) : '';
    $store = $raw ? json_decode($raw, true) : null;
    if (!is_array($store)) $store = array('schemaVersion' => 1, 'users' => array(), 'sessions' => array(), 'rateLimits' => array());
    foreach (array('users', 'sessions', 'rateLimits') as $key) if (!isset($store[$key]) || !is_array($store[$key])) $store[$key] = array();
    $deferredResponse = null;
    $GLOBALS['madcad_store_transaction'] = true;
    try {
      $result = $callback($store);
    } catch (MadcadHttpResponse $response) {
      $deferredResponse = $response;
      $result = null;
    } finally {
      $GLOBALS['madcad_store_transaction'] = false;
    }
    $json = json_encode($store, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE);
    if (!is_string($json)) throw new RuntimeException('Nie można zakodować magazynu licencji.');
    $temporaryPath = data_path('store-' . bin2hex(random_bytes(8)) . '.tmp');
    if (file_put_contents($temporaryPath, $json, LOCK_EX) === false) throw new RuntimeException('Nie można zapisać magazynu licencji.');
    @chmod($temporaryPath, 0600);
    if (!rename($temporaryPath, $path)) { @unlink($temporaryPath); throw new RuntimeException('Nie można zatwierdzić magazynu licencji.'); }
    @chmod($path, 0600);
    if ($deferredResponse !== null) throw $deferredResponse;
    return $result;
  } finally {
    flock($handle, LOCK_UN);
    fclose($handle);
    @chmod($lockPath, 0600);
  }
}

function body(): array {
  $length = (int)($_SERVER['CONTENT_LENGTH'] ?? 0);
  if ($length > MADCAD_MAX_BODY_BYTES) respond(413, array('ok' => false, 'error' => 'Żądanie jest zbyt duże.'));
  $raw = file_get_contents('php://input', false, null, 0, MADCAD_MAX_BODY_BYTES + 1);
  $decoded = json_decode($raw ?: '{}', true);
  if (!is_array($decoded)) respond(400, array('ok' => false, 'error' => 'Nieprawidłowy JSON.'));
  return $decoded;
}

function text($value, int $max): string {
  return mb_substr(trim(is_string($value) ? $value : ''), 0, $max);
}

function email($value): string {
  $normalized = strtolower(text($value, 254));
  if (!filter_var($normalized, FILTER_VALIDATE_EMAIL)) respond(422, array('ok' => false, 'error' => 'Podaj poprawny adres e-mail.'));
  return $normalized;
}

function installation_id($value): string {
  $id = text($value, 36);
  if (!preg_match('/^[a-f0-9-]{36}$/i', $id)) respond(422, array('ok' => false, 'error' => 'Nieprawidłowy identyfikator instalacji.'));
  return strtolower($id);
}

function password_value($value): string {
  $password = is_string($value) ? $value : '';
  if (strlen($password) < 10 || strlen($password) > 200) respond(422, array('ok' => false, 'error' => 'Hasło musi mieć od 10 do 200 znaków.'));
  return $password;
}

function client_ip(): string {
  return text($_SERVER['REMOTE_ADDR'] ?? 'unknown', 64);
}

function enforce_rate_limit(array &$store, string $scope, int $limit = 20, int $windowSeconds = 900): void {
  $key = hash('sha256', $scope . '|' . client_ip());
  $now = time();
  $record = $store['rateLimits'][$key] ?? array('startedAt' => $now, 'count' => 0);
  if ($now - (int)$record['startedAt'] >= $windowSeconds) $record = array('startedAt' => $now, 'count' => 0);
  $record['count'] = (int)$record['count'] + 1;
  $store['rateLimits'][$key] = $record;
  if ($record['count'] > $limit) respond(429, array('ok' => false, 'error' => 'Zbyt wiele prób. Spróbuj ponownie później.'));
}

function cleanup_sessions(array &$store): void {
  $now = time();
  foreach ($store['sessions'] as $hash => $session) if ((int)($session['expiresAt'] ?? 0) <= $now) unset($store['sessions'][$hash]);
}

function issue_session(array &$store, string $userId): string {
  cleanup_sessions($store);
  $token = rtrim(strtr(base64_encode(random_bytes(32)), '+/', '-_'), '=');
  $store['sessions'][hash('sha256', $token)] = array('userId' => $userId, 'createdAt' => time(), 'expiresAt' => time() + MADCAD_SESSION_DAYS * 86400);
  return $token;
}

function require_session(array &$store, array $input): array {
  cleanup_sessions($store);
  $token = text($input['sessionToken'] ?? '', 4096);
  $hash = hash('sha256', $token);
  $session = $token !== '' ? ($store['sessions'][$hash] ?? null) : null;
  if (!is_array($session) || !isset($store['users'][$session['userId']])) respond(401, array('ok' => false, 'error' => 'Sesja wygasła. Zaloguj się ponownie.'));
  $session['expiresAt'] = time() + MADCAD_SESSION_DAYS * 86400;
  $store['sessions'][$hash] = $session;
  return array($session['userId'], $hash);
}

function require_admin(array &$store, array $input): void {
  enforce_rate_limit($store, 'admin', 30, 900);
  $provided = text($input['adminToken'] ?? '', 256);
  $secretPath = data_path('admin.secret');
  $expected = is_file($secretPath) ? trim((string)file_get_contents($secretPath)) : '';
  if (strlen($expected) < 32 || strlen($provided) < 32 || !hash_equals($expected, $provided)) respond(403, array('ok' => false, 'error' => 'Brak uprawnień administratora.'));
}

function active_entitlement(array $user): array {
  $now = time();
  $commercial = is_array($user['commercial'] ?? null) ? $user['commercial'] : array();
  $commercialExpiry = strtotime((string)($commercial['expiresAt'] ?? ''));
  if (($commercial['status'] ?? '') === 'active' && ($commercialExpiry === false || $commercialExpiry > $now)) {
    return array('plan' => 'commercial', 'startsAt' => (string)($commercial['startsAt'] ?? ''), 'expiresAt' => (string)($commercial['expiresAt'] ?? ''), 'seats' => max(1, (int)($commercial['seats'] ?? 1)), 'licenseId' => (string)($commercial['licenseId'] ?? ''));
  }
  $trialStarted = (int)($user['trialStartedAt'] ?? 0);
  $trialExpiry = $trialStarted > 0 ? $trialStarted + MADCAD_TRIAL_DAYS * 86400 : 0;
  if ($trialExpiry > $now) {
    return array('plan' => 'commercial-trial', 'startsAt' => gmdate('c', $trialStarted), 'expiresAt' => gmdate('c', $trialExpiry), 'seats' => 1, 'licenseId' => 'trial-' . substr((string)$user['id'], 0, 12));
  }
  return array('plan' => 'personal', 'startsAt' => '', 'expiresAt' => '', 'seats' => 1, 'licenseId' => '');
}

function public_user(array $user): array {
  return array(
    'email' => (string)$user['email'],
    'displayName' => (string)$user['displayName'],
    'entitlement' => active_entitlement($user),
    'devices' => array_map(function ($installationId, $device) {
      return array('installationId' => $installationId, 'firstSeenAt' => (int)($device['firstSeenAt'] ?? 0), 'lastSeenAt' => (int)($device['lastSeenAt'] ?? 0), 'lastPlan' => (string)($device['lastPlan'] ?? 'personal'), 'revoked' => isset($device['revokedAt']));
    }, array_keys($user['devices'] ?? array()), array_values($user['devices'] ?? array())),
  );
}

function bind_device(array &$user, string $installationId, array $entitlement): void {
  if (!isset($user['devices']) || !is_array($user['devices'])) $user['devices'] = array();
  $now = time();
  $activeDevices = array_filter($user['devices'], function ($device) use ($now) {
    return !isset($device['revokedAt']) && $now - (int)($device['lastSeenAt'] ?? $now) < 120 * 86400;
  });
  $licensedDevices = array_filter($activeDevices, function ($device) {
    return in_array($device['lastPlan'] ?? '', array('commercial-trial', 'commercial'), true);
  });
  $existing = $user['devices'][$installationId] ?? array('firstSeenAt' => $now);
  $wasLicensed = in_array($existing['lastPlan'] ?? '', array('commercial-trial', 'commercial'), true);
  $isLicensed = $entitlement['plan'] !== 'personal';
  $limit = $isLicensed ? max(1, (int)$entitlement['seats']) : 3;
  $used = $isLicensed ? count($licensedDevices) : count($activeDevices);
  if ((!isset($user['devices'][$installationId]) || ($isLicensed && !$wasLicensed)) && $used >= $limit) respond(409, array('ok' => false, 'error' => 'Osiągnięto limit aktywnych urządzeń dla tego planu.'));
  unset($existing['revokedAt']);
  $existing['lastSeenAt'] = $now;
  $existing['lastPlan'] = $entitlement['plan'];
  $user['devices'][$installationId] = $existing;
}

function license_response(array $user, array $entitlement, ?string $sessionToken = null): array {
  $response = array(
    'ok' => true,
    'serverTime' => gmdate('c'),
    'offlineDays' => MADCAD_OFFLINE_DAYS,
    'account' => array('email' => $user['email'], 'displayName' => $user['displayName']),
    'entitlement' => $entitlement,
  );
  if ($sessionToken !== null) $response['sessionToken'] = $sessionToken;
  return $response;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') respond(405, array('ok' => false, 'error' => 'Dozwolona jest wyłącznie metoda POST.'));
$route = parse_url($_SERVER['REQUEST_URI'] ?? '', PHP_URL_PATH);
$prefix = '/api/madcad/v1';
if (strpos($route, $prefix) === 0) $route = substr($route, strlen($prefix));
$input = body();

try {
  $result = with_store(function (array &$store) use ($route, $input) {
    if ($route === '/health') return array('ok' => true, 'service' => 'madcad-license', 'schemaVersion' => 1, 'serverTime' => gmdate('c'));
    if ($route === '/auth/register') {
      enforce_rate_limit($store, 'register', 10, 3600);
      $mail = email($input['email'] ?? '');
      $password = password_value($input['password'] ?? '');
      $displayName = text($input['displayName'] ?? '', 120);
      $installationId = installation_id($input['installationId'] ?? '');
      if (mb_strlen($displayName) < 2) respond(422, array('ok' => false, 'error' => 'Podaj nazwę użytkownika lub firmy.'));
      foreach ($store['users'] as $user) if (hash_equals((string)$user['email'], $mail)) respond(409, array('ok' => false, 'error' => 'Konto o tym adresie już istnieje.'));
      $id = bin2hex(random_bytes(16));
      $user = array('id' => $id, 'email' => $mail, 'displayName' => $displayName, 'passwordHash' => password_hash($password, PASSWORD_DEFAULT), 'createdAt' => time(), 'trialStartedAt' => 0, 'commercial' => null, 'devices' => array());
      $entitlement = active_entitlement($user);
      bind_device($user, $installationId, $entitlement);
      $store['users'][$id] = $user;
      return license_response($user, $entitlement, issue_session($store, $id));
    }
    if ($route === '/auth/login') {
      enforce_rate_limit($store, 'login', 20, 900);
      $mail = email($input['email'] ?? '');
      $password = password_value($input['password'] ?? '');
      $installationId = installation_id($input['installationId'] ?? '');
      $id = null;
      foreach ($store['users'] as $candidateId => $candidate) if (hash_equals((string)$candidate['email'], $mail)) { $id = $candidateId; break; }
      if ($id === null || !password_verify($password, (string)$store['users'][$id]['passwordHash'])) respond(401, array('ok' => false, 'error' => 'Nieprawidłowy e-mail lub hasło.'));
      $user =& $store['users'][$id];
      $entitlement = active_entitlement($user);
      bind_device($user, $installationId, $entitlement);
      return license_response($user, $entitlement, issue_session($store, $id));
    }
    if ($route === '/license/status' || $route === '/license/start-trial') {
      list($id) = require_session($store, $input);
      $user =& $store['users'][$id];
      $installationId = installation_id($input['installationId'] ?? '');
      if ($route === '/license/start-trial' && (int)($user['trialStartedAt'] ?? 0) === 0 && active_entitlement($user)['plan'] !== 'commercial') $user['trialStartedAt'] = time();
      $entitlement = active_entitlement($user);
      bind_device($user, $installationId, $entitlement);
      return license_response($user, $entitlement);
    }
    if ($route === '/auth/logout') {
      list($_id, $sessionHash) = require_session($store, $input);
      unset($store['sessions'][$sessionHash]);
      return array('ok' => true);
    }
    if ($route === '/admin/users') {
      require_admin($store, $input);
      return array('ok' => true, 'users' => array_values(array_map('public_user', $store['users'])));
    }
    if ($route === '/admin/grant-commercial' || $route === '/admin/revoke-commercial') {
      require_admin($store, $input);
      $mail = email($input['email'] ?? '');
      $id = null;
      foreach ($store['users'] as $candidateId => $candidate) if (hash_equals((string)$candidate['email'], $mail)) { $id = $candidateId; break; }
      if ($id === null) respond(404, array('ok' => false, 'error' => 'Nie znaleziono konta.'));
      $user =& $store['users'][$id];
      if ($route === '/admin/revoke-commercial') {
        $user['commercial'] = array('status' => 'revoked', 'revokedAt' => gmdate('c'));
      } else {
        $seats = max(1, min(1000, (int)($input['seats'] ?? 1)));
        $expiresAt = text($input['expiresAt'] ?? '', 40);
        if ($expiresAt !== '' && strtotime($expiresAt) === false) respond(422, array('ok' => false, 'error' => 'Nieprawidłowa data wygaśnięcia.'));
        $user['commercial'] = array('status' => 'active', 'startsAt' => gmdate('c'), 'expiresAt' => $expiresAt, 'seats' => $seats, 'licenseId' => 'commercial-' . bin2hex(random_bytes(8)));
      }
      return array('ok' => true, 'user' => public_user($user));
    }
    if ($route === '/admin/revoke-device') {
      require_admin($store, $input);
      $mail = email($input['email'] ?? '');
      $installationId = installation_id($input['installationId'] ?? '');
      foreach ($store['users'] as &$user) {
        if (!hash_equals((string)$user['email'], $mail)) continue;
        if (!isset($user['devices'][$installationId])) respond(404, array('ok' => false, 'error' => 'Nie znaleziono urządzenia.'));
        $user['devices'][$installationId]['revokedAt'] = time();
        return array('ok' => true, 'user' => public_user($user));
      }
      unset($user);
      respond(404, array('ok' => false, 'error' => 'Nie znaleziono konta.'));
    }
    respond(404, array('ok' => false, 'error' => 'Nieznany endpoint licencji.'));
  });
  respond(200, $result);
} catch (MadcadHttpResponse $response) {
  respond($response->status(), $response->payload());
} catch (Throwable $error) {
  error_log('MadCAD license API: ' . $error->getMessage());
  respond(500, array('ok' => false, 'error' => 'Serwer licencji jest chwilowo niedostępny.'));
}

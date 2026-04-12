<?php
declare(strict_types=1);
require_once __DIR__ . '/../config.php';

const LOGIN_THROTTLE_WINDOW_SEC = 300;
const LOGIN_THROTTLE_MAX_ATTEMPTS = 5;

start_secure_session();

if (clear_session_if_expired(true)) {
  start_secure_session();
  redirect_to_index('?login_err=session');
}

function redirect_to_index(string $qs = ''): void {
  header('Location: ../index.php' . $qs);
  exit;
}

function login_throttle_key(string $username): string {
  $ip = strtolower(trim((string)($_SERVER['REMOTE_ADDR'] ?? 'unknown')));
  $user = strtolower(trim($username));
  return hash('sha256', $user . '|' . $ip);
}

function login_throttle_path(string $username): string {
  return sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'edward_login_' . login_throttle_key($username) . '.json';
}

function read_login_throttle(string $username): array {
  $path = login_throttle_path($username);
  if (!is_file($path)) {
    return ['count' => 0, 'first' => 0];
  }

  $raw = @file_get_contents($path);
  if (!is_string($raw) || $raw === '') {
    return ['count' => 0, 'first' => 0];
  }

  $data = json_decode($raw, true);
  if (!is_array($data)) {
    return ['count' => 0, 'first' => 0];
  }

  $count = isset($data['count']) && is_numeric($data['count']) ? (int)$data['count'] : 0;
  $first = isset($data['first']) && is_numeric($data['first']) ? (int)$data['first'] : 0;

  return ['count' => max(0, $count), 'first' => max(0, $first)];
}

function write_login_throttle(string $username, array $data): void {
  $path = login_throttle_path($username);
  @file_put_contents($path, json_encode($data), LOCK_EX);
}

function clear_login_throttle(string $username): void {
  $path = login_throttle_path($username);
  if (is_file($path)) {
    @unlink($path);
  }
}

function is_login_throttled(string $username): bool {
  if ($username === '') return false;

  $state = read_login_throttle($username);
  $now = time();

  if ($state['first'] <= 0 || ($now - $state['first']) > LOGIN_THROTTLE_WINDOW_SEC) {
    clear_login_throttle($username);
    return false;
  }

  return $state['count'] >= LOGIN_THROTTLE_MAX_ATTEMPTS;
}

function register_login_failure(string $username): void {
  if ($username === '') return;

  $state = read_login_throttle($username);
  $now = time();

  if ($state['first'] <= 0 || ($now - $state['first']) > LOGIN_THROTTLE_WINDOW_SEC) {
    $state = ['count' => 0, 'first' => $now];
  }

  $state['count'] += 1;
  write_login_throttle($username, $state);
}

function is_password_strong(string $password): bool {
  if (strlen($password) < 10) return false;
  if (!preg_match('/[a-z]/', $password)) return false;
  if (!preg_match('/[A-Z]/', $password)) return false;
  if (!preg_match('/\d/', $password)) return false;
  return true;
}

function csrf_ok(): bool {
  $token = $_POST['csrf'] ?? '';
  if (!is_string($token)) return false;
  if (!isset($_SESSION['csrf']) || !is_string($_SESSION['csrf'])) return false;
  return hash_equals($_SESSION['csrf'], $token);
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
  redirect_to_index();
}

$mode = $_POST['mode'] ?? 'login';
if (!is_string($mode)) $mode = 'login';

if (!csrf_ok()) {
  if ($mode === 'register') redirect_to_index('?register_err=csrf');
  if ($mode === 'logout') redirect_to_index();
  redirect_to_index('?login_err=csrf');
}

if ($mode === 'logout') {
  destroy_current_session();
  redirect_to_index();
}

$username = trim((string)($_POST['username'] ?? ''));
$password = (string)($_POST['password'] ?? '');

if ($mode === 'login' && is_login_throttled($username)) {
  redirect_to_index('?login_err=throttled');
}

$pdo = pdo_db();
ensure_schema($pdo);

if ($mode === 'register') {
  $password2 = (string)($_POST['password2'] ?? '');

  if (!preg_match('/^[A-Za-z0-9_]{3,50}$/', $username)) {
    redirect_to_index('?register_err=invalid_user');
  }

  if (!is_password_strong($password)) {
    redirect_to_index('?register_err=weak_pass');
  }

  if ($password !== $password2) {
    redirect_to_index('?register_err=mismatch');
  }

  $stmt = $pdo->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
  $stmt->execute([$username]);
  if ($stmt->fetchColumn()) {
    redirect_to_index('?register_err=taken');
  }

  $hash = password_hash($password, PASSWORD_DEFAULT);
  $stmt = $pdo->prepare('INSERT INTO users (username, password_hash) VALUES (?, ?)');
  $ok = $stmt->execute([$username, $hash]);

  if (!$ok) {
    redirect_to_index('?register_err=server');
  }

  $userId = (int)$pdo->lastInsertId();
  session_regenerate_id(true);
  $_SESSION['user_id'] = $userId;
  $_SESSION['username'] = $username;
  refresh_session_activity();

  redirect_to_index('?register_ok=1');
}

$stmt = $pdo->prepare('SELECT id, password_hash FROM users WHERE username = ? LIMIT 1');
$stmt->execute([$username]);
$row = $stmt->fetch(PDO::FETCH_ASSOC);

if (!$row || !password_verify($password, (string)$row['password_hash'])) {
  register_login_failure($username);
  redirect_to_index('?login_err=bad');
}

clear_login_throttle($username);

session_regenerate_id(true);
$_SESSION['user_id'] = (int)$row['id'];
$_SESSION['username'] = $username;
refresh_session_activity();

redirect_to_index();
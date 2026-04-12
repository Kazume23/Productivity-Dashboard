<?php
declare(strict_types=1);

const DB_HOST = '127.0.0.1';
const DB_USER = 'root';
const DB_PASS = '';
const DB_NAME = 'edward_tracker';
const DB_CHARSET = 'utf8mb4';
const SESSION_IDLE_TIMEOUT_SEC = 3600;

function env_string(string $key, string $default = ''): string {
  $value = getenv($key);
  if ($value === false || $value === '') return $default;
  return $value;
}

function env_int(string $key, int $default): int {
  $value = getenv($key);
  if ($value === false || $value === '') return $default;
  if (!is_numeric($value)) return $default;
  return (int)$value;
}

function db_host(): string {
  return env_string('EDWARD_DB_HOST', DB_HOST);
}

function db_user(): string {
  return env_string('EDWARD_DB_USER', DB_USER);
}

function db_pass(): string {
  $value = getenv('EDWARD_DB_PASS');
  return $value === false ? DB_PASS : (string)$value;
}

function db_name(): string {
  return env_string('EDWARD_DB_NAME', DB_NAME);
}

function db_charset(): string {
  return env_string('EDWARD_DB_CHARSET', DB_CHARSET);
}

function session_idle_timeout_sec(): int {
  $value = env_int('EDWARD_SESSION_IDLE_TIMEOUT_SEC', SESSION_IDLE_TIMEOUT_SEC);
  return $value > 0 ? $value : SESSION_IDLE_TIMEOUT_SEC;
}

function session_cookie_samesite(): string {
  $value = env_string('EDWARD_SESSION_SAMESITE', 'Lax');
  $allowed = ['Lax', 'Strict', 'None'];
  return in_array($value, $allowed, true) ? $value : 'Lax';
}

function is_https_request(): bool {
  if (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') return true;
  if (isset($_SERVER['SERVER_PORT']) && (int)$_SERVER['SERVER_PORT'] === 443) return true;
  if (!empty($_SERVER['HTTP_X_FORWARDED_PROTO']) && strtolower((string)$_SERVER['HTTP_X_FORWARDED_PROTO']) === 'https') return true;
  return false;
}

function start_secure_session(): void {
  if (session_status() === PHP_SESSION_ACTIVE) return;

  session_set_cookie_params([
    'lifetime' => 0,
    'path' => '/',
    'secure' => is_https_request(),
    'httponly' => true,
    'samesite' => session_cookie_samesite(),
  ]);

  ini_set('session.use_strict_mode', '1');
  ini_set('session.use_only_cookies', '1');

  session_start();
}

function destroy_current_session(): void {
  $_SESSION = [];

  if (ini_get('session.use_cookies')) {
    $params = session_get_cookie_params();
    setcookie(
      session_name(),
      '',
      time() - 42000,
      $params['path'],
      $params['domain'],
      (bool)$params['secure'],
      (bool)$params['httponly']
    );
  }

  session_destroy();
}

function clear_session_if_expired(bool $onlyWhenAuthenticated = true): bool {
  if ($onlyWhenAuthenticated) {
    $isAuthenticated = isset($_SESSION['user_id']) && (int)$_SESSION['user_id'] > 0;
    if (!$isAuthenticated) return false;
  }

  $timeout = session_idle_timeout_sec();
  $now = time();
  $last = $_SESSION['last_activity'] ?? null;

  if (!is_int($last)) {
    $_SESSION['last_activity'] = $now;
    return false;
  }

  if (($now - $last) > $timeout) {
    destroy_current_session();
    return true;
  }

  $_SESSION['last_activity'] = $now;
  return false;
}

function refresh_session_activity(): void {
  $_SESSION['last_activity'] = time();
}

function json_response(array $data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function pdo_no_db(): PDO {
  $dsn = 'mysql:host=' . db_host() . ';charset=' . db_charset();
  return new PDO($dsn, db_user(), db_pass(), [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);
}

function pdo_db(): PDO {
  ensure_database();
  $dsn = 'mysql:host=' . db_host() . ';dbname=' . db_name() . ';charset=' . db_charset();
  $pdo = new PDO($dsn, db_user(), db_pass(), [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);
  ensure_schema($pdo);
  return $pdo;
}

function ensure_database(): void {
  $pdo = pdo_no_db();
  $sql = 'CREATE DATABASE IF NOT EXISTS `' . db_name() . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci';
  $pdo->exec($sql);
}

function ensure_schema(PDO $pdo): void {
  $pdo->exec("
    CREATE TABLE IF NOT EXISTS users (
      id INT UNSIGNED NOT NULL AUTO_INCREMENT,
      username VARCHAR(50) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (id),
      UNIQUE KEY uq_users_username (username)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  ");

  $pdo->exec("
    CREATE TABLE IF NOT EXISTS user_state (
      user_id INT UNSIGNED NOT NULL,
      state_json LONGTEXT NULL,
      version INT UNSIGNED NOT NULL DEFAULT 0,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
      PRIMARY KEY (user_id),
      CONSTRAINT fk_user_state_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  ");

  ensure_user_state_version_column($pdo);
}

function ensure_user_state_version_column(PDO $pdo): void {
  $stmt = $pdo->prepare('
    SELECT COUNT(*)
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = ?
      AND TABLE_NAME = ?
      AND COLUMN_NAME = ?
  ');
  $stmt->execute([db_name(), 'user_state', 'version']);

  $exists = (int)$stmt->fetchColumn() > 0;
  if ($exists) return;

  $pdo->exec('ALTER TABLE user_state ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 0 AFTER state_json');
}



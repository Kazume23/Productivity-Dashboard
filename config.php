<?php
declare(strict_types=1);

const DB_HOST = '127.0.0.1';
const DB_USER = 'root';
const DB_PASS = '';
const DB_NAME = 'edward_tracker';
const DB_CHARSET = 'utf8mb4';

function json_response(array $data, int $status = 200): void {
  http_response_code($status);
  header('Content-Type: application/json; charset=utf-8');
  echo json_encode($data, JSON_UNESCAPED_UNICODE);
  exit;
}

function pdo_no_db(): PDO {
  $dsn = 'mysql:host=' . DB_HOST . ';charset=' . DB_CHARSET;
  return new PDO($dsn, DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);
}

function pdo_db(): PDO {
  ensure_database();
  $dsn = 'mysql:host=' . DB_HOST . ';dbname=' . DB_NAME . ';charset=' . DB_CHARSET;
  $pdo = new PDO($dsn, DB_USER, DB_PASS, [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
  ]);
  ensure_schema($pdo);
  return $pdo;
}

function ensure_database(): void {
  $pdo = pdo_no_db();
  $sql = 'CREATE DATABASE IF NOT EXISTS `' . DB_NAME . '` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci';
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
  $stmt->execute([DB_NAME, 'user_state', 'version']);

  $exists = (int)$stmt->fetchColumn() > 0;
  if ($exists) return;

  $pdo->exec('ALTER TABLE user_state ADD COLUMN version INT UNSIGNED NOT NULL DEFAULT 0 AFTER state_json');
}



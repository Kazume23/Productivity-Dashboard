<?php

declare(strict_types=1);

require __DIR__ . '/../config.php';

start_secure_session();

if (clear_session_if_expired(true)) {
  json_response(['ok' => false, 'error' => 'session_expired'], 401);
}

function read_json_body(): array
{
  $raw = file_get_contents('php://input');

  if ($raw === false || $raw === '') {
    return [];
  }

  $data = json_decode($raw, true);

  return is_array($data) ? $data : [];
}

function csrf_header_ok(): bool
{
  $sessionToken = $_SESSION['csrf'] ?? '';
  $headerToken = $_SERVER['HTTP_X_CSRF_TOKEN'] ?? '';

  return is_string($sessionToken)
    && $sessionToken !== ''
    && is_string($headerToken)
    && hash_equals($sessionToken, $headerToken);
}

function parse_client_version(array $body): int
{
  if (!array_key_exists('version', $body)) {
    return 0;
  }

  $raw = $body['version'];

  if (is_int($raw)) {
    return $raw;
  }

  if (is_string($raw) && ctype_digit($raw)) {
    return (int)$raw;
  }

  return -1;
}

function decode_state_json_from_row(array $row): ?array
{
  $json = $row['state_json'] ?? null;
  if (!is_string($json) || $json === '') {
    return null;
  }

  $state = json_decode($json, true);
  return is_array($state) ? $state : null;
}

function updated_at_ms_from_row(array $row): int
{
  $updatedAtMs = 0;

  if (!empty($row['updated_at'])) {
    $ts = strtotime((string)$row['updated_at']);
    if ($ts !== false) {
      $updatedAtMs = $ts * 1000;
    }
  }

  return $updatedAtMs;
}

$userId = isset($_SESSION['user_id']) ? (int)$_SESSION['user_id'] : 0;
if ($userId <= 0) {
  json_response(['ok' => false, 'error' => 'unauthorized'], 401);
}

$pdo = pdo_db();

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method === 'GET') {
  $stmt = $pdo->prepare('SELECT state_json, updated_at, version FROM user_state WHERE user_id = ? LIMIT 1');
  $stmt->execute([$userId]);
  $row = $stmt->fetch();

  if (!$row) {
    json_response([
      'ok' => true,
      'updatedAtMs' => 0,
      'version' => 0,
      'state' => null,
    ]);
  }

  $state = decode_state_json_from_row($row);
  $updatedAtMs = updated_at_ms_from_row($row);
  $version = (int)($row['version'] ?? 0);

  json_response([
    'ok' => true,
    'updatedAtMs' => $updatedAtMs,
    'version' => $version,
    'state' => $state,
  ]);
}

if ($method === 'POST') {

  if (!csrf_header_ok()) {
    json_response(['ok' => false, 'error' => 'csrf'], 403);
  }

  $body = read_json_body();
  $state = $body['state'] ?? null;

  if (!is_array($state)) {
    json_response(['ok' => false, 'error' => 'bad_state'], 400);
  }

  $clientVersion = parse_client_version($body);
  if ($clientVersion < 0) {
    json_response(['ok' => false, 'error' => 'bad_version'], 400);
  }

  $json = json_encode($state, JSON_UNESCAPED_UNICODE);
  if (!is_string($json)) {
    json_response(['ok' => false, 'error' => 'json_encode_failed'], 500);
  }

  try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare('SELECT state_json, updated_at, version FROM user_state WHERE user_id = ? LIMIT 1 FOR UPDATE');
    $stmt->execute([$userId]);
    $current = $stmt->fetch();

    if (!$current) {
      if ($clientVersion !== 0) {
        $pdo->rollBack();
        json_response([
          'ok' => false,
          'error' => 'conflict',
          'updatedAtMs' => 0,
          'version' => 0,
          'state' => null,
        ], 409);
      }

      $insert = $pdo->prepare('INSERT INTO user_state (user_id, state_json, version) VALUES (?, ?, 1)');
      $insert->execute([$userId, $json]);
    } else {
      $serverVersion = (int)($current['version'] ?? 0);

      if ($clientVersion !== $serverVersion) {
        $conflictState = decode_state_json_from_row($current);
        $conflictUpdatedAtMs = updated_at_ms_from_row($current);

        $pdo->rollBack();
        json_response([
          'ok' => false,
          'error' => 'conflict',
          'updatedAtMs' => $conflictUpdatedAtMs,
          'version' => $serverVersion,
          'state' => $conflictState,
        ], 409);
      }

      $update = $pdo->prepare('UPDATE user_state SET state_json = ?, version = version + 1 WHERE user_id = ?');
      $update->execute([$json, $userId]);
    }

    $stmt2 = $pdo->prepare('SELECT updated_at, version FROM user_state WHERE user_id = ? LIMIT 1');
    $stmt2->execute([$userId]);
    $saved = $stmt2->fetch();

    $pdo->commit();

    $updatedAtMs = $saved ? updated_at_ms_from_row($saved) : 0;
    $version = $saved ? (int)($saved['version'] ?? 0) : 0;

    json_response([
      'ok' => true,
      'updatedAtMs' => $updatedAtMs,
      'version' => $version,
    ]);
  } catch (Throwable $e) {
    if ($pdo->inTransaction()) {
      $pdo->rollBack();
    }
    throw $e;
  }
}

json_response(['ok' => false, 'error' => 'method_not_allowed'], 405);

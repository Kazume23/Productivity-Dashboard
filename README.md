# Edward Tracker

A full-stack personal productivity app built with PHP, MySQL, and vanilla JavaScript.

Project scope (current): one interface for tasks, habits, finance tracking, wishlist, pomodoro, and dashboard analytics with local-first persistence plus server sync for authenticated users.

## Current Features

- Dashboard with daily summary cards, quick actions, trend charts, and recent activity
- ToDo Pro with priorities, due dates, recurring tasks, checklist/subtasks, SLA badges, and Kanban lanes
- Habits Pro with weekly tracker, period goals (week/month), streak freeze, templates, and habit analytics charts
- Finance Pro with expense ledger, category budgets, recurring costs, savings goals, month-over-month comparison, and upcoming recurring costs
- Import/Export for finance module:
  - CSV + XLS/XLSX import
  - finance JSON export
  - expenses CSV export
  - full state backup export/import JSON
- Wishlist with sorting modes (date, price, name)
- Pomodoro with focus/break/long modes, editable duration, and running-session restore
- Browser reminders for overdue/open ToDo and habits:
  - configurable start/end hours
  - daily limit and cooldown anti-spam
  - Notification API with toast fallback
- Local-first state model:
  - works in guest mode using localStorage
  - optional server sync after login
- Auth hardening:
  - CSRF protection
  - session timeout
  - login throttling
  - password strength policy

## Tech Stack

- Backend: PHP 8+, PDO, MySQL/MariaDB
- Frontend: HTML, CSS, vanilla JavaScript (modular files, no framework)
- Charts: Chart.js (CDN)
- Spreadsheet import: SheetJS XLSX (CDN)
- Runtime: XAMPP (Apache + MySQL)

## Project Structure

- `index.php` - app shell, views, modals, script/style loading, CSRF/data attributes
- `config.php` - DB/session configuration, schema bootstrap, env overrides
- `api/auth.php` - login/register/logout, password policy, throttling, CSRF checks
- `api/state.php` - GET/POST state sync endpoint with version conflict detection
- `js/core/config.js` - runtime config from DOM dataset (`AUTH_USER`, `CSRF_TOKEN`, API URL)
- `js/core/storage.js` - localStorage strategy for guest and per-user keys
- `js/core/state.js` - state defaults + sanitization + `saveState`
- `js/core/api.js` - sync queue, retry/backoff, conflict handling
- `js/core/elements.js` - centralized DOM references
- `js/modules/theme.js` - theme cycle + persistence
- `js/modules/auth.js` - login/register modal behavior
- `js/modules/calendar.js` - calendar rendering + activity badges
- `js/modules/habits.js` - habits tracker + Habits Pro logic
- `js/modules/reminders.js` - reminder scheduler + Notification API fallback
- `js/modules/dashboard/todo.js` - ToDo Pro and Kanban logic
- `js/modules/dashboard/expenses.js` - Finance Pro logic
- `js/modules/dashboard/chart.js` - habits charts and comparisons
- `js/modules/dashboard/wishlist.js` - wishlist CRUD + sort
- `js/modules/dashboard/pomodoro.js` - pomodoro timer logic
- `js/app.js` - app bootstrap flow, view routing, dashboard aggregates

## State and Sync Model

- State is kept in one global object (`state`) in the frontend.
- Local persistence:
  - guest: `habit_app_anon_v1`
  - authenticated user: `habit_app_user_<username>`
- Server persistence:
  - MySQL table `user_state` (JSON snapshot + `version`)
- Conflict strategy:
  - optimistic versioning on `api/state.php`
  - if client version != server version, API returns conflict payload and frontend applies newer server state
- Sync behavior:
  - queued writes with retry/backoff
  - sync status badge + toast notifications

## Security Baseline

- CSRF token generated in session and validated in auth and state write endpoints
- Session cookie hardened with `HttpOnly`, `SameSite`, and `secure` when HTTPS is detected
- Idle session timeout (default 3600s, configurable)
- Login throttling by user+IP window (5 attempts / 5 minutes)
- Password policy:
  - min 10 chars
  - at least one lowercase letter
  - at least one uppercase letter
  - at least one digit

## Local Setup (XAMPP)

1. Copy/clone repository to `C:\xampp\htdocs\Edward`
2. Start Apache and MySQL in XAMPP Control Panel
3. Open app in browser:
   - `http://localhost/Edward`
4. On first run, database and tables are created automatically by backend bootstrap

## Optional Environment Variables

- `EDWARD_DB_HOST`
- `EDWARD_DB_USER`
- `EDWARD_DB_PASS`
- `EDWARD_DB_NAME`
- `EDWARD_DB_CHARSET`
- `EDWARD_SESSION_IDLE_TIMEOUT_SEC`
- `EDWARD_SESSION_SAMESITE`

If not provided, defaults from `config.php` are used.

## Development Notes

- No build step and no package manager pipeline required
- Edit files directly and refresh browser
- Frontend architecture is intentionally procedural (simple functions + shared state)
- UI text is primarily Polish
- There is no automated test suite yet (manual smoke testing recommended)

## Practical Smoke Checklist

1. Register a new user and log in
2. Add habit, toggle entries in weekly grid, switch chart week/month
3. Add ToDo with recurrence + checklist, move card across Kanban lanes
4. Add expenses, create budget + recurring cost + savings goal
5. Import one CSV or XLSX file and verify summary/report
6. Export finance JSON and full backup JSON
7. Toggle theme and reload page
8. Open second tab, edit data, verify sync/conflict behavior

## Known Limitations

- Chart.js and XLSX are loaded from CDN (offline-first for those features depends on cache/network)
- No automated tests in repository
- No dedicated background push (service worker); reminders are browser-session based
- Full-state overwrite model on server sync (by design with optimistic conflict handling)

## Project Status

Active development. Current codebase reflects iterative releases with ToDo Pro, Habits Pro, Finance Pro, and browser reminders already integrated.

## License

No license file has been added yet.
If you plan to open the project publicly, add a license (for example MIT).

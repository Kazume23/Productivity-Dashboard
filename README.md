# Edward Tracker

A full-stack personal productivity dashboard built with PHP, MySQL, and vanilla JavaScript.

This project combines habit tracking, daily planning, expense logging, and focus sessions in one app, with local-first state handling and server sync for authenticated users.

## Project Highlights

- Multi-feature dashboard in one workflow:
  - Habit tracker + balance chart
  - Calendar + date-based TODOs
  - Expense journal with categories and scoring
  - Wishlist
  - Pomodoro timer
- Theme system with runtime switching and persisted user preference
- Local-first UX with server synchronization for signed-in users
- Optimistic state versioning to reduce accidental overwrites
- Auth hardening:
  - CSRF protection
  - Session timeout handling
  - Login throttling
  - Password strength policy

## Tech Stack

- Backend: PHP 8+, PDO, MySQL
- Frontend: HTML, CSS, vanilla JavaScript (modular files, no framework)
- Runtime: XAMPP (Apache + MySQL)
- Persistence:
  - localStorage (guest and per-user local state)
  - MySQL `user_state` table (JSON snapshot + version)

## Architecture Overview

### Frontend

- `js/core/`:
  - config and constants
  - DOM helpers
  - local storage helpers
  - shared state shape/sanitization
  - API sync helpers
- `js/modules/`:
  - auth, calendar, habits, theme
- `js/modules/dashboard/`:
  - todo, expenses, chart, wishlist, pomodoro
- `js/app.js`:
  - orchestrates startup and module initialization

### Backend

- `api/auth.php`:
  - register/login/logout flow
  - CSRF validation
  - login throttling
- `api/state.php`:
  - GET/POST user state
  - optimistic version checks
  - conflict handling
- `config.php`:
  - DB/session config
  - env-based overrides
  - schema bootstrap

## Local Setup (XAMPP)

1. Clone or copy the project into your XAMPP `htdocs` directory.
2. Start Apache and MySQL from XAMPP.
3. Open the app in the browser:
   - `http://localhost/Edward`
4. On first run, the app creates the database and required tables automatically.

## Environment Variables (Optional)

You can override local defaults via environment variables:

- `EDWARD_DB_HOST`
- `EDWARD_DB_USER`
- `EDWARD_DB_PASS`
- `EDWARD_DB_NAME`
- `EDWARD_DB_CHARSET`
- `EDWARD_SESSION_IDLE_TIMEOUT_SEC`
- `EDWARD_SESSION_SAMESITE`

If variables are not provided, local defaults from `config.php` are used.

## Current Focus

- UX polish for first paint and theme loading
- CSS architecture cleanup (tokenized themes and deduplicated styles)
- Better regression safety through smoke checks

## Roadmap

- [x] Modularize dashboard logic into feature files
- [x] Add optimistic state sync versioning
- [x] Harden auth/session baseline
- [x] Reduce theme CSS duplication with variable-based themes
- [ ] Add lightweight smoke test checklist/script
- [ ] Add export/reporting improvements
- [ ] Improve mobile responsiveness and accessibility pass

## Notes

- This repository is actively iterated.
- Some features are intentionally simple by design to keep velocity high while improving reliability.

## License

No license file has been added yet.
If you plan to make this public for broader reuse, add a license (for example MIT).

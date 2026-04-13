<?php
declare(strict_types=1);
require_once __DIR__ . '/config.php';

start_secure_session();
$sessionExpired = clear_session_if_expired(true);
if ($sessionExpired) {
  start_secure_session();
}

if (empty($_SESSION['csrf'])) {
  $_SESSION['csrf'] = bin2hex(random_bytes(32));
}
$csrf = $_SESSION['csrf'];

$authUser = $_SESSION['username'] ?? null;

$loginErr = '';
if (isset($_GET['login_err'])) {
  $code = (string)$_GET['login_err'];
  if ($code === 'csrf' || $code === 'session') $loginErr = 'Sesja wygasła, spróbuj ponownie';
  else if ($code === 'throttled') $loginErr = 'Zbyt wiele prób logowania. Spróbuj ponownie za chwilę';
  else $loginErr = 'Błędny login lub hasło';
}

if (!$loginErr && $sessionExpired) {
  $loginErr = 'Sesja wygasła, spróbuj ponownie';
}

$registerErr = '';
$registerOk = isset($_GET['register_ok']) && (string)$_GET['register_ok'] === '1';

if (isset($_GET['register_err'])) {
  $code = (string)$_GET['register_err'];
  if ($code === 'csrf') $registerErr = 'Sesja wygasła, spróbuj ponownie';
  else if ($code === 'taken') $registerErr = 'Login jest zajęty';
  else if ($code === 'invalid_user') $registerErr = 'Login musi mieć 3 do 50 znaków i zawierać tylko litery, cyfry lub podkreślnik';
  else if ($code === 'weak_pass') $registerErr = 'Hasło musi mieć min. 10 znaków oraz zawierać małą i wielką literę oraz cyfrę';
  else if ($code === 'mismatch') $registerErr = 'Hasła nie są takie same';
  else $registerErr = 'Rejestracja nieudana';
}
?>

<!doctype html>
<html lang="pl">

<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Edward Tracker</title>
<link rel="stylesheet" href="style/style.css" id="baseStyles">
<link rel="stylesheet" href="style/theme-ira.css" id="themeStyles" media="not all">
<link rel="stylesheet" href="style/styletrybjasny1.css" id="themelight" media="not all">
<link rel="stylesheet" href="style/styletrybrozowy.css" id="themepink" media="not all">
  <script>
    (() => {
      const key = "edward_theme_v1";
      const themeIds = ["themeStyles", "themelight", "themepink"];
      let saved = "base";

      try {
        const raw = localStorage.getItem(key) || "base";
        if (raw === "base" || themeIds.includes(raw)) {
          saved = raw;
        }
      } catch (e) {}

      const base = document.getElementById("baseStyles");
      if (base) {
        base.disabled = false;
        base.media = "all";
      }

      themeIds.forEach((id) => {
        const link = document.getElementById(id);
        if (!link) return;
        link.disabled = false;
        link.media = saved === id ? "all" : "not all";
      });
    })();
  </script>
  <link rel="icon" type="image/png" href="favicon.png">
  
</head>

<body
  data-auth-user="<?= htmlspecialchars((string)($authUser ?? ''), ENT_QUOTES, 'UTF-8') ?>"
  data-api-state-url="./api/state.php"
  data-register-ok="<?= $registerOk ? '1' : '0' ?>"
  data-csrf="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>"
>
  <div class="app">
    <div class="sidebar" id="sidebarNav">
      <div class="logo">  
        <span class="logoMark" aria-hidden="true"></span>
        <span class="logoText">Edward</span>
        <button class="sidebarCloseBtn" id="sidebarCloseBtn" type="button" aria-label="Zamknij menu">×</button>
      </div>

      <div class="nav">
        <div class="navRow">
          <button class="navItem" id="navDash" type="button">Dashboard</button>
        </div>

        <div class="navRow">
          <button class="navItem" id="navTodo" type="button">ToDo</button>
          <button class="navAddBtn" id="navAddTodo" type="button" title="Dodaj ToDo" aria-label="Dodaj ToDo">+</button>
        </div>

        <div class="navRow">
          <button class="navItem" id="navHabits" type="button">Nawyki</button>
          <button class="navAddBtn" id="navAddHabits" type="button" title="Dodaj nawyk" aria-label="Dodaj nawyk">+</button>
        </div>

        <div class="navRow">
          <button class="navItem" id="navExpenses" type="button">Wydatki</button>
          <button class="navAddBtn" id="navAddExpenses" type="button" title="Dodaj wydatek" aria-label="Dodaj wydatek">+</button>
        </div>

        <div class="navRow">
          <button class="navItem" id="navWishlist" type="button">Wishlist</button>
          <button class="navAddBtn" id="navAddWishlist" type="button" title="Dodaj do wishlisty" aria-label="Dodaj do wishlisty">+</button>
        </div>
      </div>

      <div class="sidebarFooter">
        <div class="authBox" id="authBox">
          <div class="authTop">
            <div class="authTitle">Konto</div>
          </div>

          <div class="authStatus" id="authStatus">
            <?php if ($authUser): ?>
              Zalogowano: <?= htmlspecialchars($authUser, ENT_QUOTES, 'UTF-8') ?>
            <?php else: ?>
              Nie zalogowano
            <?php endif; ?>
          </div>

          <div class="authActions">
              <?php if ($authUser): ?>
                <form method="post" action="api/auth.php" class="inlineForm">
                  <input type="hidden" name="mode" value="logout">
                  <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES) ?>">
                  <button class="calBtn" type="submit">Wyloguj</button>
                </form>
              <?php else: ?>
              <button class="habBtn" id="openLoginBtn" type="button">Zaloguj</button>
              <button class="calBtn" id="openRegisterBtn" type="button">Rejestruj</button>
            <?php endif; ?>
          </div>
        </div>
      </div>


    </div>

    <button class="sidebarOverlay" id="sidebarOverlay" type="button" aria-label="Zamknij menu"></button>

    <div class="main">
      <div class="topbar">
        <div class="topbarLeft">
          <button class="iconBtn mobileMenuBtn" id="mobileMenuBtn" type="button" aria-label="Otwórz menu" aria-expanded="false" aria-controls="sidebarNav">
            <svg class="iconSvg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path fill="currentColor" d="M4 6h16v2H4V6Zm0 5h16v2H4v-2Zm0 5h16v2H4v-2Z"/>
            </svg>
          </button>

          <div class="titleWrap">
            <div class="title" id="pageTitle">Dashboard</div>
            <div class="titleMeta" id="pageSubtitle">Przegląd dnia i postępów</div>
          </div>
        </div>
          <div class="icons">
            <button class="icon iconBtn" id="langBtn" type="button" title="Zmień język">
              <svg class="iconSvg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="currentColor"
                  d="M12 2a10 10 0 1 0 .001 20.001A10 10 0 0 0 12 2Zm7.93 9h-3.1a15.6 15.6 0 0 0-1.2-5.02A8.03 8.03 0 0 1 19.93 11ZM12 4c.88 1.22 1.57 3.07 1.9 5H10.1c.33-1.93 1.02-3.78 1.9-5Zm-1.9 7h3.8c.1.64.1 1.31.1 2s0 1.36-.1 2h-3.8c-.1-.64-.1-1.31-.1-2s0-1.36.1-2Zm-1.73-5.02A15.6 15.6 0 0 0 7.17 11H4.07a8.03 8.03 0 0 1 4.3-5.02ZM4.07 13h3.1c.19 1.74.62 3.44 1.2 5.02A8.03 8.03 0 0 1 4.07 13Zm7.93 7c-.88-1.22-1.57-3.07-1.9-5h3.8c-.33 1.93-1.02 3.78-1.9 5Zm3.63-1.98A15.6 15.6 0 0 0 16.83 13h3.1a8.03 8.03 0 0 1-4.3 5.02Z"/>
              </svg>
            </button>

          <button class="icon iconBtn" id="themeBtn" type="button" title="Motyw">
              <svg class="iconSvg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="currentColor"
                  d="M12 3a1 1 0 0 1 1 1v1a1 1 0 1 1-2 0V4a1 1 0 0 1 1-1Zm0 14a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm7-5a1 1 0 0 1 1-1h1a1 1 0 1 1 0 2h-1a1 1 0 0 1-1-1Zm-16 0a1 1 0 0 1 1-1H3a1 1 0 1 1 0 2h1a1 1 0 0 1-1-1Zm11.66 6.66a1 1 0 0 1 1.41 0l.7.7a1 1 0 0 1-1.41 1.41l-.7-.7a1 1 0 0 1 0-1.41ZM7.64 5.64a1 1 0 0 1 1.41 0l.7.7a1 1 0 0 1-1.41 1.41l-.7-.7a1 1 0 0 1 0-1.41Zm0 12.72a1 1 0 0 1 0-1.41l.7-.7a1 1 0 0 1 1.41 1.41l-.7.7a1 1 0 0 1-1.41 0Zm12.72-12.72a1 1 0 0 1 0 1.41l-.7.7a1 1 0 0 1-1.41-1.41l.7-.7a1 1 0 0 1 1.41 0Z"/>
              </svg>
            </button> 

            <a class="icon iconBtn" id="ghBtn"
              href="https://github.com/Kazume23/Edward-Cullen"
              target="_blank" rel="noreferrer"
              title="GitHub">

              <svg class="iconSvg" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path fill="currentColor"
                  d="M12 .5C5.73.5.5 5.74.5 12.02c0 5.11 3.29 9.43 7.86 10.96.58.11.79-.25.79-.56v-2.1c-3.2.7-3.87-1.38-3.87-1.38-.53-1.34-1.3-1.7-1.3-1.7-1.06-.73.08-.72.08-.72 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.41-1.27.75-1.56-2.55-.29-5.23-1.28-5.23-5.68 0-1.26.45-2.29 1.19-3.1-.12-.29-.52-1.46.11-3.05 0 0 .97-.31 3.18 1.18a11.07 11.07 0 0 1 5.8 0c2.2-1.49 3.17-1.18 3.17-1.18.63 1.59.23 2.76.11 3.05.74.81 1.19 1.84 1.19 3.1 0 4.41-2.68 5.38-5.24 5.66.42.36.8 1.08.8 2.18v3.23c0 .31.21.67.8.56A11.52 11.52 0 0 0 23.5 12C23.5 5.74 18.27.5 12 .5z"/>
              </svg>
            </a>
          </div>
      </div>
    <div class="content" id="appContent">
      <section class="view viewDashboard isActive" id="viewDash" data-view="dashboard" aria-hidden="false">
        <div class="heroPanel box">
          <div class="heroMeta" id="heroDateText">Dzisiaj</div>
          <div class="heroTitle">Control center dnia</div>
          <div class="heroStatus" id="heroStatusText">Sprawdź priorytety i rusz z najważniejszym zadaniem.</div>

          <div class="heroMetrics">
            <div class="heroMetric">
              <span>Focus</span>
              <strong id="heroFocusValue">25:00</strong>
            </div>
            <div class="heroMetric">
              <span>Zadania na dziś</span>
              <strong id="heroTodoValue">0</strong>
            </div>
            <div class="heroMetric">
              <span>Wydatki dziś</span>
              <strong id="heroSpendValue">0,00 zł</strong>
            </div>
          </div>

          <div class="heroActions">
            <button class="habBtn" id="heroOpenTodo" type="button">Przejdź do ToDo</button>
            <button class="calBtn" id="heroOpenHabits" type="button">Przejdź do Nawyków</button>
            <button class="calBtn" id="heroAddExpense" type="button">Dodaj wydatek</button>
          </div>
        </div>

        <div class="summaryStrip">
          <article class="summaryCard box">
            <span class="summaryLabel">ToDo dziś</span>
            <strong class="summaryValue" id="dashTodayTodos">0</strong>
          </article>
          <article class="summaryCard box">
            <span class="summaryLabel">Najlepszy streak</span>
            <strong class="summaryValue" id="dashBestStreak">0 dni</strong>
          </article>
          <article class="summaryCard box">
            <span class="summaryLabel">Miesięczne wydatki</span>
            <strong class="summaryValue" id="dashMonthSpend">0,00 zł</strong>
          </article>
          <article class="summaryCard box">
            <span class="summaryLabel">Wishlist budżet</span>
            <strong class="summaryValue" id="dashWishlistValue">0,00 zł</strong>
          </article>
        </div>

        <div class="dashMainGrid">
          <div class="box topB dashCalendarCard">
            <div class="cal">
              <div class="calHeader">
                <button class="calBtn" id="calPrev" type="button">‹</button>
                <div class="calTitle" id="calTitle">Miesiąc 2026</div>
                <div class="calRight">
                  <button class="calBtn" id="calToday" type="button" data-i18n="cal.today">Dziś</button>
                  <button class="calBtn" id="calNext" type="button">›</button>
                </div>
              </div>

              <div class="calWeekdays">
                <div data-i18n="cal.wd.mon">PN</div>
                <div data-i18n="cal.wd.tue">WT</div>
                <div data-i18n="cal.wd.wed">ŚR</div>
                <div data-i18n="cal.wd.thu">CZ</div>
                <div data-i18n="cal.wd.fri">PT</div>
                <div data-i18n="cal.wd.sat">SB</div>
                <div data-i18n="cal.wd.sun">ND</div>
              </div>

              <div class="calGrid" id="calGrid"></div>
            </div>
          </div>

          <div class="box dashTodoCard">
            <div class="panelTitle todoTitleRow">
              <div class="todoTitleText">
                <span>Najbliższe zadania</span>
                <span class="todoTitleSub" id="dashboardTodoSub"></span>
              </div>

              <div class="inlineActions">
                <button type="button" class="todoAddBtn" id="dashAddTodoBtn" aria-label="Dodaj ToDo">+</button>
                <button type="button" class="calBtn" id="dashGoTodoBtn">Pełny widok</button>
              </div>
            </div>

            <div class="panelBody">
              <div id="dashboardTodoEmpty" class="todoEmpty">Brak ToDo do podglądu.</div>
              <div id="dashboardTodoList" class="todoList todoPreviewList"></div>
            </div>
          </div>
        </div>

        <div class="dashSideGrid">
          <div class="box pomoBox dashPomoCard">
            <div class="panelTitle">Pomodoro</div>
            <div class="panelBody pomoBody">
              <div class="pomoMode">
                <button class="pomoTab isActive" id="pomoFocus" type="button">Focus</button>
                <button class="pomoTab" id="pomoBreak" type="button">Break</button>
                <button class="pomoTab" id="pomoLong" type="button">Long</button>
              </div>

              <div class="pomoTime" id="pomoTime">25:00</div>

              <div class="pomoActions">
                <button class="habBtn" id="pomoStart" type="button">Start</button>
                <button class="habBtn" id="pomoReset" type="button">Reset</button>
              </div>

              <div class="pomoMeta">Sesja: <span id="pomoSession">0</span></div>
            </div>
          </div>

          <div class="box dashHabitCard">
            <div class="panelTitle">Bilans nawyków (skrót)</div>
            <div class="panelBody">
              <div class="dashHabitStats">
                <div><span>Wykonane</span><b id="dashHabitDone">0</b></div>
                <div><span>Zawalone</span><b id="dashHabitFail">0</b></div>
                <div><span>Puste</span><b id="dashHabitEmpty">0</b></div>
              </div>
              <div class="dashHabitRate">Skuteczność: <strong id="dashHabitRate">0%</strong></div>
              <button class="calBtn" id="dashGoHabitsBtn" type="button">Przejdź do Nawyków</button>
            </div>
          </div>

          <div class="box dashFinanceCard">
            <div class="panelTitle">Finanse i wishlist</div>
            <div class="panelBody">
              <div class="dashFinanceRow"><span>Miesięczne wydatki</span><b id="dashExpenseMonth">0,00 zł</b></div>
              <div class="dashFinanceRow"><span>Liczba wydatków</span><b id="dashExpenseCount">0</b></div>
              <div class="dashFinanceRow"><span>Pozycje wishlisty</span><b id="dashWishlistCount">0</b></div>
              <div class="dashFinanceRow"><span>Budżet wishlisty</span><b id="dashWishlistBudget">0,00 zł</b></div>

              <div class="dashFinanceActions">
                <button class="calBtn" id="dashGoExpensesBtn" type="button">Wydatki</button>
                <button class="calBtn" id="dashGoWishlistBtn" type="button">Wishlist</button>
              </div>
            </div>
          </div>

          <div class="box dashActivityCard">
            <div class="panelTitle">Ostatnia aktywność</div>
            <div class="panelBody">
              <div id="dashActivityList" class="dashActivityList"></div>
            </div>
          </div>
        </div>
      </section>

      <section class="view viewHabits" id="viewHabits" data-view="habits" aria-hidden="true">
        <div class="sectionHero box">
          <div class="sectionHeadText">
            <div class="sectionTitle">Centrum nawyków</div>
            <div class="sectionSubtitle">Pełny tracker tygodnia, bilans i szybkie KPI skuteczności.</div>
          </div>
          <div class="sectionKpiGrid">
            <div class="sectionKpi"><span>Wykonane</span><b id="habitsKpiDone">0</b></div>
            <div class="sectionKpi"><span>Zawalone</span><b id="habitsKpiFail">0</b></div>
            <div class="sectionKpi"><span>Skuteczność</span><b id="habitsKpiRate">0%</b></div>
          </div>
        </div>

        <div class="sectionGrid habitsLayoutGrid">
          <div class="box topA">
            <div class="chartHeader">
              <div class="panelTitle">Bilans nawyków</div>

              <div class="chartToggle" role="tablist" aria-label="Zakres wykresu">
                <button class="chartTab isActive" id="chartWeek" type="button">Tydzień</button>
                <button class="chartTab" id="chartMonth" type="button">Miesiąc</button>
              </div>
            </div>

            <div class="panelBody">
              <div class="chartWrap">
                <svg id="chartSvg" class="chartSvg" viewBox="0 0 220 220" aria-label="Wykres bilansu"></svg>

                <div class="chartMeta">
                  <div class="chartRange" id="chartRangeTxt"></div>

                  <div class="chartLegend">
                    <div class="legendRow">
                      <span class="legendDot done"></span>
                      <span>Wykonane:</span>
                      <b id="chartDone">0</b>
                    </div>
                    <div class="legendRow">
                      <span class="legendDot fail"></span>
                      <span>Zawalone:</span>
                      <b id="chartFail">0</b>
                    </div>
                    <div class="legendRow">
                      <span class="legendDot empty"></span>
                      <span>Puste:</span>
                      <b id="chartEmpty">0</b>
                    </div>
                  </div>
                  <div class="chartActions">
                    <button class="habBtn" id="chartDetailsBtn" type="button">Szczegóły</button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="tableBox">
            <div class="habHeader">
              <div class="habHeaderLeft">
                <div class="habTitle">Habit tracker</div>
                <div class="habRange" id="habRange"></div>
              </div>

              <div class="habAdd">
                <input class="habInput" id="habitName" placeholder="Dodaj nawyk..." data-i18n-placeholder="hab.addPlaceholder" autocomplete="off">
                <button class="habBtn" id="addHabit" type="button" data-i18n="common.add">Dodaj</button>
              </div>
            </div>

            <div class="habTableWrap">
              <table class="habTable" id="habTable">
                <thead id="habThead"></thead>
                <tbody id="habTbody"></tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      <section class="view viewTodo" id="viewTodo" data-view="todo" aria-hidden="true">
        <div class="sectionHero box">
          <div class="sectionHeadText">
            <div class="sectionTitle">Moduł ToDo</div>
            <div class="sectionSubtitle">Planowanie zadań z podziałem na dziś, nadchodzące i zaległe.</div>
          </div>
          <div class="sectionKpiGrid">
            <div class="sectionKpi"><span>Dziś</span><b id="todoKpiToday">0</b></div>
            <div class="sectionKpi"><span>Upcoming</span><b id="todoKpiUpcoming">0</b></div>
            <div class="sectionKpi"><span>Overdue</span><b id="todoKpiOverdue">0</b></div>
          </div>
        </div>

        <div class="box todoBox todoViewCard" id="todoBox">
          <div class="panelTitle todoTitleRow">
            <div class="todoTitleText">
              <span data-i18n="todo.title">ToDo</span>
              <span class="todoTitleSub" id="todoTitleSub"></span>
            </div>

            <button type="button" class="todoAddBtn" id="todoAddBtn" aria-label="Dodaj ToDo">+</button>
          </div>

          <div class="panelBody">
            <div id="todoEmpty" class="todoEmpty" data-i18n="todo.empty">Brak ToDo. Dwuklik w kalendarzu aby dodać.</div>
            <div id="todoList" class="todoList"></div>
          </div>
        </div>
      </section>

      <section class="view viewExpenses" id="viewExpenses" data-view="expenses" aria-hidden="true">
        <div class="sectionHero box">
          <div class="sectionHeadText">
            <div class="sectionTitle">Moduł wydatków</div>
            <div class="sectionSubtitle">Pełny dziennik kosztów z filtrowaniem i oceną priorytetów.</div>
          </div>
          <div class="sectionKpiGrid">
            <div class="sectionKpi"><span>Miesięcznie</span><b id="expKpiMonth">0,00 zł</b></div>
            <div class="sectionKpi"><span>Top kategoria</span><b id="expKpiTopCategory">-</b></div>
            <div class="sectionKpi"><span>Wpisy</span><b id="expKpiCount">0</b></div>
          </div>
        </div>

        <div class="bottomBox expensesViewBox">
          <div class="expWrap">
            <div class="panelTitle" data-i18n="exp.title">Dziennik wydatków</div>
            <div class="panelBody">
              <div class="expHeader">
                <div class="expSummary" id="expSummary">Suma: 0,00 zł</div>
                <div class="expFilterRow">
                  <label class="modalLabel expFilterLabel" for="expFilterCategory">Filtruj:</label>
                  <select class="modalInput expFilterSelect" id="expFilterCategory">
                    <option value="">Wszystkie</option>
                    <option value="Jedzenie">Jedzenie</option>
                    <option value="Transport">Transport</option>
                    <option value="Rozrywka">Rozrywka</option>
                    <option value="Zdrowie">Zdrowie</option>
                    <option value="Edukacja">Edukacja</option>
                    <option value="Sprzęt">Sprzęt</option>
                    <option value="Subskrypcje">Subskrypcje</option>
                    <option value="Inne">Inne</option>
                  </select>
                </div>
              </div>

              <div class="expForm">
                <input class="modalInput" id="expAmount" type="text" inputmode="numeric" placeholder="Kwota" data-i18n-placeholder="exp.amount" />
                <input class="modalInput" id="expWhat" type="text" placeholder="Co kupione" data-i18n-placeholder="exp.what">

                <select class="modalInput" id="expCategory">
                  <option value="Jedzenie">Jedzenie</option>
                  <option value="Transport">Transport</option>
                  <option value="Rozrywka">Rozrywka</option>
                  <option value="Zdrowie">Zdrowie</option>
                  <option value="Edukacja">Edukacja</option>
                  <option value="Sprzęt">Sprzęt</option>
                  <option value="Subskrypcje">Subskrypcje</option>
                  <option value="Inne">Inne</option>
                </select>

                <select class="modalInput" id="expScore">
                  <option value="A">A — Wysoki priorytet</option>
                  <option value="B">B — Konieczny</option>
                  <option value="C">C — Opcjonalny</option>
                  <option value="D">D — Zbędny</option>
                </select>

                <select class="modalInput" id="expPeriod">
                  <option value="once">Jednorazowe</option>
                  <option value="weekly">Tygodniowe</option>
                  <option value="monthly">Miesięczne</option>
                  <option value="yearly">Roczne</option>
                </select>

                <input class="modalInput" id="expDate" type="date">
                <button class="habBtn" id="expAdd" type="button" data-i18n="common.add">Dodaj</button>
              </div>

              <div class="expList" id="expList"></div>
            </div>
          </div>
        </div>
      </section>

      <section class="view viewWishlist" id="viewWishlist" data-view="wishlist" aria-hidden="true">
        <div class="sectionHero box">
          <div class="sectionHeadText">
            <div class="sectionTitle">Moduł wishlisty</div>
            <div class="sectionSubtitle">Plan zakupów z sortowaniem i kontrolą budżetu.</div>
          </div>
          <div class="sectionKpiGrid">
            <div class="sectionKpi"><span>Pozycje</span><b id="wishKpiItems">0</b></div>
            <div class="sectionKpi"><span>Budżet</span><b id="wishKpiBudget">0,00 zł</b></div>
            <div class="sectionKpi"><span>Śr. cena</span><b id="wishKpiAvg">0,00 zł</b></div>
          </div>
        </div>

        <div class="bottomBox wishlistViewBox">
          <div class="wishWrap">
            <div class="panelTitle">Wishlist</div>
            <div class="panelBody">
              <div class="wishForm">
                <input class="modalInput" id="wishName" type="text" placeholder="Co chcesz kupić" autocomplete="off">
                <input class="modalInput" id="wishPrice" type="text" inputmode="numeric" placeholder="Cena" autocomplete="off">
                <button class="habBtn" id="wishAdd" type="button">Dodaj</button>
              </div>

              <div class="wishHeader">
                <label class="modalLabel wishSortLabel" for="wishSort">Sortuj:</label>
                <select class="modalInput wishSortSelect" id="wishSort">
                  <option value="date-desc">Data (najnowsze)</option>
                  <option value="date-asc">Data (najstarsze)</option>
                  <option value="price-asc">Cena (rosnąco)</option>
                  <option value="price-desc">Cena (malejąco)</option>
                  <option value="name-asc">Nazwa (A-Z)</option>
                  <option value="name-desc">Nazwa (Z-A)</option>
                </select>
              </div>

              <div class="wishList" id="wishList"></div>
            </div>
          </div>
        </div>
      </section>
    </div>
      </div>
    </div>
  <div class="modalOverlay" id="todoOverlay" aria-hidden="true">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="todoModalTitle">
      <div class="modalTop">
        <div class="modalTitle" id="todoModalTitle" data-i18n="todo.modal.title">Dodaj ToDo</div>
        <button class="modalClose" id="todoClose" type="button" aria-label="Zamknij" data-i18n-aria="common.close">×</button>
      </div>

      <div class="modalBody">
        <label class="modalLabel" for="todoDate">Data</label>
        <input class="modalInput" id="todoDate" type="date">

        <label class="modalLabel" for="todoText">Treść</label>
        <textarea class="modalTextarea" id="todoText" placeholder="Wpisz ToDo..." rows="4"></textarea>

        <label class="modalLabel" for="todoPriority">Priorytet</label>
        <select class="modalInput" id="todoPriority">
          <option value="high">Wysoki</option>
          <option value="medium" selected>Średni</option>
          <option value="low">Niski</option>
        </select>

        <div class="modalActions">
          <button class="calBtn" id="todoCancel" type="button">Anuluj</button>
          <button class="habBtn" id="todoSave" type="button">Zapisz</button>
        </div>
      </div>
    </div>
  </div>

  <div class="modalOverlay" id="chartOverlay" aria-hidden="true">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="chartModalTitle">
      <div class="modalTop">
        <div class="modalTitle" id="chartModalTitle">Bilans nawyków</div>
        <button class="modalClose" id="chartClose" type="button" aria-label="Zamknij">×</button>
      </div>

      <div class="modalBody chartModalBody">
        <div class="chartModalRange" id="chartModalRange"></div>
        <div class="chartModalSummary" id="chartModalSummary"></div>
        <div class="chartModalList" id="chartModalList"></div>
      </div>
    </div>
  </div>

  <div class="modalOverlay" id="habitOverlay" aria-hidden="true">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="habitModalTitle">
      <div class="modalTop">
        <div class="modalTitle" id="habitModalTitle">Dodaj nawyk</div>
        <button class="modalClose" id="habitClose" type="button" aria-label="Zamknij">×</button>
      </div>

      <div class="modalBody">
        <label class="modalLabel" for="habitModalName">Nazwa</label>
        <input class="modalInput" id="habitModalName" type="text" placeholder="Np. Wstać o 6:00" autocomplete="off">

        <div class="modalActions">
          <button class="calBtn" id="habitCancel" type="button">Anuluj</button>
          <button class="habBtn" id="habitSave" type="button">Dodaj</button>
        </div>
      </div>
    </div>
  </div>

  <div class="modalOverlay" id="expOverlay" aria-hidden="true">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="expModalTitle">
      <div class="modalTop">
        <div class="modalTitle" id="expModalTitle">Dodaj wydatek</div>
        <button class="modalClose" id="expClose" type="button" aria-label="Zamknij">×</button>
      </div>

      <div class="modalBody">
        <label class="modalLabel" for="expModalAmount">Kwota</label>
        <input class="modalInput" id="expModalAmount" type="text" inputmode="numeric" placeholder="Np. 12,50">

        <label class="modalLabel" for="expModalWhat">Co kupione</label>
        <input class="modalInput" id="expModalWhat" type="text" placeholder="Np. Kawa">

        <label class="modalLabel" for="expModalCategory">Kategoria</label>
        <select class="modalInput" id="expModalCategory">
          <option value="Jedzenie">Jedzenie</option>
          <option value="Transport">Transport</option>
          <option value="Rozrywka">Rozrywka</option>
          <option value="Zdrowie">Zdrowie</option>
          <option value="Edukacja">Edukacja</option>
          <option value="Sprzęt">Sprzęt</option>
          <option value="Subskrypcje">Subskrypcje</option>
          <option value="Inne">Inne</option>
        </select>

        <label class="modalLabel" for="expModalScore">Ocena</label>
        <select class="modalInput" id="expModalScore">
          <option value="A">A  Wysoki priorytet</option>
          <option value="B">B  Konieczny</option>
          <option value="C">C  Opcjonalny</option>
          <option value="D">D  Zbędny</option>
        </select>

        <label class="modalLabel" for="expModalPeriod">Okres</label>
        <select class="modalInput" id="expModalPeriod">
          <option value="once">Jednorazowe</option>
          <option value="weekly">Tygodniowe</option>
          <option value="monthly">Miesięczne</option>
          <option value="yearly">Roczne</option>
        </select>

        <label class="modalLabel" for="expModalDate">Data</label>
        <input class="modalInput" id="expModalDate" type="date">

        <div class="modalActions">
          <button class="calBtn" id="expCancel" type="button">Anuluj</button>
          <button class="habBtn" id="expSave" type="button">Dodaj</button>
        </div>
      </div>
    </div>
  </div>

  <div class="modalOverlay" id="wishOverlay" aria-hidden="true">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="wishModalTitle">
      <div class="modalTop">
        <div class="modalTitle" id="wishModalTitle">Dodaj do wishlisty</div>
        <button class="modalClose" id="wishClose" type="button" aria-label="Zamknij">×</button>
      </div>

      <div class="modalBody">
        <label class="modalLabel" for="wishModalName">Co chcesz kupić</label>
        <input class="modalInput" id="wishModalName" type="text" autocomplete="off">

        <label class="modalLabel" for="wishModalPrice">Cena</label>
        <input class="modalInput" id="wishModalPrice" type="text" inputmode="numeric" autocomplete="off" placeholder="Np. 123,45">

        <div class="modalActions">
          <button class="calBtn" id="wishCancel" type="button">Anuluj</button>
          <button class="habBtn" id="wishSave" type="button">Dodaj</button>
        </div>
      </div>
    </div>
  </div>

  <div class="modalOverlay" id="loginOverlay" aria-hidden="<?= $loginErr ? 'false' : 'true' ?>">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="loginModalTitle">
      <div class="modalTop">
        <div class="modalTitle" id="loginModalTitle">Logowanie</div>
        <button class="modalX" id="loginClose" type="button" aria-label="Zamknij">×</button>
      </div>

      <form method="post" action="api/auth.php" autocomplete="off">
        <input type="hidden" name="mode" value="login">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES) ?>">
        <div class="modalBody">
          <label class="modalLabel" for="loginUser">Login</label>
          <input class="modalInput" id="loginUser" name="username" value="" required>

          <label class="modalLabel" for="loginPass">Hasło</label>
          <input class="modalInput" id="loginPass" name="password" type="password" value="" required>

          <?php if ($loginErr): ?>
            <div class="authError"><?= htmlspecialchars($loginErr, ENT_QUOTES, 'UTF-8') ?></div>
          <?php endif; ?>

          <div class="modalActions">
            <button class="calBtn" id="loginCancel" type="button">Anuluj</button>
            <button class="habBtn" type="submit">Zaloguj</button>
          </div>
        </div>
      </form>
    </div>
  </div>




  <div class="modalOverlay" id="registerOverlay" aria-hidden="<?= $registerErr ? 'false' : 'true' ?>">
    <div class="modal" role="dialog" aria-modal="true" aria-labelledby="registerTitle">
      <div class="modalHead">
        <div class="modalTitle" id="registerTitle">Rejestracja</div>
        <button class="miniBtn" id="closeRegisterBtn" type="button">✕</button>
      </div>
      <form method="post" action="api/auth.php" autocomplete="off">
        <input type="hidden" name="mode" value="register">
        <input type="hidden" name="csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES) ?>">

        <div class="formRow">
          <label for="regUsername">Login</label>
          <input id="regUsername" name="username" required autocomplete="username" minlength="3" maxlength="50" pattern="[A-Za-z0-9_]{3,50}">
        </div>

        <div class="formRow">
          <label for="regPass1">Hasło</label>
          <input id="regPass1" type="password" name="password" required autocomplete="new-password" minlength="10" pattern="(?=.*[a-z])(?=.*[A-Z])(?=.*[0-9]).{10,}" title="Minimum 10 znaków, mała i wielka litera oraz cyfra">
        </div>

        <div class="formRow">
          <label for="regPass2">Powtórz hasło</label>
          <input id="regPass2" type="password" name="password2" required autocomplete="new-password" minlength="10">
        </div>

        <div class="modalActions">
          <button class="calBtn" id="cancelRegister" type="button">Anuluj</button>
          <button class="habBtn" type="submit">Utwórz konto</button>
        </div>

        <?php if ($registerErr): ?>
          <div class="authError"><?= htmlspecialchars($registerErr) ?></div>
        <?php endif; ?>
      </form>
    </div>
  </div>

  <script src="js/core/config.js"></script>
  <script src="js/core/dom.js"></script>
  <script src="js/core/utils.js"></script>
  <script src="js/core/storage.js"></script>
  <script src="js/core/state.js"></script>
  <script src="js/core/api.js"></script>
  <script src="js/core/elements.js"></script>
  <script src="js/modules/theme.js"></script>
  <script src="js/modules/auth.js"></script>
  <script src="js/modules/calendar.js"></script>
  <script src="js/modules/habits.js"></script>
  <script src="js/modules/dashboard/todo.js"></script>
  <script src="js/modules/dashboard/expenses.js"></script>
  <script src="js/modules/dashboard/chart.js"></script>
  <script src="js/modules/dashboard/wishlist.js"></script>
  <script src="js/modules/dashboard/pomodoro.js"></script>
  <script src="js/app.js"></script>
</body>
</html>
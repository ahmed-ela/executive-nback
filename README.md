# Executive n-back

A small browser-based executive weekday n-back trainer with adaptive levels from 1 to 20, local practice history, and a color-coded review of every trial. No account, backend, or dependency installation is required.

## Run locally

From the repository root, start a static server with Python 3:

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory dist
```

Open http://localhost:8765 in a modern browser. JavaScript modules need an HTTP server; opening `index.html` directly as a file is not supported. Any static server can serve `dist/`.

## How to play

Press **Space** or click **Next day — match** when the current weekday is the day immediately after the weekday shown n items earlier. Otherwise do nothing. The week wraps: Sunday → Monday is a match. Repeating the same weekday is not a match.

Examples:

- 1-back: Monday, Tuesday → respond to Tuesday.
- 2-back: Tuesday, Saturday, Wednesday → respond to Wednesday.
- 2-back: Tuesday, Saturday, Tuesday → do not respond to the second Tuesday.

The first n items are an unscored warmup. Each round then has 20 scored trials, six of which are targets. A weekday appears for 500 milliseconds followed by a fixation cross for 2,500 milliseconds. Responses remain open during fixation. A recorded response changes the button color; this acknowledges the press without revealing correctness.

Balanced accuracy is 50 × (hit rate + correct-rejection rate). No responses scores 50%, not 70%. At ≥90% the next level increases, below 70% it decreases; otherwise it stays the same. Levels run from 1 to 20, including automatic progression from 9-back to 10-back. The duration estimate includes the three-second countdown, n warm-up items, and 20 scored trials: 66 seconds at 1-back through 123 seconds at 20-back. A round can be stopped; leaving the tab also stops it to avoid misleading timing. Incomplete rounds count toward practice time but not completed-round scores or average level.

After a completed round, a horizontal weekday timeline shows each response: green for a caught match, blue for correctly waiting on a nonmatch, red for a missed match, amber for a false alarm, and gray for unscored warm-up items. Select any weekday to highlight its n-back reference and see the expected day and your response. Recent rounds → View reopens saved reviews; the latest completed review also returns on reload. Reviews are hidden during training. Colors describe individual trials, so the fraction of green and blue items combined is not the balanced-accuracy score.

## Data and privacy

Practice time (minutes and hours), level, scores, raw stimuli, responses, and response times are saved in this browser's localStorage under `executive-nback-practice-v1`. If you previously used the dual n-back prototype, its history remains untouched under `nback-practice-v1`; the two tasks are not mixed. Export history saves a JSON copy. localhost and 127.0.0.1 have separate histories. The application uses no account, external service, analytics, or audio. Clearing browser site data removes local history; export it first if you want a backup.

## Tests

With Node.js 20 or newer:

```sh
node --test tests/engine.test.mjs
```

The dependency-free tests cover weekday matching and wraparound, warm-up handling, exact target counts, balanced scoring, adaptive progression, and saved review data across levels 1–20.

## Files

- `dist/index.html`, `style.css`, `executive.css`: interface and styling.
- `dist/app.mjs`: round timing, keyboard controls, progress, history, and export.
- `dist/engine.mjs`: sequence generation and scoring.
- `dist/review.mjs`: completed-round timeline and comparison details.
- `tests/engine.test.mjs`: deterministic engine and review checks.

## Research fidelity and limits

The weekday transformation rule follows the executive n-back task described by [León-Domínguez et al. (2015)](https://doi.org/10.1016/j.bbr.2015.06.002) and illustrated in [Cao et al. (2026)](https://doi.org/10.3758/s13423-025-02773-8). Cao's public figure shows a 500 ms stimulus plus 2,500 ms fixation interval, reproduced here. Weekday labels are displayed in English.

This is a research-inspired implementation, not an exact replication of Cao's complete intervention. The 20-trial block size, 30% target rate, balanced-accuracy scoring, level thresholds, level range, and one-round session flow are prototype design choices; the full study methods were unavailable. The UI gives no guarantee of general working-memory improvement. It does not include independent pre/post transfer assessments.

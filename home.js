/**
 * Everything on the front page that moves or answers (S13.15a).
 *
 * site.js keeps doing what it does on every page — the theme switch and the
 * header's hairline. This file runs on index.html only. No framework and no
 * library: a dozen small behaviours, each self-contained, each started inside
 * `safely` so one that fails cannot take the others down.
 *
 * **The page has to be whole without any of this.** Everything home.css hides
 * until it is revealed sits behind the `js` class, and the inline script in
 * index.html takes that class away again unless this file reaches its last
 * line and says so (`window.rehearsioHome`). A page that does not move is a
 * small loss; a page that stays blank is not.
 *
 * **Reduced motion means none of it moves.** Every block checks `reduce`
 * before it animates anything, and home.css §19 says the same in CSS. What is
 * left still works — the metronome still clicks, the line between the themes
 * still drags — it just arrives without travelling.
 *
 * Audio timing never depends on a JS timer (CLAUDE.md §4, features/metronome.md):
 * the clicks of the metronome below are scheduled on the audio clock, a
 * little ahead, and the timer only tops the schedule up — the same split the
 * app makes, in the browser's terms.
 */

(function () {
  'use strict';

  var APPLE = 'https://apps.apple.com/app/rehearsio/id6809843721';
  var GOOGLE = 'https://play.google.com/store/apps/details?id=com.rehearsio.app';

  var reduceQuery = window.matchMedia
    ? window.matchMedia('(prefers-reduced-motion: reduce)')
    : null;
  var reduce = !!(reduceQuery && reduceQuery.matches);

  function clamp(v, lo, hi) {
    return v < lo ? lo : v > hi ? hi : v;
  }

  /** 0 below `from`, 1 above `to`, and an S-curve between. */
  function smooth(from, to, x) {
    var t = clamp((x - from) / (to - from), 0, 1);
    return t * t * (3 - 2 * t);
  }

  function easeOut(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function easeInOut(t) {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function mmss(seconds) {
    var s = Math.max(0, Math.floor(seconds));
    return pad(Math.floor(s / 60)) + ':' + pad(s % 60);
  }

  function all(selector, scope) {
    return Array.prototype.slice.call((scope || document).querySelectorAll(selector));
  }

  function safely(name, start) {
    try {
      start();
    } catch (error) {
      if (window.console) console.error('home.js: ' + name + ' did not start', error);
    }
  }

  /** Runs `then` once, the first time `el` is properly on screen. */
  function whenSeen(el, then, threshold) {
    if (!('IntersectionObserver' in window)) {
      then();
      return;
    }
    var watch = new IntersectionObserver(
      function (entries) {
        if (!entries[0].isIntersecting) return;
        watch.disconnect();
        then();
      },
      { threshold: threshold || 0.3 },
    );
    watch.observe(el);
  }

  /**
   * One choice out of several, the way a radio group answers the keyboard:
   * the arrows move the choice, and only the chosen one is in the tab order.
   */
  function radioGroup(group, onPick) {
    if (!group) return;
    var items = all('[role="radio"]', group);
    function pick(item, focus) {
      items.forEach(function (other) {
        var on = other === item;
        other.setAttribute('aria-checked', on ? 'true' : 'false');
        other.tabIndex = on ? 0 : -1;
      });
      if (focus) item.focus();
      if (onPick) onPick(item);
    }
    items.forEach(function (item, i) {
      item.tabIndex = item.getAttribute('aria-checked') === 'true' ? 0 : -1;
      item.addEventListener('click', function () {
        pick(item);
      });
      item.addEventListener('keydown', function (e) {
        var j;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') j = (i + 1) % items.length;
        else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp')
          j = (i - 1 + items.length) % items.length;
        else return;
        e.preventDefault();
        pick(items[j], true);
      });
    });
  }

  // ---------------------------------------------------------------------------
  // The frame loop. Everything the scroll drives is a function in `onFrame`,
  // run at most once per frame; everything that has to measure the layout is
  // in `onMeasure`, run on resize and once the pictures have arrived.
  // ---------------------------------------------------------------------------

  var onFrame = [];
  var onMeasure = [];
  var queued = false;

  function frame() {
    queued = false;
    for (var i = 0; i < onFrame.length; i++) onFrame[i]();
  }

  function request() {
    if (queued) return;
    queued = true;
    requestAnimationFrame(frame);
  }

  function measure() {
    for (var i = 0; i < onMeasure.length; i++) onMeasure[i]();
    request();
  }

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', measure, { passive: true });
  window.addEventListener('load', measure);

  // ---------------------------------------------------------------------------
  // 1. The store button in the header. On an iPhone or an Android phone it
  //    goes straight to that phone's store; elsewhere it scrolls to the two
  //    badges at the end. It shows itself once the hero's badges have gone
  //    by, and steps aside again when the last ones are on screen.
  // ---------------------------------------------------------------------------

  safely('store button', function () {
    var ua = navigator.userAgent || '';
    // iPadOS reports itself as a Mac; a Mac with a touch screen is an iPad.
    var apple =
      /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1);
    var android = /Android/.test(ua);
    all('[data-store-link]').forEach(function (link) {
      if (apple) link.href = APPLE;
      else if (android) link.href = GOOGLE;
    });

    var button = document.querySelector('.header-cta');
    var first = document.querySelector('[data-hero-stores]');
    var last = document.querySelector('.finale .stores');
    if (!button || !first || !('IntersectionObserver' in window)) return;

    var passed = false;
    var atEnd = false;
    function sync() {
      button.setAttribute('data-shown', passed && !atEnd ? 'true' : 'false');
    }
    new IntersectionObserver(function (entries) {
      var e = entries[0];
      passed = !e.isIntersecting && e.boundingClientRect.top < 0;
      sync();
    }).observe(first);
    if (last) {
      new IntersectionObserver(function (entries) {
        atEnd = entries[0].isIntersecting;
        sync();
      }).observe(last);
    }
  });

  // ---------------------------------------------------------------------------
  // 2. How far through the page the reader is: the orange line under the
  //    header. It is the scroll position and nothing else, so it follows the
  //    hand exactly.
  // ---------------------------------------------------------------------------

  safely('progress line', function () {
    var bar = document.querySelector('.read-progress span');
    if (!bar) return;
    onFrame.push(function () {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      var done = max > 0 ? clamp(window.scrollY / max, 0, 1) : 0;
      bar.style.transform = 'scaleX(' + done.toFixed(4) + ')';
    });
  });

  // ---------------------------------------------------------------------------
  // 3. The hero arrives once its drawing is decoded — the words rise, the
  //    sheet settles, the objects pop in one after another. It never waits
  //    more than 1.2 s for one picture.
  // ---------------------------------------------------------------------------

  safely('hero', function () {
    var hero = document.querySelector('[data-hero]');
    if (!hero) return;
    var done = false;
    function ready() {
      if (done) return;
      done = true;
      // Two frames: the starting positions are painted once before the class
      // that moves them away arrives, or there is nothing to move from.
      requestAnimationFrame(function () {
        requestAnimationFrame(function () {
          hero.classList.add('is-ready');
        });
      });
    }
    var girl = hero.querySelector('.layer--girl');
    if (reduce) ready();
    else if (girl && girl.decode) girl.decode().then(ready, ready);
    else window.addEventListener('load', ready);
    setTimeout(ready, 1200);
  });

  // ---------------------------------------------------------------------------
  // 4. Blocks arrive as they come into view; the second drawing pops in the
  //    same way the first did, when the reader gets to it.
  // ---------------------------------------------------------------------------

  safely('reveal', function () {
    var blocks = all('[data-reveal]');
    var scenes = all('[data-scene-host]:not([data-hero])');
    if (reduce || !('IntersectionObserver' in window)) {
      blocks.forEach(function (el) {
        el.classList.add('is-in');
      });
      scenes.forEach(function (el) {
        el.classList.add('is-ready');
      });
      return;
    }
    var watch = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          var el = entry.target;
          el.classList.add(el.hasAttribute('data-scene-host') ? 'is-ready' : 'is-in');
          watch.unobserve(el);
        });
      },
      { rootMargin: '0px 0px -10% 0px', threshold: 0.1 },
    );
    blocks.concat(scenes).forEach(function (el) {
      watch.observe(el);
    });
  });

  // ---------------------------------------------------------------------------
  // 5. The drawings follow the mouse a little, each object by its own depth,
  //    and drift as the page scrolls past them. The girl herself stays put:
  //    she is what everything else moves against.
  // ---------------------------------------------------------------------------

  safely('drawings', function () {
    if (reduce) return;
    all('[data-scene]').forEach(function (scene) {
      var host = scene.closest('section') || scene;
      var layers = all('.layer[data-depth]', scene);
      var depth = layers.map(function (layer) {
        return parseFloat(layer.getAttribute('data-depth')) || 1;
      });
      var aim = { x: 0, y: 0 };
      var at = { x: 0, y: 0 };
      var drift = 0;
      var running = false;

      function render() {
        // Eased towards the pointer: the pointer is not dragging anything
        // here, so the objects are allowed to lag it, and lagging is the
        // whole effect.
        at.x += (aim.x - at.x) * 0.08;
        at.y += (aim.y - at.y) * 0.08;
        for (var i = 0; i < layers.length; i++) {
          var d = depth[i];
          layers[i].style.transform =
            'translate3d(' +
            (at.x * d * -14).toFixed(2) +
            'px,' +
            (at.y * d * -14 + drift * d).toFixed(2) +
            'px,0)';
        }
        if (Math.abs(aim.x - at.x) > 0.0005 || Math.abs(aim.y - at.y) > 0.0005) {
          requestAnimationFrame(render);
        } else {
          running = false;
        }
      }

      function kick() {
        if (running) return;
        running = true;
        requestAnimationFrame(render);
      }

      host.addEventListener('pointermove', function (e) {
        if (e.pointerType && e.pointerType !== 'mouse') return;
        var box = scene.getBoundingClientRect();
        aim.x = clamp((e.clientX - box.left) / box.width - 0.5, -0.8, 0.8);
        aim.y = clamp((e.clientY - box.top) / box.height - 0.5, -0.8, 0.8);
        kick();
      });

      host.addEventListener('pointerleave', function () {
        aim.x = 0;
        aim.y = 0;
        kick();
      });

      onFrame.push(function () {
        var box = scene.getBoundingClientRect();
        if (box.bottom < 0 || box.top > window.innerHeight) return;
        drift = ((box.top + box.height / 2 - window.innerHeight / 2) / window.innerHeight) * 16;
        kick();
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 6. Before and after. The track is three screens tall and its stage
  //    sticks; how far the reader has scrolled through the track is the
  //    timeline. Each object leaves its place, flies into the tool it became,
  //    shrinks to that tool's size and is gone — and the ring round the tool
  //    lights as it lands. Halfway through, the words change sides.
  // ---------------------------------------------------------------------------

  safely('before and after', function () {
    var section = document.querySelector('[data-converge]');
    if (!section || reduce || !('IntersectionObserver' in window)) return;
    section.classList.add('is-live');

    var track = section.querySelector('.converge__track');
    var slots = {};
    all('[data-slot]', section).forEach(function (slot) {
      slots[slot.getAttribute('data-slot')] = slot;
    });
    var flights = all('.doodle', section).map(function (doodle) {
      return {
        art: doodle.querySelector('.doodle__art'),
        label: doodle.querySelector('.doodle__label'),
        slot: slots[doodle.getAttribute('data-to')],
      };
    });
    var paths = [];

    // Where each object has to go, measured with every flight undone. The
    // stage moves as one piece, so these distances hold at any scroll.
    onMeasure.push(function () {
      flights.forEach(function (f) {
        f.art.style.transform = '';
      });
      paths = flights.map(function (f) {
        var from = f.art.getBoundingClientRect();
        var to = f.slot.getBoundingClientRect();
        return {
          dx: to.left + to.width / 2 - (from.left + from.width / 2),
          dy: to.top + to.height / 2 - (from.top + from.height / 2),
          size: Math.min(to.width / from.width, to.height / from.height) * 0.9,
        };
      });
    });

    onFrame.push(function () {
      var box = track.getBoundingClientRect();
      if (box.bottom < -200 || box.top > window.innerHeight + 200) return;
      var span = box.height - window.innerHeight;
      var p = span > 0 ? clamp(-box.top / span, 0, 1) : 1;

      // The words change only once every object has landed, and the old ones
      // are gone before the new ones arrive: two headlines faded across each
      // other in one place read as neither.
      section.style.setProperty('--k-out', smooth(0.6, 0.67, p).toFixed(3));
      section.style.setProperty('--k-in', smooth(0.67, 0.76, p).toFixed(3));

      for (var i = 0; i < flights.length; i++) {
        var f = flights[i];
        var path = paths[i];
        if (!path) continue;
        // One after another, each over a quarter of the track, the last one
        // landing at 60 %. What is left of the track holds the finished scene.
        var q = easeInOut(clamp((p - (0.06 + i * 0.06)) / 0.24, 0, 1));
        var size = 1 + (path.size - 1) * q;
        f.art.style.transform =
          'translate3d(' +
          (path.dx * q).toFixed(1) +
          'px,' +
          (path.dy * q).toFixed(1) +
          'px,0) scale(' +
          size.toFixed(3) +
          ')';
        f.art.style.opacity = (1 - smooth(0.8, 1, q)).toFixed(3);
        f.label.style.opacity = (1 - smooth(0, 0.22, q)).toFixed(3);
        f.slot.style.setProperty('--lit', smooth(0.84, 1, q).toFixed(3));
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 7. Each picture moves a little slower than its sheet as it passes, inside
  //    the sheet's own edges. The picture is drawn 4 % larger than its sheet
  //    (home.css §18) and never travels further than that margin.
  // ---------------------------------------------------------------------------

  safely('picture drift', function () {
    if (reduce) return;
    var pictures = all('[data-parallax]');
    onFrame.push(function () {
      var vh = window.innerHeight;
      for (var i = 0; i < pictures.length; i++) {
        var box = pictures[i].parentNode.getBoundingClientRect();
        if (box.bottom < 0 || box.top > vh) continue;
        var c = (box.top + box.height / 2 - vh / 2) / (vh + box.height);
        pictures[i].style.transform =
          'translate3d(0,' + (c * box.height * -0.035).toFixed(1) + 'px,0)';
      }
    });
  });

  // ---------------------------------------------------------------------------
  // 8. The working copy of a session.
  // ---------------------------------------------------------------------------

  safely('session', function () {
    var pg = document.querySelector('[data-playground]');
    if (!pg) return;

    radioGroup(pg.querySelector('.pg__chips'));

    // --- The practice clock: starts when the reader gets there, and a tap
    //     on it pauses — as a tap on the stopwatch does in the app.
    var clock = pg.querySelector('[data-clock]');
    var clockTime = pg.querySelector('[data-clock-time]');
    var clockState = pg.querySelector('[data-clock-state]');
    var counted = 0;
    var since = null;
    var clockTick = null;

    function clockNow() {
      return counted + (since ? (Date.now() - since) / 1000 : 0);
    }
    function showClock() {
      clockTime.textContent = mmss(clockNow());
    }
    function runClock() {
      if (since) return;
      since = Date.now();
      clockTick = setInterval(showClock, 250);
      clock.setAttribute('data-paused', 'false');
      clockState.textContent = 'Running';
      clock.setAttribute('aria-label', 'Pause practice');
    }
    function holdClock() {
      if (!since) return;
      counted = clockNow();
      since = null;
      clearInterval(clockTick);
      showClock();
      clock.setAttribute('data-paused', 'true');
      clockState.textContent = 'Paused';
      clock.setAttribute('aria-label', 'Resume practice');
    }
    clock.addEventListener('click', function () {
      if (since) holdClock();
      else runClock();
    });
    whenSeen(pg, runClock, 0.4);

    // --- Metronome. The clicks are the app's own two samples; they are
    //     scheduled on the audio clock 120 ms ahead, and the 25 ms timer
    //     only tops the schedule up, so a busy page cannot make it stumble.
    var metro = (function () {
      var NAMES = [
        [200, 'Prestissimo'],
        [168, 'Presto'],
        [156, 'Vivace'],
        [120, 'Allegro'],
        [108, 'Moderato'],
        [76, 'Andante'],
        [66, 'Adagio'],
        [60, 'Larghetto'],
        [40, 'Largo'],
        [0, 'Grave'],
      ];
      var bpmText = pg.querySelector('[data-bpm]');
      var nameText = pg.querySelector('[data-bpm-name]');
      var ruler = pg.querySelector('[data-bpm-range]');
      var toggle = pg.querySelector('[data-metro-toggle]');
      var tap = pg.querySelector('[data-metro-tap]');
      var dots = all('.metro__beat', pg);
      var bpm = 110;
      var playing = false;
      var audio = null;
      var samples = null;
      var next = 0;
      var beat = 0;
      var topUp = null;
      var heard = [];
      var taps = [];

      function nameOf(value) {
        for (var i = 0; i < NAMES.length; i++) if (value >= NAMES[i][0]) return NAMES[i][1];
        return 'Grave';
      }

      function setBpm(value) {
        bpm = clamp(Math.round(value), 20, 300);
        bpmText.textContent = bpm;
        nameText.textContent = nameOf(bpm);
        ruler.value = bpm;
        // The tool row shows what each tool is set to, as in the app.
        var shown = pg.querySelector('[data-value="metronome"]');
        if (shown) shown.textContent = bpm;
      }

      function load() {
        if (samples) return Promise.resolve(samples);
        return Promise.all(
          ['assets/audio/tick-strong.wav', 'assets/audio/tick-weak.wav'].map(function (url) {
            return fetch(url)
              .then(function (response) {
                return response.arrayBuffer();
              })
              .then(function (data) {
                // The callback form, because older Safari has no promise one.
                return new Promise(function (resolve, reject) {
                  audio.decodeAudioData(data, resolve, reject);
                });
              });
          }),
        ).then(function (list) {
          samples = list;
          return list;
        });
      }

      function schedule() {
        while (next < audio.currentTime + 0.12) {
          var click = audio.createBufferSource();
          click.buffer = samples[beat === 0 ? 0 : 1];
          click.connect(audio.destination);
          click.start(next);
          heard.push({ beat: beat, at: next });
          next += 60 / bpm;
          beat = (beat + 1) % dots.length;
        }
      }

      // The dot follows the sound, not the timer: it lights when the audio
      // clock passes the click it belongs to.
      function show() {
        if (!playing) return;
        while (heard.length && heard[0].at <= audio.currentTime) {
          var lit = heard.shift().beat;
          dots.forEach(function (dot, i) {
            dot.classList.toggle('is-on', i === lit);
          });
        }
        requestAnimationFrame(show);
      }

      function start() {
        var Ctx = window.AudioContext || window.webkitAudioContext;
        if (!Ctx) return;
        if (!audio) audio = new Ctx();
        if (audio.state === 'suspended') audio.resume();
        toggle.textContent = 'Stop';
        playing = true;
        load().then(
          function () {
            if (!playing) return;
            beat = 0;
            heard = [];
            next = audio.currentTime + 0.06;
            schedule();
            topUp = setInterval(schedule, 25);
            requestAnimationFrame(show);
          },
          function () {
            stop();
          },
        );
      }

      function stop() {
        playing = false;
        clearInterval(topUp);
        heard = [];
        dots.forEach(function (dot) {
          dot.classList.remove('is-on');
        });
        toggle.textContent = 'Start';
      }

      toggle.addEventListener('click', function () {
        if (playing) stop();
        else start();
      });

      all('[data-bpm-step]', pg).forEach(function (button) {
        button.addEventListener('click', function () {
          setBpm(bpm + Number(button.getAttribute('data-bpm-step')));
        });
      });

      ruler.addEventListener('input', function () {
        setBpm(Number(ruler.value));
      });

      // Tap along and the tempo follows: two taps set it, eight are averaged,
      // a pause of three seconds starts again (metronome/services/tapTempo.ts).
      tap.addEventListener('click', function () {
        var now = performance.now();
        if (taps.length && now - taps[taps.length - 1] > 3000) taps = [];
        taps.push(now);
        if (taps.length > 8) taps.shift();
        if (taps.length > 1)
          setBpm(60000 / ((taps[taps.length - 1] - taps[0]) / (taps.length - 1)));
      });

      return {
        stop: stop,
        isPlaying: function () {
          return playing;
        },
      };
    })();

    // --- Tuner. A demonstration, and it says so: the page has no
    //     microphone. The pitch starts off and eases in, the way a string
    //     does under a turning peg; inside three cents it is in tune.
    var tuner = (function () {
      var STRINGS = { G3: 196.0, D4: 293.66, A4: 440.0, E5: 659.26 };
      var box = pg.querySelector('[data-tuner]');
      var noteText = pg.querySelector('[data-tuner-note]');
      var octaveText = pg.querySelector('[data-tuner-octave]');
      var needle = pg.querySelector('[data-tuner-needle]');
      var centsText = pg.querySelector('[data-tuner-cents]');
      var hzText = pg.querySelector('[data-tuner-hz]');
      var string = 'A4';
      var from = -14;
      var startedAt = 0;
      var running = false;
      var lastSaid = '';

      function draw(now) {
        if (!running) return;
        var t = (now - startedAt) / 1000;
        var cents = from * Math.exp(-t / 1.4) * Math.cos(t * 2.1) + Math.sin(t * 13) * 0.6;
        var inTune = Math.abs(cents) < 3;
        needle.style.setProperty('--cents', clamp(cents, -50, 50).toFixed(2));
        hzText.textContent = (STRINGS[string] * Math.pow(2, cents / 1200)).toFixed(1);
        box.setAttribute('data-in-tune', inTune ? 'true' : 'false');
        var said = inTune
          ? 'In tune'
          : (cents < 0 ? '−' : '+') + Math.abs(Math.round(cents)) + ' cents';
        if (said !== lastSaid) {
          centsText.textContent = said;
          lastSaid = said;
        }
        requestAnimationFrame(draw);
      }

      function begin() {
        noteText.textContent = string.charAt(0);
        octaveText.textContent = string.charAt(1);
        startedAt = performance.now();
        if (!running) {
          running = true;
          requestAnimationFrame(draw);
        }
      }

      radioGroup(box.querySelector('.tuner__strings'), function (item) {
        string = item.getAttribute('data-string');
        from = (Math.random() < 0.5 ? -1 : 1) * (12 + Math.random() * 18);
        begin();
      });

      return {
        start: begin,
        stop: function () {
          running = false;
        },
      };
    })();

    // --- Recording. Opening the recorder starts it, as the record button
    //     does in the app (ADR-096); the flag drops a mark at the moment.
    var rec = (function () {
      var box = pg.querySelector('[data-rec]');
      var timeText = pg.querySelector('[data-rec-time]');
      var wave = pg.querySelector('[data-rec-wave]');
      var list = pg.querySelector('[data-rec-marks]');
      var markButton = pg.querySelector('[data-rec-mark]');
      var pauseButton = pg.querySelector('[data-rec-toggle]');
      var hint = pg.querySelector('[data-rec-hint]');
      var KINDS = [
        ['Went well', '#83b891'],
        ["Didn't work", '#e2897b'],
      ];
      var seconds = 0;
      var running = false;
      var last = 0;
      var nextBar = 0;
      var level = 0.4;
      var marks = 0;

      function addBar() {
        // A phrase rises and falls; a bar is that, plus the grain of a bow.
        level = clamp(level + (Math.random() - 0.5) * 0.35, 0.12, 1);
        var bar = document.createElement('i');
        bar.style.setProperty('--h', (level * (0.55 + Math.random() * 0.45)).toFixed(2));
        wave.appendChild(bar);
        while (wave.children.length > 60) wave.removeChild(wave.firstElementChild);
      }

      function draw(now) {
        if (!running) return;
        seconds += (now - last) / 1000;
        last = now;
        timeText.textContent = mmss(seconds);
        if (now >= nextBar) {
          addBar();
          nextBar = now + 110;
        }
        requestAnimationFrame(draw);
      }

      function setPaused(paused) {
        box.setAttribute('data-paused', paused ? 'true' : 'false');
        pauseButton.setAttribute(
          'aria-label',
          paused ? 'Resume the recording' : 'Pause the recording',
        );
      }

      function start() {
        if (running) return;
        running = true;
        setPaused(false);
        last = performance.now();
        requestAnimationFrame(draw);
      }

      function hold() {
        running = false;
        setPaused(true);
      }

      for (var i = 0; i < 40; i++) addBar();

      pauseButton.addEventListener('click', function () {
        if (running) hold();
        else start();
      });

      markButton.addEventListener('click', function () {
        var kind = KINDS[marks % KINDS.length];
        marks += 1;
        var item = document.createElement('li');
        item.style.setProperty('--mark', kind[1]);
        var at = document.createElement('time');
        at.textContent = mmss(seconds);
        item.appendChild(at);
        item.appendChild(document.createTextNode(kind[0]));
        list.appendChild(item);
        while (list.children.length > 3) list.removeChild(list.firstElementChild);
        hint.hidden = true;
      });

      return { start: start, stop: hold };
    })();

    // --- Quick note: a new one writes itself in, a letter at a time.
    (function () {
      var list = pg.querySelector('[data-notes-list]');
      var add = pg.querySelector('[data-notes-add]');
      var LINES = [
        'Always stumble on the last beat of bar 24',
        'Ask about the fingering in bar 12',
        'Slow practice first: 60, then 72',
      ];
      var written = 0;
      var busy = false;
      add.addEventListener('click', function () {
        if (busy) return;
        busy = true;
        var text = LINES[written % LINES.length];
        written += 1;
        var item = document.createElement('li');
        var line = document.createElement('span');
        var when = document.createElement('small');
        when.textContent = 'Just now';
        item.appendChild(line);
        item.appendChild(when);
        list.insertBefore(item, list.firstElementChild);
        // Elements, not nodes: the list in the markup carries whitespace between
        // its items, and counting that would throw real notes away.
        while (list.children.length > 3) list.removeChild(list.lastElementChild);
        if (reduce) {
          line.textContent = text;
          busy = false;
          return;
        }
        item.className = 'is-typing';
        var shown = 0;
        (function type() {
          shown += 1;
          line.textContent = text.slice(0, shown);
          if (shown < text.length) setTimeout(type, 26 + Math.random() * 44);
          else {
            item.className = '';
            busy = false;
          }
        })();
      });
    })();

    // --- Countdown: five minutes, a bar that empties, start and pause.
    (function () {
      var timeText = pg.querySelector('[data-countdown-time]');
      var bar = pg.querySelector('[data-countdown-bar]');
      var toggle = pg.querySelector('[data-countdown-toggle]');
      var TOTAL = 300;
      var left = TOTAL;
      var since = null;
      var tick = null;

      function remaining() {
        return Math.max(0, left - (since ? (Date.now() - since) / 1000 : 0));
      }
      function show() {
        var r = remaining();
        timeText.textContent = mmss(Math.ceil(r));
        bar.style.setProperty('--left', (r / TOTAL).toFixed(4));
        var shown = pg.querySelector('[data-value="countdown"]');
        if (shown) shown.textContent = mmss(Math.ceil(r)).replace(/^0/, '');
        if (r <= 0 && since) {
          clearInterval(tick);
          since = null;
          left = TOTAL;
          toggle.textContent = 'Start';
        }
      }
      toggle.addEventListener('click', function () {
        if (since) {
          left = remaining();
          since = null;
          clearInterval(tick);
          toggle.textContent = 'Start';
        } else {
          since = Date.now();
          tick = setInterval(show, 200);
          toggle.textContent = 'Pause';
        }
        show();
      });
    })();

    // --- The row of tools: one panel at a time. Opening the tuner stops the
    //     metronome and pauses the recorder, because in the app the
    //     microphone listens to one thing at a time (ADR-092, ADR-101).
    var tabs = all('[role="tab"]', pg);
    var views = {};
    all('[data-view]', pg).forEach(function (view) {
      views[view.getAttribute('data-view')] = view;
    });
    var open = 'metronome';

    function select(name, focus) {
      if (name === open) return;
      tabs.forEach(function (tab) {
        var on = tab.getAttribute('data-tool') === name;
        tab.setAttribute('aria-selected', on ? 'true' : 'false');
        tab.tabIndex = on ? 0 : -1;
        if (on && focus) tab.focus();
      });
      Object.keys(views).forEach(function (key) {
        views[key].hidden = key !== name;
      });
      if (open === 'tuner') tuner.stop();
      if (open === 'record') rec.stop();
      if (name === 'tuner') {
        if (metro.isPlaying()) metro.stop();
        tuner.start();
      }
      if (name === 'record') rec.start();
      open = name;
    }

    tabs.forEach(function (tab, i) {
      tab.tabIndex = tab.getAttribute('aria-selected') === 'true' ? 0 : -1;
      tab.addEventListener('click', function () {
        select(tab.getAttribute('data-tool'));
      });
      tab.addEventListener('keydown', function (e) {
        var j;
        if (e.key === 'ArrowRight') j = (i + 1) % tabs.length;
        else if (e.key === 'ArrowLeft') j = (i - 1 + tabs.length) % tabs.length;
        else if (e.key === 'Home') j = 0;
        else if (e.key === 'End') j = tabs.length - 1;
        else return;
        e.preventDefault();
        select(tabs[j].getAttribute('data-tool'), true);
      });
    });
  });

  // ---------------------------------------------------------------------------
  // 9. Pencil marks: each one draws itself, in order, when the score is on
  //    screen. Picking a pencil redraws the ring in that pencil.
  // ---------------------------------------------------------------------------

  safely('pencil', function () {
    var score = document.querySelector('[data-score]');
    if (!score) return;
    var marks = all('.mark', score);
    marks.forEach(function (path) {
      path.style.setProperty('--len', Math.ceil(path.getTotalLength()));
    });
    var ring = score.querySelector('[data-ink]');
    var ringLength = Math.ceil(ring.getTotalLength());

    if (reduce) score.classList.add('is-drawn');
    else
      whenSeen(
        score,
        function () {
          score.classList.add('is-drawn');
        },
        0.45,
      );

    radioGroup(document.querySelector('[data-pencils]'), function (item) {
      score.style.setProperty('--pencil', item.style.getPropertyValue('--ink'));
      if (reduce || !score.classList.contains('is-drawn')) return;
      // Off the page, then drawn again: the new colour arrives as a stroke.
      ring.style.transition = 'none';
      ring.style.strokeDashoffset = ringLength;
      ring.getBoundingClientRect();
      ring.style.transition = 'stroke-dashoffset 700ms cubic-bezier(0.45, 0, 0.2, 1)';
      ring.style.strokeDashoffset = '0';
    });
  });

  // ---------------------------------------------------------------------------
  // 10. Numbers that count up to themselves when they come into view.
  // ---------------------------------------------------------------------------

  safely('numbers', function () {
    if (reduce) return;
    all('[data-count]').forEach(function (el) {
      var to = Number(el.getAttribute('data-count'));
      var minutes = el.getAttribute('data-unit') === 'hm';
      function show(v) {
        if (!minutes) el.textContent = String(v);
        else el.textContent = (v >= 60 ? Math.floor(v / 60) + ' h ' : '') + (v % 60) + ' min';
      }
      show(0);
      whenSeen(
        el,
        function () {
          var t0 = performance.now();
          (function step(now) {
            var t = clamp((now - t0) / 1400, 0, 1);
            show(Math.round(to * easeOut(t)));
            if (t < 1) requestAnimationFrame(step);
          })(t0);
        },
        0.6,
      );
    });
  });

  // ---------------------------------------------------------------------------
  // 11. Light and dark: one line across three phones. Left of it a phone is
  //     light, right of it dark. It is dragged — so it follows the hand and
  //     never eases — and the first time it is seen it sweeps once by itself
  //     to say that it can be moved.
  // ---------------------------------------------------------------------------

  safely('light and dark', function () {
    var split = document.querySelector('[data-split]');
    if (!split) return;
    var phones = all('.split__phone', split);
    var range = split.querySelector('[data-split-range]');
    var pos = 50;
    var dragging = false;
    var touched = false;

    // Where the line rests: across the middle of the first phone on screen,
    // so at rest one phone is visibly both — on a phone only one is shown.
    function rest() {
      var first = phones.filter(function (phone) {
        return phone.offsetWidth;
      })[0];
      if (!first) return 50;
      var box = split.getBoundingClientRect();
      var r = first.getBoundingClientRect();
      return clamp(((r.left + r.width / 2 - box.left) / box.width) * 100, 0, 100);
    }

    function apply() {
      split.style.setProperty('--pos', pos.toFixed(2) + '%');
      var box = split.getBoundingClientRect();
      var x = box.left + (box.width * pos) / 100;
      phones.forEach(function (phone) {
        if (!phone.offsetWidth) return;
        var r = phone.getBoundingClientRect();
        phone.style.setProperty('--cut', clamp((x - r.left) / r.width, 0, 1).toFixed(4));
      });
      range.value = String(Math.round(pos));
    }

    function follow(e) {
      var box = split.getBoundingClientRect();
      pos = clamp(((e.clientX - box.left) / box.width) * 100, 0, 100);
      apply();
    }

    function end() {
      dragging = false;
      split.classList.remove('is-dragging');
    }

    split.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      dragging = true;
      touched = true;
      split.classList.add('is-dragging');
      if (split.setPointerCapture) split.setPointerCapture(e.pointerId);
      follow(e);
    });
    split.addEventListener('pointermove', function (e) {
      if (dragging) follow(e);
    });
    split.addEventListener('pointerup', end);
    split.addEventListener('pointercancel', end);

    range.addEventListener('input', function () {
      touched = true;
      pos = Number(range.value);
      apply();
    });

    onMeasure.push(function () {
      if (!touched) pos = rest();
      apply();
    });
    pos = rest();
    apply();

    if (reduce) return;
    whenSeen(
      split,
      function () {
        var end = rest();
        var legs = [
          [end, 16, 900],
          [16, 84, 1300],
          [84, end, 900],
        ];
        var leg = 0;
        var t0 = performance.now() + 400;
        (function step(now) {
          if (touched) return;
          var t = clamp((now - t0) / legs[leg][2], 0, 1);
          pos = legs[leg][0] + (legs[leg][1] - legs[leg][0]) * easeInOut(t);
          apply();
          if (t >= 1) {
            leg += 1;
            t0 = now;
            if (leg === legs.length) return;
          }
          requestAnimationFrame(step);
        })(performance.now());
      },
      0.5,
    );
  });

  // ---------------------------------------------------------------------------
  // 12. A lamp follows the pointer across each feature card. It goes out by
  //     fading where it is, not by jumping back to where it started.
  // ---------------------------------------------------------------------------

  safely('lamps', function () {
    all('.feature-card').forEach(function (card) {
      card.addEventListener('pointermove', function (e) {
        var box = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - box.left).toFixed(0) + 'px');
        card.style.setProperty('--my', (e.clientY - box.top).toFixed(0) + 'px');
      });
    });
  });

  measure();
  window.rehearsioHome = true;
})();

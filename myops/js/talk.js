// Voice conversation: asks three questions, listens, and lights the circle with your voice.
// Uses the real microphone (Web Audio for loudness, Web Speech API for the transcript).
// If the mic isn't available, it falls back to a scripted demo so the flow still works.
(function () {
  var QUESTIONS = [
    'Tell me about yourself.',
    'What do you want to study, and why?',
    "What's something you've done that you're proud of?"
  ];
  var DEMO_ANSWERS = [
    "I'm a first-year in college. My parents run a small restaurant and I've worked there since I was fourteen.",
    "Biology. I want to go into public health, mostly because I've seen how hard it is for my family to get care.",
    'I started a free tutoring group at my high school and kept it running for three years.'
  ];

  var $ = function (id) { return document.getElementById(id); };
  var el = {
    progress: $('progress'), conversation: $('conversation'), results: $('results'),
    dome: $('dome'), orb: $('orb'), haloWrap: $('halo-wrap'), halo: $('halo'), sky: $('sky'),
    eyebrow: $('eyebrow'), question: $('question'), transcript: $('transcript'),
    controls: $('talk-controls'), btn: $('talk-btn'), label: $('talk-label'), note: $('mode-note'),
    traits: $('traits'), matches: $('matches'), restart: $('restart')
  };

  var state = { phase: 'ask', turn: 0, answers: [], level: 0, angle: 0, text: '' };
  var mode = null; // 'live' or 'demo'
  var audio = null; // { ctx, analyser, buf }
  var recog = null, finalText = '', interimText = '';
  var demoTimer = null, demoWords = 0, rafId = null, t1 = null, t2 = null;

  var LOOKS = {
    ask:       { sky: '#8DC0EF', glow: '0 0 0 1px rgba(255,255,255,0.15), 0 0 80px rgba(255,220,180,0.35)', skyCls: 'sky-idle', dome: 1,    halo: 0.35, haloCls: 'halo-drift' },
    listening: { sky: '#F3BFA4', glow: null, skyCls: '', dome: 1.04, halo: null, haloCls: '' },
    heard:     { sky: '#F6E3B0', glow: '0 0 0 1px rgba(255,255,255,0.2), 0 0 100px 10px rgba(255,226,170,0.45)', skyCls: '', dome: 1, halo: 0.55, haloCls: 'halo-drift' },
    matching:  { sky: '#FFFFFF', glow: '0 0 0 1px rgba(255,255,255,0.3), 0 0 200px 70px rgba(255,240,210,0.7)', skyCls: 'sky-open', dome: 1.25, halo: 1, haloCls: 'halo-spin' }
  };

  // ---------- rendering ----------
  function render() {
    var p = state.phase;
    var look = LOOKS[p];
    if (look) {
      el.sky.style.backgroundColor = look.sky;
      el.sky.className = 'sky ' + look.skyCls;
      el.halo.className = 'halo ' + look.haloCls;
      el.dome.style.transform = 'scale(' + look.dome + ')';
      if (look.glow) el.sky.style.boxShadow = look.glow;
      if (look.halo !== null) { el.haloWrap.style.opacity = look.halo; el.haloWrap.style.transform = p === 'matching' ? 'scale(1.35)' : 'scale(1)'; }
      if (p !== 'listening') el.orb.style.transform = 'scale(1)';
    }
    el.progress.textContent = p === 'results' ? 'Done' : p === 'matching' ? 'Matching' : (state.turn + 1) + ' / ' + QUESTIONS.length;
    el.eyebrow.textContent = { listening: 'Listening', heard: 'Got it', matching: 'Matching' }[p] || ('Question ' + (state.turn + 1) + ' of ' + QUESTIONS.length);
    el.question.textContent = p === 'matching' ? 'Finding your best fits' : QUESTIONS[state.turn];
    var t = '';
    if (p === 'ask') t = state.turn === 0 ? 'Talk for as long as you like. A minute is plenty.' : '';
    if (p === 'listening') t = state.text ? '“' + state.text : '';
    if (p === 'heard') t = state.text ? '“' + state.text + '”' : '';
    if (p === 'matching') t = 'Reading what you shared against our scholarships.';
    el.transcript.textContent = t;
    el.controls.hidden = !(p === 'ask' || p === 'listening');
    el.label.textContent = p === 'listening' ? "I'm done" : 'Start talking';
    el.btn.setAttribute('aria-pressed', p === 'listening' ? 'true' : 'false');
    el.conversation.hidden = p === 'results';
    el.results.hidden = p !== 'results';
  }

  // The light follows your voice: louder = bigger, brighter, faster swirl.
  function paintLevel() {
    var lv = state.level;
    el.sky.style.boxShadow = '0 0 0 1px rgba(255,255,255,0.2), 0 0 ' + Math.round(50 + lv * 160) + 'px ' + Math.round(lv * 46) + 'px rgba(255,205,150,' + (0.3 + lv * 0.45).toFixed(2) + ')';
    el.orb.style.transform = 'scale(' + (1 + lv * 0.07).toFixed(3) + ')';
    el.haloWrap.style.opacity = (0.45 + lv * 0.55).toFixed(2);
    el.haloWrap.style.transform = 'scale(' + (1 + lv * 0.28).toFixed(3) + ')';
    el.halo.style.setProperty('--angle', Math.round(state.angle) + 'deg');
  }

  function loop() {
    if (state.phase !== 'listening') return;
    var target = 0.05;
    if (mode === 'live' && audio) {
      audio.analyser.getByteTimeDomainData(audio.buf);
      var sum = 0;
      for (var i = 0; i < audio.buf.length; i++) { var v = (audio.buf[i] - 128) / 128; sum += v * v; }
      target = Math.min(1, Math.sqrt(sum / audio.buf.length) * 5);
    } else if (demoWords < DEMO_ANSWERS[state.turn].split(' ').length) {
      target = 0.25 + Math.random() * 0.75;
    }
    state.level = state.level * 0.8 + target * 0.2;
    state.angle = (state.angle + 1 + state.level * 9) % 360;
    paintLevel();
    rafId = requestAnimationFrame(loop);
  }

  // ---------- microphone ----------
  function setupLive() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) return Promise.reject(new Error('no mic api'));
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function (stream) {
      var Ctx = window.AudioContext || window.webkitAudioContext;
      var ctx = new Ctx();
      var analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      ctx.createMediaStreamSource(stream).connect(analyser);
      audio = { ctx: ctx, analyser: analyser, buf: new Uint8Array(analyser.fftSize) };
      var SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SR) {
        recog = new SR();
        recog.continuous = true;
        recog.interimResults = true;
        recog.lang = 'en-US';
        recog.onresult = function (e) {
          interimText = '';
          for (var i = e.resultIndex; i < e.results.length; i++) {
            if (e.results[i].isFinal) finalText += e.results[i][0].transcript + ' ';
            else interimText += e.results[i][0].transcript;
          }
          state.text = (finalText + interimText).trim();
          if (state.phase === 'listening') render();
        };
        recog.onerror = function () {};
      } else {
        showNote("Your browser can't transcribe speech, but the light still follows your voice. Try Chrome for transcripts.");
      }
      mode = 'live';
    });
  }

  function showNote(msg) { el.note.textContent = msg; el.note.hidden = false; }

  function ensureMode() {
    if (mode) return Promise.resolve();
    return setupLive().catch(function () {
      mode = 'demo';
      showNote('Demo mode: no microphone access, so this plays a sample answer.');
    });
  }

  // ---------- flow ----------
  function start() {
    if (state.phase !== 'ask') return;
    state.phase = 'listening';
    state.text = '';
    render();
    ensureMode().then(function () {
      if (state.phase !== 'listening') return;
      if (mode === 'live') {
        if (audio.ctx.state === 'suspended') audio.ctx.resume();
        finalText = ''; interimText = '';
        if (recog) { try { recog.start(); } catch (e) {} }
      } else {
        demoWords = 0;
        var words = DEMO_ANSWERS[state.turn].split(' ');
        clearInterval(demoTimer);
        demoTimer = setInterval(function () {
          if (demoWords < words.length) { demoWords++; state.text = words.slice(0, demoWords).join(' '); render(); }
        }, 170);
      }
      cancelAnimationFrame(rafId);
      rafId = requestAnimationFrame(loop);
    });
  }

  function stop() {
    if (state.phase !== 'listening') return;
    clearInterval(demoTimer);
    cancelAnimationFrame(rafId);
    if (recog) { try { recog.stop(); } catch (e) {} }
    if (mode === 'demo') state.text = DEMO_ANSWERS[state.turn];
    state.answers[state.turn] = state.text;
    state.level = 0;
    state.phase = 'heard';
    render();
    var turn = state.turn;
    t1 = setTimeout(function () {
      if (turn < QUESTIONS.length - 1) {
        state.turn = turn + 1; state.text = ''; state.phase = 'ask'; render();
      } else {
        state.phase = 'matching'; render();
        t2 = setTimeout(function () {
          window.matchScholarships(state.answers).then(showResults);
        }, 2600);
      }
    }, 1500);
  }

  function showResults(data) {
    el.traits.textContent = '';
    data.traits.forEach(function (t) {
      var s = document.createElement('span'); s.className = 'trait'; s.textContent = t; el.traits.appendChild(s);
    });
    el.matches.textContent = '';
    data.matches.forEach(function (m) {
      var card = document.createElement('article'); card.className = 'card';
      var art = document.createElement('div'); art.className = 'card-art'; art.setAttribute('aria-hidden', 'true'); art.style.background = m.art;
      var fit = document.createElement('span'); fit.className = 'card-fit'; fit.textContent = m.fit; art.appendChild(fit);
      var body = document.createElement('div'); body.className = 'card-body';
      var head = document.createElement('div');
      var h = document.createElement('h2'); h.textContent = m.name;
      var meta = document.createElement('p'); meta.className = 'card-meta'; meta.textContent = m.amount + ' · Due ' + m.deadline;
      head.appendChild(h); head.appendChild(meta);
      var why = document.createElement('div'); why.className = 'card-why';
      var wl = document.createElement('span'); wl.textContent = 'Why you';
      var wt = document.createElement('span'); wt.textContent = m.why;
      why.appendChild(wl); why.appendChild(wt);
      var link = document.createElement('a'); link.className = 'card-link'; link.href = m.url || '#'; link.textContent = 'View details';
      body.appendChild(head); body.appendChild(why); body.appendChild(link);
      card.appendChild(art); card.appendChild(body);
      el.matches.appendChild(card);
    });
    state.phase = 'results';
    render();
  }

  function restart() {
    clearTimeout(t1); clearTimeout(t2); clearInterval(demoTimer); cancelAnimationFrame(rafId);
    state = { phase: 'ask', turn: 0, answers: [], level: 0, angle: 0, text: '' };
    render();
  }

  // ---------- input ----------
  el.btn.addEventListener('click', function () { if (state.phase === 'ask') start(); else stop(); });
  el.restart.addEventListener('click', restart);

  function isSpace(e) { return e.code === 'Space' || e.key === ' '; }
  function typing(e) { var t = e.target; return t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
  // Hold Space anywhere on the page to talk; let go to finish.
  document.addEventListener('keydown', function (e) {
    if (!isSpace(e) || typing(e)) return;
    e.preventDefault();
    if (!e.repeat) start();
  });
  document.addEventListener('keyup', function (e) {
    if (!isSpace(e) || typing(e)) return;
    e.preventDefault();
    stop();
  });

  render();
})();

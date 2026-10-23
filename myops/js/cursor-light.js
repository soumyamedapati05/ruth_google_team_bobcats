// Warm light that follows the cursor across the page.
(function () {
  var light = document.getElementById('cursor-light');
  if (!light) return;
  var base = light.style.background;
  var frame = null, x = 0, y = 0;
  function paint() {
    frame = null;
    light.style.background = base.replace(/at [^,]+?,/, 'at ' + x + 'px ' + y + 'px,');
  }
  document.addEventListener('mousemove', function (e) {
    x = e.clientX; y = e.clientY;
    light.style.opacity = '1';
    if (!frame) frame = requestAnimationFrame(paint);
  });
  document.documentElement.addEventListener('mouseleave', function () { light.style.opacity = '0'; });
})();

// On the home page, Space opens the conversation (unless you're typing somewhere).
(function () {
  if (!document.body.hasAttribute('data-space-to-talk')) return;
  document.addEventListener('keydown', function (e) {
    var t = e.target;
    var typing = t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(t.tagName));
    if ((e.code === 'Space' || e.key === ' ') && !typing && !e.repeat) {
      e.preventDefault();
      window.location.href = 'talk.html';
    }
  });
})();

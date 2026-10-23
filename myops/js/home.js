// Skyspace hero: start the light cycle at the visitor's real time of day,
// and shift the sky opening slightly with the cursor for depth.
(function () {
  var DAY_SECONDS = 40; // one full day of light, matches --day in the page
  var d = new Date();
  var offset = -(((d.getHours() * 60 + d.getMinutes()) / 1440) * DAY_SECONDS);
  document.documentElement.style.setProperty('--offset', offset.toFixed(2) + 's');

  var hero = document.getElementById('top');
  var aperture = document.getElementById('aperture');
  if (!hero || !aperture) return;
  hero.addEventListener('mousemove', function (e) {
    var r = hero.getBoundingClientRect();
    var hx = ((e.clientX - r.left) / r.width) * 2 - 1;
    var hy = ((e.clientY - r.top) / r.height) * 2 - 1;
    aperture.style.transform = 'translate(calc(-50% + ' + Math.round(-hx * 14) + 'px), calc(-50% + ' + Math.round(-hy * 8) + 'px))';
  });
  hero.addEventListener('mouseleave', function () { aperture.style.transform = 'translate(-50%, -50%)'; });
})();

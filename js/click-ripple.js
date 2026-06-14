(function () {
  function createRipple(event) {
    if (event.button !== 0) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const ripple = document.createElement('span');
    ripple.className = 'click-ripple';
    ripple.style.left = `${event.clientX}px`;
    ripple.style.top = `${event.clientY}px`;
    document.body.appendChild(ripple);

    window.setTimeout(function () {
      ripple.remove();
    }, 900);
  }

  document.addEventListener('pointerdown', createRipple, { passive: true });
})();

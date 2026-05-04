(function () {
  function initSnow() {
    const header = document.querySelector('#page-header');
    if (!header) return;

    // 避免重复创建
    const oldCanvas = document.querySelector('#snow-canvas');
    if (oldCanvas) oldCanvas.remove();

    // 确保顶部区域可以作为定位容器
    const headerStyle = window.getComputedStyle(header);
    if (headerStyle.position === 'static') {
      header.style.position = 'relative';
    }
    header.style.overflow = 'hidden';

    const canvas = document.createElement('canvas');
    canvas.id = 'snow-canvas';
    header.appendChild(canvas);

    const ctx = canvas.getContext('2d');

    let width = 0;
    let height = 0;
    const snowflakes = [];
    const snowCount = 120;

    function random(min, max) {
      return Math.random() * (max - min) + min;
    }

    function resizeCanvas() {
      width = header.offsetWidth;
      height = header.offsetHeight;
      canvas.width = width;
      canvas.height = height;
    }

    function createSnowflake(initial = false) {
      return {
        x: random(0, width),
        y: initial ? random(0, height) : random(-20, 0),
        r: random(1, 3.2),
        speedY: random(0.2, 0.8), // 雪花速度
        drift: random(-0.5, 0.5),
        swing: random(0.2, 0.8) // 雪花摇摆幅度
      };
    }

    function resetSnowflakes() {
      snowflakes.length = 0;
      for (let i = 0; i < snowCount; i++) {
        snowflakes.push(createSnowflake(true));
      }
    }

    function draw() {
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      ctx.beginPath();

      for (let i = 0; i < snowflakes.length; i++) {
        const f = snowflakes[i];
        ctx.moveTo(f.x, f.y);
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2, true);
      }

      ctx.fill();
      update();
      requestAnimationFrame(draw);
    }

    function update() {
      for (let i = 0; i < snowflakes.length; i++) {
        const f = snowflakes[i];
        f.y += f.speedY;
        f.x += Math.sin(f.y * 0.01) * f.swing + f.drift;

        if (f.y > height || f.x < -10 || f.x > width + 10) {
          snowflakes[i] = createSnowflake(false);
        }
      }
    }

    resizeCanvas();
    resetSnowflakes();
    draw();

    window.addEventListener('resize', function () {
      resizeCanvas();
      resetSnowflakes();
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initSnow);
  } else {
    initSnow();
  }
})();
(function () {
  const HERO_CONFIG = {
    avatar: '/img/avatar.jpg',
    name: 'Flourish',
    texts: [
      "Peace and joy, a promising future ahead.",
      "在雪落下的时候，记录声音、灵感和生活。",
      "慢慢听，慢慢写，慢慢成为自己。"
    ],
    typeSpeed: 85,
    deleteSpeed: 45,
    stayTime: 1800
  };

  let typingTimer = null;
  let hasStarted = false;

  function clearTypingTimer() {
    if (typingTimer) {
      clearTimeout(typingTimer);
      typingTimer = null;
    }
  }

  function createHero() {
    const siteInfo = document.querySelector('#site-info');
    const pageHeader = document.querySelector('#page-header');

    if (!siteInfo || !pageHeader) return;

    // 只在首页顶部大图生效，文章页和普通页面不插入
    if (!pageHeader.classList.contains('full_page')) return;

    // 避免重复插入
    if (document.querySelector('.custom-hero-avatar')) return;

    const oldTitle = document.querySelector('#site-title');
    const oldSubtitle = document.querySelector('#site-subtitle');

    if (oldTitle) {
      oldTitle.textContent = HERO_CONFIG.name;
    }

    if (oldSubtitle) {
      oldSubtitle.remove();
    }

    const avatarBox = document.createElement('div');
    avatarBox.className = 'custom-hero-avatar';
    avatarBox.innerHTML = `<img src="${HERO_CONFIG.avatar}" alt="avatar">`;

    const divider = document.createElement('div');
    divider.className = 'custom-hero-divider';

    const typewriter = document.createElement('div');
    typewriter.className = 'custom-hero-typewriter';
    typewriter.innerHTML = `<span id="hero-typewriter-text"></span><span class="hero-cursor">|</span>`;

    siteInfo.insertBefore(avatarBox, siteInfo.firstChild);

    if (oldTitle) {
      oldTitle.insertAdjacentElement('afterend', divider);
      divider.insertAdjacentElement('afterend', typewriter);
    } else {
      siteInfo.appendChild(divider);
      siteInfo.appendChild(typewriter);
    }
  }

  function startTypewriter() {
    const target = document.querySelector('#hero-typewriter-text');
    if (!target || hasStarted) return;

    hasStarted = true;
    clearTypingTimer();

    let textIndex = 0;
    let charIndex = 0;
    let deleting = false;

    function typeLoop() {
      const currentText = HERO_CONFIG.texts[textIndex];

      if (!deleting) {
        target.textContent = currentText.slice(0, charIndex + 1);
        charIndex++;

        if (charIndex === currentText.length) {
          deleting = true;
          typingTimer = setTimeout(typeLoop, HERO_CONFIG.stayTime);
          return;
        }

        typingTimer = setTimeout(typeLoop, HERO_CONFIG.typeSpeed);
      } else {
        target.textContent = currentText.slice(0, charIndex - 1);
        charIndex--;

        if (charIndex === 0) {
          deleting = false;
          textIndex = (textIndex + 1) % HERO_CONFIG.texts.length;
          typingTimer = setTimeout(typeLoop, 450);
          return;
        }

        typingTimer = setTimeout(typeLoop, HERO_CONFIG.deleteSpeed);
      }
    }

    typeLoop();
  }

  function initHomeHero() {
    clearTypingTimer();
    hasStarted = false;
    createHero();
    startTypewriter();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initHomeHero);
  } else {
    initHomeHero();
  }

  // Butterfly 如果开了 PJAX，切换页面后也能重新生效
  document.addEventListener('pjax:complete', initHomeHero);
})();
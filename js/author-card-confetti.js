(() => {
  const initializedCards = new WeakSet()
  const activeCards = new Set()
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const colors = ['#68b7ff', '#8f8cff', '#ff8fc4', '#ffc86b', '#56d5b0', '#7fd66f']

  function createPiece(card, layer) {
    if (layer.childElementCount >= 30) return

    const piece = document.createElement('span')
    const width = 2 + Math.random() * 2
    const height = 4 + Math.random() * 5
    const fallDistance = card.clientHeight + 42
    piece.className = 'author-confetti-piece'
    piece.style.setProperty('--confetti-x', `${4 + Math.random() * 92}%`)
    piece.style.setProperty('--confetti-width', `${width}px`)
    piece.style.setProperty('--confetti-height', `${height}px`)
    piece.style.setProperty('--confetti-color', colors[Math.floor(Math.random() * colors.length)])
    piece.style.setProperty('--confetti-duration', `${1.2 + Math.random() * 0.85}s`)
    piece.style.setProperty('--confetti-drift', `${-28 + Math.random() * 56}px`)
    piece.style.setProperty('--confetti-spin', `${240 + Math.random() * 520}deg`)
    piece.style.setProperty('--confetti-fall-distance', `${fallDistance}px`)
    piece.addEventListener('animationend', () => piece.remove(), { once: true })
    layer.appendChild(piece)
  }

  function startConfetti(card, layer) {
    if (card._confettiTimer || reducedMotionQuery.matches) return

    activeCards.add(card)
    for (let index = 0; index < 6; index += 1) createPiece(card, layer)
    card._confettiTimer = window.setInterval(() => {
      createPiece(card, layer)
      createPiece(card, layer)
    }, 190)
  }

  function stopConfetti(card, layer) {
    if (card._confettiTimer) {
      window.clearInterval(card._confettiTimer)
      card._confettiTimer = null
    }
    activeCards.delete(card)
    layer.replaceChildren()
  }

  function initCard(card) {
    if (initializedCards.has(card)) return

    const layer = document.createElement('div')
    layer.className = 'author-card-confetti'
    layer.setAttribute('aria-hidden', 'true')
    card.prepend(layer)
    card.addEventListener('mouseenter', () => startConfetti(card, layer))
    card.addEventListener('mousemove', () => startConfetti(card, layer), { passive: true })
    card.addEventListener('mouseleave', () => stopConfetti(card, layer))
    initializedCards.add(card)
  }

  function initAuthorCardConfetti() {
    document.querySelectorAll('#aside-content .card-info').forEach(initCard)
  }

  function stopAllConfetti() {
    activeCards.forEach(card => {
      const layer = card.querySelector('.author-card-confetti')
      if (layer) stopConfetti(card, layer)
    })
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuthorCardConfetti, { once: true })
  } else {
    initAuthorCardConfetti()
  }

  document.addEventListener('pjax:send', stopAllConfetti)
  document.addEventListener('pjax:complete', initAuthorCardConfetti)
  document.addEventListener('mousemove', event => {
    activeCards.forEach(card => {
      if (card.contains(event.target)) return
      const layer = card.querySelector('.author-card-confetti')
      if (layer) stopConfetti(card, layer)
    })
  }, { passive: true })
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stopAllConfetti()
  })
})()

(() => {
  let syncPending = false

  const getCodeContent = figure => {
    try {
      return figure.querySelector(':scope > table, :scope > pre')
    } catch (error) {
      return figure.querySelector('table, pre')
    }
  }

  const syncHighlightTools = () => {
    document.querySelectorAll('#article-container figure.highlight').forEach(figure => {
      const tools = figure.querySelector('.highlight-tools')
      const codeContent = getCodeContent(figure)
      if (!tools || !codeContent) return

      tools.style.width = ''
      tools.style.minWidth = ''
      tools.style.removeProperty('--codeblock-content-width')

      const codeWidth = Math.ceil(Math.max(
        figure.clientWidth,
        codeContent.scrollWidth,
        codeContent.getBoundingClientRect().width
      ))

      tools.style.setProperty('--codeblock-content-width', `${codeWidth}px`)
    })
  }

  const scheduleSync = () => {
    if (syncPending) return
    syncPending = true

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        syncPending = false
        syncHighlightTools()
      })
    })
  }

  const observeArticle = () => {
    const article = document.getElementById('article-container')
    if (!article || article.dataset.codeblockToolsObserved) return

    article.dataset.codeblockToolsObserved = 'true'
    new MutationObserver(scheduleSync).observe(article, {
      childList: true,
      subtree: true
    })
  }

  const init = () => {
    observeArticle()
    scheduleSync()
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init, { once: true })
  } else {
    init()
  }

  window.addEventListener('load', scheduleSync)
  window.addEventListener('resize', scheduleSync)
  document.addEventListener('pjax:complete', init)
})()

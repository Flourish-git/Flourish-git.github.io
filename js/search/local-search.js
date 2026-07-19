/**
 * Refer to hexo-generator-searchdb
 * https://github.com/next-theme/hexo-generator-searchdb/blob/main/dist/search.js
 * Modified by hexo-theme-butterfly
 */

class LocalSearch {
  constructor ({
    path = '',
    unescape = false,
    top_n_per_article = 1
  }) {
    this.path = path
    this.unescape = unescape
    this.top_n_per_article = top_n_per_article
    this.isfetched = false
    this.datas = null
  }

  getIndexByWord (words, text, caseSensitive = false) {
    const index = []
    const included = new Set()

    if (!caseSensitive) {
      text = text.toLowerCase()
    }
    words.forEach(word => {
      if (this.unescape) {
        const div = document.createElement('div')
        div.innerText = word
        word = div.innerHTML
      }
      const wordLen = word.length
      if (wordLen === 0) return
      let startPosition = 0
      let position = -1
      if (!caseSensitive) {
        word = word.toLowerCase()
      }
      while ((position = text.indexOf(word, startPosition)) > -1) {
        index.push({ position, word })
        included.add(word)
        startPosition = position + wordLen
      }
    })
    // Sort index by position of keyword
    index.sort((left, right) => {
      if (left.position !== right.position) {
        return left.position - right.position
      }
      return right.word.length - left.word.length
    })
    return [index, included]
  }

  // Merge hits into slices
  mergeIntoSlice (start, end, index) {
    let item = index[0]
    let { position, word } = item
    const hits = []
    const count = new Set()
    while (position + word.length <= end && index.length !== 0) {
      count.add(word)
      hits.push({
        position,
        length: word.length
      })
      const wordEnd = position + word.length

      // Move to next position of hit
      index.shift()
      while (index.length !== 0) {
        item = index[0]
        position = item.position
        word = item.word
        if (wordEnd > position) {
          index.shift()
        } else {
          break
        }
      }
    }
    return {
      hits,
      start,
      end,
      count: count.size
    }
  }

  // Highlight title and content
  highlightKeyword (val, slice) {
    let result = ''
    let index = slice.start
    for (const { position, length } of slice.hits) {
      result += val.substring(index, position)
      index = position + length
      result += `<mark class="search-keyword">${val.substr(position, length)}</mark>`
    }
    result += val.substring(index, slice.end)
    return result
  }

  highlightTerms (value, keywords) {
    if (!keywords.length) return value
    const [indexes] = this.getIndexByWord(keywords, value)
    if (!indexes.length) return value
    return this.highlightKeyword(value, this.mergeIntoSlice(0, value.length, indexes))
  }

  getResultItems ({ keywords, tagFilters, categoryFilters, scope }) {
    const resultItems = []
    this.datas.forEach(({ title, content, url, tags = [], categories = [] }) => {
      const normalizedTags = tags.map(tag => tag.toLowerCase())
      const normalizedCategories = categories.map(category => category.toLowerCase())
      if (!tagFilters.every(tag => normalizedTags.includes(tag))) return
      if (!categoryFilters.every(category => normalizedCategories.includes(category))) return

      const [indexOfTitle, keysOfTitle] = this.getIndexByWord(keywords, title)
      const [indexOfContent, keysOfContent] = this.getIndexByWord(keywords, content)
      const [indexOfTags, keysOfTags] = this.getIndexByWord(keywords, tags.join(' '))
      const [indexOfCategories, keysOfCategories] = this.getIndexByWord(keywords, categories.join(' '))
      const scopeHits = {
        all: indexOfTitle.length + indexOfContent.length + indexOfTags.length + indexOfCategories.length,
        article: indexOfTitle.length + indexOfContent.length,
        tag: indexOfTags.length,
        category: indexOfCategories.length
      }
      const hasFilters = tagFilters.length > 0 || categoryFilters.length > 0
      if (keywords.length && scopeHits[scope] === 0) return
      if (!keywords.length && !hasFilters) return

      const includedCount = new Set([
        ...keysOfTitle,
        ...keysOfContent,
        ...keysOfTags,
        ...keysOfCategories
      ]).size

      const hitCount = scopeHits[scope]

      const slicesOfTitle = []
      if (indexOfTitle.length !== 0) {
        slicesOfTitle.push(this.mergeIntoSlice(0, title.length, indexOfTitle))
      }

      let slicesOfContent = []
      while (indexOfContent.length !== 0) {
        const item = indexOfContent[0]
        const { position } = item
        // Cut out 120 characters. The maxlength of .search-input is 80.
        const start = Math.max(0, position - 20)
        const end = Math.min(content.length, position + 100)
        slicesOfContent.push(this.mergeIntoSlice(start, end, indexOfContent))
      }

      // Sort slices in content by included keywords' count and hits' count
      slicesOfContent.sort((left, right) => {
        if (left.count !== right.count) {
          return right.count - left.count
        } else if (left.hits.length !== right.hits.length) {
          return right.hits.length - left.hits.length
        }
        return left.start - right.start
      })

      // Select top N slices in content
      const upperBound = parseInt(this.top_n_per_article, 10)
      if (upperBound >= 0) {
        slicesOfContent = slicesOfContent.slice(0, upperBound)
      }

      url = new URL(url, location.origin)
      if (keywords.length) url.searchParams.append('highlight', keywords.join(' '))

      let resultItem = `<li class="local-search-hit-item"><a href="${url.href}">`
      if (slicesOfTitle.length !== 0) {
        resultItem += `<span class="search-result-title">${this.highlightKeyword(title, slicesOfTitle[0])}</span>`
      } else {
        resultItem += `<span class="search-result-title">${title}</span>`
      }

      if (categories.length || tags.length) {
        resultItem += '<span class="search-result-meta">'
        categories.forEach(category => {
          resultItem += `<span class="search-result-category"><i class="fas fa-folder-open" aria-hidden="true"></i>${this.highlightTerms(category, keywords)}</span>`
        })
        tags.forEach(tag => {
          resultItem += `<span class="search-result-tag"><i class="fas fa-tag" aria-hidden="true"></i>${this.highlightTerms(tag, keywords)}</span>`
        })
        resultItem += '</span>'
      }

      slicesOfContent.forEach(slice => {
        const prefix = slice.start > 0 ? '...' : ''
        const suffix = slice.end < content.length ? '...' : ''
        resultItem += `<p class="search-result">${prefix}${this.highlightKeyword(content, slice)}${suffix}</p>`
      })

      if (!slicesOfContent.length && content) {
        resultItem += `<p class="search-result">${content.slice(0, 120)}${content.length > 120 ? '...' : ''}</p>`
      }

      resultItem += '</a></li>'
      resultItems.push({
        item: resultItem,
        id: resultItems.length,
        hitCount,
        includedCount
      })
    })
    return resultItems
  }

  fetchData () {
    const isXml = !this.path.endsWith('json')
    fetch(this.path)
      .then(response => response.text())
      .then(res => {
        // Get the contents from search data
        this.isfetched = true
        this.datas = isXml
          ? [...new DOMParser().parseFromString(res, 'text/xml').querySelectorAll('entry')].map(element => ({
              title: element.querySelector('title').textContent,
              content: element.querySelector('content').textContent,
              url: element.querySelector('url').textContent
            }))
          : JSON.parse(res)
        // Only match articles with non-empty titles
        this.datas = this.datas.filter(data => data.title).map(data => {
          data.title = data.title.trim()
          data.content = data.content
            ? data.content
                .replace(/<[^>]+>/g, ' ')
                .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
                .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
                .replace(/^#{1,6}\s+/gm, '')
                .replace(/```[^\n]*|```|`/g, ' ')
                .replace(/[>*_~|]/g, ' ')
                .replace(/\s+/g, ' ')
                .trim()
            : ''
          data.url = decodeURIComponent(data.url).replace(/\/{2,}/g, '/')
          data.tags = Array.isArray(data.tags) ? data.tags.map(tag => String(tag).trim()).filter(Boolean) : []
          data.categories = Array.isArray(data.categories) ? data.categories.map(category => String(category).trim()).filter(Boolean) : []
          return data
        })
        // Remove loading animation
        window.dispatchEvent(new Event('search:loaded'))
      })
  }

  // Highlight by wrapping node in mark elements with the given class name
  highlightText (node, slice, className) {
    const val = node.nodeValue
    let index = slice.start
    const children = []
    for (const { position, length } of slice.hits) {
      const text = document.createTextNode(val.substring(index, position))
      index = position + length
      const mark = document.createElement('mark')
      mark.className = className
      mark.appendChild(document.createTextNode(val.substr(position, length)))
      children.push(text, mark)
    }
    node.nodeValue = val.substring(index, slice.end)
    children.forEach(element => {
      node.parentNode.insertBefore(element, node)
    })
  }

  // Highlight the search words provided in the url in the text
  highlightSearchWords (body) {
    const params = new URL(location.href).searchParams.get('highlight')
    const keywords = params ? params.split(' ') : []
    if (!keywords.length || !body) return
    const walk = document.createTreeWalker(body, NodeFilter.SHOW_TEXT, null)
    const allNodes = []
    while (walk.nextNode()) {
      if (!walk.currentNode.parentNode.matches('button, select, textarea, .mermaid')) allNodes.push(walk.currentNode)
    }
    allNodes.forEach(node => {
      const [indexOfNode] = this.getIndexByWord(keywords, node.nodeValue)
      if (!indexOfNode.length) return
      const slice = this.mergeIntoSlice(0, node.nodeValue.length, indexOfNode)
      this.highlightText(node, slice, 'search-keyword')
    })
  }
}

window.addEventListener('load', () => {
// Search
  const { path, top_n_per_article, unescape, languages, pagination } = GLOBAL_CONFIG.localSearch
  const enablePagination = pagination && pagination.enable
  const localSearch = new LocalSearch({
    path,
    top_n_per_article,
    unescape
  })

  const input = document.querySelector('.local-search-input input')
  const statsItem = document.getElementById('local-search-stats')
  const $loadingStatus = document.getElementById('loading-status')
  const scopeButtons = [...document.querySelectorAll('.local-search-scope-button')]
  const activeFilters = document.getElementById('local-search-active-filters')
  const recentSearch = document.getElementById('local-search-recent')
  const recentSearchList = recentSearch.querySelector('.local-search-recent-list')
  const recentSearchClear = recentSearch.querySelector('.local-search-recent-clear')
  const isXml = !path.endsWith('json')
  const recentSearchKey = 'flourish:recent-searches'
  let currentScope = 'all'
  let activeResultIndex = -1

  // Pagination variables (only initialize if pagination is enabled)
  let currentPage = 0
  const hitsPerPage = pagination.hitsPerPage || 10

  let currentResultItems = []

  if (!enablePagination) {
    // If pagination is disabled, we don't need these variables
    currentPage = undefined
    currentResultItems = undefined
  }

  // Cache frequently used elements
  const elements = {
    get pagination () { return document.getElementById('local-search-pagination') },
    get paginationList () { return document.querySelector('#local-search-pagination .ais-Pagination-list') }
  }

  // Show/hide search results area
  const toggleResultsVisibility = hasResults => {
    if (enablePagination) {
      if (!hasResults) elements.pagination.style.display = 'none'
    } else {
      elements.pagination.style.display = 'none'
    }
  }

  // Render search results for current page
  const renderResults = (searchText, resultItems) => {
    const container = document.getElementById('local-search-results')

    // Determine items to display based on pagination mode
    const itemsToDisplay = enablePagination
      ? currentResultItems.slice(currentPage * hitsPerPage, (currentPage + 1) * hitsPerPage)
      : resultItems

    // Handle empty page in pagination mode
    if (enablePagination && itemsToDisplay.length === 0 && currentResultItems.length > 0) {
      currentPage = 0
      renderResults(searchText, resultItems)
      return
    }

    // Add numbering to items
    const numberedItems = itemsToDisplay.map((result, index) => {
      const itemNumber = enablePagination
        ? currentPage * hitsPerPage + index + 1
        : index + 1
      return result.item.replace(
        '<li class="local-search-hit-item">',
        `<li class="local-search-hit-item" value="${itemNumber}">`
      )
    })

    container.innerHTML = `<ol class="search-result-list">${numberedItems.join('')}</ol>`
    activeResultIndex = -1

    // Update stats
    const displayCount = enablePagination ? currentResultItems.length : resultItems.length
    const stats = languages.hits_stats.replace(/\$\{hits}/, displayCount)
    statsItem.innerHTML = `<hr><div class="search-result-stats">${stats}</div>`

    // Handle pagination
    if (enablePagination) {
      const nbPages = Math.ceil(currentResultItems.length / hitsPerPage)
      renderPagination(currentPage, nbPages, searchText)
    }

    const hasResults = resultItems.length > 0
    toggleResultsVisibility(hasResults)

    window.pjax && window.pjax.refresh(container)
  }

  // Render pagination
  const renderPagination = (page, nbPages, query) => {
    if (nbPages <= 1) {
      elements.pagination.style.display = 'none'
      elements.paginationList.innerHTML = ''
      return
    }

    elements.pagination.style.display = 'block'

    const isFirstPage = page === 0
    const isLastPage = page === nbPages - 1

    // Responsive page display
    const isMobile = window.innerWidth < 768
    const maxVisiblePages = isMobile ? 3 : 5
    let startPage = Math.max(0, page - Math.floor(maxVisiblePages / 2))
    const endPage = Math.min(nbPages - 1, startPage + maxVisiblePages - 1)

    // Adjust starting page to maintain max visible pages
    if (endPage - startPage + 1 < maxVisiblePages) {
      startPage = Math.max(0, endPage - maxVisiblePages + 1)
    }

    let pagesHTML = ''

    // Only add ellipsis and first page when there are many pages
    if (nbPages > maxVisiblePages && startPage > 0) {
      pagesHTML += `
        <li class="ais-Pagination-item ais-Pagination-item--page">
          <a class="ais-Pagination-link" aria-label="Page 1" href="#" data-page="0">1</a>
        </li>`
      if (startPage > 1) {
        pagesHTML += `
          <li class="ais-Pagination-item ais-Pagination-item--ellipsis">
            <span class="ais-Pagination-link">...</span>
          </li>`
      }
    }

    // Add middle page numbers
    for (let i = startPage; i <= endPage; i++) {
      const isSelected = i === page
      if (isSelected) {
        pagesHTML += `
          <li class="ais-Pagination-item ais-Pagination-item--page ais-Pagination-item--selected">
            <span class="ais-Pagination-link" aria-label="Page ${i + 1}">${i + 1}</span>
          </li>`
      } else {
        pagesHTML += `
          <li class="ais-Pagination-item ais-Pagination-item--page">
            <a class="ais-Pagination-link" aria-label="Page ${i + 1}" href="#" data-page="${i}">${i + 1}</a>
          </li>`
      }
    }

    // Only add ellipsis and last page when there are many pages
    if (nbPages > maxVisiblePages && endPage < nbPages - 1) {
      if (endPage < nbPages - 2) {
        pagesHTML += `
          <li class="ais-Pagination-item ais-Pagination-item--ellipsis">
            <span class="ais-Pagination-link">...</span>
          </li>`
      }
      pagesHTML += `
        <li class="ais-Pagination-item ais-Pagination-item--page">
          <a class="ais-Pagination-link" aria-label="Page ${nbPages}" href="#" data-page="${nbPages - 1}">${nbPages}</a>
        </li>`
    }

    if (nbPages > 1) {
      elements.paginationList.innerHTML = `
            <li class="ais-Pagination-item ais-Pagination-item--previousPage ${isFirstPage ? 'ais-Pagination-item--disabled' : ''}">
              ${isFirstPage
                ? '<span class="ais-Pagination-link ais-Pagination-link--disabled" aria-label="Previous Page"><i class="fas fa-angle-left"></i></span>'
                : `<a class="ais-Pagination-link" aria-label="Previous Page" href="#" data-page="${page - 1}"><i class="fas fa-angle-left"></i></a>`
              }
            </li>
            ${pagesHTML}
            <li class="ais-Pagination-item ais-Pagination-item--nextPage ${isLastPage ? 'ais-Pagination-item--disabled' : ''}">
              ${isLastPage
                ? '<span class="ais-Pagination-link ais-Pagination-link--disabled" aria-label="Next Page"><i class="fas fa-angle-right"></i></span>'
                : `<a class="ais-Pagination-link" aria-label="Next Page" href="#" data-page="${page + 1}"><i class="fas fa-angle-right"></i></a>`
              }
            </li>`
    } else {
      elements.pagination.style.display = 'none'
    }
  }

  // Clear search results and stats
  const clearSearchResults = () => {
    const container = document.getElementById('local-search-results')
    container.textContent = ''
    statsItem.textContent = ''
    activeFilters.hidden = true
    activeFilters.textContent = ''
    activeResultIndex = -1
    toggleResultsVisibility(false)
    if (enablePagination) {
      currentResultItems = []
      currentPage = 0
    }
  }

  // Show no results message
  const showNoResults = searchText => {
    const container = document.getElementById('local-search-results')
    container.textContent = ''
    const statsDiv = document.createElement('div')
    statsDiv.className = 'search-result-stats'
    statsDiv.textContent = languages.hits_empty.replace(/\$\{query}/, searchText)
    statsItem.innerHTML = statsDiv.outerHTML
    activeResultIndex = -1
    toggleResultsVisibility(false)
    if (enablePagination) {
      currentResultItems = []
      currentPage = 0
    }
  }

  const parseSearchQuery = rawQuery => {
    const filters = []
    const remaining = rawQuery.replace(/(?:^|\s)(tag|标签|category|分类):(?:"([^"]+)"|(\S+))/gi, (match, type, quotedValue, plainValue) => {
      const value = (quotedValue || plainValue || '').trim()
      if (!value) return match
      const normalizedType = /^(tag|标签)$/i.test(type) ? 'tag' : 'category'
      filters.push({ type: normalizedType, value })
      return ' '
    })
    const keywords = remaining
      .trim()
      .toLowerCase()
      .split(/[-\s]+/)
      .filter(Boolean)
    return {
      keywords,
      tagFilters: filters.filter(filter => filter.type === 'tag').map(filter => filter.value.toLowerCase()),
      categoryFilters: filters.filter(filter => filter.type === 'category').map(filter => filter.value.toLowerCase()),
      filters
    }
  }

  const renderActiveFilters = filters => {
    activeFilters.replaceChildren()
    filters.forEach(filter => {
      const chip = document.createElement('span')
      chip.className = `local-search-filter-chip is-${filter.type}`
      const icon = document.createElement('i')
      icon.className = filter.type === 'tag' ? 'fas fa-tag' : 'fas fa-folder-open'
      icon.setAttribute('aria-hidden', 'true')
      chip.append(icon, document.createTextNode(filter.value))
      activeFilters.appendChild(chip)
    })
    activeFilters.hidden = filters.length === 0
  }

  const getRecentSearches = () => {
    try {
      const value = JSON.parse(localStorage.getItem(recentSearchKey) || '[]')
      return Array.isArray(value) ? value.filter(item => typeof item === 'string').slice(0, 6) : []
    } catch (error) {
      return []
    }
  }

  const renderRecentSearches = () => {
    const searches = getRecentSearches()
    recentSearchList.replaceChildren()
    searches.forEach(query => {
      const button = document.createElement('button')
      button.type = 'button'
      button.className = 'local-search-recent-item'
      button.dataset.recentQuery = query
      const icon = document.createElement('i')
      icon.className = 'fas fa-history'
      icon.setAttribute('aria-hidden', 'true')
      button.append(icon, document.createTextNode(query))
      recentSearchList.appendChild(button)
    })
    recentSearch.hidden = input.value.trim() !== '' || searches.length === 0
  }

  const saveRecentSearch = query => {
    const value = query.trim()
    if (!value) return
    const searches = getRecentSearches().filter(item => item !== value)
    searches.unshift(value)
    try {
      localStorage.setItem(recentSearchKey, JSON.stringify(searches.slice(0, 6)))
    } catch (error) {}
    renderRecentSearches()
  }

  const inputEventFunction = () => {
    if (!localSearch.isfetched) return
    let searchText = input.value.trim()
    isXml && (searchText = searchText.replace(/</g, '&lt;').replace(/>/g, '&gt;'))
    const query = parseSearchQuery(searchText)
    query.scope = currentScope
    renderActiveFilters(query.filters)
    recentSearch.hidden = searchText !== '' || getRecentSearches().length === 0

    if (searchText !== '') $loadingStatus.hidden = false

    let resultItems = []

    if (searchText.length > 0) {
      resultItems = localSearch.getResultItems(query)
    }

    if (searchText === '') {
      clearSearchResults()
      renderRecentSearches()
    } else if (resultItems.length === 0) {
      showNoResults(searchText)
    } else {
      // Sort results by relevance
      resultItems.sort((left, right) => {
        if (left.includedCount !== right.includedCount) {
          return right.includedCount - left.includedCount
        } else if (left.hitCount !== right.hitCount) {
          return right.hitCount - left.hitCount
        }
        return right.id - left.id
      })

      if (enablePagination) {
        currentResultItems = resultItems
        currentPage = 0
      }
      renderResults(searchText, resultItems)
    }

    $loadingStatus.hidden = true
  }

  const setActiveResult = nextIndex => {
    const results = [...document.querySelectorAll('#local-search-results .local-search-hit-item')]
    if (!results.length) return
    results.forEach(result => result.classList.remove('is-keyboard-active'))
    activeResultIndex = (nextIndex + results.length) % results.length
    const activeResult = results[activeResultIndex]
    activeResult.classList.add('is-keyboard-active')
    activeResult.scrollIntoView({ block: 'nearest' })
  }

  let loadFlag = false
  const $searchMask = document.getElementById('search-mask')
  const $searchDialog = document.querySelector('#local-search .search-dialog')

  // fix safari
  const fixSafariHeight = () => {
    if (window.innerWidth < 768) {
      $searchDialog.style.setProperty('--search-height', window.innerHeight + 'px')
    }
  }

  const openSearch = () => {
    btf.overflowPaddingR.add()
    btf.animateIn($searchMask, 'to_show 0.5s')
    btf.animateIn($searchDialog, 'titleScale 0.5s')
    setTimeout(() => { input.focus() }, 300)
    renderRecentSearches()
    if (!loadFlag) {
      !localSearch.isfetched && localSearch.fetchData()
      input.addEventListener('input', inputEventFunction)
      loadFlag = true
    }
    // shortcut: ESC
    document.addEventListener('keydown', function f (event) {
      if (event.code === 'Escape') {
        closeSearch()
        document.removeEventListener('keydown', f)
      }
    })

    fixSafariHeight()
    window.addEventListener('resize', fixSafariHeight)
  }

  const closeSearch = () => {
    btf.overflowPaddingR.remove()
    btf.animateOut($searchDialog, 'search_close .5s')
    btf.animateOut($searchMask, 'to_hide 0.5s')
    window.removeEventListener('resize', fixSafariHeight)
  }

  const searchClickFn = () => {
    btf.addEventListenerPjax(document.querySelector('#search-button > .search'), 'click', openSearch)
  }

  const searchFnOnce = () => {
    $searchMask.addEventListener('click', closeSearch)
    if (GLOBAL_CONFIG.localSearch.preload) {
      localSearch.fetchData()
    }
    localSearch.highlightSearchWords(document.getElementById('article-container'))

    scopeButtons.forEach(button => {
      button.addEventListener('click', () => {
        currentScope = button.dataset.searchScope
        scopeButtons.forEach(item => {
          const isActive = item === button
          item.classList.toggle('is-active', isActive)
          item.setAttribute('aria-selected', String(isActive))
        })
        inputEventFunction()
        input.focus()
      })
    })

    recentSearchList.addEventListener('click', event => {
      const button = event.target.closest('[data-recent-query]')
      if (!button) return
      input.value = button.dataset.recentQuery
      inputEventFunction()
      input.focus()
    })

    recentSearchClear.addEventListener('click', () => {
      try {
        localStorage.removeItem(recentSearchKey)
      } catch (error) {}
      renderRecentSearches()
      input.focus()
    })

    input.addEventListener('keydown', event => {
      if (event.key === 'ArrowDown') {
        event.preventDefault()
        setActiveResult(activeResultIndex + 1)
      } else if (event.key === 'ArrowUp') {
        event.preventDefault()
        setActiveResult(activeResultIndex <= 0 ? -1 : activeResultIndex - 1)
      } else if (event.key === 'Enter') {
        const results = [...document.querySelectorAll('#local-search-results .local-search-hit-item')]
        if (!results.length) return
        event.preventDefault()
        if (activeResultIndex < 0) setActiveResult(0)
        const activeResult = results[activeResultIndex < 0 ? 0 : activeResultIndex]
        const link = activeResult.querySelector('a')
        if (link) {
          saveRecentSearch(input.value)
          link.click()
        }
      }
    })

    document.getElementById('local-search-results').addEventListener('click', event => {
      if (event.target.closest('.local-search-hit-item a')) saveRecentSearch(input.value)
    })

    // Pagination event delegation - only add if pagination is enabled
    if (enablePagination) {
      elements.pagination.addEventListener('click', e => {
        e.preventDefault()
        const link = e.target.closest('a[data-page]')
        if (link) {
          const page = parseInt(link.dataset.page, 10)
          if (!isNaN(page) && currentResultItems.length > 0) {
            currentPage = page
            renderResults(input.value.trim().toLowerCase(), currentResultItems)
          }
        }
      })
    }

    // Initial state
    toggleResultsVisibility(false)
    renderRecentSearches()
  }

  window.addEventListener('search:loaded', () => {
    const $loadDataItem = document.getElementById('loading-database')
    $loadDataItem.nextElementSibling.style.visibility = 'visible'
    $loadDataItem.remove()
    if (input.value.trim()) inputEventFunction()
  })

  searchClickFn()
  searchFnOnce()

  // pjax
  window.addEventListener('pjax:complete', () => {
    !btf.isHidden($searchMask) && closeSearch()
    localSearch.highlightSearchWords(document.getElementById('article-container'))
    searchClickFn()
  })
})

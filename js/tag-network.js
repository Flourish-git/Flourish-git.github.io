(() => {
  const initializedNetworks = new WeakSet()
  const compactQuery = window.matchMedia('(max-width: 600px)')

  function initTagNetwork(container) {
    if (initializedNetworks.has(container) || !window.d3) return

    const nodeElements = Array.from(container.querySelectorAll('.tag-network-node'))
    const svgElement = container.querySelector('.tag-network-lines')
    if (!nodeElements.length || !svgElement) return

    let links = []
    try {
      links = JSON.parse(container.dataset.links || '[]')
    } catch (error) {
      return
    }

    const nodes = nodeElements.map(element => ({
      id: element.dataset.nodeId,
      count: Number(element.dataset.nodeCount) || 1,
      element
    }))
    const nodeIds = new Set(nodes.map(node => node.id))
    links = links.filter(link => nodeIds.has(link.source) && nodeIds.has(link.target))

    const svg = window.d3.select(svgElement)
    const lineSelection = svg
      .selectAll('line')
      .data(links)
      .join('line')
      .attr('class', 'tag-network-line')
      .attr('stroke-width', link => 0.75 + Math.min(link.weight || 1, 4) * 0.32)
      .attr('opacity', link => 0.46 + Math.min(link.weight || 1, 4) * 0.08)

    const simulation = window.d3
      .forceSimulation(nodes)
      .force('link', window.d3.forceLink(links)
        .id(node => node.id)
        .distance(link => 96 - Math.min(link.weight || 1, 4) * 4)
        .strength(link => 0.16 + Math.min(link.weight || 1, 4) * 0.06))
      .force('charge', window.d3.forceManyBody().strength(-230))
      .force('collision', window.d3.forceCollide().radius(node => {
        const labelRoom = Math.min(node.id.length * 2.8, 34)
        return 29 + labelRoom + node.count
      }).iterations(3))
      .force('x', window.d3.forceX().strength(0.045))
      .force('y', window.d3.forceY().strength(0.07))

    function applyLabelDirection(node, width, height) {
      const element = node.element
      element.classList.remove('is-left', 'is-right', 'is-top', 'is-bottom')

      if (node.x < Math.max(92, width * 0.2)) {
        element.classList.add('is-right')
      } else if (node.x > Math.min(width - 92, width * 0.8)) {
        element.classList.add('is-left')
      } else if (node.y < Math.max(55, height * 0.24)) {
        element.classList.add('is-bottom')
      } else {
        element.classList.add('is-top')
      }
    }

    function updateLayout() {
      const width = container.clientWidth
      const height = container.clientHeight
      const isCompact = compactQuery.matches

      svg.attr('viewBox', `0 0 ${width} ${height}`)

      if (isCompact) {
        simulation.stop()
        nodeElements.forEach(element => {
          element.style.removeProperty('left')
          element.style.removeProperty('top')
          element.classList.remove('is-left', 'is-right', 'is-top', 'is-bottom')
        })
        return
      }

      simulation
        .force('center', window.d3.forceCenter(width / 2, height / 2))
        .force('x').x(width / 2)
      simulation.force('y').y(height / 2)
      simulation.alpha(0.72).restart()
    }

    simulation.on('tick', () => {
      if (compactQuery.matches) return

      const width = container.clientWidth
      const height = container.clientHeight
      const horizontalMargin = Math.min(74, Math.max(48, width * 0.08))
      const verticalMargin = 38

      nodes.forEach(node => {
        node.x = Math.max(horizontalMargin, Math.min(width - horizontalMargin, node.x))
        node.y = Math.max(verticalMargin, Math.min(height - verticalMargin, node.y))
        node.element.style.left = `${node.x}px`
        node.element.style.top = `${node.y}px`
        applyLabelDirection(node, width, height)
      })

      lineSelection
        .attr('x1', link => link.source.x)
        .attr('y1', link => link.source.y)
        .attr('x2', link => link.target.x)
        .attr('y2', link => link.target.y)
    })

    const resizeObserver = new ResizeObserver(updateLayout)
    resizeObserver.observe(container)
    compactQuery.addEventListener('change', updateLayout)
    initializedNetworks.add(container)
    updateLayout()
  }

  function initAllTagNetworks() {
    document.querySelectorAll('[data-tag-network]').forEach(initTagNetwork)
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAllTagNetworks, { once: true })
  } else {
    initAllTagNetworks()
  }

  document.addEventListener('pjax:complete', initAllTagNetworks)
})()

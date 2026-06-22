(() => {
  const initializedNetworks = new WeakSet()
  const compactQuery = window.matchMedia('(max-width: 600px)')
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')

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
    const pointer = { x: 0, y: 0, active: false }
    const panOffset = { x: 0, y: 0 }
    const dragState = {
      active: false,
      mode: null,
      pointerId: null,
      startClientX: 0,
      startClientY: 0,
      startPanX: 0,
      startPanY: 0,
      startNodes: [],
      node: null,
      moved: false,
      suppressClick: false
    }

    nodeElements.forEach(element => {
      element.draggable = false
    })

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
      .force('pointer', alpha => {
        if (!pointer.active || compactQuery.matches || reducedMotionQuery.matches) return

        const influenceRadius = Math.min(160, Math.max(118, container.clientWidth * 0.21))
        nodes.forEach(node => {
          const deltaX = node.x - pointer.x
          const deltaY = node.y - pointer.y
          const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY) || 0.01
          if (distance >= influenceRadius) return

          const proximity = 1 - distance / influenceRadius
          const impulse = proximity * proximity * (0.48 + alpha * 1.4)
          node.vx += (deltaX / distance) * impulse
          node.vy += (deltaY / distance) * impulse
          node.vx = Math.max(-4.2, Math.min(4.2, node.vx))
          node.vy = Math.max(-4.2, Math.min(4.2, node.vy))
        })
      })
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

    function getLayoutBounds() {
      const width = container.clientWidth
      const height = container.clientHeight
      return {
        width,
        height,
        horizontalMargin: Math.min(74, Math.max(48, width * 0.08)),
        verticalMargin: 38
      }
    }

    function updateCenterForces() {
      const { width, height } = getLayoutBounds()
      const centerX = width / 2 + panOffset.x
      const centerY = height / 2 + panOffset.y
      simulation.force('center', window.d3.forceCenter(centerX, centerY))
      simulation.force('x').x(centerX)
      simulation.force('y').y(centerY)
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

      updateCenterForces()
      simulation.alpha(0.72).restart()
    }

    function updatePointer(event) {
      if (dragState.active || event.pointerType === 'touch' || compactQuery.matches || reducedMotionQuery.matches) return

      const bounds = container.getBoundingClientRect()
      pointer.x = event.clientX - bounds.left
      pointer.y = event.clientY - bounds.top
      pointer.active = true
      container.style.setProperty('--pointer-x', `${pointer.x}px`)
      container.style.setProperty('--pointer-y', `${pointer.y}px`)
      container.classList.add('is-interacting')
      simulation.alphaTarget(0.16).restart()
    }

    function releasePointer() {
      if (!pointer.active && !container.classList.contains('is-interacting')) return

      pointer.active = false
      container.classList.remove('is-interacting')
      simulation.alphaTarget(0).alpha(0.2).restart()
    }

    function startDrag(event) {
      if (event.button !== 0 || !event.isPrimary || event.pointerType === 'touch' ||
        compactQuery.matches || reducedMotionQuery.matches) return

      const nodeElement = event.target.closest('.tag-network-node')
      const draggedNode = nodeElement
        ? nodes.find(node => node.element === nodeElement)
        : null

      releasePointer()
      dragState.active = true
      dragState.mode = draggedNode ? 'node' : 'network'
      dragState.pointerId = event.pointerId
      dragState.startClientX = event.clientX
      dragState.startClientY = event.clientY
      dragState.startPanX = panOffset.x
      dragState.startPanY = panOffset.y
      dragState.startNodes = nodes.map(node => ({ node, x: node.x, y: node.y }))
      dragState.node = draggedNode
      dragState.moved = false
      dragState.suppressClick = false

      if (draggedNode) {
        draggedNode.fx = draggedNode.x
        draggedNode.fy = draggedNode.y
        draggedNode.element.classList.add('is-dragging')
      }

      container.classList.add('is-dragging')
      container.setPointerCapture(event.pointerId)
      simulation.alphaTarget(0.2).restart()
    }

    function moveDrag(event) {
      if (!dragState.active || event.pointerId !== dragState.pointerId) return

      const deltaX = event.clientX - dragState.startClientX
      const deltaY = event.clientY - dragState.startClientY
      const movement = Math.sqrt(deltaX * deltaX + deltaY * deltaY)
      if (movement > 4) dragState.moved = true

      const { width, height, horizontalMargin, verticalMargin } = getLayoutBounds()
      if (dragState.mode === 'node' && dragState.node) {
        const bounds = container.getBoundingClientRect()
        dragState.node.fx = Math.max(horizontalMargin, Math.min(width - horizontalMargin, event.clientX - bounds.left))
        dragState.node.fy = Math.max(verticalMargin, Math.min(height - verticalMargin, event.clientY - bounds.top))
      } else {
        const minX = Math.min(...dragState.startNodes.map(item => item.x))
        const maxX = Math.max(...dragState.startNodes.map(item => item.x))
        const minY = Math.min(...dragState.startNodes.map(item => item.y))
        const maxY = Math.max(...dragState.startNodes.map(item => item.y))
        const boundedDeltaX = Math.max(horizontalMargin - minX, Math.min(width - horizontalMargin - maxX, deltaX))
        const boundedDeltaY = Math.max(verticalMargin - minY, Math.min(height - verticalMargin - maxY, deltaY))

        panOffset.x = dragState.startPanX + boundedDeltaX
        panOffset.y = dragState.startPanY + boundedDeltaY
        dragState.startNodes.forEach(item => {
          item.node.fx = item.x + boundedDeltaX
          item.node.fy = item.y + boundedDeltaY
        })
        updateCenterForces()
      }

      if (dragState.moved) event.preventDefault()
      simulation.alpha(0.38).restart()
    }

    function endDrag(event) {
      if (!dragState.active || event.pointerId !== dragState.pointerId) return

      if (container.hasPointerCapture(event.pointerId)) {
        container.releasePointerCapture(event.pointerId)
      }

      dragState.startNodes.forEach(item => {
        item.node.fx = null
        item.node.fy = null
      })
      if (dragState.node) dragState.node.element.classList.remove('is-dragging')

      dragState.suppressClick = dragState.moved
      dragState.active = false
      dragState.mode = null
      dragState.pointerId = null
      dragState.node = null
      container.classList.remove('is-dragging')
      simulation.alphaTarget(0).alpha(0.32).restart()
    }

    function holdNodeClick(event) {
      const nodeElement = event.target.closest('.tag-network-node')
      if (!nodeElement) {
        dragState.suppressClick = false
        return
      }

      event.preventDefault()
      event.stopPropagation()
      dragState.suppressClick = false
      nodeElement.focus({ preventScroll: true })
    }

    function openNodeOnDoubleClick(event) {
      const nodeElement = event.target.closest('.tag-network-node')
      if (!nodeElement || dragState.active || dragState.suppressClick) return

      event.preventDefault()
      event.stopPropagation()
      window.location.assign(nodeElement.href)
    }

    function openNodeWithKeyboard(event) {
      if (event.key !== 'Enter') return

      const nodeElement = event.target.closest('.tag-network-node')
      if (!nodeElement) return

      event.preventDefault()
      window.location.assign(nodeElement.href)
    }

    function releasePointerOutside(event) {
      if (!pointer.active || dragState.active) return

      const bounds = container.getBoundingClientRect()
      const isOutside = event.clientX < bounds.left || event.clientX > bounds.right ||
        event.clientY < bounds.top || event.clientY > bounds.bottom
      if (isOutside) releasePointer()
    }

    simulation.on('tick', () => {
      if (compactQuery.matches) return

      const { width, height, horizontalMargin, verticalMargin } = getLayoutBounds()

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
    container.addEventListener('pointerenter', updatePointer)
    container.addEventListener('pointermove', updatePointer)
    container.addEventListener('pointerleave', releasePointer)
    container.addEventListener('pointerdown', startDrag)
    container.addEventListener('pointermove', moveDrag)
    container.addEventListener('pointerup', endDrag)
    container.addEventListener('pointercancel', endDrag)
    container.addEventListener('click', holdNodeClick, true)
    container.addEventListener('dblclick', openNodeOnDoubleClick)
    container.addEventListener('keydown', openNodeWithKeyboard)
    document.addEventListener('pointermove', releasePointerOutside, { passive: true })
    window.addEventListener('blur', releasePointer)
    window.addEventListener('scroll', releasePointer, { passive: true })
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

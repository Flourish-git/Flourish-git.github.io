(() => {
  const initializedNetworks = new WeakSet()
  const compactQuery = window.matchMedia('(max-width: 600px)')
  const reducedMotionQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
  const MIN_SCALE = 0.45
  const MAX_SCALE = 2.2

  function initTagNetwork(container) {
    if (initializedNetworks.has(container) || !window.d3) return

    const worldElement = container.querySelector('.tag-network-world')
    const nodeElements = Array.from(container.querySelectorAll('.tag-network-node'))
    const svgElement = container.querySelector('.tag-network-lines')
    const controls = container.querySelector('.tag-network-controls')
    if (!worldElement || !nodeElements.length || !svgElement) return

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
    const coreNode = nodes.find(node => node.element.classList.contains('is-core')) || nodes[0]
    links = links.filter(link => nodeIds.has(link.source) && nodeIds.has(link.target))

    const pointer = { x: 0, y: 0, active: false }
    const camera = { x: 0, y: 0, scale: 1 }
    const dragState = {
      active: false,
      mode: null,
      pointerId: null,
      startClientX: 0,
      startClientY: 0,
      startCameraX: 0,
      startCameraY: 0,
      node: null,
      moved: false,
      suppressClick: false
    }
    let cameraAnimation = 0
    let hasInitialView = false

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

        const influenceRadius = Math.min(160, Math.max(118, container.clientWidth * 0.21)) / camera.scale
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
      .force('center', window.d3.forceCenter(0, 0))
      .force('x', window.d3.forceX(0).strength(0.045))
      .force('y', window.d3.forceY(0).strength(0.07))

    function worldToScreenX(x) {
      return camera.x + x * camera.scale
    }

    function worldToScreenY(y) {
      return camera.y + y * camera.scale
    }

    function screenToWorld(clientX, clientY) {
      const bounds = container.getBoundingClientRect()
      return {
        x: (clientX - bounds.left - camera.x) / camera.scale,
        y: (clientY - bounds.top - camera.y) / camera.scale
      }
    }

    function applyLabelDirection(node, width, height) {
      const element = node.element
      const screenX = worldToScreenX(node.x)
      const screenY = worldToScreenY(node.y)
      element.classList.remove('is-left', 'is-right', 'is-top', 'is-bottom')

      if (screenX < Math.max(92, width * 0.2)) {
        element.classList.add('is-right')
      } else if (screenX > Math.min(width - 92, width * 0.8)) {
        element.classList.add('is-left')
      } else if (screenY < Math.max(55, height * 0.24)) {
        element.classList.add('is-bottom')
      } else {
        element.classList.add('is-top')
      }
    }

    function render() {
      if (compactQuery.matches) return

      const width = container.clientWidth
      const height = container.clientHeight
      svg.attr('viewBox', `0 0 ${width} ${height}`)

      nodes.forEach(node => {
        node.element.style.left = `${worldToScreenX(node.x)}px`
        node.element.style.top = `${worldToScreenY(node.y)}px`
        node.element.style.setProperty('--camera-scale', camera.scale)
        applyLabelDirection(node, width, height)
      })

      lineSelection
        .attr('x1', link => worldToScreenX(link.source.x))
        .attr('y1', link => worldToScreenY(link.source.y))
        .attr('x2', link => worldToScreenX(link.target.x))
        .attr('y2', link => worldToScreenY(link.target.y))
    }

    function setCamera(nextCamera, animate = true) {
      const target = {
        x: Number.isFinite(nextCamera.x) ? nextCamera.x : camera.x,
        y: Number.isFinite(nextCamera.y) ? nextCamera.y : camera.y,
        scale: Math.max(MIN_SCALE, Math.min(MAX_SCALE,
          Number.isFinite(nextCamera.scale) ? nextCamera.scale : camera.scale))
      }

      cancelAnimationFrame(cameraAnimation)
      if (!animate || reducedMotionQuery.matches) {
        Object.assign(camera, target)
        render()
        return
      }

      const start = { ...camera }
      const startedAt = performance.now()
      const duration = 360
      const step = now => {
        const progress = Math.min(1, (now - startedAt) / duration)
        const eased = 1 - Math.pow(1 - progress, 3)
        camera.x = start.x + (target.x - start.x) * eased
        camera.y = start.y + (target.y - start.y) * eased
        camera.scale = start.scale + (target.scale - start.scale) * eased
        render()
        if (progress < 1) cameraAnimation = requestAnimationFrame(step)
      }
      cameraAnimation = requestAnimationFrame(step)
    }

    function getGraphBounds() {
      const xs = nodes.map(node => node.x).filter(Number.isFinite)
      const ys = nodes.map(node => node.y).filter(Number.isFinite)
      if (!xs.length || !ys.length) return null
      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minY: Math.min(...ys),
        maxY: Math.max(...ys)
      }
    }

    function centerOnNode(node = coreNode, animate = true, scale = camera.scale) {
      if (!node || !Number.isFinite(node.x) || !Number.isFinite(node.y)) return
      setCamera({
        x: container.clientWidth / 2 - node.x * scale,
        y: container.clientHeight / 2 - node.y * scale,
        scale
      }, animate)
    }

    function fitToView(animate = true) {
      const bounds = getGraphBounds()
      if (!bounds) return

      const paddingX = Math.min(88, container.clientWidth * 0.11)
      const paddingY = 62
      const graphWidth = Math.max(1, bounds.maxX - bounds.minX + 100)
      const graphHeight = Math.max(1, bounds.maxY - bounds.minY + 80)
      const scale = Math.max(MIN_SCALE, Math.min(1.35,
        (container.clientWidth - paddingX * 2) / graphWidth,
        (container.clientHeight - paddingY * 2) / graphHeight))
      const centerX = (bounds.minX + bounds.maxX) / 2
      const centerY = (bounds.minY + bounds.maxY) / 2
      setCamera({
        x: container.clientWidth / 2 - centerX * scale,
        y: container.clientHeight / 2 - centerY * scale,
        scale
      }, animate)
    }

    function resetView() {
      centerOnNode(coreNode, true, 1)
      simulation.alpha(0.38).restart()
    }

    function updateLayout() {
      if (compactQuery.matches) {
        simulation.stop()
        nodeElements.forEach(element => {
          element.style.removeProperty('left')
          element.style.removeProperty('top')
          element.style.removeProperty('--camera-scale')
          element.classList.remove('is-left', 'is-right', 'is-top', 'is-bottom')
        })
        return
      }

      if (!hasInitialView) {
        camera.x = container.clientWidth / 2
        camera.y = container.clientHeight / 2
        hasInitialView = true
      }
      render()
      simulation.alpha(0.72).restart()
    }

    function updatePointer(event) {
      if (dragState.active || event.pointerType === 'touch' || compactQuery.matches || reducedMotionQuery.matches) return

      const worldPoint = screenToWorld(event.clientX, event.clientY)
      pointer.x = worldPoint.x
      pointer.y = worldPoint.y
      pointer.active = true
      container.style.setProperty('--pointer-x', `${event.offsetX}px`)
      container.style.setProperty('--pointer-y', `${event.offsetY}px`)
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
        compactQuery.matches || reducedMotionQuery.matches || event.target.closest('.tag-network-controls')) return

      const nodeElement = event.target.closest('.tag-network-node')
      const draggedNode = nodeElement ? nodes.find(node => node.element === nodeElement) : null

      releasePointer()
      cancelAnimationFrame(cameraAnimation)
      dragState.active = true
      dragState.mode = draggedNode ? 'node' : 'camera'
      dragState.pointerId = event.pointerId
      dragState.startClientX = event.clientX
      dragState.startClientY = event.clientY
      dragState.startCameraX = camera.x
      dragState.startCameraY = camera.y
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
      if (Math.sqrt(deltaX * deltaX + deltaY * deltaY) > 4) dragState.moved = true

      if (dragState.mode === 'node' && dragState.node) {
        const worldPoint = screenToWorld(event.clientX, event.clientY)
        dragState.node.fx = worldPoint.x
        dragState.node.fy = worldPoint.y
      } else {
        camera.x = dragState.startCameraX + deltaX
        camera.y = dragState.startCameraY + deltaY
        render()
      }

      if (dragState.moved) event.preventDefault()
      simulation.alpha(0.38).restart()
    }

    function endDrag(event) {
      if (!dragState.active || event.pointerId !== dragState.pointerId) return

      if (container.hasPointerCapture(event.pointerId)) container.releasePointerCapture(event.pointerId)
      if (dragState.node) {
        dragState.node.fx = null
        dragState.node.fy = null
        dragState.node.element.classList.remove('is-dragging')
      }

      dragState.suppressClick = dragState.moved
      dragState.active = false
      dragState.mode = null
      dragState.pointerId = null
      dragState.node = null
      container.classList.remove('is-dragging')
      simulation.alphaTarget(0).alpha(0.32).restart()
    }

    function zoomView(event) {
      if (compactQuery.matches || event.target.closest('.tag-network-controls')) return
      event.preventDefault()
      releasePointer()

      const bounds = container.getBoundingClientRect()
      const screenX = event.clientX - bounds.left
      const screenY = event.clientY - bounds.top
      const worldX = (screenX - camera.x) / camera.scale
      const worldY = (screenY - camera.y) / camera.scale
      const scale = Math.max(MIN_SCALE, Math.min(MAX_SCALE,
        camera.scale * Math.exp(-event.deltaY * 0.0012)))
      setCamera({
        x: screenX - worldX * scale,
        y: screenY - worldY * scale,
        scale
      }, false)
    }

    function handleControl(event) {
      const button = event.target.closest('[data-network-action]')
      if (!button) return
      const action = button.dataset.networkAction
      if (action === 'center') centerOnNode()
      if (action === 'fit') fitToView()
      if (action === 'reset') resetView()
      button.blur()
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

    simulation.on('tick', render)
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
    container.addEventListener('wheel', zoomView, { passive: false })
    container.addEventListener('click', holdNodeClick, true)
    container.addEventListener('dblclick', openNodeOnDoubleClick)
    container.addEventListener('keydown', openNodeWithKeyboard)
    if (controls) controls.addEventListener('click', handleControl)
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

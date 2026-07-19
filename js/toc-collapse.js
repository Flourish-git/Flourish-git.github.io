(function () {
  function initTocCollapse() {
    const card = document.getElementById('card-toc');
    if (!card || card.dataset.collapseReady === 'true') return;

    const button = card.querySelector('.toc-collapse-toggle');
    const content = card.querySelector('.toc-content');
    if (!button || !content) return;

    const initBranches = () => {
      content.classList.add('is-branch-collapsible');

      content.querySelectorAll('.toc-item').forEach((item, index) => {
        const child = Array.from(item.children).find(element => element.classList.contains('toc-child'));
        const link = Array.from(item.children).find(element => element.classList.contains('toc-link'));
        if (!child || !link) return;

        const branchId = `post-toc-branch-${index + 1}`;
        const label = link.textContent.trim();
        const branchButton = document.createElement('button');
        const icon = document.createElement('i');

        item.classList.add('has-toc-child');
        child.id = branchId;
        branchButton.type = 'button';
        branchButton.className = 'toc-branch-toggle';
        branchButton.setAttribute('aria-controls', branchId);
        branchButton.setAttribute('aria-expanded', 'true');
        branchButton.setAttribute('aria-label', `收起 ${label} 的子目录`);
        branchButton.title = `收起 ${label} 的子目录`;
        icon.className = 'fas fa-chevron-down';
        icon.setAttribute('aria-hidden', 'true');
        branchButton.appendChild(icon);
        link.insertAdjacentElement('afterend', branchButton);

        branchButton.addEventListener('click', event => {
          event.preventDefault();
          event.stopPropagation();

          const collapsed = !item.classList.contains('is-branch-collapsed');
          item.classList.toggle('is-branch-collapsed', collapsed);
          branchButton.setAttribute('aria-expanded', String(!collapsed));
          branchButton.setAttribute('aria-label', `${collapsed ? '展开' : '收起'} ${label} 的子目录`);
          branchButton.title = `${collapsed ? '展开' : '收起'} ${label} 的子目录`;
          child.setAttribute('aria-hidden', String(collapsed));
        });
      });
    };

    const setCollapsed = collapsed => {
      card.classList.toggle('is-toc-collapsed', collapsed);
      button.setAttribute('aria-expanded', String(!collapsed));
      button.setAttribute('aria-label', collapsed ? '展开目录' : '收起目录');
      button.title = collapsed ? '展开目录' : '收起目录';
      content.setAttribute('aria-hidden', String(collapsed));
    };

    button.addEventListener('click', () => {
      setCollapsed(!card.classList.contains('is-toc-collapsed'));
    });

    initBranches();
    card.dataset.collapseReady = 'true';
    setCollapsed(false);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initTocCollapse);
  } else {
    initTocCollapse();
  }

  document.addEventListener('pjax:complete', initTocCollapse);
})();

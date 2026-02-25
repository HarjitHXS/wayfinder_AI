export const LABEL_ELEMENTS_SCRIPT = `
(function() {
  document.querySelectorAll('.wayfinder-label').forEach(el => el.remove());

  const interactiveSelectors = [
    'a', 'button', 'input', 'textarea', 'select', 
    '[role="button"]', '[role="link"]', '[role="menuitem"]',
    '[onclick]', '[tabindex="0"]'
  ];

  const elements = Array.from(document.querySelectorAll(interactiveSelectors.join(',')))
    .filter(el => {
      const rect = el.getBoundingClientRect();
      const style = window.getComputedStyle(el);
      return rect.width > 0 && 
             rect.height > 0 && 
             style.visibility !== 'hidden' && 
             style.display !== 'none';
    });

  elements.forEach((el, index) => {
    const id = index + 1;
    const rect = el.getBoundingClientRect();
    
    const label = document.createElement('div');
    label.className = 'wayfinder-label';
    label.textContent = id.toString();
    Object.assign(label.style, {
      position: 'absolute',
      left: (rect.left + window.scrollX) + 'px',
      top: (rect.top + window.scrollY) + 'px',
      background: '#ff0000',
      color: 'white',
      padding: '2px 4px',
      fontSize: '12px',
      fontWeight: 'bold',
      zIndex: '10000',
      borderRadius: '2px',
      pointerEvents: 'none',
      boxShadow: '0 1px 2px rgba(0,0,0,0.2)'
    });

    document.body.appendChild(label);
    el.setAttribute('data-wayfinder-id', id.toString());
  });

  return elements.length;
})();
`;

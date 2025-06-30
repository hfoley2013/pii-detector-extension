class DOMUtils {
  static waitForElement(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const element = document.querySelector(selector);
      if (element) {
        resolve(element);
        return;
      }

      const observer = new MutationObserver(() => {
        const element = document.querySelector(selector);
        if (element) {
          observer.disconnect();
          resolve(element);
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Element ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  static waitForElements(selector, timeout = 5000) {
    return new Promise((resolve, reject) => {
      const elements = document.querySelectorAll(selector);
      if (elements.length > 0) {
        resolve(Array.from(elements));
        return;
      }

      const observer = new MutationObserver(() => {
        const elements = document.querySelectorAll(selector);
        if (elements.length > 0) {
          observer.disconnect();
          resolve(Array.from(elements));
        }
      });

      observer.observe(document.body, {
        childList: true,
        subtree: true
      });

      setTimeout(() => {
        observer.disconnect();
        reject(new Error(`Elements ${selector} not found within ${timeout}ms`));
      }, timeout);
    });
  }

  static observeElement(element, callback, options = {}) {
    const defaultOptions = {
      childList: true,
      subtree: true,
      characterData: true
    };

    const observer = new MutationObserver(callback);
    observer.observe(element, { ...defaultOptions, ...options });
    return observer;
  }

  static debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  }

  static isElementVisible(element) {
    if (!element) return false;
    
    const rect = element.getBoundingClientRect();
    const style = window.getComputedStyle(element);
    
    const visible = (
      rect.width > 0 &&
      rect.height > 0 &&
      style.visibility !== 'hidden' &&
      style.display !== 'none' &&
      style.opacity !== '0'
    );
    
    // Debug logging
    if (!visible) {
      console.log('Element not visible:', element, {
        width: rect.width,
        height: rect.height,
        visibility: style.visibility,
        display: style.display,
        opacity: style.opacity
      });
    }
    
    return visible;
  }

  static getTextContent(element) {
    if (!element) return '';
    
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      return element.value;
    }
    
    if (element.contentEditable === 'true' || element.classList.contains('ProseMirror')) {
      // For ProseMirror editor, try multiple approaches to get text
      let text = '';
      
      // Method 1: Check if there's actual text content
      const rawText = element.textContent || element.innerText || '';
      if (rawText && rawText.trim() && rawText.trim() !== 'Ask anything' && rawText.trim() !== 'Message ChatGPT') {
        text = rawText.trim();
      } else {
        // Method 2: Look for paragraph elements (ProseMirror structure)
        const paragraphs = element.querySelectorAll('p');
        if (paragraphs.length > 0) {
          const paragraphTexts = Array.from(paragraphs)
            .map(p => (p.textContent || p.innerText || '').trim())
            .filter(t => t && t !== 'Ask anything' && t !== 'Message ChatGPT');
          text = paragraphTexts.join('\n');
        }
        
        // Method 3: Look for text nodes directly
        if (!text) {
          const walker = document.createTreeWalker(
            element,
            NodeFilter.SHOW_TEXT,
            null,
            false
          );
          
          const textNodes = [];
          let node;
          while (node = walker.nextNode()) {
            const nodeText = node.textContent.trim();
            if (nodeText && nodeText !== 'Ask anything' && nodeText !== 'Message ChatGPT') {
              textNodes.push(nodeText);
            }
          }
          text = textNodes.join(' ');
        }
      }
      
      // Debug logging
      console.log('🔒 Getting text from ProseMirror:', {
        element: element,
        textContent: element.textContent,
        innerText: element.innerText,
        cleaned: text,
        length: text.length,
        paragraphs: element.querySelectorAll('p').length,
        hasPlaceholder: element.querySelector('[data-placeholder]') !== null
      });
      
      return text;
    }
    
    return element.textContent || element.innerText || '';
  }

  static setTextContent(element, text) {
    if (!element || typeof text !== 'string') return;
    
    if (element.tagName === 'TEXTAREA' || element.tagName === 'INPUT') {
      element.value = text;
      element.dispatchEvent(new Event('input', { bubbles: true }));
      return;
    }
    
    if (element.contentEditable === 'true' || element.classList.contains('ProseMirror')) {
      // For ProseMirror, we need to clear and set content properly
      element.innerHTML = `<p>${text}</p>`;
      
      // Dispatch multiple events to ensure ProseMirror recognizes the change
      element.dispatchEvent(new Event('input', { bubbles: true }));
      element.dispatchEvent(new Event('keyup', { bubbles: true }));
      element.dispatchEvent(new Event('change', { bubbles: true }));
      return;
    }
    
    element.textContent = text;
  }

  static createElementFromHTML(htmlString) {
    const div = document.createElement('div');
    div.innerHTML = htmlString.trim();
    return div.firstChild;
  }

  static addStylesheet(css) {
    const style = document.createElement('style');
    style.textContent = css;
    document.head.appendChild(style);
    return style;
  }

  static findParentBySelector(element, selector) {
    let parent = element.parentElement;
    while (parent && !parent.matches(selector)) {
      parent = parent.parentElement;
    }
    return parent;
  }

  static simulateEvent(element, eventType, options = {}) {
    const event = new Event(eventType, {
      bubbles: true,
      cancelable: true,
      ...options
    });
    element.dispatchEvent(event);
  }
}

if (typeof window !== 'undefined') {
  window.DOMUtils = DOMUtils;
  console.log('🔒 PII Extension: DOMUtils loaded');
}
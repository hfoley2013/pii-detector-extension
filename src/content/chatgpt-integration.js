class ChatGPTIntegration {
  constructor() {
    this.selectors = {
      inputField:
        '#prompt-textarea, div[contenteditable="true"]#prompt-textarea, div.ProseMirror[contenteditable="true"], div[contenteditable="true"][data-placeholder], textarea[placeholder*="Message"]',
      submitButton:
        'button[data-testid="send-button"], button[aria-label*="Send"], button[type="submit"]',
      responseContainer:
        'div[data-message-author-role="assistant"], .markdown, article, [data-message-id]',
      conversationContainer: 'main, div[role="main"], #__next',
      messageElements:
        "div[data-message-author-role], article, .conversation-item",
    };

    this.inputElement = null;
    this.submitButton = null;
    this.conversationContainer = null;
    this.responseObserver = null;
    this.isInitialized = false;
    this.interceptionDisabled = false;

    // Initialize PII detection components
    this.piiDetector = null;
    this.tokenizer = null; // V2 format-preserving tokenizer
  }

  async initialize() {
    if (this.isInitialized) return true;

    try {
      // Initialize V2 tokenizer (async)
      if (typeof PIITokenizerV2 !== "undefined") {
        this.tokenizer = new PIITokenizerV2();
        await this.tokenizer.initialize();
        console.log("🔐 ChatGPT: PIITokenizerV2 initialized");
      }

      await this.findChatElements();
      this.setupInputInterception();
      this.setupResponseMonitoring();
      this.isInitialized = true;

      console.log("ChatGPT integration initialized successfully");
      return true;
    } catch (error) {
      console.error("Failed to initialize ChatGPT integration:", error);
      return false;
    }
  }

  async findChatElements() {
    try {
      // Try multiple selectors and find the visible one
      const possibleInputs = [
        "#prompt-textarea",
        'div#prompt-textarea[contenteditable="true"]',
        'div.ProseMirror[contenteditable="true"]',
        'div[contenteditable="true"][data-placeholder]',
        'textarea[placeholder*="Message"]',
        'textarea[placeholder*="Ask"]',
        'div[contenteditable="true"]',
      ];

      let foundInput = null;
      for (const selector of possibleInputs) {
        const elements = document.querySelectorAll(selector);
        for (const element of elements) {
          if (DOMUtils.isElementVisible(element)) {
            foundInput = element;
            console.log(
              "Found visible input with selector:",
              selector,
              element,
            );
            break;
          }
        }
        if (foundInput) break;
      }

      if (foundInput) {
        this.inputElement = foundInput;
      } else {
        // Fallback to waiting for any input
        this.inputElement = await DOMUtils.waitForElement(
          this.selectors.inputField,
          10000,
        );
        console.log("Found input element via wait:", this.inputElement);
      }
    } catch (error) {
      console.warn("Could not find input element, will retry later");
    }

    try {
      this.conversationContainer = await DOMUtils.waitForElement(
        this.selectors.conversationContainer,
        5000,
      );
      console.log("Found conversation container:", this.conversationContainer);
    } catch (error) {
      console.warn("Could not find conversation container");
    }
  }

  setupInputInterception() {
    if (!this.inputElement) {
      setTimeout(() => this.setupInputInterception(), 1000);
      return;
    }

    console.log("Setting up input interception on:", this.inputElement);

    // Mark that we've attached listeners to this element
    this.inputElement._piiExtensionListeners = true;

    const interceptSubmission = async (event) => {
      try {
        // Check if interception is temporarily disabled
        if (this.interceptionDisabled) {
          console.log(
            "🔒 Interception disabled, allowing submission to proceed",
          );
          return;
        }

        const inputText = DOMUtils.getTextContent(this.inputElement);
        console.log("🔒 Intercepting submission with text:", inputText);

        // Check if this is already a tokenized submission (XML format)
        const tokenPattern =
          /<(email|phone|name|ssn|cc|address|date|url)(?:\s+[^>]*)?>([^<]+)<\/\1>/i;
        if (tokenPattern.test(inputText)) {
          console.log(
            "🔒 Already tokenized text detected, allowing submission",
          );
          return; // Allow the submission to proceed
        }

        if (!inputText || inputText.trim().length === 0) {
          console.log("🔒 No text to process, allowing submission");
          return;
        }

        // ALWAYS prevent the default submission first
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();

        console.log("🔒 Submission prevented, processing text...");

        const processedResult = await this.processInputText(inputText);
        console.log("🔒 Processing result:", processedResult);

        if (processedResult && processedResult.piiDetected) {
          console.log("🔒 PII detected, showing confirmation...");

          // Show user confirmation
          const userConfirmed = confirm(
            `🔒 PII PROTECTION ACTIVE!\n\n` +
              `Detected ${processedResult.piiCount} sensitive item(s): ${processedResult.piiTypes.join(", ")}\n\n` +
              `Original text:\n"${inputText.substring(0, 150)}${inputText.length > 150 ? "..." : ""}"\n\n` +
              `Protected version:\n"${processedResult.tokenizedText.substring(0, 150)}${processedResult.tokenizedText.length > 150 ? "..." : ""}"\n\n` +
              `Tokens use format-preserving encryption (e.g., <ssn>847-29-3156</ssn>) to protect your data.\n\n` +
              `Click OK to submit the protected version, or Cancel to edit your message.`,
          );

          if (userConfirmed) {
            console.log("🔒 User confirmed, submitting tokenized text");
            this.submitTokenizedText(processedResult.tokenizedText);
          } else {
            console.log("🔒 User cancelled, restoring original text");
            DOMUtils.setTextContent(this.inputElement, inputText);
          }
        } else {
          console.log("🔒 No PII detected, submitting normally");
          this.submitOriginalText(inputText);
        }
      } catch (error) {
        console.error("🔒 Error in input interception:", error);
        // On error, allow normal submission by not preventing it
      }
    };

    // Multiple event interception strategies

    // 1. Enter key interception
    this.inputElement.addEventListener(
      "keydown",
      (event) => {
        if (event.key === "Enter" && !event.shiftKey) {
          console.log("🔒 Enter key pressed, intercepting...");
          interceptSubmission(event);
        }
      },
      true,
    ); // Use capture phase

    // 2. Form submission interception
    const form = this.inputElement.closest("form");
    if (form) {
      console.log("🔒 Found form, adding submit listener");
      form.addEventListener(
        "submit",
        (event) => {
          console.log("🔒 Form submit event triggered");
          interceptSubmission(event);
        },
        true,
      );
    }

    // 3. Look for and intercept submit buttons
    this.interceptSubmitButtons();

    // 4. Monitor for value changes and submissions
    this.setupSubmissionDetection();

    // Debug: Monitor input activity
    this.inputElement.addEventListener("input", () => {
      const text = DOMUtils.getTextContent(this.inputElement);
      console.log("🔒 Input change detected:", text.substring(0, 30) + "...");
    });

    // Additional: Intercept all clicks on the page to catch send button
    document.addEventListener(
      "click",
      (event) => {
        const target = event.target;

        // Check if click is on or near a send button
        if (target.tagName === "BUTTON" || target.closest("button")) {
          const button =
            target.tagName === "BUTTON" ? target : target.closest("button");
          const ariaLabel = button.getAttribute("aria-label") || "";
          const testId = button.getAttribute("data-testid") || "";

          // Log all button clicks for debugging
          console.log("🔒 Button clicked:", {
            button: button,
            ariaLabel: ariaLabel,
            testId: testId,
            className: button.className,
          });

          // Check if this might be a send button
          if (this.couldBeSendButton(button)) {
            console.log(
              "🔒 Potential send button clicked, checking for text...",
            );
            const inputText = DOMUtils.getTextContent(this.inputElement);
            if (inputText && inputText.trim().length > 0) {
              console.log("🔒 Intercepting potential send button click");
              event.preventDefault();
              event.stopPropagation();
              event.stopImmediatePropagation();
              this.handleTextSubmission(inputText);
              return false;
            }
          }
        }
      },
      true,
    );

    this.inputElement.addEventListener("keypress", (event) => {
      console.log("🔒 Key press:", event.key, "Code:", event.code);
    });
  }

  submitTokenizedText(tokenizedText) {
    console.log("🔒 Submitting tokenized text:", tokenizedText);

    // Temporarily disable our event listeners to avoid infinite loop
    this.temporarilyDisableInterception();

    // Set the tokenized text
    DOMUtils.setTextContent(this.inputElement, tokenizedText);

    // Submit the form
    setTimeout(() => {
      this.submitForm();
      // Re-enable listeners after submission
      setTimeout(() => this.enableInterception(), 1000);
    }, 100);
  }

  submitOriginalText(originalText) {
    console.log("🔒 Submitting original text (no PII):", originalText);

    // Temporarily disable our event listeners to avoid infinite loop
    this.temporarilyDisableInterception();

    // Set the original text
    DOMUtils.setTextContent(this.inputElement, originalText);

    // Submit the form
    setTimeout(() => {
      this.submitForm();
      // Re-enable listeners after submission
      setTimeout(() => this.enableInterception(), 1000);
    }, 100);
  }

  temporarilyDisableInterception() {
    console.log("🔒 Temporarily disabling event interception");
    this.interceptionDisabled = true;
  }

  enableInterception() {
    console.log("🔒 Re-enabling event interception");
    this.interceptionDisabled = false;

    this.inputElement.addEventListener("blur", () => {
      console.log("🔒 Input lost focus");
    });
  }

  async processInputText(text) {
    try {
      console.log(
        "🔒 🔒 🔒 PROCESSING INPUT TEXT WITH PRESIDIO (LENGTH:",
        text.length,
        "):",
        text.substring(0, 100) + "...",
      );
      console.log("🔒 Extension context valid:", !!chrome.runtime?.id);

      // Check if extension context is still valid
      if (!chrome.runtime?.id) {
        console.warn(
          "🔒 Extension context invalidated, allowing submission without processing",
        );
        return {
          tokenizedText: text,
          piiDetected: false,
          error: "Extension context invalidated",
        };
      }

      // NEW: Do PII detection directly in content script where Presidio is available
      console.log("🔒 🔒 🔒 STARTING PRESIDIO DETECTION IN CONTENT SCRIPT");

      // Initialize PIIDetector if not already done
      if (!this.piiDetector) {
        try {
          this.piiDetector = new PIIDetector();
          console.log("🔒 PIIDetector initialized successfully");
        } catch (error) {
          console.error("🔒 Failed to initialize PIIDetector:", error);
          // Fallback to regex if PIIDetector fails
          this.piiDetector = new PIIPatternDetector();
          console.log("🔒 Using regex fallback detector");
        }
      }

      // Detect PII using Presidio
      const piiEntities = await this.piiDetector.analyzePII(text);
      console.log("🔒 🔒 🔒 CONTENT SCRIPT DETECTION COMPLETE:", {
        count: piiEntities.length,
        method: piiEntities[0]?.detection_method || "unknown",
        entities: piiEntities.map((e) => e.entity_type),
      });

      // Debug: Log detailed entity information
      console.log(
        "🔒 Detailed entities detected:",
        piiEntities.map((entity) => ({
          type: entity.entity_type,
          text: entity.text,
          start: entity.start,
          end: entity.end,
          score: entity.score,
        })),
      );

      if (piiEntities.length === 0) {
        console.log("🔒 No PII detected, proceeding with original text");
        return { tokenizedText: text, piiDetected: false };
      }

      // Tokenize the text using format-preserving tokenizer
      const tokenizedText = await this.tokenizer.tokenizeText(
        text,
        piiEntities,
      );
      console.log(
        "🔒 🔒 🔒 TOKENIZATION COMPLETE:",
        tokenizedText.substring(0, 100) + "...",
      );

      // Send the results to background script for tracking/stats
      const message = {
        action: "recordPiiDetection",
        piiCount: piiEntities.length,
        piiTypes: piiEntities.map((e) => e.entity_type),
        detectionMethod: piiEntities[0]?.detection_method || "unknown",
      };

      // Send stats to background script (fire and forget)
      try {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.log(
              "🔒 Background stats logging failed (non-critical):",
              chrome.runtime.lastError.message,
            );
          } else {
            console.log("🔒 Stats recorded in background script");
          }
        });
      } catch (error) {
        console.log(
          "🔒 Background stats logging failed (non-critical):",
          error.message,
        );
      }

      return {
        tokenizedText,
        piiDetected: true,
        piiCount: piiEntities.length,
        piiTypes: piiEntities.map((e) => e.entity_type),
        detectionMethod: piiEntities[0]?.detection_method || "unknown",
      };
    } catch (error) {
      console.error("🔒 Error processing input text:", error);
      return { tokenizedText: text, piiDetected: false, error: error.message };
    }
  }

  interceptSubmitButtons() {
    // Find and intercept ChatGPT-specific submit button patterns
    const buttonSelectors = [
      'button[data-testid="send-button"]',
      'button[aria-label="Send message"]',
      'button[aria-label*="Send"]',
      'form button[type="submit"]',
      // More generic patterns for ChatGPT's send button
      'button:has(svg[data-icon="send"])',
      'button:has([data-icon="send"])',
      '[role="button"][aria-label*="Send"]',
    ];

    let foundButtons = 0;
    buttonSelectors.forEach((selector) => {
      try {
        const buttons = document.querySelectorAll(selector);
        buttons.forEach((button) => {
          // Filter out irrelevant buttons by checking their context
          if (this.isRelevantSubmitButton(button)) {
            foundButtons++;
            console.log(
              "🔒 Found relevant submit button:",
              button,
              "selector:",
              selector,
            );

            button.addEventListener(
              "click",
              (event) => {
                console.log("🔒 Submit button clicked!");
                const inputText = DOMUtils.getTextContent(this.inputElement);
                if (inputText && inputText.trim().length > 0) {
                  event.preventDefault();
                  event.stopPropagation();
                  event.stopImmediatePropagation();
                  this.handleTextSubmission(inputText);
                }
              },
              true,
            );
          }
        });
      } catch (error) {
        console.log("🔒 Error with selector:", selector, error);
      }
    });

    console.log("🔒 Total relevant submit buttons found:", foundButtons);

    // If no buttons found, set up a mutation observer to watch for them
    if (foundButtons === 0) {
      this.watchForSubmitButtons();
    }
  }

  isRelevantSubmitButton(button) {
    // Check if button is near the input area (composer area)
    const composer =
      document.querySelector('[data-testid="composer-text-input"]') ||
      document.querySelector(".composer") ||
      document.querySelector("#prompt-textarea")?.closest("form") ||
      this.inputElement?.closest("form");

    if (composer && composer.contains(button)) {
      return true;
    }

    // Check for specific send button characteristics
    const ariaLabel = button.getAttribute("aria-label") || "";
    const testId = button.getAttribute("data-testid") || "";

    if (testId.includes("send") || ariaLabel.toLowerCase().includes("send")) {
      // Make sure it's not a voice/audio send button
      if (
        ariaLabel.toLowerCase().includes("voice") ||
        ariaLabel.toLowerCase().includes("audio")
      ) {
        return false;
      }
      return true;
    }

    return false;
  }

  couldBeSendButton(button) {
    const ariaLabel = (button.getAttribute("aria-label") || "").toLowerCase();
    const testId = (button.getAttribute("data-testid") || "").toLowerCase();
    const className = button.className || "";

    // Check for send-related attributes
    if (ariaLabel.includes("send") || testId.includes("send")) {
      return true;
    }

    // Check if button is in the composer area
    const composer = document
      .querySelector("#prompt-textarea")
      ?.closest('form, div[data-testid*="composer"]');
    if (composer && composer.contains(button)) {
      // If it's in the composer area and has an icon/svg, likely the send button
      if (
        button.querySelector("svg") ||
        className.includes("send") ||
        className.includes("submit")
      ) {
        return true;
      }
    }

    return false;
  }

  watchForSubmitButtons() {
    console.log("🔒 Setting up mutation observer for submit buttons");

    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Check if the added node is a submit button
            if (
              node.tagName === "BUTTON" &&
              this.isRelevantSubmitButton(node)
            ) {
              console.log("🔒 Found dynamically added submit button:", node);
              this.attachSubmitListener(node);
            }

            // Check if the added node contains submit buttons
            const buttons = node.querySelectorAll?.("button");
            if (buttons) {
              buttons.forEach((button) => {
                if (this.isRelevantSubmitButton(button)) {
                  console.log(
                    "🔒 Found submit button in added content:",
                    button,
                  );
                  this.attachSubmitListener(button);
                }
              });
            }
          }
        });
      });
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  attachSubmitListener(button) {
    button.addEventListener(
      "click",
      (event) => {
        console.log("🔒 🔒 🔒 SUBMIT BUTTON CLICKED VIA OBSERVER!");
        const inputText = DOMUtils.getTextContent(this.inputElement);
        console.log(
          "🔒 Input text from DOM:",
          inputText?.substring(0, 100) + "...",
        );
        if (inputText && inputText.trim().length > 0) {
          console.log("🔒 Preventing default and handling submission...");
          event.preventDefault();
          event.stopPropagation();
          event.stopImmediatePropagation();
          this.handleTextSubmission(inputText);
        } else {
          console.log("🔒 No input text found, allowing normal submission");
        }
      },
      true,
    );
  }

  setupSubmissionDetection() {
    // Monitor for DOM changes that might indicate submission
    let lastInputValue = "";

    const checkForSubmission = () => {
      const currentValue = DOMUtils.getTextContent(this.inputElement);

      // If input was cleared after having content, likely submitted
      if (lastInputValue.length > 0 && currentValue.length === 0) {
        console.log("🔒 Detected potential submission - input cleared");
        console.log("🔒 Last input value was:", lastInputValue);
        // Too late to intercept, but we can log it
      }

      lastInputValue = currentValue;
    };

    setInterval(checkForSubmission, 500);
  }

  async handleTextSubmission(text) {
    console.log(
      "🔒 🔒 🔒 HANDLING TEXT SUBMISSION - Length:",
      text.length,
      "Text:",
      text.substring(0, 100) + "...",
    );

    try {
      // Check if extension context is still valid before processing
      if (!chrome.runtime?.id) {
        console.warn(
          "🔒 Extension context invalidated during submission, proceeding normally",
        );
        this.submitForm();
        return;
      }

      const processedResult = await this.processInputText(text);
      console.log("🔒 Processing result:", processedResult);

      // If there was an error (like extension context invalidated), proceed normally
      if (processedResult && processedResult.error) {
        console.warn(
          "🔒 Processing error occurred, proceeding with normal submission:",
          processedResult.error,
        );
        this.submitForm();
        return;
      }

      if (processedResult && processedResult.piiDetected) {
        const userConfirmed = confirm(
          `🔒 PII DETECTED!\n\n` +
            `Found ${processedResult.piiCount} PII item(s): ${processedResult.piiTypes.join(", ")}\n\n` +
            `Original: "${text.substring(0, 100)}${text.length > 100 ? "..." : ""}"\n\n` +
            `Tokenized: "${processedResult.tokenizedText.substring(0, 100)}${processedResult.tokenizedText.length > 100 ? "..." : ""}"\n\n` +
            `Click OK to submit with PII tokenized, or Cancel to edit your message.`,
        );

        if (userConfirmed) {
          DOMUtils.setTextContent(
            this.inputElement,
            processedResult.tokenizedText,
          );
          setTimeout(() => this.submitForm(), 200);
        } else {
          DOMUtils.setTextContent(this.inputElement, text);
        }
      } else {
        this.submitForm();
      }
    } catch (error) {
      console.error("🔒 Error handling submission:", error);

      // If extension context was invalidated, still allow submission
      if (
        error.message &&
        error.message.includes("Extension context invalidated")
      ) {
        console.warn(
          "🔒 Extension context invalidated, allowing normal submission",
        );
      }

      this.submitForm();
    }
  }

  submitForm() {
    try {
      console.log("🔒 Attempting to submit form...");

      // For ChatGPT, simulate Enter key press to submit
      const enterEvent = new KeyboardEvent("keydown", {
        key: "Enter",
        code: "Enter",
        keyCode: 13,
        which: 13,
        bubbles: true,
        cancelable: false, // Don't allow this to be cancelled
      });

      // Dispatch on the input element
      if (this.inputElement) {
        this.inputElement.dispatchEvent(enterEvent);
        console.log("🔒 Submitted via Enter key simulation");
      }

      // Also try triggering input events to ensure the form recognizes content
      const inputEvent = new Event("input", { bubbles: true });
      this.inputElement?.dispatchEvent(inputEvent);
    } catch (error) {
      console.error("🔒 Error submitting form:", error);
    }
  }

  setupResponseMonitoring() {
    if (this.responseObserver) {
      this.responseObserver.disconnect();
    }

    const container = this.conversationContainer || document.body;

    this.responseObserver = DOMUtils.observeElement(
      container,
      DOMUtils.debounce((mutations) => {
        this.handleResponseMutations(mutations);
      }, 500),
    );

    const existingResponses = document.querySelectorAll(
      this.selectors.responseContainer,
    );
    existingResponses.forEach((response) =>
      this.processResponseElement(response),
    );
  }

  handleResponseMutations(mutations) {
    const processedElements = new Set();

    mutations.forEach((mutation) => {
      if (mutation.type === "childList") {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            const responseElements = node.matches?.(
              this.selectors.responseContainer,
            )
              ? [node]
              : Array.from(
                  node.querySelectorAll?.(this.selectors.responseContainer) ||
                    [],
                );

            responseElements.forEach((element) => {
              if (!processedElements.has(element)) {
                processedElements.add(element);
                this.processResponseElement(element);
              }
            });
          }
        });
      } else if (
        mutation.type === "characterData" ||
        mutation.type === "childList"
      ) {
        const targetElement =
          mutation.target.nodeType === Node.ELEMENT_NODE
            ? mutation.target
            : mutation.target.parentElement;

        if (targetElement) {
          const responseElement = targetElement.closest(
            this.selectors.responseContainer,
          );
          if (responseElement && !processedElements.has(responseElement)) {
            processedElements.add(responseElement);
            this.processResponseElement(responseElement);
          }
        }
      }
    });
  }

  async processResponseElement(element) {
    if (!element || element.dataset.piiProcessed) return;

    try {
      const textContent = DOMUtils.getTextContent(element);
      if (!textContent) return;

      const detokenizedText = await this.processResponseText(textContent);

      if (detokenizedText !== textContent) {
        this.updateResponseElement(element, detokenizedText);
        element.dataset.piiProcessed = "true";
      }
    } catch (error) {
      console.error("Error processing response element:", error);
    }
  }

  async processResponseText(text) {
    try {
      // Use local detokenization (XML format)
      if (this.tokenizer) {
        const detokenized = this.tokenizer.detokenizeText(text);
        if (detokenized !== text) {
          console.log("🔐 Local detokenization applied");
          return detokenized;
        }
      }

      // Fall back to background script detokenization
      const message = {
        action: "detokenizeText",
        text: text,
      };

      return new Promise((resolve) => {
        chrome.runtime.sendMessage(message, (response) => {
          if (chrome.runtime.lastError) {
            console.error("Error detokenizing text:", chrome.runtime.lastError);
            resolve(text);
          } else {
            resolve(response?.detokenizedText || text);
          }
        });
      });
    } catch (error) {
      console.error("Error processing response text:", error);
      return text;
    }
  }

  updateResponseElement(element, newText) {
    try {
      if (element.tagName === "TEXTAREA" || element.tagName === "INPUT") {
        element.value = newText;
      } else if (element.contentEditable === "true") {
        element.textContent = newText;
      } else {
        const textNodes = this.getTextNodes(element);
        if (textNodes.length > 0) {
          textNodes[0].textContent = newText;
          for (let i = 1; i < textNodes.length; i++) {
            textNodes[i].textContent = "";
          }
        } else {
          element.textContent = newText;
        }
      }
    } catch (error) {
      console.error("Error updating response element:", error);
    }
  }

  getTextNodes(element) {
    const textNodes = [];
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false,
    );

    let node;
    while ((node = walker.nextNode())) {
      if (node.textContent.trim()) {
        textNodes.push(node);
      }
    }

    return textNodes;
  }

  reinitialize() {
    this.isInitialized = false;
    if (this.responseObserver) {
      this.responseObserver.disconnect();
    }
    setTimeout(() => this.initialize(), 1000);
  }

  destroy() {
    if (this.responseObserver) {
      this.responseObserver.disconnect();
    }
    this.isInitialized = false;
  }
}

if (typeof window !== "undefined") {
  window.ChatGPTIntegration = ChatGPTIntegration;
  console.log("🔒 PII Extension: ChatGPTIntegration loaded");
}

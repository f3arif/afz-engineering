(function () {
  'use strict';

  var launcher = document.getElementById('afz-ai-launcher');
  var panel = document.getElementById('afz-ai-panel');
  var closeBtn = document.getElementById('afz-ai-close');
  var sendBtn = document.getElementById('afz-ai-send');
  var input = document.getElementById('afz-ai-input');
  var messages = document.getElementById('afz-ai-messages');
  var status = document.getElementById('afz-ai-status');
  var reopenBtn = document.getElementById('afz-ai-reopen');

  if (!launcher || !panel || !input || !sendBtn || !messages) return;

  // AFZ CONTACT HANDOFF LAUNCHER HIDE
  // AFZ CONTACT ENQUIRY MODE
  var CONTACT_HANDOFF_KEY = 'afz-ai-contact-handoff-v1';

  function isContactPage() {
    return (
      window.location.pathname === '/contact' ||
      window.location.pathname === '/contact.html'
    );
  }

  function hasContactHandoff() {
    if (!isContactPage()) return false;

    try {
      return sessionStorage.getItem(CONTACT_HANDOFF_KEY) === '1';
    } catch (err) {
      return false;
    }
  }

  function applyContactHandoffLauncherState() {
    if (!hasContactHandoff()) return;

    panel.classList.remove('afz-ai-open');
    launcher.setAttribute('aria-expanded', 'false');
    launcher.style.display = 'none';

    if (reopenBtn) {
      reopenBtn.style.display = 'inline-flex';
    }
  }

  applyContactHandoffLauncherState();

  // AFZ OPEN CHAT LAUNCHER STATE
  function setOpen(open) {
    panel.classList.toggle('afz-ai-open', open);
    launcher.setAttribute('aria-expanded', open ? 'true' : 'false');

    if (open || hasContactHandoff()) {
      launcher.style.display = 'none';
    } else {
      launcher.style.display = '';
    }

    if (open) {
      setTimeout(function () {
        input.focus();
      }, 100);
    }
  }

  // AFZ CONTACT REOPEN CHAT
  if (reopenBtn) {
    reopenBtn.addEventListener('click', function () {
      setOpen(true);
      messages.scrollTop = messages.scrollHeight;
    });
  }

  // AFZ CHAT SESSION PERSISTENCE
  var CHAT_STORAGE_KEY = 'afz-ai-chat-session-v1';

  function collectChatSession() {
    var entries = [];

    Array.prototype.forEach.call(
      messages.children,
      function (node) {

        if (
          node.classList.contains('afz-ai-msg')
        ) {
          entries.push({
            type: 'message',
            who: node.classList.contains('afz-ai-user')
              ? 'user'
              : 'bot',
            text: node.textContent || ''
          });
        }

        if (
          node.classList.contains('afz-ai-qualify-wrap')
        ) {
          entries.push({
            type: 'qualification',
            question:
              node.getAttribute(
                'data-project-question'
              ) || ''
          });
        }

        if (
          node.classList.contains('afz-ai-cta-wrap')
        ) {
          entries.push({
            type: 'cta',
            question:
              node.getAttribute(
                'data-project-question'
              ) || ''
          });
        }

        if (
          node.classList.contains('afz-ai-followups')
        ) {
          var followupQuestions = [];

          Array.prototype.forEach.call(
            node.querySelectorAll('.afz-ai-followup-question'),
            function (button) {
              if (button.textContent) {
                followupQuestions.push(button.textContent);
              }
            }
          );

          if (followupQuestions.length) {
            entries.push({
              type: 'followups',
              questions: followupQuestions.slice(0, 3)
            });
          }
        }
      }
    );

    return {
      entries: entries,
      open: panel.classList.contains('afz-ai-open')
    };
  }

  function saveChatSession() {
    try {
      sessionStorage.setItem(
        CHAT_STORAGE_KEY,
        JSON.stringify(collectChatSession())
      );
    } catch (err) {
      // Chat continues normally if storage is unavailable.
    }
  }

  function restoreChatSession() {
    try {
      var raw =
        sessionStorage.getItem(CHAT_STORAGE_KEY);

      if (!raw) {
        return;
      }

      var saved = JSON.parse(raw);

      if (
        !saved ||
        !Array.isArray(saved.entries) ||
        !saved.entries.length
      ) {
        return;
      }

      messages.innerHTML = '';

      saved.entries.forEach(function (entry) {

        if (
          entry &&
          entry.type === 'message' &&
          typeof entry.text === 'string'
        ) {
          var div = document.createElement('div');

          div.className =
            'afz-ai-msg ' +
            (
              entry.who === 'user'
                ? 'afz-ai-user'
                : 'afz-ai-bot'
            );

          div.textContent = entry.text;

          messages.appendChild(div);
        }

        if (
          entry &&
          entry.type === 'qualification'
        ) {
          addProjectQualification(
            entry.question || ''
          );
        }

        if (
          entry &&
          entry.type === 'cta'
        ) {
          addProjectCta(
            entry.question || ''
          );
        }

        if (
          entry &&
          entry.type === 'followups' &&
          Array.isArray(entry.questions)
        ) {
          addFollowUpSuggestions(
            '',
            '',
            entry.questions
          );
        }
      });

      messages.scrollTop =
        messages.scrollHeight;

      if (saved.open === true) {
        setOpen(true);
      }
    } catch (err) {
      try {
        sessionStorage.removeItem(
          CHAT_STORAGE_KEY
        );
      } catch (ignore) {
      }
    }
  }

  restoreChatSession();
  applyContactHandoffLauncherState();

  var chatSessionObserver =
    new MutationObserver(function () {
      saveChatSession();
    });

  chatSessionObserver.observe(
    messages,
    {
      childList: true,
      subtree: true
    }
  );

  chatSessionObserver.observe(
    panel,
    {
      attributes: true,
      attributeFilter: ['class']
    }
  );

  window.addEventListener(
    'pagehide',
    saveChatSession
  );

  function addMessage(text, who) {
    var div = document.createElement('div');
    div.className = 'afz-ai-msg ' +
      (who === 'user' ? 'afz-ai-user' : 'afz-ai-bot');

    div.textContent = text;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  // AFZ COMMON QUESTIONS + QUESTION ANALYTICS
  var COMMON_QUESTIONS = [
    'What services do you provide?',
    'Do you work on residential and commercial projects?',
    'Can you help with permit drawings?',
    'How do I get a quote?'
  ];


  // AFZ CONTEXTUAL FOLLOW-UP QUESTIONS
  var FOLLOW_UP_DEFAULTS = [
    'What information do you need?',
    'How do I get a quote?',
    'What is your typical process?',
    'Do you work on residential and commercial projects?'
  ];

  var FOLLOW_UP_RULES = [
    {
      terms: ['permit', 'drawing', 'drawings', 'sealed', 'p.eng'],
      questions: [
        'What information do you need for permit drawings?',
        'How do I get a quote?',
        'What is your typical process?'
      ]
    },
    {
      terms: ['quote', 'price', 'pricing', 'cost', 'fee'],
      questions: [
        'What information do you need for a quote?',
        'Do you work on residential and commercial projects?',
        'What is your typical process?'
      ]
    },
    {
      terms: ['hvac', 'furnace', 'heat pump', 'duct', 'ventilation', 'hrv', 'erv'],
      questions: [
        'Can you help with HVAC permit drawings?',
        'What project information do you need?',
        'How do I get a quote?'
      ]
    },
    {
      terms: ['plumbing', 'drain', 'sanitary', 'water', 'riser'],
      questions: [
        'Can you help with plumbing permit drawings?',
        'What project information do you need?',
        'How do I get a quote?'
      ]
    },
    {
      terms: ['hydronic', 'boiler', 'radiant', 'in-floor', 'baseboard'],
      questions: [
        'Can you help with hydronic heating design?',
        'What project information do you need?',
        'How do I get a quote?'
      ]
    },
    {
      terms: ['residential', 'commercial', 'renovation', 'addition', 'basement', 'new construction'],
      questions: [
        'What services can you provide for this project?',
        'Can you help with permit drawings?',
        'How do I get a quote?'
      ]
    }
  ];

  function removeCommonQuestions() {
    var existing =
      messages.querySelector('.afz-ai-common-questions');

    if (existing) {
      existing.remove();
    }
  }

  function ensureCommonQuestions() {
    if (
      messages.querySelector('.afz-ai-user') ||
      messages.querySelector('.afz-ai-common-questions')
    ) {
      return;
    }

    var wrap = document.createElement('div');
    wrap.className = 'afz-ai-common-questions';

    var title = document.createElement('div');
    title.className = 'afz-ai-common-title';
    title.textContent = 'Common questions';
    wrap.appendChild(title);

    var list = document.createElement('div');
    list.className = 'afz-ai-common-list';

    COMMON_QUESTIONS.forEach(function (question) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'afz-ai-common-question';
      button.textContent = question;
      button.addEventListener('click', function () {
        input.value = question;
        sendMessage('common-question');
      });
      list.appendChild(button);
    });

    wrap.appendChild(list);
    messages.appendChild(wrap);
  }

  function removeFollowUpSuggestions() {
    var existing =
      messages.querySelector('.afz-ai-followups');

    if (existing) {
      existing.remove();
    }
  }

  function normalizeFollowUpText(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function getFollowUpQuestions(question, answer) {
    var context = ((question || '') + ' ' + (answer || '')).toLowerCase();
    var candidates = [];
    var seen = {};
    var asked = {};

    Array.prototype.forEach.call(
      messages.querySelectorAll('.afz-ai-user'),
      function (node) {
        var key = normalizeFollowUpText(node.textContent || '');
        if (key) asked[key] = true;
      }
    );

    function addCandidate(candidate) {
      var key = normalizeFollowUpText(candidate);
      if (!key || seen[key] || asked[key]) return;

      seen[key] = true;
      candidates.push(candidate);
    }

    FOLLOW_UP_RULES.forEach(function (rule) {
      var matched = rule.terms.some(function (term) {
        return context.indexOf(term) !== -1;
      });

      if (matched) {
        rule.questions.forEach(addCandidate);
      }
    });

    FOLLOW_UP_DEFAULTS.forEach(addCandidate);
    COMMON_QUESTIONS.forEach(addCandidate);

    return candidates.slice(0, 3);
  }

  function addFollowUpSuggestions(question, answer, explicitQuestions) {
    removeFollowUpSuggestions();

    var suggestions =
      Array.isArray(explicitQuestions) && explicitQuestions.length
        ? explicitQuestions.slice(0, 3)
        : getFollowUpQuestions(question, answer);

    if (!suggestions.length) return;

    var wrap = document.createElement('div');
    wrap.className = 'afz-ai-followups';

    var title = document.createElement('div');
    title.className = 'afz-ai-followups-title';
    title.textContent = 'You may also ask';
    wrap.appendChild(title);

    var list = document.createElement('div');
    list.className = 'afz-ai-followups-list';

    suggestions.forEach(function (suggestion) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'afz-ai-followup-question';
      button.textContent = suggestion;
      button.addEventListener('click', function () {
        input.value = suggestion;
        sendMessage('common-question');
      });
      list.appendChild(button);
    });

    wrap.appendChild(list);
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  }

  // AFZ COMMON QUESTIONS INITIALIZATION ORDER
  ensureCommonQuestions();

  function logQuestionAnalytics(question, source) {
    try {
      fetch('/api/chat-analytics', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        keepalive: true,
        body: JSON.stringify({
          question: question,
          source: source || 'typed',
          page_path: window.location.pathname || '/'
        })
      }).catch(function () {
        // Analytics must never interrupt the customer chat.
      });
    } catch (err) {
      // Analytics must never interrupt the customer chat.
    }
  }

  // AFZ SMART QUALIFICATION TRIGGER
  function normalizeProjectIntentText(text) {
    return (text || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  function isGeneralInformationQuestion(question) {
    var text = normalizeProjectIntentText(question);

    var generalStarts = [
      'what services do you provide',
      'what services can you provide',
      'what information do you need',
      'what project information do you need',
      'what information do you need for permit drawings',
      'what information do you need for a quote',
      'what is your typical process',
      'what is the typical process',
      'how do i get a quote',
      'do you work on residential and commercial projects',
      'can you help with permit drawings',
      'can you help with hvac permit drawings',
      'can you help with plumbing permit drawings',
      'can you help with hydronic heating design'
    ];

    return generalStarts.some(function (start) {
      return text.indexOf(start) === 0;
    });
  }

  function hasExplicitProjectIntent(question) {
    var text = normalizeProjectIntentText(question);

    var patterns = [
      /\b(my|our)\b/,
      /\b(i|we)\s+(need|want|have|require|plan|planning)\b/,
      /\b(i am|im|we are|were)\s+(building|renovating|finishing|adding|replacing|installing)\b/,
      /\bneed\s+(hvac|plumbing|mechanical|permit|drawings|design|engineer|engineering)\b/,
      /\bquote\s+(for\s+)?(my|our|this)\b/,
      /\bfor\s+(my|our)\b/
    ];

    return patterns.some(function (pattern) {
      return pattern.test(text);
    });
  }

  function looksLikeProjectSpecificEngineeringQuestion(question) {
    var text = normalizeProjectIntentText(question);

    var patterns = [
      /\bwhat\s+(size|capacity|cfm|diameter|furnace|heat pump|boiler)\b/,
      /\bshould\s+(i|we)\b/,
      /\bcan\s+(i|we)\s+(install|use|reduce|resize|connect|replace|move)\b/,
      /\bwhere\s+should\s+(i|we)\b/,
      /\bhow\s+(many|much)\s+(cfm|btu|btuh|tons|kw)\b/,
      /\b(existing|proposed)\b.*\b(duct|furnace|boiler|pipe|equipment)\b/
    ];

    return patterns.some(function (pattern) {
      return pattern.test(text);
    });
  }

  function shouldStartProjectQualification(question, answer) {
    if (isGeneralInformationQuestion(question)) {
      return false;
    }

    if (
      hasExplicitProjectIntent(question) ||
      looksLikeProjectSpecificEngineeringQuestion(question)
    ) {
      return true;
    }

    var responseText = (answer || '').toLowerCase();
    var strongReviewSignals = [
      'afz engineer must review',
      'requires project-specific',
      'requires a project-specific',
      'project-specific engineering review',
      'project-specific code review'
    ];

    return strongReviewSignals.some(function (signal) {
      return responseText.indexOf(signal) !== -1;
    });
  }

  function removeSoftProjectPrompt() {
    var existing =
      messages.querySelector('.afz-ai-soft-cta-wrap');

    if (existing) {
      existing.remove();
    }
  }

  function addSoftProjectPrompt(question) {
    if (
      isContactPage() ||
      messages.querySelector('.afz-ai-qualify-wrap') ||
      messages.querySelector('.afz-ai-cta-wrap') ||
      messages.querySelector('.afz-ai-soft-cta-wrap')
    ) {
      return;
    }

    var userQuestionCount =
      messages.querySelectorAll('.afz-ai-user').length;

    if (userQuestionCount < 3) {
      return;
    }

    var wrap = document.createElement('div');
    wrap.className = 'afz-ai-soft-cta-wrap';

    var copy = document.createElement('div');
    copy.className = 'afz-ai-soft-cta-copy';

    var title = document.createElement('div');
    title.className = 'afz-ai-soft-cta-title';
    title.textContent = 'Ready to discuss your project?';

    var note = document.createElement('div');
    note.className = 'afz-ai-soft-cta-note';
    note.textContent =
      'Share a few project details and we’ll carry them into the enquiry form.';

    copy.appendChild(title);
    copy.appendChild(note);

    var button = document.createElement('button');
    button.type = 'button';
    button.className = 'afz-ai-soft-cta-button';
    button.textContent = 'Start project enquiry';

    button.addEventListener('click', function () {
      removeSoftProjectPrompt();
      removeFollowUpSuggestions();
      addProjectQualification(question || '');
    });

    wrap.appendChild(copy);
    wrap.appendChild(button);
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  }

  // AFZ PROJECT QUALIFICATION
  var PROJECT_QUALIFICATION_KEY =
    'afz-ai-project-qualification-v1';

  function getProjectQualification() {
    try {
      var raw =
        sessionStorage.getItem(
          PROJECT_QUALIFICATION_KEY
        );

      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      return null;
    }
  }

  function setStoredProjectQualification(data) {
    try {
      sessionStorage.setItem(
        PROJECT_QUALIFICATION_KEY,
        JSON.stringify(data)
      );
    } catch (err) {
      // Qualification continues if storage is unavailable.
    }
  }

  function clearStoredProjectQualification() {
    try {
      sessionStorage.removeItem(
        PROJECT_QUALIFICATION_KEY
      );
    } catch (err) {
    }
  }

  function addProjectQualification(question) {
    var existing =
      messages.querySelector(
        '.afz-ai-qualify-wrap'
      );

    if (existing) {
      existing.remove();
    }

    var wrap = document.createElement('div');
    wrap.className = 'afz-ai-qualify-wrap';
    wrap.setAttribute(
      'data-project-question',
      question || ''
    );

    var title = document.createElement('div');
    title.className = 'afz-ai-qualify-title';
    title.textContent = 'Quick project details';
    wrap.appendChild(title);

    var note = document.createElement('div');
    note.className = 'afz-ai-qualify-note';
    note.textContent =
      'Optional — these details will be carried into your enquiry form.';
    wrap.appendChild(note);

    function addField(labelText, control) {
      var field = document.createElement('label');
      field.className = 'afz-ai-qualify-field';

      var label = document.createElement('span');
      label.textContent = labelText;
      field.appendChild(label);
      field.appendChild(control);
      wrap.appendChild(field);
    }

    function makeSelect(options, placeholder) {
      var select = document.createElement('select');

      var first = document.createElement('option');
      first.value = '';
      first.textContent = placeholder;
      select.appendChild(first);

      options.forEach(function (value) {
        var option = document.createElement('option');
        option.value = value;
        option.textContent = value;
        select.appendChild(option);
      });

      return select;
    }

    var propertyType = makeSelect(
      [
        'Residential',
        'Commercial'
      ],
      'Select residential or commercial'
    );

    var projectType = makeSelect(
      [
        'New construction',
        'Renovation or addition',
        'Basement / secondary suite',
        'Equipment upgrade / retrofit',
        'Site review only',
        'Not sure yet'
      ],
      'Select project type'
    );

    var services = makeSelect(
      [
        'HVAC design',
        'Plumbing design',
        'Hydronic / radiant heating',
        'HVAC + plumbing',
        'Full mechanical design',
        'Site review reports',
        'Not sure — please advise'
      ],
      'Select service'
    );

    var location = document.createElement('input');
    location.type = 'text';
    location.maxLength = 160;
    location.placeholder = 'City / municipality';
    location.autocomplete = 'address-level2';

    addField('Project', propertyType);
    addField('Type', projectType);
    addField('Service', services);
    addField('Location', location);

    var saved = getProjectQualification();

    if (
      saved &&
      saved.question === (question || '')
    ) {
      propertyType.value = saved.propertyType || '';
      projectType.value = saved.projectType || '';
      services.value = saved.services || '';
      location.value = saved.location || '';
    }

    var actions = document.createElement('div');
    actions.className = 'afz-ai-qualify-actions';

    var save = document.createElement('button');
    save.type = 'button';
    save.className = 'afz-ai-qualify-save';
    save.textContent = 'Save & continue';

    var skip = document.createElement('button');
    skip.type = 'button';
    skip.className = 'afz-ai-qualify-skip';
    skip.textContent = 'Skip';

    save.addEventListener('click', function () {
      var projectQuestion =
        wrap.getAttribute(
          'data-project-question'
        ) || '';

      setStoredProjectQualification({
        question: projectQuestion,
        propertyType: propertyType.value,
        projectType: projectType.value,
        services: services.value,
        location: location.value.trim()
      });

      try {
        if (projectQuestion.trim()) {
          sessionStorage.setItem(
            'afz-ai-project-question-v1',
            projectQuestion.trim()
          );
        }
      } catch (err) {
      }

      // AFZ QUALIFICATION AUTO-CONTINUE
      wrap.remove();
      addMessage(
        'Thanks — opening the enquiry form with your project details.',
        'bot'
      );

      panel.classList.remove('afz-ai-open');
      launcher.setAttribute(
        'aria-expanded',
        'false'
      );

      try {
        sessionStorage.setItem(
          CONTACT_HANDOFF_KEY,
          '1'
        );
      } catch (err) {
      }

      launcher.style.display = 'none';
      saveChatSession();
      window.location.assign('/contact#afzForm');
    });

    skip.addEventListener('click', function () {
      var projectQuestion =
        wrap.getAttribute(
          'data-project-question'
        ) || '';

      clearStoredProjectQualification();
      wrap.remove();
      addProjectCta(projectQuestion);
    });

    actions.appendChild(save);
    actions.appendChild(skip);
    wrap.appendChild(actions);

    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  }

  function addProjectCta(question) {
    var wrap = document.createElement('div');
    wrap.className = 'afz-ai-cta-wrap';

    wrap.setAttribute(
      'data-project-question',
      question || ''
    );

    var link = document.createElement('a');
    link.className = 'afz-ai-cta';

    var onContactPage = isContactPage();
    var contactHandoff = hasContactHandoff();

    link.href =
      onContactPage
        ? '#afzForm'
        : '/contact';

    link.textContent =
      onContactPage && contactHandoff
        ? 'Back to enquiry'
        : onContactPage
          ? 'Continue Your Enquiry'
          : 'Discuss Your Project';

    // AFZ PROJECT QUESTION HANDOFF
    link.addEventListener('click', function (event) {
      try {
        var projectQuestion =
          wrap.getAttribute(
            'data-project-question'
          ) || '';

        projectQuestion =
          projectQuestion.trim();

        if (projectQuestion) {
          sessionStorage.setItem(
            'afz-ai-project-question-v1',
            projectQuestion
          );
        }
      } catch (err) {
        // Navigation continues if storage is unavailable.
      }

      if (onContactPage) {
        event.preventDefault();
        setOpen(false);

        var form =
          document.getElementById('afzForm');

        if (!contactHandoff && form) {
          form.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
          });
        }
      }
    });

    link.setAttribute(
      'aria-label',
      onContactPage && contactHandoff
        ? 'Back to your project enquiry'
        : onContactPage
          ? 'Continue your project enquiry'
          : 'Discuss your project with AFZ Engineering'
    );

    wrap.appendChild(link);
    messages.appendChild(wrap);
    messages.scrollTop = messages.scrollHeight;
  }

  function setBusy(busy) {
    sendBtn.disabled = busy;
    input.disabled = busy;
    status.textContent = busy ? 'AFZ Assistant is thinking…' : '';

    if (!busy) input.focus();
  }

  async function sendMessage(source) {
    var message = input.value.trim();

    if (!message) return;

    if (message.length > 500) {
      status.textContent = 'Please keep your question under 500 characters.';
      return;
    }

    source =
      source === 'common-question'
        ? 'common-question'
        : 'typed';

    removeFollowUpSuggestions();
    removeSoftProjectPrompt();
    removeCommonQuestions();
    addMessage(message, 'user');
    logQuestionAnalytics(message, source);
    input.value = '';
    setBusy(true);

    try {
      var response = await fetch('/api/ai-chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: message
        })
      });

      var data;

      try {
        data = await response.json();
      } catch (e) {
        throw new Error('Invalid server response');
      }

      if (!response.ok) {
        throw new Error(
          data.error ||
          data.detail ||
          'The assistant is temporarily unavailable.'
        );
      }

      var answer =
        data.answer || 'I was unable to generate a response.';

      addMessage(answer, 'bot');

      if (shouldStartProjectQualification(message, answer)) {
        addProjectQualification(message);
      } else {
        addFollowUpSuggestions(message, answer);
        addSoftProjectPrompt(message);
      }
    } catch (err) {
      addMessage(
        'Our AI assistant is temporarily unavailable. Please try again shortly or contact AFZ Engineering directly.',
        'bot'
      );
    } finally {
      setBusy(false);
    }
  }

  // AFZ RELIABLE CHAT OPEN
  function openChatFromLauncher(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    setOpen(true);
    messages.scrollTop = messages.scrollHeight;
    saveChatSession();
  }

  // Pointer activation handles mouse/touch immediately; click preserves
  // keyboard activation and acts as a fallback on older browsers.
  if ('PointerEvent' in window) {
    launcher.addEventListener('pointerup', openChatFromLauncher, true);
  }
  launcher.addEventListener('click', openChatFromLauncher, true);

  // AFZ RELIABLE CHAT CLOSE
  function closeChat(event) {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }

    panel.classList.remove('afz-ai-open');
    launcher.setAttribute('aria-expanded', 'false');

    if (hasContactHandoff()) {
      launcher.style.display = 'none';
    } else {
      launcher.style.display = '';
    }

    saveChatSession();
  }

  if (closeBtn) {
    closeBtn.addEventListener('click', closeChat, true);
  }

  // Capture-phase fallback in case site-level handlers interfere.
  panel.addEventListener('click', function (event) {
    var target = event.target;
    if (target && target.closest && target.closest('#afz-ai-close')) {
      closeChat(event);
    }
  }, true);

  document.addEventListener('keydown', function (event) {
    if (event.key === 'Escape' && panel.classList.contains('afz-ai-open')) {
      closeChat(event);
      launcher.focus();
    }
  });

  sendBtn.addEventListener('click', function () {
    sendMessage('typed');
  });

  input.addEventListener('keydown', function (event) {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      sendMessage('typed');
    }
  });
})();
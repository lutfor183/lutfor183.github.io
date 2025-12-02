document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const editorContainer = document.getElementById('editor-container');
    const savedSessionsContainer = document.getElementById('saved-sessions-container');
    const savedSessionsList = document.getElementById('saved-sessions-list');
    const orderToggle = document.getElementById('order-toggle');
    const resultContainer = document.getElementById('result-container');
    const headingsContainer = document.getElementById('headings-container');
    const heading1 = document.getElementById('heading-1');
    const heading2 = document.getElementById('heading-2');
    const saveBtn = document.getElementById('save-btn');
    const manualParseBtn = document.getElementById('manual-parse-btn'); 
    const bnContentInput = document.getElementById('bn-content-input');
    const enContentInput = document.getElementById('en-content-input');
    const exportBtn = document.getElementById('export-btn');
    const importBtn = document.getElementById('import-btn');
    const importInput = document.getElementById('import-input');
    const showSessionsBtn = document.getElementById('show-sessions-btn');
    const layoutToggle = document.getElementById('layout-toggle');
    const decreaseFontBtn = document.getElementById('decrease-font');
    const increaseFontBtn = document.getElementById('increase-font');
    const fontSizeDisplay = document.getElementById('font-size-display');
    // NEW: Blur Toggle Button
    const blurToggleBtn = document.getElementById('blur-toggle-btn');


    // --- State Management ---
    let appState = {
        bn: { heading: '', sentences: [] },
        en: { heading: '', sentences: [] }
    };
    let historyStack = [];
    let isBlurred = true;
    let isVertical = false; 
    let currentFontSize = 2.25; 


    // --- UTILITY: LocalStorage Wrappers ---
    const getSavedSessions = () => {
        const data = localStorage.getItem('savedSessions');
        return data ? JSON.parse(data) : [];
    };

    const setSavedSessions = (sessions) => {
        localStorage.setItem('savedSessions', JSON.stringify(sessions));
    };

    // --- Core Functions ---
    const saveState = () => {
        historyStack.push(JSON.parse(JSON.stringify(appState)));
        if (historyStack.length > 20) historyStack.shift();
    };
    
    const syncStateFromDOM = () => {
        const pairs = document.querySelectorAll('.article-pair');
        const isEnFirst = orderToggle.checked;
        const lang1Sentences = Array.from(pairs).map(p => p.children[0].textContent);
        const lang2Sentences = Array.from(pairs).map(p => p.children[1].textContent);
        appState.bn.sentences = isEnFirst ? lang2Sentences : lang1Sentences;
        appState.en.sentences = isEnFirst ? lang1Sentences : lang2Sentences;
    };

    const renderContent = () => {
        resultContainer.innerHTML = '';
        const isEnFirst = orderToggle.checked;
        const firstLangData = isEnFirst ? appState.en : appState.bn;
        const secondLangData = isEnFirst ? appState.bn : appState.en;
        
        headingsContainer.style.display = 'block';
        heading1.textContent = firstLangData.heading || (isEnFirst ? 'English Article' : 'Bangla Article');
        heading2.textContent = secondLangData.heading || (isEnFirst ? 'Bangla Article' : 'English Article');
        
        resultContainer.classList.toggle('vertical-layout', isVertical);
        layoutToggle.textContent = isVertical 
            ? 'Switch to Horizontal Layout' 
            : 'Switch to Vertical Layout';
        
        const fontSizeStr = `${currentFontSize}em`;
        fontSizeDisplay.textContent = fontSizeStr;
        
        // Ensure blur button text is correct when content is first rendered
        if (blurToggleBtn) {
            blurToggleBtn.textContent = isBlurred ? 'Unblur Content (Space)' : 'Blur Content (Space)';
        }


        const maxLength = Math.max(firstLangData.sentences.length, secondLangData.sentences.length);
        for (let i = 0; i < maxLength; i++) {
            const pairDiv = document.createElement('div');
            pairDiv.className = 'article-pair';
            
            const p1 = document.createElement('p');
            p1.textContent = firstLangData.sentences[i] || ''; 
            p1.setAttribute('contenteditable', 'true');
            p1.style.fontSize = fontSizeStr;
            
            const p2 = document.createElement('p');
            p2.textContent = secondLangData.sentences[i] || ''; 
            p2.setAttribute('contenteditable', 'true');
            p2.style.fontSize = fontSizeStr;
            
            if (isBlurred) {
                p2.classList.add('blurred');
            }

            pairDiv.appendChild(p1);
            pairDiv.appendChild(p2);
            resultContainer.appendChild(pairDiv);
        }
    };

    function handleManualEdit(event) {
        const target = event.target;
        if (!target.isContentEditable) return;
        
        const selection = window.getSelection();
        if (event.key !== 'z') syncStateFromDOM();
        saveState();

        const pair = target.closest('.article-pair');
        const pairIndex = Array.from(resultContainer.children).indexOf(pair);
        const isEnFirst = orderToggle.checked;
        const isFirstColumn = target === pair.firstChild;
        const targetLang = (isEnFirst && isFirstColumn) || (!isEnFirst && !isFirstColumn) ? 'en' : 'bn';
        const sentenceArray = appState[targetLang].sentences;

        if (event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            const cursorPosition = selection.anchorOffset;
            const text = target.textContent;
            
            if (pairIndex >= 0 && pairIndex < sentenceArray.length) {
                sentenceArray.splice(pairIndex, 1, text.substring(0, cursorPosition), text.substring(cursorPosition));
            } else if (pairIndex === sentenceArray.length) {
                sentenceArray.push(text.substring(0, cursorPosition), text.substring(cursorPosition));
            }
            renderContent();
        } else if (event.key === 'Enter' && event.shiftKey) {
            event.preventDefault();
            if (pairIndex < sentenceArray.length - 1) {
                const mergedText = sentenceArray[pairIndex] + ' ' + sentenceArray[pairIndex + 1];
                sentenceArray.splice(pairIndex, 2, mergedText);
                renderContent();
            }
        } else if (event.key === 'Backspace' && selection.anchorOffset === 0) {
            event.preventDefault();
            if (pairIndex > 0) {
                const mergedText = sentenceArray[pairIndex - 1] + ' ' + sentenceArray[pairIndex];
                sentenceArray.splice(pairIndex - 1, 2, mergedText);
                renderContent();
            }
        } else if ((event.ctrlKey || event.metaKey) && event.key === 'z') {
            event.preventDefault();
            if (historyStack.length > 0) {
                appState = historyStack.pop();
                renderContent();
            }
        }
    }
    
    // --- OFFLINE SESSION MANAGEMENT ---
    const saveSession = () => {
        syncStateFromDOM();
        const currentTitle = appState.en.heading.substring(0, 50) || 'Untitled Session';
        
        const savedSessions = getSavedSessions();
        const existingSessionIndex = savedSessions.findIndex(s => s.title === currentTitle);

        if (existingSessionIndex > -1) {
            if (confirm(`A session named "${currentTitle}" already exists. Do you want to update it with your changes?\n\n(Cancel to save as a new copy)`)) {
                savedSessions[existingSessionIndex].data = appState;
                savedSessions[existingSessionIndex].date = new Date().toLocaleString();
                setSavedSessions(savedSessions);
                alert(`Session "${currentTitle}" updated!`);
                location.reload();
                return;
            }
        }
        
        const newSession = {
            id: Date.now(),
            title: currentTitle,
            date: new Date().toLocaleString(),
            data: appState
        };
        savedSessions.push(newSession);
        setSavedSessions(savedSessions);
        
        alert(`New session "${newSession.title}" saved!`);
        location.reload();
    };

    const loadSessions = () => {
        const sessions = getSavedSessions();
        savedSessionsList.innerHTML = '';
        if (sessions.length === 0) {
            savedSessionsList.innerHTML = '<p>No saved sessions yet. Start a new session above or import a backup!</p>';
            return;
        }
        sessions.reverse().forEach(session => {
            const sessionDiv = document.createElement('div');
            sessionDiv.className = 'saved-session-item';
            sessionDiv.innerHTML = `<div class="session-info"><strong>${session.title}</strong><small>${session.date}</small></div><div class="session-actions"><button class="load-btn" data-id="${session.id}">Load</button><button class="delete-btn" data-id="${session.id}">Delete</button></div>`;
            savedSessionsList.appendChild(sessionDiv);
        });
    };
    
    savedSessionsList.addEventListener('click', (event) => {
        const sessionId = event.target.getAttribute('data-id');
        if (!sessionId) return;
        let sessions = getSavedSessions();
        if (event.target.classList.contains('load-btn')) {
            const sessionToLoad = sessions.find(s => s.id == sessionId);
            if (sessionToLoad) {
                appState = sessionToLoad.data;
                editorContainer.style.display = 'block';
                savedSessionsContainer.style.display = 'none';
                renderContent();
            }
        } else if (event.target.classList.contains('delete-btn')) {
            setSavedSessions(sessions.filter(s => s.id != sessionId));
            loadSessions();
        }
    });

    // --- Manual Article Parsing Function (Paragraph Parsing Mode) ---
    const parseContent = (fullText, lang) => {
        
        // 1. Normalize content by splitting on one or more newlines and filtering empty results
        let paragraphs = fullText
            .split(/[\r\n]+/) 
            .map(p => p.trim())
            .filter(p => p.length > 5); 
        
        if (paragraphs.length === 0) {
            let trimmedText = fullText.trim();
            if (trimmedText.length > 5) {
                paragraphs = [trimmedText];
            }
        }

        // 2. Simple heading generation
        const heading = paragraphs.length > 0 
            ? paragraphs[0].substring(0, 50).replace(/\s+/g, ' ') + '...'
            : 'Untitled ' + (lang === 'bn' ? 'Bangla' : 'English');

        return { heading, sentences: paragraphs };
    }

    // --- UPDATED: Manual Parse Button Logic ---
    manualParseBtn.addEventListener('click', () => {
        const bnText = bnContentInput.value.trim();
        const enText = enContentInput.value.trim();

        if (!bnText || !enText) {
            alert("Please paste content into both the Bangla and English text areas.");
            return;
        }

        try {
            const bnData = parseContent(bnText, 'bn'); 
            const enData = parseContent(enText, 'en');

            if (bnData.sentences.length === 0 || enData.sentences.length === 0) {
                alert("Could not extract any content. Please ensure the pasted text is not empty.");
                return;
            }

            appState.bn.sentences = bnData.sentences;
            appState.bn.heading = bnData.heading;
            appState.en.sentences = enData.sentences;
            appState.en.heading = enData.heading;
            
            editorContainer.style.display = 'block';
            savedSessionsContainer.style.display = 'none';
            
            renderContent();
            saveState(); 
            
            bnContentInput.value = '';
            enContentInput.value = '';

        } catch (error) {
            alert("An error occurred during content parsing: " + error.message);
        }
    });

    // --- Export Logic ---
    exportBtn.addEventListener('click', () => {
        const savedSessions = getSavedSessions();
        if (savedSessions.length === 0) {
            alert('No sessions to export.'); return;
        }
        const dataStr = JSON.stringify(savedSessions, null, 2);
        
        const blob = new Blob([dataStr], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'translation_sessions_backup.json';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // --- Import Logic ---
    importBtn.addEventListener('click', () => importInput.click());
    importInput.addEventListener('change', (event) => {
        const file = event.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const imported = JSON.parse(e.target.result);
                if (!Array.isArray(imported)) throw new Error('Invalid backup file.');
                
                const savedSessions = getSavedSessions();
                const existingIds = new Set(savedSessions.map(s => s.id));
                const newSessions = imported.filter(s => !existingIds.has(s.id));

                if (newSessions.length > 0) {
                    setSavedSessions([...savedSessions, ...newSessions]);
                    alert(`${newSessions.length} new session(s) imported!`);
                    loadSessions();
                } else {
                    alert('No new sessions found in the file to import.');
                }
            } catch (error) {
                alert(`Error importing file: ${error.message}`);
            }
        };
        reader.readAsText(file);
    });

    // --- Font Control Logic ---
    const updateFontSize = (delta) => {
        currentFontSize = parseFloat((Math.max(1.0, Math.min(5.0, currentFontSize + delta))).toFixed(2));
        
        localStorage.setItem('translationFontSize', currentFontSize);
        renderContent();
    };

    increaseFontBtn.addEventListener('click', () => updateFontSize(0.25));
    decreaseFontBtn.addEventListener('click', () => updateFontSize(-0.25));

    // --- NEW: Toggle Blur Function ---
    const toggleBlur = () => {
        isBlurred = !isBlurred;
        const secondParagraphs = document.querySelectorAll('.article-pair p:nth-child(2)');
        secondParagraphs.forEach(p => {
            p.classList.toggle('blurred', isBlurred);
        });
        
        if (blurToggleBtn) {
            blurToggleBtn.textContent = isBlurred ? 'Unblur Content (Space)' : 'Blur Content (Space)';
        }
    };
    
    // --- Initialize function ---
    const initialize = () => {
        const savedSize = localStorage.getItem('translationFontSize');
        if (savedSize) {
            currentFontSize = parseFloat(savedSize);
        }
        
        editorContainer.style.display = 'none';
        savedSessionsContainer.style.display = 'block';
        loadSessions();
    };

    // --- Attaching Event Listeners ---
    resultContainer.addEventListener('keydown', handleManualEdit);
    resultContainer.addEventListener('input', () => { 
        syncStateFromDOM();
        saveState(); 
    });
    saveBtn.addEventListener('click', saveSession);
    
    if (showSessionsBtn) {
        showSessionsBtn.addEventListener('click', () => {
            location.reload(); 
        });
    }
    
    orderToggle.addEventListener('click', () => {
        renderContent();
    });
    
    layoutToggle.addEventListener('click', () => {
        isVertical = !isVertical;
        renderContent();
    });
    
    // NEW: Button Listener
    if (blurToggleBtn) {
        blurToggleBtn.addEventListener('click', toggleBlur);
    }

    // Existing Spacebar Listener (now calls the new function)
    document.addEventListener('keydown', (event) => {
        // Prevents spacebar action if user is actively typing in a paragraph or textarea
        if (event.code === 'Space' && document.activeElement.tagName !== 'P' && document.activeElement.tagName !== 'TEXTAREA') {
            event.preventDefault();
            toggleBlur();
        }
    });

    initialize();
});

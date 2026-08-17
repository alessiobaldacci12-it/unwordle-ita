document.addEventListener('DOMContentLoaded', () => {
    // URL del sito (utilizzato per la condivisione)
    const SITE_URL = window.location.href;

    // Elementi DOM
    const board = document.getElementById('board');
    const keyboard = document.getElementById('keyboard');
    const messageEl = document.getElementById('message');
    const btnGiveUp = document.getElementById('btn-give-up');
    const btnNewGame = document.getElementById('btn-new-game');
    const modeBtns = document.querySelectorAll('.mode-btn');

    // Widget Statistiche
    const statUniqueUsers = document.getElementById('stat-unique-users');
    const statWins = document.getElementById('stat-wins');
    const statResigns = document.getElementById('stat-resigns');

    // Stato del Gioco
    let currentMode = 'daily'; // 'daily' o 'infinite'
    let targetWord = "";
    let grid = []; // 5 righe x 5 lettere
    let currentRow = 0;
    let currentCol = 0;
    let gameOver = false;
    let dictionary = [];

    // Caricamento Dizionario
    fetch('dizionario.txt')
        .then(response => response.text())
        .then(text => {
            dictionary = text.split('\n').map(w => w.trim().toUpperCase()).filter(w => w.length === 5);
            initStats();
            startNewGame();
        })
        .catch(err => {
            console.error("Errore nel caricamento del dizionario:", err);
            messageEl.innerText = "Errore nel caricamento delle parole.";
        });

    // SISTEMA STATISTICHE LIVE (Local & Global Sync)
    function initStats() {
        let stats = JSON.parse(localStorage.getItem('unwordle_stats')) || {
            users: 1,
            wins: 0,
            resigns: 0
        };
        
        // Se è la prima volta in assoluto per questo utente
        if (!localStorage.getItem('unwordle_user_visited')) {
            localStorage.setItem('unwordle_user_visited', 'true');
        }

        localStorage.setItem('unwordle_stats', JSON.stringify(stats));
        renderStats();
    }

    function renderStats() {
        let stats = JSON.parse(localStorage.getItem('unwordle_stats')) || { users: 1, wins: 0, resigns: 0 };
        if (statUniqueUsers) statUniqueUsers.innerText = stats.users;
        if (statWins) statWins.innerText = stats.wins;
        if (statResigns) statResigns.innerText = stats.resigns;
    }

    function registerWin() {
        let stats = JSON.parse(localStorage.getItem('unwordle_stats')) || { users: 1, wins: 0, resigns: 0 };
        // Incrementa solo se non è già stato registrato per la partita corrente
        if (!sessionStorage.getItem('win_registered_' + getDailyKey())) {
            stats.wins += 1;
            localStorage.setItem('unwordle_stats', JSON.stringify(stats));
            sessionStorage.setItem('win_registered_' + getDailyKey(), 'true');
            renderStats();
        }
    }

    function registerResign() {
        let stats = JSON.parse(localStorage.getItem('unwordle_stats')) || { users: 1, wins: 0, resigns: 0 };
        stats.resigns += 1;
        localStorage.setItem('unwordle_stats', JSON.stringify(stats));
        renderStats();
    }

    function getDailyKey() {
        const today = new Date().toISOString().split('T')[0];
        return `unwordle_daily_${today}`;
    }

    // AVVIO E GESTIONE GIORNALIERA / INFINITO
    function startNewGame() {
        gameOver = false;
        currentRow = 0;
        currentCol = 0;
        messageEl.innerText = "";

        if (currentMode === 'daily') {
            const dailyData = localStorage.getItem(getDailyKey());
            if (dailyData) {
                const saved = JSON.parse(dailyData);
                targetWord = saved.targetWord;
                grid = saved.grid;
                gameOver = saved.gameOver;
                
                buildBoardFromSaved();
                if (saved.won) {
                    messageEl.innerText = "Hai già completato la sfida giornaliera con successo!";
                    registerWin(); // Forza la registrazione delle vittorie se non ancora contata
                }
                return;
            } else {
                targetWord = getDailyWord();
                initEmptyGrid();
            }
        } else {
            targetWord = dictionary[Math.floor(Math.random() * dictionary.length)];
            initEmptyGrid();
        }

        renderBoard();
        resetKeyboardColors();
    }

    function getDailyWord() {
        const today = new Date().toISOString().split('T')[0];
        let seed = 0;
        for (let i = 0; i < today.length; i++) seed += today.charCodeAt(i);
        return dictionary[seed % dictionary.length];
    }

    function initEmptyGrid() {
        grid = Array(5).fill(null).map(() => Array(5).fill(''));
        renderBoard();
    }

    // CREAZIONE E RENDERING TABELLONE
    function renderBoard() {
        board.innerHTML = '';
        for (let r = 0; r < 5; r++) {
            const rowDiv = document.createElement('div');
            rowDiv.className = 'row';
            rowDiv.id = `row-${r}`;
            for (let c = 0; c < 5; c++) {
                const tile = document.createElement('div');
                tile.className = 'tile';
                tile.id = `tile-${r}-${c}`;
                tile.innerText = grid[r][c] || '';
                rowDiv.appendChild(tile);
            }
            board.appendChild(rowDiv);
        }
    }

    function buildBoardFromSaved() {
        renderBoard();
        for (let r = 0; r < 5; r++) {
            if (grid[r].join('').length === 5) {
                checkRowColors(r);
            }
        }
    }

    // INPUT TASTIERA
    document.addEventListener('keydown', (e) => {
        if (gameOver) return;
        const key = e.key.toUpperCase();
        if (key === 'ENTER') handleEnter();
        else if (key === 'BACKSPACE') handleDelete();
        else if (/^[A-Z]$/.test(key)) handleLetter(key);
    });

    window.handleVirtualKey = function(key) {
        if (gameOver) return;
        if (key === 'ENTER') handleEnter();
        else if (key === 'BACK') handleDelete();
        else handleLetter(key);
    };

    function handleLetter(letter) {
        if (currentCol < 5 && currentRow < 5) {
            grid[currentRow][currentCol] = letter;
            const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
            if (tile) tile.innerText = letter;
            currentCol++;
        }
    }

    function handleDelete() {
        if (currentCol > 0) {
            currentCol--;
            grid[currentRow][currentCol] = '';
            const tile = document.getElementById(`tile-${currentRow}-${currentCol}`);
            if (tile) tile.innerText = '';
        }
    }

    function handleEnter() {
        if (currentCol < 5) {
            shakeRow(currentRow);
            messageEl.innerText = "Inserisci tutte le 5 lettere!";
            return;
        }

        const currentGuess = grid[currentRow].join('');
        if (!dictionary.includes(currentGuess)) {
            shakeRow(currentRow);
            messageEl.innerText = "Parola non presente nel dizionario!";
            return;
        }

        checkRowColors(currentRow);

        if (currentGuess === targetWord) {
            gameOver = true;
            messageEl.innerText = "Complimenti! Hai indovinato!";
            registerWin();
            saveDailyState(true);
        } else if (currentRow === 4) {
            gameOver = true;
            messageEl.innerText = `Peccato! La parola era: ${targetWord}`;
            saveDailyState(false);
        } else {
            currentRow++;
            currentCol = 0;
            saveDailyState(false);
        }
    }

    // VALUTAZIONE COLORI (Tile e Tastiera)
    function checkRowColors(r) {
        const rowGuess = grid[r];
        const targetArr = targetWord.split('');
        const letterStates = Array(5).fill('absent');

        // Primo passaggio: Cerca Corrette (Verdi)
        for (let i = 0; i < 5; i++) {
            if (rowGuess[i] === targetArr[i]) {
                letterStates[i] = 'correct';
                targetArr[i] = null;
            }
        }

        // Secondo passaggio: Cerca Presenti (Gialle)
        for (let i = 0; i < 5; i++) {
            if (letterStates[i] !== 'correct') {
                const idx = targetArr.indexOf(rowGuess[i]);
                if (idx !== -1) {
                    letterStates[i] = 'present';
                    targetArr[idx] = null;
                }
            }
        }

        // Applica classi grafiche
        for (let i = 0; i < 5; i++) {
            const tile = document.getElementById(`tile-${r}-${i}`);
            if (tile) {
                tile.classList.add('flip');
                tile.classList.add(letterStates[i]);
            }
            updateKeyColor(rowGuess[i], letterStates[i]);
        }
    }

    function updateKeyColor(letter, state) {
        const keys = document.querySelectorAll('.key');
        keys.forEach(k => {
            if (k.innerText === letter) {
                if (state === 'correct') {
                    k.className = 'key correct';
                } else if (state === 'present' && !k.classList.contains('correct')) {
                    k.className = 'key present';
                } else if (state === 'absent' && !k.classList.contains('correct') && !k.classList.contains('present')) {
                    k.className = 'key absent';
                }
            }
        });
    }

    function resetKeyboardColors() {
        const keys = document.querySelectorAll('.key');
        keys.forEach(k => {
            if (k.classList.contains('large')) {
                k.className = 'key large';
            } else {
                k.className = 'key';
            }
        });
    }

    function shakeRow(r) {
        const rowEl = document.getElementById(`row-${r}`);
        if (rowEl) {
            rowEl.classList.add('shake');
            setTimeout(() => rowEl.classList.remove('shake'), 500);
        }
    }

    function saveDailyState(won) {
        if (currentMode === 'daily') {
            const data = {
                targetWord,
                grid,
                gameOver,
                won
            };
            localStorage.setItem(getDailyKey(), JSON.stringify(data));
        }
    }

    // PULSANTI AZIONE (Resa e Nuova Partita)
    if (btnGiveUp) {
        btnGiveUp.addEventListener('click', () => {
            if (!gameOver) {
                gameOver = true;
                messageEl.innerText = `Ti sei arreso! La parola era: ${targetWord}`;
                registerResign();
                saveDailyState(false);
            }
        });
    }

    if (btnNewGame) {
        btnNewGame.addEventListener('click', () => {
            if (currentMode === 'infinite') {
                startNewGame();
            } else {
                messageEl.innerText = "La modalità Giornaliera ha una sola parola al giorno!";
            }
        });
    }

    // SELETTORE MODALITÀ
    modeBtns.forEach(btn => {
        btn.addEventListener('click', (e) => {
            modeBtns.forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            currentMode = e.target.dataset.mode;
            startNewGame();
        });
    });

    // FUNZIONE DI CONDIVISIONE (Pulsante Condividi)
    window.shareResult = function() {
        const textToShare = `Ho giocato a Unwordle ITA! 🧩\nProva anche tu: ${SITE_URL}`;
        if (navigator.clipboard) {
            navigator.clipboard.writeText(textToShare).then(() => {
                alert("Risultato copiato negli appunti!");
            });
        } else {
            alert(textToShare);
        }
    };
});
let WORDS = [];
let targetWord = "";
let currentRow = 3;
let currentTile = 0;
let currentGuess = "";
let pattern = [];
let wordChain = [];
let gameEnded = false;
let gameMode = 'daily';

// --- GESTIONE STATISTICHE LIVE WIDGET ---
const giocatoriUnici = new Set();
let vittorieLive = 0;
let reseLive = 0;

function getPlayerID() {
    let id = localStorage.getItem('unwordle_player_id');
    if (!id) {
        id = 'user_' + Math.random().toString(36).substring(2, 9);
        localStorage.setItem('unwordle_player_id', id);
    }
    return id;
}

function aggiornaWidgetLive() {
    const totaliEl = document.getElementById('live-stat-totali');
    const vittorieEl = document.getElementById('live-stat-vittorie');
    const reseEl = document.getElementById('live-stat-rese');

    if (totaliEl) totaliEl.textContent = giocatoriUnici.size;
    if (vittorieEl) vittorieEl.textContent = vittorieLive;
    if (reseEl) reseEl.textContent = reseLive;
}

function registraVittoriaLive() {
    giocatoriUnici.add(getPlayerID());
    vittorieLive++;
    aggiornaWidgetLive();
}

function registraResaLive() {
    giocatoriUnici.add(getPlayerID());
    reseLive++;
    aggiornaWidgetLive();
}

// Inizializza l'utente unico al caricamento della pagina
giocatoriUnici.add(getPlayerID());

const CLUE_LIMITS = {
  0: { min: 2, max: 2 },
  1: { min: 2, max: 3 },
  2: { min: 3, max: 3 },
  3: { min: 3, max: 4 }
};

let stats = JSON.parse(localStorage.getItem('unwordle_stats')) || {
  played: 0,
  wins: 0,
  currentStreak: 0,
  maxStreak: 0
};

// Caricamento Dizionario e Avvio
fetch('dizionario.txt')
    .then(response => response.text())
    .then(data => {
        WORDS = data
            .split(/\r?\n/)
            .map(word => word.trim().toUpperCase())
            .filter(word => word.length === 5);

        setupEventListeners();
        openRulesModal(); // Mostra il pop-up delle regole all'inizio
        switchMode('daily');
        aggiornaWidgetLive(); // Inizializza i valori visivi del widget
    })
    .catch(error => console.error("Errore nel caricamento del dizionario:", error));

function setupEventListeners() {
    document.getElementById('giveup-btn').addEventListener('click', giveUp);
    document.getElementById('restart-btn').addEventListener('click', startNewGame);
    document.getElementById('share-btn').addEventListener('click', shareResult);
    
    document.getElementById('mode-daily').addEventListener('click', () => switchMode('daily'));
    document.getElementById('mode-unlimited').addEventListener('click', () => switchMode('unlimited'));

    // Modale Regole
    document.getElementById('close-rules-modal').addEventListener('click', closeRulesModal);
    document.getElementById('start-game-btn').addEventListener('click', closeRulesModal);

    // Modale Statistiche
    document.getElementById('stats-btn').addEventListener('click', openStatsModal);
    document.getElementById('close-stats-modal').addEventListener('click', closeStatsModal);

    // Modale Segnalazioni
    document.getElementById('report-btn').addEventListener('click', openReportModal);
    document.getElementById('close-report-modal').addEventListener('click', closeReportModal);
    document.getElementById('report-form').addEventListener('submit', sendReportEmail);

    // Modale Donazioni
    document.getElementById('donate-btn').addEventListener('click', openDonateModal);
    document.getElementById('close-donate-modal').addEventListener('click', closeDonateModal);

    // Clic fuori dalla finestra per chiudere
    window.addEventListener('click', (e) => {
        if (e.target === document.getElementById('rules-modal')) closeRulesModal();
        if (e.target === document.getElementById('stats-modal')) closeStatsModal();
        if (e.target === document.getElementById('report-modal')) closeReportModal();
        if (e.target === document.getElementById('donate-modal')) closeDonateModal();
    });
}

function getTodayString() {
    const today = new Date();
    return `${today.getFullYear()}-${today.getMonth() + 1}-${today.getDate()}`;
}

function seededRandom(seedStr) {
    let hash = 0;
    for (let i = 0; i < seedStr.length; i++) {
        hash = (hash << 5) - hash + seedStr.charCodeAt(i);
        hash |= 0;
    }
    return function() {
        let x = Math.sin(hash++) * 10000;
        return x - Math.floor(x);
    };
}

function switchMode(mode) {
    gameMode = mode;
    
    const dailyBtn = document.getElementById('mode-daily');
    const unlimitedBtn = document.getElementById('mode-unlimited');
    const subtitle = document.getElementById('game-subtitle');

    if (mode === 'daily') {
        dailyBtn.classList.add('active');
        unlimitedBtn.classList.remove('active');
        subtitle.textContent = "Ricostruisci la griglia del giorno!";
        
        const dailyPlayed = localStorage.getItem(`unwordle_daily_${getTodayString()}`);
        if (dailyPlayed) {
            loadDailyState(JSON.parse(dailyPlayed));
            return;
        }
    } else {
        unlimitedBtn.classList.add('active');
        dailyBtn.classList.remove('active');
        subtitle.textContent = "Modalità infinita: gioca quante volte vuoi!";
    }

    startNewGame();
}

function startNewGame() {
    generateValidGameChain();
    initBoard();
    resetKeyboard();
    fillTargetRow();
    
    currentRow = 3;
    currentTile = 0;
    currentGuess = "";
    gameEnded = false;
    
    document.getElementById('message').textContent = "";
    document.getElementById('share-btn').style.display = 'none';
    
    if (gameMode === 'daily') {
        document.getElementById('restart-btn').style.display = 'none';
        document.getElementById('giveup-btn').style.display = 'block';
    } else {
        document.getElementById('restart-btn').style.display = 'block';
        document.getElementById('giveup-btn').style.display = 'block';
    }
}

function generateValidGameChain() {
    let rng = Math.random;
    
    if (gameMode === 'daily') {
        const seed = getTodayString();
        rng = seededRandom(seed);
    }

    let attempts = 0;
    let found = false;

    while (!found && attempts < 2000) {
        attempts++;
        wordChain = new Array(5);
        
        let baseWord = WORDS[Math.floor(rng() * WORDS.length)];
        wordChain[4] = baseWord;

        let validChain = true;

        for (let r = 0; r < 4; r++) {
            let candidates = WORDS.filter(w => {
                if (w === baseWord) return false;
                let colors = calculateRowColors(w, baseWord);
                return isValidRowProgression(colors, r);
            });

            if (candidates.length === 0) {
                validChain = false;
                break;
            }

            wordChain[r] = candidates[Math.floor(rng() * candidates.length)];
        }

        if (validChain) {
            found = true;
        }
    }

    targetWord = wordChain[4];
    
    pattern = [];
    for (let r = 0; r < 5; r++) {
        pattern.push(calculateRowColors(wordChain[r], targetWord));
    }
}

function loadDailyState(savedState) {
    wordChain = savedState.wordChain;
    targetWord = savedState.targetWord;
    pattern = savedState.pattern;
    gameEnded = true;

    initBoard();
    fillTargetRow();

    const rows = document.querySelectorAll('.row');
    for (let r = 0; r < 4; r++) {
        const tiles = rows[r].querySelectorAll('.tile');
        const word = savedState.wordChain[r];
        for (let i = 0; i < 5; i++) {
            tiles[i].textContent = word[i];
        }
        updateKeyboard(word, pattern[r]);
    }

    document.getElementById('giveup-btn').style.display = 'none';
    document.getElementById('restart-btn').style.display = 'none';
    document.getElementById('share-btn').style.display = 'block';
    
    if (savedState.isWin) {
        document.getElementById('message').textContent = "Hai già completato la sfida giornaliera con successo!";
    } else {
        document.getElementById('message').textContent = "Hai già giocato la sfida giornaliera di oggi.";
    }
}

function resetKeyboard() {
    document.querySelectorAll('.key').forEach(key => {
        key.classList.remove('correct', 'present', 'absent');
    });
}

function updateKeyboard(guess, rowColors) {
    for (let i = 0; i < 5; i++) {
        const letter = guess[i];
        const colorCode = rowColors[i];
        const keyElement = document.querySelector(`.key[data-key="${letter}"]`);

        if (!keyElement) continue;

        if (colorCode === 2) {
            keyElement.classList.remove('present', 'absent');
            keyElement.classList.add('correct');
        } else if (colorCode === 1) {
            if (!keyElement.classList.contains('correct')) {
                keyElement.classList.remove('absent');
                keyElement.classList.add('present');
            }
        } else if (colorCode === 0) {
            if (!keyElement.classList.contains('correct') && !keyElement.classList.contains('present')) {
                keyElement.classList.add('absent');
            }
        }
    }
}

function triggerShake(rowElement) {
    rowElement.classList.add('shake');
    rowElement.addEventListener('animationend', () => {
        rowElement.classList.remove('shake');
    }, { once: true });
}

function isValidRowProgression(rowColors, rowIndex) {
    const coloredCount = rowColors.filter(code => code > 0).length;
    const greenCount = rowColors.filter(code => code === 2).length;
    const limits = CLUE_LIMITS[rowIndex];

    if (rowIndex === 2 && greenCount < 1) return false;
    if (rowIndex === 3 && greenCount < 2) return false;

    return coloredCount >= limits.min && coloredCount <= limits.max;
}

function calculateRowColors(guess, target) {
    let rowColor = [0, 0, 0, 0, 0];
    let targetArr = target.split('');
    let guessArr = guess.split('');

    for (let i = 0; i < 5; i++) {
        if (guessArr[i] === targetArr[i]) {
            rowColor[i] = 2;
            targetArr[i] = null;
            guessArr[i] = null;
        }
    }

    for (let i = 0; i < 5; i++) {
        if (guessArr[i] !== null) {
            let index = targetArr.indexOf(guessArr[i]);
            if (index !== -1) {
                rowColor[i] = 1;
                targetArr[index] = null;
            }
        }
    }

    return rowColor;
}

function initBoard() {
    const rows = document.querySelectorAll('.row');
    rows.forEach((row, rowIndex) => {
        const tiles = row.querySelectorAll('.tile');
        tiles.forEach((tile, tileIndex) => {
            tile.textContent = '';
            tile.className = 'tile';
            tile.style.animationDelay = '0ms';
            
            const colorCode = pattern[rowIndex][tileIndex];
            if (colorCode === 2) tile.classList.add('correct');
            else if (colorCode === 1) tile.classList.add('present');
            else if (colorCode === 0) tile.classList.add('absent');
        });
    });
}

function fillTargetRow() {
    const lastRow = document.querySelectorAll('.row')[4];
    const tiles = lastRow.querySelectorAll('.tile');
    for (let i = 0; i < 5; i++) {
        tiles[i].textContent = targetWord[i];
    }
    updateKeyboard(targetWord, [2, 2, 2, 2, 2]);
}

function isAnyModalOpen() {
    return (document.getElementById('report-modal').style.display === 'flex') || 
           (document.getElementById('donate-modal').style.display === 'flex') || 
           (document.getElementById('stats-modal').style.display === 'flex') ||
           (document.getElementById('rules-modal').style.display === 'flex');
}

// Input Tastiera Fisica
document.addEventListener('keydown', (e) => {
    if (isAnyModalOpen()) return;

    const key = e.key.toUpperCase();
    if (key === 'ENTER') submitGuess();
    else if (key === 'BACKSPACE') removeLetter();
    else if (/^[A-Z]$/.test(key)) addLetter(key);
});

// Input Tastiera Virtuale
document.querySelectorAll('.key').forEach(key => {
    key.addEventListener('click', () => {
        if (isAnyModalOpen()) return;

        const letter = key.getAttribute('data-key');
        if (letter === 'ENTER') submitGuess();
        else if (letter === 'BACKSPACE') removeLetter();
        else addLetter(letter);
    });
});

function addLetter(letter) {
    if (currentTile < 5 && currentRow >= 0 && !gameEnded) {
        const row = document.querySelectorAll('.row')[currentRow];
        const tile = row.querySelectorAll('.tile')[currentTile];
        tile.textContent = letter;
        currentGuess += letter;
        currentTile++;
    }
}

function removeLetter() {
    if (gameEnded) return;

    if (currentTile > 0 && currentRow >= 0) {
        currentTile--;
        const row = document.querySelectorAll('.row')[currentRow];
        const tile = row.querySelectorAll('.tile')[currentTile];
        tile.textContent = '';
        currentGuess = currentGuess.slice(0, -1);
    } 
    else if (currentTile === 0 && currentRow < 3) {
        currentRow++;
        const row = document.querySelectorAll('.row')[currentRow];
        const tiles = row.querySelectorAll('.tile');
        
        tiles.forEach(tile => {
            tile.textContent = '';
            tile.classList.remove('flip');
        });
        
        currentTile = 0;
        currentGuess = "";
        document.getElementById('message').textContent = "";
    }
}

function submitGuess() {
    if (currentRow < 0 || gameEnded) return;

    const row = document.querySelectorAll('.row')[currentRow];

    if (currentGuess.length !== 5) {
        document.getElementById('message').textContent = "Inserisci 5 lettere!";
        triggerShake(row);
        return;
    }

    if (!WORDS.includes(currentGuess)) {
        document.getElementById('message').textContent = "Parola non presente nel dizionario!";
        triggerShake(row);
        return;
    }

    const rowPattern = pattern[currentRow];
    const currentGeneratedColors = calculateRowColors(currentGuess, targetWord);

    let isValid = true;
    for (let i = 0; i < 5; i++) {
        if (currentGeneratedColors[i] !== rowPattern[i]) {
            isValid = false;
            break;
        }
    }

    if (!isValid) {
        document.getElementById('message').textContent = "La parola non rispetta i colori della griglia!";
        triggerShake(row);
        return;
    }

    const tiles = row.querySelectorAll('.tile');
    tiles.forEach((tile, index) => {
        tile.style.animationDelay = `${index * 100}ms`;
        tile.classList.add('flip');
    });

    updateKeyboard(currentGuess, currentGeneratedColors);

    document.getElementById('message').textContent = "";
    currentRow--;
    currentTile = 0;
    currentGuess = "";

    if (currentRow < 0) {
        document.getElementById('message').textContent = "Complimenti! Hai completato la griglia!";
        document.getElementById('giveup-btn').style.display = 'none';
        document.getElementById('share-btn').style.display = 'block';
        
        if (gameMode === 'unlimited') {
            document.getElementById('restart-btn').style.display = 'block';
        }
        
        recordGameResult(true);
    }
}

function giveUp() {
    if (currentRow < 0 || gameEnded) return;

    const rows = document.querySelectorAll('.row');
    
    for (let r = 0; r < 4; r++) {
        const tiles = rows[r].querySelectorAll('.tile');
        const word = wordChain[r];
        
        for (let i = 0; i < 5; i++) {
            tiles[i].textContent = word[i];
        }
    }

    currentRow = -1;
    document.getElementById('message').textContent = "Ti sei arreso! Ecco una delle possibili soluzioni.";

    document.getElementById('giveup-btn').style.display = 'none';
    document.getElementById('share-btn').style.display = 'block';
    
    if (gameMode === 'unlimited') {
        document.getElementById('restart-btn').style.display = 'block';
    }

    recordGameResult(false);
}

function recordGameResult(isWin) {
    if (gameEnded) return;
    gameEnded = true;

    stats.played++;
    if (isWin) {
        stats.wins++;
        stats.currentStreak++;
        if (stats.currentStreak > stats.maxStreak) {
            stats.maxStreak = stats.currentStreak;
        }
        registraVittoriaLive(); // Incrementa vittorie nel widget
    } else {
        stats.currentStreak = 0;
        registraResaLive(); // Incrementa rese nel widget
    }

    localStorage.setItem('unwordle_stats', JSON.stringify(stats));

    if (gameMode === 'daily') {
        const dailyData = {
            isWin: isWin,
            wordChain: wordChain,
            targetWord: targetWord,
            pattern: pattern
        };
        localStorage.setItem(`unwordle_daily_${getTodayString()}`, JSON.stringify(dailyData));
    }
}

// Condivisione Risultati
function generateShareText() {
    let emojiGrid = "";
    const colorEmojis = { 0: "⬛", 1: "🟨", 2: "🟩" };

    for (let r = 0; r < 5; r++) {
        emojiGrid += pattern[r].map(code => colorEmojis[code]).join('') + "\n";
    }

    const modeText = gameMode === 'daily' ? `Giornaliero (${getTodayString()})` : 'Infinito';
    return `Unwordle ITA - ${modeText}\n\n${emojiGrid}\nGioca su: https://alessiobaldacci12-it.github.io/unwordle-ita/`;
}

function shareResult() {
    const textToShare = generateShareText();

    if (navigator.share) {
        navigator.share({
            title: 'Unwordle ITA',
            text: textToShare
        }).catch(() => {});
    } else {
        navigator.clipboard.writeText(textToShare).then(() => {
            document.getElementById('message').textContent = "Risultato copiato negli appunti! 📋";
        });
    }
}

// Gestione Modali
function openRulesModal() {
    document.getElementById('rules-modal').style.display = 'flex';
}

function closeRulesModal() {
    document.getElementById('rules-modal').style.display = 'none';
}

function openStatsModal() {
    document.getElementById('stat-played').textContent = stats.played;
    const winRate = stats.played > 0 ? Math.round((stats.wins / stats.played) * 100) : 0;
    document.getElementById('stat-winrate').textContent = `${winRate}%`;
    document.getElementById('stat-streak').textContent = stats.currentStreak;
    document.getElementById('stat-max-streak').textContent = stats.maxStreak;
    document.getElementById('stats-modal').style.display = 'flex';
}

function closeStatsModal() {
    document.getElementById('stats-modal').style.display = 'none';
}

function openReportModal() {
    document.getElementById('report-word').value = currentGuess.length === 5 ? currentGuess : '';
    document.getElementById('report-modal').style.display = 'flex';
}

function closeReportModal() {
    document.getElementById('report-modal').style.display = 'none';
    document.getElementById('report-form').reset();
}

function openDonateModal() {
    document.getElementById('donate-modal').style.display = 'flex';
}

function closeDonateModal() {
    document.getElementById('donate-modal').style.display = 'none';
}

function sendReportEmail(e) {
    e.preventDefault();

    const reportType = document.querySelector('input[name="reportType"]:checked').value;
    const word = document.getElementById('report-word').value.trim().toUpperCase();
    const notes = document.getElementById('report-notes').value.trim();

    const typeText = reportType === 'add' ? 'PAROLA MANCANTE (Da aggiungere)' : 'PAROLA ERRATA (Da rimuovere)';
    
    const email = "alessiobaldacci12@gmail.com";
    const subject = encodeURIComponent(`[Unwordle ITA] Segnalazione Parola: ${word}`);
    const body = encodeURIComponent(
        `Tipo di segnalazione: ${typeText}\n` +
        `Parola: ${word}\n` +
        `Note / Definizione: ${notes || 'Nessuna nota aggiuntiva'}`
    );

    window.location.href = `mailto:${email}?subject=${subject}&body=${body}`;
    
    closeReportModal();
}
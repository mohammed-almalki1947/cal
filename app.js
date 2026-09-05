/**
 * Trix & Complex Scoreboard - Application Engine
 * Pure Vanilla JavaScript implementation with full state management & LocalStorage persistence.
 */

// Global State
const state = {
  playerCount: 4, // 3 or 4
  players: [
    { id: 1, name: 'لاعب 1', totalScore: 0, input: { queens: 0, king: 0, kingDouble: false, diamonds: 0, tricks: 0, trixRank: null } },
    { id: 2, name: 'لاعب 2', totalScore: 0, input: { queens: 0, king: 0, kingDouble: false, diamonds: 0, tricks: 0, trixRank: null } },
    { id: 3, name: 'لاعب 3', totalScore: 0, input: { queens: 0, king: 0, kingDouble: false, diamonds: 0, tricks: 0, trixRank: null } },
    { id: 4, name: 'لاعب 4', totalScore: 0, input: { queens: 0, king: 0, kingDouble: false, diamonds: 0, tricks: 0, trixRank: null } }
  ],
  history: []
};

// Trix Rank Config
const TRIX_RANKS = [
  { rank: 1, label: 'الأول', points: 200 },
  { rank: 2, label: 'الثاني', points: 150 },
  { rank: 3, label: 'الثالث', points: 100 },
  { rank: 4, label: 'الرابع', points: 50 }
];

// DOM Element References
const playersGrid = document.getElementById('playersGrid');
const playerModeToggle = document.getElementById('playerModeToggle');
const btnSubmitRound = document.getElementById('btnSubmitRound');
const btnClearRound = document.getElementById('btnClearRound');
const btnEndMatch = document.getElementById('btnEndMatch');
const btnHeaderReset = document.getElementById('btnHeaderReset');
const btnUndoRound = document.getElementById('btnUndoRound');

// Modal Elements - Reset Modal
const resetModalBackdrop = document.getElementById('resetModalBackdrop');
const btnCancelReset = document.getElementById('btnCancelReset');
const btnConfirmReset = document.getElementById('btnConfirmReset');

// Modal Elements - End Match Modal
const endMatchModalBackdrop = document.getElementById('endMatchModalBackdrop');
const leaderboardList = document.getElementById('leaderboardList');
const btnCloseEndMatch = document.getElementById('btnCloseEndMatch');
const btnNewMatchFromEnd = document.getElementById('btnNewMatchFromEnd');

// History Log Elements
const historySection = document.getElementById('historySection');
const historyHeader = document.getElementById('historyHeader');
const historyToggleBtn = document.getElementById('historyToggleBtn');
const historyContent = document.getElementById('historyContent');
const historyTableHeader = document.getElementById('historyTableHeader');
const historyTableBody = document.getElementById('historyTableBody');
const historyEmpty = document.getElementById('historyEmpty');
const roundCountEl = document.getElementById('roundCount');
const toastEl = document.getElementById('toast');

// ==========================================================================
// Initialisation & Event Wiring
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  loadSavedState();
  renderBoard();
  setupEventListeners();
});

function setupEventListeners() {
  // Mode Selector (3 or 4 players)
  playerModeToggle.addEventListener('click', (e) => {
    const btn = e.target.closest('.mode-btn');
    if (!btn) return;

    const count = parseInt(btn.dataset.players, 10);
    if (count === state.playerCount) return;

    setPlayerCount(count);
  });

  // Action Bar Buttons
  btnSubmitRound.addEventListener('click', submitRound);
  btnClearRound.addEventListener('click', clearCurrentInputs);
  btnUndoRound.addEventListener('click', undoLastRound);
  btnEndMatch.addEventListener('click', openEndMatchModal);

  // Reset Modal Trigger
  btnHeaderReset.addEventListener('click', openResetModal);
  btnCancelReset.addEventListener('click', closeResetModal);
  btnConfirmReset.addEventListener('click', confirmResetAll);

  // End Match Modal Controls
  btnCloseEndMatch.addEventListener('click', closeEndMatchModal);
  btnNewMatchFromEnd.addEventListener('click', () => {
    closeEndMatchModal();
    openResetModal();
  });

  // Close modals on backdrop click
  resetModalBackdrop.addEventListener('click', (e) => {
    if (e.target === resetModalBackdrop) closeResetModal();
  });
  endMatchModalBackdrop.addEventListener('click', (e) => {
    if (e.target === endMatchModalBackdrop) closeEndMatchModal();
  });

  // History Drawer Toggle
  historyHeader.addEventListener('click', () => {
    historySection.classList.toggle('expanded');
    historyContent.classList.toggle('hidden');
  });
}

// ==========================================================================
// Core State Functions
// ==========================================================================

function setPlayerCount(count) {
  state.playerCount = count;
  
  // Update toggle UI
  const buttons = playerModeToggle.querySelectorAll('.mode-btn');
  buttons.forEach(b => {
    b.classList.toggle('active', parseInt(b.dataset.players, 10) === count);
  });

  // If switching to 3 players, clear player 4's rank if selected
  if (count === 3 && state.players[3]) {
    state.players[3].input.trixRank = null;
  }

  saveState();
  renderBoard();
  renderHistory();
}

// Helper to calculate round score for a given player input
function calculatePlayerRoundScore(input) {
  const queensPoints = input.queens * -25;
  const kingValue = input.kingDouble ? -150 : -75;
  const kingPoints = input.king * kingValue;

  const diamondsPoints = input.diamonds * -10;
  const tricksPoints = input.tricks * -10;
  
  let trixPoints = 0;
  if (input.trixRank) {
    const rankObj = TRIX_RANKS.find(r => r.rank === input.trixRank);
    if (rankObj) trixPoints = rankObj.points;
  }

  return queensPoints + kingPoints + diamondsPoints + tricksPoints + trixPoints;
}

// Find which OTHER player has taken a rank (returns player object or null)
function getOtherPlayerHoldingRank(rank, currentPlayerId) {
  const activePlayers = state.players.slice(0, state.playerCount);
  return activePlayers.find(p => p.id !== currentPlayerId && p.input.trixRank === rank) || null;
}

// ==========================================================================
// Rendering Engine
// ==========================================================================

function renderBoard() {
  playersGrid.innerHTML = '';
  playersGrid.className = `players-grid mode-${state.playerCount}-players`;

  const activePlayers = state.players.slice(0, state.playerCount);

  activePlayers.forEach((player) => {
    const roundScore = calculatePlayerRoundScore(player.input);
    const col = createPlayerColumnDOM(player, roundScore);
    playersGrid.appendChild(col);
  });

  // Enable/Disable Undo Button based on history length
  btnUndoRound.disabled = state.history.length === 0;

  renderHistory();
}

function createPlayerColumnDOM(player, roundScore) {
  const column = document.createElement('div');
  column.className = 'player-column';
  column.dataset.playerId = player.id;

  // Classify main total score color
  let scoreClass = 'zero';
  if (player.totalScore > 0) scoreClass = 'positive';
  else if (player.totalScore < 0) scoreClass = 'negative';

  // Format round preview badge string
  let previewText = '0';
  let previewClass = 'neutral';
  if (roundScore > 0) {
    previewText = `+${roundScore}`;
    previewClass = 'positive';
  } else if (roundScore < 0) {
    previewText = `${roundScore}`;
    previewClass = 'negative';
  }

  // Trix ranks to display based on player count
  const availableRanks = TRIX_RANKS.slice(0, state.playerCount);
  const kingValue = player.input.kingDouble ? -150 : -75;

  column.innerHTML = `
    <!-- Player Name Header -->
    <div class="player-header">
      <div class="player-name-wrapper">
        <input 
          type="text" 
          class="player-name-input" 
          value="${escapeHtml(player.name)}" 
          placeholder="اسم اللاعب" 
          aria-label="اسم اللاعب"
        />
      </div>
    </div>

    <!-- Main Score Card -->
    <div class="total-score-card">
      <span class="score-label">المجموع الحالي</span>
      <div class="score-value ${scoreClass}">${player.totalScore}</div>
      <div class="round-preview-badge ${previewClass}">الجولة الحالية: ${previewText}</div>
    </div>

    <!-- 5 Contract Inputs List -->
    <div class="contract-list">
      <!-- 1. البنات (-25) -->
      <div class="contract-item">
        <div class="contract-item-header">
          <div class="contract-title-group">
            <span class="contract-icon icon-queens">👑</span>
            <div>
              <span class="contract-name">البنات</span>
              <span class="contract-multiplier">(-25)</span>
            </div>
          </div>
          <span class="contract-score-tag ${player.input.queens > 0 ? 'active-negative' : ''}">
            ${player.input.queens * -25}
          </span>
        </div>
        <div class="counter-control">
          <button type="button" class="counter-btn" data-action="dec" data-contract="queens" ${player.input.queens <= 0 ? 'disabled' : ''}>−</button>
          <span class="counter-value ${player.input.queens > 0 ? 'has-value' : ''}">${player.input.queens}</span>
          <button type="button" class="counter-btn" data-action="inc" data-contract="queens" ${player.input.queens >= 4 ? 'disabled' : ''}>+</button>
        </div>
      </div>

      <!-- 2. شايب الهاص (-75 أو -150 دبل) -->
      <div class="contract-item">
        <div class="contract-item-header">
          <div class="contract-title-group">
            <span class="contract-icon icon-king">♥️</span>
            <div>
              <span class="contract-name">شايب الهاص</span>
              <span class="contract-multiplier">(${kingValue})</span>
            </div>
          </div>
          <span class="contract-score-tag ${player.input.king > 0 ? 'active-negative' : ''}">
            ${player.input.king * kingValue}
          </span>
        </div>
        
        <div class="king-controls-wrapper">
          <button type="button" class="king-toggle-btn ${player.input.king === 1 ? 'active' : ''}" data-action="toggle-king">
            ${player.input.king === 1 ? `✓ تم الأكل (${kingValue})` : 'لم يأكل (0)'}
          </button>
          
          <button type="button" class="double-toggle-btn ${player.input.kingDouble ? 'active' : ''}" data-action="toggle-king-double" title="تفعيل الدبل (-150 نقطة)">
            ${player.input.kingDouble ? '⚡ دبل x2' : 'دبل x2'}
          </button>
        </div>
      </div>

      <!-- 3. الديمن (-10) -->
      <div class="contract-item">
        <div class="contract-item-header">
          <div class="contract-title-group">
            <span class="contract-icon icon-diamonds">♦️</span>
            <div>
              <span class="contract-name">الديمن</span>
              <span class="contract-multiplier">(-10)</span>
            </div>
          </div>
          <span class="contract-score-tag ${player.input.diamonds > 0 ? 'active-negative' : ''}">
            ${player.input.diamonds * -10}
          </span>
        </div>
        <div class="counter-control">
          <button type="button" class="counter-btn" data-action="dec" data-contract="diamonds" ${player.input.diamonds <= 0 ? 'disabled' : ''}>−</button>
          <span class="counter-value ${player.input.diamonds > 0 ? 'has-value' : ''}">${player.input.diamonds}</span>
          <button type="button" class="counter-btn" data-action="inc" data-contract="diamonds" ${player.input.diamonds >= 13 ? 'disabled' : ''}>+</button>
        </div>
      </div>

      <!-- 4. الأكلات (-10) -->
      <div class="contract-item">
        <div class="contract-item-header">
          <div class="contract-title-group">
            <span class="contract-icon icon-tricks">🃏</span>
            <div>
              <span class="contract-name">الأكلات</span>
              <span class="contract-multiplier">(-10)</span>
            </div>
          </div>
          <span class="contract-score-tag ${player.input.tricks > 0 ? 'active-negative' : ''}">
            ${player.input.tricks * -10}
          </span>
        </div>
        <div class="counter-control">
          <button type="button" class="counter-btn" data-action="dec" data-contract="tricks" ${player.input.tricks <= 0 ? 'disabled' : ''}>−</button>
          <span class="counter-value ${player.input.tricks > 0 ? 'has-value' : ''}">${player.input.tricks}</span>
          <button type="button" class="counter-btn" data-action="inc" data-contract="tricks" ${player.input.tricks >= 13 ? 'disabled' : ''}>+</button>
        </div>
      </div>

      <!-- 5. التريكس (المراكز) -->
      <div class="contract-item">
        <div class="contract-item-header">
          <div class="contract-title-group">
            <span class="contract-icon icon-trix">🏆</span>
            <div>
              <span class="contract-name">التريكس</span>
              <span class="contract-multiplier">(مراكز)</span>
            </div>
          </div>
          <span class="contract-score-tag ${player.input.trixRank ? 'active-positive' : ''}">
            ${player.input.trixRank ? '+' + (TRIX_RANKS.find(r => r.rank === player.input.trixRank)?.points || 0) : '0'}
          </span>
        </div>

        <div class="trix-ranks-grid">
          ${availableRanks.map(r => {
            const isSelected = player.input.trixRank === r.rank;
            const holdingPlayer = getOtherPlayerHoldingRank(r.rank, player.id);
            const isTakenByOther = holdingPlayer !== null;

            return `
              <button 
                type="button" 
                class="rank-btn ${isSelected ? 'selected' : ''} ${isTakenByOther ? 'taken-by-other' : ''}" 
                data-action="select-rank" 
                data-rank="${r.rank}"
                ${isTakenByOther ? `title="محجوز لـ ${escapeHtml(holdingPlayer.name)}"` : ''}
              >
                <span>${r.label}</span>
                <span class="rank-pts">+${r.points}</span>
                ${isTakenByOther ? `<span class="taken-tag">${escapeHtml(holdingPlayer.name)}</span>` : ''}
              </button>
            `;
          }).join('')}
        </div>
      </div>
    </div>
  `;

  // Attach Event Listeners to column elements
  const nameInput = column.querySelector('.player-name-input');
  nameInput.addEventListener('change', (e) => {
    player.name = e.target.value.trim() || `لاعب ${player.id}`;
    saveState();
    renderHistory();
  });

  // Counter Buttons Event Listener
  column.querySelectorAll('.counter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const action = btn.dataset.action;
      const contract = btn.dataset.contract;
      if (!contract) return;

      if (action === 'inc') {
        const max = contract === 'queens' ? 4 : 13;
        if (player.input[contract] < max) player.input[contract]++;
      } else if (action === 'dec') {
        if (player.input[contract] > 0) player.input[contract]--;
      }

      saveState();
      renderBoard();
    });
  });

  // King Toggle Button Listener
  const kingBtn = column.querySelector('.king-toggle-btn');
  if (kingBtn) {
    kingBtn.addEventListener('click', () => {
      player.input.king = player.input.king === 1 ? 0 : 1;
      saveState();
      renderBoard();
    });
  }

  // King Double Toggle Button Listener
  const kingDoubleBtn = column.querySelector('.double-toggle-btn');
  if (kingDoubleBtn) {
    kingDoubleBtn.addEventListener('click', () => {
      player.input.kingDouble = !player.input.kingDouble;
      saveState();
      renderBoard();
    });
  }

  // Trix Rank Selection Listener
  column.querySelectorAll('.rank-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const rank = parseInt(btn.dataset.rank, 10);
      const holdingPlayer = getOtherPlayerHoldingRank(rank, player.id);

      // If taken by another player, notify user
      if (holdingPlayer) {
        showToast(`المركز (${TRIX_RANKS.find(r=>r.rank===rank)?.label}) محجوز لـ ${holdingPlayer.name}`);
        return;
      }

      // If already selected by THIS player, deselect it
      if (player.input.trixRank === rank) {
        player.input.trixRank = null;
      } else {
        // Otherwise, set rank for THIS player (freely switching from previous selection)
        player.input.trixRank = rank;
      }

      saveState();
      renderBoard();
    });
  });

  return column;
}

// ==========================================================================
// Actions & Round Submission
// ==========================================================================

function submitRound() {
  const activePlayers = state.players.slice(0, state.playerCount);

  // Snapshot round result
  const roundSnapshot = {
    roundNumber: state.history.length + 1,
    timestamp: new Date().toISOString(),
    scores: {}
  };

  activePlayers.forEach(p => {
    const rScore = calculatePlayerRoundScore(p.input);
    p.totalScore += rScore;
    roundSnapshot.scores[p.id] = rScore;

    // Clear input counters for next round
    p.input = { queens: 0, king: 0, kingDouble: false, diamonds: 0, tricks: 0, trixRank: null };
  });

  state.history.push(roundSnapshot);

  saveState();
  renderBoard();
  showToast(`تم تسجيل الجولة رقم ${roundSnapshot.roundNumber} بنجاح!`);
}

function clearCurrentInputs() {
  state.players.forEach(p => {
    p.input = { queens: 0, king: 0, kingDouble: false, diamonds: 0, tricks: 0, trixRank: null };
  });
  saveState();
  renderBoard();
  showToast('تم مسح الإدخالات الحالية');
}

function undoLastRound() {
  if (state.history.length === 0) return;

  const lastRound = state.history.pop();
  
  // Deduct scores from players
  state.players.forEach(p => {
    if (lastRound.scores[p.id] !== undefined) {
      p.totalScore -= lastRound.scores[p.id];
    }
  });

  saveState();
  renderBoard();
  showToast(`تم التراجع عن الجولة رقم ${lastRound.roundNumber}`);
}

// ==========================================================================
// Modal Engines (Reset & End Match Leaderboard)
// ==========================================================================

function openResetModal() {
  resetModalBackdrop.classList.remove('hidden');
}

function closeResetModal() {
  resetModalBackdrop.classList.add('hidden');
}

function confirmResetAll() {
  state.players.forEach((p, idx) => {
    p.name = `لاعب ${idx + 1}`;
    p.totalScore = 0;
    p.input = { queens: 0, king: 0, kingDouble: false, diamonds: 0, tricks: 0, trixRank: null };
  });

  state.history = [];

  closeResetModal();
  saveState();
  renderBoard();
  showToast('تم تصفير جميع البيانات والنتائج');
}

// End of Match Modal (نهاية الصكة)
function openEndMatchModal() {
  const activePlayers = state.players.slice(0, state.playerCount);
  
  // Sort players by total score descending
  const sortedPlayers = [...activePlayers].sort((a, b) => b.totalScore - a.totalScore);

  const rankBadges = ['🥇', '🥈', '🥉', '🏅'];

  leaderboardList.innerHTML = sortedPlayers.map((player, index) => {
    const badge = rankBadges[index] || '🏅';
    const scoreCls = player.totalScore > 0 ? 'pos' : (player.totalScore < 0 ? 'neg' : '');
    const formattedScore = player.totalScore > 0 ? `+${player.totalScore}` : `${player.totalScore}`;

    return `
      <div class="leaderboard-item rank-${index + 1}">
        <div class="leaderboard-left">
          <span class="leaderboard-rank-icon">${badge}</span>
          <span class="leaderboard-player-name">${escapeHtml(player.name)}</span>
        </div>
        <span class="leaderboard-score ${scoreCls}">${formattedScore} نقطة</span>
      </div>
    `;
  }).join('');

  endMatchModalBackdrop.classList.remove('hidden');
}

function closeEndMatchModal() {
  endMatchModalBackdrop.classList.add('hidden');
}

// ==========================================================================
// History Log Rendering
// ==========================================================================

function renderHistory() {
  const activePlayers = state.players.slice(0, state.playerCount);
  roundCountEl.textContent = state.history.length;

  // Header columns
  historyTableHeader.innerHTML = `
    <th>الجولة</th>
    ${activePlayers.map(p => `<th>${escapeHtml(p.name)}</th>`).join('')}
  `;

  if (state.history.length === 0) {
    historyTableBody.innerHTML = '';
    historyEmpty.style.display = 'block';
    return;
  }

  historyEmpty.style.display = 'none';
  historyTableBody.innerHTML = state.history.map((round) => {
    return `
      <tr>
        <td><strong>#${round.roundNumber}</strong></td>
        ${activePlayers.map(p => {
          const score = round.scores[p.id] || 0;
          const cls = score > 0 ? 'pos' : (score < 0 ? 'neg' : '');
          const formatted = score > 0 ? `+${score}` : `${score}`;
          return `<td class="${cls}">${formatted}</td>`;
        }).join('')}
      </tr>
    `;
  }).join('');
}

// ==========================================================================
// Helpers & LocalStorage Utilities
// ==========================================================================

function showToast(msg) {
  toastEl.textContent = msg;
  toastEl.classList.remove('hidden');

  setTimeout(() => {
    toastEl.classList.add('hidden');
  }, 2500);
}

function escapeHtml(str) {
  return str.replace(/[&<>"']/g, (m) => {
    return {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#039;'
    }[m];
  });
}

function saveState() {
  try {
    localStorage.setItem('trix_app_state', JSON.stringify(state));
  } catch (e) {
    console.error('LocalStorage write failed:', e);
  }
}

function loadSavedState() {
  try {
    const raw = localStorage.getItem('trix_app_state');
    if (raw) {
      const parsed = JSON.parse(raw);
      if (parsed.players && Array.isArray(parsed.players)) {
        state.playerCount = parsed.playerCount || 4;
        state.players = parsed.players.map(p => {
          return {
            ...p,
            input: {
              queens: p.input?.queens || 0,
              king: p.input?.king || 0,
              kingDouble: p.input?.kingDouble || false,
              diamonds: p.input?.diamonds || 0,
              tricks: p.input?.tricks || 0,
              trixRank: p.input?.trixRank || null
            }
          };
        });
        state.history = parsed.history || [];
      }
    }
  } catch (e) {
    console.error('LocalStorage read failed:', e);
  }
}

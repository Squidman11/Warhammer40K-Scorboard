// =========================================================================
// 1. GLOBAL STATE & REGISTRY ARCHITECTURE
// =========================================================================
let isRestoringState = false; // Latch flag to block race condition overwrites
let currentRound = 1;
let currentPhaseIndex = 0;
let activePlayerIndex = 0;    // Tracks array index position of player whose turn it is

let players = [];             // Dynamic array collection holding active player schemas
let playerActiveCards = {};   // Dynamic lookup dictionary for tactical card hands

// 🛑 CHANGE THIS FROM TRUE TO FALSE:
let teamsEnabled = false; // Set to true for Team Alpha vs Beta, or false for Free-For-All
let currentTeams = ["team_a", "team_b"]; 

// A color-coded registry to give your custom teams distinct sci-fi themes
const teamRegistry = {
    team_a: { name: "Team Alpha", color: "#00f0ff" },
    team_b: { name: "Team Beta", color: "#ff3300" },
    team_c: { name: "Team Gamma", color: "#a855f7" },
    team_d: { name: "Team Delta", color: "#e2a04a" },
    team_e: { name: "Team Epsilon", color: "#15803d" },
    team_f: { name: "Team Zeta", color: "#e11d48" }
};

const turnPhases = [
    { name: "Command Phase", color: "var(--accent-gold)" },
    { name: "Movement Phase", color: "#4a90e2" },
    { name: "Shooting Phase", color: "#e2a04a" },
    { name: "Charge Phase", color: "#e25c4a" },
    { name: "Fight Phase", color: "#b83232" }
];

const factionRegistry = {
    marines: { name: "Space Marines", color: "#2d7dd2" },
    darkangels: { name: "Dark Angels", color: "#0f4229" },
    bloodangels: { name: "Blood Angels", color: "#b81414" },
    spacewolves: { name: "Space Wolves", color: "#708090" },
    templars: { name: "Black Templars", color: "#ffffff" },
    greyknights: { name: "Grey Knights", color: "#94a3b8" },
    custodes: { name: "Adeptus Custodes", color: "#e2a04a" },
    guard: { name: "Astra Militarum", color: "#15803d" },
    sisters: { name: "Adepta Sororitas", color: "#e11d48" },
    mechanicus: { name: "Adeptus Mechanicus", color: "#991b1b" },
    knights: { name: "Imperial Knights", color: "#1e3a8a" },
    agents: { name: "Imperial Agents", color: "#475569" },
    chaos: { name: "Chaos Space Marines", color: "#ff3300" },
    deathguard: { name: "Death Guard", color: "#606c38" },
    thousandsons: { name: "Thousand Sons", color: "#0284c7" },
    worldeaters: { name: "World Eaters", color: "#991b1b" },
    daemons: { name: "Chaos Daemons", color: "#dc2626" },
    chaosknights: { name: "Chaos Knights", color: "#450a0a" },
    necrons: { name: "Necrons", color: "#00ff66" },
    tyranids: { name: "Tyranids", color: "#a855f7" },
    orks: { name: "Orks", color: "#4ade80" },
    tau: { name: "T'au Empire", color: "#f97316" },
    eldar: { name: "Aeldari", color: "#00cccc" },
    drukhari: { name: "Drukhari", color: "#115e59" },
    genestealers: { name: "Genestealer Cults", color: "#4c1d95" },
    votann: { name: "Leagues of Votann", color: "#b45309" }
};

// =========================================================================
// 2. DYNAMIC COMBATANT GENERATION ENGINE
// =========================================================================
function addNewPlayerProfile(customName = "", factionKey = "marines") {
    const playerNum = players.length + 1;
    const defaultName = customName || `Player ${playerNum}`;
    
    const newPlayer = {
        id: playerNum,
        name: defaultName,
        factionId: factionKey,
        vp: 0,
        cp: 1,
        secMode: 'fixed',
        // 🌟 NEW: Establish team identifiers (Defaulting to Team A or B based on player count order)
        teamId: (playerNum % 2 === 1) ? 'team_a' : 'team_b' 
    };
    
    players.push(newPlayer);
    playerActiveCards[playerNum] = []; 
    
    renderAllPlayerCards();
    updateGlobalBackground();
}


// =========================================================================
// 🌟 NEW: PROGRAMMATIC COMBATANT REMOVAL MODULE
// =========================================================================
function removePlayerProfile(playerId) {
    if (players.length <= 1) {
        alert("The battlefield requires at least one active player profile to track stats!");
        return;
    }

    // 1. Wipe out their slot parameters from our state arrays
    players = players.filter(p => p.id !== playerId);
    delete playerActiveCards[playerId];

    // 2. Re-index remaining player IDs so DOM identifiers stay sequential and unbroken
    players.forEach((player, index) => {
        const oldId = player.id;
        const newId = index + 1;
        
        if (oldId !== newId) {
            // Remap dynamic tactical hand objects to the new index
            playerActiveCards[newId] = playerActiveCards[oldId] || [];
            delete playerActiveCards[oldId];
            player.id = newId;
        }
    });

    // 3. Re-render dashboard layouts and update ambient layers
    renderAllPlayerCards();
    updateGlobalBackground();
    saveMatchToStorage();
}


function renderAllPlayerCards() {
    const mainGrid = document.getElementById('match-main-grid');
    if (!mainGrid) return;
    
    mainGrid.innerHTML = ""; 

    players.forEach((player) => {
        const factionData = factionRegistry[player.factionId] || { name: "Space Marines", color: "#2d7dd2" };
        const card = document.createElement('div');
        card.id = `player${player.id}`;
        card.className = 'player-card';
        card.style.setProperty('--faction-accent', factionData.color);
        
        // 🌟 FIXED INPUT EVALUATION LAYER: Bypasses array type errors to safely fallback to 0
        const currentPrimary = player.primaryValue !== undefined ? player.primaryValue : 0;
        
        let currentFixedA = 0;
        let currentFixedB = 0;
        if (player.fixedValues && Array.isArray(player.fixedValues)) {
            currentFixedA = player.fixedValues[0] !== undefined ? player.fixedValues[0] : 0;
            currentFixedB = player.fixedValues[1] !== undefined ? player.fixedValues[1] : 0;
        } else if (player.fixedValues !== undefined) {
            currentFixedA = player.fixedValues;
            currentFixedB = player.fixedValues;
        }

        // Dynamically build the team list dropdown options
        let optionsHtml = "";
        currentTeams.forEach(tKey => {
            const tData = teamRegistry[tKey];
            if (tData) {
                optionsHtml += `<option value="${tKey}" ${player.teamId === tKey ? 'selected' : ''} style="color: ${tData.color};">${tData.name.toUpperCase()}</option>`;
            }
        });

        const teamSwitcherHtml = teamsEnabled ? `
            <select onchange="updatePlayerTeamDirectly(${player.id}, this.value)" style="background: rgba(0,0,0,0.3); color: var(--text-muted); border: 1px solid var(--panel-border); font-size: 0.75rem; font-weight: 800; padding: 2px 6px; border-radius: 4px; cursor: pointer; outline: none;">
                ${optionsHtml}
            </select>
        ` : '';



        // 🌟 FIXED: Repaired broken template strings around player variables so buttons map to real IDs
        card.innerHTML = `
            <div class="player-header">
                <div class="player-header-text">
                    <div class="player-name" style="display: flex; align-items: center; gap: 8px;">${player.name} ${teamSwitcherHtml}</div>
                    <div class="faction-name" data-faction-id="${player.factionId}">${factionData.name}</div>
                </div>
                <div class="player-header-controls" style="display: flex; gap: 8px;">
                    <button class="btn-edit-profile" onclick="editPlayerProfile(${player.id})">EDIT</button>
                    <button class="btn-remove-player pre-match-controls" onclick="removePlayerProfile(${player.id})">🗑️</button>
                </div>
            </div>
            
            <div class="counter-group">
                <div class="counter-box">
                    <span class="counter-label">Victory Points</span>
                    <div id="p${player.id}-vp" class="counter-value">${player.vp}</div>
                    <div class="btn-group">
                        <button onclick="adjustCounter(${player.id}, 'vp', -1)">-</button>
                        <button onclick="adjustCounter(${player.id}, 'vp', 1)">+</button>
                    </div>
                </div>
                <div class="counter-box">
                    <span class="counter-label">Command Points</span>
                    <div id="p${player.id}-cp" class="counter-value">${player.cp}</div>
                    <div class="btn-group">
                        <button onclick="adjustCounter(${player.id}, 'cp', -1)">-</button>
                        <button onclick="adjustCounter(${player.id}, 'cp', 1)">+</button>
                    </div>
                </div>
            </div>

            <div class="objectives-section">
                <h3>Objectives Breakdown</h3>
                <div class="objective-row">
                    <span class="objective-name">Primary Mission</span>
                    <input type="number" class="objective-input p${player.id}-obj" value="${currentPrimary}" min="0" max="50" oninput="calculateTotalVP(${player.id})">
                </div>
                
                <div class="secondary-mode-toggle">
                    <button id="p${player.id}-mode-fixed" class="mode-btn active" onclick="setSecondaryMode(${player.id}, 'fixed')">Fixed</button>
                    <button id="p${player.id}-mode-tactical" class="mode-btn" onclick="setSecondaryMode(${player.id}, 'tactical')">Tactical</button>
                </div>

                <div id="p${player.id}-fixed-ui" style="display: block;">
                    <div class="objective-row">
                        <span class="objective-name">Fixed Sec A</span>
                        <input type="number" class="objective-input p${player.id}-fixed-in" value="${currentFixedA}" min="0" max="15" oninput="calculateTotalVP(${player.id})">
                    </div>
                    <div class="objective-row">
                        <span class="objective-name">Fixed Sec B</span>
                        <input type="number" class="objective-input p${player.id}-fixed-in" value="${currentFixedB}" min="0" max="15" oninput="calculateTotalVP(${player.id})">
                    </div>
                </div>

                <div id="p${player.id}-tactical-ui" class="tactical-deck-ui" style="display: none;">
                    <div id="p${player.id}-active-cards"></div>
                    <button class="btn-card-control draw" onclick="drawTacticalCard(${player.id})">Draw Tactical Mission</button>
                </div>

                <div class="stratagem-section">
                    <h4>Core Stratagems</h4>
                    <div class="stratagem-grid">
                        <button class="btn-strat" onclick="spendStratagem(${player.id}, 'Command Re-roll', 1)">
                            <span><span>Command Re-roll</span> <span class="strat-cost">1CP</span></span>
                        </button>
                        <button class="btn-strat" onclick="spendStratagem(${player.id}, 'Fire Overwatch', 1)">
                            <span><span>Fire Overwatch</span> <span class="strat-cost">1CP</span></span>
                        </button>
                        <button class="btn-strat" onclick="spendStratagem(${player.id}, 'Go to Ground', 1)">
                            <span><span>Go to Ground</span> <span class="strat-cost">1CP</span></span>
                        </button>
                        <button class="btn-strat" onclick="spendStratagem(${player.id}, 'Insane Bravery', 1)">
                            <span><span>Insane Bravery</span> <span class="strat-cost">1CP</span></span>
                        </button>
                        <button class="btn-strat" onclick="spendStratagem(${player.id}, 'Counter-Offensive', 2)">
                            <span><span>Counter-Offensive</span> <span class="strat-cost">2CP</span></span>
                        </button>
                        <button class="btn-strat" onclick="spendStratagem(${player.id}, 'Heroic Intervent.', 2)">
                            <span><span>Heroic Intervent.</span> <span class="strat-cost">2CP</span></span>
                        </button>
                        <button class="btn-strat" onclick="spendStratagem(${player.id}, 'Desperate Escape', 1)">
                            <span><span>Desperate Escape</span> <span class="strat-cost">1CP</span></span>
                        </button>
                    </div>
                    <div class="stratagem-creator-form">
                        <input type="text" id="p${player.id}-new-strat-name" class="strat-input-text" placeholder="Custom Stratagem...">
                        <select id="p${player.id}-new-strat-cost" class="strat-select-cost">
                            <option value="0">0CP</option><option value="1" selected>1CP</option><option value="2">2CP</option>
                        </select>
                        <button class="btn-add-strat" onclick="createCustomStratagem(${player.id})">+</button>
                    </div>
                </div>
            </div>
        `;
        mainGrid.appendChild(card);
        renderTacticalCards(player.id);
    });
}



// =========================================================================
// 3. CORE STAT COUNTERS & UTILITIES
// =========================================================================
function adjustCounter(playerId, statType, direction) {
    // 1. Locate the player profile object within your global state array
    const targetPlayer = players.find(p => p.id === playerId);
    if (!targetPlayer) return;

    if (statType === 'vp') {
        // Handle VP increments/decrements
        let currentVP = parseInt(targetPlayer.vp) || 0;
        currentVP += direction;
        
        // Prevent points from falling below 0 or going past standard 90 point caps
        targetPlayer.vp = Math.max(0, Math.min(90, currentVP));
        
        // Update the screen display element directly
        const vpDisplay = document.getElementById(`p${playerId}-vp`);
        if (vpDisplay) vpDisplay.innerText = targetPlayer.vp;
        
        // Sync team score tracking systems if alliance rules are active
        updateTeamScoreHUD();
        
    } else if (statType === 'cp') {
        // Handle CP increments/decrements
        let currentCP = parseInt(targetPlayer.cp) || 0;
        currentCP += direction;
        
        // Prevent command pool points from dropping below zero
        targetPlayer.cp = Math.max(0, currentCP);
        
        // Update the screen display element directly
        const cpDisplay = document.getElementById(`p${playerId}-cp`);
        if (cpDisplay) cpDisplay.innerText = targetPlayer.cp;
    }

    // 2. Commit the new state downstream into localStorage session variables
    saveMatchToStorage();
}

function adjustTeamCount(direction) {
    const registryKeys = Object.keys(teamRegistry);
    
    if (direction > 0) {
        if (currentTeams.length >= registryKeys.length) {
            alert("Maximum battlefield team allocation reached!");
            return;
        }
        const nextKey = registryKeys[currentTeams.length];
        currentTeams.push(nextKey);
        addLogEntry(`SYSTEM CONFIG: Created new operational faction: [${teamRegistry[nextKey].name}].`);
    } else {
        if (currentTeams.length <= 2) {
            alert("Team matches require at least 2 active teams to function!");
            return;
        }
        const removedKey = currentTeams.pop();
        
        // Safety Clean up: If any player was on the team being deleted, push them back to Team Alpha
        players.forEach(p => {
            if (p.teamId === removedKey) p.teamId = "team_a";
        });
        addLogEntry(`SYSTEM CONFIG: Dissolved [${teamRegistry[removedKey].name}]. Detachments reallocated.`);
    }
    
    rebuildTeamHUDLayout();
    renderAllPlayerCards();
    saveMatchToStorage();
}

function getPlayerActiveName(playerId) {
    const targetPlayer = players.find(p => p.id === playerId);
    return targetPlayer ? targetPlayer.name : `Player ${playerId}`;
}

function editPlayerProfile(playerNumber) {
    const card = document.getElementById(`player${playerNumber}`);
    if (!card) return;
    const nameEl = card.querySelector('.player-name');
    const factionEl = card.querySelector('.faction-name');
    const editBtn = card.querySelector('.btn-edit-profile');
    if (!nameEl || !factionEl || !editBtn) return;

    const targetPlayer = players.find(p => p.id === playerNumber);

    if (editBtn.innerText === "EDIT") {
        const currentName = targetPlayer ? targetPlayer.name : `Player ${playerNumber}`;
        const currentFactionId = factionEl.getAttribute('data-faction-id') || 'marines';
        const currentTeamId = targetPlayer ? (targetPlayer.teamId || 'team_a') : 'team_a';

        // 🌟 DYNAMICALLY BUILD OPTIONS: Loops through whatever teams are active
        let teamOptionsHtml = "";
        currentTeams.forEach(tKey => {
            const tData = teamRegistry[tKey];
            if (tData) {
                teamOptionsHtml += `<option value="${tKey}" ${currentTeamId === tKey ? 'selected' : ''}>${tData.name}</option>`;
            }
        });

        // 🌟 CONDITIONAL DISPLAY: Only show the select menu if Teams mode is turned on
        const teamSelectHtml = teamsEnabled ? `
            <select class="profile-select-team" style="margin-top:6px; width:100%; padding:4px; font-size:0.8rem; background:#000; color:#fff; border:1px solid var(--panel-border); border-radius:4px;">
                ${teamOptionsHtml}
            </select>
        ` : '';

        nameEl.innerHTML = `
            <input type="text" class="profile-input-name" value="${currentName}" style="font-size:1.1rem; background:#000; color:#fff; border:1px solid var(--panel-border); padding:2px; width:100%;">
            ${teamSelectHtml}
        `;
        
        let selectOptions = `
            <optgroup label="⚓ Imperium - Space Marines">
                <option value="marines" ${currentFactionId === 'marines' ? 'selected' : ''}>Space Marines</option>
                <option value="darkangels" ${currentFactionId === 'darkangels' ? 'selected' : ''}>Dark Angels</option>
                <option value="bloodangels" ${currentFactionId === 'bloodangels' ? 'selected' : ''}>Blood Angels</option>
                <option value="spacewolves" ${currentFactionId === 'spacewolves' ? 'selected' : ''}>Space Wolves</option>
                <option value="templars" ${currentFactionId === 'templars' ? 'selected' : ''}>Black Templars</option>
                <option value="greyknights" ${currentFactionId === 'greyknights' ? 'selected' : ''}>Grey Knights</option>
            </optgroup>
            <optgroup label="🛡️ Imperium - Human Forces">
                <option value="custodes" ${currentFactionId === 'custodes' ? 'selected' : ''}>Adeptus Custodes</option>
                <option value="guard" ${currentFactionId === 'guard' ? 'selected' : ''}>Astra Militarum</option>
                <option value="sisters" ${currentFactionId === 'sisters' ? 'selected' : ''}>Adepta Sororitas</option>
                <option value="mechanicus" ${currentFactionId === 'mechanicus' ? 'selected' : ''}>Adeptus Mechanicus</option>
                <option value="knights" ${currentFactionId === 'knights' ? 'selected' : ''}>Imperial Knights</option>
                <option value="agents" ${currentFactionId === 'agents' ? 'selected' : ''}>Imperial Agents</option>
            </optgroup>
            <optgroup label="🔥 Forces of Chaos">
                <option value="chaos" ${currentFactionId === 'chaos' ? 'selected' : ''}>Chaos Space Marines</option>
                <option value="deathguard" ${currentFactionId === 'deathguard' ? 'selected' : ''}>Death Guard</option>
                <option value="thousandsons" ${currentFactionId === 'thousandsons' ? 'selected' : ''}>Thousand Sons</option>
                <option value="worldeaters" ${currentFactionId === 'worldeaters' ? 'selected' : ''}>World Eaters</option>
                <option value="daemons" ${currentFactionId === 'daemons' ? 'selected' : ''}>Chaos Daemons</option>
                <option value="chaosknights" ${currentFactionId === 'chaosknights' ? 'selected' : ''}>Chaos Knights</option>
            </optgroup>
            <optgroup label="👽 Xenos Empires">
                <option value="necrons" ${currentFactionId === 'necrons' ? 'selected' : ''}>Necrons</option>
                <option value="tyranids" ${currentFactionId === 'tyranids' ? 'selected' : ''}>Tyranids</option>
                <option value="orks" ${currentFactionId === 'orks' ? 'selected' : ''}>Orks</option>
                <option value="tau" ${currentFactionId === 'tau' ? 'selected' : ''}>T'au Empire</option>
                <option value="eldar" ${currentFactionId === 'eldar' ? 'selected' : ''}>Aeldari</option>
                <option value="drukhari" ${currentFactionId === 'drukhari' ? 'selected' : ''}>Drukhari</option>
                <option value="genestealers" ${currentFactionId === 'genestealers' ? 'selected' : ''}>Genestealer Cults</option>
                <option value="votann" ${currentFactionId === 'votann' ? 'selected' : ''}>Leagues of Votann</option>
            </optgroup>`;

        factionEl.innerHTML = `<select class="profile-select-faction">${selectOptions}</select>`;
        editBtn.innerText = "SAVE";
        editBtn.style.backgroundColor = "#2d7dd2";
    } else {
        const selectBox = card.querySelector('.profile-select-faction');
        const selectNameBox = card.querySelector('.profile-input-name');
        const teamSelectBox = card.querySelector('.profile-select-team');
        if(!selectBox || !selectNameBox) return;

        const selectedFactionId = selectBox.value;
        let rawName = selectNameBox.value.trim() || `Player ${playerNumber}`;
        const newName = rawName.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');

        if (targetPlayer) {
            targetPlayer.name = newName;
            targetPlayer.factionId = selectedFactionId;
            if (teamsEnabled && teamSelectBox) {
                targetPlayer.teamId = teamSelectBox.value;
            }
        }

        saveMatchToStorage();
        renderAllPlayerCards(); 
        updatePhaseDisplayText();
        updateGlobalBackground(); 
        updateTeamScoreHUD();
    }
}






// =========================================================================
// 4. TIMELINE TURN RUNTIME ENGINE
// =========================================================================
function changeRound(amount, isSystemCall = false) {
    if (!isSystemCall) return;
    currentRound += amount;
    currentRound = Math.max(1, Math.min(5, currentRound));
    
    const displayElement = document.getElementById('round-display');
    if (displayElement) displayElement.innerText = currentRound;
    
    addLogEntry(`BATTLE ROUND ACTION: Timeline automatically transitioned to Battle Round ${currentRound}.`);
    saveMatchToStorage();
}

function changePhase(direction) {
    if (direction < 0 || players.length === 0) return;

    currentPhaseIndex += direction;

    if (currentPhaseIndex >= turnPhases.length) {
        currentPhaseIndex = 0;
        
        const prevPlayerId = players[activePlayerIndex].id;
        addLogEntry(`TURN TRANSITION: ${getPlayerActiveName(prevPlayerId)}'s turn phase block concluded.`, prevPlayerId);
        
        activePlayerIndex++;
        
        if (activePlayerIndex >= players.length) {
            activePlayerIndex = 0; 
            
            if (currentRound === 5) {
                addLogEntry(`TURN TRANSITION: Battle Round 5 complete.`);
                triggerEndMatch();
                return; 
            }
            changeRound(1, true);
        }
    }

    updatePhaseDisplayText();
    updateVisualTurnHighlight();
    updateGlobalBackground(); 

    // 🌟 FIXED ENGINE: Mutates player data model directly, updates the elements, then runs a clean save
    const currentPhase = turnPhases.at(currentPhaseIndex);
    if (currentPhase && currentPhase.name === "Command Phase") {
        players.forEach(player => {
            player.cp = (parseInt(player.cp) || 0) + 1; // 1. Update data model array layer first
            
            const cpDisplay = document.getElementById(`p${player.id}-cp`);
            if (cpDisplay) {
                cpDisplay.innerText = player.cp; // 2. Push directly to screen element second
            }
        });
    }

    saveMatchToStorage(); // 3. Securely lock the array payload state straight into LocalStorage third
}

function updatePhaseDisplayText() {
    if(players.length === 0) return;
    const currentPhase = turnPhases.at(currentPhaseIndex);
    const phaseName = currentPhase ? currentPhase.name : "Command Phase";
    const phaseColor = currentPhase ? currentPhase.color : "var(--accent-gold)";
    const activePlayerId = players[activePlayerIndex].id;
    const activeName = getPlayerActiveName(activePlayerId);

    const phaseText = document.getElementById('phase-display-text');
    const phaseContainer = document.getElementById('phase-tracker-box');
    if (phaseText) phaseText.innerText = `${activeName} - ${phaseName}`;
    if (phaseContainer) phaseContainer.style.borderLeftColor = phaseColor;
}

// =========================================================================
// 5. SECONDARY MISSION ENGINE (DYNAMIC ARRAY CONTROL)
// =========================================================================
const tacticalCardPool = [
    "Area Denial", "Extend Battle Lines", "Overwhelming Force", 
    "Secure No Man's Land", "Defend Orders", "Investigate Signals",
    "Shed Blood", "Capturing Outposts", "A01: Sabotage", "A02: Purge"
];

function setSecondaryMode(playerNum, mode) {
    const targetPlayer = players.find(p => p.id === playerNum);
    if (targetPlayer) targetPlayer.secMode = mode;

    const fixedUI = document.getElementById(`p${playerNum}-fixed-ui`);
    const tacticalUI = document.getElementById(`p${playerNum}-tactical-ui`);
    const fixedBtn = document.getElementById(`p${playerNum}-mode-fixed`);
    const tacticalBtn = document.getElementById(`p${playerNum}-mode-tactical`);

    if (!fixedUI || !tacticalUI || !fixedBtn || !tacticalBtn) return;

    if (mode === 'fixed') {
        fixedUI.style.display = 'block';
        tacticalUI.style.display = 'none';
        fixedBtn.classList.add('active');
        tacticalBtn.classList.remove('active');
    } else {
        fixedUI.style.display = 'none';
        tacticalUI.style.display = 'flex';
        fixedBtn.classList.remove('active');
        tacticalBtn.classList.add('active');
    }

    if (!isRestoringState) {
        calculateTotalVP(playerNum);
        saveMatchToStorage();
    }
}




function drawTacticalCard(playerNum) {
    if (!playerActiveCards[playerNum]) playerActiveCards[playerNum] = [];

    if (playerActiveCards[playerNum].length >= 3) {
        alert("Maximum hand size reached! Discard or score a mission before drawing more.");
        return;
    }

    const randomIndex = Math.floor(Math.random() * tacticalCardPool.length);
    const cardTitle = tacticalCardPool[randomIndex];
    const uniqueId = `p${playerNum}-tac-${Date.now()}`;

    playerActiveCards[playerNum].push({ id: uniqueId, title: cardTitle, score: 0 });
    renderTacticalCards(playerNum);
    saveMatchToStorage();
}

function discardTacticalCard(playerNum, cardId) {
    if (!playerActiveCards[playerNum]) return;
    playerActiveCards[playerNum] = playerActiveCards[playerNum].filter(c => c.id !== cardId);
    renderTacticalCards(playerNum);
    calculateTotalVP(playerNum);
    saveMatchToStorage();
}

function updateTacticalScore(playerNum, cardId, value) {
    if (!playerActiveCards[playerNum]) return;
    const card = playerActiveCards[playerNum].find(c => c.id === cardId);
    if (card) {
        let val = parseInt(value) || 0;
        card.score = Math.max(0, Math.min(15, val));
    }
    calculateTotalVP(playerNum);
    saveMatchToStorage();
}

function renderTacticalCards(playerNum) {
    const container = document.getElementById(`p${playerNum}-active-cards`);
    if (!container) return;
    container.innerHTML = "";

    if (!playerActiveCards[playerNum]) playerActiveCards[playerNum] = [];

    playerActiveCards[playerNum].forEach(card => {
        const row = document.createElement('div');
        row.className = 'tactical-card-row';
        row.innerHTML = `
            <span>${card.title}</span>
            <div style="display:flex; gap:5px; align-items:center;">
                <input type="number" class="objective-input" value="${card.score}" min="0" max="15" 
                    oninput="updateTacticalScore(${playerNum}, '${card.id}', this.value)" style="width:45px; padding:2px;">
                <button class="btn-card-control" onclick="discardTacticalCard(${playerNum}, '${card.id}')">X</button>
            </div>
        `;
        container.appendChild(row);
    });
}

function calculateTotalVP(playerNumber) {
    let total = 0;
    const primaryInput = document.querySelector(`.p${playerNumber}-obj`);
    if (primaryInput) total += (parseInt(primaryInput.value) || 0);

    const fixedBtn = document.getElementById(`p${playerNumber}-mode-fixed`);
    const isFixed = fixedBtn ? fixedBtn.classList.contains('active') : true;

    if (isFixed) {
        document.querySelectorAll(`.p${playerNumber}-fixed-in`).forEach(input => {
            total += (parseInt(input.value) || 0);
        });
    } else if (playerActiveCards[playerNumber]) {
        playerActiveCards[playerNumber].forEach(card => { total += card.score; });
    }

    total = Math.min(90, total);
    const vpDisplay = document.getElementById(`p${playerNumber}-vp`);
    if (vpDisplay) vpDisplay.innerText = total;

    const targetPlayer = players.find(p => p.id === playerNumber);
    if (targetPlayer) {
        targetPlayer.vp = total; 
        
        const cpDisplay = document.getElementById(`p${playerNumber}-cp`);
        if (cpDisplay) {
            targetPlayer.cp = parseInt(cpDisplay.innerText) || targetPlayer.cp || 0;
        }
    }

    updateTeamScoreHUD(); // 🌟 Sync core values cleanly out to screen elements

    if (!isRestoringState) {
        saveMatchToStorage();
    }
}





// =========================================================================
// 6. RESOURCE SYSTEMS & STRATAGEM BUILDER
// =========================================================================
function spendStratagem(playerNum, stratName, cpCost) {
    const cpElement = document.getElementById(`p${playerNum}-cp`);
    if (!cpElement) return;

    let currentCP = parseInt(cpElement.innerText) || 0;
    if (currentCP < cpCost) {
        alert("Insufficient Command Points!");
        return;
    }

    currentCP -= cpCost;
    cpElement.innerText = currentCP;
    
    const targetPlayer = players.find(p => p.id === playerNum);
    if (targetPlayer) targetPlayer.cp = currentCP;

    addLogEntry(`STRATAGEM ACTIVATED: ${getPlayerActiveName(playerNum)} spent ${cpCost} CP to deploy [${stratName}].`, playerNum);
    saveMatchToStorage();
}

function createCustomStratagem(playerNum) {
    const nameInput = document.getElementById(`p${playerNum}-new-strat-name`);
    const costSelect = document.getElementById(`p${playerNum}-new-strat-cost`);
    if (!nameInput || !costSelect) return;

    const rawStratName = nameInput.value.trim();
    if (rawStratName === "") return;

    const stratName = rawStratName.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    const cpCost = parseInt(costSelect.value) || 0;

    const card = document.getElementById(`player${playerNum}`);
    if (!card) return;
    const grid = card.querySelector('.stratagem-grid');
    if (!grid) return;

    const newButton = document.createElement('button');
    newButton.className = 'btn-strat';
    const sanitizedName = stratName.replace(/'/g, "\\'");
    newButton.innerHTML = `
        <span onclick="event.stopPropagation(); spendStratagem(${playerNum}, "${sanitizedName}", ${cpCost})">
            <span>${stratName}</span> <span class="strat-cost">${cpCost}CP</span>
        </span>
        <button class="btn-strat-delete" onclick="event.stopPropagation(); this.parentElement.remove(); saveMatchToStorage();">X</button>
    `;
    grid.appendChild(newButton);

    nameInput.value = "";
    saveMatchToStorage();
}

// =========================================================================
// 7. INTERFACE GLOWS & LOG CONTEXTS
// =========================================================================
function updateGlobalBackground() {
    if (players.length === 0) return;
    
    // Safely pull the single active player object using the current turn index pointer
    const currentActivePlayer = players[activePlayerIndex];
    if (!currentActivePlayer) return;
    
    // Extract color tokens safely out of the registry mapping profiles
    const factionData = factionRegistry[currentActivePlayer.factionId] || { name: "Space Marines", color: "#2d7dd2" };
    
    // Directly push the active hex color straight down to the root CSS custom variable
    document.body.style.setProperty('--active-faction-color', factionData.color);
}


function updateVisualTurnHighlight() {
    if (players.length === 0) return;
    const activePlayerId = players[activePlayerIndex].id;
    
    // Toggle active/inactive visual states across the card elements without touching stats
    players.forEach(p => {
        const card = document.getElementById(`player${p.id}`);
        if (card) {
            if (p.id === activePlayerId) {
                card.classList.add('active-turn');
                card.classList.remove('inactive-turn');
            } else {
                card.classList.add('inactive-turn');
                card.classList.remove('active-turn');
            }
        }
    });
}


function launchMatch() {
    if(players.length === 0) return;
    addLogEntry("SYSTEM INIT: War room deployed. Match started successfully.");
    addLogEntry(`BATTLE ROUND 1: Commencing Command Phase.`);
    
    const overlay = document.getElementById('start-match-overlay');
    if (overlay) overlay.style.display = 'none';

    const mainGrid = document.getElementById('match-main-grid');
    if (mainGrid) mainGrid.classList.remove('pre-match');

    // 🌟 FIXED LAYER: Setup active profiles to start with their initial 1 CP baseline allocation
    players.forEach(p => {
        p.cp = 1; // Change from 0 to 1
        const pCPElement = document.getElementById(`p${p.id}-cp`);
        if (pCPElement) pCPElement.innerText = '1'; // Change from '0' to '1'
    });

    updatePhaseDisplayText();
    updateVisualTurnHighlight();
    updateGlobalBackground(); 
    saveMatchToStorage();
}




function addLogEntry(message, playerNum = 0) {
    const feedBody = document.getElementById('log-ticker-feed');
    if (!feedBody) return;

    const timeStamp = new Date().toTimeString().slice(0, 8);
    const row = document.createElement('div');
    row.className = 'log-entry-row';

    if (playerNum > 0) {
        const pData = players.find(p => p.id === playerNum);
        const factionAccentColor = factionRegistry[pData?.factionId]?.color || '#c59b27';
        row.style.borderLeft = `3px solid ${factionAccentColor}`;
        row.style.paddingLeft = '8px';
    }

    row.innerHTML = `<span class="log-timestamp">[${timeStamp}]</span> <span class="log-text">${message}</span>`;
    feedBody.insertBefore(row, feedBody.firstChild);
}

function clearLogFeed() {
    const feedBody = document.getElementById('log-ticker-feed');
    if (feedBody) {
        feedBody.innerHTML = '';
        addLogEntry("Log system cleared by user request.");
    }
}

// =========================================================================
// 8. END GAME CALCULATOR & LEADERBOARD OVERLAYS
// =========================================================================
// Replace your existing triggerEndMatch() implementation with this versatile framework
function triggerEndMatch() {
    if (players.length === 0) return;
    
    let winnerHeadline = "Victory Achieved";
    let summaryText = "";

    if (teamsEnabled) {
        // Dynamic Team Standings Multi-Check
        let totals = {};
        currentTeams.forEach(tKey => totals[tKey] = 0);
        players.forEach(p => { 
            if (totals[p.teamId] !== undefined) totals[p.teamId] += (parseInt(p.vp) || 0); 
        });

        let sortedTeams = Object.keys(totals).map(key => ({ key: key, score: totals[key] })).sort((a,b) => b.score - a.score);

        if (sortedTeams.length > 1 && sortedTeams[0].score === sortedTeams[1].score) {
            winnerHeadline = "Conflict Drawn";
            summaryText = `The war has concluded in a faction deadlock tie at ${sortedTeams[0].score} VP!\\n\\n`;
        } else {
            const winningKey = sortedTeams[0].key;
            winnerHeadline = "Victory Achieved";
            summaryText = `🏆 ${teamRegistry[winningKey].name} has triumphed! (${sortedTeams[0].score} VP)\\n\\n`;
        }

        summaryText += `Team Standings:\\n`;
        sortedTeams.forEach(tObj => {
            summaryText += `• ${teamRegistry[tObj.key].name}: ${tObj.score} VP\\n`;
        });
        summaryText += `\\n`;
    } else {
        // Free-For-All Individual Placement Calculations
        let sortedPlayers = [...players].sort((a, b) => b.vp - a.vp);
        
        if (sortedPlayers.length > 1 && sortedPlayers[0].vp === sortedPlayers[1].vp) {
            winnerHeadline = "Mutual Destruction";
            summaryText = `The match concluded in an individual stalemate at ${sortedPlayers[0].vp} VP!\\n\\n`;
        } else {
            winnerHeadline = "Grand Champion";
            summaryText = `🏆 ${sortedPlayers[0].name} has swept the warzone! (${sortedPlayers[0].vp} VP)\\n\\n`;
        }
    }

    summaryText += `Individual Standings:\\n`;
    let scoreboardSorted = [...players].sort((a, b) => b.vp - a.vp);
    scoreboardSorted.forEach((p, idx) => {
        const teamLabel = teamsEnabled ? ` [${teamRegistry[p.teamId]?.name || 'Unknown'}]` : '';
        summaryText += `  ${idx + 1}. ${p.name}${teamLabel}: ${p.vp} VP\\n`;
    });

    const banner = document.getElementById('victory-banner-overlay');
    if (banner) {
        document.getElementById('victory-headline').innerText = winnerHeadline;
        document.getElementById('winner-score-summary').innerText = summaryText;
        banner.style.display = 'flex';
    }
    
    addLogEntry("========================================");
    addLogEntry("MATCH CONCLUDED. Final scores tabulated.");
    addLogEntry("========================================");
}





function closeVictoryBanner() {
    document.getElementById('victory-banner-overlay').style.display = 'none';
}

// Fixed confirm scope inside standard prompt runtime handlers
function resetMatch() {
    if (window.confirm("Are you sure you want to reset the match?")) {
        localStorage.removeItem('wh40k_scoreboard_session');
        window.location.reload(); 
    }
}

// =========================================================================
// 9. DYNAMIC PERSISTENCE ENGINE
// =========================================================================
function saveMatchToStorage() {
    if (isRestoringState || players.length === 0) return;

    players.forEach(p => {
        const pInput = document.querySelector(`.p${p.id}-obj`);
        p.primaryValue = pInput ? pInput.value : "0";
        
        const fixedInputs = Array.from(document.querySelectorAll(`.p${p.id}-fixed-in`));
        if (fixedInputs.length > 0) {
            p.fixedValues = fixedInputs.map(i => i.value);
        } else {
            p.fixedValues = ["0", "0"];
        }
        
        const cpDisplay = document.getElementById(`p${p.id}-cp`);
        if (cpDisplay) p.cp = parseInt(cpDisplay.innerText) || 0;
        
        const vpDisplay = document.getElementById(`p${p.id}-vp`);
        if (vpDisplay) p.vp = parseInt(vpDisplay.innerText) || 0;

        const teamSelect = document.querySelector(`#player${p.id} select[onchange*="updatePlayerTeamDirectly"]`);
        if (teamSelect) {
            p.teamId = teamSelect.value;
        }
    });

    const customStratsSaved = {};
    players.forEach(p => {
        customStratsSaved[p.id] = [];
        const card = document.getElementById(`player${p.id}`);
        if (card) {
            const addedButtons = card.querySelectorAll('.stratagem-grid .btn-strat');
            addedButtons.forEach(btn => {
                const deleteBtnExists = btn.querySelector('.btn-strat-delete');
                if (deleteBtnExists) {
                    const name = btn.querySelector('span span')?.innerText;
                    const costText = btn.querySelector('.strat-cost')?.innerText || "1CP";
                    const cost = parseInt(costText) || 1;
                    if (name) customStratsSaved[p.id].push({ name, cost });
                }
            });
        }
    });

    // Locate saveMatchToStorage() and make sure matchData includes teamsEnabled:
    const matchData = {
    currentRound,
    currentPhaseIndex,
    activePlayerIndex,
    teamsEnabled, // Save format state
    currentTeams, // Save dynamic team allocation array length parameters
    players, 
    playerActiveCards,
    customStratsSaved,
    feedHTML: document.getElementById('log-ticker-feed')?.innerHTML || ''
    };
    localStorage.setItem('wh40k_scoreboard_session', JSON.stringify(matchData));
}





function loadMatchFromStorage() {
    const savedSession = localStorage.getItem('wh40k_scoreboard_session');
    if (!savedSession) return false;

    try {
        const data = JSON.parse(savedSession);
        isRestoringState = true; 

        currentRound = data.currentRound;
        currentPhaseIndex = data.currentPhaseIndex;
        activePlayerIndex = data.activePlayerIndex;
        players = data.players || [];
        playerActiveCards = data.playerActiveCards || {};
        
        teamsEnabled = data.teamsEnabled !== undefined ? data.teamsEnabled : true;
        currentTeams = data.currentTeams || ["team_a", "team_b"];

        const checkbox = document.getElementById('teams-toggle-checkbox');
        if (checkbox) checkbox.checked = teamsEnabled;
      
        if (document.getElementById('round-display')) {
            document.getElementById('round-display').innerText = currentRound;
        }
        
        const overlay = document.getElementById('start-match-overlay');
        if (overlay) overlay.style.display = 'none';
        
        const mainGrid = document.getElementById('match-main-grid');
        if (mainGrid) {
            mainGrid.classList.remove('pre-match');
        }

        // 🌟 SEQUENCE FIX 1: Sync the team modes, scaler controls, and formats before rendering cards
        const scalerShelf = document.getElementById('team-scaler-controls');
        const hudContainer = document.getElementById('dynamic-team-hud-container');
        const labelText = document.getElementById('team-toggle-label');
        
        if (teamsEnabled) {
            if (labelText) { labelText.innerText = "Teams Active"; labelText.style.color = "#00f0ff"; }
            if (scalerShelf) scalerShelf.style.display = "inline-flex";
            if (hudContainer) hudContainer.style.display = "flex";
        } else {
            if (labelText) { labelText.innerText = "Free-For-All"; labelText.style.color = "var(--text-muted)"; }
            if (scalerShelf) scalerShelf.style.display = "none";
            if (hudContainer) hudContainer.style.display = "none";
        }

        rebuildTeamHUDLayout();

        // 🌟 SEQUENCE FIX 2: Render cards once so their baseline markup is injected into the DOM safely
        renderAllPlayerCards();

        players.forEach(p => {
            const cpDisplay = document.getElementById(`p${p.id}-cp`);
            if (cpDisplay && p.cp !== undefined) {
                cpDisplay.innerText = p.cp;
            }
            
            const vpDisplay = document.getElementById(`p${p.id}-vp`);
            if (vpDisplay && p.vp !== undefined) {
                vpDisplay.innerText = p.vp;
            }
            
            // 🌟 SEQUENCE FIX 3: Rehydrate individual objective card interfaces directly
            const fixedUI = document.getElementById(`p${p.id}-fixed-ui`);
            const tacticalUI = document.getElementById(`p${p.id}-tactical-ui`);
            const fixedBtn = document.getElementById(`p${p.id}-mode-fixed`);
            const tacticalBtn = document.getElementById(`p${p.id}-mode-tactical`);

            if (fixedUI && tacticalUI && fixedBtn && tacticalBtn) {
                if (p.secMode === 'fixed') {
                    fixedUI.style.display = 'block';
                    tacticalUI.style.display = 'none';
                    fixedBtn.classList.add('active');
                    tacticalBtn.classList.remove('active');
                } else {
                    fixedUI.style.display = 'none';
                    tacticalUI.style.display = 'flex';
                    fixedBtn.classList.remove('active');
                    tacticalBtn.classList.add('active');
                }
            }
            
            renderTacticalCards(p.id);

            if (data.customStratsSaved && data.customStratsSaved[p.id]) {
                const card = document.getElementById(`player${p.id}`);
                const grid = card?.querySelector('.stratagem-grid');
                if (grid) {
                    data.customStratsSaved[p.id].forEach(strat => {
                        const newButton = document.createElement('button');
                        newButton.className = 'btn-strat';
                        const sanitizedName = strat.name.replace(/'/g, "\\'");
                        newButton.innerHTML = `
                            <span onclick="event.stopPropagation(); spendStratagem(${p.id}, '${sanitizedName}', ${strat.cost})">
                                <span>${strat.name}</span> <span class="strat-cost">${strat.cost}CP</span>
                            </span>
                            <button class="btn-strat-delete" onclick="event.stopPropagation(); this.parentElement.remove(); saveMatchToStorage();">X</button>
                        `;
                        grid.appendChild(newButton);
                    });
                }
            }
        });

        const feed = document.getElementById('log-ticker-feed');
        if (feed && data.feedHTML) feed.innerHTML = data.feedHTML;

        updatePhaseDisplayText();
        updateVisualTurnHighlight();
        updateGlobalBackground();

        setTimeout(() => { isRestoringState = false; }, 100);
        return true;
    } catch (e) {
        console.error("Critical Failure reloading session payload, wiping storage:", e);
        isRestoringState = false;
        localStorage.removeItem('wh40k_scoreboard_session');
        return false;
    }
}


function getCumulativeTeamScores() {
    let totals = { team_a: 0, team_b: 0 };
    
    players.forEach(p => {
        if (p.teamId === 'team_a') totals.team_a += (parseInt(p.vp) || 0);
        if (p.teamId === 'team_b') totals.team_b += (parseInt(p.vp) || 0);
    });
    
    return totals;
}

// 🌟 Tip: Use this inside triggerEndMatch() to declare which Team won the overall round!


function updateTeamScoreHUD() {
    // 🌟 CRITICAL FIX: If teams are turned off (Free-For-All), exit immediately! 
    // This stops errors from crashing the script thread and unfreezes your VP/CP buttons.
    if (!teamsEnabled) return;

    let totals = {};
    currentTeams.forEach(tKey => totals[tKey] = 0);
    
    players.forEach(p => {
        if (totals[p.teamId] !== undefined) {
            totals[p.teamId] += (parseInt(p.vp) || 0);
        }
    });

    currentTeams.forEach(tKey => {
        const scoreEl = document.getElementById(`hud-score-${tKey}`);
        if (scoreEl) scoreEl.innerText = totals[tKey];
    });
}

// 🌟 NEW: Live controller that changes a player's team instantly and saves state
function updatePlayerTeamDirectly(playerId, targetTeamId) {
    const targetPlayer = players.find(p => p.id === playerId);
    if (targetPlayer) {
        targetPlayer.teamId = targetTeamId;
        
        // Refresh the HUD calculations and secure state history into local storage
        updateTeamScoreHUD();
        saveMatchToStorage();
        
        // Re-render cards so style profiles/badges adapt smoothly if edited later
        renderAllPlayerCards();
    }
}
function setQuickDiceCount(amount) {
    const input = document.getElementById('dice-count-input');
    if (input) input.value = amount;
}

function executeDiceRoll(sides = 6) {
    const input = document.getElementById('dice-count-input');
    const tray = document.getElementById('dice-tray-display');
    const summary = document.getElementById('dice-summary-total');
    if (!input || !tray || !summary) return;

    let count = parseInt(input.value) || 1;
    if (count < 1) count = 1;
    if (count > 100) {
        alert("Safeguards cap mass calculations at 100 dice per payload.");
        count = 100;
        input.value = 100;
    }

    let rolls = [];
    let grandTotal = 0;

    for (let i = 0; i < count; i++) {
        let rolledValue = Math.floor(Math.random() * sides) + 1;
        rolls.push(rolledValue);
        grandTotal += rolledValue;
    }

    // High to low sort sequence to quickly check critical checks
    rolls.sort((a, b) => b - a);

    tray.innerHTML = "";
    rolls.forEach(val => {
        const badge = document.createElement('span');
        badge.style.cssText = `
            background: #0f1115;
            color: #fff;
            border: 1px solid var(--panel-border);
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 800;
            display: inline-block;
            box-shadow: 0 2px 4px rgba(0,0,0,0.5);
        `;
        
        // Match standard 40k critical hit color thresholds
        if (sides === 6) {
            if (val === 6) { badge.style.borderColor = "#00f0ff"; badge.style.color = "#00f0ff"; }
            if (val === 1) { badge.style.borderColor = "#b83232"; badge.style.color = "#ff5555"; }
        }
        
        badge.innerText = val;
        tray.appendChild(badge);
    });

    summary.innerHTML = `Total: <strong style="color:var(--accent-gold); font-size:0.95rem;">${grandTotal}</strong> (Avg: ${(grandTotal / count).toFixed(1)})`;

    // Safely outputs the text right downstream to whatever feed elements addLogEntry looks for
    const logString = `DICE ROLLOUT: Threw ${count}x D${sides}. Results -> [ ${rolls.join(', ')} ] | Total Sum: ${grandTotal}.`;
    addLogEntry(logString);
}
// 🌟 NEW: Live tray clearer that purges results and updates readouts cleanly
function clearDiceTray() {
    const input = document.getElementById('dice-count-input');
    const tray = document.getElementById('dice-tray-display');
    const summary = document.getElementById('dice-summary-total');
    
    // 🌟 NEW: Resets the dice payload field back to the baseline of 1 die
    if (input) {
        input.value = "1";
    }
    if (tray) {
        tray.innerHTML = `<span style="color: var(--text-muted); font-style: italic; font-size: 0.75rem;">Tray empty. Awaiting payload rollout...</span>`;
    }
    if (summary) {
        summary.innerText = "Total: --";
    }
}
// =========================================================================
// 🌟 NEW: TEAMS AND INDIVIDUAL LAYOUT CONTROLLER
// =========================================================================
function toggleTeamMode(isEnabled) {
    teamsEnabled = isEnabled;
    const labelText = document.getElementById('team-toggle-label');
    const scalerShelf = document.getElementById('team-scaler-controls');
    const hudContainer = document.getElementById('dynamic-team-hud-container');
    
    if (teamsEnabled) {
        if (labelText) labelText.innerText = "Teams Active";
        if (labelText) labelText.style.color = "#00f0ff";
        if (scalerShelf) scalerShelf.style.display = "inline-flex";
        if (hudContainer) hudContainer.style.display = "flex";
        addLogEntry("SYSTEM CONFIG: Scoreboard updated to Team Alliance format.");
    } else {
        if (labelText) labelText.innerText = "Free-For-All";
        if (labelText) labelText.style.color = "var(--text-muted)"; // 🌟 Fixed your string assignment syntax error!
        if (scalerShelf) scalerShelf.style.display = "none";
        if (hudContainer) hudContainer.style.display = "none";
        addLogEntry("SYSTEM CONFIG: Scoreboard updated to Free-For-All / Solos format.");
    }
    
    rebuildTeamHUDLayout();
    renderAllPlayerCards();
    saveMatchToStorage();
}
function rebuildTeamHUDLayout() {
    const container = document.getElementById('dynamic-team-hud-container');
    if (!container) return;
    container.innerHTML = ""; // Clear layout layers

    if (!teamsEnabled) return; // Exit immediately if FFA mode is on

    currentTeams.forEach(tKey => {
        const tData = teamRegistry[tKey];
        const hudBox = document.createElement('div');
        hudBox.className = "turn-tracker"; // Seamlessly reuse your sci-fi panel class layout properties
        hudBox.style.borderColor = tData.color;
        hudBox.innerHTML = `
            <span class="turn-label" style="color:${tData.color}; font-size:0.8rem; font-weight:bold;">${tData.name.toUpperCase()}:</span>
            <span id="hud-score-${tKey}" class="turn-display" style="color:#fff; margin-left:8px; font-size:1.3rem;">0</span>
        `;
        container.appendChild(hudBox);
    });
    updateTeamScoreHUD();
}



window.addEventListener('DOMContentLoaded', () => {
    // 1. Programmatically inject hover effects and sci-fi transitions...
    if (!document.getElementById('dice-roller-styles')) {
        const styleSheet = document.createElement('style');
        styleSheet.id = 'dice-roller-styles';
        styleSheet.innerText = `
            .dice-roller-container button {
                transition: all 0.25s cubic-bezier(0.4, 0, 0.2, 1) !important;
            }
            /* Standard Roll D6 Button Hover */
            .dice-roller-container button:nth-of-type(1):hover {
                background: var(--active-faction-color, #2d7dd2) !important;
                color: #0f1115 !important;
                box-shadow: 0 0 15px var(--active-faction-color, #2d7dd2);
                transform: translateY(-1px);
            }
            /* D3 Gold Accent Button Hover */
            .dice-roller-container button:nth-of-type(2):hover {
                background: var(--accent-gold) !important;
                color: #0f1115 !important;
                box-shadow: 0 0 15px var(--accent-gold);
                transform: translateY(-1px);
            }
            /* D10 Cyan Accent Button Hover */
            .dice-roller-container button:nth-of-type(3):hover {
                background: #00f0ff !important;
                color: #0f1115 !important;
                box-shadow: 0 0 15px #00f0ff;
                transform: translateY(-1px);
            }
            /* Quick Multiplier Buttons Hover (1x, 5x, 10x, 20x) */
            .dice-roller-container div:nth-of-type(2) div button:not(:last-child):hover {
                background: #fff !important;
                color: #0f1115 !important;
                box-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
                transform: translateY(-1px);
            }
            /* Red Clear Button Hover */
            .dice-roller-container button[onclick*="clearDiceTray"]:hover {
                background: #b83232 !important;
                color: #fff !important;
                box-shadow: 0 0 15px #ff5555;
                transform: translateY(-1px);
            }
            /* Universal Active Click State Compression Effect */
            .dice-roller-container button:active {
                transform: translateY(1px) !important;
            }
        `;
        document.head.appendChild(styleSheet);
    }

    // 2. Build the Dice Roller HTML Widget layout completely
    const diceStation = document.createElement('div');
    diceStation.className = "dice-roller-container";
    diceStation.style.cssText = `
        background: rgba(0, 0, 0, 0.2); 
        border: 1px dashed var(--panel-border); 
        padding: 15px; 
        border-radius: 4px; 
        margin-bottom: 15px;
        width: 100%;
        max-width: 1200px;
    `;
    
    // 🌟 ADDED: '<button onclick="setQuickDiceCount(1)" ...>1x</button>' inside the layout multipliers container row
    diceStation.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
            <h4 style="font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1.5px; color: #00f0ff; font-weight: bold;">🎲 Tactical Dice Station</h4>
            <div style="font-size: 0.75rem; color: var(--text-muted);" id="dice-summary-total">Total: --</div>
        </div>
        
        <div style="display: flex; gap: 10px; flex-wrap: wrap; margin-bottom: 12px;">
            <input type="number" id="dice-count-input" value="1" min="1" max="100" style="background: #000; border: 1px solid var(--panel-border); color: #fff; padding: 6px; width: 65px; border-radius: 4px; text-align: center; font-weight: bold;">
            <button onclick="executeDiceRoll(6)" style="background: var(--panel-border); color: #fff; font-size: 0.8rem; padding: 6px 12px; font-weight: bold; cursor: pointer; border-radius: 4px;">Roll D6</button>
            <button onclick="executeDiceRoll(3)" style="background: rgba(197, 155, 39, 0.1); border: 1px solid var(--accent-gold); color: var(--accent-gold); font-size: 0.8rem; padding: 6px 12px; font-weight: bold; cursor: pointer; border-radius: 4px;">D3</button>
            <button onclick="executeDiceRoll(10)" style="background: rgba(0, 240, 255, 0.1); border: 1px solid #00f0ff; color: #00f0ff; font-size: 0.8rem; padding: 6px 12px; font-weight: bold; cursor: pointer; border-radius: 4px;">D10</button>
            
            <div style="display: flex; gap: 4px; margin-left: auto; align-items: center;">
                <button onclick="setQuickDiceCount(1)" style="font-size:0.7rem; padding: 4px 8px; cursor: pointer; background: var(--panel-border); color: #fff; border-radius: 4px;">1x</button>
                <button onclick="setQuickDiceCount(5)" style="font-size:0.7rem; padding: 4px 8px; cursor: pointer; background: var(--panel-border); color: #fff; border-radius: 4px;">5x</button>
                <button onclick="setQuickDiceCount(10)" style="font-size:0.7rem; padding: 4px 8px; cursor: pointer; background: var(--panel-border); color: #fff; border-radius: 4px;">10x</button>
                <button onclick="setQuickDiceCount(20)" style="font-size:0.7rem; padding: 4px 8px; cursor: pointer; background: var(--panel-border); color: #fff; border-radius: 4px;">20x</button>
                <button onclick="clearDiceTray()" style="font-size:0.7rem; padding: 4px 8px; cursor: pointer; background: rgba(184, 50, 50, 0.2); border: 1px solid #ff5555; color: #ff5555; border-radius: 4px; margin-left: 6px; font-weight: bold;">CLEAR</button>
            </div>
        </div>

        <div id="dice-tray-display" style="display: flex; gap: 6px; flex-wrap: wrap; min-height: 28px; background: rgba(0,0,0,0.4); padding: 6px; border-radius: 4px; font-family: monospace; font-size: 0.9rem; align-items: center;">
            <span style="color: var(--text-muted); font-style: italic; font-size: 0.75rem;">Tray empty. Awaiting payload rollout...</span>
        </div>
    `;

    // 3. Mount the dynamic roller node safely over the Match Log wrapper panel
    const logContainer = document.querySelector('.log-container') || document.querySelector('.workspace-stack');
    if (logContainer) {
        logContainer.insertBefore(diceStation, logContainer.firstChild);
    }

    // 4. Run session local storage checks cleanly
    const loaded = loadMatchFromStorage();
    if (!loaded) {
        addNewPlayerProfile("Player 1", "marines");
        addNewPlayerProfile("Player 2", "tyranids");
    } else {
        updateTeamScoreHUD();
    }
    const checkboxElement = document.getElementById('teams-toggle-checkbox');
    if (checkboxElement) {
        checkboxElement.checked = teamsEnabled; // Sync checkbox position to your variable
        toggleTeamMode(teamsEnabled);          // Force layout rules to process cleanly
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('sw.js');
    }
});

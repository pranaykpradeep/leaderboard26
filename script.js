// ==========================================
// CONFIGURATION
// ==========================================
// Real-time Google Apps Script Web App URL
const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxOiUteM5VmZCXIQVsvsgRvTXIiTf82WAuA3LDyPuRgK-_w5qLCLmVxT4FPUbUyF9gScA/exec';
// Fallback CSV URL (in case Apps Script is inaccessible)
const GOOGLE_SHEET_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vQ8S9cCzPnrWOIEFwbs97BG_k602zTW8b572790RXSMtd7PZEtuvLSPmBENQIWPn28McGpDEnkin4Zc/pub?output=csv'; 

// Points rules
const POINTS_PER_TASK = 100;
const MIN_POINTS_PER_TASK = 60; // Minimum points a team can get for a task

// Final Task (Task 8) Reduced Bonus Ladder:
// 1st team gets 10,000 pts and is crowned Winner / Champion!
// Subsequent teams get stepped reduced bonuses down to 500 pts.
const FINAL_TASK_BONUSES = [
    10000, // 1st Place (Champion)
    5000,  // 2nd Place (Runner-Up)
    3000,  // 3rd Place
    2000,  // 4th Place
    1500,  // 5th Place
    1000,  // 6th Place
    800,   // 7th Place
    500    // 8th+ Place (Completion bonus)
];

function getFinalTaskBonus(rank) {
    if (rank >= 1 && rank <= FINAL_TASK_BONUSES.length) {
        return FINAL_TASK_BONUSES[rank - 1];
    }
    return 500;
}

// The exact string that represents the final task in the form
const FINAL_TASK_NAME = "Task 8"; 
const REFRESH_INTERVAL = 3000; // 3 seconds for instant real-time updates

// Team Mapping (Team ID -> Unique Name)
const TEAM_NAMES = {
    "Team 1": "Quisito",
    "Team 2": "Indiana Jonesnte piller",
    "Team 3": "Secret Seekers",
    "Team 4": "CID Moosas",
    "Team 5": "DRASHTA",
    "Team 6": "Operation Treasure",
    "Team 7": "Kryptos",
    "Team 8": "Cryptic squad",
    "Team 9": "Squad Zero",
    "Team 10": "Pirates Of Cheruthoni",
    "Team 11": "Cipher Squad",
    "Team 12": "Renegades",
    "Team 13": "Relic Hunters",
    "Team 14": "Mungal Vidhagthar",
    "Team 15": "Treasure Warriors",
    "Team 16": "Celestial dragons",
    "Team 17": "Strawhats",
    "Team 18": "Uncharted 😎"
};

function resolveTeamId(rawTeam) {
    if (!rawTeam) return null;
    let clean = rawTeam.trim().toLowerCase();

    for (let id of Object.keys(TEAM_NAMES)) {
        if (id.toLowerCase() === clean) return id;
    }
    for (let [id, name] of Object.entries(TEAM_NAMES)) {
        if (name.toLowerCase() === clean) return id;
    }
    for (let id of Object.keys(TEAM_NAMES)) {
        if (clean.includes(id.toLowerCase())) return id;
    }
    for (let [id, name] of Object.entries(TEAM_NAMES)) {
        if (name !== id && clean.includes(name.toLowerCase())) return id;
    }
    return null;
}

function getAvatar(displayName, teamId) {
    if (displayName === teamId) {
        return teamId.replace('Team ', 'T');
    }
    let words = displayName.trim().split(/\s+/);
    if (words.length >= 2) {
        return (words[0][0] + words[1][0]).toUpperCase();
    }
    return displayName.substring(0, 2).toUpperCase();
}

const TASK_TITLES = {
    1: "reached Website",
    2: "reached Puzzle",
    3: "reached Morse code",
    4: "reached Tele bot",
    5: "reached Library of babel",
    6: "reached Spectrogram",
    7: "reached Credential insta handle",
    8: "reached Telegram bot"
};

function resolveTaskId(rawTask) {
    if (!rawTask) return null;
    let clean = rawTask.trim().toLowerCase();

    for (let i = 1; i <= 8; i++) {
        if (clean === `task ${i}` || clean.startsWith(`task ${i} `) || clean.startsWith(`task ${i}-`) || clean.startsWith(`task ${i}:`)) {
            return `Task ${i}`;
        }
    }
    for (let [num, title] of Object.entries(TASK_TITLES)) {
        if (clean.includes(title.toLowerCase()) || title.toLowerCase().includes(clean)) {
            return `Task ${num}`;
        }
    }
    return rawTask;
}

// ==========================================
// APP LOGIC
// ==========================================

function parseCSVData(csvText) {
    Papa.parse(csvText, {
        header: true,
        skipEmptyLines: true,
        complete: function(results) {
            processData(results.data);
        }
    });
}

function processData(rows) {
    const TOTAL_TEAMS = 18;
    const validTeamIds = Array.from({length: TOTAL_TEAMS}, (_, i) => `Team ${i + 1}`);

    // Pre-initialize Team 1 to Team 18 with 0 points
    let taskCompletions = {}; 
    let teamPoints = {};
    let teamHasWon = {};
    let teamFinalRank = {};

    validTeamIds.forEach(t => {
        teamPoints[t] = 0;
        teamHasWon[t] = false;
        teamFinalRank[t] = null;
    });

    if (rows && rows.length > 0) {
        const headers = Object.keys(rows[0]);
        const timeCol = headers.find(h => h.toLowerCase().includes('timestamp')) || headers[0];
        const teamCol = headers.find(h => h.toLowerCase().includes('team')) || headers[1];
        const taskCol = headers.find(h => h.toLowerCase().includes('task')) || headers[2];

        // 1. Organize submissions chronologically
        rows.sort((a, b) => new Date(a[timeCol]) - new Date(b[timeCol]));

        // 2. Track who solved what and when
        rows.forEach(row => {
            let rawTeam = row[teamCol]?.toString().trim();
            let rawTask = row[taskCol]?.toString().trim();
            
            if (!rawTeam || !rawTask) return;

            // Resolve to canonical Team ID (e.g. "Squad Zero" -> "Team 9", "Team 9" -> "Team 9")
            let team = resolveTeamId(rawTeam);
            let task = resolveTaskId(rawTask);
            if (!team || !task) return; // Ignore any unrecognized names

            // Initialize task array if not exists
            if (!taskCompletions[task]) {
                taskCompletions[task] = [];
            }

            // If this team hasn't already received points for this task
            if (!taskCompletions[task].includes(team)) {
                taskCompletions[task].push(team);
                
                // Their rank is how many people solved it before them + 1
                let rank = taskCompletions[task].length; 
                
                if (task.toLowerCase() === FINAL_TASK_NAME.toLowerCase()) {
                    let bonus = getFinalTaskBonus(rank);
                    teamPoints[team] += bonus;
                    teamFinalRank[team] = rank;
                    if (rank === 1) {
                        teamHasWon[team] = true;
                    }
                } else {
                    teamPoints[team] += Math.max(MIN_POINTS_PER_TASK, POINTS_PER_TASK - ((rank - 1) * 10));
                }
            }
        });
    }

    // 3. Format for rendering - Only display teams that have started (completed at least one task / points > 0)
    let activeTeams = validTeamIds.filter(teamId => (teamPoints[teamId] || 0) > 0);

    let teamsList = activeTeams.map(teamId => {
        let displayName = TEAM_NAMES[teamId] || teamId;
        let hasCustomName = displayName !== teamId;
        return {
            id: teamId,
            name: displayName,
            hasCustomName: hasCustomName,
            points: teamPoints[teamId] || 0,
            avatar: getAvatar(displayName, teamId),
            hasWon: teamHasWon[teamId] || false,
            finalRank: teamFinalRank[teamId] || null
        };
    });

    // Sort teams: Highest points first. If tied, sort by team number.
    teamsList.sort((a, b) => (b.points - a.points) || a.id.localeCompare(b.id, undefined, { numeric: true }));

    renderLeaderboard(teamsList);
}

function renderLeaderboard(teams) {
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return; // Fail gracefully if missing element
    
    tbody.innerHTML = '';
    
    // Check if the grand champion has been crowned (1st to finish Task 8)
    const champion = teams.find(t => t.hasWon);
    const winnerBanner = document.getElementById('winner-banner');
    const winnerTeamNameEl = document.getElementById('winner-team-name');
    if (winnerBanner && winnerTeamNameEl) {
        if (champion) {
            winnerBanner.style.display = 'flex';
            winnerTeamNameEl.textContent = champion.name + (champion.hasCustomName ? ` (${champion.id})` : '');
        } else {
            winnerBanner.style.display = 'none';
        }
    }

    if (teams.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #888; padding: 25px; font-size: 15px;">No teams have completed Task 1 yet. The hunt is on! 🚀</td></tr>`;
        let timeEl = document.getElementById('update-time');
        if (timeEl) timeEl.textContent = new Date().toLocaleTimeString();
        return;
    }

    teams.forEach((team, index) => {
        const rank = index + 1;
        const row = document.createElement('tr');
        
        if (team.hasWon) {
            row.classList.add('winner');
        } else if (team.finalRank === 2) {
            row.classList.add('runner-up');
        } else if (team.finalRank === 3) {
            row.classList.add('third-place');
        } else if (rank <= 3) {
            row.classList.add('top-3');
        }

        let displayRank = team.hasWon ? '👑' : rank;

        // Custom badges based on final task finish order
        let badgeHtml = '';
        if (team.hasWon) {
            badgeHtml = '<span class="status-badge champion-badge">👑 1ST • WINNER</span>';
        } else if (team.finalRank === 2) {
            badgeHtml = '<span class="status-badge runner-up-badge">🥈 2ND • RUNNER UP</span>';
        } else if (team.finalRank === 3) {
            badgeHtml = '<span class="status-badge third-badge">🥉 3RD PLACE</span>';
        } else if (team.finalRank) {
            badgeHtml = `<span class="status-badge finisher-badge">🏁 COMPLETED (#${team.finalRank})</span>`;
        }

        let nameHtml = `
            <div class="name-container">
                <span class="team-title">${team.name}</span>
                ${team.hasCustomName ? `<span class="team-badge">${team.id}</span>` : ''}
                ${badgeHtml}
            </div>
        `;

        row.innerHTML = `
            <td class="rank">${displayRank}</td>
            <td class="name">
                <div class="avatar">${team.avatar}</div>
                ${nameHtml}
            </td>
            <td class="points">${team.points.toLocaleString()}</td>
        `;
        tbody.appendChild(row);
    });
    
    let timeEl = document.getElementById('update-time');
    if (timeEl) timeEl.textContent = new Date().toLocaleTimeString();
}

function triggerManualRefresh() {
    const btn = document.getElementById('refresh-btn');
    if (btn) {
        btn.classList.add('spinning');
        btn.disabled = true;
    }
    fetchData().finally(() => {
        if (btn) {
            setTimeout(() => {
                btn.classList.remove('spinning');
                btn.disabled = false;
            }, 600);
        }
    });
}

function fetchData() {
    return fetch(APPS_SCRIPT_URL)
        .then(response => {
            if (!response.ok) throw new Error("Apps Script response not ok: " + response.status);
            return response.json();
        })
        .then(rows => {
            if (Array.isArray(rows)) {
                processData(rows);
            } else {
                throw new Error("Invalid response format from Apps Script");
            }
        })
        .catch(error => {
            console.warn('Apps Script fetch failed, falling back to published CSV:', error);
            return fetch(`${GOOGLE_SHEET_CSV_URL}&_=${Date.now()}`)
                .then(response => {
                    if (!response.ok) throw new Error("CSV response not ok");
                    return response.text();
                })
                .then(csvText => {
                    parseCSVData(csvText);
                })
                .catch(csvError => {
                    console.error('All fetch sources failed:', csvError);
                });
        });
}

// Make functions globally available
window.fetchData = fetchData;
window.triggerManualRefresh = triggerManualRefresh;

// Initial fetch
fetchData();
setInterval(fetchData, REFRESH_INTERVAL);

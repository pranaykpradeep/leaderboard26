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
const FINAL_TASK_BONUS = 10000;

// The exact string that represents the final task in the form
const FINAL_TASK_NAME = "Task 10"; 
const REFRESH_INTERVAL = 3000; // 3 seconds for instant real-time updates

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
    // Expected headers: "Timestamp", "team name", "task name"
    // Find the actual keys since Google Forms might capitalize them slightly differently
    if (rows.length === 0) {
        renderLeaderboard([]);
        return;
    }

    const headers = Object.keys(rows[0]);
    const timeCol = headers.find(h => h.toLowerCase().includes('timestamp')) || headers[0];
    const teamCol = headers.find(h => h.toLowerCase().includes('team')) || headers[1];
    const taskCol = headers.find(h => h.toLowerCase().includes('task')) || headers[2];

    // 1. Organize submissions chronologically
    rows.sort((a, b) => new Date(a[timeCol]) - new Date(b[timeCol]));

    // 2. Track who solved what and when
    // { "Task 1": ["NOVA", "Team 2"], "Task 2": ["NOVA"] }
    let taskCompletions = {}; 
    let teamPoints = {}; // { "NOVA": 100 }
    let teamHasWon = {}; // { "NOVA": false }

    rows.forEach(row => {
        let team = row[teamCol]?.toString().trim();
        let task = row[taskCol]?.toString().trim();
        
        if (!team || !task) return;

        // Initialize team if not exists
        if (typeof teamPoints[team] === 'undefined') {
            teamPoints[team] = 0;
            teamHasWon[team] = false;
        }

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
                if (rank === 1) {
                    teamPoints[team] += FINAL_TASK_BONUS;
                    teamHasWon[team] = true;
                } else {
                    teamPoints[team] += Math.max(MIN_POINTS_PER_TASK, POINTS_PER_TASK - ((rank - 1) * 10));
                }
            } else {
                teamPoints[team] += Math.max(MIN_POINTS_PER_TASK, POINTS_PER_TASK - ((rank - 1) * 10));
            }
        }
    });

    // 3. Format for rendering
    let teamsList = Object.keys(teamPoints).map(teamName => {
        // Generate avatar initials (first two letters)
        let avatar = teamName.replace('Team ', 'T');
        if (teamName.length > 2 && avatar === teamName) {
             avatar = teamName.substring(0, 2).toUpperCase();
        }

        return {
            name: teamName,
            points: teamPoints[teamName],
            avatar: avatar,
            hasWon: teamHasWon[teamName]
        };
    });

    // Sort teams: Highest points first.
    teamsList.sort((a, b) => b.points - a.points);

    renderLeaderboard(teamsList);
}

function renderLeaderboard(teams) {
    const tbody = document.getElementById('leaderboard-body');
    if (!tbody) return; // Fail gracefully if missing element
    
    tbody.innerHTML = '';
    
    if (teams.length === 0) {
        tbody.innerHTML = `<tr><td colspan="3" style="text-align: center; color: #888; padding: 25px; font-size: 15px;">No task submissions recorded yet. The hunt is on! 🚀</td></tr>`;
        let timeEl = document.getElementById('update-time');
        if (timeEl) timeEl.textContent = new Date().toLocaleTimeString();
        return;
    }
    teams.forEach((team, index) => {
        const rank = index + 1;
        const row = document.createElement('tr');
        
        if (rank <= 3 && !team.hasWon) {
            row.classList.add('top-3');
        }
        
        if (team.hasWon) {
            row.classList.add('winner');
        }

        let displayRank = team.hasWon ? '👑' : rank;

        row.innerHTML = `
            <td class="rank">${displayRank}</td>
            <td class="name">
                <div class="avatar">${team.avatar}</div>
                ${team.name}
            </td>
            <td class="points">${team.points}</td>
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

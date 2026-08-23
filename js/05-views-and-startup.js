        function toggleRecruiterSkill(skillName) {
            if (recruiterAssignedSkills.includes(skillName)) {
                if (recruiterAssignedSkills.length === 1) { alert("Please keep at least one skill track active."); return; }
                recruiterAssignedSkills = recruiterAssignedSkills.filter(s => s !== skillName);
            } else {
                recruiterAssignedSkills.push(skillName);
            }
            renderRecruiterView();
        }

        function renderRecruiterView() {
            const chipContainer = document.getElementById('recruiterSkillChips');
            chipContainer.innerHTML = skills.map(skillRecord => {
                const skill = skillRecord.name;
                const isActive = recruiterAssignedSkills.includes(skill);
                return `<div class="skill-chip ${isActive ? 'active' : ''}" onclick="toggleRecruiterSkill('${skill}')">${isActive ? '✓ ' : '+ '}${skill}</div>`;
            }).join('');

            document.getElementById('recruiterTrackSummary').innerText = `${recruiterAssignedSkills.length} Tracks Active (${recruiterAssignedSkills.join(', ')})`;

            const trackQueue = queue.filter(c => c.interviewDate === getActiveInterviewDate() && c.status === 'WAITING' && recruiterAssignedSkills.includes(c.skill));
            document.getElementById('recruiterQueueCount').innerText = trackQueue.length;

            const recruiterQueueEl = document.getElementById('recruiterQueueList');
            if (trackQueue.length === 0) {
                recruiterQueueEl.innerHTML = `<div class="empty-state">No candidates waiting in active tracks [${recruiterAssignedSkills.join(', ')}].</div>`;
            } else {
                const matchedPanelists = panelists.filter(p => p.interviewDate === getActiveInterviewDate() && (recruiterAssignedSkills.includes(p.skill) || p.skill === 'General'));

                recruiterQueueEl.innerHTML = trackQueue.map(c => {
                    const sortedOptions = [...matchedPanelists].sort((a, b) => {
                        const aMatch = (a.skill === c.skill || a.skill === 'General') ? -1 : 1;
                        const bMatch = (b.skill === c.skill || b.skill === 'General') ? -1 : 1;
                        return aMatch - bMatch;
                    });

                    const dropdownOptions = sortedOptions.map(p => {
                        const matchStar = (p.skill === c.skill || p.skill === 'General') ? "★ " : "";
                        const statusTag = p.status === 'AVAILABLE' ? 'Ready' : (p.status === 'BUSY' ? 'Busy' : 'Break');
                        return `<option value="${p.id}">${matchStar}${p.name} [${p.level}] (${statusTag}) - ${p.location}</option>`;
                    }).join('');

                    const dropdownHtml = matchedPanelists.length > 0
                        ? `<div class="manual-assign-box">
                             <div class="manual-assign-row">
                                 <select id="select_assign_${c.id}">
                                     <option value="">-- Assign Panelist in Active Session --</option>
                                     ${dropdownOptions}
                                 </select>
                                 <button class="btn-assign btn-purple" onclick="assignManually('${c.id}')">Assign ➔</button>
                             </div>
                           </div>`
                        : `<div style="font-size: 11px; color: var(--danger); font-style: italic; margin-top: 6px;">No track panelists available</div>`;

                    return `
                    <div class="card" style="margin-bottom: 12px;">
                        <div class="card-top" style="margin-bottom: 0;">
                            <div>
                                <div class="card-title">👤 ${c.name}</div>
                                <div class="card-subtitle">Check-in: ${c.checkInTime} · Next: ${c.r1 === 'Cleared' ? 'Round 2' : 'Round 1'}</div>
                                ${c.r1 === 'Cleared' ? `<span class="cleared-badge">🟢 Round 1 Cleared — Ready for R2</span>` : ''}
                            </div>
                            <span class="badge badge-${c.skill.toLowerCase()}">${c.skill}</span>
                        </div>
                        ${dropdownHtml}

                        <div style="margin-top:7px; font-size:10px; color:var(--text-muted); text-align:right;">
                            Permanent delete is intended only for accidental check-ins.
                        </div>
                                                <div style="display:flex; justify-content:flex-end; margin-top:10px;">
                            <button
                                class="btn-sm btn-remove"
                                style="flex:0 0 auto; color: var(--danger); border-color:#fecaca;"
                                title="Remove candidate from this waiting queue"
                                onclick="removeCandidateFromQueue('${c.id}')">
                                ↩️ Remove from Queue
                            </button>
                            <button
                                class="btn-sm btn-remove"
                                style="flex:0 0 auto; color:#991b1b; border-color:#fca5a5;"
                                title="Permanently delete accidentally added candidate"
                                onclick="deleteWaitingCandidate('${c.id}')">
                                🗑️ Delete Candidate
                            </button>
                        </div>
                    </div>
                    `;
                }).join('');
            }

            let trackPanelists = panelists.filter(p => p.interviewDate === getActiveInterviewDate() && (recruiterAssignedSkills.includes(p.skill) || p.skill === 'General'));
            trackPanelists = sortPanelistsByAvailability(trackPanelists);

            document.getElementById('recruiterStatAvail').innerText = `${trackPanelists.filter(p => p.status === 'AVAILABLE').length} Avail`;
            document.getElementById('recruiterStatBusy').innerText = `${trackPanelists.filter(p => p.status === 'BUSY').length} Busy`;

            const recruiterPanelistEl = document.getElementById('recruiterPanelistList');
            if (trackPanelists.length === 0) {
                recruiterPanelistEl.innerHTML = `<div class="empty-state">No interviewers assigned to tracks [${recruiterAssignedSkills.join(', ')}].</div>`;
            } else {
                recruiterPanelistEl.innerHTML = trackPanelists.map(p => {
                    let borderLeftColor = p.status === 'BUSY' ? 'var(--danger)' : (p.status === 'BREAK' ? 'var(--warning-bg)' : 'var(--success)');
                    return `
                    <div class="card" style="border-left: 5px solid ${borderLeftColor};">
                        <div>
                            <div class="card-top">
                                <div>
                                    <div class="card-title">${p.name}</div>
                                    <div class="meta-badges">
                                        <span class="level-badge">${p.level}</span>
                                        <span class="location-badge">📍 ${p.location}</span>
                                    </div>
                                </div>
                                <span class="badge badge-${p.skill.toLowerCase()}">${p.skill}</span>
                            </div>
                            <div style="font-size: 11px; color: var(--purple); font-weight: 700; margin-top: 4px;">
                                R1 Done: ${getRoundActivitySummaryForPanelist(p.id).r1} · R2 Done: ${getRoundActivitySummaryForPanelist(p.id).r2}
                            </div>
                            <div style="margin: 12px 0 6px 0; font-size: 13px;">
                                ${p.status === 'BUSY' ? `
                                    <div class="status-busy">🎙️ Interviewing: ${p.currentCandidate}</div>
                                    <div style="margin-top: 4px; font-size: 12px; font-weight: 800; color: var(--primary);">
                                        📋 Current Round: ${getPanelistCurrentRound(p)}
                                    </div>
                                ` : ''}
                                ${p.status === 'AVAILABLE' ? `<div class="status-available">✅ Available in ${p.location}</div>` : ''}
                                ${p.status === 'BREAK' ? `<div class="status-break">☕ On Break</div>` : ''}
                            </div>
                        </div>
                        <div class="action-buttons">
                            ${p.status === 'BUSY' ? `<button class="btn-sm btn-ready" onclick="changePanelistStatus('${p.id}', 'AVAILABLE', ${p.completed})">Finish Interview & Evaluate</button>` : ''}
                            ${p.status === 'AVAILABLE' ? `<button class="btn-sm btn-break" onclick="changePanelistStatus('${p.id}', 'BREAK', ${p.completed})">Pause for Break</button>` : ''}
                            ${p.status === 'BREAK' ? `<button class="btn-sm btn-ready" onclick="changePanelistStatus('${p.id}', 'AVAILABLE', ${p.completed})">Resume Shifts</button>` : ''}
                        </div>
                    </div>
                    `;
                }).join('');
            }
        }

        // Global Render Engine
        function renderAll() {
            queue.forEach(ensureCandidateWorkflow);
            panelists.forEach(p => { if (!Object.prototype.hasOwnProperty.call(p, 'nextCandidateId')) p.nextCandidateId = null; if (!Object.prototype.hasOwnProperty.call(p, 'activeInterviewId')) p.activeInterviewId = null; });
            renderQueue();
            renderPanelists();
            renderTelemetryStats();
            renderPanelistPortal();
            if (document.getElementById('recruiterViewContainer').style.display === 'block') renderRecruiterView();
            updateTimersDOM();
            if (document.getElementById('floorMapModal').style.display === 'flex') renderFloorMap();
            if (document.getElementById('eodModal').style.display === 'flex') renderEodReport();
        }

        function escapeHtml(value) {
            return String(value ?? '')
                .replace(/&/g, '&amp;')
                .replace(/</g, '&lt;')
                .replace(/>/g, '&gt;')
                .replace(/"/g, '&quot;')
                .replace(/'/g, '&#039;');
        }

        function candidateNameMatches(candidate, searchInputId) {
            const input = document.getElementById(searchInputId);
            const query = input ? input.value.trim().toLowerCase() : "";
            if (!query) return true;
            return String(candidate.name || "").toLowerCase().includes(query);
        }


        function getCandidatePanelistName(candidate, roundNumber) {
            const panelistId = roundNumber === 1 ? candidate.round1PanelistId : candidate.round2PanelistId;
            if (!panelistId) return "Not assigned";
            const panelist = panelists.find(p => p.id === panelistId);
            return panelist ? panelist.name : "Panelist unavailable";
        }

        function getCandidateRoundPanelistMarkup(candidate) {
            return `
                <div style="margin-top: 8px; padding: 7px 9px; background: #f8fafc; border: 1px solid var(--border-color); border-radius: 6px; font-size: 12px;">
                    <div><strong>Round 1 Panelist:</strong> ${getCandidatePanelistName(candidate, 1)}</div>
                    <div style="margin-top: 3px;"><strong>Round 2 Panelist:</strong> ${getCandidatePanelistName(candidate, 2)}</div>
                </div>
            `;
        }

        function renderQueue() {
            const skillFilter = document.getElementById('filterCandidateSkill').value;
            const waitingQueue = queue.filter(c => c.interviewDate === getActiveInterviewDate() && c.status === 'WAITING' && (!skillFilter || c.skill === skillFilter) && candidateNameMatches(c, 'searchQueueCandidate'));
            const holdSearch = document.getElementById('searchHoldCandidate')?.value.trim().toLowerCase() || "";
            const holdQueue = queue.filter(c => c.interviewDate === getActiveInterviewDate() && c.status === 'ON_HOLD' && (!holdSearch || String(c.name || '').toLowerCase().includes(holdSearch)));

            document.getElementById('queueCount').innerText = `${waitingQueue.length} ${skillFilter ? `(${skillFilter})` : ''}`;
            document.getElementById('holdQueueCount').innerText = holdQueue.length;

            const list = document.getElementById('queueList');
            const holdList = document.getElementById('holdQueueList');
            const isAuto = document.getElementById('autoRouteToggle').checked;
            
            // Render Waiting Queue
            if (waitingQueue.length === 0) {
                list.innerHTML = `<div class="empty-state">No candidates waiting for assignment.</div>`;
            } else {
                list.innerHTML = waitingQueue.map(c => {
                    let dropdownHtml = '';
                    if (!isAuto) {
                        const sortedOptions = panelists
                        .filter(p => p.interviewDate === getActiveInterviewDate() && p.status !== 'REMOVED')
                        .sort((a, b) => {
                            const aMatch = (a.skill === c.skill || a.skill === 'General') ? -1 : 1;
                            const bMatch = (b.skill === c.skill || b.skill === 'General') ? -1 : 1;
                            return aMatch - bMatch;
                        });

                        const dropdownOptions = sortedOptions.map(p => {
                            const matchStar = (p.skill === c.skill || p.skill === 'General') ? "★ " : "";
                            const statusTag = p.status === 'AVAILABLE' ? 'Ready' : (p.status === 'BUSY' ? 'Busy' : 'Break');
                            return `<option value="${p.id}">${matchStar}${p.name} [${p.level}] (${statusTag}) - ${p.location}</option>`;
                        }).join('');

                        dropdownHtml = panelists.length > 0
                            ? `<div class="manual-assign-box">
                                 <div class="manual-assign-row">
                                     <select id="select_assign_${c.id}">
                                         <option value="">-- Assign / Queue for Panelist (Active Session) --</option>
                                         ${dropdownOptions}
                                     </select>
                                     <button class="btn-assign" onclick="assignManually('${c.id}')">Assign ➔</button>
                                 </div>
                               </div>`
                            : `<div style="font-size: 11px; color: var(--danger); font-style: italic; margin-top: 6px;">No interviewers available</div>`;
                    }

                    const isR1Cleared = (c.r1 === 'Cleared');

                    return `
                    <div class="card" style="margin-bottom: 12px;">
                        <div class="card-top" style="margin-bottom: 0;">
                            <div>
                                <div class="card-title">👤 ${c.name}</div>
                                <div class="card-subtitle">📅 ${c.interviewDate || getTodayFormattedDate()} | Check-in: ${c.checkInTime}</div>
                                ${isR1Cleared ? `<span class="cleared-badge">🟢 Round 1 Cleared — Ready for Round 2</span>` : ''}
                            </div>
                            <span class="badge badge-${c.skill.toLowerCase()}">${c.skill}</span>
                        </div>

                        ${getCandidateRoundPanelistMarkup(c)}
<div class="round-group">
                                <span>R2:</span>
                                <select class="round-select" onchange="updateCandidateRound('${c.id}', 'r2', this.value)" ${!isR1Cleared ? 'disabled' : ''}>
                                    <option value="Pending" ${c.r2 === 'Pending' ? 'selected' : ''}>Pending</option>
                                    <option value="Cleared" ${c.r2 === 'Cleared' ? 'selected' : ''}>Cleared</option>
                                    <option value="On Hold" ${c.r2 === 'On Hold' ? 'selected' : ''}>On Hold</option>
                                    <option value="Rejected" ${c.r2 === 'Rejected' ? 'selected' : ''}>Rejected</option>
                                </select>
                            </div>
                            <div class="round-group">
                                <span>Final:</span>
                                <select class="round-select" onchange="updateCandidateRound('${c.id}', 'final', this.value)">
                                    <option value="Pending" ${c.final === 'Pending' ? 'selected' : ''}>Pending</option>
                                    <option value="In Progress" ${c.final === 'In Progress' ? 'selected' : ''}>In Progress</option>
                                    <option value="On Hold" ${c.final === 'On Hold' ? 'selected' : ''}>On Hold</option>
                                    <option value="Selected" ${c.final === 'Selected' ? 'selected' : ''}>Selected</option>
                                    <option value="Rejected" ${c.final === 'Rejected' ? 'selected' : ''}>Rejected</option>
                                </select>
                            </div>
                        </div>

                        ${dropdownHtml}
                    </div>
                    `;
                }).join('');
            }

            // Render On-Hold Review Queue
            if (holdQueue.length === 0) {
                holdList.innerHTML = `<div class="empty-state" style="padding: 15px;">No candidates currently on hold.</div>`;
            } else {
                holdList.innerHTML = holdQueue.map(c => `
                    <div class="card" style="margin-bottom: 10px; border-left: 4px solid var(--warning); background: #fffbeb;">
                        <div class="card-top" style="margin-bottom: 4px;">
                            <div>
                                <div class="card-title">👤 ${c.name}</div>
                                <span class="on-hold-badge">⏸️ On Hold (${c.r1 === 'On Hold' ? 'Round 1' : 'Round 2'})</span>
                            </div>
                            <span class="badge badge-${c.skill.toLowerCase()}">${c.skill}</span>
                        </div>
                        <div style="display: flex; gap: 8px; margin-top: 10px;">
                            <button class="btn-sm btn-success" onclick="adminApproveHold('${c.id}')">✅ Move Ahead</button>
                            <button class="btn-sm btn-danger" onclick="adminRejectHold('${c.id}')">❌ Reject</button>
                        </div>
                    </div>
                `).join('');
            }

            // Completed / selected history. These candidates intentionally leave the active
            // waiting queue, but remain visible here so R2 completion never looks like data loss.
            const completedCandidates = queue.filter(c => c.interviewDate === getActiveInterviewDate() && c.status === 'COMPLETED' && c.final === 'Selected' && !isRejectedCandidate(c) && c.status !== 'REMOVED' && candidateNameMatches(c, 'searchCompletedCandidate'));
            const completedList = document.getElementById('completedQueueList');
            const completedCount = document.getElementById('completedQueueCount');
            completedCount.innerText = completedCandidates.length;
            if (completedCandidates.length === 0) {
                completedList.innerHTML = `<div class="empty-state" style="padding: 15px;">No completed / selected candidates yet.</div>`;
            } else {
                completedList.innerHTML = completedCandidates.map(c => `
                    <div class="card" style="margin-bottom: 10px; border-left: 4px solid var(--success); background: #f0fdf4;">
                        <div class="card-top" style="margin-bottom: 4px;">
                            <div>
                                <div class="card-title">👤 ${c.name}</div>
                                <div class="card-subtitle">${c.skill} · R1: ${c.r1} · R2: ${c.r2}</div>
                            </div>
                            <span class="cleared-badge">✅ Selected</span>
                        </div>
                    </div>
                `).join('');
            }

            // Rejected history across every round. Rejected candidates are never put back into
            // the waiting queue, but their record remains available for audit/review.
            const rejectedCandidates = queue.filter(c => c.interviewDate === getActiveInterviewDate() && isRejectedCandidate(c) && c.status !== 'REMOVED' && candidateNameMatches(c, 'searchRejectedCandidate'));
            const rejectedList = document.getElementById('rejectedQueueList');
            const rejectedCount = document.getElementById('rejectedQueueCount');
            rejectedCount.innerText = rejectedCandidates.length;
            if (rejectedCandidates.length === 0) {
                rejectedList.innerHTML = `<div class="empty-state" style="padding: 15px;">No rejected candidates yet.</div>`;
            } else {
                rejectedList.innerHTML = rejectedCandidates.map(c => `
                    <div class="card" style="margin-bottom: 10px; border-left: 4px solid var(--danger); background: #fef2f2;">
                        <div class="card-top" style="margin-bottom: 4px;">
                            <div>
                                <div class="card-title">👤 ${c.name}</div>
                                <div class="card-subtitle">${c.skill} · Rejected in ${rejectedRoundLabel(c)}</div>
                            </div>
                            <span class="badge" style="background: #fee2e2; color: var(--danger);">❌ Rejected</span>
                        </div>
                        ${getCandidateRoundPanelistMarkup(c)}
</div>
                `).join('');
            }
        }


        function getCandidateRoundDisplay(candidate) {
            if (!candidate) return "Round 1";
            return (candidate.currentRound === 2 || candidate.r1 === 'Cleared') ? "Round 2" : "Round 1";
        }

        function getPanelistCurrentRound(panelist) {
            const candidate = panelist && panelist.currentCandidateId
                ? queue.find(c => c.id === panelist.currentCandidateId)
                : null;
            return getCandidateRoundDisplay(candidate);
        }

        function renderPanelists() {
            const statusFilter = document.getElementById('filterPanelistStatus').value;
            const activeDate = getActiveInterviewDate();
            let filteredPanelists = panelists.filter(
                p => p.interviewDate === activeDate &&
                     (!statusFilter || p.status === statusFilter)
            );
            
            filteredPanelists = sortPanelistsByAvailability(filteredPanelists);
            const list = document.getElementById('panelistList');
            
            if (filteredPanelists.length === 0) {
                list.innerHTML = `
                    <div class="empty-state">
                        No panelists onboarded for interview session <strong>${activeDate}</strong>.
                        <div style="margin-top:6px;font-size:11px;color:var(--text-muted);">
                            Add/import panelists above to create the fresh roster for this session.
                        </div>
                    </div>`;
                return;
            }

            list.innerHTML = filteredPanelists.map(p => {
                let borderLeftColor = p.status === 'BUSY' ? 'var(--danger)' : (p.status === 'BREAK' ? 'var(--warning-bg)' : 'var(--success)');
                const freeTimeStr = calculatePanelistFreeTime(p);

                return `
                <div class="card" style="border-left: 5px solid ${borderLeftColor};">
                    <div>
                        <div class="card-top">
                            <div>
                                <div class="card-title">${p.name}</div>
                                <div class="meta-badges">
                                    <span class="level-badge">${p.level}</span>
                                    <span class="location-badge">📍 ${p.location}</span>
                                </div>
                            </div>
                            <span class="badge badge-${p.skill.toLowerCase()}">${p.skill}</span>
                        </div>
                        
                        <div style="margin: 12px 0 6px 0; font-size: 13px;">
                            <div style="margin-bottom: 4px; color: var(--text-muted); font-size: 12px; display: flex; justify-content: space-between;">
                                <span>Completed Today: <strong>${p.completed}</strong></span>
                                <!-- <span style="color: var(--purple);">R1: <strong>${getRoundActivitySummaryForPanelist(p.id).r1}</strong> · R2: <strong>${getRoundActivitySummaryForPanelist(p.id).r2}</strong></span> -->
                                 <!-- <span style="color: var(--purple);">R1: <strong>${getRoundActivitySummaryForPanelist(p.id).r1}</strong> · R2: <strong>${getRoundActivitySummaryForPanelist(p.id).r2}</strong></span> -->
                                <span style="color: var(--primary);">Est. Free: <strong>${freeTimeStr}</strong></span>
                            </div>
                            ${p.status === 'BUSY' ? `
                                <div class="status-busy">🎙️ Interviewing: <span style="color:var(--text-main); font-weight:normal;">${p.currentCandidate}</span></div>
                                <div style="margin-top: 4px; font-size: 12px; font-weight: 800; color: var(--primary);">
                                    📋 Current Round: ${getPanelistCurrentRound(p)}
                                </div>
                                <div id="timer_box_${p.id}" class="timer-box timer-normal">
                                    <span id="timer_val_${p.id}">⏱️ Calculating...</span>
                                    <button class="btn-ff" onclick="fastForwardTimer('${p.id}')" title="Test: Fast-forward 10 mins">⏩ +10m</button>
                                </div>
                                ${p.nextCandidate ? `
                                    <div class="next-queue-badge">
                                        <span>⏳ <strong>Next in Line:</strong> ${p.nextCandidate}</span>
                                        <button class="btn-ff" onclick="removeNextQueue('${p.id}')" title="Remove next-in-line">✕</button>
                                    </div>
                                ` : `<div style="font-size: 11px; color: var(--text-muted); margin-top: 6px; font-style: italic;">No candidate queued next.</div>`}
                            ` : ''}
                            ${p.status === 'AVAILABLE' ? `<div class="status-available">✅ Available in ${p.location}</div>` : ''}
                            ${p.status === 'BREAK' ? `<div class="status-break">☕ Temporarily On Break</div>` : ''}
                        </div>
                    </div>
                    
                    <div class="action-buttons">
                        ${p.status === 'BUSY' ? `
                            <button class="btn-sm btn-ready" onclick="changePanelistStatus('${p.id}', 'AVAILABLE', ${p.completed})">Finish Interview & Evaluate</button>
                            <button class="btn-sm btn-break" onclick="changePanelistStatus('${p.id}', 'BREAK', ${p.completed})">Finish & Take Break</button>
                        ` : ''}
                        ${p.status === 'AVAILABLE' ? `
                            <button class="btn-sm btn-break" onclick="changePanelistStatus('${p.id}', 'BREAK', ${p.completed})">Pause for Break</button>
                        ` : ''}
                        ${p.status === 'BREAK' ? `
                            <button class="btn-sm btn-ready" onclick="changePanelistStatus('${p.id}', 'AVAILABLE', ${p.completed})">Resume Shifts</button>
                        ` : ''}
                        <button class="btn-sm btn-remove" title="Remove interviewer" onclick="removePanelist('${p.id}')">✕</button>
                    </div>
                </div>
                `;
            }).join('');
        }

        function renderPanelistPortal() {
            const portalList = document.getElementById('panelistPortalCards');
            const sessionPanelists = panelists.filter(p => p.interviewDate === getActiveInterviewDate());
            if (sessionPanelists.length === 0) {
                portalList.innerHTML = `<div class="empty-state">No interviewers registered in the system yet. Ask an HR Admin to onboard panelists first.</div>`;
                return;
            }

            const sortedPanelists = sortPanelistsByAvailability(sessionPanelists);

            portalList.innerHTML = sortedPanelists.map(p => {
                let borderLeftColor = p.status === 'BUSY' ? 'var(--danger)' : (p.status === 'BREAK' ? 'var(--warning-bg)' : 'var(--success)');
                const freeTimeStr = calculatePanelistFreeTime(p);

                return `
                <div class="card" style="border-left: 5px solid ${borderLeftColor}; background: #fafafa;">
                    <div>
                        <div class="card-top">
                            <div>
                                <div class="card-title" style="font-size: 17px;">${p.name}</div>
                                <div class="meta-badges" style="margin-top: 4px;">
                                    <span class="level-badge">${p.level}</span>
                                    <span class="location-badge">📍 ${p.location}</span>
                                </div>
                            </div>
                            <span class="badge badge-${p.skill.toLowerCase()}">${p.skill}</span>
                        </div>
                        
                        <div style="margin: 14px 0 10px 0; font-size: 14px;">
                            <div style="margin-bottom: 6px; color: var(--text-muted); display: flex; justify-content: space-between;">
                                <span>Interviews Completed: <strong>${p.completed}</strong></span>
                                <span style="color: var(--primary);">Est. Free: <strong>${freeTimeStr}</strong></span>
                            </div>
                            ${p.status === 'BUSY' ? `
                                <div class="status-busy" style="font-size: 14px;">🎙️ Active Interview: <span style="color:var(--text-main); font-weight:normal;">${p.currentCandidate}</span></div>
                                ${p.nextCandidate ? `
                                    <div class="next-queue-badge" style="margin-top: 8px;">
                                        <span>⏳ <strong>Queued Next:</strong> ${p.nextCandidate}</span>
                                    </div>
                                ` : ''}
                            ` : ''}
                            ${p.status === 'AVAILABLE' ? `<div class="status-available" style="font-size: 14px;">✅ Status: Ready to receive candidates</div>` : ''}
                            ${p.status === 'BREAK' ? `<div class="status-break" style="font-size: 14px;">☕ Status: On Break</div>` : ''}
                        </div>
                    </div>
                    
                    <div class="action-buttons" style="margin-top: 15px;">
                        ${p.status === 'BUSY' ? `
                            <button class="btn-sm btn-ready" style="padding: 10px; font-size: 13px;" onclick="changePanelistStatus('${p.id}', 'AVAILABLE', ${p.completed})">Finish Interview & Evaluate</button>
                            <button class="btn-sm btn-break" style="padding: 10px; font-size: 13px;" onclick="changePanelistStatus('${p.id}', 'BREAK', ${p.completed})">Finish & Take Break</button>
                        ` : ''}
                        ${p.status === 'AVAILABLE' ? `
                            <button class="btn-sm btn-break" style="padding: 10px; font-size: 13px;" onclick="changePanelistStatus('${p.id}', 'BREAK', ${p.completed})">☕ Take a Break</button>
                        ` : ''}
                        ${p.status === 'BREAK' ? `
                            <button class="btn-sm btn-ready" style="padding: 10px; font-size: 13px;" onclick="changePanelistStatus('${p.id}', 'AVAILABLE', ${p.completed})">✅ I'm Back & Ready</button>
                        ` : ''}
                    </div>
                </div>
                `;
            }).join('');
        }

        function renderTelemetryStats() {
            const activeDate = getActiveInterviewDate();
            const sessionPanelists = panelists.filter(p => p.interviewDate === activeDate);

            document.getElementById('statAvail').innerText = `${sessionPanelists.filter(p => p.status === 'AVAILABLE').length} Avail`;
            document.getElementById('statBusy').innerText = `${sessionPanelists.filter(p => p.status === 'BUSY').length} Busy`;
            document.getElementById('statBreak').innerText = `${sessionPanelists.filter(p => p.status === 'BREAK').length} On Break`;
        }


        document.addEventListener('keydown', e => {
            if (e.key !== 'Escape') return;
            const ids = ['searchQueueCandidate', 'searchHoldCandidate', 'searchCompletedCandidate', 'searchRejectedCandidate'];
            const active = document.activeElement;
            if (active && ids.includes(active.id)) {
                active.value = '';
                renderQueue();
            }
        });

        // Initialize App
        initializeActiveInterviewDate();

        function changePanelistStatus(panelistId, newStatus, completedCount) {
            const panelist = panelists.find(p => p.id === panelistId);
            if (!panelist) return;

            if (panelist.status === 'BUSY' && panelist.currentCandidate) {
                openEvalModal(panelist, newStatus, panelist.completed);
                return;
            }

            const confirmationMessage = newStatus === 'BREAK'
                ? `Put ${panelist.name} ON BREAK?`
                : `Set ${panelist.name} as READY / AVAILABLE?`;

            if (!confirm(confirmationMessage)) return;

            if (newStatus === 'AVAILABLE') {
                panelist.status = 'AVAILABLE';
                if (!startNextCandidateIfAvailable(panelist)) {
                    checkRoutingMode();
                }
            } else if (newStatus === 'BREAK') {
                panelist.status = 'BREAK';
            } else {
                panelist.status = newStatus;
            }
            savePanelist(panelist);
            renderAll();
        }

        function openEvalModal(panelist, targetNextStatus, completedCount) {
            const candidate = queue.find(c => c.id === panelist.currentCandidateId);
            if (!candidate) {
                alert(`Unable to find the active candidate for ${panelist.name}. The interview cannot be completed safely.`);
                return;
            }
            ensureCandidateWorkflow(candidate);

            const candidateName = candidate.name;
            const activeRound = candidateRoundLabel(candidate);

            activeEvalContext = {
                panelistId: panelist.id,
                candidateId: candidate.id,
                candidateName,
                activeRound,
                targetNextStatus,
                completedCount: Number.isFinite(completedCount) ? completedCount : panelist.completed,
                roundNumber: candidate.currentRound
            };

            const evalModalBody = document.getElementById('evalModalBody');
            const isRound2 = candidate.currentRound === 2;
            evalModalBody.innerHTML = `
                <div style="background: #f8fafc; border: 1px solid var(--border-color); padding: 12px 16px; border-radius: 8px; margin-bottom: 16px;">
                    <div style="font-size: 15px; font-weight: 700; color: var(--text-main);">👤 Candidate: ${candidateName}</div>
                    <div style="font-size: 12px; color: var(--text-muted); margin-top: 2px;">
                        Interviewer: <strong>${panelist.name}</strong> (${panelist.location}) | Evaluating: <strong style="color: var(--primary);">${activeRound}</strong>
                    </div>
                </div>

                <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 10px; font-weight: 600;">
                    Please select the evaluation outcome for ${activeRound}:
                </p>

                <div class="eval-option-grid">
                    <div class="eval-btn-card selected-btn" onclick="submitCandidateEvaluation('SELECT')">
                        <span style="font-size: 22px;">✅</span>
                        <strong style="font-size: 13px; color: var(--success);">${isRound2 ? 'Select / Finalize' : 'Select / Pass'}</strong>
                        <span style="font-size: 11px; color: var(--text-muted);">${isRound2 ? 'Complete the interview track' : 'Clear Round 1 and queue for Round 2'}</span>
                    </div>

                    <div class="eval-btn-card hold-btn" onclick="submitCandidateEvaluation('HOLD')">
                        <span style="font-size: 22px;">⏸️</span>
                        <strong style="font-size: 13px; color: var(--warning);">Put On Hold</strong>
                        <span style="font-size: 11px; color: var(--text-muted);">Admin will decide whether to advance</span>
                    </div>

                    <div class="eval-btn-card reject-btn" onclick="submitCandidateEvaluation('REJECT')">
                        <span style="font-size: 22px;">❌</span>
                        <strong style="font-size: 13px; color: var(--danger);">Reject</strong>
                        <span style="font-size: 11px; color: var(--text-muted);">End interview track for candidate</span>
                    </div>
                </div>

                <div style="margin-top: 15px;">
                    <label style="font-size: 12px; font-weight: 600; color: var(--text-muted);">Feedback / Notes (Optional):</label>
                    <textarea id="evalNotesInput" rows="3" style="width: 100%; margin-top: 4px;" placeholder="Add quick interviewer evaluation notes..."></textarea>
                </div>
            `;

            document.getElementById('evalModal').style.display = 'flex';
        }

        function closeEvalModal() {
            document.getElementById('evalModal').style.display = 'none';
            activeEvalContext = null;
        }

        function submitCandidateEvaluation(decision) {
            if (!activeEvalContext) return;

            const ctx = activeEvalContext;
            const panelist = panelists.find(p => p.id === ctx.panelistId);
            const candidate = queue.find(c => c.id === ctx.candidateId);
            if (!panelist || !candidate) {
                closeEvalModal();
                renderAll();
                return;
            }

            ensureCandidateWorkflow(candidate);
            const notesInput = document.getElementById('evalNotesInput');
            const notes = notesInput ? notesInput.value.trim() : '';
            if (notes) {
                candidate.evaluationNotes.push({
                    round: ctx.roundNumber,
                    interviewerId: panelist.id,
                    interviewer: panelist.name,
                    timestamp: new Date().toISOString(),
                    note: notes
                });
            }

            const activeRound = ctx.roundNumber;
            if (activeRound === 1) {
                if (decision === 'SELECT') {
                    candidate.r1 = 'Cleared';
                    candidate.r2 = 'Pending';
                    candidate.currentRound = 2;
                    candidate.final = 'In Progress';
                    setCandidateWaiting(candidate, 2);
                } else if (decision === 'HOLD') {
                    candidate.r1 = 'On Hold';
                    candidate.currentRound = 1;
                    candidate.status = 'ON_HOLD';
                    candidate.assignedPanelistId = null;
                    candidate.queuedPanelistId = null;
                    candidate.final = 'On Hold';
                } else if (decision === 'REJECT') {
                    candidate.r1 = 'Rejected';
                    candidate.r2 = 'Pending';
                    candidate.currentRound = 1;
                    candidate.rejectedRound = 1;
                    finalizeCandidate(candidate, 'Rejected');
                }
            } else {
                if (decision === 'SELECT') {
                    candidate.r2 = 'Cleared';
                    candidate.currentRound = 2;
                    finalizeCandidate(candidate, 'Selected');
                } else if (decision === 'HOLD') {
                    candidate.r2 = 'On Hold';
                    candidate.currentRound = 2;
                    candidate.status = 'ON_HOLD';
                    candidate.assignedPanelistId = null;
                    candidate.queuedPanelistId = null;
                    candidate.final = 'On Hold';
                } else if (decision === 'REJECT') {
                    candidate.r2 = 'Rejected';
                    candidate.currentRound = 2;
                    candidate.rejectedRound = 2;
                    finalizeCandidate(candidate, 'Rejected');
                }
            }

            // Persist the panelist who actually conducted this round on the candidate itself.
            if (activeRound === 1) {
                candidate.round1PanelistId = panelist.id;
            } else if (activeRound === 2) {
                candidate.round2PanelistId = panelist.id;
            }

            const historyDecision =
                decision === 'SELECT' ? 'SELECTED' :
                decision === 'HOLD' ? 'ON_HOLD' :
                'REJECTED';
            completeInterviewHistoryRecord(panelist, candidate, historyDecision, notes);

            panelist.completed = (Number(panelist.completed) || 0) + 1;
            panelist.currentCandidate = null;
            panelist.currentCandidateId = null;
            panelist.startTime = null;

            // If the interviewer is returning to AVAILABLE, immediately start the
            // reserved next candidate. If taking a break, keep the reservation intact.
            if (ctx.targetNextStatus === 'AVAILABLE') {
                panelist.status = 'AVAILABLE';
                if (!startNextCandidateIfAvailable(panelist)) {
                    checkRoutingMode();
                }
            } else {
                panelist.status = ctx.targetNextStatus;
            }

            saveCandidate(candidate);
            savePanelist(panelist);
            recordCandidateStatusChange(candidate.id, 'IN_PROGRESS', candidate.status, activeRound, `Evaluation: ${historyDecision}`);

            closeEvalModal();
            renderAll();
        }

        // Admin Decision Controls for On-Hold Candidates
        function adminApproveHold(candidateId) {
            const c = queue.find(x => x.id === candidateId);
            if (!c) return;
            ensureCandidateWorkflow(c);

            if (!confirm(`Approve "${c.name}" and advance the candidate?`)) return;

            if (c.r1 === 'On Hold') {
                c.r1 = 'Cleared';
                c.r2 = 'Pending';
                c.currentRound = 2;
                c.final = 'In Progress';
                setCandidateWaiting(c, 2);
            } else if (c.r2 === 'On Hold') {
                // Round 2 is the final interview round in this application.
                // Approval therefore completes the candidate instead of sending them back to R2.
                c.r2 = 'Cleared';
                c.currentRound = 2;
                finalizeCandidate(c, 'Selected');
            } else {
                return;
            }

            saveCandidate(c);
            recordCandidateStatusChange(c.id, 'ON_HOLD', c.status, c.currentRound, 'Admin approved hold');
            checkRoutingMode();
            renderAll();
        }

        function adminRejectHold(candidateId) {
            const c = queue.find(x => x.id === candidateId);
            if (!c) return;

            if (confirm(`Reject candidate "${c.name}"?`)) {
                ensureCandidateWorkflow(c);
                if (c.r1 === 'On Hold') c.r1 = 'Rejected';
                if (c.r2 === 'On Hold') c.r2 = 'Rejected';
                finalizeCandidate(c, 'Rejected');
                saveCandidate(c);
                recordCandidateStatusChange(c.id, 'ON_HOLD', c.status, c.currentRound, 'Admin rejected hold');
                renderAll();
            }
        }

        // Manual Assignment & Fast-Forward Controls
        function assignManually(candidateId) {
            const selectEl = document.getElementById(`select_assign_${candidateId}`);
            const panelistId = selectEl ? selectEl.value : null;
            if (!panelistId) { alert("Please select an interviewer from the dropdown first."); return; }

            const candidate = queue.find(c => c.id === candidateId);
            const panelist = panelists.find(p => p.id === panelistId);
            if (!candidate || !panelist) return;
            if (candidate.interviewDate !== getActiveInterviewDate() || panelist.interviewDate !== getActiveInterviewDate()) {
                alert('Candidate and panelist must belong to the active interview session date.');
                return;
            }
            ensureCandidateWorkflow(candidate);

            if (candidate.status !== 'WAITING') {
                alert(`Candidate "${candidate.name}" is not currently available for assignment.`);
                return;
            }

            if (panelist.status === 'BREAK') {
                alert(`${panelist.name} is on break. Resume the shift before assigning a candidate.`);
                return;
            }

            if (panelist.status === 'BUSY') {
                if (panelist.nextCandidateId) {
                    const queued = getQueuedCandidate(panelist);
                    alert(`${panelist.name} already has ${queued ? `"${queued.name}"` : 'a candidate'} queued next. Complete or remove that candidate first.`);
                    return;
                }
                if (!confirm(`Queue "${candidate.name}" as NEXT IN LINE for ${panelist.name}?`)) return;
                panelist.nextCandidate = `${candidate.name} (${candidate.skill})`;
                panelist.nextCandidateId = candidate.id;
                setCandidateQueued(candidate, panelist.id);
                saveCandidate(candidate);
                savePanelist(panelist);
                recordCandidateStatusChange(candidate.id, 'WAITING', candidate.status, candidate.currentRound, `Queued next for ${panelist.name}`);
                renderAll();
                return;
            }

            if (!confirm(`Start the interview immediately with ${panelist.name}?`)) return;
            startCandidateForPanelist(panelist, candidate);
            renderAll();
        }

        function removeNextQueue(panelistId) {
            const p = panelists.find(x => x.id === panelistId);
            if (!p || !p.nextCandidateId) return;
            const queuedCandidate = queue.find(c => c.id === p.nextCandidateId);
            const queuedName = queuedCandidate ? queuedCandidate.name : p.nextCandidate;
            if (confirm(`Are you sure you want to remove "${queuedName}" from ${p.name}'s next-in-line queue?`)) {
                if (queuedCandidate) {
                    setCandidateWaiting(queuedCandidate, queuedCandidate.currentRound);
                    saveCandidate(queuedCandidate);
                    recordCandidateStatusChange(queuedCandidate.id, 'QUEUED', queuedCandidate.status, queuedCandidate.currentRound, `Removed from ${p.name} next-in-line queue`);
                }
                p.nextCandidate = null;
                p.nextCandidateId = null;
                savePanelist(p);
                checkRoutingMode();
                renderAll();
            }
        }

        function fastForwardTimer(panelistId) {
            const p = panelists.find(x => x.id === panelistId);
            if (p && p.startTime) {
                p.startTime -= (10 * 60 * 1000);
                savePanelist(p);
                updateTimersDOM();
            }
        }

        async function removePanelist(panelistId) {
            const p = panelists.find(x => x.id === panelistId);
            if (!p) return;
            if (!confirm(`Are you sure you want to remove ${p.name}? Any active or queued candidates will be returned to the waiting queue.`)) return;

            const current = p.currentCandidateId ? queue.find(c => c.id === p.currentCandidateId) : null;
            const queued = p.nextCandidateId ? queue.find(c => c.id === p.nextCandidateId) : null;
            const affected = [current, queued].filter(Boolean);
            for (const candidate of affected) {
                setCandidateWaiting(candidate, candidate.currentRound);
                await saveCandidate(candidate);
                await recordCandidateStatusChange(candidate.id, 'IN_PROGRESS', candidate.status, candidate.currentRound, `Panelist ${p.name} removed`);
            }

            const { error } = await supabaseClient.from('panelists').delete().eq('id', panelistId);
            if (error) {
                console.error(error);
                alert(`Unable to remove panelist: ${error.message}`);
                return;
            }
            panelists = panelists.filter(x => x.id !== panelistId);
            checkRoutingMode();
            renderAll();
        }

        // Automatic Skill-Weighted Routing
        document.getElementById('autoRouteToggle').addEventListener('change', () => {
            checkRoutingMode();
            renderAll();
        });

        function checkRoutingMode() {
            if (document.getElementById('autoRouteToggle').checked) attemptAutoRouting();
        }

        function attemptAutoRouting() {
            let madeAssignment = false;
            let availablePanelists = panelists
                .filter(p => p.interviewDate === getActiveInterviewDate() && p.status === 'AVAILABLE')
                .sort((a, b) => (Number(a.completed) || 0) - (Number(b.completed) || 0) || a.name.localeCompare(b.name));

            // First honor explicit next-in-line reservations.
            for (const panelist of availablePanelists) {
                if (startNextCandidateIfAvailable(panelist)) madeAssignment = true;
            }

            availablePanelists = panelists
                .filter(p => p.status === 'AVAILABLE')
                .sort((a, b) => (Number(a.completed) || 0) - (Number(b.completed) || 0) || a.name.localeCompare(b.name));

            for (const panelist of availablePanelists) {
                while (panelist.status === 'AVAILABLE') {
                    const candidateIndex = queue.findIndex(c => {
                        ensureCandidateWorkflow(c);
                        return c.interviewDate === getActiveInterviewDate() && c.status === 'WAITING' && (c.skill === panelist.skill || panelist.skill === 'General');
                    });
                    if (candidateIndex === -1) break;
                    const candidate = queue[candidateIndex];
                    startCandidateForPanelist(panelist, candidate);
                    madeAssignment = true;
                }
            }

            return madeAssignment;
        }

        // Live SLA Timer Loop
        setInterval(updateTimersDOM, 1000);

        function updateTimersDOM() {
            panelists.forEach(p => {
                if (p.status === 'BUSY' && p.startTime) {
                    const el = document.getElementById(`timer_val_${p.id}`);
                    const boxEl = document.getElementById(`timer_box_${p.id}`);
                    if (el && boxEl) {
                        const elapsedSeconds = Math.floor((Date.now() - p.startTime) / 1000);
                        const remainingSeconds = SLA_DURATION_SECONDS - elapsedSeconds;
                        
                        if (remainingSeconds > 300) {
                            const mins = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
                            const secs = (remainingSeconds % 60).toString().padStart(2, '0');
                            el.innerText = `⏱️ ${mins}:${secs} left`;
                            boxEl.className = "timer-box timer-normal";
                        } else if (remainingSeconds >= 0) {
                            const mins = Math.floor(remainingSeconds / 60).toString().padStart(2, '0');
                            const secs = (remainingSeconds % 60).toString().padStart(2, '0');
                            el.innerText = `⚠️ ${mins}:${secs} left (Expiring Soon)`;
                            boxEl.className = "timer-box timer-warning";
                        } else {
                            const overSeconds = Math.abs(remainingSeconds);
                            const mins = Math.floor(overSeconds / 60).toString().padStart(2, '0');
                            const secs = (overSeconds % 60).toString().padStart(2, '0');
                            el.innerText = `🚨 +${mins}:${secs} OVERTIME`;
                            boxEl.className = "timer-box timer-overtime";
                        }
                    }
                }
            });
        }

        // Recruiter View Logic

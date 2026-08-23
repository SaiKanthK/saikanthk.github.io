        async function addCandidate() {
            const nameInput = document.getElementById('candidateNameInput');
            const name = nameInput.value.trim() || 'Anonymous Candidate';
            const skill = document.getElementById('candidateSkill').value;
            const now = new Date();
            const checkInTimestamp = now.toISOString();
            const checkInTime = now.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            const interviewDate = getActiveInterviewDate();

            if (!currentUser) return;
            const payload = {
                name,
                skill,
                interview_date: interviewDate,
                check_in_time: checkInTimestamp,
                status: 'WAITING',
                current_round: 1,
                round1_status: 'Pending',
                round2_status: 'Pending',
                final_decision: 'Pending',
                evaluation_notes: []
            };
            const { data, error } = await withTimeout(supabaseClient.from('candidates').insert(payload).select().single(), DB_REQUEST_TIMEOUT_MS, 'Add candidate');
            if (error) {
                console.error(error);
                alert(`Unable to add candidate: ${error.message}`);
                return;
            }
            queue.push(candidateFromDb(data));
            nameInput.value = '';
            checkRoutingMode();
            renderAll();
        }

        async function addPanelist() {
            const nameInput = document.getElementById('panelistNameInput');
            const locationInput = document.getElementById('panelistLocationInput');
            const levelInput = document.getElementById('panelistLevelInput');
            const name = nameInput.value.trim();
            const location = locationInput.value.trim() || 'Main Desk';
            const level = levelInput.value.trim() || 'L4';
            const skill = document.getElementById('panelistSkill').value;
            if (!name) { alert('Please enter an interviewer name first.'); return; }

            const { data, error } = await withTimeout(supabaseClient.from('panelists').insert({
                name,
                location,
                level,
                skill,
                interview_date: getActiveInterviewDate(),
                status:'AVAILABLE',
                completed_count:0
            }).select().single(), DB_REQUEST_TIMEOUT_MS, 'Add panelist');
            if (error) {
                console.error(error);
                alert(`Unable to add panelist: ${error.message}`);
                return;
            }
            panelists.push(panelistFromDb(data));
            nameInput.value = '';
            locationInput.value = '';
            levelInput.value = '';
            checkRoutingMode();
            renderAll();
        }

        document.getElementById('addCandidateBtn').addEventListener('click', addCandidate);
        document.getElementById('addPanelistBtn').addEventListener('click', addPanelist);

        document.getElementById('candidateNameInput').addEventListener('keypress', e => { if (e.key === 'Enter') addCandidate(); });
        document.getElementById('panelistNameInput').addEventListener('keypress', e => { if (e.key === 'Enter') addPanelist(); });



        async function deleteWaitingCandidate(candidateId) {
            const candidate = queue.find(c => c.id === candidateId);
            if (!candidate) return;

            if (!['ADMIN', 'RECRUITER', 'RECEPTION'].includes(currentProfile?.role)) {
                alert('Only Admin, Recruiter, or Reception users can delete an accidentally added candidate.');
                return;
            }

            ensureCandidateWorkflow(candidate);

            if (candidate.status !== 'WAITING') {
                alert(`"${candidate.name}" can only be permanently deleted while it is in the waiting queue.`);
                return;
            }

            if (candidate.interviewDate !== getActiveInterviewDate()) {
                alert(`"${candidate.name}" belongs to interview session ${candidate.interviewDate || 'another date'}.`);
                return;
            }

            const confirmed = confirm(
                `Permanently delete "${candidate.name}" from this interview session?\n\n` +
                `This is intended for accidental check-ins and cannot be undone.`
            );
            if (!confirmed) return;

            try {
                const { error } = await withTimeout(
                    supabaseClient.rpc('delete_waiting_candidate', {
                        p_candidate_id: candidate.id
                    }),
                    DB_REQUEST_TIMEOUT_MS,
                    'Delete waiting candidate'
                );

                if (error) throw error;

                queue = queue.filter(c => c.id !== candidate.id);

                checkRoutingMode();
                renderAll();
            } catch (error) {
                console.error('Delete waiting candidate failed:', error);
                alert(`Unable to delete candidate: ${error.message || 'Unknown error'}`);
            }
        }

        async function removeCandidateFromQueue(candidateId) {
            const candidate = queue.find(c => c.id === candidateId);
            if (!candidate) return;

            ensureCandidateWorkflow(candidate);

            if (candidate.status !== 'WAITING') {
                alert(`"${candidate.name}" is not currently in the waiting queue.`);
                return;
            }

            if (candidate.interviewDate !== getActiveInterviewDate()) {
                alert(`"${candidate.name}" belongs to the ${candidate.interviewDate || 'other'} interview session.`);
                return;
            }

            if (!confirm(`Remove "${candidate.name}" from the waiting queue for this interview session? The record will be retained in Supabase for audit/history.`)) {
                return;
            }

            const previousStatus = candidate.status;
            candidate.status = 'REMOVED';
            candidate.assignedPanelistId = null;
            candidate.queuedPanelistId = null;
            candidate.final = 'Removed';

            await saveCandidate(candidate);
            await recordCandidateStatusChange(
                candidate.id,
                previousStatus,
                'REMOVED',
                candidate.currentRound,
                'Removed from waiting queue by user'
            );

            checkRoutingMode();
            renderAll();
        }

        // Candidate workflow helpers
        function ensureCandidateWorkflow(candidate) {
            if (!candidate) return;
            if (![1, 2].includes(candidate.currentRound)) {
                candidate.currentRound = candidate.r1 === 'Cleared' ? 2 : 1;
            }
            if (!Array.isArray(candidate.evaluationNotes)) candidate.evaluationNotes = [];
            if (!Object.prototype.hasOwnProperty.call(candidate, 'rejectedRound')) candidate.rejectedRound = null;
            if (!Object.prototype.hasOwnProperty.call(candidate, 'assignedPanelistId')) candidate.assignedPanelistId = null;
            if (!Object.prototype.hasOwnProperty.call(candidate, 'queuedPanelistId')) candidate.queuedPanelistId = null;
            if (!Object.prototype.hasOwnProperty.call(candidate, 'round1PanelistId')) candidate.round1PanelistId = null;
            if (!Object.prototype.hasOwnProperty.call(candidate, 'round2PanelistId')) candidate.round2PanelistId = null;
        }

        function candidateRoundLabel(candidate) {
            ensureCandidateWorkflow(candidate);
            return candidate.currentRound === 2 ? 'Round 2' : 'Round 1';
        }

        function setCandidateWaiting(candidate, roundNumber = null) {
            if (!candidate) return;
            ensureCandidateWorkflow(candidate);
            const round = roundNumber || candidate.currentRound;
            candidate.currentRound = round;
            candidate.status = 'WAITING';
            candidate.assignedPanelistId = null;
            candidate.queuedPanelistId = null;
            candidate.final = round === 2 ? 'In Progress' : (candidate.final === 'Selected' ? 'Pending' : candidate.final || 'Pending');
        }

        function setCandidateQueued(candidate, panelistId) {
            if (!candidate) return;
            ensureCandidateWorkflow(candidate);
            candidate.status = 'QUEUED';
            candidate.queuedPanelistId = panelistId;
            candidate.assignedPanelistId = null;
        }

        function setCandidateInProgress(candidate, panelistId) {
            if (!candidate) return;
            ensureCandidateWorkflow(candidate);
            candidate.status = 'IN_PROGRESS';
            candidate.assignedPanelistId = panelistId;
            candidate.queuedPanelistId = null;
        }

        function finalizeCandidate(candidate, decision) {
            if (!candidate) return;
            ensureCandidateWorkflow(candidate);
            candidate.assignedPanelistId = null;
            candidate.queuedPanelistId = null;
            if (decision === 'SELECT' || decision === 'Selected') {
                candidate.final = 'Selected';
                candidate.status = 'COMPLETED';
                candidate.rejectedRound = null;
            } else if (decision === 'REJECT' || decision === 'Rejected') {
                candidate.final = 'Rejected';
                candidate.status = 'COMPLETED';
                candidate.rejectedRound = candidate.currentRound || (candidate.r1 === 'Cleared' ? 2 : 1);
            }
        }

        function isRejectedCandidate(candidate) {
            return !!candidate && (candidate.final === 'Rejected' || candidate.r1 === 'Rejected' || candidate.r2 === 'Rejected');
        }

        function rejectedRoundLabel(candidate) {
            if (candidate && candidate.rejectedRound === 2) return 'Round 2';
            if (candidate && candidate.rejectedRound === 1) return 'Round 1';
            if (candidate && candidate.r2 === 'Rejected') return 'Round 2';
            if (candidate && candidate.r1 === 'Rejected') return 'Round 1';
            return 'Final';
        }

        function getQueuedCandidate(panelist) {
            if (!panelist || !panelist.nextCandidateId) return null;
            const candidate = queue.find(c => c.id === panelist.nextCandidateId);
            return candidate && candidate.status === 'QUEUED' ? candidate : null;
        }

        function startCandidateForPanelist(panelist, candidate) {
            if (!panelist || !candidate) return false;
            if (candidate.interviewDate !== getActiveInterviewDate() || panelist.interviewDate !== getActiveInterviewDate()) return false;
            ensureCandidateWorkflow(candidate);

            // Record exactly which panelist is conducting this candidate's round.
            const roundNumber = candidate.currentRound || (candidate.r1 === 'Cleared' ? 2 : 1);
            candidate.currentRound = roundNumber;
            if (roundNumber === 1) {
                candidate.round1PanelistId = panelist.id;
            } else if (roundNumber === 2) {
                candidate.round2PanelistId = panelist.id;
            }

            panelist.status = 'BUSY';
            panelist.currentCandidate = `${candidate.name} (${candidate.skill})`;
            panelist.currentCandidateId = candidate.id;
            panelist.startTime = Date.now();
            const previousStatus = candidate.status;
            setCandidateInProgress(candidate, panelist.id);
            createInterviewHistoryRecord(panelist, candidate);
            saveCandidate(candidate);
            savePanelist(panelist);
            recordCandidateStatusChange(candidate.id, previousStatus, candidate.status, roundNumber, `Started ${candidateRoundLabel(candidate)} with ${panelist.name}`);
            return true;
        }

        function startNextCandidateIfAvailable(panelist) {
            const nextCandidate = getQueuedCandidate(panelist);
            if (!nextCandidate) {
                if (panelist) {
                    panelist.nextCandidate = null;
                    panelist.nextCandidateId = null;
                    savePanelist(panelist);
                }
                return false;
            }
            panelist.nextCandidate = null;
            panelist.nextCandidateId = null;
            return startCandidateForPanelist(panelist, nextCandidate);
        }

        function migrateCandidateAndPanelistState() {
            queue.forEach(ensureCandidateWorkflow);

            // Backfill candidate round-panelist fields from interview history so older records
            // are displayed correctly after upgrading the application.
            queue.forEach(candidate => {
                const history = getCandidateInterviewHistory(candidate.id);
                const r1 = history.slice().reverse().find(h => h.round === 1 && h.panelistId);
                const r2 = history.slice().reverse().find(h => h.round === 2 && h.panelistId);
                if (!candidate.round1PanelistId && r1) candidate.round1PanelistId = r1.panelistId;
                if (!candidate.round2PanelistId && r2) candidate.round2PanelistId = r2.panelistId;
            });

            panelists.forEach(p => {
                if (!Object.prototype.hasOwnProperty.call(p, 'nextCandidateId')) p.nextCandidateId = null;
                if (!Object.prototype.hasOwnProperty.call(p, 'startTime')) p.startTime = null;
                if (!Object.prototype.hasOwnProperty.call(p, 'completed')) p.completed = 0;
                if (!Object.prototype.hasOwnProperty.call(p, 'activeInterviewId')) p.activeInterviewId = null;
            });

            // Repair/derive queued candidate IDs from legacy display-only state where possible.
            panelists.forEach(p => {
                if (!p.nextCandidateId && p.nextCandidate) {
                    const match = queue.find(c => c.status === 'QUEUED' && p.nextCandidate.includes(c.name));
                    if (match) p.nextCandidateId = match.id;
                }
                if (p.currentCandidateId) {
                    const current = queue.find(c => c.id === p.currentCandidateId);
                    if (current) {
                        setCandidateInProgress(current, p.id);
                        if (!p.activeInterviewId) {
                            const existing = interviewHistory.find(h => h.panelistId === p.id && h.candidateId === current.id && h.decision === 'IN_PROGRESS');
                            if (existing) {
                                p.activeInterviewId = existing.id;
                            } else {
                                const record = createInterviewHistoryRecord(p, current);
                                if (p.startTime) record.startedAt = new Date(p.startTime).toISOString();
                            }
                        }
                    }
                }
                const queued = getQueuedCandidate(p);
                if (queued) setCandidateQueued(queued, p.id);
            });
        }

        // Update Round Manual Actions
        function updateCandidateRound(candidateId, roundKey, value) {
            const candidate = queue.find(c => c.id === candidateId);
            if (!candidate) return;
            ensureCandidateWorkflow(candidate);

            if (roundKey === 'r2' && value !== 'Pending' && candidate.r1 !== 'Cleared') {
                alert(`⚠️ PREREQUISITE REQUIRED: Candidate "${candidate.name}" must clear Round 1 before taking Round 2.`);
                renderAll();
                return;
            }

            const roundLabel = roundKey === 'r1' ? 'Round 1' : (roundKey === 'r2' ? 'Round 2' : 'Final Decision');
            if (!confirm(`Are you sure you want to set ${roundLabel} to "${value}" for "${candidate.name}"?`)) {
                renderAll();
                return;
            }

            candidate[roundKey] = value;

            if (roundKey === 'r1') {
                if (value === 'Cleared') {
                    candidate.r2 = candidate.r2 === 'Rejected' ? 'Pending' : candidate.r2;
                    candidate.currentRound = 2;
                    candidate.status = 'WAITING';
                    candidate.assignedPanelistId = null;
                    candidate.queuedPanelistId = null;
                    candidate.final = 'In Progress';
                } else if (value === 'On Hold') {
                    candidate.currentRound = 1;
                    candidate.status = 'ON_HOLD';
                    candidate.assignedPanelistId = null;
                    candidate.queuedPanelistId = null;
                    candidate.final = 'On Hold';
                } else if (value === 'Rejected') {
                    candidate.currentRound = 1;
                    candidate.rejectedRound = 1;
                    candidate.r2 = 'Pending';
                    finalizeCandidate(candidate, 'Rejected');
                } else if (value === 'Pending') {
                    candidate.currentRound = 1;
                    candidate.r2 = 'Pending';
                    candidate.final = 'Pending';
                    setCandidateWaiting(candidate, 1);
                }
            } else if (roundKey === 'r2') {
                if (value === 'Cleared') {
                    candidate.currentRound = 2;
                    finalizeCandidate(candidate, 'Selected');
                } else if (value === 'Rejected') {
                    candidate.currentRound = 2;
                    candidate.rejectedRound = 2;
                    finalizeCandidate(candidate, 'Rejected');
                } else if (value === 'On Hold') {
                    candidate.currentRound = 2;
                    candidate.status = 'ON_HOLD';
                    candidate.assignedPanelistId = null;
                    candidate.queuedPanelistId = null;
                    candidate.final = 'On Hold';
                } else if (value === 'Pending') {
                    candidate.currentRound = 2;
                    candidate.r2 = 'Pending';
                    candidate.final = 'In Progress';
                    setCandidateWaiting(candidate, 2);
                }
            } else if (roundKey === 'final') {
                if (value === 'Selected') {
                    finalizeCandidate(candidate, 'Selected');
                } else if (value === 'Rejected') {
                    finalizeCandidate(candidate, 'Rejected');
                } else if (value === 'On Hold') {
                    candidate.status = 'ON_HOLD';
                    candidate.assignedPanelistId = null;
                    candidate.queuedPanelistId = null;
                } else if (value === 'In Progress') {
                    const round = candidate.r1 === 'Cleared' ? 2 : 1;
                    setCandidateWaiting(candidate, round);
                    candidate.final = 'In Progress';
                } else if (value === 'Pending') {
                    const round = candidate.r1 === 'Cleared' ? 2 : 1;
                    setCandidateWaiting(candidate, round);
                    candidate.final = 'Pending';
                }
            }

            saveCandidate(candidate);
            recordCandidateStatusChange(candidate.id, null, candidate.status, candidate.currentRound, `Manual ${roundLabel} update`);
            checkRoutingMode();
            renderAll();
        }

        // ================= FEATURE: EVALUATION MODAL & WORKFLOW =================

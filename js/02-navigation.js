        function switchView(viewName) {
            if (currentProfile) {
                const allowed = {
                    ADMIN: ['admin', 'recruiter', 'portal'],
                    RECRUITER: ['recruiter'],
                    RECEPTION: ['admin'],
                    PANELIST: ['portal']
                };
                const allowedViews = allowed[currentProfile.role] || [];
                if (!allowedViews.includes(viewName)) {
                    if (allowedViews.length) viewName = allowedViews[0];
                    else return;
                }
            }

            const adminBtn = document.getElementById('navAdminBtn');
            const recruiterBtn = document.getElementById('navRecruiterBtn');
            const portalBtn = document.getElementById('navPortalBtn');
            
            const adminContainer = document.getElementById('adminViewContainer');
            const recruiterContainer = document.getElementById('recruiterViewContainer');
            const portalContainer = document.getElementById('panelistPortalView');

            adminBtn.className = "view-btn";
            recruiterBtn.className = "view-btn";
            portalBtn.className = "view-btn";

            adminContainer.style.display = "none";
            recruiterContainer.style.display = "none";
            portalContainer.style.display = "none";

            if (viewName === 'admin') {
                adminBtn.className = "view-btn active";
                adminContainer.style.display = "block";
            } else if (viewName === 'recruiter') {
                recruiterBtn.className = "view-btn active";
                recruiterContainer.style.display = "block";
                renderRecruiterView();
            } else {
                portalBtn.className = "view-btn active";
                portalContainer.style.display = "block";
                renderPanelistPortal();
            }
        }

        // Modals Controller
        function openFloorMapModal() {
            renderFloorMap();
            document.getElementById('floorMapModal').style.display = 'flex';
        }
        function closeFloorMapModal() {
            document.getElementById('floorMapModal').style.display = 'none';
        }
        function openEodModal() {
            if (currentProfile?.role === 'PANELIST') {
                alert('EOD reports are available only to Admin, Recruiter, and Reception users.');
                return;
            }
            renderEodReport();
            document.getElementById('eodModal').style.display = 'flex';
        }
        function closeEodModal() {
            document.getElementById('eodModal').style.display = 'none';
        }
        function closeOnOutsideClick(e, modalId) {
            if (e.target === document.getElementById(modalId)) {
                document.getElementById(modalId).style.display = 'none';
            }
        }

        // Floor Map Renderer
        function renderFloorMap() {
            const mapContainer = document.getElementById('floorMapContainer');
            const activeDate = getActiveInterviewDate();
            const sessionPanelists = panelists.filter(p => p.interviewDate === activeDate);

            if (sessionPanelists.length === 0) {
                mapContainer.innerHTML = `
                    <div class="empty-state">
                        No interviewers/rooms onboarded for session ${activeDate}.
                    </div>`;
                return;
            }

            mapContainer.innerHTML = sessionPanelists.map(p => {
                let statusClass = 'available';
                let statusText = '✅ Available';
                if (p.status === 'BUSY') {
                    statusClass = 'occupied';
                    statusText = '🎙️ Occupied (Busy)';
                } else if (p.status === 'BREAK') {
                    statusClass = 'on-break';
                    statusText = '☕ On Break';
                }

                const freeTimeStr = calculatePanelistFreeTime(p);

                return `
                <div class="map-room-card ${statusClass}">
                    <div style="font-weight: 700; font-size: 15px; margin-bottom: 2px;">📍 ${p.location}</div>
                    <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 6px;">Interviewer: <strong>${p.name}</strong> <span class="level-badge">${p.level}</span> [${p.skill}]</div>
                    <div style="font-size: 12px; font-weight: 600; margin-bottom: 4px;">Status: ${statusText}</div>
                    ${p.status === 'BUSY' ? `
                        <div style="font-size: 12px; margin-top: 4px;"><strong>Current:</strong> ${p.currentCandidate}</div>
                        <div style="font-size: 12px; margin-top: 2px; color: var(--primary);"><strong>Round:</strong> ${getPanelistCurrentRound(p)}</div>
                    ` : ''}
                    ${p.nextCandidate ? `<div style="font-size: 12px; margin-top: 4px; color: var(--primary);"><strong>Next in Line:</strong> ${p.nextCandidate}</div>` : ''}
                    <div style="font-size: 12px; margin-top: 6px; padding-top: 6px; border-top: 1px dashed #cbd5e1; font-weight: 600; color: #1e293b;">
                        ⏳ Est. Free Time: ${freeTimeStr}
                    </div>
                </div>
                `;
            }).join('');
        }

        // EOD Report Renderer
        function getAvailableEodDates() {
            const dates = [...new Set([
                ...queue.map(c => c.interviewDate),
                ...panelists.map(p => p.interviewDate),
                ...interviewHistory.map(h => h.interviewDate)
            ].filter(Boolean))];
            const today = getTodayFormattedDate();
            if (!dates.includes(today)) dates.push(today);
            return dates.sort((a, b) => b.localeCompare(a));
        }

        function populateEodDateSelector() {
            const select = document.getElementById('eodReportDate');
            if (!select) return;

            const dates = getAvailableEodDates();
            const current = select.value || getTodayFormattedDate();

            select.innerHTML = dates.map(date => {
                const label = new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric'
                });
                return `<option value="${date}">${label}</option>`;
            }).join('');

            select.value = dates.includes(current) ? current : dates[0];

            const hint = document.getElementById('eodHistoryHint');
            if (hint) {
                hint.innerText = `${dates.length} report date${dates.length === 1 ? '' : 's'} available from candidate data.`;
            }
        }

        function renderEodReport() {
            populateEodDateSelector();

            const dateSelect = document.getElementById('eodReportDate');
            const selectedDate = dateSelect && dateSelect.value
                ? dateSelect.value
                : getTodayFormattedDate();

            const reportCandidates = queue.filter(c =>
                (c.interviewDate || getTodayFormattedDate()) === selectedDate
            );

            const totalWalkins = reportCandidates.length;
            const clearedR1 = reportCandidates.filter(c => c.r1 === 'Cleared').length;
            const clearedR2 = reportCandidates.filter(c => c.r2 === 'Cleared').length;
            const selected = reportCandidates.filter(c => c.final === 'Selected').length;
            const rejected = reportCandidates.filter(c =>
                c.r1 === 'Rejected' || c.r2 === 'Rejected' || c.final === 'Rejected'
            ).length;

            document.getElementById('eodTotalWalkins').innerText = totalWalkins;
            document.getElementById('eodClearedR1').innerText = clearedR1;
            document.getElementById('eodClearedR2').innerText = clearedR2;
            document.getElementById('eodSelected').innerText = selected;

            const kpiGrid = document.querySelector('.eod-kpi-grid');
            if (kpiGrid && !document.getElementById('eodRejected')) {
                kpiGrid.insertAdjacentHTML('beforeend', `
                    <div class="eod-kpi-card">
                        <div style="font-size: 13px; color: var(--text-muted); font-weight: 600;">Rejected</div>
                        <div class="eod-kpi-number" id="eodRejected" style="color: var(--danger);">0</div>
                    </div>
                `);
            }
            if (document.getElementById('eodRejected')) {
                document.getElementById('eodRejected').innerText = rejected;
            }

            const title = document.querySelector('#eodModal .modal-header h2');
            if (title) {
                const friendlyDate = new Date(selectedDate + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
                });
                title.innerText = `📈 End of Day Interview Summary — ${friendlyDate}`;
            }

            const tbody = document.getElementById('eodTableBody');
            if (!reportCandidates.length) {
                tbody.innerHTML = `<tr><td colspan="9" style="text-align:center;padding:20px;color:var(--text-muted);font-style:italic;">No candidate records found for ${selectedDate}.</td></tr>`;
                return;
            }

            tbody.innerHTML = reportCandidates.map(c => `
                <tr style="border-bottom:1px solid var(--border-color);">
                    <td style="padding:10px;">${c.interviewDate || selectedDate}</td>
                    <td style="padding:10px;font-weight:600;">${c.name}</td>
                    <td style="padding:10px;"><span class="badge badge-${(c.skill || 'General').toLowerCase()}">${c.skill || 'General'}</span></td>
                    <td style="padding:10px;color:var(--text-muted);">${c.checkInTime || 'Just now'}</td>
                    <td style="padding:10px;">${c.r1 || 'Pending'}</td>
                    <td style="padding:10px;">${c.r2 || 'Pending'}</td>
                    <td style="padding:10px;">${c.final || 'Pending'}</td>
                    <td style="padding:10px;">${getCandidatePanelistName(c, 1)}</td>
                    <td style="padding:10px;">${getCandidatePanelistName(c, 2)}</td>
                </tr>
            `).join('');

            const auditBody = document.getElementById('eodPanelistAuditBody');
            if (auditBody) {
                const dayAudit = interviewHistory
                    .filter(h => h.interviewDate === selectedDate)
                    .sort((a, b) => String(a.startedAt).localeCompare(String(b.startedAt)));

                if (!dayAudit.length) {
                    auditBody.innerHTML = `<tr><td colspan="8" style="text-align:center;padding:18px;color:var(--text-muted);font-style:italic;">No panelist interview records for ${selectedDate}.</td></tr>`;
                } else {
                    auditBody.innerHTML = dayAudit.map(h => `
                        <tr style="border-bottom:1px solid var(--border-color);">
                            <td style="padding:10px;font-weight:700;color:var(--primary);">Round ${h.round}</td>
                            <td style="padding:10px;font-weight:600;">${h.panelistName}</td>
                            <td style="padding:10px;">${h.candidateName}</td>
                            <td style="padding:10px;">${h.skill || 'General'}</td>
                            <td style="padding:10px;color:var(--text-muted);">${h.startedAt ? new Date(h.startedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                            <td style="padding:10px;color:var(--text-muted);">${h.completedAt ? new Date(h.completedAt).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}) : '-'}</td>
                            <td style="padding:10px;font-weight:700;">${h.decision || 'IN_PROGRESS'}</td>
                            <td style="padding:10px;color:var(--text-muted);">${h.notes || ''}</td>
                        </tr>
                    `).join('');
                }
            }

        }

        function calculatePanelistFreeTime(p) {
            if (p.status === 'AVAILABLE') return "Right Now (Available)";
            let totalSecondsRemaining = 0;

            if (p.status === 'BUSY' && p.startTime) {
                const elapsedSeconds = Math.floor((Date.now() - p.startTime) / 1000);
                const currentInterviewRemaining = Math.max(0, SLA_DURATION_SECONDS - elapsedSeconds);
                totalSecondsRemaining += currentInterviewRemaining;
            } else if (p.status === 'BREAK') {
                totalSecondsRemaining += (15 * 60); 
            }

            if (p.nextCandidate) {
                totalSecondsRemaining += SLA_DURATION_SECONDS + BREAK_BUFFER_SECONDS;
            }

            const freeTimestamp = new Date(Date.now() + (totalSecondsRemaining * 1000));
            return freeTimestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        }

        function sortPanelistsByAvailability(list) {
            const weight = { "AVAILABLE": 1, "BUSY": 2, "BREAK": 3 };
            return [...list].sort((a, b) => {
                const wA = weight[a.status] || 4;
                const wB = weight[b.status] || 4;
                if (wA !== wB) return wA - wB;
                return a.name.localeCompare(b.name);
            });
        }

        // Excel Export/Import
        function exportToExcel() {
            const wb = XLSX.utils.book_new();
            const reportDateEl = document.getElementById('eodReportDate');
            const exportDate = reportDateEl && reportDateEl.value ? reportDateEl.value : getTodayFormattedDate();
            const candidatesForExport = queue.filter(c =>
                (c.interviewDate || getTodayFormattedDate()) === exportDate
            );

            const candidatesData = candidatesForExport.map((c, index) => ({
                "No.": index + 1,
                "Interview Date": c.interviewDate || exportDate,
                "Candidate Name": c.name,
                "Skill Tag": c.skill,
                "Check-in Time": c.checkInTime,
                "Round 1 Status": c.r1,
                "Round 2 Status": c.r2,
                "Final Decision": c.final,
                "Rejected Round": c.rejectedRound || "",
                "Current Queue Status": c.status,
                "Current Round": c.currentRound || (c.r1 === "Cleared" ? 2 : 1),
                "Assigned Interviewer": c.assignedPanelistId ? ((panelists.find(p => p.id === c.assignedPanelistId) || {}).name || "") : "",
                "Queued With Interviewer": c.queuedPanelistId ? ((panelists.find(p => p.id === c.queuedPanelistId) || {}).name || "") : "",
                "Evaluation Notes": (c.evaluationNotes || []).map(n => `[${n.round === 1 ? "R1" : "R2"}] ${n.interviewer}: ${n.note}`).join(" | ")
            }));
            const wsCandidates = XLSX.utils.json_to_sheet(candidatesData);
            XLSX.utils.book_append_sheet(wb, wsCandidates, "Candidate Assessment Report");

            const panelistsData = panelists.map((p, index) => ({
                "No.": index + 1,
                "Report Date": p.interviewDate || exportDate,
                "Interviewer Name": p.name,
                "Room / Location": p.location,
                "Level": p.level,
                "Skill Tag": p.skill,
                "Live Status": p.status,
                "Current Candidate": p.currentCandidate || "None",
                "Next in Line": p.nextCandidate || "None",
                "Interviews Completed Today": p.completed
            }));
            const wsPanelists = XLSX.utils.json_to_sheet(panelistsData);
            XLSX.utils.book_append_sheet(wb, wsPanelists, "Panelist Audit Log");

            const panelistRoundAuditData = interviewHistory
                .filter(h => h.interviewDate === exportDate)
                .map((h, index) => ({
                    "No.": index + 1,
                    "Interview Date": h.interviewDate,
                    "Round": h.round,
                    "Panelist": h.panelistName,
                    "Candidate": h.candidateName,
                    "Skill": h.skill,
                    "Started At": h.startedAt ? new Date(h.startedAt).toLocaleString() : "",
                    "Completed At": h.completedAt ? new Date(h.completedAt).toLocaleString() : "",
                    "Decision": h.decision,
                    "Notes": h.notes || ""
                }));
            const wsPanelistRoundAudit = XLSX.utils.json_to_sheet(panelistRoundAuditData);
            XLSX.utils.book_append_sheet(wb, wsPanelistRoundAudit, "Panelist Round Audit");

            XLSX.writeFile(wb, `Interview_EOD_Report_${exportDate}.xlsx`);
        }

        function downloadSampleExcel() {
            const sampleData = [
                { "Name": "Alice Smith", "Location": "Room 101", "Level": "L5", "Skill": "Frontend" },
                { "Name": "Bob Jones", "Location": "Desk 4B", "Level": "L4", "Skill": "Backend" },
                { "Name": "Charlie Brown", "Location": "Conf Room B", "Level": "L6", "Skill": "DevOps" }
            ];
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(sampleData);
            XLSX.utils.book_append_sheet(wb, ws, "PanelistsTemplate");
            XLSX.writeFile(wb, "Panelist_Import_Template.xlsx");
        }

        async function importPanelistsFromExcel(event) {
            const file = event.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = async function(e) {
                try {
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    const worksheet = workbook.Sheets[workbook.SheetNames[0]];
                    const jsonRows = XLSX.utils.sheet_to_json(worksheet);
                    const rows = jsonRows.map(row => ({
                        name: String(row['Name'] || row['Interviewer Name'] || row['name'] || '').trim(),
                        location: String(row['Location'] || row['Room / Location'] || row['location'] || 'Main Office').trim(),
                        level: String(row['Level'] || row['level'] || 'L4').trim(),
                        skill: String(row['Skill'] || row['Skill Tag'] || row['skill'] || 'General').trim(),
                        interview_date: getActiveInterviewDate(),
                        status: 'AVAILABLE',
                        completed_count: 0
                    })).filter(r => r.name);
                    if (!rows.length) { alert('No valid panelists were found in the file.'); return; }
                    const { data: inserted, error } = await withTimeout(supabaseClient.from('panelists').insert(rows).select(), DB_REQUEST_TIMEOUT_MS, 'Import panelists');
                    if (error) throw error;
                    panelists.push(...inserted.map(panelistFromDb));
                    alert(`Successfully imported ${inserted.length} panelists into Supabase.`);
                    document.getElementById('excelUploadInput').value = '';
                    checkRoutingMode();
                    renderAll();
                } catch (err) {
                    console.error(err);
                    alert(`Failed to import panelists: ${err.message || err}`);
                }
            };
            reader.readAsArrayBuffer(file);
        }

        // Actions: Reception & HR

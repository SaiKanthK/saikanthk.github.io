        // Global State Memory
        let queue = [];
        let panelists = [];
        let localIdCounter = 100;
        let activeEvalContext = null; // Stores evaluation context during panelist completion
        let interviewHistory = []; // Audit trail: one record per candidate-panelist-round interview
        let activeInterviewDate = null;
        const ACTIVE_INTERVIEW_DATE_STORAGE_KEY = 'activeInterviewDate';
        
        // Skills are loaded from Supabase; no hard-coded skill master list.


        const SLA_DURATION_SECONDS = 45 * 60; // 45 Minutes Interview Duration
        const BREAK_BUFFER_SECONDS = 10 * 60; // 10 Minutes Buffer Between Interviews


        // ================= SUPABASE PRODUCTION DATA LAYER =================
        // Replace these placeholders with your Supabase project URL and publishable key.
        // Never put a sb_secret_* or service_role key in this file.
        const SUPABASE_URL = 'https://YOUR_PROJECT_REF.supabase.co';
        const SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_REPLACE_ME';

        const supabaseClient = window.supabase.createClient(
            SUPABASE_URL,
            SUPABASE_PUBLISHABLE_KEY,
            {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            }
        );

        let currentUser = null;
        let currentProfile = null;
        let skills = [];
        let recruiterAssignedSkills = [];
        let dbRefreshTimer = null;
        let realtimeChannel = null;
        let appReady = false;
        let dbLoadInFlight = false;
        let inactivityTimer = null;
        let inactivityWarningTimer = null;
        let inactivityLastActivityAt = null;
        let inactivityListenersAttached = false;
        let inactivityWarningVisible = false;
        let inactivityActivityThrottleAt = 0;

        const INACTIVITY_LIMIT_MS = 30 * 60 * 1000;
        const INACTIVITY_WARNING_START_MS = 28 * 60 * 1000;
        const INACTIVITY_WARNING_COUNTDOWN_MS = INACTIVITY_LIMIT_MS - INACTIVITY_WARNING_START_MS;
        const INACTIVITY_STORAGE_KEY = 'interview_management_last_activity_at';


        function isSupabaseConfigured() {
            return !SUPABASE_URL.includes('YOUR_PROJECT_REF') &&
                   !SUPABASE_PUBLISHABLE_KEY.includes('REPLACE_ME');
        }

        function showAuthGate(show, errorMessage = '') {
            const gate = document.getElementById('authGate');
            if (gate) gate.classList.toggle('hidden', !show);
            const err = document.getElementById('authError');
            if (err) {
                err.innerText = errorMessage || '';
                err.style.display = errorMessage ? 'block' : 'none';
            }
        }

        function setAuthLoading(loading) {
            const button = document.getElementById('authLoginBtn');
            const status = document.getElementById('authLoading');
            if (button) button.disabled = loading;
            if (status) status.style.display = loading ? 'block' : 'none';
        }

        function updateAuthUi() {
            const userBox = document.getElementById('authUserBox');
            const status = document.getElementById('connection-status');
            if (currentUser) {
                if (userBox) {
                    userBox.style.display = 'inline-flex';
                    userBox.innerHTML = `${currentUser.email || 'Signed in'}${currentProfile && currentProfile.role ? ` · ${currentProfile.role}` : ''} <button class="btn-secondary" onclick="handleLogout()">Sign out</button>`;
                }
                if (status) {
                    status.className = 'db-sync-badge';
                    status.innerText = '🟢 Connected to Supabase';
                }
            } else {
                if (userBox) userBox.style.display = 'none';
                if (status) {
                    status.className = 'db-sync-badge';
                    status.innerText = '🔴 Not connected';
                }
            }
        }

        function formatCheckInTime(value) {
            if (!value) return '';
            // Keep existing display strings such as "10:35 AM" unchanged.
            if (!/^\d{4}-\d{2}-\d{2}T/.test(String(value))) return String(value);
            const d = new Date(value);
            return isNaN(d.getTime()) ? String(value) : d.toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
        }

        function candidateFromDb(row) {
            return {
                id: row.id,
                name: row.name,
                skill: row.skill,
                interviewDate: row.interview_date,
                checkInTime: formatCheckInTime(row.check_in_time),
                checkInTimestamp: row.check_in_time || null,
                status: row.status,
                currentRound: row.current_round || 1,
                r1: row.round1_status || 'Pending',
                r2: row.round2_status || 'Pending',
                final: row.final_decision || 'Pending',
                rejectedRound: row.rejected_round ?? null,
                round1PanelistId: row.round1_panelist_id ?? null,
                round2PanelistId: row.round2_panelist_id ?? null,
                assignedPanelistId: row.assigned_panelist_id ?? null,
                queuedPanelistId: row.queued_panelist_id ?? null,
                evaluationNotes: Array.isArray(row.evaluation_notes) ? row.evaluation_notes : []
            };
        }

        function panelistFromDb(row) {
            return {
                id: row.id,
                name: row.name,
                location: row.location || 'Main Desk',
                level: row.level || 'L4',
                skill: row.skill || 'General',
                interviewDate: row.interview_date || getTodayFormattedDate(),
                status: row.status || 'AVAILABLE',
                currentCandidate: row.current_candidate_id ? null : (row.current_candidate || null),
                currentCandidateId: row.current_candidate_id || null,
                nextCandidate: null,
                nextCandidateId: row.next_candidate_id || null,
                startTime: row.start_time ? new Date(row.start_time).getTime() : null,
                completed: Number(row.completed_count) || 0,
                activeInterviewId: null
            };
        }

        function historyFromDb(row) {
            return {
                id: row.id,
                candidateId: row.candidate_id,
                candidateName: row.candidate_name,
                skill: row.skill,
                panelistId: row.panelist_id,
                panelistName: row.panelist_name,
                round: row.round_number,
                interviewDate: row.interview_date,
                startedAt: row.started_at,
                completedAt: row.completed_at,
                decision: row.decision || 'IN_PROGRESS',
                notes: row.notes || ''
            };
        }

        function candidateToDb(c) {
            return {
                id: c.id,
                name: c.name,
                skill: c.skill,
                interview_date: c.interviewDate || getTodayFormattedDate(),
                // Supabase column is timestamptz; never send a display-only value such as "11:36 PM".
                check_in_time: c.checkInTimestamp || null,
                status: c.status,
                current_round: c.currentRound || 1,
                round1_status: c.r1 || 'Pending',
                round2_status: c.r2 || 'Pending',
                final_decision: c.final || 'Pending',
                rejected_round: c.rejectedRound ?? null,
                round1_panelist_id: c.round1PanelistId ?? null,
                round2_panelist_id: c.round2PanelistId ?? null,
                assigned_panelist_id: c.assignedPanelistId ?? null,
                queued_panelist_id: c.queuedPanelistId ?? null,
                evaluation_notes: Array.isArray(c.evaluationNotes) ? c.evaluationNotes : [],
                updated_at: new Date().toISOString()
            };
        }

        function panelistToDb(p) {
            return {
                id: p.id,
                name: p.name,
                location: p.location || 'Main Desk',
                level: p.level || 'L4',
                skill: p.skill || 'General',
                interview_date: p.interviewDate || getActiveInterviewDate(),
                status: p.status || 'AVAILABLE',
                current_candidate_id: p.currentCandidateId || null,
                next_candidate_id: p.nextCandidateId || null,
                start_time: p.startTime ? new Date(p.startTime).toISOString() : null,
                completed_count: Number(p.completed) || 0,
                updated_at: new Date().toISOString()
            };
        }

        async function saveCandidate(candidate) {
            if (!candidate || !currentUser || !appReady) return;
            const { error } = await supabaseClient.from('candidates').upsert(candidateToDb(candidate), { onConflict: 'id' });
            if (error) console.error('Candidate save failed:', error, candidate);
        }

        async function savePanelist(panelist) {
            if (!panelist || !currentUser || !appReady) return;
            const { error } = await supabaseClient.from('panelists').upsert(panelistToDb(panelist), { onConflict: 'id' });
            if (error) console.error('Panelist save failed:', error, panelist);
        }

        async function saveInterviewHistory(record) {
            if (!record || !currentUser || !appReady) return;
            const payload = {
                id: record.id,
                candidate_id: record.candidateId,
                candidate_name: record.candidateName,
                skill: record.skill,
                panelist_id: record.panelistId,
                panelist_name: record.panelistName,
                round_number: record.round,
                interview_date: record.interviewDate,
                started_at: record.startedAt,
                completed_at: record.completedAt,
                decision: record.decision,
                notes: record.notes || ''
            };
            const { error } = await supabaseClient.from('interview_history').upsert(payload, { onConflict: 'id' });
            if (error) console.error('Interview history save failed:', error);
        }

        async function recordCandidateStatusChange(candidateId, fromStatus, toStatus, round, reason) {
            if (!candidateId || !currentUser || !appReady || fromStatus === toStatus) return;
            const { error } = await supabaseClient.from('candidate_status_history').insert({
                id: (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : undefined,
                candidate_id: candidateId,
                from_status: fromStatus || null,
                to_status: toStatus || null,
                round_number: round || null,
                reason: reason || null,
                changed_by: currentUser.id
            });
            if (error) console.error('Status history save failed:', error);
        }

        const DB_REQUEST_TIMEOUT_MS = 12000;

        function withTimeout(promise, timeoutMs = DB_REQUEST_TIMEOUT_MS, label = 'Database request') {
            return Promise.race([
                promise,
                new Promise((_, reject) => setTimeout(() => reject(new Error(`${label} timed out after ${Math.round(timeoutMs/1000)} seconds.`)), timeoutMs))
            ]);
        }

        function getActiveSkills() {
            return Array.isArray(skills)
                ? skills.filter(s => s && s.active !== false)
                : [];
        }

        function canManageSkills() {
            return !!currentProfile && ['ADMIN', 'RECRUITER', 'RECEPTION'].includes(currentProfile.role);
        }

        function canManageUsers() {
            return !!currentProfile && currentProfile.role === 'ADMIN';
        }

        function updateRoleUi() {
            const manage = document.getElementById('manageSkillsBtn');
            if (manage) manage.style.display = canManageSkills() ? 'inline-flex' : 'none';

            const manageUsers = document.getElementById('manageUsersBtn');
            if (manageUsers) manageUsers.style.display = canManageUsers() ? 'inline-flex' : 'none';

            const eodShortcut = document.querySelector('.top-shortcuts .header-shortcut-btn[onclick*="openEodModal"]');
            if (eodShortcut) {
                eodShortcut.style.display = currentProfile?.role === 'PANELIST' ? 'none' : '';
            }

            const adminBtn = document.getElementById('navAdminBtn');
            const recruiterBtn = document.getElementById('navRecruiterBtn');
            const portalBtn = document.getElementById('navPortalBtn');
            if (!currentProfile) return;

            const role = currentProfile.role;
            if (adminBtn) adminBtn.style.display = ['ADMIN','RECEPTION'].includes(role) ? '' : 'none';
            if (recruiterBtn) recruiterBtn.style.display = ['ADMIN','RECRUITER'].includes(role) ? '' : 'none';
            // Admin can inspect every operational view. Panelists see only their portal.
            if (portalBtn) portalBtn.style.display = role === 'ADMIN' || role === 'PANELIST' ? '' : 'none';
        }


        function openDefaultRoleView() {
            if (!currentProfile) return;
            if (currentProfile.role === 'PANELIST') switchView('portal');
            else if (currentProfile.role === 'RECRUITER') switchView('recruiter');
            else switchView('admin');
        }

        async function loadCurrentProfile() {
            if (!currentUser) throw new Error('Not authenticated.');

            const { data, error } = await withTimeout(
                supabaseClient
                    .from('profiles')
                    .select('id, full_name, role, panelist_id')
                    .eq('id', currentUser.id)
                    .maybeSingle(),
                DB_REQUEST_TIMEOUT_MS,
                'Profile lookup'
            );

            if (error) {
                console.error('Profile lookup failed:', error);
                throw new Error(`Unable to load application profile: ${error.message}`);
            }

            if (!data) {
                throw new Error(
                    'Your Supabase login is valid, but no public.profiles row exists for this user. ' +
                    'Create a profile whose id exactly matches the Auth user UUID and assign ADMIN, RECRUITER, RECEPTION, or PANELIST.'
                );
            }

            if (!data.role) {
                throw new Error(
                    'Your public.profiles row exists but has no application role. ' +
                    'Set role to ADMIN, RECRUITER, RECEPTION, or PANELIST.'
                );
            }

            currentProfile = data;
            updateRoleUi();
            openDefaultRoleView();
        }

        async function loadSkills() {
            const { data, error } = await withTimeout(
                supabaseClient.from('skills').select('id, name, active, created_at').order('name', { ascending: true }),
                DB_REQUEST_TIMEOUT_MS,
                'Skills lookup'
            );
            if (error) throw error;
            skills = (data || []).sort((a,b) => a.name.localeCompare(b.name));
            const activeNames = getActiveSkills().map(s => s.name);
            recruiterAssignedSkills = recruiterAssignedSkills.filter(name => activeNames.includes(name));
            if (!recruiterAssignedSkills.length) recruiterAssignedSkills = [...activeNames];
            renderSkillSelectors();
            renderRecruiterView();
        }

        function renderSkillSelectors() {
            const selects = [
                ['candidateSkill', 'Select Skill'],
                ['panelistSkill', 'Select Skill'],
                ['filterCandidateSkill', 'All Skills']
            ];
            selects.forEach(([id, placeholder]) => {
                const el = document.getElementById(id);
                if (!el) return;
                const current = el.value;
                el.innerHTML = '';
                if (id === 'filterCandidateSkill') {
                    el.innerHTML = '<option value="">All Skills</option>';
                } else if (!skills.length) {
                    el.innerHTML = '<option value="">No skills configured</option>';
                }
                getActiveSkills().forEach(skill => {
                    const option = document.createElement('option');
                    option.value = skill.name;
                    option.textContent = skill.name;
                    el.appendChild(option);
                });
                if (current && skills.some(s => s.name === current)) el.value = current;
                else if (id !== 'filterCandidateSkill' && skills.length) el.value = skills[0].name;
            });
        }


        function populatePanelistUserSkills() {
            const select = document.getElementById('newPanelistSkill');
            if (!select) return;

            const activeSkills = getActiveSkills();
            const current = select.value;

            select.innerHTML = activeSkills.length
                ? `<option value="">Select skill</option>` + activeSkills.map(skill =>
                    `<option value="${escapeHtml(skill.name)}">${escapeHtml(skill.name)}</option>`
                  ).join('')
                : `<option value="">No active skills</option>`;

            if (current && activeSkills.some(s => s.name === current)) {
                select.value = current;
            }
        }

        function toggleStaffRoleFields() {
            const role = document.getElementById('newStaffRole').value;
            const panelFields = document.getElementById('panelistStaffFields');
            if (!panelFields) return;

            const isPanelist = role === 'PANELIST';
            panelFields.style.display = isPanelist ? 'block' : 'none';

            if (isPanelist) {
                populatePanelistUserSkills();
                const dateInput = document.getElementById('newPanelistInterviewDate');
                if (dateInput && !dateInput.value) {
                    dateInput.value = getActiveInterviewDate();
                }
            }
        }


        function setCreateUserBusy(isBusy, message = 'Creating user… please wait.') {
            const button = document.getElementById('createStaffUserBtn');
            const progress = document.getElementById('userManagerProgress');
            const progressText = document.getElementById('userManagerProgressText');

            if (button) {
                button.disabled = isBusy;
                button.style.opacity = isBusy ? '0.65' : '';
                button.style.cursor = isBusy ? 'wait' : '';
                button.textContent = isBusy ? 'Creating User…' : 'Create User';
            }

            if (progress) progress.style.display = isBusy ? 'block' : 'none';
            if (progressText) progressText.textContent = message;
            setCreateUserFormDisabled(isBusy);
        }


        function setCreateUserFormDisabled(isDisabled) {
            const ids = [
                'newStaffFullName',
                'newStaffEmail',
                'newStaffRole',
                'newStaffPassword',
                'newPanelistLocation',
                'newPanelistLevel',
                'newPanelistSkill',
                'newPanelistInterviewDate'
            ];

            ids.forEach(id => {
                const el = document.getElementById(id);
                if (el) el.disabled = isDisabled;
            });

            const generateBtn = document.querySelector('#userManagerModal button[onclick="generateStaffPassword()"]');
            if (generateBtn) generateBtn.disabled = isDisabled;
        }

        function openUserManager() {
            if (!canManageUsers()) {
                alert('Only Admin users can create staff accounts.');
                return;
            }

            document.getElementById('userManagerError').style.display = 'none';
            document.getElementById('userManagerSuccess').style.display = 'none';
            setCreateUserBusy(false);
            document.getElementById('newStaffFullName').value = '';
            document.getElementById('newStaffEmail').value = '';
            document.getElementById('newStaffRole').value = 'RECRUITER';
            document.getElementById('newStaffPassword').value = '';
            document.getElementById('newPanelistLocation').value = '';
            document.getElementById('newPanelistLevel').value = '';
            document.getElementById('newPanelistInterviewDate').value = getActiveInterviewDate();
            populatePanelistUserSkills();
            document.getElementById('userManagerModal').style.display = 'flex';
            document.getElementById('newStaffFullName').focus();
            toggleStaffRoleFields();
        }

        function closeUserManager() {
            document.getElementById('userManagerModal').style.display = 'none';
        }

        function generateStaffPassword() {
            const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
            const bytes = new Uint32Array(16);
            crypto.getRandomValues(bytes);
            let password = '';
            for (const value of bytes) {
                password += chars[value % chars.length];
            }
            const input = document.getElementById('newStaffPassword');
            input.value = password;
            input.type = 'text';
        }

        async function createStaffUser() {
            if (!canManageUsers()) {
                throw new Error('Only Admin users can create Admin, Recruiter, or Panelist accounts.');
            }

            const name = document.getElementById('newStaffFullName').value.trim();
            const email = document.getElementById('newStaffEmail').value.trim().toLowerCase();
            const role = document.getElementById('newStaffRole').value;
            let password = document.getElementById('newStaffPassword').value;

            const errorBox = document.getElementById('userManagerError');
            const successBox = document.getElementById('userManagerSuccess');
            errorBox.style.display = 'none';
            successBox.style.display = 'none';

            if (!name) throw new Error('Please enter the user full name.');
            if (!email || !email.includes('@')) throw new Error('Please enter a valid email address.');

            if (!['ADMIN', 'RECRUITER', 'PANELIST'].includes(role)) {
                throw new Error('Invalid staff role.');
            }

            const body = {
                full_name: name,
                email,
                role
            };

            if (password) {
                if (password.length < 8) {
                    throw new Error('Temporary password must be at least 8 characters.');
                }
                body.password = password;
            }

            if (role === 'PANELIST') {
                const location = document.getElementById('newPanelistLocation').value.trim() || 'Main Desk';
                const level = document.getElementById('newPanelistLevel').value.trim() || 'L4';
                const skill = document.getElementById('newPanelistSkill').value;
                const interviewDate = document.getElementById('newPanelistInterviewDate').value || getActiveInterviewDate();

                if (!skill) throw new Error('Please select a skill for the panelist.');
                if (!interviewDate) throw new Error('Please select an interview session date.');

                body.panelist = {
                    location,
                    level,
                    skill,
                    interview_date: interviewDate
                };
            }

            const { data: rawData, error } = await withTimeout(
                supabaseClient.functions.invoke('create-staff-user', { body }),
                DB_REQUEST_TIMEOUT_MS,
                'Create staff user'
            );

            if (error) {
                console.error('Create staff user failed:', error);

                // Edge Functions can return a structured JSON error body even
                // when functions.invoke exposes only a non-2xx status.
                let serverMessage = '';
                try {
                    if (error.context) {
                        const response = error.context instanceof Response
                            ? error.context
                            : error.context?.response;

                        if (response && typeof response.clone === 'function') {
                            const cloned = response.clone();
                            const contentType = cloned.headers.get('content-type') || '';

                            if (contentType.includes('application/json')) {
                                const body = await cloned.json();
                                serverMessage = body?.error || body?.message || '';
                            } else {
                                serverMessage = await cloned.text();
                            }
                        }
                    }
                } catch (diagnosticError) {
                    console.warn('Could not read Edge Function error body:', diagnosticError);
                }

                throw new Error(
                    serverMessage ||
                    error.message ||
                    'Unable to create user.'
                );
            }

            // Supabase normally parses an application/json Edge Function response.
            // This fallback also handles deployments that return JSON as plain text.
            let data = rawData;

            if (typeof data === 'string') {
                try {
                    data = JSON.parse(data);
                } catch (parseError) {
                    console.error('Could not parse Edge Function response:', rawData);
                    throw new Error(
                        'The staff-user service returned an invalid response. ' +
                        'Check the Edge Function deployment/logs.'
                    );
                }
            }

            if (!data || typeof data !== 'object') {
                console.error('Unexpected create-staff-user response:', data);
                throw new Error(
                    'The staff-user service returned no usable response. ' +
                    'Redeploy create-staff-user and check its logs.'
                );
            }

            if (data.error) {
                throw new Error(String(data.error));
            }

            if (!data.user || !data.user.id) {
                console.error('Unexpected create-staff-user payload:', data);
                throw new Error(
                    'The staff-user service responded successfully but did not include the created user. ' +
                    'Redeploy create-staff-user with the latest panelist-capable function and check its logs.'
                );
            }

            password = data.temporary_password || password || '';

            const panelistMessage = role === 'PANELIST'
                ? `<br>Interview session: <strong>${escapeHtml(body.panelist.interview_date)}</strong><br>Panelist record: <strong>${escapeHtml(data.panelist?.id || 'Created')}</strong>`
                : '';

            successBox.innerHTML = `
                <strong>User created successfully.</strong><br>
                Email: <strong>${escapeHtml(data.user.email || email)}</strong><br>
                Role: <strong>${escapeHtml(role)}</strong>
                ${panelistMessage}
                <br>
                Temporary password:
                <strong id="createdStaffPassword" style="font-family:monospace;">${escapeHtml(password)}</strong>
                <button type="button" class="btn-secondary" style="margin-left:8px;padding:4px 8px;font-size:11px;" onclick="copyCreatedStaffPassword()">Copy</button>
                <div style="margin-top:6px;">Give the temporary password to the user securely and ask them to change it.</div>
            `;
            successBox.style.display = 'block';

            document.getElementById('newStaffPassword').value = '';
            await refreshFromSupabase();
        }

        async function handleCreateStaffUser() {
            const errorBox = document.getElementById('userManagerError');
            const successBox = document.getElementById('userManagerSuccess');
            errorBox.style.display = 'none';

            setCreateUserBusy(true, 'Creating user… please wait. This may take a few seconds.');

            try {
                await createStaffUser();
            } catch (error) {
                console.error(error);
                errorBox.textContent = error.message || 'Unable to create user.';
                errorBox.style.display = 'block';
            } finally {
                setCreateUserBusy(false);
                if (successBox && successBox.style.display !== 'block') {
                    // Keep the form ready for another attempt.
                }
            }
        }

        async function copyCreatedStaffPassword() {
            const el = document.getElementById('createdStaffPassword');
            if (!el) return;
            try {
                await navigator.clipboard.writeText(el.textContent || '');
            } catch (_) {
                alert(`Temporary password: ${el.textContent || ''}`);
            }
        }

        async function addSkill() {
            if (!canManageSkills()) { alert('Only Admin, Recruiter, or Reception users can manage skills.'); return; }
            const input = document.getElementById('newSkillName');
            const name = input ? input.value.trim() : '';
            const errorBox = document.getElementById('skillManagerError');
            if (errorBox) { errorBox.style.display = 'none'; errorBox.innerText = ''; }
            if (!name) return;
            if (skills.some(s => s.name.toLowerCase() === name.toLowerCase())) {
                if (errorBox) { errorBox.innerText = 'That skill already exists.'; errorBox.style.display = 'block'; }
                return;
            }
            const { data, error } = await withTimeout(
                supabaseClient.from('skills').insert({ name, active: true, created_by: currentUser.id }).select().single(),
                DB_REQUEST_TIMEOUT_MS,
                'Add skill'
            );
            if (error) {
                if (errorBox) { errorBox.innerText = error.message; errorBox.style.display = 'block'; }
                return;
            }
            skills.push(data);
            skills.sort((a,b) => a.name.localeCompare(b.name));
            recruiterAssignedSkills = [...new Set([...recruiterAssignedSkills, data.name])];
            input.value = '';
            renderSkillSelectors();
            renderRecruiterView();
            renderSkillManager();
        }

        async function toggleSkill(skillId, active) {
            if (!canManageSkills()) return;
            const { error } = await withTimeout(
                supabaseClient.from('skills').update({ active }).eq('id', skillId),
                DB_REQUEST_TIMEOUT_MS,
                'Update skill'
            );
            if (error) { alert(`Unable to update skill: ${error.message}`); return; }
            await loadSkills();
            renderSkillManager();
        }

        function renderSkillManager() {
            const list = document.getElementById('skillManagerList');
            if (!list) return;
            const allSkills = [...skills].sort((a,b) => a.name.localeCompare(b.name));
            list.innerHTML = allSkills.length ? allSkills.map(skill => `
                <div style="display:flex;justify-content:space-between;align-items:center;padding:9px 10px;border:1px solid var(--border-color);border-radius:7px;margin-bottom:7px;">
                    <span style="font-weight:600;">${skill.name}</span>
                    <button class="btn-sm ${skill.active === false ? 'btn-success' : 'btn-secondary'}" style="flex:0 0 auto;" onclick="toggleSkill('${skill.id}', ${skill.active === false})">${skill.active === false ? 'Activate' : 'Deactivate'}</button>
                </div>
            `).join('') : '<div class="empty-state">No skills configured.</div>';
        }

        function openSkillManager() {
            if (!canManageSkills()) { alert('Only Admin, Recruiter, or Reception users can manage skills.'); return; }
            renderSkillManager();
            document.getElementById('skillManagerModal').style.display = 'flex';
        }

        function closeSkillManager() {
            document.getElementById('skillManagerModal').style.display = 'none';
        }

        document.addEventListener('keydown', e => {
            if (e.key === 'Enter' && document.activeElement && document.activeElement.id === 'newSkillName') addSkill();
        });

        async function loadFromSupabase() {
            initializeActiveInterviewDate();
            if (dbLoadInFlight) return;
            dbLoadInFlight = true;
            try {
            const [candidatesRes, panelistsRes, historyRes, skillsRes] = await withTimeout(Promise.all([
                supabaseClient.from('candidates').select('*').order('created_at', { ascending: true }),
                supabaseClient.from('panelists').select('*').order('name', { ascending: true }),
                supabaseClient.from('interview_history').select('*').order('started_at', { ascending: true }),
                supabaseClient.from('skills').select('id, name, active, created_at').order('name', { ascending: true })
            ]), DB_REQUEST_TIMEOUT_MS, 'Initial database load');

            if (candidatesRes.error) throw candidatesRes.error;
            if (panelistsRes.error) throw panelistsRes.error;
            if (historyRes.error) throw historyRes.error;
            if (skillsRes.error) throw skillsRes.error;

            skills = (skillsRes.data || []).sort((a,b) => a.name.localeCompare(b.name));
            recruiterAssignedSkills = getActiveSkills().map(s => s.name);
            renderSkillSelectors();

            queue = (candidatesRes.data || []).map(candidateFromDb);
            panelists = (panelistsRes.data || []).map(panelistFromDb);
            interviewHistory = (historyRes.data || []).map(historyFromDb);

            migrateCandidateAndPanelistState();
            reconcilePanelistDisplayState();
            } finally {
                dbLoadInFlight = false;
            }
        }

        function reconcilePanelistDisplayState() {
            panelists.forEach(p => {
                const current = p.currentCandidateId ? queue.find(c => c.id === p.currentCandidateId) : null;
                p.currentCandidate = current ? `${current.name} (${current.skill})` : null;
                const queued = p.nextCandidateId ? queue.find(c => c.id === p.nextCandidateId) : null;
                p.nextCandidate = queued ? `${queued.name} (${queued.skill})` : null;
                if (current) {
                    const active = interviewHistory.slice().reverse().find(h => h.panelistId === p.id && h.candidateId === current.id && h.decision === 'IN_PROGRESS');
                    if (active) p.activeInterviewId = active.id;
                }
            });
        }

        function scheduleDatabaseRefresh() {
            if (dbRefreshTimer) clearTimeout(dbRefreshTimer);
            dbRefreshTimer = setTimeout(async () => {
                if (!currentUser) return;
                try {
                    await loadFromSupabase();
                    if (appReady) renderAll();
                } catch (error) {
                    console.error('Realtime refresh failed:', error);
                }
            }, 250);
        }

        function setupRealtime() {
            if (realtimeChannel) supabaseClient.removeChannel(realtimeChannel);
            realtimeChannel = supabaseClient.channel('interview-management-live')
                .on('postgres_changes', {event:'*', schema:'public', table:'candidates'}, scheduleDatabaseRefresh)
                .on('postgres_changes', {event:'*', schema:'public', table:'panelists'}, scheduleDatabaseRefresh)
                .on('postgres_changes', {event:'*', schema:'public', table:'interview_history'}, scheduleDatabaseRefresh)
                .on('postgres_changes', {event:'*', schema:'public', table:'candidate_status_history'}, scheduleDatabaseRefresh)
                .subscribe();
        }

        function getStoredInactivityTimestamp() {
            try {
                const stored = sessionStorage.getItem(INACTIVITY_STORAGE_KEY);
                const parsed = Number(stored);
                return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
            } catch (_) {
                return null;
            }
        }

        function storeInactivityTimestamp(timestamp) {
            try { sessionStorage.setItem(INACTIVITY_STORAGE_KEY, String(timestamp)); } catch (_) {}
        }


        function isStoredInactivityExpired() {
            const stored = getStoredInactivityTimestamp();
            return !!stored && (Date.now() - stored) >= INACTIVITY_LIMIT_MS;
        }

        function clearInactivityTimestamp() {
            try { sessionStorage.removeItem(INACTIVITY_STORAGE_KEY); } catch (_) {}
        }

        function hideInactivityWarning() {
            inactivityWarningVisible = false;
            const el = document.getElementById('inactivityWarning');
            if (el) {
                el.classList.remove('visible');
                el.setAttribute('aria-hidden', 'true');
            }
            if (inactivityWarningTimer) {
                clearInterval(inactivityWarningTimer);
                inactivityWarningTimer = null;
            }
        }

        function showInactivityWarning() {
            if (!currentUser || !appReady) return;
            inactivityWarningVisible = true;
            const el = document.getElementById('inactivityWarning');
            if (!el) return;
            el.classList.add('visible');
            el.setAttribute('aria-hidden', 'false');
            updateInactivityCountdown();
            if (inactivityWarningTimer) clearInterval(inactivityWarningTimer);
            inactivityWarningTimer = setInterval(updateInactivityCountdown, 1000);
        }

        function updateInactivityCountdown() {
            if (!inactivityLastActivityAt || !currentUser) return;
            const remaining = Math.max(0, INACTIVITY_LIMIT_MS - (Date.now() - inactivityLastActivityAt));
            const totalSeconds = Math.ceil(remaining / 1000);
            const mins = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
            const secs = String(totalSeconds % 60).padStart(2, '0');
            const el = document.getElementById('inactivityCountdown');
            if (el) el.textContent = `${mins}:${secs}`;
            if (remaining <= 0) {
                clearInactivityTimers();
                logoutForInactivity();
            }
        }

        function clearInactivityTimers() {
            if (inactivityTimer) { clearInterval(inactivityTimer); inactivityTimer = null; }
            if (inactivityWarningTimer) { clearInterval(inactivityWarningTimer); inactivityWarningTimer = null; }
            hideInactivityWarning();
        }

        function resetInactivityTimer(force = false) {
            if (!currentUser || !appReady) return;
            const now = Date.now();
            if (!force && now - inactivityActivityThrottleAt < 1000) return;
            inactivityActivityThrottleAt = now;
            inactivityLastActivityAt = now;
            storeInactivityTimestamp(now);
            hideInactivityWarning();
        }

        function checkInactivity() {
            if (!currentUser || !appReady || !inactivityLastActivityAt) return;
            const inactiveFor = Date.now() - inactivityLastActivityAt;
            if (inactiveFor >= INACTIVITY_LIMIT_MS) {
                clearInactivityTimers();
                logoutForInactivity();
                return;
            }
            if (inactiveFor >= INACTIVITY_WARNING_START_MS && !inactivityWarningVisible) {
                showInactivityWarning();
            }
        }

        function startInactivityTracking() {
            clearInactivityTimers();
            if (!currentUser || !appReady) return;
            const stored = getStoredInactivityTimestamp();
            inactivityLastActivityAt = stored || Date.now();
            storeInactivityTimestamp(inactivityLastActivityAt);
            checkInactivity();
            inactivityTimer = setInterval(checkInactivity, 1000);

            if (!inactivityListenersAttached) {
                inactivityListenersAttached = true;
                const activityHandler = () => {
                    if (!currentUser || !appReady) return;
                    resetInactivityTimer(false);
                };
                ['mousedown', 'keydown', 'touchstart', 'scroll', 'pointerdown'].forEach(eventName => {
                    window.addEventListener(eventName, activityHandler, { passive: true });
                });
                window.addEventListener('mousemove', activityHandler, { passive: true });
                document.addEventListener('visibilitychange', () => {
                    if (document.visibilityState === 'visible') checkInactivity();
                });
            }
        }

        function continueActiveSession() {
            resetInactivityTimer(true);
        }

        async function logoutForInactivity() {
            if (!currentUser) return;
            clearInactivityTimers();
            clearInactivityTimestamp();
            try { sessionStorage.removeItem(ACTIVE_INTERVIEW_DATE_STORAGE_KEY); } catch (_) {}
            activeInterviewDate = null;
            const message = 'You have been signed out after 30 minutes of inactivity.';
            try {
                if (realtimeChannel) {
                    await supabaseClient.removeChannel(realtimeChannel);
                    realtimeChannel = null;
                }
                await withTimeout(supabaseClient.auth.signOut(), DB_REQUEST_TIMEOUT_MS, 'Automatic sign-out');
            } catch (error) {
                console.error('Automatic sign-out failed:', error);
            } finally {
                appReady = false;
                currentUser = null;
                currentProfile = null;
                skills = [];
                queue = [];
                panelists = [];
                interviewHistory = [];
                updateAuthUi();
                showAuthGate(true, message);
            }
        }

        async function initializeSupabaseApp() {
            if (!isSupabaseConfigured()) {
                showAuthGate(true, 'Update SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in this file first.');
                updateAuthUi();
                return;
            }

            try {
                const { data: { session } } = await withTimeout(supabaseClient.auth.getSession(), DB_REQUEST_TIMEOUT_MS, 'Authentication session lookup');
                if (session && session.user) {
                    const storedActivity = getStoredInactivityTimestamp();
                    if (storedActivity && (Date.now() - storedActivity) >= INACTIVITY_LIMIT_MS) {
                        currentUser = session.user;
                        await logoutForInactivity();
                        return;
                    }
                    currentUser = session.user;
                    showAuthGate(false);
                    updateAuthUi();
                    await loadCurrentProfile();
                    await loadFromSupabase();
                    appReady = true;
                    setupRealtime();
                    renderAll();
                    startInactivityTracking();
                    return;
                }
                showAuthGate(true);
                updateAuthUi();
            } catch (error) {
                console.error(error);
                showAuthGate(true, error.message || 'Unable to initialize Supabase.');
                updateAuthUi();
            }
        }


        // Diagnostic helper:
        // After a successful Auth user is created, run `getMyAuthIdentity()` in the browser console
        // to see the exact UUID that must be used as public.profiles.id.
        async function getMyAuthIdentity() {
            const { data, error } = await supabaseClient.auth.getUser();
            if (error) {
                console.error(error);
                return null;
            }
            console.log('Authenticated user:', data.user);
            console.log('Use this UUID for public.profiles.id:', data.user ? data.user.id : null);
            return data.user ? { id: data.user.id, email: data.user.email } : null;
        }

        async function handleLogin() {
            const email = document.getElementById('authEmail').value.trim();
            const password = document.getElementById('authPassword').value;
            if (!email || !password) {
                showAuthGate(true, 'Enter your email and password.');
                return;
            }
            setAuthLoading(true);
            showAuthGate(true);
            try {
                const { data, error } = await withTimeout(supabaseClient.auth.signInWithPassword({ email, password }), DB_REQUEST_TIMEOUT_MS, 'Sign-in request');
                if (error) throw error;
                currentUser = data.user;
                showAuthGate(false);
                updateAuthUi();
                await loadCurrentProfile();
                await loadFromSupabase();
                appReady = true;
                setupRealtime();
                renderAll();
                resetInactivityTimer(true);
                startInactivityTracking();
            } catch (error) {
                console.error(error);
                showAuthGate(true, error.message || 'Login failed.');
            } finally {
                setAuthLoading(false);
            }
        }

        async function handleLogout() {
            clearInactivityTimers();
            clearInactivityTimestamp();
            try { sessionStorage.removeItem(ACTIVE_INTERVIEW_DATE_STORAGE_KEY); } catch (_) {}
            activeInterviewDate = null;
            appReady = false;
            if (realtimeChannel) {
                await supabaseClient.removeChannel(realtimeChannel);
                realtimeChannel = null;
            }
            await supabaseClient.auth.signOut();
            currentUser = null;
            currentProfile = null;
            skills = [];
            queue = [];
            panelists = [];
            interviewHistory = [];
            updateAuthUi();
            showAuthGate(true);
        }

        supabaseClient.auth.onAuthStateChange((event, session) => {
            if (session && session.user) {
                currentUser = session.user;
            } else {
                currentUser = null;
                currentProfile = null;
                clearInactivityTimers();
                clearInactivityTimestamp();
            }
            updateAuthUi();
        });

        document.addEventListener('DOMContentLoaded', () => {
            const loginBtn = document.getElementById('authLoginBtn');
            if (loginBtn) loginBtn.addEventListener('click', handleLogin);
            const passwordInput = document.getElementById('authPassword');
            if (passwordInput) passwordInput.addEventListener('keypress', e => { if (e.key === 'Enter') handleLogin(); });
        });

        function getStoredActiveInterviewDate() {
            try {
                const stored = sessionStorage.getItem(ACTIVE_INTERVIEW_DATE_STORAGE_KEY);
                return /^\d{4}-\d{2}-\d{2}$/.test(stored || '') ? stored : null;
            } catch (_) { return null; }
        }

        function storeActiveInterviewDate(dateValue) {
            try { sessionStorage.setItem(ACTIVE_INTERVIEW_DATE_STORAGE_KEY, dateValue); } catch (_) {}
        }

        function getActiveInterviewDate() {
            return activeInterviewDate || getTodayFormattedDate();
        }

        function initializeActiveInterviewDate() {
            activeInterviewDate = getStoredActiveInterviewDate() || getTodayFormattedDate();
            storeActiveInterviewDate(activeInterviewDate);
            updateActiveInterviewDateUi();
        }

        function updateActiveInterviewDateUi() {
            const date = getActiveInterviewDate();
            const input = document.getElementById('activeInterviewDate');
            const status = document.getElementById('activeInterviewDateStatus');
            if (input) input.value = date;
            const cLabel = document.getElementById('candidateEntryDateLabel');
            const pLabel = document.getElementById('panelistEntryDateLabel');
            if (cLabel) cLabel.textContent = date;
            if (pLabel) pLabel.textContent = date;
            if (status) {
                const sessionPanelistCount = Array.isArray(panelists)
                    ? panelists.filter(p => p.interviewDate === date).length
                    : 0;
                status.textContent = date === getTodayFormattedDate()
                    ? (sessionPanelistCount
                        ? `Today's interview session. ${sessionPanelistCount} panelist(s) in this roster.`
                        : "Today's interview session. No panelists yet — add/import a fresh roster.")
                    : (sessionPanelistCount
                        ? `Viewing interview session ${date}. ${sessionPanelistCount} panelist(s) in this roster.`
                        : `Viewing interview session ${date}. No panelists yet — add/import a fresh roster.`);
            }
        }

        function setActiveInterviewDate(dateValue) {
            if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue || '')) return;
            const current = getActiveInterviewDate();
            if (current !== dateValue) {
                const inProgress = queue.filter(c => c.interviewDate === current && c.status === 'IN_PROGRESS').length;
                if (inProgress && !confirm(`There are ${inProgress} active interview(s) in ${current}. Switch session date without changing those interviews?`)) {
                    updateActiveInterviewDateUi();
                    return;
                }
            }
            activeInterviewDate = dateValue;
            storeActiveInterviewDate(activeInterviewDate);
            updateActiveInterviewDateUi();
            checkRoutingMode();
            renderAll();
        }

        function changeActiveInterviewDate(dateValue) {
            setActiveInterviewDate(dateValue);
        }

        function getTodayFormattedDate() {
            const today = new Date();
            const year = today.getFullYear();
            const month = String(today.getMonth() + 1).padStart(2, '0');
            const day = String(today.getDate()).padStart(2, '0');
            return `${year}-${month}-${day}`;
        }

        function updateHeaderDate() {
            const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
            const todayStr = new Date().toLocaleDateString(undefined, options);
            document.getElementById('current-date-display').innerText = `📅 Current Date: ${todayStr}`;
        }

        // Demo initialization has been removed for production. Data is loaded from Supabase.
        async function initDemoData() {
            return initializeSupabaseApp();
        }

        function getInterviewHistoryId() {
            return (window.crypto && crypto.randomUUID) ? crypto.randomUUID() : `ih_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        }

        function getPanelistInterviewHistory(panelistId, dateFilter = null) {
            return interviewHistory.filter(h =>
                h.panelistId === panelistId &&
                (!dateFilter || h.interviewDate === dateFilter)
            );
        }

        function getCandidateInterviewHistory(candidateId) {
            return interviewHistory.filter(h => h.candidateId === candidateId);
        }

        function createInterviewHistoryRecord(panelist, candidate) {
            const historyRound = candidate.currentRound || (candidate.r1 === 'Cleared' ? 2 : 1);
            if (historyRound === 1) candidate.round1PanelistId = panelist.id;
            if (historyRound === 2) candidate.round2PanelistId = panelist.id;

            const record = {
                id: getInterviewHistoryId(),
                candidateId: candidate.id,
                candidateName: candidate.name,
                skill: candidate.skill,
                panelistId: panelist.id,
                panelistName: panelist.name,
                round: historyRound,
                interviewDate: candidate.interviewDate || getTodayFormattedDate(),
                startedAt: new Date().toISOString(),
                completedAt: null,
                decision: 'IN_PROGRESS',
                notes: ''
            };
            interviewHistory.push(record);
            panelist.activeInterviewId = record.id;
            saveInterviewHistory(record);
            saveCandidate(candidate);
            savePanelist(panelist);
            return record;
        }

        function completeInterviewHistoryRecord(panelist, candidate, decision, notes) {
            const activeId = panelist && panelist.activeInterviewId;
            let record = activeId ? interviewHistory.find(h => h.id === activeId) : null;

            if (!record && panelist && candidate) {
                record = interviewHistory.slice().reverse().find(h =>
                    h.panelistId === panelist.id &&
                    h.candidateId === candidate.id &&
                    h.round === (candidate.currentRound || (candidate.r1 === 'Cleared' ? 2 : 1)) &&
                    h.decision === 'IN_PROGRESS'
                );
            }

            if (!record) record = createInterviewHistoryRecord(panelist, candidate);

            record.completedAt = new Date().toISOString();
            record.decision = decision;
            record.notes = notes || '';
            record.round = record.round || candidate.currentRound || (candidate.r1 === 'Cleared' ? 2 : 1);
            record.interviewDate = candidate.interviewDate || record.interviewDate || getTodayFormattedDate();

            if (panelist) panelist.activeInterviewId = null;
            saveInterviewHistory(record);
            return record;
        }

        function getRoundActivitySummaryForPanelist(panelistId, dateFilter = null) {
            const records = getPanelistInterviewHistory(panelistId, dateFilter)
                .filter(h => h.completedAt);

            const r1 = records.filter(h => h.round === 1).length;
            const r2 = records.filter(h => h.round === 2).length;
            return { r1, r2, total: r1 + r2 };
        }

        // View Switcher Navigation

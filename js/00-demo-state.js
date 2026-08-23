
/* Demo-only in-memory application state. No login, DB, or network. */
(function () {
    window.DEMO_MODE = true;

    window.queue = [
        {
            id: 'demo-c1',
            name: 'John Wick',
            skill: 'Android',
            interviewDate: '2026-08-23',
            checkInTime: '09:10 AM',
            status: 'WAITING',
            currentRound: 1,
            r1: 'Pending',
            r2: 'Pending',
            final: 'Pending',
            round1PanelistId: 'demo-p1',
            round2PanelistId: null,
            assignedPanelistId: null,
            queuedPanelistId: null,
            evaluationNotes: []
        },
        {
            id: 'demo-c2',
            name: 'Sarah Connor',
            skill: 'Backend',
            interviewDate: '2026-08-23',
            checkInTime: '09:25 AM',
            status: 'IN_PROGRESS',
            currentRound: 1,
            r1: 'Pending',
            r2: 'Pending',
            final: 'In Progress',
            round1PanelistId: 'demo-p2',
            round2PanelistId: null,
            assignedPanelistId: 'demo-p2',
            queuedPanelistId: null,
            evaluationNotes: []
        },
        {
            id: 'demo-c3',
            name: 'Tony Stark',
            skill: 'Frontend',
            interviewDate: '2026-08-23',
            checkInTime: '09:40 AM',
            status: 'WAITING',
            currentRound: 2,
            r1: 'Cleared',
            r2: 'Pending',
            final: 'In Progress',
            round1PanelistId: 'demo-p1',
            round2PanelistId: null,
            assignedPanelistId: null,
            queuedPanelistId: null,
            evaluationNotes: []
        },
        {
            id: 'demo-c4',
            name: 'Bruce Wayne',
            skill: 'DevOps',
            interviewDate: '2026-08-23',
            checkInTime: '08:50 AM',
            status: 'COMPLETED',
            currentRound: 2,
            r1: 'Cleared',
            r2: 'Cleared',
            final: 'Selected',
            round1PanelistId: 'demo-p2',
            round2PanelistId: 'demo-p3',
            assignedPanelistId: null,
            queuedPanelistId: null,
            evaluationNotes: []
        },
        {
            id: 'demo-c5',
            name: 'Natasha Romanoff',
            skill: 'UIUX',
            interviewDate: '2026-08-23',
            checkInTime: '10:00 AM',
            status: 'COMPLETED',
            currentRound: 1,
            r1: 'Rejected',
            r2: 'Pending',
            final: 'Rejected',
            round1PanelistId: 'demo-p1',
            round2PanelistId: null,
            assignedPanelistId: null,
            queuedPanelistId: null,
            evaluationNotes: []
        },
        {
            id: 'demo-c6',
            name: 'Peter Parker',
            skill: 'DataScience',
            interviewDate: '2026-08-22',
            checkInTime: '11:15 PM',
            status: 'IN_PROGRESS',
            currentRound: 2,
            r1: 'Cleared',
            r2: 'Pending',
            final: 'In Progress',
            round1PanelistId: 'demo-p3',
            round2PanelistId: 'demo-p4',
            assignedPanelistId: 'demo-p4',
            queuedPanelistId: null,
            evaluationNotes: []
        }
    ];

    window.panelists = [
        {
            id: 'demo-p1',
            name: 'Jane Doe',
            location: 'Room 101',
            level: 'L4',
            skill: 'Android',
            interviewDate: '2026-08-23',
            status: 'AVAILABLE',
            currentCandidateId: null,
            nextCandidateId: null,
            currentCandidate: null,
            nextCandidate: null,
            startTime: null,
            completed: 4
        },
        {
            id: 'demo-p2',
            name: 'Michael Chen',
            location: 'Room 102',
            level: 'L5',
            skill: 'Backend',
            interviewDate: '2026-08-23',
            status: 'BUSY',
            currentCandidateId: 'demo-c2',
            nextCandidateId: null,
            currentCandidate: 'Sarah Connor (Backend)',
            nextCandidate: null,
            startTime: Date.now() - 14 * 60 * 1000,
            completed: 3
        },
        {
            id: 'demo-p3',
            name: 'Priya Shah',
            location: 'Room 103',
            level: 'L4',
            skill: 'Frontend',
            interviewDate: '2026-08-23',
            status: 'BREAK',
            currentCandidateId: null,
            nextCandidateId: null,
            currentCandidate: null,
            nextCandidate: null,
            startTime: null,
            completed: 5
        },
        {
            id: 'demo-p4',
            name: 'Arjun Rao',
            location: 'Room 104',
            level: 'L3',
            skill: 'DataScience',
            interviewDate: '2026-08-22',
            status: 'BUSY',
            currentCandidateId: 'demo-c6',
            nextCandidateId: null,
            currentCandidate: 'Peter Parker (DataScience)',
            nextCandidate: null,
            startTime: Date.now() - 26 * 60 * 1000,
            completed: 2
        }
    ];

    window.interviewHistory = [
        {
            id: 'demo-h1',
            candidateId: 'demo-c1',
            candidateName: 'John Wick',
            panelistId: 'demo-p1',
            panelistName: 'Jane Doe',
            skill: 'Android',
            round: 1,
            interviewDate: '2026-08-23',
            startedAt: '2026-08-23T09:10:00+05:30',
            completedAt: null,
            decision: null,
            notes: ''
        },
        {
            id: 'demo-h2',
            candidateId: 'demo-c4',
            candidateName: 'Bruce Wayne',
            panelistId: 'demo-p2',
            panelistName: 'Michael Chen',
            skill: 'DevOps',
            round: 1,
            interviewDate: '2026-08-23',
            startedAt: '2026-08-23T08:55:00+05:30',
            completedAt: '2026-08-23T09:30:00+05:30',
            decision: 'SELECT',
            notes: 'Strong technical fundamentals'
        },
        {
            id: 'demo-h3',
            candidateId: 'demo-c4',
            candidateName: 'Bruce Wayne',
            panelistId: 'demo-p3',
            panelistName: 'Priya Shah',
            skill: 'DevOps',
            round: 2,
            interviewDate: '2026-08-23',
            startedAt: '2026-08-23T09:40:00+05:30',
            completedAt: '2026-08-23T10:15:00+05:30',
            decision: 'SELECT',
            notes: 'Excellent system design'
        },
        {
            id: 'demo-h4',
            candidateId: 'demo-c6',
            candidateName: 'Peter Parker',
            panelistId: 'demo-p4',
            panelistName: 'Arjun Rao',
            skill: 'DataScience',
            round: 1,
            interviewDate: '2026-08-22',
            startedAt: '2026-08-22T23:40:00+05:30',
            completedAt: '2026-08-23T00:20:00+05:30',
            decision: 'SELECT',
            notes: 'Saturday session continued past midnight'
        },
        {
            id: 'demo-h5',
            candidateId: 'demo-c6',
            candidateName: 'Peter Parker',
            panelistId: 'demo-p4',
            panelistName: 'Arjun Rao',
            skill: 'DataScience',
            round: 2,
            interviewDate: '2026-08-22',
            startedAt: '2026-08-23T00:30:00+05:30',
            completedAt: null,
            decision: null,
            notes: ''
        }
    ];

    window.skills = [
        { id: 's1', name: 'Android', active: true },
        { id: 's2', name: 'Backend', active: true },
        { id: 's3', name: 'Frontend', active: true },
        { id: 's4', name: 'DevOps', active: true },
        { id: 's5', name: 'DataScience', active: true },
        { id: 's6', name: 'UIUX', active: true },
        { id: 's7', name: 'General', active: true }
    ];

    window.currentProfile = {
        id: 'demo-admin',
        full_name: 'Demo Admin',
        role: 'ADMIN',
        panelist_id: null
    };

    window.currentUser = {
        id: 'demo-admin',
        email: 'demo@interview.local'
    };

    window.activeInterviewDate = '2026-08-23';
    window.recruiterAssignedSkills = ['Android', 'Backend', 'Frontend', 'DevOps', 'DataScience', 'UIUX', 'General'];
    window.activeEvalContext = null;
    window.DB_REQUEST_TIMEOUT_MS = 12000;

    // No-op persistence/auth adapters used by the existing UI.
    window.supabaseClient = {
        auth: {
            async signOut() {},
            async getUser() { return { data: { user: window.currentUser }, error: null }; },
            async getSession() { return { data: { session: { user: window.currentUser } }, error: null }; }
        }
    };

    window.getActiveSkills = function () {
        return window.skills.filter(s => s.active !== false);
    };

    window.saveCandidate = async function (candidate) { return candidate; };
    window.savePanelist = async function (panelist) { return panelist; };
    window.recordInterviewHistory = async function (record) {
        window.interviewHistory.push(record);
        return record;
    };
    window.recordCandidateStatusChange = async function () {};
    window.refreshFromSupabase = async function () {
        if (typeof window.renderAll === 'function') window.renderAll();
    };
    window.persistCandidate = window.saveCandidate;
    window.persistPanelist = window.savePanelist;
    window.updateCandidateInSupabase = window.saveCandidate;
    window.updatePanelistInSupabase = window.savePanelist;

    // In-memory RPC used by the accidental delete button.
    window.supabaseClient.rpc = async function (name, args) {
        if (name === 'delete_waiting_candidate') {
            const candidate = window.queue.find(c => c.id === args.p_candidate_id);
            if (!candidate || candidate.status !== 'WAITING') {
                return { data: null, error: new Error('Only a waiting candidate can be deleted in demo mode.') };
            }
            window.interviewHistory = window.interviewHistory.filter(h => h.candidateId !== candidate.id);
            window.queue = window.queue.filter(c => c.id !== candidate.id);
            return { data: true, error: null };
        }
        return { data: null, error: new Error(`Demo RPC "${name}" is not implemented.`) };
    };

    // In-memory Edge Function simulation for demo user creation.
    window.supabaseClient.functions = {
        async invoke(name, opts) {
            if (name !== 'create-staff-user') {
                return { data: null, error: new Error('Demo function not implemented.') };
            }
            const body = opts?.body || {};
            const id = `demo-user-${Date.now()}`;
            const role = body.role || 'RECRUITER';

            if (role === 'PANELIST') {
                const p = body.panelist || {};
                const panelistId = `demo-p-${Date.now()}`;
                window.panelists.push({
                    id: panelistId,
                    name: body.full_name,
                    location: p.location || 'Main Desk',
                    level: p.level || 'L4',
                    skill: p.skill || 'General',
                    interviewDate: p.interview_date || window.activeInterviewDate,
                    status: 'AVAILABLE',
                    currentCandidateId: null,
                    nextCandidateId: null,
                    currentCandidate: null,
                    nextCandidate: null,
                    startTime: null,
                    completed: 0
                });
                return {
                    data: {
                        ok: true,
                        user: { id, email: body.email, full_name: body.full_name, role },
                        profile: { id, full_name: body.full_name, role, panelist_id: panelistId },
                        panelist: {
                            id: panelistId,
                            interview_date: p.interview_date || window.activeInterviewDate,
                            skill: p.skill || 'General'
                        },
                        temporary_password: body.password || 'Demo@12345'
                    },
                    error: null
                };
            }

            return {
                data: {
                    ok: true,
                    user: { id, email: body.email, full_name: body.full_name, role },
                    profile: { id, full_name: body.full_name, role, panelist_id: null },
                    panelist: null,
                    temporary_password: body.password || 'Demo@12345'
                },
                error: null
            };
        }
    };

    // Bypass auth gate / initialization.
    window.handleLogin = async function () {};
    window.logout = async function () {};
    window.initializeSupabaseApp = async function () {
        if (typeof window.updateRoleUi === 'function') window.updateRoleUi();
        if (typeof window.updateActiveInterviewDateUi === 'function') window.updateActiveInterviewDateUi();
        if (typeof window.renderAll === 'function') window.renderAll();
    };

    window.initDemoData = async function () {
        await window.initializeSupabaseApp();
    };

    // Make external UI calls use in-memory adapters.
    window.DEMO_MODE = true;
})();

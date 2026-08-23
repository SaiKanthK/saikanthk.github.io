# Interview Management Demo (In-Memory)

This version is for demos only.

It has:
- No login
- No database
- No network calls
- In-memory candidates, panelists, skills, history and demo staff creation
- All current workflow/UI features are retained as far as the existing frontend supports them
- Session-date behavior
- Candidate name searches
- Active-date panelist filtering
- Round 1 / Round 2 panelist tracking
- Selected / rejected / on-hold queues
- EOD report
- Panelist audit history
- Admin staff creation demo
- Remove/Delete waiting candidate demo
- 30-minute inactivity/login security is intentionally not active

Open `index.html` directly in a browser or serve the folder with any simple static server.
Data resets on page refresh because it is in memory.

Folder structure:

```text
interview-management-demo/
├── index.html
├── css/
│   └── app.css
└── js/
    ├── 00-demo-state.js
    ├── 01-core-data-auth.js
    ├── 02-navigation.js
    ├── 03-candidates-admin.js
    ├── 04-interviews.js
    └── 05-views-and-startup.js
```

# AmzSphere Swarm Guide

This directory contains the multi-agent swarm configuration for AmzSphere development.

## Agents

| Agent | File | Role |
|-------|------|------|
| A - Orchestrator | `.kilo/agents/orchestrator.md` | Coordinates tasks, tracks mock_db.json, handles confirmations |
| B - Backend Automation | `.kilo/agents/backend.md` | Modifies simulator.py, server.py, database.py |
| C - Frontend & UI | `.kilo/agents/frontend.md` | Modifies static/app.js, static/styles.css, static/index.html |
| D - QA & Verification | `.kilo/agents/qa.md` | Runs `python3 -m unittest discover -s tests -v` |

## Swarm Board

The task queue lives at `.kilo/swarm_board.json`. Each task has:
- `id`: unique task identifier
- `title`: short description
- `agent`: which agent is assigned
- `status`: `pending`, `in_progress`, `completed`, or `blocked`

## How to Spawn a Sub-Agent

Use the `task` tool with the appropriate agent type and prompt:

```python
# Example: Spawn Agent B (backend) for a specific task
task(
    description="Backend task description",
    subagent_type="general",
    prompt="You are Agent B (Backend Automation) for the AmzSphere swarm. Your job is to [specific task]. Read the task from /home/lkkolokoy/AmzSphere/.kilo/swarm-board.json where your assigned tasks have agent='backend' and status='pending'. Mark the task in_progress before starting. After completing, run 'python3 -m unittest discover -s tests -v' from /home/lkkolokoy/AmzSphere to verify. Update the board with your results."
)
```

## State Monitoring

The orchestrator tracks `mock_db.json` changes via `git diff`. Run:
```bash
cd /home/lkkolokoy/AmzSphere && git diff mock_db.json
```

## Test Command

All agents should verify with:
```bash
cd /home/lkkolokoy/AmzSphere && python3 -m unittest discover -s tests -v
```
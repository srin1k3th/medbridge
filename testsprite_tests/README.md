# MedBridge — TestSprite Test Suite

This folder contains AI-generated E2E tests produced by [TestSprite MCP](https://www.testsprite.com/solutions/mcp).

## What's Being Tested

| Feature | Test Type | Coverage |
|---|---|---|
| Signup & Login flow | E2E UI | Auth, profile save |
| Discharge Analyser | E2E UI + API | PDF text → LLM → summary |
| Symptom Checker | E2E UI + API | Classification + WhatsApp alert |
| Prescription Tracker | E2E UI + API | Extract → save → delete |
| Drug Lookup | API | FDA + LLM fallback |
| Reminders | E2E UI | Add / toggle / delete med & appt |

## How to Run Tests

1. Make sure both servers are running:
   - Backend: `http://localhost:8000`
   - Frontend: `http://localhost:3000`

2. Run via TestSprite MCP in your IDE, or through the TestSprite dashboard.

## Round History

- **Round 1**: Initial test generation — baseline coverage
- **Round 2**: After bug fixes — regression + new feature coverage

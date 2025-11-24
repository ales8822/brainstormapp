# Debate Feature Implementation Plan

## Objective
Implement a "Debate Mode" where users can select agents to debate a topic, dynamically manage participants, and generate a side-by-side summary of arguments upon completion.

## 1. Planning & Architecture
- [ ] **Define Debate Flow**: A debate is a specialized interaction within a meeting or workspace where specific agents take turns arguing points.
- [ ] **Prompt Engineering**: Design a specific "Secretary Prompt" that analyzes the debate transcript and produces a side-by-side comparison of arguments.

## 2. Backend Implementation
- [ ] **LLM Service (`backend/services/llm_service.py`)**:
    -   Add `synthesize_debate_summary(transcript)`: Should return a structured comparison (e.g., Markdown table or specific JSON).
- [ ] **Router (`backend/routers/meeting.py`)**:
    -   Ensure existing endpoints support dynamic participant updates (if not already stateless).
    -   Add endpoint for generating the debate summary.

## 3. Frontend - Dynamic Participant Management (Prerequisite)
- [ ] **Meeting Board**:
    -   Add UI to "Add Agent" to an active meeting (e.g., a "+" button in the empty chairs or a menu).
    -   Add UI to "Remove Agent" (e.g., "X" on the agent avatar).
    -   Update `App.js` to handle these state changes dynamically.

## 4. Frontend - Debate Interface
- [ ] **Controls**:
    -   Add "Start Debate" button in Meeting/Workspace panels.
    -   **Participant Selector**: A modal or inline list to check/uncheck which agents will participate in the debate.
- [ ] **Active Debate Mode**:
    -   Visual indicator (e.g., "🔴 Debate in Progress").
    -   "End Debate" button.
- [ ] **Summary View**:
    -   A dedicated view to render the "Secretary's Report" with side-by-side arguments.

## 5. Integration Points
- [ ] **Meeting Board**: Integrate debate controls into the `meeting-in-progress-panel`.
- [ ] **Node Details**: Add a "Debate" tab or button in the Node Inspector/Details view.
- [ ] **Working Canvas**: Ensure debate can be triggered for the active idea node.

## 6. Testing
- [ ] Verify dynamic add/remove of agents.
- [ ] Verify debate flow (Start -> Discuss -> End).
- [ ] Verify summary generation and formatting.

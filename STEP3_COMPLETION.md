# Step 3 Completion Guide: Secretary Follow-up Chat

## Current Status

✅ **Backend Complete:**
- `SecretaryQueryRequest` schema added to `backend/schemas.py`
- `query_secretary()` method implemented in `backend/services/llm_service.py`
- `POST /api/meetings/query-secretary` endpoint created in `backend/routers/meeting.py`

✅ **Frontend UI Added:**
- Secretary chat section HTML added to `frontend/index.html` (lines 235-242)
- Includes chat messages container and input field

⏳ **Remaining Work:**
1. Add CSS styling for secretary chat
2. Add API method to `ApiService.js`
3. Wire up JavaScript handlers in `App.js`

---

## Task 1: Add CSS Styling

**File:** `frontend/style.css`

Add the following CSS at the end of the file (after the `.minutes-content` styles):

```css
/* Secretary Chat Section */
.secretary-chat-section {
  border-top: 1px solid #333;
  padding: 20px;
  background-color: #252525;
}

.secretary-chat-messages {
  max-height: 200px;
  overflow-y: auto;
  margin-bottom: 15px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.secretary-chat-message {
  padding: 10px;
  border-radius: 6px;
  line-height: 1.4;
}

.secretary-chat-message.user {
  background-color: #2d4a7c;
  color: #ecf0f1;
  align-self: flex-end;
  max-width: 80%;
}

.secretary-chat-message.assistant {
  background-color: #2d2d2d;
  color: #ecf0f1;
  align-self: flex-start;
  max-width: 80%;
  border-left: 3px solid #3498db;
}

.secretary-chat-input-container {
  display: flex;
  gap: 10px;
}

#secretary-query-input {
  flex-grow: 1;
  padding: 10px;
  border: 1px solid #444;
  border-radius: 6px;
  background-color: #2d2d2d;
  color: #ecf0f1;
  font-size: 14px;
}

#secretary-query-input:focus {
  outline: none;
  border-color: #3498db;
}

#send-secretary-query-btn {
  padding: 10px 20px;
  white-space: nowrap;
}
```

---

## Task 2: Add API Method

**File:** `frontend/js/services/ApiService.js`

Add this method to the `ApiService` class (after the `streamMeeting` method):

```javascript
async querySecretary(payload) {
  try {
    const response = await fetch(`${this.baseUrl}/meetings/query-secretary`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Server error: ${response.status}`);
    }

    const data = await response.json();
    return data;
  } catch (error) {
    console.error("Query secretary API call failed:", error);
    throw error;
  }
}
```

---

## Task 3: Wire Up JavaScript Handlers

**File:** `frontend/js/App.js`

### 3.1: Add DOM References (in constructor, around line 115)

```javascript
// --- MEETING MINUTES REFS ---
this.meetingMinutesPanel = document.getElementById("meeting-minutes-panel");
this.meetingMinutesContent = document.getElementById("meeting-minutes-content");
this.promoteMinutesBtn = document.getElementById("promote-minutes-btn");
this.exportMinutesBtn = document.getElementById("export-minutes-btn");

// Add these new references:
this.secretaryChatMessages = document.getElementById("secretary-chat-messages");
this.secretaryQueryInput = document.getElementById("secretary-query-input");
this.sendSecretaryQueryBtn = document.getElementById("send-secretary-query-btn");

this.meetingAgents = {}; // { chairIndex: agentName }
this.currentMeetingMinutes = ""; // Store minutes for export/promote
```

### 3.2: Add Event Listener (around line 355, after other button listeners)

```javascript
this.sendSecretaryQueryBtn.addEventListener("click", () =>
  this.handleSecretaryQuery()
);

// Also add Enter key support
this.secretaryQueryInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    this.handleSecretaryQuery();
  }
});
```

### 3.3: Add Handler Method (after `handleExportMinutes`, around line 510)

```javascript
async handleSecretaryQuery() {
  const query = this.secretaryQueryInput.value.trim();
  
  if (!query) {
    return;
  }
  
  if (!this.currentMeetingMinutes) {
    alert("No meeting minutes available to query.");
    return;
  }
  
  // Display user's question
  this.appendSecretaryMessage("user", query);
  
  // Clear input
  this.secretaryQueryInput.value = "";
  
  // Show loading indicator
  const loadingMsg = this.appendSecretaryMessage("assistant", "Thinking...");
  loadingMsg.classList.add("thinking");
  
  try {
    const payload = {
      topic: this.meetingTopicInput.value.trim(),
      company_context: this.companyContextInput.value.trim(),
      minutes: this.currentMeetingMinutes,
      query: query
    };
    
    const data = await this.api.querySecretary(payload);
    
    // Remove loading message
    loadingMsg.remove();
    
    // Display secretary's response
    this.appendSecretaryMessage("assistant", data.response);
    
  } catch (error) {
    loadingMsg.remove();
    this.appendSecretaryMessage("assistant", `Error: ${error.message}`);
  }
}

appendSecretaryMessage(role, text) {
  const msg = document.createElement("div");
  msg.className = `secretary-chat-message ${role}`;
  msg.textContent = text;
  
  this.secretaryChatMessages.appendChild(msg);
  this.secretaryChatMessages.scrollTop = this.secretaryChatMessages.scrollHeight;
  
  return msg; // Return for potential removal (loading indicator)
}
```

---

## Testing Checklist

Once implemented, test the following:

1. ✅ Start a meeting with 2+ agents
2. ✅ Wait for meeting to complete and minutes to appear
3. ✅ Verify minutes panel is visible with formatted content
4. ✅ Type a question in the secretary chat input (e.g., "What were the main concerns?")
5. ✅ Click "Ask" button or press Enter
6. ✅ Verify your question appears in the chat
7. ✅ Verify "Thinking..." appears briefly
8. ✅ Verify secretary's response appears
9. ✅ Test multiple follow-up questions
10. ✅ Verify "Promote to Node" still works
11. ✅ Verify "Export as MD" still works

---

## Architecture Notes

**Data Flow:**
1. User types question → `handleSecretaryQuery()` called
2. Payload created with topic, context, minutes, and query
3. `ApiService.querySecretary()` calls `POST /api/meetings/query-secretary`
4. Backend `query_secretary()` uses Gemini to answer based on minutes
5. Response displayed in chat UI

**Key Points:**
- Secretary has full context (topic, company context, and complete minutes)
- Uses Gemini's `_get_gemini_chat()` for intelligent Q&A
- Chat history is NOT maintained (each query is independent)
- If you want conversation history, modify the backend to accept a `history` parameter

---

## Optional Enhancements

If you want to improve the feature later:

1. **Conversation History:** Maintain chat history and pass it to the backend
2. **Suggested Questions:** Add quick-action buttons with common questions
3. **Copy Response:** Add a copy button to secretary responses
4. **Voice Input:** Add speech-to-text for queries
5. **Export Chat:** Include Q&A in the exported markdown
6. **Typing Indicator:** Animate the "Thinking..." message

---

## File Summary

**Modified Files:**
- `backend/schemas.py` - Added `SecretaryQueryRequest`
- `backend/services/llm_service.py` - Added `query_secretary()` method
- `backend/routers/meeting.py` - Added `/query-secretary` endpoint
- `frontend/index.html` - Added secretary chat UI

**Files to Modify:**
- `frontend/style.css` - Add secretary chat styles
- `frontend/js/services/ApiService.js` - Add `querySecretary()` method
- `frontend/js/App.js` - Add DOM refs, event listeners, and handlers

---

## Estimated Time to Complete

- Task 1 (CSS): 5 minutes
- Task 2 (API method): 3 minutes
- Task 3 (JS handlers): 10 minutes
- Testing: 5 minutes

**Total: ~25 minutes**

---

## Questions or Issues?

If you encounter any problems:

1. Check browser console for JavaScript errors
2. Check backend logs for API errors
3. Verify the payload structure matches `SecretaryQueryRequest`
4. Ensure `currentMeetingMinutes` is populated before querying

Good luck! 🚀

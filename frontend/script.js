// === DOM ELEMENT REFERENCES ===
const promptInput = document.getElementById('prompt-input'), submitButton = document.getElementById('submit-button'), loader = document.getElementById('loader'), cyContainer = document.getElementById('cy'), promptLabel = document.getElementById('prompt-label');
const ideaModal = document.getElementById('idea-modal'), modalTitle = document.getElementById('modal-title'), modalTextContent = document.getElementById('modal-text-content'), modalDeleteButton = document.getElementById('modal-delete-button'), modalCloseButton = document.getElementById('modal-close-button');
const statusButtonsContainer = document.querySelector('.status-controls');
const chatForm = document.getElementById('chat-form');
const chatInput = document.getElementById('chat-input');
const chatMessages = document.getElementById('chat-messages');

// === APP STATE ===
let selectedNode = null;
let activeConversationHistory = [];

// === HELPER FUNCTION ===
function uuid_v4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// === CYTOSCAPE INITIALIZATION ===
const cy = cytoscape({
    container: cyContainer,
    style: [
        { selector: 'node', style: { 'label': 'data(label)', 'width': '150px', 'height': '150px', 'text-valign': 'center', 'text-halign': 'center', 'text-wrap': 'wrap', 'text-max-width': '140px', 'color': '#fff', 'font-size': '14px', 'font-weight': 'bold', 'transition-property': 'background-color, shape', 'transition-duration': '0.3s' }},
        { selector: ':selected', style: { 'border-color': '#f1c40f', 'border-width': 5, 'border-style': 'solid' }},
        { selector: '.user-node', style: { 'shape': 'round-rectangle' }},
        { selector: '.ai-node', style: { 'shape': 'ellipse' }},
        { selector: '.status-Idea', style: { 'background-color': '#3498db' } },
        { selector: '.status-InProgress', style: { 'background-color': '#f39c12' } },
        { selector: '.status-Completed', style: { 'background-color': '#27ae60' } },
        { selector: '.status-Archived', style: { 'background-color': '#95a5a6' } },
        { selector: 'edge', style: { 'width': 3, 'line-color': '#bdc3c7', 'target-arrow-color': '#bdc3c7', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' }},
        { selector: 'edge[label]', style: { 'label': 'data(label)', 'font-size': '10px', 'color': '#34495e', 'text-rotation': 'autorotate', 'text-background-color': '#ecf0f1', 'text-background-opacity': 1, 'text-background-padding': '3px' }}
    ],
    elements: [],
});

// === API-DRIVEN FUNCTIONS ===
async function loadGraph() { try { const response = await fetch('http://127.0.0.1:8000/api/graph'); const elements = await response.json(); cy.elements().remove(); elements.forEach(el => { if (el.group === 'nodes' && el.data.status) { el.classes += ` status-${el.data.status}`; } }); cy.add(elements); cy.layout({ name: 'cose', animate: false, padding: 50 }).run(); } catch (error) { console.error("Failed to load graph:", error); } }
async function updateNodeStatus(newStatus) { if (!selectedNode) return; try { await fetch(`http://127.0.0.1:8000/api/nodes/${selectedNode.id()}/status`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status: newStatus }), }); selectedNode.data('status', newStatus); const baseClass = selectedNode.hasClass('user-node') ? 'user-node' : 'ai-node'; selectedNode.classes(`${baseClass} status-${newStatus}`); updateModalStatusButtons(); } catch (error) { console.error("Error updating status:", error); alert("Could not update status."); } }
async function deleteSelectedNode() { if (!selectedNode) return; const nodeId = selectedNode.id(); try { await fetch(`http://127.0.0.1:8000/api/nodes/${nodeId}`, { method: 'DELETE' }); await loadGraph(); selectedNode = null; closeModal(); updatePromptUI(); } catch (error) { console.error("Error deleting node branch:", error); alert("Could not delete node branch."); } }

// === UI & EVENT LISTENERS ===
cy.on('tap', 'node', (event) => { selectedNode = event.target; openModal(); });
cy.on('tap', (event) => { if (event.target === cy) { if(selectedNode) { selectedNode.unselect(); selectedNode = null; } updatePromptUI(); } });

async function openModal() {
    if (!selectedNode) return;
    const nodeId = selectedNode.id();
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/nodes/${nodeId}/chat`);
        if (!response.ok) throw new Error("Could not fetch chat history.");
        activeConversationHistory = await response.json();
        chatMessages.innerHTML = '';
        activeConversationHistory.forEach(message => { appendChatMessage(message.parts[0], message.role); });
    } catch (error) { console.error("Failed to load chat history:", error); activeConversationHistory = []; chatMessages.innerHTML = '<div class="chat-message model">Could not load history.</div>'; }
    modalTitle.innerText = selectedNode.data('label');
    modalTextContent.innerText = selectedNode.data('fullText');
    updateModalStatusButtons();
    ideaModal.style.display = 'flex';
}

function closeModal() { ideaModal.style.display = 'none'; }
function updateModalStatusButtons() { const currentStatus = selectedNode.data('status'); document.querySelectorAll('.status-btn').forEach(btn => { btn.classList.toggle('active', btn.dataset.status === currentStatus); }); }
function updatePromptUI() { if (selectedNode) { promptLabel.innerText = "Enter a follow-up..."; submitButton.innerText = "Brainstorm from Selected"; } else { promptLabel.innerText = "Enter a new idea..."; submitButton.innerText = "Create Idea Node"; } }
modalCloseButton.addEventListener('click', closeModal);
modalDeleteButton.addEventListener('click', deleteSelectedNode);
statusButtonsContainer.addEventListener('click', (event) => { if (event.target.classList.contains('status-btn')) { const newStatus = event.target.dataset.status; updateNodeStatus(newStatus); } });

chatForm.addEventListener('submit', async (event) => {
    event.preventDefault(); // Stop page reload
    event.stopPropagation(); // --- FIX #1: Stop event from bubbling up to the canvas ---

    const userMessage = chatInput.value;
    if (!userMessage.trim()) return;
    appendChatMessage(userMessage, 'user');
    chatInput.value = '';
    const chatSubmitButton = chatForm.querySelector('button');
    chatSubmitButton.disabled = true;

    try {
        const response = await fetch('http://127.0.0.1:8000/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ nodeId: selectedNode.id(), nodeContext: selectedNode.data('fullText'), history: activeConversationHistory, userMessage: userMessage })
        });
        if (!response.ok) { const err = await response.json(); throw new Error(err.detail); }
        const data = await response.json();
        const aiMessage = data.response;
        appendChatMessage(aiMessage, 'model');

        activeConversationHistory = [ ...activeConversationHistory, { role: "user", parts: [userMessage] }, { role: "model", parts: [aiMessage] }];
        
    } catch (error) {
        console.error("Chat error:", error);
        appendChatMessage(`Sorry, an error occurred: ${error.message || 'Unknown error'}`, 'model');
    } finally {
        chatSubmitButton.disabled = false;
        // --- FIX #2: Only focus if the modal is still visible ---
        if (ideaModal.style.display !== 'none') {
            chatInput.focus();
        }
    }
});

function appendChatMessage(text, role) { const messageDiv = document.createElement('div'); messageDiv.classList.add('chat-message', role); messageDiv.textContent = text; chatMessages.appendChild(messageDiv); chatMessages.scrollTop = chatMessages.scrollHeight; }

// === MAIN BRAINSTORM SUBMIT LISTENER ===
submitButton.addEventListener('click', async () => { const promptText = promptInput.value; if (!promptText.trim()) { alert("Please enter some text!"); return; } loader.style.display = 'block'; submitButton.disabled = true; let apiContext = null; let sourceNodeId = null; if (selectedNode) { sourceNodeId = selectedNode.id(); apiContext = selectedNode.data('fullText'); } else { sourceNodeId = `node-user-${uuid_v4()}`; cy.add({ group: 'nodes', data: { id: sourceNodeId, label: promptText, fullText: promptText, status: 'Idea' }, classes: 'user-node status-Idea' }); } try { const response = await fetch('http://127.0.0.1:8000/api/brainstorm', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt: promptText, parent_context: apiContext, source_node_id: sourceNodeId }), }); if (!response.ok) { const err = await response.json(); throw new Error(err.detail || "API request failed"); } const data = await response.json(); if (selectedNode) { sourceNodeId = data.user_node_id; } cy.add([ { group: 'nodes', data: { id: data.ai_node.id, label: data.ai_node.label, fullText: data.ai_node.fullText, status: 'Idea' }, classes: 'ai-node status-Idea' }, { group: 'edges', data: { id: `edge-${sourceNodeId}-${data.ai_node.id}`, source: sourceNodeId, target: data.ai_node.id, label: promptText } } ]); cy.layout({ name: 'cose', animate: true, padding: 50 }).run(); } catch (error) { console.error("Error in brainstorming process:", error); alert(error.message); if (!selectedNode) { cy.getElementById(sourceNodeId).remove(); } } finally { loader.style.display = 'none'; submitButton.disabled = false; promptInput.value = ''; } });

// === INITIALIZE APP ===
loadGraph();
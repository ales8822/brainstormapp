// === DOM ELEMENT REFERENCES ===
const promptInput = document.getElementById('prompt-input'), submitButton = document.getElementById('submit-button'), loader = document.getElementById('loader'), cyContainer = document.getElementById('cy'), promptLabel = document.getElementById('prompt-label');
const ideaModal = document.getElementById('idea-modal'), modalTitle = document.getElementById('modal-title'), modalTextContent = document.getElementById('modal-text-content'), modalDeleteButton = document.getElementById('modal-delete-button'), modalCloseButton = document.getElementById('modal-close-button');
const statusButtonsContainer = document.querySelector('.status-controls');

// === APP STATE ===
let selectedNode = null;

// === CYTOSCAPE INITIALIZATION ===
const cy = cytoscape({
    container: cyContainer,
    style: [
        { selector: 'node', style: { /* ... base styles ... */ 'label': 'data(label)', 'width': '150px', 'height': '150px', 'text-valign': 'center', 'text-halign': 'center', 'text-wrap': 'wrap', 'text-max-width': '140px', 'color': '#fff', 'font-size': '14px', 'font-weight': 'bold', 'transition-property': 'background-color', 'transition-duration': '0.3s' }},
        { selector: 'edge', style: { /* ... edge styles ... */ 'width': 3, 'line-color': '#bdc3c7', 'target-arrow-color': '#bdc3c7', 'target-arrow-shape': 'triangle', 'curve-style': 'bezier' }},
        { selector: ':selected', style: { 'border-color': '#f1c40f', 'border-width': 5, 'border-style': 'solid' }},
        // NEW: Status-based coloring
        { selector: '.status-Idea', style: { 'background-color': '#3498db' } }, // Blue (Default)
        { selector: '.status-InProgress', style: { 'background-color': '#f39c12' } }, // Orange
        { selector: '.status-Completed', style: { 'background-color': '#27ae60' } }, // Green
        { selector: '.status-Archived', style: { 'background-color': '#95a5a6' } } // Grey
    ],
    elements: [], 
});

// === API-DRIVEN FUNCTIONS ===
async function loadGraph() {
    try {
        const response = await fetch('http://127.0.0.1:8000/api/graph');
        const elements = await response.json();
        cy.elements().remove();
        // Add the correct status class to each node on load
        elements.forEach(el => {
            if (el.group === 'nodes' && el.data.status) {
                el.classes = `status-${el.data.status}`;
            }
        });
        cy.add(elements);
        cy.layout({ name: 'cose', animate: false, padding: 50 }).run();
    } catch (error) { console.error("Failed to load graph:", error); }
}

async function deleteSelectedNode() {
    if (!selectedNode) return;
    const nodeId = selectedNode.id();
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/nodes/${nodeId}`, {
            method: 'DELETE'
        });
        if (!response.ok) throw new Error("Failed to delete node on server.");
        
        // On success, remove from canvas
        cy.remove(selectedNode);
        selectedNode = null;
        closeModal();
        updatePromptUI(); // Reset the UI since nothing is selected
    } catch (error) {
        console.error("Error deleting node:", error);
        alert("Could not delete the node. Please try again.");
    }
}
async function updateNodeStatus(newStatus) {
    if (!selectedNode) return;
    try {
        const response = await fetch(`http://127.0.0.1:8000/api/nodes/${selectedNode.id()}/status`, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ status: newStatus }),
        });
        if (!response.ok) throw new Error('Failed to update status on server.');
        
        // Update on the canvas for instant feedback
        selectedNode.data('status', newStatus); // Update internal data
        selectedNode.classes(`status-${newStatus}`); // This changes the color
        updateModalStatusButtons(); // Update the active button in the modal
    } catch (error) {
        console.error("Error updating status:", error);
        alert("Could not update the node's status.");
    }
}

// === UI & EVENT LISTENERS ===
cy.on('tap', 'node', (event) => { selectedNode = event.target; openModal(); });
cy.on('tap', (event) => { if (event.target === cy) { if(selectedNode) { selectedNode.unselect(); selectedNode = null; } updatePromptUI(); } });
function openModal() {
    if (!selectedNode) return;
    modalTitle.innerText = selectedNode.data('label');
    modalTextContent.innerText = selectedNode.data('fullText');
    updateModalStatusButtons();
    ideaModal.style.display = 'flex';
}
function closeModal() { ideaModal.style.display = 'none'; }
function updateModalStatusButtons() {
    const currentStatus = selectedNode.data('status');
    document.querySelectorAll('.status-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.status === currentStatus);
    });
}
function updatePromptUI() { /* ... (same as before) ... */ }

// Main Event Listeners
modalCloseButton.addEventListener('click', closeModal);
modalDeleteButton.addEventListener('click', deleteSelectedNode);
statusButtonsContainer.addEventListener('click', (event) => {
    if (event.target.classList.contains('status-btn')) {
        const newStatus = event.target.dataset.status;
        updateNodeStatus(newStatus);
    }
});

// Brainstorm submit button (no changes needed)
submitButton.addEventListener('click', async () => { /* ... (same as before) ... */ });

// === INITIALIZE APP ===
loadGraph();
// Get references to the HTML elements
const promptInput = document.getElementById('prompt-input');
const submitButton = document.getElementById('submit-button');
const responseContainer = document.getElementById('response-container');
const loader = document.getElementById('loader');

// Add a click event listener to the button
submitButton.addEventListener('click', async () => {
    const prompt = promptInput.value;

    // Basic validation: Do not send if prompt is empty
    if (!prompt.trim()) {
        alert("Please enter an idea to brainstorm!");
        return;
    }

    // Show the loader and disable the button
    loader.style.display = 'block';
    responseContainer.style.display = 'none';
    submitButton.disabled = true;

    try {
        // Make the API call to our FastAPI backend
        const response = await fetch('http://127.0.0.1:8000/api/brainstorm', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ prompt: prompt }),
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        
        // Display the response from the AI
        responseContainer.innerHTML = `<p>${data.response}</p>`;

    } catch (error) {
        // Display an error message if something goes wrong
        console.error("Error fetching from API:", error);
        responseContainer.innerHTML = `<p style="color: red;">Failed to get a response. Is the backend server running?</p>`;
    } finally {
        // Hide the loader and re-enable the button
        loader.style.display = 'none';
        responseContainer.style.display = 'block';
        submitButton.disabled = false;
    }
});
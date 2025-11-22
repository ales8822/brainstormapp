class MeetingHistory {
    constructor(api, app) {
        this.api = api;
        this.app = app;

        this.modal = document.getElementById("history-modal");
        this.listContainer = document.getElementById("history-list");
        this.closeBtn = document.getElementById("history-close-button");
        this.openBtn = document.getElementById("meeting-history-button");

        this.init();
    }

    init() {
        if (this.openBtn) {
            this.openBtn.addEventListener("click", () => this.open());
        }
        if (this.closeBtn) {
            this.closeBtn.addEventListener("click", () => this.close());
        }

        // Close on click outside
        this.modal.addEventListener("click", (e) => {
            if (e.target === this.modal) this.close();
        });
    }

    async open() {
        this.modal.style.display = "flex";
        await this.loadHistory();
    }

    close() {
        this.modal.style.display = "none";
    }

    async loadHistory() {
        this.listContainer.innerHTML = "Loading...";
        try {
            const meetings = await this.api.getMeetingHistory();
            this.renderList(meetings);
        } catch (error) {
            console.error("Failed to load history:", error);
            this.listContainer.innerHTML = "Failed to load history.";
        }
    }

    renderList(meetings) {
        this.listContainer.innerHTML = "";

        if (meetings.length === 0) {
            this.listContainer.innerHTML = "<p style='color: #888; padding: 10px;'>No past meetings found.</p>";
            return;
        }

        meetings.forEach(meeting => {
            const item = document.createElement("div");
            item.className = "history-item";
            item.style.padding = "15px";
            item.style.backgroundColor = "#2d2d2d";
            item.style.borderRadius = "8px";
            item.style.cursor = "pointer";
            item.style.border = "1px solid #444";
            item.style.transition = "background-color 0.2s";

            item.onmouseover = () => item.style.backgroundColor = "#3d3d3d";
            item.onmouseout = () => item.style.backgroundColor = "#2d2d2d";

            const date = new Date(meeting.start_time).toLocaleString();
            const isInProgress = !meeting.end_time;
            const statusBadge = isInProgress
                ? '<span style="display: inline-block; background-color: #f39c12; color: #000; padding: 2px 8px; border-radius: 4px; font-size: 0.75em; font-weight: bold; margin-left: 8px;">IN PROGRESS</span>'
                : '';

            item.innerHTML = `
        <div style="font-weight: bold; font-size: 1.1em; margin-bottom: 5px; color: #ecf0f1;">
            ${meeting.topic}${statusBadge}
        </div>
        <div style="color: #888; font-size: 0.9em;">${date}</div>
      `;

            item.addEventListener("click", () => this.loadMeeting(meeting.id));
            this.listContainer.appendChild(item);
        });
    }

    async loadMeeting(meetingId) {
        try {
            const details = await this.api.getMeetingDetails(meetingId);
            this.app.restoreMeeting(details);
            this.close();
        } catch (error) {
            console.error("Failed to load meeting details:", error);
            alert("Failed to load meeting details.");
        }
    }
}

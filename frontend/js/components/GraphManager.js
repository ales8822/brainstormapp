// frontend/js/components/GraphManager.js
// This file will contain all the logic for initializing Cytoscape, loading graph data, and handling node clicks.

class GraphManager {
  constructor(containerId, apiService) {
    console.log("GraphManager: Initializing...");
    this.api = apiService;
    const attachmentIcon = "📄";

    this.cy = cytoscape({
      container: document.getElementById(containerId),
      style: [
        {
          selector: "node",
          style: {
            label: "data(label)",
            width: "150px",
            height: "150px",
            "text-valign": "center",
            "text-halign": "center",
            "text-wrap": "wrap",
            "text-max-width": "140px",
            color: "#fff",
            "font-size": "14px",
            "font-weight": "bold",
            "transition-property": "background-color, shape",
            "transition-duration": "0.3s",
          },
        },
        {
          selector: ":selected",
          style: {
            "border-color": "#f1c40f",
            "border-width": 5,
            "border-style": "solid",
          },
        },
        { selector: ".user-node", style: { shape: "round-rectangle" } },
        { selector: ".ai-node", style: { shape: "ellipse" } },
        { selector: ".status-Idea", style: { "background-color": "#3498db" } },
        {
          selector: ".status-InProgress",
          style: { "background-color": "#f39c12" },
        },
        {
          selector: ".status-Completed",
          style: { "background-color": "#27ae60" },
        },
        {
          selector: ".status-Archived",
          style: { "background-color": "#95a5a6" },
        },
        {
          selector: "edge",
          style: {
            width: 3,
            "line-color": "#bdc3c7",
            "target-arrow-color": "#bdc3c7",
            "target-arrow-shape": "triangle",
            "curve-style": "bezier",
          },
        },
        {
          selector: "edge[label]",
          style: {
            label: "data(label)",
            "font-size": "10px",
            color: "#34495e",
            "text-rotation": "autorotate",
            "text-background-color": "#ecf0f1",
            "text-background-opacity": 1,
            "text-background-padding": "3px",
          },
        },
        {
          selector: ".has-attachment",
          style: {
            // Add a border to visually indicate an attachment
            "border-color": "#ffffff",
            "border-width": 4,
            "border-style": "double",
          },
        },
      ],
      elements: [],
    });
    console.log("GraphManager: Cytoscape instance created.");
  }

  async loadGraph() {
    console.log("GraphManager: Loading graph data from API...");
    try {
      const elementsFromServer = await this.api.getGraph();
      this.cy.elements().remove();

      const processedElements = elementsFromServer.map((el) => {
        if (el.group === "nodes") {
          let classes = el.classes || "";
          if (el.data.status) {
            classes += ` status-${el.data.status}`;
          }
          if (el.data.attachment_path) {
            classes += " has-attachment";
          }
          el.classes = classes.trim();
        }
        return el;
      });

      this.cy.add(processedElements);
      this.cy.layout({ name: "cose", animate: false, padding: 50 }).run();
      console.log("GraphManager: Graph loaded and rendered.");
    } catch (error) {
      console.error("GraphManager: Failed to load graph.", error);
    }
  }

  addNode(nodeData, classes = "") {
    console.log("GraphManager: Adding node:", nodeData);
    return this.cy.add({ group: "nodes", data: nodeData, classes: classes });
  }

  addEdge(edgeData) {
    console.log("GraphManager: Adding edge:", edgeData);
    return this.cy.add({ group: "edges", data: edgeData });
  }

  removeNodeById(nodeId) {
    console.log(`GraphManager: Removing node by ID: ${nodeId}`);
    const node = this.cy.getElementById(nodeId);
    if (node) {
      this.cy.remove(node);
    }
  }

  rerunLayout() {
    console.log("GraphManager: Rerunning layout...");
    this.cy.layout({ name: "cose", animate: true, padding: 50 }).run();
  }

  onNodeClick(callback) {
    console.log("GraphManager: Registering node click handler.");
    this.cy.on("tap", "node", (event) => {
      const node = event.target;
      console.log(`GraphManager: Node clicked with ID: ${node.id()}`);
      callback(node); // Pass the cytoscape node object to the callback
    });
  }

  onCanvasClick(callback) {
    console.log("GraphManager: Registering canvas click handler.");
    this.cy.on("tap", (event) => {
      if (event.target === this.cy) {
        console.log("GraphManager: Canvas background clicked.");
        callback();
      }
    });
  }
}

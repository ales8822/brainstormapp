// frontend/js/components/GraphManager.js

class GraphManager {
  constructor(containerId, apiService) {
    console.log("GraphManager: Initializing...");
    this.api = apiService;

    this.cy = cytoscape({
      container: document.getElementById(containerId),
      boxSelectionEnabled: false,
      // autounselectify: true,
      style: [
        // This style array is correct and unchanged
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
          },
        },
        {
          selector: ":selected",
          style: { "border-color": "#f1c40f", "border-width": 5 },
        },
        {
          selector: ".edge-source-selected",
          style: {
            // --- FIX: Cytoscape does not support box-shadow. This creates a glow. ---
            "border-width": "10px",
            "border-color": "#27ae60",
            "border-opacity": 0.5,
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
          selector: "edge:selected",
          style: {
            width: 5, // Make it thicker
            "line-color": "#f1c40f", // Use the same yellow as node selection
            "target-arrow-color": "#f1c40f",
          },
        },
        {
          selector: "edge[label]",
          style: {
            label: "data(label)",
            "font-size": "10px",
            color: "#34495e",
          },
        },
        {
          selector: ".has-attachment",
          style: {
            "border-color": "#ffffff",
            "border-width": 4,
            "border-style": "double",
          },
        },
      ],
      elements: [],
    });

    if (typeof this.cy.nodeHtmlLabel === "function") {
      this.cy.nodeHtmlLabel([
        {
          query: "node",
          halign: "center",
          valign: "top",
          halignBox: "center",
          valignBox: "top",
          tpl: (data) =>
            `<div class="edge-connector-button" data-node-id="${data.id}">+</div>`,
        },
      ]);
    }

    // Manually handle hover effects for the HTML label
    this.cy.on("mouseover", "node", (event) => {
      const node = event.target;
      const el = document.querySelector(
        `.cy-node-html-label[data-cy-id="${node.id()}"]`
      );
      if (el) el.classList.add("cy-node-html-label-hover");
    });

    this.cy.on("mouseout", "node", (event) => {
      const node = event.target;
      const el = document.querySelector(
        `.cy-node-html-label[data-cy-id="${node.id()}"]`
      );
      if (el) el.classList.remove("cy-node-html-label-hover");
    });

    console.log("GraphManager: Cytoscape instance created.");
  }

  initLabels() {
    if (typeof this.cy.nodeHtmlLabel === "function") {
      console.log("GraphManager: Initializing HTML labels.");
      this.cy.nodeHtmlLabel([
        {
          query: "node",
          halign: "center",
          valign: "top",
          halignBox: "center",
          valignBox: "top",
          tpl: (data) =>
            `<div class="edge-connector-button" data-node-id="${data.id}">+</div>`,
        },
      ]);
    } else {
      console.warn(
        "GraphManager: nodeHtmlLabel function not found on instance, cannot init labels."
      );
    }
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
    let finalClasses = classes;
    // Check for attachment_path in the data object itself.
    if (nodeData.attachment_path && !finalClasses.includes("has-attachment")) {
      finalClasses += " has-attachment";
    }
    console.log(
      "GraphManager: Adding node:",
      nodeData,
      "with classes:",
      finalClasses.trim()
    );
    return this.cy.add({
      group: "nodes",
      data: nodeData,
      classes: finalClasses.trim(),
    });
  }

  addNodes(nodes) {
    return this.cy.add(nodes);
  }

  addEdge(edgeData) {
    return this.cy.add({ group: "edges", data: edgeData });
  }

  clear() {
    this.cy.elements().remove();
  }

  removeNodeById(nodeId) {
    const node = this.cy.getElementById(nodeId);
    if (node) {
      this.cy.remove(node);
    }
  }

  addClassToNode(nodeId, className) {
    this.cy.getElementById(nodeId).addClass(className);
  }

  removeClassFromAllNodes(className) {
    this.cy.nodes().removeClass(className);
  }

  resize() {
    this.cy.resize();
  }

  rerunLayout() {
    this.cy.layout({ name: "cose", animate: true, padding: 50 }).run();
  }

  onNodeClick(callback) {
    this.cy.on("tap", "node", (event) => {
      callback(event.target);
    });
  }

  onNodeDoubleClick(callback) {
    this.cy.on("dbltap", "node", (event) => {
      callback(event.target);
    });
  }

  onCanvasClick(callback) {
    this.cy.on("tap", (event) => {
      if (event.target === this.cy) {
        callback();
      }
    });
  }
}

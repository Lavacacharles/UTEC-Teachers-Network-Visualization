// 1. Setup Canvas and SVGs
const container = document.getElementById('viz-container');
const width = container.clientWidth;
const height = container.clientHeight;

const svg = d3.select("#viz-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

// Add a <g> element for zooming/panning
const g = svg.append("g");

// Zoom behavior
const zoom = d3.zoom()
    .scaleExtent([0.1, 1])
    .on("zoom", (event) => {
        g.attr("transform", event.transform);
    });
svg.call(zoom);

const tooltip = d3.select("#tooltip");

// 2. Define Minimalist Color Palette for Categories
const colorScale = d3.scaleOrdinal()
    .domain(["UTEC Faculty", "External Researcher", "External Organization", "Internal Organization"])
    .range(["#0284c7", "#f59e0b", "#64748b", "#10b981"]);

    // --- LEGEND TOGGLE LOGIC ---
const legendHeader = document.getElementById('legend-header');
const legendContent = document.getElementById('legend-content');
const toggleBtn = document.getElementById('toggle-legend-btn');

document.addEventListener("DOMContentLoaded", () => {
    const legendHeader = document.getElementById('legend-header');
    const legendContent = document.getElementById('legend-content');
    const toggleBtn = document.getElementById('toggle-legend-btn');

    legendHeader.addEventListener('click', () => {
        legendContent.classList.toggle('collapsed');
        toggleBtn.classList.toggle('collapsed');
    });
});

// 3. Load Data
d3.json("data/transformed/utec_d3_network.json").then(data => {
      
    console.log(data.nodes.length, data.links.length);
    // Scale for node size based on h-index (Task 2)
    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(data.nodes, d => d.h_index || 1)])
        .range([5, 20]); // Minimal size 5, max 20

    // Scale for link thickness (Task 2)
    const linkWidthScale = d3.scaleLinear()
        .domain([1, d3.max(data.links, d => d.weight || 1)])
        .range([1, 6]);

    // 4. Setup Force Simulation (Task 1)
    const simulation = d3.forceSimulation(data.nodes)
        .force("link", d3.forceLink(data.links).id(d => d.id).distance(80))
        .force("charge", d3.forceManyBody().strength(-100))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => radiusScale(d.h_index || 1) + 2));

    // 5. Draw Links
    const link = g.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(data.links)
        .enter().append("line")
        .attr("class", "link")
        .attr("stroke-width", d => linkWidthScale(d.weight));

    // 6. Draw Nodes
    const node = g.append("g")
        .attr("class", "nodes")
        .selectAll("circle")
        .data(data.nodes)
        .enter().append("circle")
        .attr("class", "node")
        .attr("r", d => radiusScale(d.h_index || 1))
        .attr("fill", d => colorScale(d.type))
        .call(drag(simulation));
    renderLegend(colorScale, "Entity Types");  
    // 7. Interaction: Mouseover (Tooltip)
    let lastMove = 0;
    node
        .on("mouseenter", (event, d) => {
            tooltip
                .style("opacity", 1)
                .html(`<strong>${d.id}</strong><br>${d.type}`);
        })
        .on("mousemove", (event) => {
            tooltip
                .style("left", `${event.pageX}px`)
                .style("top", `${event.pageY}px`);
        })
        .on("mouseleave", () => {
            tooltip.style("opacity", 0);
        });

    // 8. Interaction: Click & Isolate Ego-Network (Task 4)
    node.on("click", (event, d) => {
        if (d.dragMoved) return;
        // Highlight connected nodes and dim others
        const connectedIds = new Set();
        connectedIds.add(d.id);
        
        data.links.forEach(l => {
            if (l.source.id === d.id) connectedIds.add(l.target.id);
            if (l.target.id === d.id) connectedIds.add(l.source.id);
        });

        node.style("opacity", n => connectedIds.has(n.id) ? 1 : 0.1);
        link.style("opacity", l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.05)
            .style("stroke", l => (l.source.id === d.id || l.target.id === d.id) ? "#475569" : "#cbd5e1");

        // Update Side Panel
        updateSidePanel(d);
        event.stopPropagation(); // Prevent SVG click from firing
    });

    // Reset view on background click
    svg.on("click", resetView);
    document.getElementById("reset-btn").addEventListener("click", resetView);

    function resetView() {
        node.style("opacity", 1);
        link.style("opacity", 1).style("stroke", "#cbd5e1");
        clearSidePanel();
    }

    // 9. Filtering Logic (Task 3)
    document.getElementById("filter-type").addEventListener("change", function(e) {
        const selectedType = e.target.value;
        if (selectedType === "all") {
            resetView();
        } else {
            node.style("opacity", d => d.type === selectedType ? 1 : 0.1);
            link.style("opacity", 0.1); // Dim all links during filtering to focus on nodes
            clearSidePanel();
        }
    });

    // 10. Simulation Tick Update
    simulation.on("tick", () => {
        link
            .attr("x1", d => d.source.x)
            .attr("y1", d => d.source.y)
            .attr("x2", d => d.target.x)
            .attr("y2", d => d.target.y);

        node
            .attr("cx", d => d.x)
            .attr("cy", d => d.y);
    });
    simulation.on("end", () => {
        simulation.stop();
    });

    simulation.alpha(1).restart();
    // Drag implementation
    function drag(simulation) {
        function dragstarted(event, d) {
            d.dragMoved = false;
            if (!event.active) simulation.alphaTarget(0.3).restart();
            d.fx = d.x;
            d.fy = d.y;
        }
        function dragged(event, d) {
            d.dragMoved = true;
            d.fx = event.x;
            d.fy = event.y;
        }
        function dragended(event, d) {
            if (!event.active) simulation.alphaTarget(0);
            d.fx = null;
            d.fy = null;
        }
        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    }
    function highlightBridges() {
        // Find top 5 nodes with the highest betweenness centrality
        clearSidePanel();
        d3.select("#info-panel").select(".placeholder-text")
            .text("Calculating pathways across thousands of nodes.")
            .style("display", "block");
        setTimeout(() => {
            const topBridges = [...data.nodes]
                .sort((a, b) => (b.betweenness_centrality || 0) - (a.betweenness_centrality || 0))
                .slice(0, 5)
                .map(d => d.id);

            const bridgeSet = new Set(topBridges);

            // Heavy DOM manipulation
            node.style("opacity", d => bridgeSet.has(d.id) ? 1 : 0.1)
                .style("stroke", d => bridgeSet.has(d.id) ? "#f59e0b" : "#fff")
                .style("stroke-width", d => bridgeSet.has(d.id) ? "3px" : "1.5px");

            link.style("opacity", 0.05);

            // 3. Update the side panel with the absolute top bridge
            const topNodeData = data.nodes.find(d => d.id === topBridges[0]);
            if(topNodeData) updateSidePanel(topNodeData);
            
        }, 100);
    }

    // TASK 2: Highlight Top Impact (Highest h-index)
    // Does high impact correlate with central network position?
    function highlightTopImpact() {
        clearSidePanel();
        d3.select("#info-panel").select(".placeholder-text")
            .text("⚙️ Scanning for highest impact faculty... please wait.")
            .style("display", "block");

        setTimeout(() => {
            const topImpact = [...data.nodes]
                .filter(d => d.type === "UTEC Faculty")
                .sort((a, b) => (b.h_index || 0) - (a.h_index || 0))
                .slice(0, 5)
                .map(d => d.id);

            const impactSet = new Set(topImpact);

            node.style("opacity", d => impactSet.has(d.id) ? 1 : 0.1)
                .style("stroke", d => impactSet.has(d.id) ? "#0284c7" : "#fff")
                .style("stroke-width", d => impactSet.has(d.id) ? "3px" : "1.5px");
                
            link.style("opacity", 0.05);

            const topNodeData = data.nodes.find(d => d.id === topImpact[0]);
            if(topNodeData) updateSidePanel(topNodeData);
            
        }, 100);
    }
// TASK 3: Map Thematic Clusters
    // How do distinct research areas/departments drive groups?
    function mapThematicClusters() {
        clearSidePanel();
        d3.select("#info-panel").select(".placeholder-text")
            .text("⚙️ Color-coding network by academic department... please wait.")
            .style("display", "block");

        setTimeout(() => {
            // Create a dynamic color scale based on Departments
            // We only look at UTEC Faculty because external nodes don't have a 'dept'
            const departments = Array.from(new Set(data.nodes
                .filter(d => d.type === "UTEC Faculty" && d.dept)
                .map(d => d.dept)));
            
            // D3 built-in categorical color scale
            const clusterColorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(departments);
            renderLegend(clusterColorScale, "Departments");
            node.style("opacity", 1)
                .style("stroke", "#fff")
                .style("stroke-width", "1px")
                .attr("fill", d => {
                    if (d.type === "UTEC Faculty" && d.dept) {
                        return clusterColorScale(d.dept);
                    }
                    return "#e2e8f0"; // Gray out non-faculty nodes to make the clusters pop
                });

            link.style("opacity", 0.1).style("stroke", "#cbd5e1");

            // Update UI to explain what we are looking at
            const panel = d3.select("#info-panel");
            panel.classed("empty", false);
            panel.select(".placeholder-text").style("display", "none");
            d3.select("#detail-name").text("Thematic Clusters Active");
            d3.select("#detail-type").text("Network view by Department");
            d3.select("#detail-bio").text("UTEC Faculty nodes are now color-coded by their department. Gray nodes represent external collaborators and organizations. Notice how certain colors (departments) naturally group together due to shared collaborations.");
            panel.selectAll("h2, span, p:not(.placeholder-text)").style("display", "block");
            
        }, 50);
    }
    

    // TASK 4: Spotlight Top Ego-Network
    // What is the specific collaboration history of a highly connected member?
    function spotlightEgoNetwork() {
        clearSidePanel();
        d3.select("#info-panel").select(".placeholder-text")
            .text("⚙️ Isolating the largest faculty ego-network... please wait.")
            .style("display", "block");

        setTimeout(() => {
            // Find the UTEC Faculty member with the highest degree_centrality (most direct connections)
            const topConnector = [...data.nodes]
                .filter(d => d.type === "UTEC Faculty")
                .sort((a, b) => (b.degree_centrality || 0) - (a.degree_centrality || 0))[0];

            if (!topConnector) return;

            // Find all nodes connected to this person
            const connectedIds = new Set();
            connectedIds.add(topConnector.id);
            
            data.links.forEach(l => {
                if (l.source.id === topConnector.id) connectedIds.add(l.target.id);
                if (l.target.id === topConnector.id) connectedIds.add(l.source.id);
            });

            // Dim everything not in this ego-network
            node.style("opacity", n => connectedIds.has(n.id) ? 1 : 0.05)
                .attr("fill", d => colorScale(d.type)); // Ensure original colors are back if Task 3 was active
                
            // Highlight only the links connected to our top connector
            link.style("opacity", l => (l.source.id === topConnector.id || l.target.id === topConnector.id) ? 1 : 0.02)
                .style("stroke", l => (l.source.id === topConnector.id || l.target.id === topConnector.id) ? "#475569" : "#cbd5e1")
                .style("stroke-width", l => linkWidthScale(l.weight)); // Emphasize weight

            // Update the Side Panel with their details
            updateSidePanel(topConnector);
            
        }, 50);
    }

    // --- EVENT LISTENERS FOR NEW BUTTONS ---
    document.getElementById("btn-task1").addEventListener("click", () => {
        resetView(); // Clean state first
        highlightBridges();
    });

    document.getElementById("btn-task2").addEventListener("click", () => {
        resetView();
        highlightTopImpact();
    });
    // --- EVENT LISTENERS FOR TASK 3 AND 4 ---
    document.getElementById("btn-task3").addEventListener("click", () => {
        // We do NOT call resetView() here because we are dynamically changing the 'fill' attribute, 
        // which resetView() doesn't touch. We handle the reset inside the function.
        mapThematicClusters();
    });

    document.getElementById("btn-task4").addEventListener("click", () => {
        resetView(); // Clean state first
        spotlightEgoNetwork();
    });

    // Make sure to update your existing resetView() function to remove the thick strokes
    function resetView() {
            node.style("opacity", 1)
                .style("stroke", "#fff")
                .style("stroke-width", "1.5px")
                .attr("fill", d => colorScale(d.type)); // Restores original colors (Task 3 fix)
                
            link.style("opacity", 1).style("stroke", "#cbd5e1");
            clearSidePanel();
            renderLegend(colorScale, "Entity Types");
        }
});

// UI Helper Functions
function updateSidePanel(d) {

    const panel = d3.select("#info-panel");
        panel.classed("empty", false);
        panel.select(".placeholder-text").style("display", "none"); // Hide loading text

        const photo = d3.select("#detail-photo");
        if (d.photo_url) {
            photo.attr("src", d.photo_url).style("display", "block");
        } else {
            photo.style("display", "none");
        }

        d3.select("#detail-name").text(d.id);
        d3.select("#detail-type").text(d.type);
        
        // Handle null/missing metrics gracefully
        console.log(d.h_index)
        console.log(d.citations)
        d3.select("#detail-hindex").text(
            d.h_index ? `H-Index: ${d.h_index}` : "H-Index: N/A"
        );
        d3.select("#detail-citations").text(
            d.citations ? `Citations: ${d.citations}` : "Citations: N/A"
        );
        
        // Handle missing bios (which is normal for external orgs)
        d3.select("#detail-bio").text(d.bio ? d.bio : "No biography available for this external entity or organization.");
        
        // Ensure all these elements are visible
        panel.selectAll("h2, span, div, p:not(.placeholder-text)").style("display", "block");
}

function clearSidePanel() {
    const panel = d3.select("#info-panel");
    panel.classed("empty", true);
    panel.selectAll("img, h2, span, div, p:not(.placeholder-text)").text("").style("display", "none");
    panel.select(".placeholder-text").text("Click a node or use Guided Insights to view details.").style("display", "block");
}
function renderLegend(scale, title) {
    d3.select("#legend-title").text(title);
    const content = d3.select("#legend-content");
    content.selectAll("*").remove(); // Clear existing items

    const domain = scale.domain();
    
    // Add dynamically generated colors
    const items = content.selectAll(".legend-item")
        .data(domain)
        .enter()
        .append("div")
        .attr("class", "legend-item");

    items.append("div")
        .attr("class", "legend-color")
        .style("background-color", d => scale(d));

    items.append("span")
        .text(d => d);
        
    // If we are showing Departments (Task 3), explicitly label the grayed-out nodes
    if (title === "Departments") {
        const ext = content.append("div").attr("class", "legend-item");
        ext.append("div")
            .attr("class", "legend-color")
            .style("background-color", "#e2e8f0");
        ext.append("span").text("External / Other");
    }
}   
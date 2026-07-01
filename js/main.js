console.log("VERSION ACTIVA:", Math.random());
window.__VERSION = Math.random();
console.log('WINDOW VERSION')
console.log(window.__VERSION)
const container = document.getElementById('viz-container');
const width = container.clientWidth;
const height = container.clientHeight;

console.log("MAIN JS CARGADO");

const svg = d3.select("#viz-container")
    .append("svg")
    .attr("width", width)
    .attr("height", height);

const g = svg.append("g");

const zoom = d3.zoom()
  .scaleExtent([0.1, 4]) 
  .on("zoom", (event) => {
      g.attr("transform", event.transform);
      d3.select("#tooltip").style("opacity", 0);
  });

svg.call(zoom);


const tooltip = d3.select("#tooltip");

const colorScale = d3.scaleOrdinal()
    .domain(["UTEC Faculty", "External Researcher", "External Organization", "Internal Organization"])
    .range(["#0284c7", "#f59e0b", "#64748b", "#10b981"]);



d3.json("data/transformed/utec_d3_network.json").then(data => { 
    console.log("CARGANDO DATOS");
    console.log(data.nodes.length, data.links.length);
    const radiusScale = d3.scaleSqrt()
        .domain([0, d3.max(data.nodes, d => d.h_index || 1)])
        .range([5, 20]);

    const linkWidthScale = d3.scaleLinear()
        .domain([1, d3.max(data.links, d => d.weight || 1)])
        .range([1, 6]);

    const simulation = d3.forceSimulation(data.nodes)
        .force("link", d3.forceLink(data.links).id(d => d.id).distance(80))
        .force("charge", d3.forceManyBody().strength(-100))
        .force("center", d3.forceCenter(width / 2, height / 2))
        .force("collide", d3.forceCollide().radius(d => radiusScale(d.h_index || 1) + 2));

    const link = g.append("g")
        .attr("class", "links")
        .selectAll("line")
        .data(data.links)
        .enter().append("line")
        .attr("class", "link")
        .attr("stroke-width", d => linkWidthScale(d.weight));

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
    let lastMove = 0;
    node
        .on("mouseenter", (event, d) => {
            let html = `<strong>${d.id}</strong><br>${d.type}`;

            if (d.dept) {
                html += `<br>${d.dept}`;
            }

            tooltip
                .style("opacity", 1)
                .html(html);
            
        })
        .on("mousemove", (event) => {
    console.log("MOVE NODO");
            tooltip
                .style("left", `${event.pageX - 100}px`)
                .style("top", `${event.pageY - 100}px`);
        })
        .on("mouseleave", () => {
    console.log("LEAVE NODO");
            tooltip.style("opacity", 0);
        });
    node.on("click", (event, d) => {
        console.log("CLIKCEA NODO");
        if (d.dragMoved) return;
        const connectedIds = new Set();
        const connectedNodes = [];

        connectedIds.add(d.id);
        
        data.links.forEach(l => {
            if (l.source.id === d.id) {
                connectedIds.add(l.target.id);
                connectedNodes.push(l.target);
            }
            if (l.target.id === d.id) {
                connectedIds.add(l.source.id);
                connectedNodes.push(l.source);
            }
        });

        node.style("opacity", n => connectedIds.has(n.id) ? 1 : 0.1);
        link.style("opacity", l => (l.source.id === d.id || l.target.id === d.id) ? 1 : 0.05)
            .style("stroke", l => (l.source.id === d.id || l.target.id === d.id) ? "#475569" : "#cbd5e1");

        updateSidePanel(d, connectedNodes);
        event.stopPropagation(); 
    });
    node.style("pointer-events", "all");
    link.style("pointer-events", "none");
    svg.on("click", resetView);
    document.getElementById("reset-btn").addEventListener("click", resetView);

    const dataList = d3.select("#node-list");
    dataList.selectAll("option")
        .data(data.nodes)
        .enter()
        .append("option")
        .attr("value", d => d.id);

    const searchInput = document.getElementById("node-search");
    
    searchInput.addEventListener("change", function(e) {
        const searchedId = e.target.value;
        const targetNode = data.nodes.find(n => n.id === searchedId);

        if (targetNode) {
            resetView();
            const connectedIds = new Set();
            connectedIds.add(targetNode.id);
            
            data.links.forEach(l => {
                if (l.source.id === targetNode.id) connectedIds.add(l.target.id);
                if (l.target.id === targetNode.id) connectedIds.add(l.source.id);
            });

            node.style("opacity", n => connectedIds.has(n.id) ? 1 : 0.05)
                .style("stroke-width", n => n.id === targetNode.id ? "5px" : "1.5px")
                .style("stroke", n => n.id === targetNode.id ? "#ef4444" : (connectedIds.has(n.id) ? "#fff" : "none"));

            link.style("opacity", l => (l.source.id === targetNode.id || l.target.id === targetNode.id) ? 1 : 0.02)
                .style("stroke", l => (l.source.id === targetNode.id || l.target.id === targetNode.id) ? "#475569" : "#cbd5e1");

            console.log("targetNode")
            console.log(targetNode)
            updateSidePanel(targetNode);
        } else if (searchedId === "") {
            resetView();
        }
    });
    function resetView() {
        node.style("opacity", 1);
        link.style("opacity", 1).style("stroke", "#cbd5e1");
        clearSidePanel();
    }

    document.getElementById("filter-type").addEventListener("change", function(e) {
        const selectedType = e.target.value;
        if (selectedType === "all") {
            resetView();
        } else {
            node.style("opacity", d => d.type === selectedType ? 1 : 0.1);
            link.style("opacity", 0.1); 
            clearSidePanel();
        }
    });

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
console.count("GRAPH RENDER");
console.count("LEGEND RENDER");
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

            node.style("opacity", d => bridgeSet.has(d.id) ? 1 : 0.1)
                .style("stroke", d => bridgeSet.has(d.id) ? "#f59e0b" : "#fff")
                .style("stroke-width", d => bridgeSet.has(d.id) ? "3px" : "1.5px");

            link.style("opacity", 0.05);

            const topNodeData = data.nodes.find(d => d.id === topBridges[0]);
            if(topNodeData) updateSidePanel(topNodeData);
            
        }, 100);
    }

    function highlightTopImpact() {
        clearSidePanel();
        d3.select("#info-panel").select(".placeholder-text")
            .text("Scanning for highest impact faculty... please wait.")
            .style("display", "block");

        setTimeout(() => {
            const topImpact = [...data.nodes]
                .filter(d => d.type === "UTEC Faculty")
                .sort((a, b) => (b.h_index || 0) - (a.h_index || 0))
                .slice(0, 10)
                .map(d => d.id);

            const impactSet = new Set(topImpact);

            node.style("opacity", d => impactSet.has(d.id) ? 1 : 0.1)
                .style("stroke", d => impactSet.has(d.id) ? "#fbbf24" : "#fff") 
                .style("stroke-width", d => impactSet.has(d.id) ? "6px" : "1px"); 

            link.style("opacity", 0.05);

            const topNodeData = data.nodes.find(d => d.id === topImpact[0]);
            if(topNodeData) updateSidePanel(topNodeData);
            
        }, 100);
    }
    function mapThematicClusters() {
        clearSidePanel();
        d3.select("#info-panel").select(".placeholder-text")
            .text("Color-coding network by academic department... please wait.")
            .style("display", "block");

        setTimeout(() => {
            const departments = Array.from(new Set(data.nodes
                .filter(d => d.type === "UTEC Faculty" && d.dept)
                .map(d => d.dept)));
            
            const clusterColorScale = d3.scaleOrdinal(d3.schemeCategory10).domain(departments);
            renderLegend(clusterColorScale, "Departments");
            node.style("opacity", 1)
                .style("stroke", "#fff")
                .style("stroke-width", "1px")
                .attr("fill", d => {
                    if (d.type === "UTEC Faculty" && d.dept) {
                        return clusterColorScale(d.dept);
                    }
                    return "#e2e8f0";
                });

            link.style("opacity", 0.1).style("stroke", "#cbd5e1");

            const panel = d3.select("#info-panel");
            panel.classed("empty", false);
            panel.select(".placeholder-text").style("display", "none");
            d3.select("#detail-name").text("Thematic Clusters Active");
            d3.select("#detail-type").text("Network view by Department");
            d3.select("#detail-bio").text("UTEC Faculty nodes are now color-coded by their department. Gray nodes represent external collaborators and organizations. Notice how certain colors (departments) naturally group together due to shared collaborations.");
            panel.selectAll("h2, span, p:not(.placeholder-text)").style("display", "block");
            
        }, 50);
    }
    

    function spotlightEgoNetwork() {
        clearSidePanel();
        d3.select("#info-panel").select(".placeholder-text")
            .text("Isolating the largest faculty ego-network... please wait.")
            .style("display", "block");

        setTimeout(() => {
            const topConnector = [...data.nodes]
                .filter(d => d.type === "UTEC Faculty")
                .sort((a, b) => (b.degree_centrality || 0) - (a.degree_centrality || 0))[0];

            if (!topConnector) return;

            const connectedIds = new Set();
            connectedIds.add(topConnector.id);
            
            data.links.forEach(l => {
                if (l.source.id === topConnector.id) connectedIds.add(l.target.id);
                if (l.target.id === topConnector.id) connectedIds.add(l.source.id);
            });
            node.style("opacity", n => connectedIds.has(n.id) ? 1 : 0.05)
                .attr("fill", d => colorScale(d.type)); 

            link.style("opacity", l => (l.source.id === topConnector.id || l.target.id === topConnector.id) ? 1 : 0.02)
                .style("stroke", l => (l.source.id === topConnector.id || l.target.id === topConnector.id) ? "#475569" : "#cbd5e1")
                .style("stroke-width", l => linkWidthScale(l.weight)); 
            updateSidePanel(topConnector);
            
        }, 50);
    }

    document.getElementById("btn-task1").addEventListener("click", () => {
        resetView(); 
        highlightBridges();
    });

    document.getElementById("btn-task2").addEventListener("click", () => {
        resetView();
        highlightTopImpact();
    });
    document.getElementById("btn-task3").addEventListener("click", () => {
        mapThematicClusters();
    });

    document.getElementById("btn-task4").addEventListener("click", () => {
        resetView(); 
        spotlightEgoNetwork();
    });

    function resetView() {
            node.style("opacity", 1)
                .style("stroke", "#fff")
                .style("stroke-width", "1.5px")
                .attr("fill", d => colorScale(d.type)); 
                
            link.style("opacity", 1).style("stroke", "#cbd5e1");
            clearSidePanel();
            renderLegend(colorScale, "Entity Types");
        }
});

function updateSidePanel(d, neighbors = []) {
    console.log("updateSidePanel")
    console.log(d)
    const panel = d3.select("#info-panel");
    panel.classed("empty", false);
    panel.select(".placeholder-text").style("display", "none");

    const photo = d3.select("#detail-photo");
    if (d.photo_url) {
        photo.attr("src", d.photo_url).style("display", "block");
    } else {
        photo.style("display", "none");
    }

    d3.select("#detail-name").text(d.id);
    d3.select("#detail-type").text(d.type);
    
    d3.select("#detail-hindex").text(
        d.h_index !== null && d.h_index !== undefined ? `H-Index: ${d.h_index}` : "H-Index: N/A"
    );
    d3.select("#detail-citations").text(
        d.citations !== null && d.citations !== undefined ? `Citas: ${d.citations}` : "Citas: N/A"
    );

    const areasContainer = d3.select("#detail-areas");
    areasContainer.selectAll("*").remove();
    console.log("CANTIDAD DE AREAS: ", d)
    if (d.areas && d.areas.length > 0) {
        areasContainer.style("display", "flex");
        d.areas.forEach(area => {
            areasContainer.append("span")
                .attr("class", "tag")
                .text(area);
        });
    } else {
        areasContainer.style("display", "none");
    }

    const bioContainer = d3.select("#bio-container");
    if (d.bio) {
        console.log('has bio');
        d3.select("#detail-bio")
            .style("display", "block")
            .text(d.bio);
        
        bioContainer
            .style("display", "block")
            .attr("open", true); 
        
    } else {
        bioContainer.style("display", "none");
        d3.select("#detail-bio").style("display", "none").text("");
        document.getElementById("bio-container").open = false;
    }
    
    panel.selectAll("h2, span.badge, div.metrics").style("display", "block");
    const neighborsListContainer = d3.select("#neighbors-list");
    neighborsListContainer.selectAll("*").remove();
    if (neighbors.length > 0) {
        d3.select("#neighbors-divider").style("display", "block");
        d3.select("#neighbors-title").style("display", "block");

        neighborsListContainer.style("display", "block");
        const groupedNeighbors = d3.group(neighbors, d => d.type);
        
        groupedNeighbors.forEach((nodes, type) => {
            nodes.sort((a, b) => a.id.localeCompare(b.id));
            const details = neighborsListContainer.append("details")
                .attr("class", "neighbor-group");

            const summary = details.append("summary")
                .attr("class", "neighbor-group-title")
                .style("color", colorScale(type)) 
                .html(`<strong>${type}</strong> <span class="count-badge">${nodes.length}</span>`);

            const ul = details.append("ul").attr("class", "neighbors-sublist");

            nodes.forEach(neighbor => {
                const li = ul.append("li")
                    .attr("class", "neighbor-card")
                    .style("border-left", `4px solid ${colorScale(neighbor.type)}`);

                li.append("div")
                    .attr("class", "neighbor-name")
                    .text(neighbor.id);
            });
        });
    } else {
        d3.select("#neighbors-divider").style("display", "none");
        d3.select("#neighbors-title").style("display", "none");
    }
}
function clearSidePanel() {
    document.getElementById("node-search").value = "";
    const panel = d3.select("#info-panel");
    panel.classed("empty", true);
    panel.selectAll("h2, span.badge, div.metrics, #detail-bio, ul, h3").text("").style("display", "none");
    d3.select("#detail-photo").attr("src", "").style("display", "none");
    const areasContainer = d3.select("#detail-areas");
    areasContainer.selectAll("*").remove();
    areasContainer.style("display", "none");
    const neighborsList = d3.select("#neighbors-list");
    neighborsList.selectAll("*").remove();
    neighborsList.style("display", "none");
    d3.select("#neighbors-divider").style("display", "none");
    d3.select("#neighbors-title").style("display", "none");
    d3.select("#bio-container").style("display", "none").property("open", false);
    panel.select(".placeholder-text").text("Click a node or use Guided Insights to view details.").style("display", "block");
}

function renderLegend(scale, title) {
    d3.select("#legend-title").text(title);
    const content = d3.select("#legend-content");
    
    if (title === "Departments") {
        content.classed("scrollable-legend", true);
    } else {
        content.classed("scrollable-legend", false);
    }

    content.selectAll("*").remove(); 

    const domain = scale.domain();
    
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
        
    if (title === "Departments") {
        const ext = content.append("div").attr("class", "legend-item");
        ext.append("div")
            .attr("class", "legend-color")
            .style("background-color", "#e2e8f0");
        ext.append("span").text("External / Other");
    }
};
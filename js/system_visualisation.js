let allSystems = [];

// Main function
async function buildSystemVisualisation() {
    const rawData = window.globalExoplanetData;
    if (!rawData || rawData.length === 0) return;

    // Data preparation
    const normalizeMethod = (m) => {
        if (!m) return "Other";
        const lower = m.toLowerCase();
        if (lower.includes("transit")) return "Transit";
        if (lower.includes("radial")) return "Radial Velocity"; 
        if (lower.includes("microlensing")) return "Microlensing";
        if (lower.includes("imaging")) return "Imaging";
        return "Other";
    };

    const data = rawData
        .filter(d => d.pl_orbsmax && !isNaN(d.pl_orbsmax) && d.pl_radj && !isNaN(d.pl_radj) && d.sy_pnum && !isNaN(d.sy_pnum))
        .map(d => ({
            method: normalizeMethod(d.discoverymethod),
            distance: +d.pl_orbsmax,
            hostname: d.hostname,
            radius: +d.pl_radj,
            name: d.pl_name,
            planetCount: +d.sy_pnum
        }));

    window.sizeScale = d3.scaleSqrt()
        .domain(d3.extent(data, d => +d.radius))
        .range([3, 14]);

    const groupPerHost = d3.group(data, d => d.hostname);
    allSystems = Array.from(groupPerHost, ([hostname, planets]) => ({
        hostname,
        planetCount: planets[0].planetCount,
        planets
    })).sort((a, b) => {
        const minA = d3.min(a.planets, p => p.distance);
        const minB = d3.min(b.planets, p => p.distance);
        return minA - minB;
    });

    // Initiate filters
    const counts = [...new Set(allSystems.map(s => s.planetCount))]
        .filter(n => n >= 1 && n <= 8)
        .sort((a, b) => a - b);

    const countContainer = d3.select("#sys-count-filters");
    countContainer.selectAll("button")
        .data(counts)
        .join("button")
        .attr("class", "method-btn other")
        .classed("active", d => d >= 4) // Default to 4+ planets
        .attr("data-count", d => d)
        .text(d => d === 1 ? `${d} Planet` : `${d} Planets`)
        .on("click", function(event) {
            event.stopPropagation(); // FIX: Prevent Exolab.js from hijacking!
            const btn = d3.select(this);
            btn.classed("active", !btn.classed("active"));
            renderSystems();
        });

    const methodFilters = document.getElementById("sys-method-filters");
    const methodClone = methodFilters.cloneNode(true);
    methodFilters.parentNode.replaceChild(methodClone, methodFilters);

    d3.selectAll("#sys-method-filters .method-btn").on("click", function(event) {
        event.stopPropagation(); // FIX: Prevent delegated listeners from hijacking
        event.preventDefault();
        const btn = d3.select(this);
        btn.classed("active", !btn.classed("active"));
        renderSystems();
    });

    // First render
    renderSystems();
    drawSolarSystemBaseline();
    drawSizeReference();
    
    window.addEventListener("resize", () => {
        renderSystems();
        drawSolarSystemBaseline();
        drawSizeReference();
    });
}

function drawSizeReference() {
    const container = document.getElementById("size-reference-container");
    const width = container.clientWidth;

    d3.select("#size-reference-container").selectAll("svg").remove();

    const svg = d3.select("#size-reference-container")
        .append("svg")
        .attr("width", "100%")
        .attr("height", 60);

    const refRadii = [0.1, 0.5, 0.75, 1, 1.25, 1.5, 3, 5, 7];

    const g = svg.append("g").attr("transform", `translate(0, 30)`);

    // Calculate total width of all circles + spacing to center them
    let totalWidth = 0;
    refRadii.forEach(r => { totalWidth += sizeScale(r) * 2 + 20; });
    const labelWidth = 130;
    const startX = (width - totalWidth - labelWidth) / 2;

    g.append("text")
        .attr("x", startX)
        .attr("y", 4)
        .style("font-family", "var(--font-body)")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "var(--text-muted)")
        .text("References sizes (Rⱼ):");

    let xCursor = startX + labelWidth;
    refRadii.forEach(r => {
        const circleR = sizeScale(r);
        g.append("circle")
            .attr("cx", xCursor + circleR)
            .attr("cy", 0)
            .attr("r", circleR)
            .style("fill", "var(--accent-glow)")
            .style("opacity", 0.6);

        g.append("text")
            .attr("x", xCursor + circleR)
            .attr("y", circleR + 12)
            .attr("text-anchor", "middle")
            .style("font-family", "var(--font-body)")
            .style("font-size", "10px")
            .style("fill", "var(--text-muted)")
            .text(r);

        xCursor += circleR * 2 + 20;
    });
}

function renderSystems() {
    const activeMethods = [];
    d3.selectAll("#sys-method-filters .method-btn.active").each(function() {
        activeMethods.push(d3.select(this).attr("data-method"));
    });

    const activePlanetCounts = [];
    d3.selectAll("#sys-count-filters .method-btn.active").each(function() {
        activePlanetCounts.push(+d3.select(this).attr("data-count"));
    });

    // Filter systems based on active toggle buttons
    const filteredSystems = allSystems
        .filter(s => activePlanetCounts.includes(s.planetCount))
        .filter(s => s.planets.some(p => activeMethods.includes(p.method)));
        
    const planets = filteredSystems.flatMap(s => s.planets);

    drawVisualisation(filteredSystems, planets);
}

// Visualisation of planetary systems (exoplanets)
function drawVisualisation(systems, planets) {
    const systemsSvg = d3.select("#systems-svg");
    const axisSvg = d3.select("#x-axis-svg");
    
    systemsSvg.selectAll("*").remove();
    axisSvg.selectAll("*").remove();

    if (systems.length === 0) {
        systemsSvg.append("text")
            .attr("x", 20).attr("y", 30)
            .style("font-family", "var(--font-body)")
            .style("font-size", "14px")
            .style("fill", "var(--text-muted)")
            .text("No star systems match the current filters.");
        return;
    }

    const container = document.getElementById("system-visualisation-container");
    const width = container.clientWidth;
    const margin = { top: 45, right: 40, bottom: 0, left: 20 }; 
    const innerWidth = width - margin.left - margin.right;
    const rowHeight = 50; 
    const innerHeight = systems.length * rowHeight;

    systemsSvg.attr("width", "100%").attr("height", innerHeight + margin.top);
    axisSvg.attr("width", "100%");

    const svg = systemsSvg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    const axisGroup = axisSvg.append("g")
        .attr("transform", `translate(${margin.left}, 0)`);

    const allDistances = planets.map(d => d.distance);
    if(allDistances.length === 0) return;

    // Log scale for x-axis
    const xScale = d3.scaleLog()
        .domain([d3.min(allDistances), d3.max(allDistances)])
        .nice()
        .range([35, innerWidth]); 

    const yScale = d3.scaleBand()
        .domain(systems.map(d => d.hostname))
        .range([0, innerHeight])
        .padding(0.3);

    const colorScale = (method) => {
        if (method === "Transit") return "var(--color-transit)";
        if (method === "Radial Velocity") return "var(--color-radial)";
        if (method === "Microlensing") return "var(--color-microlensing)";
        if (method === "Imaging") return "var(--color-imaging)";
        return "var(--color-other)";
    };

    const tooltip = d3.select("body")
        .selectAll(".d3-tooltip-system")
        .data([null])
        .join("div")
        .attr("class", "exo-tooltip d3-tooltip-system")
        .style("opacity", 0);

    const formatValue = x => {
        if (x == null || !Number.isFinite(x)) return "Unknown";
        if (x >= 1000) return d3.format(",.0f")(x);
        if (x >= 10) return d3.format(",.1f")(x);
        return d3.format(".2f")(x);
    };

    // Host star header
    svg.append("text")
        .attr("x", 0)
        .attr("y", -20)
        .style("font-family", "var(--font-body)")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "var(--text-muted)")
        .text("↓ Host star (not to scale)");

    // Orbit line
    svg.selectAll(".system-line")
        .data(systems)
        .join("line")
        .attr("class", "system-line")
        .attr("x1", 0) 
        .attr("x2", innerWidth)
        .attr("y1", d => yScale(d.hostname) + yScale.bandwidth() / 2)
        .attr("y2", d => yScale(d.hostname) + yScale.bandwidth() / 2)
        .attr("stroke", "var(--border-light)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,4");

    // Host star
    svg.selectAll(".host-star")
        .data(systems)
        .join("circle")
        .attr("class", "host-star")
        .attr("cx", 0)
        .attr("cy", d => yScale(d.hostname) + yScale.bandwidth() / 2)
        .attr("r", 5)
        .style("fill", "#fcd34d")
        .style("stroke", "#fbbf24")
        .style("stroke-width", 1.5)
        .style("filter", "drop-shadow(0 0 4px rgba(252, 211, 77, 0.6))");

    // System name
    svg.selectAll(".system-name")
        .data(systems)
        .join("text")
        .attr("class", "system-name")
        .attr("x", 0)
        .attr("y", d => yScale(d.hostname) + yScale.bandwidth() / 2 - 10)
        .style("font-family", "var(--font-heading)")
        .style("font-size", "12px")
        .style("font-weight", "700")
        .style("fill", "var(--text-dark)")
        .text(d => d.hostname);

    // Planets
    svg.selectAll(".planet")
        .data(planets)
        .join("circle")
        .attr("class", "planet")
        .attr("cx", d => xScale(d.distance))
        .attr("cy", d => yScale(d.hostname) + yScale.bandwidth() / 2)
        .attr("r", d => sizeScale(d.radius))
        .style("fill", d => colorScale(d.method))
        .style("opacity", 0.85)
        .style("stroke", "var(--bg-card)")
        .style("stroke-width", 1)
        .on("mouseenter", function(event, d) {
            tooltip
                .style("opacity", 1)
                .html(`
                    <div class="tt-header">${d.name}</div>
                    <table style="width: 100%; font-size: 0.8rem; margin-top: 8px; border-collapse: collapse;">
                        <tr>
                            <td style="padding-bottom: 4px; padding-right: 16px; color: var(--text-light);">Method:</td>
                            <td style="text-align: right; font-weight: bold; padding-bottom: 4px; color: ${colorScale(d.method)};">${d.method}</td>
                        </tr>
                        <tr>
                            <td style="padding-bottom: 4px; padding-right: 16px; color: var(--text-light);">Distance to host:</td>
                            <td style="text-align: right; font-weight: bold; font-variant-numeric: tabular-nums; padding-bottom: 4px;">${formatValue(d.distance)} AU</td>
                        </tr>
                        <tr>
                            <td style="padding-bottom: 4px; padding-right: 16px; color: var(--text-light);">Radius:</td>
                            <td style="text-align: right; font-weight: bold; font-variant-numeric: tabular-nums; padding-bottom: 4px;">${formatValue(d.radius)} R<sub>J</sub></td>
                        </tr>
                    </table>
                `)
                .style("left", `${event.pageX + 14}px`)
                .style("top", `${event.pageY + 14}px`);
        })
        .on("mousemove", function(event) {
            tooltip
                .style("left", `${event.pageX + 14}px`)
                .style("top", `${event.pageY + 14}px`);
        })
        .on("mouseleave", function() {
            tooltip.style("opacity", 0);
        });

    // Clean x-axis
    const logFormat = d => d >= 1000 ? window.formatExoNumber(d, 0) : d;
    const xTicks = [0.001, 0.01, 0.1, 1, 10, 100, 1000, 10000, 100000];
    
    const xAxis = d3.axisBottom(xScale)
        .tickValues(xTicks)
        .tickFormat(logFormat)
        .tickSizeOuter(0);
        
    const gx = axisGroup.append("g").call(xAxis);
    gx.select(".domain").attr("stroke", "var(--border-light)");
    gx.selectAll(".tick line").attr("stroke", "var(--border-light)");
    gx.selectAll(".tick text")
        .style("font-family", "var(--font-body)")
        .style("font-size", "11px")
        .style("fill", "var(--text-muted)")
        .attr("dy", "10");

    axisSvg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", margin.left + innerWidth / 2)
        .attr("y", 45)
        .style("font-family", "var(--font-heading)")
        .style("font-size", "12px")
        .style("font-weight", "700")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "1px")
        .style("fill", "var(--text-muted)")
        .text("Orbital distance (AU)");
}

// Our own solar system
function drawSolarSystemBaseline() {
    const svg = d3.select("#baseline-svg");
    svg.selectAll("*").remove(); // Clear on resize

    const container = document.getElementById("solar-system-baseline");
    const width = container.clientWidth;
    const margin = { top: 30, right: 40, bottom: 30, left: 20 };
    const innerWidth = width - margin.left - margin.right;
    const height = 120;

    const chart = svg.append("g").attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Match scale of interactive chart
    const xScale = d3.scaleLog()
        .domain([0.1, 40])
        .range([35, innerWidth]);

    const sizeScale = d3.scaleSqrt()
        .domain([0, 1.5])
        .range([3, 16]);

    // Sun label
    chart.append("text")
        .attr("x", 0).attr("y", -20)
        .style("font-family", "var(--font-body)")
        .style("font-size", "11px")
        .style("font-weight", "600")
        .style("fill", "var(--text-muted)")
        .text("↓ The Sun (not to scale)");

    // Orbit line
    chart.append("line")
        .attr("x1", 0).attr("x2", innerWidth)
        .attr("y1", height / 3).attr("y2", height / 3)
        .attr("stroke", "var(--border-light)")
        .attr("stroke-width", 1)
        .attr("stroke-dasharray", "2,4");

    // Sun
    chart.append("circle")
        .attr("cx", 0).attr("cy", height / 3)
        .attr("r", 6)
        .style("fill", "#fcd34d")
        .style("stroke", "#fbbf24")
        .style("stroke-width", 1.5)
        .style("filter", "drop-shadow(0 0 5px rgba(252, 211, 77, 0.8))");

    // Planets
    chart.selectAll(".sol-planet")
        .data(solarSystem)
        .join("circle")
        .attr("cx", d => xScale(d.distance))
        .attr("cy", height / 3)
        .attr("r", d => sizeScale(d.radius))
        .style("fill", d => d.color)

    // Planet labels
    chart.selectAll(".sol-label")
        .data(solarSystem)
        .join("text")
        .attr("x", d => xScale(d.distance))
        .attr("y", d => (height / 3) + d.labelOffset)
        .attr("text-anchor", "middle")
        .style("dominant-baseline", "middle")
        .style("font-family", "var(--font-body)")
        .style("font-size", "10px")
        .style("font-weight", "600")
        .style("fill", "var(--text-dark)")
        .text(d => d.name);

    // Clean x-axis
    const logFormat = d => Number(d).toLocaleString("en-GB", { maximumFractionDigits: 4 });
    const xTicks = [0.1, 1, 10];
    
    const xAxis = d3.axisBottom(xScale)
        .tickValues(xTicks)
        .tickFormat(logFormat)
        .tickSizeOuter(0);
        
    const gx = chart.append("g")
        .attr("transform", `translate(0, ${height - 40})`)
        .call(xAxis);
        
    gx.select(".domain").attr("stroke", "var(--border-light)");
    gx.selectAll(".tick line").attr("stroke", "var(--border-light)");
    gx.selectAll(".tick text")
        .style("font-family", "var(--font-body)")
        .style("font-size", "10px")
        .style("fill", "var(--text-muted)");
}

// Lazy loading
function initSystemsWhenVisible() {
    const container = document.getElementById("solar-system-baseline");
    if (!container) return;

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                buildSystemVisualisation();
                obs.unobserve(entry.target);
            }
        });
    }, { rootMargin: "300px 0px" });

    observer.observe(container);
}

if (window.globalExoplanetData && window.globalExoplanetData.length > 0) {
    initSystemsWhenVisible();
} else {
    document.addEventListener('dataLoaded', initSystemsWhenVisible);
}
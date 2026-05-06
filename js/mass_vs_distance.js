
async function buildScatterPlot() {
    const rawData = window.globalExoplanetData;
    if (!rawData || rawData.length === 0) return;

    // Data preparation
    const normalizeMethod = (m) => {
        if (!m) return "Other";
        const lower = m.toLowerCase();
        if (lower.includes("transit")) return "Transit";
        if (lower.includes("radial")) return "Radial velocity";
        if (lower.includes("microlensing")) return "Microlensing";
        if (lower.includes("imaging")) return "Imaging";
        return "Other";
    };

    // Layer-order for best visibility
    const methodZIndex = {
        "Transit": 1,
        "Radial velocity": 2,
        "Microlensing": 3,
        "Imaging": 4,
        "Other": 5
    };

    const data = rawData
        .filter(d => d.pl_bmasse && d.pl_orbsmax && !isNaN(d.pl_bmasse) && !isNaN(d.pl_orbsmax) && +d.pl_bmasse > 0 && +d.pl_orbsmax > 0)
        .map(d => ({
            method: normalizeMethod(d.discoverymethod),
            mass: +d.pl_bmasse,
            distance: +d.pl_orbsmax,
            name: d.pl_name
        }))
        .sort((a, b) => methodZIndex[a.method] - methodZIndex[b.method]);

    // Dimensions and lay-out
    const container = document.getElementById("scatter-plot-container");
    container.innerHTML = ""; // Clear for resize
    
    const fullWidth = 1050;
    const fullHeight = 450;
    const margin = { top: 20, right: 40, bottom: 60, left: 60 };
    const width = fullWidth - margin.left - margin.right;
    const height = fullHeight - margin.top - margin.bottom;

    const svg = d3.select("#scatter-plot-container")
        .append("svg")
        .attr("viewBox", `0 0 ${fullWidth} ${fullHeight}`)
        .style("width", "100%")
        .style("height", "auto")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    let tooltip = d3.select("body").select(".exo-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div").attr("class", "exo-tooltip").style("pointer-events", "none");
    }

    // Scales
    const minDistance = d3.min(data, d => d.distance);
    const maxDistance = d3.max(data, d => d.distance);
    const minMass = d3.min(data, d => d.mass);
    const maxMass = d3.max(data, d => d.mass);

    const x = d3.scaleLog()
        .domain([minDistance, maxDistance])
        .nice()
        .range([0, width]);

    const y = d3.scaleLog()
        .domain([minMass, maxMass])
        .nice()
        .range([height, 0]);

    const colorScale = (method) => {
        if (method === "Transit") return "var(--color-transit)";
        if (method === "Radial velocity") return "var(--color-radial)";
        if (method === "Microlensing") return "var(--color-microlensing)";
        if (method === "Imaging") return "var(--color-imaging)";
        return "var(--color-other)";
    };

    const getPowersOf10 = (min, max) => {
        const start = Math.floor(Math.log10(min));
        const end = Math.ceil(Math.log10(max));
        return d3.range(start, end + 1).map(p => Math.pow(10, p));
    };

    const xTicks = getPowersOf10(minDistance, maxDistance);
    const yTicks = getPowersOf10(minMass, maxMass);

    // Grid
    svg.append("g")
        .attr("class", "grid")
        .attr("opacity", 0.08)
        .call(d3.axisLeft(y).tickValues(yTicks).tickSize(-width).tickFormat(""));
    
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .attr("opacity", 0.08)
        .call(d3.axisBottom(x).tickValues(xTicks).tickSize(-height).tickFormat(""));

    // Data points
    const dots = svg.append('g')
        .selectAll(".data-dot")
        .data(data)
        .join("circle")
        .attr("class", "data-dot")
        .attr("cx", d => x(d.distance))
        .attr("cy", d => y(d.mass))
        .attr("r", 3.5)
        .style("fill", d => colorScale(d.method))
        .style("opacity", 0.6)
        .style("stroke", "none");

    // Interactive hover
    const highlightMethod = (targetMethod) => {
        dots.style("opacity", d => d.method === targetMethod ? 0.8 : 0.05)
            .filter(d => d.method === targetMethod)
            .raise();
            
        d3.selectAll(".scatter-action").style("opacity", function() {
            return d3.select(this).attr("data-method") === targetMethod ? 1 : 0.4;
        });
        
        svg.selectAll(".legend-row").style("opacity", d => d === targetMethod ? 1 : 0.4);
    };

    const resetHighlights = () => {
        // Reset opacities
        dots.style("opacity", 0.6);
        d3.selectAll(".scatter-action").style("opacity", 1);
        svg.selectAll(".legend-row").style("opacity", 1);
        
        // Restore correct z-index
        dots.sort((a, b) => methodZIndex[a.method] - methodZIndex[b.method]);
    };

    // Explorable text interactions
    d3.selectAll(".scatter-action")
        .on("mouseenter", function() { highlightMethod(d3.select(this).attr("data-method")); })
        .on("mouseleave", resetHighlights);

    dots.on("mouseover", function(event, d) {
        d3.select(this).attr("r", 5);
        tooltip.style("transition", "none").style("opacity", 1).html(`
            <div class="tt-header">${d.name}</div>
            <table style="width: 100%; min-width: 160px; font-size: 0.8rem; margin-top: 8px; border-collapse: collapse;">
                <tr>
                    <td style="padding-bottom: 4px; padding-right: 16px; color: var(--text-light);">Method:</td>
                    <td style="text-align: right; font-weight: bold; padding-bottom: 4px; color: ${colorScale(d.method)};">${d.method}</td>
                </tr>
                <tr>
                    <td style="padding-bottom: 4px; padding-right: 16px; color: var(--text-light);">Mass:</td>
                    <td style="text-align: right; font-weight: bold; font-variant-numeric: tabular-nums; padding-bottom: 4px;">${window.formatExoNumber(d.mass, 2)} M<sub>⊕</sub></td>
                </tr>
                <tr>
                    <td style="padding-right: 16px; color: var(--text-light);">Distance:</td>
                    <td style="text-align: right; font-weight: bold; font-variant-numeric: tabular-nums;">${window.formatExoNumber(d.distance, 4)} AU</td>
                </tr>
            </table>
        `);
    })
    .on("mousemove", event => tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 20) + "px"))
    .on("mouseout", function() {
        d3.select(this).attr("r", 3.5);
        tooltip.style("opacity", 0);
    });

    // Clean axes
    const logFormat = d => Number(d).toLocaleString("en-GB", { maximumFractionDigits: 4 });

    const gx = svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).tickValues(xTicks).tickFormat(logFormat).tickSizeOuter(0));
        
    gx.select(".domain").attr("stroke", "var(--border-light)");
    gx.selectAll(".tick line").attr("stroke", "var(--border-light)");
    gx.selectAll("text").style("font-family", "var(--font-body)").style("font-variant-numeric", "tabular-nums").style("fill", "var(--text-muted)");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + 45)
        .style("font-family", "var(--font-heading)")
        .style("font-size", "12px")
        .style("font-weight", "700")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "1px")
        .style("fill", "var(--text-muted)")
        .text("Orbital Distance (AU)");

    const gy = svg.append("g")
        .call(d3.axisLeft(y).tickValues(yTicks).tickFormat(logFormat).tickSizeOuter(0));
        
    gy.select(".domain").attr("stroke", "var(--border-light)");
    gy.selectAll(".tick line").attr("stroke", "var(--border-light)");
    gy.selectAll("text").style("font-family", "var(--font-body)").style("font-variant-numeric", "tabular-nums").style("fill", "var(--text-muted)");

    const yLabel = svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -45)
        .attr("x", -height / 2)
        .style("font-family", "var(--font-heading)")
        .style("font-size", "12px")
        .style("font-weight", "700")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "1px")
        .style("fill", "var(--text-muted)");
        
    yLabel.text("Earth masses");

    // Reference planets
    const referencePlanets = [
        { name: "Earth", mass: 1, distance: 1, dx: 15, dy: 15, align: "start" },
        { name: "Jupiter", mass: 317.828, distance: 5.2, dx: 15, dy: 15, align: "start" }
    ];

    const refGroup = svg.append("g").attr("class", "reference-planets");

    refGroup.selectAll("circle")
        .data(referencePlanets)
        .join("circle")
        .attr("cx", d => x(d.distance))
        .attr("cy", d => y(d.mass))
        .attr("r", 5)
        .style("fill", "none")
        .style("stroke", "var(--text-dark)")
        .style("stroke-width", 2);

    refGroup.selectAll("text")
        .data(referencePlanets)
        .join("text")
        .attr("x", d => x(d.distance) + d.dx)
        .attr("y", d => y(d.mass) + d.dy)
        .attr("text-anchor", d => d.align)
        .style("font-family", "var(--font-body)")
        .style("font-size", "12px")
        .style("font-weight", "700")
        .style("fill", "var(--text-dark)")
        .text(d => d.name);

    // Interactive legend
    const legendMethods = ["Transit", "Radial velocity", "Microlensing", "Imaging", "Other"];
    
    const legendWidth = 140;
    const legendHeight = (legendMethods.length * 28) + 20;
    const legend = svg.append("g")
        .attr("transform", `translate(${width - legendWidth - 10}, ${height - legendHeight - 10})`);

    legend.append("rect")
        .attr("x", 0).attr("y", 0)
        .attr("width", legendWidth).attr("height", legendHeight)
        .attr("fill", "rgba(255,255,255,0.8)")
        .attr("stroke", "var(--border-light)")
        .attr("rx", 8)
        .style("backdrop-filter", "blur(4px)")
        .style("box-shadow", "var(--shadow-card)");

    const legendRows = legend.selectAll(".legend-row")
        .data(legendMethods)
        .join("g")
        .attr("class", "legend-row")
        .style("cursor", "pointer")
        .style("transition", "opacity 0.2s")
        .on("mouseenter", function(event, d) { highlightMethod(d); })
        .on("mouseleave", resetHighlights);

    legendRows.append("rect")
        .attr("x", 5).attr("y", (d, i) => 10 + i * 28)
        .attr("width", legendWidth - 10).attr("height", 24)
        .attr("fill", "transparent");

    legendRows.append("circle")
        .attr("cx", 20)
        .attr("cy", (d, i) => 22 + i * 28)
        .attr("r", 6)
        .style("fill", d => colorScale(d));

    legendRows.append("text")
        .attr("x", 35)
        .attr("y", (d, i) => 22 + i * 28)
        .style("font-family", "var(--font-body)")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("fill", "var(--text-dark)")
        .style("alignment-baseline", "middle")
        .text(d => d);
}

// Lazy loading
function initScatterWhenVisible() {
    const container = document.getElementById("scatter-plot-container");
    if (!container) return;

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                buildScatterPlot();
                obs.unobserve(entry.target); 
            }
        });
    }, { rootMargin: "300px 0px" });

    observer.observe(container);
}

if (window.globalExoplanetData && window.globalExoplanetData.length > 0) {
    initScatterWhenVisible();
} else {
    document.addEventListener('dataLoaded', initScatterWhenVisible);
}
/**
 * Constructs visualisations for a select number of star systems. 
 */
let allSystems = [];

function normalizeMethod(method) {
    if (method !== "Transit" && method !== "Radial Velocity" && method !== "Microlensing" && method !== "Imaging") return "Other";
    return method;
}

function getFilteredSystems(allSystems, activeMethods, activePlanetCounts) {
    return allSystems
        .filter(s => activePlanetCounts.includes(s.planetCount))
        .filter(s => s.planets.some(p => activeMethods.includes(normalizeMethod(p.method))));
}

function getActiveCheckboxes(name) {
    return [...document.querySelectorAll(`input[name="${name}"]:checked`)]
        .map(el => el.value);
}

function attachMethodListeners() {
    document.querySelectorAll("input[name='method']").forEach(input => {
        input.addEventListener("change", render);
    });
}

async function loadData() {
    const rawData = await getExoplanetData();
    if (!rawData || rawData.length === 0) return;

    // Data
    const data = rawData
        .filter(d => d.pl_orbsmax && !isNaN(d.pl_orbsmax) && d.pl_radj && !isNaN(d.pl_radj) && d.sy_pnum && !isNaN(d.sy_pnum))
        .map(d => ({
            method: d.discoverymethod,
            distance: +d.pl_orbsmax,
            hostname: d.hostname,
            radius: +d.pl_radj,
            name: d.pl_name,
            planetCount: +d.sy_pnum
        }))
    
    console.log(data)
    const groupPerHost = d3.group(data, d => d.hostname);
    allSystems = Array.from(groupPerHost, ([hostname, planets]) => ({
        hostname,
        planetCount: planets[0].planetCount,
        planets
    }));

    populatePlanetCountCheckBoxes();
    attachMethodListeners(); 
    render();
    document.getElementById("scroll-area").scrollTop = 0;
}

function populatePlanetCountCheckBoxes() {
    const counts = [...new Set(allSystems.map(s => s.planetCount))]
        .filter(n => n >= 1 && n <= 8)
        .sort((a, b) => a - b);

    const container = document.getElementById("planet-count-filters");
    container.innerHTML = counts.map(n => `
        <label>
            <input type="checkbox" name="planetCount" value="${n}" ${n === 8 ? "checked" : ""}>
            ${n} ${n === 1 ? "planet" : "planets"}
        </label>
    `).join("");

    container.querySelectorAll("input").forEach(input => {
        input.addEventListener("change", render);
    });
}

function render() {
    const activeMethods = getActiveCheckboxes("method");
    const activePlanetCounts = getActiveCheckboxes("planetCount").map(Number);
    const filteredSystems = getFilteredSystems(allSystems, activeMethods, activePlanetCounts);
    const planets = filteredSystems.flatMap(s => s.planets);

    drawVisualisation(filteredSystems, planets);
}

function drawVisualisation(systems, planets){
    d3.select("#systems-svg").selectAll("*").remove();
    d3.select("#x-axis-svg").selectAll("*").remove();
    d3.select("#legend-svg").selectAll("*").remove();
    d3.selectAll(".tooltip").remove();

    if (systems.length === 0) {
        d3.select("#systems-svg").append("text")
            .attr("x", 20).attr("y", 40)
            .text("No star systems match the current filters.")
            .style("fill", "var(--text-main, #333)");
        return;
    }

    // Setup 
    const container = document.getElementById("system-visualisation-container");
    const containerWidth = container.clientWidth;
    const margin = { top: 10, right: 40, bottom: 30, left: 70 };
    const width = containerWidth - margin.left - margin.right;
    const rowHeight = 60;
    const height = systems.length * rowHeight;

    const axisSvg = d3.select("#x-axis-svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", 80);

    const legendSvg = d3.select("#legend-svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", 40);

    const axisGroup = axisSvg.append("g")
        .attr("transform", `translate(${margin.left}, 10)`);

    const systemsSvg = d3.select("#systems-svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height);

    const svg = systemsSvg.append("g")
        .attr("transform", `translate(${margin.left}, ${margin.top})`);

    // Scales
    const allDistances = planets.map(d => d.distance);

    const xScale = d3.scaleLog()
        .domain([d3.min(allDistances), d3.max(allDistances)])
        .nice()
        .range([0, width]);

    const yScale = d3.scaleBand()
        .domain(systems.map(d => d.hostname))
        .range([0, height])
        .padding(0.2);

    const sizeScale = d3.scaleLinear()
        .domain(d3.extent(planets, d => d.radius))
        .range([4, 20]);

    // Format
    const format = d3.format(".2f");
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("padding", "6px")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("opacity", 0);
        
    const colorScale = (method) => {
        if (method === "Transit") return "var(--color-transit, #2563eb)";
        if (method === "Radial Velocity") return "var(--color-radial, #ea580c)";
        if (method === "Microlensing") return "var(--color-microlensing, #16a34a)";
        if (method === "Imaging") return "var(--color-imaging, #9333ea)";
        return "var(--color-other, #64748b)";
    };

    // Picture
    svg.selectAll(".system-line")
        .data(systems)
        .join("line")
        .attr("class", "system-line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", d => yScale(d.hostname) + yScale.bandwidth() / 2)
        .attr("y2", d => yScale(d.hostname) + yScale.bandwidth() / 2)
        .attr("stroke", "#ccc");

    svg.selectAll(".planet")
        .data(planets)
        .join("circle")
        .attr("class", "planet")
        .attr("cx", d => xScale(d.distance))
        .attr("cy", d => yScale(d.hostname) + yScale.bandwidth() / 2)
        .attr("r",d => sizeScale(d.radius,2))
        .style("fill", d => colorScale(normalizeMethod(d.method)))
        .on("mouseover", (event, d) => {
        tooltip
            .style("opacity", 1)
            .html(`
                <strong>${d.name}</strong><br>
                Radius: ${format(d.radius)} Jupiter Radii<br>
                Distance: ${format(d.distance)} AU<br>
                Method: ${d.method} 
            `);
        })

        .on("mousemove", (event) => {
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })

        .on("mouseout", () => {
            tooltip.style("opacity", 0);
        });

    // Axes
    const yAxis = d3.axisLeft(yScale);

    svg.append("g")
        .call(yAxis);

    const xTicks = [0.01, 0.1, 1, 10, 100, 1000, 10000];
    axisGroup.call(
        d3.axisBottom(xScale)
            .tickValues(xTicks)
            .tickFormat(d => d >= 1 ? d3.format(".0f")(d) : d)
    );

    axisSvg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", margin.left + width / 2)
        .attr("y", 65)
        .style("fill", "var(--text-main, #333)")
        .style("font-size", "14px")
        .style("font-weight", "500")
        .text("Orbital Distance (AU)");

    /*
    // Legend
    const legendCategories = ["Transit", "Radial Velocity", "Microlensing", "Imaging", "Other"];
    const legendX = margin.left;
    const legendY = 20;
    const spacing = 120
    const legend = legendSvg.append("g")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    legend.append("rect")
        .attr("x", -10)
        .attr("y", -15)
        .attr("width", legendCategories.length * spacing + 80)
        .attr("height", 40)
        .attr("fill", "var(--container-bg, #ffffff)")
        .attr("opacity", 0.9)
        .attr("rx", 5)

    legend.selectAll("legendDots")
        .data(legendCategories)
        .join("circle")
        .attr("cx", (d, i) => i * spacing)
        .attr("cy", 0)
        .attr("r", 6)
        .style("fill", d => colorScale(d));

    legend.selectAll("legendLabels")
        .data(legendCategories)
        .join("text")
        .attr("x", (d, i) => i * spacing + 10)
        .attr("y", 3)
        .style("font-size", "13px")
        .style("font-weight", "500")
        .style("fill", "var(--text-main, #333)")
        .style("alignment-baseline", "middle")
        .text(d => d);  
        */
}
loadData();

/*
    const planets = systems.flatMap(system =>
        system.planets.map(p => ({
            ...p,
            hostname: system.hostname
        }))
    );

    console.log(systems)
    console.log(planets)

    // Space
    const container = document.getElementById("system-visualisation-container"); 
    const containerWidth = container.clientWidth;

    const margin = { top: 10, right: 40, bottom: 30, left: 70};
    const width = containerWidth - margin.left - margin.right;
    const rowHeight = 60;
    const height = systems.length * rowHeight;

    const axisSvg = d3.select("#x-axis-svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", 80);

    const legendSvg = d3.select("#legend-svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", 80);

    const axisGroup = axisSvg.append("g")
        .attr("transform", `translate(${margin.left},30)`);

    const systemsSvg = d3.select("#systems-svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height);

    const svg = systemsSvg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

        
    const svg = d3.select("#system-visualisation-container")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);
    

    // Scales

    const allDistances = data.map(d => d.distance);

    const xScale = d3.scaleLog()
        .domain([d3.min(allDistances),d3.max(allDistances)])
        .nice()
        .range([0, width]);
    
    const yScale = d3.scaleBand()
        .domain(systems.map(d => d.hostname))
        .range([0, height])
        .padding(0.2);

    const sizeScale = d3.scaleLinear()
        .domain(d3.extent(data, d => d.radius,2))
        .range([4, 20]);  

    // Formats
    const format = d3.format(".2f");
    const tooltip = d3.select("body")
        .append("div")
        .attr("class", "tooltip")
        .style("position", "absolute")
        .style("background", "white")
        .style("border", "1px solid #ccc")
        .style("padding", "6px")
        .style("border-radius", "4px")
        .style("pointer-events", "none")
        .style("opacity", 0);
        
    const colorScale = (method) => {
        if (method === "Transit") return "var(--color-transit, #2563eb)";
        if (method === "Radial Velocity") return "var(--color-radial, #ea580c)";
        if (method === "Microlensing") return "var(--color-microlensing, #16a34a)";
        if (method === "Imaging") return "var(--color-imaging, #9333ea)";
        return "var(--color-other, #64748b)";
    };

    // Picture 
    svg.selectAll(".system-line")
        .data(systems)
        .join("line")
        .attr("class", "system-line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", d => yScale(d.hostname) + yScale.bandwidth() / 2)
        .attr("y2", d => yScale(d.hostname) + yScale.bandwidth() / 2)
        .attr("stroke", "#ccc");

    svg.selectAll(".planet")
        .data(planets)
        .join("circle")
        .attr("class", "planet")
        .attr("cx", d => xScale(d.distance))
        .attr("cy", d => yScale(d.hostname) + yScale.bandwidth() / 2)
        .attr("r",d => sizeScale(d.radius,2))
        .style("fill", d => colorScale(normalizeMethod(d.method)))
        .on("mouseover", (event, d) => {
        tooltip
            .style("opacity", 1)
            .html(`
                <strong>${d.name}</strong><br>
                Radius: ${format(d.radius)} Jupiter Radii<br>
                Distance: ${format(d.distance)} AU<br>
                Method: ${d.method} 
            `);
        })

        .on("mousemove", (event) => {
            tooltip
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })

        .on("mouseout", () => {
            tooltip.style("opacity", 0);
        });

    // Axes
    const niceFormat = d => Number(d).toLocaleString("en-GB", { maximumFractionDigits: 4 });

    const yAxis = d3.axisLeft(yScale);

    svg.append("g")
        .call(yAxis);

    axisGroup.call(
        d3.axisBottom(xScale)
            .ticks(10)
            .tickFormat(niceFormat)
    );

    axisSvg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", margin.left + width / 2)
        .attr("y", 65)
        .style("fill", "var(--text-main, #333)")
        .style("font-size", "14px")
        .style("font-weight", "500")
        .text("Orbital Distance (AU)");

    // Legend
    const legendCategories = ["Transit", "Radial Velocity", "Microlensing", "Imaging", "Other"];
    const legendX = margin.left;
    const legendY = 20;
    const spacing = 120
    const legend = legendSvg.append("g")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    legend.append("rect")
        .attr("x", -10)
        .attr("y", -15)
        .attr("width", legendCategories.length * spacing + 80)
        .attr("height", 40)
        .attr("fill", "var(--container-bg, #ffffff)")
        .attr("opacity", 0.9)
        .attr("rx", 5)

    legend.selectAll("legendDots")
        .data(legendCategories)
        .join("circle")
        .attr("cx", (d, i) => i * spacing)
        .attr("cy", 0)
        .attr("r", 6)
        .style("fill", d => colorScale(d));

    legend.selectAll("legendLabels")
        .data(legendCategories)
        .join("text")
        .attr("x", (d, i) => i * spacing + 10)
        .attr("y", 3)
        .style("font-size", "13px")
        .style("font-weight", "500")
        .style("fill", "var(--text-main, #333)")
        .style("alignment-baseline", "middle")
        .text(d => d);  
}

buildSystemVisualisation();
*/
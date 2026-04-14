/**
 * Builds a scatter plot of the mass versus distance of exoplanets.
 * Includes the discovery method in color and two reference planets in
 * our solar system (Earth and Jupiter).
 */
async function buildScatterPlot() {
    const rawData = await getExoplanetData();
    if (!rawData || rawData.length === 0) return;

    // Data
    const data = rawData
        .filter(d => d.pl_bmasse && d.pl_orbsmax && !isNaN(d.pl_bmasse) && !isNaN(d.pl_orbsmax))
        .map(d => ({
            method: d.discoverymethod,
            mass: +d.pl_bmasse,
            distance: +d.pl_orbsmax
        }));

    const container = document.getElementById("scatter-plot-container");
    const containerWidth = container.clientWidth;
    
    const margin = { top: 30, right: 40, bottom: 60, left: 60 };
    const width = containerWidth - margin.left - margin.right;
    const height = 450 - margin.top - margin.bottom;

    const svg = d3.select("#scatter-plot-container")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Logarithmic scales (and minimums)
    const minDistance = Math.min(d3.min(data, d => d.distance), 0.5);
    const maxDistance = Math.max(d3.max(data, d => d.distance), 10);
    const minMass = Math.min(d3.min(data, d => d.mass), 0.5);
    const maxMass = Math.max(d3.max(data, d => d.mass), 1000);

    const x = d3.scaleLog()
        .domain([minDistance, maxDistance])
        .range([0, width]);

    const y = d3.scaleLog()
        .domain([minMass, maxMass])
        .range([height, 0]);

    const colorScale = (method) => {
        if (method === "Transit") return "var(--color-transit, #2563eb)";
        if (method === "Radial Velocity") return "var(--color-radial, #ea580c)";
        if (method === "Microlensing") return "var(--color-microlensing, #16a34a)";
        if (method === "Imaging") return "var(--color-imaging, #9333ea)";
        return "var(--color-other, #64748b)";
    };

    // Converts values like 10000 to "10,000" and 0.01 to "0.01"
    const niceFormat = d => Number(d).toLocaleString("en-GB", { maximumFractionDigits: 4 });

    // Axes
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).ticks(5).tickFormat(niceFormat))
        .selectAll("text")
        .style("fill", "var(--text-main, #333)");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .style("fill", "var(--text-main, #333)")
        .style("font-size", "14px")
        .style("font-weight", "500")
        .text("Orbital Distance (AU)");

    svg.append("g")
        .call(d3.axisLeft(y).ticks(5).tickFormat(niceFormat))
        .selectAll("text")
        .style("fill", "var(--text-main, #333)");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("y", -45)
        .attr("x", -height / 2)
        .style("fill", "var(--text-main, #333)")
        .style("font-size", "14px")
        .style("font-weight", "500")
        .text("Mass (Earth Masses, M🜨)");

    // Gridlines
    svg.append("g")
        .attr("class", "grid")
        .attr("opacity", 0.08)
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(""));
    
    svg.append("g")
        .attr("class", "grid")
        .attr("transform", `translate(0,${height})`)
        .attr("opacity", 0.08)
        .call(d3.axisBottom(x).tickSize(-height).tickFormat(""));

    // Scatter plot
    svg.append('g')
        .selectAll("circle")
        .data(data)
        .join("circle")
        .attr("cx", d => x(d.distance))
        .attr("cy", d => y(d.mass))
        .attr("r", 3.5)
        .style("fill", d => colorScale(d.method))
        .style("opacity", 0.6)
        .style("stroke", "none");

    const referencePlanets = [
        { name: "Earth (1 AU, 1 M🜨)", mass: 1, distance: 1, dx: 30, dy: 30 },
        { name: "Jupiter (5.2 AU, 318 M🜨)", mass: 317.828, distance: 5.2, dx: 40, dy: 20 }
    ];

    const refGroup = svg.append("g").attr("class", "reference-planets");

    refGroup.selectAll("line")
        .data(referencePlanets)
        .join("line")
        .attr("x1", d => x(d.distance))
        .attr("y1", d => y(d.mass))
        .attr("x2", d => x(d.distance) + d.dx)
        .attr("y2", d => y(d.mass) + d.dy)
        .style("stroke", "var(--text-main, #333)")
        .style("stroke-width", 1.5)
        .style("stroke-dasharray", "4,4"); 

    refGroup.selectAll("circle")
        .data(referencePlanets)
        .join("circle")
        .attr("cx", d => x(d.distance))
        .attr("cy", d => y(d.mass))
        .attr("r", 6)
        .style("fill", "#ffffff")
        .style("stroke", "var(--text-main, #333)")
        .style("stroke-width", 2);

    refGroup.selectAll("text")
        .data(referencePlanets)
        .join("text")
        .attr("x", d => x(d.distance) + d.dx + 5)
        .attr("y", d => y(d.mass) + d.dy + 4)
        .style("font-size", "13px")
        .style("font-weight", "bold")
        .style("fill", "var(--text-main, #333)")
        .text(d => d.name);

    // Legend
    const legendCategories = ["Transit", "Radial Velocity", "Microlensing", "Imaging", "Other"];
    const legendX = width - 140;
    const legendY = height - 150;
    const legend = svg.append("g")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    legend.append("rect")
        .attr("x", -10)
        .attr("y", -15)
        .attr("width", 130)
        .attr("height", legendCategories.length * 25 + 10)
        .attr("fill", "var(--container-bg, #ffffff)")
        .attr("opacity", 0.9)
        .attr("rx", 5);

    legend.selectAll("legendDots")
        .data(legendCategories)
        .join("circle")
        .attr("cx", 0)
        .attr("cy", (d, i) => i * 25)
        .attr("r", 6)
        .style("fill", d => colorScale(d));

    legend.selectAll("legendLabels")
        .data(legendCategories)
        .join("text")
        .attr("x", 15)
        .attr("y", (d, i) => i * 25)
        .style("font-size", "13px")
        .style("font-weight", "500")
        .style("fill", "var(--text-main, #333)")
        .style("alignment-baseline", "middle")
        .text(d => d);
}

buildScatterPlot();
/**
 * Builds a visualization comparing a statistically "average" exoplanetary system
 * against our own Solar System. Uses a logarithmic scale for distance and 
 * a square root scale for planet radius.
 */
async function buildAverageSystemComparison() {
    const rawData = await getExoplanetData();
    if (!rawData || rawData.length === 0) return;

    const validData = rawData
        .filter(d => d.pl_orbsmax && d.pl_rade && !isNaN(d.pl_orbsmax) && !isNaN(d.pl_rade) && +d.pl_orbsmax > 0)
        .map(d => ({
            hostname: d.hostname,
            dist: +d.pl_orbsmax,
            rad: +d.pl_rade
        }));

    const systems = Array.from(d3.group(validData, d => d.hostname).values())
        .map(planets => planets.sort((a, b) => a.dist - b.dist));

    const solarSystem = [
        { name: "Mercury", dist: 0.39, rad: 0.38, type: "Solar" },
        { name: "Venus", dist: 0.72, rad: 0.95, type: "Solar" },
        { name: "Earth", dist: 1.00, rad: 1.00, type: "Solar" },
        { name: "Mars", dist: 1.52, rad: 0.53, type: "Solar" },
        { name: "Jupiter", dist: 5.20, rad: 11.21, type: "Solar" },
        { name: "Saturn", dist: 9.58, rad: 9.45, type: "Solar" },
        { name: "Uranus", dist: 19.20, rad: 4.01, type: "Solar" },
        { name: "Neptune", dist: 30.05, rad: 3.88, type: "Solar" }
    ];

    const container = document.getElementById("average-system-container");
    const containerWidth = container.clientWidth;

    const margin = { top: 40, right: 60, bottom: 60, left: 160 };
    const width = containerWidth - margin.left - margin.right;
    const height = 300 - margin.top - margin.bottom;

    const controlsDiv = d3.select("#average-system-container").append("div")
        .style("margin-bottom", "20px")
        .style("display", "flex")
        .style("flex-direction", "column")
        .style("gap", "10px");

    const selectWrapper = controlsDiv.append("div");
    selectWrapper.append("strong").text("System Selection: ");
    const select = selectWrapper.append("select").attr("id", "system-mode-select");

    const options = ["Combined Method", ...Array.from({length: 8}, (_, i) => `${i + 1} Planet Systems`)];
    select.selectAll("option").data(options).join("option").attr("value", d => d).text(d => d);

    const descText = controlsDiv.append("p")
        .style("font-size", "13px")
        .style("color", "var(--text-muted, #64748b)")
        .style("margin", "0")
        .style("line-height", "1.5")
        .style("background-color", "var(--bg-color, #f4f7f6)")
        .style("padding", "10px")
        .style("border-radius", "5px");

    const svg = d3.select("#average-system-container")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    let tooltip = d3.select("body").select(".d3-tooltip");
    if (tooltip.empty()) {
        tooltip = d3.select("body").append("div").attr("class", "d3-tooltip");
    }

    const xDist = d3.scaleLog().domain([0.01, 40]).range([0, width]);
    const rScale = d3.scaleSqrt().domain([0, 12]).range([2, 24]);
    const yTrack = d3.scaleBand().domain(["avg", "solar"]).range([0, height]).padding(0.4);

    const tracks = [
        { id: "avg", line1: "Average Exoplanet", line2: "System" },
        { id: "solar", line1: "Our Solar", line2: "System" }
    ];

    svg.selectAll(".track-line")
        .data(tracks)
        .join("line")
        .attr("class", "track-line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", d => yTrack(d.id) + yTrack.bandwidth() / 2)
        .attr("y2", d => yTrack(d.id) + yTrack.bandwidth() / 2)
        .style("stroke", "var(--grid-line, #e0e0e0)")
        .style("stroke-width", 2)
        .style("stroke-dasharray", "4 4");

    svg.selectAll(".star")
        .data(tracks)
        .join("circle")
        .attr("cx", 0)
        .attr("cy", d => yTrack(d.id) + yTrack.bandwidth() / 2)
        .attr("r", 15)
        .style("fill", "#fbbf24")
        .style("stroke", "#f59e0b")
        .style("stroke-width", 2);

    const labels = svg.selectAll(".track-label")
        .data(tracks)
        .join("text")
        .attr("class", "track-label")
        .attr("x", -25)
        .attr("y", d => yTrack(d.id) + yTrack.bandwidth() / 2)
        .attr("text-anchor", "end")
        .style("font-weight", "bold")
        .style("fill", "var(--text-main, #333)")
        .style("font-size", "14px");

    labels.selectAll("tspan")
        .data(d => [d.line1, d.line2])
        .join("tspan")
        .attr("x", -25)
        .attr("dy", (d, i) => i === 0 ? "-0.2em" : "1.2em")
        .text(d => d);

    const niceFormat = d => Number(d).toLocaleString(undefined, { maximumFractionDigits: 2 });
    
    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xDist).tickValues([0.01, 0.1, 1, 10, 40]).tickFormat(niceFormat))
        .selectAll("text")
        .style("fill", "var(--text-main, #333)");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .style("fill", "var(--text-main, #333)")
        .style("font-size", "13px")
        .style("font-weight", "500")
        .text("Orbital Distance (AU)");

    const planetGroup = svg.append("g");
    
    svg.selectAll(".solar-text")
        .data(solarSystem)
        .join("text")
        .attr("class", "solar-text")
        .attr("x", d => xDist(d.dist))
        .attr("y", (d, i) => {
            const trackY = yTrack("solar") + yTrack.bandwidth() / 2;
            return i % 2 === 0 ? trackY - rScale(d.rad) - 8 : trackY + rScale(d.rad) + 16;
        })
        .attr("text-anchor", "middle")
        .style("font-size", "11px")
        .style("fill", "var(--text-muted, #64748b)")
        .style("pointer-events", "none")
        .text(d => d.name);

    function updateChart(mode) {
        let filteredSystems = [];
        let buckets = [];
        let infoText = "";

        if (mode === "Combined Method") {
            filteredSystems = systems;
            for (let i = 0; i < 8; i++) buckets.push([]);
            filteredSystems.forEach(sys => {
                sys.forEach((p, i) => {
                    if (i < 8) buckets[i].push(p);
                });
            });
            infoText = `<strong>Combined Method (N = ${filteredSystems.length} systems):</strong> Planet 1 is the median of the innermost planet of EVERY system. Planet 2 is the median of the second planet of every system with at least 2 planets, etc. <em>Note: Distant exoplanets in 1-planet systems can artificially skew the "Planet 1" median outwards, which is why grouping by exact system size is often more accurate.</em>`;
        } else {
            const n = parseInt(mode.split(" ")[0]);
            filteredSystems = systems.filter(s => s.length === n);
            for (let i = 0; i < n; i++) buckets.push([]);
            filteredSystems.forEach(sys => {
                sys.forEach((p, i) => {
                    if (i < n) buckets[i].push(p);
                });
            });
            infoText = `<strong>${n} Planet Systems (N = ${filteredSystems.length} systems):</strong> Shows the median orbital distances and radii exclusively for systems that possess exactly ${n} confirmed planet(s).`;
        }

        descText.html(infoText);

        const averageSystem = [];
        buckets.forEach((bucket, i) => {
            if (bucket.length > 0) {
                averageSystem.push({
                    name: `Exoplanet ${i + 1}`,
                    dist: d3.median(bucket, d => d.dist),
                    rad: d3.median(bucket, d => d.rad),
                    type: "Exoplanet"
                });
            }
        });

        const allPlanets = [...averageSystem, ...solarSystem];

        planetGroup.selectAll(".planet-node")
            .data(allPlanets, d => d.name + d.type)
            .join(
                enter => enter.append("circle")
                    .attr("class", "planet-node")
                    .attr("cx", d => xDist(d.dist))
                    .attr("cy", d => yTrack(d.type === "Solar" ? "solar" : "avg") + yTrack.bandwidth() / 2)
                    .attr("r", 0)
                    .style("fill", d => d.type === "Solar" ? "#64748b" : "var(--accent-blue, #2563eb)")
                    .style("stroke", "#ffffff")
                    .style("stroke-width", 1.5)
                    .style("cursor", "pointer")
                    .on("mouseover", function(event, d) {
                        d3.select(this).style("stroke", "#000").style("stroke-width", 2).raise();
                        tooltip.style("opacity", 1).html(`
                            <strong>${d.name}</strong><br>
                            Distance: ${d.dist.toFixed(3)} AU<br>
                            Radius: ${d.rad.toFixed(2)} Earths
                        `);
                    })
                    .on("mousemove", function(event) {
                        tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 20) + "px");
                    })
                    .on("mouseout", function(event, d) {
                        d3.select(this).style("stroke", "#ffffff").style("stroke-width", 1.5);
                        tooltip.style("opacity", 0);
                    })
                    .call(enter => enter.transition().duration(500).attr("r", d => rScale(d.rad))),
                update => update.call(update => update.transition().duration(500)
                    .attr("cx", d => xDist(d.dist))
                    .attr("r", d => rScale(d.rad))),
                exit => exit.call(exit => exit.transition().duration(500).attr("r", 0).remove())
            );
    }

    select.on("change", function() {
        updateChart(this.value);
    });

    updateChart("Combined Method");
}

buildAverageSystemComparison();
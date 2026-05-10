async function buildAverageSystemComparison() {
    const rawData = window.globalExoplanetData;
    if (!rawData || rawData.length === 0) return;

    // Clean data
    const validData = rawData
        .filter(d => d.pl_orbsmax && d.pl_rade && !isNaN(d.pl_orbsmax) && !isNaN(d.pl_rade) && +d.pl_orbsmax > 0)
        .map(d => ({
            hostname: d.hostname,
            dist: +d.pl_orbsmax,
            rad: +d.pl_rade // Earth radii
        }));

    const systems = Array.from(d3.group(validData, d => d.hostname).values())
        .map(planets => planets.sort((a, b) => a.dist - b.dist));

    const formattedSolarSystem = solarSystem.map(p => ({
        name: p.name,
        dist: p.distance,
        rad: p.radius * 11.209, // Convert to correct units
        type: "Solar",
        color: p.color
    }));

    /// Dimensions and lay-out
    const container = document.getElementById("average-system-container");
    container.innerHTML = ""; // Clear existing
    
    const fullWidth = 800;
    const fullHeight = 240;
    const margin = { top: 20, right: 40, bottom: 50, left: 150 };
    const width = fullWidth - margin.left - margin.right;
    const height = fullHeight - margin.top - margin.bottom;

    const svg = d3.select("#average-system-container")
        .append("svg")
        .attr("viewBox", `0 0 ${fullWidth} ${fullHeight}`)
        .style("width", "100%")
        .style("height", "auto")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const tooltip = d3.select("body")
        .selectAll(".exo-tooltip")
        .data([null])
        .join("div")
        .attr("class", "exo-tooltip")
        .style("pointer-events", "none");
    d3.select("#scroll-area").on("scroll.avgSystem", () => {
        tooltip.style("opacity", 0);
    });
    d3.select("body").on("touchstart.avgSystem", (event) => {
        if (!event.target.closest('.planet-node')) {
            tooltip.style("opacity", 0);
        }
    });

    const xDist = d3.scaleLog().domain([0.01, 40]).range([0, width]);
    const rScale = d3.scaleSqrt().domain([0, 12]).range([2, 22]);
    const yTrack = d3.scaleBand().domain(["avg", "solar"]).range([0, height]).padding(0.5);

    const tracks = [
        { id: "avg", line1: "Average exoplanet", line2: "system" },
        { id: "solar", line1: "Our Solar", line2: "System" }
    ];

    // Orbit lines and host stars
    svg.selectAll(".track-line")
        .data(tracks)
        .join("line")
        .attr("class", "track-line")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", d => yTrack(d.id) + yTrack.bandwidth() / 2)
        .attr("y2", d => yTrack(d.id) + yTrack.bandwidth() / 2)
        .style("stroke", "var(--border-light)")
        .style("stroke-width", 1)
        .style("stroke-dasharray", "4 4");

    svg.selectAll(".star")
        .data(tracks)
        .join("circle")
        .attr("cx", 0)
        .attr("cy", d => yTrack(d.id) + yTrack.bandwidth() / 2)
        .attr("r", 12)
        .style("fill", "#fcd34d")
        .style("stroke", "#fbbf24")
        .style("stroke-width", 2)
        .style("filter", "drop-shadow(0 0 5px rgba(252, 211, 77, 0.8))");

    const labels = svg.selectAll(".track-label")
        .data(tracks)
        .join("text")
        .attr("class", "track-label")
        .attr("x", -25)
        .attr("y", d => yTrack(d.id) + yTrack.bandwidth() / 2)
        .attr("text-anchor", "end")
        .style("font-family", "var(--font-heading)")
        .style("font-weight", "600")
        .style("fill", "var(--text-dark)")
        .style("font-size", "13px");

    labels.selectAll("tspan")
        .data(d => [d.line1, d.line2])
        .join("tspan")
        .attr("x", -25)
        .attr("dy", (d, i) => i === 0 ? "-0.2em" : "1.2em")
        .text(d => d);

    // X-axis
    const logFormat = d => Number(d).toLocaleString("en-GB", { maximumFractionDigits: 4 });
    const gx = svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(xDist).tickValues([0.01, 0.1, 1, 10, 40]).tickFormat(logFormat));
        
    gx.select(".domain").attr("stroke", "var(--border-light)");
    gx.selectAll(".tick line").attr("stroke", "var(--border-light)");
    gx.selectAll("text").style("font-family", "var(--font-body)").style("fill", "var(--text-muted)");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .style("font-family", "var(--font-heading)")
        .style("font-size", "12px")
        .style("font-weight", "700")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "1px")
        .style("fill", "var(--text-muted)")
        .text("Orbital distance (AU)");

    const planetGroup = svg.append("g");
    
    // Solar system labels
    svg.selectAll(".solar-text")
        .data(formattedSolarSystem)
        .join("text")
        .attr("class", "solar-text")
        .attr("x", d => xDist(d.dist))
        .attr("y", (d, i) => {
            const trackY = yTrack("solar") + yTrack.bandwidth() / 2;
            return i % 2 === 0 ? trackY - rScale(d.rad) - 10 : trackY + rScale(d.rad) + 15;
        })
        .attr("text-anchor", "middle")
        .style("font-family", "var(--font-body)")
        .style("font-size", "10px")
        .style("font-weight", "600")
        .style("fill", "var(--text-muted)")
        .text(d => d.name);

    // Dynamic update logic
    function updateChart(mode) {
        let filteredSystems = [];
        let buckets = [];

        if (mode === "Combined method") {
            filteredSystems = systems;
            for (let i = 0; i < 8; i++) buckets.push([]);
            filteredSystems.forEach(sys => {
                sys.forEach((p, i) => {
                    if (i < 8) buckets[i].push(p);
                });
            });
        } else {
            const n = parseInt(mode.split(" ")[0]);
            filteredSystems = systems.filter(s => s.length >= n);
            for (let i = 0; i < n; i++) buckets.push([]);
            filteredSystems.forEach(sys => {
                sys.forEach((p, i) => {
                    if (i < n) buckets[i].push(p);
                });
            });
        }

        // Number of systems update
        d3.select("#dynamic-sys-count").text(`Based on ${window.formatExoNumber(filteredSystems.length)} system(s).`);

        const averageSystem = [];
        buckets.forEach((bucket, i) => {
            if (bucket.length > 0) {
                averageSystem.push({
                    name: `Average planet ${i + 1}`,
                    dist: d3.median(bucket, d => d.dist),
                    rad: d3.median(bucket, d => d.rad),
                    type: "Exoplanet",
                    color: "var(--color-transit)" 
                });
            }
        });

        const allPlanets = [...averageSystem, ...formattedSolarSystem];

        planetGroup.selectAll(".planet-node")
            .data(allPlanets, d => d.name + d.type)
            .join(
                enter => enter.append("circle")
                    .attr("class", "planet-node")
                    .attr("cx", d => xDist(d.dist))
                    .attr("cy", d => yTrack(d.type === "Solar" ? "solar" : "avg") + yTrack.bandwidth() / 2)
                    .attr("r", 0)
                    .style("fill", d => d.color)
                    .style("stroke", "var(--bg-card)")
                    .style("stroke-width", 1.5)
                    .style("cursor", "pointer")
                    .on("mouseover", function(event, d) {
                        d3.select(this).style("stroke", "white").style("stroke-width", 2);
                        
                        tooltip.style("transition", "none").style("opacity", 1).html(`
                            <div class="tt-header">${d.name}</div>
                            <table style="width: 100%; min-width: 150px; font-size: 0.8rem; margin-top: 8px; border-collapse: collapse;">
                                <tr>
                                    <td style="padding-bottom: 4px; padding-right: 16px; color: var(--text-light);">Radius:</td>
                                    <td style="text-align: right; font-weight: bold; font-variant-numeric: tabular-nums; padding-bottom: 4px;">${window.formatExoNumber(d.rad, 2)} R<sub>⊕</sub></td>
                                </tr>
                                <tr>
                                    <td style="padding-right: 16px; color: var(--text-light);">Distance:</td>
                                    <td style="text-align: right; font-weight: bold; font-variant-numeric: tabular-nums;">${window.formatExoNumber(d.dist, 4)} AU</td>
                                </tr>
                            </table>
                        `);
                    })
                    .on("mousemove", event => tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 20) + "px"))
                    .on("mouseout", function() {
                        d3.select(this).style("stroke", "var(--bg-card)").style("stroke-width", 1.5);
                        tooltip.style("opacity", 0);
                    })
                    .call(enter => enter.transition().duration(750).ease(d3.easeCubicOut).attr("r", d => rScale(d.rad))),
                update => update.call(update => update.transition().duration(750).ease(d3.easeCubicOut)
                    .attr("cx", d => xDist(d.dist))
                    .attr("r", d => rScale(d.rad))),
                exit => exit.call(exit => exit.transition().duration(400).attr("r", 0).remove())
            );
    }

    // Link to slider
    const slider = document.getElementById("planet-slider");
    const sliderVal = document.getElementById("planet-slider-val");
    
    if (slider) {
        slider.addEventListener("input", function() {
            const val = parseInt(this.value);
            if (val === 0) {
                sliderVal.innerText = "All systems";
                updateChart("Combined method");
            } else {
                sliderVal.innerText = val === 1 ? "1 planet" : `${val} planets`;
                updateChart(`${val} Planet systems`);
            }
        });
    }

    // Initialize
    updateChart("Combined method");
}

if (window.globalExoplanetData && window.globalExoplanetData.length > 0) {
    buildAverageSystemComparison();
} else {
    document.addEventListener('dataLoaded', buildAverageSystemComparison);
}
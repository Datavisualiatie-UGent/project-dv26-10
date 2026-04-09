/**
 * Builds an interactive horizontal bar chart displaying exoplanet discovery methods.
 * Includes a timeline brush for filtering data by discovery year and a drill-down
 * view for less common discovery methods.
 */
async function buildInteractiveChart() {
    const rawData = await getExoplanetData();
    if (!rawData || rawData.length === 0) return;

    // Parse years to numbers and filter out invalid or missing entries
    const data = rawData
        .filter(d => d.disc_year && !isNaN(d.disc_year))
        .map(d => ({ ...d, disc_year: +d.disc_year }));

    // Categorize methods for the top-level and drill-down views
    const mainMethods = ["Transit", "Radial Velocity", "Microlensing", "Imaging"];
    
    // Calculate global totals to establish a static, sorted Y-axis domain
    const totalCounts = d3.rollup(data, v => v.length, d => d.discoverymethod);
    const allMethods = Array.from(totalCounts.keys())
        .sort((a, b) => d3.descending(totalCounts.get(a), totalCounts.get(b)));
        
    // Cache minor methods to maintain axis ticks even when windowed counts reach zero
    const allOtherMethods = allMethods.filter(m => !mainMethods.includes(m));

    let isShowingOther = false;
    let currentFilteredData = data; 

    // --- Layout & Dimensions ---
    const containerWidth = document.getElementById("bar-chart-container").clientWidth;
    
    // Timeline margins
    const tMargin = { top: 10, right: 40, bottom: 20, left: 200 }; 
    const tWidth = containerWidth - tMargin.left - tMargin.right;
    const tHeight = 80 - tMargin.top - tMargin.bottom;

    // Main chart margins
    const cMargin = { top: 20, right: 40, bottom: 40, left: 200 }; 
    const cWidth = containerWidth - cMargin.left - cMargin.right;
    const cHeight = 450 - cMargin.top - cMargin.bottom;

    // --- Timeline Construction ---
    const timelineSvg = d3.select("#timeline-container")
        .append("svg")
        .attr("width", tWidth + tMargin.left + tMargin.right)
        .attr("height", tHeight + tMargin.top + tMargin.bottom)
        .append("g")
        .attr("transform", `translate(${tMargin.left},${tMargin.top})`);

    // Aggregate data for the cumulative area chart
    const yearCounts = d3.rollup(data, v => v.length, d => d.disc_year);
    const years = Array.from(yearCounts.keys()).sort(d3.ascending);
    const minYear = d3.min(years);
    const maxYear = d3.max(years);
    
    let cumulative = 0;
    const cumulativeData = years.map(year => {
        cumulative += yearCounts.get(year);
        return { year: year, total: cumulative };
    });

    const xTime = d3.scaleLinear().domain([minYear, maxYear]).range([0, tWidth]);
    const yTime = d3.scaleLinear().domain([0, d3.max(cumulativeData, d => d.total)]).range([tHeight, 0]);

    timelineSvg.append("path")
        .datum(cumulativeData)
        .attr("class", "area-cumulative")
        .attr("d", d3.area().x(d => xTime(d.year)).y0(tHeight).y1(d => yTime(d.total)));

    // Ensure the timeline axis explicitly displays the minimum year
    let timeTicks = xTime.ticks(8); 
    if (!timeTicks.includes(minYear)) timeTicks.unshift(minYear);

    timelineSvg.append("g")
        .attr("transform", `translate(0, ${tHeight})`)
        .call(d3.axisBottom(xTime).tickValues(timeTicks).tickFormat(d3.format("d")));

    // --- Main Bar Chart Construction ---
    const chartSvg = d3.select("#bar-chart-container")
        .append("svg")
        .attr("width", cWidth + cMargin.left + cMargin.right)
        .attr("height", cHeight + cMargin.top + cMargin.bottom)
        .append("g")
        .attr("transform", `translate(${cMargin.left},${cMargin.top})`);

    const xBar = d3.scaleLinear().range([0, cWidth]);
    const yBar = d3.scaleBand().range([0, cHeight]).padding(0.25);

    const xAxisGroup = chartSvg.append("g").attr("transform", `translate(0, ${cHeight})`);
    const yAxisGroup = chartSvg.append("g");

    /**
     * Re-calculates aggregations and transitions the bar chart
     * based on the current filter state and timeline window.
     */
    function updateBarChart() {
        const counts = d3.rollup(currentFilteredData, v => v.length, d => d.discoverymethod);
        let displayData = [];

        if (!isShowingOther) {
            // Aggregate top-level view
            let otherTotal = 0;
            const mainDataMap = new Map();
            mainMethods.forEach(m => mainDataMap.set(m, 0));

            for (const [method, count] of counts.entries()) {
                if (mainMethods.includes(method)) {
                    mainDataMap.set(method, count);
                } else {
                    otherTotal += count;
                }
            }
            
            displayData = Array.from(mainDataMap, ([method, count]) => ({method, count}));
            if (otherTotal > 0) displayData.push({method: "Other", count: otherTotal});

        } else {
            // Map against the pre-defined minor methods to persist zero-count rows
            displayData = allOtherMethods.map(method => ({
                method: method,
                count: counts.get(method) || 0
            }));
        }

        // Sort data vertically (Most -> Least)
        displayData.sort((a, b) => d3.descending(a.count, b.count));

        // Update domains dynamically
        const maxCount = d3.max(displayData, d => d.count) || 1;
        xBar.domain([0, maxCount]);
        yBar.domain(displayData.map(d => d.method));

        // Animate Axes
        xAxisGroup.transition().duration(500).call(d3.axisBottom(xBar).ticks(6));
        yAxisGroup.transition().duration(500).call(d3.axisLeft(yBar).tickSize(0))
            .selectAll("text")
            .style("font-size", "13px")
            .style("fill", "var(--text-main)");
        yAxisGroup.select(".domain").remove();

        // Bar data join
        const bars = chartSvg.selectAll(".bar-rect").data(displayData, d => d.method);
        
        bars.join(
            enter => enter.append("rect")
                .attr("class", "bar-rect")
                .attr("y", d => yBar(d.method))
                .attr("x", 0)
                .attr("height", yBar.bandwidth())
                .attr("width", 0) 
                .attr("rx", 4),
            update => update,
            exit => exit.transition().duration(400).attr("width", 0).remove()
        )
        .classed("bar-clickable", d => d.method === "Other") 
        .style("cursor", d => d.method === "Other" ? "pointer" : "default")
        .on("click", function(event, d) {
            // Trigger drill-down view
            if (d.method === "Other") {
                isShowingOther = true;
                d3.select("#back-btn").style("display", "inline-block");
                updateBarChart();
            }
        })
        .transition().duration(500)
        .attr("y", d => yBar(d.method))
        .attr("height", yBar.bandwidth())
        .attr("width", d => xBar(d.count))
        .attr("fill", d => d.method === "Other" ? "#4b5563" : "var(--accent-blue, #2563eb)");

        // Label data join
        const labels = chartSvg.selectAll(".bar-label").data(displayData, d => d.method);
        
        labels.join(
            enter => enter.append("text").attr("class", "bar-label").attr("dy", "0.35em"),
            update => update,
            exit => exit.transition().duration(400).style("opacity", 0).remove()
        )
        .transition().duration(500)
        .attr("y", d => yBar(d.method) + yBar.bandwidth() / 2)
        .attr("x", d => xBar(d.count) > 30 ? xBar(d.count) - 8 : xBar(d.count) + 8)
        .attr("text-anchor", d => xBar(d.count) > 30 ? "end" : "start")
        .style("fill", d => xBar(d.count) > 30 ? "#ffffff" : "var(--text-muted, #64748b)")
        .style("font-weight", "600")
        .style("font-size", "12px")
        .style("pointer-events", "none") 
        .text(d => d.count > 0 ? d.count : "0"); 
    }

    // --- State Management ---
    document.getElementById("back-btn").addEventListener("click", () => {
        isShowingOther = false;
        d3.select("#back-btn").style("display", "none");
        updateBarChart();
    });

    // --- Timeline Brush & Custom Handles ---
    const handleGroup = timelineSvg.append("g").attr("class", "brush-handles");

    const brush = d3.brushX()
        .extent([[0, 0], [tWidth, tHeight]])
        .on("brush end", function(event) {
            if (!event.selection) {
                // Reset to global view if brush selection is cleared
                handleGroup.style("display", "none");
                currentFilteredData = data;
                updateBarChart();
                return;
            }
            
            // Map pixel coordinates to year bounds
            const [x0, x1] = event.selection.map(xTime.invert);
            currentFilteredData = data.filter(d => d.disc_year >= Math.floor(x0) && d.disc_year <= Math.ceil(x1));
            updateBarChart();

            // Render and position custom drag handles
            handleGroup.style("display", null);
            handleGroup.selectAll(".custom-handle")
                .data([{type: "W", x: event.selection[0]}, {type: "E", x: event.selection[1]}])
                .join(
                    enter => {
                        const h = enter.append("g").attr("class", "custom-handle").attr("cursor", "ew-resize");
                        h.append("rect").attr("class", "handle--custom").attr("y", tHeight / 2 - 12).attr("width", 10).attr("height", 24).attr("rx", 3);
                        h.append("line").attr("class", "handle-grip").attr("y1", tHeight / 2 - 6).attr("y2", tHeight / 2 + 6).attr("x1", 3).attr("x2", 3);
                        h.append("line").attr("class", "handle-grip").attr("y1", tHeight / 2 - 6).attr("y2", tHeight / 2 + 6).attr("x1", 5).attr("x2", 5);
                        h.append("line").attr("class", "handle-grip").attr("y1", tHeight / 2 - 6).attr("y2", tHeight / 2 + 6).attr("x1", 7).attr("x2", 7);
                        return h;
                    },
                    update => update,
                    exit => exit.remove()
                )
                .attr("transform", d => `translate(${d.x - 5}, 0)`);
        });

    // Initialize the brush to cover the entire domain on load
    timelineSvg.append("g").attr("class", "brush").call(brush).call(brush.move, xTime.range());
}

buildInteractiveChart();
function buildInteractiveChart() {
    const rawData = window.globalExoplanetData;
    if (!rawData || rawData.length === 0) return;

    d3.select("#timeline-container").html("");
    d3.select("#bar-chart-container").selectAll("svg").remove();

    // Methods and colours
    const colorScale = (method) => {
        if (method === "Transit") return "var(--color-transit)";
        if (method === "Radial velocity") return "var(--color-radial)";
        if (method === "Microlensing") return "var(--color-microlensing)";
        if (method === "Imaging") return "var(--color-imaging)";
        return "var(--color-other)";
    };

    const data = rawData
        .filter(d => d.disc_year && !isNaN(d.disc_year))
        .map(d => {
            let m = d.discoverymethod;
            if (m === "Radial Velocity") m = "Radial velocity";
            return { ...d, disc_year: +d.disc_year, discoverymethod: m };
        });

    const mainMethods = ["Transit", "Radial velocity", "Microlensing", "Imaging"];
    
    const totalCounts = d3.rollup(data, v => v.length, d => d.discoverymethod);
    const allMethods = Array.from(totalCounts.keys())
        .sort((a, b) => d3.descending(totalCounts.get(a), totalCounts.get(b)));
        
    const allOtherMethods = allMethods.filter(m => !mainMethods.includes(m));

    let isShowingOther = false;
    let currentFilteredData = data; 

    // Lay-out and dimensions
    const cFullWidth = 1050; 
    
    const tMargin = { top: 10, right: 20, bottom: 25, left: 240 }; 
    const tWidth = cFullWidth - tMargin.left - tMargin.right;
    const tHeight = 80 - tMargin.top - tMargin.bottom;

    const cMargin = { top: 10, right: 20, bottom: 40, left: 240 }; 
    const cWidth = cFullWidth - cMargin.left - cMargin.right;
    const cHeight = 450 - cMargin.top - cMargin.bottom;

    // Timeline
    const timelineSvg = d3.select("#timeline-container")
        .append("svg")
        .attr("viewBox", `0 0 ${cFullWidth} 80`) 
        .style("width", "100%")
        .style("height", "auto")
        .append("g")
        .attr("transform", `translate(${tMargin.left},${tMargin.top})`);

    const yLabel = timelineSvg.append("text")
        .attr("x", -120)
        .attr("y", tHeight / 2)
        .attr("text-anchor", "middle")
        .style("fill", "var(--text-muted)")
        .style("font-family", "var(--font-heading)")
        .style("font-size", "11px")
        .style("font-weight", "600");

    yLabel.append("tspan").attr("x", -120).attr("dy", "-1em").text("Total confirmed");
    yLabel.append("tspan").attr("x", -120).attr("dy", "1.2em").text("planets found");

    const dynamicCount = yLabel.append("tspan")
        .attr("x", -120)
        .attr("dy", "1.6em")
        .style("fill", "var(--accent-glow)")
        .style("font-size", "15px")
        .style("font-weight", "bold");

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

    let timeTicks = xTime.ticks(8); 
    if (!timeTicks.includes(minYear)) timeTicks.unshift(minYear);

    timelineSvg.append("g")
        .attr("transform", `translate(0, ${tHeight})`)
        .call(d3.axisBottom(xTime).tickValues(timeTicks).tickFormat(d3.format("d")))
        .attr("font-family", "var(--font-body)")
        .attr("color", "var(--text-muted)");

    // Bar chart
    const chartSvg = d3.select("#bar-chart-container")
        .append("svg")
        .attr("viewBox", `0 0 ${cFullWidth} ${cHeight + cMargin.top + cMargin.bottom}`)
        .style("width", "100%")
        .style("height", "auto")
        .append("g")
        .attr("transform", `translate(${cMargin.left},${cMargin.top})`);

    const xBar = d3.scaleLinear().range([0, cWidth]);
    const yBar = d3.scaleBand().range([0, cHeight]).padding(0.25);

    const xAxisGroup = chartSvg.append("g").attr("transform", `translate(0, ${cHeight})`);
    const yAxisGroup = chartSvg.append("g");

    // Live update based on timeline
    function updateBarChart() {
        dynamicCount.text(window.formatExoNumber(currentFilteredData.length));

        const counts = d3.rollup(currentFilteredData, v => v.length, d => d.discoverymethod);
        let displayData = [];

        if (!isShowingOther) {
            let otherTotal = 0;
            const mainDataMap = new Map();
            mainMethods.forEach(m => mainDataMap.set(m, 0));

            for (const [method, count] of counts.entries()) {
                if (mainMethods.includes(method)) mainDataMap.set(method, count);
                else otherTotal += count;
            }
            
            displayData = Array.from(mainDataMap, ([method, count]) => ({method, count}));
            if (otherTotal > 0) displayData.push({method: "Other", count: otherTotal});
        } else {
            displayData = allOtherMethods.map(method => ({ method: method, count: counts.get(method) || 0 }));
        }

        displayData.sort((a, b) => d3.descending(a.count, b.count));

        const maxCount = d3.max(displayData, d => d.count) || 1;
        xBar.domain([0, maxCount]);
        yBar.domain(displayData.map(d => d.method));

        xAxisGroup.transition().duration(500)
            .call(d3.axisBottom(xBar).ticks(8))
            .attr("font-family", "var(--font-body)")
            .attr("color", "var(--text-muted)");
            
        yAxisGroup.transition().duration(500)
            .call(d3.axisLeft(yBar).tickSize(0).tickPadding(15))
            .selectAll("text")
            .style("font-family", "var(--font-heading)")
            .style("font-weight", "600")
            .style("font-size", "14px")
            .style("fill", "var(--text-dark)")
            .style("color", d => d.includes("Other") ? "var(--color-other)" : "inherit");
            
        yAxisGroup.select(".domain").remove();

        const bars = chartSvg.selectAll(".bar-rect").data(displayData, d => d.method);
        
        bars.join(
            enter => enter.append("rect")
                .attr("class", "bar-rect")
                .attr("y", d => yBar(d.method))
                .attr("x", 0)
                .attr("height", yBar.bandwidth())
                .attr("width", 0) 
                .attr("rx", 6),
            update => update,
            exit => exit.transition().duration(400).attr("width", 0).remove()
        )
        .classed("bar-clickable", d => d.method.includes("Other")) 
        .style("cursor", d => d.method.includes("Other") ? "pointer" : "default")
        .on("click", function(event, d) {
            if (d.method.includes("Other")) {
                isShowingOther = true;
                d3.select("#back-btn").style("display", "inline-block");
                updateBarChart();
            }
        })
        .transition().duration(500)
        .attr("y", d => yBar(d.method))
        .attr("height", yBar.bandwidth())
        .attr("width", d => xBar(d.count))
        .attr("fill", d => d.method.includes("Other") ? "var(--color-other)" : colorScale(d.method));
        
        const MIN_BAR_WIDTH = 45; 
        const labels = chartSvg.selectAll(".bar-label").data(displayData, d => d.method);
        
        labels.join(
            enter => enter.append("text")
                .attr("class", "bar-label")
                .attr("dy", "0.35em")
                .attr("y", d => yBar(d.method) + yBar.bandwidth() / 2)
                .attr("x", 0)
                .style("opacity", 0),
            update => update,
            exit => exit.transition().duration(400).style("opacity", 0).remove()
        )
        .transition().duration(500)
        .style("opacity", 1) 
        .attr("y", d => yBar(d.method) + yBar.bandwidth() / 2)
        .attr("x", d => xBar(d.count) > MIN_BAR_WIDTH ? xBar(d.count) - 10 : xBar(d.count) + 10)
        .attr("text-anchor", d => xBar(d.count) > MIN_BAR_WIDTH ? "end" : "start")
        .style("fill", d => xBar(d.count) > MIN_BAR_WIDTH ? "#ffffff" : "var(--text-muted)")
        .style("font-family", "var(--font-body)")
        .style("font-variant-numeric", "tabular-nums")
        .style("font-weight", "600")
        .style("font-size", "13px")
        .style("pointer-events", "none") 
        .text(d => d.count > 0 ? window.formatExoNumber(d.count) : "0");
    }

    document.getElementById("back-btn").addEventListener("click", () => {
        isShowingOther = false;
        d3.select("#back-btn").style("display", "none");
        updateBarChart();
    });

    // Timeline handles
    const handleGroup = timelineSvg.append("g").attr("class", "brush-handles");

    const brush = d3.brushX()
        .extent([[0, 0], [tWidth, tHeight]])
        .on("brush end", function(event) {
            if (!event.selection) {
                handleGroup.style("display", "none");
                currentFilteredData = data;
                updateBarChart();
                return;
            }
            
            const [x0, x1] = event.selection.map(xTime.invert);
            currentFilteredData = data.filter(d => d.disc_year >= Math.floor(x0) && d.disc_year <= Math.ceil(x1));
            updateBarChart();

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

    timelineSvg.append("g").attr("class", "brush").call(brush).call(brush.move, xTime.range());

    // Explorable text interactions
    d3.selectAll(".inline-action").on("click", function(event) {
        const btn = d3.select(this);
        const startYear = btn.attr("data-start");
        const endYear = btn.attr("data-end");
        
        if (startYear && endYear) {
            timelineSvg.select(".brush")
                .transition()
                .duration(750)
                .call(brush.move, [xTime(+startYear), xTime(+endYear)]);
        }
    });
}

if (window.globalExoplanetData && window.globalExoplanetData.length > 0) {
    buildInteractiveChart();
} else {
    document.addEventListener('dataLoaded', buildInteractiveChart);
}
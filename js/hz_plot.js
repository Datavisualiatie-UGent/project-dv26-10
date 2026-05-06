async function buildHZPlot() {
    const rawData = window.globalExoplanetData;
    if (!rawData || rawData.length === 0) return;

    // Data preparation
    const data = rawData
        .filter(d => d.st_teff && d.pl_orbsmax && !isNaN(d.st_teff) && !isNaN(d.pl_orbsmax) && +d.pl_orbsmax > 0)
        .map(d => ({
            temp: +d.st_teff,
            dist: +d.pl_orbsmax,
            name: d.pl_name
        }));

    const container = document.getElementById("hz-plot-container");
    if (!container) return;
    container.innerHTML = "";
    
    // Dimensions and lay-out
    const fullWidth = 900;
    const fullHeight = 450;
    const margin = { top: 40, right: 40, bottom: 60, left: 70 };
    const width = fullWidth - margin.left - margin.right;
    const height = fullHeight - margin.top - margin.bottom;

    const svg = d3.select("#hz-plot-container")
        .append("svg")
        .attr("viewBox", `0 0 ${fullWidth} ${fullHeight}`)
        .style("width", "100%")
        .style("height", "auto");

    svg.append("defs").append("clipPath")
        .attr("id", "hz-chart-clip")
        .append("rect")
        .attr("width", width)
        .attr("height", height);

    const g = svg.append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLog().domain([0.01, 10]).range([0, width]);
    const y = d3.scaleLinear().domain([2500, 7500]).range([height, 0]);

    // Habitable zone area
    const hzGenerator = d3.area()
        .x0(d => x(0.7 * Math.pow(d/5778, 2)))
        .x1(d => x(1.24 * Math.pow(d/5778, 2)))
        .y(d => y(d))
        .curve(d3.curveBasis);

    const temps = d3.range(2500, 7600, 100);
    
    g.append("path")
        .datum(temps)
        .attr("fill", "#10b981")
        .attr("opacity", 0.15)
        .attr("d", hzGenerator)
        .attr("clip-path", "url(#hz-chart-clip)"); // APPLY CLIPPING

    // Grid and axes
    g.append("g").attr("class", "grid").attr("opacity", 0.05)
        .call(d3.axisBottom(x).tickSize(height).tickFormat(""));
    
    const xAxis = g.append("g")
        .attr("transform", `translate(0,${height})`)
        .call(d3.axisBottom(x).ticks(5, ".2f"));

    const yAxis = g.append("g")
        .call(d3.axisLeft(y).ticks(5));

    [xAxis, yAxis].forEach(axis => {
        axis.selectAll("text")
            .style("font-family", "var(--font-body)")
            .style("fill", "var(--text-muted)");
        axis.select(".domain").attr("stroke", "var(--border-light)");
    });

    // Labels
    g.append("text").attr("x", width/2).attr("y", height + 45).attr("text-anchor", "middle")
        .style("font-family", "var(--font-heading)").style("font-size", "12px").style("font-weight", "700")
        .style("fill", "var(--text-muted)").text("Orbital distance (AU)");

    g.append("text").attr("transform", "rotate(-90)").attr("x", -height/2).attr("y", -50).attr("text-anchor", "middle")
        .style("font-family", "var(--font-heading)").style("font-size", "12px").style("font-weight", "700")
        .style("fill", "var(--text-muted)").text("Stellar temperature (Kelvin)");

    // Data points
    const dots = g.append("g")
        .attr("clip-path", "url(#hz-chart-clip)") // Clipping
        .selectAll("circle")
        .data(data).join("circle")
        .attr("cx", d => x(d.dist)).attr("cy", d => y(d.temp))
        .attr("r", 2.5).attr("fill", "var(--space-bottom)").attr("opacity", 0.3);

    // Reference planet
    const earthGroup = g.append("g").attr("clip-path", "url(#hz-chart-clip)");
    earthGroup.append("circle").attr("cx", x(1)).attr("cy", y(5778)).attr("r", 5).attr("fill", "none").attr("stroke", "var(--text-dark)").attr("stroke-width", 2);
    earthGroup.append("text").attr("x", x(1) + 8).attr("y", y(5778) + 4).style("font-size", "12px").style("font-weight", "800").text("Earth");

    // Explorable text interactions
    const highlight = (type) => {
        dots.transition().duration(300).style("opacity", d => {
            const inner = 0.7 * Math.pow(d.temp/5778, 2);
            const outer = 1.24 * Math.pow(d.temp/5778, 2);
            const isHZ = d.dist >= inner && d.dist <= outer;
            if (type === 'hz') return isHZ ? 0.8 : 0.05;
            if (type === 'hot') return d.dist < inner ? 0.8 : 0.05;
            return 0.4;
        }).attr("r", d => {
            const inner = 0.7 * Math.pow(d.temp/5778, 2);
            const isHZ = d.dist >= inner && d.dist <= 1.24 * Math.pow(d.temp/5778, 2);
            return (type === 'hz' && isHZ) || (type === 'hot' && d.dist < inner) ? 4 : 2.5;
        });
    };

    d3.selectAll(".hz-action")
        .on("mouseenter", function() { highlight(d3.select(this).attr("data-type")); })
        .on("mouseleave", () => { dots.transition().duration(300).style("opacity", 0.4).attr("r", 2.5); });
}

function startHZObserver() {
    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                buildHZPlot();
                obs.unobserve(entry.target);
            }
        });
    }, { rootMargin: "300px" });
    
    const el = document.getElementById("hz-plot-container");
    if (el) observer.observe(el);
}

if (window.globalExoplanetData) startHZObserver();
else document.addEventListener('dataLoaded', startHZObserver);
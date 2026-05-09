async function buildDensityPlot() {
    const rawData = window.globalExoplanetData;
    if (!rawData || rawData.length === 0) return;

    // Data preparation
    const normalizeMethod = (m) => {
        if (!m) return "Other";
        const lower = m.toLowerCase();
        if (lower.includes("transit")) return "Transit";
        if (lower.includes("radial")) return "Radial velocity";
        return "Other";
    };

    const data = rawData
        .filter(d => d.pl_orbper && !isNaN(d.pl_orbper) && +d.pl_orbper > 0)
        .map(d => ({
            method: normalizeMethod(d.discoverymethod),
            log_period: Math.log10(+d.pl_orbper)
        }));
    
    const groupPerMethod = d3.group(data, d => d.method);

    // Dimensions and lay-out
    const container = document.getElementById("density-plot-container");
    container.innerHTML = "";
    
    const fullWidth = 1050;
    const fullHeight = 450;
    const margin = { top: 40, right: 40, bottom: 60, left: 65 }; 
    const width = fullWidth - margin.left - margin.right;
    const height = fullHeight - margin.top - margin.bottom;

    const svg = d3.select("#density-plot-container")
        .append("svg")
        .attr("viewBox", `0 0 ${fullWidth} ${fullHeight}`)
        .style("width", "100%")
        .style("height", "auto")
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Kernel density estimator
    function densityEstimator(kernel, X) {
        return function(V) {
            return X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
        };
    }

    function kernelGaussian(sd) {
        return function(dist) {
            return (1 / (Math.sqrt(2 * Math.PI) * sd)) * Math.exp(-0.5 * (dist / sd) * (dist / sd));
        };
    }

    // Scales
    const minPeriod = d3.min(data, d => d.log_period);
    const maxPeriod = Math.min(d3.max(data, d => d.log_period), 5.5);

    const x = d3.scaleLinear()
        .domain([minPeriod, maxPeriod])
        .range([0, width]);

    const xTicks = x.ticks(150); 
    const kde = densityEstimator(kernelGaussian(0.15), xTicks); 

    const densities = Array.from(groupPerMethod, ([method, values]) => {
        if (method !== "Transit" && method !== "Radial velocity") return null;
        const logValues = values.map(d => d.log_period);
        return { method, density: kde(logValues) };
    }).filter(Boolean);

    const yMax = d3.max(densities, d => d3.max(d.density, p => p[1]));

    const y = d3.scaleLinear()
        .domain([0, yMax * 1.1]) 
        .range([height, 0]);

    // Draw density curves
    const colorScale = (method) => {
        if (method === "Transit") return "var(--color-transit)";
        if (method === "Radial velocity") return "var(--color-radial)";
        return "var(--color-other)";
    };

    const line = d3.line()
        .curve(d3.curveBasis)
        .x(p => x(p[0]))
        .y(p => y(p[1]));

    const areas = svg.selectAll(".density-area")
        .data(densities)
        .join("path")
        .attr("class", "density-area")
        .attr("data-method", d => d.method)
        .attr("fill", d => colorScale(d.method))
        .attr("opacity", 0.5)
        .attr("stroke", d => colorScale(d.method))
        .attr("stroke-width", 2)
        .attr("d", d => {
            const path = line(d.density);
            return `${path} L ${x(maxPeriod)} ${height} L ${x(minPeriod)} ${height} Z`;
        })
        .style("transition", "opacity 0.3s ease, filter 0.3s ease");

    // Interactive hover logic
    const highlightMethod = (targetMethod) => {
        svg.selectAll(".density-area").style("opacity", d => d.method === targetMethod ? 0.8 : 0.1);
        d3.selectAll(".density-action").style("opacity", function() {
            return d3.select(this).attr("data-method") === targetMethod ? 1 : 0.4;
        });
        svg.selectAll(".legend-row").style("opacity", d => d === targetMethod ? 1 : 0.4);
    };

    const resetHighlights = () => {
        svg.selectAll(".density-area").style("opacity", 0.5);
        d3.selectAll(".density-action").style("opacity", 1);
        svg.selectAll(".legend-row").style("opacity", 1);
    };

    // Explorable text interactions
    d3.selectAll(".density-action")
        .on("mouseenter", function() { highlightMethod(d3.select(this).attr("data-method")); })
        .on("mouseleave", resetHighlights);

    areas
        .on("mouseenter", function(event, d) { highlightMethod(d.method); })
        .on("mouseleave", resetHighlights);

    // Clean axes
    const formatDays = d => {
        const val = Math.pow(10, d);
        return window.formatExoNumber(val, val < 10 ? 1 : 0);
    };

    const gx = svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(d3.axisBottom(x).tickValues([-1, 0, 1, 2, 3, 4, 5]).tickFormat(formatDays).tickSizeOuter(0));
        
    gx.select(".domain").attr("stroke", "var(--border-light)");
    gx.selectAll(".tick line").attr("stroke", "var(--border-light)");
    gx.selectAll(".tick text").style("font-family", "var(--font-body)").style("font-variant-numeric", "tabular-nums").style("fill", "var(--text-muted)");

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
        .text("Orbital Period (days)");

    const gy = svg.append("g")
        .attr("transform", `translate(0, 0)`)
        .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(".2f")).tickSizeOuter(0));

    gy.select(".domain").attr("stroke", "var(--border-light)");
    gy.selectAll(".tick line").attr("stroke", "var(--border-light)");
    gy.selectAll(".tick text")
        .style("font-family", "var(--font-body)")
        .style("font-variant-numeric", "tabular-nums")
        .style("fill", "var(--text-muted)");

    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", `rotate(-90)`)
        .attr("x", -(height / 2))
        .attr("y", -45)
        .style("font-family", "var(--font-heading)")
        .style("font-size", "12px")
        .style("font-weight", "700")
        .style("text-transform", "uppercase")
        .style("letter-spacing", "1px")
        .style("fill", "var(--text-muted)")
        .text("Density");

    // Reference planets
    const referencePlanets = [
        { name: "Mercury", period: 88, align: "end" },
        { name: "Earth", period: 365, align: "start" },
        { name: "Neptune", period: 60195, align: "start" }
    ];

    const refGroup = svg.append("g").attr("class", "reference-planets");

    refGroup.selectAll("line")
        .data(referencePlanets)
        .join("line")
        .attr("x1", d => x(Math.log10(d.period)))
        .attr("x2", d => x(Math.log10(d.period)))
        .attr("y1", height)
        .attr("y2", 15) 
        .style("stroke", "var(--text-dark)")
        .style("stroke-width", 1.5)
        .style("stroke-dasharray", "4,4")
        .style("opacity", 0.5);

    refGroup.selectAll("text")
        .data(referencePlanets)
        .join("text")
        .attr("x", d => x(Math.log10(d.period)) + (d.align === "start" ? 6 : -6))
        .attr("y", 20)
        .attr("text-anchor", d => d.align)
        .style("font-family", "var(--font-body)")
        .style("font-size", "12px")
        .style("font-weight", "600")
        .style("fill", "var(--text-dark)")
        .text(d => `${d.name} (${window.formatExoNumber(d.period)} days)`);

    // Interactive legend
    const legendMethods = ["Transit", "Radial velocity"];
    
    const legend = svg.append("g")
        .attr("transform", `translate(10, 10)`);

    legend.append("rect")
        .attr("x", 0).attr("y", 0)
        .attr("width", 140).attr("height", 70)
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
        .attr("width", 130).attr("height", 24)
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
function initDensityWhenVisible() {
    const container = document.getElementById("density-plot-container");
    if (!container) return;

    const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                buildDensityPlot();
                obs.unobserve(entry.target); 
            }
        });
    }, { rootMargin: "300px 0px" });

    observer.observe(container);
}

if (window.globalExoplanetData && window.globalExoplanetData.length > 0) {
    initDensityWhenVisible();
} else {
    document.addEventListener('dataLoaded', initDensityWhenVisible);
}
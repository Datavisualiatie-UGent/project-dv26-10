/**
 * Builds a density plot of the log orbital period for the two main detection methods. 
 * Three reference planets (Mercury, Earth, Neptune) are added.
 */
async function buildDensityPlot() {
    const rawData = await getExoplanetData();
    if (!rawData || rawData.length === 0) return;

    // Data
    function normalizeMethod(method) {
        if (method !== "Transit" && method !== "Radial Velocity" && method !== "Microlensing" && method !== "Imaging") return "Other";
        return method;
    }

    const data = rawData
        .filter(d => d.pl_orbper && !isNaN(d.pl_orbper) && +d.pl_orbper > 0)
        .map(d => ({
            method: normalizeMethod(d.discoverymethod),
            log_period: Math.log10(+d.pl_orbper)
        }))
    
    const groupPerMethod = d3.group(data, d => d.method);

    // Space
    const container = document.getElementById("density-plot-container"); 
    const containerWidth = container.clientWidth;

    const margin = { top: 30, right: 40, bottom: 60, left: 60},
      width = containerWidth - margin.left - margin.right,
      height = 450 - margin.top - margin.bottom;

    const svg = d3.select("#density-plot-container")
        .append("svg")
        .attr("width", width + margin.left + margin.right)
        .attr("height", height + margin.top + margin.bottom)
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    // Density function: smoothing using Gaussian kernel 
    function densityEstimator(kernel, X) {
        return function(V) {
            return X.map(x => [x, d3.mean(V, v => kernel(x - v))]);
        };
    }

    function kernelGaussian(sd) {
        return function(dist) {
            return (1 / (Math.sqrt(2 * Math.PI) * sd)) *
                Math.exp(-0.5 * (dist / sd) * (dist / sd));
        };
    }

    // Scales for x-axis
    const minPeriod = d3.min(data, d => d.log_period);
    const maxPeriod = Math.min(d3.max(data, d => d.log_period),6.1); 

    const x = d3.scaleLinear()
        .domain([minPeriod, maxPeriod])
        .range([0, width]);

    // Calculate density
    const xTicks = x.ticks(150); 
    const kde = densityEstimator(kernelGaussian(0.07), xTicks);

    const densities = Array.from(groupPerMethod, ([method, values]) => {
        if (method !== "Transit" && method !== "Radial Velocity") return null;
        const logValues = values.map(d => d.log_period);
        return { method, density: kde(logValues) };
    }).filter(Boolean);

    // Scales for y-axis 
    const yMax = d3.max(densities, d =>
        d3.max(d.density, p => p[1])
    );

    const y = d3.scaleLinear()
        .domain([0, yMax])
        .range([height, 0]);

    // Picture
    const colorScale = (method) => {
        if (method === "Transit") return "var(--color-transit, #2563eb)";
        if (method === "Radial Velocity") return "var(--color-radial, #ea580c)";
        if (method === "Microlensing") return "var(--color-microlensing, #16a34a)";
        if (method === "Imaging") return "var(--color-imaging, #9333ea)";
        return "var(--color-other, #64748b)";
    };

    const newFormat = d => Number(Math.pow(10,d)).toLocaleString("en-GB", { maximumFractionDigits: 4 });

    const line = d3.line()
        .curve(d3.curveBasis)
        .x(p => x(p[0]))
        .y(p => y(p[1]));


    svg.selectAll(".density")
        .data(densities)
        .enter()
        .append("path")
        .attr("class", "density")
        .attr("fill", d => colorScale(d.method))
        .attr("opacity", 0.4)
        .attr("stroke", d => colorScale(d.method))
        .attr("stroke-width", 1.5)
        .attr("d", d => line(d.density)
        );

    svg.append("g")
        .call(d3.axisLeft(y));
    
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .style("fill", "var(--text-main, #333)")
        .style("font-size", "14px")
        .style("font-weight", "500")
        .text("Orbital Period (days)");
    
    svg.append("text")
        .attr("text-anchor", "middle")
        .attr("transform", "rotate(-90)")
        .attr("x", -height / 2)
        .attr("y", -45)
        .style("fill", "var(--text-main, #333)")
        .style("font-size", "14px")
        .style("font-weight", "500")
        .text("Density");
    
    
    svg.selectAll(".density")
        .on("mouseover", function() {
            d3.selectAll(".density").attr("opacity", 0.1);
            d3.select(this).attr("opacity", 0.8);
        })
        .on("mouseout", () => {
            d3.selectAll(".density").attr("opacity", 0.4);
        });

    const legendCategories = ["Transit", "Radial Velocity"];
    const legendX = width - 140;
    const legendY = height - 320;
    const legend = svg.append("g")
        .attr("transform", `translate(${legendX}, ${legendY})`);

    legend.append("rect")
        .attr("x", -10)
        .attr("y", -15)
        .attr("width", 130)
        .attr("height", legendCategories.length * 25 + 10)
        .attr("fill", "var(--container-bg, #ffffff)")
        .attr("opacity", 0.9)
        .attr("rx", 5)

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

    svg.append("g")
        .attr("transform", `translate(0, ${height})`)
        .call(
            d3.axisBottom(x)
                .tickValues(d3.range(Math.ceil(minPeriod), Math.floor(maxPeriod)))
                .tickFormat(newFormat)
        )
        .selectAll("text")
        .style("fill", "var(--text-main, #333)");

    const referencePlanets = [
        { name: "Mercury (88 days)", period: 88, dx: -30, dy : 10},
        { name: "Earth (365 days)", period: 365, dx: -30, dy : 70},
        { name: "Neptune (60,195 days)", period: 60195, dx: -30, dy : 140 }
    ];

    const refGroup = svg.append("g").attr("class", "reference-planets");

    refGroup.selectAll("line")
        .data(referencePlanets)
        .join("line")
        .attr("x1", d => x(Math.log10(d.period)))
        .attr("y1", height)
        .attr("x2", d => x(Math.log10(d.period)))
        .attr("y2", d => d.dy)
        .style("stroke", "var(--text-main, #333)")
        .style("stroke-width", 1.5)
        .style("stroke-dasharray", "4,4"); 


    refGroup.selectAll("text")
        .data(referencePlanets)
        .join("text")
        .attr("x", d => x(Math.log10(d.period)) + d.dx)
        .attr("y", d => d.dy - 10)
        .style("font-size", "13px")
        .style("font-weight", "bold")
        .style("fill", "var(--text-main, #333)")
        .text(d => d.name);
}

buildDensityPlot();
// Global variable definitions
var centeredState, xVals, yScale, chart;

// Define page, map, and detail boundaries and canvases
var margin = {
  top: 50,
  right: 50,
  bottom: 50,
  left: 50
};

var width = 1060 - margin.left - margin.right;
var height = 800 - margin.bottom - margin.top;

var bbVis = {
  x: 100,
  y: 10,
  w: width - 100,
  h: 300
};

var bbDetail = {
  x: 15,
  y: 25,
  w: 270,
  h: 120
};

var canvas = d3.select("#vis").append("svg").attr({
  width: width + margin.left + margin.right,
  height: height + margin.top + margin.bottom
})

var detailVis = d3.select("#detailVis").append("svg").attr({
  width:350,
  height:200
});

var svg = canvas.append("g").attr({
  transform: "translate(" + margin.left + "," + margin.top + ")"
});

// Set up tooltips
var tip = d3.tip()
  .attr('class', 'd3-tip')
  .offset([-8, 0])
  .html(function(d) {
    return "<table>" +
             "<tr><th>Station:</th><td>" + d.name + "</td></tr>" +
             "<tr><th>Light:</th><td>" + (stats[d.id] ? stats[d.id].sum : "no data") + "</td></tr>" +
           "</table>";
  });

svg.call(tip);

// Create the projection
var projection = d3.geo.albersUsa().translate([width / 2, height / 2]);
var path = d3.geo.path().projection(projection);

// Storage for data
var stats;
var stations = [];

// Draw the dots for the stations on the map
var drawStations = function() {
  svg.selectAll(".station")
    .data(stations)
    .enter().append("circle")
    .on("click", stationClicked)
    .on("mouseover", tip.show)
    .on("mouseout", tip.hide)
    .attr({
      class: function(d) { return "station" + (stats[d.id] ? " hasData" : "") },
      cx:    function(d) { return d.x; },
      cy:    function(d) { return d.y; },
      r:     function(d) {
        if (!stats[d.id]) return 2;
        return Math.sqrt(stats[d.id].sum)/2000;
      }
    });
}

// Load the station data
function loadStations() {
  d3.csv("../data/NSRDB_StationsMeta.csv",function(error,data){
    data.forEach(function(d) {
      var station = {
        id:   d["USAF"],
        name: d["STATION"],
        lon:  parseFloat(d["NSRDB_LON(dd)"]),
        lat:  parseFloat(d["NSRDB_LAT (dd)"])
      };
      var coord = projection([station.lon, station.lat]);
      if (coord) {
        station.x = coord[0];
        station.y = coord[1];
        stations.push(station);
      }
    });

    drawStations();
  });
}

// Load the light data
function loadStats() {
  d3.json("../data/reducedMonthStationHour2003_2004.json", function(error,data){
    stats = data;

    loadStations();
    createDetailVis();
  })
}

// Load the states and draw them
d3.json("../data/us-named.json", function(error, data) {
  var usMap = topojson.feature(data,data.objects.states).features

  svg.selectAll(".country")
    .data(usMap)
    .enter().append("path")
    .attr("class", "country")
    .attr("d", path)
    .on("click", stateClicked);

  loadStats();
});

// Create the detail visualization
var createDetailVis = function() {
  xVals = Object.keys(stats).map(function(station) {
    return Object.keys(stats[station].hourly);
  }).reduce(function(prev, curr) {
    return d3.set(prev.concat(curr)).values();
  }, []).sort();

  var yMax = d3.max(Object.keys(stats).map(function(station) {
    return d3.max(Object.keys(stats[station].hourly).map(function(hour) {
      return stats[station].hourly[hour];
    }));
  }));

  var xScale = d3.scale.ordinal().domain(xVals).rangeRoundBands([0, bbDetail.w]);
  yScale = d3.scale.linear().domain([0, yMax]).range([bbDetail.h, 0]);

  var xAxis = d3.svg.axis()
    .scale(xScale)
    .orient('bottom');

  var yAxis = d3.svg.axis()
    .scale(yScale)
    .orient('right');

  detailVis.append("g")
    .attr("transform", "translate(5,15)")
    .append("text")
      .attr("class", "detailTitle");

  detailVis.append("g")
    .attr("class", "x axis")
    .attr("transform", "translate(" + bbDetail.x + "," + (bbDetail.y + bbDetail.h) + ")")
    .call(xAxis)
    .selectAll("text")
    .style("text-anchor", "end")
    .attr("dx", "-.7em")
    .attr("dy", "0.1em")
    .attr("transform", function(d) {
      return "rotate(-70)"
    });

  detailVis.append("g")
    .attr("class", "y axis")
    .attr("transform", "translate(" + (bbDetail.x + bbDetail.w) + "," + bbDetail.y + ")")
    .call(yAxis);

  chart = detailVis.append("g")
    .attr({
      class: "chart",
      width: bbDetail.w,
      height: bbDetail.h,
      transform: "translate(" + bbDetail.x + "," + bbDetail.y + ")"
    });

  chart.selectAll(".bar")
    .data(xVals)
    .enter().append("rect")
    .attr({
      class:     "bar",
      transform: function(d) { return "translate(" + xScale(d) + ",0)"; },
      y:         bbDetail.h,
      height:    0,
      width:     xScale.rangeBand() - 1
    });
}

// Update the detail visualization to reflect a station
var updateDetailVis = function(station) {
  detailVis.select(".detailTitle")[0][0].innerHTML = station.name;

  chart.selectAll(".bar")
    .data(xVals.map(function(hour) {
      return { hour: hour, value: (stats[station.id] ? stats[station.id].hourly[hour] : 0) };
    }))
    .transition().duration(750)
      .attr({
        y:      function(d) { return yScale(d.value); },
        height: function(d) { return bbDetail.h - yScale(d.value); }
      });
}

// Click handlers
var stationClicked = function(d) {
  // Highlight the selected station
  svg.selectAll(".station")
    .classed("selected", function(e) { return d.id == e.id; });

  updateDetailVis(d);
}

function stateClicked(d) {
  if (d && centeredState !== d) {
    var centroid = path.centroid(d);
    centeredState = d;
    doZoom(centroid[0], centroid[1], 4);
  } else {
    resetZoom();
  }
}

// Zooming functions
function resetZoom() {
  centeredState = null;
  doZoom(width / 2, height / 2, 1);
}

function doZoom(x, y, k) {
  svg.selectAll("path")
    .classed("active", centeredState && function(d) { return d === centeredState; });

  svg.transition()
    .duration(750)
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")scale(" + k + ")translate(" + (margin.left - x) + "," + (margin.top - y) + ")")
    .style("stroke-width", 1.5 / k + "px");
}


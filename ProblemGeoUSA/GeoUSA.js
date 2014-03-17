var margin = {
  top: 50,
  right: 50,
  bottom: 50,
  left: 50
};

var width = 1060 - margin.left - margin.right;
var height = 800 - margin.bottom - margin.top;
var centered;

var bbVis = {
  x: 100,
  y: 10,
  w: width - 100,
  h: 300
};

var tooltip = d3.select("#tooltip");

var detailVis = d3.select("#detailVis").append("svg").attr({
  width:350,
  height:200
})

var canvas = d3.select("#vis").append("svg").attr({
  width: width + margin.left + margin.right,
  height: height + margin.top + margin.bottom
})

var svg = canvas.append("g").attr({
  transform: "translate(" + margin.left + "," + margin.top + ")"
});

var projection = d3.geo.albersUsa().translate([width / 2, height / 2]);//.precision(.1);
var path = d3.geo.path().projection(projection);

var stats;
var stations = [];

var drawStations = function() {
  svg.selectAll(".station")
    .data(stations)
    .enter().append("circle")
    .on("click", stationClicked)
    .on("mouseover", stationMouseOver)
    .on("mouseout", stationMouseOut)
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

function loadStats() {
  d3.json("../data/reducedMonthStationHour2003_2004.json", function(error,data){
    stats = data;

    loadStations();
  })
}

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

// ALL THESE FUNCTIONS are just a RECOMMENDATION !!!!
var createDetailVis = function() {

}

var updateDetailVis = function(data, name) {

}

function stationClicked(d) {
  // Highlight the selected station
  svg.selectAll(".station")
    .classed("selected", function(e) { return d.id == e.id; });

  // updateDetail
}

function stationMouseOver(d) {
  tooltip.select("#station").text(d.name);
  tooltip.select("#sum").text(stats[d.id] ? (stats[d.id].sum + " (100 lux)") : "no data");
  tooltip
    .style("left", (margin.left + Math.round(d.x)) + "px")
    .style("top", (margin.top + Math.round(d.y) + 20) + "px")
    .classed("hidden", false);
}

function stationMouseOut(d) {
  tooltip.classed("hidden", true);
}

// ZOOMING
function stateClicked(d) {
  // TODO: Fix tooltip on zoom in/out
  if (d && centered !== d) {
    var centroid = path.centroid(d);
    centered = d;
    doZoom(centroid[0], centroid[1], 4);
  } else {
    resetZoom();
  }
}

function doZoom(x, y, k) {
  svg.selectAll("path")
    .classed("active", centered && function(d) { return d === centered; });

  svg.transition()
    .duration(750)
    .attr("transform", "translate(" + width / 2 + "," + height / 2 + ")scale(" + k + ")translate(" + -x + "," + -y + ")")
    .style("stroke-width", 1.5 / k + "px");
}

function resetZoom() {
  centered = null;
  doZoom(width / 2, height / 2, 1);
}


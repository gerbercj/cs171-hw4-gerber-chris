var margin = {
  top: 50,
  right: 50,
  bottom: 50,
  left: 50
};

var width = 960 - margin.left - margin.right;
var height = 700 - margin.bottom - margin.top;

var bbVis = {
  x: 100,
  y: 10,
  w: width - 100,
  h: 300
};

var svg = d3.select("#vis").append("svg").attr({
  width: width + margin.left + margin.right,
  height: height + margin.top + margin.bottom
}).append("g").attr({
  transform: "translate(" + margin.left + "," + margin.top + ")"
});

var projectionMethods = [
  {
    name: "mercator", method: d3.geo.mercator().translate([width / 2, height / 2])//.precision(.1);
  }, {
    name: "equiRect", method: d3.geo.equirectangular().translate([width / 2, height / 2])//.precision(.1);
  }, {
    name: "stereo", method: d3.geo.stereographic().translate([width / 2, height / 2])//.precision(.1);
  }
];

var actualProjectionMethod = 0;
var selectedIndicator, selectedYear;
var colorMin = colorbrewer.Greens[3][0];
var colorMax = colorbrewer.Greens[3][2];

var path = d3.geo.path().projection(projectionMethods[0].method);

function runAQueryOn(indicator, year) {
  $.ajax({
    url: "http://api.worldbank.org/countries/all/indicators/" + indicator + "?format=jsonP&prefix=getdata&per_page=500&date=" + year + ":" + year,
    jsonpCallback: 'getdata',
    dataType: 'jsonp',
    success: function (data, status){
      // transform data
      var dataSet = data[1].map(function(d) {
        return { country: d.country.id, value: d.value };
      });
      var dataSetExtent = d3.extent(dataSet.map(function(d) {
        return d.value;
      }));

      // generate scale
      var scale = d3.scale.linear().domain(dataSetExtent).range([colorMin, colorMax]);

      // update graph colors
      svg.selectAll(".country")
        .data(dataSet)
        .transition().duration(750)
          .style("fill", function(d) { return scale(d.value); });
    }
  });
}

var initVis = function(error, indicators, world) {
  // create drop-down list of indicators
  d3.select("#selector").append("select")
    .on("change", changeIndicator)
    .selectAll("option")
      .data(indicators)
      .enter().append("option")
        .attr("value", function(d) { return d.IndicatorCode; })
        .text(function(d) { return d.IndicatorName; });
  selectedIndicator = indicators[0].IndicatorCode;

  // create drop-down list of years
  // TODO: Can we get the range programatically?
  d3.select("#selectorYear").append("select")
    .on("change", changeYear)
    .selectAll("option")
    .data(d3.range(1960,2014))
    .enter().append("option")
      .attr("value", function(d) { return d; })
      .text(function(d) { return d; });
  selectedYear = 1960;

  // create map
  console.log(world);
  var countries = world.features;
  svg.selectAll(".country")
    .data(countries)
    .enter().append("path")
      .attr({
        class: "country",
        d: path
      });
}

queue()
  .defer(d3.csv,"../data/worldBank_indicators.csv")
  .defer(d3.json,"../data/world_data.json")
  // .defer(d3.json,"../data/WorldBankCountries.json")
  .await(initVis);

var textLabel = svg.append("text").text(projectionMethods[actualProjectionMethod].name).attr({
  transform: "translate(-40,-30)"
})

var changeIndicator = function() {
  selectedIndicator = d3.event.target.value;
  console.log("indicator:", selectedIndicator);
  runAQueryOn(selectedIndicator, selectedYear);
}

var changeYear = function() {
  selectedYear = d3.event.target.value;
  console.log("year:", selectedYear);
  runAQueryOn(selectedIndicator, selectedYear);
}

var changePro = function() {
  actualProjectionMethod = (actualProjectionMethod+1) % (projectionMethods.length);

  textLabel.text(projectionMethods[actualProjectionMethod].name);
  path = d3.geo.path().projection(projectionMethods[actualProjectionMethod].method);
  svg.selectAll(".country").transition().duration(750).attr("d",path);
};

d3.select("body").append("button").text("Change Projection").on({
  click: changePro
})


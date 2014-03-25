// configure the page layout
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

// create variables for the drawing regions
var svg = d3.select("#vis").append("svg").attr({
  width: width + margin.left + margin.right,
  height: height + margin.top + margin.bottom
}).append("g").attr({
  transform: "translate(" + margin.left + "," + margin.top + ")"
});
var legend = svg.append("g");
var textLabel = d3.select("#textLabel");

// create an array of projection types
var projectionMethods = [
  {
    name: "mercator", method: d3.geo.mercator().translate([width / 2, height / 2])
  }, {
    name: "equiRect", method: d3.geo.equirectangular().translate([width / 2, height / 2])
  }, {
    name: "stereo", method: d3.geo.stereographic().translate([width / 2, height / 2])
  }
];

// configure global variables
var actualProjectionMethod = 0;
var selectedIndicator, selectedYear;
var colorMin = colorbrewer.Greens[3][0];
var colorMax = colorbrewer.Greens[3][2];

var countries, codes={}, countryDetails={};

var path = d3.geo.path().projection(projectionMethods[0].method);

// helpers to update the detail text
var updateTextLabel = function(country) {
  var detailHtml = "";
  if (country != "") {
    var details = countryDetails[country];
    var value = countries.reduce(function(prev, curr) {
      if (codes[curr.id] == country) return curr.value;
      return prev;
    }, NaN);

    detailHtml = "<h1>" + details.name + "</h1>";

    if (!isNaN(value)) detailHtml += "<h2>Value: " + Math.round(value).toLocaleString() + "</h2>";

    detailHtml +=
      "<table><tbody>" +
      "  <tr><th>Region:</th><td>" + details.region.value + "</td>" +
      "  <tr><th>Latitude:</th><td>" + details.latitude + "</td>" +
      "  <tr><th>Longitude:</th><td>" + details.longitude + "</td>" +
      "  <tr><th>Capital:</th><td>" + details.capitalCity + "</td>" +
      "  <tr><th>Income Level:</th><td>" + details.incomeLevel.value + "</td>" +
      "  <tr><th>Lending Type:</th><td>" + details.lendingType.value + "</td>" +
      "</tbody></table>"
  }

  textLabel.html(detailHtml);
}

function queryCountry(country) {
  // use a cached result if we have it
  if (countryDetails[country]) {
    updateTextLabel(country);
  } else {
    $.ajax({
      url: "http://api.worldbank.org/countries/" + country + "?format=jsonP&prefix=getcountry&per_page=500",
      jsonpCallback: 'getcountry',
      dataType: 'jsonp',
      success: function (data, status){
        if (data[1]) {
          countryDetails[country] = data[1][0];
          updateTextLabel(country);
        } else {
          updateTextLabel("");
        }
      }
    });
  }
}

// query indicator data for year from World Bank
function queryIndicator(indicator, year) {
  $.ajax({
    url: "http://api.worldbank.org/countries/all/indicators/" + indicator + "?format=jsonP&prefix=getindicator&per_page=500&date=" + year + ":" + year,
    jsonpCallback: 'getindicator',
    dataType: 'jsonp',
    success: function (data, status){
      // transform data
      var dataSet = {};

      // make an associative array of country => value
      data[1].forEach(function(d) {
        dataSet[d.country.id] = parseFloat(d.value);
      });

      // update countries with values
      countries = countries.map(function(country) {
        country.value = dataSet[codes[country.id]];
        return country;
      });

      // determine value range for color scale
      var dataSetExtent = d3.extent(countries.map(function(country) {
        return country.value;
      }));

      // generate scale
      var scale = d3.scale.linear().domain(dataSetExtent).range([colorMin, colorMax]);

      // update legend labels
      d3.select("#minVal").text(Math.round(dataSetExtent[0]).toLocaleString());
      d3.select("#maxVal").text(Math.round(dataSetExtent[1]).toLocaleString());

      // update details
      updateTextLabel("");

      // update graph colors
      svg.selectAll(".country")
        .data(countries)
        .transition().duration(750)
          .attr("d", path)
          .style("fill", function(d) { if (d.value) return scale(d.value); return "lightgray"; });
    }
  });
}

// configure the basic visualization
var initVis = function(error, indicators, world, country_codes) {
  // create a dictionary of country codes
  country_codes.forEach(function(d) {
    codes[d["Alpha-3 code"]] = d["Alpha-2 code"];
  });

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
  countries = world.features;
  svg.selectAll(".country")
    .data(countries)
    .enter().append("path")
      .attr({
        class: "country",
        d: path
      })
      .style("fill", "lightgray")
      .on("click", countryClicked);

  // configure legend
  gradient = legend.append("defs").append("linearGradient")
    .attr({
      id: "gradient",
      x1: "0%",
      y1: "0%",
      x2: "0%",
      y2: "100%",
      spreadMethod: "pad"
    });

  gradient.append("stop")
      .attr({
        offset: "0%",
        "stop-color": colorMax,
        "stop-opacity": 1
      });

  gradient.append("stop")
      .attr({
        offset: "100%",
        "stop-color": colorMin,
        "stop-opacity": 1
      });

  legend.append("rect")
    .attr({
      x: 0,
      y: 330,
      width: 20,
      height: 200
    })
    .style("fill", "url(#gradient)");

  legend.append("text")
    .attr({
      id: "maxVal",
      x: 25,
      y: 334
    })
    .text("");

  legend.append("text")
    .attr({
      id: "minVal",
      x: 25,
      y: 534
    })
    .text("");
}

// load all of the data files and process them
queue()
  .defer(d3.csv,"../data/worldBank_indicators.csv")
  .defer(d3.json,"../data/world_data.json")
  // the following data is from: https://gist.github.com/jeremybuis/4997305
  // and from: http://www.freeformatter.com/iso-country-list-html-select.html
  .defer(d3.json,"../data/wikipedia-iso-country-codes.json")
  .await(initVis);

// show the projection type on the map
var projectionLabel = svg.append("text").text(projectionMethods[actualProjectionMethod].name).attr({
  transform: "translate(-40,-30)"
})

// handle interactions
var countryClicked = function(d) {
  queryCountry(codes[d.id]);
}

var changeIndicator = function() {
  selectedIndicator = d3.event.target.value;
  console.log("indicator:", selectedIndicator);
  queryIndicator(selectedIndicator, selectedYear);
}

var changeYear = function() {
  selectedYear = d3.event.target.value;
  console.log("year:", selectedYear);
  queryIndicator(selectedIndicator, selectedYear);
}

var changePro = function() {
  actualProjectionMethod = (actualProjectionMethod+1) % (projectionMethods.length);

  projectionLabel.text(projectionMethods[actualProjectionMethod].name);
  path = d3.geo.path().projection(projectionMethods[actualProjectionMethod].method);
  svg.selectAll(".country")
    .transition().duration(750)
      .attr("d", path);
};

d3.select("body").append("button").text("Change Projection").on({
  click: changePro
})


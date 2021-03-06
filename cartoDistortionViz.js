var step = 1;

var fs = require('fs');

var path = process.argv[2];
var photosPath = process.argv[3];
var densityGridSize = parseInt(process.argv[4]);
var svgFilename = process.argv[5];
var photosDistortedFilename = process.argv[6];

var gridSize = densityGridSize + 1;

var scale = 1024 / gridSize;

var photos = JSON.parse(fs.readFileSync(photosPath, 'utf-8'));
  var latLngLeft   = photos.map(function(p){ return p.lon; }).reduce(function(a, b) { return a < b ? a : b; });
  var latLngRight  = photos.map(function(p){ return p.lon; }).reduce(function(a, b) { return a > b ? a : b; });
  var latLngBottom = photos.map(function(p){ return p.lat; }).reduce(function(a, b) { return a < b ? a : b; });
  var latLngTop    = photos.map(function(p){ return p.lat; }).reduce(function(a, b) { return a > b ? a : b; });
  //process.stderr.write('bounds', left, right, bottom, top);

  var latLngWidth  = latLngRight - latLngLeft,
      latLngHeight = latLngTop - latLngBottom;

  var latLngAspect = latLngWidth / latLngHeight;
  //process.stderr.write('aspect', aspect);

  var gridLeft = 0,
      gridBottom = 0,
      gridRight = gridSize-1,
      gridTop = gridSize-1

function vecSub(v1, v2) {
  return [
    v1[0] - v2[0],
    v1[1] - v2[1]
  ];
}

function vecAdd(v1, v2) {
  return [
    v1[0] + v2[0],
    v1[1] + v2[1]
  ];
}

function vecScale(v, s) {
  return [
    s * v[0],
    s * v[1]
  ];
}

fs.readFile(path, 'utf-8', function(err, str) {
  var entries = str.split('\n');
  entries = entries.slice(0, entries.length-1);
  var points = entries.map(function(entry){
    return entry.split(' ').map(parseFloat);
  });

  var grid = new Array(gridSize);
  for(var x = 0; x < gridSize; x++)
    grid[x] = new Array(gridSize);
  var p = 0;
  for(var r = 0; r < gridSize; r++) {
    for(var c = 0; c < gridSize; c++) {
      grid[c][r] = points[p];
      p++;
    }
  }

  var svgStr = '<svg xmlns="http://www.w3.org/2000/svg" version="1.1" width="'+scale*gridSize+'" height="'+scale*gridSize+'">';
  
  for(var x = 0; x < gridSize; x += step) {
    svgStr += '<polyline fill="none" stroke="black" stroke-width="0.4px" points="';
    for(var y = 0; y < gridSize; y += step) {
      var p = grid[x][y]; 
      svgStr += scale*p[0] + ',' + scale*(gridSize - 1 - p[1]) + ' ';
      //console.log('<rect x="'+p[0]+'" y="'+(1024-p[1])+'" width="1" height="1" fill="black" stroke="none"/>');
    }
    svgStr += '"/>\n';
  }
  for(var y = 0; y < gridSize; y += step) {
    svgStr += '<polyline fill="none" stroke="black" stroke-width="0.4px" points="';
    for(var x = 0; x < gridSize; x += step) {
      var p = grid[x][y]; 
      svgStr += scale*p[0] + ',' + scale*(gridSize - 1 - p[1]) + ' ';
      //console.log('<rect x="'+p[0]+'" y="'+(1024-p[1])+'" width="1" height="1" fill="black" stroke="none"/>');
    }
    svgStr += '"/>\n';
  }

  var project = function(pt){
  
    var normalX = (pt[0] - latLngLeft)   / latLngWidth,
        normalY = (pt[1] - latLngBottom) / latLngHeight;

    var gridX = normalX * densityGridSize,
        gridY = normalY * densityGridSize;

    var left   = Math.max(Math.floor(gridX), 0),
        right  = Math.min(left + 1, gridSize-1),
        bottom = Math.max(Math.floor(gridY), 0),
        top    = Math.min(bottom + 1, gridSize-1);
    var xFraction = gridX - left;
    var yFraction = gridY - bottom;

    var sw = grid[left][bottom];
    var nw = grid[left][top];
    var se = grid[right][bottom];
    var ne = grid[right][top];

    var swToSe = vecSub(se, sw);
    var nwToNe = vecSub(ne, nw);
    var s = vecAdd(sw, vecScale(swToSe, xFraction));
    var n = vecAdd(nw, vecScale(nwToNe, xFraction));
    var sToN = vecSub(n, s);

    var swToNw = vecSub(nw, sw);
    var seToNe = vecSub(ne, se);
    var w = vecAdd(sw, vecScale(swToNw, yFraction));
    var e = vecAdd(se, vecScale(seToNe, yFraction));

    var projectedPt = vecAdd(s, vecScale(sToN, yFraction));

    return projectedPt;
  };
  
  var rectSize = 3.0;
  photos.forEach(function(p){
    var pt = project([p.lon, p.lat]);
    p.lon = pt[0];
    p.lat = pt[1];
    /* FIXME -1 here? */
    svgStr += '<rect x="'+(scale*pt[0]-rectSize/2.0)+'" y="'+(scale*(gridSize - 1 - pt[1])-rectSize/2.0)+'" width="'+rectSize+'" height="'+rectSize+'" fill="red" stroke="none"/>';
  });

  svgStr += '</svg>';
  fs.writeFile(svgFilename, svgStr);

  fs.writeFile(photosDistortedFilename, JSON.stringify(photos));

});

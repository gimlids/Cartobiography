var im = require('imagemagick'),
    fs = require('fs'),
    path = require('path'),
    async = require('async');

var geoPhotos = [];
function loadGeoPhotoWorker(path, done)
{
  im.readMetadata(path, function(err, metadata){
    if (err) throw err;
    
    // gpsLatitude: '39/1, 4419/100, 0/1',
    // gpsLatitudeRef: 'N',
    // gpsLongitude: '75/1, 3267/100, 0/1',
    // gpsLongitudeRef: 'W',
    
    if(metadata.exif.gpsLatitude === undefined) {
      done();
      return;
    }

    var location = [metadata.exif.gpsLatitude, metadata.exif.gpsLongitude].map(function(str){
      var parts = str.split(',');
      var degrees = parseInt(parts[0].split('/')[0]);
      var minutesFraction = parts[1].split('/').map(function(n){return parseInt(n); });
      var minutes = minutesFraction[0] / minutesFraction[1];
      degrees += minutes / 60;
      return degrees;
    });
    if(metadata.exif.gpsLatitudeRef == 'S')
      location[0] *= -1;
    if(metadata.exif.gpsLongitudeRef == 'W')
      location[1] *= -1;
  
    geoPhotos.push({
      'path' : path,
      'lon' : location[1],
      'lat' : location[0],
      't' : metadata.exif.dateTime ? metadata.exif.dateTime.getTime() / 1000 : undefined
    });

    done();
  });
}

var dir = process.argv[2];

fs.readdir(dir, function(err, files) {
  jpgs = files.filter(function(file) { return /jpg/i.test(file); });
  jpgs = jpgs.map(function(file) { return path.join(dir, file); });
  
  var q = async.queue(loadGeoPhotoWorker, 32);
  q.drain = function() {
    process.stderr.write("\n");
    process.stdout.write(JSON.stringify(geoPhotos));
  };

  var count = jpgs.length;
  var done = 0;
  jpgs.forEach(function(path) {
    q.push(path, function(err) {
      done++;
      process.stderr.write("\r" + done + ' / ' + count);
    });
  });

});

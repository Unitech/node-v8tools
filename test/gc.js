var v8tools = require('../build/Release/v8tools.node');

v8tools.afterGC(function(gcType, gcFlags, usedHeapSize) {
  console.log('GC Type', gcType);
  console.log('GC Flags', gcFlags);
  console.log('Used Heap Size', usedHeapSize);
});

setInterval(function() {
  for(var i = 0; i < 1000; i++) {
    new Object();
  }
}, 2000);


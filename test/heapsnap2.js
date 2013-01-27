var v8tools = require('../build/Release/v8tools.node');


var bbb1 = {bbb2: []};
var bbb3 = {bbb4: ""};

for(var i = 0; i < 10000; i++) {
  bbb1.bbb2[i] = {bbb7: "asdfasdfasdffdasfasdfkasldfkjasldjkfhalsdjfhalskdjfhalskdjfhaslkdjfhaslkdjfhaslkdfjhasldkfjhasdlfkjhasdflkjadshf" + i};
  bbb3.bbb4 += "str";
}

function edgeTypeToString(type) {
  switch(type) {
    case 0: 
      return 'variable';
    case 1: 
      return 'element';
    case 2: 
      return 'property';
    case 3: 
      return 'internal';
    case 4: 
      return 'hidden';
    case 5: 
      return 'shortcut';
    case 6:
      return 'weak';
    default:
      return 'other';
  }
}

function nodeTypeToString(type) {
  switch(type) {
    case 0: 
      return 'hidden';
    case 1: 
      return 'array';
    case 2: 
      return 'string';
    case 3: 
      return 'object';
    case 4: 
      return 'compiled code';
    case 5: 
      return 'function clojure';
    case 6: 
      return 'regexp';
    case 7: 
      return 'heap number';
    case 7: 
      return 'native object';
    default:
      return 'other';
  }
}

var seen = {};
var stats = {};
var totalSize = 0;
var totalCount = 0;


var nodes = {};
var root;
v8tools.takeHeapSnapshot(function(parentNodeUid, nodeUid, name, type, selfSize, retainerName, retainerType) {
  if(retainerType === 5) return;

  var node = nodes[nodeUid];
  if(!node) {
    node = nodes[nodeUid] = {
      parentNodeUid: parentNodeUid,
      nodeUid: nodeUid,
      name: name,
      type: type,
      selfSize: selfSize,
      retainerName: retainerName,
      retainerType: retainerType,
      retainedSize: 0,
      children: []
    }
  }
   
  if(parentNodeUid && !node.parentNodeUid) {
    node.parentNodeUid = parentNodeUid;
  }

  if(parentNodeUid) {
    var parentNode = nodes[parentNodeUid];
    if(parentNode) parentNode.children.push(node);
  }
});


function calculateRetainedSize(depth, walked, node) {
  if(depth++ > 1000) return 0;
 
  if(walked[node.nodeUid]) return 0;
  walked[node.nodeUid] = true;

  var retainedSize = node.selfSize;

  node.children.forEach(function(childNode) {
    retainedSize += calculateRetainedSize(depth + 1, walked, childNode);
  });

  return retainedSize;
}

var walked = {};
for(var prop in nodes) {
  var node = nodes[prop];
  if(node.retainerType) {
    var key = node.retainerType + ':' + node.retainerName;
    walked[key] || (walked[key] = {});

    var retainedSize = calculateRetainedSize(0, walked[key], node);

    if(!stats[key]) {
      stats[key] = {
        type: edgeTypeToString(node.retainerType),
        name: node.retainerName,
        size: 0, 
        count: 0,
        sizePercentage: 0,
        countPercentage: 0
      };
    }

    stats[key].size += retainedSize;
    stats[key].count++;
  }

  totalSize += node.selfSize;
  totalCount++; 
}


var statsOrdered = [];
for(var key in stats) {
  var obj = stats[key];
  if(totalSize > 0) obj.sizePercentage = Math.round((obj.size / totalSize) * 100);
  if(totalCount > 0) obj.countPercentage = Math.round((obj.count / totalCount) * 100);

  statsOrdered.push(stats[key]);
}

statsOrdered = statsOrdered.sort(function(a, b) {
  return b.size - a.size;
});

console.log(statsOrdered.slice(0, 10));
//console.log(statsOrdered);



var v8tools = require('/usr/local/node-v8tools/build/Release/v8tools.node');


var bbb1 = {bbb2: []};
var bbb3 = {bbb4: "aa"};

for(var i = 0; i < 30000; i++) {
  bbb1.bbb2[i] = {bbb7: "asdfasdfasdffdasfasdfkasldfkjasldjkfhalsdjfhalskdjfhalskdjfhaslkdjfhaslkdjfhaslkdfjhasldkfjhasdlfkjhasjhalsdkjfhasldkjfhalsdkjfhaslfaslkjdfhalskdjfhalsdjkfhalsdjkfhalsdkjfhalsdjkhfalsdkjfhalsdkjfhalsdkjfhalsdkjfhaalsdkjfhasjdfhalskdjfhalskdjfhalsdkjfhasldkjfhasldkjfhasdlkfjhdflkjadshf" + i};
  bbb3.bbb4 += "stasdfasdklfjhasldkjfhalsdkjfhasldkfjhasdlkfjhasdlkfjhasldfkjhasldkfjhasldkfjhasldkjfhalskdjfhaslkdjfhalskdjfhar" + i;
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



function calculateRetainedSize(depth, walked, node) {
  if(depth++ > 1000) return 0;
  walked[node.nodeUid] = true;

  node.retainedSize += node.selfSize;

  node.children.forEach(function(childNode) {
    if(walked[childNode.nodeUid] || childNode.retainersCount > 1) return;

    if(!childNode.retainedSize) {
      calculateRetainedSize(depth + 1, walked, childNode);
    }

    node.retainedSize += childNode.retainedSize;
  });
}


function genKey(node) {
  if(node.retainerType == 0 || node.retainerType == 2) {
    return edgeTypeToString(node.retainerType) + ':' + node.retainerName;
  }
  else {
    return edgeTypeToString(node.retainerType);
  }
}


function genGroupLabel(node) {
  switch(node.retainerType) {
    case 0: 
      return 'Variable: ' + node.retainerName;
    case 1: 
      return 'Array elements';
    case 2: 
      return 'Property: ' + node.retainerName;
    case 4: 
      return 'Hidden links';
    case 6:
      return 'Weak references';
    default:
      return 'Other';
  }
}

function truncate(obj) {
  if(!obj) return undefined;
  
  if(typeof(obj) === 'string') {
    if(obj.length > 25) {
      return obj.substring(0, 25) + '...';
    }
    else {
      return obj;
    }
  }
  else if(typeof(obj) === 'number') {
    return obj;
  }
}


function genNodeLabel(node) {
  var name = truncate(node.name);
  return nodeTypeToString(node.type) + (name ? (": " + name) : "");
}


var takeHeapSnapshot = function() {
  var seen = {};
  var groups = {};
  var totalSize = 0;
  var totalCount = 0;

  var nodes = {};
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
        retainersCount: 0,
        children: []
      }
    }
   
    if(parentNodeUid && !node.parentNodeUid) {
      node.parentNodeUid = parentNodeUid;
    }

    if(parentNodeUid) {
      var parentNode = nodes[parentNodeUid];
      if(parentNode) {
        parentNode.children.push(node);
        node.retainersCount++;
      }
    }
  });


  for(var prop in nodes) {
    var node = nodes[prop];
    if(node.retainerType && node.retainerType !== 3) {
      if(!node.retainedSize) calculateRetainedSize(0, {}, node);

      var key = genKey(node);
      var obj = groups[key];
      if(!obj) {
        obj = groups[key] = {
          _label: genGroupLabel(node),
          size: 0, 
          count: 0,
          instances: []
        };
      }

      obj.size += node.retainedSize;
      obj.count++;

      obj.instances.push({
        _label: genNodeLabel(node),
        _retainedSize: node.retainedSize,
        'Id': node.nodeUid,
        'Name': truncate(node.name),
        'Type': nodeTypeToString(node.type),
        'Self size (KB)': (node.selfSize / 1024).toFixed(3),
        'Retained size (KB)': (node.retainedSize / 1024).toFixed(3)
      });
    }

    totalSize += node.selfSize;
    totalCount++; 
  }

  // sort groups
  var groupsOrdered = [];
  for(var key in groups) {
    groupsOrdered.push(groups[key]);
  }
  groupsOrdered = groupsOrdered.sort(function(a, b) {
    return b.size - a.size;
  });
  groupsOrdered = groupsOrdered.slice(0, 100);


  // prepare for rendering
  for(var key in groups) {
    var obj = groups[key];

    obj.instances = obj.instances.sort(function(a, b) {
      return b._retainedSize - a._retainedSize;
    });
    obj.instances = obj.instances.slice(0, 10);

    obj['Size (KB)'] = obj.size;
    if(totalSize > 0) obj['Size %'] = Math.round((obj.size / totalSize) * 100);

    obj['Count'] = obj.count;
    if(totalCount > 0) obj['Count %'] = Math.round((obj.count / totalCount) * 100);

    obj['Largest instances'] = obj.instances;
    
    delete obj.size;
    delete obj.count;
    delete obj.instances;
  }

  console.log(require('util').inspect(groupsOrdered, true, 20, true));
  //console.log(groupsOrdered);
};

takeHeapSnapshot();


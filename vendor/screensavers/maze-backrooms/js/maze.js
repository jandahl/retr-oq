"use strict";

/**
  Andrew Jobson
  Generate a maze of the given dimensions. The returned maze is an object:
  {
    form:{
      rows:<the number of rows>
      cols:<the number of cols>
      start:<the randomly selected start>
      goal:<the randomly selected goal>
      h:<a 2 dimensional array representing the positions of the openings on the horizonal lines>
      v:<a 2 dimensional array representing the positions of the openings on the vertical lines>
    }
    path:<array of coordinates passed through when solving the maze>
  }
  adapted from code found at:
  http://rosettacode.org/wiki/Maze_generation#JavaScript
  on: 28th Sept 2014
*/
function Maze(rows, cols){
  var _this = this;
  
  _this.form = {
      rows:rows || 5,
      cols:cols || 5,
      h:[],
      v:[]
    };
  
  _this.path = [];
  
  init();
  
  /**
    Generate the maze
  */
  function init(){
    //size of the grid minus the start position
    var cellsLeft = (_this.form.rows * _this.form.cols - 1);
    
    //arrays representing the presence of openings in the horizontal and vertical
    //i.e. the lines between cells (n - 1). assume solid wall around the whole thing
    for(var r = 0; r < _this.form.rows-1; r++) _this.form.h[r] = [];
    for(var c = 0; c < _this.form.cols-1; c++) _this.form.v[c] = [];
    
    //at first we've not visited anything
    var visited = [];
    for(var r = 0; r < _this.form.rows; r++){
      var a = [];
      for(var c = 0; c < _this.form.cols; c++)
        a.push(false);
      visited.push(a);
    }
    
    //choose a random starting position for generating the maze
    var path = [];
    var loc = [Math.floor(Math.random() * _this.form.rows), Math.floor(Math.random() * _this.form.cols)];
    visited[loc[0]][loc[1]] = true;
    path.push(loc);
    
    //while there are still cells to visit
    while(cellsLeft > 0){
      //find all the neighbors that haven't been visited
      var n = [];
      if((loc[1] - 1 >= 0) && !visited[loc[0]][loc[1]-1]) n.push([loc[0],loc[1]-1]);
      if((loc[0] + 1 < visited.length) && !visited[loc[0]+1][loc[1]]) n.push([loc[0]+1,loc[1]]);
      if((loc[1] + 1 < visited[0].length) && !visited[loc[0]][loc[1]+1]) n.push([loc[0],loc[1]+1]);
      if((loc[0] - 1 >= 0) && !visited[loc[0]-1][loc[1]]) n.push([loc[0]-1,loc[1]]);

      //if there is at least one unvisited neighbor
      if(n.length){
        var old = loc;
        loc = n[Math.floor(Math.random() * n.length)];
        visited[loc[0]][loc[1]] = true;
        
        //mark it as an opening
        if(old[0] == loc[0]){
          _this.form.v[(old[1] + loc[1]-1)/2][loc[0]] = true;
        }else{
          _this.form.h[(loc[0]+old[0]-1)/2][loc[1]] = true;
        }

        path.push(loc);
        cellsLeft--;
      }else{
        //there are no valid neighbors, go backwards up the path
        loc = path.pop();
      }
    }
    
	/*_this.form.start = 
    _this.form.goal = [Math.floor(Math.random() * _this.form.rows), Math.floor(Math.random() * _this.form.cols)];*/
    solve();
  }

  /**
    given a 'board' from 'generateBoard' this will choose a random 'dead end' for both the start and the finish of the maze
  */
  function getStartFinish(b){
    var de = [];
	  for(var r = 0; r < _this.form.rows; r++){
      for(var c = 0; c < _this.form.cols; c++){
        if(b[r][c].exits.length == 1) de.push([r,c]);
      }
	  }
    
    var j, x, i;
    for(i = de.length; i; i -= 1){
      j = Math.floor(Math.random() * i);
      x = de[i - 1];
      de[i - 1] = de[j];
      de[j] = x;
    }
    
    _this.form.start = de[0];
    _this.form.goal = de[1];
  }
	
  /**
    represent each cell in the maze like this:
    {
      visits:0,
      exits:[[],[],...]
    }
  */
  function generateBoard(){
    var board = [];
    for(var r = 0; r < _this.form.rows; r++){
      board[r] = [];
      for(var c = 0; c < _this.form.cols; c++){
        board[r][c] = [];
        var pos = [r,c];
        var cell = {
          visits:0,
          exits:[]
        };
        
        if((pos[0] - 1 >= 0) && _this.form.h[pos[0]-1])
          if(_this.form.h[pos[0]-1][pos[1]])
            cell.exits.push([pos[0]-1,pos[1]]); //above is open
        
        if((pos[0] + 1 < _this.form.rows) && (_this.form.h[pos[0]]))
          if(_this.form.h[pos[0]][pos[1]])
            cell.exits.push([pos[0]+1,pos[1]]); //below is open

        if((pos[1] - 1 >= 0) && _this.form.v[pos[1]-1])
          if(_this.form.v[pos[1]-1][pos[0]])
            cell.exits.push([pos[0],pos[1]-1]); //left is open

        if((pos[1] + 1 < _this.form.cols) && (_this.form.v[pos[1]]))
          if(_this.form.v[pos[1]][pos[0]])
            cell.exits.push([pos[0],pos[1]+1]); //right is open
        
        board[r][c] = cell;
      }
    }
    return board;
  }

  /**
    get the appropriate direction to exit this cell.
    This is called for cells that are either straights corners or dead ends
    dir is modified by reference.
    returns true if we were about to continue on through a straight or a turn.
    false if we turned around at a dead end
  */
  function getNextDirection(dir, coords, cell){
    //see if there's a way out straight ahead
    var c = [coords[0] + dir[0], coords[1] + dir[1]];
    for(var x in cell.exits)
      if(cell.exits[x][0] == c[0] && cell.exits[x][1] == c[1])
        var exit = cell.exits[x];
    
    //if we didn't find an exit, there must be a wall in front of us
    if(!exit){
      if(dir[0] == 0){ //if we're moving left/right
        //find the exit that is on a different plane to our movement
        for(var x in cell.exits){
          if(cell.exits[x][0] != coords[0]){
            dir[0] = cell.exits[x][0] - coords[0];
            dir[1] = 0;
            return true;
          }
        }
        //if no appropriate change of direction was found, this is a dead end
        dir[0] = 0; 
        dir[1] *= -1; //reverse direction in the correct plane
        return false;
      }else{ //we're moving up/down
        //find the exit that is on a different plane to our moevement
        for(var x in cell.exits){
          if(cell.exits[x][1] != coords[1]){
            dir[1] = cell.exits[x][1] - coords[1];
            dir[0] = 0;
            return true;
          }
        }
        //if no appropriate change of direction was found, this is a dead end
        dir[0] *= -1;
        dir[1] = 0;
        return false;
      }
    }else{ //stay the course
      return true;
    }
  }
  
  /**

  */
  function getLowestVisitExit(pos, b){
    var c = [];
    var v = [];
    for(var x = 0; x < b[pos[0]][pos[1]].exits.length; x++){
      c.push(b[pos[0]][pos[1]].exits[x]);
      v.push(b[b[pos[0]][pos[1]].exits[x][0]][b[pos[0]][pos[1]].exits[x][1]].visits);
    }
    
    var min = Math.min.apply(null, v);
    var m = [];
    for(var x in c)
      if(b[c[x][0]][c[x][1]].visits == min)
        m.push(c[x]);
    
    if(m.length == 1)
      return m[0];
    else
      return m[Math.floor(Math.random() * m.length)];
  }
  
  /**
    Tremaux's algorithm:
    
      Paths are 'marked' as visited 0, 1 or 2 times.
      
      From the start, choose a direction at random. Mark the path you choose.
      Whenever you reach a dead end, just turn back.
      
      On arriving at a junction that has not been visited before (no other marks), 
      pick a random direction (and mark the path you came from and go to).
      
      When arriving at a marked junction (with no unvisited paths) and if your 
      current path is marked only once then turn around and walk back (and mark 
      your path a second time).
      
      If there are unvisited paths at the junction, pick the direction with the
      fewest marks (and add a mark to your source and destination, as always).
      
      Paths marked exactly once indicate a direct route to the goal (if we're
      interested in such a route).
    
    Use this algorithm to solve the given maze, return an array of arrays 
    showing the coordinates we passed through, and it will be animated later:
    [[0,1],[0,2],[1,2],...]
  */  
  function solve(){
    var board = generateBoard();
    getStartFinish(board);	
    var pos = _this.form.start;
    
    //create a start direction at random using exits
    var dir = board[pos[0]][pos[1]].exits[Math.floor(Math.random() * board[pos[0]][pos[1]].exits.length)];
    dir = [dir[0] - pos[0], dir[1] - pos[1]];
    
    //while we're not at the goal
    while(JSON.stringify(pos) != JSON.stringify(_this.form.goal)){
      board[pos[0]][pos[1]].visits++;
      _this.path.push(pos);
      
      if(board[pos[0]][pos[1]].exits.length > 2){ //if this is a junction
        //find the number of unvisited exits
        var uv = [];
        for(var x = 0; x < board[pos[0]][pos[1]].exits.length; x++)
          if(board[board[pos[0]][pos[1]].exits[x][0]][board[pos[0]][pos[1]].exits[x][1]].visits == 0)
            uv.push(board[pos[0]][pos[1]].exits[x]);
        
        //no unvisited exits
        if(uv.length < 1){
        
          var x = getLowestVisitExit(pos, board);
          dir = [x[0] - pos[0], x[1] - pos[1]];
          pos = [pos[0] + dir[0], pos[1] + dir[1]];
          
        }else if(uv.length == 1){ //only 1 unvisited exit, take it
        
          dir = [uv[0][0] - pos[0], uv[0][1] - pos[1]];
          pos = [uv[0][0], uv[0][1]];
          
        }else if(uv.length > 1){ //more than one valid exit, pick one at random
        
          var n = uv[Math.floor(Math.random() * uv.length)];
          dir = [n[0] - pos[0], n[1] - pos[1]];
          pos = [n[0], n[1]];
          
        }
        
      }else{ //this is not a junction, its either a straight, a dead end or a corner
        //if we turned around at a dead end, mark an extra visit on the way out
        if(!getNextDirection(dir, pos, board[pos[0]][pos[1]]))
          board[pos[0]][pos[1]].visits++;
        
        pos = [pos[0] + dir[0], pos[1] + dir[1]];
      }
    }
    _this.path.push(pos);
  }
}

function MazeRenderer(maze, scene){
  this.wallsUp = true;
  var _this = this;
  
  _this.scene = scene;
  
  var width = 5;
  var height = 5;
  var mWall = new THREE.MeshLambertMaterial({side:THREE.DoubleSide,map:THREE.ImageUtils.loadTexture('img/brickwall.jpg')});
  var mFloor = new THREE.MeshLambertMaterial({side:THREE.DoubleSide,map:THREE.ImageUtils.loadTexture('img/gravelfloor.jpg')});
  var mCeil = new THREE.MeshLambertMaterial({side:THREE.DoubleSide,map:THREE.ImageUtils.loadTexture('img/brickceiling.jpg')});
  
  _this.wallGroup = new THREE.Object3D();
  _this.floorGroup = new THREE.Object3D();
  _this.ceilingGroup = new THREE.Object3D();
  _this.lightGroup = new THREE.Object3D();
  
  //place the outside horizontal walls
  for(var h = 0; h < (width * maze.form.cols); h += width){
    //top walls
    var wall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mWall);
    wall.position.x = h;
    _this.wallGroup.add(wall);
    
    //bottom walls
    wall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mWall);
    wall.position.x = h;
    wall.position.z = width * maze.form.rows;
    _this.wallGroup.add(wall);
  }
  
  //place the outside vertical walls
  for(var v = 0; v < (width * maze.form.rows); v += width){
    //left walls
    var wall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mWall);
    wall.rotation.y = Math.PI / 2;
    wall.position.x = 0 - width / 2;
    wall.position.z = v + (width / 2);
    _this.wallGroup.add(wall);
    //right walls
    wall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mWall);
    wall.rotation.y = Math.PI / 2;
    wall.position.x = width * maze.form.cols - (width / 2);
    wall.position.z = v + (width / 2);
    _this.wallGroup.add(wall);
  }

  //place the floor and ceiling and some randomized lighting
  for(var h = 0; h < maze.form.cols; h++){
    for(var v = 0; v < maze.form.rows; v++){
      var tile = new THREE.Mesh(new THREE.PlaneGeometry(width, width), mFloor);
      tile.rotation.x = Math.PI / 2;
      tile.position.x = h * width;
      tile.position.z = v * width + (width / 2);
      tile.position.y = -(height / 2);
      _this.floorGroup.add(tile);
      
      var tile = tile.clone();
      tile.material = mCeil;
      tile.position.y = tile.position.y + height;
      _this.ceilingGroup.add(tile);
      
      if(Math.random() > 0.7){
        var light = new THREE.PointLight(0xffffff, 0.4, 15);
        light.position.set(h * width, 0, v * width + (width / 2));
        _this.lightGroup.add(light);
      }
    }
  }

  var penPos = [0,0]; //x and z coords
  
  //place all the horizontal walls
  for(var h = 0; h < maze.form.h.length; h++){
    penPos[0] = 0;
    penPos[1] += width;
    for(var w = 0; w < maze.form.cols; w++){
      if(typeof maze.form.h[h][w] == 'undefined' || maze.form.h[h][w]==null){
        var wall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mWall);
        wall.position.x = penPos[0];
        wall.position.z = penPos[1];
        _this.wallGroup.add(wall);
      }
      penPos[0] += width;
    }
  }
  
  penPos = [0, 0];
  
  //place all the vertical walls
  for(var v = 0; v < maze.form.v.length; v++){
    penPos[1] = 0;
    penPos[0] += width;
    for(var w = 0; w < maze.form.rows; w++){
      if(typeof maze.form.v[v][w] == 'undefined' || maze.form.v[v][w]==null){
        var wall = new THREE.Mesh(new THREE.PlaneGeometry(width, height), mWall);
        wall.position.x = penPos[0] - (width / 2);
        wall.position.z = penPos[1] + (width / 2);
        wall.rotation.y = Math.PI / 2;
        _this.wallGroup.add(wall);
      }
      penPos[1] += width;
    }
  }

  _this.scene.add(_this.wallGroup);
  _this.scene.add(_this.floorGroup);
  _this.scene.add(_this.ceilingGroup);
  _this.scene.add(_this.lightGroup);
  
  var tx = THREE.ImageUtils.loadTexture('img/smiley.png');
  var sprite = new THREE.Sprite(new THREE.SpriteMaterial({map: tx, color: 0xffffff, fog: true}));
  sprite.position.set((maze.form.goal[1] * width), 0,(maze.form.goal[0] * width) + (width / 2));
  _this.scene.add(sprite);

  _this.getScene = function(){
    return _this.scene;
  }
  
  _this.resizeWalls = function(amount){
    var y = 0;
    for(var x = 0; x < _this.wallGroup.children.length; x++){
      var mesh = _this.wallGroup.children[x];
      
      mesh.scale.y += amount;
      
      mesh.position.y += (height * amount);
      
      y += mesh.scale.y;
      
    }
    
    if(y < 0) _this.wallsUp = false;
  }
}

/**
  {
    cam:THREE.Camera,
    stepSize:int,
    turnSpeed,
    cellWidth,
    path:[]
  }
*/
function MazeWalker(opts){
  if(!(opts.cam && opts.path && opts.cellWidth)) return;
  
  
  var _this = this;
  _this.atGoal = false;
  
  var step = opts.stepSize || 0.1; //move rate
  var rSpeed = opts.turnSpeed || 0.08; //rotation rate
  var rRemain; //rotation remaining
  var newPos, newDir; //camera position and rotation for next cell
  var newCoord; //the next cell to move to
  
  var cam = opts.cam;
  var s = getCamPos(opts.path[0]);  
  cam.position.set(s.x, s.y, s.z);

  newPos = getCamPos(opts.path[1]);
  cam.rotation.y = getCamAngle(opts.path[0],opts.path[1]);
  newDir = cam.rotation.y;
  newCoord = opts.path.shift();
  
  
  /**
  gets where the camera should be for the given grid reference
  */
  function getCamPos(c){
    return {
      x: c[1] * opts.cellWidth, 
      y: 0, 
      z: (c[0] * opts.cellWidth) + (opts.cellWidth / 2)
    };
  }
  
  /**
    gets where the camera should be facing from 'from' to 'to'
  */
  function getCamAngle(from, to){
    var dir = [to[0] - from[0] , to[1] - from[1]];
    if(dir[0] == 0){
      if(to[1] > from[1]){
        return (3 * Math.PI) / 2;
      }else{
        return Math.PI / 2;
      }
    }else{
      if(to[0] > from[0]){
        return Math.PI;
      }else{
        return (2 * Math.PI);
      }
    }
  }
  
  _this.advance = function(){
    if(rRemain - Math.abs(rSpeed) > 0){
      rRemain -= Math.abs(rSpeed);
      cam.rotation.y += rSpeed;
    }else{
      cam.rotation.y = newDir;
      if(Math.abs(cam.position.x - newPos.x) < 0.1 && Math.abs(cam.position.z - newPos.z) < 0.1){
        cam.position.set(newPos.x, 0, newPos.z);
        
        if(opts.path.length < 1){
          _this.atGoal = true;
          return;
        }
        
        var pos = newCoord;
        
        newCoord = opts.path.shift(); //whats the next coordinate
        newPos = getCamPos(newCoord); //where should the camera be for that coordinate?
        
        newDir = getCamAngle(pos, newCoord); //where should the camera be looking?
        //find the radial difference
        rRemain = Math.abs(newDir - cam.rotation.y);
        
        //decide whether to turn positively or negatively
        rSpeed = (newDir - cam.rotation.y) < 0 ? 0 - Math.abs(rSpeed) : 0 + Math.abs(rSpeed); 

        //but if that makes us turn more than half way, reverse direction
        if(rRemain > Math.PI){
          rRemain -= Math.PI;
          rSpeed *= -1;
        }
      }else{
        if(cam.position.x == newPos.x){
          if(newPos.z > cam.position.z){
            cam.position.z += step;
          }else{
            cam.position.z -= step;
          }
        }else{
          if(newPos.x > cam.position.x){
            cam.position.x += step;
          }else{
            cam.position.x -= step;
          }
        }
      }
    }
  }  
}















class TerrainType {
  constructor(minHeight, maxHeight, minColour, maxColour, lerpAdjustment = 0) {
    this.minHeight = minHeight;
    this.maxHeight = maxHeight;
    this.minColour = minColour;
    this.maxColour = maxColour;
    this.lerpAdjustment = lerpAdjustment;
  }
}

class NodeGrid {
  constructor(grid) {
    this.grid = grid;
    this.gridWidth = grid.length;
    this.gridHeight = grid[0].length;
  }

  getNeighbours(x, y) {
    let neighbours = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        if (dx === 0 && dy === 0) continue;
        let nx = x + dx;
        let ny = y + dy;
        if (nx >= 0 && nx < this.gridWidth && ny >= 0 && ny < this.gridHeight) {
          neighbours.push(this.grid[nx][ny]);
        }
      }
    }
    return neighbours;
  }

  setNodeHeight(x, y, z) {
    this.grid[x][y].setHeight(z);
  }

  getNode(x, y) {
    return this.grid[x][y];
  }
}

class Node {
  constructor(x, y, noise) {
    this.x = x;
    this.y = y;
    this.z = noise * heightFactor;
    this.g = Infinity;
    this.h = Infinity;
    this.f = Infinity;
    this.parent = null;
    this.inPath = false;
    this.terrainType = getTerrainType(noise);
  }

  manhattanDistance(otherNode) {
    return (
      Math.abs(this.x - otherNode.x) +
      Math.abs(this.y - otherNode.y) +
      Math.abs(this.z - otherNode.z)
    );
  }

  setHeight(z) {
    this.z = z;
  }
}

let waterTerrain;
let landTerrain;
let mountainTerrain;
let snowTerrain;

let zoomFactor = 120;
let heightFactor = 1000;
let mapChanged = true;
let xOffset = 10000;
let yOffset = 10000;
const cameraSpeed = 10;

let nodeGrid;
let pointA = null;
let pointB = null;
let currentNode = null;

function setup() {
  createCanvas(windowWidth, windowHeight);
  noiseDetail(8, 0.5);

  waterTerrain = new TerrainType(
    0.2,
    0.4,
    color(30, 176, 251),
    color(40, 255, 255)
  );
  landTerrain = new TerrainType(
    0.4,
    0.6,
    color(118, 239, 124),
    color(2, 166, 155)
  );
  mountainTerrain = new TerrainType(
    0.6,
    0.75,
    color(100, 100, 100),
    color(200, 200, 200)
  );
  snowTerrain = new TerrainType(
    0.75,
    0.8,
    color(255, 250, 250),
    color(255, 255, 255)
  );
  //noLoop();
}

function draw() {
  if (!mapChanged) {
    return;
  }
  loadPixels();
  let grid = [];

  for (let x = 0; x < width; x++) {
    let column = [];
    for (let y = 0; y < height; y++) {
      // const xVal = (x - width / 2) / zoomFactor + xOffset;
      // const yVal = (y - height / 2) / zoomFactor + yOffset;
      const xVal = x / zoomFactor;
      const yVal = y / zoomFactor;
      const noiseValue = noise(xVal, yVal);

      currentNode = new Node(x, y, noiseValue);
      column.push(currentNode);
      set(x, y, getPixelColour(noiseValue, currentNode.terrainType));
    }
    grid.push(column);
  }
  nodeGrid = new NodeGrid(grid);
  if (pointA != null && pointB != null) {
    drawPath(AStarSearch(pointA, pointB));
    // pointA = null;
    // pointB = null;
  }

  updatePixels();
  if (pointA != null) {
    text("A", pointA.x, pointA.y);
  }
  if (pointB != null) {
    text("B", pointB.x, pointB.y);
  }
  mapChanged = false;
}

// // Pan
// function mouseDragged(event) {
//   xOffset -= event.movementX / zoomFactor;
//   yOffset -= event.movementY / zoomFactor;
//   mapChanged = true;
// }

// // Zoom
// function mouseWheel(event) {
//   zoomFactor -= event.delta / 10;
//   zoomFactor = Math.max(10, zoomFactor);
//   mapChanged = true;
//   return false;
// }

function mouseClicked() {
  if (pointA != null && pointB == null) {
    pointB = { x: mouseX, y: mouseY };
  } else {
    pointA = { x: mouseX, y: mouseY };
    pointB = null;
  }
  mapChanged = true;
}

function drawPath(path) {
  for (const pos of path) {
    set(pos.x, pos.y, color(255, 0, 0));
  }
}

function getPixelColour(noiseValue, terrainType) {
  const normalisedValue = normalise(
    noiseValue,
    terrainType.maxHeight,
    terrainType.minHeight
  );

  return lerpColor(
    terrainType.minColour,
    terrainType.maxColour,
    normalisedValue + terrainType.lerpAdjustment
  );
}

function getTerrainType(noiseValue) {
  if (noiseValue < waterTerrain.maxHeight) {
    return waterTerrain;
  }
  if (noiseValue < landTerrain.maxHeight) {
    return landTerrain;
  }
  if (noiseValue < mountainTerrain.maxHeight) {
    return mountainTerrain;
  } else {
    return snowTerrain;
  }
}

function normalise(value, max, min) {
  if (value > max) {
    return 1;
  }
  if (value < min) {
    return 0;
  }
  return (value - min) / (max - min);
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
  mapChanged = true;
}

function nodeKey(x, y) {
  return `${x},${y}`;
}

function heuristic(ax, ay, bx, by, allowDiagonal = true) {
  const dx = Math.abs(ax - bx);
  const dy = Math.abs(ay - by);

  if (!allowDiagonal) {
    return dx + dy; // Manhattan
  } else {
    // Octile distance (diagonals cost sqrt(2))
    const F = Math.SQRT2 - 1;
    return dx < dy ? F * dx + dy : F * dy + dx;
  }
}

// Movement cost: base + optional terrain modifier
function getMovementCost(current, neighbour) {
  const straight = current.x === neighbour.x || current.y === neighbour.y;
  const baseCost = straight ? 1 : Math.SQRT2;
  const terrainCost = Math.abs(neighbour.z - current.z);
  return baseCost + terrainCost;
}

// Reconstruct path from goal node
function reconstructPath(node) {
  const path = [];
  let current = node;
  while (current) {
    //set(current.x, current.y, color(255, 0, 0));
    current.inPath = true;
    path.push({ x: current.x, y: current.y });
    current = current.parent;
  }
  return path.reverse();
}

function AStarSearch(start, end) {
  const allowDiagonal = true;
  const rows = nodeGrid.gridHeight;
  const cols = nodeGrid.gridWidth;
  const openMap = new Map();
  const openSet = [];
  const closedSet = new Set();

  startNode = nodeGrid.getNode(start.x, start.y);
  startNode.g = 0;
  startNode.h = heuristic(start.x, start.y, end.x, end.y, allowDiagonal);
  startNode.f = startNode.g + startNode.h;
  startNode.parent = 0;

  openSet.push(startNode);
  openMap.set(nodeKey(startNode.x, startNode.y), startNode);

  const directions4 = [
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
  ];

  const directions8 = directions4.concat([
    { dx: 1, dy: 1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
    { dx: -1, dy: -1 },
  ]);

  while (openSet.length > 0) {
    let bestIndex = 0;
    for (let i = 1; i < openSet.length; i++) {
      if (openSet[i].f < openSet[bestIndex].f) {
        bestIndex = i;
      }
    }
    const current = openSet[bestIndex];

    // If we reached the goal, reconstruct path
    if (current.x === end.x && current.y === end.y) {
      return reconstructPath(current);
    }

    // Move current from open to closed
    openSet.splice(bestIndex, 1);
    openMap.delete(nodeKey(current.x, current.y));
    closedSet.add(nodeKey(current.x, current.y));

    for (const { dx, dy } of directions8) {
      const nx = current.x + dx;
      const ny = current.y + dy;

      // Out of bounds?
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;

      let potentialNeighbour = nodeGrid.getNode(nx, ny);
      // Not walkable?
      if (potentialNeighbour.terrainType == waterTerrain) continue;

      const neighborKey = nodeKey(nx, ny);
      if (closedSet.has(neighborKey)) continue;

      const tentativeG =
        current.g + getMovementCost(current, potentialNeighbour);

      let neighborNode = openMap.get(neighborKey);

      // New node discovered
      if (!neighborNode) {
        neighborNode = nodeGrid.getNode(nx, ny);
        neighborNode.g = tentativeG;
        neighborNode.h = heuristic(nx, ny, end.x, end.y, allowDiagonal);
        neighborNode.f = neighborNode.g + neighborNode.h;
        neighborNode.parent = current;

        openSet.push(neighborNode);
        openMap.set(neighborKey, neighborNode);
      } else if (tentativeG < neighborNode.g) {
        // Found a better path to an existing node
        neighborNode.g = tentativeG;
        neighborNode.f = neighborNode.g + neighborNode.h;
        neighborNode.parent = current;
        // No need to reinsert into openSet, we just updated its scores
      }
    }
  }
  return null;
}

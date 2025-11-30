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
    this.portalPartner = null;
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

let zoomFactor = 100;
let cellSize = 4;
let heightFactor = 1000;
let prevHeightFactor = heightFactor;
let mapChanged = true;
//let xOffset = 10000;
//let yOffset = 10000;
//const cameraSpeed = 10;
let portalColour;
let pathColour;

let nodeGrid;
let pointA = null;
let pointB = null;
let portalA = null;
let portalB = null;
let currentNode = null;
let canvasElem;

document.oncontextmenu = () => false;

function setup() {
  canvasElem = createCanvas(windowWidth, windowHeight);
  noiseDetail(8, 0.5);

  heightSlider = createSlider(100, 3000, heightFactor, 1);
  heightSlider.position(10, 10);
  heightSlider.style("width", "200px");

  portalColour = color(150, 131, 236);
  pathColour = color(255, 0, 0);

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
  heightFactor = heightSlider.value();

  // Trigger redraw if slider changed
  if (heightFactor !== prevHeightFactor) {
    mapChanged = true;
    prevHeightFactor = heightFactor;
  }
  if (!mapChanged) {
    return;
  }

  background(0);
  const cols = floor(width / cellSize);
  const rows = floor(height / cellSize);
  const grid = [];

  for (let x = 0; x < cols; x++) {
    let column = [];
    for (let y = 0; y < rows; y++) {
      // pixel position of this cell (center)
      const px = x * cellSize + cellSize / 2;
      const py = y * cellSize + cellSize / 2;

      // sample noise in some coordinate space
      const xVal = px / zoomFactor;
      const yVal = py / zoomFactor;

      const noiseValue = noise(xVal, yVal);

      // --- ISLAND MASK ---

      // distance from center (in pixel space)
      const dx = px - width / 2;
      const dy = py - height / 2;
      const distance = Math.sqrt(dx * dx + dy * dy);

      // max possible distance (corner)
      const maxDistance = Math.sqrt(
        (width / 2) * (width / 2) + (height / 2) * (height / 2)
      );

      // normalize to [0, 1]
      let d = distance / maxDistance;
      d = constrain(d, 0, 1);

      // falloff: 1 at center -> 0 at edge
      const power = 3; // try 2, 3, 4 etc
      const falloff = 1 - Math.pow(d, power);

      // final "height" in [0, 1], but pushed down near edges
      const islandValue = noiseValue * falloff;

      currentNode = new Node(x, y, islandValue);
      column.push(currentNode);
      // set(x, y, getPixelColour(noiseValue, currentNode.terrainType));
      const c = getPixelColour(islandValue, currentNode.terrainType);
      fill(c);
      noStroke();
      rect(x * cellSize, y * cellSize, cellSize, cellSize);
    }
    grid.push(column);
  }
  nodeGrid = new NodeGrid(grid);

  if (portalA != null && portalB != null) {
    const nodeA = nodeGrid.getNode(portalA.x, portalA.y);
    const nodeB = nodeGrid.getNode(portalB.x, portalB.y);

    nodeA.portalPartner = nodeB;
    nodeB.portalPartner = nodeA;
  }

  if (pointA != null && pointB != null) {
    const path = AStarSearch(pointA, pointB);
    if (path) {
      drawPath(path);
    } else {
      window.alert("Path not possible!");
    }
  }

  if (pointA != null) drawMarker(pointA, "A");
  if (pointB != null) drawMarker(pointB, "B");

  if (portalA != null) drawPortal(portalA);
  if (portalB != null) drawPortal(portalB);

  mapChanged = false;
}

function islandMask(xVal, yVal) {
  // distance from center (in pixel space)
}

// Navigation (scrapped feature)

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

function mousePressed(event) {
  if (event.target !== canvasElem.elt) return;

  const gx = floor(mouseX / cellSize);
  const gy = floor(mouseY / cellSize);

  if (mouseButton === LEFT) {
    handlePathClick(gx, gy);
    return;
  }

  if (mouseButton === RIGHT) {
    handlePortalClick(gx, gy);
    return;
  }
}

function handlePathClick(gx, gy) {
  if (pointA != null && pointB == null) {
    pointB = { x: gx, y: gy };
  } else {
    pointA = { x: gx, y: gy };
    pointB = null;
  }
  mapChanged = true;
}

function handlePortalClick(gx, gy) {
  if (portalA != null && portalB == null) {
    portalB = { x: gx, y: gy };

    const nodeA = nodeGrid.getNode(portalA.x, portalA.y);
    const nodeB = nodeGrid.getNode(portalB.x, portalB.y);
    nodeA.portalPartner = nodeB;
    nodeB.portalPartner = nodeA;
  } else {
    portalA = { x: gx, y: gy };
    portalB = null;
  }
  mapChanged = true;
}

function drawPath(path, colourChoice = pathColour) {
  noStroke();
  fill(colourChoice);
  for (const pos of path) {
    const px = pos.x * cellSize + cellSize / 2;
    const py = pos.y * cellSize + cellSize / 2;
    ellipse(px, py, cellSize * 0.6, cellSize * 0.6);
  }
}

function drawPortal(point, colourChoice = portalColour) {
  const px = point.x * cellSize + cellSize / 2;
  const py = point.y * cellSize + cellSize / 2;
  //noStroke();
  stroke(
    colourChoice.levels[0] * 0.8,
    colourChoice.levels[1] * 0.8,
    colourChoice.levels[2] * 0.8
  );
  fill(colourChoice);
  ellipse(px, py, cellSize * 1.2, cellSize * 2.4);
}

function drawMarker(point, label) {
  const px = point.x * cellSize + cellSize / 2;
  const py = point.y * cellSize + cellSize / 2;

  // noStroke();
  // fill(255, 255, 0);
  // ellipse(px, py, cellSize, cellSize);

  fill(0);
  textAlign(CENTER, CENTER);
  text(label, px, py);
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
      if (
        potentialNeighbour.terrainType == waterTerrain ||
        potentialNeighbour.terrainType == snowTerrain
      )
        continue;

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

    // --- PORTAL NEIGHBOR ---
    if (current.portalPartner) {
      const portalNode = current.portalPartner;
      const nx = portalNode.x;
      const ny = portalNode.y;

      const neighborKey = nodeKey(nx, ny);
      if (!closedSet.has(neighborKey)) {
        // define the teleport cost (could be cheap, but > 0)
        const teleportCost = 1; // or 0.5 or whatever you like

        const tentativeG = current.g + teleportCost;
        let neighborNode = openMap.get(neighborKey);

        if (!neighborNode) {
          neighborNode = portalNode;
          neighborNode.g = tentativeG;
          neighborNode.h = heuristic(nx, ny, end.x, end.y, allowDiagonal);
          neighborNode.f = neighborNode.g + neighborNode.h;
          neighborNode.parent = current;

          openSet.push(neighborNode);
          openMap.set(neighborKey, neighborNode);
        } else if (tentativeG < neighborNode.g) {
          neighborNode.g = tentativeG;
          neighborNode.f = neighborNode.g + neighborNode.h;
          neighborNode.parent = current;
        }
      }
    }
  }
  return null;
}

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

  setHeight(z) {
    this.z = z;
  }

  get2DPoint() {
    return { x: this.x, y: this.y };
  }
}

let waterTerrain;
let landTerrain;
let mountainTerrain;
let snowTerrain;

let zoomFactor = 100;
let cellSize = 4;
let heightFactor = 1000;
let heuristicScaling = 0.5; // heuristicScaling <1 more exploratory of portals, >1 opposite
const falloffPower = 3;
const teleportCost = 1;
let prevHeightFactor = heightFactor;
let prevHeuristicScaling = heuristicScaling;
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
let uiBox;
let heightSlider;
let heuristicSlider;
let heightLabel;
let heuristicLabel;

// Disable context menu on right click
document.oncontextmenu = () => false;

function setup() {
  canvasElem = createCanvas(windowWidth, windowHeight);
  noiseDetail(8, 0.5);

  uiBox = createDiv();
  uiBox.position(10, 10);
  uiBox.style(`
    background: rgba(0,0,0,0.55);
    padding: 12px;
    width: 220px;
    color: white;
    font-family: monospace;
    border-radius: 8px;
    user-select:none;
  `);

  heightLabel = createDiv(`Terrain Height Factor: ${heightFactor}`);
  uiBox.child(heightLabel);
  heightSlider = createSlider(100, 3000, heightFactor, 1);
  uiBox.child(heightSlider);

  heuristicLabel = createDiv(
    `Heuristic Scaling For Portal Bias: ${heuristicScaling.toFixed(2)}`
  );
  uiBox.child(heuristicLabel);
  heuristicSlider = createSlider(0.2, 1, heuristicScaling, 0.01);
  uiBox.child(heuristicSlider);

  uiBox.child(createElement("hr"));
  uiBox.child(
    createDiv(`
    <b>CONTROLS:</b><br>
    Left click: Set A then B for path<br>
    Right click: Place Portal A then B for wormhole
  `)
  );
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
}

function draw() {
  heightFactor = heightSlider.value();
  heuristicScaling = heuristicSlider.value();

  heightLabel.html(`Terrain Height Factor: ${heightFactor}`);
  heuristicLabel.html(
    `Heuristic Scaling For Portal Bias: ${heuristicScaling.toFixed(2)}`
  );

  // Trigger redraw if sliders changed
  if (heightFactor !== prevHeightFactor) {
    mapChanged = true;
    prevHeightFactor = heightFactor;
  }
  if (heuristicScaling !== prevHeuristicScaling) {
    mapChanged = true;
    prevHeuristicScaling = heuristicScaling;
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
      // center pixel position of cell
      const px = x * cellSize + cellSize / 2;
      const py = y * cellSize + cellSize / 2;

      const xVal = px / zoomFactor;
      const yVal = py / zoomFactor;

      const noiseValue = noise(xVal, yVal);
      const maskedValue = noiseValue * getFalloff(px, py);

      currentNode = new Node(x, y, maskedValue);
      column.push(currentNode);
      const c = getPixelColour(maskedValue, currentNode.terrainType);
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

  if (portalA != null) drawPortal(portalA);
  if (portalB != null) drawPortal(portalB);

  if (pointA != null && pointB != null) {
    const path = AStarSearch(pointA, pointB);
    if (path != null) {
      drawPath(path);
    } else {
      window.alert("Path not possible!");
    }
  }

  if (pointA != null) drawMarker(pointA, "A");
  if (pointB != null) drawMarker(pointB, "B");

  mapChanged = false;
}

function getFalloff(px, py) {
  // distance from center (in pixel space)
  const dx = px - width / 2;
  const dy = py - height / 2;
  const distance = Math.sqrt(dx * dx + dy * dy);

  const maxDistance = Math.sqrt(
    (width / 2) * (width / 2) + (height / 2) * (height / 2)
  );

  // normalise distance
  let d = distance / maxDistance;
  d = constrain(d, 0, 1);

  // apply falloff curve
  const falloff = 1 - Math.pow(d, falloffPower);

  return falloff;
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
  stroke(
    colourChoice.levels[0] * 1.2,
    colourChoice.levels[1] * 1.2,
    colourChoice.levels[2] * 1.2
  );
  strokeWeight(2);
  fill(colourChoice);
  ellipse(px, py, cellSize * 2, cellSize * 4);
  noStroke();
  fill(
    colourChoice.levels[0] * 0.8,
    colourChoice.levels[1] * 0.8,
    colourChoice.levels[2] * 0.8
  );
  ellipse(px, py, cellSize * 1, cellSize * 2);
}

function drawMarker(point, label) {
  const px = point.x * cellSize + cellSize / 2;
  const py = point.y * cellSize + cellSize / 2;

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
  pointA = null;
  pointB = null;
  portalA = null;
  portalB = null;
  mapChanged = true;
}

function nodeKey(x, y) {
  return `${x},${y}`;
}

// Octile extension of Manhattan distance
function octile(current, end) {
  const dx = Math.abs(current.x - end.x);
  const dy = Math.abs(current.y - end.y);
  const F = Math.SQRT2 - 1;
  if (dx < dy) {
    return F * dx + dy;
  } else {
    return F * dy + dx;
  }
}

function heuristic(current, end) {
  const normal = octile(current, end);

  // Estimate heuristic with portals if they exist
  if (portalA && portalB) {
    const d1 =
      octile(current, portalA) * heuristicScaling +
      teleportCost +
      octile(portalB, end);
    const d2 =
      octile(current, portalB) * heuristicScaling +
      teleportCost +
      octile(portalA, end);
    return Math.min(normal, d1, d2);
  }
  return normal;
}

// Movement cost: base + terrain modifier
function getMovementCost(current, neighbour) {
  let baseCost;
  if (current.x === neighbour.x || current.y === neighbour.y) {
    baseCost = 1;
  } else {
    baseCost = Math.SQRT2;
  }
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
  const openMap = new Map();
  const openSet = [];
  const closedSet = new Set();

  startNode = nodeGrid.getNode(start.x, start.y);
  startNode.g = 0;
  startNode.h = heuristic(start, end);
  startNode.f = startNode.g + startNode.h;
  startNode.parent = null;

  openSet.push(startNode);
  openMap.set(nodeKey(startNode.x, startNode.y), startNode);

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

    for (const neighbour of nodeGrid.getNeighbours(current.x, current.y)) {
      // Skip if forbidden (water or snow)
      if (
        neighbour.terrainType == waterTerrain ||
        neighbour.terrainType == snowTerrain
      ) {
        continue;
      }

      const neighbourKey = nodeKey(neighbour.x, neighbour.y);
      if (closedSet.has(neighbourKey)) continue;

      const tentativeG = current.g + getMovementCost(current, neighbour);
      let neighbourNode = openMap.get(neighbourKey);

      // New node discovered
      if (neighbourNode == null) {
        neighbour.g = tentativeG;
        neighbour.h = heuristic(neighbour.get2DPoint(), end);
        neighbour.f = neighbour.g + neighbour.h;
        neighbour.parent = current;
        openSet.push(neighbour);
        openMap.set(neighbourKey, neighbour);
      } else if (tentativeG < neighbour.g) {
        // Found a better path to an existing node
        neighbour.g = tentativeG;
        neighbour.f = neighbour.g + neighbour.h;
        neighbour.parent = current;
        // No need to reinsert into openSet, we just updated its scores
      }
    }

    if (current.portalPartner != null) {
      const portalNode = current.portalPartner;

      const neighbourKey = nodeKey(portalNode.x, portalNode.y);
      if (!closedSet.has(neighbourKey)) {
        const tentativeG = current.g + teleportCost;
        let neighbourNode = openMap.get(neighbourKey);

        if (neighbourNode == null) {
          portalNode.g = tentativeG;
          portalNode.h = heuristic(portalNode.get2DPoint(), end);
          portalNode.f = portalNode.g + portalNode.h;
          portalNode.parent = current;

          openSet.push(portalNode);
          openMap.set(neighbourKey, portalNode);
        } else if (tentativeG < portalNode.g) {
          portalNode.g = tentativeG;
          portalNode.f = portalNode.g + portalNode.h;
          portalNode.parent = current;
        }
      }
    }
  }
  return null;
}

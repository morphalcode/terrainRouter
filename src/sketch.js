class TerrainType {
  constructor(minHeight, maxHeight, minColour, maxColour, lerpAdjustment = 0) {
    this.minHeight = minHeight;
    this.maxHeight = maxHeight;
    this.minColour = minColour;
    this.maxColour = maxColour;
    this.lerpAdjustment = lerpAdjustment;
  }
}

let waterTerrain;
let landTerrain;
let mountainTerrain;
let snowTerrain;

let zoomFactor = 100;
let mapChanged = true;
let xOffset = 10000;
let yOffset = 10000;
const cameraSpeed = 10;

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

  for (let x = 0; x < width; x++) {
    for (let y = 0; y < height; y++) {
      const xVal = (x - width / 2) / zoomFactor + xOffset;
      const yVal = (y - height / 2) / zoomFactor + yOffset;
      const noiseValue = noise(xVal, yVal);

      const terrainType = getTerrainType(noiseValue);

      set(x, y, getPixelColour(noiseValue, terrainType));
    }
  }
  updatePixels();
  mapChanged = false;
}

// Pan
function mouseDragged(event) {
  xOffset -= event.movementX / zoomFactor;
  yOffset -= event.movementY / zoomFactor;
  mapChanged = true;
}

// Zoom
function mouseWheel(event) {
  zoomFactor -= event.delta / 10;
  zoomFactor = Math.max(10, zoomFactor);
  mapChanged = true;
  return false;
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

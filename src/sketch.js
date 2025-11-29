let zoomFactor = 100;

function setup() {
  createCanvas(600, 600);
  background(200);
  describe("Canvas with a zoom factor of " + zoomFactor);
  noLoop();
}

function draw() {
  for (x = 0; x < width; x++) {
    for (y = 0; y < height; y++) {
      const noiseValue = noise(x / zoomFactor, y / zoomFactor);
      set(x, y, color(noiseValue * 255));
    }
  }
  updatePixels();
}

# BIT case: Island Router

This project generates a procedural perlin noise based island map, and uses an A\* search algorithm to find the most efficient route between two user-selected points. To make things more interesting, the user can place down two portals to create a wormhole across the map, which the search algorithm can consider using!

![Preview Image](./images/preview2.png)

## TECH STACK

Primarily written in JavaScript, and makes use of P5.js for perlin noise and graphics.

## FEATURES

- **Procedural terrain:** Uses perlin noise and a smooth falloff mask to form an island terrain.
- **Terrain types:** Terrain types are water, grassland, mountains, and snow. Water and snow cannot be traversed over. Each terrain is textured for height visualisation.
- **A\* pathfinding:** Path calculated between two user-provided points using cost based on vertical height change.
- **Wormhole sytem:** Two portals can be placed, through which the pathfinding can teleport.
- **Adjustable controls:** Real-time sliders for terrain height + heuristic influence.
- **Auto-adjusting:** Map scales based on window size.

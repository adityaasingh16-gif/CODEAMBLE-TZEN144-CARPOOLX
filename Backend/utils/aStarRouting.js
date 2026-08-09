/**
 * CarpoolX - A* Pathfinding & Driving Route Optimizer Engine
 * 
 * Implements the A* (A-Star) algorithm for Ola/Uber-style driver matching
 * and shortest driving path calculations.
 * 
 * Formula: f(n) = g(n) + h(n)
 *   - g(n): Actual road travel cost from start node to node n (distance / speed * traffic_factor)
 *   - h(n): Admissible heuristic (Haversine great-circle distance to goal / max speed limit)
 */

const { haversineDistance } = require('./routeMatcher');

/**
 * Priority Queue (Min-Heap) for A* open set traversal - O(log N) operations
 */
class MinHeap {
  constructor() {
    this.heap = [];
  }

  push(element) {
    this.heap.push(element);
    this._bubbleUp(this.heap.length - 1);
  }

  pop() {
    if (this.heap.length === 0) return null;
    if (this.heap.length === 1) return this.heap.pop();
    const top = this.heap[0];
    this.heap[0] = this.heap.pop();
    this._bubbleDown(0);
    return top;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  _bubbleUp(index) {
    while (index > 0) {
      const parentIndex = Math.floor((index - 1) / 2);
      if (this.heap[index].fScore >= this.heap[parentIndex].fScore) break;
      [this.heap[index], this.heap[parentIndex]] = [this.heap[parentIndex], this.heap[index]];
      index = parentIndex;
    }
  }

  _bubbleDown(index) {
    const length = this.heap.length;
    while (true) {
      let left = 2 * index + 1;
      let right = 2 * index + 2;
      let smallest = index;

      if (left < length && this.heap[left].fScore < this.heap[smallest].fScore) {
        smallest = left;
      }
      if (right < length && this.heap[right].fScore < this.heap[smallest].fScore) {
        smallest = right;
      }
      if (smallest === index) break;
      [this.heap[index], this.heap[smallest]] = [this.heap[smallest], this.heap[index]];
      index = smallest;
    }
  }
}

/**
 * Core A* Algorithm for Road Networks
 * 
 * @param {Object} graph - Map of nodeId -> [{ node, distanceMeters, speedKmh, trafficFactor }]
 * @param {Object} nodes - Map of nodeId -> { id, coordinates: [lng, lat], name }
 * @param {String} startNodeId 
 * @param {String} goalNodeId 
 * @param {Number} maxSpeedKmh - Max speed for admissible heuristic estimation
 */
function aStarSearch(graph, nodes, startNodeId, goalNodeId, maxSpeedKmh = 80) {
  const startNode = nodes[startNodeId];
  const goalNode = nodes[goalNodeId];

  if (!startNode || !goalNode) {
    throw new Error('Invalid start or goal node provided to A* search');
  }

  const maxSpeedMps = (maxSpeedKmh * 1000) / 3600; // Convert km/h to m/s
  const openSet = new MinHeap();
  const cameFrom = {};

  const gScore = {}; // Actual travel time in seconds
  const fScore = {}; // Estimated total cost

  for (const id in nodes) {
    gScore[id] = Infinity;
    fScore[id] = Infinity;
  }

  gScore[startNodeId] = 0;
  const initialDistance = haversineDistance(startNode.coordinates, goalNode.coordinates);
  const initialH = initialDistance / maxSpeedMps;
  fScore[startNodeId] = initialH;

  openSet.push({ nodeId: startNodeId, fScore: initialH });
  const visited = new Set();

  while (!openSet.isEmpty()) {
    const { nodeId: currentId } = openSet.pop();

    if (currentId === goalNodeId) {
      // Reconstruct path
      const path = [];
      let curr = currentId;
      while (curr in cameFrom) {
        path.push(nodes[curr]);
        curr = cameFrom[curr];
      }
      path.push(nodes[startNodeId]);
      path.reverse();

      const totalDistanceMeters = path.reduce((acc, node, i) => {
        if (i === 0) return 0;
        return acc + haversineDistance(path[i - 1].coordinates, node.coordinates);
      }, 0);

      const pathCoordinates = path.map((n) => n.coordinates);

      return {
        pathNodes: path.map((n) => ({ id: n.id, name: n.name, coordinates: n.coordinates })),
        coordinates: pathCoordinates,
        totalDistanceMeters: Math.round(totalDistanceMeters),
        totalDistanceKm: Math.round((totalDistanceMeters / 1000) * 100) / 100,
        etaSeconds: Math.round(gScore[goalNodeId]),
        etaMinutes: Math.round((gScore[goalNodeId] / 60) * 10) / 10,
      };
    }

    if (visited.has(currentId)) continue;
    visited.add(currentId);

    const neighbors = graph[currentId] || [];
    for (const neighbor of neighbors) {
      const { node: neighborId, distanceMeters, speedKmh = 40, trafficFactor = 1.0 } = neighbor;

      const speedMps = (speedKmh * 1000) / 3600;
      // Weight in seconds = (Distance / Speed) * Traffic Congestion Factor
      const edgeWeightSeconds = (distanceMeters / speedMps) * trafficFactor;

      const tentativeG = gScore[currentId] + edgeWeightSeconds;

      if (tentativeG < gScore[neighborId]) {
        cameFrom[neighborId] = currentId;
        gScore[neighborId] = tentativeG;

        const neighborNode = nodes[neighborId];
        const hDist = haversineDistance(neighborNode.coordinates, goalNode.coordinates);
        const hTimeSeconds = hDist / maxSpeedMps;

        fScore[neighborId] = tentativeG + hTimeSeconds;
        openSet.push({ nodeId: neighborId, fScore: fScore[neighborId] });
      }
    }
  }

  return null; // Path not reachable
}

/**
 * Snaps raw GPS coordinates [lng, lat] to the nearest road network graph node
 */
function findNearestGraphNode(nodes, coords) {
  let minDistance = Infinity;
  let nearestId = null;

  for (const id in nodes) {
    const dist = haversineDistance(coords, nodes[id].coordinates);
    if (dist < minDistance) {
      minDistance = dist;
      nearestId = id;
    }
  }
  return nearestId;
}

/**
 * Generates an interpolated coordinate path for coordinates when graph is sparse
 */
function generateLinearRouteCoordinates(startCoords, goalCoords, segments = 5) {
  const coords = [];
  for (let i = 0; i <= segments; i++) {
    const ratio = i / segments;
    const lng = startCoords[0] + (goalCoords[0] - startCoords[0]) * ratio;
    const lat = startCoords[1] + (goalCoords[1] - startCoords[1]) * ratio;
    coords.push([lng, lat]);
  }
  return coords;
}

/**
 * Multi-Target A* Driver Ranking Engine
 * Computes exact driving ETA using A* for nearby candidate drivers
 */
function rankDriversWithAStar(graph, nodes, pickupCoords, candidateDrivers) {
  const pickupNodeId = findNearestGraphNode(nodes, pickupCoords);

  const ranked = candidateDrivers.map((candidate) => {
    const driver = candidate.driver || candidate;
    const driverCoords = driver.currentLocation?.coordinates || candidate.coordinates;

    if (!driverCoords) {
      return { driver, etaMinutes: Infinity, distanceKm: Infinity };
    }

    const driverNodeId = findNearestGraphNode(nodes, driverCoords);
    const aStarResult = aStarSearch(graph, nodes, driverNodeId, pickupNodeId);

    if (aStarResult) {
      return {
        driver,
        pickupNodeId,
        driverNodeId,
        etaSeconds: aStarResult.etaSeconds,
        etaMinutes: aStarResult.etaMinutes,
        distanceKm: aStarResult.totalDistanceKm,
        drivingPath: aStarResult.coordinates,
      };
    }

    // Fallback if graph unconnected
    const directDist = haversineDistance(driverCoords, pickupCoords);
    const estSecs = Math.round((directDist / 11.11) * 1.2);
    return {
      driver,
      etaSeconds: estSecs,
      etaMinutes: Math.round((estSecs / 60) * 10) / 10,
      distanceKm: Math.round((directDist / 1000) * 100) / 100,
      drivingPath: [driverCoords, pickupCoords],
    };
  });

  ranked.sort((a, b) => a.etaSeconds - b.etaSeconds);
  return ranked;
}

module.exports = {
  aStarSearch,
  findNearestGraphNode,
  generateLinearRouteCoordinates,
  rankDriversWithAStar,
};

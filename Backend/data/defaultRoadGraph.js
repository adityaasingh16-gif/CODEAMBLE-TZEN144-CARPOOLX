/**
 * Urban Road Graph Dataset for A* Navigation
 * Contains intersections (nodes) and road segments with traffic congestion weights.
 */

const defaultNodes = {
  N1: { id: 'N1', name: 'Central Station Junction', coordinates: [77.5946, 12.9716] },
  N2: { id: 'N2', name: 'Tech Park Circle', coordinates: [77.6000, 12.9750] },
  N3: { id: 'N3', name: 'Metro Interchange', coordinates: [77.5950, 12.9800] },
  N4: { id: 'N4', name: 'North Airport Road', coordinates: [77.6050, 12.9850] },
  N5: { id: 'N5', name: 'Southern Bypass', coordinates: [77.5900, 12.9650] },
  N6: { id: 'N6', name: 'Commercial Boulevard', coordinates: [77.6100, 12.9700] },
  N7: { id: 'N7', name: 'University Campus Square', coordinates: [77.5900, 12.9900] },
};

const defaultGraph = {
  N1: [
    { node: 'N2', distanceMeters: 650, speedKmh: 50, trafficFactor: 1.0 },
    { node: 'N3', distanceMeters: 950, speedKmh: 40, trafficFactor: 1.2 },
    { node: 'N5', distanceMeters: 800, speedKmh: 60, trafficFactor: 1.0 },
  ],
  N2: [
    { node: 'N1', distanceMeters: 650, speedKmh: 50, trafficFactor: 1.0 },
    { node: 'N4', distanceMeters: 1200, speedKmh: 60, trafficFactor: 1.1 },
    { node: 'N6', distanceMeters: 1100, speedKmh: 50, trafficFactor: 1.5 }, // Congestion segment
  ],
  N3: [
    { node: 'N1', distanceMeters: 950, speedKmh: 40, trafficFactor: 1.2 },
    { node: 'N4', distanceMeters: 1300, speedKmh: 50, trafficFactor: 1.0 },
    { node: 'N7', distanceMeters: 1150, speedKmh: 50, trafficFactor: 1.0 },
  ],
  N4: [
    { node: 'N2', distanceMeters: 1200, speedKmh: 60, trafficFactor: 1.1 },
    { node: 'N3', distanceMeters: 1300, speedKmh: 50, trafficFactor: 1.0 },
    { node: 'N6', distanceMeters: 1400, speedKmh: 60, trafficFactor: 1.0 },
    { node: 'N7', distanceMeters: 1600, speedKmh: 70, trafficFactor: 1.0 },
  ],
  N5: [
    { node: 'N1', distanceMeters: 800, speedKmh: 60, trafficFactor: 1.0 },
    { node: 'N6', distanceMeters: 2100, speedKmh: 60, trafficFactor: 1.2 },
  ],
  N6: [
    { node: 'N2', distanceMeters: 1100, speedKmh: 50, trafficFactor: 1.5 },
    { node: 'N4', distanceMeters: 1400, speedKmh: 60, trafficFactor: 1.0 },
    { node: 'N5', distanceMeters: 2100, speedKmh: 60, trafficFactor: 1.2 },
  ],
  N7: [
    { node: 'N3', distanceMeters: 1150, speedKmh: 50, trafficFactor: 1.0 },
    { node: 'N4', distanceMeters: 1600, speedKmh: 70, trafficFactor: 1.0 },
  ],
};

module.exports = {
  defaultNodes,
  defaultGraph,
};

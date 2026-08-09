/**
 * Calculates fare split and detour surcharges.
 * Rule 2: Shared base fare = Base Fare / Total Passengers
 * Rule 4: Detour Charge = ceil(extraDistanceMeters / 100) * chargePer100m
 * Rule 5: Direct path (detour = 0) = 0 extra charge
 */
const calculateFareWithDetour = ({
  baseFare,
  currentPassengersCount,
  detourDistanceMeters = 0,
  chargePer100m = 5,
  toll = 0,
  waitingMinutes = 0,
  waitingChargePerMinute = 0,
  dynamicMultiplier = 1,
  includedDetourMeters = 500,
}) => {
  if (!Number.isFinite(Number(baseFare)) || Number(baseFare) < 0) {
    throw new Error('Base fare must be a non-negative number.');
  }
  if (!Number.isInteger(Number(currentPassengersCount)) || Number(currentPassengersCount) < 1) {
    throw new Error('At least one passenger is required to calculate a fare.');
  }
  const safeDetour = Math.max(0, Number(detourDistanceMeters) || 0);
  const safeMultiplier = Math.max(1, Number(dynamicMultiplier) || 1);
  const sharedBaseFare = Math.round((Number(baseFare) * safeMultiplier) / currentPassengersCount);

  let detourCharge = 0;
  if (safeDetour > Math.max(0, Number(includedDetourMeters) || 0)) {
    detourCharge = Math.ceil((safeDetour - Math.max(0, Number(includedDetourMeters) || 0)) / 100) *
      Math.max(0, Number(chargePer100m) || 0);
  }
  const tollShare = Math.round(Math.max(0, Number(toll) || 0) / currentPassengersCount);
  const waitingCharge = Math.round(Math.max(0, Number(waitingMinutes) || 0) * Math.max(0, Number(waitingChargePerMinute) || 0));

  return {
    sharedBaseFare,
    detourCharge,
    tollShare,
    waitingCharge,
    totalFareForPassenger: sharedBaseFare + detourCharge + tollShare + waitingCharge,
  };
};

module.exports = { calculateFareWithDetour };
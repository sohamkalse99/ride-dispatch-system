from typing import List, Optional, Tuple

from app.models.models import Driver, RideRequest, RideStatus, Location, DriverStatus


class DispatchService:
    def __init__(self):
        """Initialize the dispatch service with empty state."""
        self.drivers = {}  # driver_id -> Driver
        self.riders = {}  # rider_id -> Rider
        self.ride_requests = {}  # request_id -> RideRequest
        self.active_trips = {}  # request_id -> (driver_id, step)
        
        # Configuration parameters
        self.fairness_weight = 0.3  # Weight for fairness in driver selection
        self.eta_weight = 0.7  # Weight for ETA in driver selection
        self.max_rejection_attempts = 3  # Max number of drivers to try before failing

    def calculate_distance(self, loc1: Location, loc2: Location) -> float:
        """Calculate Manhattan distance between two locations."""
        return abs(loc1.x - loc2.x) + abs(loc1.y - loc2.y)
    
    def calculate_eta(self, driver: Driver, pickup: Location) -> float:
        """Calculate ETA for a driver to reach pickup location."""
        # Using Manhattan distance as ETA (1 unit per tick)
        return self.calculate_distance(driver.location, pickup)
    
    def find_best_driver(self, ride_request: RideRequest) -> Optional[Driver]:
        """
        Find the best available driver for a ride request based on:
        1. ETA (distance to pickup)
        2. Fairness (number of rides previously assigned)
        3. Avoiding drivers who already rejected this request
        """
        available_drivers = [
            d for d in self.drivers.values() 
            if d.status == DriverStatus.AVAILABLE and d.id not in ride_request.rejected_by
        ]
        
        if not available_drivers:
            return None
            
        # Calculate scores for each driver (lower is better)
        driver_scores = []
        
        # Find max values for normalization
        max_eta = 1
        max_rides = 1
        
        for driver in available_drivers:
            eta = self.calculate_eta(driver, ride_request.pickup)
            max_eta = max(max_eta, eta)
            max_rides = max(max_rides, driver.assigned_rides)
        
        for driver in available_drivers:
            eta = self.calculate_eta(driver, ride_request.pickup)
            # Normalize ETA and assigned_rides to [0,1] range
            normalized_eta = eta / max_eta if max_eta > 0 else 0
            normalized_rides = driver.assigned_rides / max_rides if max_rides > 0 else 0
            
            # Calculate weighted score (lower is better)
            score = (
                self.eta_weight * normalized_eta +
                self.fairness_weight * (1 - normalized_rides)  # Invert so fewer rides = better score
            )
            
            driver_scores.append((driver, score))
        
        # Sort by score (lower is better)
        driver_scores.sort(key=lambda x: x[1])
        
        # Return the best driver
        return driver_scores[0][0] if driver_scores else None
    
    def assign_ride(self, ride_request_id: str) -> Tuple[bool, str]:
        """
        Attempt to assign a ride request to the best available driver.
        Returns a tuple of (success, message)
        """
        ride_request = self.ride_requests.get(ride_request_id)
        if not ride_request:
            return False, f"Ride request {ride_request_id} not found"
        
        # Skip if already assigned or completed
        if ride_request.status in [RideStatus.ASSIGNED, RideStatus.COMPLETED]:
            return False, f"Ride request {ride_request_id} is already {ride_request.status}"
        
        best_driver = self.find_best_driver(ride_request)
        if not best_driver:
            # If too many rejections or no available drivers
            if len(ride_request.rejected_by) >= self.max_rejection_attempts:
                ride_request.status = RideStatus.FAILED
                return False, f"No available drivers for ride {ride_request_id}"
            return False, "No available drivers at the moment"
        
        # Simulate driver acceptance/rejection (for now, always accept)
        # In a real implementation, this would be a separate endpoint
        accepted = True
        
        if accepted:
            # Update ride and driver status
            ride_request.status = RideStatus.ASSIGNED
            ride_request.assigned_driver_id = best_driver.id
            
            best_driver.status = DriverStatus.ON_TRIP
            best_driver.assigned_rides += 1
            
            # Track active trip
            self.active_trips[ride_request_id] = (best_driver.id, "to_pickup")
            
            return True, f"Ride {ride_request_id} assigned to driver {best_driver.id}"
        else:
            # If rejected, add to rejected_by list and try again
            ride_request.rejected_by.append(best_driver.id)
            return self.assign_ride(ride_request_id)
    
    def simulate_driver_decision(self, driver_id: str, ride_request_id: str) -> bool:
        """
        Simulate whether a driver accepts or rejects a ride.
        This can be extended with more complex logic based on:
        - Distance to pickup
        - Trip length
        - Driver preferences
        - Time of day
        - etc.
        
        For now, we'll use a simple implementation where drivers reject 
        if they've already rejected too many rides recently.
        """
        driver = self.drivers.get(driver_id)
        ride_request = self.ride_requests.get(ride_request_id)
        
        if not driver or not ride_request:
            return False
            
        # Calculate pickup distance
        pickup_distance = self.calculate_distance(driver.location, ride_request.pickup)
        
        # For now, simple logic: reject if pickup is too far (> 20 units)
        # In a real implementation, this would depend on various factors
        if pickup_distance > 20:
            if ride_request_id not in driver.rejected_rides:
                driver.rejected_rides.append(ride_request_id)
            return False
        
        return True
    
    def tick(self) -> List[dict]:
        """
        Advance the simulation by one time step.
        Returns a list of events that occurred during this tick.
        """
        events = []
        
        # Process active trips
        trips_to_remove = []
        
        for request_id, (driver_id, step) in self.active_trips.items():
            driver = self.drivers.get(driver_id)
            request = self.ride_requests.get(request_id)
            
            if not driver or not request:
                continue
                
            if step == "to_pickup":
                # Driver is heading to pickup
                if self._move_towards(driver, request.pickup):
                    # Arrived at pickup
                    events.append({
                        "type": "pickup",
                        "ride_id": request_id,
                        "driver_id": driver_id,
                        "location": {"x": driver.location.x, "y": driver.location.y}
                    })
                    self.active_trips[request_id] = (driver_id, "to_dropoff")
                
            elif step == "to_dropoff":
                # Driver is heading to dropoff
                if self._move_towards(driver, request.dropoff):
                    # Arrived at dropoff, ride is complete
                    events.append({
                        "type": "dropoff",
                        "ride_id": request_id,
                        "driver_id": driver_id,
                        "location": {"x": driver.location.x, "y": driver.location.y}
                    })
                    
                    # Update statuses
                    request.status = RideStatus.COMPLETED
                    driver.status = DriverStatus.AVAILABLE
                    
                    # Remove from active trips
                    trips_to_remove.append(request_id)
        
        # Clean up completed trips
        for request_id in trips_to_remove:
            self.active_trips.pop(request_id, None)
            
        return events
    
    def _move_towards(self, driver: Driver, target: Location) -> bool:
        """
        Move driver one step towards the target location.
        Returns True if driver reached the target, False otherwise.
        """
        # Calculate direction
        dx = target.x - driver.location.x
        dy = target.y - driver.location.y
        
        # Move in x direction first, then y (Manhattan style)
        if dx != 0:
            # Move one step in x direction
            driver.location.x += 1 if dx > 0 else -1
        elif dy != 0:
            # Move one step in y direction
            driver.location.y += 1 if dy > 0 else -1
            
        # Check if we've reached the target
        return driver.location.x == target.x and driver.location.y == target.y

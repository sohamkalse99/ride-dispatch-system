from fastapi import APIRouter, HTTPException, Body, Query, Depends
from typing import Dict, List, Optional
import uuid

from app.models.models import Driver, Rider, RideRequest, Location, DriverStatus, RideStatus
from app.services.dispatch import DispatchService

router = APIRouter()

# Create a global instance of the dispatch service
dispatch_service = DispatchService()


@router.get("/")
def health_check():
    """Simple health check endpoint."""
    return {"status": "ok"}


@router.get("/grid-info")
def get_grid_info():
    """Get information about the grid dimensions."""
    return {"width": 100, "height": 100}


# Driver endpoints
@router.post("/drivers/", response_model=Driver)
def create_driver(location: Location = Body(...)):
    """Create a new driver at the specified location."""
    driver_id = f"driver_{uuid.uuid4().hex[:8]}"
    driver = Driver(
        id=driver_id,
        location=location,
        status=DriverStatus.AVAILABLE
    )
    dispatch_service.drivers[driver_id] = driver
    return driver


@router.get("/drivers/", response_model=List[Driver])
def get_all_drivers():
    """Get all drivers in the system."""
    return list(dispatch_service.drivers.values())


@router.get("/drivers/{driver_id}", response_model=Driver)
def get_driver(driver_id: str):
    """Get a specific driver by ID."""
    if driver_id not in dispatch_service.drivers:
        raise HTTPException(status_code=404, detail="Driver not found")
    return dispatch_service.drivers[driver_id]


@router.delete("/drivers/{driver_id}")
def delete_driver(driver_id: str):
    """Remove a driver from the system."""
    if driver_id not in dispatch_service.drivers:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Check if driver is on a trip
    if dispatch_service.drivers[driver_id].status == DriverStatus.ON_TRIP:
        raise HTTPException(status_code=400, detail="Cannot remove driver who is on a trip")
    
    del dispatch_service.drivers[driver_id]
    return {"message": f"Driver {driver_id} removed"}


@router.put("/drivers/{driver_id}/status")
def update_driver_status(driver_id: str, status: DriverStatus):
    """Update a driver's status."""
    if driver_id not in dispatch_service.drivers:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    # Prevent changing status if driver is on a trip
    if dispatch_service.drivers[driver_id].status == DriverStatus.ON_TRIP and status != DriverStatus.ON_TRIP:
        raise HTTPException(status_code=400, detail="Cannot change status of driver who is on a trip")
    
    dispatch_service.drivers[driver_id].status = status
    return {"message": f"Driver {driver_id} status updated to {status}"}


# Rider endpoints
@router.post("/riders/", response_model=Rider)
def create_rider(location: Location = Body(...)):
    """Create a new rider at the specified location."""
    rider_id = f"rider_{uuid.uuid4().hex[:8]}"
    rider = Rider(
        id=rider_id,
        location=location
    )
    dispatch_service.riders[rider_id] = rider
    return rider


@router.get("/riders/", response_model=List[Rider])
def get_all_riders():
    """Get all riders in the system."""
    return list(dispatch_service.riders.values())


@router.get("/riders/{rider_id}", response_model=Rider)
def get_rider(rider_id: str):
    """Get a specific rider by ID."""
    if rider_id not in dispatch_service.riders:
        raise HTTPException(status_code=404, detail="Rider not found")
    return dispatch_service.riders[rider_id]


@router.delete("/riders/{rider_id}")
def delete_rider(rider_id: str):
    """Remove a rider from the system."""
    if rider_id not in dispatch_service.riders:
        raise HTTPException(status_code=404, detail="Rider not found")
    
    # Check if rider has an active ride request
    for request in dispatch_service.ride_requests.values():
        if request.rider_id == rider_id and request.status in [RideStatus.WAITING, RideStatus.ASSIGNED]:
            raise HTTPException(status_code=400, detail="Cannot remove rider with active ride request")
    
    del dispatch_service.riders[rider_id]
    return {"message": f"Rider {rider_id} removed"}


# Ride request endpoints
@router.post("/rides/request", response_model=RideRequest)
def request_ride(rider_id: str = Body(...), pickup: Location = Body(...), dropoff: Location = Body(...)):
    """Create a new ride request."""
    if rider_id not in dispatch_service.riders:
        raise HTTPException(status_code=404, detail="Rider not found")
    
    # Check if rider already has an active request
    for request in dispatch_service.ride_requests.values():
        if request.rider_id == rider_id and request.status in [RideStatus.WAITING, RideStatus.ASSIGNED]:
            raise HTTPException(status_code=400, detail="Rider already has an active request")
    
    request_id = f"ride_{uuid.uuid4().hex[:8]}"
    ride_request = RideRequest(
        id=request_id,
        rider_id=rider_id,
        pickup=pickup,
        dropoff=dropoff,
        status=RideStatus.WAITING
    )
    dispatch_service.ride_requests[request_id] = ride_request
    
    # Try to assign a driver
    success, message = dispatch_service.assign_ride(request_id)
    
    return ride_request


@router.get("/rides/", response_model=List[RideRequest])
def get_all_rides():
    """Get all ride requests in the system."""
    return list(dispatch_service.ride_requests.values())


@router.get("/rides/{ride_id}", response_model=RideRequest)
def get_ride(ride_id: str):
    """Get a specific ride request by ID."""
    if ride_id not in dispatch_service.ride_requests:
        raise HTTPException(status_code=404, detail="Ride request not found")
    return dispatch_service.ride_requests[ride_id]


@router.put("/rides/{ride_id}/accept")
def accept_ride(ride_id: str, driver_id: str = Body(...)):
    """Driver accepts a ride request."""
    if ride_id not in dispatch_service.ride_requests:
        raise HTTPException(status_code=404, detail="Ride request not found")
    if driver_id not in dispatch_service.drivers:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    ride_request = dispatch_service.ride_requests[ride_id]
    driver = dispatch_service.drivers[driver_id]
    
    if ride_request.status != RideStatus.WAITING:
        raise HTTPException(status_code=400, detail=f"Ride is not in waiting status (current: {ride_request.status})")
    
    if driver.status != DriverStatus.AVAILABLE:
        raise HTTPException(status_code=400, detail=f"Driver is not available (current: {driver.status})")
    
    # Update statuses
    ride_request.status = RideStatus.ASSIGNED
    ride_request.assigned_driver_id = driver_id
    driver.status = DriverStatus.ON_TRIP
    driver.assigned_rides += 1
    
    # Track active trip
    dispatch_service.active_trips[ride_id] = (driver_id, "to_pickup")
    
    return {"message": f"Driver {driver_id} accepted ride {ride_id}"}


@router.put("/rides/{ride_id}/reject")
def reject_ride(ride_id: str, driver_id: str = Body(...)):
    """Driver rejects a ride request."""
    if ride_id not in dispatch_service.ride_requests:
        raise HTTPException(status_code=404, detail="Ride request not found")
    if driver_id not in dispatch_service.drivers:
        raise HTTPException(status_code=404, detail="Driver not found")
    
    ride_request = dispatch_service.ride_requests[ride_id]
    driver = dispatch_service.drivers[driver_id]
    
    if ride_request.status != RideStatus.WAITING:
        raise HTTPException(status_code=400, detail=f"Ride is not in waiting status (current: {ride_request.status})")
    
    # Add driver to rejected list
    if driver_id not in ride_request.rejected_by:
        ride_request.rejected_by.append(driver_id)
    
    # Add ride to driver's rejected rides
    if ride_id not in driver.rejected_rides:
        driver.rejected_rides.append(ride_id)
    
    # Try to find another driver
    success, message = dispatch_service.assign_ride(ride_id)
    
    if not success and ride_request.status == RideStatus.FAILED:
        return {"message": "No available drivers to fulfill this request", "status": "failed"}
    
    return {"message": f"Driver {driver_id} rejected ride {ride_id}, finding another driver", "status": "reassigning"}


@router.put("/rides/{ride_id}/cancel")
def cancel_ride(ride_id: str):
    """Cancel a ride request."""
    if ride_id not in dispatch_service.ride_requests:
        raise HTTPException(status_code=404, detail="Ride request not found")
    
    ride_request = dispatch_service.ride_requests[ride_id]
    
    # Only allow cancellation of waiting or assigned rides
    if ride_request.status not in [RideStatus.WAITING, RideStatus.ASSIGNED]:
        raise HTTPException(status_code=400, detail=f"Cannot cancel ride with status: {ride_request.status}")
    
    # If ride was assigned to a driver, free up the driver
    if ride_request.status == RideStatus.ASSIGNED and ride_request.assigned_driver_id:
        driver_id = ride_request.assigned_driver_id
        if driver_id in dispatch_service.drivers:
            driver = dispatch_service.drivers[driver_id]
            driver.status = DriverStatus.AVAILABLE
            # Decrease assigned rides count since this ride is being cancelled
            if driver.assigned_rides > 0:
                driver.assigned_rides -= 1
        
        # Remove from active trips if it was there
        if ride_id in dispatch_service.active_trips:
            del dispatch_service.active_trips[ride_id]
    
    # Mark ride as cancelled (we'll use FAILED status for cancelled rides)
    ride_request.status = RideStatus.FAILED
    ride_request.assigned_driver_id = None
    
    return {"message": f"Ride {ride_id} has been cancelled successfully"}


# Simulation endpoints
@router.post("/tick")
def advance_simulation():
    """Advance the simulation by one time step."""
    events = dispatch_service.tick()
    return {"message": "Advanced simulation by one tick", "events": events}


@router.get("/state")
def get_system_state():
    """Get the current state of the entire system."""
    return {
        "drivers": list(dispatch_service.drivers.values()),
        "riders": list(dispatch_service.riders.values()),
        "ride_requests": list(dispatch_service.ride_requests.values()),
        "active_trips": [
            {
                "ride_id": ride_id,
                "driver_id": driver_id,
                "step": step
            }
            for ride_id, (driver_id, step) in dispatch_service.active_trips.items()
        ]
    }

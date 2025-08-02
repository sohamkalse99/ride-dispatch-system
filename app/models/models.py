from enum import Enum
from pydantic import BaseModel
from typing import List, Optional, Dict


class DriverStatus(str, Enum):
    AVAILABLE = "available"
    ON_TRIP = "on_trip"
    OFFLINE = "offline"


class RideStatus(str, Enum):
    WAITING = "waiting"
    ASSIGNED = "assigned"
    REJECTED = "rejected"
    COMPLETED = "completed"
    FAILED = "failed"


class Location(BaseModel):
    x: int
    y: int


class Driver(BaseModel):
    id: str
    location: Location
    status: DriverStatus
    assigned_rides: int = 0  # Track number of rides for fairness
    rejected_rides: List[str] = []  # Track rejected ride IDs


class Rider(BaseModel):
    id: str
    location: Location


class RideRequest(BaseModel):
    id: str
    rider_id: str
    pickup: Location
    dropoff: Location
    status: RideStatus
    assigned_driver_id: Optional[str] = None
    rejected_by: List[str] = []  # List of driver IDs who rejected this ride

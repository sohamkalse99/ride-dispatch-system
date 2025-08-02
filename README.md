# 🛺 Ride Dispatch System

A simplified ride-hailing backend system using FastAPI, with a frontend to visualize and simulate the system. The platform operates in a grid-based city where riders request rides, and drivers are dispatched based on ETA, fairness, and efficiency.

## 🚀 Features

- FastAPI backend to manage the city grid, drivers, riders, and ride requests
- Intelligent dispatch logic to assign drivers to ride requests
- Fallback mechanism when drivers reject rides
- Simple frontend UI to:
  - Visualize the grid
  - Add/remove drivers and riders
  - Request rides
  - Advance simulated time (tick)
  - See current system state

## 🧪 Technical Implementation

### System Architecture

- **Backend**: FastAPI for the REST API, in-memory storage for simplicity
- **Frontend**: Vanilla HTML, CSS, JavaScript for the UI
- **Simulation**: Grid-based movement with manual time advancement

### Key Components

- **City Grid**: A 100x100 grid where drivers and riders exist
- **Entities**: Drivers, Riders, and Ride Requests with appropriate status tracking
- **Dispatch Logic**: Multi-factor algorithm for optimal driver assignment

## 🚗 Dispatch Logic Explained

The dispatch logic in this system is designed to balance multiple goals:

1. **Low ETA**: Prioritizes assigning drivers who are closest to the pickup location
2. **Fairness**: Ensures equitable distribution of rides among drivers
3. **Efficiency**: Maximizes fulfilled rides and minimizes idle drivers
4. **Fallbacks**: Implements retry logic when drivers reject ride requests

### How It Works

The dispatch algorithm uses a weighted scoring system:

- **ETA Score (70%)**: Based on Manhattan distance between driver and pickup location
- **Fairness Score (30%)**: Based on number of previously assigned rides
- Each available driver receives a composite score, and the driver with the lowest score is selected
- If a driver rejects a ride, they're added to a rejection list and the next best driver is selected
- After a configurable number of rejections (default: 3), the ride request is marked as failed

### Driver Acceptance/Rejection Model

In this simulation, drivers may reject rides based on:
- Distance to pickup location (if > 20 grid units)

This could be extended to consider:
- Trip length
- Driver preferences
- Time of day
- Historical patterns

## 🏃‍♂️ How to Run the System

### Prerequisites

- Python 3.8+
- A modern web browser

### Backend Setup

1. Clone this repository
2. Create and activate a virtual environment (recommended):
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Start the backend server:
   ```bash
   cd /path/to/ride-dispatch-system
   uvicorn app.main:app --reload
   ```
   The API will be available at http://localhost:8000

### Frontend Setup

Simply open the `frontend/index.html` file in a web browser.

## 📝 API Documentation

Once the backend is running, visit http://localhost:8000/docs for the interactive API documentation.

### Key Endpoints

- `POST /drivers/`: Add a new driver
- `POST /riders/`: Add a new rider
- `POST /rides/request`: Request a new ride
- `POST /tick`:  one time step
- `GET /state`: Get current system state

## 📊 System Usage

1. Add drivers to the system using the "Add Driver" form
2. Add riders using the "Add Rider" form
3. Select a rider and set pickup/dropoff locations to request a ride
4. Use the "Next Tick" button to advance time and see drivers moving
5. Monitor the system state tables to see the status of drivers, riders, and rides

## 🔧 Assumptions and Simplifications

- **Movement**: Drivers move at a constant rate of 1 grid unit per tick
- **Time**: Time advances manually through the `/tick` endpoint
- **Storage**: All data is stored in-memory; no persistence between server restarts
- **Driver Behavior**: A simple model is used where drivers reject rides if pickup is > 20 units away
- **Path Finding**: Movement follows Manhattan distance (horizontal then vertical)
- **Grid Size**: Fixed at 100x100

## 🔄 Extensibility Considerations

The system is designed to be extensible in several ways:

- The dispatch algorithm weights can be adjusted
- Additional driver decision factors could be introduced
- The grid size and movement speed could be parameterized
- Persistence could be added with minimal changes to the service layer
- Real-time updates could be implemented using WebSockets

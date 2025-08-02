// Configuration
// const API_URL = 'http://localhost:8000';
const API_URL = window.location.origin;
const GRID_SIZE = 100;
const GRID_SCALE = 6; // 6px per grid unit

// State variables
let drivers = [];
let riders = [];
let rideRequests = [];
let activeTrips = [];
let gridElement;

// State for grid interaction
let gridMode = 'none'; // 'driver', 'rider', or 'none'

// Loading state management
let isLoading = false;

// Enhanced notification system with animations
function showNotification(message, type = 'info', duration = 3000) {
    // Remove existing notifications with fade out
    const existingNotifications = document.querySelectorAll('.notification');
    existingNotifications.forEach(n => {
        n.style.opacity = '0';
        n.style.transform = 'translateX(100%)';
        setTimeout(() => n.remove(), 300);
    });
    
    const notification = document.createElement('div');
    notification.className = 'notification';
    notification.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 16px 24px;
        border-radius: 12px;
        color: white;
        font-weight: 600;
        z-index: 1000;
        max-width: 350px;
        word-wrap: break-word;
        box-shadow: 0 8px 32px rgba(0,0,0,0.2);
        backdrop-filter: blur(10px);
        border: 1px solid rgba(255,255,255,0.1);
        transform: translateX(100%);
        opacity: 0;
        transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
    `;
    
    // Set background color based on type with gradients
    const colors = {
        'success': 'linear-gradient(135deg, #27ae60, #2ecc71)',
        'error': 'linear-gradient(135deg, #e74c3c, #c0392b)',
        'warning': 'linear-gradient(135deg, #f39c12, #e67e22)',
        'info': 'linear-gradient(135deg, #3498db, #2980b9)'
    };
    notification.style.background = colors[type] || colors['info'];
    
    // Add icon based on type
    const icons = {
        'success': '✓',
        'error': '✕',
        'warning': '⚠',
        'info': 'ℹ'
    };
    notification.innerHTML = `<span style="margin-right: 8px; font-size: 1.2em;">${icons[type] || icons['info']}</span>${message}`;
    
    document.body.appendChild(notification);
    
    // Animate in
    requestAnimationFrame(() => {
        notification.style.transform = 'translateX(0)';
        notification.style.opacity = '1';
    });
    
    // Auto remove with animation
    setTimeout(() => {
        if (notification.parentNode) {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => notification.remove(), 400);
        }
    }, duration);
}

// Loading overlay functions
function showLoadingOverlay(message = 'Loading...') {
    if (isLoading) return;
    isLoading = true;
    
    const overlay = document.createElement('div');
    overlay.id = 'loading-overlay';
    overlay.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.7);
        display: flex;
        align-items: center;
        justify-content: center;
        z-index: 2000;
        opacity: 0;
        transition: opacity 0.3s ease;
    `;
    
    overlay.innerHTML = `
        <div style="
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            padding: 30px 40px;
            border-radius: 16px;
            color: white;
            text-align: center;
            box-shadow: 0 20px 40px rgba(0,0,0,0.3);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255,255,255,0.1);
        ">
            <div style="
                width: 40px;
                height: 40px;
                border: 4px solid rgba(255,255,255,0.3);
                border-top: 4px solid white;
                border-radius: 50%;
                animation: spin 1s linear infinite;
                margin: 0 auto 15px;
            "></div>
            <div style="font-weight: 600; font-size: 16px;">${message}</div>
        </div>
        <style>
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        </style>
    `;
    
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.style.opacity = '1');
}

function hideLoadingOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.style.opacity = '0';
        setTimeout(() => {
            overlay.remove();
            isLoading = false;
        }, 300);
    }
}

// Enhanced entity animation functions
function animateEntityMovement(element, fromX, fromY, toX, toY, duration = 800) {
    const startTime = performance.now();
    const deltaX = toX - fromX;
    const deltaY = toY - fromY;
    
    function animate(currentTime) {
        const elapsed = currentTime - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // Easing function for smooth movement
        const easeProgress = 1 - Math.pow(1 - progress, 3);
        
        const currentX = fromX + (deltaX * easeProgress);
        const currentY = fromY + (deltaY * easeProgress);
        
        element.style.left = `${currentX * GRID_SCALE}px`;
        element.style.top = `${currentY * GRID_SCALE}px`;
        
        if (progress < 1) {
            requestAnimationFrame(animate);
        }
    }
    
    requestAnimationFrame(animate);
}

// Initialize the application
window.addEventListener('load', () => {
    // Get DOM elements
    gridElement = document.getElementById('grid');
    
    // Set up event listeners
    document.getElementById('tickButton').addEventListener('click', advanceSimulation);
    document.getElementById('addDriverButton').addEventListener('click', addDriver);
    document.getElementById('addRiderButton').addEventListener('click', addRider);
    document.getElementById('requestRideButton').addEventListener('click', requestRide);
    document.getElementById('riderSelect').addEventListener('change', onRiderSelectionChange);
    
    // Add grid click functionality
    gridElement.addEventListener('click', handleGridClick);
    
    // Add mode toggle buttons
    addModeToggleButtons();

    // Initialize the grid
    initGrid();

    // Load initial state
    refreshState();
});

// Add mode toggle buttons to the grid panel
function addModeToggleButtons() {
    const gridPanel = gridElement.parentElement;
    const modeContainer = document.createElement('div');
    modeContainer.style.marginBottom = '20px';
    modeContainer.style.padding = '15px';
    modeContainer.style.background = '#f8f9fa';
    modeContainer.style.borderRadius = '10px';
    modeContainer.style.borderLeft = '4px solid #3498db';
    
    const modeLabel = document.createElement('p');
    modeLabel.innerHTML = '<strong>🎯 Grid Interaction Mode:</strong>';
    modeLabel.style.margin = '0 0 15px 0';
    modeLabel.style.color = '#2c3e50';
    modeContainer.appendChild(modeLabel);
    
    const buttonContainer = document.createElement('div');
    buttonContainer.style.display = 'flex';
    buttonContainer.style.gap = '10px';
    buttonContainer.style.flexWrap = 'wrap';
    
    const driverModeBtn = document.createElement('button');
    driverModeBtn.innerHTML = '🚙 Add Driver';
    driverModeBtn.id = 'driverModeBtn';
    driverModeBtn.className = 'primary-btn';
    driverModeBtn.style.fontSize = '12px';
    driverModeBtn.addEventListener('click', () => setGridMode('driver'));
    
    const riderModeBtn = document.createElement('button');
    riderModeBtn.innerHTML = '🚶 Add Rider';
    riderModeBtn.id = 'riderModeBtn';
    riderModeBtn.className = 'success-btn';
    riderModeBtn.style.fontSize = '12px';
    riderModeBtn.addEventListener('click', () => setGridMode('rider'));
    
    const noneModeBtn = document.createElement('button');
    noneModeBtn.innerHTML = '👁️ View Only';
    noneModeBtn.id = 'noneModeBtn';
    noneModeBtn.className = 'secondary-btn';
    noneModeBtn.style.fontSize = '12px';
    noneModeBtn.addEventListener('click', () => setGridMode('none'));
    
    buttonContainer.appendChild(driverModeBtn);
    buttonContainer.appendChild(riderModeBtn);
    buttonContainer.appendChild(noneModeBtn);
    modeContainer.appendChild(buttonContainer);
    
    const modeStatus = document.createElement('p');
    modeStatus.id = 'modeStatus';
    modeStatus.innerHTML = '📍 Current mode: <strong>View Only</strong>';
    modeStatus.style.margin = '15px 0 0 0';
    modeStatus.style.fontSize = '0.9em';
    modeStatus.style.color = '#6c757d';
    modeContainer.appendChild(modeStatus);
    
    gridPanel.insertBefore(modeContainer, gridElement);
}

// Set grid interaction mode
function setGridMode(mode) {
    gridMode = mode;
    const modeStatus = document.getElementById('modeStatus');
    const buttons = ['driverModeBtn', 'riderModeBtn', 'noneModeBtn'];
    
    // Reset button styles
    buttons.forEach(btnId => {
        const btn = document.getElementById(btnId);
        btn.style.opacity = '0.7';
        btn.style.transform = 'scale(1)';
    });
    
    // Highlight active button and update status
    switch(mode) {
        case 'driver':
            const driverBtn = document.getElementById('driverModeBtn');
            driverBtn.style.opacity = '1';
            driverBtn.style.transform = 'scale(1.05)';
            modeStatus.innerHTML = '📍 Current mode: <strong>Click grid to add Driver 🚙</strong>';
            gridElement.style.cursor = 'crosshair';
            showNotification('Driver mode activated! Click anywhere on the grid to add drivers.', 'info');
            break;
        case 'rider':
            const riderBtn = document.getElementById('riderModeBtn');
            riderBtn.style.opacity = '1';
            riderBtn.style.transform = 'scale(1.05)';
            modeStatus.innerHTML = '📍 Current mode: <strong>Click grid to add Rider 🚶</strong>';
            gridElement.style.cursor = 'crosshair';
            showNotification('Rider mode activated! Click anywhere on the grid to add riders.', 'info');
            break;
        default:
            const viewBtn = document.getElementById('noneModeBtn');
            viewBtn.style.opacity = '1';
            viewBtn.style.transform = 'scale(1.05)';
            modeStatus.innerHTML = '📍 Current mode: <strong>View Only 👁️</strong>';
            gridElement.style.cursor = 'default';
    }
}

// Handle grid clicks
function handleGridClick(event) {
    if (gridMode === 'none') return;
    
    const rect = gridElement.getBoundingClientRect();
    const x = Math.floor((event.clientX - rect.left) / GRID_SCALE);
    const y = Math.floor((event.clientY - rect.top) / GRID_SCALE);
    
    // Ensure coordinates are within bounds
    if (x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) return;
    
    if (gridMode === 'driver') {
        addDriverAtPosition(x, y);
    } else if (gridMode === 'rider') {
        addRiderAtPosition(x, y);
    }
}

// Initialize the grid
function initGrid() {
    gridElement.style.width = `${GRID_SIZE * GRID_SCALE}px`;
    gridElement.style.height = `${GRID_SIZE * GRID_SCALE}px`;
    gridElement.style.position = 'relative';
    gridElement.style.backgroundColor = '#f8f9fa';
    
    // Add grid lines for better visualization
    const gridOverlay = document.createElement('div');
    gridOverlay.style.position = 'absolute';
    gridOverlay.style.top = '0';
    gridOverlay.style.left = '0';
    gridOverlay.style.width = '100%';
    gridOverlay.style.height = '100%';
    gridOverlay.style.pointerEvents = 'none';
    gridOverlay.style.backgroundImage = `
        linear-gradient(to right, #ddd 1px, transparent 1px),
        linear-gradient(to bottom, #ddd 1px, transparent 1px)
    `;
    gridOverlay.style.backgroundSize = `${GRID_SCALE * 10}px ${GRID_SCALE * 10}px`;
    gridElement.appendChild(gridOverlay);
}

// Enhanced refresh system state with loading feedback
async function refreshState(showLoading = false) {
    try {
        if (showLoading) {
            showLoadingOverlay('Refreshing system state...');
        }
        
        const [driversRes, ridersRes, ridesRes, stateRes] = await Promise.all([
            fetch(`${API_URL}/api/drivers/`),
            fetch(`${API_URL}/api/riders/`),
            fetch(`${API_URL}/api/rides/`),
            fetch(`${API_URL}/api/state`)
        ]);
        
        if (!driversRes.ok || !ridersRes.ok || !ridesRes.ok || !stateRes.ok) {
            throw new Error('Failed to fetch system data');
        }
        
        drivers = await driversRes.json();
        riders = await ridersRes.json();
        rideRequests = await ridesRes.json();
        const systemState = await stateRes.json();
        activeTrips = systemState.active_trips || [];
        
        updateGridVisualization();
        updateDriversTable();
        updateRidersTable();
        updateRidesTable();
        updateRiderSelect();
        
        if (showLoading) {
            hideLoadingOverlay();
        }
    } catch (error) {
        console.error('Error refreshing state:', error);
        if (showLoading) {
            hideLoadingOverlay();
        }
        showNotification('Failed to refresh system state', 'error');
    }
}

// Update the grid visualization
function updateGridVisualization() {
    // Clear existing elements
    gridElement.innerHTML = '';
    
    // Draw drivers
    drivers.forEach(driver => {
        const driverElement = document.createElement('div');
        driverElement.className = `entity driver ${driver.status}`;
        driverElement.style.left = `${driver.location.x * GRID_SCALE}px`;
        driverElement.style.top = `${driver.location.y * GRID_SCALE}px`;
        driverElement.title = `Driver ${driver.id} (${driver.status})`;
        gridElement.appendChild(driverElement);
    });
    
    // Draw riders
    riders.forEach(rider => {
        const riderElement = document.createElement('div');
        riderElement.className = 'entity rider';
        riderElement.style.left = `${rider.location.x * GRID_SCALE}px`;
        riderElement.style.top = `${rider.location.y * GRID_SCALE}px`;
        riderElement.title = `Rider ${rider.id}`;
        gridElement.appendChild(riderElement);
    });
    
    // Draw ride requests (pickup and dropoff locations)
    rideRequests.forEach(ride => {
        // Only show active rides
        if (['waiting', 'assigned'].includes(ride.status)) {
            // Draw pickup point
            const pickupElement = document.createElement('div');
            pickupElement.className = 'entity pickup';
            pickupElement.style.left = `${ride.pickup.x * GRID_SCALE}px`;
            pickupElement.style.top = `${ride.pickup.y * GRID_SCALE}px`;
            pickupElement.title = `Pickup for ride ${ride.id}`;
            gridElement.appendChild(pickupElement);
            
            // Draw dropoff point
            const dropoffElement = document.createElement('div');
            dropoffElement.className = 'entity dropoff';
            dropoffElement.style.left = `${ride.dropoff.x * GRID_SCALE}px`;
            dropoffElement.style.top = `${ride.dropoff.y * GRID_SCALE}px`;
            dropoffElement.title = `Dropoff for ride ${ride.id}`;
            gridElement.appendChild(dropoffElement);
            
            // Draw path between pickup and dropoff
            drawPath(ride.pickup, ride.dropoff);
        }
    });
}

// Draw a path between two points using small dots
function drawPath(start, end) {
    // Calculate Manhattan path (horizontal then vertical)
    const horizontalDistance = end.x - start.x;
    const verticalDistance = end.y - start.y;
    
    // Draw horizontal segment
    for (let i = 0; i <= Math.abs(horizontalDistance); i++) {
        const x = start.x + (horizontalDistance > 0 ? i : -i);
        const pathElement = document.createElement('div');
        pathElement.className = 'entity path';
        pathElement.style.left = `${x * GRID_SCALE}px`;
        pathElement.style.top = `${start.y * GRID_SCALE}px`;
        gridElement.appendChild(pathElement);
    }
    
    // Draw vertical segment
    for (let i = 0; i <= Math.abs(verticalDistance); i++) {
        const y = end.y - (verticalDistance > 0 ? i : -i);
        const pathElement = document.createElement('div');
        pathElement.className = 'entity path';
        pathElement.style.left = `${end.x * GRID_SCALE}px`;
        pathElement.style.top = `${y * GRID_SCALE}px`;
        gridElement.appendChild(pathElement);
    }
}

// Update the drivers table
function updateDriversTable() {
    const container = document.getElementById('driversTable');
    
    if (drivers.length === 0) {
        container.innerHTML = '<p>No drivers available</p>';
        return;
    }
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Position</th>
                    <th>Status</th>
                    <th>Rides</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    drivers.forEach(driver => {
        const statusClass = `status-badge status-${driver.status}`;
        
        html += `
            <tr>
                <td>${driver.id}</td>
                <td>(${driver.location.x}, ${driver.location.y})</td>
                <td><span class="${statusClass}">${driver.status}</span></td>
                <td>${driver.assigned_rides}</td>
                <td>
                    ${driver.status !== 'on_trip' ? 
                        `<button onclick="removeDriver('${driver.id}')">Remove</button>` : 
                        'On Trip'
                    }
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

// Update the riders table
function updateRidersTable() {
    const container = document.getElementById('ridersTable');
    
    if (riders.length === 0) {
        container.innerHTML = '<p>No riders available</p>';
        return;
    }
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>ID</th>
                    <th>Position</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    riders.forEach(rider => {
        // Check if rider has an active request
        const hasActiveRequest = rideRequests.some(
            ride => ride.rider_id === rider.id && 
            ['waiting', 'assigned'].includes(ride.status)
        );
        
        html += `
            <tr>
                <td>${rider.id}</td>
                <td>(${rider.location.x}, ${rider.location.y})</td>
                <td>
                    ${!hasActiveRequest ? 
                        `<button onclick="removeRider('${rider.id}')">Remove</button>` : 
                        'Has Active Request'
                    }
                </td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

// Update the rides table
function updateRidesTable() {
    const container = document.getElementById('ridesTable');
    
    if (rideRequests.length === 0) {
        container.innerHTML = '<p style="color: #666; font-style: italic;">No ride requests</p>';
        return;
    }
    
    let html = `
        <table>
            <thead>
                <tr>
                    <th>Ride ID</th>
                    <th>Rider</th>
                    <th>Pickup</th>
                    <th>Dropoff</th>
                    <th>Status</th>
                    <th>Driver</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
    `;
    
    rideRequests.forEach(ride => {
        const statusClass = `status-${ride.status.replace('_', '')}`;
        const canCancel = ride.status === 'waiting' || ride.status === 'assigned';
        const cancelButton = canCancel ? 
            `<button onclick="cancelRide('${ride.id}')" class="danger-btn" style="padding: 4px 8px; font-size: 11px; margin: 0;">❌ Cancel</button>` : 
            '<span style="color: #999; font-size: 11px;">N/A</span>';
        
        html += `
            <tr>
                <td>${ride.id}</td>
                <td>${ride.rider_id}</td>
                <td>(${ride.pickup.x}, ${ride.pickup.y})</td>
                <td>(${ride.dropoff.x}, ${ride.dropoff.y})</td>
                <td><span class="status-badge ${statusClass}">${ride.status}</span></td>
                <td>${ride.assigned_driver_id || 'None'}</td>
                <td>${cancelButton}</td>
            </tr>
        `;
    });
    
    html += `
            </tbody>
        </table>
    `;
    
    container.innerHTML = html;
}

// Handle rider selection change
function onRiderSelectionChange() {
    const riderSelect = document.getElementById('riderSelect');
    const selectedRiderId = riderSelect.value;
    
    if (selectedRiderId) {
        // Find the selected rider
        const selectedRider = riders.find(rider => rider.id === selectedRiderId);
        
        if (selectedRider) {
            // Auto-fill pickup location with rider's current position
            document.getElementById('pickupX').value = selectedRider.location.x;
            document.getElementById('pickupY').value = selectedRider.location.y;
        }
    } else {
        // Clear pickup fields if no rider selected
        document.getElementById('pickupX').value = '';
        document.getElementById('pickupY').value = '';
    }
}

// Update the rider select dropdown
function updateRiderSelect() {
    const riderSelect = document.getElementById('riderSelect');
    const currentValue = riderSelect.value;
    
    // Clear existing options except the first placeholder
    riderSelect.innerHTML = '<option value="">-- Select a rider --</option>';
    
    // Add riders
    riders.forEach(rider => {
        const option = document.createElement('option');
        option.value = rider.id;
        option.textContent = `${rider.id} (${rider.location.x}, ${rider.location.y})`;
        riderSelect.appendChild(option);
    });
    
    // Restore previous selection if it still exists
    if (currentValue && riders.find(rider => rider.id === currentValue)) {
        riderSelect.value = currentValue;
        onRiderSelectionChange(); // Update pickup fields
    } else if (riders.length === 1) {
        // If there's only one rider, select it automatically
        riderSelect.value = riders[0].id;
        onRiderSelectionChange(); // Update pickup fields
    }
}

// Add a new driver at specified position
async function addDriverAtPosition(x, y) {
    try {
        const response = await fetch(`${API_URL}/api/drivers/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y })
        });
        
        if (!response.ok) throw new Error('Failed to add driver');
        
        const driver = await response.json();
        showNotification(`Driver ${driver.id} added at (${x}, ${y})`, 'success');
        
        // Refresh state
        refreshState();
    } catch (error) {
        console.error('Error adding driver:', error);
        showNotification('Failed to add driver. Please try again.', 'error');
    }
}

// Add a new driver (from form)
async function addDriver() {
    const x = parseInt(document.getElementById('driverX').value);
    const y = parseInt(document.getElementById('driverY').value);
    
    if (isNaN(x) || isNaN(y) || x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
        alert('Please enter valid coordinates (0-99)');
        return;
    }
    
    await addDriverAtPosition(x, y);
}

// Remove a driver
async function removeDriver(driverId) {
    try {
        const response = await fetch(`${API_URL}/api/drivers/${driverId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to remove driver');
        }
        
        // Refresh state
        refreshState();
    } catch (error) {
        console.error('Error removing driver:', error);
        alert(error.message);
    }
}

// Add a new rider at specified position
async function addRiderAtPosition(x, y) {
    try {
        const response = await fetch(`${API_URL}/api/riders/`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ x, y })
        });
        
        if (!response.ok) throw new Error('Failed to add rider');
        
        const rider = await response.json();
        showNotification(`Rider ${rider.id} added at (${x}, ${y})`, 'success');
        
        // Refresh state
        refreshState();
    } catch (error) {
        console.error('Error adding rider:', error);
        showNotification('Failed to add rider. Please try again.', 'error');
    }
}

// Add a new rider (from form)
async function addRider() {
    const x = parseInt(document.getElementById('riderX').value);
    const y = parseInt(document.getElementById('riderY').value);
    
    if (isNaN(x) || isNaN(y) || x < 0 || x >= GRID_SIZE || y < 0 || y >= GRID_SIZE) {
        alert('Please enter valid coordinates (0-99)');
        return;
    }
    
    await addRiderAtPosition(x, y);
}

// Remove a rider
async function removeRider(riderId) {
    try {
        const response = await fetch(`${API_URL}/api/riders/${riderId}`, {
            method: 'DELETE'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to remove rider');
        }
        
        // Refresh state
        refreshState();
    } catch (error) {
        console.error('Error removing rider:', error);
        alert(error.message);
    }
}

// Request a ride
async function requestRide() {
    const riderId = document.getElementById('riderSelect').value;
    const pickupX = parseInt(document.getElementById('pickupX').value);
    const pickupY = parseInt(document.getElementById('pickupY').value);
    const dropoffX = parseInt(document.getElementById('dropoffX').value);
    const dropoffY = parseInt(document.getElementById('dropoffY').value);
    
    if (!riderId) {
        alert('Please select a rider first');
        return;
    }
    
    if (isNaN(pickupX) || isNaN(pickupY)) {
        alert('Pickup location not set. Please select a rider first.');
        return;
    }
    
    if (
        isNaN(dropoffX) || isNaN(dropoffY) || dropoffX < 0 || dropoffX >= GRID_SIZE || dropoffY < 0 || dropoffY >= GRID_SIZE
    ) {
        alert('Please enter valid dropoff coordinates (0-99)');
        return;
    }
    
    if (pickupX === dropoffX && pickupY === dropoffY) {
        alert('Pickup and dropoff locations cannot be the same');
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/rides/request`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                rider_id: riderId,
                pickup: { x: pickupX, y: pickupY },
                dropoff: { x: dropoffX, y: dropoffY }
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to request ride');
        }
        
        const result = await response.json();
        showNotification(`Ride requested successfully! Driver dispatch in progress...`, 'success');
        
        // Refresh state
        refreshState();
    } catch (error) {
        console.error('Error requesting ride:', error);
        showNotification(error.message || 'Failed to request ride', 'error');
    }
}

// Cancel a ride
async function cancelRide(rideId) {
    if (!confirm(`Are you sure you want to cancel ride ${rideId}?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${API_URL}/api/rides/${rideId}/cancel`, {
            method: 'PUT'
        });
        
        if (!response.ok) {
            const error = await response.json();
            throw new Error(error.detail || 'Failed to cancel ride');
        }
        
        const result = await response.json();
        showNotification(`🚫 Ride ${rideId} cancelled successfully`, 'warning');
        
        // Refresh state
        refreshState();
    } catch (error) {
        console.error('Error cancelling ride:', error);
        showNotification(error.message || 'Failed to cancel ride', 'error');
    }
}

// Enhanced advance simulation with loading states and animations
async function advanceSimulation() {
    try {
        const response = await fetch(`${API_URL}/api/tick`, {
            method: 'POST'
        });
        
        if (!response.ok) {
            throw new Error('Failed to advance simulation');
        }
        
        const result = await response.json();
        
        // Store previous positions for animation
        const previousPositions = new Map();
        drivers.forEach(driver => {
            previousPositions.set(driver.id, { x: driver.x, y: driver.y });
        });
        
        // Refresh the state to get new positions
        await refreshState();
        
        // Animate driver movements
        drivers.forEach(driver => {
            const prevPos = previousPositions.get(driver.id);
            if (prevPos && (prevPos.x !== driver.x || prevPos.y !== driver.y)) {
                const element = document.querySelector(`[data-driver-id="${driver.id}"]`);
                if (element) {
                    animateEntityMovement(element, prevPos.x, prevPos.y, driver.x, driver.y);
                }
            }
        });
        
        showNotification(`${result.message}`, 'success');
        
        // Refresh state
        refreshState();
    } catch (error) {
        console.error('Error advancing simulation:', error);
        showNotification('Failed to advance simulation', 'error');
    }
}

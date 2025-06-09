document.addEventListener('DOMContentLoaded', function() {
     // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    const body = document.body;
    
    themeToggle.addEventListener('click', () => {
        body.classList.toggle('dark-theme');
        localStorage.setItem('theme', body.classList.contains('dark-theme') ? 'dark' : 'light');
    });
    
    // Apply saved theme
    if (localStorage.getItem('theme') === 'dark') {
        body.classList.add('dark-theme');
    }
    
    // API endpoints (we'll use functions now instead of static strings)
    const endpoints = {
        lead: () => `http://127.0.0.1:8000/get/lead_info?session_id=${sessionID}`,
        quadrant: {
            summary: () => `http://127.0.0.1:8000/limit/summary?session_id=${sessionID}`,
            guidance: () => `http://127.0.0.1:8000/limit/guidance?session_id=${sessionID}`,
            method: () => `http://127.0.0.1:8000/limit/method?session_id=${sessionID}`,
            reason: () => `http://127.0.0.1:8000/limit/reason?session_id=${sessionID}`
        },
        detailed: {
            summary: () => `http://127.0.0.1:8000/summary?session_id=${sessionID}`,
            guidance: () => `http://127.0.0.1:8000/guidance?session_id=${sessionID}`,
            method: () => `http://127.0.0.1:8000/method?session_id=${sessionID}`,
            reason: () => `http://127.0.0.1:8000/reason?session_id=${sessionID}`
        }
    };
    // Status bar functions
    const statusBar = document.getElementById('statusBar');
    const showStatus = message => {
        statusBar.querySelector('span').textContent = message;
        statusBar.classList.add('show');
    };
    const hideStatus = () => statusBar.classList.remove('show');

    // ======== CACHE IMPLEMENTATION ======== //
    const responseCache = {
        detailed: {},
        quadrant: {},
        hasCachedData: false
    };

    // Cache management functions
    function getCacheKey(type, category = 'quadrant') {
        return `${sessionID}-${category}-${type}`;
    }

    function cacheResponse(type, data, category = 'quadrant') {
        const key = getCacheKey(type, category);
        if (category === 'detailed') {
            responseCache.detailed[key] = data;
        } else {
            responseCache.quadrant[key] = data;
        }
        responseCache.hasCachedData = true;
    }

    function getCachedResponse(type, category = 'quadrant') {
        const key = getCacheKey(type, category);
        return category === 'detailed' 
            ? responseCache.detailed[key]
            : responseCache.quadrant[key];
    }

    // ======== MODIFIED API FUNCTIONS ======== //
    async function generateData(type) {
        const cacheKey = getCacheKey(type, 'detailed');
        
        if (responseCache.detailed[cacheKey]) {
            return responseCache.detailed[cacheKey];
        }

        try {
            showStatus(`Generating ${type} data...`);
            const response = await fetch(endpoints.detailed[type](), { method: 'GET' });
            
            if (!response.ok) throw new Error(`Failed to generate ${type} data`);
            
            const data = await response.json();
            cacheResponse(type, data, 'detailed');
            return data;
            
        } catch (error) {
            console.error(`Error generating ${type} data:`, error);
            throw error;
        }
    }

    async function fetchQuadrantData(type) {
        const cached = getCachedResponse(type);
        if (cached) return cached;

        try {
            // Only generate if not already cached
            if (!getCachedResponse(type, 'detailed')) {
                await generateData(type);
            }

            const response = await fetch(endpoints.quadrant[type](), {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ limit: 50 })
            });
            
            if (!response.ok) throw new Error(`Failed to fetch ${type} data`);
            
            const data = await response.json();
            cacheResponse(type, data);
            return data;
            
        } catch (error) {
            console.error(error);
            throw error;
        }
    }



     // Render data based on quadrant type
    function renderQuadrantData(type, data) {
        switch(type) {
            case 'summary':
                return data.summary || 'No summary available';
                
            case 'guidance':
                // if (data.summary && Array.isArray(data.action_plans)) {
                //     return data.action_plans.map(plan => `• ${plan}`).join('<br>');
                // }
                return data.summary || 'No guidance available';
                
            case 'method':
                // if (data.summary && Array.isArray(data.strategies)) {
                //     return data.strategies.map(strategy => `• ${strategy}`).join('<br>');
                // }
                return data.summary ||  'No strategies available';
                
            case 'reason':
                return data.summary || 'No analysis available';
                
            default:
                return JSON.stringify(data, null, 2);
        }
    }
    
   

    // ======== MODIFIED DASHBOARD INIT ======== //
    async function fetchDashboardData() {
        if (responseCache.hasCachedData) {
            // Use cached data for immediate UI update
            document.querySelectorAll('.quadrant').forEach(quadrant => {
                const type = quadrant.dataset.type.toLowerCase();
                const cachedData = getCachedResponse(type);
                if (cachedData) {
                    quadrant.querySelector('.content-placeholder').innerHTML = `
                        <div class="placeholder-text">
                            <p class="sample-data">
                                ${renderQuadrantData(type, cachedData)}
                            </p>
                        </div>
                    `;
                }
            });
        }

        showStatus(responseCache.hasCachedData 
            ? 'Loading cached data...' 
            : 'Fetching dashboard data...');
        
        try {
            const quadrants = document.querySelectorAll('.quadrant');
            
            for (const quadrant of quadrants) {
                const type = quadrant.dataset.type.toLowerCase();
                const content = quadrant.querySelector('.content-placeholder');
                
                // Only fetch if not in cache
                if (!getCachedResponse(type)) {
                    try {
                        const data = await fetchQuadrantData(type);
                        content.innerHTML = `
                            <div class="placeholder-text">
                                <p class="sample-data">
                                    ${renderQuadrantData(type, data)}
                                </p>
                            </div>
                        `;
                    } catch (error) {
                        content.innerHTML = `<div class="error">Error loading ${type} data</div>`;
                    }
                }
            }
            
            hideStatus();
        } catch (error) {
            showStatus('Error loading dashboard data');
            setTimeout(hideStatus, 3000);
        }
    }

    // ======== MODAL FUNCTIONS WITH CACHE ======== //
    async function fetchDetailedData(type) {
        const cacheKey = getCacheKey(type, 'detailed');
        
        if (responseCache.detailed[cacheKey]) {
            document.getElementById('modalData').innerHTML = `
                <div class="modal-data-content">
                    ${renderDetailedData(type, responseCache.detailed[cacheKey])}
                </div>
            `;
            return;
        }

        showStatus(`Generating detailed ${type} data...`);
        const modalData = document.getElementById('modalData');
        
        try {
            const data = await generateData(type);
            modalData.innerHTML = `
                <div class="modal-data-content">
                    ${renderDetailedData(type, data)}
                </div>
            `;
        } catch (error) {
            modalData.innerHTML = `<p>Error: ${error.message}</p>`;
        }
        hideStatus();
    }

        
    // Render detailed modal data
function renderDetailedData(type, data) {
    switch(type) {
        case 'summary':
            if (data.detailed_summary) {
                return `
                    <div class="summary-detail">
                        <h4>Summary:</h4>
                        <p>${data.detailed_summary.summary || 'No detailed summary'}</p>
                        <h4>Key Steps:</h4>
                        <ul>
                            ${data.detailed_summary.steps?.map(step => 
                                `<li><i class="fas fa-caret-right"></i> ${step}</li>`
                            ).join('') || '<li>No steps available</li>'}
                        </ul>
                    </div>
                `;
            }
            return `<p>${data.summary || 'No detailed summary'}</p>`;
            
        case 'guidance':
            if (data.guidance?.action_plans) {
                return `
                    <div class="guidance-detail">
                        <h4>Action Plans:</h4>
                        <ul>
                            ${data.guidance.action_plans.map(plan => 
                                `<li><i class="fas fa-tasks"></i> ${plan}</li>`
                            ).join('')}
                        </ul>
                    </div>
                `;
            }
            return '<p>No detailed guidance available</p>';
            
        case 'method':
            if (data.methods_and_steps) {
                return `
                    <div class="method-detail">
                        <div class="method-section">
                            <h4>Methods:</h4>
                            <ul>
                                ${data.methods_and_steps.methods.map(method => 
                                    `<li><i class="fas fa-cog"></i> ${method}</li>`
                                ).join('')}
                            </ul>
                        </div>
                        <div class="steps-section">
                            <h4>Implementation Steps:</h4>
                            <ol>
                                ${data.methods_and_steps.steps.map((step, i) => 
                                    `<li>${step}</li>`
                                ).join('')}
                            </ol>
                        </div>
                    </div>
                `;
            }
            return '<p>No detailed strategies available</p>';
            
        case 'reason':
            if (data.reason && data.reason.length > 0) {
                return `
                    <div class="reason-detail">
                        <h4>Analysis:</h4>
                        <ul>
                            ${data.reason.map(r => 
                                `<li><i class="fas fa-clipboard-check"></i> ${r}</li>`
                            ).join('')}
                        </ul>
                    </div>
                `;
            }
            return '<p>No detailed analysis available</p>';
            
        default:
            return `<pre>${JSON.stringify(data, null, 2)}</pre>`;
    }
}
    
// Expand quadrant to modal
    document.querySelectorAll('.expand-btn').forEach(button => {
        button.addEventListener('click', function(e) {
            e.stopPropagation();
            const type = this.closest('.quadrant').dataset.type;
            
            document.getElementById('modalTitle').textContent = type;
            document.getElementById('expandedModal').classList.add('active');
            fetchDetailedData(type.toLowerCase());
        });
    });
    
    // Close modal
    document.getElementById('modalClose').addEventListener('click', () => {
        document.getElementById('expandedModal').classList.remove('active');
    });
    

    

// Minimize quadrant
            // const minimizeButtons = document.querySelectorAll('.minimize-btn');
            
            // minimizeButtons.forEach(button => {
            //     button.addEventListener('click', function(e) {
            //         e.stopPropagation();
            //         const quadrant = this.closest('.quadrant');
            //         quadrant.classList.toggle('minimized');
                    
            //         const icon = this.querySelector('i');
            //         if (quadrant.classList.contains('minimized')) {
            //             icon.classList.remove('fa-minus');
            //             icon.classList.add('fa-plus');
            //         } else {
            //             icon.classList.remove('fa-plus');
            //             icon.classList.add('fa-minus');
            //         }
                    
            //         // In a real implementation, we would adjust the grid layout here
            //     });
            // });




            // Update the dashboard grid to handle minimized state
// function updateGridLayout() {
//     const grid = document.getElementById('dashboardGrid');
//     const minimized = document.querySelectorAll('.quadrant.minimized');
    
//     if (minimized.length > 0) {
//         grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
//         grid.style.gridAutoRows = 'min-content';
//     } else {
//         grid.style.gridTemplateColumns = 'repeat(2, 1fr)';
//         grid.style.gridAutoRows = '1fr';
//     }
// }



const taskbar = document.getElementById('taskbar');

// Store minimized quadrants
const minimizedQuadrants = {
    summary: null,
    guidance: null,
    method: null,
    reason: null
};

// Update grid layout when quadrants change
function updateGridLayout() {
    const grid = document.getElementById('dashboardGrid');
    const quadrants = Array.from(grid.children);
    
    // Reset all quadrants
    quadrants.forEach(q => {
        q.style.gridColumn = '';
        q.style.gridRow = '';
        q.style.display = 'block';
    });
    
    // Find visible quadrants
    const visibleQuadrants = quadrants.filter(q => 
        !q.classList.contains('minimized') && 
        !q.classList.contains('animating')
    );
    
    // Apply grid positioning based on available space
    if (visibleQuadrants.length === 3) {
        // Create a 2x2 grid with one cell spanning two rows
        visibleQuadrants[0].style.gridRow = '1 / 3';
        visibleQuadrants[1].style.gridColumn = '2';
        visibleQuadrants[1].style.gridRow = '1';
        visibleQuadrants[2].style.gridColumn = '2';
        visibleQuadrants[2].style.gridRow = '2';
    } else if (visibleQuadrants.length === 2) {
        // Both quadrants take full width
        visibleQuadrants[0].style.gridColumn = '1 / 3';
        visibleQuadrants[1].style.gridColumn = '1 / 3';
    }
}

// Minimize quadrant to taskbar
function minimizeQuadrant(e) {
    e.stopPropagation();
    const quadrant = this.closest('.quadrant');
    const type = quadrant.dataset.type;
    
    // Already minimized
    if (quadrant.classList.contains('minimized') || minimizedQuadrants[type]) {
        return;
    }
    
    // Add animating class
    quadrant.classList.add('animating');
    
    // Calculate animation path
    const quadrantRect = quadrant.getBoundingClientRect();
    const taskbarRect = taskbar.getBoundingClientRect();
    
    // Calculate animation vectors
    const tx = (taskbarRect.left + taskbarRect.width/2) - (quadrantRect.left + quadrantRect.width/2);
    const ty = (taskbarRect.top + taskbarRect.height/2) - (quadrantRect.top + quadrantRect.height/2);
    
    // Set custom properties for animation
    quadrant.style.setProperty('--tx', `${tx}px`);
    quadrant.style.setProperty('--ty', `${ty}px`);
    
    // Start animation
    quadrant.style.animation = `minimizeToTaskbar 0.5s forwards`;
    
    setTimeout(() => {
        quadrant.classList.remove('animating');
        quadrant.classList.add('minimized');
        quadrant.style.display = 'none';
        
        // Add to taskbar
        const taskbarItem = document.createElement('div');
        taskbarItem.className = 'taskbar-item';
        taskbarItem.textContent = type.charAt(0).toUpperCase() + type.slice(1);
        taskbarItem.dataset.type = type;
        
        // Add restore functionality
        taskbarItem.addEventListener('click', function() {
            restoreQuadrant(type);
        });
        
        taskbar.appendChild(taskbarItem);
        minimizedQuadrants[type] = taskbarItem;
        
        // Update grid layout
        updateGridLayout();
    }, 500);
}

// Restore quadrant from taskbar
function restoreQuadrant(type) {
    const quadrant = document.querySelector(`.quadrant[data-type="${type}"]`);
    const taskbarItem = minimizedQuadrants[type];
    
    if (!quadrant || !taskbarItem) return;
    
    // Remove from taskbar
    taskbar.removeChild(taskbarItem);
    minimizedQuadrants[type] = null;
    
    // Prepare for animation
    quadrant.classList.add('animating');
    quadrant.style.display = 'block';
    quadrant.style.opacity = '0';
    quadrant.style.transform = 'scale(0.01)';
    
    setTimeout(() => {
        quadrant.style.animation = `restoreFromTaskbar 0.5s forwards`;
        
        setTimeout(() => {
            quadrant.classList.remove('minimized', 'animating');
            quadrant.style.animation = '';
            quadrant.style.transform = '';
            quadrant.style.opacity = '';
            
            // Update grid layout
            updateGridLayout();
        }, 500);
    }, 50);
}

// Update minimize button event handlers
document.querySelectorAll('.minimize-btn').forEach(button => {
    button.addEventListener('click', minimizeQuadrant);
});

// Initialize grid layout
updateGridLayout();

// Add window resize handler to update layout
window.addEventListener('resize', updateGridLayout);






      // Make quadrants draggable
            const dashboardGrid = document.getElementById('dashboardGrid');
            new Sortable(dashboardGrid, {
                animation: 350,
                ghostClass: 'sortable-ghost',
                chosenClass: 'sortable-chosen',
                dragClass: 'sortable-drag',
                handle: '.quadrant-header',
                onEnd: function(evt) {
                    console.log('Quadrant moved', evt.oldIndex, '->', evt.newIndex);
                }
            });
    // Initialize dashboard
    fetchDashboardData();
    // Call this on initial load
updateGridLayout();
});
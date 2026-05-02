const { systemLogger } = require('./loggerMiddleware');

const computeOptimalFleetSchedule = (fleetQueue, availableBudgetHours) => {
    systemLogger.info('Initiating scheduling optimization', { fleetSize: fleetQueue.length, budget: availableBudgetHours });
    
    const count = fleetQueue.length;
    // DP array creation
    const dynamicTable = Array(count + 1).fill(null).map(() => Array(availableBudgetHours + 1).fill(0));
    
    for (let itemIdx = 1; itemIdx <= count; itemIdx++) {
        const currentTask = fleetQueue[itemIdx - 1];
        const timeCost = currentTask.Duration;
        const priorityValue = currentTask.Impact;
        
        for (let timeCap = 1; timeCap <= availableBudgetHours; timeCap++) {
            if (timeCost <= timeCap) {
                const includeValue = priorityValue + dynamicTable[itemIdx - 1][timeCap - timeCost];
                const excludeValue = dynamicTable[itemIdx - 1][timeCap];
                dynamicTable[itemIdx][timeCap] = Math.max(includeValue, excludeValue);
            } else {
                dynamicTable[itemIdx][timeCap] = dynamicTable[itemIdx - 1][timeCap];
            }
        }
    }
    
    let remainingCap = availableBudgetHours;
    let maximumImpactScore = dynamicTable[count][availableBudgetHours];
    const chosenTasks = [];
    let utilizedHours = 0;
    
    // Backtracking to find selected vehicles
    for (let i = count; i > 0 && maximumImpactScore > 0; i--) {
        if (maximumImpactScore !== dynamicTable[i - 1][remainingCap]) {
            const selectedTask = fleetQueue[i - 1];
            chosenTasks.push(selectedTask.TaskID);
            maximumImpactScore -= selectedTask.Impact;
            remainingCap -= selectedTask.Duration;
            utilizedHours += selectedTask.Duration;
        }
    }
    
    const optimalImpact = dynamicTable[count][availableBudgetHours];
    
    systemLogger.info('Optimization completed', { 
        totalImpact: optimalImpact, 
        utilizedHours, 
        selectedCount: chosenTasks.length 
    });
    
    return {
        selectedVehicleTaskIDs: chosenTasks.reverse(),
        totalImpactGenerated: optimalImpact,
        mechanicHoursUtilized: utilizedHours
    };
};

module.exports = { computeOptimalFleetSchedule };

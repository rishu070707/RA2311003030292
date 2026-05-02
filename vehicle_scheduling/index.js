const express = require('express');
const axios = require('axios');
const { activityTrackerMiddleware, systemLogger } = require('./loggerMiddleware');
const { computeOptimalFleetSchedule } = require('./optimizer');

const application = express();
const PORT = process.env.PORT || 4000;

application.use(express.json());
application.use(activityTrackerMiddleware);

application.post('/api/optimize-schedule', async (req, res) => {
    try {
        const authHeaderValue = req.headers['authorization'];
        if (!authHeaderValue) {
            systemLogger.warn('Missing authorization token');
            return res.status(401).json({ error: "Authorization token is required to access Affordmed APIs" });
        }

        const requestConfig = { headers: { 'Authorization': authHeaderValue } };

        systemLogger.info('Fetching depot data from external service');
        const depotResponse = await axios.get('http://20.207.122.201/evaluation-service/depots', requestConfig);

        systemLogger.info('Fetching vehicle data from external service');
        const vehicleResponse = await axios.get('http://20.207.122.201/evaluation-service/vehicles', requestConfig);

        const allDepots = depotResponse.data.depots;
        const allVehicles = vehicleResponse.data.vehicles;

        const results = {};

        for (const currentDepot of allDepots) {
            const depotBudget = currentDepot.MechanicHours;
            const optimalResult = computeOptimalFleetSchedule(allVehicles, depotBudget);

            results[`Depot_${currentDepot.ID}`] = {
                mechanicBudgetLimit: depotBudget,
                ...optimalResult
            };
        }

        systemLogger.info('Successfully generated schedule for all depots');
        res.json({
            status: 'success',
            data: results
        });

    } catch (error) {
        systemLogger.error('Failed to process scheduling request', { errorMsg: error.message || error });
        res.status(error.response?.status || 500).json({
            error: "Internal server error during processing",
            details: error.response?.data || error.message
        });
    }
});

application.listen(PORT, () => {
    systemLogger.info(`Vehicle Maintenance Scheduler Microservice active on port ${PORT}`);
    process.stdout.write(`Vehicle Maintenance Microservice is listening on port ${PORT}.\nSend a POST request to /api/optimize-schedule with the Authorization header to run the optimization.\nCheck service_execution.log for the application logs.\n`);
});

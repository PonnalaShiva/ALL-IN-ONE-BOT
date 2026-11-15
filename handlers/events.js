'use strict';

const loaders = require('../loaders');

module.exports = (client) => {
    return loaders.loadGatewayEvents(client);
};

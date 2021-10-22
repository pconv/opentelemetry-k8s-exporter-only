"use strict";
// Copyright 2020 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
Object.defineProperty(exports, "__esModule", { value: true });
exports.MetricExporter = void 0;
const core_1 = require("@opentelemetry/core");
const google_auth_library_1 = require("google-auth-library");
const googleapis_1 = require("googleapis");
const transform_1 = require("./transform");
const utils_1 = require("./utils");
const api_1 = require("@opentelemetry/api");
// Stackdriver Monitoring v3 only accepts up to 200 TimeSeries per
// CreateTimeSeries call.
const MAX_BATCH_EXPORT_SIZE = 200;
const OT_USER_AGENT = {
    product: 'opentelemetry-js',
    version: core_1.VERSION,
};
const OT_REQUEST_HEADER = {
    'x-opentelemetry-outgoing-request': 0x1,
};
googleapis_1.google.options({ headers: OT_REQUEST_HEADER });
/**
 * Format and sends metrics information to Google Cloud Monitoring.
 */
class MetricExporter {
    constructor(options = {}) {
        this._startTime = new Date().toISOString();
        this.registeredMetricDescriptors = new Map();
        this._metricPrefix =
            options.prefix || MetricExporter.CUSTOM_OPENTELEMETRY_DOMAIN;
        this._displayNamePrefix =
            options.prefix || MetricExporter.DEFAULT_DISPLAY_NAME_PREFIX;
        this._auth = new google_auth_library_1.GoogleAuth({
            credentials: options.credentials,
            keyFile: options.keyFile,
            keyFilename: options.keyFilename,
            projectId: options.projectId,
            scopes: ['https://www.googleapis.com/auth/cloud-platform'],
        });
        // Start this async process as early as possible. It will be
        // awaited on the first export because constructors are synchronous
        this._projectId = this._auth.getProjectId().catch(err => {
            api_1.diag.error(err);
        });
    }
    /**
     * Implementation for {@link IMetricExporter.export}.
     * Calls the async wrapper method {@link _exportAsync} and
     * assures no rejected promises bubble up to the caller.
     *
     * @param metrics Metrics to be sent to the Google Cloud Monitoring backend
     * @param cb result callback to be called on finish
     */
    export(metrics, cb) {
        this._exportAsync(metrics)
            .then(cb)
            .catch(err => {
            api_1.diag.error(err.message);
            return cb({ code: core_1.ExportResultCode.FAILED, error: err });
        });
    }
    async shutdown() { }
    /**
     * Asnyc wrapper for the {@link export} implementation.
     * Writes the current values of all exported {@link MetricRecord}s
     * to the Google Cloud Monitoring backend.
     *
     * @param metrics Metrics to be sent to the Google Cloud Monitoring backend
     */
    async _exportAsync(metrics) {
        if (this._projectId instanceof Promise) {
            this._projectId = await this._projectId;
        }
        if (!this._projectId) {
            const error = new Error('expecting a non-blank ProjectID');
            api_1.diag.error(error.message);
            return { code: core_1.ExportResultCode.FAILED, error };
        }
        api_1.diag.debug('Google Cloud Monitoring export');
        const timeSeries = [];
        for (const metric of metrics) {
            const isRegistered = await this._registerMetricDescriptor(metric.descriptor);
            if (isRegistered) {
                timeSeries.push((0, transform_1.createTimeSeries)(metric, this._metricPrefix, this._startTime, this._projectId));
            }
        }
        let failure = {
            sendFailed: false,
        };
        for (const batchedTimeSeries of (0, utils_1.partitionList)(timeSeries, MAX_BATCH_EXPORT_SIZE)) {
            try {
                await this._sendTimeSeries(batchedTimeSeries);
            }
            catch (e) {
                const err = asError(e);
                err.message = `Send TimeSeries failed: ${err.message}`;
                failure = { sendFailed: true, error: err };
                api_1.diag.error(err.message);
            }
        }
        if (failure.sendFailed) {
            return { code: core_1.ExportResultCode.FAILED, error: failure.error };
        }
        return { code: core_1.ExportResultCode.SUCCESS };
    }
    /**
     * Returns true if the given metricDescriptor is successfully registered to
     * Google Cloud Monitoring, or the exact same metric has already been
     * registered. Returns false otherwise.
     * @param metricDescriptor The OpenTelemetry MetricDescriptor.
     */
    async _registerMetricDescriptor(metricDescriptor) {
        const existingMetricDescriptor = this.registeredMetricDescriptors.get(metricDescriptor.name);
        if (existingMetricDescriptor) {
            if (existingMetricDescriptor === metricDescriptor) {
                // Ignore metricDescriptor that are already registered.
                return true;
            }
            else {
                api_1.diag.warn(`A different metric with the same name is already registered: ${existingMetricDescriptor}`);
                return false;
            }
        }
        const isRegistered = await this._createMetricDescriptor(metricDescriptor)
            .then(() => {
            this.registeredMetricDescriptors.set(metricDescriptor.name, metricDescriptor);
            return true;
        })
            .catch(err => {
            api_1.diag.error(err);
            return false;
        });
        return isRegistered;
    }
    /**
     * Creates a new metric descriptor.
     * @param metricDescriptor The OpenTelemetry MetricDescriptor.
     */
    async _createMetricDescriptor(metricDescriptor) {
        const authClient = await this._authorize();
        const descriptor = (0, transform_1.transformMetricDescriptor)(metricDescriptor, this._metricPrefix, this._displayNamePrefix);
        try {
            return new Promise((resolve, reject) => {
                MetricExporter._monitoring.projects.metricDescriptors.create({
                    name: `projects/${this._projectId}`,
                    requestBody: descriptor,
                    auth: authClient,
                }, { headers: OT_REQUEST_HEADER, userAgentDirectives: [OT_USER_AGENT] }, (err) => {
                    api_1.diag.debug('sent metric descriptor', descriptor);
                    err ? reject(err) : resolve();
                });
            });
        }
        catch (e) {
            const err = asError(e);
            api_1.diag.error('MetricExporter: Failed to write data: %s', err.message);
        }
    }
    async _sendTimeSeries(timeSeries) {
        if (timeSeries.length === 0) {
            return Promise.resolve();
        }
        return this._authorize().then(authClient => {
            return new Promise((resolve, reject) => {
                MetricExporter._monitoring.projects.timeSeries.create({
                    name: `projects/${this._projectId}`,
                    requestBody: { timeSeries },
                    auth: authClient,
                }, { headers: OT_REQUEST_HEADER, userAgentDirectives: [OT_USER_AGENT] }, (err) => {
                    api_1.diag.debug('sent time series', timeSeries);
                    err ? reject(err) : resolve();
                });
            });
        });
    }
    /**
     * Gets the Google Application Credentials from the environment variables
     * and authenticates the client.
     */
    async _authorize() {
        return (await this._auth.getClient());
    }
}
exports.MetricExporter = MetricExporter;
MetricExporter.DEFAULT_DISPLAY_NAME_PREFIX = 'OpenTelemetry';
MetricExporter.CUSTOM_OPENTELEMETRY_DOMAIN = 'custom.googleapis.com/opentelemetry';
MetricExporter._monitoring = googleapis_1.google.monitoring('v3');
function asError(error) {
    if (error instanceof Error) {
        return error;
    }
    return new Error(String(error));
}
//# sourceMappingURL=monitoring.js.map
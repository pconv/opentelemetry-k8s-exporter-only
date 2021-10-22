import { MetricExporter as IMetricExporter, MetricRecord } from '@opentelemetry/sdk-metrics-base';
import { ExportResult } from '@opentelemetry/core';
import { ExporterOptions } from './external-types';
/**
 * Format and sends metrics information to Google Cloud Monitoring.
 */
export declare class MetricExporter implements IMetricExporter {
    private _projectId;
    private readonly _metricPrefix;
    private readonly _displayNamePrefix;
    private readonly _auth;
    private readonly _startTime;
    static readonly DEFAULT_DISPLAY_NAME_PREFIX: string;
    static readonly CUSTOM_OPENTELEMETRY_DOMAIN: string;
    private registeredMetricDescriptors;
    private static readonly _monitoring;
    constructor(options?: ExporterOptions);
    /**
     * Implementation for {@link IMetricExporter.export}.
     * Calls the async wrapper method {@link _exportAsync} and
     * assures no rejected promises bubble up to the caller.
     *
     * @param metrics Metrics to be sent to the Google Cloud Monitoring backend
     * @param cb result callback to be called on finish
     */
    export(metrics: MetricRecord[], cb: (result: ExportResult) => void): void;
    shutdown(): Promise<void>;
    /**
     * Asnyc wrapper for the {@link export} implementation.
     * Writes the current values of all exported {@link MetricRecord}s
     * to the Google Cloud Monitoring backend.
     *
     * @param metrics Metrics to be sent to the Google Cloud Monitoring backend
     */
    private _exportAsync;
    /**
     * Returns true if the given metricDescriptor is successfully registered to
     * Google Cloud Monitoring, or the exact same metric has already been
     * registered. Returns false otherwise.
     * @param metricDescriptor The OpenTelemetry MetricDescriptor.
     */
    private _registerMetricDescriptor;
    /**
     * Creates a new metric descriptor.
     * @param metricDescriptor The OpenTelemetry MetricDescriptor.
     */
    private _createMetricDescriptor;
    private _sendTimeSeries;
    /**
     * Gets the Google Application Credentials from the environment variables
     * and authenticates the client.
     */
    private _authorize;
}

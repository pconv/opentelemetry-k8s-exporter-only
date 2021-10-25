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
exports.TEST_ONLY = exports.createTimeSeries = exports.transformMetricDescriptor = exports.OPENTELEMETRY_TASK_VALUE_DEFAULT = void 0;
const sdk_metrics_base_1 = require("@opentelemetry/sdk-metrics-base");
const api_metrics_1 = require("@opentelemetry/api-metrics");
const opentelemetry_resource_util_1 = require("@google-cloud/opentelemetry-resource-util");
const types_1 = require("./types");
const path = require("path");
const os = require("os");
const OPENTELEMETRY_TASK = 'opentelemetry_task';
const OPENTELEMETRY_TASK_DESCRIPTION = 'OpenTelemetry task identifier';
exports.OPENTELEMETRY_TASK_VALUE_DEFAULT = generateDefaultTaskValue();
const GCP_GKE_INSTANCE = 'k8s_container';
function transformMetricDescriptor(metricDescriptor, metricPrefix, displayNamePrefix) {
    return {
        type: transformMetricType(metricPrefix, metricDescriptor.name),
        description: metricDescriptor.description,
        displayName: transformDisplayName(displayNamePrefix, metricDescriptor.name),
        metricKind: transformMetricKind(metricDescriptor.metricKind),
        valueType: transformValueType(metricDescriptor.valueType),
        unit: metricDescriptor.unit,
        labels: [
            {
                key: OPENTELEMETRY_TASK,
                description: OPENTELEMETRY_TASK_DESCRIPTION,
            },
        ],
    };
}
exports.transformMetricDescriptor = transformMetricDescriptor;
/** Transforms Metric type. */
function transformMetricType(metricPrefix, name) {
    return path.posix.join(metricPrefix, name);
}
/** Transforms Metric display name. */
function transformDisplayName(displayNamePrefix, name) {
    return path.posix.join(displayNamePrefix, name);
}
/** Transforms a OpenTelemetry Type to a StackDriver MetricKind. */
function transformMetricKind(kind) {
    switch (kind) {
        case sdk_metrics_base_1.MetricKind.COUNTER:
        case sdk_metrics_base_1.MetricKind.SUM_OBSERVER:
            return types_1.MetricKind.CUMULATIVE;
        case sdk_metrics_base_1.MetricKind.UP_DOWN_COUNTER:
        case sdk_metrics_base_1.MetricKind.VALUE_OBSERVER:
        case sdk_metrics_base_1.MetricKind.UP_DOWN_SUM_OBSERVER:
            return types_1.MetricKind.GAUGE;
        default:
            // TODO: Add support for OTMetricKind.ValueRecorder
            // OTMetricKind.Measure was renamed to ValueRecorder in #1117
            return types_1.MetricKind.UNSPECIFIED;
    }
}
/** Transforms a OpenTelemetry ValueType to a StackDriver ValueType. */
function transformValueType(valueType) {
    if (valueType === api_metrics_1.ValueType.DOUBLE) {
        return types_1.ValueType.DOUBLE;
    }
    else if (valueType === api_metrics_1.ValueType.INT) {
        return types_1.ValueType.INT64;
    }
    else {
        return types_1.ValueType.VALUE_TYPE_UNSPECIFIED;
    }
}
/**
 * Converts metric's timeseries to a TimeSeries, so that metric can be
 * uploaded to StackDriver.
 */
function createTimeSeries(metric, metricPrefix, startTime, projectId) {
    const timeSeries = {
        metric: transformMetric(metric, metricPrefix),
        resource: k8sorMapOtelResourceSelector(metric.resource, projectId),
        metricKind: transformMetricKind(metric.descriptor.metricKind),
        valueType: transformValueType(metric.descriptor.valueType),
        points: [
            transformPoint(metric.aggregator.toPoint(), metric.descriptor, startTime),
        ],
    };
    console.log('time series', timeSeries);
    return timeSeries;
}
exports.createTimeSeries = createTimeSeries;
function k8sorMapOtelResourceSelector(resource, projectId) {
    if (resource.attributes.type === GCP_GKE_INSTANCE) {
        const gke = {
            type: GCP_GKE_INSTANCE,
            labels: {
                project_id: projectId,
                // ...resource.attributes,
                pod_name: String(resource.attributes.pod_name),
                container_name: String(resource.attributes.container_name),
                cluster_name: String(resource.attributes.cluster_name),
                location: String(resource.attributes.location),
                namespace_name: String(resource.attributes.namespace_name),
            },
        };
        console.log('a-labels', resource.attributes.labels);
        console.log('gke', gke);
        return gke;
    }
    else {
        return (0, opentelemetry_resource_util_1.mapOtelResourceToMonitoredResource)(resource, projectId);
    }
}
function transformMetric(metric, metricPrefix) {
    console.log('transform', metric);
    try {
        const type = transformMetricType(metricPrefix, metric.descriptor.name);
        const labels = {};
        Object.keys(metric.labels).forEach(key => (labels[key] = `${metric.labels[key]}`));
        labels[OPENTELEMETRY_TASK] = exports.OPENTELEMETRY_TASK_VALUE_DEFAULT;
        return { type, labels };
    }
    catch (error) {
        console.log('error', error);
        const labels = {};
        const type = 'hi';
        return { type, labels };
    }
}
/**
 * Transform timeseries's point, so that metric can be uploaded to StackDriver.
 */
function transformPoint(point, metricDescriptor, startTime) {
    // TODO: Add endTime and startTime support, once available in OpenTelemetry
    // Related issues: https://github.com/open-telemetry/opentelemetry-js/pull/893
    // and https://github.com/open-telemetry/opentelemetry-js/issues/488
    switch (metricDescriptor.metricKind) {
        case sdk_metrics_base_1.MetricKind.COUNTER:
        case sdk_metrics_base_1.MetricKind.SUM_OBSERVER:
            return {
                value: transformValue(metricDescriptor.valueType, point.value),
                interval: {
                    startTime,
                    endTime: new Date().toISOString(),
                },
            };
        default:
            return {
                value: transformValue(metricDescriptor.valueType, point.value),
                interval: {
                    endTime: new Date().toISOString(),
                },
            };
    }
}
/** Transforms a OpenTelemetry Point's value to a StackDriver Point value. */
function transformValue(valueType, value) {
    if (isHistogramValue(value)) {
        return {
            distributionValue: {
                // sumOfSquaredDeviation param not aggregated
                count: value.count.toString(),
                mean: value.sum / value.count,
                bucketOptions: {
                    explicitBuckets: { bounds: value.buckets.boundaries },
                },
                bucketCounts: value.buckets.counts.map(count => count.toString()),
            },
        };
    }
    if (valueType === api_metrics_1.ValueType.INT) {
        return { int64Value: value.toString() };
    }
    else if (valueType === api_metrics_1.ValueType.DOUBLE) {
        return { doubleValue: value };
    }
    throw Error(`unsupported value type: ${valueType}`);
}
/** Returns true if value is of type OTHistogram */
function isHistogramValue(value) {
    return Object.prototype.hasOwnProperty.call(value, 'buckets');
}
/** Returns a task label value in the format of 'nodejs-<pid>@<hostname>'. */
function generateDefaultTaskValue() {
    const pid = process.pid;
    const hostname = os.hostname() || 'localhost';
    return 'nodejs-' + pid + '@' + hostname;
}
exports.TEST_ONLY = {
    transformMetricKind,
    transformValueType,
    transformDisplayName,
    transformMetricType,
    transformMetric,
    transformPoint,
    OPENTELEMETRY_TASK,
};
//# sourceMappingURL=transform.js.map
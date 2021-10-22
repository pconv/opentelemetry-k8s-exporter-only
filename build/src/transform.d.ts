import { MetricDescriptor as OTMetricDescriptor, MetricKind as OTMetricKind, MetricRecord, Point as OTPoint, PointValueType } from '@opentelemetry/sdk-metrics-base';
import { ValueType as OTValueType } from '@opentelemetry/api-metrics';
import { MetricDescriptor, MetricKind, ValueType, TimeSeries, Point } from './types';
export declare const OPENTELEMETRY_TASK_VALUE_DEFAULT: string;
export declare function transformMetricDescriptor(metricDescriptor: OTMetricDescriptor, metricPrefix: string, displayNamePrefix: string): MetricDescriptor;
/** Transforms Metric type. */
declare function transformMetricType(metricPrefix: string, name: string): string;
/** Transforms Metric display name. */
declare function transformDisplayName(displayNamePrefix: string, name: string): string;
/** Transforms a OpenTelemetry Type to a StackDriver MetricKind. */
declare function transformMetricKind(kind: OTMetricKind): MetricKind;
/** Transforms a OpenTelemetry ValueType to a StackDriver ValueType. */
declare function transformValueType(valueType: OTValueType): ValueType;
/**
 * Converts metric's timeseries to a TimeSeries, so that metric can be
 * uploaded to StackDriver.
 */
export declare function createTimeSeries(metric: MetricRecord, metricPrefix: string, startTime: string, projectId: string): TimeSeries;
declare function transformMetric(metric: MetricRecord, metricPrefix: string): {
    type: string;
    labels: {
        [key: string]: string;
    };
};
/**
 * Transform timeseries's point, so that metric can be uploaded to StackDriver.
 */
declare function transformPoint(point: OTPoint<PointValueType>, metricDescriptor: OTMetricDescriptor, startTime: string): Point;
export declare const TEST_ONLY: {
    transformMetricKind: typeof transformMetricKind;
    transformValueType: typeof transformValueType;
    transformDisplayName: typeof transformDisplayName;
    transformMetricType: typeof transformMetricType;
    transformMetric: typeof transformMetric;
    transformPoint: typeof transformPoint;
    OPENTELEMETRY_TASK: string;
};
export {};

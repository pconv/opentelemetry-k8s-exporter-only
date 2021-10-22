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
const assert = require("assert");
const transform_1 = require("../src/transform");
const sdk_metrics_base_1 = require("@opentelemetry/sdk-metrics-base");
const semantic_conventions_1 = require("@opentelemetry/semantic-conventions");
const api_metrics_1 = require("@opentelemetry/api-metrics");
const types_1 = require("../src/types");
const resources_1 = require("@opentelemetry/resources");
describe('transform', () => {
    const METRIC_NAME = 'metric-name';
    const METRIC_DESCRIPTION = 'metric-description';
    const DEFAULT_UNIT = '1';
    describe('MetricDescriptor', () => {
        const metricDescriptor = {
            name: METRIC_NAME,
            description: METRIC_DESCRIPTION,
            unit: DEFAULT_UNIT,
            metricKind: sdk_metrics_base_1.MetricKind.COUNTER,
            valueType: api_metrics_1.ValueType.INT,
        };
        const metricDescriptor1 = {
            name: METRIC_NAME,
            description: METRIC_DESCRIPTION,
            unit: DEFAULT_UNIT,
            metricKind: sdk_metrics_base_1.MetricKind.UP_DOWN_SUM_OBSERVER,
            valueType: api_metrics_1.ValueType.DOUBLE,
        };
        it('should return a Google Cloud Monitoring MetricKind', () => {
            assert.strictEqual(transform_1.TEST_ONLY.transformMetricKind(sdk_metrics_base_1.MetricKind.COUNTER), types_1.MetricKind.CUMULATIVE);
            assert.strictEqual(transform_1.TEST_ONLY.transformMetricKind(sdk_metrics_base_1.MetricKind.SUM_OBSERVER), types_1.MetricKind.CUMULATIVE);
            assert.strictEqual(transform_1.TEST_ONLY.transformMetricKind(sdk_metrics_base_1.MetricKind.UP_DOWN_COUNTER), types_1.MetricKind.GAUGE);
            assert.strictEqual(transform_1.TEST_ONLY.transformMetricKind(sdk_metrics_base_1.MetricKind.VALUE_OBSERVER), types_1.MetricKind.GAUGE);
            assert.strictEqual(transform_1.TEST_ONLY.transformMetricKind(sdk_metrics_base_1.MetricKind.UP_DOWN_SUM_OBSERVER), types_1.MetricKind.GAUGE);
            assert.strictEqual(transform_1.TEST_ONLY.transformMetricKind(sdk_metrics_base_1.MetricKind.VALUE_RECORDER), types_1.MetricKind.UNSPECIFIED);
        });
        it('should return a Google Cloud Monitoring ValueType', () => {
            assert.strictEqual(transform_1.TEST_ONLY.transformValueType(api_metrics_1.ValueType.INT), types_1.ValueType.INT64);
            assert.strictEqual(transform_1.TEST_ONLY.transformValueType(api_metrics_1.ValueType.DOUBLE), types_1.ValueType.DOUBLE);
            assert.strictEqual(transform_1.TEST_ONLY.transformValueType(2), types_1.ValueType.VALUE_TYPE_UNSPECIFIED);
        });
        it('should return a Google Cloud Monitoring DisplayName', () => {
            assert.strictEqual(transform_1.TEST_ONLY.transformDisplayName('custom.googleapis.com/opentelemetry', 'demo/latency'), 'custom.googleapis.com/opentelemetry/demo/latency');
        });
        it('should return a Google Cloud Monitoring MetricType', () => {
            assert.strictEqual(transform_1.TEST_ONLY.transformMetricType('opentelemetry', 'demo/latency'), 'opentelemetry/demo/latency');
        });
        it('should return a Cumulative Google Cloud Monitoring MetricDescriptor', () => {
            const descriptor = (0, transform_1.transformMetricDescriptor)(metricDescriptor, 'custom.googleapis.com/myorg/', 'myorg/');
            assert.strictEqual(descriptor.description, METRIC_DESCRIPTION);
            assert.strictEqual(descriptor.displayName, `myorg/${METRIC_NAME}`);
            assert.strictEqual(descriptor.type, `custom.googleapis.com/myorg/${METRIC_NAME}`);
            assert.strictEqual(descriptor.unit, DEFAULT_UNIT);
            assert.strictEqual(descriptor.metricKind, types_1.MetricKind.CUMULATIVE);
            assert.strictEqual(descriptor.valueType, types_1.ValueType.INT64);
        });
        it('should return a Gauge Google Cloud Monitoring MetricDescriptor', () => {
            const descriptor = (0, transform_1.transformMetricDescriptor)(metricDescriptor1, 'custom.googleapis.com/myorg/', 'myorg/');
            assert.strictEqual(descriptor.description, METRIC_DESCRIPTION);
            assert.strictEqual(descriptor.displayName, `myorg/${METRIC_NAME}`);
            assert.strictEqual(descriptor.type, `custom.googleapis.com/myorg/${METRIC_NAME}`);
            assert.strictEqual(descriptor.unit, DEFAULT_UNIT);
            assert.strictEqual(descriptor.metricKind, types_1.MetricKind.GAUGE);
            assert.strictEqual(descriptor.valueType, types_1.ValueType.DOUBLE);
        });
    });
    describe('TimeSeries', () => {
        const mockAwsResource = {
            [semantic_conventions_1.SemanticResourceAttributes.CLOUD_PROVIDER]: 'aws',
            [semantic_conventions_1.SemanticResourceAttributes.HOST_ID]: 'host_id',
            [semantic_conventions_1.SemanticResourceAttributes.CLOUD_REGION]: 'my-region',
            [semantic_conventions_1.SemanticResourceAttributes.CLOUD_ACCOUNT_ID]: '12345',
        };
        const mockAwsMonitoredResource = {
            type: 'aws_ec2_instance',
            labels: {
                instance_id: 'host_id',
                project_id: 'project_id',
                region: 'aws:my-region',
                aws_account: '12345',
            },
        };
        const mockGCResource = {
            [semantic_conventions_1.SemanticResourceAttributes.CLOUD_PROVIDER]: 'gcp',
            [semantic_conventions_1.SemanticResourceAttributes.HOST_ID]: 'host_id',
            [semantic_conventions_1.SemanticResourceAttributes.CLOUD_AVAILABILITY_ZONE]: 'my-zone',
        };
        const mockGCMonitoredResource = {
            type: 'gce_instance',
            labels: {
                instance_id: 'host_id',
                project_id: 'project_id',
                zone: 'my-zone',
            },
        };
        it('should return a Google Cloud Monitoring Metric with a default resource', async () => {
            const meter = new sdk_metrics_base_1.MeterProvider().getMeter('test-meter');
            const labels = { ['keya']: 'value1', ['keyb']: 'value2' };
            const counter = meter.createCounter(METRIC_NAME, {
                description: METRIC_DESCRIPTION,
            });
            counter.bind(labels).add(10);
            await meter.collect();
            const [record] = meter.getProcessor().checkPointSet();
            const ts = (0, transform_1.createTimeSeries)(record, 'otel', new Date().toISOString(), 'project_id');
            assert.strictEqual(ts.metric.type, 'otel/metric-name');
            assert.strictEqual(ts.metric.labels['keya'], 'value1');
            assert.strictEqual(ts.metric.labels['keyb'], 'value2');
            assert.strictEqual(ts.metric.labels[transform_1.TEST_ONLY.OPENTELEMETRY_TASK], transform_1.OPENTELEMETRY_TASK_VALUE_DEFAULT);
            assert.deepStrictEqual(ts.resource, {
                labels: { project_id: 'project_id' },
                type: 'global',
            });
            assert.strictEqual(ts.metricKind, types_1.MetricKind.CUMULATIVE);
            assert.strictEqual(ts.valueType, types_1.ValueType.DOUBLE);
            assert.strictEqual(ts.points.length, 1);
            assert.deepStrictEqual(ts.points[0].value, { doubleValue: 10 });
        });
        it('should detect an AWS instance', async () => {
            const meter = new sdk_metrics_base_1.MeterProvider({
                resource: new resources_1.Resource(mockAwsResource),
            }).getMeter('test-meter');
            const labels = { ['keya']: 'value1', ['keyb']: 'value2' };
            const counter = meter.createCounter(METRIC_NAME, {
                description: METRIC_DESCRIPTION,
            });
            counter.bind(labels).add(10);
            await meter.collect();
            const [record] = meter.getProcessor().checkPointSet();
            const ts = (0, transform_1.createTimeSeries)(record, 'otel', new Date().toISOString(), 'project_id');
            assert.deepStrictEqual(ts.resource, mockAwsMonitoredResource);
        });
        it('should detect a Google Cloud VM instance', async () => {
            const meter = new sdk_metrics_base_1.MeterProvider({
                resource: new resources_1.Resource(mockGCResource),
            }).getMeter('test-meter');
            const labels = { ['keya']: 'value1', ['keyb']: 'value2' };
            const counter = meter.createCounter(METRIC_NAME, {
                description: METRIC_DESCRIPTION,
            });
            counter.bind(labels).add(10);
            await meter.collect();
            const [record] = meter.getProcessor().checkPointSet();
            const ts = (0, transform_1.createTimeSeries)(record, 'otel', new Date().toISOString(), 'project_id');
            assert.deepStrictEqual(ts.resource, mockGCMonitoredResource);
        });
        it('should return global for an incomplete resource', async () => {
            // Missing host.id
            const incompleteResource = {
                'cloud.provider': 'gcp',
                'cloud.zone': 'my-zone',
            };
            const meter = new sdk_metrics_base_1.MeterProvider({
                resource: new resources_1.Resource(incompleteResource),
            }).getMeter('test-meter');
            const labels = { ['keya']: 'value1', ['keyb']: 'value2' };
            const counter = meter.createCounter(METRIC_NAME, {
                description: METRIC_DESCRIPTION,
            });
            counter.bind(labels).add(10);
            await meter.collect();
            const [record] = meter.getProcessor().checkPointSet();
            const ts = (0, transform_1.createTimeSeries)(record, 'otel', new Date().toISOString(), 'project_id');
            assert.deepStrictEqual(ts.resource, {
                labels: { project_id: 'project_id' },
                type: 'global',
            });
        });
        it('should return a Google Cloud Monitoring Metric for an observer', async () => {
            const meter = new sdk_metrics_base_1.MeterProvider().getMeter('test-meter');
            const labels = { keya: 'value1', keyb: 'value2' };
            meter.createSumObserver(METRIC_NAME, {
                description: METRIC_DESCRIPTION,
                valueType: api_metrics_1.ValueType.INT,
            }, result => {
                result.observe(int64Value, labels);
            });
            const int64Value = 0;
            await meter.collect();
            const [record] = meter.getProcessor().checkPointSet();
            const ts = (0, transform_1.createTimeSeries)(record, 'otel', new Date().toISOString(), 'project_id');
            assert(ts.points[0].interval.startTime);
            assert(ts.points[0].interval.endTime);
            assert.strictEqual(ts.metric.type, `otel/${METRIC_NAME}`);
            assert.strictEqual(ts.metric.labels['keya'], 'value1');
            assert.strictEqual(ts.metric.labels['keyb'], 'value2');
            assert.strictEqual(ts.metric.labels[transform_1.TEST_ONLY.OPENTELEMETRY_TASK], transform_1.OPENTELEMETRY_TASK_VALUE_DEFAULT);
            assert.deepStrictEqual(ts.resource, {
                labels: { project_id: 'project_id' },
                type: 'global',
            });
            assert.strictEqual(ts.metricKind, types_1.MetricKind.CUMULATIVE);
            assert.strictEqual(ts.valueType, types_1.ValueType.INT64);
            assert.strictEqual(ts.points.length, 1);
            assert.deepStrictEqual(ts.points[0].value, {
                int64Value: int64Value.toString(),
            });
        });
        it('should return a point', () => {
            const metricDescriptor = {
                name: METRIC_NAME,
                description: METRIC_DESCRIPTION,
                unit: DEFAULT_UNIT,
                metricKind: sdk_metrics_base_1.MetricKind.SUM_OBSERVER,
                valueType: api_metrics_1.ValueType.INT,
            };
            const point = {
                value: 50,
                timestamp: process.hrtime(),
            };
            const result = transform_1.TEST_ONLY.transformPoint(point, metricDescriptor, new Date().toISOString());
            assert.deepStrictEqual(result.value, { int64Value: '50' });
            assert(result.interval.endTime);
            assert(result.interval.startTime);
        });
        it('should export a histogram value', () => {
            const metricDescriptor = {
                name: METRIC_NAME,
                description: METRIC_DESCRIPTION,
                unit: DEFAULT_UNIT,
                metricKind: sdk_metrics_base_1.MetricKind.COUNTER,
                valueType: api_metrics_1.ValueType.DOUBLE,
            };
            const point = {
                value: {
                    buckets: {
                        boundaries: [10, 30],
                        counts: [1, 2],
                    },
                    sum: 70,
                    count: 3,
                },
                timestamp: process.hrtime(),
            };
            const result = transform_1.TEST_ONLY.transformPoint(point, metricDescriptor, new Date().toISOString());
            assert.deepStrictEqual(result.value, {
                distributionValue: {
                    bucketCounts: ['1', '2'],
                    bucketOptions: {
                        explicitBuckets: {
                            bounds: [10, 30],
                        },
                    },
                    count: '3',
                    mean: 23.333333333333332,
                },
            });
            assert(result.interval.endTime);
            assert(result.interval.startTime);
        });
    });
});
//# sourceMappingURL=transform.test.js.map
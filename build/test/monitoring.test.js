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
/* eslint-disable @typescript-eslint/no-explicit-any */
const assert = require("assert");
const nock = require("nock");
const sinon = require("sinon");
const src_1 = require("../src");
const core_1 = require("@opentelemetry/core");
const sdk_metrics_base_1 = require("@opentelemetry/sdk-metrics-base");
describe('MetricExporter', () => {
    beforeEach(() => {
        process.env.GCLOUD_PROJECT = 'not-real';
        nock.disableNetConnect();
    });
    describe('constructor', () => {
        it('should construct an exporter', () => {
            const exporter = new src_1.MetricExporter();
            assert.ok(typeof exporter.export === 'function');
            assert.ok(typeof exporter.shutdown === 'function');
        });
        it('should be able to shutdown', async () => {
            const exporter = new src_1.MetricExporter();
            await assert.doesNotReject(exporter.shutdown());
        });
        it('should construct an exporter', async () => {
            const exporter = new src_1.MetricExporter({
                credentials: {
                    client_email: 'noreply@fake.example.com',
                    private_key: 'this is a key',
                },
            });
            assert(exporter);
            return exporter['_projectId'].then(id => {
                assert.deepStrictEqual(id, 'not-real');
            });
        });
    });
    describe('export', () => {
        let exporter;
        let metricDescriptors;
        let timeSeries;
        let getClientShouldFail;
        let createTimeSeriesShouldFail;
        beforeEach(() => {
            getClientShouldFail = false;
            createTimeSeriesShouldFail = false;
            exporter = new src_1.MetricExporter({});
            metricDescriptors = sinon.spy((request, params, callback) => {
                callback(null);
            });
            sinon.replace(src_1.MetricExporter['_monitoring'].projects.metricDescriptors, 'create', metricDescriptors);
            timeSeries = sinon.spy((request, params, callback) => {
                if (createTimeSeriesShouldFail) {
                    return callback(new Error('fail'));
                }
                callback(null);
            });
            sinon.replace(src_1.MetricExporter['_monitoring'].projects.timeSeries, 'create', timeSeries);
            sinon.replace(exporter['_auth'], 'getClient', () => {
                if (getClientShouldFail) {
                    throw new Error('fail');
                }
                return {};
            });
        });
        afterEach(() => {
            nock.restore();
            sinon.restore();
        });
        it('should return FAILED if project id missing', async () => {
            await exporter['_projectId'];
            exporter['_projectId'] = undefined;
            const result = await new Promise(resolve => {
                exporter.export([], result => {
                    resolve(result);
                });
            });
            assert.strictEqual(result.code, core_1.ExportResultCode.FAILED);
        });
        it('should return FAILED if project id promise is rejected', async () => {
            await exporter['_projectId'];
            exporter['_projectId'] = Promise.reject({
                message: 'Failed to resolve projectId',
            });
            const result = await new Promise(resolve => {
                exporter.export([], result => {
                    resolve(result);
                });
            });
            assert.deepStrictEqual(result, {
                code: core_1.ExportResultCode.FAILED,
                error: {
                    message: 'Failed to resolve projectId',
                },
            });
        });
        it('should not raise an UnhandledPromiseRejectionEvent if projectId rejects', async () => {
            const meter = new sdk_metrics_base_1.MeterProvider().getMeter('test-meter');
            const labels = { ['keya']: 'value1', ['keyb']: 'value2' };
            const counter = meter.createCounter('name');
            counter.add(10, labels);
            await meter.collect();
            const records = meter.getProcessor().checkPointSet();
            await exporter['_projectId'];
            exporter['_projectId'] = Promise.reject({
                message: 'Failed to resolve projectId',
            });
            let unhandledPromiseRejectionEvent = false;
            process.on('unhandledRejection', () => {
                unhandledPromiseRejectionEvent = true;
            });
            await exporter.export(records, () => { });
            assert.strictEqual(unhandledPromiseRejectionEvent, false);
        });
        it('should export metrics', async () => {
            const meter = new sdk_metrics_base_1.MeterProvider().getMeter('test-meter');
            const labels = { ['keya']: 'value1', ['keyb']: 'value2' };
            const counter = meter.createCounter('name');
            counter.add(10, labels);
            await meter.collect();
            const records = meter.getProcessor().checkPointSet();
            const result = await new Promise(resolve => {
                exporter.export(records, result => {
                    resolve(result);
                });
            });
            assert.deepStrictEqual(metricDescriptors.getCall(0).args[0].requestBody.type, 'custom.googleapis.com/opentelemetry/name');
            assert.strictEqual(metricDescriptors.callCount, 1);
            assert.strictEqual(timeSeries.callCount, 1);
            assert.strictEqual(result.code, core_1.ExportResultCode.SUCCESS);
        });
        it('should return FAILED if there is an error sending TimeSeries', async () => {
            const meter = new sdk_metrics_base_1.MeterProvider().getMeter('test-meter');
            const labels = { ['keya']: 'value1', ['keyb']: 'value2' };
            const counter = meter.createCounter('name');
            counter.add(10, labels);
            await meter.collect();
            const records = meter.getProcessor().checkPointSet();
            createTimeSeriesShouldFail = true;
            const result = await new Promise(resolve => {
                exporter.export(records, result => {
                    resolve(result);
                });
            });
            assert.deepStrictEqual(metricDescriptors.getCall(0).args[0].requestBody.type, 'custom.googleapis.com/opentelemetry/name');
            assert.strictEqual(metricDescriptors.callCount, 1);
            assert.strictEqual(timeSeries.callCount, 1);
            assert.deepStrictEqual(result.code, core_1.ExportResultCode.FAILED);
        });
        it('should enforce batch size limit on metrics', async () => {
            const meter = new sdk_metrics_base_1.MeterProvider().getMeter('test-meter');
            const labels = { ['keya']: 'value1', ['keyb']: 'value2' };
            let nMetrics = 401;
            while (nMetrics > 0) {
                nMetrics -= 1;
                const counter = meter.createCounter(`name${nMetrics.toString()}`);
                counter.bind(labels).add(10);
            }
            await meter.collect();
            const records = meter.getProcessor().checkPointSet();
            const result = await new Promise(resolve => {
                exporter.export(records, result => {
                    resolve(result);
                });
            });
            assert.deepStrictEqual(metricDescriptors.getCall(0).args[0].requestBody.type, 'custom.googleapis.com/opentelemetry/name400');
            assert.deepStrictEqual(metricDescriptors.getCall(100).args[0].requestBody.type, 'custom.googleapis.com/opentelemetry/name300');
            assert.deepStrictEqual(metricDescriptors.getCall(400).args[0].requestBody.type, 'custom.googleapis.com/opentelemetry/name0');
            assert.strictEqual(metricDescriptors.callCount, 401);
            assert.strictEqual(timeSeries.callCount, 3);
            assert.strictEqual(result.code, core_1.ExportResultCode.SUCCESS);
        });
        it('should use the same startTime for cumulative metrics each export', async () => {
            const meter = new sdk_metrics_base_1.MeterProvider().getMeter('test-meter');
            const labels = { ['keya']: 'value1', ['keyb']: 'value2' };
            const counter = meter.createCounter('name');
            counter.add(10, labels);
            await meter.collect();
            const records1 = meter.getProcessor().checkPointSet();
            await new Promise(resolve => {
                exporter.export(records1, result => {
                    resolve(result);
                });
            });
            assert(timeSeries.calledOnce);
            const calledWithSeries1 = timeSeries.firstCall.args[0].requestBody.timeSeries;
            assert.strictEqual(calledWithSeries1.length, 1);
            assert.strictEqual(calledWithSeries1[0].points.length, 1);
            const interval1 = calledWithSeries1[0].points[0].interval;
            assert(interval1.startTime);
            assert(interval1.endTime);
            // Export a second time
            counter.add(15, labels);
            await meter.collect();
            const records2 = meter.getProcessor().checkPointSet();
            await new Promise(resolve => {
                exporter.export(records2, result => {
                    resolve(result);
                });
            });
            assert(timeSeries.calledTwice);
            const calledWithSeries2 = timeSeries.secondCall.args[0].requestBody.timeSeries;
            assert.strictEqual(calledWithSeries2.length, 1);
            assert.strictEqual(calledWithSeries2[0].points.length, 1);
            const interval2 = calledWithSeries2[0].points[0].interval;
            assert(interval1.startTime);
            assert(interval1.endTime);
            assert.strictEqual(interval1.startTime, interval2.startTime);
            assert(interval2.endTime);
        });
    });
});
//# sourceMappingURL=monitoring.test.js.map
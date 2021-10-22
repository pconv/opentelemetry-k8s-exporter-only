import { TimeSeries } from './types';
/** Returns the minimum number of arrays of max size chunkSize, partitioned from the given array. */
export declare function partitionList(list: TimeSeries[], chunkSize: number): TimeSeries[][];

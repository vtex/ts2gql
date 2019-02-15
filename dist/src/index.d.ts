/// <reference types="node" />
import { CollectorType } from './Collector';
export declare function load(schemaRootPath: string, rootNodeNames: string[]): CollectorType;
export declare function emit(schemaRootPath: string, rootNodeNames: string[], stream?: NodeJS.WritableStream): void;

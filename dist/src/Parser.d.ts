import * as types from './types';
export interface PartialParseResult {
    nextIdx: number;
}
export interface ArgNameParseResult extends PartialParseResult {
    argName: string;
}
export interface ArgValueParseResult extends PartialParseResult {
    argValue: types.ValueNode;
}
export declare class ParsingFailedException extends Error {
}
export declare class MethodParamsParser {
    private tokenizer;
    private tokens;
    private args;
    constructor();
    parse(stringToParse: string): types.MethodParamsNode;
    _parseArgs(): types.TypeMap;
    _parseArg(start: number): number;
}

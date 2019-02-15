import * as types from './types';
export declare class MethodParamsParser {
    private tokenizer;
    private tokens;
    private args;
    constructor();
    parse(stringToParse: string): types.DirectiveInputValueNode[];
    _parseArgs(): Map<string, types.DirectiveInputValueNode>;
    _parseArg(start: number): number;
}

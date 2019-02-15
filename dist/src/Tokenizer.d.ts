export declare enum TokenType {
    PARAMETER_LIST_BEGIN = "PARAMETER_LIST_BEGIN",
    PARAMETER_NAME = "PARAMETER_NAME",
    PARAMETER_NAME_VALUE_SEPARATOR = "PARAMETER_NAME_VALUE_SEPARATOR",
    PARAMETER_VALUE = "PARAMETER_VALUE",
    PARAMETER_SEPARATOR = "PARAMETER_SEPARATOR",
    PARAMETER_LIST_END = "PARAMETER_LIST_END"
}
export declare class MethodParamsToken {
    type: TokenType;
    value: string;
    constructor(type: TokenType, value: string);
}
export declare class MethodParamsTokenizer {
    private tokens;
    private raw;
    constructor();
    tokenize(content: string): MethodParamsToken[];
    begin(): void;
    parameter(idx: number): number;
    parameterName(idx: number): number;
    parameterValue(idx: number): number;
    stringLiteral(idx: number): number;
    _checkPrimitiveValue(value: string): boolean;
    _checkNameValue(value: string): boolean;
    _checkNumberValue(value: string): boolean;
    _ignore(ignore: RegExp, start: number): number;
    _until(ignore: RegExp, start: number): number;
}

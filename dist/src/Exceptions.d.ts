import * as typescript from 'typescript';
export declare class TranspilationError extends Error {
    protected fileName: string;
    protected lineNumber: number;
    constructor(node: typescript.Node, msg: string);
    protected fileAndLine: () => string;
}
export declare class InterfaceError extends TranspilationError {
    constructor(node: typescript.InterfaceDeclaration, msg: string);
}
export declare class PropertyError extends TranspilationError {
    constructor(node: typescript.TypeElement, msg: string);
}
export declare class InputValueError extends TranspilationError {
    constructor(node: typescript.ParameterDeclaration, msg: string);
}
export declare class TypeAliasError extends TranspilationError {
    constructor(node: typescript.TypeAliasDeclaration, msg: string);
}
export declare class EnumError extends TranspilationError {
    constructor(node: typescript.EnumDeclaration, msg: string);
}

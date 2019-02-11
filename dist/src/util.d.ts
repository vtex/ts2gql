import * as doctrine from 'doctrine';
import * as typescript from 'typescript';
import * as types from './types';
export declare function documentationForNode(node: typescript.Node, source?: string): doctrine.ParseResult | undefined;
export declare function isPrimitive(node: types.Node): boolean;
export declare function unwrapNotNull(node: types.Node): types.Node;
export declare function wrapNotNull(node: types.Node): types.NotNullNode;

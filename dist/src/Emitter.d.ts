/// <reference types="node" />
import * as types from './types';
import { CollectorType } from './Collector';
export default class Emitter {
    private typeMap;
    private root;
    private emissionMap;
    private emissionQueue;
    constructor(collector: CollectorType);
    emitAll(stream: NodeJS.WritableStream): void;
    _emitTopLevelNode(node: types.TypeDefinitionNode, name: types.SymbolName): void;
    _emitSchema(): string;
    _emitDescription(desc: string | undefined): string;
    _emitObject(node: types.ObjectTypeDefinitionNode, name: string): string;
    _emitImplementations(node: types.ObjectTypeDefinitionNode): string;
    _emitInterface(node: types.InterfaceTypeDefinitionNode, name: types.SymbolName): string;
    _emitFields(fields: types.FieldDefinitionNode[]): string;
    _emitField(field: types.FieldDefinitionNode): string;
    _emitArguments(args?: (types.InputValueDefinitionNode | types.DirectiveInputValueNode)[]): string;
    _emitInputValue: (node: types.InputValueDefinitionNode | types.DirectiveInputValueNode) => string;
    _emitFieldDirectives(directives?: types.DirectiveDefinitionNode[]): string;
    _emitInputObject(node: types.InputObjectTypeDefinition, name: types.SymbolName): string;
    _emitEnum(node: types.EnumTypeDefinitionNode, name: types.SymbolName): string;
    _emitEnumFields(fields: types.EnumFieldDefinitionNode[]): string;
    _emitUnion(node: types.UnionTypeDefinitionNode, name: types.SymbolName): string;
    _emitScalarDefinition(node: types.ScalarTypeDefinitionNode, name: types.SymbolName): string;
    _emitExpression: (node: types.ObjectTypeNode | types.CustomScalarTypeNode | types.StringTypeNode | types.IntTypeNode | types.FloatTypeNode | types.BooleanTypeNode | types.IDTypeNode | types.EnumTypeNode | types.InputObjectTypeNode | types.ListNode<types.NamedInputTypeNode> | types.InterfaceTypeNode | types.UnionTypeNode | types.ListNode<types.NamedOutputTypeNode> | types.ValueNode | types.ListNode<types.NamedTypeNode>) => string;
    _name: (name: string) => string;
    _indent(content: string | string[]): string;
}

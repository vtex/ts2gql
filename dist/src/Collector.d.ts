import * as doctrine from 'doctrine';
import * as typescript from 'typescript';
import * as types from './types';
export interface CollectorType {
    resolved: types.TypeDefinitionMap;
    root?: types.SchemaDefinitionNode;
}
/**
 * Walks declarations from a TypeScript programs, and builds up a map of
 * referenced types.
 */
export declare class Collector implements CollectorType {
    resolved: types.TypeDefinitionMap;
    root?: types.SchemaDefinitionNode;
    private checker;
    private unresolved;
    private unresolvedCircular;
    private circularlyExtending;
    constructor(program: typescript.Program);
    addRootNode(node: typescript.InterfaceDeclaration): void;
    mergeOverrides(node: typescript.InterfaceDeclaration, name: types.SymbolName): void;
    _walkDeclaration(node: typescript.Node): types.TypeDefinitionNode;
    _walkInherited(node: typescript.InterfaceDeclaration): types.ReferenceNode[];
    _walkSymbolDeclaration: (symbol: typescript.Symbol) => types.TypeDefinitionNode;
    _walkTypeReferenceNode(node: typescript.TypeReferenceNode): types.ReferenceTypeNode | types.IntTypeNode | types.IDTypeNode;
    _walkType: (node: typescript.Node) => types.TypeNode;
    _walkUnion(node: typescript.UnionTypeNode): types.TypeNode;
    _walkUnion(node: typescript.UnionTypeNode, name: types.SymbolName, doc?: doctrine.ParseResult): types.UnionTypeDefinitionNode | types.ScalarTypeDefinitionNode | types.DefinitionAliasNode | types.EnumTypeDefinitionNode;
    _walkUnionMembersFlat(unionTypes: typescript.Node[]): types.TypeNode[];
    _collectInterfaceDeclaration(node: typescript.InterfaceDeclaration): types.InterfaceTypeDefinitionNode | types.InputObjectTypeDefinition;
    _collectFieldDefinition(field: typescript.TypeElement, category: types.GQLTypeCategory.INPUT): types.InputFieldDefinitionNode;
    _collectFieldDefinition(field: typescript.TypeElement, category: types.GQLTypeCategory.OUTPUT): types.OutputFieldDefinitionNode;
    _collectArgumentsDefinition(params: typescript.NodeArray<typescript.ParameterDeclaration>): types.InputValueDefinitionNode[];
    _collectInputValueDefinition: (param: typescript.ParameterDeclaration) => types.InputValueDefinitionNode;
    _collectReferenceForSymbol(symbol: typescript.Symbol): types.ReferenceTypeNode | types.IntTypeNode | types.IDTypeNode;
    _collectList(node: typescript.ArrayTypeNode): types.ListTypeNode;
    _collectBuiltInScalar(kind: typescript.SyntaxKind): types.BuiltInScalarTypeNode;
    _collectDirectives(jsDoc: doctrine.ParseResult): types.DirectiveDefinitionNode[];
    _collectTypeAliasDeclaration(node: typescript.TypeAliasDeclaration): types.ScalarTypeDefinitionNode | types.UnionTypeDefinitionNode | types.EnumTypeDefinitionNode | types.DefinitionAliasNode;
    _collectIntOrIDKind(type: types.TypeNode, doc: doctrine.ParseResult | undefined): types.GQLTypeKind.INT_TYPE | types.GQLTypeKind.ID_TYPE | undefined;
    _collectUnionExpression: (node: typescript.UnionTypeNode) => types.TypeNode;
    _collectUnionDefinition(node: typescript.UnionTypeNode, name: types.SymbolName, doc?: doctrine.ParseResult): types.UnionTypeDefinitionNode | types.ScalarTypeDefinitionNode | types.EnumTypeDefinitionNode | types.DefinitionAliasNode;
    _collectEnumDeclaration(node: typescript.EnumDeclaration): types.EnumTypeDefinitionNode;
    _collectDescription(doc: doctrine.ParseResult | undefined): string | undefined;
    _addTypeDefinition<T extends types.TypeDefinitionNode>(typeDefinition: T): T;
    _symbolForNode(node: typescript.Node): typescript.Symbol;
    _nameForSymbol(symbol: typescript.Symbol): types.SymbolName;
    _expandSymbol(symbol: typescript.Symbol): typescript.Symbol;
    _concrete(node: types.InterfaceTypeDefinitionNode): types.ObjectTypeDefinitionNode;
    _directiveFromDocTag(jsDocTag: doctrine.Tag): types.DirectiveDefinitionNode;
    _filterNullUndefined(nodes: typescript.NodeArray<typescript.Node>): typescript.Node[];
    _unwrapAlias(referenced: types.TypeDefinitionNode): types.TypeDefinitionNode | undefined;
}

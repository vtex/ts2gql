import * as doctrine from 'doctrine';
export declare type SymbolName = string;
export interface TranspiledNode {
    documentation?: doctrine.ParseResult;
    description?: string;
    originalLine?: number;
    originalColumn?: number;
}
export declare enum GQLDefinitionKind {
    OBJECT_DEFINITION = "object definition",
    INTERFACE_DEFINITION = "interface definition",
    ENUM_DEFINITION = "enum definition",
    INPUT_OBJECT_DEFINITION = "input object definition",
    UNION_DEFINITION = "union definition",
    SCALAR_DEFINITION = "scalar definition",
    FIELD_DEFINITION = "field definition",
    INPUT_VALUE_DEFINITION = "input value definition",
    ENUM_FIELD_DEFINITION = "enum field definition",
    DEFINITION_ALIAS = "definition alias",
    DIRECTIVE = "directive",
    DIRECTIVE_INPUT_VALUE_DEFINITION = "directive input value definition"
}
export declare enum GQLTypeKind {
    LIST_TYPE = "list",
    REFERENCE = "reference",
    OBJECT_TYPE = "object type",
    INTERFACE_TYPE = "interface type",
    ENUM_TYPE = "enum type",
    INPUT_OBJECT_TYPE = "input object type",
    UNION_TYPE = "union type",
    CUSTOM_SCALAR_TYPE = "custom scalar",
    STRING_TYPE = "string",
    INT_TYPE = "int",
    FLOAT_TYPE = "float",
    BOOLEAN_TYPE = "boolean",
    ID_TYPE = "id",
    STRING_LITERAL = "string literal",
    VALUE = "value"
}
export interface NamedNode {
    name: SymbolName;
}
export interface NullableNode {
    nullable: boolean;
}
export interface ReferenceNode extends NullableNode {
    target: SymbolName;
}
export interface SchemaDefinitionNode extends TranspiledNode {
    query: SymbolName;
    mutation?: SymbolName;
}
export interface GraphQLDefinitionNode extends TranspiledNode, NamedNode {
    kind: GQLDefinitionKind;
}
export interface ObjectTypeDefinitionNode extends GraphQLDefinitionNode {
    kind: GQLDefinitionKind.OBJECT_DEFINITION;
    fields: OutputFieldDefinitionNode[];
    implements: ReferenceNode[];
}
export interface InterfaceTypeDefinitionNode extends GraphQLDefinitionNode {
    kind: GQLDefinitionKind.INTERFACE_DEFINITION;
    fields: OutputFieldDefinitionNode[];
    implements: ReferenceNode[];
}
export interface InputObjectTypeDefinition extends GraphQLDefinitionNode {
    kind: GQLDefinitionKind.INPUT_OBJECT_DEFINITION;
    fields: InputFieldDefinitionNode[];
    implements: ReferenceNode[];
}
export interface EnumTypeDefinitionNode extends GraphQLDefinitionNode, NullableNode {
    kind: GQLDefinitionKind.ENUM_DEFINITION;
    fields: EnumFieldDefinitionNode[];
}
export interface UnionTypeDefinitionNode extends GraphQLDefinitionNode, NullableNode {
    kind: GQLDefinitionKind.UNION_DEFINITION;
    members: ObjectTypeNode[];
}
export interface ScalarTypeDefinitionNode extends GraphQLDefinitionNode, NullableNode {
    kind: GQLDefinitionKind.SCALAR_DEFINITION;
    builtIn?: GQLTypeKind.INT_TYPE | GQLTypeKind.ID_TYPE;
}
export interface DefinitionAliasNode extends GraphQLDefinitionNode, NullableNode, ReferenceNode {
    kind: GQLDefinitionKind.DEFINITION_ALIAS;
}
export declare type TypeDefinitionNode = ObjectTypeDefinitionNode | InterfaceTypeDefinitionNode | EnumTypeDefinitionNode | InputObjectTypeDefinition | UnionTypeDefinitionNode | ScalarTypeDefinitionNode | DefinitionAliasNode;
export declare type TypeDefinitionMap = Map<string, TypeDefinitionNode>;
export interface FieldDefinitionNode extends GraphQLDefinitionNode {
    kind: GQLDefinitionKind.FIELD_DEFINITION;
    category: GQLTypeCategory;
    type: InputTypeNode | OutputTypeNode;
    arguments?: InputValueDefinitionNode[];
    directives?: DirectiveDefinitionNode[];
}
export interface InputFieldDefinitionNode extends FieldDefinitionNode {
    category: GQLTypeCategory.INPUT;
    type: InputTypeNode;
}
export interface OutputFieldDefinitionNode extends FieldDefinitionNode {
    category: GQLTypeCategory.OUTPUT;
    type: OutputTypeNode;
}
export interface InputValueDefinitionNode extends GraphQLDefinitionNode {
    kind: GQLDefinitionKind.INPUT_VALUE_DEFINITION;
    value: InputTypeNode;
}
export interface DirectiveDefinitionNode extends GraphQLDefinitionNode {
    kind: GQLDefinitionKind.DIRECTIVE;
    args: DirectiveInputValueNode[];
}
export interface DirectiveInputValueNode extends GraphQLDefinitionNode {
    kind: GQLDefinitionKind.DIRECTIVE_INPUT_VALUE_DEFINITION;
    value: ValueNode;
}
export interface EnumFieldDefinitionNode extends GraphQLDefinitionNode {
    kind: GQLDefinitionKind.ENUM_FIELD_DEFINITION;
}
export interface GraphQLTypeNode extends TranspiledNode {
    kind: GQLTypeKind;
}
export declare enum GQLTypeCategory {
    INPUT = "input",
    OUTPUT = "output"
}
export declare type NamedInputTypeNode = ScalarTypeNode | EnumTypeNode | InputObjectTypeNode;
export declare type NamedOutputTypeNode = ScalarTypeNode | ObjectTypeNode | InterfaceTypeNode | UnionTypeNode | EnumTypeNode;
export declare type NamedTypeNode = NamedInputTypeNode | NamedOutputTypeNode;
export declare type WrappingInputTypeNode = ListInputTypeNode;
export declare type WrappingOutputTypeNode = ListOutputTypeNode;
export declare type WrappingTypeNode = ListInputTypeNode | ListOutputTypeNode | ListTypeNode;
export declare type InputTypeNode = NamedInputTypeNode | WrappingInputTypeNode;
export declare type OutputTypeNode = NamedOutputTypeNode | WrappingOutputTypeNode;
export declare type TypeNode = NamedTypeNode | WrappingTypeNode;
export interface WrappingNode<T extends GraphQLTypeNode | ReferenceNode> extends GraphQLTypeNode, NullableNode {
    wrapped: T;
}
export interface ListNode<T extends GraphQLTypeNode & NullableNode> extends WrappingNode<T | ListNode<T>> {
    kind: GQLTypeKind.LIST_TYPE;
}
export declare type ListInputTypeNode = ListNode<NamedInputTypeNode>;
export declare type ListOutputTypeNode = ListNode<NamedOutputTypeNode>;
export declare type ListTypeNode = ListNode<NamedTypeNode>;
export declare type ReferenceTypeNode = ObjectTypeNode | InterfaceTypeNode | EnumTypeNode | InputObjectTypeNode | UnionTypeNode | CustomScalarTypeNode;
export declare const DefinitionFromType: Map<GQLDefinitionKind, GQLTypeKind.OBJECT_TYPE | GQLTypeKind.INTERFACE_TYPE | GQLTypeKind.ENUM_TYPE | GQLTypeKind.INPUT_OBJECT_TYPE | GQLTypeKind.UNION_TYPE | GQLTypeKind.CUSTOM_SCALAR_TYPE>;
export interface ObjectTypeNode extends GraphQLTypeNode, ReferenceNode {
    kind: GQLTypeKind.OBJECT_TYPE;
}
export interface InterfaceTypeNode extends GraphQLTypeNode, ReferenceNode {
    kind: GQLTypeKind.INTERFACE_TYPE;
}
export interface EnumTypeNode extends GraphQLTypeNode, ReferenceNode {
    kind: GQLTypeKind.ENUM_TYPE;
}
export interface InputObjectTypeNode extends GraphQLTypeNode, ReferenceNode {
    kind: GQLTypeKind.INPUT_OBJECT_TYPE;
}
export interface UnionTypeNode extends GraphQLTypeNode, ReferenceNode {
    kind: GQLTypeKind.UNION_TYPE;
}
export interface CustomScalarTypeNode extends GraphQLTypeNode, ReferenceNode {
    kind: GQLTypeKind.CUSTOM_SCALAR_TYPE;
}
export interface StringTypeNode extends GraphQLTypeNode, NullableNode {
    kind: GQLTypeKind.STRING_TYPE;
}
export interface IntTypeNode extends GraphQLTypeNode, NullableNode {
    kind: GQLTypeKind.INT_TYPE;
}
export interface FloatTypeNode extends GraphQLTypeNode, NullableNode {
    kind: GQLTypeKind.FLOAT_TYPE;
}
export declare type NumberTypeNode = IntTypeNode | FloatTypeNode;
export interface BooleanTypeNode extends GraphQLTypeNode, NullableNode {
    kind: GQLTypeKind.BOOLEAN_TYPE;
}
export interface IDTypeNode extends GraphQLTypeNode, NullableNode {
    kind: GQLTypeKind.ID_TYPE;
}
export declare type BuiltInScalarTypeNode = StringTypeNode | NumberTypeNode | BooleanTypeNode | IDTypeNode;
export declare type ScalarTypeNode = CustomScalarTypeNode | BuiltInScalarTypeNode;
export interface ValueNode extends GraphQLTypeNode {
    kind: GQLTypeKind.VALUE;
    value: string;
}

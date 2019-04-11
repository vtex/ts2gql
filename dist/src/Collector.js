"use strict";
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __values = (this && this.__values) || function (o) {
    var m = typeof Symbol === "function" && o[Symbol.iterator], i = 0;
    if (m) return m.call(o);
    return {
        next: function () {
            if (o && i >= o.length) o = void 0;
            return { value: o && o[i++], done: !o };
        }
    };
};
Object.defineProperty(exports, "__esModule", { value: true });
var _ = require("lodash");
var typescript = require("typescript");
var types = require("./types");
var util = require("./util");
var excpt = require("./Exceptions");
var Parser_1 = require("./Parser");
var SyntaxKind = typescript.SyntaxKind;
/**
 * Walks declarations from a TypeScript programs, and builds up a map of
 * referenced types.
 */
var Collector = /** @class */ (function () {
    function Collector(program) {
        var _this = this;
        this.resolved = new Map();
        this.unresolved = new Map();
        this.unresolvedCircular = new Map();
        this.circularlyExtending = new Set();
        this._walkSymbolDeclaration = function (symbol) {
            var declarations = symbol.getDeclarations();
            if (!declarations || declarations.length === 0) {
                throw new Error("Could not find TypeScript declarations for symbol " + symbol.name + ".");
            }
            else if (declarations.length > 1) {
                throw new Error("Conflicting declarations for symbol " + symbol.name + ".");
            }
            return _this._walkDeclaration(declarations[0]);
        };
        this._walkType = function (node) {
            var result;
            switch (node.kind) {
                case SyntaxKind.ParenthesizedType:
                    var parenthesizedNode = node;
                    result = _this._walkType(parenthesizedNode.type);
                    break;
                case SyntaxKind.ArrayType:
                    result = _this._collectList(node);
                    break;
                case SyntaxKind.TypeReference:
                    result = _this._walkTypeReferenceNode(node);
                    break;
                case SyntaxKind.UnionType:
                    result = _this._walkUnion(node);
                    break;
                case SyntaxKind.StringKeyword:
                case SyntaxKind.NumberKeyword:
                case SyntaxKind.BooleanKeyword:
                    result = _this._collectBuiltInScalar(node.kind);
                    break;
                default:
                    throw new Error("Unsupported TypeScript type " + SyntaxKind[node.kind] + ".");
            }
            return result;
        };
        this._collectInputValueDefinition = function (param) {
            var name = param.name.getText();
            var collected = _this._walkType(param.type);
            if (!util.isInputType(collected)) {
                var kind = util.isWrappingType(collected) ? collected.wrapped.kind : collected.kind;
                var msg = "Argument lists accept only GraphQL Scalars, Enums and Input Object types. Got " + kind + ".";
                throw new excpt.InputValueError(param, msg);
            }
            if (param.questionToken) {
                collected.nullable = true;
            }
            return {
                name: name,
                kind: types.GQLDefinitionKind.INPUT_VALUE_DEFINITION,
                value: collected,
            };
        };
        this._collectUnionExpression = function (node) {
            var unionMembers = _this._filterNullUndefined(node.types).map(_this._walkType);
            if (unionMembers.length < 1) {
                throw new Error("Empty union expression.");
            }
            else if (unionMembers.length > 1) {
                throw new Error("Union expressions are only allowed to have a single type reference."
                    + " For multiple type references, please use create an appropriate GraphQL Union.");
            }
            var member = unionMembers[0];
            if (unionMembers.length !== node.types.length) {
                member.nullable = true;
            }
            return member;
        };
        this.checker = program.getTypeChecker();
    }
    Collector.prototype.addRootNode = function (node) {
        var collectedRoot = this._walkDeclaration(node);
        if (collectedRoot.kind === types.GQLDefinitionKind.INTERFACE_DEFINITION) {
            this.resolved.set(collectedRoot.name, this._concrete(collectedRoot));
        }
        else if (collectedRoot.kind !== types.GQLDefinitionKind.OBJECT_DEFINITION) {
            throw new excpt.InterfaceError(node, "Expected root definition " + node.name.getText() + " as GraphQL Object definition. Got " + collectedRoot.kind + ".");
        }
        if (collectedRoot.fields.some(function (field) { return field.name !== 'query' && field.name !== 'mutation'; })) {
            throw new excpt.InterfaceError(node, "Schema definition may only have query or mutation fields.");
        }
        // Update root node
        var queryField = collectedRoot.fields.find(function (field) { return field.name === 'query'; });
        if (!queryField) {
            throw new excpt.InterfaceError(node, "Schema definition without query field.");
        }
        else if (queryField.type.kind !== types.GQLTypeKind.OBJECT_TYPE) {
            throw new excpt.InterfaceError(node, "Query root definition must be a GraphQL Object.");
        }
        this.root = {
            query: queryField.type.target,
        };
        var mutationField = collectedRoot.fields.find(function (field) { return field.name === 'mutation'; });
        if (mutationField) {
            if (mutationField.type.kind !== types.GQLTypeKind.OBJECT_TYPE) {
                throw new excpt.InterfaceError(node, "Mutation root definition must be a GraphQL Object.");
            }
            this.root = __assign({}, this.root, { mutation: mutationField.type.target });
        }
        // Remove Root Object from type list
        this.resolved.delete(collectedRoot.name);
    };
    Collector.prototype.mergeOverrides = function (node, name) {
        var _this = this;
        var existing = this.resolved.get(name);
        if (!existing) {
            throw new excpt.InterfaceError(node, "Cannot override '" + name + "' - it was never included");
        }
        else if (existing.kind !== types.GQLDefinitionKind.OBJECT_DEFINITION
            && existing.kind !== types.GQLDefinitionKind.INTERFACE_DEFINITION) {
            throw new excpt.InterfaceError(node, "Cannot override '" + name + "' - it is not a GraphQL Type or Interface");
        }
        var overrides = node.members.map(function (member) { return _this._collectFieldDefinition(member, types.GQLTypeCategory.OUTPUT); });
        var overriddenNames = new Set(overrides.map(function (prop) { return prop.name; }));
        existing.fields = _(existing.fields)
            .filter(function (m) { return !overriddenNames.has(m.name); })
            .concat(overrides)
            .value();
    };
    //
    // TypeScript Node Walking
    //
    Collector.prototype._walkDeclaration = function (node) {
        if (this.unresolved.has(node)) {
            return this.unresolved.get(node);
        }
        var typeDefinition = {};
        this.unresolved.set(node, typeDefinition);
        var result = null;
        switch (node.kind) {
            case SyntaxKind.InterfaceDeclaration:
                result = this._collectInterfaceDeclaration(node);
                break;
            case SyntaxKind.TypeAliasDeclaration:
                result = this._collectTypeAliasDeclaration(node);
                break;
            case SyntaxKind.EnumDeclaration:
                result = this._collectEnumDeclaration(node);
                break;
            default:
                throw new excpt.TranspilationError(node, "Don't know how to handle " + node.getText() + " as " + SyntaxKind[node.kind] + " node");
        }
        Object.assign(typeDefinition, result);
        var pending = this.unresolvedCircular.get(typeDefinition.name);
        if (pending) {
            var pendingName = pending.name.getText();
            this.unresolved.delete(pending);
            this.resolved.delete(pendingName);
            this.unresolvedCircular.delete(typeDefinition.name);
            this.circularlyExtending.delete(pendingName);
            this._walkDeclaration(pending);
        }
        return typeDefinition;
    };
    Collector.prototype._walkInherited = function (node) {
        var e_1, _a, e_2, _b;
        var inherits = [];
        if (node.heritageClauses) {
            try {
                for (var _c = __values(node.heritageClauses), _d = _c.next(); !_d.done; _d = _c.next()) {
                    var clause = _d.value;
                    try {
                        for (var _e = __values(clause.types), _f = _e.next(); !_f.done; _f = _e.next()) {
                            var type = _f.value;
                            var symbol = this._symbolForNode(type.expression);
                            this._walkSymbolDeclaration(symbol);
                            inherits.push({
                                nullable: false,
                                target: this._nameForSymbol(symbol),
                            });
                        }
                    }
                    catch (e_2_1) { e_2 = { error: e_2_1 }; }
                    finally {
                        try {
                            if (_f && !_f.done && (_b = _e.return)) _b.call(_e);
                        }
                        finally { if (e_2) throw e_2.error; }
                    }
                }
            }
            catch (e_1_1) { e_1 = { error: e_1_1 }; }
            finally {
                try {
                    if (_d && !_d.done && (_a = _c.return)) _a.call(_c);
                }
                finally { if (e_1) throw e_1.error; }
            }
        }
        return inherits;
    };
    Collector.prototype._walkTypeReferenceNode = function (node) {
        if (!node.typeName.getText()) {
            throw new Error("Missing reference name.");
        }
        return this._collectReferenceForSymbol(this._symbolForNode(node.typeName));
    };
    Collector.prototype._walkUnion = function (node, name, doc) {
        return name ? this._collectUnionDefinition(node, name, doc) : this._collectUnionExpression(node);
    };
    Collector.prototype._walkUnionMembersFlat = function (unionTypes) {
        var _this = this;
        var collectedMembers = unionTypes.map(function (type) {
            var collected = _this._walkType(type);
            if (collected.kind !== types.GQLTypeKind.UNION_TYPE) {
                return collected;
            }
            var referenced = _this.resolved.get(collected.target);
            return referenced.members;
        });
        return _.flatten(collectedMembers);
    };
    //
    // GraphQL Node Collecting
    //
    Collector.prototype._collectInterfaceDeclaration = function (node) {
        var _this = this;
        var documentation = util.documentationForNode(node);
        var name = this._nameForSymbol(this._symbolForNode(node.name));
        var inherits = this._walkInherited(node);
        var isInput = !!documentation && !!_.find(documentation.tags, function (tag) {
            return tag.title === 'graphql' && /^[Ii]nput$/.test(tag.description);
        });
        var inheritedDefinitionChecker = isInput ?
            function (definition) {
                return definition.kind === types.GQLDefinitionKind.INPUT_OBJECT_DEFINITION;
            }
            : function (definition) {
                return definition.kind === types.GQLDefinitionKind.OBJECT_DEFINITION
                    || definition.kind === types.GQLDefinitionKind.INTERFACE_DEFINITION;
            };
        var ownFields;
        try {
            ownFields = node.members.map(function (member) {
                if (isInput) {
                    return _this._collectFieldDefinition(member, types.GQLTypeCategory.INPUT);
                }
                return _this._collectFieldDefinition(member, types.GQLTypeCategory.OUTPUT);
            });
        }
        catch (e) {
            throw new excpt.InterfaceError(node, e.message);
        }
        if (ownFields.length !== _.uniqBy(ownFields, function (field) { return field.name; }).length) {
            throw new excpt.InterfaceError(node, "Conflicting field names.");
        }
        var inheritedFields = _.flatten(inherits.map(function (inherited) {
            var inheritedName = inherited.target;
            var inheritedDefinition = _this._unwrapAlias(_this.resolved.get(inheritedName));
            if (!inheritedDefinition) {
                // Circularly extending a TypeScript interface. Ignore and schedule revisiting
                _this.unresolvedCircular.set(inherited.target, node);
                _this.circularlyExtending.add(name);
                return [];
            }
            else if (!inheritedDefinitionChecker(inheritedDefinition)) {
                var expectedType = isInput ? types.GQLDefinitionKind.INPUT_OBJECT_DEFINITION
                    : types.GQLDefinitionKind.OBJECT_DEFINITION + " or " + types.GQLDefinitionKind.INTERFACE_DEFINITION;
                var msg = "Incompatible inheritance of '" + inheritedDefinition.name + "'."
                    + (" Expected type '" + expectedType + "', got '" + inheritedDefinition.kind + "'.");
                throw new excpt.InterfaceError(node, msg);
            }
            if (_this.circularlyExtending.has(inheritedName)) {
                // If extending interface found a circular reference, this interface may need to update its fields later on
                _this.unresolvedCircular.set(inheritedName, node);
            }
            return inheritedDefinition.fields;
        }));
        var inheritedPropNames = inheritedFields.map(function (field) { return field.name; });
        if (_.uniq(inheritedPropNames).length !== inheritedPropNames.length) {
            throw new excpt.InterfaceError(node, "There are conflicting properties between inherited TypeScript interfaces.");
        }
        var ownFieldNames = new Set(ownFields.map(function (field) { return field.name; }));
        var mergedFields = _.concat(ownFields, inheritedFields.filter(function (inheritedField) {
            return !ownFieldNames.has(inheritedField.name);
        }));
        if (mergedFields.length === 0) {
            throw new excpt.InterfaceError(node, "GraphQL does not allow Objects and Interfaces without fields.");
        }
        var collected = {
            documentation: documentation,
            description: this._collectDescription(documentation),
            name: name,
            implements: inherits,
            fields: mergedFields,
        };
        collected.kind = isInput ? types.GQLDefinitionKind.INPUT_OBJECT_DEFINITION
            : types.GQLDefinitionKind.INTERFACE_DEFINITION;
        return this._addTypeDefinition(collected);
    };
    Collector.prototype._collectFieldDefinition = function (field, category) {
        var signature;
        var signatureType;
        var name;
        var args;
        if (typescript.isMethodSignature(field)) {
            signature = field;
            signatureType = signature.type;
            name = signature.name.getText();
            if (category === types.GQLTypeCategory.INPUT) {
                var msg = "GraphQL Input Objects Fields must not have argument lists.";
                throw new Error("At property '" + name + "'\n" + msg);
            }
            args = this._collectArgumentsDefinition(signature.parameters);
        }
        else if (typescript.isPropertySignature(field)) {
            signature = field;
            signatureType = signature.type;
            name = signature.name.getText();
            if (typescript.isFunctionTypeNode(signatureType)) {
                if (category === types.GQLTypeCategory.INPUT) {
                    var msg = "GraphQL Input Objects Fields must not have argument lists.";
                    throw new Error("At property '" + name + "'\n" + msg);
                }
                args = this._collectArgumentsDefinition(signatureType.parameters);
            }
        }
        else {
            throw new excpt.PropertyError(field, "TypeScript " + field.kind + " doesn't have a valid Field Signature.");
        }
        var type;
        try {
            type = this._walkType(typescript.isFunctionTypeNode(signatureType) ? signatureType.type : signatureType);
        }
        catch (e) {
            throw new excpt.PropertyError(field, e.message);
        }
        var unwrappedType = util.isWrappingType(type) ? type.wrapped : type;
        // When circularly referencing:
        if (unwrappedType.kind === types.GQLTypeKind.CIRCULAR_TYPE) {
            var circularlyReferenced = this.resolved.get(unwrappedType.target);
            if (circularlyReferenced && circularlyReferenced.kind === types.GQLDefinitionKind.DEFINITION_ALIAS) {
                // Aliases are not reliable and demand to recollect the current node
                this.unresolvedCircular.set(unwrappedType.target, field.parent);
            }
            if (category === types.GQLTypeCategory.INPUT) {
                // If field of future GraphQL Input, expect TypeScript interface/type to be reference to GraphQL Input
                type = {
                    nullable: type.nullable,
                    target: unwrappedType.target,
                    kind: types.GQLTypeKind.INPUT_OBJECT_TYPE,
                };
            }
            else {
                // If field of future GraphQL Object/Interface, expect TypeScript interface/type to be GraphQL Object
                type = {
                    nullable: type.nullable,
                    target: unwrappedType.target,
                    kind: types.GQLTypeKind.OBJECT_TYPE,
                };
            }
        }
        if (field.kind === SyntaxKind.PropertySignature && field.questionToken) {
            type.nullable = true;
        }
        var documentation = util.documentationForNode(field);
        var directives;
        if (category === types.GQLTypeCategory.OUTPUT) {
            try {
                directives = documentation ? this._collectDirectives(documentation) : [];
            }
            catch (e) {
                throw new excpt.PropertyError(field, e.message);
            }
        }
        if (category === types.GQLTypeCategory.OUTPUT) {
            if (!util.isOutputType(type)) {
                var acceptedOutputs = 'Scalars, Input Objects and Enums';
                var kind = util.isWrappingType(type) ? type.wrapped.kind : type.kind;
                var msg = "Input Object field types accept only GraphQL " + acceptedOutputs + ". Got " + kind + ".";
                throw new excpt.PropertyError(field, msg);
            }
        }
        else if (category === types.GQLTypeCategory.INPUT) {
            if (!util.isInputType(type)) {
                var acceptedOutputs = 'Scalars, Objects, Interfaces, Unions and Enums';
                var kind = util.isWrappingType(type) ? type.wrapped.kind : type.kind;
                var msg = "Object field types accept only GraphQL " + acceptedOutputs + ". Got " + kind + ".";
                throw new excpt.PropertyError(field, msg);
            }
        }
        else {
            throw new excpt.PropertyError(field, "Invalid Field Kind " + type.kind);
        }
        return {
            documentation: documentation,
            description: this._collectDescription(documentation),
            name: name,
            kind: types.GQLDefinitionKind.FIELD_DEFINITION,
            category: category,
            type: type,
            arguments: args,
            directives: directives,
        };
    };
    Collector.prototype._collectArgumentsDefinition = function (params) {
        var inputValues = params.map(this._collectInputValueDefinition);
        if (inputValues.length !== _.uniqBy(inputValues, function (input) { return input.name; }).length) {
            throw new Error("Conflicting parameters in argument list.");
        }
        return inputValues;
    };
    Collector.prototype._collectReferenceForSymbol = function (symbol) {
        var referenced = this._walkSymbolDeclaration(symbol);
        var name = this._nameForSymbol(symbol);
        if (!referenced) {
            throw new Error("Could not find declaration for symbol '" + name + "'.");
        }
        else if (!this.resolved.get(name)) {
            return {
                nullable: false,
                target: name,
                kind: types.GQLTypeKind.CIRCULAR_TYPE,
            };
        }
        var nullable = false;
        // Inherit nullable property from definition if available
        if (util.isNullableDefinition(referenced)) {
            nullable = referenced.nullable;
        }
        var reference = {
            target: name,
            nullable: nullable,
        };
        var unwrappedReferenced = referenced.kind === types.GQLDefinitionKind.DEFINITION_ALIAS ?
            this._unwrapAlias(referenced) : referenced;
        if (!unwrappedReferenced) {
            return __assign({}, reference, { kind: types.GQLTypeKind.CIRCULAR_TYPE, target: referenced.name });
        }
        else if (unwrappedReferenced.kind === types.GQLDefinitionKind.INTERFACE_DEFINITION) {
            var concreteReference = this._concrete(unwrappedReferenced);
            this.resolved.set(name, concreteReference);
            unwrappedReferenced = concreteReference;
        }
        var kind;
        kind = types.DefinitionFromType.get(unwrappedReferenced.kind);
        // Scalar definitions may mean Int or ID TypeScript definition
        if (referenced.kind === types.GQLDefinitionKind.SCALAR_DEFINITION && referenced.builtIn) {
            kind = referenced.builtIn;
        }
        if (!kind) {
            throw new Error("Invalid DefinitionKind " + referenced.name);
        }
        reference.kind = kind;
        return reference;
    };
    Collector.prototype._collectList = function (node) {
        return {
            kind: types.GQLTypeKind.LIST_TYPE,
            nullable: false,
            wrapped: this._walkType(node.elementType),
        };
    };
    Collector.prototype._collectBuiltInScalar = function (kind) {
        switch (kind) {
            case SyntaxKind.StringKeyword:
                return {
                    nullable: false,
                    kind: types.GQLTypeKind.STRING_TYPE,
                };
            case SyntaxKind.BooleanKeyword:
                return {
                    nullable: false,
                    kind: types.GQLTypeKind.BOOLEAN_TYPE,
                };
            case SyntaxKind.NumberKeyword:
                return {
                    nullable: false,
                    kind: types.GQLTypeKind.FLOAT_TYPE,
                };
            default:
                throw new Error("TypeScript '" + kind + "' is not a GraphQL BuiltIn Scalar");
        }
    };
    Collector.prototype._collectDirectives = function (jsDoc) {
        var _this = this;
        var directivesStart = _.findIndex(jsDoc.tags, function (tag) {
            return tag.title === 'graphql' && /^[Dd]irectives$/.test(tag.description);
        });
        if (directivesStart === -1) {
            return [];
        }
        var processedTags = {};
        return _.map(jsDoc.tags.slice(directivesStart + 1), function (tag) {
            if (processedTags[tag.title])
                throw new Error("Multiple declarations of directive " + tag.title + ".");
            processedTags[tag.title] = true;
            return _this._directiveFromDocTag(tag);
        });
    };
    Collector.prototype._collectTypeAliasDeclaration = function (node) {
        var name = node.name.getText();
        var doc = util.documentationForNode(node);
        var definition;
        try {
            if (typescript.isUnionTypeNode(node.type)) {
                definition = this._walkUnion(node.type, name, doc);
            }
            else {
                var aliasType = this._walkType(node.type);
                if (util.isBuiltInScalar(aliasType)) {
                    definition = {
                        documentation: doc,
                        description: this._collectDescription(doc),
                        name: name,
                        nullable: aliasType.nullable,
                        kind: types.GQLDefinitionKind.SCALAR_DEFINITION,
                    };
                    definition.builtIn = this._collectIntOrIDKind(aliasType, doc);
                }
                else if (util.isReferenceType(aliasType)) {
                    if (aliasType.kind === types.GQLTypeKind.CIRCULAR_TYPE) {
                        if (aliasType.target === name) {
                            throw new Error("An alias can not alias itself.");
                        }
                        // Enqueue this alias resolution
                        this.unresolvedCircular.set(aliasType.target, node);
                    }
                    definition = {
                        documentation: doc,
                        description: this._collectDescription(doc),
                        name: name,
                        kind: types.GQLDefinitionKind.DEFINITION_ALIAS,
                        nullable: aliasType.nullable,
                        target: aliasType.target,
                    };
                }
                else {
                    throw new Error("Unsupported alias for GraphQL type " + aliasType.kind);
                }
            }
        }
        catch (e) {
            throw new excpt.TypeAliasError(node, e.message);
        }
        return this._addTypeDefinition(definition);
    };
    Collector.prototype._collectIntOrIDKind = function (type, doc) {
        if (util.extractTagDescription(doc, /^[Ii]nt$/)) {
            if (type.kind !== types.GQLTypeKind.FLOAT_TYPE) {
                throw new Error("GraphQL Int is incompatible with type " + type.kind);
            }
            return types.GQLTypeKind.INT_TYPE;
        }
        else if (util.extractTagDescription(doc, /^(ID)|(Id)|(id)$/)) {
            if (type.kind !== types.GQLTypeKind.STRING_TYPE && type.kind !== types.GQLTypeKind.FLOAT_TYPE) {
                throw new Error("GraphQL ID is incompatible with type " + type.kind);
            }
            return types.GQLTypeKind.ID_TYPE;
        }
        return undefined;
    };
    Collector.prototype._collectUnionDefinition = function (node, name, doc) {
        var _this = this;
        var description = this._collectDescription(doc);
        var unionMembers = this._walkUnionMembersFlat(this._filterNullUndefined(node.types));
        var nullable = unionMembers.length < node.types.length || unionMembers.every(function (member) { return member.nullable; });
        // Only one member: create alias nullable by default
        if (unionMembers.length === 1) {
            var nonNullMember = unionMembers[0];
            if (util.isWrappingType(nonNullMember)) {
                throw new Error("Cannot create alias for GraphQL Wrapping Types.");
            }
            if (util.isBuiltInScalar(nonNullMember)) {
                var intOrID = this._collectIntOrIDKind(nonNullMember, doc);
                if (intOrID) {
                    throw new Error("Can not define " + name + " as " + intOrID + "."
                        + " GraphQL BuiltIn Primitives can not be nullable by default.");
                }
                return {
                    name: name,
                    nullable: nullable,
                    kind: types.GQLDefinitionKind.SCALAR_DEFINITION,
                };
            }
            if (nonNullMember.target === name) {
                throw new Error("An alias can not alias itself");
            }
            return {
                documentation: doc,
                description: description,
                name: name,
                nullable: nullable,
                kind: types.GQLDefinitionKind.DEFINITION_ALIAS,
                target: nonNullMember.target,
            };
        }
        // If all elements are enums, build a merged single enum
        if (unionMembers.every(function (member) { return member.kind === types.GQLTypeKind.ENUM_TYPE; })) {
            var enumReferences = unionMembers;
            var enums = enumReferences.map(function (member) { return _this.resolved.get(member.target); });
            return {
                documentation: doc,
                description: description,
                kind: types.GQLDefinitionKind.ENUM_DEFINITION,
                name: name,
                nullable: nullable,
                fields: _.uniqBy(_.flatten(enums.map(function (enumDef) { return enumDef.fields; })), function (enumField) { return enumField.name; }),
            };
        }
        // GraphQL Union only allow GraphQL Objects as members
        var collectedUnion = unionMembers.map(function (member) {
            if (member.kind === types.GQLTypeKind.CIRCULAR_TYPE) {
                // Circular reference: assume it's an unresolved object type but schedule revisiting
                _this.unresolvedCircular.set(member.target, node.parent);
                return {
                    kind: types.GQLTypeKind.OBJECT_TYPE,
                    nullable: member.nullable,
                    target: member.target,
                };
            }
            if (member.kind !== types.GQLTypeKind.OBJECT_TYPE) {
                throw new Error("GraphQL does not support " + member.kind + " as an union member.");
            }
            return member;
        });
        return {
            documentation: doc,
            description: description,
            kind: types.GQLDefinitionKind.UNION_DEFINITION,
            name: name,
            nullable: nullable,
            members: _.uniqBy(collectedUnion, function (member) { return member.target; }),
        };
    };
    Collector.prototype._collectEnumDeclaration = function (node) {
        var _this = this;
        // If the user provides an initializer, ignore and use the initializer itself.
        // The initializer regards server functioning and should not interfere in protocol description.
        var fields = _.uniqBy(node.members.map(function (member) {
            var fieldDoc = util.documentationForNode(member);
            var fieldDesc = _this._collectDescription(fieldDoc);
            var value = _.trim(member.name.getText(), "'\"");
            return {
                documentation: fieldDoc,
                description: fieldDesc,
                kind: types.GQLDefinitionKind.ENUM_FIELD_DEFINITION,
                name: value,
            };
        }).filter(function (field) { return field.name; }), function (field) { return field.name; });
        if (fields.length === 0) {
            throw new excpt.EnumError(node, "GraphQL Enums must have at least one or more unique enum values.");
        }
        var documentation = util.documentationForNode(node);
        var description = this._collectDescription(documentation);
        return this._addTypeDefinition({
            documentation: documentation,
            description: description,
            name: node.name.getText(),
            nullable: false,
            kind: types.GQLDefinitionKind.ENUM_DEFINITION,
            fields: fields,
        });
    };
    Collector.prototype._collectDescription = function (doc) {
        var tagPattern = /^[Dd]escription\s+((?:.|\s)+)$/;
        var description = util.extractTagDescription(doc, tagPattern);
        if (!description) {
            return undefined;
        }
        var extracted = description.match(tagPattern);
        return extracted ? extracted[1] : '';
    };
    // Utility
    Collector.prototype._addTypeDefinition = function (typeDefinition) {
        var name = typeDefinition.name;
        var defined = this.resolved.get(name);
        if (defined) {
            throw new Error("Conflicting references for symbol " + name + "."
                + ("Defined as " + defined.kind + " and " + typeDefinition.kind + "."));
        }
        this.resolved.set(name, typeDefinition);
        return typeDefinition;
    };
    Collector.prototype._symbolForNode = function (node) {
        var symbol = this.checker.getSymbolAtLocation(node);
        if (!symbol) {
            throw new Error("Could not find declaration for symbol " + node.getText());
        }
        return this._expandSymbol(symbol);
    };
    Collector.prototype._nameForSymbol = function (symbol) {
        symbol = this._expandSymbol(symbol);
        var parts = [];
        while (symbol) {
            parts.unshift(this.checker.symbolToString(symbol));
            symbol = symbol['parent'];
            // Don't include raw module names.
            if (symbol && symbol.flags === typescript.SymbolFlags.ValueModule)
                break;
        }
        return parts.join('.');
    };
    Collector.prototype._expandSymbol = function (symbol) {
        while (symbol.flags & typescript.SymbolFlags.Alias) {
            symbol = this.checker.getAliasedSymbol(symbol);
        }
        return symbol;
    };
    Collector.prototype._concrete = function (node) {
        var concrete = {};
        Object.assign(concrete, node);
        concrete.kind = types.GQLDefinitionKind.OBJECT_DEFINITION;
        return concrete;
    };
    Collector.prototype._directiveFromDocTag = function (jsDocTag) {
        var directiveParams = [];
        if (jsDocTag.description) {
            var parser = new Parser_1.MethodParamsParser();
            try {
                directiveParams = parser.parse(jsDocTag.description);
            }
            catch (e) {
                var parsingMsg = e.message;
                throw new Error("Failed to parse parameter list of \"" + jsDocTag.title + "\" directive.\n" + parsingMsg);
            }
        }
        return {
            kind: types.GQLDefinitionKind.DIRECTIVE,
            name: jsDocTag.title,
            args: directiveParams,
        };
    };
    Collector.prototype._filterNullUndefined = function (nodes) {
        return nodes.filter(function (node) {
            return node.kind !== SyntaxKind.NullKeyword && node.kind !== SyntaxKind.UndefinedKeyword;
        });
    };
    Collector.prototype._unwrapAlias = function (referenced) {
        var aliasedRef = referenced;
        while (aliasedRef.kind === types.GQLDefinitionKind.DEFINITION_ALIAS) {
            var aliasedTarget = this.resolved.get(aliasedRef.target);
            if (!aliasedTarget) {
                return undefined;
            }
            aliasedRef = aliasedTarget;
        }
        return aliasedRef;
    };
    return Collector;
}());
exports.Collector = Collector;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29sbGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL0NvbGxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLDBCQUE0QjtBQUM1Qix1Q0FBeUM7QUFFekMsK0JBQWlDO0FBQ2pDLDZCQUErQjtBQUMvQixvQ0FBc0M7QUFDdEMsbUNBQThDO0FBRTlDLElBQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUM7QUFPekM7OztHQUdHO0FBQ0g7SUFPRSxtQkFBWSxPQUEwQjtRQUF0QyxpQkFFQztRQVJELGFBQVEsR0FBMkIsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUdyQyxlQUFVLEdBQWtELElBQUksR0FBRyxFQUFFLENBQUM7UUFDdEUsdUJBQWtCLEdBQWdGLElBQUksR0FBRyxFQUFFLENBQUM7UUFDNUcsd0JBQW1CLEdBQWUsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQXNIcEQsMkJBQXNCLEdBQUcsVUFBQyxNQUF3QjtZQUNoRCxJQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDOUMsSUFBSSxDQUFDLFlBQVksSUFBSSxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtnQkFDOUMsTUFBTSxJQUFJLEtBQUssQ0FBQyx1REFBcUQsTUFBTSxDQUFDLElBQUksTUFBRyxDQUFDLENBQUM7YUFDdEY7aUJBQU0sSUFBSSxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDbEMsTUFBTSxJQUFJLEtBQUssQ0FBQyx5Q0FBdUMsTUFBTSxDQUFDLElBQUksTUFBRyxDQUFDLENBQUM7YUFDeEU7WUFDRCxPQUFPLEtBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoRCxDQUFDLENBQUE7UUFVRCxjQUFTLEdBQUcsVUFBQyxJQUFvQjtZQUMvQixJQUFJLE1BQU0sQ0FBQztZQUNYLFFBQVEsSUFB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
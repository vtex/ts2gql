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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29sbGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL0NvbGxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLDBCQUE0QjtBQUM1Qix1Q0FBeUM7QUFFekMsK0JBQWlDO0FBQ2pDLDZCQUErQjtBQUMvQixvQ0FBc0M7QUFDdEMsbUNBQThDO0FBRTlDLElBQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUM7QUFPekM7OztHQUdHO0FBQ0g7SUFPRSxtQkFBWSxPQUEwQjtRQUF0QyxpQkFFQztRQVJELGFBQVEsR0FBMkIsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUdyQyxlQUFVLEdBQWtELElBQUksR0FBRyxFQUFFLENBQUM7UUFDdEUsdUJBQWtCLEdBQWdGLElBQUksR0FBRyxFQUFFLENBQUM7UUFDNUcsd0JBQW1CLEdBQWUsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQXFIcEQsMkJBQXNCLEdBQUcsVUFBQyxNQUF3QjtZQUNoRCxJQUFNLFlBQVksR0FBRyxNQUFNLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDOUMsSUFBSSxDQUFDLFlBQVksSUFBSSxZQUFZLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtnQkFDOUMsTUFBTSxJQUFJLEtBQUssQ0FBQyx1REFBcUQsTUFBTSxDQUFDLElBQUksTUFBRyxDQUFDLENBQUM7YUFDdEY7aUJBQU0sSUFBSSxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDbEMsTUFBTSxJQUFJLEtBQUssQ0FBQyx5Q0FBdUMsTUFBTSxDQUFDLElBQUksTUFBRyxDQUFDLENBQUM7YUFDeEU7WUFDRCxPQUFPLEtBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNoRCxDQUFDLENBQUE7UUFVRCxjQUFTLEdBQUcsVUFBQyxJQUFvQjtZQUMvQixJQUFJLE1BQU0sQ0FBQztZQUNYLFFBQVEsSUFB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
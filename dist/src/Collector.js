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
        this.types = new Map();
        this.ts2GqlMap = new Map();
        this.gql2TsMap = new Map();
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
            this.types.set(collectedRoot.name, this._concrete(collectedRoot));
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
        this.types.delete(collectedRoot.name);
    };
    Collector.prototype.mergeOverrides = function (node, name) {
        var _this = this;
        var existing = this.types.get(name);
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
        if (this.ts2GqlMap.has(node)) {
            return this.ts2GqlMap.get(node);
        }
        var typeDefinition = {};
        this.ts2GqlMap.set(node, typeDefinition);
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
            var referenced = _this.types.get(collected.target);
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
            var inheritedDefinition = _this._unwrapAlias(_this.types.get(inheritedName));
            if (!inheritedDefinition) {
                throw new excpt.InterfaceError(node, "Found circular reference in inherited interface '" + inheritedName + "'.");
            }
            else if (!inheritedDefinitionChecker(inheritedDefinition)) {
                var expectedType = isInput ? types.GQLDefinitionKind.INPUT_OBJECT_DEFINITION
                    : types.GQLDefinitionKind.OBJECT_DEFINITION + " or " + types.GQLDefinitionKind.INTERFACE_DEFINITION;
                var msg = "Incompatible inheritance of '" + inheritedDefinition.name + "'."
                    + (" Expected type '" + expectedType + "', got '" + inheritedDefinition.kind + "'.");
                throw new excpt.InterfaceError(node, msg);
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
        var args;
        if (typescript.isMethodSignature(field)) {
            signature = field;
            signatureType = signature.type;
            args = this._collectArgumentsDefinition(signature.parameters);
        }
        else if (typescript.isPropertySignature(field)) {
            signature = field;
            signatureType = signature.type;
            if (typescript.isFunctionTypeNode(signatureType)) {
                args = this._collectArgumentsDefinition(signatureType.parameters);
            }
        }
        else {
            throw new excpt.PropertyError(field, "TypeScript " + field.kind + " doesn't have a valid Field Signature.");
        }
        var name = signature.name.getText();
        if (category === types.GQLTypeCategory.INPUT && args) {
            throw new excpt.PropertyError(field, "GraphQL Input Objects Fields must not have argument lists.");
        }
        var type;
        try {
            type = this._walkType(typescript.isFunctionTypeNode(signatureType) ? signatureType.type : signatureType);
        }
        catch (e) {
            throw new excpt.PropertyError(field, e.message);
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
        else if (!referenced.kind) {
            throw new Error("Found circular reference for symbol '" + name + "'.");
        }
        else if (referenced.kind === types.GQLDefinitionKind.INTERFACE_DEFINITION) {
            var concreteReference = this._concrete(referenced);
            this.ts2GqlMap.set(this.gql2TsMap.get(referenced.name), concreteReference);
            this.types.set(name, concreteReference);
            referenced = concreteReference;
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
        var kind;
        if (referenced.kind === types.GQLDefinitionKind.DEFINITION_ALIAS) {
            referenced = this._unwrapAlias(referenced);
            kind = types.DefinitionFromType.get(referenced.kind);
        }
        else {
            kind = types.DefinitionFromType.get(referenced.kind);
        }
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
            if (node.type.kind === SyntaxKind.UnionType) {
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
                    throw new excpt.TypeAliasError(node, "Unsupported alias for GraphQL type " + aliasType.kind);
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
            var enums = enumReferences.map(function (member) { return _this.types.get(member.target); });
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
        var defined = this.types.get(name);
        if (defined) {
            throw new Error("Conflicting references for symbol " + name + "."
                + ("Defined as " + defined.kind + " and " + typeDefinition.kind + "."));
        }
        this.types.set(name, typeDefinition);
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
            var aliasedTarget = this.types.get(aliasedRef.target);
            if (!aliasedTarget) {
                throw new Error("Broken alias chain. Could not find declaration for aliased symbol " + aliasedRef.target);
            }
            aliasedRef = aliasedTarget;
        }
        return aliasedRef;
    };
    return Collector;
}());
exports.Collector = Collector;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29sbGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL0NvbGxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLDBCQUE0QjtBQUM1Qix1Q0FBeUM7QUFFekMsK0JBQWlDO0FBQ2pDLDZCQUErQjtBQUMvQixvQ0FBc0M7QUFDdEMsbUNBQThDO0FBRTlDLElBQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUM7QUFPekM7OztHQUdHO0FBQ0g7SUFPRSxtQkFBWSxPQUEwQjtRQUF0QyxpQkFFQztRQVJELFVBQUssR0FBMkIsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUdsQyxjQUFTLEdBQWtELElBQUksR0FBRyxFQUFFLENBQUM7UUFDckUsY0FBUyxHQUEwQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBOEdyRSwyQkFBc0IsR0FBRyxVQUFDLE1BQXdCO1lBQ2hELElBQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUM5QyxJQUFJLENBQUMsWUFBWSxJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO2dCQUM5QyxNQUFNLElBQUksS0FBSyxDQUFDLHVEQUFxRCxNQUFNLENBQUMsSUFBSSxNQUFHLENBQUMsQ0FBQzthQUN0RjtpQkFBTSxJQUFJLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUNsQyxNQUFNLElBQUksS0FBSyxDQUFDLHlDQUF1QyxNQUFNLENBQUMsSUFBSSxNQUFHLENBQUMsQ0FBQzthQUN4RTtZQUNELE9BQU8sS0FBSSxDQUFDLGdCQUFnQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2hELENBQUMsQ0FBQTtRQVVELGNBQVMsR0FBRyxVQUFDLElBQW9CO1lBQy9CLElBQUksTUFBcUIsQ0FBQztZQUMxQixRQUFRLElBQUksQ0FBQyxJQUFJLEVBQUU7Z0JBQ2pCLEtBQUssVUFBVSxDQUFD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
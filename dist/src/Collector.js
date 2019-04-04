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
        var unionMembers = this._filterNullUndefined(node.types).map(this._walkType);
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
            members: collectedUnion,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29sbGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL0NvbGxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUNBLDBCQUE0QjtBQUM1Qix1Q0FBeUM7QUFFekMsK0JBQWlDO0FBQ2pDLDZCQUErQjtBQUMvQixvQ0FBc0M7QUFDdEMsbUNBQThDO0FBRTlDLElBQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUM7QUFPekM7OztHQUdHO0FBQ0g7SUFPRSxtQkFBWSxPQUEwQjtRQUF0QyxpQkFFQztRQVJELFVBQUssR0FBMkIsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUdsQyxjQUFTLEdBQWtELElBQUksR0FBRyxFQUFFLENBQUM7UUFDckUsY0FBUyxHQUEwQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBOEdyRSwyQkFBc0IsR0FBRyxVQUFDLE1BQXdCO1lBQ2hELElBQU0sWUFBWSxHQUFHLE1BQU0sQ0FBQyxlQUFlLEVBQUUsQ0FBQztZQUM5QyxJQUFJLENBQUMsWUFBWSxJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO2dCQUM5QyxNQUFNLElBQUksS0FBSyxDQUFDLHVEQUFxRCxNQUFNLENBQUMsSUFBSSxNQUFHLENBQUMsQ0FBQzthQUN0RjtpQkFBTSxJQUFJLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUNsQyxNQUFNLElBQUksS0FBSyxDQUFDLHlDQUF1QyxNQUFNLENBQUMsSUFBSSxNQUFHLENBQUMsQ0FBQzthQUN4RTtZQUNELE9BQU8sS0FBSSxDQUFDLGdCQUFnQixDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBQ2hELENBQUMsQ0FBQTtRQVVELGNBQVMsR0FBRyxVQUFDLElBQW9CO1lBQy9CLElBQUksTUFBcUIsQ0FBQztZQUMxQixRQUFRLElBQUksQ0FBQyxJQUFJLEVBQUU7Z0JBQ2pCLEtBQUssVUFBVSxDQUFDLGlCQUFpQjtvQkFDL0IsSUFBTSxpQkFBaUIsR0FBRyxJQUF3QyxDQUFDO29CQUNuRSxNQUFNLEdBQUcsS0FBSSxDQUFDLFNBQVMsQ0FBQyxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDaEQsTUFBTTtnQkFDUixLQUFLLFVBQVUsQ0FBQyxTQUFTO29CQUN2QixNQUFNLEdBQUcsS0FBSSxDQUFDLFlBQVksQ0FBQyxJQUFnQyxDQUFDLENBQUM7b0JBQzdELE1BQU07Z0JBQ1IsS0FBSyxVQUFVLENBQUMsYUFBYTtvQkFDM0IsTUFBTSxHQUFHLEtBQUksQ0FBQyxzQkFBc0IsQ0FBQyxJQUFvQyxDQUFDLENBQUM7b0JBQzNFLE1BQU07Z0JBQ1IsS0FBSyxVQUFVLENBQUMsU0FBUztvQkFDdkIsTUFBTSxHQUFHLEtBQUksQ0FBQyxVQUFVLENBQUMsSUFBZ0MsQ0FBQyxDQUFDO29CQUMzRCxNQUFNO2dCQUNSLEtBQUssVUFBVSxDQUFDLGFBQWEsQ0FBQztnQkFDOUIsS0FBSyxVQUFVLENBQUMsYUFBYSxDQUFDO2dCQUM5QixLQUFLLFVBQVUsQ0FBQyxjQUFjO29CQUM1QixNQUFNLEdBQUcsS0FBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztvQkFDL0MsTUFBTTtnQkFDUjtvQkFDRSxNQUFNLElBQUksS0FBSyxDQUFDLGlDQUErQixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFHLENBQUMsQ0FBQzthQUM1RTtZQUNELE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUMsQ0FBQTtRQWtMRCxpQ0FBNEIsR0FBRyxVQUFDLEtBQXFDO1lBQ25FLElBQU0sSUFBSSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbEMsSUFBTSxTQUFTLEdBQUcsS0FBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsSUFBSyxDQUFDLENBQUM7WUFDOUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLEVBQUU7Z0JBQ2hDLElBQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDO2dCQUN0RixJQUFNLEdBQUcsR0FBRyxtRkFBaUYsSUFBSSxNQUFHLENBQUM7Z0JBQ3JHLE1BQU0sSUFBSSxLQUFLLENBQUMsZUFBZSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQzthQUM3QztZQUNELElBQUksS0FBSyxDQUFDLGFBQWEsRUFBRTtnQkFDdkIsU0FBUyxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUM7YUFDN0I7WUFDQyxPQUFPO2dCQUNMLElBQUksTUFBQTtnQkFDSixJQUFJLEVBQUUsS0FBSyxDQUFDLGlCQUFpQixDQUFDLHNCQUFzQjtnQkFDcEQsS0FBSyxFQUFFLFNBQVM7YUFDakIsQ0FBQztRQUNKLENBQUMsQ0FBQTtRQXdKRCw0QkFBdUIsR0FBRyxVQUFDLElBQTZCO1lBQ3RELElBQU0sWUFBWSxHQUFHLEtBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUMvRSxJQUFJLFlBQVksQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO2dCQUMzQixNQUFNLElBQUksS0FBSyxDQUFDLHlCQUF5QixDQUFDLENBQUM7YUFDNUM7aUJBQU0sSUFBSSxZQUFZLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtnQkFDbEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxxRUFBcUU7c0JBQ25GLGdGQUFnRixDQUFDLENBQUM7YUFDckY7WUFFRCxJQUFNLE1BQU0sR0FBRyxZQUFZLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDL0IsSUFBSSxZQUFZLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFO2dCQUM3QyxNQUFNLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQzthQUN4QjtZQUVELE9BQU8sTUFBTSxDQUFDO1FBQ2hCLENBQUMsQ0FBQTtRQS9mQyxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxjQUFjLEVBQUUsQ0FBQztJQUMxQyxDQUFDO0lBRUQsK0JBQVcsR0FBWCxVQUFZLElBQW9DO1FBQzlDLElBQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNsRCxJQUFJLGFBQWEsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLGlCQUFpQixDQUFDLG9CQUFvQixFQUFFO1lBQ3ZFLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDO1NBQ25FO2FBQU0sSUFBSSxhQUFhLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUIsRUFBRTtZQUMzRSxNQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQ2pDLDhCQUE0QixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSwyQ0FBc0MsYUFBYSxDQUFDLElBQUksTUFBRyxDQUFDLENBQUM7U0FDL0c7UUFFRCxJQUFJLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQUEsS0FBSyxJQUFJLE9BQUEsS0FBSyxDQUFDLElBQUksS0FBSyxPQUFPLElBQUksS0FBSyxDQUFDLElBQUksS0FBSyxVQUFVLEVBQW5ELENBQW1ELENBQUMsRUFBRTtZQUMzRixNQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsMkRBQTJELENBQUMsQ0FBQztTQUNuRztRQUVELG1CQUFtQjtRQUNuQixJQUFNLFVBQVUsR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFBLEtBQUssSUFBSSxPQUFBLEtBQUssQ0FBQyxJQUFJLEtBQUssT0FBTyxFQUF0QixDQUFzQixDQUFDLENBQUM7UUFDOUUsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNmLE1BQU0sSUFBSSxLQUFLLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSx3Q0FBd0MsQ0FBQyxDQUFDO1NBQ2hGO2FBQU0sSUFBSSxVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRTtZQUNqRSxNQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsaURBQWlELENBQUMsQ0FBQztTQUN6RjtRQUVELElBQUksQ0FBQyxJQUFJLEdBQUc7WUFDVixLQUFLLEVBQUUsVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNO1NBQzlCLENBQUM7UUFFRixJQUFNLGFBQWEsR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFBLEtBQUssSUFBSSxPQUFBLEtBQUssQ0FBQyxJQUFJLEtBQUssVUFBVSxFQUF6QixDQUF5QixDQUFDLENBQUM7UUFDcEYsSUFBSSxhQUFhLEVBQUU7WUFDakIsSUFBSSxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksS0FBSyxLQUFLLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRTtnQkFDN0QsTUFBTSxJQUFJLEtBQUssQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLG9EQUFvRCxDQUFDLENBQUM7YUFDNUY7WUFDRCxJQUFJLENBQUMsSUFBSSxnQkFDSixJQUFJLENBQUMsSUFBSSxJQUNaLFFBQVEsRUFBRSxhQUFhLENBQUMsSUFBSSxDQUFDLE1BQU0sR0FDcEMsQ0FBQztTQUNIO1FBRUQsb0NBQW9DO1FBQ3BDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN4QyxDQUFDO0lBRUQsa0NBQWMsR0FBZCxVQUFlLElBQW9DLEVBQUUsSUFBcUI7UUFBMUUsaUJBY0M7UUFiQyxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0QyxJQUFJLENBQUMsUUFBUSxFQUFFO1lBQ2IsTUFBTSxJQUFJLEtBQUssQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLHNCQUFvQixJQUFJLDhCQUEyQixDQUFDLENBQUM7U0FDM0Y7YUFBTSxJQUFJLFFBQVEsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLGlCQUFpQixDQUFDLGlCQUFpQjtlQUNqRSxRQUFRLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxvQkFBb0IsRUFBRTtZQUNqRSxNQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsc0JBQW9CLElBQUksOENBQTJDLENBQUMsQ0FBQztTQUM3RztRQUNELElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLFVBQUEsTUFBTSxJQUFJLE9BQUEsS0FBSSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsZUFBZSxDQUFDLE1BQU0sQ0FBQyxFQUFsRSxDQUFrRSxDQUFDLENBQUM7UUFDakgsSUFBTSxlQUFlLEdBQUcsSUFBSSxHQUFHLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFBLElBQUksSUFBSSxPQUFBLElBQUksQ0FBQyxJQUFJLEVBQVQsQ0FBUyxDQUFDLENBQUMsQ0FBQztRQUNsRSxRQUFRLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxRQUFRLENBQUMsTUFBYSxDQUFDO2FBQ3hDLE1BQU0sQ0FBQyxVQUFDLENBQUssSUFBSyxPQUFBLENBQUMsZUFBZSxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLEVBQTVCLENBQTRCLENBQUM7YUFDL0MsTUFBTSxDQUFDLFNBQVMsQ0FBQzthQUNqQixLQUFLLEVBQUUsQ0FBQztJQUNiLENBQUM7SUFFRCxFQUFFO0lBQ0YsMEJBQTBCO0lBQzFCLEVBQUU7SUFFRixvQ0FBZ0IsR0FBaEIsVUFBaUIsSUFBb0I7UUFDbkMsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsRUFBRTtZQUM1QixPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBRSxDQUFDO1NBQ2xDO1FBQ0QsSUFBTSxjQUFjLEdBQUcsRUFBOEIsQ0FBQztRQUN0RCxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsY0FBYyxDQUFDLENBQUM7UUFDekMsSUFBSSxNQUFNLEdBQUcsSUFBdUMsQ0FBQztRQUVyRCxRQUFRLElBQUksQ0FBQyxJQUFJLEVBQUU7WUFDakIsS0FBSyxVQUFVLENBQUMsb0JBQW9CO2dCQUNsQyxNQUFNLEdBQUcsSUFBSSxDQUFDLDRCQUE0QixDQUFDLElBQXVDLENBQUMsQ0FBQztnQkFDcEYsTUFBTTtZQUNSLEtBQUssVUFBVSxDQUFDLG9CQUFvQjtnQkFDbEMsTUFBTSxHQUFHLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxJQUF1QyxDQUFDLENBQUM7Z0JBQ3BGLE1BQU07WUFDUixLQUFLLFVBQVUsQ0FBQyxlQUFlO2dCQUM3QixNQUFNLEdBQUcsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQWtDLENBQUMsQ0FBQztnQkFDMUUsTUFBTTtZQUNSO2dCQUNFLE1BQU0sSUFBSSxLQUFLLENBQUMsa0JBQWtCLENBQUMsSUFBSSxFQUNyQyw4QkFBNEIsSUFBSSxDQUFDLE9BQU8sRUFBRSxZQUFPLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLFVBQU8sQ0FBQyxDQUFDO1NBQ3BGO1FBRUQsTUFBTSxDQUFDLE1BQU0sQ0FBQyxjQUFjLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDdEMsT0FBTyxjQUFjLENBQUM7SUFDeEIsQ0FBQztJQUVELGtDQUFjLEdBQWQsVUFBZSxJQUFvQzs7UUFDakQsSUFBTSxRQUFRLEdBQXlCLEVBQUUsQ0FBQztRQUMxQyxJQUFJLElBQUksQ0FBQyxlQUFlLEVBQUU7O2dCQUN4QixLQUFxQixJQUFBLEtBQUEsU0FBQSxJQUFJLENBQUMsZUFBZSxDQUFBLGdCQUFBLDRCQUFFO29CQUF0QyxJQUFNLE1BQU0sV0FBQTs7d0JBQ2YsS0FBbUIsSUFBQSxLQUFBLFNBQUEsTUFBTSxDQUFDLEtBQUssQ0FBQSxnQkFBQSw0QkFBRTs0QkFBNUIsSUFBTSxJQUFJLFdBQUE7NEJBQ2IsSUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7NEJBQ3BELElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLENBQUMsQ0FBQzs0QkFDcEMsUUFBUSxDQUFDLElBQUksQ0FBQztnQ0FDWixRQUFRLEVBQUUsS0FBSztnQ0FDZixNQUFNLEVBQUUsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUM7NkJBQ3BDLENBQUMsQ0FBQzt5QkFDSjs7Ozs7Ozs7O2lCQUNGOzs7Ozs7Ozs7U0FDRjtRQUNELE9BQU8sUUFBUSxDQUFDO0lBQ2xCLENBQUM7SUFZRCwwQ0FBc0IsR0FBdEIsVUFBdUIsSUFBaUM7UUFFdEQsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFLEVBQUU7WUFDNUIsTUFBTSxJQUFJLEtBQUssQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1NBQzVDO1FBQ0QsT0FBTyxJQUFJLENBQUMsMEJBQTBCLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQztJQUM3RSxDQUFDO0lBaUNELDhCQUFVLEdBQVYsVUFBVyxJQUE2QixFQUFFLElBQXNCLEVBQ2hFLEdBQXlCO1FBRXZCLE9BQU8sSUFBSSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsdUJBQXVCLENBQUMsSUFBSSxFQUFFLElBQUksRUFBRSxHQUFHLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxDQUFDO0lBQ25HLENBQUM7SUFFRCxFQUFFO0lBQ0YsMEJBQTBCO0lBQzFCLEVBQUU7SUFFRixnREFBNEIsR0FBNUIsVUFBNkIsSUFBb0M7UUFBakUsaUJBMEVDO1FBeEVDLElBQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxJQUFNLElBQUksR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7UUFDakUsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUUzQyxJQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsYUFBYSxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEVBQUUsVUFBQyxHQUFnQjtZQUMvRSxPQUFPLEdBQUcsQ0FBQyxLQUFLLEtBQUssU0FBUyxJQUFJLFlBQVksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLFdBQVcsQ0FBQyxDQUFDO1FBQ3ZFLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBTSwwQkFBMEIsR0FBRyxPQUFPLENBQUMsQ0FBQztZQUM1QyxVQUFDLFVBQW1DO2dCQUNsQyxPQUFPLFVBQVUsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLGlCQUFpQixDQUFDLHVCQUF1QixDQUFDO1lBQzdFLENBQUM7WUFDRCxDQUFDLENBQUMsVUFBQyxVQUFtQztnQkFFcEMsT0FBTyxVQUFVLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUI7dUJBQ2pFLFVBQVUsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLGlCQUFpQixDQUFDLG9CQUFvQixDQUFDO1lBQ3RFLENBQUMsQ0FBQztRQUVGLElBQUksU0FBUyxDQUFDO1FBQ2QsSUFBSTtZQUNGLFNBQVMsR0FBRyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBQyxVQUFBLE1BQU07Z0JBQ2pDLElBQUksT0FBTyxFQUFFO29CQUNYLE9BQU8sS0FBSSxDQUFDLHVCQUF1QixDQUFDLE1BQU0sRUFBRSxLQUFLLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO2lCQUMxRTtnQkFDRCxPQUFPLEtBQUksQ0FBQyx1QkFBdUIsQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUM1RSxDQUFDLENBQUMsQ0FBQztTQUNKO1FBQUMsT0FBTyxDQUFDLEVBQUU7WUFDVixNQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQ2pEO1FBRUQsSUFBSSxTQUFTLENBQUMsTUFBTSxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLFVBQUEsS0FBSyxJQUFJLE9BQUEsS0FBSyxDQUFDLElBQUksRUFBVixDQUFVLENBQUMsQ0FBQyxNQUFNLEVBQUU7WUFDeEUsTUFBTSxJQUFJLEtBQUssQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLDBCQUEwQixDQUFDLENBQUM7U0FDbEU7UUFFRCxJQUFNLGVBQWUsR0FBRyxDQUFDLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsVUFBQyxTQUE2QjtZQUMzRSxJQUFNLGFBQWEsR0FBRyxTQUFTLENBQUMsTUFBTSxDQUFDO1lBQ3ZDLElBQU0sbUJBQW1CLEdBQUcsS0FBSSxDQUFDLFlBQVksQ0FBQyxLQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUUsQ0FBQyxDQUFDO1lBQzlFLElBQUksQ0FBQyxtQkFBbUIsRUFBRTtnQkFDeEIsTUFBTSxJQUFJLEtBQUssQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLHNEQUFvRCxhQUFhLE9BQUksQ0FBQyxDQUFDO2FBQzdHO2lCQUFNLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxtQkFBbUIsQ0FBQyxFQUFFO2dCQUN6RCxJQUFNLFlBQVksR0FBRyxPQUFPLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyx1QkFBdUI7b0JBQzlFLENBQUMsQ0FBSSxLQUFLLENBQUMsaUJBQWlCLENBQUMsaUJBQWlCLFlBQU8sS0FBSyxDQUFDLGlCQUFpQixDQUFDLG9CQUFzQixDQUFDO2dCQUNwRyxJQUFNLEdBQUcsR0FBRyxrQ0FBZ0MsbUJBQW1CLENBQUMsSUFBSSxPQUFJO3VCQUN0RSxxQkFBbUIsWUFBWSxnQkFBVyxtQkFBbUIsQ0FBQyxJQUFJLE9BQUksQ0FBQSxDQUFDO2dCQUN6RSxNQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7YUFDN0M7WUFDRCxPQUFPLG1CQUFtQixDQUFDLE1BQXFDLENBQUM7UUFDbkUsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUNKLElBQU0sa0JBQWtCLEdBQUcsZUFBZSxDQUFDLEdBQUcsQ0FBQyxVQUFBLEtBQUssSUFBSSxPQUFBLEtBQUssQ0FBQyxJQUFJLEVBQVYsQ0FBVSxDQUFDLENBQUM7UUFDcEUsSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDLENBQUMsTUFBTSxLQUFLLGtCQUFrQixDQUFDLE1BQU0sRUFBRTtZQUNuRSxNQUFNLElBQUksS0FBSyxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsMkVBQTJFLENBQUMsQ0FBQztTQUNuSDtRQUVELElBQU0sYUFBYSxHQUFHLElBQUksR0FBRyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsVUFBQSxLQUFLLElBQUksT0FBQSxLQUFLLENBQUMsSUFBSSxFQUFWLENBQVUsQ0FBQyxDQUFDLENBQUM7UUFDbEUsSUFBTSxZQUFZLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsZUFBZSxDQUFDLE1BQU0sQ0FBQyxVQUFDLGNBQWM7WUFDN0UsT0FBTyxDQUFDLGFBQWEsQ0FBQyxHQUFHLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ2pELENBQUMsQ0FBQyxDQUFDLENBQUM7UUFFSixJQUFJLFlBQVksQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQzdCLE1BQU0sSUFBSSxLQUFLLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSwrREFBK0QsQ0FBQyxDQUFDO1NBQ3ZHO1FBRUQsSUFBTSxTQUFTLEdBQUc7WUFDaEIsYUFBYSxlQUFBO1lBQ2IsV0FBVyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxhQUFhLENBQUM7WUFDcEQsSUFBSSxNQUFBO1lBQ0osVUFBVSxFQUFFLFFBQVE7WUFDcEIsTUFBTSxFQUFFLFlBQVk7U0FDa0QsQ0FBQztRQUN6RSxTQUFTLENBQUMsSUFBSSxHQUFHLE9BQU8sQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLHVCQUF1QjtZQUMxRSxDQUFDLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLG9CQUFvQixDQUFDO1FBQy9DLE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQzVDLENBQUM7SUFNRCwyQ0FBdUIsR0FBdkIsVUFBd0IsS0FBNEIsRUFBRSxRQUE4QjtRQUNsRixJQUFJLFNBQVMsQ0FBQztRQUNkLElBQUksYUFBYSxDQUFDO1FBQ2xCLElBQUksSUFBSSxDQUFDO1FBQ1QsSUFBSSxVQUFVLENBQUMsaUJBQWlCLENBQUMsS0FBSyxDQUFDLEVBQUU7WUFDdkMsU0FBUyxHQUFHLEtBQUssQ0FBQztZQUNsQixhQUFhLEdBQUcsU0FBUyxDQUFDLElBQUssQ0FBQztZQUNoQyxJQUFJLEdBQUcsSUFBSSxDQUFDLDJCQUEyQixDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztTQUMvRDthQUFNLElBQUksVUFBVSxDQUFDLG1CQUFtQixDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQ2hELFNBQVMsR0FBRyxLQUFLLENBQUM7WUFDbEIsYUFBYSxHQUFHLFNBQVMsQ0FBQyxJQUFLLENBQUM7WUFDaEMsSUFBSSxVQUFVLENBQUMsa0JBQWtCLENBQUMsYUFBYSxDQUFDLEVBQUU7Z0JBQ2hELElBQUksR0FBRyxJQUFJLENBQUMsMkJBQTJCLENBQUMsYUFBYSxDQUFDLFVBQVUsQ0FBQyxDQUFDO2FBQ25FO1NBQ0Y7YUFBTTtZQUNMLE1BQU0sSUFBSSxLQUFLLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxnQkFBYyxLQUFLLENBQUMsSUFBSSwyQ0FBd0MsQ0FBQyxDQUFDO1NBQ3hHO1FBQ0QsSUFBTSxJQUFJLEdBQUcsU0FBUyxDQUFDLElBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN2QyxJQUFJLFFBQVEsS0FBSyxLQUFLLENBQUMsZUFBZSxDQUFDLEtBQUssSUFBSSxJQUFJLEVBQUU7WUFDcEQsTUFBTSxJQUFJLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLDREQUE0RCxDQUFDLENBQUM7U0FDcEc7UUFFRCxJQUFJLElBQUksQ0FBQztRQUNULElBQUk7WUFDRixJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsa0JBQWtCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxJQUFLLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1NBQzNHO1FBQUMsT0FBTyxDQUFDLEVBQUU7WUFDVixNQUFNLElBQUksS0FBSyxDQUFDLGFBQWEsQ0FBQyxLQUFLLEVBQUUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1NBQ2pEO1FBRUQsSUFBSSxLQUFLLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQyxpQkFBaUIsSUFBSSxLQUFLLENBQUMsYUFBYSxFQUFFO1lBQ3BFLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDO1NBQ3hCO1FBRUQsSUFBTSxhQUFhLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxDQUFDO1FBQ3ZELElBQUksVUFBVSxDQUFDO1FBQ2YsSUFBSSxRQUFRLEtBQUssS0FBSyxDQUFDLGVBQWUsQ0FBQyxNQUFNLEVBQUU7WUFDN0MsSUFBSTtnQkFDRixVQUFVLEdBQUcsYUFBYSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQzthQUMxRTtZQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUNWLE1BQU0sSUFBSSxLQUFLLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUM7YUFDakQ7U0FDRjtRQUVELElBQUksUUFBUSxLQUFLLEtBQUssQ0FBQyxlQUFlLENBQUMsTUFBTSxFQUFFO1lBQzdDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLElBQUksQ0FBQyxFQUFFO2dCQUM1QixJQUFNLGVBQWUsR0FBRyxrQ0FBa0MsQ0FBQztnQkFDM0QsSUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7Z0JBQ3ZFLElBQU0sR0FBRyxHQUFHLGtEQUFnRCxlQUFlLGNBQVMsSUFBSSxNQUFHLENBQUM7Z0JBQzVGLE1BQU0sSUFBSSxLQUFLLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxHQUFHLENBQUMsQ0FBQzthQUMzQztTQUNGO2FBQU0sSUFBSSxRQUFRLEtBQUssS0FBSyxDQUFDLGVBQWUsQ0FBQyxLQUFLLEVBQUU7WUFDbkQsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzNCLElBQU0sZUFBZSxHQUFHLGdEQUFnRCxDQUFDO2dCQUN6RSxJQUFNLElBQUksR0FBRyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztnQkFDdkUsSUFBTSxHQUFHLEdBQUcsNENBQTBDLGVBQWUsY0FBUyxJQUFJLE1BQUcsQ0FBQztnQkFDdEYsTUFBTSxJQUFJLEtBQUssQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2FBQzNDO1NBQ0Y7YUFBTTtZQUNMLE1BQU0sSUFBSSxLQUFLLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSx3QkFBc0IsSUFBSSxDQUFDLElBQU0sQ0FBQyxDQUFDO1NBQ3pFO1FBRUQsT0FBTztZQUNMLGFBQWEsZUFBQTtZQUNiLFdBQVcsRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsYUFBYSxDQUFDO1lBQ3BELElBQUksTUFBQTtZQUNKLElBQUksRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsZ0JBQWdCO1lBQzlDLFFBQVEsVUFBQTtZQUNSLElBQUksTUFBQTtZQUNKLFNBQVMsRUFBRSxJQUFJO1lBQ2YsVUFBVSxZQUFBO1NBQ1gsQ0FBQztJQUNKLENBQUM7SUFFRCwrQ0FBMkIsR0FBM0IsVUFBNEIsTUFBNEQ7UUFFdEYsSUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsNEJBQTRCLENBQUMsQ0FBQztRQUNsRSxJQUFJLFdBQVcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxDQUFDLE1BQU0sQ0FBQyxXQUFXLEVBQUUsVUFBQSxLQUFLLElBQUksT0FBQSxLQUFLLENBQUMsSUFBSSxFQUFWLENBQVUsQ0FBQyxDQUFDLE1BQU0sRUFBRTtZQUM1RSxNQUFNLElBQUksS0FBSyxDQUFDLDBDQUEwQyxDQUFDLENBQUM7U0FDN0Q7UUFDRCxPQUFPLFdBQVcsQ0FBQztJQUNyQixDQUFDO0lBb0JELDhDQUEwQixHQUExQixVQUEyQixNQUF3QjtRQUNqRCxJQUFJLFVBQVUsR0FBRyxJQUFJLENBQUMsc0JBQXNCLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDckQsSUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUV6QyxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQ2YsTUFBTSxJQUFJLEtBQUssQ0FBQyw0Q0FBMEMsSUFBSSxPQUFJLENBQUMsQ0FBQztTQUNyRTthQUFNLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxFQUFFO1lBQzNCLE1BQU0sSUFBSSxLQUFLLENBQUMsMENBQXdDLElBQUksT0FBSSxDQUFDLENBQUM7U0FDbkU7YUFBTSxJQUFJLFVBQVUsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLGlCQUFpQixDQUFDLG9CQUFvQixFQUFFO1lBQzNFLElBQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUNyRCxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFFLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztZQUM1RSxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLEVBQUUsaUJBQWlCLENBQUMsQ0FBQztZQUN4QyxVQUFVLEdBQUcsaUJBQWlCLENBQUM7U0FDaEM7UUFFRCxJQUFJLFFBQVEsR0FBRyxLQUFLLENBQUM7UUFDckIseURBQXlEO1FBQ3pELElBQUksSUFBSSxDQUFDLG9CQUFvQixDQUFDLFVBQVUsQ0FBQyxFQUFFO1lBQ3pDLFFBQVEsR0FBRyxVQUFVLENBQUMsUUFBUSxDQUFDO1NBQ2hDO1FBRUQsSUFBTSxTQUFTLEdBQUk7WUFDakIsTUFBTSxFQUFFLElBQUk7WUFDWixRQUFRLFVBQUE7U0FDeUQsQ0FBQztRQUVwRSxJQUFJLElBQXlHLENBQUM7UUFDOUcsSUFBSSxVQUFVLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0IsRUFBRTtZQUNoRSxVQUFVLEdBQUcsSUFBSSxDQUFDLFlBQVksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUMzQyxJQUFJLEdBQUcsS0FBSyxDQUFDLGtCQUFrQixDQUFDLEdBQUcsQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDdEQ7YUFBTTtZQUNMLElBQUksR0FBRyxLQUFLLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUN0RDtRQUNELDhEQUE4RDtRQUM5RCxJQUFJLFVBQVUsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLGlCQUFpQixDQUFDLGlCQUFpQixJQUFJLFVBQVUsQ0FBQyxPQUFPLEVBQUU7WUFDdkYsSUFBSSxHQUFHLFVBQVUsQ0FBQyxPQUFPLENBQUM7U0FDM0I7UUFFRCxJQUFJLENBQUMsSUFBSSxFQUFFO1lBQ1QsTUFBTSxJQUFJLEtBQUssQ0FBQyw0QkFBMEIsVUFBVSxDQUFDLElBQU0sQ0FBQyxDQUFDO1NBQzlEO1FBRUQsU0FBUyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUM7UUFFdEIsT0FBTyxTQUFTLENBQUM7SUFDbkIsQ0FBQztJQUVELGdDQUFZLEdBQVosVUFBYSxJQUE2QjtRQUN4QyxPQUFPO1lBQ0wsSUFBSSxFQUFFLEtBQUssQ0FBQyxXQUFXLENBQUMsU0FBUztZQUNqQyxRQUFRLEVBQUUsS0FBSztZQUNmLE9BQU8sRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7U0FDMUMsQ0FBQztJQUNKLENBQUM7SUFFRCx5Q0FBcUIsR0FBckIsVUFBc0IsSUFBMEI7UUFDOUMsUUFBUSxJQUFJLEVBQUU7WUFDWixLQUFLLFVBQVUsQ0FBQyxhQUFhO2dCQUMzQixPQUFPO29CQUNMLFFBQVEsRUFBRSxLQUFLO29CQUNmLElBQUksRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLFdBQVc7aUJBQ3BDLENBQUM7WUFDSixLQUFLLFVBQVUsQ0FBQyxjQUFjO2dCQUM1QixPQUFPO29CQUNMLFFBQVEsRUFBRSxLQUFLO29CQUNmLElBQUksRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLFlBQVk7aUJBQ3JDLENBQUM7WUFDSixLQUFLLFVBQVUsQ0FBQyxhQUFhO2dCQUMzQixPQUFPO29CQUNMLFFBQVEsRUFBRSxLQUFLO29CQUNmLElBQUksRUFBRSxLQUFLLENBQUMsV0FBVyxDQUFDLFVBQVU7aUJBQ25DLENBQUM7WUFDSjtnQkFDRSxNQUFNLElBQUksS0FBSyxDQUFDLGlCQUFlLElBQUksc0NBQW1DLENBQUMsQ0FBQztTQUMzRTtJQUNILENBQUM7SUFFRCxzQ0FBa0IsR0FBbEIsVUFBbUIsS0FBMEI7UUFBN0MsaUJBZUM7UUFkQyxJQUFNLGVBQWUsR0FBRyxDQUFDLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsVUFBQyxHQUFHO1lBQ2xELE9BQU8sR0FBRyxDQUFDLEtBQUssS0FBSyxTQUFTLElBQUksaUJBQWlCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxXQUFXLENBQUMsQ0FBQztRQUM1RSxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksZUFBZSxLQUFLLENBQUMsQ0FBQyxFQUFFO1lBQzFCLE9BQU8sRUFBRSxDQUFDO1NBQ1g7UUFDRCxJQUFNLGFBQWEsR0FBRyxFQUFFLENBQUM7UUFDekIsT0FBTyxDQUFDLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGVBQWUsR0FBRyxDQUFDLENBQUMsRUFBRSxVQUFDLEdBQUc7WUFDdEQsSUFBSSxhQUFhLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQztnQkFDMUIsTUFBTSxJQUFJLEtBQUssQ0FBQyx3Q0FBc0MsR0FBRyxDQUFDLEtBQUssTUFBRyxDQUFDLENBQUM7WUFDdEUsYUFBYSxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUM7WUFDaEMsT0FBTyxLQUFJLENBQUMsb0JBQW9CLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDeEMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsZ0RBQTRCLEdBQTVCLFVBQTZCLElBQW9DO1FBRS9ELElBQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7UUFDakMsSUFBTSxHQUFHLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxDQUFDO1FBQzVDLElBQUksVUFDcUIsQ0FBQztRQUMxQixJQUFJO1lBQ0YsSUFBSSxJQUFJLENBQUMsSUFBSyxDQUFDLElBQUksS0FBSyxVQUFVLENBQUMsU0FBUyxFQUFFO2dCQUM1QyxVQUFVLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBaUMsRUFBRSxJQUFJLEVBQUUsR0FBRyxDQUFDLENBQUM7YUFDakY7aUJBQU07Z0JBQ0wsSUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7Z0JBQzVDLElBQUksSUFBSSxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsRUFBRTtvQkFDbkMsVUFBVSxHQUFHO3dCQUNYLGFBQWEsRUFBRSxHQUFHO3dCQUNsQixXQUFXLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQzt3QkFDMUMsSUFBSSxNQUFBO3dCQUNKLFFBQVEsRUFBRSxTQUFTLENBQUMsUUFBUTt3QkFDNUIsSUFBSSxFQUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUI7cUJBQ2hELENBQUM7b0JBQ0YsVUFBVSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO2lCQUMvRDtxQkFBTSxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLEVBQUU7b0JBQzFDLFVBQVUsR0FBRzt3QkFDWCxhQUFhLEVBQUUsR0FBRzt3QkFDbEIsV0FBVyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUM7d0JBQzFDLElBQUksTUFBQTt3QkFDSixJQUFJLEVBQUUsS0FBSyxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQjt3QkFDOUMsUUFBUSxFQUFFLFNBQVMsQ0FBQyxRQUFRO3dCQUM1QixNQUFNLEVBQUUsU0FBUyxDQUFDLE1BQU07cUJBQ3pCLENBQUM7aUJBQ0g7cUJBQU07b0JBQ0wsTUFBTSxJQUFJLEtBQUssQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLHdDQUFzQyxTQUFTLENBQUMsSUFBTSxDQUFDLENBQUM7aUJBQzlGO2FBQ0Y7U0FDRjtRQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsTUFBTSxJQUFJLEtBQUssQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQztTQUNqRDtRQUNELE9BQU8sSUFBSSxDQUFDLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxDQUFDO0lBQzdDLENBQUM7SUFFRCx1Q0FBbUIsR0FBbkIsVUFBb0IsSUFBbUIsRUFBRSxHQUFrQztRQUV6RSxJQUFJLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLEVBQUUsVUFBVSxDQUFDLEVBQUU7WUFDL0MsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxXQUFXLENBQUMsVUFBVSxFQUFFO2dCQUM5QyxNQUFNLElBQUksS0FBSyxDQUFDLDJDQUF5QyxJQUFJLENBQUMsSUFBTSxDQUFDLENBQUM7YUFDdkU7WUFDRCxPQUFPLEtBQUssQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDO1NBQ25DO2FBQU0sSUFBSSxJQUFJLENBQUMscUJBQXFCLENBQUMsR0FBRyxFQUFFLGtCQUFrQixDQUFDLEVBQUU7WUFDOUQsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxXQUFXLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFdBQVcsQ0FBQyxVQUFVLEVBQUU7Z0JBQzdGLE1BQU0sSUFBSSxLQUFLLENBQUMsMENBQXdDLElBQUksQ0FBQyxJQUFNLENBQUMsQ0FBQzthQUN0RTtZQUNELE9BQU8sS0FBSyxDQUFDLFdBQVcsQ0FBQyxPQUFPLENBQUM7U0FDbEM7UUFFRCxPQUFPLFNBQVMsQ0FBQztJQUNuQixDQUFDO0lBbUJELDJDQUF1QixHQUF2QixVQUF3QixJQUE2QixFQUFFLElBQXFCLEVBQzVFLEdBQXlCO1FBRHpCLGlCQWlFQztRQTlEQyxJQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDLENBQUM7UUFDbEQsSUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQy9FLElBQU0sUUFBUSxHQUFHLFlBQVksQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLElBQUksWUFBWSxDQUFDLEtBQUssQ0FBQyxVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxRQUFRLEVBQWYsQ0FBZSxDQUFDLENBQUM7UUFFMUcsb0RBQW9EO1FBQ3BELElBQUksWUFBWSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUc7WUFDOUIsSUFBTSxhQUFhLEdBQUcsWUFBWSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3RDLElBQUksSUFBSSxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsRUFBRTtnQkFDdEMsTUFBTSxJQUFJLEtBQUssQ0FBQyxpREFBaUQsQ0FBQyxDQUFDO2FBQ3BFO1lBQ0QsSUFBSSxJQUFJLENBQUMsZUFBZSxDQUFDLGFBQWEsQ0FBQyxFQUFFO2dCQUN2QyxJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsYUFBYSxFQUFFLEdBQUcsQ0FBQyxDQUFDO2dCQUM3RCxJQUFJLE9BQU8sRUFBRTtvQkFDWCxNQUFNLElBQUksS0FBSyxDQUFDLG9CQUFrQixJQUFJLFlBQU8sT0FBTyxNQUFHOzBCQUNyRCw2REFBNkQsQ0FBQyxDQUFDO2lCQUNsRTtnQkFDRCxPQUFPO29CQUNMLElBQUksTUFBQTtvQkFDSixRQUFRLFVBQUE7b0JBQ1IsSUFBSSxFQUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUI7aUJBQ2hELENBQUM7YUFDSDtZQUNELE9BQU87Z0JBQ0wsYUFBYSxFQUFFLEdBQUc7Z0JBQ2xCLFdBQVcsYUFBQTtnQkFDWCxJQUFJLE1BQUE7Z0JBQ0osUUFBUSxVQUFBO2dCQUNSLElBQUksRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsZ0JBQWdCO2dCQUM5QyxNQUFNLEVBQUUsYUFBYSxDQUFDLE1BQU07YUFDN0IsQ0FBQztTQUNIO1FBRUQsd0RBQXdEO1FBQ3hELElBQUksWUFBWSxDQUFDLEtBQUssQ0FBQyxVQUFBLE1BQU0sSUFBSSxPQUFBLE1BQU0sQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQTNDLENBQTJDLENBQUMsRUFBRTtZQUM3RSxJQUFNLGNBQWMsR0FBRyxZQUFvQyxDQUFDO1lBQzVELElBQU0sS0FBSyxHQUFHLGNBQWMsQ0FBQyxHQUFHLENBQUMsVUFBQSxNQUFNLElBQUksT0FBQSxLQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQTdCLENBQTZCLENBQW1DLENBQUM7WUFDNUcsT0FBTztnQkFDTCxhQUFhLEVBQUUsR0FBRztnQkFDbEIsV0FBVyxhQUFBO2dCQUNYLElBQUksRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsZUFBZTtnQkFDN0MsSUFBSSxNQUFBO2dCQUNKLFFBQVEsVUFBQTtnQkFDUixNQUFNLEVBQUUsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsVUFBQSxPQUFPLElBQUksT0FBQSxPQUFPLENBQUMsTUFBTSxFQUFkLENBQWMsQ0FBQyxDQUFDLEVBQUUsVUFBQSxTQUFTLElBQUksT0FBQSxTQUFTLENBQUMsSUFBSSxFQUFkLENBQWMsQ0FBQzthQUMvRixDQUFDO1NBQ0g7UUFFRCxzREFBc0Q7UUFDdEQsSUFBTSxjQUFjLEdBQUcsWUFBWSxDQUFDLEdBQUcsQ0FBQyxVQUFDLE1BQU07WUFDN0MsSUFBSSxNQUFNLENBQUMsSUFBSSxLQUFLLEtBQUssQ0FBQyxXQUFXLENBQUMsV0FBVyxFQUFFO2dCQUNqRCxNQUFNLElBQUksS0FBSyxDQUFDLDhCQUE0QixNQUFNLENBQUMsSUFBSSx5QkFBc0IsQ0FBQyxDQUFDO2FBQ2hGO1lBQ0QsT0FBTyxNQUFNLENBQUM7UUFDakIsQ0FBQyxDQUFDLENBQUM7UUFFRixPQUFPO1lBQ0wsYUFBYSxFQUFFLEdBQUc7WUFDbEIsV0FBVyxhQUFBO1lBQ1gsSUFBSSxFQUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxnQkFBZ0I7WUFDOUMsSUFBSSxNQUFBO1lBQ0osUUFBUSxVQUFBO1lBQ1IsT0FBTyxFQUFFLGNBQWM7U0FDeEIsQ0FBQztJQUNKLENBQUM7SUFFRCwyQ0FBdUIsR0FBdkIsVUFBd0IsSUFBK0I7UUFBdkQsaUJBMkJDO1FBMUJDLDhFQUE4RTtRQUM5RSwrRkFBK0Y7UUFDL0YsSUFBTSxNQUFNLEdBQUcsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLEdBQUcsQ0FBZ0MsVUFBQyxNQUFNO1lBQzdFLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUNuRCxJQUFNLFNBQVMsR0FBRyxLQUFJLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLENBQUM7WUFDckQsSUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBQ25ELE9BQU87Z0JBQ0wsYUFBYSxFQUFFLFFBQVE7Z0JBQ3ZCLFdBQVcsRUFBRSxTQUFTO2dCQUN0QixJQUFJLEVBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDLHFCQUFxQjtnQkFDbEQsSUFBSSxFQUFFLEtBQUs7YUFDWixDQUFDO1FBQ0osQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLFVBQUEsS0FBSyxJQUFJLE9BQUEsS0FBSyxDQUFDLElBQUksRUFBVixDQUFVLENBQUMsRUFBRSxVQUFBLEtBQUssSUFBSSxPQUFBLEtBQUssQ0FBQyxJQUFJLEVBQVYsQ0FBVSxDQUFDLENBQUM7UUFDckQsSUFBSSxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUN2QixNQUFNLElBQUksS0FBSyxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsa0VBQWtFLENBQUMsQ0FBQztTQUNyRztRQUNELElBQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxJQUFNLFdBQVcsR0FBRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDNUQsT0FBTyxJQUFJLENBQUMsa0JBQWtCLENBQUM7WUFDN0IsYUFBYSxlQUFBO1lBQ2IsV0FBVyxhQUFBO1lBQ1gsSUFBSSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ3pCLFFBQVEsRUFBRSxLQUFLO1lBQ2YsSUFBSSxFQUFFLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxlQUFlO1lBQzdDLE1BQU0sUUFBQTtTQUNQLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCx1Q0FBbUIsR0FBbkIsVUFBb0IsR0FBa0M7UUFDcEQsSUFBTSxVQUFVLEdBQUcsZ0NBQWdDLENBQUM7UUFDcEQsSUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsRUFBRSxVQUFVLENBQUMsQ0FBQztRQUNoRSxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ2hCLE9BQU8sU0FBUyxDQUFDO1NBQ2xCO1FBQ0QsSUFBTSxTQUFTLEdBQUcsV0FBVyxDQUFDLEtBQUssQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUNoRCxPQUFPLFNBQVMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUM7SUFDdkMsQ0FBQztJQUVELFVBQVU7SUFFVixzQ0FBa0IsR0FBbEIsVUFBdUQsY0FBZ0I7UUFDckUsSUFBTSxJQUFJLEdBQUcsY0FBYyxDQUFDLElBQUksQ0FBQztRQUNqQyxJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNyQyxJQUFJLE9BQU8sRUFBRTtZQUNYLE1BQU0sSUFBSSxLQUFLLENBQUMsdUNBQXFDLElBQUksTUFBRzttQkFDMUQsZ0JBQWMsT0FBTyxDQUFDLElBQUksYUFBUSxjQUFjLENBQUMsSUFBSSxNQUFHLENBQUEsQ0FBQyxDQUFDO1NBQzdEO1FBQ0QsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxDQUFDO1FBQ3JDLE9BQU8sY0FBYyxDQUFDO0lBQ3hCLENBQUM7SUFFRCxrQ0FBYyxHQUFkLFVBQWUsSUFBb0I7UUFDakMsSUFBTSxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxtQkFBbUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUN0RCxJQUFJLENBQUMsTUFBTSxFQUFFO1lBQ1gsTUFBTSxJQUFJLEtBQUssQ0FBQywyQ0FBeUMsSUFBSSxDQUFDLE9BQU8sRUFBSSxDQUFDLENBQUM7U0FDNUU7UUFDRCxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELGtDQUFjLEdBQWQsVUFBZSxNQUF3QjtRQUNyQyxNQUFNLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUNwQyxJQUFNLEtBQUssR0FBRyxFQUFFLENBQUM7UUFDakIsT0FBTyxNQUFNLEVBQUU7WUFDYixLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7WUFDbkQsTUFBTSxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztZQUMxQixrQ0FBa0M7WUFDbEMsSUFBSSxNQUFNLElBQUksTUFBTSxDQUFDLEtBQUssS0FBSyxVQUFVLENBQUMsV0FBVyxDQUFDLFdBQVc7Z0JBQUUsTUFBTTtTQUMxRTtRQUVELE9BQU8sS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsQ0FBQztJQUN6QixDQUFDO0lBRUQsaUNBQWEsR0FBYixVQUFjLE1BQXdCO1FBQ3BDLE9BQU8sTUFBTSxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRTtZQUNsRCxNQUFNLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztTQUNoRDtRQUNELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRCw2QkFBUyxHQUFULFVBQVUsSUFBc0M7UUFDOUMsSUFBTSxRQUFRLEdBQUcsRUFBb0MsQ0FBQztRQUN0RCxNQUFNLENBQUMsTUFBTSxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUM5QixRQUFRLENBQUMsSUFBSSxHQUFHLEtBQUssQ0FBQyxpQkFBaUIsQ0FBQyxpQkFBaUIsQ0FBQztRQUMxRCxPQUFPLFFBQVEsQ0FBQztJQUNsQixDQUFDO0lBRUQsd0NBQW9CLEdBQXBCLFVBQXFCLFFBQXFCO1FBQ3hDLElBQUksZUFBZSxHQUFHLEVBQXFDLENBQUM7UUFDNUQsSUFBSSxRQUFRLENBQUMsV0FBVyxFQUFFO1lBQ3hCLElBQU0sTUFBTSxHQUFHLElBQUksMkJBQWtCLEVBQUUsQ0FBQztZQUN4QyxJQUFJO2dCQUNGLGVBQWUsR0FBRyxNQUFNLENBQUMsS0FBSyxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQzthQUN0RDtZQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUNWLElBQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxPQUFPLENBQUM7Z0JBQzdCLE1BQU0sSUFBSSxLQUFLLENBQUMseUNBQXVDLFFBQVEsQ0FBQyxLQUFLLHVCQUFrQixVQUFZLENBQUMsQ0FBQzthQUN0RztTQUNGO1FBQ0QsT0FBTztZQUNMLElBQUksRUFBRSxLQUFLLENBQUMsaUJBQWlCLENBQUMsU0FBUztZQUN2QyxJQUFJLEVBQUUsUUFBUSxDQUFDLEtBQUs7WUFDcEIsSUFBSSxFQUFFLGVBQWU7U0FDdEIsQ0FBQztJQUNKLENBQUM7SUFFRCx3Q0FBb0IsR0FBcEIsVUFBcUIsS0FBMkM7UUFDOUQsT0FBTyxLQUFLLENBQUMsTUFBTSxDQUFDLFVBQUMsSUFBSTtZQUN2QixPQUFPLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQztRQUMzRixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxnQ0FBWSxHQUFaLFVBQWEsVUFBbUM7UUFDOUMsSUFBSSxVQUFVLEdBQXNELFVBQVUsQ0FBQztRQUM3RSxPQUFPLFVBQVUsQ0FBQyxJQUFJLEtBQUssS0FBSyxDQUFDLGlCQUFpQixDQUFDLGdCQUFnQixFQUFFO1lBQ25FLElBQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUN4RCxJQUFJLENBQUMsYUFBYSxFQUFFO2dCQUNsQixNQUFNLElBQUksS0FBSyxDQUFDLHVFQUFxRSxVQUFVLENBQUMsTUFBUSxDQUFDLENBQUM7YUFDM0c7WUFDRCxVQUFVLEdBQUcsYUFBYSxDQUFDO1NBQzVCO1FBQ0QsT0FBTyxVQUFVLENBQUM7SUFDdEIsQ0FBQztJQUNILGdCQUFDO0FBQUQsQ0FBQyxBQXRzQkQsSUFzc0JDO0FBdHNCWSw4QkFBUyJ9
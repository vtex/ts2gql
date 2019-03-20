"use strict";
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
var Parser_1 = require("./Parser");
var SyntaxKind = typescript.SyntaxKind;
var TypeFlags = typescript.TypeFlags;
/**
 * Walks declarations from a TypeScript programs, and builds up a map of
 * referenced types.
 */
var Collector = /** @class */ (function () {
    function Collector(program) {
        var _this = this;
        this.types = {};
        this.nodeMap = new Map();
        // Node Walking
        this._walkNode = function (node) {
            // Reentrant node walking.
            if (_this.nodeMap.has(node)) {
                return _this.nodeMap.get(node);
            }
            var nodeReference = {};
            _this.nodeMap.set(node, nodeReference);
            var doc = util.documentationForNode(node);
            var result = null;
            if (node.kind === SyntaxKind.InterfaceDeclaration) {
                result = _this._walkInterfaceDeclaration(node);
            }
            else if (node.kind === SyntaxKind.MethodSignature) {
                result = _this._walkMethodSignature(node, doc);
            }
            else if (node.kind === SyntaxKind.PropertySignature) {
                result = _this._walkPropertySignature(node, doc);
            }
            else if (node.kind === SyntaxKind.TypeReference) {
                result = _this._walkTypeReferenceNode(node);
            }
            else if (node.kind === SyntaxKind.TypeAliasDeclaration) {
                result = _this._walkTypeAliasDeclaration(node);
            }
            else if (node.kind === SyntaxKind.EnumDeclaration) {
                result = _this._walkEnumDeclaration(node);
            }
            else if (node.kind === SyntaxKind.TypeLiteral) {
                result = _this._walkTypeLiteralNode(node);
            }
            else if (node.kind === SyntaxKind.ParenthesizedType) {
                var parenthesizedNode = node;
                result = _this._walkNode(parenthesizedNode.type);
            }
            else if (node.kind === SyntaxKind.ArrayType) {
                result = _this._walkArrayTypeNode(node);
            }
            else if (node.kind === SyntaxKind.UnionType) {
                result = _this._walkUnionTypeNode(node);
            }
            else if (node.kind === SyntaxKind.LiteralType) {
                result = {
                    type: types.NodeType.STRING_LITERAL,
                    value: _.trim(node.literal.getText(), "'\""),
                };
            }
            else if (node.kind === SyntaxKind.StringKeyword) {
                result = { type: types.NodeType.NOT_NULL, node: { type: types.NodeType.STRING } };
            }
            else if (node.kind === SyntaxKind.NumberKeyword) {
                result = { type: types.NodeType.NOT_NULL, node: { type: types.NodeType.NUMBER } };
            }
            else if (node.kind === SyntaxKind.BooleanKeyword) {
                result = { type: types.NodeType.NOT_NULL, node: { type: types.NodeType.BOOLEAN } };
            }
            else if (node.kind === SyntaxKind.AnyKeyword) {
                result = { type: types.NodeType.ANY };
            }
            else if (node.kind === SyntaxKind.NullKeyword) {
                result = { type: types.NodeType.NULL };
            }
            else if (node.kind === SyntaxKind.UndefinedKeyword) {
                result = { type: types.NodeType.UNDEFINED };
            }
            else if (node.kind === SyntaxKind.ModuleDeclaration) {
                // Nada.
            }
            else if (node.kind === SyntaxKind.VariableDeclaration) {
                // Nada.
            }
            else {
                console.error(node);
                console.error(node.getSourceFile().fileName);
                throw new Error("Don't know how to handle " + SyntaxKind[node.kind] + " nodes");
            }
            if (result) {
                Object.assign(nodeReference, result);
            }
            return nodeReference;
        };
        this._walkSymbol = function (symbol) {
            return _.map(symbol.getDeclarations(), function (d) { return _this._walkNode(d); });
        };
        // Type Walking
        this._walkType = function (type) {
            if (type.flags & TypeFlags.Object) {
                return _this._walkTypeReference(type);
            }
            else if (type.flags & TypeFlags.BooleanLike) {
                return _this._walkInterfaceType(type);
            }
            else if (type.flags & TypeFlags.Index) {
                return _this._walkNode(type.getSymbol().declarations[0]);
            }
            else if (type.flags & TypeFlags.String) {
                return { type: types.NodeType.STRING };
            }
            else if (type.flags & TypeFlags.Number) {
                return { type: types.NodeType.NUMBER };
            }
            else if (type.flags & TypeFlags.Boolean) {
                return { type: types.NodeType.BOOLEAN };
            }
            else {
                console.error(type);
                console.error(type.getSymbol().declarations[0].getSourceFile().fileName);
                throw new Error("Don't know how to handle type with flags: " + type.flags);
            }
        };
        this.checker = program.getTypeChecker();
    }
    Collector.prototype.addRootNode = function (node) {
        this._walkNode(node);
        var simpleNode = this.types[this._nameForSymbol(this._symbolForNode(node.name))];
        simpleNode.concrete = true;
    };
    Collector.prototype.mergeOverrides = function (node, name) {
        var existing = this.types[name];
        if (!existing) {
            throw new Error("Cannot override '" + name + "' - it was never included");
        }
        var overrides = node.members.map(this._walkNode);
        var overriddenNames = new Set(overrides.map(function (o) { return o.name; }));
        existing.members = _(existing.members)
            .filter(function (m) { return !overriddenNames.has(m.name); })
            .concat(overrides)
            .value();
    };
    Collector.prototype._walkInterfaceDeclaration = function (node) {
        var _this = this;
        // TODO: How can we determine for sure that this is the global date?
        if (node.name.text === 'Date') {
            return { type: types.NodeType.REFERENCE, target: 'Date' };
        }
        return this._addType(node, function () {
            var e_1, _a, e_2, _b;
            var inherits = [];
            if (node.heritageClauses) {
                try {
                    for (var _c = __values(node.heritageClauses), _d = _c.next(); !_d.done; _d = _c.next()) {
                        var clause = _d.value;
                        try {
                            for (var _e = __values(clause.types), _f = _e.next(); !_f.done; _f = _e.next()) {
                                var type = _f.value;
                                var symbol = _this._symbolForNode(type.expression);
                                _this._walkSymbol(symbol);
                                inherits.push(_this._nameForSymbol(symbol));
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
            return {
                type: types.NodeType.INTERFACE,
                members: node.members.map(_this._walkNode),
                inherits: inherits,
            };
        });
    };
    Collector.prototype._walkMethodSignature = function (node, doc) {
        try {
            var parameters = this._walkMethodParams(node.parameters);
            var collectedReturn = this._walkNode(node.type);
            var directiveList = doc ? this._retrieveDirectives(doc) : [];
            return {
                type: types.NodeType.METHOD,
                name: node.name.getText(),
                parameters: parameters,
                returns: this._isNullable(collectedReturn) ? collectedReturn : util.wrapNotNull(collectedReturn),
                directives: directiveList,
            };
        }
        catch (e) {
            e.message = "At function '" + node.name.getText() + "':\n" + e.message;
            throw e;
        }
    };
    Collector.prototype._retrieveDirectives = function (jsDoc) {
        var _this = this;
        var directivesStart = _.findIndex(jsDoc.tags, function (tag) {
            return tag.title === 'graphql' && tag.description === 'Directives';
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
    Collector.prototype._walkMethodParams = function (paramNodes) {
        var e_3, _a;
        var argNodes = {};
        try {
            for (var paramNodes_1 = __values(paramNodes), paramNodes_1_1 = paramNodes_1.next(); !paramNodes_1_1.done; paramNodes_1_1 = paramNodes_1.next()) {
                var paramNode = paramNodes_1_1.value;
                var collectedNode = this._walkNode(paramNode.type);
                argNodes[paramNode.name.getText()] = (paramNode.questionToken || this._isNullable(collectedNode)) ?
                    util.unwrapNotNull(collectedNode) : util.wrapNotNull(collectedNode);
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (paramNodes_1_1 && !paramNodes_1_1.done && (_a = paramNodes_1.return)) _a.call(paramNodes_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return {
            type: types.NodeType.METHOD_PARAMS,
            args: argNodes,
        };
    };
    Collector.prototype._walkPropertySignature = function (node, doc) {
        var nodeType = node.type;
        if (typescript.isFunctionTypeNode(nodeType)) {
            return this._walkMethodSignature(typescript.createMethodSignature(nodeType.typeParameters, nodeType.parameters, nodeType.type, node.name, node.questionToken), doc);
        }
        var signature = this._walkNode(nodeType);
        return {
            type: types.NodeType.PROPERTY,
            name: node.name.getText(),
            signature: (node.questionToken || this._isNullable(signature)) ?
                util.unwrapNotNull(signature) : util.wrapNotNull(signature),
        };
    };
    Collector.prototype._walkTypeReferenceNode = function (node) {
        return this._referenceForSymbol(this._symbolForNode(node.typeName));
    };
    Collector.prototype._walkTypeAliasDeclaration = function (node) {
        var _this = this;
        return this._addType(node, function () { return ({
            type: types.NodeType.ALIAS,
            target: _this._walkNode(node.type),
        }); });
    };
    Collector.prototype._walkEnumDeclaration = function (node) {
        return this._addType(node, function () {
            var values = node.members.map(function (m) {
                // If the user provides an initializer, use the value of the initializer
                // as the GQL enum value _unless_ the initializer is a numeric literal.
                if (m.initializer && m.initializer.kind !== SyntaxKind.NumericLiteral) {
                    /**
                     *  Enums with initializers can look like:
                     *
                     *    export enum Type {
                     *      CREATED  = <any>'CREATED',
                     *      ACCEPTED = <any>'ACCEPTED',
                     *    }
                     *
                     *    export enum Type {
                     *      CREATED  = 'CREATED',
                     *      ACCEPTED = 'ACCEPTED',
                     *    }
                     *
                     *    export enum Type {
                     *      CREATED  = "CREATED",
                     *      ACCEPTED = "ACCEPTED",
                     *    }
                     */
                    var target = _.last(m.initializer.getChildren()) || m.initializer;
                    return _.trim(target.getText(), "'\"");
                }
                else {
                    /**
                     *  For Enums without initializers (or with numeric literal initializers), emit the
                     *  EnumMember name as the value. Example:
                     *    export enum Type {
                     *      CREATED,
                     *      ACCEPTED,
                     *    }
                     */
                    return _.trim(m.name.getText(), "'\"");
                }
            });
            return {
                type: types.NodeType.ENUM,
                values: values,
            };
        });
    };
    Collector.prototype._walkTypeLiteralNode = function (node) {
        return {
            type: types.NodeType.LITERAL_OBJECT,
            members: node.members.map(this._walkNode),
        };
    };
    Collector.prototype._walkArrayTypeNode = function (node) {
        return {
            type: types.NodeType.NOT_NULL,
            node: {
                type: types.NodeType.ARRAY,
                elements: [this._walkNode(node.elementType)],
            },
        };
    };
    Collector.prototype._walkUnionTypeNode = function (node) {
        var _this = this;
        var unionMembers = node.types.map(this._walkNode);
        var withoutNull = unionMembers.filter(function (member) {
            return member.type !== types.NodeType.NULL && member.type !== types.NodeType.UNDEFINED;
        });
        var nullable = withoutNull.length !== unionMembers.length;
        // GraphQL does not allow unions with GraphQL Scalars, Unions or Scalars
        // Interpret TypeScript Union of one only primitive as a scalar
        withoutNull.map(function (member) {
            var memberNode = util.unwrapNotNull(member);
            if (memberNode.type === types.NodeType.REFERENCE) {
                var referenced = _this.types[memberNode.target];
                if (referenced.type === types.NodeType.ALIAS && util.isPrimitive(referenced.target) && withoutNull.length > 1) {
                    throw new Error("GraphQL does not support Scalar as an union member.");
                }
                if (referenced.type === types.NodeType.UNION) {
                    throw new Error("GraphQL does not support UnionType as an union member.");
                }
                if (referenced.type === types.NodeType.INTERFACE && !referenced.concrete) {
                    throw new Error("GraphQL does not support InterfaceType as an union member.");
                }
            }
            else if (util.isPrimitive(member) && withoutNull.length > 1) {
                throw new Error("GraphQL does not support Scalar as an union member.");
            }
        });
        var collectedUnion = {
            type: types.NodeType.UNION,
            types: withoutNull,
        };
        if (nullable) {
            // If the union is nullable, remove the non-null property of all members
            collectedUnion.types = collectedUnion.types.map(util.unwrapNotNull);
            return collectedUnion;
        }
        return {
            type: types.NodeType.NOT_NULL,
            node: collectedUnion,
        };
    };
    Collector.prototype._walkTypeReference = function (type) {
        if (type.target && type.target.getSymbol().name === 'Array') {
            return {
                type: types.NodeType.ARRAY,
                elements: type.typeArguments.map(this._walkType),
            };
        }
        else {
            throw new Error('Non-array type references not yet implemented');
        }
    };
    Collector.prototype._walkInterfaceType = function (type) {
        return this._referenceForSymbol(this._expandSymbol(type.getSymbol()));
    };
    // Utility
    Collector.prototype._addType = function (node, typeBuilder) {
        var name = this._nameForSymbol(this._symbolForNode(node.name));
        if (this.types[name])
            return this.types[name];
        var type = typeBuilder();
        type.documentation = util.documentationForNode(node);
        this.types[name] = type;
        return type;
    };
    Collector.prototype._symbolForNode = function (node) {
        return this._expandSymbol(this.checker.getSymbolAtLocation(node));
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
    Collector.prototype._referenceForSymbol = function (symbol) {
        this._walkSymbol(symbol);
        var referenced = this.types[this._nameForSymbol(symbol)];
        if (referenced && referenced.type === types.NodeType.INTERFACE) {
            referenced.concrete = true;
        }
        return {
            type: types.NodeType.REFERENCE,
            target: this._nameForSymbol(symbol),
        };
    };
    Collector.prototype._directiveFromDocTag = function (jsDocTag) {
        var directiveParams = {
            type: types.NodeType.METHOD_PARAMS,
            args: {},
        };
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
            type: types.NodeType.DIRECTIVE,
            name: jsDocTag.title,
            params: directiveParams,
        };
    };
    Collector.prototype._isNullable = function (node) {
        if (node.type === types.NodeType.REFERENCE) {
            var referenced = this.types[node.target];
            if (!referenced) {
                return false;
            }
            return this._isNullable(referenced);
        }
        else if (node.type === types.NodeType.ALIAS) {
            return this._isNullable(node.target);
        }
        return node.type !== types.NodeType.NOT_NULL;
    };
    return Collector;
}());
exports.default = Collector;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29sbGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL0NvbGxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFDQSwwQkFBNEI7QUFDNUIsdUNBQXlDO0FBRXpDLCtCQUFpQztBQUNqQyw2QkFBK0I7QUFDL0IsbUNBQThDO0FBRTlDLElBQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUM7QUFDekMsSUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQztBQUV2Qzs7O0dBR0c7QUFDSDtJQUtFLG1CQUFZLE9BQTBCO1FBQXRDLGlCQUVDO1FBTkQsVUFBSyxHQUFpQixFQUFFLENBQUM7UUFFakIsWUFBTyxHQUFvQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBeUI3RCxlQUFlO1FBRWYsY0FBUyxHQUFHLFVBQUMsSUFBb0I7WUFDL0IsMEJBQTBCO1lBQzFCLElBQUksS0FBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQzFCLE9BQU8sS0FBSSxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFlLENBQUM7YUFDN0M7WUFDRCxJQUFNLGFBQWEsR0FBMEIsRUFBRSxDQUFDO1lBQ2hELEtBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsQ0FBQztZQUN0QyxJQUFNLEdBQUcsR0FBSSxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFN0MsSUFBSSxNQUFNLEdBQW1CLElBQUksQ0FBQztZQUNsQyxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLG9CQUFvQixFQUFFO2dCQUNqRCxNQUFNLEdBQUcsS0FBSSxDQUFDLHlCQUF5QixDQUFrQyxJQUFJLENBQUMsQ0FBQzthQUNoRjtpQkFBTSxJQUFJLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLGVBQWUsRUFBRTtnQkFD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
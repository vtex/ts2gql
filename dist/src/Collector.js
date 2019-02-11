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
            var inherits = [];
            if (node.heritageClauses) {
                try {
                    for (var _a = __values(node.heritageClauses), _b = _a.next(); !_b.done; _b = _a.next()) {
                        var clause = _b.value;
                        try {
                            for (var _c = __values(clause.types), _d = _c.next(); !_d.done; _d = _c.next()) {
                                var type = _d.value;
                                var symbol = _this._symbolForNode(type.expression);
                                _this._walkSymbol(symbol);
                                inherits.push(_this._nameForSymbol(symbol));
                            }
                        }
                        catch (e_1_1) { e_1 = { error: e_1_1 }; }
                        finally {
                            try {
                                if (_d && !_d.done && (_e = _c.return)) _e.call(_c);
                            }
                            finally { if (e_1) throw e_1.error; }
                        }
                    }
                }
                catch (e_2_1) { e_2 = { error: e_2_1 }; }
                finally {
                    try {
                        if (_b && !_b.done && (_f = _a.return)) _f.call(_a);
                    }
                    finally { if (e_2) throw e_2.error; }
                }
            }
            return {
                type: types.NodeType.INTERFACE,
                members: node.members.map(_this._walkNode),
                inherits: inherits,
            };
            var e_2, _f, e_1, _e;
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
        var e_3, _a;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29sbGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL0NvbGxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFDQSwwQkFBNEI7QUFDNUIsdUNBQXlDO0FBRXpDLCtCQUFpQztBQUNqQyw2QkFBK0I7QUFDL0IsbUNBQThDO0FBRTlDLElBQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUM7QUFDekMsSUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQztBQUV2Qzs7O0dBR0c7QUFDSDtJQUtFLG1CQUFZLE9BQTBCO1FBQXRDLGlCQUVDO1FBTkQsVUFBSyxHQUFpQixFQUFFLENBQUM7UUFFakIsWUFBTyxHQUFvQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBeUI3RCxlQUFlO1FBRWYsY0FBUyxHQUFHLFVBQUMsSUFBb0I7WUFDL0IsMEJBQTBCO1lBQzFCLEVBQUUsQ0FBQyxDQUFDLEtBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDM0IsTUFBTSxDQUFDLEtBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBZSxDQUFDO1lBQzlDLENBQUM7WUFDRCxJQUFNLGFBQWEsR0FBMEIsRUFBRSxDQUFDO1lBQ2hELEtBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsQ0FBQztZQUN0QyxJQUFNLEdBQUcsR0FBSSxJQUFJLENBQUMsb0JBQW9CLENBQUMsSUFBSSxDQUFDLENBQUM7WUFFN0MsSUFBSSxNQUFNLEdBQW1CLElBQUksQ0FBQztZQUNsQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDLENBQUM7Z0JBQ2xELE1BQU0sR0FBRyxLQUFJLENBQUMseUJBQXlCLENBQWtDLElBQUksQ0FBQyxDQUFDO1lBQ2pGLENBQUM7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
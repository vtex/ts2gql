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
            var result = null;
            if (node.kind === SyntaxKind.InterfaceDeclaration) {
                result = _this._walkInterfaceDeclaration(node);
            }
            else if (node.kind === SyntaxKind.MethodSignature) {
                result = _this._walkMethodSignature(node);
            }
            else if (node.kind === SyntaxKind.PropertySignature) {
                result = _this._walkPropertySignature(node);
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
            throw new Error("Cannot override \"" + name + "\" - it was never included");
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
    Collector.prototype._walkMethodSignature = function (node) {
        try {
            var signature = this.checker.getSignatureFromDeclaration(node);
            var parameters = this._walkMethodParams(signature.getParameters());
            var methodDoc = util.documentationForNode(node);
            var directiveList = methodDoc ? this._retrieveDirectives(methodDoc) : [];
            return {
                type: types.NodeType.METHOD,
                name: node.name.getText(),
                parameters: parameters,
                returns: this._walkNode(node.type),
                directives: directiveList,
            };
        }
        catch (e) {
            e.message = "At method \"" + node.name.getText() + "\":\n" + e.message;
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
    Collector.prototype._walkMethodParams = function (params) {
        var argNodes = {};
        try {
            for (var params_1 = __values(params), params_1_1 = params_1.next(); !params_1_1.done; params_1_1 = params_1.next()) {
                var parameter = params_1_1.value;
                var parameterNode = parameter.valueDeclaration;
                argNodes[parameter.getName()] = this._walkNode(parameterNode.type);
            }
        }
        catch (e_3_1) { e_3 = { error: e_3_1 }; }
        finally {
            try {
                if (params_1_1 && !params_1_1.done && (_a = params_1.return)) _a.call(params_1);
            }
            finally { if (e_3) throw e_3.error; }
        }
        return {
            type: types.NodeType.METHOD_PARAMS,
            args: argNodes,
        };
        var e_3, _a;
    };
    Collector.prototype._walkPropertySignature = function (node) {
        var signature = this._walkNode(node.type);
        return {
            type: types.NodeType.PROPERTY,
            name: node.name.getText(),
            signature: (node.questionToken && signature.type === types.NodeType.NOT_NULL) ? signature.node : signature,
        };
    };
    Collector.prototype._walkTypeReferenceNode = function (node) {
        return { type: types.NodeType.NOT_NULL, node: this._referenceForSymbol(this._symbolForNode(node.typeName)) };
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
        return {
            type: types.NodeType.UNION,
            types: node.types.map(this._walkNode),
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
    return Collector;
}());
exports.default = Collector;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiQ29sbGVjdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vc3JjL0NvbGxlY3Rvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFDQSwwQkFBNEI7QUFDNUIsdUNBQXlDO0FBRXpDLCtCQUFpQztBQUNqQyw2QkFBK0I7QUFDL0IsbUNBQThDO0FBRTlDLElBQU0sVUFBVSxHQUFHLFVBQVUsQ0FBQyxVQUFVLENBQUM7QUFDekMsSUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQztBQUV2Qzs7O0dBR0c7QUFDSDtJQUtFLG1CQUFZLE9BQTBCO1FBQXRDLGlCQUVDO1FBTkQsVUFBSyxHQUFpQixFQUFFLENBQUM7UUFFakIsWUFBTyxHQUFvQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBeUI3RCxlQUFlO1FBRWYsY0FBUyxHQUFHLFVBQUMsSUFBb0I7WUFDL0IsMEJBQTBCO1lBQzFCLEVBQUUsQ0FBQyxDQUFDLEtBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQztnQkFDM0IsTUFBTSxDQUFDLEtBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBZSxDQUFDO1lBQzlDLENBQUM7WUFDRCxJQUFNLGFBQWEsR0FBMEIsRUFBRSxDQUFDO1lBQ2hELEtBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsQ0FBQztZQUV0QyxJQUFJLE1BQU0sR0FBbUIsSUFBSSxDQUFDO1lBQ2xDLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLEtBQUssVUFBVSxDQUFDLG9CQUFvQixDQUFDLENBQUMsQ0FBQztnQkFDbEQsTUFBTSxHQUFHLEtBQUksQ0FBQyx5QkFBeUIsQ0FBa0MsSUFBSSxDQUFDLENBQUM7WUFDakYsQ0FBQztZQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxLQUFLLFVBQVUsQ0FB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